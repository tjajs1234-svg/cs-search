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

  /* ───── 업무 흐름: 그날 기록 시각으로 시간대별 건수 · 시간당 · 텀 ───── */
  var fDay = '';
  // 기록 시각(분) → 시간당 · 텀(점심 12:30~14:00은 빼고) · 30분 넘게 빈 구간
  function flowOf(rt) {
    var t = (rt || []).slice().sort(function (a, b) { return a - b; }), L = W.LUNCH, n = t.length;
    var minus = function (a, b) { return Math.max(0, Math.min(b, L[1]) - Math.max(a, L[0])); };
    if (!n) return { n: 0 };
    var span = Math.max(0, t[n - 1] - t[0] - minus(t[0], t[n - 1])), gaps = [], long = [];
    for (var i = 1; i < n; i++) { var g = t[i] - t[i - 1] - minus(t[i - 1], t[i]); gaps.push(g); if (g >= 30) long.push([t[i - 1], t[i], g]); }
    var sorted = gaps.slice().sort(function (a, b) { return a - b; }), med = sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : 0;
    return { n: n, first: t[0], last: t[n - 1], perHour: n / Math.max(1, span / 60), med: med, long: long, hours: t.reduce(function (o, m) { var h = Math.floor(m / 60); o[h] = (o[h] || 0) + 1; return o; }, {}) };
  }
  async function flow(w) {
    var title = '업무 흐름';
    if (!(await ready(w, title, '기록한 시각으로 본 하루 흐름이에요. 시간당 건수 · 기록 사이 텀(점심 빼고) · 30분 넘게 기록이 없던 구간. 긴 통화나 어려운 상담도 빈 구간으로 보이니 참고용으로만 봐 주세요.'))) return;
    var td = today(); if (!fDay || fDay > td) fDay = td;
    var back = diffDays(fDay, td) + 1, q;
    try { q = await CSTeam.call('qa.get', { days: Math.min(62, back) }); }
    catch (e) { w.lastChild.textContent = '불러오지 못했어요. ' + e.message; return; }
    w.lastChild.remove();
    var nav = mk('div', 'ins qnav');
    var di = mk('input', 'in'); di.type = 'date'; di.value = fDay; di.max = td; di.style.width = '160px'; di.addEventListener('change', function () { if (di.value) { fDay = di.value; flow(w); } });
    nav.append(btn('◀ 전날', '', function () { fDay = W.addDays(fDay, -1); flow(w); }), di, btn('다음 날 ▶', '', function () { if (fDay < td) { fDay = W.addDays(fDay, 1); flow(w); } }), btn('오늘', fDay === td ? 'on' : '', function () { fDay = td; flow(w); }), mk('span', null, md(fDay) + (W.day(fDay, {}) ? '' : ' · 쉬는 날')));
    Array.prototype.forEach.call(nav.querySelectorAll('button'), function (b) { b.className = b.className.replace('btn ghost', '').replace('btn ', '').trim(); });
    w.append(nav);
    // 시간대별
    var day = (q.days || {})[fDay] || {}, P = T().person, people = {};
    Object.keys(day).forEach(function (n) { var k = P(n), v = day[n] || {}; (people[k] || (people[k] = [])).push.apply(people[k], v.rt || []); });
    var names = Object.keys(people).sort(function (a, b) { return a.localeCompare(b, 'ko'); });
    var p = mk('div', 'panel'); p.style.maxWidth = '1100px';
    p.append(mk('h3', 'qh', '시간대별 기록'));
    if (diffDays(fDay, td) >= 62) p.append(mk('div', 'empty', '기록 시각은 62일 동안만 보관해요.'));
    else if (!names.length) p.append(mk('div', 'empty', '이날 기록 시각이 아직 없어요.\n상담사 기록기 2.4.0부터 쌓여요.'));
    else {
      var F = {}; names.forEach(function (n) { F[n] = flowOf(people[n]); });
      var lo = 10, hi = 18; names.forEach(function (n) { var f = F[n]; if (f.n) { lo = Math.min(lo, Math.floor(f.first / 60)); hi = Math.max(hi, Math.floor(f.last / 60)); } });
      var hours = []; for (var h = lo; h <= hi; h++) hours.push(h);
      var max = 1; names.forEach(function (n) { hours.forEach(function (h2) { max = Math.max(max, F[n].hours[h2] || 0); }); });
      var rows = names.map(function (n) {
        var f = F[n], cells = [n];
        hours.forEach(function (h2) { var v = f.hours[h2] || 0, sp = mk('span', 'hb', v ? String(v) : '·'); sp.style.setProperty('--a', String(v / max)); cells.push({ node: sp, cls: 'hc' + (v ? '' : ' z') }); });
        cells.push({ text: String(f.n), cls: 'sum' }, { text: f.n ? f.perHour.toFixed(1) : '–', title: '첫 기록 ' + hhmm(f.first) + ' ~ 마지막 ' + hhmm(f.last) + ' (점심 빼고)' }, { text: f.n > 1 ? f.med + '분' : '–' },
          { text: f.long.length ? String(f.long.length) : '0', cls: f.long.length ? 'warnc' : '', title: f.long.map(function (x) { return hhmm(x[0]) + '~' + hhmm(x[1]) + ' (' + x[2] + '분)'; }).join('\n') }, { text: f.n ? hhmm(f.first) + '–' + hhmm(f.last) : '–' });
        return { cells: cells };
      });
      p.append(table(['상담사'].concat(hours.map(function (h2) { return h2 + '시'; }), ['합계', '시간당', '텀(보통)', '30분+ 빈 구간', '첫–마지막']), rows, 'tflow'));
      var gl = mk('div', 'qgaps'); names.forEach(function (n) { var f = F[n]; if (!f.long.length) return; var r2 = mk('div'); r2.append(mk('b', null, n + ' '), document.createTextNode(f.long.map(function (x) { return hhmm(x[0]) + '~' + hhmm(x[1]) + ' (' + x[2] + '분)'; }).join(' · '))); gl.append(r2); });
      if (gl.childNodes.length) { p.append(mk('p', 'muted', '30분 넘게 기록이 없던 구간(점심 빼고)')); p.append(gl); }
      p.append(mk('p', 'muted', '시간당 = 그날 기록 수 ÷ 첫 기록부터 마지막 기록까지 시간(점심 빼고) · 텀(보통) = 기록과 기록 사이 시간의 가운데 값'));
    }
    w.append(p);
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

  /* ───── 확인할 상담 ───── */
  var qDay = '';
  async function qa(w) {
    var title = '확인할 상담';
    if (!(await ready(w, title, '팀장만 보는 화면이에요(상담사 화면에는 안 나와요). 상담 번호와 링크만 있고 고객 이름·대화 내용은 없어요. [열기]를 누르면 그 상담이 새 탭에서 열려요(카카오·톡톡에 로그인돼 있어야 해요).'))) return;
    var td = today(); if (!qDay || qDay > td) qDay = td;
    var r, reads = {}, cfg = null;
    try { var got = await Promise.all([CSTeam.call('qa.get', { days: Math.min(62, diffDays(qDay, td) + 1) }), CSTeam.call('notice.reads', {}).catch(function () { return { reads: {} }; }), getCfg().catch(function () { return null; })]); r = got[0]; reads = got[1].reads || {}; cfg = got[2]; }
    catch (e) { w.lastChild.textContent = '불러오지 못했어요. ' + e.message; return; }
    w.lastChild.remove();
    var P = T().person, live = r.live || {}, liveNames = Object.keys(live).map(P), tok = await T().adminToken();
    var okBtn = function (x, row) { return btn('확인함', 'ghost sm', async function () { try { await CSTeam.call('qa.ok', { key: x.ch + ':' + x.id, adminToken: tok }); row.remove(); say('목록에서 뺐어요', 'ok'); } catch (e) { say(e.message, 'err'); } }); };
    var sec = function (h, sub) { var p = mk('div', 'panel'); p.style.maxWidth = '980px'; p.append(mk('h3', 'qh', h)); if (sub) p.append(mk('p', 'muted', sub)); w.append(p); return p; };
    var personList = function (p, map, render, empty) {
      var names = Object.keys(map).filter(function (n) { return map[n].length; }).sort(function (a, b) { return a.localeCompare(b, 'ko'); });
      if (!names.length) { p.append(mk('div', 'empty', empty)); return; }
      names.forEach(function (n) { var box = mk('div', 'qbox'); box.append(mk('b', 'qn', n + ' · ' + map[n].length)); var ul = mk('div', 'qlist'); map[n].forEach(function (x) { ul.append(render(x)); }); box.append(ul); p.append(box); });
    };
    // 1) 기록 안 한 상담(지금)
    var miss = {}; Object.keys(live).forEach(function (n) { miss[P(n)] = (miss[P(n)] || []).concat(live[n].miss || []); });
    personList(sec('기록 안 한 상담 · 지금', '오늘 답했는데 같은 상담 링크로 남긴 기록이 없는 상담 · 상담사 화면에는 안 보여요 · 기록이 필요 없던 건 [확인함]으로 빼요'), miss, function (x) {
      var row = mk('div', 'qrow'); row.append(mk('span', 'chb ' + x.ch, chName(x.ch)), mk('span', null, clock(x.at) + ' 답함'), link(x), okBtn(x, row)); return row;
    }, '없어요 👍');
    // 2) 20분 넘긴 상담(날짜별)
    var p2 = sec('20분 넘긴 상담', '업무시간 기준으로 20분 넘게 기다리게 한 뒤 답한 상담');
    var nav = mk('div', 'ins qnav');
    var di = mk('input', 'in'); di.type = 'date'; di.value = qDay; di.max = td; di.style.width = '160px'; di.addEventListener('change', function () { if (di.value) { qDay = di.value; qa(w); } });
    nav.append(btn('◀ 전날', '', function () { qDay = W.addDays(qDay, -1); qa(w); }), di, btn('다음 날 ▶', '', function () { if (qDay < td) { qDay = W.addDays(qDay, 1); qa(w); } }), btn('오늘', qDay === td ? 'on' : '', function () { qDay = td; qa(w); }));
    Array.prototype.forEach.call(nav.querySelectorAll('button'), function (b) { b.className = b.className.replace('btn ghost', '').replace('btn ', '').trim(); });
    p2.append(nav);
    var late = {}, dd = (r.days || {})[qDay] || {}; Object.keys(dd).forEach(function (n) { late[P(n)] = (late[P(n)] || []).concat((dd[n] || {}).late || []); });
    Object.keys(late).forEach(function (n) { late[n].sort(function (a, b) { return (b.w || 0) - (a.w || 0); }); });
    personList(p2, late, function (x) { var row = mk('div', 'qrow'); row.append(mk('span', 'chb ' + x.ch, chName(x.ch)), mk('b', 'qw', (x.w || 0) + '분'), mk('span', 'muted', clock(x.at) + ' 답함'), link(x)); return row; }, diffDays(qDay, td) >= 62 ? '62일 넘은 날은 보관하지 않아요.' : '이날은 없어요 👍');
    // 3) 오래된 상담(지금)
    var lh = {}; Object.keys(live).forEach(function (n) { lh[P(n)] = (lh[P(n)] || []).concat(live[n].lh || []); });
    Object.keys(lh).forEach(function (n) { lh[n].sort(function (a, b) { return (b.d || 0) - (a.d || 0); }); });
    personList(sec('오래된 상담 · 지금', '마지막 대화 뒤 영업일 2일 넘게 지난 상담(카톡 진행중 · 톡톡 진행중 · 톡톡 보류 탭)'), lh, function (x) { var row = mk('div', 'qrow'); row.append(mk('span', 'chb ' + x.ch, chName(x.ch)), mk('span', null, (x.h ? '보류 탭' : '진행중') + ' · 영업일 ' + (x.d || 0) + '일'), link(x), okBtn(x, row)); return row; }, '없어요 👍');
    // 4) 공지 확인
    var p4 = sec('공지 확인', '상담사가 검색기에서 [확인했어요]를 누른 공지예요(기록기 2.4.0 · 이름은 기록기 태그로 자동)');
    var team = activeNames(cfg && cfg.roster, td, liveNames).filter(function (n) { return n !== '팀장'; });
    var ids = Object.keys(reads).sort(function (a, b) { return (reads[b].first || 0) - (reads[a].first || 0); }).slice(0, 20);
    if (!ids.length) p4.append(mk('div', 'empty', '아직 확인한 공지가 없어요.'));
    else p4.append(table(['공지', '확인함', '아직'], ids.map(function (id) {
      var o = reads[id], who = Object.keys(o.reads || {}).map(P), not = team.filter(function (n) { return who.indexOf(n) < 0; });
      return { cells: [{ text: o.title || '(제목 없음)', title: id.indexOf('s:') === 0 ? '족보 Daily 공지' : '관리자 공지' }, { text: who.join(' · ') || '–' }, { text: not.join(' · ') || '모두 확인', cls: not.length ? 'warnc' : '' }] };
    }), 'tread'));
    if (!(cfg && cfg.roster && cfg.roster.length)) p4.append(mk('p', 'muted', '‘아직’ 칸은 근무 달력의 상담사 명단으로 셈 — 명단이 비어 있으면 팀 현황에 신호를 보낸 사람으로 셈'));
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
  window.KBTeam2 = { flowOf: flowOf };
})();
