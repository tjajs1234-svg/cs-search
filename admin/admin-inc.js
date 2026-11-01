/* 이달의 상담사(인센티브 추천) — 팀 현황 다섯째 칸 · 관리 화면 전용(2026-11-01 주인)
   · 숫자 재료는 팀 현황(admin-team3.js collect)과 같음 + 부풀리기 막기(주인 11/01 "악의적으로 쓸 수 있는 부분 싹 다")
     A5 남이 답한 고객을 기록 → 답을 보낸 사람에게 · A6 답 없이 완료 → 보낸 방만 답한 고객 · A3 게시판 한 주 1건 · A4 방 모르는 기록은 점수에서 뺌
     A9 어려운 상담 비율이 팀+15%p를 넘친 만큼은 1.5배 안 함 · A10 시간당은 근무시간(출근한 날 업무시간 + 승인된 OT − 쉰 시간)으로 나눔
   · 팀장 입력(오처리·클레임·공지 미반영·근태·칭찬·쉰 시간·입사일)과 배점은 팀 서버 inc.json(관리자 열쇠로만 읽음) · 확정한 점수표도 거기에
   · 상담사 화면 어디에도 이 기준을 보여 주지 않음(주인: 알면 카테고리를 일부러 바꿀 수 있음)
   계산(compute)은 화면과 떼어 시험(tests/incentive.test.js)이 그대로 부름 */
