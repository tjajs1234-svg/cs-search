/* 멘트 관리에 더한 화면 3 (팀 서버 1.3.0 · 기록기 2.4.0)
   · 업무 흐름: 시간대별 기록 · 시간당 건수 · 기록 사이 텀 · 게시판 사이트별 건수
   · 확인할 상담: 기록 안 한 상담 · 20분 넘긴 상담 · 오래된 상담 · 공지 확인
   · 근무 달력: 야근 신청 승인 · 이달 합계 · 공휴일 · 상담사 명단 · 비수기 */
(function () {
  'use strict';
  var A = function () { return window.KBAdminApp; }, T = function () { return window.KBTeam; };
  function mk(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function btn(label, cls, fn) { var b = mk('button', 'btn ' + (cls || 'ghost'), label); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; }
  function say(t, k) { if (A()) A().say(t, k); }
  var W = window.WorkClock, WD = ['일', '월', '화', '수', '목', '금', '토'];
  function today() { return W.dayKey(Date.now()); }
  function md(k) { return Number(k.slice(5, 7)) + '/' + Number(k.slice(8, 10)) + '(' + WD[W.weekday(k)] + ')'; }
  function hhmm(min) { return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0'); }
  function clock(ms) { return ms ? hhmm(W.minuteOf(ms)) : ''; }
  function hm(mins) { var h = Math.floor(mins / 60), m = mins % 60; return (h ? h + '시간' : '') + (m ? (h ? ' ' : '') + m + '분' : h ? '' : '0분'); }
  function diffDays(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5); }
  function addMonth(m, n) { var y = Number(m.slice(0, 4)), mo = Number(m.slice(5, 7)) - 1 + n; y += Math.floor(mo / 12); mo = ((mo % 12) + 12) % 12; return y + '-' + String(mo + 1).padStart(2, '0'); }
  function monthEnd(m) { return W.addDays(addMonth(m, 1) + '-01', -1); }
  function chName(ch) { return ch === 'naver' ? '톡톡' : '카톡'; }
  function link(x, label) { var a = mk('a', 'qlink', label || '열기'); if (x.u) { a.href = x.u; a.target = '_blank'; a.rel = 'noopener'; } else a.className += ' off'; return a; }
  function table(head, rows, cls) {
    var tb = mk('table', 'ttable' + (cls ? ' ' + cls : '')), tr = mk('tr'); head.forEach(function (h) { tr.append(mk('th', null, h)); });
    var th = mk('thead'); th.append(tr); tb.append(th); var bd = mk('tbody');
    rows.forEach(function (r) { var t2 = mk('tr', r.cls || null); r.cells.forEach(function (c) { var td = mk('td', c && c.cls || null); if (c && c.node) td.append(c.node); else td.textContent = c && typeof c === 'object' ? c.text : String(c); if (c && c.title) td.title = c.title; t2.append(td); }); bd.append(t2); });
    tb.append(bd); var wrap = mk('div', 'twrap'); wrap.append(tb); return wrap;
  }
  async function ready(w, title, desc) {
    if (CSTeam.ready()) CSTeam.get('cfg.get', {}).catch(function () {}); // 명단은 미리(다른 요청과 함께)
    w.replaceChildren(mk('h2', null, title), mk('p', 'desc', desc), mk('div', 'empty', '불러오는 중…'));
    if (!(await T().ensureUrl())) { T().needServer(w, title); return false; }
    return true;
  }
  var cfgCache = null;
  async function getCfg(force) { if (!cfgCache || force) cfgCache = await CSTeam.get('cfg.get', {}); return cfgCache; }
  // 명단(입사~퇴사 사이) — 비어 있으면 팀 현황에 신호를 보낸 이름
  function activeNames(roster, day, fallback) {
    var r = (roster || []).filter(function (x) { return (!x.start || x.start <= day) && (!x.end || x.end >= day); }).map(function (x) { return x.name; });
    return r.length ? r : (fallback || []);
  }

  /* ───── 상담사 모두를 한 화면에: 사람마다 한 칸(누를 필요 없음) ───── */
  async function teamNames(extra) {
    var cfg = await getCfg().catch(function () { return null; }), td = today(), set = {};
    activeNames(cfg && cfg.roster, td, []).forEach(function (n) { set[n] = 1; });
    (extra || []).forEach(function (n) { if (n) set[n] = 1; });
    var full = {}; ((cfg && cfg.roster) || []).forEach(function (x) { full[x.name] = x.full || x.name; });
    return Object.keys(set).sort(function (a, b) { return (a === '팀장') - (b === '팀장') || (full[a] || a).localeCompare(full[b] || b, 'ko'); });
  }
  function stat(label, value, cls, title) { var t = mk('div', 'st' + (cls ? ' ' + cls : '')); t.append(mk('b', null, value), mk('span', null, label)); if (title) t.title = title; return t; }
  function ago(t) { var m = Math.floor((Date.now() - t) / 60000); return m < 1 ? '방금' : m < 60 ? m + '분 전' : Math.floor(m / 60) + '시간 전'; }
  // 세로 막대(값 위에 숫자 · 아래 이름) — 한 가지 색, 마우스를 올리면 설명
  function bars(list, opt) {
    opt = opt || {}; var max = Math.max(1, opt.max || 0); list.forEach(function (x) { max = Math.max(max, x.v || 0); });
    var box = mk('div', 'vb' + (opt.cls ? ' ' + opt.cls : ''));
    list.forEach(function (x) {
      var c = mk('div', 'vc' + (x.cls ? ' ' + x.cls : '')), w = mk('div', 'vw'), b = mk('span', 'vbar');
      b.style.height = (x.v ? Math.max(4, x.v / max * 100) : 0) + '%'; w.append(b);
      c.append(mk('b', 'vv', x.v ? String(x.v) : (x.blank ? '' : '·')), w, mk('span', 'vl', x.label));
      if (x.title) c.title = x.title; box.append(c);
    });
    return box;
  }

  /* ───── 팀 현황 카드: 지금 · 오늘 · 이번 주 · 확인할 것(상담사마다 한 칸) ───── */
  async function teamCards(r, R) {
    var P = T().person, td = today(), now = Date.now(), days = r.days || {};
    var q = await CSTeam.get('qa.get', { days: 1 }).catch(function () { return { days: {}, live: {} }; });
    var live = {}; (r.live || []).forEach(function (x) { live[P(x.name)] = x; });
    var ql = {}; Object.keys(q.live || {}).forEach(function (n) { ql[P(n)] = q.live[n]; });
    var qd = (q.days || {})[td] || {}, rt = {}, late = {}; Object.keys(qd).forEach(function (n) { var k = P(n); rt[k] = (rt[k] || []).concat(qd[n].rt || []); late[k] = (late[k] || []).concat(qd[n].late || []); });
    var sum = function (name, keys) { var o = { answered: 0, waitSum: 0, over20: 0, maxWait: 0, holds: 0, records: 0 }; keys.forEach(function (d) { var x = days[d] || {}; Object.keys(x).forEach(function (n) { if (P(n) !== name) return; var v = x[n]; ['answered', 'waitSum', 'over20', 'holds', 'records'].forEach(function (k) { o[k] += v[k] || 0; }); o.maxWait = Math.max(o.maxWait, v.maxWait || 0); }); }); return o; };
    var dn = []; Object.keys(days).forEach(function (d) { Object.keys(days[d] || {}).forEach(function (n) { dn.push(P(n)); }); });
    var names = (await teamNames(Object.keys(live).concat(dn))).filter(function (n) { return n !== '팀장'; });
    var grid = mk('div', 'pgrid'), WDN = ['월', '화', '수', '목', '금', '토', '일'];
    // 순서는 늘 같게(명단 가나다순) — 급한 칸은 색으로 보임
    names.forEach(function (n) {
      var x = live[n], off = !x || now - x.at > 3 * 60000, hot = !off && (x.oldestMin || 0) >= 20, warm = !off && !hot && (x.oldestMin || 0) >= 10;
      var c = mk('div', 'pcard' + (off ? ' off' : hot ? ' hot' : warm ? ' warm' : ''));
      // 머리: 이름 · 지금
      var h = mk('div', 'pch'); h.append(mk('span', 'av', n.slice(0, 1)), mk('b', 'pn', n), mk('span', 'sp'));
      if (off) h.append(mk('span', 'pill off', x ? '신호 없음 · ' + ago(x.at) : '오늘 신호 없음'));
      else { h.append(mk('span', 'pill' + (hot ? ' hot' : warm ? ' warm' : ''), x.pending ? x.pending + '명 대기 · 가장 오래 ' + (x.oldestMin || 0) + '분' : '대기 없음')); }
      c.append(h);
      // 오늘
      var s = sum(n, [td]), row = mk('div', 'pst');
      row.append(stat('답한 상담', String(s.answered)), stat('평균 대기', s.answered ? Math.round(s.waitSum / s.answered) + '분' : '–', '', '업무시간 기준'), stat('20분 넘김', String(s.over20), s.over20 ? 'bad' : ''), stat('기록', String(s.records)));
      c.append(mk('div', 'psub', '오늘'), row);
      // 이번 주(요일별 답한 상담)
      var list = R.days.map(function (d, i) { var o = sum(n, [d]); return { d: d, i: i, v: o.answered, rec: o.records }; }).filter(function (o) { return o.i < 5 || o.v; })
        .map(function (o) { return { v: o.d > td ? 0 : o.v, blank: o.d > td, label: WDN[o.i], cls: o.d === td ? 'now' : '', title: md(o.d) + ' · 답한 상담 ' + o.v + ' · 기록 ' + o.rec }; });
      var wk = sum(n, R.days.filter(function (d) { return d <= td; })), mo = sum(n, Object.keys(days).filter(function (d) { return d.slice(0, 7) === R.month && d <= td; }));
      var wh = mk('div', 'psub'); wh.append(mk('span', null, '이번 주 답한 상담'), mk('span', 'sp'), mk('span', null, '주 ' + wk.answered + ' · ' + Number(R.month.slice(5)) + '월 ' + mo.answered));
      c.append(wh, bars(list, { cls: 'sm' }));
      // 확인할 것 · 오늘 흐름(누르면 그 화면)
      var f = flowOf(rt[n] || []), qn = ql[n] || {}, miss = (qn.miss || []).length, lh = (qn.lh || []).length, lt = (late[n] || []).length;
      var ft = mk('div', 'pfoot');
      var tag = function (t, v, cls, view) { var b = mk('button', 'ptag' + (cls ? ' ' + cls : ''), t + ' ' + v); b.type = 'button'; b.addEventListener('click', function () { A().setView(view); }); ft.append(b); };
      tag('기록 안 함', miss, miss ? 'bad' : 'ok', 'qa'); tag('20분 넘김', lt, lt ? 'bad' : 'ok', 'qa'); tag('오래된', lh, lh ? 'warn' : 'ok', 'qa');
      tag('시간당', f.n ? f.perHour.toFixed(1) : '–', '', 'flow'); tag('빈 구간', f.n ? f.long.length : '–', f.long.length ? 'warn' : '', 'flow');
      c.append(ft);
      grid.append(c);
    });
    if (!names.length) grid.append(mk('div', 'empty', '아직 신호를 보낸 상담사가 없어요.'));
    return grid;
  }

  /* ───── 업무 흐름: 기록 시각으로 본 하루(상담사마다 한 칸) ───── */
  var fDay = '';
  // 기록 시각(분) → 시간당 · 텀(점심 12:30~14:00은 빼고) · 30분 넘게 빈 구간
  function flowOf(rt) {
    var t = (rt || []).slice().sort(function (a, b) { return a - b; }), L = W.LUNCH, n = t.length;
    var minus = function (a, b) { return Math.max(0, Math.min(b, L[1]) - Math.max(a, L[0])); };
    if (!n) return { n: 0, long: [], hours: {} };
    var span = Math.max(0, t[n - 1] - t[0] - minus(t[0], t[n - 1])), gaps = [], long = [];
    for (var i = 1; i < n; i++) { var g = t[i] - t[i - 1] - minus(t[i - 1], t[i]); gaps.push(g); if (g >= 30) long.push([t[i - 1], t[i], g]); }
    var sorted = gaps.slice().sort(function (a, b) { return a - b; }), med = sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : 0;
    return { n: n, t: t, first: t[0], last: t[n - 1], perHour: n / Math.max(1, span / 60), med: med, long: long, hours: t.reduce(function (o, m) { var h = Math.floor(m / 60); o[h] = (o[h] || 0) + 1; return o; }, {}) };
  }
  function dayNav(cur, td, go) {
    var nav = mk('div', 'ins qnav');
    var di = mk('input', 'in'); di.type = 'date'; di.value = cur; di.max = td; di.style.width = '160px'; di.addEventListener('change', function () { if (di.value) go(di.value); });
    nav.append(btn('◀ 전날', '', function () { go(W.addDays(cur, -1)); }), di, btn('다음 날 ▶', '', function () { if (cur < td) go(W.addDays(cur, 1)); }), btn('오늘', cur === td ? 'on' : '', function () { go(td); }), mk('span', null, md(cur) + (W.day(cur, {}) ? '' : ' · 쉬는 날')));
    Array.prototype.forEach.call(nav.querySelectorAll('button'), function (b) { b.className = b.className.replace('btn ghost', '').replace('btn ', '').trim(); });
    return nav;
  }
  async function flow(w) {
    var title = '업무 흐름';
    if (!(await ready(w, title, '기록한 시각으로 본 하루예요. 시간마다 몇 건 기록했는지 · 시간당 건수 · 기록과 기록 사이 간격 · 30분 넘게 기록이 없던 때(점심 빼고). 긴 통화나 어려운 상담도 빈 시간으로 보이니 참고용으로만 봐 주세요.'))) return;
    var td = today(); if (!fDay || fDay > td) fDay = td;
    var back = diffDays(fDay, td) + 1, q;
    try { q = await CSTeam.get('qa.get', { days: Math.min(62, back + 6) }); }
    catch (e) { w.lastChild.textContent = '불러오지 못했어요. ' + e.message; return; }
    w.lastChild.remove();
    var P = T().person, rtOf = function (d) { var o = {}, x = (q.days || {})[d] || {}; Object.keys(x).forEach(function (n) { var k = P(n); (o[k] || (o[k] = [])).push.apply(o[k], x[n].rt || []); }); return o; };
    var people = rtOf(fDay), F = {}; Object.keys(people).forEach(function (n) { F[n] = flowOf(people[n]); });
    w.append(dayNav(fDay, td, function (d) { fDay = d; flow(w); }));
    if (diffDays(fDay, td) >= 62) { w.append(mk('div', 'empty', '기록 시각은 62일 동안만 보관해요.')); return; }
    var names = await teamNames(Object.keys(people));
    // 시간 칸: 모두 같은 눈금(10시~18시 · 더 이르거나 늦은 기록이 있으면 넓힘)
    var lo = 10, hi = 18; Object.keys(F).forEach(function (n) { var f = F[n]; if (f.n) { lo = Math.min(lo, Math.floor(f.first / 60)); hi = Math.max(hi, Math.floor(f.last / 60)); } });
    var mx = 1; Object.keys(F).forEach(function (n) { for (var h = lo; h <= hi; h++) mx = Math.max(mx, F[n].hours[h] || 0); });
    var grid = mk('div', 'pgrid');
    names.forEach(function (n) {
      var f = F[n] || flowOf([]), c = mk('div', 'pcard' + (f.n ? '' : ' off'));
      var h = mk('div', 'pch'); h.append(mk('span', 'av', n.slice(0, 1)), mk('b', 'pn', n), mk('span', 'sp'), mk('span', 'pill' + (f.n ? '' : ' off'), f.n ? hhmm(f.first) + ' – ' + hhmm(f.last) : '기록 없음'));
      c.append(h);
      if (!f.n) { c.append(mk('div', 'pnone', '이날 기록한 시각이 없어요')); grid.append(c); return; }
      var row = mk('div', 'pst'); row.append(stat('기록', f.n + '건'), stat('시간당', f.perHour.toFixed(1) + '건', '', '첫 기록~마지막 기록 시간(점심 빼고)으로 나눔'), stat('기록 사이', f.med + '분', '', '기록과 기록 사이 시간의 가운데 값(점심 빼고)'), stat('30분+ 빈 시간', f.long.length + '번', f.long.length ? 'warn' : ''));
      c.append(row);
      var hs = []; for (var h2 = lo; h2 <= hi; h2++) hs.push({ v: f.hours[h2] || 0, label: String(h2), cls: h2 === 12 || h2 === 13 ? 'lunch' : '', title: h2 + '시대 기록 ' + (f.hours[h2] || 0) + '건' + (h2 === 12 || h2 === 13 ? ' (점심 12:30~14:00 포함)' : '') });
      c.append(mk('div', 'psub', '시간마다 기록한 건수 (시)'), bars(hs, { max: mx }));
      var gp = mk('div', 'pgap');
      if (!f.long.length) gp.append(mk('span', 'okc', '30분 넘게 빈 시간 없음'));
      else { gp.append(mk('span', 'gt', '30분 넘게 기록 없던 때')); f.long.forEach(function (x) { gp.append(mk('span', 'gchip', hhmm(x[0]) + ' ~ ' + hhmm(x[1]) + ' · ' + x[2] + '분')); }); }
      c.append(gp);
      // 최근 7일 기록 건수
      var wk = [], dl = []; for (var j = 0; dl.length < 7 && j < 14; j++) { var dj = W.addDays(fDay, -j), wj = W.weekday(dj); if (wj !== 0 && wj !== 6) dl.unshift(dj); }
      dl.forEach(function (d) { var ff = flowOf((rtOf(d)[n]) || []); wk.push({ v: ff.n, label: WD[W.weekday(d)], cls: d === fDay ? 'now' : '', title: md(d) + ' · 기록 ' + ff.n + '건' + (ff.n ? ' · 시간당 ' + ff.perHour.toFixed(1) : '') }); });
      c.append(mk('div', 'psub', '최근 평일 7일 기록 건수'), bars(wk, { cls: 'sm' }));
      grid.append(c);
    });
    if (!names.length) grid.append(mk('div', 'empty', '이날 기록 시각이 아직 없어요.\n상담사 기록기 2.4.0부터 쌓여요.'));
    w.append(grid);
  }

  /* ───── 게시판 건수: 그날 게시판 사이트별 기록 수(사람별) · 이달 합계 ───── */
  var sDay = '';
  async function sites(w) {
    var title = '게시판 건수';
    if (!(await ready(w, title, '게시판에서 기록할 때 고른 구매처로 저절로 세요. 상담사 PC는 1분마다 · 팀장 PC(태그 여러 개)는 5분마다 ‘팀장’ 줄로 들어와요.'))) return;
    var td = today(); if (!sDay || sDay > td) sDay = td;
    var mon = sDay.slice(0, 7), back = Math.max(diffDays(sDay, td), diffDays(mon + '-01', td)) + 1, g;
    try { g = await CSTeam.get('team.get', { days: Math.min(400, back) }); } catch (e) { w.lastChild.textContent = '불러오지 못했어요. ' + e.message; return; }
    w.lastChild.remove();
    var nav = mk('div', 'ins qnav');
    var di = mk('input', 'in'); di.type = 'date'; di.value = sDay; di.max = td; di.style.width = '160px'; di.addEventListener('change', function () { if (di.value) { sDay = di.value; sites(w); } });
    nav.append(btn('◀ 전날', '', function () { sDay = W.addDays(sDay, -1); sites(w); }), di, btn('다음 날 ▶', '', function () { if (sDay < td) { sDay = W.addDays(sDay, 1); sites(w); } }), btn('오늘', sDay === td ? 'on' : '', function () { sDay = td; sites(w); }), mk('span', null, md(sDay)));
    Array.prototype.forEach.call(nav.querySelectorAll('button'), function (b) { b.className = b.className.replace('btn ghost', '').replace('btn ', '').trim(); });
    w.append(nav);
    var days = g.days || {}, P = T().person;
    var sumBy = function (keys) { var o = {}; keys.forEach(function (d) { var x = days[d] || {}; Object.keys(x).forEach(function (n) { var k = P(n), s2 = (x[n] || {}).sites || {}; var t2 = o[k] || (o[k] = {}); Object.keys(s2).forEach(function (st) { t2[st] = (t2[st] || 0) + s2[st]; }); }); }); return o; };
    var siteTable = function (S, label) {
      var all2 = {}; Object.keys(S).forEach(function (n) { Object.keys(S[n]).forEach(function (st) { all2[st] = (all2[st] || 0) + S[n][st]; }); });
      var cols = Object.keys(all2).sort(function (a, b) { return all2[b] - all2[a]; }), ppl = Object.keys(S).filter(function (n) { return Object.keys(S[n]).length; }).sort(function (a, b) { return a.localeCompare(b, 'ko'); });
      if (!cols.length) return mk('div', 'empty', label + ' 게시판 기록이 없어요.');
      var rows = ppl.map(function (n) { var tot = 0; var cells = [n].concat(cols.map(function (c) { var v = S[n][c] || 0; tot += v; return { text: v ? String(v) : '–', cls: v ? '' : 'z' }; })); cells.push({ text: String(tot), cls: 'sum' }); return { cells: cells }; });
      var all = 0; rows.push({ cls: 'total', cells: ['합계'].concat(cols.map(function (c) { all += all2[c]; return String(all2[c]); }), [{ text: String(all), cls: 'sum' }]) });
      return table(['상담사'].concat(cols, ['합계']), rows, 'tsite');
    };
    var p1 = mk('div', 'panel'); p1.style.maxWidth = '1100px'; p1.append(mk('h3', 'qh', md(sDay)), siteTable(sumBy([sDay]), '이날'));
    var p2 = mk('div', 'panel'); p2.style.maxWidth = '1100px'; p2.append(mk('h3', 'qh', Number(mon.slice(5)) + '월 합계'), siteTable(sumBy(Object.keys(days).filter(function (d) { return d.slice(0, 7) === mon && d <= td; })), '이달'));
    w.append(p1, p2);
  }

  /* ───── 확인할 상담: 사람마다 한 칸(기록 안 함 · 20분 넘김 · 오래된 상담) · 공지 확인 ───── */
  var qDay = '';
  async function qa(w) {
    var title = '확인할 상담';
    if (!(await ready(w, title, '팀장만 보는 화면이에요(상담사 화면에는 안 나와요). 상담 번호와 링크만 있고 고객 이름·대화 내용은 없어요. [열기]를 누르면 그 상담이 새 탭에서 열려요(카카오·톡톡에 로그인돼 있어야 해요).'))) return;
    var td = today(); if (!qDay || qDay > td) qDay = td;
    var r, reads = {}, cfg = null;
    try { var got = await Promise.all([CSTeam.get('qa.get', { days: Math.min(62, diffDays(qDay, td) + 1) }), CSTeam.get('notice.reads', {}).catch(function () { return { reads: {} }; }), getCfg().catch(function () { return null; })]); r = got[0]; reads = got[1].reads || {}; cfg = got[2]; }
    catch (e) { w.lastChild.textContent = '불러오지 못했어요. ' + e.message; return; }
    w.lastChild.remove();
    var P = T().person, live = r.live || {}, tok = await T().adminToken();
    var by = {}, box = function (n) { return by[n] || (by[n] = { miss: [], late: [], lh: [] }); };
    Object.keys(live).forEach(function (n) { var b = box(P(n)); b.miss = b.miss.concat(live[n].miss || []); b.lh = b.lh.concat(live[n].lh || []); });
    var dd = (r.days || {})[qDay] || {}; Object.keys(dd).forEach(function (n) { var b = box(P(n)); b.late = b.late.concat((dd[n] || {}).late || []); });
    Object.keys(by).forEach(function (n) { by[n].late.sort(function (a, b) { return (b.w || 0) - (a.w || 0); }); by[n].lh.sort(function (a, b) { return (b.d || 0) - (a.d || 0); }); });
    var names = (await teamNames(Object.keys(by))).filter(function (n) { return n !== '팀장'; }), counts = {};
    names.forEach(function (n) { var b = by[n] || {}; counts[n] = (b.miss || []).length + (b.late || []).length + (b.lh || []).length; });
    var nav = dayNav(qDay, td, function (d) { qDay = d; qa(w); }); nav.prepend(mk('span', 'nl', '20분 넘긴 상담 날짜'));
    w.append(nav);
    var okBtn = function (x, row, card) { return btn('확인함', 'ghost sm', async function () { try { await CSTeam.call('qa.ok', { key: x.ch + ':' + x.id, adminToken: tok }); row.remove(); if (card) card(); say('목록에서 뺐어요', 'ok'); } catch (e) { say(e.message, 'err'); } }); };
    var team = names.filter(function (n) { return n !== '팀장'; });
    var unread = function (n) { return Object.keys(reads).filter(function (id) { return !Object.keys(reads[id].reads || {}).map(P).includes(n); }).map(function (id) { return reads[id]; }); };
    var card = function (n, wide) {
      var b = by[n] || { miss: [], late: [], lh: [] }, c = mk('div', 'qcard' + (wide ? ' wide' : '')), total = b.miss.length + b.late.length + b.lh.length;
      var h = mk('div', 'qch'); h.append(mk('span', 'av', n.slice(0, 1)), mk('b', 'pn', n), mk('span', 'sp'));
      var badge = function (t, v, cls) { if (v) h.append(mk('span', 'qbadge ' + cls, t + ' ' + v)); };
      badge('기록 안 함', b.miss.length, 'red'); badge('20분 넘김', b.late.length, 'red'); badge('오래된', b.lh.length, 'amber');
      if (!total) h.append(mk('span', 'qbadge ok', '확인할 것 없음'));
      c.append(h);
      var refresh = function () { if (!c.querySelector('.qrow')) c.classList.add('done'); };
      var sec = function (t, list, render) { if (!list.length) return; var s = mk('div', 'qsec'); s.append(mk('div', 'qst', t + ' ' + list.length)); list.forEach(function (x) { s.append(render(x)); }); c.append(s); };
      sec('기록 안 한 상담 · 지금', b.miss, function (x) { var row = mk('div', 'qrow'); row.append(mk('span', 'chb ' + x.ch, chName(x.ch)), mk('span', null, clock(x.at) + ' 답함'), mk('span', 'sp'), link(x), okBtn(x, row, refresh)); return row; });
      sec('20분 넘긴 상담 · ' + md(qDay), b.late, function (x) { var row = mk('div', 'qrow'); row.append(mk('span', 'chb ' + x.ch, chName(x.ch)), mk('b', 'qw', (x.w || 0) + '분'), mk('span', 'muted', clock(x.at) + ' 답함'), mk('span', 'sp'), link(x)); return row; });
      sec('오래된 상담 · 지금', b.lh, function (x) { var row = mk('div', 'qrow'); row.append(mk('span', 'chb ' + x.ch, chName(x.ch)), mk('span', null, (x.h ? '톡톡 보류 탭' : '진행중') + ' · 영업일 ' + (x.d || 0) + '일'), mk('span', 'sp'), link(x), okBtn(x, row, refresh)); return row; });
      var un = unread(n); if (un.length) { var s2 = mk('div', 'qsec'); s2.append(mk('div', 'qst', '아직 확인 안 한 공지 ' + un.length)); un.slice(0, 5).forEach(function (o) { s2.append(mk('div', 'qrow muted', o.title || '(제목 없음)')); }); c.append(s2); }
      if (!total && !un.length) c.classList.add('done');
      return c;
    };
    var g = mk('div', 'qgrid'); names.forEach(function (n) { g.append(card(n)); }); w.append(g);
    if (!names.length) w.append(mk('div', 'empty', '아직 신호를 보낸 상담사가 없어요.'));
    // 공지 확인
    var p4 = mk('div', 'panel wide'); p4.append(mk('h3', 'qh', '공지 확인'), mk('p', 'muted', '상담사가 검색기에서 [확인했어요]를 누른 공지(이름은 기록기 태그로 자동)'));
    var ids = Object.keys(reads).sort(function (a, b) { return (reads[b].first || 0) - (reads[a].first || 0); }).slice(0, 20);
    if (!ids.length) p4.append(mk('div', 'empty', '아직 확인한 공지가 없어요.'));
    else p4.append(table(['공지', '확인함', '아직'], ids.map(function (id) {
      var o = reads[id], who = Object.keys(o.reads || {}).map(P), not = team.filter(function (n) { return who.indexOf(n) < 0; });
      return { cells: [{ text: o.title || '(제목 없음)', title: id.indexOf('s:') === 0 ? '족보 Daily 공지' : '관리자 공지' }, { text: who.join(' · ') || '–' }, { text: not.join(' · ') || '모두 확인', cls: not.length ? 'warnc' : '' }] };
    }), 'tread'));
    if (!(cfg && cfg.roster && cfg.roster.length)) p4.append(mk('p', 'muted', '‘아직’ 칸은 근무 달력의 상담사 명단으로 셈 — 명단이 비어 있으면 팀 현황에 신호를 보낸 사람으로 셈'));
    w.append(p4);
  }

  /* ───── 근무 달력: 야근 신청 승인 · 공휴일 · 명단 · 비수기 ───── */
  var cMonth = '';
  async function cal(w) {
    var title = '근무 달력';
    if (!(await ready(w, title, '상담사가 검색기 [근무] 탭에 그날 퇴근 시각을 적으면 여기 쌓여요(정시 19:00 뒤 넘은 시간이 야근). 승인은 이 화면에서만 해요 · 상담사 화면에는 승인 여부가 안 보여요. 공휴일·비수기 설정은 팀 현황의 ‘기다린 시간’ 계산에도 쓰여요.'))) return;
    var td = today(); if (!cMonth) cMonth = td.slice(0, 7);
    var m = cMonth, from = m + '-01', to = monthEnd(m), back = diffDays(from, td) + 1;
    var got;
    try { got = await Promise.all([getCfg(true), CSTeam.get('ot.list', { from: from, to: to }), back > 0 && back <= 62 ? CSTeam.get('qa.get', { days: back }) : Promise.resolve({ days: {} }), CSTeam.get('team.get', { days: 1 }).catch(function () { return { live: [] }; })]); }
    catch (e) { w.lastChild.textContent = '불러오지 못했어요. ' + e.message; return; }
    w.lastChild.remove();
    var cfgAll = got[0], cfg = cfgAll.cfg || {}, roster = (cfgAll.roster || []).slice(), items = got[1].items || [], qd = got[2].days || {}, P = T().person;
    var fullOf = {}; roster.forEach(function (x) { fullOf[x.name] = x.full || x.name; }); items.forEach(function (x) { if (x.full && !fullOf[x.name]) fullOf[x.name] = x.full; });
    var nmOf = function (n) { return fullOf[n] || n; };
    items = items.slice().sort(function (a, b) { return (fullOf[a.name] || a.name).localeCompare(fullOf[b.name] || b.name, 'ko') || (a.date < b.date ? -1 : 1); });
    var liveNames = (got[3].live || []).map(function (x) { return P(x.name); });
    var hol = W.holidays(cfg);
    var lastRec = function (name, day) { var x = qd[day] || {}, best = -1; Object.keys(x).forEach(function (n) { if (P(n) === name) (x[n].rt || []).forEach(function (v) { best = Math.max(best, v); }); }); return best >= 0 ? hhmm(best) : ''; };
    var tok = await T().adminToken();
    var decide = async function (x, st) { var rep = ''; try { await CSTeam.call('ot.decide', { id: x.id, status: st, reply: rep || '', adminToken: tok }); say(st === '승인' ? '승인했어요' : '반려했어요(상담사 달력에서도 빠져요)', 'ok'); cal(w); } catch (e) { say(e.message, 'err'); } };
    // 달 넘기기 · 내려받기
    var nav = mk('div', 'ins qnav');
    nav.append(btn('◀', '', function () { cMonth = addMonth(m, -1); cal(w); }), mk('b', null, Number(m.slice(0, 4)) + '년 ' + Number(m.slice(5)) + '월'), btn('▶', '', function () { cMonth = addMonth(m, 1); cal(w); }), btn('이번 달', m === td.slice(0, 7) ? 'on' : '', function () { cMonth = td.slice(0, 7); cal(w); }),
      btn('엑셀(CSV) 내려받기', '', function () {
        var lines = [['날짜', '요일', '이름', '퇴근', '야근(분)', '야근', '상태', '그날 마지막 기록']].concat(items.map(function (x) { return [x.date, WD[W.weekday(x.date)], x.name, x.to, x.mins, hm(x.mins || 0), x.status, lastRec(x.name, x.date)]; }));
        var csv = '﻿' + lines.map(function (r) { return r.map(function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\r\n');
        var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = '야근_' + m + '.csv'; document.body.append(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      }));
    Array.prototype.forEach.call(nav.querySelectorAll('button'), function (b) { b.className = b.className.replace('btn ghost', '').replace('btn ', '').trim(); });
    w.append(nav);
    // 승인 기다리는 신청
    var wait = items.filter(function (x) { return x.status === '신청'; });
    var p1 = mk('div', 'panel'); p1.style.maxWidth = '980px'; p1.append(mk('h3', 'qh', '승인할 야근 ' + wait.length));
    if (!wait.length) p1.append(mk('div', 'empty', '이달에 승인할 야근이 없어요.'));
    wait.forEach(function (x) {
      var r2 = mk('div', 'qrow ot'), lr = lastRec(x.name, x.date);
      r2.append(mk('b', null, nmOf(x.name)), mk('span', null, md(x.date) + ' 퇴근 ' + x.to + ' · 야근 ' + hm(x.mins || 0)));
      if (x.note) r2.append(mk('span', 'muted', x.note));
      if (lr) r2.append(mk('span', 'chip use', '그날 마지막 기록 ' + lr));
      r2.append(mk('span', 'sp'), btn('승인', 'primary sm', function () { decide(x, '승인'); }), btn('반려', 'danger-ghost sm', function () { decide(x, '반려'); }));
      p1.append(r2);
    });
    w.append(p1);
    // 달력
    var p2 = mk('div', 'panel'); p2.style.maxWidth = '1100px'; p2.append(mk('h3', 'qh', '달력'));
    // 평일만(토·일 칸은 뺌)
    var grid = mk('div', 'wcal'); ['월', '화', '수', '목', '금'].forEach(function (x) { grid.append(mk('div', 'wd', x)); });
    var fw = W.weekday(from), lead = fw === 0 || fw === 6 ? 0 : fw - 1, nd = Number(to.slice(8, 10));
    for (var i = 0; i < lead; i++) grid.append(mk('div', 'wc blank'));
    for (var d = 1; d <= nd; d++) {
      var k = m + '-' + String(d).padStart(2, '0'), wd = W.weekday(k); if (wd === 0 || wd === 6) continue;
      var cell = mk('div', 'wc' + (hol[k] || wd === 0 ? ' off' : wd === 6 ? ' sat' : '') + (k === td ? ' today' : ''));
      cell.append(mk('span', 'n', String(d))); if (hol[k]) cell.append(mk('span', 'h', hol[k]));
      items.filter(function (x) { return x.date === k; }).forEach(function (x) { var o = mk('span', 'ot ' + (x.status === '승인' ? 'ok' : x.status === '반려' ? 'no' : 'wait'), nmOf(x.name) + ' ' + x.to); o.title = x.status + ' · 야근 ' + hm(x.mins || 0); cell.append(o); });
      grid.append(cell);
    }
    p2.append(grid);
    // 팀장이 바로 적기(바로 승인)
    var names = activeNames(roster, td, liveNames);
    var f = mk('div', 'facts'), sel = mk('select', 'sel'); sel.style.width = '120px'; sel.setAttribute('aria-label', '이름'); names.forEach(function (n) { sel.append(new Option(n, n)); });
    var di = mk('input', 'in'); di.type = 'date'; di.value = td.slice(0, 7) === m ? td : from; di.style.width = '150px';
    var ti = mk('input', 'in'); ti.type = 'time'; ti.value = '20:00'; ti.step = 600; ti.style.width = '120px'; ti.title = '퇴근 시각';
    f.append(sel, di, ti, btn('바로 적기(승인)', 'ghost sm', async function () { if (!sel.value) { say('아래 상담사 명단에 이름을 먼저 넣어 주세요', 'err'); return; } if (!ti.value || ti.value.slice(0, 5) <= '19:00') { say('정시(19:00)보다 늦은 퇴근 시각을 골라 주세요', 'err'); return; } try { await CSTeam.call('ot.add', { name: sel.value, date: di.value, from: '19:00', to: ti.value.slice(0, 5), adminToken: tok }); say('적었어요', 'ok'); cal(w); } catch (e) { say(e.message, 'err'); } }));
    p2.append(mk('p', 'muted', '팀장이 대신 적기(퇴근 시각 · 바로 승인돼요)'), f);
    w.append(p2);
    // 이달 합계
    var p3 = mk('div', 'panel'); p3.style.maxWidth = '980px'; p3.append(mk('h3', 'qh', Number(m.slice(5)) + '월 야근 합계'));
    var sum = {}; names.forEach(function (n) { sum[n] = { ok: 0, okN: 0, wait: 0, no: 0 }; });
    items.forEach(function (x) { var s2 = sum[x.name] || (sum[x.name] = { ok: 0, okN: 0, wait: 0, no: 0 }); if (x.status === '승인') { s2.ok += x.mins || 0; s2.okN++; } else if (x.status === '신청') s2.wait++; else s2.no++; });
    var sn = Object.keys(sum).sort(function (a, b) { return a.localeCompare(b, 'ko'); });
    var all = 0;
    p3.append(table(['상담사', '승인된 야근', '건수', '승인할 것', '반려'], sn.map(function (n) { var s2 = sum[n]; all += s2.ok; return { cells: [nmOf(n), { text: s2.ok ? hm(s2.ok) : '–' }, String(s2.okN), { text: String(s2.wait), cls: s2.wait ? 'warnc' : '' }, String(s2.no)] }; }).concat([{ cls: 'total', cells: ['합계', hm(all), '', '', ''] }])));
    var done = items.filter(function (x) { return x.status !== '신청'; });
    if (done.length) {
      var det = mk('details', 'qdet'); det.append(mk('summary', null, '처리한 신청 ' + done.length + '건 보기'));
      done.forEach(function (x) { var r3 = mk('div', 'qrow'); r3.append(mk('span', 'chip ' + (x.status === '승인' ? 'new' : 'err'), x.status), mk('b', null, nmOf(x.name)), mk('span', null, md(x.date) + ' 퇴근 ' + x.to + ' · 야근 ' + hm(x.mins || 0)), mk('span', 'sp'), btn('지우기', 'danger-ghost sm', async function () { try { await CSTeam.call('ot.cancel', { id: x.id, adminToken: tok }); cal(w); } catch (e) { say(e.message, 'err'); } })); det.append(r3); });
      p3.append(det);
    }
    w.append(p3);
    // 설정: 비수기 · 공휴일 · 명단
    var p4 = mk('div', 'panel'); p4.style.maxWidth = '980px'; p4.append(mk('h3', 'qh', '설정'));
    var save = async function (patch, msg) { try { await CSTeam.call('cfg.set', Object.assign({ adminToken: tok }, patch)); cfgCache = null; say(msg || '저장했어요', 'ok'); cal(w); } catch (e) { say(e.message, 'err'); } };
    var sw = mk('label', 'qsw'), cb = mk('input'); cb.type = 'checkbox'; cb.checked = !!cfg.offseason;
    cb.addEventListener('change', function () { save({ offseason: cb.checked }, cb.checked ? '비수기: 18시 뒤 새 문의도 셈' : '평소대로: 18시 뒤 새 문의는 다음 날 10시부터'); });
    sw.append(cb, mk('span', null, '비수기 — 18시(목 16시) 뒤에 들어온 새 문의도 바로 기다린 시간으로 셈'));
    p4.append(sw, mk('p', 'muted', '평소: 진행 중 상담(답한 상담에 고객이 다시 보냄)은 19시(목 17시)까지, 새 문의는 18시(목 16시)까지 셈 · 점심 12:30~14:00 · 주말·공휴일은 셈하지 않음'));
    // 공휴일(이 달과 다음 달)
    var hp = mk('div', 'qhol'), custom = Object.assign({}, cfg.holidays || {}), removed = (cfg.removed || []).slice();
    var range = Object.keys(hol).filter(function (k) { return k >= from && k <= monthEnd(addMonth(m, 1)); }).sort();
    hp.append(mk('b', null, '공휴일 (' + Number(m.slice(5)) + '·' + Number(addMonth(m, 1).slice(5)) + '월)'));
    if (!range.length) hp.append(mk('span', 'muted', ' 없음'));
    range.forEach(function (k) { var c = mk('span', 'chip use', md(k) + ' ' + hol[k] + ' '); var x = mk('button', 'lk', '✕'); x.type = 'button'; x.title = '공휴일에서 빼기'; x.addEventListener('click', function () { if (custom[k]) delete custom[k]; else removed.push(k); save({ holidays: custom, removed: removed }, '뺐어요'); }); c.append(x); hp.append(c); });
    var hd = mk('input', 'in'); hd.type = 'date'; hd.style.width = '150px'; var hn = mk('input', 'in'); hn.type = 'text'; hn.placeholder = '이름(예: 회사 창립일)'; hn.style.width = '180px';
    var hf = mk('div', 'facts'); hf.append(hd, hn, btn('쉬는 날 더하기', 'ghost sm', function () { if (!hd.value) return; custom[hd.value] = hn.value.trim() || '휴일'; removed = removed.filter(function (x) { return x !== hd.value; }); save({ holidays: custom, removed: removed }, '더했어요'); }));
    p4.append(hp, hf);
    // 명단
    p4.append(mk('b', null, '상담사 명단'), mk('p', 'muted', '성까지 적어 주세요(김수빈). 화면에는 성 뺀 이름(수빈)으로 나오고, 순서는 성까지 넣은 이름 가나다순이에요. 입사·퇴사일 사이에만 나와요.'));
    var rl = mk('div', 'qroster');
    var draw = function () {
      rl.replaceChildren();
      roster.forEach(function (x, i) {
        var r4 = mk('div', 'facts'), n = mk('input', 'in'), s1 = mk('input', 'in'), e1 = mk('input', 'in');
        n.type = 'text'; n.value = x.full || x.name; n.placeholder = '성까지(김수빈)'; n.style.width = '130px'; n.addEventListener('input', function () { x.name = n.value.trim(); x.full = ''; });
        s1.type = 'date'; s1.value = x.start || ''; s1.style.width = '150px'; s1.title = '입사일(비워도 돼요)'; s1.addEventListener('change', function () { x.start = s1.value; });
        e1.type = 'date'; e1.value = x.end || ''; e1.style.width = '150px'; e1.title = '퇴사일(근무 중이면 비워 둠)'; e1.addEventListener('change', function () { x.end = e1.value; });
        r4.append(n, mk('span', 'muted', '입사'), s1, mk('span', 'muted', '퇴사'), e1, btn('✕', 'danger-ghost sm', function () { roster.splice(i, 1); draw(); }));
        rl.append(r4);
      });
    };
    draw();
    if (!roster.length && liveNames.length) liveNames.filter(function (n) { return n !== '팀장'; }).forEach(function (n) { roster.push({ name: n, start: '', end: '' }); }), draw();
    var rf = mk('div', 'facts'); rf.append(btn('+ 사람 더하기', 'ghost sm', function () { roster.push({ name: '', start: td, end: '' }); draw(); }), btn('명단 저장', 'primary sm', function () { save({ roster: roster.filter(function (x) { return x.name; }) }, '명단을 저장했어요'); }));
    p4.append(rl, rf);
    w.append(p4);
  }

  var add = function () { if (!window.KBAdminExtra || !window.KBTeam) return setTimeout(add, 50); Object.assign(KBAdminExtra.views, { flow: flow, sites: sites, qa: qa, cal: cal }); };
  add();
  window.KBTeam2 = { flowOf: flowOf, teamNames: teamNames, teamCards: teamCards };
})();
