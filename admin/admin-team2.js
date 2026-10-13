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
    w.replaceChildren(mk('h2', null, title), mk('p', 'desc', desc), mk('div', 'empty', '불러오는 중…'));
    if (!(await T().ensureUrl())) { T().needServer(w, title); return false; }
    return true;
  }
  var cfgCache = null;
  async function getCfg(force) { if (!cfgCache || force) cfgCache = await CSTeam.call('cfg.get', {}); return cfgCache; }
  // 명단(입사~퇴사 사이) — 비어 있으면 팀 현황에 신호를 보낸 이름
  function activeNames(roster, day, fallback) {
    var r = (roster || []).filter(function (x) { return (!x.start || x.start <= day) && (!x.end || x.end >= day); }).map(function (x) { return x.name; });
    return r.length ? r : (fallback || []);
  }

  /* ───── 상담사 고르기(전체 · 사람별): 팀 현황 · 업무 흐름 · 확인할 상담이 같이 씀(고른 사람은 기억) ───── */
  var PK = 'kb:teamPerson';
  function picked() { try { return localStorage.getItem(PK) || ''; } catch (e) { return ''; } }
  function pick(n) { try { if (n) localStorage.setItem(PK, n); else localStorage.removeItem(PK); } catch (e) {} }
  // names: 보여 줄 사람 · counts: 이름 → 숫자(빨간 점) · onPick: 다시 그리기
  function personBar(names, counts, onPick) {
    var cur = picked(), bar = mk('div', 'pbar'); bar.setAttribute('role', 'tablist'); bar.setAttribute('aria-label', '상담사');
    var chip = function (n, label) {
      var b = mk('button', 'pchip' + (cur === n ? ' on' : '')); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(cur === n));
      if (n) b.append(mk('span', 'av', n.slice(0, 1)));
      b.append(mk('span', null, label || n));
      var c = n ? (counts && counts[n]) : (counts && Object.keys(counts).reduce(function (s2, k) { return s2 + (counts[k] || 0); }, 0));
      if (c) b.append(mk('span', 'pc', String(c)));
      b.addEventListener('click', function () { pick(n); onPick(); });
      return b;
    };
    bar.append(chip('', '전체'));
    names.forEach(function (n) { bar.append(chip(n)); });
    return bar;
  }
  async function teamNames(extra) {
    var cfg = await getCfg().catch(function () { return null; }), td = today(), set = {};
    activeNames(cfg && cfg.roster, td, []).forEach(function (n) { set[n] = 1; });
    (extra || []).forEach(function (n) { if (n) set[n] = 1; });
    var out = Object.keys(set).sort(function (a, b) { return (a === '팀장') - (b === '팀장') || a.localeCompare(b, 'ko'); });
    if (picked() && out.indexOf(picked()) < 0) pick('');
    return out;
  }
  function tile(label, value, sub, cls) { var t = mk('div', 'tile' + (cls ? ' ' + cls : '')); t.append(mk('span', 'tl', label), mk('b', 'tv', value)); if (sub) t.append(mk('span', 'ts', sub)); return t; }
  function goView(v, n) { pick(n); A().setView(v); }

  /* ───── 팀 현황 · 사람별 한 장: 지금 · 오늘 숫자 · 이번 주 · 확인할 것 · 오늘 흐름 ───── */
  async function personTeam(w, name, r, week) {
    var P = T().person, now = Date.now(), td = today();
    var live = (r.live || []).find(function (x) { return P(x.name) === name; }) || null;
    var q = await CSTeam.call('qa.get', { days: 1 }).catch(function () { return { days: {}, live: {} }; });
    var ql = {}; Object.keys(q.live || {}).forEach(function (n) { if (P(n) === name) ql = q.live[n]; });
    var qd = ((q.days || {})[td] || {}), rt = [], late = [];
    Object.keys(qd).forEach(function (n) { if (P(n) === name) { rt = rt.concat(qd[n].rt || []); late = late.concat(qd[n].late || []); } });
    var days = r.days || {}, sum = function (keys) { var o = { answered: 0, waitSum: 0, over20: 0, maxWait: 0, holds: 0, records: 0 }; keys.forEach(function (d) { var x = days[d] || {}; Object.keys(x).forEach(function (n) { if (P(n) !== name) return; var v = x[n]; ['answered', 'waitSum', 'over20', 'holds', 'records'].forEach(function (k) { o[k] += v[k] || 0; }); o.maxWait = Math.max(o.maxWait, v.maxWait || 0); }); }); return o; };
    var s = sum([td]);
    // 머리: 지금 상태
    var off = !live || now - live.at > 3 * 60000, hot = !off && (live.oldestMin || 0) >= 20;
    var hd = mk('div', 'phead' + (off ? ' off' : hot ? ' hot' : ''));
    var who = mk('div', 'pwho'); who.append(mk('span', 'av big', name.slice(0, 1)), mk('b', null, name));
    var st = mk('div', 'pnow');
    if (off) st.append(mk('span', 'muted', live ? '기록기 신호 없음 · ' + ago(live.at) : '오늘 신호가 아직 없어요'));
    else st.append(mk('span', 'big', (live.pending || 0) + '명 대기'), mk('span', null, live.pending ? '가장 오래 ' + (live.oldestMin || 0) + '분' : '기다리는 고객 없음'), mk('span', 'muted', (live.channels || '') + ' · ' + ago(live.at)));
    hd.append(who, st); w.append(hd);
    // 오늘 숫자
    var g1 = mk('div', 'tiles');
    g1.append(tile('답한 상담', String(s.answered)), tile('평균 대기', s.answered ? Math.round(s.waitSum / s.answered) + '분' : '–', '업무시간 기준'), tile('20분 넘김', String(s.over20), '', s.over20 ? 'bad' : ''), tile('가장 오래', s.maxWait ? s.maxWait + '분' : '–', '', s.maxWait >= 20 ? 'bad' : ''), tile('보류', String(s.holds)), tile('기록', String(s.records)));
    var p1 = mk('div', 'panel wide'); p1.append(mk('h3', 'qh', '오늘'), g1); w.append(p1);
    // 확인할 것 · 오늘 흐름(누르면 그 화면으로)
    var f = flowOf(rt), miss = (ql.miss || []).length, lh = (ql.lh || []).length;
    var g2 = mk('div', 'tiles');
    var linkTile = function (t, v) { t.classList.add('go'); t.tabIndex = 0; t.setAttribute('role', 'button'); t.addEventListener('click', function () { goView(v, name); }); t.addEventListener('keydown', function (e) { if (e.key === 'Enter') goView(v, name); }); return t; };
    g2.append(linkTile(tile('기록 안 한 상담', String(miss), '확인할 상담 →', miss ? 'bad' : ''), 'qa'), linkTile(tile('20분 넘긴 상담', String(late.length), '확인할 상담 →', late.length ? 'bad' : ''), 'qa'), linkTile(tile('오래된 상담', String(lh), '확인할 상담 →', lh ? 'warn' : ''), 'qa'),
      linkTile(tile('시간당 기록', f.n ? f.perHour.toFixed(1) : '–', '업무 흐름 →'), 'flow'), linkTile(tile('기록 사이 텀', f.n > 1 ? f.med + '분' : '–', '업무 흐름 →'), 'flow'), linkTile(tile('30분+ 빈 구간', f.n ? String(f.long.length) : '–', '업무 흐름 →', f.long && f.long.length ? 'warn' : ''), 'flow'));
    var p2 = mk('div', 'panel wide'); p2.append(mk('h3', 'qh', '확인할 것 · 오늘 흐름'), g2); w.append(p2);
    // 이번 주(요일별 막대) · 주간 · 월간
    var R = week, wd = ['월', '화', '수', '목', '금', '토', '일'], max = 1;
    var cols = R.days.map(function (d, i) { var o = sum([d]); max = Math.max(max, o.answered, o.records); return { d: d, i: i, o: o }; }).filter(function (c) { return c.i < 5 || c.o.answered || c.o.records; });
    var ch = mk('div', 'wbars');
    cols.forEach(function (c) {
      var col = mk('div', 'wbar' + (c.d === td ? ' now' : '') + (c.d > td ? ' fut' : ''));
      var bars = mk('div', 'bb'), a = mk('span', 'ba'), b = mk('span', 'br'); a.style.height = (c.o.answered / max * 100) + '%'; b.style.height = (c.o.records / max * 100) + '%'; a.title = '답한 상담 ' + c.o.answered; b.title = '기록 ' + c.o.records; bars.append(a, b);
      col.append(mk('b', 'bv', c.d > td ? '' : String(c.o.answered)), bars, mk('span', 'bl', wd[c.i] + ' ' + Number(c.d.slice(8, 10))));
      ch.append(col);
    });
    var wk = sum(R.days.filter(function (d) { return d <= td; })), mo = sum(Object.keys(days).filter(function (d) { return d.slice(0, 7) === R.month && d <= td; }));
    var side = mk('div', 'tiles col'); side.append(tile('이번 주', wk.answered + '건', '기록 ' + wk.records), tile(Number(R.month.slice(5)) + '월', mo.answered + '건', '기록 ' + mo.records));
    var row = mk('div', 'wrow2'); row.append(ch, side);
    var p3 = mk('div', 'panel wide'); p3.append(mk('h3', 'qh', '이번 주'), row, mk('p', 'muted', '진한 막대 = 답한 상담 · 옅은 막대 = 기록')); w.append(p3);
  }
  function ago(t) { var m = Math.floor((Date.now() - t) / 60000); return m < 1 ? '방금' : m < 60 ? m + '분 전' : Math.floor(m / 60) + '시간 전'; }

  /* ───── 업무 흐름: 그날 기록 시각으로 시간대별 건수 · 시간당 · 텀 ───── */
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
  // 하루 띠: 10시~퇴근 사이 기록한 때(눈금) · 30분 넘게 빈 구간(빨강) · 점심(회색)
  function strip(f) {
    var lo = Math.min(9 * 60 + 30, f.first - 10), hi = Math.max(19 * 60 + 30, f.last + 10), span = hi - lo, pos = function (m) { return ((m - lo) / span * 100) + '%'; };
    var box = mk('div', 'strip'), L = W.LUNCH;
    var lu = mk('span', 'lunch'); lu.style.left = pos(L[0]); lu.style.width = ((L[1] - L[0]) / span * 100) + '%'; lu.title = '점심 12:30~14:00'; box.append(lu);
    f.long.forEach(function (x) { var g = mk('span', 'gap'); g.style.left = pos(x[0]); g.style.width = ((x[1] - x[0]) / span * 100) + '%'; g.title = hhmm(x[0]) + '~' + hhmm(x[1]) + ' 기록 없음 (점심 빼고 ' + x[2] + '분)'; box.append(g); });
    f.t.forEach(function (m) { var k = mk('span', 'tick'); k.style.left = pos(m); k.title = hhmm(m); box.append(k); });
    var ax = mk('div', 'axis'); for (var h = Math.ceil(lo / 60); h * 60 <= hi; h++) { var a = mk('span', null, h + '시'); a.style.left = pos(h * 60); ax.append(a); }
    var wrap = mk('div', 'stripw'); wrap.append(box, ax); return wrap;
  }
  async function flow(w) {
    var title = '업무 흐름';
    if (!(await ready(w, title, '기록한 시각으로 본 하루 흐름이에요. 시간당 건수 · 기록 사이 텀(점심 빼고) · 30분 넘게 기록이 없던 구간. 긴 통화나 어려운 상담도 빈 구간으로 보이니 참고용으로만 봐 주세요.'))) return;
    var td = today(); if (!fDay || fDay > td) fDay = td;
    var back = diffDays(fDay, td) + 1, q;
    try { q = await CSTeam.call('qa.get', { days: Math.min(62, back + 6) }); }
    catch (e) { w.lastChild.textContent = '불러오지 못했어요. ' + e.message; return; }
    w.lastChild.remove();
    var P = T().person, rtOf = function (d) { var o = {}, x = (q.days || {})[d] || {}; Object.keys(x).forEach(function (n) { var k = P(n); (o[k] || (o[k] = [])).push.apply(o[k], x[n].rt || []); }); return o; };
    var people = rtOf(fDay), F = {}; Object.keys(people).forEach(function (n) { F[n] = flowOf(people[n]); });
    var names = await teamNames(Object.keys(people)), cur = picked(), counts = {}; Object.keys(F).forEach(function (n) { counts[n] = 0; });
    w.append(personBar(names, null, function () { flow(w); }), dayNav(fDay, td, function (d) { fDay = d; flow(w); }));
    if (diffDays(fDay, td) >= 62) { w.append(mk('div', 'empty', '기록 시각은 62일 동안만 보관해요.')); return; }
    if (cur) {
      // 사람별: 숫자 · 하루 띠 · 시간대 막대 · 최근 7일
      var f = F[cur] || flowOf([]);
      var p = mk('div', 'panel wide');
      if (!f.n) { p.append(mk('div', 'empty', cur + ' · 이날 기록 시각이 없어요.')); w.append(p); }
      else {
        var g = mk('div', 'tiles'); g.append(tile('기록', f.n + '건'), tile('시간당', f.perHour.toFixed(1) + '건', '점심 빼고'), tile('기록 사이 텀', f.med + '분', '가운데 값'), tile('30분+ 빈 구간', String(f.long.length), '', f.long.length ? 'warn' : ''), tile('첫 기록 – 마지막', hhmm(f.first) + ' – ' + hhmm(f.last), '', 'small'));
        p.append(mk('h3', 'qh', cur + ' · ' + md(fDay)), g, mk('p', 'muted', '하루 띠 — 눈금 = 기록한 때 · 빨강 = 30분 넘게 기록 없음 · 회색 = 점심'), strip(f));
        if (f.long.length) { var gl = mk('div', 'qgaps'); f.long.forEach(function (x) { gl.append(mk('div', null, hhmm(x[0]) + ' ~ ' + hhmm(x[1]) + ' · ' + x[2] + '분 동안 기록 없음')); }); p.append(gl); }
        var hb = mk('div', 'hbars'), lo = Math.min(10, Math.floor(f.first / 60)), hi = Math.max(18, Math.floor(f.last / 60)), mx = 1;
        for (var h = lo; h <= hi; h++) mx = Math.max(mx, f.hours[h] || 0);
        for (var h2 = lo; h2 <= hi; h2++) { var v = f.hours[h2] || 0, c = mk('div', 'hcol'), bar = mk('span', 'hbar'); bar.style.height = (v / mx * 100) + '%'; c.append(mk('b', null, v ? String(v) : ''), mk('div', 'hbw'), mk('span', 'hl', h2 + '시')); c.children[1].append(bar); hb.append(c); }
        p.append(mk('p', 'muted', '시간대별 기록 수'), hb);
        w.append(p);
      }
      var p7 = mk('div', 'panel wide'); p7.append(mk('h3', 'qh', '최근 7일'));
      var rows = []; for (var i = 6; i >= 0; i--) { var d = W.addDays(fDay, -i), ff = flowOf((rtOf(d)[cur]) || []); rows.push({ cls: d === fDay ? 'cur' : '', cells: [md(d), { text: ff.n ? String(ff.n) : '–', cls: ff.n ? '' : 'z' }, { text: ff.n ? ff.perHour.toFixed(1) : '–' }, { text: ff.n > 1 ? ff.med + '분' : '–' }, { text: ff.n ? String(ff.long.length) : '–', cls: ff.long.length ? 'warnc' : '' }, { text: ff.n ? hhmm(ff.first) + '–' + hhmm(ff.last) : '–' }] }); }
      p7.append(table(['날짜', '기록', '시간당', '텀(보통)', '30분+ 빈 구간', '첫–마지막'], rows, 'tweek'));
      w.append(p7); return;
    }
    // 전체: 사람마다 한 줄(누르면 그 사람)
    var list = Object.keys(F).sort(function (a, b) { return (a === '팀장') - (b === '팀장') || a.localeCompare(b, 'ko'); });
    var p0 = mk('div', 'panel wide'); p0.append(mk('h3', 'qh', '시간대별 기록'));
    if (!list.length) p0.append(mk('div', 'empty', '이날 기록 시각이 아직 없어요.\n상담사 기록기 2.4.0부터 쌓여요.'));
    else {
      var lo2 = 10, hi2 = 18; list.forEach(function (n) { var f2 = F[n]; lo2 = Math.min(lo2, Math.floor(f2.first / 60)); hi2 = Math.max(hi2, Math.floor(f2.last / 60)); });
      var hours = []; for (var hh = lo2; hh <= hi2; hh++) hours.push(hh);
      var max = 1; list.forEach(function (n) { hours.forEach(function (h3) { max = Math.max(max, F[n].hours[h3] || 0); }); });
      var rows2 = list.map(function (n) {
        var f3 = F[n], nm = mk('button', 'plink'); nm.type = 'button'; nm.append(mk('span', 'av', n.slice(0, 1)), n); nm.addEventListener('click', function () { pick(n); flow(w); });
        var cells = [{ node: nm }];
        hours.forEach(function (h3) { var v = f3.hours[h3] || 0, sp = mk('span', 'hb', v ? String(v) : '·'); sp.style.setProperty('--a', String(v / max)); cells.push({ node: sp, cls: 'hc' + (v ? '' : ' z') }); });
        cells.push({ text: String(f3.n), cls: 'sum' }, { text: f3.perHour.toFixed(1) }, { text: f3.n > 1 ? f3.med + '분' : '–' }, { text: String(f3.long.length), cls: f3.long.length ? 'warnc' : '', title: f3.long.map(function (x) { return hhmm(x[0]) + '~' + hhmm(x[1]) + ' (' + x[2] + '분)'; }).join('\n') }, { text: hhmm(f3.first) + '–' + hhmm(f3.last) });
        return { cells: cells };
      });
      p0.append(table(['상담사'].concat(hours.map(function (h3) { return h3 + '시'; }), ['합계', '시간당', '텀(보통)', '30분+ 빈 구간', '첫–마지막']), rows2, 'tflow'));
      p0.append(mk('p', 'muted', '이름을 누르면 그 사람의 하루 띠 · 최근 7일을 봐요 · 시간당 = 기록 수 ÷ 첫 기록~마지막 기록 시간(점심 빼고) · 텀(보통) = 기록 사이 시간의 가운데 값'));
    }
    w.append(p0);
  }

  /* ───── 게시판 건수: 그날 게시판 사이트별 기록 수(사람별) · 이달 합계 ───── */
  var sDay = '';
  async function sites(w) {
    var title = '게시판 건수';
    if (!(await ready(w, title, '게시판에서 기록할 때 고른 구매처로 저절로 세요. 상담사 PC는 1분마다 · 팀장 PC(태그 여러 개)는 5분마다 ‘팀장’ 줄로 들어와요.'))) return;
    var td = today(); if (!sDay || sDay > td) sDay = td;
    var mon = sDay.slice(0, 7), back = Math.max(diffDays(sDay, td), diffDays(mon + '-01', td)) + 1, g;
    try { g = await CSTeam.call('team.get', { days: Math.min(400, back) }); } catch (e) { w.lastChild.textContent = '불러오지 못했어요. ' + e.message; return; }
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
    try { var got = await Promise.all([CSTeam.call('qa.get', { days: Math.min(62, diffDays(qDay, td) + 1) }), CSTeam.call('notice.reads', {}).catch(function () { return { reads: {} }; }), getCfg().catch(function () { return null; })]); r = got[0]; reads = got[1].reads || {}; cfg = got[2]; }
    catch (e) { w.lastChild.textContent = '불러오지 못했어요. ' + e.message; return; }
    w.lastChild.remove();
    var P = T().person, live = r.live || {}, tok = await T().adminToken();
    var by = {}, box = function (n) { return by[n] || (by[n] = { miss: [], late: [], lh: [] }); };
    Object.keys(live).forEach(function (n) { var b = box(P(n)); b.miss = b.miss.concat(live[n].miss || []); b.lh = b.lh.concat(live[n].lh || []); });
    var dd = (r.days || {})[qDay] || {}; Object.keys(dd).forEach(function (n) { var b = box(P(n)); b.late = b.late.concat((dd[n] || {}).late || []); });
    Object.keys(by).forEach(function (n) { by[n].late.sort(function (a, b) { return (b.w || 0) - (a.w || 0); }); by[n].lh.sort(function (a, b) { return (b.d || 0) - (a.d || 0); }); });
    var names = (await teamNames(Object.keys(by))).filter(function (n) { return n !== '팀장'; }), counts = {};
    names.forEach(function (n) { var b = by[n] || {}; counts[n] = (b.miss || []).length + (b.late || []).length + (b.lh || []).length; });
    var cur = picked(); if (cur === '팀장') cur = '';
    w.append(personBar(names, counts, function () { qa(w); }));
    var nav = dayNav(qDay, td, function (d) { qDay = d; qa(w); }); nav.prepend(mk('span', 'nl', '20분 넘긴 상담 날짜'));
    w.append(nav);
    var okBtn = function (x, row, card) { return btn('확인함', 'ghost sm', async function () { try { await CSTeam.call('qa.ok', { key: x.ch + ':' + x.id, adminToken: tok }); row.remove(); if (card) card(); say('목록에서 뺐어요', 'ok'); } catch (e) { say(e.message, 'err'); } }); };
    var team = names.filter(function (n) { return n !== '팀장'; });
    var unread = function (n) { return Object.keys(reads).filter(function (id) { return !Object.keys(reads[id].reads || {}).map(P).includes(n); }).map(function (id) { return reads[id]; }); };
    var card = function (n, wide) {
      var b = by[n] || { miss: [], late: [], lh: [] }, c = mk('div', 'qcard' + (wide ? ' wide' : '')), total = b.miss.length + b.late.length + b.lh.length;
      var h = mk('div', 'qch'), nm = mk('button', 'plink'); nm.type = 'button'; nm.append(mk('span', 'av', n.slice(0, 1)), n); nm.addEventListener('click', function () { pick(wide ? '' : n); qa(w); });
      h.append(nm, mk('span', 'sp'));
      var badge = function (t, v, cls) { if (v) h.append(mk('span', 'qbadge ' + cls, t + ' ' + v)); };
      badge('기록 안 함', b.miss.length, 'red'); badge('20분 넘김', b.late.length, 'red'); badge('오래된', b.lh.length, 'amber');
      if (!total) h.append(mk('span', 'qbadge ok', '확인할 것 없음'));
      c.append(h);
      var refresh = function () { if (!c.querySelector('.qrow')) c.classList.add('done'); };
      var sec = function (t, list, render) { if (!list.length) return; var s = mk('div', 'qsec'); s.append(mk('div', 'qst', t + ' ' + list.length)); list.forEach(function (x) { s.append(render(x)); }); c.append(s); };
      sec('기록 안 한 상담 · 지금', b.miss, function (x) { var row = mk('div', 'qrow'); row.append(mk('span', 'chb ' + x.ch, chName(x.ch)), mk('span', null, clock(x.at) + ' 답함'), mk('span', 'sp'), link(x), okBtn(x, row, refresh)); return row; });
      sec('20분 넘긴 상담 · ' + md(qDay), b.late, function (x) { var row = mk('div', 'qrow'); row.append(mk('span', 'chb ' + x.ch, chName(x.ch)), mk('b', 'qw', (x.w || 0) + '분'), mk('span', 'muted', clock(x.at) + ' 답함'), mk('span', 'sp'), link(x)); return row; });
      sec('오래된 상담 · 지금', b.lh, function (x) { var row = mk('div', 'qrow'); row.append(mk('span', 'chb ' + x.ch, chName(x.ch)), mk('span', null, (x.h ? '톡톡 보류 탭' : '진행중') + ' · 영업일 ' + (x.d || 0) + '일'), mk('span', 'sp'), link(x), okBtn(x, row, refresh)); return row; });
      if (wide) { var un = unread(n); var s2 = mk('div', 'qsec'); s2.append(mk('div', 'qst', '아직 확인 안 한 공지 ' + un.length)); if (!un.length) s2.append(mk('div', 'muted', '모두 확인했어요')); un.slice(0, 15).forEach(function (o) { s2.append(mk('div', 'qrow', o.title || '(제목 없음)')); }); c.append(s2); }
      if (!total && !wide) c.classList.add('done');
      return c;
    };
    if (cur) { var g1 = mk('div', 'qgrid one'); g1.append(card(cur, true)); w.append(g1); return; }
    var g = mk('div', 'qgrid'); names.slice().sort(function (a, b) { return (counts[b] || 0) - (counts[a] || 0) || a.localeCompare(b, 'ko'); }).forEach(function (n) { g.append(card(n)); }); w.append(g);
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
    try { got = await Promise.all([getCfg(true), CSTeam.call('ot.list', { from: from, to: to }), back > 0 && back <= 62 ? CSTeam.call('qa.get', { days: back }) : Promise.resolve({ days: {} }), CSTeam.call('team.get', { days: 1 }).catch(function () { return { live: [] }; })]); }
    catch (e) { w.lastChild.textContent = '불러오지 못했어요. ' + e.message; return; }
    w.lastChild.remove();
    var cfgAll = got[0], cfg = cfgAll.cfg || {}, roster = (cfgAll.roster || []).slice(), items = got[1].items || [], qd = got[2].days || {}, P = T().person;
    var liveNames = (got[3].live || []).map(function (x) { return P(x.name); });
    var hol = W.holidays(cfg);
    var lastRec = function (name, day) { var x = qd[day] || {}, best = -1; Object.keys(x).forEach(function (n) { if (P(n) === name) (x[n].rt || []).forEach(function (v) { best = Math.max(best, v); }); }); return best >= 0 ? hhmm(best) : ''; };
    var tok = await T().adminToken();
    var decide = async function (x, st) { var rep = ''; try { await CSTeam.call('ot.decide', { id: x.id, status: st, reply: rep || '', adminToken: tok }); say(st === '승인' ? '승인했어요' : '반려했어요(상담사 달력에서도 빠져요)', 'ok'); cal(w); } catch (e) { say(e.message, 'err'); } };
    // 상담사 고르기: 고르면 그 사람 것만(승인할 것 · 달력)
    var allItems = items, cur = picked(), cnt = {}; allItems.forEach(function (x) { if (x.status === '신청') cnt[x.name] = (cnt[x.name] || 0) + 1; });
    var pn = await teamNames(allItems.map(function (x) { return x.name; }).concat(liveNames));
    pn = pn.filter(function (n) { return n !== '팀장'; }); if (cur && pn.indexOf(cur) < 0) cur = '';
    w.append(personBar(pn, cnt, function () { cal(w); }));
    if (cur) items = allItems.filter(function (x) { return x.name === cur; });
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
      r2.append(mk('b', null, x.name), mk('span', null, md(x.date) + ' 퇴근 ' + x.to + ' · 야근 ' + hm(x.mins || 0)));
      if (x.note) r2.append(mk('span', 'muted', x.note));
      if (lr) r2.append(mk('span', 'chip use', '그날 마지막 기록 ' + lr));
      r2.append(mk('span', 'sp'), btn('승인', 'primary sm', function () { decide(x, '승인'); }), btn('반려', 'danger-ghost sm', function () { decide(x, '반려'); }));
      p1.append(r2);
    });
    w.append(p1);
    // 달력
    var p2 = mk('div', 'panel'); p2.style.maxWidth = '1100px'; p2.append(mk('h3', 'qh', '달력'));
    var grid = mk('div', 'wcal'); ['월', '화', '수', '목', '금', '토', '일'].forEach(function (x) { grid.append(mk('div', 'wd', x)); });
    var lead = (W.weekday(from) + 6) % 7, nd = Number(to.slice(8, 10));
    for (var i = 0; i < lead; i++) grid.append(mk('div', 'wc blank'));
    for (var d = 1; d <= nd; d++) {
      var k = m + '-' + String(d).padStart(2, '0'), wd = W.weekday(k), cell = mk('div', 'wc' + (hol[k] || wd === 0 ? ' off' : wd === 6 ? ' sat' : '') + (k === td ? ' today' : ''));
      cell.append(mk('span', 'n', String(d))); if (hol[k]) cell.append(mk('span', 'h', hol[k]));
      items.filter(function (x) { return x.date === k; }).forEach(function (x) { var o = mk('span', 'ot ' + (x.status === '승인' ? 'ok' : x.status === '반려' ? 'no' : 'wait'), x.name + ' ' + x.to); o.title = x.status + ' · 야근 ' + hm(x.mins || 0); cell.append(o); });
      grid.append(cell);
    }
    p2.append(grid);
    // 팀장이 바로 적기(바로 승인)
    var names = activeNames(roster, td, liveNames);
    var f = mk('div', 'facts'), sel = mk('select', 'sel'); sel.style.width = '120px'; sel.setAttribute('aria-label', '이름'); names.forEach(function (n) { sel.append(new Option(n, n)); });
    var di = mk('input', 'in'); di.type = 'date'; di.value = td.slice(0, 7) === m ? td : from; di.style.width = '150px';
    var ti = mk('input', 'in'); ti.type = 'time'; ti.value = '20:00'; ti.step = 300; ti.style.width = '120px'; ti.title = '퇴근 시각';
    f.append(sel, di, ti, btn('바로 적기(승인)', 'ghost sm', async function () { if (!sel.value) { say('아래 상담사 명단에 이름을 먼저 넣어 주세요', 'err'); return; } if (!ti.value || ti.value.slice(0, 5) <= '19:00') { say('정시(19:00)보다 늦은 퇴근 시각을 골라 주세요', 'err'); return; } try { await CSTeam.call('ot.add', { name: sel.value, date: di.value, from: '19:00', to: ti.value.slice(0, 5), adminToken: tok }); say('적었어요', 'ok'); cal(w); } catch (e) { say(e.message, 'err'); } }));
    p2.append(mk('p', 'muted', '팀장이 대신 적기(퇴근 시각 · 바로 승인돼요)'), f);
    w.append(p2);
    // 이달 합계
    var p3 = mk('div', 'panel'); p3.style.maxWidth = '980px'; p3.append(mk('h3', 'qh', Number(m.slice(5)) + '월 야근 합계'));
    var sum = {}; names.forEach(function (n) { sum[n] = { ok: 0, okN: 0, wait: 0, no: 0 }; });
    items.forEach(function (x) { var s2 = sum[x.name] || (sum[x.name] = { ok: 0, okN: 0, wait: 0, no: 0 }); if (x.status === '승인') { s2.ok += x.mins || 0; s2.okN++; } else if (x.status === '신청') s2.wait++; else s2.no++; });
    var sn = Object.keys(sum).sort(function (a, b) { return a.localeCompare(b, 'ko'); });
    var all = 0;
    p3.append(table(['상담사', '승인된 야근', '건수', '승인할 것', '반려'], sn.map(function (n) { var s2 = sum[n]; all += s2.ok; return { cells: [n, { text: s2.ok ? hm(s2.ok) : '–' }, String(s2.okN), { text: String(s2.wait), cls: s2.wait ? 'warnc' : '' }, String(s2.no)] }; }).concat([{ cls: 'total', cells: ['합계', hm(all), '', '', ''] }])));
    var done = items.filter(function (x) { return x.status !== '신청'; });
    if (done.length) {
      var det = mk('details', 'qdet'); det.append(mk('summary', null, '처리한 신청 ' + done.length + '건 보기'));
      done.forEach(function (x) { var r3 = mk('div', 'qrow'); r3.append(mk('span', 'chip ' + (x.status === '승인' ? 'new' : 'err'), x.status), mk('b', null, x.name), mk('span', null, md(x.date) + ' 퇴근 ' + x.to + ' · 야근 ' + hm(x.mins || 0)), mk('span', 'sp'), btn('지우기', 'danger-ghost sm', async function () { try { await CSTeam.call('ot.cancel', { id: x.id, adminToken: tok }); cal(w); } catch (e) { say(e.message, 'err'); } })); det.append(r3); });
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
    p4.append(mk('b', null, '상담사 명단'), mk('p', 'muted', '입사·퇴사일 사이에만 근무 달력·공지 확인에 나와요. 이름은 성 뺀 이름(기록기 태그와 같게: 영원3·김영원 → 영원)'));
    var rl = mk('div', 'qroster');
    var draw = function () {
      rl.replaceChildren();
      roster.forEach(function (x, i) {
        var r4 = mk('div', 'facts'), n = mk('input', 'in'), s1 = mk('input', 'in'), e1 = mk('input', 'in');
        n.type = 'text'; n.value = x.name; n.placeholder = '이름'; n.style.width = '120px'; n.addEventListener('input', function () { x.name = n.value.trim(); });
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
  window.KBTeam2 = { flowOf: flowOf, personBar: personBar, teamNames: teamNames, picked: picked, pick: pick, personTeam: personTeam };
})();
