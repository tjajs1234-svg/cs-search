/* 검색기 [내 피드백] 탭(2026-11-06 주인): 관리 화면 [이달의 상담사] QA 감점 기록에서 '상담사에게 보내기'를 누른 건만 그 상담사에게
   · 본인 것만(검색기가 아는 이 PC 이름으로 팀 서버 fb.get) · 이번 달 · 지난달
   · 날짜 · 종류 · 무엇이 틀렸나 · 이렇게 했어야 해요 · [상담 열기] · [확인했어요](fb.ack — 확인 시각이 관리 화면 · 면담 화면에 남음)
   · 점수(−3점)는 안 보임(주인 11/01: 인센티브 기준을 상담사에게 숨김) · 상담사 화면이라 '팀장' 말을 쓰지 않음
   · 새 피드백이 오면 1분 안에 이 PC에만 창이 뜸: [네, 확인했어요]를 눌러야 닫힘 · [내 피드백에서 볼게요]는 탭으로 가고 1시간 뒤 다시 뜸
     입력 중이거나 다른 확인 창(공지 · 한줄평)이 떠 있으면 기다림 · 검색기 웹 안에서만 뜸
   · 자료: 팀 서버 1.3.26 fb.get · fb.ack(예전 판이면 탭에 '팀 서버 새 판이 필요해요') · 고객 이름·내용은 안 다룸 */
