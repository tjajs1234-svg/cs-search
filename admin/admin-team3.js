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
  // 2026-10-21 방 열쇠 → 짧은 숫자(팀 서버 roomHash_ · hash1_과 같은 식)
  function rh(k) { var h = 2166136261; for (var i = 0; i < k.length; i++) { h ^= k.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return k.charAt(0) + h.toString(36); }
  // 2026-10-21 팀장 [빼기](주인): '날짜|채널:방' → { r: 이유, w: 뺄 때 기다린 분, at } · 이 PC에만 기억 · 두 달 지나면 지움
  var SKIP_KEY = 'kb:team:skip', SKIP_WHY = ['다른 상담사가 마무리함', '인사만 보낸 고객', '기록기 착오', '기타'];
  function skipGet() { var o = {}; try { o = JSON.parse(store(SKIP_KEY) || '{}') || {}; } catch (e) { o = {}; } return typeof o === 'object' ? o : {}; }
  function skipSet(key, v) { var o = skipGet(), cut = W.addDays(W.dayKey(Date.now()), -62); Object.keys(o).forEach(function (k) { if (k.slice(0, 10) < cut) delete o[k]; }); if (v) o[key] = v; else delete o[key]; store(SKIP_KEY, JSON.stringify(o)); }

  /* ───── 숫자 모으기: 사람마다 고른 기간의 기록 · 채널 · 시간당 · 20분 넘김 · 빈 시간 + 지금 상태 ───── */
  async function collect(r, period, maxAge) {
    await (T().syncLead ? T().syncLead() : null);
    var K = T2(), P = T().person, now = Date.now(), td = W.dayKey(now), days = r.days || {}, keys = K.periodKeys(period);
    // 2026-10-21 이번 달·2주는 늘 같은 범위로 물어서 기간을 바꿔도 방금 받은 걸 다시 씀(팀 서버는 qa.json 하나만 읽음)
    var back = Math.min(62, Math.max(14, Number(td.slice(8, 10)), Math.round((Date.parse(td + 'T00:00:00Z') - Date.parse(keys[0] + 'T00:00:00Z')) / 864e5) + 1));
    var got = await Promise.all([CSTeam.get('qa.get', { days: back }, maxAge || 0).catch(function () { return { days: {}, live: {} }; }), CSTeam.get('cases.get', {}).catch(function () { return { list: [] }; }), K.getCfg().catch(function () { return null; })]);
    var q = got[0], wcfg = (got[2] || {}).cfg || {}, cbn = {}; (got[1].list || []).forEach(function (x) { cbn[P(x.name)] = x; });
    var live = {}; (r.live || []).forEach(function (x) { live[P(x.name)] = x; });
    var ql = {}; Object.keys(q.live || {}).forEach(function (n) { ql[P(n)] = q.live[n]; });
    var dn = []; keys.forEach(function (d) { Object.keys(days[d] || {}).forEach(function (n) { dn.push(P(n)); }); });
    var names = (await K.teamNames(Object.keys(live).concat(dn))).filter(function (n) { return n !== '팀장' && n !== P('팀장'); });
    var oneDay = keys.length === 1 ? keys[0] : '', isToday = oneDay === td;
    var periodName = { today: '오늘', yday: '어제', week: '이번 주', lweek: '지난주', month: '이번 달' }[period] || (oneDay ? (isToday ? '오늘' : md(oneDay)) : '오늘');
    // 2026-10-21 누가 답했나(기록기 2.4.22 · 팀 서버 1.3.12): 그날 사람마다 답을 보낸 방(짧은 숫자 → [처음 분, 마지막 분])
    //  태그 주인이 그 방에 한 번도 안 보냈고 다른 상담사가 보냈으면 그 상담사가 답한 것 → 20분 넘김에서 빼고, 답한 고객은 보낸 사람에게 옮김
    var sdBy = {}, akBy = {}, moved = {}, skip = skipGet();
    keys.forEach(function (d) {
      var qd = (q.days || {})[d] || {}, sb = sdBy[d] = {}, ab = akBy[d] = {};
      Object.keys(qd).forEach(function (k) {
        var n = P(k), e = qd[k] || {};
        if (e.sd && typeof e.sd === 'object') { var t = sb[n] || (sb[n] = {}); Object.keys(e.sd).forEach(function (h) { var r = e.sd[h]; if (!Array.isArray(r)) return; t[h] = t[h] ? [Math.min(t[h][0], r[0]), Math.max(t[h][1], r[1])] : [r[0], r[1]]; }); }
        if (Array.isArray(e.ak)) { var b = ab[n] || (ab[n] = {}); e.ak.forEach(function (h) { b[h] = 1; }); }
      });
    });
    function sentBy(d, n, h, m0, m1) { var sb = sdBy[d] || {}, hit = ''; Object.keys(sb).forEach(function (m) { var r = sb[m][h]; if (!hit && m !== n && r && (m0 == null || (r[0] <= m1 && r[1] >= m0))) hit = m; }); return hit; }
    keys.forEach(function (d) { var mv = moved[d] = { o: {}, i: {} }; Object.keys(akBy[d]).forEach(function (n) { var mine = sdBy[d][n]; if (!mine) return; Object.keys(akBy[d][n]).forEach(function (h) { if (mine[h]) return; var m = sentBy(d, n, h); if (!m) return; (mv.o[n] || (mv.o[n] = {}))[h] = m; (mv.i[m] || (mv.i[m] = {}))[h] = n; }); }); });
    var people = names.map(function (n) {
      var x = live[n], fresh = !!(x && now - x.at <= 3 * 60000), o = { n: n, x: x, fresh: fresh, cs: cbn[n], days: {}, rec: 0, k: 0, nv: 0, bd: 0, ans: 0, ak: 0, an: 0, wsum: 0, late: [], lateN: 0, lateMax: 0, flN: 0, flH: 0, gaps: 0, work: 0, cats: {}, lateX: 0, lateBy: 0, mvOut: 0, mvIn: 0, on: null, onDays: 0, onAns: 0, onRec: 0, off: 0, hasSd: false };
      keys.forEach(function (d) {
        var dd = days[d] || {}, qd = (q.days || {})[d] || {}, v = { rec: 0, k: 0, nv: 0, bd: 0, ans: 0, ak: 0, an: 0, wsum: 0, rt: [], late: [], o20: 0, maxW: 0, sites: {}, cats: {}, on: null };
        Object.keys(dd).forEach(function (k) {
          if (P(k) !== n) return; var s = dd[k] || {};
          if (!(d === td && fresh)) v.rec += s.records || 0;
          v.k += s.kakao || 0; v.nv += s.naver || 0; v.o20 += s.over20 || 0; v.ans += s.answered || 0; v.wsum += s.waitSum || 0; v.ak += (s.ach || {}).kakao || 0; v.an += (s.ach || {}).naver || 0; v.maxW = Math.max(v.maxW, s.maxWait || 0);
          if (typeof s.on === 'number' && s.on >= 0) v.on = (v.on || 0) + s.on; // 1.3.12 기록기가 켜져 있던 업무시간(분)
          Object.keys(s.sites || {}).forEach(function (st) { v.bd += s.sites[st] || 0; v.sites[st] = (v.sites[st] || 0) + s.sites[st]; });
          Object.keys(s.cats || {}).forEach(function (c) { v.cats[c] = (v.cats[c] || 0) + (s.cats[c] || 0); });
        });
        if (d === td && fresh) v.rec += x.records || 0;
        var seen = {}, rks = {}, aks = {}, hasAk = false; Object.keys(qd).forEach(function (k) { if (P(k) !== n) return; (qd[k].rk || []).forEach(function (h) { rks[h] = 1; }); if (Array.isArray(qd[k].ak)) { hasAk = true; qd[k].ak.forEach(function (h) { aks[h] = 1; }); } v.rt = v.rt.concat(qd[k].rt || []); (qd[k].late || []).forEach(function (z) { var id = z.ch + ':' + z.id; if (!seen[id]) { seen[id] = 1; v.late.push(Object.assign({ d: d }, z)); } }); });
        v.rk = Object.keys(rks); v.rt.sort(function (a, b) { return a - b; }); v.fl = K.flowOf(v.rt);
        // 2026-10-21 20분 넘김에서 빼는 것: 팀장이 [빼기] 한 것 · 다른 상담사가 답한 것(그 방에 본인은 안 보냈고 다른 사람이 그 무렵 보냄)
        var mySd = sdBy[d][n], mo = moved[d].o[n] || {}, mi = moved[d].i[n] || {}; v.hasSd = !!mySd; v.lateX = 0; v.lateBy = 0;
        v.late.forEach(function (z) {
          var key = d + '|' + z.ch + ':' + z.id, h = rh(z.ch + ':' + z.id), am = z.at ? W.minuteOf(z.at) : null;
          if (mySd) z.by = mySd[h] ? n : sentBy(d, n, h, am == null ? null : am - 10, am == null ? null : am + 2);
          if (skip[key]) { z.skip = skip[key].r || '팀장이 뺌'; z.mine = 1; } else if (z.by && z.by !== n) { z.skip = '다른 상담사가 답함'; v.lateBy++; }
          if (z.skip) v.lateX++;
        });
        v.lateN = Math.max(v.late.length - v.lateX, v.o20 - v.lateX, 0);
        // 2026-10-20 답한 상담 = 고객 수(같은 고객은 하루 1명 · 기록기 2.4.17 · 팀 서버 1.3.10부터) · 답한 횟수(ansN)는 참고 · 예전 날은 답한 횟수 그대로
        v.ansN = v.ans; v.akl = hasAk ? Object.keys(aks) : null; if (v.akl && v.akl.length && v.ans) v.ans = Math.min(v.ans, v.akl.length);
        // 2026-10-21 다른 사람 고객에게 대신 답한 건 보낸 사람에게(기록기 2.4.22부터 · 둘 다 2.4.22일 때만)
        v.mvOut = 0; v.mvIn = 0;
        if (v.akl) { v.akl = v.akl.filter(function (h) { if (mo[h]) { v.mvOut++; return false; } return true; }); }
        Object.keys(mi).forEach(function (h) { if (!aks[h]) { (v.akl || (v.akl = [])).push(h); v.mvIn++; } });
        if (v.mvOut || v.mvIn) { v.ans = Math.max(0, v.ans - v.mvOut + v.mvIn); v.ansN = Math.max(v.ans, v.ansN - v.mvOut + v.mvIn); }
        Object.keys(v.cats).forEach(function (c) { o.cats[c] = (o.cats[c] || 0) + v.cats[c]; });
        o.days[d] = v; o.rec += v.rec; o.k += v.k; o.nv += v.nv; o.bd += v.bd; o.ans += v.ans; o.ak += v.ak; o.an += v.an; o.wsum += v.wsum; o.late = o.late.concat(v.late); o.lateN += v.lateN;
        o.lateX += v.lateX; o.lateBy += v.lateBy; o.mvOut += v.mvOut; o.mvIn += v.mvIn; if (v.hasSd) o.hasSd = true;
        o.lateMax = Math.max(o.lateMax, v.late.length ? v.late.reduce(function (m, z) { return z.skip ? m : Math.max(m, z.w || 0); }, 0) : v.lateN ? v.maxW : 0);
        if (v.on != null) { var bz = W.bizMin(W.dayStart(d), Math.min(now, W.dayStart(d) + 864e5), wcfg); o.on = (o.on || 0) + v.on; o.onDays++; o.onAns += v.ans; o.onRec += v.rec; o.off += Math.max(0, bz - v.on); }
        if (v.fl.n >= 2) { o.flN += v.fl.n; o.flH += v.fl.span / 60; } o.gaps += v.fl.long ? v.fl.long.length : 0;
        if (v.rec > 0 || v.fl.n > 0 || v.ans > 0) o.work++;
      });
      o.late.sort(function (a, b) { return (b.w || 0) - (a.w || 0); });
      // 2026-10-20 같은 고객은 한 주(월~금)에 1건(주인) — 팀 서버 1.3.10부터 남는 그날 기록한 방으로 · 이번 달은 주마다 센 것을 더함
      //  다른 날 다시 기록한 건 빼고 따로 보여 줌
      var wkOf = function (d) { return W.addDays(d, -((W.weekday(d) + 6) % 7)); };
      var seenR = {}; o.redup = 0; o.rdK = 0; o.rdN = 0; o.rkAll = {};
      keys.forEach(function (d) { var wk = wkOf(d); (o.days[d].rk || []).forEach(function (r) { var h = wk + ':' + r; if (seenR[h]) { o.redup++; if (r.charAt(0) === 'k') o.rdK++; else o.rdN++; } else { seenR[h] = 1; o.rkAll[h] = 1; } }); });
      if (o.redup) { o.rec = Math.max(0, o.rec - o.redup); o.k = Math.max(0, o.k - o.rdK); o.nv = Math.max(0, o.nv - o.rdN); }
      // 답한 고객도 기간에 한 번(다른 날 다시 온 같은 고객은 빼고 · 답한 횟수는 그대로 참고)
      var seenA = {}; o.ansN = 0; o.reAns = 0; o.akAll = {};
      keys.forEach(function (d) { var v2 = o.days[d], wk = wkOf(d); o.ansN += v2.ansN || 0; (v2.akl || []).forEach(function (h) { h = wk + ':' + h; if (seenA[h]) { if (v2.ans) o.reAns++; } else { seenA[h] = 1; o.akAll[h] = 1; } }); });
      if (o.reAns) o.ans = Math.max(0, o.ans - o.reAns);
      o.perDay = o.work ? o.rec / o.work : (o.rec ? o.rec : null);
      if (!o.work && !o.rec) o.perDay = null;
      o.ph = o.flH >= 0.5 ? o.flN / o.flH : null;
      o.ansDay = o.work ? o.ans / o.work : null; o.wait = o.ansN ? o.wsum / o.ansN : null; // 대기는 답할 때마다 잰 시간이라 답한 횟수로 나눔
      // 2026-10-21 시간당(기록기가 켜져 있던 업무시간으로 나눔 · 1.3.12부터 · 1시간 넘게 켜진 날만)
      o.ansPH = o.on >= 60 && o.onAns ? o.onAns / (o.on / 60) : null; o.recPH = o.on >= 60 && o.onRec ? o.onRec / (o.on / 60) : null;
      o.perCust = o.ans >= 5 && o.ansN ? o.ansN / o.ans : null; // 고객 1명당 답한 횟수
      // 2026-10-20 상담 1건당 답한 횟수(카톡·톡톡: 답한 상담 ÷ 완료 기록) — 많으면 길게 주고받은 상담이 많았던 것(참작)
      o.perCase = (o.k + o.nv) >= 5 && (o.ak + o.an) > 0 ? (o.ak + o.an) / (o.k + o.nv) : null;
      o.catN = 0; o.hardN = 0; Object.keys(o.cats).forEach(function (c) { o.catN += o.cats[c]; if (isHard(c)) o.hardN += o.cats[c]; }); o.hardPct = o.catN >= 3 ? o.hardN / o.catN : null;
      // 지금: 기다리는 고객 · 연결 · 기록 빠짐(팀장이 [기록 안 해도 돼요] 누른 것은 빠짐)
      o.pend = fresh ? (x.pending || 0) : 0; o.oldest = fresh ? (x.oldestMin || 0) : 0; o.over20 = fresh ? (x.over20 || 0) : 0; o.over10 = fresh ? Math.max(x.over10 || 0, o.over20) : 0;
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
    // 두 상담사가 같은 고객을 기록하면 사람마다는 각자 1건 · 팀 합계에서만 1건
    var tR = {}; team.redup = 0; people.forEach(function (o) { Object.keys(o.rkAll).forEach(function (h) { if (tR[h]) { team.redup++; if (h.slice(11).charAt(0) === 'k') team.k--; else team.nv--; } else tR[h] = 1; }); });
    team.rec = Math.max(0, team.rec - team.redup); team.k = Math.max(0, team.k); team.nv = Math.max(0, team.nv);
    team.redupP = people.reduce(function (s2, o) { return s2 + o.redup; }, 0);
    var tA = {}; team.reAns = 0; team.ansN = 0; people.forEach(function (o) { team.ansN += o.ansN; Object.keys(o.akAll).forEach(function (h) { if (tA[h]) team.reAns++; else tA[h] = 1; }); }); team.ans = Math.max(0, team.ans - team.reAns);
    team.perCase = mean(people.map(function (o) { return o.perCase; }));
    return { r: r, q: q, wcfg: wcfg, now: now, td: td, keys: keys, oneDay: oneDay, isToday: isToday, periodName: periodName, period: period, people: people, team: team, days: days };
  }
  // 다른 사람 평균(면담 화면 · 본인 빼고)
  function others(M, who) {
    var on = M.people.filter(function (o) { return o.n !== who && o.perDay != null; });
    return { perDay: mean(on.map(function (o) { return o.perDay; })), ph: mean(on.map(function (o) { return o.ph; })), late: mean(on.map(function (o) { return o.lateN; })), ansDay: mean(on.map(function (o) { return o.ans ? o.ansDay : null; })), wait: mean(on.map(function (o) { return o.wait; })), miss: mean(M.people.filter(function (o) { return o.n !== who && (o.fresh || o.hasQ); }).map(function (o) { return o.missN; })), perCase: mean(M.people.filter(function (o) { return o.n !== who; }).map(function (o) { return o.perCase; })), n: on.length, hardPct: (function () { var c = 0, h = 0; M.people.forEach(function (o) { if (o.n !== who) { c += o.catN; h += o.hardN; } }); return c >= 5 ? h / c : null; })() };
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
    if (a3.lv === 2) { out.push({ k: 'late', c: 'r', t: '고객을 20분 넘게 기다리게 한 상담 ' + o.lateN + '건' + (o.lateMax ? ' (가장 오래 ' + o.lateMax + '분)' : '') }); sc += 40; }
    else if (a3.lv === 1 && o.lateN >= 2) { out.push({ k: 'late', c: 'o', t: '고객을 20분 넘게 기다리게 한 상담 ' + o.lateN + '건' }); sc += 12; }
    if (aw.lv === 2 && o.ans >= 5) { out.push({ k: 'wait', c: 'o', t: '고객 평균 대기 ' + n0(o.wait) + '분 (팀 평균 ' + n0(avg.wait) + '분)' }); sc += 15; }
    // 응대가 적음은 이번 주·이번 달만(하루는 긴 상담 하나에 크게 흔들림)
    if (multi && aa.lv === 2) { out.push({ k: 'ans', c: 'r', t: '하루 평균 답한 상담 ' + n0(o.ansDay) + '건, 팀 평균보다 ' + n0(avg.ansDay - o.ansDay) + '건 적어요' }); sc += 30; }
    if (o.missN) { out.push({ k: 'miss', c: o.missN >= 2 ? 'r' : 'o', t: '답했는데 기록 안 한 상담 ' + o.missN + '건 (지금)' }); sc += 8 * o.missN; }
    if (M.oneDay && o.gaps >= 2) { out.push({ k: 'gap', c: 'm', t: '30분 넘게 기록이 없던 때 ' + o.gaps + '번 (긴 상담일 수 있어요)' }); sc += 3; }
    if (o.fresh && o.bad.length) { var b0 = o.bad[0]; out.push({ k: 'conn', c: 'r', t: chName(b0.ch) + ' 연결이 끊겼어요(' + (T2().CONN_LABEL[b0.s] || '확인 필요') + ')' }); sc += 20; }
    if (aa.lv === 1) sc += 4;
    // 건수가 적거나 늦은 게 있어도 어려운 상담을 많이 맡았으면 같이 보여 줌(참작)
    if (out.some(function (z) { return z.c !== 'm'; }) && hardHigh(o, avg)) out.push({ k: 'hard', c: 'm', t: '어려운 상담(' + HARD_LABEL + ') ' + pct(o.hardPct) + ', 팀 ' + pct(avg.hardPct) + ' — 참작해 주세요' });
    return { list: out, score: sc };
  }

  function hardHigh(o, avg) { return o.hardPct != null && avg.hardPct != null && o.catN >= 5 && o.hardPct >= avg.hardPct + 0.1; }

  /* ───── 2026-10-20 비교 더 세게(주인: "내가 좀 딸리는구나"를 느끼게) — 등수 · 차이(%) · 팀에서 가장 좋은 기록 · 기간 합친 차이 ───── */
  var MET = {
    late: { l: '20분 넘게 기다리게 한 상담', s: '20분 넘김', u: '건', hi: '많아요', lo: '적어요', low: true, dec: true, v: function (p) { return p.lateN; }, has: function (p) { return p.perDay != null || p.lateN > 0; } },
    wait: { l: '고객 평균 대기', s: '평균 대기', u: '분', hi: '길어요', lo: '짧아요', low: true, v: function (p) { return p.wait; }, has: function (p) { return p.wait != null && p.ans >= 3; } },
    ans: { l: '답한 상담', s: '답한 상담', u: '건', hi: '많아요', lo: '적어요', low: false, v: function (p, M) { return M.oneDay ? p.ans : p.ansDay; }, has: function (p) { return p.ans > 0; } },
    rec: { l: '완료 기록(참고)', s: '완료 기록', u: '건', hi: '많아요', lo: '적어요', low: false, v: function (p, M) { return M.oneDay ? p.rec : p.perDay; }, has: function (p) { return p.perDay != null; } },
    // 2026-10-21 시간당(기록기가 켜져 있던 업무시간으로 나눔 · 주인: 주·월로 보면 운은 평균이 됨)
    aph: { l: '시간당 답한 고객', s: '시간당 답한 고객', u: '명', hi: '많아요', lo: '적어요', low: false, dec: true, v: function (p) { return p.ansPH; }, has: function (p) { return p.ansPH != null; } },
    rph: { l: '시간당 완료 기록(참고)', s: '시간당 완료 기록', u: '건', hi: '많아요', lo: '적어요', low: false, dec: true, v: function (p) { return p.recPH; }, has: function (p) { return p.recPH != null; } },
    wsum: { l: '고객을 기다리게 한 시간 합계', s: '기다리게 한 시간', u: '분', hi: '길어요', lo: '짧아요', low: true, v: function (p, M) { return M.oneDay ? p.wsum : p.work ? p.wsum / p.work : null; }, has: function (p) { return p.ans > 0; } }
  };
  // 2026-10-21 '운이 아니라 꾸준한 차이': 여러 날 중 60% 넘는 날이 다른 사람 평균보다 나쁘고(좋고) 차이가 20% 넘을 때만
  function dayVal(k, v) {
    if (!v) return null;
    if (k === 'late') return v.ans || v.rec || v.lateN ? v.lateN : null;
    if (k === 'wait') return v.ansN >= 3 ? v.wsum / v.ansN : null;
    if (k === 'ans') return v.ans > 0 ? v.ans : null;
    if (k === 'aph') return v.on >= 60 ? v.ans / (v.on / 60) : null;
    return null;
  }
  function steady(k, o, M) {
    var c = cmp(k, o, M); if (!c || M.oneDay || !c.bad) return null;
    var low = MET[k].low, n = 0, w = 0;
    M.keys.forEach(function (d) {
      var mv = dayVal(k, o.days[d]); if (mv == null) return;
      var ot = mean(M.people.filter(function (p) { return p !== o; }).map(function (p) { return dayVal(k, p.days[d]); })); if (ot == null) return;
      n++; var worse = low ? mv > ot : mv < ot, better = low ? mv < ot : mv > ot; if (c.bad > 0 ? worse : better) w++;
    });
    var big = c.pct == null ? Math.abs(c.d) >= 2 : c.pct >= 0.2;
    return n >= 3 && w / n >= 0.6 && big ? { n: n, w: w, bad: c.bad > 0 } : null;
  }
  function steadyTxt(st) { return st.bad ? '운이 아니라 꾸준한 차이예요 · 일한 ' + st.n + '일 중 ' + st.w + '일이 다른 사람 평균보다 나빴어요' : '꾸준히 잘했어요 · 일한 ' + st.n + '일 중 ' + st.w + '일이 다른 사람 평균보다 좋았어요'; }
  function cmp(k, o, M) {
    var m = MET[k], val = function (p) { return m.v(p, M); }, list = M.people.filter(function (p) { return m.has(p) && val(p) != null; });
    if (list.indexOf(o) < 0 || list.length < 2) return null;
    var v = val(o), avg = mean(list.filter(function (p) { return p !== o; }).map(val));
    var better = list.filter(function (p) { return m.low ? val(p) < v : val(p) > v; }).length, worse = list.filter(function (p) { return m.low ? val(p) > v : val(p) < v; }).length;
    var top = list.slice().sort(function (a, b) { return m.low ? val(a) - val(b) : val(b) - val(a); })[0];
    var d = v - avg, bad = m.low ? d : -d, small = m.dec ? Math.abs(d) < 0.5 : Math.abs(d) < 1 || (avg && Math.abs(d) / avg < 0.1);
    return { k: k, m: m, v: v, avg: avg, n: list.length, pos: better + 1, first: !better, last: !worse && better > 0, same: !better && !worse, best: val(top), bestN: top.n, bestMe: val(top) === v, d: d, bad: small ? 0 : bad > 0 ? 1 : -1, pct: avg ? Math.abs(d) / avg : null };
  }
  function numOf(c, v) { return (c.m.dec && v != null && Math.round(v) !== v ? f1(v) : n0(v)) + c.m.u; }
  // "5명 중 5등 (가장 적어요)"
  function rankTxt(c) {
    if (!c) return '';
    if (c.same) return c.n + '명 모두 같아요';
    return c.n + '명 중 ' + c.pos + '등' + (c.last ? ' (가장 ' + (c.m.low ? c.m.hi : c.m.lo) + ')' : c.first ? ' (가장 ' + (c.m.low ? c.m.lo : c.m.hi) + ')' : '');
  }
  // "다른 사람 평균보다 10건(40%) 적어요" · 적을수록 좋은 건 "3배 많아요"
  function gapTxt(c) {
    if (!c) return '';
    if (!c.bad) return '다른 사람 평균과 비슷해요';
    var ad = Math.abs(c.d), more = c.d > 0, t = '다른 사람 평균보다 ' + numOf(c, ad);
    if (c.m.low && more) return t + (c.avg >= 0.5 && c.v / c.avg >= 1.5 ? '(' + (c.v / c.avg).toFixed(1).replace(/\.0$/, '') + '배)' : '') + ' ' + c.m.hi;
    return t + (c.pct != null && c.pct >= 0.05 && c.v ? '(' + Math.round(c.pct * 100) + '%)' : '') + ' ' + (more ? c.m.hi : c.m.lo);
  }
  // 기간을 합치면 얼마나 차이 나나(답한 상담 · 여러 날)
  function totalTxt(c, o, M) {
    if (!c || c.k !== 'ans' || c.bad <= 0 || M.oneDay || o.work < 2) return '';
    return M.periodName + ' 근무 ' + o.work + '일을 합치면 다른 사람보다 ' + n0(Math.abs(c.d) * o.work) + '건 덜 응대했어요.';
  }
  function bestName(c, anon, who) { return c.bestMe ? who + ' 본인' : anon ? '1등 상담사' : c.bestN; }

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
  function numView(M, ctx) {
    var box = mk('div', 'tview'), avg = M.team, td = M.td;
    // 숫자 칸 4개
    var nowP = 0, now20 = 0, now20p = 0, part = 0; M.people.forEach(function (o) { if (!o.fresh) return; nowP += o.pend; now20 += o.over20; if (o.over20) now20p++; if (o.bad.length) part = 1; });
    var kp = mk('div', 'tkpi');
    var tile = function (lab, big, sub, cls) { var t = mk('div', 'tk' + (cls ? ' ' + cls : '')); t.append(mk('span', 'tkl', lab), mk('b', 'tkb', big)); if (sub) t.append(mk('span', 'tks', sub)); return t; };
    kp.append(tile('지금 기다리는 고객', nowP + (part ? '+' : '') + '명', part ? '연결이 끊긴 PC는 끊기기 전 기준' : '업무시간으로 셈(점심 빼고)'),
      tile('20분 넘게 방치 (지금)', now20 ? now20 + '건 · ' + now20p + '명' : '없음', '', now20 ? 'bad' : 'ok'),
      tile(M.periodName + ' 팀 답한 상담', avg.ans + '건', '완료 기록 ' + avg.rec + '건 (카톡 ' + avg.k + ' · 톡톡 ' + avg.nv + ' · 게시판 ' + avg.bd + ')' + (avg.redup + avg.redupP ? ' · 같은 고객 ' + (avg.redup + avg.redupP) + '건 뺌' : '')),
      tile('고객 평균 대기', avg.ansN ? n0(avg.wsum / avg.ansN) + '분' : '–', '답을 받기까지 · 업무시간으로 셈'));
    box.append(kp);
    // 2026-10-20 [숫자] 화면: 지금 급한 고객 · 챙길 사람 · 줄 세우기는 [지금] · [피드백] 화면으로 옮김
    var need = M.people.map(function (o) { return { o: o, f: flags(o, M, avg) }; }).filter(function (z) { return z.f.list.length; }).sort(function (a, b) { return b.f.score - a.f.score; });
    // 상담사별 표
    var tp = mk('div', 'tpanel'), ht = mk('div', 'tph'); ht.append(mk('b', null, '상담사별'), mk('span', 'muted', '챙길 사람 먼저 · 줄을 누르면 ' + (M.oneDay ? '하루 흐름' : '날짜별 건수')));
    var csv = btn('CSV 내려받기', 'ghost sm', function () { T2().chanCsv(M.days, (M.oneDay || td).slice(0, 7), td, T().person); }); csv.title = '그 달 날짜 × 상담사 × 채널(카톡 · 톡톡 · 게시판) 건수 · QA용'; ht.append(mk('span', 'sp'), csv);
    tp.append(ht, peopleTable(M, avg, need, ctx)); box.append(tp);
    // 게시판 사이트별(QA)
    var sd = mk('details', 'tdet'); sd.append(mk('summary', null, '게시판 구매처별 건수 · ' + M.periodName));
    var S = {}; M.people.concat([]).forEach(function () {}); M.keys.forEach(function (d) { var x = M.days[d] || {}; Object.keys(x).forEach(function (n) { var k = T().person(n), s2 = (x[n] || {}).sites || {}, t2 = S[k] || (S[k] = {}); Object.keys(s2).forEach(function (st) { t2[st] = (t2[st] || 0) + s2[st]; }); }); });
    sd.append(T2().siteTable(S, M.periodName)); if (store('kb:tdet') === '1') sd.open = true; sd.addEventListener('toggle', function () { store('kb:tdet', sd.open ? '1' : '0'); }); box.append(sd);
    box.append(catTable(M));
    box.append(mk('p', 'muted tfoot', '답한 상담 = 답한 고객 수(같은 고객은 한 주(월~금)에 1명 · 이번 달은 주마다 센 것을 더함, 기록기 2.4.17 · 팀 서버 1.3.10부터 · 그 전 날은 답한 횟수) · 처리 = 시트에 저장된 기록(같은 고객은 한 주(월~금)에 1건 · 이번 달은 주마다 더함, 팀 서버 1.3.10부터 · 다른 상담사와 같은 고객은 각자 1건, 팀 합계만 1건) · 시간당 = 그날 첫 기록~마지막 기록 사이(점심 빼고)로 나눔(반차·늦은 출근은 저절로 반영) · 20분 넘김 = 고객이 20분 넘게 기다린 뒤 답한 상담(업무시간) · 기록 안 함 = 지금 남아 있는 것(다른 상담사가 그날 기록했으면 빠짐) · 긴 통화·어려운 상담이 많은 날은 숫자가 낮게 나오니 하루 흐름과 같이 봐 주세요 · 기록기를 끈 시간과 다른 PC 기록은 안 잡혀요'));
    return box;
  }
  function peopleTable(M, avg, need, ctx) {
    var order = {}; need.forEach(function (z, i) { order[z.o.n] = i; });
    var ppl = M.people.slice().sort(function (a, b) { var x = order[a.n] != null ? order[a.n] : 99, y = order[b.n] != null ? order[b.n] : 99; return x - y || (b.perDay || 0) - (a.perDay || 0); });
    var multi = !M.oneDay, head = ['상담사', '지금 대기', '20분 넘겨 답함', '평균 대기'].concat(multi ? ['근무일', '답한 상담(하루)', '완료 기록(하루) · 참고'] : ['답한 상담', '완료 기록 · 참고'], ['어려운 상담', '카톡 · 톡톡 · 게시판', '시간당 완료', '기록 안 함(지금)'], M.oneDay ? ['30분+ 빈 때'] : [], ['연결', '']);
    var tb = mk('table', 'ttable tppl'), tr = mk('tr'); head.forEach(function (h) { tr.append(mk('th', null, h)); }); var th = mk('thead'); th.append(tr); tb.append(th);
    var bd = mk('tbody'), cols = head.length;
    var cell = function (row, main, w, cls, rk) { var td = mk('td', cls || null); td.append(mk('b', null, main)); if (w && w.t) { td.append(mk('br')); td.append(word({ c: w.c, t: w.t.replace(/^평균보다 (.+) 많음$/, '평균 +$1').replace(/^평균보다 (.+) 적음$/, '평균 −$1') })); } if (rk) { td.append(mk('br')); td.append(mk('span', 'trk ' + (rk.last ? 'r' : rk.first ? 'g' : 'm'), rk.pos + '등/' + rk.n + '명')); } row.append(td); return td; };
    ppl.forEach(function (o) {
      var f = flags(o, M, avg), lv = f.list.some(function (s) { return s.c === 'r'; }) ? 'bad' : f.list.length ? 'warn' : '';
      var row = mk('tr', 'tprow ' + lv + (openRow[o.n] ? ' open' : '')); row.tabIndex = 0;
      var nc = mk('td'); nc.append(mk('span', 'av', o.n.slice(0, 1)), mk('b', 'nm', o.n), mk('span', 'car', openRow[o.n] ? '▴' : '▾')); row.append(nc);
      var wc = mk('td'); wc.append(o.fresh ? String(o.pend) : '–'); if (o.over20) { wc.append(mk('br'), mk('span', 'tword r', '20분+ ' + o.over20)); } if (o.fresh && o.held) { wc.append(mk('br'), mk('span', 'tword m', '보류 ' + o.held)); }; if (!o.fresh) wc.title = o.x ? '기록기 꺼짐 · 마지막 신호 ' + ago(o.x.at) : '오늘 신호 없음'; row.append(wc);
      var lw = vs(o.lateN, avg.late, '건', true); cell(row, String(o.lateN), lw, lw.lv === 2 ? 'bad' : '', cmp('late', o, M)).title = o.lateMax && o.lateN ? '가장 오래 ' + o.lateMax + '분' : '';
      cell(row, o.wait != null ? n0(o.wait) + '분' : '–', vs(o.wait, avg.wait, '분', true), '', cmp('wait', o, M));
      var soft = function (w) { return w.c === 'r' || w.c === 'o' ? { t: w.t, c: 'm' } : w; };
      if (multi) { row.append(mk('td', null, o.work + '일')); cell(row, o.ans ? n0(o.ansDay) + '건' : '–', o.ans ? vs(o.ansDay, avg.ansDay, '건') : null, '', cmp('ans', o, M)).title = '고객 ' + o.ans + '명(같은 고객은 한 번) · 답한 횟수 ' + o.ansN + '번 (카톡 ' + o.ak + ' · 톡톡 ' + o.an + ')'; cell(row, o.perDay != null ? n0(o.perDay) + '건' : '–', soft(vs(o.perDay, avg.perDay, '건'))).title = '합계 ' + o.rec + '건' + (o.redup ? ' · 다른 날 같은 고객 ' + o.redup + '건은 뺌' : ''); }
      else { cell(row, o.ans + '건', soft(vs(o.ans, avg.ansDay, '건')), '', cmp('ans', o, M)).title = '고객 ' + o.ans + '명(같은 고객은 한 번) · 답한 횟수 ' + o.ansN + '번 (카톡 ' + o.ak + ' · 톡톡 ' + o.an + ')'; cell(row, o.rec + '건', soft(vs(o.perDay, avg.perDay, '건'))); }
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
  // 지금 기다리는 고객 · 보류 중(오늘 · 기록기 켜짐일 때) — 표 펼침 · [지금] 화면 칸 펼침에서 같이 씀
  function waitBlock(o) {
    var c1 = mk('div', 'pcol'), l1 = mk('div', 'plab'); l1.append(mk('span', null, '지금 기다리는 고객 '), mk('b', null, o.pend + '명'), mk('span', 'pr', o.bad.length ? '끊기기 전 기준' : '오래 기다린 순')); c1.append(l1);
    if (!o.pend) c1.append(mk('div', 'pnone', '기다리는 고객 없음'));
    else if (o.top) { var wl = mk('div', 'pwl'); o.top.forEach(function (t) { var r = mk('div', 'pw' + (t.w >= 20 ? ' r' : t.w >= 10 ? ' a' : '')), msg = mk('span', 'pmsg'); if (t.r) msg.append(mk('span', 'pre', '다시 옴')); msg.append(t.p || '(사진·파일 또는 내용 없음)'); msg.title = t.p || ''; r.append(mk('span', 'pmin', t.w + '분'), chip(t.ch), mk('span', 'pcn', t.n || '이름 없음'), link(t), msg); wl.append(r); }); if (o.pend > o.top.length) wl.append(mk('div', 'pmore', '+ ' + (o.pend - o.top.length) + '명 더 (덜 기다린 고객)')); c1.append(wl); }
    else c1.append(mk('div', 'pmore', o.pend + '명 · 가장 오래 ' + o.oldest + '분 · 고객 이름·메시지는 기록기 2.4.4부터 보여요'));
    // 2.4.15 보류해 둔 고객(최근 보류 순) — 패널 [보류]는 바로, 톡톡 보류 탭은 30초 안에 팀 서버로
    if (o.held) {
      var hl = mk('div', 'plab tholdl'); hl.append(mk('span', null, '보류 중 '), mk('b', null, o.held + '명'), mk('span', 'pr', '최근 보류 순')); c1.append(hl);
      if (o.hold && o.hold.length) { var hw = mk('div', 'pwl'); o.hold.forEach(function (t) { var r = mk('div', 'pw h'), msg = mk('span', 'pmsg'); msg.append(t.p || '(사진·파일 또는 내용 없음)'); msg.title = t.p || ''; r.append(mk('span', 'pmin', t.s ? '보류 탭' : t.at ? clock(t.at) : '보류'), chip(t.ch), mk('span', 'pcn', t.n || '이름 없음'), link(t), msg); hw.append(r); }); if (o.held > o.hold.length) hw.append(mk('div', 'pmore', '+ ' + (o.held - o.hold.length) + '명 더')); c1.append(hw); }
      else c1.append(mk('div', 'pmore', '보류한 고객 이름·메시지는 기록기 2.4.15 · 팀 서버 1.3.9부터 보여요'));
    }
    return c1;
  }
  function rowDetail(o, M) {
    var box = mk('div', 'tpd');
    if (M.oneDay) {
      var v = o.days[M.oneDay] || { fl: T2().flowOf([]) }, fl = v.fl, lab = mk('div', 'plab');
      lab.append(mk('span', null, o.n + ' · ' + M.periodName + ' 흐름'), mk('span', 'pr', fl.n ? hhmm(fl.first) + ' – ' + hhmm(fl.last) + ' · 기록 ' + fl.n + '건 · 기록 사이 ' + (fl.med || 0) + '분' : '기록 시각 없음'));
      box.append(lab, mk('div', 'tflow', flowLine(fl)), catChips(o.cats, o.catN));
      if (M.isToday && o.fresh) {
        var g = mk('div', 'tpd2'), c1 = waitBlock(o);
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

  /* ───── 2026-10-21 새 면담 화면(주인: 상담사가 억울해하지 않고 반박에 바로 답하는 화면)
     원칙: 기록이 아니라 고객 쪽에서 일어난 일로 봄(기다린 시간 · 답한 고객) · 근거는 줄마다 [열기] · 맞는 반박은 [빼기]로 바로 숫자에서 뺌
     위: 한 줄 결론 → 큰 숫자 셋(등수 · 다른 사람 평균 · 1등) → 시간당 비교 → 근거 목록 → 이런 말이 나오면 → 참고(완료 기록) → [자세히 보기](예전 화면) ───── */
  var ivPick = {};
  function interviewNew(M, who, ctx) {
    var o = M.people.filter(function (p) { return p.n === who; })[0], box = mk('div', 'tview tiv tiv2');
    if (!o) { box.append(mk('div', 'empty', who + ' 님의 숫자가 이 기간에 없어요.')); return box; }
    var av = others(M, who), anon = store('kb:anon') !== '0', multi = !M.oneDay, pn = M.periodName;
    var nameOf = function (n) { return n === who ? who : anon ? '다른 상담사' : n; };
    var cL = cmp('late', o, M), cW = cmp('wait', o, M), cA = cmp('ans', o, M), cH = cmp('aph', o, M), cR = cmp('rec', o, M), cP = cmp('rph', o, M), cS = cmp('wsum', o, M);
    var aDay = function (v) { return multi ? '하루 ' + n0(v) : n0(v); };
    // 한 줄 결론: 가장 크게 뒤처진 것 하나
    var worst = [cL, cW, cA, cH].filter(function (c) { return c && c.bad > 0; }).sort(function (a, b) { return (b.pct == null ? 9 : b.pct) - (a.pct == null ? 9 : a.pct); })[0];
    var vd = mk('div', 'tivv' + (worst ? ' r' : ' ok'));
    if (!worst) vd.append(who + ' 님은 ' + pn + ' ', mk('b', null, '기다리게 한 시간 · 답한 고객 모두 다른 사람 평균만큼 하거나 더 잘했어요.'));
    else {
      var wl = { late: ['고객을 20분 넘게 기다리게 한 게 ', o.lateN + '명', '명'], wait: ['고객 평균 대기가 ', n0(o.wait) + '분', '분'], ans: [(multi ? '하루 ' : '') + '답한 고객이 ', n0(cA && cA.v) + '명', '명'], aph: ['시간당 답한 고객이 ', f1(o.ansPH) + '명', '명'] }[worst.k];
      vd.append(who + ' 님은 ' + pn + ' ' + wl[0], mk('b', null, wl[1] + '으로 ' + worst.n + '명 중 ' + worst.pos + '등'), '이에요. 다른 사람 평균은 ' + (worst.m.dec || worst.k === 'aph' ? f1(worst.avg) : n0(worst.avg)) + wl[2] + '이에요.');
      var st0 = steady(worst.k, o, M); if (st0) vd.append(mk('div', 'tsteady r', steadyTxt(st0)));
    }
    box.append(vd);
    // 큰 숫자 셋
    var big = mk('div', 'tbig3');
    var cell = function (title, val, unit, c, k, note) {
      var bad = c && c.bad > 0, good = c && c.bad < 0, d = mk('div', 'tbg' + (bad ? ' r' : good ? ' g' : ''));
      d.append(mk('div', 'tbgt', title)); var b = mk('div', 'tbgn'); b.append(val, mk('small', null, unit)); d.append(b);
      d.append(mk('div', 'tbgr', c ? (c.same ? c.n + '명 모두 같아요' : c.n + '명 중 ' + c.pos + '등') : '비교할 사람이 없어요'));
      var nm = function (v) { var t = numOf(c, v); return unit === '명' ? t.replace(/건$/, '명') : t; };
      if (c) d.append(mk('div', 'tbgs', '다른 사람 평균 ' + nm(c.avg) + ' · 1등 ' + nm(c.best) + (c.bestMe ? '(본인)' : '')));
      if (note) d.append(mk('div', 'tbgs', note));
      var st = k && steady(k, o, M); if (st) d.append(mk('div', 'tsteady' + (st.bad ? ' r' : ' g'), steadyTxt(st)));
      return d;
    };
    big.append(cell('20분 넘게 기다린 고객', String(o.lateN), '명', cL, 'late', o.lateX ? '뺀 ' + o.lateX + '건은 안 셈' : ''));
    big.append(cell('고객 평균 대기', o.wait != null ? n0(o.wait) : '–', '분', cW, 'wait'));
    big.append(cell('답한 고객 (기록과 상관없이)', o.ans ? aDay(cA ? cA.v : o.ans) : '–', '명', cA, 'ans', o.mvIn ? '다른 사람 고객에게 대신 답한 ' + o.mvIn + '명 포함' : ''));
    box.append(big);
    // 시간당 비교(기록기가 켜져 있던 시간으로 나눔)
    var hp = mk('div', 'tpanel tph4'), hh = mk('div', 'tph'); hh.append(mk('b', null, '시간당으로 보면'), mk('span', 'muted', '기록기가 켜져 있던 업무시간으로 나눠요 · 늦게 켠 날 · 반차도 공평하게')); hp.append(hh);
    if (o.on == null) hp.append(mk('div', 'pnone', '켜진 시간은 팀 서버 1.3.12부터 모여요. 그 전 날은 시간당으로 비교하지 않아요.'));
    else if (o.on < 60) hp.append(mk('div', 'pnone', '기록기가 켜져 있던 업무시간이 1시간이 안 돼 아직 시간당으로 비교하지 않아요(지금 ' + hm(Math.round(o.on)) + ').'));
    else {
      var rows = [[cH, '시간당 답한 고객', o.ansPH], [cS, multi ? '기다리게 한 시간 합계(하루)' : '기다리게 한 시간 합계', cS ? cS.v : null], [cP, '시간당 완료 기록(참고)', o.recPH]];
      var hl = mk('div', 'tphl');
      rows.forEach(function (r) {
        var c = r[0], line = mk('div', 'tphr' + (c && c.bad > 0 && c.k !== 'rph' ? ' r' : c && c.bad < 0 ? ' g' : ''));
        line.append(mk('span', 'tphk', r[1]), mk('b', 'tphv', r[2] == null ? '–' : c ? numOf(c, r[2]) : f1(r[2])), mk('span', 'tphc', c ? rankTxt(c) + ' · ' + gapTxt(c) : '비교할 사람이 없어요'));
        hl.append(line);
      });
      var onL = mk('div', 'tphr'); onL.append(mk('span', 'tphk', '기록기 켜진 시간'), mk('b', 'tphv', hm(Math.round(o.on))), mk('span', 'tphc', '업무시간 중 꺼져 있던 시간 ' + hm(Math.round(o.off)) + (multi ? ' (' + o.onDays + '일)' : ''))); hl.append(onL);
      hp.append(hl);
      if (cS) hp.append(mk('p', 'muted tfoot', '기다리게 한 시간 합계는 답한 고객이 많으면 같이 늘어요. 평균 대기와 같이 봐 주세요.'));
    }
    box.append(hp);
    // 근거: 20분 넘게 기다린 고객
    var ep = mk('div', 'tpanel tevd'), eh = mk('div', 'tph'); eh.append(mk('span', 'tdot r'), mk('b', null, '근거: 20분 넘게 기다린 고객 ' + o.lateN + '명'), mk('span', 'muted', '[열기]로 대화를 같이 보고, 상담사 말이 맞으면 [빼기] → 숫자에서 바로 빠져요')); ep.append(eh);
    var list = o.late.slice().sort(function (a, b) { return (a.skip ? 1 : 0) - (b.skip ? 1 : 0) || (b.w || 0) - (a.w || 0); });
    if (!list.length) ep.append(mk('div', 'pnone', o.lateN ? '상담 목록은 기록기 2.4.0부터 보여요(숫자만 있음)' : '20분 넘게 기다린 고객이 없어요 ✓'));
    else {
      var t = mk('table', 'ttable tevt'), th = mk('thead'), hr = mk('tr'); ['답한 때', '채널', '기다린 시간', '누가 답했나', ''].forEach(function (h) { hr.append(mk('th', null, h)); }); th.append(hr); t.append(th);
      var tb = mk('tbody');
      list.slice(0, 40).forEach(function (z) {
        var key = z.d + '|' + z.ch + ':' + z.id, tr = mk('tr', z.skip ? 'tx' : ''), byT = z.by === undefined ? '–' : z.by ? nameOf(z.by) : '확인 못 함';
        var c1 = mk('td'); c1.append(chip(z.ch)); var c3 = mk('td'); c3.append(mk('span', z.by && z.by !== who ? 'tword m' : null, byT)); if (z.by === undefined) c3.title = '누가 답했는지는 기록기 2.4.22부터 보여요';
        var act = mk('td', 'tevact');
        if (z.skip) { act.append(mk('span', 'tword m', '뺌 · ' + z.skip)); if (z.mine) act.append(btn('되돌리기', 'ghost sm', function () { skipSet(key, null); delete ivPick[key]; ctx.again(); })); }
        else if (ivPick[key]) { act.append(mk('span', 'muted', '이유:')); SKIP_WHY.forEach(function (r) { act.append(btn(r, 'ghost sm', function () { skipSet(key, { r: r, at: Date.now() }); delete ivPick[key]; ctx.again(); })); }); act.append(btn('취소', 'ghost sm', function () { delete ivPick[key]; ctx.again(); })); }
        else act.append(link(z), btn('빼기', 'ghost sm', function () { ivPick[key] = 1; ctx.again(); }));
        tr.append(mk('td', null, md(z.d) + ' ' + clock(z.at)), c1, mk('td', z.skip ? null : 'bad', (z.w || 0) + '분'), c3, act); tb.append(tr);
      });
      t.append(tb); var wrap = mk('div', 'twrap'); wrap.append(t); ep.append(wrap);
      ep.append(mk('p', 'muted tfoot', '빼기 이유: ' + SKIP_WHY.join(' · ') + '. 뺀 건은 줄을 그어 남겨 두고 언제든 [되돌리기]로 돌려요. 뺀 기록은 이 PC에만 남아요. 다른 상담사가 답한 건(기록기 2.4.22부터)은 저절로 빠져요. 고객 이름은 이 화면에 나오지 않아요.'));
    }
    box.append(ep);
    // 이런 말이 나오면: 자주 나오는 반박마다 그 사람 숫자로 미리 답해 둠
    var op = mk('div', 'tpanel tobj'), oh = mk('div', 'tph'); oh.append(mk('b', null, '이런 말이 나오면'), mk('span', 'muted', '자주 나오는 말마다 화면이 숫자로 미리 답해 둬요')); op.append(oh);
    var grid = mk('div', 'tobjg'), card = function (q, a, tone) { var c = mk('div', 'tobjc' + (tone ? ' ' + tone : '')); c.append(mk('b', 'tobjq', '“' + q + '”'), mk('div', 'tobja', a)); grid.append(c); };
    card('기록 안 된 상담이 많았어요', '이 화면은 기록 수로 비교하지 않아요. 답한 고객 ' + (o.ans ? aDay(cA ? cA.v : o.ans) + '명' : '숫자 없음') + '은 기록과 상관없이 셌고' + (cA ? ' ' + rankTxt(cA) : '') + '이에요. ' + (cL && cL.bad > 0 ? '문제는 답한 양이 아니라 기다리게 한 시간이에요.' : cA && cA.bad > 0 ? '기록이 아니라 답한 고객 자체가 ' + gapTxt(cA).replace('다른 사람 평균보다 ', '다른 사람보다 ') + '.' : ''));
    var hard = hardHigh(o, av);
    card('어려운 상담이 몰렸어요', o.catN ? HARD_LABEL + '이 ' + pct(o.hardPct) + '예요. 다른 사람은 ' + pct(av.hardPct) + (hard ? '라 많았어요. 참작할게요.' : av.hardPct == null ? '(비교할 기록이 아직 없어요).' : '라 비슷해요.') : '이 기간 카테고리 기록이 없어요(기록기 2.4.15부터).', hard ? 'ok' : '');
    // 같은 날 같은 시간대(앞뒤 1시간) 다른 사람의 20분 넘김
    var mine = o.late.filter(function (z) { return !z.skip && z.at; }), busy = null;
    if (mine.length) {
      busy = mean(mine.map(function (z) {
        var ps = M.people.filter(function (p) { return p !== o && p.days[z.d] && (p.days[z.d].ans || p.days[z.d].rec); }); if (!ps.length) return null;
        return ps.reduce(function (s2, p) { return s2 + p.days[z.d].late.filter(function (y) { return !y.skip && y.at && Math.abs(y.at - z.at) <= 3600e3; }).length; }, 0) / ps.length;
      }));
    }
    card('그날 유난히 바빴어요', !mine.length ? '20분 넘게 기다린 고객 목록이 없어요.' : busy == null ? '그 시간에 일한 다른 사람 기록이 없어 비교를 못 해요.' : who + ' 님이 20분 넘긴 때와 같은 날 같은 시간대(앞뒤 1시간)에 다른 사람은 20분 넘김이 평균 ' + f1(busy) + '건이었어요. ' + (busy >= 1 ? '그 시간대는 다 같이 바빴어요. 참작할 만해요.' : '같은 조건에서 다른 사람은 거의 없었어요.'), busy != null && busy >= 1 ? 'ok' : '');
    card('제가 아니라 다른 사람이 답했어요', o.hasSd ? '어느 PC에서 답을 보냈는지로 봐요. 다른 상담사가 답한 ' + o.lateBy + '건은 저절로 빠졌어요.' + (o.mvOut ? ' 답한 고객도 실제로 답한 사람에게 옮겼어요(' + o.mvOut + '명).' : '') + ' 목록의 ‘누가 답했나’ 칸에서 확인해요.' : '‘누가 답했나’는 기록기 2.4.22부터 저절로 가려져요. 지금은 [열기]로 보고 맞으면 [빼기]를 눌러 주세요.');
    card('기록기가 꺼져 있었어요', o.on == null ? '켜진 시간은 팀 서버 1.3.12부터 모여요.' : pn + ' 업무시간 중 기록기가 꺼져 있던 시간은 ' + hm(Math.round(o.off)) + '예요. 꺼진 동안의 일은 숫자에 안 들어가서, 켜진 시간으로 나눈 시간당으로도 비교해요' + (cH ? ': 시간당 답한 고객 ' + f1(o.ansPH) + '명, ' + rankTxt(cH) + '.' : '.'), '');
    var pcs = mean(M.people.filter(function (p) { return p !== o; }).map(function (p) { return p.perCust; }));
    card('길게 주고받는 고객이 많았어요', o.perCust == null || pcs == null ? '비교할 만큼 답한 기록이 아직 없어요.' : '고객 1명당 답한 횟수 ' + f1(o.perCust) + '번 · 다른 사람 ' + f1(pcs) + '번이라 ' + (o.perCust >= pcs * 1.3 ? '길게 주고받은 고객이 많았어요. 참작할 만해요.' : '비슷해요.'), o.perCust != null && pcs != null && o.perCust >= pcs * 1.3 ? 'ok' : '');
    op.append(grid); box.append(op);
    // 참고: 완료 기록
    box.append(mk('p', 'tivref', '참고 · 완료 기록 ' + (multi ? '하루 ' + n0(o.perDay) : String(o.rec)) + '건 (다른 사람 평균 ' + (cR ? numOf(cR, cR.avg) : '–') + '). 기록은 상담이 끝나야 늘어서 비교에 쓰지 않아요.' + (o.missN ? ' 답했는데 기록 안 한 상담이 지금 ' + o.missN + '건 있어요.' : '')));
    // 예전 면담 화면은 접어 둠
    var more = mk('details', 'tdet tivmore'); more.append(mk('summary', null, '자세히 보기 (성적표 · 날짜별 · 하루 흐름 · 기록 안 한 상담)')); more.append(interview(M, who, ctx, true)); box.append(more);
    return box;
  }

  /* ───── 면담 화면: 한 사람만 · 다른 사람 평균과 나란히 · 말할 거리 ───── */
  var fDay = {};
  function interview(M, who, ctx, more) {
    var o = M.people.filter(function (p) { return p.n === who; })[0], box = mk('div', 'tview tiv');
    if (!o) { box.append(mk('div', 'empty', who + ' 님의 숫자가 이 기간에 없어요.')); return box; }
    var av = others(M, who), anon = store('kb:anon') !== '0', label = function (n) { return n === who ? n : anon ? '다른 상담사' : n; };
    var multi = !M.oneDay, flg = flags(o, M, av).list;
    // 위 세 칸
    var hero = mk('div', 'thero');
    var card = function (title, badTitle, big, unit, me, oth, meL, othL, sayT, bad, cls) {
      var c = mk('div', 'thc' + (bad ? ' bad' : '')); c.append(mk('div', 'thct', bad ? badTitle : title));
      var b = mk('div', 'thcb' + (bad ? ' r' : cls ? ' ' + cls : '')); b.append(big, mk('small', null, unit)); c.append(b);
      c.append(mk('div', 'thtx', meL), mk('div', 'thtx o', othL), mk('div', 'thsay' + (bad ? ' r' : ' ok'), sayT)); return c;
    };
    var cL = cmp('late', o, M), cW = cmp('wait', o, M), cA = cmp('ans', o, M), cR = cmp('rec', o, M);
    var l1 = av.late, lb = o.lateN >= 2 && l1 != null && o.lateN >= l1 * 1.5;
    hero.append(card('고객을 20분 넘게 기다리게 한 상담', '① 고객을 오래 기다리게 했어요', String(o.lateN), '건 · 20분 넘게 기다린 뒤 답함', o.lateN, l1, o.n + ' · ' + o.lateN + '건', '다른 사람 평균 · ' + f1(l1) + '건',
      (!o.lateN ? '20분 넘게 기다리게 한 상담이 없어요.' : lb ? (l1 ? '다른 사람보다 ' + (o.lateN / Math.max(0.5, l1)).toFixed(1).replace(/\.0$/, '') + '배 많아요. ' : '') + (o.lateMax ? '가장 오래 기다린 고객 ' + o.lateMax + '분.' : '') : cL && cL.bad > 0 ? gapTxt(cL) + '.' : '다른 사람과 비슷해요.') + (cL && (cL.bad || cL.same) ? ' ' + rankTxt(cL) + '.' : ''), lb));
    // ② 응대: 답한 상담(주) · 완료 기록(참고) — 응대는 비슷한데 완료만 적으면 긴 상담이 많았던 것
    var aa = vs(o.ansDay, av.ansDay, '건'), pd = vs(o.perDay, av.perDay, '건');
    var aBad = multi && aa.lv === 2, aSay = !o.ans ? '답한 상담 숫자가 아직 없어요(게시판만 했거나 기록기 2.4.0 전).' : aa.lv > 0 ? (multi ? '하루에 ' : '') + n0(av.ansDay - o.ansDay) + '건 덜 응대했어요.' + (cA ? ' ' + rankTxt(cA) + '.' : '') : aa.c === 'g' ? '다른 사람보다 ' + n0(o.ansDay - av.ansDay) + '건 더 응대했어요.' : '응대 횟수는 다른 사람과 비슷해요.';
    if (o.ans && aa.lv <= 0 && pd.lv > 0) aSay += ' 완료 기록은 ' + n0(av.perDay - o.perDay) + '건 적어요 — 길게 주고받는 상담이 많았을 수 있어요.';
    hero.append(card('응대한 상담', '② 응대한 상담이 적어요', multi ? '하루 ' + n0(o.ansDay) : String(o.ans), '건 답함 · 완료 기록 ' + (multi ? '하루 ' + n0(o.perDay) : o.rec) + '건', o.ansDay, av.ansDay, o.n + ' · 답한 상담 ' + (multi ? '하루 ' : '') + n0(o.ansDay) + '건', '다른 사람 평균 · ' + (multi ? '하루 ' : '') + n0(av.ansDay) + '건', aSay, aBad));
    var mb = o.missN >= 2 && (av.miss == null || o.missN > av.miss);
    hero.append(card('답했는데 기록 안 한 상담', '③ 기록을 안 한 상담이 있어요', String(o.missN), '건 · 지금 남아 있음', o.missN, av.miss, o.n + ' · ' + o.missN + '건', '다른 사람 평균 · ' + f1(av.miss) + '건', o.missN ? '아래 목록에서 하나씩 열어 볼 수 있어요.' : '빠진 기록이 없어요.', mb, o.missN ? 'o' : ''));
    if (!more) box.append(hero);
    // 2026-10-20 성적표: 나 · 다른 사람 평균 · 팀에서 가장 좋은 기록 · 등수 · 차이(같은 기간 · 같은 기준)
    var cs = [cL, cW, cA, cR].filter(Boolean);
    if (cs.length) {
      var sp = mk('div', 'tpanel tscore'), sh = mk('div', 'tph'); sh.append(mk('b', null, M.periodName + ' 성적표'), mk('span', 'muted', '같은 기간 · 같은 기준 · 본인을 뺀 다른 사람 평균')); sp.append(sh);
      var low = cs.filter(function (c) { return c.k !== 'rec' && c.bad > 0; }), good = cs.filter(function (c) { return c.k !== 'rec' && c.bad < 0; });
      var hl = mk('div', 'tshead' + (low.length ? ' r' : ' ok'));
      hl.textContent = low.length ? who + ' 님은 ' + M.periodName + ' ' + low.map(function (c) { return c.m.s + ' ' + c.n + '명 중 ' + c.pos + '등'; }).join(', ') + '이에요.' : who + ' 님은 ' + M.periodName + ' 모든 항목이 다른 사람 평균만큼 하거나 더 잘했어요.';
      sp.append(hl);
      var lines = mk('div', 'tslines');
      low.forEach(function (c) { lines.append(mk('div', 'tword r', c.m.l + ': ' + numOf(c, c.v) + ' · ' + gapTxt(c) + ' · 가장 좋은 기록은 ' + numOf(c, c.best) + '(' + bestName(c, anon, who) + ')')); });
      var tt = totalTxt(cA, o, M); if (tt) lines.append(mk('div', 'tword r', tt));
      if (cL && cL.bad > 0 && cL.avg != null) { var less = Math.round(o.lateN - cL.avg); if (less >= 1) lines.append(mk('div', 'tword r', '다른 사람만큼만 했다면 20분 넘게 기다린 고객이 ' + less + '명 적었어요.')); }
      good.forEach(function (c) { lines.append(mk('div', 'tword g', '잘한 점 · ' + c.m.l + ': ' + gapTxt(c) + ' (' + rankTxt(c) + ')')); });
      if (lines.childNodes.length) sp.append(lines);
      sp.append(T2().table(['항목', who, '다른 사람 평균', '팀에서 가장 좋은 기록', '등수', '차이'], cs.map(function (c) {
        var lab = c.m.l + (M.oneDay || c.k === 'late' || c.k === 'wait' ? '' : ' (하루)');
        return { cls: c.bad > 0 && c.k !== 'rec' ? 'bad' : '', cells: [lab, { text: numOf(c, c.v), cls: c.bad > 0 && c.k !== 'rec' ? 'bad' : '' }, numOf(c, c.avg), numOf(c, c.best) + ' · ' + bestName(c, anon, who), { text: c.pos + '등 / ' + c.n + '명', cls: c.last && c.k !== 'rec' ? 'bad' : '' }, { text: gapTxt(c).replace('다른 사람 평균보다 ', '').replace('다른 사람 평균과 ', ''), cls: c.bad > 0 && c.k !== 'rec' ? 'bad' : c.bad < 0 ? 'good' : '' }] };
      }), 'tsct'));
      sp.append(mk('p', 'muted tfoot', '1등 = 가장 좋은 기록(20분 넘김 · 평균 대기는 적을수록, 답한 상담은 많을수록) · 같은 숫자는 같은 등수 · 완료 기록은 상담이 끝나야 남아서 참고로만'));
      box.append(sp);
    }
    // 날짜별(여러 날) · 시간대별(하루): 나 vs 다른 사람 평균
    var g2 = mk('div', 'tg2'), pc = mk('div', 'tpanel'), ph = mk('div', 'tph');
    ph.append(mk('b', null, multi ? '날짜별 답한 상담' : '시간대별 완료 기록'), mk('span', 'muted', o.n + ' · 다른 사람 평균')); pc.append(ph);
    var groups = [];
    if (multi) M.keys.forEach(function (d) { var od = o.days[d] || {}; if (!W.day(d, M.wcfg) && !od.ans) return; if (d > M.td) return; var oth = mean(M.people.filter(function (p) { return p.n !== who && ((p.days[d] || {}).ans || 0) > 0; }).map(function (p) { return p.days[d].ans; })); var dl = M.people.filter(function (p) { return ((p.days[d] || {}).ans || 0) > 0; }).map(function (p) { return p.days[d].ans; }), dpos = od.ans ? dl.filter(function (v) { return v > od.ans; }).length + 1 : 0; groups.push({ l: Number(d.slice(8)) + '일 ' + WD[W.weekday(d)], a: od.ans || 0, b: oth, sub: '완료 ' + (od.rec || 0), rk: dpos && dl.length >= 2 ? dpos + '등/' + dl.length + '명' : '–', last: dpos && dl.length >= 2 && dpos === dl.length }); });
    else { var fl0 = (o.days[M.oneDay] || {}).fl || { hours: {} }, wd0 = W.day(M.oneDay, M.wcfg), hi0 = Math.ceil((wd0 ? wd0.workEnd : 19 * 60) / 60) - 1;
      for (var h = 10; h <= hi0; h++) { var oth2 = mean(M.people.filter(function (p) { return p.n !== who && ((p.days[M.oneDay] || {}).fl || {}).n; }).map(function (p) { return p.days[M.oneDay].fl.hours[h] || 0; })); groups.push({ l: h === 13 ? '점심' : h + '시', a: (fl0.hours || {})[h] || 0, b: oth2 }); } }
    var dif = function (g) { if (g.b == null) return { text: '–' }; var d = Math.round(g.a - g.b); return { text: d > 0 ? '+' + d : d < 0 ? '−' + (-d) : '같음', cls: g.a < g.b * 0.75 ? 'bad' : d > 0 ? 'good' : '' }; };
    var gt = T2().table([multi ? '날짜' : '시간', o.n, '다른 사람 평균', '차이'].concat(multi ? ['그날 등수', '완료 기록'] : []), groups.map(function (g) { return { cells: [g.l, { text: String(g.a), cls: g.b != null && g.a < g.b * 0.75 ? 'bad' : '' }, g.b != null ? n0(g.b) : '–', dif(g)].concat(multi ? [{ text: g.rk, cls: g.last ? 'bad' : '' }, String(g.sub || '').replace(/^완료 /, '')] : []) }; }), 'tgt');
    pc.append(groups.length ? gt : mk('div', 'pnone', '이 기간 기록이 없어요'));
    pc.append(mk('p', 'muted tfoot', '빨간 숫자 = 다른 사람 평균의 4분의 3보다 적음'));
    g2.append(pc);
    var rp = mk('div', 'tpanel'), rh = mk('div', 'tph'); rh.append(mk('b', null, '억울하지 않게 확인한 것'), mk('span', 'muted', '숫자가 낮게 나올 사정이 있었나'));
    rp.append(rh);
    var rt = mk('div', 'note tnote');
    if (o.perCase != null && av.perCase != null) rt.append(mk('div', null, '상담 1건당 답한 횟수: ' + f1(o.perCase) + '번 (다른 사람 ' + f1(av.perCase) + '번) · ' + (o.perCase >= av.perCase * 1.3 ? '길게 주고받은 상담이 많았어요.' : '다른 사람과 비슷해요.')));
    if (rt.childNodes.length) rp.append(rt);
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
      var fp = mk('div', 'tpanel'), fh = mk('div', 'tph'); fh.append(mk('b', null, '하루 흐름 · ' + md(cur)), mk('span', 'muted', multi ? '이 기간 가장 적게 처리한 날부터 · 날짜를 누르면 바뀜' : '30분 넘게 기록이 없던 때를 시각으로 적어요(점심 빼고)'));
      fp.append(fh);
      if (multi) { var dn = mk('div', 'ins bper'); wdays.forEach(function (d) { var b = mk('button', d === cur ? 'on' : null, WD[W.weekday(d)] + ' ' + Number(d.slice(8)) + '일 · ' + o.days[d].rec + '건'); b.type = 'button'; b.addEventListener('click', function () { fDay[key] = d; ctx.again(); }); dn.append(b); }); fp.append(dn); }
      var fl = o.days[cur].fl, gsum = fl.long.reduce(function (s, z) { return s + z[2]; }, 0);
      fp.append(mk('div', 'tflow', flowLine(fl)));
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
    if (lb) talk.push('20분 넘게 기다린 고객이 ' + o.lateN + '건이에요(다른 사람 평균 ' + f1(l1) + '건' + (cL ? ' · ' + rankTxt(cL) : '') + '). 패널 위쪽, 오래 기다린 고객부터 먼저 답해 주세요.');
    if (aBad) talk.push('하루 평균 답한 상담이 ' + n0(o.ansDay) + '건으로 다른 사람보다 ' + n0(av.ansDay - o.ansDay) + '건 적어요' + (cA ? '(' + rankTxt(cA) + ')' : '') + '. ' + (totalTxt(cA, o, M) ? totalTxt(cA, o, M) + ' ' : '') + '하루 목표는 다른 사람 평균인 ' + n0(av.ansDay) + '건이에요.' + (wdays.length ? ' 하루 흐름에서 비는 시간을 같이 봐요.' : ''));
    else if (o.wait != null && av.wait != null && o.wait >= av.wait * 1.5 && o.ans >= 5) talk.push('고객이 답을 받기까지 평균 ' + n0(o.wait) + '분 기다렸어요(다른 사람 ' + n0(av.wait) + '분). 진행 중 고객부터 먼저 답해 주세요.');
    if ((aBad || lb) && hardHigh(o, av)) talk.push('다만 어려운 상담(' + HARD_LABEL + ')이 ' + pct(o.hardPct) + '로 다른 사람(' + pct(av.hardPct) + ')보다 많았어요. 이 점은 참작해요.');
    if (o.missN) talk.push('답하고 기록 안 한 상담 ' + o.missN + '건, 지금 열어서 기록해 주세요.');
    var th = mk('div', 'tph'); th.append(mk('b', null, '말할 거리'), mk('span', 'muted', '화면이 자동으로 정리'));
    var tn = mk('div', 'note tnote'); if (!talk.length) tn.textContent = '이 기간엔 특별히 말할 거리가 없어요.'; talk.forEach(function (t, i) { tn.append(mk('div', null, (i + 1) + '. ' + t)); });
    mp.append(th, tn);
    g3.append(lp, mp); box.append(g3);
    box.append(mk('p', 'muted tfoot', '공정하게 보려고: 시간당은 그날 첫 기록~마지막 기록 사이(점심 빼고)로 나눠서 반차·늦은 출근은 저절로 반영돼요. 긴 통화·어려운 상담이 있던 날은 하루 흐름에서 같이 확인해 주세요. 기록기를 끈 시간과 다른 PC 기록은 안 잡혀요. 고객 이름은 이 화면에 나오지 않아요.'));
    if (!flg.length && !more) box.insertBefore(mk('div', 'tok', o.n + ' 님은 ' + M.periodName + ' 챙길 것이 없어요.'), hero);
    return box;
  }

  /* ───── 2026-10-20 완성판(주인: 그래프 없이 문장·글로 · 시안 넷의 장점 합침) ─────
     [지금] 놓치는 고객이 있나: 사람 칸(기다림 · 가장 오래 · 연결) + 20분 넘은 고객(마지막 말 · 열기) — 판단 없음
     [피드백] 누구와 무슨 이야기를 하나: 이야기할 것(근거 · 억울하지 않은지 화면이 먼저 확인 · 한 줄 정리) + 모두 한 줄씩(신호등 · 숫자 셋)
     [숫자] QA 표 · 구매처 · 카테고리 · CSV(예전 표 그대로) */
  var HEAD = { late: '고객을 오래 기다리게 했어요', wait: '고객 평균 대기가 길어요', ans: '응대한 상담이 적어요', miss: '답하고 기록 안 한 상담이 남아 있어요' };
  function flowLine(fl) {
    if (!fl || !fl.n) return '기록 시각 없음';
    var s = hhmm(fl.first) + '–' + hhmm(fl.last) + ' · 기록 ' + fl.n + '건';
    if (fl.n < 2) return s;
    return s + (fl.long.length ? ' · 30분 넘게 기록 없던 때 ' + fl.long.length + '번(' + fl.long.map(function (z) { return hhmm(z[0]) + '~' + hhmm(z[1]) + ' ' + z[2] + '분'; }).join(', ') + ')' : ' · 30분 넘게 빈 때 없음');
  }
  function catLine(cats) { return catList(cats).slice(0, 8).map(function (x) { return x.c + ' ' + x.n; }).join(' · '); }
  function tline(k, v, cls) { var r = mk('div', 'ttk' + (cls ? ' ' + cls : '')); r.append(mk('span', 'k', k), mk('span', null, v)); return r; }
  // 근거 문장(다른 사람 평균과 같이)
  function evOf(z, o, av, M) {
    var c = M && MET[z.k] ? cmp(z.k, o, M) : null, tail = c ? ' · ' + rankTxt(c) : '';
    if (z.k === 'late') return '20분 넘게 기다린 뒤 답한 상담 ' + o.lateN + '건 · 다른 사람 평균 ' + f1(av.late) + '건' + tail + (o.lateMax ? ' · 가장 오래 ' + o.lateMax + '분' : '');
    if (z.k === 'wait') return '고객 평균 대기 ' + n0(o.wait) + '분 · 다른 사람 평균 ' + n0(av.wait) + '분' + tail;
    if (z.k === 'ans') return '하루 평균 답한 상담 ' + n0(o.ansDay) + '건 · 다른 사람 평균 ' + n0(av.ansDay) + '건' + (c && c.pct != null ? '(' + Math.round(c.pct * 100) + '% 적음)' : '') + tail;
    if (z.k === 'miss') return '답하고 기록 안 한 상담 ' + o.missN + '건 (지금 남아 있음)';
    return z.t;
  }
  // 억울하지 않게 화면이 먼저 확인한 것: ok = 탓할 사정 없음(✓) · 아니면 참작할 사정(!)
  function fairOf(o, M, av) {
    var out = [];
    if (!M.oneDay) out.push({ ok: true, t: '근무 ' + o.work + '일 기준' });
    if (o.perCase != null && av.perCase != null) out.push(o.perCase >= av.perCase * 1.3 ? { ok: false, t: '상담 1건당 ' + f1(o.perCase) + '번 답함(다른 사람 ' + f1(av.perCase) + '번)', why: '길게 주고받은 상담이 많았어요' } : { ok: true, t: '1건당 답한 횟수 비슷' });
    if (o.hardPct != null && av.hardPct != null) out.push(hardHigh(o, av) ? { ok: false, t: '어려운 상담 ' + pct(o.hardPct) + '(다른 사람 ' + pct(av.hardPct) + ')', why: '교환/반품·불량 같은 상담이 많았어요' } : { ok: true, t: '어려운 상담 비율 비슷' });
    var t = o.k + o.nv + o.bd, ot = M.people.filter(function (p) { return p.n !== o.n && (p.k + p.nv + p.bd); }).map(function (p) { return p.bd / (p.k + p.nv + p.bd); });
    if (t >= 5 && ot.length) { var sb = o.bd / t, ob = mean(ot); if (sb - ob >= 0.15) out.push({ ok: false, t: '게시판 ' + pct(sb) + '(다른 사람 ' + pct(ob) + ')', why: '게시판은 답한 상담에 안 잡혀요' }); }
    if (M.keys.indexOf(M.td) >= 0) {
      if (!o.fresh) out.push({ ok: false, t: o.x ? '기록기 꺼짐 · 마지막 신호 ' + ago(o.x.at) : '오늘 기록기 신호 없음', why: '꺼져 있던 동안의 응대는 안 잡혀요' });
      else if (o.bad.length) out.push({ ok: false, t: '지금 ' + chName(o.bad[0].ch) + ' ' + (T2().CONN_LABEL[o.bad[0].s] || '확인 필요'), why: '연결이 끊긴 동안의 응대는 안 잡혀요' });
      else out.push({ ok: true, t: '지금 연결 정상' });
    }
    return out;
  }
  function sumLine(o, M, f, fair) {
    var s = [];
    if (f.some(function (z) { return z.k === 'late'; }) && o.late.length >= 3 && !M.oneDay) {
      var by = {}; o.late.forEach(function (z) { by[z.d] = (by[z.d] || 0) + 1; });
      var top = Object.keys(by).sort(function (a, b) { return by[b] - by[a] || (a < b ? -1 : 1); })[0];
      s.push(by[top] * 2 >= o.late.length ? '20분 넘김 ' + o.late.length + '건 중 ' + by[top] + '건이 ' + md(top) + '에 몰려 있어요. 그날 무슨 일이 있었는지부터 물어보세요.' : '20분 넘김이 여러 날에 고르게 있어요. 오래 기다린 고객부터 답하는 습관 이야기가 좋아요.');
    }
    var ex = fair.filter(function (z) { return !z.ok && z.why; });
    s.push(ex.length ? '참작할 점: ' + ex.map(function (z) { return z.why; }).join(', ') + '.' : '상담 종류나 연결 탓은 아니에요.');
    return s.join(' ');
  }
  function skipKey(o, M) { return 'kb:fbskip:' + o.n + ':' + M.keys[0] + ':' + M.keys[M.keys.length - 1]; }
  function fbRows(M) {
    return M.people.map(function (o) { var av = others(M, o.n), fl = flags(o, M, av); return { o: o, av: av, score: fl.score, f: fl.list.filter(function (z) { return HEAD[z.k] && (z.c === 'r' || z.c === 'o'); }), fair: fairOf(o, M, av) }; });
  }
  function itemCard(z, M, ctx) {
    var o = z.o, red = z.f.some(function (x) { return x.c === 'r'; }), c = mk('div', 'titem' + (red ? ' r' : ''));
    var h = mk('div', 'tih'); h.append(mk('span', 'av', o.n.slice(0, 1)), mk('b', 'who', o.n), mk('b', 'what' + (red ? '' : ' o'), z.f.map(function (x) { return HEAD[x.k]; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(' · '))); c.append(h);
    var ev = mk('div', 'tev'); z.f.forEach(function (x) { ev.append(mk('div', 'tword ' + x.c, evOf(x, o, z.av, M))); });
    var tot = totalTxt(cmp('ans', o, M), o, M); if (tot) ev.append(mk('div', 'tword r', tot)); c.append(ev);
    // 등수 한 줄: 세 가지 모두(좋은 것도 같이 보여야 억울하지 않음)
    var rk = mk('div', 'trank'); rk.append(mk('span', 'tfl', '등수'));
    ['late', 'wait', 'ans'].forEach(function (k) { var q = cmp(k, o, M); if (!q) return; rk.append(mk('span', 'trk ' + (q.bad > 0 ? (q.last ? 'r' : 'o') : q.bad < 0 ? 'g' : 'm'), q.m.s + ' ' + q.pos + '등/' + q.n + '명')); });
    if (rk.childNodes.length > 1) c.append(rk);
    var fr = mk('div', 'tfair'); fr.append(mk('span', 'tfl', '화면이 먼저 확인한 것')); z.fair.forEach(function (x) { fr.append(mk('span', 'tfc' + (x.ok ? '' : ' c'), (x.ok ? '✓ ' : '! ') + x.t)); }); c.append(fr);
    var sm = mk('div', 'tverd'); sm.append(mk('b', null, '한 줄 정리 '), sumLine(o, M, z.f, z.fair)); c.append(sm);
    var ac = mk('div', 'tia'); ac.append(btn('면담 화면', 'primary sm', function () { ctx.who(o.n); }), btn('이번엔 넘어가기', 'ghost sm', function () { store(skipKey(o, M), '1'); ctx.again(); })); c.append(ac);
    return c;
  }
  function numCell(l, v, t, cls) { var d = mk('span', 'tnum' + (cls ? ' ' + cls : '')); d.append(mk('small', null, l), mk('b', null, v), mk('small', null, t)); return d; }
  function personLine(z, M, ctx) {
    var o = z.o, av = z.av, multi = !M.oneDay, lv = !multi ? 'n' : z.f.some(function (x) { return x.c === 'r'; }) ? 'r' : z.f.length ? 'y' : 'g';
    var wrap = mk('div', 'tline'), row = mk('div', 'tlr'); row.tabIndex = 0;
    var body = mk('div', 'tls'), what = !multi ? (o.ans || o.rec || o.lateN ? '' : M.periodName + ' 기록 없음') : z.f.length ? z.f.map(function (x) { return HEAD[x.k]; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(' · ') : '챙길 것 없어요';
    if (what) body.append(mk('b', 'tlw ' + lv, what));
    var lw = vs(o.lateN, av.late, '', true), ww = vs(o.wait, av.wait, '', true), aw = vs(multi ? o.ansDay : o.ans, av.ansDay, '');
    var col = function (w) { return multi && w.lv === 2 ? 'r' : w.c === 'g' ? 'g' : ''; };
    var nums = mk('div', 'tlnums');
    var rk = function (k) { var q = cmp(k, o, M); return q ? ' · ' + q.pos + '등' : ''; };
    nums.append(numCell('20분 넘김', o.lateN + '건', '다른 사람 ' + f1(av.late) + rk('late'), col(lw)), numCell('평균 대기', o.wait != null ? n0(o.wait) + '분' : '–', '다른 사람 ' + (av.wait != null ? n0(av.wait) + '분' : '–') + rk('wait'), col(ww)), numCell(multi ? '하루 답한 상담' : '답한 상담', o.ans ? n0(multi ? o.ansDay : o.ans) + '건' : '–', '다른 사람 ' + n0(av.ansDay) + rk('ans'), col(aw)));
    body.append(nums);
    var ref = ['완료 기록 ' + o.rec + '건(참고)']; if (o.redup) ref.push('같은 고객 다시 기록 ' + o.redup + '건은 안 셈'); if (o.ansN > o.ans) ref.push('답한 횟수 ' + o.ansN + '번(같은 고객 여러 번 포함)'); if (o.perCase != null) ref.push('1건당 ' + f1(o.perCase) + '번 답함'); if (o.hardPct != null) ref.push('어려운 상담 ' + pct(o.hardPct)); if (o.missN) ref.push('기록 안 함 ' + o.missN + '건');
    body.append(mk('div', 'tlref', ref.join(' · ')));
    row.append(mk('span', 'lamp ' + lv), mk('b', 'tlnm', o.n), body, btn('면담 화면', 'ghost sm', function (e) { e.stopPropagation(); ctx.who(o.n); }));
    var xp = mk('div', 'tlx'), key = 'fb:' + o.n; xp.hidden = !openRow[key];
    var fill = function () { if (!xp.childNodes.length) xp.append(textDetail(o, M)); }; if (!xp.hidden) fill();
    var tog = function () { openRow[key] = !openRow[key]; xp.hidden = !openRow[key]; row.classList.toggle('open', !!openRow[key]); if (!xp.hidden) fill(); };
    row.classList.toggle('open', !!openRow[key]);
    row.addEventListener('click', function (e) { if (e.target.closest('a,button')) return; tog(); });
    row.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tog(); } });
    wrap.append(row, xp); return wrap;
  }
  // 줄을 누르면: 날짜별(여러 날) 또는 하루(시각 · 맡은 상담) · 20분 넘김 목록 — 모두 글로
  function textDetail(o, M) {
    var box = mk('div', 'ttx');
    if (M.oneDay) {
      var v = o.days[M.oneDay] || {};
      box.append(tline('하루', flowLine(v.fl)));
      var c1 = catLine(v.cats); if (c1) box.append(tline('맡은 상담', c1));
    } else {
      M.keys.slice().reverse().forEach(function (d) { var v = o.days[d]; if (!v || !(v.rec || v.ans || v.lateN || (v.fl && v.fl.n))) return; box.append(tline(md(d), '답한 상담 ' + v.ans + '건 · 20분 넘김 ' + v.lateN + '건 · 완료 기록 ' + v.rec + '건' + (v.fl && v.fl.n >= 2 && v.fl.long.length ? ' · 30분 넘게 빈 때 ' + v.fl.long.length + '번' : ''), v.lateN >= 3 ? 'bad' : '')); });
      var c2 = catLine(o.cats); if (c2) box.append(tline('맡은 상담', c2));
    }
    if (o.late.length) {
      var lt = mk('div', 'ttl'); lt.append(mk('b', null, '20분 넘게 기다리게 한 상담 (오래 기다린 순)'));
      o.late.slice(0, 8).forEach(function (z) { var r = mk('div', 'ttr'); r.append(mk('span', null, md(z.d) + ' ' + clock(z.at)), chip(z.ch), mk('b', 'bad', (z.w || 0) + '분'), link(z, '상담 열기')); lt.append(r); });
      if (o.late.length > 8) lt.append(mk('div', 'pmore', '+ ' + (o.late.length - 8) + '건 더 (면담 화면에 모두 있어요)'));
      box.append(lt);
    }
    if (!box.childNodes.length) box.append(mk('div', 'pnone m', '이 기간 숫자가 없어요'));
    return box;
  }
  function fbView(M, ctx) {
    var box = mk('div', 'tview tfb'), multi = !M.oneDay;
    if (!M.people.length) { box.append(mk('div', 'empty', '아직 신호를 보낸 상담사가 없어요.')); return box; }
    var rows = fbRows(M), items = multi ? rows.filter(function (z) { return z.f.length; }).sort(function (a, b) { return b.score - a.score; }) : [];
    var shown = items.filter(function (z) { return store(skipKey(z.o, M)) !== '1'; }), skipped = items.length - shown.length, fine = rows.filter(function (z) { return !z.f.length; });
    var head = mk('p', 'tsum');
    if (!multi) head.append(mk('b', null, M.periodName + '은 하루라서 이야기할 것을 고르지 않아요.'), ' 하루 숫자는 긴 상담 하나로도 크게 흔들려요. 위에서 이번 주나 지난주를 골라 주세요. 아래는 숫자만 보여 줘요.');
    else { head.append(M.periodName + ' '); head.append(mk('b', shown.length ? 'bad' : 'okt', shown.length ? '이야기할 사람 ' + shown.length + '명' : '이야기할 사람 없어요 ✓')); if (fine.length) head.append(' · ' + fine.length + '명은 문제 없어요.'); }
    box.append(head);
    shown.forEach(function (z) { box.append(itemCard(z, M, ctx)); });
    if (skipped) { var sk = mk('div', 'tskip'); sk.append(mk('span', null, '이번엔 넘어간 사람 ' + skipped + '명'), btn('다시 보기', 'ghost sm', function () { items.forEach(function (z) { store(skipKey(z.o, M), '0'); }); ctx.again(); })); box.append(sk); }
    if (multi && fine.length && shown.length) { var fn = mk('div', 'tfine'); fn.append(mk('span', null, '✓ 문제 없음')); fine.forEach(function (z) { fn.append(mk('span', 'nm', z.o.n)); }); box.append(fn); }
    var all = mk('div', 'tpanel tall'), ah = mk('div', 'tph'); ah.append(mk('b', null, '모두 · ' + M.periodName), mk('span', 'muted', '이야기할 사람 먼저 · 줄을 누르면 ' + (multi ? '날짜별로' : '하루를') + ' 풀어서 보여요')); all.append(ah);
    var order = {}; items.forEach(function (z, i) { order[z.o.n] = i; });
    rows.slice().sort(function (a, b) { var x = order[a.o.n] != null ? order[a.o.n] : 99, y = order[b.o.n] != null ? order[b.o.n] : 99; return x - y || (a.o.n > b.o.n ? 1 : -1); }).forEach(function (z) { all.append(personLine(z, M, ctx)); });
    box.append(all);
    box.append(mk('p', 'muted tfoot', '이야기할 사람 = 이번 주·지난주·이번 달에 20분 넘게 기다리게 한 상담이 다른 사람 평균보다 많거나(1.5배 넘으면 빨강), 하루 평균 답한 상담이 25% 넘게 적거나, 고객 평균 대기가 많이 길거나, 답하고 기록 안 한 상담이 남은 사람이에요. 비교는 본인을 뺀 다른 사람 평균이에요. 완료 기록은 상담이 완전히 끝나야 남아서 참고로만 봐요. 1건당 답한 횟수 = 카톡·톡톡 답한 상담 ÷ 완료 기록(어림). [이번엔 넘어가기]는 이 PC에만 기억돼요.'));
    return box;
  }
  function nowView(M, ctx) {
    var box = mk('div', 'tview tnow'), live = M.people.filter(function (o) { return o.fresh; });
    // 2026-10-21 기다리는 고객 목록은 10분부터(주인) · 20분 넘으면 빨강 · 팀장 [빼기](이 PC에만 · 고객이 새로 말을 걸면 다시 뜸)
    var P = 0, L = 0, L20 = 0, H = 0, who10 = []; live.forEach(function (o) { P += o.pend; L += o.over10; L20 += o.over20; H += o.held; if (o.over10) who10.push(o.n); });
    var hd = mk('p', 'tsum');
    if (!live.length) hd.append(mk('b', null, '지금 신호를 보내는 기록기가 없어요.'), ' 상담사 PC의 기록기가 켜져 있는지 봐 주세요.');
    else { hd.append('지금 기다리는 고객 ', mk('b', null, P + '명')); hd.append(L ? mk('b', L20 ? 'bad' : 'warnt', ' · 10분 넘은 고객 ' + L + '명 (' + who10.join(', ') + ')' + (L20 ? ' · 그중 20분 넘음 ' + L20 + '명' : '')) : mk('b', 'okt', ' · 10분 넘게 기다리는 고객 없어요 ✓')); if (H) hd.append(' · 보류 ' + H + '명'); }
    box.append(hd);
    var skip = skipGet(), hidden = [], waits = [], extra = [];
    live.forEach(function (o) {
      var shown = 0;
      (o.top || []).forEach(function (t) {
        if (t.w < 10) return; var key = M.td + '|' + t.ch + ':' + t.id, sk = skip[key];
        if (sk && sk.w != null && !sk.back) { if (t.w >= sk.w) { hidden.push(key); shown++; return; } skipSet(key, Object.assign({}, sk, { back: 1 })); }
        waits.push({ o: o, t: t, key: key }); shown++;
      });
      if (!o.top && o.oldest >= 10) { waits.push({ o: o, t: { w: o.oldest, ch: '', n: '' } }); shown = 1; }
      if (o.over10 > shown) extra.push(o.n + ' ' + (o.over10 - shown) + '명');
    });
    waits.sort(function (a, b) { return b.t.w - a.t.w; });
    if (waits.length || hidden.length) {
      var wl = mk('div', 'tpanel tlate20'), wh = mk('div', 'tph'); wh.append(mk('span', 'tdot ' + (waits.some(function (z) { return z.t.w >= 20; }) ? 'r' : 'o')), mk('b', null, '10분 넘게 기다리는 고객'), mk('span', 'muted', '오래된 순 · 20분 넘으면 빨강 · [열기]를 누르면 그 상담방 · [빼기]는 팀장 판단으로 목록과 그날 숫자에서 뺌')); wl.append(wh);
      waits.slice(0, 15).forEach(function (z) {
        var row = mk('div', 'tact' + (z.t.w >= 20 ? ' r' : ' y')); row.append(mk('b', 'tmin' + (z.t.w >= 20 ? '' : ' y'), z.t.w + '분'), mk('b', null, z.o.n));
        if (z.t.ch) row.append(chip(z.t.ch)); if (z.t.ch) row.append(mk('b', 'tcn', z.t.n || '이름 없음')); var msg = mk('span', 'tmsg', z.t.ch ? (z.t.r ? '다시 옴 · ' : '') + (z.t.p || '(사진·파일 또는 내용 없음)') : '고객 이름·메시지는 기록기 2.4.4부터'); msg.title = z.t.p || ''; row.append(msg);
        if (z.t.ch) row.append(link(z.t), btn('빼기', 'ghost sm tskipb', function () { skipSet(z.key, { r: '팀장이 뺌', w: z.t.w, at: Date.now() }); say('뺐어요. 고객이 새로 말을 걸면 다시 떠요', 'ok'); ctx.again(); }));
        wl.append(row);
      });
      if (extra.length) wl.append(mk('div', 'pmore', '+ ' + extra.join(' · ') + ' 더 (칸을 누르면 그 사람 목록)'));
      if (hidden.length) { var hr = mk('div', 'pmore thid'); hr.append('팀장이 뺀 고객 ' + hidden.length + '명은 안 보여요 ', btn('다시 보기', 'ghost sm', function () { hidden.forEach(function (k) { skipSet(k, null); }); ctx.again(); })); wl.append(hr); }
      box.append(wl);
    }
    var tiles = mk('div', 'twall'), dets = mk('div', 'tnowds');
    M.people.slice().sort(function (a, b) { return (b.fresh ? b.oldest : -1) - (a.fresh ? a.oldest : -1) || (a.n > b.n ? 1 : -1); }).forEach(function (o) {
      var lv = !o.fresh ? 'off' : o.oldest >= 20 ? 'r' : o.oldest >= 10 ? 'y' : '', t = mk('div', 'twt ' + lv);
      t.append(mk('b', 'n', o.n));
      if (!o.fresh) { t.append(mk('span', 'big', '–'), mk('span', 'st bad', o.x ? '기록기 꺼짐 · ' + ago(o.x.at) : '오늘 신호 없음')); tiles.append(t); return; }
      t.append(mk('span', 'big', o.pend + '명 기다림'), mk('span', 'st', o.pend ? '가장 오래 ' + o.oldest + '분' : '기다리는 고객 없음'));
      if (o.bad.length) t.append(mk('span', 'st bad', chName(o.bad[0].ch) + ' ' + (T2().CONN_LABEL[o.bad[0].s] || '확인 필요')));
      var qa = cmp('ans', o, M); t.append(mk('span', 'st' + (qa && qa.last ? ' bad' : ''), '오늘 답한 상담 ' + o.ans + '건' + (qa ? ' · ' + qa.pos + '등' : '')));
      var ex = []; if (o.held) ex.push('보류 ' + o.held + '명'); if (o.missN) ex.push('기록 안 함 ' + o.missN + '건'); if (ex.length) t.append(mk('span', 'st', ex.join(' · ')));
      t.tabIndex = 0; t.title = '누르면 ' + o.n + ' 님 고객 목록';
      var d = mk('div', 'tpanel tnowd'), dh = mk('div', 'tph'), key = 'now:' + o.n; dh.append(mk('b', null, o.n), mk('span', 'muted', '지금 기다리는 고객 · 보류 · 답했는데 기록 없음')); d.append(dh);
      var g = mk('div', 'tpd2'), mc = missCol(o); g.append(waitBlock(o), mc); d.append(g); if (mc.xp) d.append(mc.xp);
      d.hidden = !openRow[key]; t.classList.toggle('open', !!openRow[key]);
      var tog = function () { openRow[key] = !openRow[key]; d.hidden = !openRow[key]; t.classList.toggle('open', !!openRow[key]); };
      t.addEventListener('click', tog); t.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tog(); } });
      tiles.append(t); dets.append(d);
    });
    box.append(tiles, dets);
    // 2026-10-20 오늘 지금까지 순서(답한 상담 많은 순) — 1등과 몇 건 차이인지 글로
    var ord = M.people.filter(function (o) { return o.ans > 0 || o.lateN > 0; }).sort(function (a, b) { return b.ans - a.ans || a.lateN - b.lateN; });
    if (ord.length >= 2) {
      var op = mk('div', 'tpanel tord'), oh = mk('div', 'tph'); oh.append(mk('b', null, '오늘 지금까지 순서'), mk('span', 'muted', '답한 상담 많은 순 · 20분 넘김은 적을수록 좋음')); op.append(oh);
      var top = ord[0].ans, avA = mean(ord.map(function (o) { return o.ans; })), avL = mean(ord.map(function (o) { return o.lateN; }));
      ord.forEach(function (o) {
        var pos = ord.filter(function (p) { return p.ans > o.ans; }).length + 1, last = pos > 1 && !ord.some(function (p) { return p.ans < o.ans; });
        var r = mk('div', 'tor' + (last ? ' r' : pos === 1 ? ' g' : '')); r.append(mk('b', 'tpos', pos + '등'), mk('b', 'tlnm', o.n), mk('span', 'tora', '답한 상담 ' + o.ans + '건'));
        var gap = top - o.ans, txt = pos === 1 ? '가장 많아요' : '1등보다 ' + gap + '건 적어요' + (avA && o.ans < avA * 0.75 ? ' · 평균(' + n0(avA) + '건)의 ' + Math.round(o.ans / avA * 100) + '%' : '');
        r.append(mk('span', 'torg', txt), mk('span', 'torl' + (o.lateN >= 2 && o.lateN > avL * 1.5 ? ' bad' : ''), '20분 넘김 ' + o.lateN + '건'));
        op.append(r);
      });
      box.append(op);
    }
    box.append(mk('p', 'muted tfoot', '칸 테두리: 노랑 = 10분 넘게, 빨강 = 20분 넘게 기다리는 고객이 있어요 · [빼기]는 이 PC에만 기억되고 그날 20분 넘김에서도 빠져요 · 칸을 누르면 그 사람 고객 목록이 열려요 · 30초마다 새로 읽어요 · 기다린 시간은 업무시간만 셈(점심 빼고).'));
    return box;
  }

  /* ───── 그리기: 팀 현황(admin-team.js team())이 부름 ───── */
  async function render(r, st) {
    var M = await collect(r, st.period, st.maxAge), ctx = { who: st.who, again: st.again };
    if (st.person) {
      var wrap = mk('div', 'tview'), hd = mk('div', 'tivh'), back = btn('← 팀 현황', 'ghost sm', function () { st.who(''); });
      var sel = mk('select', 'sel'); M.people.forEach(function (p) { sel.append(new Option(p.n, p.n)); }); sel.value = st.person; sel.setAttribute('aria-label', '상담사'); sel.addEventListener('change', function () { st.who(sel.value); });
      var sw = mk('label', 'tsw'), cb = mk('input'); cb.type = 'checkbox'; cb.checked = store('kb:anon') !== '0'; cb.addEventListener('change', function () { store('kb:anon', cb.checked ? '1' : '0'); st.again(); }); sw.append(cb, mk('span', null, '다른 사람 이름 가리기'));
      hd.append(back, mk('span', 'av big', st.person.slice(0, 1)), mk('b', 'tivn', st.person + ' 면담 화면'), sel, mk('span', 'sp'), sw);
      wrap.append(hd, interviewNew(M, st.person, ctx)); return wrap;
    }
    return st.mode === 'now' ? nowView(M, ctx) : st.mode === 'num' ? numView(M, ctx) : fbView(M, ctx);
  }
  window.KBTeam3 = { render: render, vs: vs, rank: rank };
})();
