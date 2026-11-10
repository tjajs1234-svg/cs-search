/* 이달의 상담사(인센티브 추천) — 팀 현황 다섯째 칸 · 관리 화면 전용
   2026-11-01 처음 · 2026-11-03 11월판(주인): 10월은 버리고 11월부터 · 매일 새로 세고 월말(마지막 근무일)에 확정 · 엑셀(.xlsx)로 받기
   · 점수(주인이 34개 중 고름): 시간당 기록 · 시간당 응대(동시 진행) · 하루 평균 기록 · 기다리게 한 정도(20분 넘김 · 평균 · 가장 길게) · OT 기여
   · 참작: 어려운 상담(교환/반품 · 고장/불량 · A/S · 불만)이 팀 평균보다 많으면 기록을 조금 더 쳐 줌 — 한도 있음(간단한 문의를 어렵게 분류했을 수 있어서)
   · 확인할 것(점수엔 안 넣음): 오래 남은 상담(링크 · 언제부터 언제까지) · 같은 고객 다시 기록 · 보류 · 남이 답한 고객 기록
   · 2026-11-06 QA 감점 기록(주인): 팀장이 한 건씩 적음(날짜 · 종류 · 상담 링크 · 무엇이 틀렸나) — 오안내 −3 · 오처리 −3 · 공지 미반영 −2 · 응대 미흡 −1 ·
     추천 제외 없음 · 지각·조퇴·무단 뺌 · 면담 화면 '근거' 칸과 엑셀 'QA 감점' 시트로 보여 줌 · 팀 서버 1.3.26 inc.json(관리자 열쇠로만) · 확정한 점수표도 거기에
   · 상담사 화면 어디에도 이 기준을 보여 주지 않음(주인: 알면 카테고리를 일부러 바꿀 수 있음)
   계산(compute)과 엑셀 만들기(xlsx)는 화면과 떼어 시험(tests/incentive.test.js)이 그대로 부름 */
