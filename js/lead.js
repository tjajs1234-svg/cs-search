/* 검색기 [현황·업무] · [계정] 탭(2026-11-12 주인): 예전에 따로 쓰던 확장(Center Lite)의 현황·업무·계정을 검색기로 합침
   · 관리 열쇠(csx:kbAdmin)가 있는 브라우저(관리 화면을 연 PC)에만 탭이 보임 — 상담사 PC엔 탭이 아예 없음 · 탭 이름에 '팀장' 말 없음
   · 게시판 현황: 기록기가 게시판 기록마다 남기는 '인입처'를 팀 서버 team.get(날짜 → 이름 → sites)에서 모아 보고 시트
     '고객 데일리 응대 현황' H~AH 칸 순서 그대로 보여 줌(팀 전체 · 같은 글 두 번 기록은 기록기가 이미 1건으로 셈)
     분홍 칸(O 119 · P 이메일 · R 그 외 이메일)은 안 셈 · 다른 분이 언제 적을지 몰라 붙여넣기를 ① H~N ② Q ③ S~AH 세 번으로 나눔
     H 11번가 톡은 기록기로 못 가려 손으로만 셈 · −/+ 손 고침과 '그날 본 가장 큰 숫자'는 이 PC에만(csx:leadAdj · csx:leadSeen)
   · 업무 알림: 대상 · 할 일 · 시간 → 시간이 되면 검색기 화면 오른쪽 아래 알림(이 PC 브라우저에만 · csx:leadTodos · 서버로 안 감)
   · 계정: 사이트 · 아이디 · 비밀번호 · 메모 — 주인이 정한 잠금 번호로 암호화(PBKDF2 + AES-GCM)해 이 PC 브라우저에만(csx:vault)
     깃허브 · 멘트 원본 · 팀 서버 · 검색기 연결 확장 보관본 어디에도 안 보냄 · 새로 열면 잠금 번호 한 번 · 60분 안 쓰면 다시 잠김 */
