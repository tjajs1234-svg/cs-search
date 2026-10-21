/* 팀 서버(Apps Script) 부르기 — 요청·건의 게시판 · 멘트 사용 통계 · 팀 현황. 검색기와 멘트 관리가 같이 씀.
   주소는 멘트 관리 ‘팀 서버 연결’에서 저장하면 cs-content.json(sources.team)으로 모든 상담사에게 전해짐 */
(function (root) {
  'use strict';
  var TOKEN = '1234', url = '';
  function valid(u) { return /^https:\/\/script\.google\.com\/macros\/s\/[\w-]{20,}\/exec$/.test(String(u || '').trim()); }
  function set(u) { url = valid(u) ? String(u).trim() : ''; }
  async function call(action, params, ms, keepalive) {
    if (!url) throw new Error('팀 서버가 아직 연결되지 않았어요');
    var ctl = typeof AbortController === 'function' ? new AbortController() : null, t = ctl ? setTimeout(function () { ctl.abort(); }, ms || 20000) : 0;
    try {
      // text/plain: 브라우저가 미리 묻지 않고(preflight 없음) 바로 보냄 → 앱스크립트가 받을 수 있음
      var res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ token: TOKEN, action: action }, params || {})), redirect: 'follow', signal: ctl ? ctl.signal : undefined, keepalive: !!keepalive, cache: 'no-store' });
      var j = await res.json().catch(function () { return null; });
      if (!j) throw new Error('팀 서버 대답을 읽지 못했어요(' + res.status + ')');
      if (!j.ok) { var se = new Error(j.error || '팀 서버에서 처리하지 못했어요'); se.server = true; throw se; }
      return j;
    } catch (e) { if (e && e.name === 'AbortError') throw new Error('팀 서버가 대답하지 않아요. 잠시 뒤 다시 해 주세요'); throw e; }
    finally { if (t) clearTimeout(t); }
  }
  // 읽기는 잠깐(기본 15초) 기억해 두고 같은 걸 또 부르면 바로 줌 · 쓰기(글·댓글·승인 등)를 하면 기억을 비움
  var memo = {}, READ = /(\.get|\.list|\.reads)$|^(ping|admin\.check)$/;
  function get(action, params, maxAge) {
    var k = action + JSON.stringify(params || {}), m = memo[k];
    if (m && Date.now() - m.at < (maxAge == null ? 15000 : maxAge)) return m.p;
    var p = call(action, params); memo[k] = { at: Date.now(), p: p };
    p.catch(function () { if (memo[k] && memo[k].p === p) delete memo[k]; });
    return p;
  }
  // 기억해 둔 읽기가 있으면 몇 ms 전에 받았는지(없으면 -1)
  function peek(action, params) { var m = memo[action + JSON.stringify(params || {})]; return m ? Date.now() - m.at : -1; }
  var rawCall = call;
  // 읽기는 인터넷이 잠깐 끊기거나 서버가 늦으면 한 번 더 물어봄(서버가 ‘안 돼요’라고 답한 건 다시 안 물음)
  call = async function (action, params, ms, keepalive) {
    if (!READ.test(action)) { memo = {}; return rawCall(action, params, ms, keepalive); }
    try { return await rawCall(action, params, ms, keepalive); }
    catch (e) { if (e && e.server) throw e; await new Promise(function (r) { setTimeout(r, 700); }); return rawCall(action, params, ms, keepalive); }
  };
  root.CSTeam = { valid: valid, set: set, call: function (a, p, m, k) { return call(a, p, m, k); }, get: get, peek: peek, ready: function () { return !!url; }, get url() { return url; } };
})(typeof globalThis !== 'undefined' ? globalThis : this);
