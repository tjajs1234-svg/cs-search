/* 검색기 [팀 기록] 탭(2026-11-01 주인): 누구나 봄 · 늘 오늘만
   · 시간당 기록(시간당 많은 순) · 오늘 기록 · 문의 분류(카테고리별 건수)
   · 2026-11-03 주인: 응대(답한 고객 · 기록 상관없음)를 같은 표에 나란히 — 시간당 응대 많은 순
   · 주인 결정: 등수·'1등'·팀 평균과 차이·일한 시간 칸 없음, '어려운 상담' 말·비율·색 없음(기록할 때 카테고리를 일부러 고르지 않게)
   · 기간 고르기는 관리 화면 팀 현황 [팀 기록]에서만 · 숫자 세기는 teamstats.js(관리 화면과 같음)
   · 2026-11-03 한줄평(주인): 표 오른쪽 칸에 칭찬 한 문장(초록) + 피드백 한 문장 · 정시마다 바뀜(그 시간 안에서는 붙잡아 둠) · 문장은 teamstats.js oneLine
     게시판 위주인 사람은 맨 위 · 시간당 응대·한줄평 '–'
   · 2026-11-03.6 주인: 칸 이름 응대 / 완료(기록)(묶음 제목 줄 없앰, 표 아래 한 줄 설명) · 칭찬은 있을 때만 · 피드백 여러 개(동시 진행 맨 위, 5건 미만은 빨간 글씨)
   · 2026-11-03.7 정시 팝업(주인): 한줄평이 바뀌는 정시 뒤 검색기를 처음 볼 때 '내 한줄평 + 오늘 누적 응대·완료' 팝업 · [네, 확인했어요]만 눌러야 닫힘(팀 기록으로 안 옮겨 감)
     · 한 PC에 1시간 한 번(csx:hourPop) · 11시~퇴근 전 · 점심(12:30~14:00)·쉬는 날·게시판 위주·이름 모름이면 안 띄움 · 입력 중이거나 공지 확인 창이 떠 있으면 기다림
     · 검색기 웹 안에서만 뜸(카톡·톡톡 화면엔 안 뜸)
   · 자료: 팀 서버 team.get · qa.get(읽기만, 지난 근무일 비교용으로 4일) · 고객 이름·내용은 안 다룸 */
