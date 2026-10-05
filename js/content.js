/* 문안·공지 받아 오기: 깃허브 비공개 저장소(연결 코드) → 마지막으로 잘 받은 것 → 확장에 들어 있는 기본 문안
   2분마다(화면이 보일 때만) 바뀌었는지만 물어봄(바뀐 게 없으면 깃허브가 ‘그대로’만 알려 줌) */
(function (root) {
  'use strict';
  var S = root.CSStore, K = S.K, PERIOD = 2 * 60000;
  var running = null, listeners = [], bundled = null;

  function connOf() {
    var a = S.json(K.admin, null), c = S.json(K.conn, null);
    if (a && a.owner && a.repo && a.token) return Object.assign({ role: 'admin' }, a);
    if (c && c.owner && c.repo && c.token) return Object.assign({ role: 'reader' }, c);
    return null;
  }
  function repoKey(c) { return c.owner + '/' + c.repo + '/' + (c.path || 'cs-content.json'); }
  function setSync(patch) { var n = Object.assign({}, S.json(K.sync, {}), patch, { checkedAt: Date.now() }); S.put(K.sync, n); emit('sync'); return n; }
  function emit(what) { listeners.forEach(function (f) { try { f(what); } catch (e) {} }); }

  async function sync(force) {
    if (running) return running;
    running = (async function () {
      var conn = connOf();
      if (!conn) return setSync({ state: 'none', message: '' });
      var have = S.json(K.content, null), same = have && have.repo === repoKey(conn);
      try {
        var r = await KBGitHub.getFile(conn, !force && same && have.scripts ? have.etag : '');
        if (r.status === 304) return setSync({ state: 'ok', message: '', okAt: Date.now(), role: conn.role });
        if (r.status === 404) return setSync({ state: 'empty', message: '관리자가 아직 문안을 올리지 않았어요', role: conn.role });
        var p = KBData.parseContent(r.json);
        if (!p.scripts) return setSync({ state: 'bad', message: '받은 문안 파일이 비었거나 망가져 있어서 마지막으로 잘 받은 문안을 보여 줘요', role: conn.role });
        var next = { repo: repoKey(conn), sha: r.sha, etag: r.etag, at: Date.now(), scripts: p.scripts, notices: p.notices, sources: p.sources, updatedAt: p.updatedAt || 0 };
        if (!S.put(K.content, next)) return setSync({ state: 'error', message: '이 PC 저장 공간이 부족해요' });
        emit('content');
        return setSync({ state: 'ok', message: '', okAt: Date.now(), role: conn.role });
      } catch (e) {
        return setSync({ state: e.status === 401 || e.status === 403 || e.status === 404 ? 'auth' : 'error', message: e.message || '확인하지 못했어요', role: conn.role });
      }
    })();
    try { return await running; } finally { running = null; }
  }
  /* 지금 쓸 문안: { scripts, notices, sources, source:'github'|'bundled', sha } 또는 null */
  async function current() {
    var c = S.json(K.content, null);
    if (c && KBData.validScripts(c.scripts)) return { scripts: c.scripts, notices: c.notices || [], sources: c.sources || {}, source: 'github', sha: c.sha || '', at: c.at };
    if (!bundled && root.CSBridge) { try { var d = await CSBridge.call('defaults', {}, 15000); if (d && KBData.validScripts(d.scripts)) bundled = d.scripts; } catch (e) {} }
    if (bundled) return { scripts: bundled, notices: [], sources: {}, source: 'bundled', sha: 'bundled', at: Date.now() };
    return null;
  }
  async function setCode(code) {
    var c = KBData.readCode(code);
    if (!c) return { ok: false, error: '연결 코드 모양이 아니에요. 관리자에게 받은 코드를 통째로 붙여 넣어 주세요' };
    try {
      var r = await KBGitHub.getFile(c, '');
      if (r.status === 200 && !KBData.parseContent(r.json).scripts) return { ok: false, error: '연결은 됐지만 문안 파일이 비었거나 망가져 있어요. 관리자에게 알려 주세요' };
    } catch (e) { return { ok: false, error: e.message }; }
    S.put(K.conn, c);
    var s = await sync(true);
    return { ok: true, sync: s };
  }
  function clearConn() { S.del(K.conn); S.del(K.content); setSync({ state: 'none', message: '' }); emit('content'); }

  // 다른 탭(멘트 관리 등)에서 바꾸면 따라감
  window.addEventListener('storage', function (e) { if (e.key === K.content) emit('content'); else if (e.key === K.sync) emit('sync'); else if (e.key === K.conn || e.key === K.admin) sync(true); });
  setInterval(function () { if (!document.hidden) sync(false); }, PERIOD);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { var s = S.json(K.sync, {}); if (!s.checkedAt || Date.now() - s.checkedAt > 60000) sync(false); } });

  root.CSContent = { sync: sync, current: current, setCode: setCode, clearConn: clearConn, connOf: connOf, on: function (f) { listeners.push(f); }, status: function () { return S.json(K.sync, {}); } };
})(window);
