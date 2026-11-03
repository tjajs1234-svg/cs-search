/* 검색기 [팀 기록] 탭(2026-11-01 주인): 누구나 봄 · 늘 오늘만
   · 시간당 기록(시간당 많은 순) · 오늘 기록 · 문의 분류(카테고리별 건수)
   · 2026-11-03 주인: 응대(답한 고객 · 기록 상관없음)를 같은 표에 나란히 — 시간당 응대 많은 순
   · 주인 결정: 등수·'1등'·팀 평균과 차이·일한 시간 칸 없음, '어려운 상담' 말·비율·색 없음(기록할 때 카테고리를 일부러 고르지 않게)
   · 기간 고르기는 관리 화면 팀 현황 [팀 기록]에서만 · 숫자 세기는 teamstats.js(관리 화면과 같음)
   · 2026-11-03 한줄평(주인): 표 오른쪽 칸에 칭찬 한 문장(초록) + 피드백 한 문장 · 정시마다 바뀜(그 시간 안에서는 붙잡아 둠) · 문장은 teamstats.js oneLine
     게시판 위주인 사람은 맨 위 · 시간당 응대·한줄평 '–' · 머리 줄 '응대(진행)' / '기록(완료)'를 같은 모양으로(파란색 없앰)
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
      var opt = { roster: (got[2] || {}).roster, ot: (got[3] || {}).items || [] }, pw = KBTeamStats.prevWorkday(keys[0]), prev = {};
      if (got[0] && got[0].days && got[0].days[pw.key]) KBTeamStats.compute(got[0], got[1], [pw.key], opt).people.forEach(function (o) { if (o.ph != null) prev[o.n] = { ph: o.ph, label: pw.label }; });
      last = { R: KBTeamStats.compute(got[0], got[1], keys, opt), prev: prev, at: Date.now() }; err = '';
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
      if (mo.rph != null && !mo.board) ml.append('시간당 ', el('b', null, '응대 ' + f1(mo.rph) + '명'), mo.ph != null ? ' · 기록 ' + f1(mo.ph) + '건이에요. ' : '이에요. ');
      else if (mo.ph != null) { ml.append('시간당 ', el('b', null, f1(mo.ph) + '건'), ' 기록했어요. '); }
      ml.append('지금까지 응대 ', el('b', null, mo.resp + '명'), ' · 기록 ', el('b', null, mo.rec + '건'), '이에요.'); wrap.append(ml);
    }
    // 시간당 기록
    var b1 = el('div', 'trk-box'); b1.append(el('h3', null, '시간당 응대 · 기록'));
    var t1 = el('table', 'trk-t trk-rr'), g1 = el('tr', 'grp'), h1 = el('tr');
    var hk = KBTeamStats.periodKeys('today')[0] + ':' + new Date(last.at + 9 * 3600e3).getUTCHours(); if (held.key !== hk) held = { key: hk, lines: {} }; // 정시마다 새 문장
    g1.append(el('th')); var ga = el('th', 'g-resp', '응대(진행) · 답한 고객'), gb = el('th', 'g-rec', '기록(완료) · 상담 끝나고 남긴 것'), gc = el('th', 'g-rv', '한줄평'); ga.colSpan = 2; gb.colSpan = 2; gc.append(el('span', 'trk-rvh', ' · ' + hk.split(':')[1] + '시 기준, 1시간마다 바뀜')); g1.append(ga, gb, gc);
    [['이름', ''], ['시간당 응대', 'num'], ['오늘 응대', 'num'], ['시간당 기록', 'num'], ['오늘 기록', 'num'], ['', 'rv']].forEach(function (h) { h1.append(el('th', h[1], h[0])); });
    var th1 = el('thead'); th1.append(g1, h1); t1.append(th1); var tb1 = el('tbody');
    var list = KBTeamStats.byResp(R.people); list = list.filter(function (o) { return o.board; }).concat(list.filter(function (o) { return !o.board; })); // 게시판 위주는 맨 위
    list.forEach(function (o) {
      var tr = el('tr', o.n === mine ? 'me' : null), nm = el('td'); nm.append(el('b', null, o.full)); if (o.n === mine) nm.append(el('span', 'trk-mine', ' (나)'));
      var ln = held.lines[o.n] || (held.lines[o.n] = KBTeamStats.oneLine(R, o, { now: last.at, prev: last.prev[o.n] })), rv = el('td', 'rv');
      if (ln.dash) rv.append(el('span', 'z', '–')); else { if (ln.good) rv.append(el('span', 'good', ln.good)); if (ln.fix) rv.append(el('span', 'fix', ln.fix)); }
      tr.append(nm, el('td', 'num big', o.board || o.rph == null ? '–' : f1(o.rph) + '명'), el('td', 'num', o.resp + '명'), el('td', 'num big', o.ph == null ? '–' : f1(o.ph) + '건'), el('td', 'num', o.rec + '건'), rv); tb1.append(tr);
    });
    t1.append(tb1); b1.append(t1);
    if (R.people.some(function (o) { return o.ph == null || o.rph == null; })) b1.append(el('p', 'trk-note', '– = 기록기를 켠 지 1시간이 안 됐거나 아직 답한 고객이 없어요'));
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
  function show() { render(); load(); clearInterval(timer); timer = setInterval(function () { if (!document.hidden) load(); }, 60000); }
  function hide() { clearInterval(timer); timer = 0; gen++; }
  root.KBTeamRec = { show: show, hide: hide, render: render };
})(typeof globalThis !== 'undefined' ? globalThis : this);
