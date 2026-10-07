/* 멘트 관리(관리자, 웹) — 상담 데스크 '멘트 관리' 화면이 부르던 창구(KNOW_DATA · ADMIN_CALL)를 깃허브 저장소로 바꿔 끼운 것
   · 관리 키(쓰기)는 이 PC 이 브라우저(localStorage의 csx:kbAdmin)에만 있음. 상담사 PC에는 읽기 전용 '사용 키'가 연결 코드로만 감
   · 올릴 때마다 깃허브에 한 판(커밋)씩 남아서 [이전 판 · 되돌리기]로 언제든 되돌릴 수 있음
   · 멘트를 올릴 때는 공지·요청시트 주소를, 공지를 올릴 때는 멘트를 건드리지 않음(파일 하나 안에서 자기 칸만 바꿈) */
(function () {
  'use strict';
  var KEY = 'kbAdmin', VER_RE = /^멘트\s+(\d+)판/;
  var conn = null, last = null; // last: { sha, parsed, json }

  function nowStamp() { return KBData.stamp(Date.now()).slice(0, 16); }
  function localStamp(iso) { var t = Date.parse(iso); return t ? KBData.stamp(t).slice(0, 16) : ''; }
  async function getConn() { var d = await chrome.storage.local.get(KEY); conn = d[KEY] && d[KEY].token ? d[KEY] : null; return conn; }
  async function bundled() {
    // 기본 문안(운영 시트 258개)은 공개 주소에 올리지 않고 ‘검색기 연결’ 확장 안에만 있음
    try { var d = await CSBridge.call('defaults', {}, 15000); if (d && d.scripts) return JSON.parse(JSON.stringify(d.scripts)); } catch (e) {}
    throw new Error('기본 문안은 ‘슈피겐 CS 검색기 연결’ 확장이 깔린 PC에서만 가져올 수 있어요. 확장을 설치한 뒤 다시 해 주세요');
  }

  /* 지금 깃허브에 있는 파일(없으면 null) */
  async function remote() {
    var r = await KBGitHub.getFile(conn, '');
    if (r.status === 404) { last = { sha: '', parsed: null, json: null }; return last; }
    var parsed = KBData.parseContent(r.json);
    last = { sha: r.sha, parsed: parsed, json: r.json };
    return last;
  }
  function versionOf(p) { return p && p.scripts ? Number(p.scripts.version) || 0 : 0; }
  /* 다른 칸(공지·주소)은 그대로 두고 한 칸만 바꿔서 올림 */
  async function writeParts(change, message, expectSha) {
    var cur = await remote();
    if (expectSha !== undefined && cur.sha !== expectSha) { var e = new Error('그 사이 다른 곳에서 바뀌었어요'); e.conflict = true; throw e; }
    var p = cur.parsed || { scripts: null, notices: [], sources: { requests: [], defects: null } };
    var parts = { scripts: p.scripts, notices: p.notices, sources: p.sources };
    change(parts, p);
    if (!KBData.validScripts(parts.scripts)) { if (!parts.scripts) parts.scripts = await bundled(); else throw new Error('멘트가 하나도 없어서 올리지 않았어요'); }
    var file = KBData.buildFile(parts);
    var put = await KBGitHub.putFile(conn, file, cur.sha, message);
    // 이 PC의 상담 화면은 바로 바꿈(다른 PC는 2분 안에)
    var mine = KBData.parseContent(file);
    await chrome.storage.local.set({ kbContent: { repo: conn.owner + '/' + conn.repo + '/' + (conn.path || 'cs-content.json'), sha: put.sha, etag: '', at: Date.now(),
      scripts: mine.scripts, notices: mine.notices, sources: mine.sources, updatedAt: file.updatedAt } });
    last = { sha: put.sha, parsed: mine, json: file };
    return { put: put, parts: mine };
  }
  function cleanScripts(d) {
    var o = ScriptDiff.clean(d); delete o.at; delete o.by; delete o.note;
    return o;
  }

  async function handle(m) {
    try {
      if (!m || !m.type) return { ok: false };
      if (m.type === 'KNOW_REFRESH') return { ok: true };
      if (!(await getConn())) return { ok: true, status: { admin: false }, scripts: {} };
      if (m.type === 'KNOW_DATA') {
        var cur = await remote();
        if (m.since && m.since === cur.sha && cur.sha) return { ok: true, unchanged: true, status: statusOf(cur) };
        var sc = cur.parsed && cur.parsed.scripts ? Object.assign({}, cur.parsed.scripts, { fromServer: true }) : Object.assign(await bundled(), { version: 0, fromServer: false });
        return { ok: true, version: cur.sha || 'none', status: statusOf(cur), scripts: sc };
      }
      if (m.type === 'ADMIN_CALL') {
        var p = m.params || {};
        if (m.action === 'scripts.save') return await saveScripts(p.data, p.baseVersion, p.note);
        if (m.action === 'scripts.history') return { ok: true, items: await historyItems() };
        if (m.action === 'scripts.restore') {
          var items = await historyItems(), h = items.find(function (x) { return x.version === Number(p.version); });
          if (!h) return { ok: false, error: '그 판을 찾지 못했어요' };
          var old = await KBGitHub.getFile(conn, '', h.sha);
          var op = old.status === 200 ? KBData.parseContent(old.json) : null;
          if (!op || !op.scripts) return { ok: false, error: '그 판의 멘트를 읽지 못했어요' };
          return await saveScripts(op.scripts, p.baseVersion, h.version + '판으로 되돌림');
        }
      }
      return { ok: false, error: '알 수 없는 요청' };
    } catch (e) {
      return { ok: false, error: e.message || String(e), conflict: !!e.conflict };
    }
  }
  function statusOf(cur) {
    var s = cur.parsed && cur.parsed.scripts;
    return { admin: true, scriptsAt: s && s.at ? String(s.at) : '', scriptsBy: s && s.by ? String(s.by) : '' };
  }
  async function saveScripts(data, baseVersion, note) {
    var cur = await remote(), ver = versionOf(cur.parsed);
    if (Number(baseVersion) !== ver) return { ok: false, conflict: true };
    var next = ver + 1, clean = cleanScripts(data);
    var ck = ScriptDiff.check(clean); if (ck.errors.length) return { ok: false, error: '고칠 곳이 남아 있어요: ' + ck.errors[0].text };
    clean.version = next; clean.at = nowStamp(); clean.by = conn.name || ''; clean.note = String(note || '').slice(0, 190);
    clean.format = 'cs-scripts-1';
    try {
      await writeParts(function (parts) { parts.scripts = clean; }, '멘트 ' + next + '판 · ' + (clean.note || '멘트 고침'), cur.sha);
    } catch (e) { if (e.conflict) return { ok: false, conflict: true }; throw e; }
    return { ok: true, version: next };
  }
  async function historyItems() {
    var list = await KBGitHub.history(conn, 80);
    return list.map(function (c) {
      var m = VER_RE.exec(c.message); if (!m) return null;
      return { version: Number(m[1]), at: localStamp(c.at), by: c.by, note: c.message.replace(VER_RE, '').replace(/^\s*·\s*/, ''), sha: c.sha };
    }).filter(Boolean);
  }

  /* 공지 · 요청시트 주소 · 연결 화면에서 쓰는 것 */
  async function latest() { await getConn(); if (!conn) throw new Error('깃허브 연결이 필요해요'); return remote(); }
  async function saveNotices(fn, message) { await getConn(); return writeParts(function (parts) { parts.notices = fn(parts.notices.slice()); }, message); }
  // 화면마다 자기 칸만 바꿈(요청시트 화면이 팀 서버 주소를 지우지 않게)
  async function saveSources(sources, message) { await getConn(); return writeParts(function (parts) { parts.sources = Object.assign({}, parts.sources || {}, sources); }, message || '요청시트 주소 바꿈'); }

  /* 화면 밝기: 검색기 설정(밝게 · 어둡게 · 시스템 따라)과 같음 */
  window.ReplyTheme = {
    watch: function (o) {
      var media = matchMedia('(prefers-color-scheme: dark)');
      var apply = function () { var t = ''; try { t = localStorage.getItem('cx_gas_workbench_theme_v2') || ''; } catch (e) {} o.apply(t === 'dark' || (t !== 'light' && media.matches) ? 'dark' : 'light'); };
      window.addEventListener('storage', function (e) { if (e.key === 'cx_gas_workbench_theme_v2') apply(); });
      media.addEventListener('change', apply); apply();
    }
  };
  window.KBAdmin = { handle: handle, latest: latest, saveNotices: saveNotices, saveSources: saveSources, getConn: getConn, bundled: bundled, KEY: KEY };
})();