(function (root) {
  'use strict';
  var W = root.WorkClock || (typeof require === 'function' ? require('../js/workclock.js') : null);
  var HARD = /교환|반품|불량|고장|A\s*\/?\s*S|불만|컴플레인/i, HARD_LABEL = '교환/반품 · 고장/불량 · A/S · 불만';
  var START = '2026-11'; // 주인 11/03: 10월은 날이 적어 버리고 11월부터
  // 기본 배점(팀 서버에 저장하면 그 값을 씀 — [배점 바꾸기])
  var DEF = { wRph: 30, wRsp: 25, wDpd: 20, wLate: 20, wOt: 5, lateStep: 1, hardStep: 3, hardMax: 5, qWi: -3, qWp: -3, qNt: -2, qPq: -1, tie: 3, gA: 85, gB: 70 };
  var CFG_LABEL = [['wRph', '시간당 기록 배점'], ['wRsp', '시간당 응대 배점'], ['wDpd', '하루 평균 기록 배점'], ['wLate', '기다리게 한 정도 배점'], ['wOt', 'OT 기여 배점'], ['lateStep', '20분 넘김 1%마다 감점'], ['hardStep', '어려운 상담: 팀보다 10%p마다 기록 +%'], ['hardMax', '어려운 상담: 최대 +%'], ['qWi', 'QA 오안내 1건'], ['qWp', 'QA 오처리 1건'], ['qNt', 'QA 공지 미반영 1건'], ['qPq', 'QA 응대 미흡 1건'], ['tie', '공동 추천: 몇 점 차이 안'], ['gA', 'A 등급: 몇 점부터'], ['gB', 'B 등급: 몇 점부터']];
  // 2026-11-06 QA 감점 종류(팀 서버 1.3.26 INC_QA와 같은 키) · 배점 키 · 색(m = 노랑)
  // 2026-11-06 '제안'(주인): 감점이 아닌 아쉬운 점 · 0점 · 5번째 칸 1 = 점수 없음
  // 2026-11-09 주인: QA 피드백 두 칸 1,000자(팀 서버 1.3.28부터 · 그 전 서버는 200자에서 자르니 웹도 200자로 막음 — 말없이 잘리지 않게)
  var QA_MAX = 1000, QA_OLD = 200, qaLimP = null;
  function qaLimit() {
    if (!qaLimP) qaLimP = (async function () {
      try { var r = await CSTeam.call('ping', {}, 15000), v = String(r.version || '').split('.').map(Number); return (v[0] * 1e6 + (v[1] || 0) * 1e3 + (v[2] || 0)) >= 1003028 ? QA_MAX : QA_OLD; }
      catch (e) { qaLimP = null; return QA_OLD; }
    })();
    return qaLimP;
  }
  function qaLimMsg(lim) { return lim < QA_MAX ? '지금 팀 서버는 200자까지만 저장해요. 팀 서버 1.3.28을 붙이면 1,000자까지 돼요.' : '1,000자까지 적을 수 있어요(빈 줄 포함)'; }
  function qaCount(ta) {
    var c = document.createElement('span'); c.className = 'qcount';
    var up = async function () {
      var lim = await qaLimit(), n = ta.value.trim().length;
      ta.style.height = 'auto'; ta.style.height = Math.min(Math.max(ta.scrollHeight + 2, 110), 420) + 'px';
      c.textContent = n.toLocaleString() + ' / ' + lim.toLocaleString() + '자' + (lim < QA_MAX ? ' · 팀 서버 1.3.28을 붙이면 1,000자까지 돼요' : '');
      c.classList.toggle('over', n > lim);
    };
    ta.addEventListener('input', up); up(); return c;
  }
  var QT = [['wi', '오안내', 'qWi', ''], ['wp', '오처리', 'qWp', ''], ['nt', '공지 미반영', 'qNt', ''], ['pq', '응대 미흡', 'qPq', ' m'], ['sg', '제안', 'qSg', ' s', 1]], QTN = {}; QT.forEach(function (q) { QTN[q[0]] = q; });
  var HOLD_NOTE = '보류를 누르면 그 고객의 기다린 시간이 멈춰서 20분 넘김에 안 잡혀요. 참고하세요.';
  function isHard(c) { return HARD.test(String(c || '')); }
  function num(v) { v = Number(v); return isFinite(v) ? v : 0; }
  function wkOf(d) { return W.addDays(d, -((W.weekday(d) + 6) % 7)); }
  function workMin(d, cfg) { var x = W.day(d, cfg); return x ? x.workEnd - x.open - (x.lunch[1] - x.lunch[0]) : 0; }
  function mean(a) { a = a.filter(function (v) { return v != null && isFinite(v); }); return a.length ? a.reduce(function (s, v) { return s + v; }, 0) / a.length : null; }
  function cfgOf(inc) { var c = Object.assign({}, DEF), s = (inc && inc.cfg) || {}; Object.keys(DEF).forEach(function (k) { if (s[k] != null && isFinite(Number(s[k]))) c[k] = Number(s[k]); }); return c; }
  function md(d) { return Number(d.slice(5, 7)) + '/' + Number(d.slice(8, 10)); }
  function pc(v) { return v == null ? '–' : Math.round(v * 100) + '%'; }
  function f1(v) { return v == null ? '–' : (Math.round(v * 10) / 10).toFixed(1); }

  // 그달 근무일 진행: 지난 근무일 · 남은 근무일 · 마지막 근무일(이날부터 확정)
  function monthInfo(month, today, wcfg) {
    var d = month + '-01', passed = 0, left = 0, last = null;
    for (; d.slice(0, 7) === month; d = W.addDays(d, 1)) { if (!W.day(d, wcfg || {})) continue; last = d; if (d <= today) passed++; else left++; }
    return { passed: passed, left: left, last: last, canFinal: !!last && today >= last };
  }

  /* ───── 계산 ─────
     M: collect() 결과(people · keys · days · q · wcfg) · ext: { inc: 팀 서버 inc.json, month: 'YYYY-MM', ot: OT 목록, P: 이름 바꾸기 } */
  function compute(M, ext) {
    ext = ext || {}; var inc = ext.inc || {}, C = cfgOf(inc), month = ext.month || (M.keys[0] || '').slice(0, 7), P = ext.P || function (n) { return n; };
    var input = ((inc.months || {})[month] || {}).people || {}, qaAll = (((inc.months || {})[month] || {}).qa || []).filter(function (x) { return x && QTN[x.t]; }), q = (M.q && M.q.days) || {}, days = M.days || {}, keys = M.keys, wcfg = M.wcfg || {};
    var otMin = {}; (ext.ot || []).forEach(function (x) { if (x && x.status !== '반려' && keys.indexOf(x.date) >= 0) otMin[P(x.name)] = (otMin[P(x.name)] || 0) + num(x.mins); });
    // 사람마다 그날 보낸 방(sd) · 기록한 방(rk) · 게시판 글(bk) · 어려운 상담 표본(hs) · 오래 남은 상담(lh)
    var Q = {}; keys.forEach(function (d) { var qd = q[d] || {}; Object.keys(qd).forEach(function (k) { var n = P(k), e = qd[k] || {}, o = (Q[n] || (Q[n] = {}))[d] || (Q[n][d] = { sd: {}, rk: [], bk: [], hs: [], lh: [] }); if (e.sd && typeof e.sd === 'object') Object.keys(e.sd).forEach(function (h) { o.sd[h] = 1; }); o.rk = o.rk.concat(e.rk || []); o.bk = o.bk.concat(e.bk || []); o.hs = o.hs.concat(e.hs || []); o.lh = o.lh.concat(Array.isArray(e.lh) ? e.lh : []); }); });
    var qOf = function (n, d) { return (Q[n] || {})[d] || { sd: {}, rk: [], bk: [], hs: [], lh: [] }; };
    var holdsOf = function (n, d) { var x = days[d] || {}, h = 0; Object.keys(x).forEach(function (k) { if (P(k) === n) h += num((x[k] || {}).holds); }); return h; };
    // 남이 답한 고객 기록(26): 같은 주 같은 고객을 둘이 기록하면 그 주에 그 방에 답을 보낸 사람에게만(보낸 사람이 없거나 둘 다 보냈으면 각자 그대로)
    var recBy = {}; M.people.forEach(function (o) { keys.forEach(function (d) { var wk = wkOf(d); qOf(o.n, d).rk.forEach(function (h) { var r = recBy[wk + ':' + h] || (recBy[wk + ':' + h] = {}); r[o.n] = 1; }); }); });
    var sentWk = function (n, wk, h) { return keys.some(function (d) { return wkOf(d) === wk && qOf(n, d).sd[h]; }); };
    var lost = {}; Object.keys(recBy).forEach(function (key) { var who = Object.keys(recBy[key]); if (who.length < 2) return; var wk = key.slice(0, 10), h = key.slice(11), snd = who.filter(function (n) { return sentWk(n, wk, h); }); if (!snd.length || snd.length === who.length) return; who.forEach(function (n) { if (snd.indexOf(n) < 0) lost[n] = (lost[n] || 0) + 1; }); });
    var rows = M.people.map(function (o) {
      var x = input[o.n] || {}, r = { n: o.n, o: o, in: x, flags: [] };
      // 근무시간(분) = 출근한 날 업무시간 + OT(주인 11/03: AS 시간 · 쉰 시간은 빼지 않음)
      var wd = keys.filter(function (d) { var v = o.days[d]; return v && (v.rec > 0 || (v.fl && v.fl.n > 0) || v.ans > 0 || ((o.respDay || {})[d] || {}).resp > 0); });
      r.work = wd.length; r.ot = otMin[o.n] || 0;
      r.min = wd.reduce(function (s, d) { return s + workMin(d, wcfg); }, 0) + r.ot; r.hours = r.min / 60;
      // 기록: collect가 같은 주 같은 고객(채팅)을 이미 1건으로 셈 → 게시판 같은 글 같은 주 · 남이 답한 고객 기록을 더 뺌
      var seenB = {}, bdup = 0, holds = 0; keys.forEach(function (d) { var wk = wkOf(d); qOf(o.n, d).bk.forEach(function (h) { var k = wk + ':' + h; if (seenB[k]) bdup++; else seenB[k] = 1; }); holds += holdsOf(o.n, d); });
      r.bdup = bdup; r.redup = (o.redup || 0) + bdup; r.holds = holds; r.lost = lost[o.n] || 0;
      r.recRaw = o.rec; r.rec = Math.max(0, o.rec - bdup - r.lost);
      r.resp = o.resp || 0; r.k = o.k || 0; r.nv = o.nv || 0; r.bd = o.bd || 0;
      r.catN = o.catN || 0; r.hardN = o.hardN || 0; r.hardPct = r.catN >= 3 ? r.hardN / r.catN : null; r.cats = o.cats || {};
      // 기다리게 한 정도: 20분 넘긴 고객 비율(점수) · 평균 대기 · 가장 길게(20분 안이면 하루 최장 중 큰 값)
      r.ans = o.ans || 0; r.lateN = o.lateN || 0; r.latePct = r.ans ? Math.min(1, r.lateN / r.ans) : null; r.wait = o.wait == null ? null : o.wait;
      r.maxWait = o.lateMax || Math.max.apply(null, [0].concat(keys.map(function (d) { var m = (o.days[d] || {}).maxW || 0; return m < 20 ? m : 0; })));
      // 오래 남은 상담(14): 상담마다 마지막 대화 날짜 ~ 목록에 마지막으로 보인 날
      var L = {}; keys.forEach(function (d) { qOf(o.n, d).lh.forEach(function (z) { if (!z || !z.k) return; var c = L[z.k] || (L[z.k] = { k: z.k, ch: z.ch, u: '', from: null, to: d, h: 0 }); if (z.u) c.u = z.u; if (z.h) c.h = 1; var f = z.last ? W.dayKey(z.last) : d; if (!c.from || f < c.from) c.from = f; if (d > c.to) c.to = d; }); });
      r.long = Object.keys(L).map(function (k) { var c = L[k]; c.days = Math.round((Date.parse(c.to) - Date.parse(c.from)) / 864e5) + 1; return c; }).sort(function (a, b) { return b.days - a.days || (a.from > b.from ? 1 : -1); });
      return r;
    });
    // 어려운 상담 참작(17): 팀 평균보다 높으면 10%p마다 기록 +hardStep% · 최대 +hardMax%
    var c = 0, h = 0; rows.forEach(function (r) { c += r.catN; h += r.hardN; }); var teamHard = c >= 5 ? h / c : null;
    rows.forEach(function (r) {
      var up = r.hardPct == null || teamHard == null ? 0 : Math.max(0, (r.hardPct - teamHard) * 100 / 10 * C.hardStep);
      r.hardBonus = Math.min(C.hardMax, up); r.capped = up > C.hardMax && C.hardMax > 0;
      r.wrec = r.rec * (1 + r.hardBonus / 100);
      r.rph = r.hours >= 1 ? r.wrec / r.hours : null; r.dpd = r.work ? r.wrec / r.work : null; r.rsp = r.hours >= 1 && r.resp ? r.resp / r.hours : null;
    });
    var mx = function (k) { return Math.max.apply(null, [0].concat(rows.map(function (r) { return r[k] || 0; }))); };
    var M1 = { rph: mx('rph'), rsp: mx('rsp'), dpd: mx('dpd'), ot: mx('ot') }, maxWork = mx('work');
    rows.forEach(function (r) {
      var x = r.in, part = function (v, m, w) { return v == null || !m ? 0 : w * v / m; };
      r.pts = { rph: part(r.rph, M1.rph, C.wRph), rsp: part(r.rsp, M1.rsp, C.wRsp), dpd: part(r.dpd, M1.dpd, C.wDpd), late: r.latePct == null ? 0 : Math.max(0, C.wLate - r.latePct * 100 * C.lateStep), ot: part(r.ot, M1.ot, C.wOt) };
      r.base = r.pts.rph + r.pts.rsp + r.pts.dpd + r.pts.late + r.pts.ot;
      // QA 감점: 적은 건(종류별 감점) + 예전에 숫자로 넣은 오안내·오처리 · 공지 미반영(사라지지 않게)
      r.qa = qaAll.filter(function (z) { return P(z.n) === r.n; }).sort(function (a, b) { return a.d < b.d ? 1 : a.d > b.d ? -1 : (b.at || 0) - (a.at || 0); });
      r.qaN = {}; r.qa.forEach(function (z) { r.qaN[z.t] = (r.qaN[z.t] || 0) + 1; });
      r.qaOld = { er: num(x.er), nt: num(x.nt) };
      r.adj = r.qa.reduce(function (s2, z) { return s2 + (C[QTN[z.t][2]] || 0); }, 0) + r.qaOld.er * C.qWi + r.qaOld.nt * C.qNt;
      r.prod = Math.round(r.base);
      r.score = Math.max(0, Math.round(r.base + r.adj));
      r.grade = r.score >= C.gA ? 'A' : r.score >= C.gB ? 'B' : 'C';
      r.out = []; if (maxWork && r.work * 2 < maxWork) r.out.push('근무일 ' + r.work + '일(다른 사람 절반 미만)');
    });
    // 확인할 것(점수엔 안 넣음) — 한 줄에 한 가지 · '~해요'
    var others = function (r, k) { return mean(rows.filter(function (z) { return z !== r && z.work; }).map(function (z) { return z[k]; })); };
    rows.forEach(function (r) {
      var f = function (lv, t, more) { r.flags.push({ lv: lv, t: t, more: more || null }); };
      if (r.long.length) f('y', '오래 남은 상담이 ' + r.long.length + '건이에요.', { long: r.long });
      var ah = others(r, 'holds'); if (r.holds >= 5 && (!ah || r.holds > ah * 1.5)) f('y', '보류를 ' + r.holds + '번 눌렀어요.' + (ah != null ? ' 다른 사람 평균은 ' + Math.round(ah) + '번이에요.' : ''), { note: HOLD_NOTE });
      if (r.redup) f('y', '같은 고객을 같은 주에 다시 기록한 게 ' + r.redup + '건이에요. 1건으로 셌어요.');
      if (r.lost) f('y', '다른 상담사가 답한 고객을 기록한 게 ' + r.lost + '건이에요. 답을 보낸 사람에게 옮겼어요.');
      if (r.hardPct != null && teamHard != null && r.hardPct >= teamHard + 0.15 && r.catN >= 10) f('r', '어려운 상담 비율이 ' + pc(r.hardPct) + '예요. 팀 평균은 ' + pc(teamHard) + '예요.', { hs: true });
    });
    // 순서 · 추천
    var ranked = rows.slice().sort(function (a, b) { return b.score - a.score || (a.n > b.n ? 1 : -1); });
    var ok = ranked.filter(function (r) { return !r.out.length && r.work; });
    ok.forEach(function (r) { r.rank = ok.filter(function (z) { return z.score > r.score; }).length + 1; });
    var pick = ok.length ? ok.filter(function (r) { return ok[0].score - r.score < C.tie; }) : [];
    return { C: C, rows: ranked, ok: ok, pick: pick, teamHard: teamHard, month: month, input: input, keys: keys };
  }
  // 1등 항목(맨 위 한 줄)
  function bests(r, R) {
    var top = function (k) { return r[k] != null && r[k] > 0 && R.rows.every(function (z) { return z === r || (z[k] || 0) <= r[k]; }); }, g = [];
    if (top('rph')) g.push('시간당 기록'); if (top('rsp')) g.push('시간당 응대'); if (top('dpd')) g.push('하루 평균 기록');
    if (r.latePct != null && R.rows.every(function (z) { return z === r || z.latePct == null || z.latePct >= r.latePct; })) g.push('기다리게 한 정도');
    return g;
  }

  /* ───── 엑셀(.xlsx) 만들기 — 외부 프로그램 없이(압축 없는 zip + 엑셀 표 형식) ─────
     sheets: [{ name, cols: [너비], rows: [[값 또는 { v, s }]] }] · 숫자는 숫자 칸 · s: 1 굵게 · 2 머리줄 · 3 어려운 상담 칸 · 4 링크 글씨 */
  var CRC = null;
  function crc32(b) { if (!CRC) { CRC = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; } } var x = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) x = CRC[(x ^ b[i]) & 255] ^ (x >>> 8); return (x ^ 0xFFFFFFFF) >>> 0; }
  function zip(files) {
    var enc = new TextEncoder(), parts = [], cen = [], off = 0;
    var u16 = function (v) { return [v & 255, (v >>> 8) & 255]; }, u32 = function (v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; };
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
      var head = [].concat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
      parts.push(new Uint8Array(head), name, data);
      cen.push(new Uint8Array([].concat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off))), name);
      off += head.length + name.length + data.length;
    });
    var cs = cen.reduce(function (s, a) { return s + a.length; }, 0);
    var end = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cs), u32(off), u16(0)));
    var all = parts.concat(cen, [end]), size = all.reduce(function (s, a) { return s + a.length; }, 0), out = new Uint8Array(size), p = 0;
    all.forEach(function (a) { out.set(a, p); p += a.length; });
    return out;
  }
  function esc(s) { return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function colName(i) { var s = ''; i++; while (i) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function sheetXml(sh) {
    var cols = (sh.cols || []).map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('');
    var rows = sh.rows.map(function (row, ri) {
      return '<row r="' + (ri + 1) + '">' + row.map(function (c, ci) {
        var v = c && typeof c === 'object' ? c.v : c, s = c && typeof c === 'object' && c.s ? ' s="' + c.s + '"' : '', ref = colName(ci) + (ri + 1);
        if (v == null || v === '') return s ? '<c r="' + ref + '"' + s + '/>' : '';
        if (typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '"' + s + '><v>' + v + '</v></c>';
        return '<c r="' + ref + '"' + s + ' t="inlineStr"><is><t xml:space="preserve">' + esc(v) + '</t></is></c>';
      }).join('') + '</row>';
    }).join('');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"' + (sh.freeze ? '><pane ySplit="' + sh.freeze + '" topLeftCell="A' + (sh.freeze + 1) + '" activePane="bottomLeft" state="frozen"/></sheetView>' : '/>') + '</sheetViews>' + (cols ? '<cols>' + cols + '</cols>' : '') + '<sheetData>' + rows + '</sheetData></worksheet>';
  }
  function xlsx(sheets) {
    var ns = 'http://schemas.openxmlformats.org/', used = {};
    var names = sheets.map(function (s) { var n = String(s.name).replace(/[\\\/?*\[\]:]/g, ' ').slice(0, 31) || '시트'; while (used[n]) n = n.slice(0, 29) + '_' + Object.keys(used).length; used[n] = 1; return n; });
    var files = [
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="' + ns + 'package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') + '</Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="' + ns + 'package/2006/relationships"><Relationship Id="rId1" Type="' + ns + 'officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="' + ns + 'spreadsheetml/2006/main" xmlns:r="' + ns + 'officeDocument/2006/relationships"><sheets>' + names.map(function (n, i) { return '<sheet name="' + esc(n) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="' + ns + 'package/2006/relationships">' + sheets.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="' + ns + 'officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') + '<Relationship Id="rId' + (sheets.length + 1) + '" Type="' + ns + 'officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: 'xl/styles.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="' + ns + 'spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="맑은 고딕"/></font><font><b/><sz val="11"/><name val="맑은 고딕"/></font><font><u/><sz val="11"/><color rgb="FF0563C1"/><name val="맑은 고딕"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE2EFDA"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF4D6"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' }
    ];
    sheets.forEach(function (s, i) { files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: sheetXml(s) }); });
    return zip(files);
  }
  var r1 = function (v) { return v == null ? null : Math.round(v * 10) / 10; }, r2 = function (v) { return v == null ? null : Math.round(v * 100) / 100; };
  // 받은 점수 · 숫자로 시트 5개(점수표 · 날짜별 · 주별 · 문의 분류 · 확인할 것)
  function workbook(R, M, info) {
    var H = function (a) { return a.map(function (v) { return { v: v, s: 2 }; }); }, mn = Number(R.month.slice(5)) + '월';
    var title = mn + ' 이달의 상담사 · ' + md(R.keys[0]) + ' ~ ' + md(R.keys[R.keys.length - 1]) + ' · ' + (info.fin ? '확정' : '확정 전') + ' · 받은 시각 ' + (info.at || '');
    var score = { name: '점수표', freeze: 2, cols: [6, 10, 7, 6, 22, 11, 11, 13, 13, 13, 13, 10, 8, 11, 8, 13, 15, 8, 10, 13, 11, 13, 13, 30], rows: [[{ v: title, s: 1 }],
      H(['등수', '상담사', '합계', '등급', '추천 제외', '시간당 기록', '시간당 응대', '하루 평균 기록', '20분 넘김(%)', '평균 대기(분)', '가장 긴 대기(분)', 'OT(시간)', '기록', '기록(참작 뒤)', '응대', '어려운 상담(%)', '어려운 상담 참작(%)', '근무일', '근무시간', '생산성 점수', 'QA 감점 건수', 'QA 감점', '메모'])] };
    R.rows.forEach(function (r) { score.rows.push([r.out.length ? '' : r.rank, r.n, r.score, r.grade, r.out.join(' / '), r2(r.rph), r2(r.rsp), r1(r.dpd), r.latePct == null ? null : r1(r.latePct * 100), r.wait == null ? null : Math.round(r.wait), Math.round(r.maxWait || 0), r1(r.ot / 60), r.rec, r1(r.wrec), r.resp, r.hardPct == null ? null : Math.round(r.hardPct * 100), r1(r.hardBonus), r.work, Math.round(r.hours), r.prod, r.qa.length + r.qaOld.er + r.qaOld.nt, Math.round(r.adj), r.in.memo || '']); });
    score.rows.push([]); score.rows.push([{ v: '배점', s: 1 }, '시간당 기록 ' + R.C.wRph + ' · 시간당 응대 ' + R.C.wRsp + ' · 하루 평균 기록 ' + R.C.wDpd + ' · 기다리게 한 정도 ' + R.C.wLate + ' · OT 기여 ' + R.C.wOt + ' (항목마다 1등이 만점)']);
    score.rows.push([{ v: 'QA 감점', s: 1 }, QT.filter(function (q) { return !q[4]; }).map(function (q) { return q[1] + ' ' + (R.C[q[2]] || 0); }).join(' · ') + ' · 합계 = 생산성 점수 + QA 감점']);
    score.rows.push([{ v: '참작', s: 1 }, '어려운 상담(' + HARD_LABEL + ') 비율이 팀 평균보다 10%p 높을 때마다 기록 +' + R.C.hardStep + '%, 최대 +' + R.C.hardMax + '%']);
    var daily = { name: '날짜별', freeze: 1, cols: [10, 12, 8, 8, 10, 12, 8], rows: [H(['상담사', '날짜', '기록', '응대', '답한 고객', '20분 넘김', '보류'])] };
    R.rows.forEach(function (r) { R.keys.forEach(function (d) { var v = r.o.days[d] || {}, rd = (r.o.respDay || {})[d] || {}, hold = 0, dd = (M.days || {})[d] || {}; Object.keys(dd).forEach(function (k) { if ((info.P || String)(k) === r.n) hold += num((dd[k] || {}).holds); }); if (!(v.rec || rd.resp || v.ans || v.lateN || hold)) return; daily.rows.push([r.n, d, Math.max(0, (v.rec || 0) - (v.dup || 0)), rd.resp || 0, v.ans || 0, v.lateN || 0, hold]); }); });
    var wdays = R.keys.filter(function (d) { return W.day(d, M.wcfg || {}); }), wks = []; wdays.forEach(function (d) { var w = wkOf(d); if (wks.indexOf(w) < 0) wks.push(w); }); // 근무일이 있는 주만(1일이 일요일이면 빈 주가 생기지 않게)
    var weekly = { name: '주별', freeze: 1, cols: [10].concat(wks.map(function () { return 14; }), [8]), rows: [H(['상담사'].concat(wks.map(function (w, i) { var ds = wdays.filter(function (d) { return wkOf(d) === w; }); return (i + 1) + '주 ' + md(ds[0]) + '~' + md(ds[ds.length - 1]); }), ['합계']))] };
    R.rows.forEach(function (r) { weekly.rows.push([r.n].concat(wks.map(function (w) { var n = 0; R.keys.forEach(function (d) { if (wkOf(d) !== w) return; var v = r.o.days[d] || {}; n += Math.max(0, (v.rec || 0) - (v.dup || 0)); }); return n; }), [r.rec])); });
    var all = {}; R.rows.forEach(function (r) { Object.keys(r.cats || {}).forEach(function (c) { all[c] = (all[c] || 0) + r.cats[c]; }); });
    var cl = Object.keys(all).sort(function (a, b) { return all[b] - all[a] || a.localeCompare(b, 'ko'); });
    var cats = { name: '문의 분류', freeze: 1, cols: [10].concat(cl.map(function () { return 12; }), [8, 14, 8, 8, 8]), rows: [H(['상담사'].concat(cl, ['합계', '어려운 상담(%)', '카톡', '톡톡', '게시판']))] };
    R.rows.forEach(function (r) { cats.rows.push([r.n].concat(cl.map(function (c) { var n = (r.cats || {})[c] || 0; return isHard(c) ? { v: n, s: 3 } : n; }), [r.catN, r.hardPct == null ? null : Math.round(r.hardPct * 100), r.k, r.nv, r.bd])); });
    var chk = { name: '확인할 것', freeze: 1, cols: [10, 60, 22, 10, 60], rows: [H(['상담사', '내용', '기간', '일수', '상담 링크'])] };
    R.rows.forEach(function (r) { r.flags.forEach(function (f) { chk.rows.push([r.n, f.t + (f.more && f.more.note ? ' ' + f.more.note : '')]); if (f.more && f.more.long) f.more.long.forEach(function (c) { chk.rows.push([r.n, '오래 남은 상담 · ' + (c.ch === 'naver' ? '톡톡' : '카톡') + (c.h ? ' 보류 탭' : ''), md(c.from) + ' ~ ' + md(c.to), c.days, c.u ? { v: c.u, s: 4 } : '']); }); }); });
    if (chk.rows.length === 1) chk.rows.push(['', '확인할 것이 없어요']);
    var qa = { name: 'QA 감점', freeze: 1, cols: [8, 10, 12, 8, 50, 50, 50, 16], rows: [H(['날짜', '상담사', '종류', '감점', '무엇이 틀렸나', '상담 링크', '이렇게 했어야 해요', '상담사 확인'])] };
    var qall = []; R.rows.forEach(function (r) { r.qa.forEach(function (e) { qall.push(e); }); if (r.qaOld.er) qa.rows.push(['', r.n, '오안내·오처리(숫자로 넣음)', Math.round(r.qaOld.er * R.C.qWi), r.qaOld.er + '건', '']); if (r.qaOld.nt) qa.rows.push(['', r.n, '공지 미반영(숫자로 넣음)', Math.round(r.qaOld.nt * R.C.qNt), r.qaOld.nt + '건', '']); });
    qall.sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : (a.at || 0) - (b.at || 0); }).forEach(function (e) { var q = QTN[e.t]; qa.rows.push([md(e.d), (info.P || function (n) { return n; })(e.n), q[1], R.C[q[2]] || 0, e.memo || '', e.u ? { v: e.u, s: 4 } : '', e.fix || '', e.ack ? '확인 ' + when(e.ack) : e.sent ? '보냄 · 확인 전' : '안 보냄']); });
    if (qa.rows.length === 1) qa.rows.push(['', '', 'QA 감점이 없어요']);
    return [score, daily, weekly, cats, chk, qa];
  }

  /* ───── 화면 ───── */
  var A = function () { return root.KBAdminApp; }, T = function () { return root.KBTeam; };
  function mk(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function btn(label, cls, fn) { var b = mk('button', 'btn ' + (cls || 'ghost'), label); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; }
  function say(t, k) { if (A()) A().say(t, k); }
  function monthOf(period) { var td = W.dayKey(Date.now()); return period === 'lmonth' ? W.addDays(td.slice(0, 8) + '01', -1).slice(0, 7) : td.slice(0, 7); }
  var incCache = null, incAt = 0;
  async function getInc(force) {
    if (!force && incCache && Date.now() - incAt < 120000) return incCache;
    var tok = await T().adminToken(); if (!tok) throw new Error('관리 열쇠(깃허브 연결)가 있어야 볼 수 있어요');
    var r = await CSTeam.call('inc.get', { adminToken: tok }); if (!r || !r.ok) throw new Error((r && r.error) || '팀 서버 1.3.16 이상이 필요해요');
    incCache = r.inc || {}; incAt = Date.now(); return incCache;
  }
  async function setInc(patch) { var r = await CSTeam.call('inc.set', Object.assign({ adminToken: await T().adminToken() }, patch)); if (!r || !r.ok) throw new Error((r && r.error) || '저장하지 못했어요'); incCache = r.inc; incAt = Date.now(); return r.inc; }
  // 팀장 [빼기]를 팀 서버에도(PC를 바꿔도 같게) — admin-team3.js skipSet이 부름 · 팀 현황을 그릴 때 팀 서버 것을 이 PC로 합침
  // 2026-11-01 합친 판: [되돌리기]·[다시 보기]로 지운 건 팀 서버 답이 오기 전에 다시 합쳐지지 않게(지운 표시를 이 PC에 남김)
  var DEL_KEY = 'kb:team:skipdel';
  function delGet() { try { var o = JSON.parse(localStorage.getItem(DEL_KEY) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
  function delPut(o) { try { localStorage.setItem(DEL_KEY, JSON.stringify(o)); } catch (e) {} }
  function pushSkip(key, v) {
    var del = delGet(); if (v) delete del[key]; else del[key] = Date.now(); delPut(del);
    if (!root.CSTeam) return; T().adminToken().then(function (tok) { if (tok) return CSTeam.call('inc.set', { adminToken: tok, skip: { key: key, v: v || null } }); }).then(function (r) { if (r && r.ok) { incCache = r.inc; incAt = Date.now(); } }).catch(function () {});
  }
  async function pullSkip() {
    try {
      var inc = await getInc(), sv = inc.skip || {}, loc = {}; try { loc = JSON.parse(localStorage.getItem('kb:team:skip') || '{}') || {}; } catch (e) {}
      var del = delGet(), dch = 0, add = 0;
      Object.keys(del).forEach(function (k) { if (!sv[k] || Date.now() - del[k] > 62 * 864e5) { delete del[k]; dch++; } }); if (dch) delPut(del);
      Object.keys(sv).forEach(function (k) { if (!loc[k] && !del[k]) { loc[k] = sv[k]; add++; } }); if (add) localStorage.setItem('kb:team:skip', JSON.stringify(loc));
    } catch (e) {}
  }
  var period = 'month', picked = false;
  async function render(r, st) {
    var box = mk('div', 'tview tinc');
    var inc; try { inc = await getInc(); } catch (e) { box.append(mk('div', 'empty', e.message)); return box; }
    var td = W.dayKey(Date.now()), lm = monthOf('lmonth'), tm = monthOf('month'), hasLm = lm >= START;
    // 지난달 확정 전이면 처음엔 지난달부터(12월 초에 11월 정산) · 10월 이전은 고를 수 없음
    if (!picked) period = hasLm && !((inc.months || {})[lm] || {}).final ? 'lmonth' : 'month';
    if (!hasLm) period = 'month';
    var nav = mk('div', 'ins bper iper'); nav.append(mk('span', null, '기간'));
    [hasLm ? ['lmonth', '지난달 (' + Number(lm.slice(5)) + '월)'] : null, ['month', '이번 달 (' + Number(tm.slice(5)) + '월)']].filter(Boolean).forEach(function (f) { var b = mk('button', period === f[0] ? 'on' : null, f[1]); b.type = 'button'; b.addEventListener('click', function () { period = f[0]; picked = true; st.again(); }); nav.append(b); });
    box.append(nav);
    var month = monthOf(period), M = await KBTeam3.collect(r, period, st.maxAge), ot = [];
    try { ot = (await CSTeam.get('ot.list', { from: M.keys[0], to: M.keys[M.keys.length - 1] })).items || []; } catch (e) {}
    var R = compute(M, { inc: inc, month: month, ot: ot, P: T().person }), C = R.C, mn = Number(month.slice(5)) + '월', info = monthInfo(month, td, M.wcfg);
    var fin = ((inc.months || {})[month] || {}).final;
    if (fin) nav.append(mk('span', 'tag w', '확정 ' + new Date(fin.at).toLocaleDateString('ko-KR')));
    else if (period === 'month') nav.append(mk('span', 'prog', '진행 중 · 매일 새로 세요'));
    else nav.append(mk('span', 'draft', '아직 확정 안 했어요'));
    nav.append(mk('span', 'muted', period === 'month' ? md(td) + '까지 · 근무일 ' + info.passed + '일 지남 · 남은 근무일 ' + info.left + '일 · ' + (info.last ? md(info.last) + '에 확정' : '') : md(M.keys[0]) + ' ~ ' + md(M.keys[M.keys.length - 1]) + ' · 근무일 ' + info.passed + '일'));
    if (!R.rows.length) { box.append(mk('div', 'empty', '이 기간 숫자가 아직 없어요.')); return box; }
    // 맨 위 추천
    var hero = mk('div', 'ihero'), rk = mk('div', 'irank'), why = mk('div', 'why'), live = period === 'month' && !fin;
    rk.append(mk('span', 'crown', mn + (live ? ' 지금까지 1등' : ' 추천')));
    var line = function (nodes) { var p = mk('div'); nodes.forEach(function (n) { p.append(n); }); why.append(p); };
    if (R.pick.length) {
      var p0 = R.pick[0]; rk.append(mk('span', 'who', '🏅 ' + R.pick.map(function (z) { return z.n; }).join(' · ')));
      var sc = mk('span', 'sc', p0.score + '점 '); sc.append(mk('span', 'grade ' + p0.grade.toLowerCase(), p0.grade)); rk.append(sc);
      var nx = R.ok[R.pick.length];
      if (R.pick.length > 1) line([mk('b', null, R.pick.length + '명이 ' + C.tie + '점 안이라 공동 추천이에요.')]);
      else if (nx) line([(p0.rank === 1 ? '2등 ' : '다음 ') + nx.n + '(' + nx.score + '점)와 ', mk('b', null, (p0.score - nx.score) + '점'), ' 차이예요.']);
      var bs = bests(p0, R); line([bs.length ? bs.map(function (b) { return b + ' 1등'; }).join(', ') + '이에요.' : '모든 항목이 고르게 높아요.']);
    } else { rk.append(mk('span', 'who', '추천할 사람 없음')); line(['모두 추천에서 빠졌어요.']); }
    R.rows.filter(function (z) { return z.out.length; }).forEach(function (z) { line([mk('span', 'minus', '추천 제외 '), z.n + ' · ' + z.out.join(', ')]); });
    if (live && info.passed < 10) line([mk('span', 'warn', '아직 날이 적어 순위가 바뀔 수 있어요.')]);
    hero.append(rk, why); box.append(hero);
    // 점수표
    var sp = mk('div', 'tpanel sec'), sh = mk('div', 'tph'); sh.append(mk('b', null, '점수표'), mk('span', 'muted', '근무시간 = 출근한 날 업무시간 + OT · 항목마다 1등이 만점'), mk('span', 'sp'));
    sh.append(btn('⬇ 엑셀로 받기', 'primary sm iexcel', function () { download(R, M, { fin: fin, at: new Date().toLocaleString('ko-KR'), P: T().person }); })); sp.append(sh);
    var tb = mk('table', 'ttable iscore'), tr = mk('tr'); ['등수', '상담사', '합계', '시간당 기록 (' + C.wRph + ')', '시간당 응대 (' + C.wRsp + ')', '하루 평균 기록 (' + C.wDpd + ')', '기다리게 한 정도 (' + C.wLate + ')', 'OT 기여 (' + C.wOt + ')', '생산성 점수', 'QA 감점'].forEach(function (h) { tr.append(mk('th', null, h)); }); tb.append(tr);
    var cell = function (big, smalls) { var c2 = mk('td'); c2.append(mk('b', null, big)); smalls.forEach(function (s) { if (s) c2.append(mk('small', s[1] || null, s[0])); }); return c2; };
    R.rows.forEach(function (z) {
      var t = mk('tr', z.out.length ? 'out' : z.rank === 1 ? 'win' : null), nm = mk('td'); nm.append(z.n + ' ', mk('span', 'grade ' + z.grade.toLowerCase(), z.grade));
      t.append(mk('td', null, z.out.length ? '–' : z.rank + '등'), nm, mk('td', 'tot', String(z.score)));
      t.append(cell(z.rph == null ? '–' : f1(z.rph) + '건', [[f1(z.pts.rph) + '점'], z.hardBonus > 0 ? ['어려운 상담 +' + f1(z.hardBonus) + '%' + (z.capped ? '(한도)' : ''), 'g'] : null]));
      t.append(cell(z.rsp == null ? '–' : f1(z.rsp) + '명', [[f1(z.pts.rsp) + '점']]));
      t.append(cell(z.dpd == null ? '–' : f1(z.dpd) + '건', [[f1(z.pts.dpd) + '점']]));
      t.append(cell(z.latePct == null ? '–' : '20분 넘김 ' + pc(z.latePct), [z.wait != null ? ['평균 ' + Math.round(z.wait) + '분 · 가장 길게 ' + Math.round(z.maxWait || 0) + '분'] : null, [Math.round(z.pts.late) + '점']]));
      t.append(cell(Math.round(z.ot / 60) + '시간', [[f1(z.pts.ot) + '점']]));
      var pr = mk('td'); pr.append(mk('b', null, String(z.prod))); t.append(pr);
      var ad = mk('td'), bits = qaBits(z); if (bits.length) { ad.append(mk('b', 'minus', qaPt(z.adj))); bits.forEach(function (b) { ad.append(mk('small', null, b)); }); } else ad.append('0');
      if (z.out.length) { ad.append(mk('br')); ad.append(mk('span', 'tag', '추천 제외')); }
      t.append(ad); tb.append(t);
    });
    var tw = mk('div', 'twrap'); tw.append(tb); sp.append(tw);
    sp.append(mk('p', 'note', '합계 = 생산성 점수(100점) + QA 감점. QA 감점은 아래 \'QA 감점 기록\'에 적은 건으로 저절로 세요.'));
    sp.append(mk('p', 'note', '어려운 상담(' + HARD_LABEL + ') 비율이 팀 평균보다 높으면 10%p마다 기록을 ' + C.hardStep + '% 더 쳐 줘요. 최대 ' + C.hardMax + '%까지예요.'));
    box.append(sp);
    // 확인할 것
    var fl = []; R.rows.forEach(function (z) { z.flags.forEach(function (x) { fl.push({ r: z, x: x }); }); }); fl.sort(function (a, b) { return (a.x.lv === 'r' ? 1 : 0) - (b.x.lv === 'r' ? 1 : 0); });
    var cp = mk('div', 'tpanel sec'), ch = mk('div', 'tph'); ch.append(mk('b', null, fl.length ? '확인할 것' : '확인할 것 없어요 ✓'), mk('span', 'muted', '점수에는 안 넣어요. 확정 전에 한 번 봐 주세요')); cp.append(ch);
    var chk = mk('div', 'chk'); fl.forEach(function (zz) {
      var row = mk('div', 'r'), body = mk('span', 'ibody'); row.append(mk('span', 'dot' + (zz.x.lv === 'r' ? ' r' : '')), mk('b', null, zz.r.n), body); body.append(zz.x.t);
      var more = zz.x.more || {};
      if (more.note) body.append(mk('div', 'note', more.note));
      if (more.long) more.long.slice(0, 10).forEach(function (c) { var d = mk('div', 'ilong'); if (c.u) { var a = mk('a', 'qlink', '상담 열기'); a.href = c.u; a.target = '_blank'; a.rel = 'noopener noreferrer'; d.append(a, ' '); } d.append((c.ch === 'naver' ? '톡톡' : '카톡') + (c.h ? ' 보류 탭' : '') + ' · ' + md(c.from) + ' ~ ' + md(c.to) + ' · ' + c.days + '일'); body.append(d); });
      if (more.long && more.long.length > 10) body.append(mk('div', 'note', '나머지 ' + (more.long.length - 10) + '건은 엑셀 \'확인할 것\' 시트에 있어요.'));
      if (more.hs) { var dt = mk('details', 'imore'); dt.append(mk('summary', null, '5건 열어 보기')); var bl = mk('div', 'imlist'); samples(zz.r, M, month).forEach(function (s) { var a = mk('a', 'qlink', s.d + ' · ' + s.c + ' · 상담 열기'); a.href = s.u; a.target = '_blank'; a.rel = 'noopener noreferrer'; bl.append(a); }); if (!bl.childNodes.length) bl.append(mk('span', 'muted', '아직 모인 기록이 없어요')); dt.append(bl); row.append(dt); } else row.append(mk('span'));
      chk.append(row);
    }); if (fl.length) cp.append(chk); box.append(cp);
    // 숫자(기록 · 채널 · 응대 · 문의 분류)
    box.append(numTable(R));
    // QA 감점 기록은 왼쪽 메뉴 [QA 피드백]으로 옮김(주인 11/06) · 여기는 한 줄 + 배점
    var qn = mk('div', 'tpanel sec iqago'), qh = mk('div', 'tph'), qs = R.rows.filter(function (z) { return z.adj < 0; });
    qh.append(mk('b', null, 'QA 감점'), mk('span', 'muted', qs.length ? qs.map(function (z) { return z.n + ' ' + qaPt(z.adj); }).join(' · ') : '이번 달 감점 없어요'), mk('span', 'sp'), btn('QA 피드백에서 적기 →', 'ghost sm', function () { var b = document.querySelector('.navx[data-view="qafb"]'); if (b) b.click(); }));
    qn.append(qh); box.append(qn, cfgPanel(R, st));
    // 확정(월말)
    var can = period !== 'month' || info.canFinal || !!fin;
    var fz = mk('div', 'ins bper ifin'); fz.append(mk('span', 'muted', fin ? '확정한 점수표가 팀 서버에 있어요(' + new Date(fin.at).toLocaleString('ko-KR') + ')' : '확정하면 이 점수표가 팀 서버에 남아요'));
    var fb = btn(fin ? '다시 확정하기' : can ? mn + ' 확정하기' : (info.last ? md(info.last) : '마지막 근무일') + '부터 확정할 수 있어요', 'primary', async function () { if (!confirm(mn + ' 점수표를 확정할까요?')) return; try { await setInc({ month: month, final: { rows: R.rows.map(rowOut) } }); say('확정했어요', 'ok'); st.again(); } catch (e) { say(e.message, 'err'); } });
    if (!can) fb.disabled = true; fz.append(fb);
    if (fin) fz.append(btn('확정 풀기', 'ghost', async function () { try { await setInc({ month: month, final: null }); say('확정을 풀었어요', 'ok'); st.again(); } catch (e) { say(e.message, 'err'); } }));
    box.append(fz);
    return box;
  }
  function rowOut(r) { return { n: r.n, score: r.score, grade: r.grade, rank: r.out.length ? 0 : r.rank, out: r.out.join(', '), rph: r2(r.rph), rsp: r2(r.rsp), dpd: r1(r.dpd), late: r.latePct == null ? null : r1(r.latePct * 100), wait: r.wait == null ? null : Math.round(r.wait), ot: r1(r.ot / 60), rec: r.rec, resp: r.resp, work: r.work, hours: Math.round(r.hours), hard: r.hardPct == null ? null : Math.round(r.hardPct * 100), hardBonus: r1(r.hardBonus), prod: r.prod, qa: r.qa.length, adj: Math.round(r.adj), flags: r.flags.length }; }
  function numTable(R) {
    var p = mk('div', 'tpanel sec'), h = mk('div', 'tph'); h.append(mk('b', null, '숫자'), mk('span', 'muted', '같은 고객은 한 주에 1건 · 노란 칸 = 어려운 상담')); p.append(h);
    var all = {}; R.rows.forEach(function (z) { Object.keys(z.cats || {}).forEach(function (c) { all[c] = (all[c] || 0) + z.cats[c]; }); });
    var cl = Object.keys(all).sort(function (a, b) { return all[b] - all[a] || a.localeCompare(b, 'ko'); }), shown = cl.slice(0, 7), rest = cl.slice(7);
    var tb = mk('table', 'ttable tcatt'), tr = mk('tr'); ['상담사', '기록', '카톡 · 톡톡 · 게시판', '응대'].concat(shown, rest.length ? ['그 밖'] : [], ['어려운 상담']).forEach(function (x) { tr.append(mk('th', null, x)); }); tb.append(tr);
    R.rows.forEach(function (z) {
      var t = mk('tr'); t.append(mk('td', null, z.n)); var b1 = mk('td'); b1.append(mk('b', null, String(z.rec))); t.append(b1, mk('td', null, z.k + ' · ' + z.nv + ' · ' + z.bd)); var b2 = mk('td'); b2.append(mk('b', null, String(z.resp))); t.append(b2);
      shown.forEach(function (c) { var n = (z.cats || {})[c] || 0; t.append(mk('td', isHard(c) ? 'hardc' : null, n ? String(n) : '')); });
      if (rest.length) { var rn = rest.reduce(function (s, c) { return s + ((z.cats || {})[c] || 0); }, 0); t.append(mk('td', null, rn ? String(rn) : '')); }
      t.append(mk('td', null, pc(z.hardPct))); tb.append(t);
    });
    var tw = mk('div', 'twrap'); tw.append(tb); p.append(tw);
    if (!cl.length) p.append(mk('div', 'pnone', '문의 분류 기록이 없어요'));
    return p;
  }
  function qaPt(v) { v = Math.round(v); return v < 0 ? '−' + (-v) + '점' : v + '점'; }
  function qaBits(z) { var b = []; QT.forEach(function (q) { if (z.qaN[q[0]] && !q[4]) b.push(q[1] + ' ' + z.qaN[q[0]]); }); if (z.qaOld.er) b.push('숫자로 넣은 오안내·오처리 ' + z.qaOld.er); if (z.qaOld.nt) b.push('숫자로 넣은 공지 미반영 ' + z.qaOld.nt); return b; }
  function qaTag(t) { var q = QTN[t]; return mk('span', 'qty' + q[3], q[1]); }
  function when(t) { var x = new Date(t + 9 * 3600e3); return (x.getUTCMonth() + 1) + '/' + x.getUTCDate() + ' ' + String(x.getUTCHours()).padStart(2, '0') + ':' + String(x.getUTCMinutes()).padStart(2, '0'); }
  function qaLink(u) { var a = mk('a', 'qlink', '상담 열기'); a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; }
  // 2026-11-06 QA 감점 기록: 상담사마다 접고 펼치기(감점 많은 순) · 펼친 곳에서 바로 추가 · 지우기
  // 주인 11/06: 팀 현황 · 근무 달력처럼 왼쪽 메뉴에 따로 [QA 피드백](이달의 상담사 탭에 안 들어가도 되게)
  var qaOpen = {}, qaMonth = '';
  function qaRows(inc, month, names) {
    var C = cfgOf(inc), P = T().person, mm = (inc.months || {})[month] || {}, people = mm.people || {}, all = (mm.qa || []).filter(function (x) { return x && QTN[x.t]; }), set = {};
    names.forEach(function (n) { if (n && n !== '팀장') set[P(n)] = 1; }); all.forEach(function (x) { set[P(x.n)] = 1; }); Object.keys(people).forEach(function (n) { if (num(people[n].er) || num(people[n].nt)) set[P(n)] = 1; });
    return { C: C, rows: Object.keys(set).map(function (n) {
      var r = { n: n, qa: all.filter(function (z) { return P(z.n) === n; }).sort(function (a, b) { return a.d < b.d ? 1 : a.d > b.d ? -1 : (b.at || 0) - (a.at || 0); }), qaN: {} }, x = people[n] || {};
      r.qa.forEach(function (z) { r.qaN[z.t] = (r.qaN[z.t] || 0) + 1; }); r.qaOld = { er: num(x.er), nt: num(x.nt) };
      r.adj = r.qa.reduce(function (s2, z) { return s2 + (C[QTN[z.t][2]] || 0); }, 0) + r.qaOld.er * C.qWi + r.qaOld.nt * C.qNt; return r;
    }) };
  }
  async function qaView(w) {
    var title = 'QA 피드백';
    w.replaceChildren(mk('h2', null, title), mk('p', 'desc', '틀린 상담을 한 건씩 적어요. [상담사에게 보내기]를 누르면 그 사람 [내 피드백]에 떠요.'), mk('div', 'empty', '불러오는 중…'));
    if (!(await T().ensureUrl())) { T().needServer(w, title); return; }
    var inc, extra = [];
    try { inc = await getInc(); } catch (e) { w.lastChild.textContent = e.message; return; }
    try { var tg = await CSTeam.get('team.get', { days: 31 }); Object.keys(tg.days || {}).forEach(function (d) { Object.keys(tg.days[d] || {}).forEach(function (n) { extra.push(n); }); }); } catch (e) {}
    var names = []; try { names = await KBTeam2.teamNames(extra); } catch (e) { names = extra; }
    var tm = W.dayKey(Date.now()).slice(0, 7), months = [tm]; for (var i = 1; i < 12; i++) { var m = W.addDays(months[i - 1] + '-01', -1).slice(0, 7); if (m < START) break; months.push(m); }
    if (months.indexOf(qaMonth) < 0) qaMonth = tm;
    var bar = mk('div', 'ins bper qamon'), sel = mk('select'); sel.setAttribute('aria-label', '달 고르기');
    months.forEach(function (m) { var o = mk('option', null, m.slice(0, 4) + '년 ' + Number(m.slice(5)) + '월'); o.value = m; if (m === qaMonth) o.selected = true; sel.append(o); });
    sel.addEventListener('change', function () { qaMonth = sel.value; qaView(w); });
    bar.append(mk('span', null, '달'), sel, mk('span', 'muted', '그 달에 적은 건만 보여요 · 상담사를 누르면 펼쳐져요'));
    var R = qaRows(inc, qaMonth, names); R.month = qaMonth;
    var box = mk('div', 'tview tinc'); box.append(qaPanel(R, qaMonth, { again: function () { qaView(w); } }));
    w.replaceChildren(mk('h2', null, title), w.children[1] || mk('p'), bar, box);
  }
  (function reg() { if (typeof document === 'undefined') return; if (!root.KBAdminExtra || !root.KBTeam || !root.KBTeam2) return setTimeout(reg, 60); KBAdminExtra.views.qafb = qaView; })();
  function qaPanel(R, month, st) {
    var p = mk('div', 'tpanel sec iqa'), h = mk('div', 'tph'), C = R.C, mn = Number(month.slice(5)) + '월';
    var accs = [];
    h.append(mk('b', null, 'QA 감점 기록 · ' + month.slice(0, 4) + '년 ' + mn), mk('span', 'muted', '상담사를 누르면 펼쳐져요 · 상담사 화면에는 안 보여요'), mk('span', 'sp'));
    h.append(btn('모두 펼치기', 'ghost sm', function () { var all = accs.every(function (d) { return d.open; }); accs.forEach(function (d) { d.open = !all; }); }));
    p.append(h);
    var td = W.dayKey(Date.now()), defD = td.slice(0, 7) === month ? td : (month < td.slice(0, 7) ? W.addDays(W.addDays(month + '-01', 40).slice(0, 8) + '01', -1) : month + '-01');
    R.rows.slice().sort(function (a, b) { return a.adj - b.adj || b.qa.length - a.qa.length || (a.n > b.n ? 1 : -1); }).forEach(function (z) {
      var d = mk('details', 'qacc'), sm = mk('summary'), bits = qaBits(z), cnt = z.qa.length + z.qaOld.er + z.qaOld.nt; d.open = !!qaOpen[z.n];
      d.addEventListener('toggle', function () { qaOpen[z.n] = d.open; });
      sm.append(mk('b', null, z.n), mk('span', 'qpt' + (z.adj < 0 ? '' : ' z'), qaPt(z.adj)));
      var chips = mk('span', 'qchips'); QT.forEach(function (q) { if (z.qaN[q[0]]) chips.append(mk('span', 'qty' + q[3], q[1] + ' ' + z.qaN[q[0]])); }); if (!bits.length) chips.append(mk('span', 'muted', '감점 없어요 ✓'));
      if (z.qaOld.er || z.qaOld.nt) chips.append(mk('span', 'qty', '숫자로 넣은 ' + (z.qaOld.er + z.qaOld.nt)));
      sm.append(chips, mk('span', 'muted', cnt + '건')); d.append(sm);
      var bd = mk('div', 'qbd');
      if (z.qa.length) {
        var tb = mk('table', 'ttable'), tr = mk('tr'); ['날짜', '종류', '감점', '무엇이 틀렸나 · 이렇게 했어야 해요', '상담', '상담사에게', ''].forEach(function (x) { tr.append(mk('th', null, x)); }); tb.append(tr);
        z.qa.forEach(function (e) {
          var t = mk('tr'), c1 = mk('td'), c3 = mk('td', 'qmemo'), c4 = mk('td'), c5 = mk('td'), c6 = mk('td'); c1.append(qaTag(e.t)); if (e.u) c5.append(qaLink(e.u)); else c5.append('–');
          c3.append(e.memo || '–'); if (e.fix) c3.append(mk('div', 'qfix', '→ ' + e.fix));
          if (e.ack) c6.append(mk('span', 'qst r', '✓ 확인 ' + when(e.ack))); else if (e.sent) c6.append(mk('span', 'qst s', '보냄 ' + when(e.sent) + ' · 아직 확인 전'));
          else { var sb = btn('보내기', 'primary sm qsend', async function () { if (!confirm(z.n + ' 님에게 이 피드백을 보낼까요? 검색기 [내 피드백]에 떠요.')) return; sb.disabled = true; try { await setInc({ qa: { send: e.id } }); say('보냈어요', 'ok'); st.again(); } catch (er) { say(er.message, 'err'); sb.disabled = false; } }); c6.append(sb); }
          var del = btn('지우기', 'ghost sm', async function () { if (!confirm(z.n + ' · ' + md(e.d) + ' ' + QTN[e.t][1] + (QTN[e.t][4] ? ' 제안을' : ' 감점을') + ' 지울까요?' + (e.sent ? ' 상담사 [내 피드백]에서도 빠져요.' : ''))) return; del.disabled = true; try { await setInc({ qa: { del: e.id } }); say('지웠어요', 'ok'); st.again(); } catch (er) { say(er.message, 'err'); del.disabled = false; } });
          c4.append(del);
          t.append(mk('td', null, md(e.d)), c1, QTN[e.t][4] ? mk('td', 'muted', '–') : mk('td', 'minus', qaPt(C[QTN[e.t][2]] || 0)), c3, c5, c6, c4); tb.append(t);
        });
        var tw = mk('div', 'twrap'); tw.append(tb); bd.append(tw);
      } else bd.append(mk('div', 'note', '적은 감점이 없어요.'));
      if (z.qaOld.er || z.qaOld.nt) bd.append(mk('div', 'note', '예전에 숫자로 넣은 것: ' + [z.qaOld.er ? '오안내·오처리 ' + z.qaOld.er + '건(' + qaPt(z.qaOld.er * C.qWi) + ')' : '', z.qaOld.nt ? '공지 미반영 ' + z.qaOld.nt + '건(' + qaPt(z.qaOld.nt * C.qNt) + ')' : ''].filter(Boolean).join(' · ')));
      // 바로 추가
      var f = mk('div', 'qadd'), di = mk('input'), ts = mk('select'), ui = mk('input'), mi = mk('textarea'), fi = mk('textarea');
      di.type = 'date'; di.value = defD; di.setAttribute('aria-label', z.n + ' 날짜');
      var o0 = mk('option', null, '종류 고르기'); o0.value = ''; ts.append(o0); QT.forEach(function (q) { var o = mk('option', null, q[1] + (q[4] ? ' (감점 없음)' : ' (' + (C[q[2]] || 0) + ')')); o.value = q[0]; ts.append(o); }); ts.setAttribute('aria-label', z.n + ' 종류');
      ui.type = 'url'; ui.placeholder = '상담 링크 (https://…)'; ui.maxLength = 300; ui.setAttribute('aria-label', z.n + ' 상담 링크');
      mi.placeholder = '고객 이름·전화번호는 적지 마세요'; mi.setAttribute('aria-label', z.n + ' 무엇이 틀렸나');
      fi.placeholder = '예: 단순 변심 반품은 받은 날부터 7일로 안내'; fi.setAttribute('aria-label', z.n + ' 이렇게 했어야 해요');
      var go = async function (send, b) {
        if (!di.value || !ts.value) { say('날짜와 종류를 골라 주세요', 'err'); return; }
        var lim = await qaLimit(); if (mi.value.trim().length > lim || fi.value.trim().length > lim) { say(qaLimMsg(lim), 'err'); return; }
        if (send && !mi.value.trim()) { say('상담사에게 보낼 때는 ' + (QTN[ts.value][4] ? '아쉬웠던 점' : '무엇이 틀렸나') + '을 적어 주세요', 'err'); return; }
        add.disabled = addS.disabled = true; qaOpen[z.n] = true;
        try { await setInc({ qa: { add: { n: z.n, d: di.value, t: ts.value, u: ui.value.trim(), memo: mi.value.trim(), fix: fi.value.trim(), send: !!send } } }); say((di.value.slice(0, 7) === month ? '' : Number(di.value.slice(5, 7)) + '월 기록에 ') + (send ? '추가하고 ' + z.n + ' 님에게 보냈어요' : '추가했어요'), 'ok'); st.again(); } catch (er) { say(er.message, 'err'); add.disabled = addS.disabled = false; }
      };
      var add = btn('추가만', 'ghost sm qonly', function () { go(false); }), addS = btn('추가 후 상담사에게 보내기', 'primary sm qaddsend', function () { go(true); });
      var two = mk('div', 'qtwo'), l1 = mk('label'), l2 = mk('label'), s1 = mk('span', null, '무엇이 틀렸나'), s2 = mk('span', null, '이렇게 했어야 해요 (상담사에게 같이 가요)'); l1.append(s1, mi, qaCount(mi)); l2.append(s2, fi, qaCount(fi)); two.append(l1, l2);
      ts.addEventListener('change', function () { var fr = QTN[ts.value] && QTN[ts.value][4]; s1.textContent = fr ? '아쉬웠던 점' : '무엇이 틀렸나'; s2.textContent = (fr ? '이렇게 하면 더 좋아요' : '이렇게 했어야 해요') + ' (상담사에게 같이 가요)'; fi.placeholder = fr ? '예: 교환 안내 때 접수 링크를 같이 보내면 고객이 덜 헤매요' : '예: 단순 변심 반품은 받은 날부터 7일로 안내'; });
      var acts = mk('div', 'qacts'); acts.append(add, addS);
      f.append(di, ts, ui); bd.append(f, two, acts); d.append(bd); accs.push(d); p.append(d);
    });
    p.append(mk('p', 'note', '감점이 많은 사람부터 보여요 · 보낸 건만 상담사 검색기 [내 피드백]에 떠요(점수는 안 보여요) · ' + QT.map(function (q) { return q[1] + ' ' + (q[4] ? '감점 없음' : qaPt(C[q[2]] || 0)); }).join(' · ') + ' · 추천에서 빼지는 않아요 · 그 건의 날짜가 속한 달에 들어가요'));
    return p;
  }
  function cfgPanel(R, st) {
    var d = mk('details', 'tdet'), C = R.C, ins = {}; d.append(mk('summary', null, '배점 바꾸기 (팀 서버에 저장 · 상담사에게 안 보여요)'));
    var g = mk('div', 'icfg'); CFG_LABEL.forEach(function (x) { var l = mk('label'), i = mk('input'); i.type = 'number'; i.step = 'any'; i.value = C[x[0]]; ins[x[0]] = i; l.append(mk('span', null, x[1]), i); g.append(l); });
    d.append(g, btn('배점 저장', 'primary sm', async function () { var c = {}; Object.keys(ins).forEach(function (k) { c[k] = Number(ins[k].value); }); try { await setInc({ cfg: c }); say('배점을 저장했어요', 'ok'); st.again(); } catch (e) { say(e.message, 'err'); } }), btn('기본값으로', 'ghost sm', async function () { try { await setInc({ cfg: {} }); say('기본값으로 돌렸어요', 'ok'); st.again(); } catch (e) { say(e.message, 'err'); } }));
    return d;
  }
  // 어려운 상담 표본: 달마다 같은 5건(이름 순서로 섞음)
  function samples(z, M, month) {
    var all = []; M.keys.forEach(function (d) { var qd = (M.q.days || {})[d] || {}; Object.keys(qd).forEach(function (k) { if (T().person(k) !== z.n) return; (qd[k].hs || []).forEach(function (s) { all.push({ d: md(d), c: s.c, u: s.u }); }); }); });
    var seed = 0, key = month + z.n; for (var i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) >>> 0;
    var rnd = function () { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
    for (var j = all.length - 1; j > 0; j--) { var k = Math.floor(rnd() * (j + 1)), t = all[j]; all[j] = all[k]; all[k] = t; }
    return all.slice(0, 5);
  }
  function download(R, M, info) {
    try {
      var bytes = xlsx(workbook(R, M, info)), a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); a.download = '이달의상담사_' + R.month + '.xlsx';
      document.body.append(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    } catch (e) { say('엑셀 파일을 만들지 못했어요: ' + e.message, 'err'); }
  }
  // 면담 화면 '근거: QA 감점' 칸: 고른 기간(keys) 안의 그 사람 건만 · 관리 열쇠가 있을 때만
  async function qaEvidence(who, keys) {
    var inc = await getInc(), C = cfgOf(inc), P = T().person, ks = {}, out = []; keys.forEach(function (k) { ks[k] = 1; });
    Object.keys(inc.months || {}).forEach(function (m) { (inc.months[m].qa || []).forEach(function (e) { if (e && QTN[e.t] && ks[e.d] && P(e.n) === who) out.push({ d: e.d, t: e.t, label: QTN[e.t][1], m: QTN[e.t][3], free: !!QTN[e.t][4], pt: C[QTN[e.t][2]] || 0, u: e.u || '', memo: e.memo || '', fix: e.fix || '', sent: e.sent || 0, ack: e.ack || 0, at: e.at || 0 }); }); });
    return out.sort(function (a, b) { return a.d < b.d ? 1 : a.d > b.d ? -1 : b.at - a.at; });
  }
  async function qaLine(who, keys, el) {
    try {
      if (!root.CSTeam || !CSTeam.ready() || !keys || !keys.length) return;
      var L = await qaEvidence(who, keys), tot = L.reduce(function (s2, e) { return s2 + e.pt; }, 0), nP = L.filter(function (e) { return !e.free; }).length, nS = L.length - nP;
      el.replaceChildren(); el.hidden = false;
      var hh = mk('div', 'tph'); hh.append(mk('b', null, (nP ? '근거: QA 감점 ' + nP + '건 (' + qaPt(tot) + ')' : '근거: QA 감점 없어요 ✓') + (nS ? ' · 제안 ' + nS + '건' : '')), mk('span', 'muted', '고른 기간 안의 건 · 상담 링크로 같이 열어 봐요')); el.append(hh);
      if (!L.length) return;
      var tb = mk('table', 'ttable'), tr = mk('tr'); ['날짜', '종류', '감점', '무엇이 틀렸나 · 이렇게 했어야 해요', '상담', '본인 확인'].forEach(function (x) { tr.append(mk('th', null, x)); }); tb.append(tr);
      L.forEach(function (e) { var t = mk('tr'), c1 = mk('td'), c3 = mk('td', 'qmemo'), c5 = mk('td'); c1.append(qaTag(e.t)); if (e.u) c5.append(qaLink(e.u)); else c5.append('–'); c3.append(e.memo || '–'); if (e.fix) c3.append(mk('div', 'qfix', '→ ' + e.fix)); t.append(mk('td', null, md(e.d)), c1, e.free ? mk('td', 'muted', '–') : mk('td', 'minus', qaPt(e.pt)), c3, c5, mk('td', e.ack ? 'qst r' : 'qst s', e.ack ? '✓ ' + when(e.ack) : e.sent ? '아직 확인 전' : '안 보냄')); tb.append(t); });
      var tw = mk('div', 'twrap'); tw.append(tb); el.append(tw);
    } catch (e) { /* 관리 열쇠가 없거나 팀 서버가 예전 판이면 칸을 안 띄움 */ }
  }
  var api = { qaEvidence: qaEvidence, qaLine: qaLine, QT: QT, compute: compute, render: render, pushSkip: pushSkip, pullSkip: pullSkip, monthOf: monthOf, monthInfo: monthInfo, workbook: workbook, xlsx: xlsx, DEF: DEF, START: START, period: function (p) { if (p) { period = p; picked = true; } return period; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KBInc = api;
})(typeof window !== 'undefined' ? window : globalThis);
