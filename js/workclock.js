/* 업무시간 시계 — 팀 현황의 ‘기다린 시간’을 업무시간 안에서만 셉니다(서울 시간).
   · 월·화·수·금: 10:00 ~ 18:00 고객 안내 · 19:00 실제 퇴근
   · 목: 10:00 ~ 16:00 고객 안내 · 17:00 실제 퇴근(복지 단축)
   · 점심 12:30 ~ 14:00은 빼고 셈 · 토·일·공휴일은 셈하지 않음
   · 새 문의: 안내 시간까지만 셈(그 뒤 온 건 다음 영업일 10시부터)
     진행 중 상담(이미 답한 상담에 고객이 다시 보냄)·비수기: 실제 퇴근까지 셈
   기록기(reply-bg.js)와 검색기·관리 화면이 같이 씀. 공휴일 기본값은 팀 서버(team-server.gs)와 같게 둠 */
(function (root) {
  'use strict';
  var H = 3600e3, M = 60e3, KST = 9 * H;
  // 기본 공휴일(대체공휴일 포함) — 관리 화면 ‘근무 달력’에서 더하거나 뺄 수 있음
  var DEFAULT_HOLIDAYS = {
    '2026-01-01': '신정', '2026-02-16': '설날 연휴', '2026-02-17': '설날', '2026-02-18': '설날 연휴', '2026-03-02': '삼일절 대체',
    '2026-05-05': '어린이날', '2026-05-25': '부처님오신날 대체', '2026-05-01': '노동절', '2026-06-03': '지방선거', '2026-07-17': '제헌절', '2026-08-17': '광복절 대체',
    '2026-09-24': '추석 연휴', '2026-09-25': '추석', '2026-10-05': '개천절 대체', '2026-10-09': '한글날', '2026-12-25': '성탄절',
    '2027-01-01': '신정', '2027-02-08': '설날 연휴', '2027-02-09': '설날 대체', '2027-03-01': '삼일절', '2027-05-03': '노동절 대체', '2027-05-05': '어린이날', '2027-05-13': '부처님오신날', '2027-07-19': '제헌절 대체',
    '2027-08-16': '광복절 대체', '2027-09-14': '추석 연휴', '2027-09-15': '추석', '2027-09-16': '추석 연휴', '2027-10-04': '개천절 대체', '2027-10-11': '한글날 대체', '2027-12-27': '성탄절 대체'
  };
  var OPEN = 10 * 60, LUNCH = [12 * 60 + 30, 14 * 60];
  function dayKey(ms) { return new Date(ms + KST).toISOString().slice(0, 10); }
  function dayStart(key) { return Date.parse(key + 'T00:00:00Z') - KST; }
  function addDays(key, n) { return new Date(Date.parse(key + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10); }
  function weekday(key) { return new Date(Date.parse(key + 'T00:00:00Z')).getUTCDay(); } // 0 일 … 6 토
  function holidays(cfg) {
    var out = {}, k;
    for (k in DEFAULT_HOLIDAYS) out[k] = DEFAULT_HOLIDAYS[k];
    var add = cfg && cfg.holidays, del = cfg && cfg.removed;
    if (add && typeof add === 'object') for (k in add) if (/^\d{4}-\d{2}-\d{2}$/.test(k)) out[k] = String(add[k] || '휴일');
    if (Array.isArray(del)) del.forEach(function (d) { delete out[d]; });
    return out;
  }
  // 하루 정보(분 단위): 쉬는 날이면 null
  function day(key, cfg, hol) {
    hol = hol || holidays(cfg);
    var w = weekday(key);
    if (w === 0 || w === 6 || hol[key]) return null;
    var thu = w === 4;
    return { open: OPEN, guideEnd: (thu ? 16 : 18) * 60, workEnd: (thu ? 17 : 19) * 60, lunch: LUNCH };
  }
  function overlap(a0, a1, b0, b1) { return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0)); }
  /* t0 ~ t1 사이 업무시간(ms). late: 진행 중 상담이거나 비수기면 true(실제 퇴근까지 셈) */
  function bizMs(t0, t1, cfg, late) {
    t0 = Number(t0) || 0; t1 = Number(t1) || 0;
    if (!t0 || t1 <= t0) return 0;
    var hol = holidays(cfg), key = dayKey(t0), last = dayKey(t1), sum = 0;
    if (cfg && cfg.offseason) late = true;
    for (var i = 0; i < 400 && key <= last; i++, key = addDays(key, 1)) {
      var d = day(key, cfg, hol); if (!d) continue;
      var s = dayStart(key), from = s + d.open * M, to = s + (late ? d.workEnd : d.guideEnd) * M;
      var got = overlap(t0, t1, from, to);
      if (got) got -= overlap(Math.max(t0, from), Math.min(t1, to), s + d.lunch[0] * M, s + d.lunch[1] * M);
      sum += got;
    }
    return sum;
  }
  function bizMin(t0, t1, cfg, late) { return Math.floor(bizMs(t0, t1, cfg, late) / M); }
  // a일 다음 날부터 b일까지 영업일 수(오래된 상담: 마지막 대화가 영업일 2일 넘게 지남)
  function bizDaysBetween(aMs, bMs, cfg) {
    var hol = holidays(cfg), a = dayKey(aMs), b = dayKey(bMs), n = 0, k = addDays(a, 1);
    for (var i = 0; i < 400 && k <= b; i++, k = addDays(k, 1)) if (day(k, cfg, hol)) n++;
    return n;
  }
  // 그날 몇 분(0시부터)인지
  function minuteOf(ms) { var d = new Date(ms + KST); return d.getUTCHours() * 60 + d.getUTCMinutes(); }
  var api = { DEFAULT_HOLIDAYS: DEFAULT_HOLIDAYS, LUNCH: LUNCH, OPEN: OPEN, dayKey: dayKey, dayStart: dayStart, addDays: addDays, weekday: weekday, holidays: holidays, day: day, bizMs: bizMs, bizMin: bizMin, bizDaysBetween: bizDaysBetween, minuteOf: minuteOf };
  root.WorkClock = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
