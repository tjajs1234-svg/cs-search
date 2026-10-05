/* 멘트 관리 화면은 원래 확장 안에서 돌던 코드라 chrome.storage · KBSheets를 씀.
   웹에서는: 저장 = 이 브라우저 localStorage('csx:' + 이름, 검색기 화면과 같은 곳) · 시트 읽어 보기 = ‘검색기 연결’ 확장 */
(function () {
  'use strict';
  var PFX = 'csx:', listeners = [];
  function read(k) { try { var v = localStorage.getItem(PFX + k); return v == null ? undefined : JSON.parse(v); } catch (e) { return undefined; } }
  function emit(changes) { listeners.forEach(function (f) { try { f(changes, 'local'); } catch (e) {} }); }
  var local = {
    get: function (keys) {
      var list = keys == null ? [] : Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(keys), out = {};
      list.forEach(function (k) { var v = read(k); if (v !== undefined) out[k] = v; });
      return Promise.resolve(out);
    },
    set: function (obj) {
      var ch = {};
      try { Object.keys(obj).forEach(function (k) { var old = read(k); localStorage.setItem(PFX + k, JSON.stringify(obj[k])); ch[k] = { oldValue: old, newValue: obj[k] }; }); }
      catch (e) { return Promise.reject(new Error('이 브라우저 저장 공간이 부족해요')); }
      emit(ch); return Promise.resolve();
    },
    remove: function (keys) {
      var ch = {}; (Array.isArray(keys) ? keys : [keys]).forEach(function (k) { var old = read(k); try { localStorage.removeItem(PFX + k); } catch (e) {} ch[k] = { oldValue: old }; });
      emit(ch); return Promise.resolve();
    }
  };
  window.addEventListener('storage', function (e) {
    if (!e.key || e.key.indexOf(PFX) !== 0) return; var k = e.key.slice(PFX.length), ch = {};
    try { ch[k] = { oldValue: e.oldValue ? JSON.parse(e.oldValue) : undefined, newValue: e.newValue ? JSON.parse(e.newValue) : undefined }; } catch (er) { return; }
    emit(ch);
  });
  window.chrome = { storage: { local: local, onChanged: { addListener: function (f) { listeners.push(f); } } }, runtime: { sendMessage: function () { return Promise.resolve({ ok: true }); }, id: 'web' } };

  function check(kind, src) {
    return CSBridge.call('check', { kind: kind, url: src.url, label: src.label || '' }, 90000).then(function (r) {
      r = r || {}; return { rows: new Array(r.count || 0), items: new Array(r.count || 0).fill(0).map(function (_, i) { return i === 0 ? { title: r.first || '' } : {}; }), warnings: r.warnings || [], map: r.map || {} };
    });
  }
  window.KBSheets = {
    FIELD_KO: { code: '상품코드', date: '인입날짜', inquiry: '고객 문의 내용', name: '제품명', type: '문의 유형', question: '상담 질문', final: '최종 답변', feedback: '매니저 피드백', agent: '담당자', channel: '인입 채널', attach: '사진' },
    hasAccess: function () { return CSBridge.wait(1500); },
    askAccess: function () { return CSBridge.wait(1500); },
    readRequests: function (s) { return check('req', s); },
    readDefects: function (s) { return check('def', s); },
    readNotice: function (s) { return check('notice', s); }
  };
})();