(function (root) {
  'use strict';
  var timer = 0, gen = 0, last = null, err = '', held = { key: '', lines: {} };
  function $(id) { return document.getElementById(id); }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function f1(v) { return (Math.round(v * 10) / 10).toFixed(1); }
  function me() { try { return KBTeamStats.person(root.CSWho ? CSWho.name() : ''); } catch (e) { return ''; } }
  function hhmm(ms) { var d = new Date(ms + 9 * 3600e3); return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'); }
  function md(k) { return Number(k.slice(5, 7)) + '/' + Number(k.slice(8, 10)) + '(' + '일월화수목금토'[WorkClock.weekday(k)] + ')'; }

  async function load() {
    var my = ++gen;
    if (!CSTeam.ready()) return;
    var keys = KBTeamStats.periodKeys('today');
    try {
      var got = await Promise.all([CSTeam.get('team.get', { days: 4 }, 50000), CSTeam.get('qa.get', { days: 4 }, 50000).catch(function () { return null; }), CSTeam.get('cfg.get', {}, 600000).catch(function () { return null; }), CSTeam.get('ot.list', { from: keys[0], to: keys[keys.length - 1] }, 50000).catch(function () { return null; })]);
      if (my !== gen) return;
      var off = !!((got[2] || {}).cfg || {}).offseason, opt = { roster: (got[2] || {}).roster, ot: (got[3] || {}).items || [] }, pw = KBTeamStats.prevWorkday(keys[0]), prev = {};
      if (got[0] && got[0].days && got[0].days[pw.key]) KBTeamStats.compute(got[0], got[1], [pw.key], opt).people.forEach(function (o) { if (o.ph != null) prev[o.n] = { ph: o.ph, label: pw.label }; });
      last = { R: KBTeamStats.compute(got[0], got[1], keys, opt), prev: prev, off: off, cfg: (got[2] || {}).cfg || {}, at: Date.now() }; err = '';
    } catch (e) { if (my !== gen) return; err = e.message || '불러오지 못했어요'; }
    render();
  }
  function render() {
    var L = $('rlistT'); if (!L) return; L.replaceChildren();
    var td = KBTeamStats.periodKeys('today')[0], head = el('div', 'bhead');
    head.append(el('h2', null, '팀 기록 · 오늘 ' + md(td)));
    var hp = el('p', null, '오늘 10:00부터 지금까지예요. '); if (last) hp.append(el('span', 'trk-upd', hhmm(last.at) + ' 기준 · 1분마다 새로 고쳐져요')); head.append(hp); L.append(head);
    if (!last) { L.append(el('div', 'empty', err ? '불러오지 못했어요.\n' + err : '불러오는 중…')); return; }
    if (err) L.append(el('div', 'scope', '새로 불러오지 못해 지난번 숫자를 보여 줘요 · ' + err));
    var R = last.R, mine = me(), wrap = el('div', 'trk');
    if (!R.people.length) { wrap.append(el('div', 'empty', WorkClock.day(td, {}) ? '오늘 기록이 아직 없어요.' : '오늘은 쉬는 날이에요.')); L.append(wrap); return; }
    var mo = R.people.filter(function (o) { return o.n === mine; })[0];
    if (mo) {
      var ml = el('div', 'trk-me'); ml.append(mine + ' 님 오늘 ');
      if (mo.rph != null && !mo.board) ml.append('시간당 ', el('b', null, '응대 ' + f1(mo.rph) + '명'), mo.ph != null ? ' · 완료 ' + f1(mo.ph) + '건이에요. ' : '이에요. ');
      else if (mo.ph != null) { ml.append('시간당 ', el('b', null, '완료 ' + f1(mo.ph) + '건'), '이에요. '); }
      ml.append('지금까지 응대 ', el('b', null, mo.resp + '명'), ' · 완료 ', el('b', null, mo.rec + '건'), '이에요.'); wrap.append(ml);
    }
    // 시간당 기록
    var b1 = el('div', 'trk-box'); b1.append(el('h3', null, '시간당 응대 · 완료'));
    var t1 = el('table', 'trk-t trk-rr'), h1 = el('tr');
    var hk = holdKey();
    [['이름', ''], ['시간당 응대', 'num'], ['오늘 응대', 'num'], ['시간당 완료(기록)', 'num'], ['오늘 완료(기록)', 'num'], ['한줄평', 'rv']].forEach(function (h) { h1.append(el('th', h[1], h[0])); });
    h1.lastChild.append(el('span', 'trk-rvh', ' · ' + hk.split(':')[1] + '시 기준, 1시간마다 바뀜'));
    var th1 = el('thead'); th1.append(h1); t1.append(th1); var tb1 = el('tbody');
    var list = KBTeamStats.byResp(R.people); list = list.filter(function (o) { return o.board; }).concat(list.filter(function (o) { return !o.board; })); // 게시판 위주는 맨 위
    list.forEach(function (o) {
      var tr = el('tr', o.n === mine ? 'me' : null), nm = el('td'); nm.append(el('b', null, o.full)); if (o.n === mine) nm.append(el('span', 'trk-mine', ' (나)'));
      var ln = lineOf(o), rv = el('td', 'rv');
      if (ln.dash) rv.append(el('span', 'z', '–')); else { if (ln.good) rv.append(el('span', 'good', ln.good)); (ln.fixes || []).forEach(function (f) { rv.append(el('span', 'fix' + (f.strong ? ' strong' : '') + (f.quiet ? ' quiet' : ''), f.t)); }); }
      tr.append(nm, el('td', 'num big', o.board || o.rph == null ? '–' : f1(o.rph) + '명'), el('td', 'num', o.resp + '명'), el('td', 'num big', o.ph == null ? '–' : f1(o.ph) + '건'), el('td', 'num', o.rec + '건'), rv); tb1.append(tr);
    });
    t1.append(tb1); b1.append(t1);
    b1.append(el('p', 'trk-note', '응대 = 답장을 보낸 고객 수 · 완료(기록) = 상담이 끝나고 남긴 기록 수' + (R.people.some(function (o) { return o.ph == null || o.rph == null; }) ? ' · – = 기록기를 켠 지 1시간이 안 됐거나 아직 답한 고객이 없어요' : '')));
    wrap.append(b1);
    // 문의 분류(카테고리별 건수만)
    var b2 = el('div', 'trk-box'); b2.append(el('h3', null, '문의 분류'), el('p', 'trk-sub', '오늘 기록 창에서 고른 카테고리별 건수'));
    if (!R.catOrder.length) b2.append(el('div', 'empty', '아직 카테고리가 고른 기록이 없어요.'));
    else {
      var sc = el('div', 'trk-scroll'), t2 = el('table', 'trk-t trk-cat' + (R.catOrder.length > 12 ? ' many' : '')), h2 = el('tr'); h2.append(el('th', null, '이름')); R.catOrder.forEach(function (c) { var th = el('th', 'num'); th.append(el('span', null, c.replace(/\//g, '/\u200b'))); th.title = c; h2.append(th); }); // 2026-11-02 칸 수만큼 나눠 가로 스크롤 없게 · '/' 뒤에서 줄바꿈
      h2.append(el('th', 'num tot', '합계')); // 2026-11-03 주석 안에 들어가 빠져 있던 합계 머리 칸
      var th2 = el('thead'); th2.append(h2); t2.append(th2); var tb2 = el('tbody');
      R.people.filter(function (o) { return o.catN > 0; }).forEach(function (o) {
        var tr = el('tr', o.n === mine ? 'me' : null), nm = el('td'); nm.append(el('b', null, o.full)); tr.append(nm);
        var top = 0; R.catOrder.forEach(function (c) { if ((o.cats[c] || 0) > top) top = o.cats[c]; }); // 2026-11-02 사람마다 가장 많은 분류 강조
        R.catOrder.forEach(function (c) { var v = o.cats[c] || 0, td = el('td', 'num' + (v ? (v === top ? ' ctop' : '') : ' z')); if (v === top && v) td.append(el('b', null, String(v))); else td.textContent = v ? String(v) : '·'; if (v === top && v) td.title = '가장 많은 분류'; tr.append(td); });
        var tt = el('td', 'num tot'); tt.append(el('b', null, String(o.catN))); tr.append(tt); tb2.append(tr);
      });
      var sum = el('tr', 'sum'), sn = el('td'); sn.append(el('b', null, '팀 합계')); sum.append(sn);
      R.catOrder.forEach(function (c) { var t = el('td', 'num'); t.append(el('b', null, String(R.cats[c]))); sum.append(t); });
      var st = el('td', 'num tot'); st.append(el('b', null, String(R.total.catN))); sum.append(st); tb2.append(sum);
      t2.append(tb2); sc.append(t2); b2.append(sc);
    }
    wrap.append(b2);
    L.append(wrap);
  }
  // 정시마다 새 문장(그 시간 안에서는 붙잡아 둠) · 표와 팝업이 같은 문장을 씀
  function holdKey() { var hk = KBTeamStats.periodKeys('today')[0] + ':' + new Date(last.at + 9 * 3600e3).getUTCHours(); if (held.key !== hk) held = { key: hk, lines: {} }; return hk; }
  function lineOf(o) { holdKey(); return held.lines[o.n] || (held.lines[o.n] = KBTeamStats.oneLine(last.R, o, { now: last.at, prev: last.prev[o.n], off: last.off })); }

  // ── 정시 팝업 ──
  var POPK = 'csx:hourPop', popOpen = null, popBusy = false, lastKey = 0, popFail = 0;
  function popGet() { try { return localStorage.getItem(POPK) || ''; } catch (e) { return ''; } }
  function popSet(v) { try { localStorage.setItem(POPK, v); } catch (e) { } }
  function nowKst() { var d = new Date(Date.now() + 9 * 3600e3); return { h: d.getUTCHours(), m: d.getUTCHours() * 60 + d.getUTCMinutes() }; }
  // 지금 띄울 수 있는 시간이면 'YYYY-MM-DD:H', 아니면 ''
  function popSlot(cfg) {
    var td = KBTeamStats.periodKeys('today')[0], d = WorkClock.day(td, cfg || {}); if (!d) return '';
    var t = nowKst(); if (t.h < 11 || t.m >= d.workEnd || (t.m >= 750 && t.m < 840)) return '';
    return td + ':' + t.h;
  }
  function busy() {
    if (popOpen || document.querySelector('.nask')) return true;
    var a = document.activeElement; return !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && Date.now() - lastKey < 8000); // 입력 중이면 잠깐 기다림
  }
  async function checkHour() {
    if (root.KB_NO_HOURPOP || popBusy || document.hidden || !root.CSTeam || !CSTeam.ready() || !me()) return;
    var slot = popSlot(last && last.cfg); if (!slot || popGet() === slot || busy() || Date.now() - popFail < 300000) return; // 못 불러오면 5분 뒤 다시
    popBusy = true;
    try {
      if (!last || Date.now() - last.at > 50000 || holdKeyOf(last.at) !== slot) await load();
      if (!last || err) { popFail = Date.now(); return; }
      slot = popSlot(last.cfg); if (!slot || popGet() === slot || holdKeyOf(last.at) !== slot) return;
      var o = last.R.people.filter(function (x) { return x.n === me(); })[0], ln = o ? lineOf(o) : { dash: true };
      if (!o || ln.dash) { popSet(slot); return; } // 게시판 위주·켠 지 1시간 전 → 이번 시간은 안 띄움
      if (busy()) return;
      openPop(slot, o, ln);
    } finally { popBusy = false; }
  }
  function holdKeyOf(at) { return KBTeamStats.periodKeys('today')[0] + ':' + new Date(at + 9 * 3600e3).getUTCHours(); }
  function openPop(slot, o, ln) {
    var bg = el('div', 'nask hpop'), d = el('div', 'naskd hpopd'); bg.setAttribute('role', 'dialog'); bg.setAttribute('aria-modal', 'true'); bg.setAttribute('aria-labelledby', 'hpopT');
    var h = el('h4', null, o.full + ' 님, 이번 1시간은 이렇게 해 볼까요?'); h.id = 'hpopT';
    var st = el('div', 'hpop-st'), c1 = el('div', 'hpop-n'), c2 = el('div', 'hpop-n');
    c1.append(el('span', null, '오늘 응대'), el('b', null, o.resp + '명')); c2.append(el('span', null, '오늘 완료(기록)'), el('b', null, o.rec + '건')); st.append(c1, c2);
    var rate = el('p', 'hpop-r', '시간당 응대 ' + (o.rph == null ? '–' : f1(o.rph) + '명') + ' · 완료(기록) ' + (o.ph == null ? '–' : f1(o.ph) + '건'));
    var ls = el('div', 'hpop-l');
    if (ln.good) ls.append(el('p', 'good', ln.good));
    (ln.fixes || []).forEach(function (f) { ls.append(el('p', 'fix' + (f.strong ? ' strong' : '') + (f.quiet ? ' quiet' : ''), f.t)); });
    var ok = document.createElement('button'); ok.type = 'button'; ok.className = 'btn primary'; ok.textContent = '네, 확인했어요';
    ok.addEventListener('click', function () { popSet(slot); closePop(); });
    var a = el('div', 'acts'); a.append(ok);
    d.append(el('span', 'hpop-tag', slot.split(':')[1] + '시 한줄평'), h, st, rate);
    if (ls.childNodes.length) d.append(ls);
    d.append(a); bg.append(d); document.body.append(bg); popOpen = { bg: bg, slot: slot }; ok.focus();
  }
  function closePop() { if (popOpen) { popOpen.bg.remove(); popOpen = null; } }
  function startHourly() {
    if (typeof document === 'undefined' || startHourly.on) return; startHourly.on = true;
    document.addEventListener('keydown', function () { lastKey = Date.now(); }, true);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) setTimeout(checkHour, 1500); });
    root.addEventListener && root.addEventListener('focus', function () { setTimeout(checkHour, 1500); });
    root.addEventListener && root.addEventListener('storage', function (e) { if (e.key === POPK && popOpen && e.newValue === popOpen.slot) closePop(); }); // 다른 탭에서 확인하면 같이 닫힘
    setInterval(checkHour, 30000); setTimeout(checkHour, 5000);
  }
  startHourly();

  function show() { render(); load(); clearInterval(timer); timer = setInterval(function () { if (!document.hidden) load(); }, 60000); }
  function hide() { clearInterval(timer); timer = 0; gen++; }
  root.KBTeamRec = { show: show, hide: hide, render: render, checkHour: checkHour };
})(typeof globalThis !== 'undefined' ? globalThis : this);
