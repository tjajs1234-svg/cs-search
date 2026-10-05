/* 깃허브 저장소의 파일 하나(cs-content.json)를 읽고 쓰기. 백그라운드(상담사 동기화)와 멘트 관리(관리자 올리기)가 같이 씀.
   키(토큰)는 이 PC의 chrome.storage.local 에만 있고, 요청할 때 깃허브로만 보냄. */
(function (root) {
  'use strict';
  var API = 'https://api.github.com';
  var TIMEOUT = 20000;

  function utf8b64(s) { var u = new TextEncoder().encode(String(s)), b = ''; for (var i = 0; i < u.length; i += 0x8000) b += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(b); }
  function b64utf8(s) { var b = atob(String(s || '').replace(/\s+/g, '')), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new TextDecoder().decode(u); }
  function enc(p) { return String(p || '').split('/').map(encodeURIComponent).join('/'); }
  function repoPath(c) { return '/repos/' + encodeURIComponent(c.owner) + '/' + encodeURIComponent(c.repo); }
  function filePath(c) { return c.path || 'cs-content.json'; }

  function GhError(status, message, extra) { var e = new Error(message); e.status = status; if (extra) for (var k in extra) e[k] = extra[k]; return e; }
  function friendly(status, body, res) {
    var msg = body && body.message ? String(body.message) : '';
    if (status === 0) return '인터넷 연결을 확인해 주세요(깃허브에 닿지 않아요)';
    if (status === 401) return '키가 맞지 않거나 기한이 지났어요. 관리자에게 새 연결 코드를 받아 주세요';
    if (status === 403 || status === 429) {
      var left = res && res.headers ? res.headers.get('x-ratelimit-remaining') : null;
      if (left === '0' || status === 429) return '깃허브에 잠깐 요청이 너무 많아요. 몇 분 뒤 저절로 다시 해요';
      return '이 키로는 저장소에 권한이 없어요(키를 만들 때 저장소와 Contents 권한을 확인해 주세요)';
    }
    if (status === 404) return '저장소나 파일을 찾지 못했어요(저장소 이름 · 키의 저장소 선택을 확인해 주세요)';
    if (status === 409) return '그 사이 다른 곳에서 파일이 바뀌었어요';
    if (status === 422) return '깃허브가 받지 않았어요' + (msg ? ' (' + msg + ')' : '');
    if (status >= 500) return '깃허브가 잠깐 응답하지 않아요. 저절로 다시 해요';
    return '깃허브 오류 ' + status + (msg ? ' · ' + msg : '');
  }
  async function call(conn, method, path, opt) {
    opt = opt || {};
    if (!conn || !conn.token) throw GhError(-1, '연결 정보가 없어요');
    var headers = { 'Authorization': 'Bearer ' + conn.token, 'Accept': opt.accept || 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (opt.etag) headers['If-None-Match'] = opt.etag;
    if (opt.body) headers['Content-Type'] = 'application/json';
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, opt.timeout || TIMEOUT) : 0;
    var res;
    try { res = await fetch(API + path, { method: method, headers: headers, body: opt.body ? JSON.stringify(opt.body) : undefined, cache: 'no-store', signal: ctl ? ctl.signal : undefined }); }
    catch (e) { throw GhError(0, friendly(0)); }
    finally { if (timer) clearTimeout(timer); }
    if (res.status === 304) return { status: 304, res: res, body: null };
    var body = null; try { body = await res.json(); } catch (e) { body = null; }
    if (!res.ok) throw GhError(res.status, friendly(res.status, body, res), { body: body });
    return { status: res.status, res: res, body: body };
  }

  /* 파일 읽기. etag가 같으면 {status:304}. 파일이 아직 없으면 {status:404} */
  async function getFile(conn, etag, ref) {
    var q = ref || conn.branch ? '?ref=' + encodeURIComponent(ref || conn.branch) : '';
    try {
      var r = await call(conn, 'GET', repoPath(conn) + '/contents/' + enc(filePath(conn)) + q, { etag: etag });
      if (r.status === 304) return { status: 304 };
      var b = r.body || {};
      var text;
      if (typeof b.content === 'string' && b.encoding === 'base64' && b.content) text = b64utf8(b.content);
      else if (b.git_url || b.sha) {
        // 1MB가 넘는 파일은 content가 비어 오므로 원문으로 다시 받음
        var raw = await fetch(API + repoPath(conn) + '/contents/' + enc(filePath(conn)) + q, { headers: { 'Authorization': 'Bearer ' + conn.token, 'Accept': 'application/vnd.github.raw', 'X-GitHub-Api-Version': '2022-11-28' }, cache: 'no-store' });
        if (!raw.ok) throw GhError(raw.status, friendly(raw.status));
        text = await raw.text();
      } else throw GhError(422, '파일 모양이 달라요');
      var json; try { json = JSON.parse(text); } catch (e) { throw GhError(422, '파일이 망가져 있어요(JSON 형식이 아님)'); }
      return { status: 200, sha: b.sha || '', etag: r.res.headers.get('etag') || '', json: json, size: text.length };
    } catch (e) {
      if (e.status === 404) return { status: 404 };
      throw e;
    }
  }
  async function putFile(conn, obj, sha, message) {
    var body = { message: String(message || '내용 바꿈').slice(0, 200), content: utf8b64(JSON.stringify(obj, null, 1) + '\n') };
    if (sha) body.sha = sha;
    if (conn.branch) body.branch = conn.branch;
    try {
      var r = await call(conn, 'PUT', repoPath(conn) + '/contents/' + enc(filePath(conn)), { body: body, timeout: 30000 });
      var b = r.body || {};
      return { sha: b.content && b.content.sha || '', commit: b.commit && b.commit.sha || '', at: b.commit && b.commit.author && b.commit.author.date || '' };
    } catch (e) {
      // sha가 옛것이면 409(가끔 422 "does not match")
      if (e.status === 409 || (e.status === 422 && /sha|match/i.test(e.body && e.body.message || ''))) throw GhError(409, friendly(409), { conflict: true });
      throw e;
    }
  }
  async function history(conn, n) {
    var q = '?path=' + encodeURIComponent(filePath(conn)) + '&per_page=' + (n || 60) + (conn.branch ? '&sha=' + encodeURIComponent(conn.branch) : '');
    var r;
    try { r = await call(conn, 'GET', repoPath(conn) + '/commits' + q); }
    catch (e) { if (e.status === 409 || e.status === 404) return []; throw e; } // 빈 저장소
    return (Array.isArray(r.body) ? r.body : []).map(function (c) {
      var m = c.commit || {}, a = m.author || {};
      return { sha: c.sha, message: String(m.message || '').split('\n')[0], at: a.date || '', by: a.name || (c.author && c.author.login) || '' };
    });
  }
  async function repoInfo(conn) {
    var r = await call(conn, 'GET', repoPath(conn));
    var b = r.body || {};
    return { private: !!b.private, defaultBranch: b.default_branch || 'main', fullName: b.full_name || '', push: !!(b.permissions && b.permissions.push) };
  }

  var api = { getFile: getFile, putFile: putFile, history: history, repoInfo: repoInfo, friendly: friendly, utf8b64: utf8b64, b64utf8: b64utf8 };
  root.KBGitHub = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