(function (root) {
  'use strict';
  var TYPES = { wi: ['오안내', ''], wp: ['오처리', ''], nt: ['공지 미반영', ''], pq: ['응대 미흡', ' m'] };
  var SNOOZE = 'csx:fbLater', list = null, err = '', at = 0, month = 'this', timer = 0, popOpen = null, lastKey = 0, loading = null, shown = false;
  function $(id) { return document.getElementById(id); }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function name() { try { return root.CSWho ? String(CSWho.name() || '').trim() : ''; } catch (e) { return ''; } }
  function short(n) { try { return root.KBTeamStats ? KBTeamStats.person(n) || n : n; } catch (e) { return n; } }
  function kst(t) { return new Date(t + 9 * 3600e3); }
  function md(k) { return Number(k.slice(5, 7)) + '/' + Number(k.slice(8, 10)) + '(' + '일월화수목금토'[new Date(k + 'T00:00:00Z').getUTCDay()] + ')'; }
  function hm(t) { var d = kst(t); return (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + ' ' + String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'); }
  function ym(off) { var d = kst(Date.now()); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + off); return d.toISOString().slice(0, 7); }
  function later() { try { var o = JSON.parse(localStorage.getItem(SNOOZE) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
  function setLater(id) { var o = later(), now = Date.now(); Object.keys(o).forEach(function (k) { if (o[k] < now - 864e5) delete o[k]; }); o[id] = now + 3600e3; try { localStorage.setItem(SNOOZE, JSON.stringify(o)); } catch (e) {} }
  function unread() { return (list || []).filter(function (x) { return !x.ack; }); }

  async function load() {
    if (loading) return loading;
    loading = (async function () {
      var n = name();
      if (!root.CSTeam || !CSTeam.ready() || !n) { list = null; err = n ? '' : 'noname'; return; }
      try { var r = await CSTeam.call('fb.get', { name: n }); list = Array.isArray(r.list) ? r.list : []; err = ''; at = Date.now(); }
      catch (e) { err = /모르는 요청/.test(e.message || '') ? 'old' : (e.message || '불러오지 못했어요'); }
      at = Date.now(); // 실패해도 바로 다시 묻지 않게
    })();
    try { await loading; } finally { loading = null; }
    badge(); if (shown) render(); check();
  }
  function badge() { var b = $('fbBadge'); if (!b) return; var n = unread().length; b.hidden = !n; b.textContent = n > 9 ? '9+' : String(n); }

  function typeTag(t) { var x = TYPES[t] || ['피드백', '']; return el('span', 'fbty' + x[1], x[0]); }
  function link(u) { var a = el('a', 'fblink', '상담 열기 ↗'); a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; }
  function body(x) {
    var f = document.createDocumentFragment(), w = el('div', 'fbwrong'); w.append(el('span', 'l', '무엇이 틀렸나'), el('span', null, x.memo || '–')); f.append(w);
    if (x.fix) { var g = el('div', 'fbfix'); g.append(el('span', 'l', '이렇게 했어야 해요'), el('span', null, x.fix)); f.append(g); }
    return f;
  }
  async function ack(x, b) {
    if (b) b.disabled = true;
    try { var r = await CSTeam.call('fb.ack', { name: name(), id: x.id }); x.ack = r.ack || Date.now(); badge(); if (shown) render(); return true; }
    catch (e) { if (b) b.disabled = false; if (root.alert) alert('확인을 저장하지 못했어요. 잠시 뒤 다시 눌러 주세요.\n' + (e.message || '')); return false; }
  }

  function render() {
    var L = $('fbList'); if (!L) return; L.replaceChildren();
    var n = short(name()), m = month === 'this' ? ym(0) : ym(-1), head = el('div', 'bhead fbhead'), h2 = el('h2', null, '내 피드백 · ' + Number(m.slice(5)) + '월');
    var sw = el('div', 'fbsw');
    [['this', '이번 달'], ['last', '지난달']].forEach(function (o) { var b = el('button', month === o[0] ? 'on' : null, o[1]); b.type = 'button'; b.addEventListener('click', function () { month = o[0]; render(); }); sw.append(b); });
    var hl = el('div', 'fbhl'); hl.append(h2, el('span', 'fbme', '나에게만 보여요'), el('span', 'sp'), sw); head.append(hl);
    head.append(el('p', null, '상담을 다시 열어 보고 같은 실수가 없게 해 주세요. 확인하면 [확인했어요]를 눌러 주세요.')); L.append(head);
    if (err === 'noname') { L.append(el('div', 'empty', '이 PC 상담사 이름을 알 수 없어요.\n기록기를 켜 두거나, 요청·건의에서 이름을 한 번 적어 주세요.')); return; }
    if (err === 'old') { L.append(el('div', 'empty', '팀 서버 새 판(1.3.26)이 올라가면 보여요.')); return; }
    if (!list) { L.append(el('div', 'empty', err ? '불러오지 못했어요.\n' + err : '불러오는 중…')); return; }
    if (err) L.append(el('div', 'scope', '새로 불러오지 못해 지난번 것을 보여 줘요 · ' + err));
    var mine = list.filter(function (x) { return x.d.slice(0, 7) === m; }), cnt = {}, un = 0;
    mine.forEach(function (x) { cnt[x.t] = (cnt[x.t] || 0) + 1; if (!x.ack) un++; });
    var sum = el('div', 'fbsum'); sum.append(el('span', null, (month === 'this' ? '이번 달 ' : '지난달 ') + mine.length + '건'));
    Object.keys(TYPES).forEach(function (t) { if (cnt[t]) sum.append(el('span', null, TYPES[t][0] + ' ' + cnt[t])); });
    if (un) sum.append(el('span', 'un', '확인 안 한 것 ' + un));
    L.append(sum);
    if (!mine.length) { L.append(el('div', 'empty', (n ? n + ' 님, ' : '') + (month === 'this' ? '이번 달' : '지난달') + ' 받은 피드백이 없어요 ✓')); return; }
    var wrap = el('div', 'fbcards');
    mine.forEach(function (x) {
      var c = el('div', 'fbcard' + (x.ack ? '' : ' new')), top = el('div', 'fbtop'); top.append(el('span', 'd', md(x.d)), typeTag(x.t), el('span', 'sp'));
      if (x.u) top.append(link(x.u));
      if (x.ack) top.append(el('span', 'fbok', '✓ ' + hm(x.ack) + ' 확인'));
      else { var b = el('button', 'btn primary sm fback', '확인했어요'); b.type = 'button'; b.addEventListener('click', function () { ack(x, b); }); top.append(b); }
      c.append(top, body(x)); wrap.append(c);
    });
    L.append(wrap);
  }

  // ── 새 피드백 창(이 PC에만) ──
  function busy() {
    if (popOpen || document.querySelector('.nask')) return true;
    var a = document.activeElement; return !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && Date.now() - lastKey < 8000);
  }
  function check() {
    if (root.KB_NO_FBPOP || document.hidden || busy() || !list) return;
    var lt = later(), now = Date.now(), todo = unread().filter(function (x) { return !(lt[x.id] > now); });
    if (!todo.length) return;
    openPop(todo.slice().reverse()); // 오래된 것부터
  }
  function openPop(items) {
    var bg = el('div', 'nask fbpop'), d = el('div', 'naskd fbpopd'), i = 0; bg.setAttribute('role', 'dialog'); bg.setAttribute('aria-modal', 'true'); bg.setAttribute('aria-labelledby', 'fbpopT');
    function draw() {
      var x = items[i]; d.replaceChildren();
      var h = el('h4', null, (short(name()) || '') + ' 님, 확인해 주세요'); h.id = 'fbpopT';
      d.append(el('span', 'hpop-tag', 'QA 피드백 ' + items.length + '건' + (items.length > 1 ? ' · ' + (i + 1) + '번째' : '')), h, el('p', null, '상담을 다시 열어 보고 다음엔 이렇게 해 주세요.'));
      var it = el('div', 'fbcard new'), top = el('div', 'fbtop'); top.append(el('span', 'd', md(x.d)), typeTag(x.t)); it.append(top, body(x));
      if (x.u) { var lk = el('div', 'fblk'); lk.append(link(x.u)); it.append(lk); }
      d.append(it);
      var go = el('button', 'btn ghost', '내 피드백에서 볼게요'); go.type = 'button';
      go.addEventListener('click', function () { items.forEach(function (y) { if (!y.ack) setLater(y.id); }); close(); var t = document.querySelector('.tab[data-v="fb"]'); if (t) t.click(); });
      var ok = el('button', 'btn primary', '네, 확인했어요'); ok.type = 'button';
      ok.addEventListener('click', async function () { if (!(await ack(x, ok))) return; i++; while (i < items.length && items[i].ack) i++; if (i < items.length) draw(); else close(); });
      var a = el('div', 'acts'); a.append(go, ok); d.append(a); ok.focus();
    }
    function close() { bg.remove(); popOpen = null; }
    draw(); bg.append(d); document.body.append(bg); popOpen = bg;
  }

  function start() {
    if (typeof document === 'undefined' || start.on) return; start.on = true;
    document.addEventListener('keydown', function () { lastKey = Date.now(); }, true);
    document.addEventListener('visibilitychange', function () { if (!document.hidden && Date.now() - at > 30000) load(); });
    setInterval(function () { if (!document.hidden) { if (Date.now() - at > 55000) load(); else check(); } }, 20000);
    setTimeout(load, 3000);
    if (root.CSWho && CSWho.on) CSWho.on(function () { load(); });
  }
  start();
  function show() { shown = true; render(); load(); clearInterval(timer); timer = setInterval(function () { if (!document.hidden) load(); }, 60000); }
  function hide() { shown = false; clearInterval(timer); timer = 0; }
  root.KBFeedback = { show: show, hide: hide, load: load, render: render, check: check };
})(typeof globalThis !== 'undefined' ? globalThis : this);
