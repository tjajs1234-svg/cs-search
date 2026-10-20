/* 팀 현황 한 화면(2026-10-18 합침: 예전 '업무 흐름' · '상담사별 건수' · '확인할 상담')
   · 피드백 기준(주인 10/18): 기록은 상담이 완전히 끝나야 남아서, 길게 이어지는 상담이 많으면 완료 건수·시간당이 낮게 나옴(가혹)
     → 주로 보는 숫자는 '20분 넘게 기다리게 한 상담' · '평균 대기' · '답한 상담(응대 횟수)', 완료 기록은 참고
     → '응대가 적음' 경고는 이번 주·이번 달에서만(하루는 긴 상담 하나에 크게 흔들림)
   · 위: 지금 방치된 내 상담 · 챙길 사람(해당하는 것만 글로)
   · 가운데: 줄 세우기 비교(20분 넘김 · 답한 상담 · 완료 기록(참고) — 점선 = 팀 평균)
   · 아래: 상담사별 표(평균보다 몇 건 적음/많음을 글로) · 줄을 누르면 하루 흐름 · 이번 달은 QA 표 + CSV
   · 면담 화면: 한 사람만 크게(다른 사람 이름은 기본으로 가림) · 말할 거리 자동 정리
   자료: 팀 서버 team.get(날짜별 숫자 · 지금) · qa.get(기록 시각 · 20분 넘긴 상담 · 지금 기록 빠짐) · cases.get · cfg.get */
