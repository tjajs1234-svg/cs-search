/* 팀 기록 숫자 세기(2026-11-01) — 검색기 [팀 기록] 탭과 관리 화면 팀 현황 [팀 기록] 칸이 같이 씀
   · 오늘 기록 = 시트에 저장된 기록. 같은 고객(상담방)은 고른 기간 안에서 한 주(월~금)에 1건(팀 현황과 같은 규칙)
   · 시간당 기록 = 기록 ÷ 기록기가 켜져 있던 업무시간(팀 서버 1.3.12부터 남는 하루 on 분: 10~19시, 목 17시, 점심 12:30~14:00 빼고)
     2026-11-02 야근한 날: 19시 뒤 켜져 있던 분(팀 서버 1.3.18 oa)도 더함 — OT에 적은 퇴근 시각이나 그날 마지막 기록 시각까지만(19시 뒤 기록만 세고 시간은 안 더해 부풀던 것)
     켜진 시간 자료가 있는 날의 기록만 나눔 · 켜진 시간이 합쳐 1시간이 안 되면 시간당은 없음(null)
   · 2026-11-03 응대 = 그날 답을 한 번이라도 보낸 서로 다른 고객(상담방) 수 · 기록과 상관없음(팀 서버 qa.get의 ak 답한 고객 · sd 보낸 방 · rk 기록한 방을 합침, 채팅만)
     같은 고객은 고른 기간 안에서 한 주(월~금)에 1명 · 시간당 응대 = 응대 ÷ 시간당 기록과 같은 켜진 시간
     AS 시트를 본 분(팀 서버 1.3.19 as · 기록기 2.4.27: 월~금 14~17시에 5분 넘게 보고 그동안 답 0)은 켜진 시간에서 뺌
   · 카테고리 = 기록 창에서 고른 분류(기록기 2.4.15부터)
   · 자료: 팀 서버 team.get(days: 날짜 → 이름 → 하루 숫자 · live: 지금) · qa.get(days: 날짜 → 이름 → rk 그날 기록한 방)
   · '팀장' 이름(팀장 PC가 보낸 숫자)은 넣지 않음. 고객 이름·내용은 다루지 않음 */
