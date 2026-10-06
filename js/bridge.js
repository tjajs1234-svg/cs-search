/* ‘슈피겐 CS 검색기 연결’ 확장과 이야기하기(연결 다리)
   확장이 이 페이지에 작은 연결 코드(content script)를 넣어 두면, 페이지 ⇄ 확장이 window.postMessage로 주고받음.
   확장이 없거나 꺼져 있으면 ready=false — 스크립트 화면은 그대로 되고, 요청시트·불량·족보 공지·사진만 안내로 바뀜 */
(function (root) {
  'use strict';
  var pending = new Map(), seq = 0, helloWaiters = [];
  var B = { ready: false, version: '', info: null };

  function onHello(d) {
    var first = !B.ready; B.ready = true; B.version = String(d.version || ''); B.info = d;
    helloWaiters.splice(0).forEach(function (f) { f(true); });
    if (first) document.dispatchEvent(new CustomEvent('csbridge', { detail: d }));
  }
  window.addEventListener('message', function (e) {
    if (e.source !== window || e.origin !== location.origin) return;
    var d = e.data; if (!d || typeof d !== 'object') return;
    if (d.cs === 'csb-hello') { onHello(d); return; }
    if (d.cs === 'csb-event') { document.dispatchEvent(new CustomEvent('csbridge-event', { detail: d })); return; }
    if (d.cs === 'csb-res' && pending.has(d.id)) {
      var p = pending.get(d.id); pending.delete(d.id); clearTimeout(p.t);
      if (d.ok) p.res(d.data); else { var err = new Error(d.error || '확장이 처리하지 못했어요'); err.kind = d.kind || ''; p.rej(err); }
    }
  });
  /* 확장이 먼저 와 있으면 표시가 붙어 있음. 없으면 한 번 불러 봄 */
  B.wait = function (ms) {
    if (B.ready) return Promise.resolve(true);
    return new Promise(function (res) {
      helloWaiters.push(res);
      try { window.postMessage({ cs: 'csb-ping' }, location.origin); } catch (e) {}
      setTimeout(function () { var i = helloWaiters.indexOf(res); if (i >= 0) { helloWaiters.splice(i, 1); res(false); } }, ms || 1500);
    });
  };
  B.call = function (op, args, ms) {
    return B.wait(1500).then(function (ok) {
      if (!ok) { var e = new Error('‘검색기 연결’ 확장이 없어요'); e.kind = 'no-bridge'; throw e; }
      return new Promise(function (res, rej) {
        var id = 'q' + (++seq) + '_' + Date.now().toString(36);
        var t = setTimeout(function () { pending.delete(id); var e = new Error('확장 응답이 늦어요'); e.kind = 'timeout'; rej(e); }, ms || 20000);
        pending.set(id, { res: res, rej: rej, t: t });
        window.postMessage({ cs: 'csb-req', id: id, op: op, args: args || {} }, location.origin);
      });
    });
  };
  if (document.documentElement && document.documentElement.dataset.csBridge) onHello({ version: document.documentElement.dataset.csBridge });
  root.CSBridge = B;
})(window);
