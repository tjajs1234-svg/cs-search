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
      if (!j.ok) throw new Error(j.error || '팀 서버에서 처리하지 못했어요');
      return j;
    } catch (e) { if (e && e.name === 'AbortError') throw new Error('팀 서버가 대답하지 않아요. 잠시 뒤 다시 해 주세요'); throw e; }
    finally { if (t) clearTimeout(t); }
  }
  root.CSTeam = { valid: valid, set: set, call: call, ready: function () { return !!url; }, get url() { return url; } };
})(typeof globalThis !== 'undefined' ? globalThis : this);
