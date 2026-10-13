/* 지금 이 PC 상담사 이름 — 기록기(크롬 확장)에게 물어봄. 요청·건의 · 공지 확인 · 근무(야근 신청)에 이름 칸 없이 씀
   · 기록기 2.4.0부터 이 검색기 주소에서 오는 ‘이름 알려 줘’에만 대답함(태그에서 성 뺀 이름: 영원3 → 영원 · 팀장 PC는 ‘팀장’)
   · 기록기가 없거나 태그가 비어 있으면 '' → 화면이 이름 칸을 보여 줌(한 번 적으면 이 PC에 기억) */
(function (root) {
  'use strict';
  var STORE_ID = 'ipnpdnmlapjngngnkmoeohlodkejhnih', AUTO = 'csx:autoName', MANUAL = 'csx:myName', OVERRIDE = 'csx:recorderId';
  var auto = '', listeners = [], asked = 0;
  try { auto = String(localStorage.getItem(AUTO) || ''); } catch (e) {}
  function ids() { var o = ''; try { o = String(localStorage.getItem(OVERRIDE) || ''); } catch (e) {} return (/^[a-p]{32}$/.test(o) ? [o] : []).concat([STORE_ID]); }
  function ask(id) {
    return new Promise(function (resolve) {
      var done = false, t = setTimeout(function () { if (!done) { done = true; resolve(null); } }, 1500);
      try {
        var rt = root.chrome && root.chrome.runtime;
        if (!rt || typeof rt.sendMessage !== 'function') { clearTimeout(t); resolve(null); return; }
        rt.sendMessage(id, { type: 'CS_WHOAMI' }, function (r) { void (rt.lastError); if (done) return; done = true; clearTimeout(t); resolve(r && r.ok ? r : null); });
      } catch (e) { if (!done) { done = true; clearTimeout(t); resolve(null); } }
    });
  }
  async function refresh() {
    asked = Date.now();
    var list = ids();
    for (var i = 0; i < list.length; i++) {
      var r = await ask(list[i]);
      if (r) {
        var n = String(r.name || '').trim().slice(0, 20), was = auto; auto = n;
        try { if (n) localStorage.setItem(AUTO, n); else localStorage.removeItem(AUTO); } catch (e) {}
        if (was !== n) listeners.forEach(function (fn) { try { fn(n); } catch (e) {} });
        return n;
      }
    }
    return auto;
  }
  function manual() { try { return String(localStorage.getItem(MANUAL) || '').trim(); } catch (e) { return ''; } }
  root.CSWho = {
    refresh: refresh,
    // 기록기가 알려 준 이름(없으면 예전에 손으로 적은 이름)
    name: function () { return auto || manual(); },
    auto: function () { return auto; },
    setManual: function (v) { try { localStorage.setItem(MANUAL, String(v || '').trim().slice(0, 20)); } catch (e) {} },
    on: function (fn) { listeners.push(fn); },
    get askedAt() { return asked; }
  };
  refresh();
  setInterval(function () { if (!document.hidden) refresh(); }, 5 * 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && Date.now() - asked > 60000) refresh(); });
})(typeof globalThis !== 'undefined' ? globalThis : this);