(function () {
  'use strict';
  var A = function () { return window.KBAdminApp; }, T = function () { return window.KBTeam; }, T2 = function () { return window.KBTeam2; };
  function mk(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function btn(label, cls, fn) { var b = mk('button', 'btn ' + (cls || 'ghost'), label); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; }
  function say(t, k) { if (A()) A().say(t, k); }
  var W = window.WorkClock, WD = ['일', '월', '화', '수', '목', '금', '토'];
  function md(k) { return Number(k.slice(5, 7)) + '/' + Number(k.slice(8, 10)) + '(' + WD[W.weekday(k)] + ')'; }
  function hhmm(min) { return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0'); }
  function clock(ms) { return ms ? hhmm(W.minuteOf(ms)) : ''; }
  function ago(t) { var m = Math.floor((Date.now() - t) / 60000); return m < 1 ? '방금' : m < 60 ? m + '분 전' : Math.floor(m / 60) + '시간 전'; }
  function hm(mins) { var h = Math.floor(mins / 60), m = mins % 60; return (h ? h + '시간' : '') + (m ? (h ? ' ' : '') + m + '분' : h ? '' : '0분'); }
  function chName(ch) { return ch === 'naver' ? '톡톡' : ch === 'board' ? '게시판' : '카톡'; }
  function chip(ch) { return mk('span', 'chb ' + ch, chName(ch)); }
  function link(x, label) { var a = mk('a', 'qlink', label || '열기'); if (x.u) { a.href = x.u; a.target = '_blank'; a.rel = 'noopener'; } else a.className += ' off'; return a; }
  function f1(v) { return v == null ? '–' : (Math.round(v * 10) / 10).toFixed(1); }
  function n0(v) { return v == null ? '–' : String(Math.round(v)); }
  function mean(a) { a = a.filter(function (v) { return v != null && isFinite(v); }); return a.length ? a.reduce(function (s, v) { return s + v; }, 0) / a.length : null; }
  // 2026-10-18 어려운 상담(손이 많이 가는 카테고리): 교환/반품 · 고장/불량 · 유무상 A/S · 불만/컴플레인 — 건수가 적어도 참작할 근거
  var HARD = /교환|반품|불량|고장|A\s*\/?\s*S|불만|컴플레인/i, HARD_LABEL = '교환/반품 · 고장/불량 · A/S · 불만';
  function isHard(c) { return HARD.test(String(c || '')); }
  function pct(v) { return v == null ? '–' : Math.round(v * 100) + '%'; }
  function catList(cats) { return Object.keys(cats || {}).map(function (k) { return { c: k, n: cats[k] }; }).filter(function (x) { return x.n > 0; }).sort(function (a, b) { return b.n - a.n || (a.c > b.c ? 1 : -1); }); }
  function catChips(cats, total) {
    var w = mk('div', 'tcats'), l = catList(cats);
    if (!l.length) { w.append(mk('span', 'muted', '카테고리 기록 없음 (기록기 2.4.15 · 팀 서버 1.3.9부터 모여요)')); return w; }
    l.forEach(function (x) { var c = mk('span', 'tcat' + (isHard(x.c) ? ' hard' : ''), x.c + ' '); c.append(mk('b', null, String(x.n))); if (total) c.title = Math.round(x.n / total * 100) + '%'; w.append(c); });
    return w;
  }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }

  /* ───── 숫자 모으기: 사람마다 고른 기간의 기록 · 채널 · 시간당 · 20분 넘김 · 빈 시간 + 지금 상태 ───── */
  async function collect(r, period) {
    await (T().syncLead ? T().syncLead() : null);
    var K = T2(), P = T().person, now = Date.now(), td = W.dayKey(now), days = r.days || {}, keys = K.periodKeys(period);
    var back = Math.min(62, Math.round((Date.parse(td + 'T00:00:00Z') - Date.parse(keys[0] + 'T00:00:00Z')) / 864e5) + 1);
    var got = await Promise.all([CSTeam.get('qa.get', { days: back }, 0).catch(function () { return { days: {}, live: {} }; }), CSTeam.get('cases.get', {}).catch(function () { return { list: [] }; }), K.getCfg().catch(function () { return null; })]);
    var q = got[0], wcfg = (got[2] || {}).cfg || {}, cbn = {}; (got[1].list || []).forEach(function (x) { cbn[P(x.name)] = x; });
    var live = {}; (r.live || []).forEach(function (x) { live[P(x.name)] = x; });
    var ql = {}; Object.keys(q.live || {}).forEach(function (n) { ql[P(n)] = q.live[n]; });
    var dn = []; keys.forEach(function (d) { Object.keys(days[d] || {}).forEach(function (n) { dn.push(P(n)); }); });
    var names = (await K.teamNames(Object.keys(live).concat(dn))).filter(function (n) { return n !== '팀장' && n !== P('팀장'); });
    var oneDay = keys.length === 1 ? keys[0] : '', isToday = oneDay === td;
    var periodName = { today: '오늘', yday: '어제', week: '이번 주', month: '이번 달' }[period] || (oneDay ? (isToday ? '오늘' : md(oneDay)) : '오늘');
    var people = names.map(function (n) {
      var x = live[n], fresh = !!(x && now - x.at <= 3 * 60000), o = { n: n, x: x, fresh: fresh, cs: cbn[n], days: {}, rec: 0, k: 0, nv: 0, bd: 0, ans: 0, ak: 0, an: 0, wsum: 0, late: [], lateN: 0, lateMax: 0, flN: 0, flH: 0, gaps: 0, work: 0, cats: {} };
      keys.forEach(function (d) {
        var dd = days[d] || {}, qd = (q.days || {})[d] || {}, v = { rec: 0, k: 0, nv: 0, bd: 0, ans: 0, ak: 0, an: 0, wsum: 0, rt: [], late: [], o20: 0, maxW: 0, sites: {}, cats: {} };
        Object.keys(dd).forEach(function (k) {
          if (P(k) !== n) return; var s = dd[k] || {};
          if (!(d === td && fresh)) v.rec += s.records || 0;
          v.k += s.kakao || 0; v.nv += s.naver || 0; v.o20 += s.over20 || 0; v.ans += s.answered || 0; v.wsum += s.waitSum || 0; v.ak += (s.ach || {}).kakao || 0; v.an += (s.ach || {}).naver || 0; v.maxW = Math.max(v.maxW, s.maxWait || 0);
          Object.keys(s.sites || {}).forEach(function (st) { v.bd += s.sites[st] || 0; v.sites[st] = (v.sites[st] || 0) + s.sites[st]; });
          Object.keys(s.cats || {}).forEach(function (c) { v.cats[c] = (v.cats[c] || 0) + (s.cats[c] || 0); });
        });
        if (d === td && fresh) v.rec += x.records || 0;
        var seen = {}; Object.keys(qd).forEach(function (k) { if (P(k) !== n) return; v.rt = v.rt.concat(qd[k].rt || []); (qd[k].late || []).forEach(function (z) { var id = z.ch + ':' + z.id; if (!seen[id]) { seen[id] = 1; v.late.push(Object.assign({ d: d }, z)); } }); });
        v.rt.sort(function (a, b) { return a - b; }); v.fl = K.flowOf(v.rt);
        v.lateN = Math.max(v.late.length, v.o20);
        Object.keys(v.cats).forEach(function (c) { o.cats[c] = (o.cats[c] || 0) + v.cats[c]; });
        o.days[d] = v; o.rec += v.rec; o.k += v.k; o.nv += v.nv; o.bd += v.bd; o.ans += v.ans; o.ak += v.ak; o.an += v.an; o.wsum += v.wsum; o.late = o.late.concat(v.late); o.lateN += v.lateN;
        o.lateMax = Math.max(o.lateMax, v.maxW, v.late.reduce(function (m, z) { return Math.max(m, z.w || 0); }, 0));
        if (v.fl.n >= 2) { o.flN += v.fl.n; o.flH += v.fl.span / 60; } o.gaps += v.fl.long ? v.fl.long.length : 0;
        if (v.rec > 0 || v.fl.n > 0 || v.ans > 0) o.work++;
      });
      o.late.sort(function (a, b) { return (b.w || 0) - (a.w || 0); });
      o.perDay = o.work ? o.rec / o.work : (o.rec ? o.rec : null);
      if (!o.work && !o.rec) o.perDay = null;
      o.ph = o.flH >= 0.5 ? o.flN / o.flH : null;
      o.ansDay = o.work ? o.ans / o.work : null; o.wait = o.ans ? o.wsum / o.ans : null;
      o.catN = 0; o.hardN = 0; Object.keys(o.cats).forEach(function (c) { o.catN += o.cats[c]; if (isHard(c)) o.hardN += o.cats[c]; }); o.hardPct = o.catN >= 3 ? o.hardN / o.catN : null;
      // 지금: 기다리는 고객 · 연결 · 기록 빠짐(팀장이 [기록 안 해도 돼요] 누른 것은 빠짐)
      o.pend = fresh ? (x.pending || 0) : 0; o.oldest = fresh ? (x.oldestMin || 0) : 0; o.over20 = fresh ? (x.over20 || 0) : 0;
      o.top = fresh && Array.isArray(x.top) ? x.top : null; o.held = fresh ? (x.held || 0) : 0; o.hold = fresh && Array.isArray(x.hold) ? x.hold : null;
      o.conns = fresh ? K.connsOf(x, o.cs) : []; o.bad = o.conns.filter(function (c) { return c.u && c.s !== 'ok'; });
      var qn = ql[n] || {}; o.miss = (qn.miss || []).slice().sort(function (a, b) { return (b.e || 0) - (a.e || 0) || (b.at || 0) - (a.at || 0); }); o.missN = o.miss.length; o.hasQ = !!ql[n];
      var rtT = (o.days[td] || {}).rt || ((q.days || {})[td] ? [] : []); var lastMin = rtT && rtT.length ? rtT[rtT.length - 1] : -1;
      o.lastMs = lastMin >= 0 ? W.dayStart(td) + lastMin * 60000 : 0;
      return o;
    });
    var on = people.filter(function (o) { return o.perDay != null; });
    var team = { perDay: mean(on.map(function (o) { return o.perDay; })), ph: mean(on.map(function (o) { return o.ph; })), late: mean(on.map(function (o) { return o.lateN; })), ansDay: mean(on.map(function (o) { return o.ans ? o.ansDay : null; })), wait: mean(on.map(function (o) { return o.wait; })), ans: 0, wsum: 0, miss: mean(people.filter(function (o) { return o.fresh || o.hasQ; }).map(function (o) { return o.missN; })), rec: 0, k: 0, nv: 0, bd: 0 };
    team.catN = 0; team.hardN = 0; team.cats = {};
    people.forEach(function (o) { team.rec += o.rec; team.k += o.k; team.nv += o.nv; team.bd += o.bd; team.ans += o.ans; team.wsum += o.wsum; team.catN += o.catN; team.hardN += o.hardN; Object.keys(o.cats).forEach(function (c) { team.cats[c] = (team.cats[c] || 0) + o.cats[c]; }); });
    team.hardPct = team.catN >= 5 ? team.hardN / team.catN : null;
    return { r: r, q: q, wcfg: wcfg, now: now, td: td, keys: keys, oneDay: oneDay, isToday: isToday, periodName: periodName, period: period, people: people, team: team, days: days };
  }
  // 다른 사람 평균(면담 화면 · 본인 빼고)
  function others(M, who) {
    var on = M.people.filter(function (o) { return o.n !== who && o.perDay != null; });
    return { perDay: mean(on.map(function (o) { return o.perDay; })), ph: mean(on.map(function (o) { return o.ph; })), late: mean(on.map(function (o) { return o.lateN; })), ansDay: mean(on.map(function (o) { return o.ans ? o.ansDay : null; })), wait: mean(on.map(function (o) { return o.wait; })), miss: mean(M.people.filter(function (o) { return o.n !== who && (o.fresh || o.hasQ); }).map(function (o) { return o.missN; })), n: on.length, hardPct: (function () { var c = 0, h = 0; M.people.forEach(function (o) { if (o.n !== who) { c += o.catN; h += o.hardN; } }); return c >= 5 ? h / c : null; })() };
  }

  /* ───── 평균과 비교: 글(평균보다 3건 적음) · 색 ───── */
  // lowerBetter: 20분 넘김처럼 적을수록 좋은 숫자
  function vs(v, avg, unit, lowerBetter, dec) {
    if (v == null || avg == null) return { t: '', c: 'm', lv: 0 };
    var d = v - avg, r = avg ? d / avg : (d ? 1 : 0), ad = Math.abs(d), small = dec ? ad < 0.3 : ad < 1;
    if (small || (Math.abs(r) < 0.1 && !lowerBetter)) return { t: '평균 수준', c: 'm', lv: 0 };
    var worse = lowerBetter ? d > 0 : d < 0, txt = (dec ? f1(ad) : n0(ad)) + unit;
    if (lowerBetter && !worse) return { t: v === 0 ? '없음' : '평균보다 ' + txt + ' 적음', c: 'g', lv: -1 };
    var lv = !worse ? -1 : lowerBetter ? (v >= 2 && v >= avg * 1.5 ? 2 : 1) : (r <= -0.25 ? 2 : 1);
    return { t: '평균보다 ' + txt + (d > 0 ? ' 많음' : ' 적음'), c: !worse ? 'g' : lv === 2 ? 'r' : 'o', lv: worse ? lv : -1 };
  }
  function word(w) { return mk('span', 'tword ' + w.c, w.t); }
  // 챙길 것(사람마다 해당하는 것만 문장으로) · 정렬 점수
  function flags(o, M, avg) {
    var out = [], sc = 0, multi = !M.oneDay, a3 = vs(o.lateN, avg.late, '건', true), aw = vs(o.wait, avg.wait, '분', true), aa = vs(o.ansDay, avg.ansDay, '건');
    if (o.oldest >= 20) { sc += 100 + o.oldest; }
    if (a3.lv === 2) { out.push({ c: 'r', t: '고객을 20분 넘게 기다리게 한 상담 ' + o.lateN + '건' + (o.lateMax ? ' (가장 오래 ' + o.lateMax + '분)' : '') }); sc += 40; }
    else if (a3.lv === 1 && o.lateN >= 2) { out.push({ c: 'o', t: '고객을 20분 넘게 기다리게 한 상담 ' + o.lateN + '건' }); sc += 12; }
    if (aw.lv === 2 && o.ans >= 5) { out.push({ c: 'o', t: '고객 평균 대기 ' + n0(o.wait) + '분 (팀 평균 ' + n0(avg.wait) + '분)' }); sc += 15; }
    // 응대가 적음은 이번 주·이번 달만(하루는 긴 상담 하나에 크게 흔들림)
    if (multi && aa.lv === 2) { out.push({ c: 'r', t: '하루 평균 답한 상담 ' + n0(o.ansDay) + '건, 팀 평균보다 ' + n0(avg.ansDay - o.ansDay) + '건 적어요' }); sc += 30; }
    if (o.missN) { out.push({ c: o.missN >= 2 ? 'r' : 'o', t: '답했는데 기록 안 한 상담 ' + o.missN + '건 (지금)' }); sc += 8 * o.missN; }
    if (M.oneDay && o.gaps >= 2) { out.push({ c: 'm', t: '30분 넘게 기록이 없던 때 ' + o.gaps + '번 (긴 상담일 수 있어요)' }); sc += 3; }
    if (o.fresh && o.bad.length) { var b0 = o.bad[0]; out.push({ c: 'r', t: chName(b0.ch) + ' 연결이 끊겼어요(' + (T2().CONN_LABEL[b0.s] || '확인 필요') + ')' }); sc += 20; }
    if (aa.lv === 1) sc += 4;
    // 건수가 적거나 늦은 게 있어도 어려운 상담을 많이 맡았으면 같이 보여 줌(참작)
    if (out.some(function (z) { return z.c !== 'm'; }) && hardHigh(o, avg)) out.push({ c: 'm', t: '어려운 상담(' + HARD_LABEL + ') ' + pct(o.hardPct) + ', 팀 ' + pct(avg.hardPct) + ' — 참작해 주세요' });
    return { list: out, score: sc };
  }

  function hardHigh(o, avg) { return o.hardPct != null && avg.hardPct != null && o.catN >= 5 && o.hardPct >= avg.hardPct + 0.1; }

  /* ───── 줄 세우기 막대(많이 한 사람이 위 · 점선 = 평균) ───── */
  function rank(title, items, avg, avgLabel, opt) {
    opt = opt || {}; var box = mk('div', 'rkcol'); box.append(mk('div', 'rklab', title));
    var list = items.filter(function (x) { return x.v != null; }).sort(function (a, b) { return opt.lowerBetter ? a.v - b.v : b.v - a.v; });
    if (!list.length) { box.append(mk('div', 'pnone m', '아직 숫자가 없어요')); return box; }
    var max = Math.max.apply(null, list.map(function (x) { return x.v; }).concat([avg || 0])) * 1.08 || 1;
    var rk = mk('div', 'rk');
    if (avg != null) { var p = Math.min(100, avg / max * 100), tag = mk('span', 'rkavt', avgLabel), ln = mk('span', 'rkavl'); tag.style.left = ln.style.left = 'calc(var(--rk-l) + (100% - var(--rk-l) - var(--rk-r)) * ' + (p / 100).toFixed(4) + ')'; rk.append(tag, ln); }
    list.forEach(function (x) {
      var w = vs(x.v, avg, '', opt.lowerBetter, opt.dec), cls = opt.soft ? (w.lv > 0 ? 'rkm' : 'rko') : w.lv === 2 ? 'rkb' : w.lv === 1 ? 'rkm' : 'rko';
      var row = mk('div', 'rkr ' + cls + (x.me ? ' me' : '')), tr = mk('div', 'rkt'), bar = mk('i'); bar.style.width = (x.v / max * 100) + '%'; tr.append(bar);
      row.append(mk('span', 'rkn', x.label), tr, mk('span', 'rkv', opt.dec ? f1(x.v) : n0(x.v))); row.title = x.label + ' ' + (opt.dec ? f1(x.v) : n0(x.v)) + (w.t ? ' · ' + w.t : ''); rk.append(row);
    });
    box.append(rk); return box;
  }

  /* ───── 하루 흐름 띠: 기록 1건 = 파란 줄 · 30분 넘게 빈 때 = 빨간 칸 · 점심 = 회색 ───── */
  function timeline(fl, wd) {
    var lo = 10 * 60, hi = (wd ? wd.workEnd : 19 * 60); if (fl.n) { lo = Math.min(lo, Math.floor(fl.first / 60) * 60); hi = Math.max(hi, Math.ceil((fl.last + 1) / 60) * 60); }
    var span = hi - lo, P = function (m) { return ((m - lo) / span * 100).toFixed(3) + '%'; }, box = mk('div', 'tlw'), tl = mk('div', 'tl');
    var L = W.LUNCH, lu = mk('div', 'tlln'); lu.style.left = P(L[0]); lu.style.width = ((L[1] - L[0]) / span * 100).toFixed(3) + '%'; lu.title = '점심'; tl.append(lu);
    (fl.long || []).forEach(function (z) { var g = mk('div', 'tlgp'); g.style.left = P(z[0]); g.style.width = ((z[1] - z[0]) / span * 100).toFixed(3) + '%'; g.append(mk('b', null, hhmm(z[0]) + '~' + hhmm(z[1]) + ' · ' + z[2] + '분')); g.title = hhmm(z[0]) + '~' + hhmm(z[1]) + ' 기록 없음(점심 빼고 ' + z[2] + '분)'; tl.append(g); });
    (fl.t || []).forEach(function (m) { var t = mk('i', 'tltk'); t.style.left = P(m); t.title = hhmm(m) + ' 기록'; tl.append(t); });
    var ax = mk('div', 'tlax'); for (var h = Math.ceil(lo / 60); h * 60 <= hi; h++) { var s = mk('span', null, h + '시'); s.style.left = P(h * 60); ax.append(s); }
    box.append(tl, ax); return box;
  }
  function gapChips(fl) {
    var gp = mk('div', 'pgap pgl');
    if (!fl.n || fl.n < 2) { gp.append(mk('span', 'muted', '기록이 2건보다 적어 흐름을 셀 수 없어요')); return gp; }
    if (!fl.long.length) gp.append(mk('span', 'okc', '30분 넘게 빈 시간 없음'));
    else { gp.append(mk('span', 'gt', '30분 넘게 기록 없던 때')); fl.long.forEach(function (z) { gp.append(mk('span', 'gchip', hhmm(z[0]) + '~' + hhmm(z[1]) + ' · ' + z[2] + '분')); }); }
    gp.title = '긴 통화나 어려운 상담도 빈 시간으로 보여요. 참고용으로만 봐 주세요. 점심(12:30~14:00)은 빼고 셈'; return gp;
  }

  /* ───── 팀 현황(전체) ───── */
  var openRow = {}, openMiss = {};
  function overview(M, ctx) {
    var box = mk('div', 'tview'), avg = M.team, td = M.td;
    // 숫자 칸 4개
    var nowP = 0, now20 = 0, now20p = 0, part = 0; M.people.forEach(function (o) { if (!o.fresh) return; nowP += o.pend; now20 += o.over20; if (o.over20) now20p++; if (o.bad.length) part = 1; });
    var kp = mk('div', 'tkpi');
    var tile = function (lab, big, sub, cls) { var t = mk('div', 'tk' + (cls ? ' ' + cls : '')); t.append(mk('span', 'tkl', lab), mk('b', 'tkb', big)); if (sub) t.append(mk('span', 'tks', sub)); return t; };
    kp.append(tile('지금 기다리는 고객', nowP + (part ? '+' : '') + '명', part ? '연결이 끊긴 PC는 끊기기 전 기준' : '업무시간으로 셈(점심 빼고)'),
      tile('20분 넘게 방치 (지금)', now20 ? now20 + '건 · ' + now20p + '명' : '없음', '', now20 ? 'bad' : 'ok'),
      tile(M.periodName + ' 팀 답한 상담', avg.ans + '건', '완료 기록 ' + avg.rec + '건 (카톡 ' + avg.k + ' · 톡톡 ' + avg.nv + ' · 게시판 ' + avg.bd + ')'),
      tile('고객 평균 대기', avg.ans ? n0(avg.wsum / avg.ans) + '분' : '–', '답을 받기까지 · 업무시간으로 셈'));
    box.append(kp);
    // 위 두 칸: 지금 방치된 내 상담 · 챙길 사람
    var g2 = mk('div', 'tg2'), c1 = mk('div', 'tpanel'), h1 = mk('div', 'tph'); h1.append(mk('span', 'tdot r'), mk('b', null, '지금 방치된 내 상담'), mk('span', 'muted', '20분 넘음 · 오래된 순'));
    c1.append(h1);
    var waits = []; M.people.forEach(function (o) { if (!o.fresh) return; (o.top || []).forEach(function (t) { if (t.w >= 20) waits.push({ o: o, t: t }); }); if (!o.top && o.oldest >= 20) waits.push({ o: o, t: { w: o.oldest, ch: '', n: '' } }); });
    waits.sort(function (a, b) { return b.t.w - a.t.w; });
    if (!waits.length) c1.append(mk('div', 'pnone', '20분 넘게 기다리는 고객 없음'));
    waits.slice(0, 12).forEach(function (z) {
      var row = mk('div', 'tact'); row.append(mk('span', 'av', z.o.n.slice(0, 1)), mk('b', null, z.o.n), mk('b', 'tmin', z.t.w + '분'));
      if (z.t.ch) row.append(chip(z.t.ch)); var msg = mk('span', 'tmsg', z.t.ch ? (z.t.r ? '다시 옴 · ' : '') + (z.t.p || '(사진·파일 또는 내용 없음)') : '고객 이름·메시지는 기록기 2.4.4부터'); msg.title = z.t.p || ''; row.append(msg);
      if (z.t.ch) row.append(link(z.t)); c1.append(row);
    });
    var c2 = mk('div', 'tpanel'), h2 = mk('div', 'tph'); h2.append(mk('span', 'tdot o'), mk('b', null, M.periodName + ' 챙길 사람'), mk('span', 'muted', '해당하는 것만 글로'));
    c2.append(h2);
    var need = M.people.map(function (o) { return { o: o, f: flags(o, M, avg) }; }).filter(function (z) { return z.f.list.length; }).sort(function (a, b) { return b.f.score - a.f.score; });
    if (!need.length) c2.append(mk('div', 'pnone', '챙길 사람 없음'));
    need.forEach(function (z) {
      var row = mk('div', 'tact top'), txt = mk('div', 'tsay'); txt.append(mk('b', null, z.o.n)); z.f.list.forEach(function (s) { txt.append(mk('span', 'tword ' + s.c, s.t)); });
      row.append(mk('span', 'av', z.o.n.slice(0, 1)), txt, btn('면담 화면', 'ghost sm', function () { ctx.who(z.o.n); })); c2.append(row);
    });
    g2.append(c1, c2); box.append(g2);
    // 줄 세우기 비교
    var cp = mk('div', 'tpanel'), hc = mk('div', 'tph'); hc.append(mk('b', null, M.periodName + ' 비교'), mk('span', 'muted', '좋은 사람이 위 · 점선 = 팀 평균 · 빨강 = 평균보다 많이 뒤처짐'));
    var it = function (f) { return M.people.map(function (o) { return { label: o.n, v: f(o) }; }); };
    var rr = mk('div', 'rkrow');
    rr.append(rank('20분 넘게 기다리게 한 상담 (적을수록 좋음)', it(function (o) { return o.perDay == null && !o.lateN ? null : o.lateN; }), avg.late, '팀 평균 ' + f1(avg.late) + '건', { lowerBetter: true }),
      rank(M.oneDay ? '답한 상담 (응대 횟수)' : '하루 평균 답한 상담', it(function (o) { return o.ans ? o.ansDay : null; }), avg.ansDay, '팀 평균 ' + n0(avg.ansDay) + '건', { soft: M.oneDay }),
      rank((M.oneDay ? '완료 기록' : '하루 평균 완료 기록') + ' (참고)', it(function (o) { return o.perDay; }), avg.perDay, '팀 평균 ' + n0(avg.perDay) + '건', { soft: true }));
    cp.append(hc, rr, mk('p', 'muted tfoot', '완료 기록은 상담이 완전히 끝나야 남아서, 고객과 길게 주고받는 상담이 많으면 적게 나와요. 그래서 참고로만 보고 색으로 경고하지 않아요. 게시판은 답한 상담에 안 잡혀요(완료 기록으로만 셈).')); box.append(cp);
    // 상담사별 표
    var tp = mk('div', 'tpanel'), ht = mk('div', 'tph'); ht.append(mk('b', null, '상담사별'), mk('span', 'muted', '챙길 사람 먼저 · 줄을 누르면 ' + (M.oneDay ? '하루 흐름' : '날짜별 건수')));
    var csv = btn('CSV 내려받기', 'ghost sm', function () { T2().chanCsv(M.days, (M.oneDay || td).slice(0, 7), td, T().person); }); csv.title = '그 달 날짜 × 상담사 × 채널(카톡 · 톡톡 · 게시판) 건수 · QA용'; ht.append(mk('span', 'sp'), csv);
    tp.append(ht, peopleTable(M, avg, need, ctx)); box.append(tp);
    // 게시판 사이트별(QA)
    var sd = mk('details', 'tdet'); sd.append(mk('summary', null, '게시판 구매처별 건수 · ' + M.periodName));
    var S = {}; M.people.concat([]).forEach(function () {}); M.keys.forEach(function (d) { var x = M.days[d] || {}; Object.keys(x).forEach(function (n) { var k = T().person(n), s2 = (x[n] || {}).sites || {}, t2 = S[k] || (S[k] = {}); Object.keys(s2).forEach(function (st) { t2[st] = (t2[st] || 0) + s2[st]; }); }); });
    sd.append(T2().siteTable(S, M.periodName)); if (store('kb:tdet') === '1') sd.open = true; sd.addEventListener('toggle', function () { store('kb:tdet', sd.open ? '1' : '0'); }); box.append(sd);
    box.append(catTable(M));
    box.append(mk('p', 'muted tfoot', '처리 = 시트에 저장된 기록(같은 날 같은 고객 1건) · 시간당 = 그날 첫 기록~마지막 기록 사이(점심 빼고)로 나눔(반차·늦은 출근은 저절로 반영) · 20분 넘김 = 고객이 20분 넘게 기다린 뒤 답한 상담(업무시간) · 기록 안 함 = 지금 남아 있는 것(다른 상담사가 그날 기록했으면 빠짐) · 긴 통화·어려운 상담이 많은 날은 숫자가 낮게 나오니 하루 흐름과 같이 봐 주세요 · 기록기를 끈 시간과 다른 PC 기록은 안 잡혀요'));
    return box;
  }
  function peopleTable(M, avg, need, ctx) {
    var order = {}; need.forEach(function (z, i) { order[z.o.n] = i; });
    var ppl = M.people.slice().sort(function (a, b) { var x = order[a.n] != null ? order[a.n] : 99, y = order[b.n] != null ? order[b.n] : 99; return x - y || (b.perDay || 0) - (a.perDay || 0); });
    var multi = !M.oneDay, head = ['상담사', '지금 대기', '20분 넘겨 답함', '평균 대기'].concat(multi ? ['근무일', '답한 상담(하루)', '완료 기록(하루) · 참고'] : ['답한 상담', '완료 기록 · 참고'], ['어려운 상담', '카톡 · 톡톡 · 게시판', '시간당 완료', '기록 안 함(지금)'], M.oneDay ? ['30분+ 빈 때'] : [], ['연결', '']);
    var tb = mk('table', 'ttable tppl'), tr = mk('tr'); head.forEach(function (h) { tr.append(mk('th', null, h)); }); var th = mk('thead'); th.append(tr); tb.append(th);
    var bd = mk('tbody'), cols = head.length;
    var cell = function (row, main, w, cls) { var td = mk('td', cls || null); td.append(mk('b', null, main)); if (w && w.t) { td.append(mk('br')); td.append(word({ c: w.c, t: w.t.replace(/^평균보다 (.+) 많음$/, '평균 +$1').replace(/^평균보다 (.+) 적음$/, '평균 −$1') })); } row.append(td); return td; };
    ppl.forEach(function (o) {
      var f = flags(o, M, avg), lv = f.list.some(function (s) { return s.c === 'r'; }) ? 'bad' : f.list.length ? 'warn' : '';
      var row = mk('tr', 'tprow ' + lv + (openRow[o.n] ? ' open' : '')); row.tabIndex = 0;
      var nc = mk('td'); nc.append(mk('span', 'av', o.n.slice(0, 1)), mk('b', 'nm', o.n), mk('span', 'car', openRow[o.n] ? '▴' : '▾')); row.append(nc);
      var wc = mk('td'); wc.append(o.fresh ? String(o.pend) : '–'); if (o.over20) { wc.append(mk('br'), mk('span', 'tword r', '20분+ ' + o.over20)); } if (o.fresh && o.held) { wc.append(mk('br'), mk('span', 'tword m', '보류 ' + o.held)); }; if (!o.fresh) wc.title = o.x ? '기록기 꺼짐 · 마지막 신호 ' + ago(o.x.at) : '오늘 신호 없음'; row.append(wc);
      var lw = vs(o.lateN, avg.late, '건', true); cell(row, String(o.lateN), lw, lw.lv === 2 ? 'bad' : '').title = o.lateMax && o.lateN ? '가장 오래 ' + o.lateMax + '분' : '';
      cell(row, o.wait != null ? n0(o.wait) + '분' : '–', vs(o.wait, avg.wait, '분', true));
      var soft = function (w) { return w.c === 'r' || w.c === 'o' ? { t: w.t, c: 'm' } : w; };
      if (multi) { row.append(mk('td', null, o.work + '일')); cell(row, o.ans ? n0(o.ansDay) + '건' : '–', o.ans ? vs(o.ansDay, avg.ansDay, '건') : null).title = '합계 ' + o.ans + '건 (카톡 ' + o.ak + ' · 톡톡 ' + o.an + ')'; cell(row, o.perDay != null ? n0(o.perDay) + '건' : '–', soft(vs(o.perDay, avg.perDay, '건'))).title = '합계 ' + o.rec + '건'; }
      else { cell(row, o.ans + '건', soft(vs(o.ans, avg.ansDay, '건'))).title = '카톡 ' + o.ak + ' · 톡톡 ' + o.an; cell(row, o.rec + '건', soft(vs(o.perDay, avg.perDay, '건'))); }
      var hc = mk('td', hardHigh(o, avg) ? 'thard' : null); hc.append(mk('b', null, pct(o.hardPct))); if (o.hardPct != null && avg.hardPct != null) { hc.append(mk('br')); hc.append(mk('span', 'tword m', '팀 ' + pct(avg.hardPct))); } hc.title = HARD_LABEL + ' 기록 비율' + (o.catN ? ' · ' + o.hardN + '/' + o.catN + '건' : ' · 카테고리 기록은 기록기 2.4.15부터'); row.append(hc);
      var rest = Math.max(0, o.rec - o.k - o.nv - o.bd); var chc = mk('td', null, o.k + ' · ' + o.nv + ' · ' + o.bd); if (rest) { chc.append(mk('br')); chc.append(mk('span', 'tword m', '구분 전 ' + rest)); chc.title = '구분 전 = 기록기 2.4.14 · 팀 서버 1.3.8 전에 쌓여 카톡·톡톡을 못 나눈 채팅 기록'; } row.append(chc);
      row.append(mk('td', 'z2', f1(o.ph)));
      row.append(mk('td', o.missN >= 2 ? 'bad' : o.missN ? 'warnc' : '', o.fresh || o.hasQ ? String(o.missN) : '–'));
      if (M.oneDay) { var fl = (o.days[M.oneDay] || {}).fl || { long: [] }; row.append(mk('td', (fl.long || []).length >= 2 ? 'warnc' : '', fl.n >= 2 ? String(fl.long.length) : '–')); }
      var cc = mk('td', 'tconn'); if (!o.fresh) cc.append(mk('span', 'cst off', o.x ? '꺼짐 · ' + ago(o.x.at) : '신호 없음')); else if (o.bad.length) o.bad.forEach(function (b) { cc.append(T2().pill(b.ch, (T2().CONN_LABEL[b.s] || '확인 필요') + (b.at ? ' · ' + ago(b.at).replace(' 전', '째') : ''), 'bad')); }); else cc.append(mk('span', 'cst ok', '정상')); row.append(cc);
      var ac = mk('td'); ac.append(btn('면담 화면', 'ghost sm', function (e) { e.stopPropagation(); ctx.who(o.n); })); row.append(ac);
      var xr = mk('tr', 'tpx'); xr.hidden = !openRow[o.n]; var xc = mk('td'); xc.colSpan = cols; xr.append(xc);
      var fill = function () { if (!xc.childNodes.length) xc.append(rowDetail(o, M)); };
      if (openRow[o.n]) fill();
      var tog = function () { openRow[o.n] = !openRow[o.n]; xr.hidden = !openRow[o.n]; row.classList.toggle('open', !!openRow[o.n]); nc.querySelector('.car').textContent = openRow[o.n] ? '▴' : '▾'; if (openRow[o.n]) fill(); };
      row.addEventListener('click', function (e) { if (e.target.closest('a,button')) return; tog(); });
      row.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tog(); } });
      bd.append(row, xr);
    });
    var tot = mk('tr', 'total'), cells = ['팀 평균', '', f1(avg.late), avg.wait != null ? n0(avg.wait) + '분' : '–'];
    if (multi) cells.push('', n0(avg.ansDay) + '건', n0(avg.perDay) + '건'); else cells.push(n0(avg.ansDay) + '건', n0(avg.perDay) + '건');
    cells.push(pct(avg.hardPct), avg.k + ' · ' + avg.nv + ' · ' + avg.bd + ' (합계)', f1(avg.ph), avg.miss != null ? f1(avg.miss) : '–'); if (M.oneDay) cells.push(''); cells.push('', '');
    cells.forEach(function (c) { tot.append(mk('td', null, c)); }); bd.append(tot);
    if (!ppl.length) { var er = mk('tr'), ec = mk('td', null, '아직 신호를 보낸 상담사가 없어요.'); ec.colSpan = cols; er.append(ec); bd.append(er); }
    tb.append(bd); var wrap = mk('div', 'twrap'); wrap.append(tb); return wrap;
  }
  // 줄을 펼치면: 하루면 그날 흐름 + (오늘이면) 기다리는 고객 · 답했는데 기록 없음 / 여러 날이면 날짜별
  function rowDetail(o, M) {
    var box = mk('div', 'tpd');
    if (M.oneDay) {
      var v = o.days[M.oneDay] || { fl: T2().flowOf([]) }, fl = v.fl, lab = mk('div', 'plab');
      lab.append(mk('span', null, o.n + ' · ' + M.periodName + ' 흐름'), mk('span', 'pr', fl.n ? hhmm(fl.first) + ' – ' + hhmm(fl.last) + ' · 기록 ' + fl.n + '건 · 기록 사이 ' + (fl.med || 0) + '분' : '기록 시각 없음'));
      box.append(lab, timeline(fl, W.day(M.oneDay, M.wcfg)), gapChips(fl), catChips(o.cats, o.catN));
      if (M.isToday && o.fresh) {
        var g = mk('div', 'tpd2'), c1 = mk('div', 'pcol'), l1 = mk('div', 'plab'); l1.append(mk('span', null, '지금 기다리는 고객 '), mk('b', null, o.pend + '명'), mk('span', 'pr', o.bad.length ? '끊기기 전 기준' : '오래 기다린 순')); c1.append(l1);
        if (!o.pend) c1.append(mk('div', 'pnone', '기다리는 고객 없음'));
        else if (o.top) { var wl = mk('div', 'pwl'); o.top.forEach(function (t) { var r = mk('div', 'pw' + (t.w >= 20 ? ' r' : t.w >= 10 ? ' a' : '')), msg = mk('span', 'pmsg'); if (t.r) msg.append(mk('span', 'pre', '다시 옴')); msg.append(t.p || '(사진·파일 또는 내용 없음)'); msg.title = t.p || ''; r.append(mk('span', 'pmin', t.w + '분'), chip(t.ch), mk('span', 'pcn', t.n || '이름 없음'), link(t), msg); wl.append(r); }); if (o.pend > o.top.length) wl.append(mk('div', 'pmore', '+ ' + (o.pend - o.top.length) + '명 더 (덜 기다린 고객)')); c1.append(wl); }
        else c1.append(mk('div', 'pmore', o.pend + '명 · 가장 오래 ' + o.oldest + '분 · 고객 이름·메시지는 기록기 2.4.4부터 보여요'));
        // 2.4.15 보류해 둔 고객(최근 보류 순) — 패널 [보류]는 바로, 톡톡 보류 탭은 30초 안에 팀 서버로
        if (o.held) {
          var hl = mk('div', 'plab tholdl'); hl.append(mk('span', null, '보류 중 '), mk('b', null, o.held + '명'), mk('span', 'pr', '최근 보류 순')); c1.append(hl);
          if (o.hold && o.hold.length) { var hw = mk('div', 'pwl'); o.hold.forEach(function (t) { var r = mk('div', 'pw h'), msg = mk('span', 'pmsg'); msg.append(t.p || '(사진·파일 또는 내용 없음)'); msg.title = t.p || ''; r.append(mk('span', 'pmin', t.s ? '보류 탭' : t.at ? clock(t.at) : '보류'), chip(t.ch), mk('span', 'pcn', t.n || '이름 없음'), link(t), msg); hw.append(r); }); if (o.held > o.hold.length) hw.append(mk('div', 'pmore', '+ ' + (o.held - o.hold.length) + '명 더')); c1.append(hw); }
          else c1.append(mk('div', 'pmore', '보류한 고객 이름·메시지는 기록기 2.4.15 · 팀 서버 1.3.9부터 보여요'));
        }
        var mc = missCol(o); g.append(c1, mc); box.append(g); if (mc.xp) box.append(mc.xp);
        var warn = T2().sanity(o.n, Object.assign({ answered: 0, waitSum: 0, over20: 0, records: 0 }, sumDay(M, o.n)), o.x, false, o.cs, M.wcfg, M.now).filter(function (s) { return !/목록 읽기가 정상이 아니에요|목록을 한 번도 못 읽었어요/.test(s); });
        if (warn.length) { var ww = mk('div', 'ppw'); warn.forEach(function (s) { ww.append(mk('div', null, '⚠ ' + s)); }); box.append(ww); }
      } else if (M.isToday) box.append(mk('div', 'poff', o.x ? '기록기가 꺼져 있어 지금 대기는 알 수 없어요 · 마지막 신호 ' + clock(o.x.at) + ' (' + ago(o.x.at) + ')' : '오늘 신호 없음'));
      return box;
    }
    var rows = M.keys.filter(function (d) { var v = o.days[d]; return v && (v.rec || v.fl.n || v.lateN); }).reverse().map(function (d) {
      var v = o.days[d]; return { cells: [md(d), { text: String(v.rec), cls: 'sum' }, String(v.k), String(v.nv), String(v.bd), v.fl.n >= 2 ? f1(v.fl.perHour) : '–', { text: String(v.lateN), cls: v.lateN >= 3 ? 'bad' : '' }, v.fl.n >= 2 ? String(v.fl.long.length) : '–'] };
    });
    box.append(mk('div', 'plab', o.n + ' · ' + M.periodName + ' 카테고리'), catChips(o.cats, o.catN));
    box.append(mk('div', 'plab', o.n + ' · 날짜별'));
    box.append(rows.length ? T2().table(['날짜', '처리', '카톡', '톡톡', '게시판', '시간당', '20분 넘김', '30분+ 빈 때'], rows, 'tday') : mk('div', 'pnone', '이 기간 기록이 없어요'));
    return box;
  }
  // 카테고리별 기록(사람 × 카테고리) · 어려운 상담 비율
  function catTable(M) {
    var cd = mk('details', 'tdet tcatd'); cd.append(mk('summary', null, '카테고리별 기록 · ' + M.periodName + ' (어려운 상담을 많이 맡았는지)'));
    if (store('kb:tcat') === '1') cd.open = true; cd.addEventListener('toggle', function () { store('kb:tcat', cd.open ? '1' : '0'); });
    var cl = catList(M.team.cats);
    if (!cl.length) { cd.append(mk('div', 'pnone m', '아직 카테고리 기록이 없어요. 기록기 2.4.15 · 팀 서버 1.3.9부터 모여요.')); return cd; }
    var heads = ['상담사'].concat(cl.map(function (x) { return x.c; }), ['합계', '어려운 상담']);
    var rows = M.people.filter(function (o) { return o.catN; }).sort(function (a, b) { return b.catN - a.catN; }).map(function (o) {
      return { cells: [o.n].concat(cl.map(function (x) { var n = o.cats[x.c] || 0; return { text: n ? String(n) : '', cls: n && isHard(x.c) ? 'hardc' : '' }; }), [{ text: String(o.catN), cls: 'sum' }, { text: pct(o.hardPct), cls: hardHigh(o, M.team) ? 'hardc' : '' }]) };
    });
    rows.push({ cls: 'total', cells: ['팀 합계'].concat(cl.map(function (x) { return String(x.n); }), [String(M.team.catN), pct(M.team.hardPct)]) });
    cd.append(T2().table(heads, rows, 'tcatt'));
    cd.append(mk('p', 'muted tfoot', '어려운 상담 = ' + HARD_LABEL + '. 이런 상담이 많으면 하나를 끝내는 데 오래 걸려 기록 건수가 적게 나올 수 있어요. 숫자는 센 기록(같은 날 같은 고객 1건)의 카테고리예요.'));
    return cd;
  }
  function sumDay(M, n) { var o = {}, P = T().person; Object.keys(M.days[M.td] || {}).forEach(function (k) { if (P(k) === n) ['answered', 'waitSum', 'over20', 'records'].forEach(function (f) { o[f] = (o[f] || 0) + ((M.days[M.td][k] || {})[f] || 0); }); }); return o; }
  // 답했는데 기록 없음(지금) · [기록 안 해도 돼요]
  function missCol(o) {
    var c3 = mk('div', 'pcol'), l3 = mk('div', 'plab'); l3.append(mk('span', null, '답했는데 기록 없음'), mk('span', 'pr', '지금')); c3.append(l3);
    var miss = o.miss, missE = miss.filter(function (m) { return m.e; }).length;
    if (!miss.length) { var z = mk('div', 'pmiss z'); z.append(mk('b', null, '0건'), mk('span', null, '빠진 기록 없음')); c3.append(z); return c3; }
    var mb = mk('div', 'pmiss'); mb.append(mk('b', null, miss.length + '건'), mk('span', null, '대기에서 빠졌는데 그 상담방 기록이 팀 어디에도 없음'));
    var tg = mk('div', 'ptags'); if (missE) tg.append(mk('span', 'ptag d', '상담 종료 ' + missE)); if (miss.length - missE) tg.append(mk('span', 'ptag g', (miss.some(function (m) { return m.n || m.p; }) ? '아직 진행 중 ' : '상태 모름 ') + (miss.length - missE))); mb.append(tg);
    var xp = mk('div', 'ppx'), tb = btn('', 'sm', function () { openMiss[o.n] = !openMiss[o.n]; paint(); });
    var paint = function () { tb.textContent = openMiss[o.n] ? '목록 접기 ▴' : '목록 펼치기 ▾'; tb.className = 'btn sm ' + (openMiss[o.n] ? 'ghost' : 'primary'); xp.hidden = !openMiss[o.n]; };
    mb.append(tb); c3.append(mb);
    var t = mk('table', 'ttable pxt'), hr = mk('tr'); ['채널', '고객', '답한 시각', '답하기 전 고객 마지막 말', '상담 상태', ''].forEach(function (s) { hr.append(mk('th', null, s)); }); var th = mk('thead'); th.append(hr); t.append(th);
    var bd = mk('tbody');
    miss.forEach(function (m) {
      var tr = mk('tr'), stt = T2().missStatus(m), act = mk('td', 'pact');
      act.append(link(m), btn('기록 안 해도 돼요', 'ghost sm', async function () { try { var tok = await T().adminToken(), old = m.ch + ':' + m.id; try { await CSTeam.call('qa.ok', { key: 'miss:' + old + ':' + W.dayKey(m.at || Date.now()), adminToken: tok }); } catch (e1) { await CSTeam.call('qa.ok', { key: old, adminToken: tok }); } tr.remove(); say('목록에서 뺐어요', 'ok'); } catch (e) { say(e.message, 'err'); } }));
      var said = mk('td', 'pmsgc', m.p || (m.n ? '(사진·파일 또는 내용 없음)' : '기록기 2.4.4부터 보여요')); said.title = m.p || '';
      var c0 = mk('td'); c0.append(chip(m.ch)); var c4 = mk('td'); c4.append(mk('span', stt[0], stt[1]));
      tr.append(c0, mk('td', 'pcn', m.n || '–'), mk('td', null, clock(m.at)), said, c4, act); bd.append(tr);
    });
    t.append(bd); var wrap = mk('div', 'twrap'); wrap.append(t); xp.append(wrap); c3.xp = xp; paint();
    return c3;
  }

  /* ───── 면담 화면: 한 사람만 · 다른 사람 평균과 나란히 · 말할 거리 ───── */
  var fDay = {};
  function interview(M, who, ctx) {
    var o = M.people.filter(function (p) { return p.n === who; })[0], box = mk('div', 'tview tiv');
    if (!o) { box.append(mk('div', 'empty', who + ' 님의 숫자가 이 기간에 없어요.')); return box; }
    var av = others(M, who), anon = store('kb:anon') !== '0', label = function (n) { return n === who ? n : anon ? '다른 상담사' : n; };
    var multi = !M.oneDay, flg = flags(o, M, av).list;
    // 위 세 칸
    var hero = mk('div', 'thero');
    var card = function (title, badTitle, big, unit, me, oth, meL, othL, sayT, bad, cls) {
      var c = mk('div', 'thc' + (bad ? ' bad' : '')); c.append(mk('div', 'thct', bad ? badTitle : title));
      var b = mk('div', 'thcb' + (bad ? ' r' : cls ? ' ' + cls : '')); b.append(big, mk('small', null, unit)); c.append(b);
      var mx = Math.max(me || 0, oth || 0) || 1, bar = function (lab, v, t) { var r = mk('div', 'thbar'); r.append(mk('span', null, lab)); var tr = mk('div', 'thbt'), i = mk('i', t); i.style.width = Math.max(2, (v || 0) / mx * 100) + '%'; tr.append(i); r.append(tr); return r; };
      c.append(bar(meL, me, bad ? 'me bad' : 'me'), bar(othL, oth, 'oth'), mk('div', 'thsay' + (bad ? ' r' : ' ok'), sayT)); return c;
    };
    var l1 = av.late, lb = o.lateN >= 2 && l1 != null && o.lateN >= l1 * 1.5;
    hero.append(card('고객을 20분 넘게 기다리게 한 상담', '① 고객을 오래 기다리게 했어요', String(o.lateN), '건 · 20분 넘게 기다린 뒤 답함', o.lateN, l1, o.n + ' · ' + o.lateN + '건', '다른 사람 평균 · ' + f1(l1) + '건',
      !o.lateN ? '20분 넘게 기다리게 한 상담이 없어요.' : lb ? (l1 ? '다른 사람보다 ' + (o.lateN / Math.max(0.5, l1)).toFixed(1).replace(/\.0$/, '') + '배 많아요. ' : '') + (o.lateMax ? '가장 오래 기다린 고객 ' + o.lateMax + '분.' : '') : '다른 사람과 비슷해요.', lb));
    // ② 응대: 답한 상담(주) · 완료 기록(참고) — 응대는 비슷한데 완료만 적으면 긴 상담이 많았던 것
    var aa = vs(o.ansDay, av.ansDay, '건'), pd = vs(o.perDay, av.perDay, '건'), sorted = M.people.filter(function (p) { return p.ans; }).sort(function (a, b) { return b.ansDay - a.ansDay; }), pos = sorted.indexOf(o) + 1;
    var aBad = multi && aa.lv === 2, aSay = !o.ans ? '답한 상담 숫자가 아직 없어요(게시판만 했거나 기록기 2.4.0 전).' : aa.lv > 0 ? (multi ? '하루에 ' : '') + n0(av.ansDay - o.ansDay) + '건 덜 응대했어요.' + (pos ? ' ' + sorted.length + '명 중 ' + pos + '번째.' : '') : aa.c === 'g' ? '다른 사람보다 ' + n0(o.ansDay - av.ansDay) + '건 더 응대했어요.' : '응대 횟수는 다른 사람과 비슷해요.';
    if (o.ans && aa.lv <= 0 && pd.lv > 0) aSay += ' 완료 기록은 ' + n0(av.perDay - o.perDay) + '건 적어요 — 길게 주고받는 상담이 많았을 수 있어요.';
    hero.append(card('응대한 상담', '② 응대한 상담이 적어요', multi ? '하루 ' + n0(o.ansDay) : String(o.ans), '건 답함 · 완료 기록 ' + (multi ? '하루 ' + n0(o.perDay) : o.rec) + '건', o.ansDay, av.ansDay, o.n + ' · 답한 상담 ' + (multi ? '하루 ' : '') + n0(o.ansDay) + '건', '다른 사람 평균 · ' + (multi ? '하루 ' : '') + n0(av.ansDay) + '건', aSay, aBad));
    var mb = o.missN >= 2 && (av.miss == null || o.missN > av.miss);
    hero.append(card('답했는데 기록 안 한 상담', '③ 기록을 안 한 상담이 있어요', String(o.missN), '건 · 지금 남아 있음', o.missN, av.miss, o.n + ' · ' + o.missN + '건', '다른 사람 평균 · ' + f1(av.miss) + '건', o.missN ? '아래 목록에서 하나씩 열어 볼 수 있어요.' : '빠진 기록이 없어요.', mb, o.missN ? 'o' : ''));
    box.append(hero);
    // 날짜별(여러 날) · 시간대별(하루): 나 vs 다른 사람 평균
    var g2 = mk('div', 'tg2'), pc = mk('div', 'tpanel'), ph = mk('div', 'tph'), lg = mk('span', 'tlg'); lg.append(mk('i', 'me'), o.n, mk('i', 'oth'), '다른 사람 평균');
    ph.append(mk('b', null, multi ? '날짜별 답한 상담' : '시간대별 완료 기록'), lg); pc.append(ph);
    var groups = [];
    if (multi) M.keys.forEach(function (d) { var od = o.days[d] || {}; if (!W.day(d, M.wcfg) && !od.ans) return; if (d > M.td) return; var oth = mean(M.people.filter(function (p) { return p.n !== who && ((p.days[d] || {}).ans || 0) > 0; }).map(function (p) { return p.days[d].ans; })); groups.push({ l: Number(d.slice(8)) + '일 ' + WD[W.weekday(d)], a: od.ans || 0, b: oth, sub: '완료 ' + (od.rec || 0) }); });
    else { var fl0 = (o.days[M.oneDay] || {}).fl || { hours: {} }, wd0 = W.day(M.oneDay, M.wcfg), hi0 = Math.ceil((wd0 ? wd0.workEnd : 19 * 60) / 60) - 1;
      for (var h = 10; h <= hi0; h++) { var oth2 = mean(M.people.filter(function (p) { return p.n !== who && ((p.days[M.oneDay] || {}).fl || {}).n; }).map(function (p) { return p.days[M.oneDay].fl.hours[h] || 0; })); groups.push({ l: h === 13 ? '점심' : h + '시', a: (fl0.hours || {})[h] || 0, b: oth2 }); } }
    var gmax = Math.max.apply(null, groups.map(function (g) { return Math.max(g.a, g.b || 0); }).concat([1])), gb = mk('div', 'tgb');
    groups.forEach(function (g) { var c = mk('div', 'tgbc'), bs = mk('div', 'tgbb'), ia = mk('i', 'me' + (g.b != null && g.a < g.b * 0.75 ? ' lo' : '')), ib = mk('i', 'oth'); ia.style.height = (g.a / gmax * 100) + '%'; ib.style.height = ((g.b || 0) / gmax * 100) + '%'; ia.append(mk('em', null, String(g.a))); if (g.b != null) ib.append(mk('em', null, n0(g.b))); bs.append(ia, ib); c.append(bs, mk('span', null, g.l)); if (g.sub) c.append(mk('small', null, g.sub)); c.title = g.l + ' · ' + o.n + ' ' + g.a + '건 · 다른 사람 평균 ' + (g.b != null ? f1(g.b) : '–') + '건' + (g.sub ? ' · ' + g.sub : ''); gb.append(c); });
    pc.append(groups.length ? gb : mk('div', 'pnone', '이 기간 기록이 없어요'));
    if (multi) pc.append(mk('p', 'muted tfoot', '막대 아래 작은 글씨 = 그날 완료 기록(참고)'));
    g2.append(pc);
    var rp = mk('div', 'tpanel'), rh = mk('div', 'tph'); rh.append(mk('b', null, M.periodName + ' 줄 세우기'), mk('span', 'muted', anon ? '다른 사람 이름은 가림' : '이름 보임'));
    rp.append(rh, mk('div', 'rkrow two'));
    rp.lastChild.append(rank('20분 넘게 기다리게 한 상담', M.people.map(function (p) { return { label: label(p.n), v: p.perDay == null && !p.lateN ? null : p.lateN, me: p.n === who }; }), M.team.late, '팀 평균 ' + f1(M.team.late) + '건', { lowerBetter: true }), rank(multi ? '하루 평균 답한 상담' : '답한 상담', M.people.map(function (p) { return { label: label(p.n), v: p.ans ? p.ansDay : null, me: p.n === who }; }), M.team.ansDay, '팀 평균 ' + n0(M.team.ansDay) + '건'));
    // 채널 비율(게시판이 많으면 건수가 적게 나올 수 있어서)
    var share = function (p) { var t = p.k + p.nv + p.bd; return t ? { k: p.k / t, nv: p.nv / t, bd: p.bd / t } : null; }, me = share(o), ot = M.people.filter(function (p) { return p.n !== who; }).map(share).filter(Boolean);
    if (me && ot.length) { var obd = mean(ot.map(function (s) { return s.bd; }));
      rp.append(mk('div', 'note tnote', '채널 비율: 카톡 ' + pct(me.k) + ' · 톡톡 ' + pct(me.nv) + ' · 게시판 ' + pct(me.bd) + ' (다른 사람 게시판 평균 ' + pct(obd) + ') — ' + (me.bd - obd >= 0.15 ? '게시판 비율이 높아 건수가 적게 나올 수 있어요.' : '다른 사람과 채널 비율이 비슷해서 채널 탓은 아니에요.'))); }
    // 카테고리(어려운 상담을 많이 맡았으면 건수가 적게 나올 수 있어서)
    if (o.catN) {
      var hn = mk('div', 'note tnote'), hh = hardHigh(o, av);
      hn.append('맡은 상담 종류: 어려운 상담(' + HARD_LABEL + ') ' + pct(o.hardPct) + (av.hardPct != null ? ' (다른 사람 ' + pct(av.hardPct) + ')' : '') + ' — ' + (hh ? '어려운 상담이 많아 건수가 적게 나올 수 있어요.' : av.hardPct == null ? '비교할 다른 사람 기록이 아직 없어요.' : '다른 사람과 비슷해서 상담 종류 탓은 아니에요.'));
      hn.append(catChips(o.cats, o.catN)); rp.append(hn);
    } else rp.append(mk('div', 'note tnote', '맡은 상담 종류: 이 기간 카테고리 기록이 없어요(기록기 2.4.15 · 팀 서버 1.3.9부터).'));
    g2.append(rp); box.append(g2);
    // 하루 흐름(날짜 고르기 · 기본은 기간에서 가장 적게 처리한 날)
    var wdays = M.keys.filter(function (d) { var v = o.days[d]; return v && v.fl.n; });
    if (wdays.length) {
      var key = who + '|' + M.period, cur = fDay[key] && wdays.indexOf(fDay[key]) >= 0 ? fDay[key] : wdays.slice().sort(function (a, b) { return o.days[a].rec - o.days[b].rec || (a < b ? 1 : -1); })[0];
      var fp = mk('div', 'tpanel'), fh = mk('div', 'tph'); fh.append(mk('b', null, '하루 흐름 · ' + md(cur)), mk('span', 'muted', multi ? '이 기간 가장 적게 처리한 날부터 · 날짜를 누르면 바뀜' : '파란 줄 = 기록 1건 · 빨간 칸 = 30분 넘게 기록 없음 · 회색 = 점심'));
      fp.append(fh);
      if (multi) { var dn = mk('div', 'ins bper'); wdays.forEach(function (d) { var b = mk('button', d === cur ? 'on' : null, WD[W.weekday(d)] + ' ' + Number(d.slice(8)) + '일 · ' + o.days[d].rec + '건'); b.type = 'button'; b.addEventListener('click', function () { fDay[key] = d; ctx.again(); }); dn.append(b); }); fp.append(dn); }
      var fl = o.days[cur].fl, gsum = fl.long.reduce(function (s, z) { return s + z[2]; }, 0);
      fp.append(timeline(fl, W.day(cur, M.wcfg)));
      fp.append(mk('div', 'thsay' + (fl.long.length >= 2 ? ' r' : ' ok'), md(cur) + ': ' + (fl.long.length ? '30분 넘게 기록이 없던 때 ' + fl.long.length + '번, 합쳐서 ' + hm(gsum) : '30분 넘게 빈 시간 없음') + ' · 기록 ' + fl.n + '건 · ' + hhmm(fl.first) + '–' + hhmm(fl.last)));
      box.append(fp);
    }
    // 목록: 20분 넘게 기다리게 한 상담 · 답했는데 기록 안 한 상담
    var g3 = mk('div', 'tg2'), lp = mk('div', 'tpanel'), lh = mk('div', 'tph'); lh.append(mk('span', 'tdot r'), mk('b', null, '20분 넘게 기다리게 한 상담 ' + o.lateN + '건'), mk('span', 'muted', '오래 기다린 순'));
    lp.append(lh);
    if (!o.late.length) lp.append(mk('div', 'pnone', o.lateN ? '상담 목록은 기록기 2.4.0부터 보여요(숫자만 있음)' : '없어요'));
    else lp.append(T2().table(['답한 때', '채널', '기다린 시간', ''], o.late.slice(0, 40).map(function (z) { return { cells: [md(z.d) + ' ' + clock(z.at), { node: chip(z.ch) }, { text: (z.w || 0) + '분', cls: 'bad' }, { node: link(z, '상담 열기') }] }; }), 'tlate'));
    var mp = mk('div', 'tpanel'), mh = mk('div', 'tph'); mh.append(mk('span', 'tdot o'), mk('b', null, '답했는데 기록 안 한 상담 ' + o.missN + '건'), mk('span', 'muted', '지금 남아 있는 것'));
    mp.append(mh);
    if (!o.miss.length) mp.append(mk('div', 'pnone', '없어요'));
    else mp.append(T2().table(['답한 때', '채널', '상담 상태', ''], o.miss.map(function (m) { var st = T2().missStatus(m); return { cells: [md(W.dayKey(m.at || M.now)) + ' ' + clock(m.at), { node: chip(m.ch) }, st[1], { node: link(m, '상담 열기') }] }; }), 'tmiss'));
    // 말할 거리
    var talk = [];
    if (lb) talk.push('20분 넘게 기다린 고객이 ' + o.lateN + '건이에요(다른 사람 평균 ' + f1(l1) + '건). 패널 위쪽, 오래 기다린 고객부터 먼저 답해 주세요.');
    if (aBad) talk.push('하루 평균 답한 상담이 ' + n0(o.ansDay) + '건으로 다른 사람보다 ' + n0(av.ansDay - o.ansDay) + '건 적어요.' + (wdays.length ? ' 하루 흐름에서 비는 시간을 같이 봐요.' : ''));
    else if (o.wait != null && av.wait != null && o.wait >= av.wait * 1.5 && o.ans >= 5) talk.push('고객이 답을 받기까지 평균 ' + n0(o.wait) + '분 기다렸어요(다른 사람 ' + n0(av.wait) + '분). 진행 중 고객부터 먼저 답해 주세요.');
    if ((aBad || lb) && hardHigh(o, av)) talk.push('다만 어려운 상담(' + HARD_LABEL + ')이 ' + pct(o.hardPct) + '로 다른 사람(' + pct(av.hardPct) + ')보다 많았어요. 이 점은 참작해요.');
    if (o.missN) talk.push('답하고 기록 안 한 상담 ' + o.missN + '건, 지금 열어서 기록해 주세요.');
    var th = mk('div', 'tph'); th.append(mk('b', null, '말할 거리'), mk('span', 'muted', '화면이 자동으로 정리'));
    var tn = mk('div', 'note tnote'); if (!talk.length) tn.textContent = '이 기간엔 특별히 말할 거리가 없어요.'; talk.forEach(function (t, i) { tn.append(mk('div', null, (i + 1) + '. ' + t)); });
    mp.append(th, tn);
    g3.append(lp, mp); box.append(g3);
    box.append(mk('p', 'muted tfoot', '공정하게 보려고: 시간당은 그날 첫 기록~마지막 기록 사이(점심 빼고)로 나눠서 반차·늦은 출근은 저절로 반영돼요. 긴 통화·어려운 상담이 있던 날은 하루 흐름에서 같이 확인해 주세요. 기록기를 끈 시간과 다른 PC 기록은 안 잡혀요. 고객 이름은 이 화면에 나오지 않아요.'));
    if (!flg.length) box.insertBefore(mk('div', 'tok', o.n + ' 님은 ' + M.periodName + ' 챙길 것이 없어요.'), hero);
    return box;
  }

  /* ───── 그리기: 팀 현황(admin-team.js team())이 부름 ───── */
  async function render(r, st) {
    var M = await collect(r, st.period), ctx = { who: st.who, again: st.again };
    if (st.person) {
      var wrap = mk('div', 'tview'), hd = mk('div', 'tivh'), back = btn('← 팀 현황', 'ghost sm', function () { st.who(''); });
      var sel = mk('select', 'sel'); M.people.forEach(function (p) { sel.append(new Option(p.n, p.n)); }); sel.value = st.person; sel.setAttribute('aria-label', '상담사'); sel.addEventListener('change', function () { st.who(sel.value); });
      var sw = mk('label', 'tsw'), cb = mk('input'); cb.type = 'checkbox'; cb.checked = store('kb:anon') !== '0'; cb.addEventListener('change', function () { store('kb:anon', cb.checked ? '1' : '0'); st.again(); }); sw.append(cb, mk('span', null, '다른 사람 이름 가리기'));
      hd.append(back, mk('span', 'av big', st.person.slice(0, 1)), mk('b', 'tivn', st.person + ' 면담 화면'), sel, mk('span', 'sp'), sw);
      wrap.append(hd, interview(M, st.person, ctx)); return wrap;
    }
    return overview(M, ctx);
  }
  window.KBTeam3 = { render: render, vs: vs, rank: rank };
})();