(function (root) {
  'use strict';
  var W = root.WorkClock || (typeof require === 'function' ? require('./workclock.js') : null);
  // 기록기 match.js person · 팀 서버 person_과 같은 규칙(끝 숫자 빼고, 한글 세 글자면 성을 뺌)
  function person(n) { var s = String(n || '').replace(/\s+/g, '').replace(/\d+$/, ''); return /^[가-힣]{3}$/.test(s) ? s.slice(1) : s; }
  var HARD = /교환|반품|불량|고장|A\s*\/?\s*S|불만|컴플레인/i;
  function isHard(c) { return HARD.test(String(c || '')); }
  function weekOf(d) { return W.addDays(d, -((W.weekday(d) + 6) % 7)); }
  function today(now) { return W.dayKey(now == null ? Date.now() : now); }

  // 기간 → 날짜 목록: today · yday · week · lweek · month · lmonth · 'd:날짜' · 'r:시작~끝'
  function periodKeys(period, now) {
    var td = today(now), out = [], i, d;
    if (/^d:\d{4}-\d{2}-\d{2}$/.test(period || '')) return [period.slice(2)];
    var m = /^r:(\d{4}-\d{2}-\d{2})~(\d{4}-\d{2}-\d{2})$/.exec(period || '');
    if (m) { var a = m[1] <= m[2] ? m[1] : m[2], b = m[1] <= m[2] ? m[2] : m[1]; if (b > td) b = td; for (d = a; d <= b && out.length < 400; d = W.addDays(d, 1)) out.push(d); return out.length ? out : [td]; }
    if (period === 'yday') { var y = W.addDays(td, -1); while (!W.day(y, {}) && y > W.addDays(td, -10)) y = W.addDays(y, -1); return [y]; }
    if (period === 'week' || period === 'lweek') { var mon = weekOf(td); if (period === 'lweek') mon = W.addDays(mon, -7); for (i = 0; i < 7; i++) { d = W.addDays(mon, i); if (d <= td) out.push(d); } return out; }
    if (period === 'month') { for (d = td.slice(0, 8) + '01'; d <= td; d = W.addDays(d, 1)) out.push(d); return out; }
    if (period === 'lmonth') { var first = W.addDays(td.slice(0, 8) + '01', -1).slice(0, 8) + '01'; for (d = first; d.slice(0, 7) === first.slice(0, 7); d = W.addDays(d, 1)) out.push(d); return out; }
    return [td];
  }
  // 팀 서버에 물을 날 수(오늘부터 거꾸로)
  function daysBack(keys, now) { var td = today(now), from = keys[0] || td; return Math.max(1, Math.round((Date.parse(td + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 864e5) + 1); }

  /* team: team.get 대답 · qa: qa.get 대답(없으면 같은 고객 합치기 없이 셈) · keys: 날짜 목록 · opt.now · opt.roster(명단: 성 포함 이름) */
  function compute(team, qa, keys, opt) {
    opt = opt || {};
    var now = opt.now == null ? Date.now() : opt.now, td = today(now), days = (team && team.days) || {}, qd = (qa && qa.days) || {};
    var live = {}; ((team && team.live) || []).forEach(function (x) { if (x && x.name) live[person(x.name)] = x; });
    var names = {}, full = {}; ((opt.roster) || []).forEach(function (x) { if (x && x.name) full[person(x.name)] = x.full || x.name; });
    keys.forEach(function (d) { Object.keys(days[d] || {}).forEach(function (n) { names[person(n)] = 1; }); });
    if (keys.indexOf(td) >= 0) Object.keys(live).forEach(function (n) { if (now - (live[n].at || 0) <= 3 * 60000 && live[n].records) names[n] = 1; });
    delete names['팀장']; delete names[''];
    // OT(반려 빼고): 이름 → 날짜 → 야근 분
    var otm = {}; ((opt.ot) || []).forEach(function (x) { if (!x || x.status === '반려') return; var p = person(x.name), o2 = otm[p] || (otm[p] = {}); o2[x.date] = Math.max(o2[x.date] || 0, Number(x.mins) || 0); });
    var noQa = []; // 기록한 방 자료가 없는 날(두 달 넘은 날 등) — 같은 고객 합치기 없이 셈
    keys.forEach(function (d) { if (!qd[d] && Object.keys(days[d] || {}).length) noQa.push(d); });
    var people = Object.keys(names).map(function (n) {
      var x = live[n], fresh = !!(x && now - (x.at || 0) <= 3 * 60000), o = { n: n, rec: 0, raw: 0, redup: 0, on: 0, late: 0, as: 0, resp: 0, onResp: 0, rh: {}, wh: {}, ah: {}, onDays: 0, onRec: 0, work: 0, cats: {}, catN: 0, hardN: 0, k: 0, nv: 0, bd: 0, byDay: {} };
      var seen = {}, seenR = {};
      keys.forEach(function (d) {
        var dd = days[d] || {}, v = { rec: 0, on: null, oa: 0, as: 0, ans: 0, k: 0, nv: 0, bd: 0, rh: {}, wh: {}, ah: {} };
        Object.keys(dd).forEach(function (k) {
          if (person(k) !== n) return; var s = dd[k] || {};
          v.rec += s.records || 0; v.ans += s.answered || 0; v.k += s.kakao || 0; v.nv += s.naver || 0;
          Object.keys(s.sites || {}).forEach(function (st) { v.bd += s.sites[st] || 0; });
          if (typeof s.on === 'number' && s.on >= 0) v.on = (v.on || 0) + s.on;
          if (typeof s.oa === 'number' && s.oa > 0) v.oa += s.oa;
          if (typeof s.as === 'number' && s.as > 0) v.as += s.as;
          ['rh', 'wh', 'ah'].forEach(function (hk) { var m = s[hk]; if (m && typeof m === 'object') Object.keys(m).forEach(function (h) { var x2 = Number(m[h]) || 0; if (x2 > (v[hk][h] || 0)) v[hk][h] = x2; }); });
          Object.keys(s.cats || {}).forEach(function (c) { var c2 = String(c); o.cats[c2] = (o.cats[c2] || 0) + (s.cats[c] || 0); });
        });
        // 오늘은 하루 파일이 5분마다 남아서, 지금 보내는 기록 수가 더 크면 그걸 씀(관리 화면 팀 현황과 같음)
        if (d === td && fresh) v.rec = Math.max(v.rec, x.records || 0);
        // 같은 고객은 한 주(월~금)에 1건: 그날 기록한 방(rk) 중 이 기간 같은 주에 이미 센 방은 빼고 셈
        var rks = {}, wk = weekOf(d), dup = 0;
        Object.keys(qd[d] || {}).forEach(function (k) { if (person(k) !== n) return; (qd[d][k].rk || []).forEach(function (h) { rks[h] = 1; }); });
        Object.keys(rks).forEach(function (h) { var key = wk + ':' + h; if (seen[key]) dup++; else seen[key] = 1; });
        var rec = Math.max(0, v.rec - dup);
        // 응대: 답한 고객(ak) · 보낸 방(sd) · 기록한 방(rk)을 합친 서로 다른 고객 · 같은 주에 이미 센 고객은 빼고
        var rs = {}, resp = 0; Object.keys(qd[d] || {}).forEach(function (k) { if (person(k) !== n) return; var e = qd[d][k] || {}; (e.ak || []).concat(e.rk || [], e.sd && typeof e.sd === 'object' && !Array.isArray(e.sd) ? Object.keys(e.sd) : []).forEach(function (h) { if (/^[kn]/.test(h)) rs[h] = 1; }); });
        Object.keys(rs).forEach(function (h) { var key = wk + ':' + h; if (!seenR[key]) { seenR[key] = 1; resp++; } });
        // 야근한 날: 19시 뒤 켜져 있던 분을 OT 퇴근 시각 · 그날 마지막 기록 시각 중 늦은 쪽까지만 더함
        if (v.on != null && v.oa > 0) {
          var lastRt = -1; Object.keys(qd[d] || {}).forEach(function (k) { if (person(k) === n) (qd[d][k].rt || []).forEach(function (t) { if (t > lastRt) lastRt = t; }); });
          var cap = Math.max((otm[n] || {})[d] || 0, lastRt - 19 * 60, 0), add = Math.min(v.oa, cap);
          if (add > 0) { v.on += add; o.late += add; }
        }
        // AS 시트를 본 분은 상담 시간에서 뺌
        if (v.on != null && v.as > 0) { var cut = Math.min(v.as, v.on); v.on -= cut; o.as += cut; }
        o.rec += rec; o.raw += v.rec; o.redup += Math.min(dup, v.rec); o.k += v.k; o.nv += v.nv; o.bd += v.bd;
        if (v.on != null) { o.on += v.on; o.onDays++; o.onRec += rec; o.onResp += resp; }
        o.resp += resp; if (keys.length === 1) { o.rh = v.rh; o.wh = v.wh; o.ah = v.ah; }
        if (rec > 0 || v.ans > 0 || resp > 0) o.work++;
        o.byDay[d] = { rec: rec, on: v.on, resp: resp, as: v.as };
      });
      Object.keys(o.cats).forEach(function (c) { if (!(o.cats[c] > 0)) { delete o.cats[c]; return; } o.catN += o.cats[c]; if (isHard(c)) o.hardN += o.cats[c]; });
      o.ph = o.on >= 60 ? o.onRec / (o.on / 60) : null;
      o.rph = o.on >= 60 && o.resp > 0 ? o.onResp / (o.on / 60) : null; // 시간당 응대
      o.perDay = o.work ? o.rec / o.work : null;
      o.hardPct = o.catN >= 3 ? o.hardN / o.catN : null;
      o.full = full[n] || n; // 화면에는 명단의 성 포함 이름(강유미)
      return o;
    }).filter(function (o) { return o.rec > 0 || o.catN > 0 || o.on > 0 || o.resp > 0; });
    // 시간당 많은 순(없으면 기록 많은 순) · 같으면 이름순
    people.sort(function (a, b) { return (b.ph == null ? -1 : b.ph) - (a.ph == null ? -1 : a.ph) || b.rec - a.rec || a.full.localeCompare(b.full, 'ko'); });
    // 등수(관리 화면만 보여 줌): 같은 숫자(소수 첫째 자리)는 같은 등수
    var r = 0, last = null; people.forEach(function (o, i) { if (o.ph == null) { o.rank = null; return; } var k = Math.round(o.ph * 10); if (k !== last) { r = i + 1; last = k; } o.rank = r; });
    var cats = {}; people.forEach(function (o) { Object.keys(o.cats).forEach(function (c) { cats[c] = (cats[c] || 0) + o.cats[c]; }); });
    var catOrder = Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a] || a.localeCompare(b, 'ko'); });
    var tot = { rec: 0, resp: 0, catN: 0, hardN: 0 }; people.forEach(function (o) { tot.rec += o.rec; tot.resp += o.resp; tot.catN += o.catN; tot.hardN += o.hardN; });
    tot.hardPct = tot.catN >= 5 ? tot.hardN / tot.catN : null;
    var best = people.filter(function (o) { return o.ph != null; })[0] || null;
    return { keys: keys, people: people, cats: cats, catOrder: catOrder, total: tot, best: best, noQa: noQa, today: td };
  }
  // 시간당 응대 많은 순(없으면 맨 뒤) → 시간당 기록 → 기록 수 → 이름(원래 목록은 그대로 두고 새 목록)
  function byResp(people) { return (people || []).slice().sort(function (a, b) { return (b.rph == null ? -1 : b.rph) - (a.rph == null ? -1 : a.rph) || (b.ph == null ? -1 : b.ph) - (a.ph == null ? -1 : a.ph) || b.rec - a.rec || String(a.full).localeCompare(String(b.full), 'ko'); }); }
  // 하루 중 가장 적게 응대한 정시(면담 한 줄): 처음·마지막으로 답한 시간 사이 · 점심(12·13시) · AS를 20분 넘게 본 시간은 뺌
  function lowHour(o) {
    var rh = (o && o.rh) || {}, ah = (o && o.ah) || {}, hs = Object.keys(rh).map(Number).filter(function (h) { return rh[h] > 0; });
    if (hs.length < 2) return null;
    var lo = Math.min.apply(null, hs), hi = Math.max.apply(null, hs), best = null;
    for (var h = lo; h <= hi; h++) { if (h === 12 || h === 13 || (ah[h] || 0) >= 20) continue; var n = rh[h] || 0; if (!best || n < best.n) best = { h: h, n: n, wait: (o.wh || {})[h] || 0 }; }
    return best;
  }
  var api = { lowHour: lowHour, person: person, isHard: isHard, periodKeys: periodKeys, daysBack: daysBack, compute: compute, weekOf: weekOf, byResp: byResp };
  root.KBTeamStats = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