(function (root) {
  'use strict';
  var W = root.WorkClock || (typeof require === 'function' ? require('../js/workclock.js') : null);
  var HARD = /교환|반품|불량|고장|A\s*\/?\s*S|불만|컴플레인/i, HARD_LABEL = '교환/반품 · 고장/불량 · A/S · 불만';
  // 기본 배점(팀 서버에 저장하면 그 값을 씀 — [배점 바꾸기])
  var DEF = { wRph: 40, wDpd: 25, wAph: 15, wLate: 20, lateStep: 1, hardW: 1.5, hardCap: 15, pErr: -3, pNt: -3, pLt: -2, pPr: 1, prMax: 5, exCl: 1, exEr: 3, tie: 3, gA: 85, gB: 70 };
  var CFG_LABEL = [['wRph', '시간당 기록 배점'], ['wDpd', '하루 평균 기록 배점'], ['wAph', '시간당 답한 고객 배점'], ['wLate', '안 기다리게 함 배점'], ['lateStep', '20분 넘긴 비율 1%마다 감점'], ['hardW', '어려운 상담 1건 = 몇 건'], ['hardCap', '어려운 상담 상한(팀 평균 +%p)'], ['pErr', '오안내·오처리 1건'], ['pNt', '공지 미반영 1건'], ['pLt', '지각·조퇴·무단 1건'], ['pPr', '칭찬·기여 1건'], ['prMax', '칭찬·기여 최대'], ['exCl', '추천 제외: 클레임 몇 건부터'], ['exEr', '추천 제외: 오처리 몇 건부터'], ['tie', '공동 추천: 몇 점 차이 안'], ['gA', 'A 등급: 몇 점부터'], ['gB', 'B 등급: 몇 점부터']];
  var INPUTS = [['er', '오안내·오처리'], ['cl', '고객 클레임'], ['nt', '공지 미반영'], ['lt', '지각·조퇴·무단'], ['pr', '칭찬·기여'], ['off', '쉰 시간(반차·교육 등)']];
  function isHard(c) { return HARD.test(String(c || '')); }
  function num(v) { v = Number(v); return isFinite(v) ? v : 0; }
  function wkOf(d) { return W.addDays(d, -((W.weekday(d) + 6) % 7)); }
  function workMin(d, cfg) { var x = W.day(d, cfg); return x ? x.workEnd - x.open - (x.lunch[1] - x.lunch[0]) : 0; }
  function mean(a) { a = a.filter(function (v) { return v != null && isFinite(v); }); return a.length ? a.reduce(function (s, v) { return s + v; }, 0) / a.length : null; }
  function cfgOf(inc) { var c = Object.assign({}, DEF), s = (inc && inc.cfg) || {}; Object.keys(DEF).forEach(function (k) { if (s[k] != null && isFinite(Number(s[k]))) c[k] = Number(s[k]); }); return c; }

  /* ───── 계산 ─────
     M: collect() 결과(people · keys · days · q · wcfg · sdBy) · ext: { inc: 팀 서버 inc.json, month: 'YYYY-MM', ot: 승인된 OT 목록, P: 이름 바꾸기 } */
  function compute(M, ext) {
    ext = ext || {}; var inc = ext.inc || {}, C = cfgOf(inc), month = ext.month || (M.keys[0] || '').slice(0, 7), P = ext.P || function (n) { return n; };
    var input = ((inc.months || {})[month] || {}).people || {}, q = (M.q && M.q.days) || {}, days = M.days || {}, keys = M.keys, wcfg = M.wcfg || {};
    var otMin = {}; (ext.ot || []).forEach(function (x) { if (x && x.status === '승인' && keys.indexOf(x.date) >= 0) otMin[P(x.name)] = (otMin[P(x.name)] || 0) + num(x.mins); });
    // 사람마다 그날 보낸 방(sd) · 기록한 방(rk) · 게시판 글(bk) · 표본(hs) · PC
    var Q = {}; keys.forEach(function (d) { var qd = q[d] || {}; Object.keys(qd).forEach(function (k) { var n = P(k), e = qd[k] || {}, o = (Q[n] || (Q[n] = {}))[d] || (Q[n][d] = { sd: {}, rk: [], bk: [], hs: [], pc: [], hasSd: false }); if (e.sd && typeof e.sd === 'object') { o.hasSd = true; Object.keys(e.sd).forEach(function (h) { o.sd[h] = 1; }); } o.rk = o.rk.concat(e.rk || []); o.bk = o.bk.concat(e.bk || []); o.hs = o.hs.concat(e.hs || []); o.pc = o.pc.concat(e.pc || []); }); });
    var qOf = function (n, d) { return (Q[n] || {})[d] || { sd: {}, rk: [], bk: [], hs: [], pc: [], hasSd: false }; };
    var T = function (n, d) { var x = days[d] || {}, out = {}; Object.keys(x).forEach(function (k) { if (P(k) !== n) return; var s = x[k] || {}; ['nk', 'bh', 'ho', 'holds'].forEach(function (f) { out[f] = (out[f] || 0) + num(s[f]); }); }); return out; };
    // A5 같은 주 같은 고객을 두 사람이 기록: 그 주에 그 방에 답을 보낸 사람이 있으면 보낸 사람에게만(보낸 사람이 없거나 둘 다 보냈으면 각자 그대로)
    var recBy = {}; M.people.forEach(function (o) { keys.forEach(function (d) { var wk = wkOf(d); qOf(o.n, d).rk.forEach(function (h) { var key = wk + ':' + h, r = recBy[key] || (recBy[key] = {}); r[o.n] = 1; }); }); });
    var sentWk = function (n, wk, h) { return keys.some(function (d) { return wkOf(d) === wk && qOf(n, d).sd[h]; }); };
    var lost = {}, gain = {}; Object.keys(recBy).forEach(function (key) { var who = Object.keys(recBy[key]); if (who.length < 2) return; var wk = key.slice(0, 10), h = key.slice(11), snd = who.filter(function (n) { return sentWk(n, wk, h); }); if (!snd.length || snd.length === who.length) return; who.forEach(function (n) { if (snd.indexOf(n) < 0) lost[n] = (lost[n] || 0) + 1; else gain[n] = (gain[n] || 0) + 1; }); });
    // PC 하나가 두 이름으로 보냄(A14)
    var pcNames = {}; M.people.forEach(function (o) { keys.forEach(function (d) { qOf(o.n, d).pc.forEach(function (p) { (pcNames[p] || (pcNames[p] = {}))[o.n] = 1; }); }); });
    var rows = M.people.map(function (o) {
      var x = input[o.n] || {}, r = { n: o.n, o: o, in: x, flags: [], notes: [], approx: [] };
      // 근무시간(분) = 출근한 날 업무시간 + 승인된 OT − 쉰 시간
      var wd = keys.filter(function (d) { var v = o.days[d]; return v && (v.rec > 0 || (v.fl && v.fl.n > 0) || v.ans > 0); });
      r.work = wd.length; r.ot = otMin[o.n] || 0; r.off = num(x.off) * 60;
      r.min = Math.max(0, wd.reduce(function (s, d) { return s + workMin(d, wcfg); }, 0) + r.ot - r.off); r.hours = r.min / 60;
      // 기록: collect가 같은 주 같은 방(채팅) 중복을 이미 뺌 → 게시판 같은 주 중복 · 방 모르는 기록 · 남이 답한 고객 기록을 더 뺌
      var seenB = {}, bdup = 0, nk = 0, bh = 0, ho = 0, holds = 0; keys.forEach(function (d) { var wk = wkOf(d); qOf(o.n, d).bk.forEach(function (h) { var k = wk + ':' + h; if (seenB[k]) bdup++; else seenB[k] = 1; }); var t = T(o.n, d); nk += t.nk || 0; bh += t.bh || 0; ho += t.ho || 0; holds += t.holds || 0; });
      r.bdup = bdup; r.nk = nk; r.bh = bh; r.ho = ho; r.holds = holds; r.lost = lost[o.n] || 0; r.gain = gain[o.n] || 0;
      r.recRaw = o.rec; r.rec = Math.max(0, o.rec - bdup - nk - r.lost);
      // A6 답한 고객 = 실제로 답을 보낸 방만(보낸 방 정보가 있는 날만 · 없는 날은 예전 숫자 그대로 · 어림)
      var seenA = {}, ans = 0, noSd = 0; keys.forEach(function (d) { var v = o.days[d] || {}, z = qOf(o.n, d), wk = wkOf(d); if (!z.hasSd || !v.akl) { if (v.ans) noSd++; ans += 0; return; } v.akl.forEach(function (h) { var k = wk + ':' + h; if (seenA[k] || !z.sd[h]) return; seenA[k] = 1; ans++; }); });
      var oldDays = keys.filter(function (d) { var v = o.days[d] || {}, z = qOf(o.n, d); return v.ans && !(z.hasSd && v.akl); });
      ans += oldDays.reduce(function (s, d) { return s + ((o.days[d] || {}).ans || 0); }, 0);
      r.ans = ans; r.ansAll = o.ans; r.noSend = Math.max(0, o.ans - ans); if (oldDays.length) r.approx.push('답한 고객 ' + oldDays.length + '일은 보낸 방 정보가 없어 예전 숫자');
      // 어려운 상담 가중(A9 상한)
      r.catN = o.catN; r.hardN = o.hardN; r.hardPct = o.catN >= 3 ? o.hardN / o.catN : null; r.cats = o.cats;
      return r;
    });
    var c = 0, h = 0; rows.forEach(function (r) { c += r.catN; h += r.hardN; }); var teamHard = c >= 5 ? h / c : null;
    rows.forEach(function (r) {
      var cap = teamHard == null ? 1 : Math.min(1, teamHard + C.hardCap / 100), pctUsed = r.hardPct == null ? 0 : Math.min(r.hardPct, cap);
      r.capped = r.hardPct != null && teamHard != null && r.hardPct > cap; r.hardUsed = pctUsed;
      r.wrec = r.rec * (1 + (C.hardW - 1) * pctUsed);
      r.rph = r.hours >= 1 ? r.wrec / r.hours : null; r.dpd = r.work ? r.wrec / r.work : null; r.aph = r.hours >= 1 ? r.ans / r.hours : null;
      r.lateN = r.o.lateN; r.latePct = r.ans ? Math.min(1, r.lateN / r.ans) : null;
    });
    var mx = function (k) { return Math.max.apply(null, [0].concat(rows.map(function (r) { return r[k] || 0; }))); };
    var M1 = { rph: mx('rph'), dpd: mx('dpd'), aph: mx('aph') }, maxWork = mx('work');
    rows.forEach(function (r) {
      var x = r.in, part = function (v, m, w) { return v == null || !m ? 0 : w * v / m; };
      r.pts = { rph: part(r.rph, M1.rph, C.wRph), dpd: part(r.dpd, M1.dpd, C.wDpd), aph: part(r.aph, M1.aph, C.wAph), late: r.latePct == null ? 0 : Math.max(0, C.wLate - r.latePct * 100 * C.lateStep) };
      r.base = r.pts.rph + r.pts.dpd + r.pts.aph + r.pts.late;
      r.adj = num(x.er) * C.pErr + num(x.nt) * C.pNt + num(x.lt) * C.pLt + Math.min(C.prMax, num(x.pr) * C.pPr);
      r.score = Math.max(0, Math.round(r.base + r.adj));
      r.grade = r.score >= C.gA ? 'A' : r.score >= C.gB ? 'B' : 'C';
      r.out = []; if (num(x.cl) >= C.exCl) r.out.push('클레임 ' + num(x.cl) + '건'); if (num(x.er) >= C.exEr) r.out.push('오처리 ' + num(x.er) + '건'); if (maxWork && r.work * 2 < maxWork) r.out.push('근무일 ' + r.work + '일(절반 미만)');
    });
    // 이상 신호(확인할 것)
    var others = function (r, k) { return mean(rows.filter(function (z) { return z !== r && z.work; }).map(function (z) { return z[k]; })); };
    rows.forEach(function (r) {
      var o = r.o, f = function (lv, t, more) { r.flags.push({ lv: lv, t: t, more: more || null }); };
      if (r.capped) f('r', '어려운 상담 비율 ' + pc(r.hardPct) + ', 팀 평균 ' + pc(teamHard) + '보다 ' + Math.round((r.hardPct - teamHard) * 100) + '%p 높아요 → 넘친 만큼은 ' + C.hardW + '배 안 했어요. 기록 몇 건을 열어 카테고리가 맞는지 봐 주세요', { hs: true });
      else if (r.hardPct != null && teamHard != null && r.hardPct < teamHard - 0.15 && r.catN >= 10) f('y', '어려운 상담 비율 ' + pc(r.hardPct) + '로 팀(' + pc(teamHard) + ')보다 많이 낮아요. 쉬운 상담만 골라 받았는지');
      if (r.nk) f('y', '상담방을 알 수 없는 기록 ' + r.nk + '건 → 같은 상담인지 가릴 수 없어 점수에서 뺐어요');
      if (r.lost) f('y', '다른 상담사가 답한 고객을 기록한 ' + r.lost + '건 → 답을 보낸 사람에게 옮겼어요');
      if (r.bdup) f('y', '게시판 같은 글을 같은 주에 다시 기록한 ' + r.bdup + '건 → 1건으로 셌어요');
      if (r.bh >= 5) f('y', '게시판 글을 고르지 않고 직접 적은 기록 ' + r.bh + '건(같은 글인지 가리기 어려움)');
      if (r.noSend >= 5) f('y', '답을 보내지 않고 대기에서 빠진 고객 ' + r.noSend + '명 → 답한 고객에서 뺐어요([완료]만 눌렀거나 다른 PC에서 답함)');
      if (o.redup >= 5) f('y', '같은 고객을 같은 주에 다시 기록 ' + o.redup + '건(1건으로 셈)');
      var ah = others(r, 'holds'); if (r.holds >= 10 && ah && r.holds > ah * 2) f('y', '보류 ' + r.holds + '번, 다른 사람 평균(' + Math.round(ah) + '번)의 ' + (r.holds / ah).toFixed(1) + '배예요. 보류하면 기다린 시간이 멈춰요');
      var aho = others(r, 'ho'); if (r.ho >= 5 && (!aho || r.ho > aho * 2)) f('y', '기다리던 고객이 다른 사람에게 넘어간 게 ' + r.ho + '명' + (aho ? '(다른 사람 평균 ' + Math.round(aho) + '명)' : '') + '. 어려운 고객을 넘겼는지');
      var apc = mean(rows.filter(function (z) { return z !== r; }).map(function (z) { return z.o.perCust; })); if (o.perCust != null && apc && o.perCust > apc * 1.5) f('y', '고객 1명에게 답한 횟수 ' + o.perCust.toFixed(1) + '번(다른 사람 ' + apc.toFixed(1) + '번). 짧은 답을 여러 번 보내 대기를 비웠는지');
      var offh = []; keys.forEach(function (d) { var v = o.days[d] || {}, dd = W.day(d, wcfg); (v.rt || []).forEach(function (m) { if (!dd || m < dd.open || m >= dd.workEnd) offh.push(d.slice(5).replace('-', '/') + ' ' + String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0')); }); });
      if (offh.length >= 5) f('y', '업무시간 밖 기록 ' + offh.length + '건(' + offh.slice(0, 3).join(', ') + ' 등). 퇴근 뒤 몰아서 기록했는지', { list: offh });
      if (o.on != null && r.min > 0 && o.off > r.min * 0.2) f('y', '업무시간 중 기록기가 꺼져 있던 시간 ' + Math.round(o.off / 60) + '시간(근무시간의 ' + Math.round(o.off / r.min * 100) + '%). 꺼진 동안 일은 숫자에 안 잡혀요 — 보안 프로그램 탓이면 참작');
      Object.keys(pcNames).forEach(function (p) { var nm = Object.keys(pcNames[p]); if (nm.length > 1 && nm.indexOf(r.n) >= 0) f('r', '같은 PC가 이달 ' + nm.join(' · ') + ' 이름으로 숫자를 보냈어요. 기록기 이름을 바꿨는지'); });
      var tot = o.k + o.nv + o.bd, tk = rows.reduce(function (s, z) { return s + z.o.bd; }, 0), tt = rows.reduce(function (s, z) { return s + z.o.k + z.o.nv + z.o.bd; }, 0);
      if (tot >= 20 && tt && Math.abs(o.bd / tot - tk / tt) > 0.3) f('y', '게시판 비중 ' + pc(o.bd / tot) + '(팀 ' + pc(tk / tt) + '). 채널이 달라 시간당 비교는 조심');
      if (o.on == null) r.approx.push('기록기 켜진 시간 없음(팀 서버 1.3.12 전)');
    });
    // 순서 · 추천
    var ranked = rows.slice().sort(function (a, b) { return b.score - a.score || (a.n > b.n ? 1 : -1); });
    var ok = ranked.filter(function (r) { return !r.out.length && r.work; });
    ok.forEach(function (r, i) { r.rank = ok.filter(function (z) { return z.score > r.score; }).length + 1; });
    var pick = ok.length ? ok.filter(function (r) { return ok[0].score - r.score < C.tie; }) : [];
    return { C: C, rows: ranked, ok: ok, pick: pick, teamHard: teamHard, month: month, input: input };
  }
  function pc(v) { return v == null ? '–' : Math.round(v * 100) + '%'; }

  /* ───── 화면 ───── */
  var A = function () { return root.KBAdminApp; }, T = function () { return root.KBTeam; };
  function mk(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function btn(label, cls, fn) { var b = mk('button', 'btn ' + (cls || 'ghost'), label); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; }
  function say(t, k) { if (A()) A().say(t, k); }
  function f1(v) { return v == null ? '–' : (Math.round(v * 10) / 10).toFixed(1); }
  function monthOf(period) { var td = W.dayKey(Date.now()); return period === 'lmonth' ? W.addDays(td.slice(0, 8) + '01', -1).slice(0, 7) : td.slice(0, 7); }
  var incCache = null, incAt = 0;
  async function getInc(force) {
    if (!force && incCache && Date.now() - incAt < 120000) return incCache;
    var tok = await T().adminToken(); if (!tok) throw new Error('관리 열쇠(깃허브 연결)가 있어야 볼 수 있어요');
    var r = await CSTeam.call('inc.get', { adminToken: tok }); if (!r || !r.ok) throw new Error((r && r.error) || '팀 서버 1.3.16이 필요해요');
    incCache = r.inc || {}; incAt = Date.now(); return incCache;
  }
  async function setInc(patch) { var r = await CSTeam.call('inc.set', Object.assign({ adminToken: await T().adminToken() }, patch)); if (!r || !r.ok) throw new Error((r && r.error) || '저장하지 못했어요'); incCache = r.inc; incAt = Date.now(); return r.inc; }
  // B8 팀장 [빼기]를 팀 서버에도(PC를 바꿔도 같게) — admin-team3.js skipSet이 부름 · 팀 현황을 그릴 때 팀 서버 것을 이 PC로 합침
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
  var period = 'lmonth';
  async function render(r, st) {
    var box = mk('div', 'tview tinc');
    var nav = mk('div', 'ins bper iper'); nav.append(mk('span', null, '기간'));
    var lm = monthOf('lmonth'), tm = monthOf('month');
    [['lmonth', '지난달 (' + Number(lm.slice(5)) + '월)'], ['month', '이번 달 (' + Number(tm.slice(5)) + '월 · 진행 중)']].forEach(function (f) { var b = mk('button', period === f[0] ? 'on' : null, f[1]); b.type = 'button'; b.addEventListener('click', function () { period = f[0]; st.again(); }); nav.append(b); });
    box.append(nav);
    var inc; try { inc = await getInc(); } catch (e) { box.append(mk('div', 'empty', e.message)); return box; }
    var month = monthOf(period), M = await KBTeam3.collect(r, period, st.maxAge), ot = [];
    try { ot = (await CSTeam.get('ot.list', { from: M.keys[0], to: M.keys[M.keys.length - 1] })).items || []; } catch (e) {}
    var R = compute(M, { inc: inc, month: month, ot: ot, P: T().person }), C = R.C, mn = Number(month.slice(5)) + '월';
    var fin = ((inc.months || {})[month] || {}).final;
    nav.append(mk('span', fin ? 'tag w' : 'draft', fin ? '확정 ' + new Date(fin.at).toLocaleDateString('ko-KR') : '초안 · 아직 확정 안 함'), mk('span', 'muted', '근무일 ' + M.keys.filter(function (d) { return W.day(d, M.wcfg); }).length + '일 · ' + M.keys[0].slice(5).replace('-', '/') + ' ~ ' + M.keys[M.keys.length - 1].slice(5).replace('-', '/')));
    if (!R.rows.length) { box.append(mk('div', 'empty', '이 기간 숫자가 없어요.')); return box; }
    // 맨 위 추천
    var hero = mk('div', 'ihero'), rk = mk('div', 'irank'), why = mk('div', 'why');
    rk.append(mk('span', 'crown', mn + ' 추천' + (period === 'month' ? '(지금까지)' : '')));
    if (R.pick.length) {
      var p0 = R.pick[0]; rk.append(mk('span', 'who', '🏅 ' + R.pick.map(function (r) { return r.n; }).join(' · ')));
      var sc = mk('span', 'sc', p0.score + '점 '); sc.append(mk('span', 'grade ' + p0.grade.toLowerCase(), p0.grade)); rk.append(sc);
      var nx = R.ok[R.pick.length];
      why.append(R.pick.length > 1 ? mk('b', null, R.pick.length + '명이 ' + C.tie + '점 안이라 공동 추천이에요. ') : '', nx ? '다음 ' : '', nx ? mk('b', null, nx.n + '(' + nx.score + '점)') : '', nx ? '과 ' : '', nx ? mk('b', null, (p0.score - nx.score) + '점') : '', nx ? ' 차이예요.' : R.pick.length > 1 ? '' : '추천에서 비교할 다른 사람이 없어요.');
      why.append(mk('br')); why.append(goodLine(p0, R));
    } else { rk.append(mk('span', 'who', '추천할 사람 없음')); why.append('모두 추천 제외 조건에 걸렸어요.'); }
    var outs = R.rows.filter(function (r) { return r.out.length; });
    if (outs.length) { why.append(mk('br')); why.append(mk('span', 'minus', '추천 제외 ' + outs.length + '명'), ' · ' + outs.map(function (r) { return r.n + ': ' + r.out.join(', ') + '(점수 ' + r.score + '점)'; }).join(' · ')); }
    hero.append(rk, why); box.append(hero);
    // 확인할 것
    var fl = []; R.rows.forEach(function (r) { r.flags.forEach(function (x) { fl.push({ r: r, x: x }); }); }); fl.sort(function (a, b) { return (a.x.lv === 'r' ? 0 : 1) - (b.x.lv === 'r' ? 0 : 1); });
    var cp = mk('div', 'tpanel'), ch = mk('div', 'tph'); ch.append(mk('b', null, fl.length ? '확인할 것 ' + fl.length + '개' : '확인할 것 없어요 ✓'), mk('span', 'muted', '확정 전에 눈으로 봐 주세요 · 숫자를 부풀렸거나 숫자가 불공평할 수 있는 곳')); cp.append(ch);
    var chk = mk('div', 'chk'); fl.forEach(function (z) {
      var row = mk('div', 'r'); row.append(mk('span', 'dot' + (z.x.lv === 'r' ? ' r' : '')), mk('b', null, z.r.n), mk('span', null, z.x.t));
      var more = z.x.more; if (more && (more.hs || more.list)) { var d = mk('details', 'imore'); d.append(mk('summary', null, more.hs ? '5건 보기' : '목록')); var body = mk('div', 'imlist'); if (more.hs) samples(z.r, M, month).forEach(function (s) { var a = mk('a', 'qlink', s.d + ' · ' + s.c + ' · 상담 열기'); a.href = s.u; a.target = '_blank'; a.rel = 'noopener noreferrer'; body.append(a); }); else body.append(mk('span', null, more.list.join(' · '))); if (!body.childNodes.length) body.append(mk('span', 'muted', '표본이 아직 없어요(기록기 2.4.26부터 모여요)')); d.append(body); row.append(d); } else row.append(mk('span'));
      chk.append(row);
    }); if (fl.length) cp.append(chk); box.append(cp);
    // 점수표
    var sp = mk('div', 'tpanel sec'), sh = mk('div', 'tph'); sh.append(mk('b', null, '점수표 · ' + mn), mk('span', 'muted', '시간당은 근무시간(출근한 날 업무시간 + 승인된 OT − 쉰 시간)으로 나눠요 · 어려운 상담은 ' + C.hardW + '건'), mk('span', 'sp'));
    sh.append(btn('CSV', 'ghost sm', function () { csv(R, month); })); sp.append(sh);
    var tb = mk('table', 'ttable'), tr = mk('tr'); ['등수', '상담사', '점수', '시간당 기록 (' + C.wRph + ')', '하루 평균 기록 (' + C.wDpd + ')', '시간당 답한 고객 (' + C.wAph + ')', '20분 넘긴 비율 (' + C.wLate + ')', '팀장 입력', '근무'].forEach(function (h) { tr.append(mk('th', null, h)); }); tb.append(tr);
    var cell = function (big, small) { var td = mk('td'); td.append(mk('b', null, big)); if (small) td.append(mk('span', 'pt', small)); return td; };
    R.rows.forEach(function (r) {
      var t = mk('tr', r.out.length ? 'out' : r.rank === 1 ? 'win' : null), nm = mk('td'); nm.append(r.n + ' ', mk('span', 'grade ' + r.grade.toLowerCase(), r.grade));
      t.append(mk('td', null, r.out.length ? '–' : r.rank + '등'), nm, mk('td', 'tot', String(r.score)));
      t.append(cell(r.rph == null ? '–' : f1(r.rph) + '건', f1(r.pts.rph) + '점'), cell(r.dpd == null ? '–' : f1(r.dpd) + '건', f1(r.pts.dpd) + '점'), cell(r.aph == null ? '–' : f1(r.aph) + '명', f1(r.pts.aph) + '점'), cell(r.latePct == null ? '–' : pc(r.latePct), Math.round(r.pts.late) + '점'));
      var ad = mk('td'), x = r.in, bits = []; if (num(x.cl)) bits.push(['minus', '클레임 ' + x.cl]); if (num(x.er)) bits.push(['minus', '오처리 ' + x.er]); if (num(x.nt)) bits.push(['minus', '공지 미반영 ' + x.nt]); if (num(x.lt)) bits.push(['minus', '근태 ' + x.lt]); if (num(x.pr)) bits.push(['plus', '칭찬 ' + x.pr]);
      if (bits.length) { if (r.adj) ad.append(mk('b', r.adj < 0 ? 'minus' : 'plus', (r.adj > 0 ? '+' : '') + Math.round(r.adj) + ' ')); bits.forEach(function (b, i) { if (i) ad.append(' · '); ad.append(mk('span', b[0], b[1])); }); } else ad.append('–');
      t.append(ad);
      var wk = mk('td', null, r.work + '일 · ' + Math.round(r.hours) + '시간'); if (r.out.length) wk.append(' ', mk('span', 'tag', '추천 제외 · ' + r.out[0])); if (r.approx.length) { var ap = mk('span', 'tag', '어림'); ap.title = r.approx.join(' · '); wk.append(' ', ap); }
      t.append(wk); tb.append(t);
    });
    var tw = mk('div', 'twrap'); tw.append(tb); sp.append(tw);
    sp.append(mk('p', 'muted tfoot', '기록 = 시트에 저장된 기록 · 같은 고객은 한 주(월~금)에 1건(게시판도) · 두 사람이 같은 고객을 기록하면 답을 보낸 사람에게 1건 · 상담방을 알 수 없는 기록은 뺌 · 답한 고객 = 실제로 답을 보낸 방만 · 어려운 상담(' + HARD_LABEL + ')은 팀 평균 +' + C.hardCap + '%p까지만 ' + C.hardW + '배 · 20분 넘긴 비율 = 답한 고객 중 20분 넘게 기다리게 한 고객(1%마다 ' + C.lateStep + '점) · 등급 A ' + C.gA + '점↑ · B ' + C.gB + '점↑'));
    box.append(sp);
    // 팀장 입력
    box.append(inputPanel(R, month, st));
    // 사람마다
    var cards = mk('div', 'icards'); R.rows.forEach(function (r) { cards.append(card(r, R)); }); box.append(cards);
    // 주별 · 분류 · 채널
    box.append(weekTable(R, M), catTable(R), cfgPanel(R, st));
    // 확정
    var fz = mk('div', 'ins bper ifin'); fz.append(mk('span', 'muted', fin ? '확정한 점수표가 팀 서버에 있어요(' + new Date(fin.at).toLocaleString('ko-KR') + ') · 1등 ' + ((fin.rows || [])[0] || {}).n + ' ' + ((fin.rows || [])[0] || {}).score + '점' : '확정하면 이 점수표가 팀 서버에 남아요(나중에 날짜별 숫자가 지워져도 그대로)'));
    fz.append(btn(fin ? '다시 확정하기' : mn + ' 확정하기', 'primary', async function () { if (!confirm(mn + ' 점수표를 확정할까요?')) return; try { await setInc({ month: month, final: { rows: R.rows.map(rowOut) } }); say('확정했어요', 'ok'); st.again(); } catch (e) { say(e.message, 'err'); } }));
    if (fin) fz.append(btn('확정 풀기', 'ghost', async function () { try { await setInc({ month: month, final: null }); say('확정을 풀었어요', 'ok'); st.again(); } catch (e) { say(e.message, 'err'); } }));
    box.append(fz);
    return box;
  }
  function rowOut(r) { return { n: r.n, score: r.score, grade: r.grade, rank: r.out.length ? 0 : r.rank, out: r.out.join(', '), rph: r.rph == null ? null : Math.round(r.rph * 100) / 100, dpd: r.dpd == null ? null : Math.round(r.dpd * 10) / 10, aph: r.aph == null ? null : Math.round(r.aph * 100) / 100, late: r.latePct == null ? null : Math.round(r.latePct * 1000) / 10, rec: r.rec, ans: r.ans, work: r.work, hours: Math.round(r.hours), hard: r.hardPct == null ? null : Math.round(r.hardPct * 100), adj: Math.round(r.adj), flags: r.flags.length }; }
  function goodLine(r, R) {
    var top = function (k) { return r[k] != null && r[k] > 0 && R.rows.every(function (z) { return z === r || (z[k] || 0) <= r[k]; }); }, g = [];
    if (top('rph')) g.push('시간당 기록 1등(' + f1(r.rph) + '건)'); if (top('dpd')) g.push('하루 평균 기록 1등(' + f1(r.dpd) + '건)'); if (top('aph')) g.push('시간당 답한 고객 1등(' + f1(r.aph) + '명)');
    if (r.latePct != null && R.rows.every(function (z) { return z === r || z.latePct == null || z.latePct >= r.latePct; })) g.push('20분 넘긴 비율 ' + pc(r.latePct) + '로 가장 낮음');
    return g.length ? g.join(', ') + '.' : '항목별로 고르게 높아요.';
  }
  function card(r, R) {
    var c = mk('div', 'icard'), h = mk('h4', null, r.n + ' '); h.append(mk('span', 'tag' + (r.rank === 1 && !r.out.length ? ' w' : ''), r.score + '점 · ' + (r.out.length ? '추천 제외' : r.rank + '등') + ' · ' + r.grade)); c.append(h);
    var good = goodLine(r, R), bad = [], plus = [];
    var low = function (k, label, unit) { var best = Math.max.apply(null, R.rows.map(function (z) { return z[k] || 0; })); if (r[k] != null && best && r[k] < best * 0.85) bad.push(label + ' ' + f1(r[k]) + unit + ', 1등보다 ' + f1(best - r[k]) + unit + ' 적어요'); };
    low('rph', '시간당 기록', '건'); low('aph', '시간당 답한 고객', '명');
    if (r.latePct != null && r.latePct >= 0.05) bad.push('20분 넘긴 비율 ' + pc(r.latePct));
    if (num(r.in.er)) bad.push('오처리 ' + r.in.er + '건'); if (num(r.in.cl)) bad.push('클레임 ' + r.in.cl + '건');
    if (r.hardPct != null && R.teamHard != null && r.hardPct > R.teamHard + 0.05) plus.push('어려운 상담 ' + pc(r.hardPct) + '(팀 ' + pc(R.teamHard) + ') — ' + R.C.hardW + '배로 쳤어요' + (r.capped ? '(상한까지)' : ''));
    if (num(r.in.off)) plus.push('쉰 시간 ' + r.in.off + '시간을 근무시간에서 뺐어요'); if (r.ot) plus.push('승인된 OT ' + Math.round(r.ot / 60) + '시간을 근무시간에 더했어요');
    var line = function (cls, label, t) { var p = mk('div'); p.append(mk('span', cls, label + ' '), t); c.append(p); };
    if (!/고르게/.test(good)) line('g', '잘한 점', good); if (plus.length) line('g', '참작했어요', plus.join(' · ')); if (bad.length) line('m', '아쉬운 점', bad.join(' · '));
    if (r.out.length) line('b', '추천 제외', r.out.join(', ')); if (r.in.memo) line('muted', '메모', r.in.memo);
    return c;
  }
  function inputPanel(R, month, st) {
    var p = mk('div', 'tpanel sec inp'), h = mk('div', 'tph'), mn = Number(month.slice(5)) + '월', fields = {};
    h.append(mk('b', null, '팀장 입력 · ' + mn), mk('span', 'muted', '기록기가 못 재는 것 · 팀 서버에 저장(상담사에게 안 보여요)'), mk('span', 'sp'));
    var save = btn('저장', 'primary sm', async function () { var people = {}; Object.keys(fields).forEach(function (n) { var o = {}; Object.keys(fields[n]).forEach(function (k) { o[k] = fields[n][k].value; }); people[n] = o; }); save.disabled = true; try { await setInc({ month: month, people: people }); say('저장했어요', 'ok'); st.again(); } catch (e) { say(e.message, 'err'); save.disabled = false; } });
    h.append(save); p.append(h);
    var tb = mk('table', 'ttable'), tr = mk('tr'); tr.append(mk('th', null, '상담사')); INPUTS.forEach(function (x) { tr.append(mk('th', null, x[1])); }); tr.append(mk('th', null, '입사일'), mk('th', null, '메모')); tb.append(tr);
    R.rows.slice().sort(function (a, b) { return a.n > b.n ? 1 : -1; }).forEach(function (r) {
      var t = mk('tr'), f = fields[r.n] = {}; t.append(mk('td', null, r.n));
      INPUTS.forEach(function (x) { var i = mk('input'); i.type = 'number'; i.min = '0'; i.step = x[0] === 'off' ? '0.5' : '1'; i.value = num(r.in[x[0]]) || 0; i.setAttribute('aria-label', r.n + ' ' + x[1]); f[x[0]] = i; var td = mk('td'); td.append(i); t.append(td); });
      var s = mk('input', 'w'); s.type = 'date'; s.value = r.in.start || ''; f.start = s; var m = mk('input', 'w'); m.maxLength = 200; m.value = r.in.memo || ''; m.placeholder = '예: 10/8 반품 접수 누락'; f.memo = m;
      [s, m].forEach(function (i) { var td = mk('td'); td.append(i); t.append(td); }); tb.append(t);
    });
    var tw = mk('div', 'twrap'); tw.append(tb); p.append(tw);
    var C = R.C; p.append(mk('p', 'muted tfoot', '점수: 오안내·오처리 ' + C.pErr + ' · 공지 미반영 ' + C.pNt + ' · 지각·조퇴·무단 ' + C.pLt + ' · 칭찬·기여 +' + C.pPr + '(최대 +' + C.prMax + ') · 추천 제외: 클레임 ' + C.exCl + '건↑ 또는 오처리 ' + C.exEr + '건↑ · 쉰 시간은 근무시간에서 빼요 · 입사일은 참고(근무일이 다른 사람 절반 미만이면 저절로 추천 제외)'));
    return p;
  }
  function cfgPanel(R, st) {
    var d = mk('details', 'tdet'), C = R.C, ins = {}; d.append(mk('summary', null, '배점 바꾸기 (팀 서버에 저장 · 상담사에게 안 보여요)'));
    var g = mk('div', 'icfg'); CFG_LABEL.forEach(function (x) { var l = mk('label'), i = mk('input'); i.type = 'number'; i.step = 'any'; i.value = C[x[0]]; ins[x[0]] = i; l.append(mk('span', null, x[1]), i); g.append(l); });
    d.append(g, btn('배점 저장', 'primary sm', async function () { var c = {}; Object.keys(ins).forEach(function (k) { c[k] = Number(ins[k].value); }); try { await setInc({ cfg: c }); say('배점을 저장했어요', 'ok'); st.again(); } catch (e) { say(e.message, 'err'); } }), btn('기본값으로', 'ghost sm', async function () { try { await setInc({ cfg: {} }); say('기본값으로 돌렸어요', 'ok'); st.again(); } catch (e) { say(e.message, 'err'); } }));
    return d;
  }
  // A9 어려운 상담 표본: 달마다 같은 5건(이름 순서로 섞음)
  function samples(r, M, month) {
    var all = []; M.keys.forEach(function (d) { var qd = (M.q.days || {})[d] || {}; Object.keys(qd).forEach(function (k) { if (T().person(k) !== r.n) return; (qd[k].hs || []).forEach(function (s) { all.push({ d: d.slice(5).replace('-', '/'), c: s.c, u: s.u }); }); }); });
    var seed = 0, key = month + r.n; for (var i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) >>> 0;
    var rnd = function () { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
    for (var j = all.length - 1; j > 0; j--) { var k = Math.floor(rnd() * (j + 1)), t = all[j]; all[j] = all[k]; all[k] = t; }
    return all.slice(0, 5);
  }
  function weekTable(R, M) {
    var p = mk('div', 'tpanel sec'), h = mk('div', 'tph'); h.append(mk('b', null, '주별 기록 수'), mk('span', 'muted', '같은 고객은 한 주에 1건 · 괄호는 하루 평균')); p.append(h);
    var wks = []; M.keys.forEach(function (d) { var w = wkOf(d); if (wks.indexOf(w) < 0) wks.push(w); });
    var tb = mk('table', 'ttable'), tr = mk('tr'); tr.append(mk('th', null, '상담사')); wks.forEach(function (w, i) { var ds = M.keys.filter(function (d) { return wkOf(d) === w; }); tr.append(mk('th', null, (i + 1) + '주 (' + Number(ds[0].slice(5, 7)) + '/' + Number(ds[0].slice(8)) + '~' + Number(ds[ds.length - 1].slice(8)) + ')')); }); tr.append(mk('th', null, '합계')); tb.append(tr);
    R.rows.forEach(function (r) {
      var t = mk('tr'); t.append(mk('td', null, r.n));
      wks.forEach(function (w) { var ds = M.keys.filter(function (d) { return wkOf(d) === w; }), seen = {}, n = 0, wd = 0; ds.forEach(function (d) { var v = r.o.days[d] || {}; if (v.rec > 0 || v.ans > 0) wd++; var dup = 0; (v.rk || []).forEach(function (h) { if (seen[h]) dup++; else seen[h] = 1; }); n += Math.max(0, (v.rec || 0) - dup); }); t.append(mk('td', null, n ? n + (wd ? ' (' + f1(n / wd) + ')' : '') : '–')); });
      t.append(mk('td', 'sum', String(r.rec))); tb.append(t);
    });
    var tw = mk('div', 'twrap'); tw.append(tb); p.append(tw); return p;
  }
  function catTable(R) {
    var p = mk('div', 'tpanel sec'), h = mk('div', 'tph'); h.append(mk('b', null, '문의 분류 · 채널'), mk('span', 'muted', '노란 칸 = 어려운 상담(' + HARD_LABEL + ')')); p.append(h);
    var all = {}; R.rows.forEach(function (r) { Object.keys(r.cats || {}).forEach(function (c) { all[c] = (all[c] || 0) + r.cats[c]; }); });
    var cl = Object.keys(all).sort(function (a, b) { return all[b] - all[a]; }).slice(0, 12);
    var tb = mk('table', 'ttable tcatt'), tr = mk('tr'); ['상담사'].concat(cl, ['합계', '어려운 상담', '카톡 · 톡톡 · 게시판']).forEach(function (x) { tr.append(mk('th', null, x)); }); tb.append(tr);
    R.rows.forEach(function (r) { var t = mk('tr'); t.append(mk('td', null, r.n)); cl.forEach(function (c) { var n = (r.cats || {})[c] || 0; t.append(mk('td', n && isHard(c) ? 'hardc' : null, n ? String(n) : '')); }); t.append(mk('td', 'sum', String(r.catN)), mk('td', r.capped ? 'hardc' : null, pc(r.hardPct)), mk('td', null, r.o.k + ' · ' + r.o.nv + ' · ' + r.o.bd)); tb.append(t); });
    var tw = mk('div', 'twrap'); tw.append(tb); p.append(tw);
    if (!cl.length) p.append(mk('div', 'pnone', '카테고리 기록이 없어요'));
    return p;
  }
  function csv(R, month) {
    var head = ['등수', '상담사', '점수', '등급', '추천 제외', '시간당 기록', '하루 평균 기록', '시간당 답한 고객', '20분 넘긴 비율(%)', '기록(뺀 뒤)', '기록(팀 현황)', '답한 고객(보낸 방)', '근무일', '근무시간', '어려운 상담(%)', '팀장 입력 점수', '오처리', '클레임', '공지 미반영', '근태', '칭찬', '쉰 시간', '확인할 것'];
    var lines = [head].concat(R.rows.map(function (r) { return [r.out.length ? '' : r.rank, r.n, r.score, r.grade, r.out.join(' / '), f1(r.rph), f1(r.dpd), f1(r.aph), r.latePct == null ? '' : Math.round(r.latePct * 1000) / 10, r.rec, r.recRaw, r.ans, r.work, Math.round(r.hours), r.hardPct == null ? '' : Math.round(r.hardPct * 100), Math.round(r.adj), num(r.in.er), num(r.in.cl), num(r.in.nt), num(r.in.lt), num(r.in.pr), num(r.in.off), r.flags.map(function (x) { return x.t; }).join(' / ')]; }));
    var s = '﻿' + lines.map(function (l) { return l.map(function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([s], { type: 'text/csv;charset=utf-8' })); a.download = '이달의상담사_' + month + '.csv'; document.body.append(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  var api = { compute: compute, render: render, pushSkip: pushSkip, pullSkip: pullSkip, monthOf: monthOf, DEF: DEF, period: function (p) { if (p) period = p; return period; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KBInc = api;
})(typeof window !== 'undefined' ? window : globalThis);
