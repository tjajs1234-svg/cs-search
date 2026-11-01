/* 검색기 [팀 기록] 탭(2026-11-01 주인): 누구나 봄 · 늘 오늘만
   · 시간당 기록(시간당 많은 순) · 오늘 기록 · 문의 분류(카테고리별 건수)
   · 주인 결정: 등수·'1등'·팀 평균과 차이·일한 시간 칸 없음, '어려운 상담' 말·비율·색 없음(기록할 때 카테고리를 일부러 고르지 않게)
   · 기간 고르기는 관리 화면 팀 현황 [팀 기록]에서만 · 숫자 세기는 teamstats.js(관리 화면과 같음)
   · 자료: 팀 서버 team.get · qa.get(읽기만) · 고객 이름·내용은 안 다룸 */
(function (root) {
  'use strict';
  var timer = 0, gen = 0, last = null, err = '';
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
      var got = await Promise.all([CSTeam.get('team.get', { days: 2 }, 50000), CSTeam.get('qa.get', { days: 1 }, 50000).catch(function () { return null; }), CSTeam.get('cfg.get', {}, 600000).catch(function () { return null; })]);
      if (my !== gen) return;
      last = { R: KBTeamStats.compute(got[0], got[1], keys, { roster: (got[2] || {}).roster }), at: Date.now() }; err = '';
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
      if (mo.ph != null) { ml.append('시간당 ', el('b', null, f1(mo.ph) + '건'), ' 기록했어요. '); }
      ml.append('지금까지 ', el('b', null, mo.rec + '건'), '이에요.'); wrap.append(ml);
    }
    // 시간당 기록
    var b1 = el('div', 'trk-box'); b1.append(el('h3', null, '시간당 기록'));
    var t1 = el('table', 'trk-t'), h1 = el('tr'); [['이름', ''], ['시간당 기록', 'num'], ['오늘 기록', 'num']].forEach(function (h) { h1.append(el('th', h[1], h[0])); });
    var th1 = el('thead'); th1.append(h1); t1.append(th1); var tb1 = el('tbody');
    R.people.forEach(function (o) {
      var tr = el('tr', o.n === mine ? 'me' : null), nm = el('td'); nm.append(el('b', null, o.full)); if (o.n === mine) nm.append(el('span', 'trk-mine', ' (나)'));
      tr.append(nm, el('td', 'num big', o.ph == null ? '–' : f1(o.ph) + '건'), el('td', 'num', o.rec + '건')); tb1.append(tr);
    });
    t1.append(tb1); b1.append(t1);
    if (R.people.some(function (o) { return o.ph == null; })) b1.append(el('p', 'trk-note', '– = 기록기를 켠 지 1시간이 안 됐어요'));
    wrap.append(b1);
    // 문의 분류(카테고리별 건수만)
    var b2 = el('div', 'trk-box'); b2.append(el('h3', null, '문의 분류'), el('p', 'trk-sub', '오늘 기록 창에서 고른 카테고리별 건수'));
    if (!R.catOrder.length) b2.append(el('div', 'empty', '아직 카테고리가 고른 기록이 없어요.'));
    else {
      var sc = el('div', 'trk-scroll'), t2 = el('table', 'trk-t'), h2 = el('tr'); h2.append(el('th', null, '이름')); R.catOrder.forEach(function (c) { h2.append(el('th', 'num', c)); }); h2.append(el('th', 'num', '합계'));
      var th2 = el('thead'); th2.append(h2); t2.append(th2); var tb2 = el('tbody');
      R.people.filter(function (o) { return o.catN > 0; }).forEach(function (o) {
        var tr = el('tr', o.n === mine ? 'me' : null), nm = el('td'); nm.append(el('b', null, o.full)); tr.append(nm);
        R.catOrder.forEach(function (c) { tr.append(el('td', 'num', o.cats[c] ? String(o.cats[c]) : '·')); });
        var tt = el('td', 'num'); tt.append(el('b', null, String(o.catN))); tr.append(tt); tb2.append(tr);
      });
      var sum = el('tr', 'sum'), sn = el('td'); sn.append(el('b', null, '팀 합계')); sum.append(sn);
      R.catOrder.forEach(function (c) { var t = el('td', 'num'); t.append(el('b', null, String(R.cats[c]))); sum.append(t); });
      var st = el('td', 'num'); st.append(el('b', null, String(R.total.catN))); sum.append(st); tb2.append(sum);
      t2.append(tb2); sc.append(t2); b2.append(sc);
    }
    wrap.append(b2);
    wrap.append(el('p', 'trk-foot', '같은 고객(상담방)은 한 번만 세요 · 시트에 저장된 기록만 세요 · 기록기를 끈 시간과 다른 PC 기록은 안 잡혀요'));
    L.append(wrap);
  }
  function show() { render(); load(); clearInterval(timer); timer = setInterval(function () { if (!document.hidden) load(); }, 60000); }
  function hide() { clearInterval(timer); timer = 0; gen++; }
  root.KBTeamRec = { show: show, hide: hide, render: render };
})(typeof globalThis !== 'undefined' ? globalThis : this);