(function (root) {
  'use strict';
  // [칸, 시트 머리줄 이름, 기록기 인입처 이름들(null = 손으로만 · 0 = 안 셈)]
  var COLS = [
    ['H', '11번가 톡', null], ['I', '네이버', ['네이버']], ['J', '네이버몰', ['씨릴', '네이버몰']], ['K', '11번가', ['11번가']],
    ['L', '지마켓', ['지마켓/옥션', '지마켓', 'G마켓', '지마켓옥션']], ['M', '옥션', ['옥션']], ['N', '스토어', ['공식 스토어', '스토어', '카페24', '카페 24 (스토어)', '공식몰']],
    ['O', '119', 0], ['P', '이메일', 0], ['Q', '쿠팡', ['쿠팡']], ['R', '그 외 이메일', 0],
    ['S', '현대이지웰', ['현대이지웰', '이지웰']], ['T', 'M 포인트몰', ['M 포인트몰', 'M포인트몰']], ['U', '현대H몰(인증)', ['현대H몰', 'H몰']], ['V', '네이버페이', ['네이버페이']],
    ['W', '신세계', ['신세계', '신세계 SSG', 'SSG']], ['X', '카카오', ['카카오톡 선물하기', '카카오', '선물하기']], ['Y', '29cm', ['29cm']], ['Z', '에이블리', ['에이블리']],
    ['AA', '롯데ON', ['롯데ON', '롯데온']], ['AB', '하이마트', ['하이마트']], ['AC', 'GS샵 (인증)', ['GS샵']], ['AD', '삼성카드', ['삼성카드']], ['AE', '무신사', ['무신사']],
    ['AF', '오늘의집', ['오늘의집']], ['AG', 'SK베네피아', ['베네피아', 'SK베네피아']], ['AH', '토스', ['토스']]];
  var PIECES = [['H', 'N'], ['Q', 'Q'], ['S', 'AH']];
  function norm(s) { return String(s || '').replace(/\s+/g, '').toLowerCase(); }
  var SITE2COL = {}; COLS.forEach(function (c) { if (c[2]) c[2].forEach(function (n) { SITE2COL[norm(n)] = c[0]; }); });
  function colOf(site) { return SITE2COL[norm(site)] || ''; }
  function counted(c) { return c[2] !== 0; }

  /* 팀 서버 team.get 대답 → 그날 칸별 건수 { cols: {I: 3, …}, other: {'롯데홈쇼핑': 1}, people: n } (팀 전체 · '팀장' PC 숫자는 팀장 이름 줄과 합침) */
  function autoCounts(team, day) {
    var T = root.KBTeamStats, lead = T ? T.person((team && team.leadName) || '') : '';
    if (T && T.leadMerge && lead && lead !== '팀장') team = T.leadMerge(team, null, lead).team;
    var dd = ((team && team.days) || {})[day] || {}, cols = {}, other = {}, people = 0;
    Object.keys(dd).forEach(function (n) {
      var s = (dd[n] || {}).sites || {}, any = 0;
      Object.keys(s).forEach(function (site) {
        var v = Math.max(0, Math.round(Number(s[site]) || 0)); if (!v) return; any = 1;
        var c = colOf(site); if (c) cols[c] = (cols[c] || 0) + v; else other[site || '게시판'] = (other[site || '게시판'] || 0) + v;
      });
      people += any;
    });
    return { cols: cols, other: other, people: people };
  }
  /* 화면에 보일 숫자: max(서버 숫자, 이 PC가 그날 본 가장 큰 숫자) + 손 고침, 0 아래로 안 감 */
  function shown(auto, seen, adj) {
    var out = {}; COLS.forEach(function (c) { if (!counted(c)) return; var k = c[0], a = c[2] ? Math.max((auto || {})[k] || 0, (seen || {})[k] || 0) : 0; out[k] = Math.max(0, a + ((adj || {})[k] || 0)); });
    return out;
  }
  function total(vals) { return Object.keys(vals).reduce(function (s, k) { return s + (vals[k] || 0); }, 0); }
  /* 붙여넣기 한 조각(칸 from~to, 분홍 칸 없음) → 탭으로 이은 숫자 */
  function pieceText(vals, from, to) {
    var on = false, out = [];
    COLS.forEach(function (c) { if (c[0] === from) on = true; if (on) out.push(String(vals[c[0]] || 0)); if (c[0] === to) on = false; });
    return out.join('\t');
  }
  var pure = { COLS: COLS, PIECES: PIECES, colOf: colOf, autoCounts: autoCounts, shown: shown, total: total, pieceText: pieceText };
  if (typeof module === 'object' && module.exports) { module.exports = pure; return; }
  if (typeof document === 'undefined') return;

  /* ───────────── 화면 ───────────── */
  var S = root.CSStore, W = root.WorkClock;
  var K_ADJ = 'csx:leadAdj', K_SEEN = 'csx:leadSeen', K_TODO = 'csx:leadTodos', K_VAULT = 'csx:vault';
  function $(id) { return document.getElementById(id); }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function btn(label, cls, fn, title) { var b = el('button', 'btn' + (cls ? ' ' + cls : ''), label); b.type = 'button'; if (fn) b.addEventListener('click', fn); if (title) b.title = title; return b; }
  function toast(m, o) { if (root.CSApp && CSApp.toast) CSApp.toast(m, o); }
  function copy(t, m) { return root.CSApp && CSApp.copy ? CSApp.copy(t, m) : Promise.resolve(false); }
  function on() { try { return !!(S.json('csx:kbAdmin', null) || {}).token; } catch (e) { return false; } }
  function todayKey() { return W ? W.dayKey(Date.now()) : new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); }
  function addDays(k, n) { return new Date(Date.parse(k + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10); }
  function wd(k) { return new Date(Date.parse(k + 'T00:00:00Z')).getUTCDay(); }
  function md(k) { return Number(k.slice(5, 7)) + '/' + Number(k.slice(8, 10)) + '(' + '일월화수목금토'[wd(k)] + ')'; }
  function hm(t) { var d = new Date(t + 9 * 3600e3); return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'); }
  function prune(o, keep) { var from = addDays(todayKey(), -keep); Object.keys(o).forEach(function (k) { if (k < from) delete o[k]; }); return o; }
  function stepDay(k, dir) { var x = addDays(k, dir); while (wd(x) === 0 || wd(x) === 6) x = addDays(x, dir); return x; }

  var cur = '', day = '', team = null, gotAt = 0, err = '', loading = false, timer = 0;

  /* 게시판 현황 */
  async function loadTeam(force) {
    if (!root.CSTeam || !CSTeam.ready()) { team = null; err = 'noteam'; return; }
    var back = Math.round((Date.parse(todayKey() + 'T00:00:00Z') - Date.parse(day + 'T00:00:00Z')) / 864e5);
    var days = back < 8 ? 8 : 31; loading = true;
    try { team = await CSTeam.get('team.get', { days: days }, force ? 0 : 50000); gotAt = Date.now() - Math.max(0, CSTeam.peek('team.get', { days: days })); err = ''; }
    catch (e) { err = e.message || '불러오지 못했어요'; }
    loading = false;
  }
  function valsFor(d) {
    var auto = team ? autoCounts(team, d) : { cols: {}, other: {}, people: 0 };
    var seenAll = prune(S.json(K_SEEN, {}) || {}, 62), seen = seenAll[d] || {}, ch = 0;
    Object.keys(auto.cols).forEach(function (k) { if ((auto.cols[k] || 0) > (seen[k] || 0)) { seen[k] = auto.cols[k]; ch = 1; } });
    if (ch) { seenAll[d] = seen; S.put(K_SEEN, seenAll); }
    var adj = (S.json(K_ADJ, {}) || {})[d] || {};
    return { auto: auto, adj: adj, vals: shown(auto.cols, seen, adj) };
  }
  function setAdj(d, k, delta, cur) {
    var all = prune(S.json(K_ADJ, {}) || {}, 62), a = all[d] || (all[d] = {});
    if (cur + delta < 0) return; a[k] = (a[k] || 0) + delta; if (!a[k]) delete a[k]; if (!Object.keys(a).length) delete all[d];
    S.put(K_ADJ, all); renderLead('board');
  }
  function boardCard() {
    var c = el('div', 'ldcard ldboard'), h = el('div', 'ldh'), td = todayKey();
    h.append(el('h2', null, '게시판 현황'), el('span', 'ldsp'));
    var prev = btn('◀', 'sm', function () { day = stepDay(day, -1); refresh(false); }, '앞 근무일'); prev.disabled = day <= addDays(td, -30);
    var next = btn('▶', 'sm', function () { day = stepDay(day, 1); if (day > td) day = td; refresh(false); }, '다음 근무일'); next.disabled = day >= td;
    var lab = el('b', 'ldday', md(day) + (day === td ? ' 오늘' : ''));
    h.append(prev, lab, next); if (day !== td) h.append(btn('오늘', 'sm', function () { day = td; refresh(false); }));
    c.append(h);
    var V = valsFor(day), vals = V.vals;
    var sub = err === 'noteam' ? '팀 서버가 연결되지 않아 저절로 셀 수 없어요. −/+로만 셀 수 있어요.'
      : err ? '숫자를 받지 못했어요(' + err + '). 잠시 뒤 다시 받아요.'
      : '기록기로 기록한 게시판 글을 구매처별로 저절로 세요' + (gotAt ? ' · ' + hm(gotAt) + '에 받음' : loading ? ' · 받는 중…' : '') + ' · 기록하고 1~2분 뒤 늘어나요';
    c.append(el('p', 'ldsub' + (err && err !== 'noteam' ? ' warn' : ''), sub));
    var tot = el('div', 'ldtot'); tot.append(el('b', null, total(vals) + '건'), el('span', null, '합계 · 보고 시트 ' + Number(day.slice(5, 7)) + '월 탭 ' + Number(day.slice(5, 7)) + '/' + Number(day.slice(8, 10)) + ' 줄 H~AH 칸 그대로'));
    c.append(tot);
    var list = el('div', 'ldrows');
    COLS.forEach(function (col) {
      var k = col[0], r = el('div', 'ldrow'); r.dataset.col = k;
      r.append(el('span', 'ldcol', k));
      var nm = el('span', 'ldnm', col[1]);
      if (!counted(col)) { r.classList.add('skip'); r.append(nm, el('span', 'ldskip', '안 셈 · 비워 둠')); list.append(r); return; }
      var v = vals[k] || 0, a = V.adj[k] || 0;
      if (col[2] === null) nm.append(el('span', 'ldhand', '손으로 셈'));
      else if (a) nm.append(el('span', 'ldhand', (a > 0 ? '+' : '') + a + ' 손'));
      if (!v) r.classList.add('zero');
      var minus = btn('−', 'ldadj', function () { setAdj(day, k, -1, v); }, '하나 빼기(이 PC에만)'); minus.disabled = !v; minus.setAttribute('aria-label', col[1] + ' 하나 빼기');
      var plus = btn('+', 'ldadj', function () { setAdj(day, k, 1, v); }, '하나 더하기(이 PC에만)'); plus.setAttribute('aria-label', col[1] + ' 하나 더하기');
      r.append(nm, minus, el('b', 'ldv', String(v)), plus); list.append(r);
    });
    c.append(list);
    var cp = el('div', 'ldcopy');
    PIECES.forEach(function (p, i) {
      var lab2 = '①②③'[i] + ' ' + (p[0] === p[1] ? p[0] : p[0] + '~' + p[1]) + ' 복사 → ' + p[0] + '칸에';
      cp.append(btn(lab2, 'primary', function () { copy(pieceText(valsFor(day).vals, p[0], p[1]), '복사했어요 · 시트 ' + md(day) + ' 줄 ' + p[0] + '칸을 누르고 Ctrl+V'); }));
    });
    c.append(cp);
    var nt = el('div', 'ldnote');
    nt.append(el('div', null, '분홍 칸(119 · 이메일 · 그 외 이메일)은 건드리지 않게 세 번 나눠 붙여요.'), el('div', null, '−/+는 기록기가 멈췄을 때 처리한 글 · 지마켓·옥션 나누기(기록기는 한 칸) · 11번가 톡에 써요. 이 PC에만 남아요.'));
    var ot = Object.keys(V.auto.other);
    if (ot.length) nt.append(el('div', 'ldother', '시트에 칸이 없어 안 센 기록: ' + ot.map(function (n) { return (n === '게시판' ? '인입처 없음' : n) + ' ' + V.auto.other[n] + '건'; }).join(' · ')));
    c.append(nt);
    return c;
  }

  /* 업무 알림 */
  function todos() { var v = S.json(K_TODO, []); return Array.isArray(v) ? v : []; }
  function saveTodos(l) { S.put(K_TODO, l); badge(); }
  function due(t) { return !t.done && t.time && t.time <= Date.now(); }
  function badge() { var b = $('leadBadge'); if (!b) return; var n = on() ? todos().filter(due).length : 0; b.hidden = !n; b.textContent = n > 9 ? '9+' : String(n); }
  function fmtTime(t) { var d = new Date(t + 9 * 3600e3); return (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + ' ' + String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'); }
  function kstInput(t) { var d = new Date(t + 9 * 3600e3).toISOString(); return { date: d.slice(0, 10), time: d.slice(11, 16) }; }
  function todoCard() {
    var c = el('div', 'ldcard ldtodo'), h = el('div', 'ldh');
    h.append(el('h2', null, '업무 알림'), el('span', 'ldsp'));
    var L = todos(), doneN = L.filter(function (t) { return t.done; }).length;
    if (doneN) h.append(btn('끝낸 것 지우기', 'sm ghost', function () { saveTodos(todos().filter(function (t) { return !t.done; })); renderLead('todo'); }));
    c.append(h, el('p', 'ldsub', '이 PC 브라우저에만 저장해요(서버 · 다른 PC로 안 감) · 시간이 되면 검색기 화면에 알려요'));
    var f = el('div', 'ldform');
    var who = el('input'); who.placeholder = '대상 (예: 주문번호 끝 4자리)'; who.maxLength = 60; who.setAttribute('aria-label', '대상');
    var task = el('input'); task.placeholder = '할 일'; task.maxLength = 200; task.setAttribute('aria-label', '할 일');
    var dt = el('input'); dt.type = 'date'; dt.setAttribute('aria-label', '날짜');
    var tm = el('input'); tm.type = 'time'; tm.setAttribute('aria-label', '시간');
    var row = el('div', 'ldfr');
    row.append(btn('오늘', 'sm', function () { dt.value = todayKey(); }), btn('내일', 'sm', function () { dt.value = stepDay(todayKey(), 1); }),
      btn('30분 뒤', 'sm', function () { var x = kstInput(Date.now() + 30 * 6e4); dt.value = x.date; tm.value = x.time; }), dt, tm, el('span', 'ldsp'),
      btn('저장', 'primary', function () {
        var n = who.value.trim(), t = task.value.trim(); if (!n && !t) { toast('대상이나 할 일을 적어 주세요', { warn: true }); who.focus(); return; }
        var at = null; if (dt.value) { at = Date.parse(dt.value + 'T' + (tm.value || '09:00') + ':00+09:00'); if (!isFinite(at)) at = null; }
        var l = todos(); l.push({ id: Date.now(), name: n, task: t, time: at, done: false, alerted: !!(at && at <= Date.now()) }); saveTodos(l);
        toast(at ? '업무를 적었어요 · ' + fmtTime(at) + '에 알려 드려요' : '업무를 적었어요'); renderLead('todo');
      }));
    f.append(who, task, row); c.append(f);
    var ul = el('div', 'ldlist');
    var sorted = L.slice().sort(function (a, b) { return (a.done - b.done) || ((a.time || 9e15) - (b.time || 9e15)) || (a.id - b.id); });
    if (!sorted.length) ul.append(el('p', 'ldempty', '적어 둔 업무가 없어요'));
    sorted.forEach(function (t) {
      var r = el('div', 'ldtd' + (t.done ? ' done' : due(t) ? ' due' : ''));
      var ck = btn(t.done ? '✓' : due(t) ? '!' : '', 'ldck', function () { var l = todos(); l.forEach(function (x) { if (x.id === t.id) { x.done = !x.done; if (!x.done && x.time && x.time <= Date.now()) x.alerted = true; } }); saveTodos(l); renderLead('todo'); }, t.done ? '다시 할 일로' : '끝냄');
      ck.setAttribute('aria-label', t.done ? '다시 할 일로' : '끝냄');
      var info = el('div', 'ldti'); info.append(el('div', 'ldtt', (t.name || '') + (t.name && t.task ? ': ' : '') + (t.task || '')), el('div', 'ldtm', t.done ? '끝냄' : t.time ? '⏰ ' + fmtTime(t.time) + (due(t) ? ' · 시간 됐어요' : '') : '시간 없음'));
      var del = btn('×', 'ldx', function () { if (!confirm('이 업무를 지울까요?')) return; saveTodos(todos().filter(function (x) { return x.id !== t.id; })); renderLead('todo'); }, '지우기'); del.setAttribute('aria-label', '지우기');
      r.append(ck, info, del); ul.append(r);
    });
    c.append(ul);
    return c;
  }
  // 시간이 된 업무 → 화면 오른쪽 아래 알림([확인] · [10분 뒤])
  var dueBox = null;
  function checkDue() {
    badge(); if (!on()) { if (dueBox) { dueBox.remove(); dueBox = null; } return; }
    var t = todos().filter(function (x) { return due(x) && !x.alerted; })[0];
    if (!t) { if (dueBox) { dueBox.remove(); dueBox = null; } return; }
    if (dueBox && dueBox.dataset.id === String(t.id)) return;
    if (dueBox) dueBox.remove();
    dueBox = el('div', 'lddue'); dueBox.dataset.id = String(t.id); dueBox.setAttribute('role', 'alert');
    var mark = function (fn) { var l = todos(); l.forEach(function (x) { if (x.id === t.id) fn(x); }); saveTodos(l); dueBox.remove(); dueBox = null; if (cur === 'lead') renderLead('todo'); checkDue(); };
    var a = el('div', 'ldda');
    a.append(btn('업무 보기', 'sm', function () { mark(function (x) { x.alerted = true; }); if (root.CSApp) CSApp.setView('lead'); }), btn('10분 뒤', 'sm', function () { mark(function (x) { x.time = Date.now() + 10 * 6e4; x.alerted = false; }); }), btn('확인', 'sm primary', function () { mark(function (x) { x.alerted = true; }); }));
    dueBox.append(el('b', null, '⏰ 업무 알림'), el('div', 'lddt', (t.name || '') + (t.name && t.task ? ': ' : '') + (t.task || '')), a);
    document.body.append(dueBox);
  }

  // 게시판 칸과 업무 칸을 따로 그림 — 1분마다 숫자를 새로 받아도 적고 있던 업무 칸은 그대로
  var gridEl = null;
  function renderLead(which) {
    var L = $('leadList'); if (!L || cur !== 'lead') return;
    if (!gridEl || !L.contains(gridEl)) { gridEl = el('div', 'ldgrid'); gridEl.append(el('div', 'ldslot'), el('div', 'ldslot')); L.replaceChildren(gridEl); which = ''; }
    if (which !== 'todo') gridEl.firstChild.replaceChildren(boardCard());
    if (which !== 'board') gridEl.lastChild.replaceChildren(todoCard());
  }
  async function refresh(force) { renderLead(gridEl && $('leadList').contains(gridEl) ? 'board' : ''); await loadTeam(force); renderLead('board'); }

  /* ───────────── 계정(잠금 번호로 암호화 · 이 PC에만) ───────────── */
  var vkey = null, vdata = null, vsalt = null, vtouch = 0, vq = '', ITER = 200000, IDLE = 60 * 6e4;
  var enc = new TextEncoder(), dec = new TextDecoder();
  function b64(u8) { var s = ''; for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); }
  function unb64(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  async function derive(pin, salt, iter) {
    var base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function seal(key, salt, obj) {
    var iv = crypto.getRandomValues(new Uint8Array(12)), ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, enc.encode(JSON.stringify(obj))));
    return { kind: 'cs-vault', v: 1, iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct), at: Date.now() };
  }
  async function open(box, pin) {
    var salt = unb64(box.salt), key = await derive(pin, salt, box.iter || ITER);
    var pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, key, unb64(box.ct)); // 번호가 틀리면 여기서 실패
    var d = JSON.parse(dec.decode(pt)); if (!d || !Array.isArray(d.accounts)) d = { accounts: [] };
    return { key: key, salt: salt, data: d };
  }
  function stored() { var v = S.json(K_VAULT, null); return v && v.kind === 'cs-vault' && v.ct ? v : null; }
  var saving = Promise.resolve();
  function persist() {
    if (!vkey) return saving;
    var snap = JSON.parse(JSON.stringify(vdata));
    saving = saving.then(async function () { var box = await seal(vkey, vsalt, snap); if (!S.set(K_VAULT, JSON.stringify(box))) toast('저장하지 못했어요(브라우저 저장 공간)', { warn: true }); var m = $('acctSaved'); if (m) { m.textContent = '저장됨 ' + hm(Date.now()); } }).catch(function () { toast('저장하지 못했어요', { warn: true }); });
    return saving;
  }
  function lock() { vkey = null; vdata = null; vsalt = null; if (cur === 'acct') renderAcct(); }
  function touch() { vtouch = Date.now(); }

  function pinForm(first) {
    var c = el('div', 'ldcard ldlock'), f = el('form', 'ldpin');
    c.append(el('h2', null, first ? '계정 잠금 번호 정하기' : '계정 열기'));
    c.append(el('p', 'ldsub', first ? '계정은 이 PC 브라우저에만, 지금 정하는 잠금 번호로 잠가서 저장해요. 잊으면 되살릴 수 없으니 기억해 두세요(4글자 이상).' : '잠금 번호를 넣어 주세요. 검색기를 새로 열거나 60분 안 쓰면 다시 잠겨요.'));
    var p1 = el('input'); p1.type = 'password'; p1.autocomplete = 'off'; p1.placeholder = '잠금 번호'; p1.setAttribute('aria-label', '잠금 번호');
    var p2 = el('input'); p2.type = 'password'; p2.autocomplete = 'off'; p2.placeholder = '한 번 더'; p2.setAttribute('aria-label', '잠금 번호 한 번 더');
    var go = btn(first ? '정하기' : '열기', 'primary'); go.type = 'submit';
    f.append(p1); if (first) f.append(p2); f.append(go);
    var msg = el('p', 'ldmsg'); c.append(f, msg);
    f.addEventListener('submit', async function (e) {
      e.preventDefault(); var pin = p1.value; msg.textContent = '';
      if (first) {
        if (pin.length < 4) { msg.textContent = '4글자 이상으로 정해 주세요'; return; }
        if (pin !== p2.value) { msg.textContent = '두 번 넣은 번호가 달라요'; return; }
        go.disabled = true; vsalt = crypto.getRandomValues(new Uint8Array(16)); vkey = await derive(pin, vsalt, ITER); vdata = { accounts: [] }; await persist(); touch(); renderAcct(); return;
      }
      var box = stored(); if (!box) { renderAcct(); return; }
      go.disabled = true; msg.textContent = '여는 중…';
      try { var o = await open(box, pin); vkey = o.key; vsalt = o.salt; vdata = o.data; touch(); renderAcct(); }
      catch (er) { go.disabled = false; msg.textContent = '잠금 번호가 달라요'; p1.select(); }
    });
    if (!first) {
      var reset = btn('잠금 번호를 잊었어요', 'sm ghost', function () {
        if (!confirm('잠금 번호를 잊으면 저장한 계정을 열 수 없어요.\n이 PC의 계정을 모두 지우고 새로 시작할까요? (백업 파일이 있으면 나중에 불러올 수 있어요)')) return;
        S.del(K_VAULT); lock(); toast('계정을 모두 지웠어요. 새 잠금 번호를 정해 주세요');
      });
      c.append(reset);
    }
    setTimeout(function () { p1.focus(); }, 0);
    return c;
  }
  function acctRow(a) {
    var r = el('div', 'ldac'); r.dataset.id = String(a.id);
    var set = function (k, v) { touch(); vdata.accounts.forEach(function (x) { if (x.id === a.id) x[k] = v; }); persist(); };
    var site = el('input', 'ldsite'); site.value = a.site || ''; site.placeholder = '사이트'; site.setAttribute('aria-label', '사이트'); site.addEventListener('change', function () { set('site', site.value.trim()); });
    var del = btn('지우기', 'sm ghost danger', function () { if (!confirm('"' + (a.site || '이 계정') + '" 계정을 지울까요?')) return; touch(); vdata.accounts = vdata.accounts.filter(function (x) { return x.id !== a.id; }); persist(); renderAcct(); });
    var top = el('div', 'ldach'); top.append(site, del);
    var idr = el('div', 'ldacr'), uid = el('input', 'lduid'); uid.value = a.uid || ''; uid.placeholder = '아이디'; uid.autocomplete = 'off'; uid.setAttribute('aria-label', '아이디'); uid.addEventListener('change', function () { set('uid', uid.value.trim()); });
    idr.append(el('span', 'ldlab', 'ID'), uid, btn('복사', 'sm', function () { touch(); copy(uid.value, '아이디를 복사했어요'); }));
    var pwr = el('div', 'ldacr'), pw = el('input', 'ldpw'); pw.type = 'password'; pw.value = a.upw || ''; pw.placeholder = '비밀번호'; pw.autocomplete = 'new-password'; pw.setAttribute('aria-label', '비밀번호'); pw.addEventListener('change', function () { set('upw', pw.value); });
    var eye = btn('보기', 'sm', function () { touch(); var s = pw.type === 'password'; pw.type = s ? 'text' : 'password'; eye.textContent = s ? '가리기' : '보기'; });
    pwr.append(el('span', 'ldlab', 'PW'), pw, eye, btn('복사', 'sm', function () { touch(); copy(pw.value, '비밀번호를 복사했어요'); }));
    var memo = el('textarea', 'ldmemo'); memo.rows = 1; memo.value = a.memo || ''; memo.placeholder = '메모'; memo.setAttribute('aria-label', '메모'); memo.addEventListener('change', function () { set('memo', memo.value); });
    var fit = function () { memo.style.height = 'auto'; memo.style.height = Math.min(160, memo.scrollHeight + 2) + 'px'; }; memo.addEventListener('input', fit); setTimeout(fit, 0);
    r.append(top, idr, pwr, memo);
    return r;
  }
  function renderAcct() {
    var L = $('acctList'); if (!L || cur !== 'acct') return;
    if (!root.crypto || !crypto.subtle) { L.replaceChildren(el('p', 'ldsub warn', '이 브라우저에선 잠금(암호화)을 쓸 수 없어 계정을 열 수 없어요.')); return; }
    if (vkey && Date.now() - vtouch > IDLE) lock();
    if (!vkey) { L.replaceChildren(pinForm(!stored())); return; }
    var c = el('div', 'ldcard ldacct'), h = el('div', 'ldh');
    h.append(el('h2', null, '계정'), el('span', 'ldmut', vdata.accounts.length + '개'), el('span', 'ldsp'), el('span', 'ldmut', ''), btn('잠그기', 'sm', function () { lock(); }));
    h.lastChild.previousSibling.id = 'acctSaved';
    c.append(h, el('p', 'ldsub', '이 PC 브라우저에만 잠가서 저장해요(서버 · 깃허브 · 다른 PC로 안 감). 브라우저 기록(사이트 데이터)을 지우면 사라지니 가끔 [백업 내려받기]를 해 두세요.'));
    var bar = el('div', 'ldbar'), q = el('input', 'ldq'); q.type = 'search'; q.value = vq; q.placeholder = '사이트 · 아이디 · 메모 찾기'; q.setAttribute('aria-label', '계정 찾기');
    q.addEventListener('input', function () { vq = q.value; touch(); draw(); });
    var file = el('input'); file.type = 'file'; file.accept = '.json,application/json'; file.hidden = true; file.addEventListener('change', function () { importFile(file.files && file.files[0]); file.value = ''; });
    bar.append(q, btn('+ 계정 추가', 'primary', function () { touch(); vdata.accounts.unshift({ id: Date.now(), site: '', uid: '', upw: '', memo: '' }); vq = ''; persist(); renderAcct(); var f = document.querySelector('#acctList .ldsite'); if (f) f.focus(); }),
      btn('백업 내려받기', '', exportVault, '잠긴 채로 파일 저장(잠금 번호가 있어야 열림)'), btn('백업 불러오기', '', function () { file.click(); }, '이 백업 파일 또는 예전 확장 백업 파일'), file);
    c.append(bar);
    var list = el('div', 'ldacs'); c.append(list);
    function draw() {
      var s = norm(vq), rows = vdata.accounts.filter(function (a) { return !s || norm(a.site + ' ' + a.uid + ' ' + a.memo).indexOf(s) >= 0; });
      list.replaceChildren(); if (!rows.length) list.append(el('p', 'ldempty', vq ? '찾는 계정이 없어요' : '아직 계정이 없어요. [+ 계정 추가]나 [백업 불러오기]로 넣어 주세요'));
      rows.forEach(function (a) { list.append(acctRow(a)); });
    }
    draw();
    var more = el('details', 'ldmore'); more.append(el('summary', null, '잠금 번호 바꾸기'));
    var n1 = el('input'); n1.type = 'password'; n1.placeholder = '새 잠금 번호'; n1.setAttribute('aria-label', '새 잠금 번호');
    var n2 = el('input'); n2.type = 'password'; n2.placeholder = '한 번 더'; n2.setAttribute('aria-label', '새 잠금 번호 한 번 더');
    more.append(n1, n2, btn('바꾸기', 'sm primary', async function () {
      if (n1.value.length < 4) { toast('4글자 이상으로 정해 주세요', { warn: true }); return; }
      if (n1.value !== n2.value) { toast('두 번 넣은 번호가 달라요', { warn: true }); return; }
      touch(); vsalt = crypto.getRandomValues(new Uint8Array(16)); vkey = await derive(n1.value, vsalt, ITER); await persist(); n1.value = n2.value = ''; toast('잠금 번호를 바꿨어요. 예전에 내려받은 백업은 예전 번호로 열려요');
    }));
    c.append(more);
    L.replaceChildren(c);
  }
  function download(name, text) {
    var a = el('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' })); a.download = name;
    document.body.append(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
  }
  async function exportVault() {
    touch(); await persist(); var box = stored(); if (!box) return;
    download('계정_백업_' + todayKey().replace(/-/g, '') + '.json', JSON.stringify(box)); toast('잠긴 백업 파일을 내려받았어요(잠금 번호가 있어야 열려요)');
  }
  // 이 백업(잠긴 파일) 또는 예전 확장 백업(accounts · todos) → 합치기(같은 사이트+아이디는 건너뜀)
  async function importFile(file) {
    touch(); if (!file) return; if (file.size > 5 * 1024 * 1024) { toast('파일이 너무 커요', { warn: true }); return; }
    var x = null; try { x = JSON.parse(await file.text()); } catch (e) { toast('백업 파일을 읽지 못했어요', { warn: true }); return; }
    var accs = [], tds = [], legacy = false;
    if (x && x.kind === 'cs-vault') {
      var got = null;
      if (vkey && vsalt && x.salt === b64(vsalt)) { try { var pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(x.iv) }, vkey, unb64(x.ct)); got = { data: JSON.parse(dec.decode(pt)) || {} }; } catch (e) {} } // 지금 잠금 번호로 만든 백업이면 바로
      if (!got) { var pin = prompt('이 백업 파일의 잠금 번호를 넣어 주세요'); if (pin == null) return; try { got = await open(x, pin); } catch (e) { toast('잠금 번호가 달라요', { warn: true }); return; } }
      accs = got.data.accounts || [];
    } else if (x && (Array.isArray(x.accounts) || Array.isArray(x.todos))) { legacy = true; accs = Array.isArray(x.accounts) ? x.accounts : []; tds = Array.isArray(x.todos) ? x.todos : []; }
    else { toast('계정 백업 파일이 아니에요', { warn: true }); return; }
    var have = {}; vdata.accounts.forEach(function (a) { have[norm(a.site) + '|' + norm(a.uid)] = 1; });
    var nA = 0, base = Date.now();
    accs.forEach(function (a, i) {
      if (!a || typeof a !== 'object') return; var o = { id: base + i, site: String(a.site || '').slice(0, 200), uid: String(a.uid || '').slice(0, 200), upw: String(a.upw || '').slice(0, 500), memo: String(a.memo || '').slice(0, 2000) };
      var k = norm(o.site) + '|' + norm(o.uid); if (have[k] || (!o.site && !o.uid)) return; have[k] = 1; vdata.accounts.push(o); nA++;
    });
    var nT = 0;
    if (tds.length) {
      var l = todos(), seen = {}; l.forEach(function (t) { seen[norm(t.name) + '|' + norm(t.task) + '|' + (t.time || '')] = 1; });
      tds.forEach(function (t, i) {
        if (!t || typeof t !== 'object') return; var o = { id: base + 1000 + i, name: String(t.name || '').slice(0, 60), task: String(t.task || '').slice(0, 200), time: typeof t.time === 'number' && isFinite(t.time) ? t.time : null, done: !!t.done, alerted: true };
        var k = norm(o.name) + '|' + norm(o.task) + '|' + (o.time || ''); if (seen[k] || (!o.name && !o.task)) return; seen[k] = 1; l.push(o); nT++;
      });
      saveTodos(l);
    }
    await persist(); renderAcct();
    toast('가져왔어요 · 계정 ' + nA + '개' + (legacy ? ' · 업무 ' + nT + '개' : '') + (legacy ? ' · 예전 백업 파일은 비밀번호가 그대로 보이는 파일이라 다 쓰면 지워 주세요' : ''), legacy ? { action: { label: '알겠어요', fn: function () {} } } : null);
  }

  /* 탭 · 보기 */
  function syncTabs() {
    var y = on(); ['leadTab', 'acctTab'].forEach(function (id) { var t = $(id); if (t) t.hidden = !y; });
    if (!y && (cur === 'lead' || cur === 'acct') && root.CSApp) CSApp.setView('scripts', false);
    if (!y) lock();
    checkDue();
  }
  function show(v) {
    cur = v; clearInterval(timer); timer = 0;
    if (v === 'lead') { gridEl = null; if (!day) day = todayKey(); refresh(false); timer = setInterval(function () { if (!document.hidden) { if (day !== todayKey() && day > addDays(todayKey(), -1)) day = todayKey(); refresh(false); } }, 60000); }
    if (v === 'acct') renderAcct();
  }
  function hide() { cur = ''; clearInterval(timer); timer = 0; }
  // 계정 탭을 보고 있으면 쓰는 동안은 안 잠김 · 60분 손을 안 대면 잠김
  document.addEventListener('pointerdown', function () { if (cur === 'acct' && vkey) touch(); }, true);
  document.addEventListener('keydown', function () { if (cur === 'acct' && vkey) touch(); }, true);
  setInterval(function () { if (vkey && Date.now() - vtouch > IDLE) lock(); }, 60000);
  setInterval(checkDue, 20000);
  window.addEventListener('storage', function (e) { if (e.key === 'csx:kbAdmin') syncTabs(); if (e.key === K_TODO) { badge(); if (cur === 'lead') renderLead('todo'); } });
  root.KBLead = Object.assign({ on: on, syncTabs: syncTabs, show: show, hide: hide, checkDue: checkDue, _lock: lock, _refresh: refresh }, pure);
})(typeof globalThis !== 'undefined' ? globalThis : this);
