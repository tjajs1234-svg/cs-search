/* 2026-11-16 주인(1-3 ㄱ): 관리 왼쪽 메뉴 한눈에
   · 팀·공지·QA 같은 화면에선 가운데 '멘트 분류' 상자를 숨기고, 메뉴에 [멘트 · 분류] 한 줄(누르면 멘트 화면 · 분류 목록은 그때만 보임)
   · 메뉴 옆 할 일 숫자: QA 피드백 = 보냈는데 상담사가 아직 안 본 피드백 · 요청·건의 = 지난번에 이 PC에서 연 뒤 새 글·댓글
     · 공지 = 가장 최근 관리 공지를 아직 확인 안 한 사람(명단 기준) — 못 세면 숫자 없음(지어내지 않음)
   · 서버 자료만 읽음(쓰지 않음) · 2분마다 다시 셈 */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  var SEEN = 'kb:boardSeen';
  function badge(view, n, title) {
    var b = document.querySelector('.navx[data-view="' + view + '"]'); if (!b) return;
    var s = b.querySelector('.nbadge');
    if (!n) { if (s) s.remove(); return; }
    if (!s) { s = document.createElement('span'); s.className = 'nbadge'; b.append(s); }
    s.textContent = n > 99 ? '99+' : String(n); s.title = title;
  }
  async function qa() {
    var tok = await KBTeam.adminToken(); if (!tok) return;
    var r = await CSTeam.call('inc.get', { adminToken: tok }); if (!r || !r.ok) return;
    var n = 0, ms = (r.inc && r.inc.months) || {};
    Object.keys(ms).forEach(function (m) { (ms[m].qa || []).forEach(function (e) { if (e && e.sent && !e.ack) n++; }); });
    badge('qafb', n, '보냈는데 상담사가 아직 안 본 피드백 ' + n + '건');
  }
  async function board() {
    var r = await CSTeam.call('board.list', {}); if (!r || !r.ok) return;
    var seen = Number(localStorage.getItem(SEEN) || 0), n = 0;
    if (!seen) { localStorage.setItem(SEEN, String(Date.now())); return; } // 처음 연 PC는 지금부터 셈
    (r.posts || []).forEach(function (p) { if ((p.at || 0) > seen) n++; (p.comments || []).forEach(function (c) { if ((c.at || 0) > seen) n++; }); });
    badge('board', n, '지난번에 연 뒤 새 글 · 댓글 ' + n + '개');
  }
  async function notices() {
    if (!window.KBAdmin || !window.KBTeam2) return;
    var got = await Promise.all([CSTeam.get('notice.reads', {}), KBAdmin.latest().then(function (c) { return c.parsed || null; }), KBTeam2.teamNames([])]);
    var reads = (got[0] && got[0].reads) || {}, cp = got[1], names = (got[2] || []).filter(function (x) { return x && x !== '팀장'; });
    if (!cp || !names.length) return;
    var list = (cp.notices || []).filter(function (x) { return x && !x.hidden; }).sort(function (a, b) { return Math.max(b.at || 0, b.ed || 0) - Math.max(a.at || 0, a.ed || 0); });
    var n0 = list[0]; if (!n0) return;
    var id = 'a:' + n0.id + (n0.rev ? ':' + n0.rev : ''), rd = ((reads[id] || {}).reads) || {}, P = KBTeam.person, done = {};
    Object.keys(rd).forEach(function (k) { done[P(k)] = 1; });
    var left = names.map(P).filter(function (x, i, a) { return a.indexOf(x) === i && !done[x]; });
    badge('notices', left.length, '최근 공지 「' + (n0.title || '') + '」를 아직 확인 안 한 사람: ' + left.join(' · '));
  }
  function count() { [qa, board, notices].forEach(function (f) { f().catch(function () { }); }); }
  function menu() {
    var top = document.querySelector('.navs.navtop'), g = top && top.querySelector('.navx[data-view="notices"]');
    if (!g || document.getElementById('navMent')) return;
    var b = document.createElement('button'); b.className = 'navx'; b.type = 'button'; b.id = 'navMent';
    b.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h12M4 10h12M4 15h8"/></svg>';
    b.append('멘트 · 분류');
    b.addEventListener('click', function () { var a = document.querySelector('#catList .cat.all'); if (a) a.click(); });
    g.after(b);
    var sync = function () { b.setAttribute('aria-current', String(!document.body.classList.contains('vnoment'))); };
    new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] }); sync();
    var bv = document.querySelector('.navx[data-view="board"]'); if (bv) bv.addEventListener('click', function () { localStorage.setItem(SEEN, String(Date.now())); badge('board', 0); });
  }
  function start() {
    menu();
    if (!window.CSTeam || !window.KBTeam) return setTimeout(start, 300);
    setTimeout(count, 1500); setInterval(count, 120000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.KBAdminBadges = { count: count };
})();
