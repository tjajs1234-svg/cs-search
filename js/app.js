/* 상담 스크립트 검색기 — 화면
   스크립트 · 문의 검색 · 불량가이드 · 공지. 카드로만 보여 주고, 검색은 분류를 골라 둬도 늘 전체에서.
   작성공간 버튼은 [복사] [비우기] 두 개(비운 뒤 되돌리기). 고객 이름·문의 글은 모두 textContent로만 그림 */
(function () {
  'use strict';
  var S = CSStore, K = S.K, $ = function (id) { return document.getElementById(id); };
  var VERSION = '2026.10.04';

  /* ───── 작은 도우미 ───── */
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  var ICON = {
    plus: '<path d="M12 5v14M5 12h14"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>', all: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    recent: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', mine: '<path d="M5 19.5 6 15 15.5 5.5a2 2 0 0 1 3 3L9 18l-4 1.5Z"/>',
    folder: '<path d="M3.5 7.5a2 2 0 0 1 2-2H10l2 2h6.5a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>', bye: '<path d="M7 11V6.5a1.5 1.5 0 0 1 3 0V11M10 10V5a1.5 1.5 0 0 1 3 0v5M13 10V6a1.5 1.5 0 0 1 3 0v6c0 4-2.5 7-6 7-2.5 0-4-1.5-5.5-4L3 12a1.5 1.5 0 0 1 2.5-1.5L7 13"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5S9.5 6 12 3.5Z"/>',
    warn: '<path d="M12 4 3 19h18L12 4Z"/><path d="M12 10v4M12 17h.01"/>', chat: '<path d="M5 5h14v10H9l-4 4z"/>', pin: '<path d="M9 4h6l-1 5 3 3v2H7v-2l3-3-1-5ZM12 14v6"/>',
    swap: '<path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5"/>', edit: '<path d="M5 19.5 6 15 15.5 5.5a2 2 0 0 1 3 3L9 18l-4 1.5Z"/>', trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', ext: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'
  };
  function ic(name) { var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.9'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.innerHTML = ICON[name] || ''; return s; }
  function btn(label, cls, icon, fn) { var b = el('button', 'btn' + (cls ? ' ' + cls : '')); b.type = 'button'; if (icon) b.append(ic(icon)); b.append(label); if (fn) b.addEventListener('click', fn); return b; }
  var toastT = 0;
  function toast(msg, opt) {
    opt = opt || {}; var t = $('toast'); t.replaceChildren(el('span', null, msg)); t.className = 'toast' + (opt.warn ? ' warn' : '');
    if (opt.action) { var b = el('button', null, opt.action.label); b.type = 'button'; b.addEventListener('click', function () { t.hidden = true; opt.action.fn(); }); t.append(b); }
    t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, opt.action ? 6500 : opt.warn ? 3500 : 2200);
  }
  async function copyText(text, msg) {
    try { await navigator.clipboard.writeText(text); toast(msg || '복사했어요'); return true; }
    catch (e) {
      var ta = el('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.append(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (er) {} ta.remove();
      toast(ok ? (msg || '복사했어요') : '복사하지 못했어요. 글을 고른 뒤 Ctrl+C를 눌러 주세요', { warn: !ok }); return ok;
    }
  }
  function textLimit(v, n) { return String(v == null ? '' : v).replace(/\r\n?/g, '\n').slice(0, n); }
  function rid(p) { return p + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9); }
  function ago(t) { if (!t) return ''; var s = Math.round((Date.now() - t) / 1000); return s < 60 ? '방금' : s < 3600 ? Math.floor(s / 60) + '분 전' : s < 86400 ? Math.floor(s / 3600) + '시간 전' : Math.floor(s / 86400) + '일 전'; }
  var PLACEHOLDER = /\[[^\[\]\n]{1,50}\]/g;
  /* 글 + 강조 구간 → 노드(검색어는 mark, [대괄호] 빈칸은 눈에 띄게) */
  function rich(node, text, terms) {
    text = String(text || ''); var rs = terms && terms.length ? KBSearch.ranges(text, terms) : [], phs = [], m;
    PLACEHOLDER.lastIndex = 0; while ((m = PLACEHOLDER.exec(text))) phs.push([m.index, m.index + m[0].length, 'ph']);
    var marks = rs.map(function (r) { return [r[0], r[1], 'mk']; }).concat(phs).sort(function (a, b) { return a[0] - b[0] || b[1] - a[1]; });
    var i = 0; marks.forEach(function (r) {
      if (r[0] < i) return;
      if (r[0] > i) node.append(text.slice(i, r[0]));
      node.append(r[2] === 'mk' ? el('mark', null, text.slice(r[0], r[1])) : el('span', 'ph-blank', text.slice(r[0], r[1])));
      i = r[1];
    });
    node.append(text.slice(i)); return node;
  }

  /* ───── 개인 설정(이 PC에만, 예전 검색기와 같은 모양) ───── */
  function normCustom(items) {
    if (!Array.isArray(items)) return []; var seen = new Set();
    return items.slice(0, 500).map(function (it) {
      if (!it || typeof it !== 'object') return null;
      var id = /^custom_[a-z0-9_-]+$/i.test(String(it.id || '')) ? String(it.id) : '';
      if (!id || seen.has(id)) id = rid('custom_'); seen.add(id);
      var situation = textLimit(it.situation, 160).trim(), script = textLimit(it.script, 20000).trim();
      if (!situation || !script) return null;
      return { id: id, source: 'custom', category: textLimit(it.category, 80).trim() || '개인 문안', situation: situation, script: script, note: textLimit(it.note, 3000).trim(),
        createdAt: textLimit(it.createdAt, 40) || new Date().toISOString(), updatedAt: textLimit(it.updatedAt, 40) || new Date().toISOString() };
    }).filter(Boolean);
  }
  function normPClosings(items) {
    if (!Array.isArray(items)) return []; var seen = new Set();
    return items.slice(0, 100).map(function (it) {
      if (!it || typeof it !== 'object') return null;
      var id = /^personal_closing_[a-z0-9_-]+$/i.test(String(it.id || '')) ? String(it.id) : '';
      if (!id || seen.has(id)) id = rid('personal_closing_'); seen.add(id);
      var title = textLimit(it.title, 80).trim(), body = textLimit(it.body, 10000).trim();
      if (!title || !body) return null;
      return { id: id, title: title, body: body, source: 'personal', createdAt: textLimit(it.createdAt, 40) || new Date().toISOString(), updatedAt: textLimit(it.updatedAt, 40) || new Date().toISOString() };
    }).filter(Boolean);
  }
  var M = {};
  function loadPersonal() {
    M.favorites = new Set(S.json(K.favorites, []).map(String)); M.favoriteOrder = S.json(K.favoriteOrder, []).map(String);
    M.recent = S.json(K.recent, []).map(String).slice(0, 12); M.usage = S.json(K.usage, {}) || {};
    M.custom = normCustom(S.json(K.customScripts, [])); M.customOrder = S.json(K.customOrder, []).map(String);
    M.pclosings = normPClosings(S.json(K.personalClosings, []));
    var sc = S.json(K.shortcuts, null); M.shortcuts = sc && typeof sc === 'object' ? sc : { 'ㅇㅅ': { kind: 'greeting' } };
    // 첫인사 단축어(ㅇㅅ)는 늘 있게: 예전 백업 등으로 빠져 있으면 되살림(ㅇㅅ를 다른 데 쓰고 있으면 그대로 둠)
    if (!Object.keys(M.shortcuts).some(function (k) { return M.shortcuts[k] && M.shortcuts[k].kind === 'greeting'; }) && !M.shortcuts['ㅇㅅ']) M.shortcuts['ㅇㅅ'] = { kind: 'greeting' };
    M.seen = S.json(K.seen, []); if (!Array.isArray(M.seen)) M.seen = [];
  }
  function saveFav() { S.put(K.favorites, Array.from(M.favorites)); S.put(K.favoriteOrder, M.favoriteOrder); }
  function saveCustom() { S.put(K.customScripts, M.custom); S.put(K.customOrder, M.customOrder); }
  function touch(r) {
    if (!r) return;
    M.recent = [r.id].concat(M.recent.filter(function (x) { return x !== r.id; })).slice(0, 12);
    var p = M.usage[r.id] || { count: 0 }; M.usage[r.id] = { count: (p.count || 0) + 1, lastUsed: new Date().toISOString() };
    S.put(K.recent, M.recent); S.put(K.usage, M.usage);
    if (r.kind === 'official') queueUse(r.id);
  }

  /* ───── 바뀐 멘트: 관리자가 고치거나 새로 넣은 멘트를 7일 동안 표시(이 PC가 지난번에 받은 문안과 비교) ───── */
  var SIG = 'csx:scriptSig', CHG = 'csx:changed', CHG_DAYS = 7, changed = {};
  function sigOf(r) { var t = [r.situation, r.script, r.note].join('\u0001'), h = 2166136261; for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); }
  function trackChanges() {
    if (!P || !C || C.source !== 'github') return;
    var old = S.json(SIG, null), now = Date.now(), sigs = {}, ch = S.json(CHG, {}); if (!ch || typeof ch !== 'object') ch = {};
    P.records.forEach(function (r) { sigs[r.id] = sigOf(r); });
    if (old && old.sigs && typeof old.sigs === 'object') Object.keys(sigs).forEach(function (id) { if (!(id in old.sigs)) ch[id] = { at: now, k: 'new' }; else if (old.sigs[id] !== sigs[id]) ch[id] = { at: now, k: 'edit' }; });
    Object.keys(ch).forEach(function (id) { if (!(id in sigs) || now - (ch[id].at || 0) > CHG_DAYS * 864e5) delete ch[id]; });
    S.put(SIG, { sigs: sigs }); S.put(CHG, ch); changed = ch;
  }
  function changedOf(id) { var x = changed[id]; return x && Date.now() - (x.at || 0) <= CHG_DAYS * 864e5 ? x : null; }

  /* ───── 문안 자료 ───── */
  var C = null, P = null, recs = [], byId = new Map(), idx = KBSearch.createIndex([]), opening = '', lastSearch = null;
  var view = S.get(K.view) || 'all', cat = S.get(K.cat) || '', q = '', openId = '', limit = 60, curView = 'scripts';
  function sharedClosings() { return P ? P.sharedClosings : []; }
  function rebuild() { setTimeout(function () { try { scCount(); } catch (e) {} }, 0);
    recs = []; byId = new Map();
    if (P) P.records.forEach(function (r) { recs.push({ id: r.id, kind: 'official', sheet: r.sheet, sheetLabel: r.sheetLabel, category: r.category, situation: r.situation, script: r.script, note: r.note }); });
    var order = new Map(M.customOrder.map(function (id, i) { return [id, i]; }));
    M.custom.slice().sort(function (a, b) { return (order.has(a.id) ? order.get(a.id) : 1e9) - (order.has(b.id) ? order.get(b.id) : 1e9); })
      .forEach(function (r) { recs.push({ id: r.id, kind: 'mine', sheetLabel: '내 멘트', category: r.category, situation: r.situation, script: r.script, note: r.note }); });
    sharedClosings().forEach(function (c) { recs.push({ id: c.id, kind: 'closing', sheetLabel: '끝인사', category: '공용 끝인사', situation: c.title, script: c.body, note: '' }); });
    M.pclosings.forEach(function (c) { recs.push({ id: c.id, kind: 'pclosing', sheetLabel: '끝인사', category: '내 끝인사', situation: c.title, script: c.body, note: '' }); });
    recs.forEach(function (r) { byId.set(r.id, r); });
    idx = KBSearch.createIndex(recs); lastSearch = null;
    opening = P ? KBSearch.commonOpening(P.records.map(function (r) { return { script: r.script }; })) : '';
  }
  async function loadContent() {
    C = await CSContent.current();
    if (!C) { P = null; rebuild(); showOnboard(true); renderAll(); return; }
    showOnboard(false);
    var before = P && P.revision;
    P = KBData.toPayload(C.scripts, { source: C.source, at: C.at, appVersion: VERSION });
    CSTeam.set(C.sources && C.sources.team && C.sources.team.url); $('boardTab').hidden = !CSTeam.ready(); $('workTab').hidden = !CSTeam.ready(); if (!CSTeam.ready() && (curView === 'board' || curView === 'work')) setView('scripts', false); if (CSTeam.ready() && !board.posts) loadBoard(false); if (CSTeam.ready()) syncReads(); if (CSTeam.ready() && curView === 'work') loadWork();
    trackChanges(); rebuild();
    if (cat && !(P.sheets || []).some(function (s) { return s === cat; })) { cat = ''; if (view === 'cat') view = 'all'; }
    renderAll();
    if (before && before !== P.revision) toast('관리자가 고친 최신 문안으로 바꿨어요');
    pushSources();
  }

  /* ───── 화면 전환 ───── */
  var VIEWS = ['scripts', 'req', 'defect', 'notice', 'board', 'work'];
  function setView(v, focus) {
    if (VIEWS.indexOf(v) < 0) v = 'scripts'; curView = v;
    VIEWS.forEach(function (x) { $('v-' + x).hidden = x !== v; });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) { t.setAttribute('aria-selected', String(t.dataset.v === v)); });
    try { history.replaceState(null, '', '#' + v); } catch (e) {}
    closePops();
    if (v === 'req') { ensureArchive(); renderReq(); }
    if (v === 'defect') { S.put('csx:defOpened', Date.now()); renderDefect(); renderBadges(); }
    if (v === 'notice') renderNotices();
    if (v === 'board') loadBoard(true); else freshNow.clear();
    if (v === 'work') { renderWork(); loadWork(); }
    if (focus !== false) { var input = v === 'scripts' ? $('q') : v === 'req' ? $('rq') : v === 'defect' ? $('dq') : null; if (input) setTimeout(function () { input.focus(); }, 0); }
  }
  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) { t.addEventListener('click', function () { setView(t.dataset.v); }); });

  /* ───── 스크립트: 분류 ───── */
  function catBtn(key, label, icon, count) {
    var b = el('button', 'cat'); b.type = 'button'; b.dataset.key = key;
    b.append(ic(icon), el('span', 'nm', label), el('span', 'c', String(count)));
    b.addEventListener('click', function () {
      if (key.indexOf('cat:') === 0) { view = 'cat'; cat = key.slice(4); } else { view = key; cat = ''; }
      S.set(K.view, view); S.set(K.cat, cat);
      if (q) { $('q').value = ''; q = ''; $('qx').hidden = true; }
      openId = ''; limit = 60; $('results').scrollTop = 0; renderScripts();
    });
    return b;
  }
  function renderCats() {
    var L = $('catList'); L.replaceChildren();
    var off = recs.filter(function (r) { return r.kind === 'official'; }).length;
    var nChg = recs.filter(function (r) { return r.kind === 'official' && changedOf(r.id); }).length;
    if (!nChg && view === 'changed') view = 'all';
    L.append(catBtn('all', '전체', 'all', off));
    if (nChg) { var cb = catBtn('changed', '최근 바뀐 멘트', 'edit', nChg); cb.classList.add('chg'); cb.title = '최근 ' + CHG_DAYS + '일 동안 관리자가 고치거나 새로 넣은 멘트'; L.append(cb); }
    L.append(catBtn('fav', '즐겨찾기', 'star', M.favorites.size), catBtn('recent', '최근 쓴 문안', 'recent', M.recent.length),
      catBtn('mine', '내 멘트', 'mine', M.custom.length), catBtn('bye', '끝인사', 'bye', sharedClosings().length + M.pclosings.length), el('div', 'sep'));
    if (P) {
      var labels = new Map(); P.records.forEach(function (r) { if (!labels.has(r.sheet)) labels.set(r.sheet, { label: r.sheetLabel, n: 0 }); labels.get(r.sheet).n++; });
      labels.forEach(function (v, k) { L.append(catBtn('cat:' + k, v.label, 'folder', v.n)); });
    }
    var searching = !!q.trim();
    Array.prototype.forEach.call(L.querySelectorAll('.cat'), function (b) {
      var k = b.dataset.key, cur = view === 'cat' ? k === 'cat:' + cat : k === view;
      b.setAttribute('aria-current', String(!searching && cur)); b.classList.toggle('was', searching && cur && k !== 'all');
    });
  }
  function viewName() { if (view === 'cat') { var r = recs.find(function (x) { return x.sheet === cat; }); return r ? r.sheetLabel : '분류'; } return { all: '전체', changed: '최근 바뀐 멘트', fav: '즐겨찾기', recent: '최근 쓴 문안', mine: '내 멘트', bye: '끝인사' }[view] || '전체'; }
  function browseList() {
    if (view === 'fav') { var o = new Map(M.favoriteOrder.map(function (id, i) { return [id, i]; })); return recs.filter(function (r) { return M.favorites.has(r.id); }).sort(function (a, b) { return (o.has(a.id) ? o.get(a.id) : 1e9) - (o.has(b.id) ? o.get(b.id) : 1e9); }); }
    if (view === 'recent') return M.recent.map(function (id) { return byId.get(id); }).filter(Boolean);
    if (view === 'changed') return recs.filter(function (r) { return r.kind === 'official' && changedOf(r.id); }).sort(function (a, b) { return changedOf(b.id).at - changedOf(a.id).at; });
    if (view === 'mine') return recs.filter(function (r) { return r.kind === 'mine'; });
    if (view === 'bye') return recs.filter(function (r) { return r.kind === 'closing' || r.kind === 'pclosing'; });
    if (view === 'cat') return recs.filter(function (r) { return r.kind === 'official' && r.sheet === cat; });
    return recs.filter(function (r) { return r.kind === 'official'; });
  }

  /* ───── 스크립트: 카드 ───── */
  function shortcutKeyFor(kind, id) { var ks = Object.keys(M.shortcuts); for (var i = 0; i < ks.length; i++) { var v = M.shortcuts[ks[i]]; if (v && v.kind === kind && (kind === 'greeting' || v.id === id)) return ks[i]; } return ''; }
  function setShortcut(kind, id, key) {
    Object.keys(M.shortcuts).forEach(function (k) { var v = M.shortcuts[k]; if (v && v.kind === kind && (kind === 'greeting' || v.id === id)) delete M.shortcuts[k]; });
    var c = String(key || '').replace(/\s+/g, '').slice(0, 6);
    if (c) { delete M.shortcuts[c]; M.shortcuts[c] = kind === 'greeting' ? { kind: 'greeting' } : { kind: kind, id: id }; }
    S.put(K.shortcuts, M.shortcuts); return c;
  }
  function shortcutField(kind, id) {
    var w = el('label', 'shortcut'); w.append('초성 단축어');
    var i = el('input'); i.type = 'text'; i.maxLength = 6; i.value = shortcutKeyFor(kind, id); i.placeholder = '예: ㄲㅇ'; i.setAttribute('aria-label', '초성 단축어');
    var save = function () { var k = setShortcut(kind, id, i.value); i.value = k; toast(k ? '작성공간에서 ' + k + ' + 스페이스로 넣을 수 있어요' : '단축어를 지웠어요'); };
    i.addEventListener('change', save); i.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); i.blur(); } });
    w.append(i); return w;
  }
  /* 1차·2차 짝: 제목에서 ‘1차’를 ‘2차’로 바꾼 멘트가 있으면 짝(고객이 수긍하지 않을 때 쓰는 2차 안내) */
  var pairCache = null, pairOpen = new Set();
  function secondOf(r) {
    if (!pairCache || pairCache.recs !== recs) {
      var byTitle = new Map(); recs.forEach(function (x) { if (x.kind === 'official') byTitle.set(x.sheet + '|' + x.situation, x); });
      pairCache = { recs: recs, map: new Map() };
      recs.forEach(function (x) { if (x.kind !== 'official' || !/1차/.test(x.situation)) return; var y = byTitle.get(x.sheet + '|' + x.situation.replace(/1차/g, '2차')); if (y && y !== x) pairCache.map.set(x.id, y); });
    }
    return pairCache.map.get(r.id) || null;
  }
  function card(r, terms) {
    var open = openId === r.id, c = el('article', 'card' + (open ? ' open' : '') + (isAdded(r.script) ? ' added' : '')); c.dataset.id = r.id;
    if (!open) peekOn(c, r, terms);
    var m = el('div', 'meta'), src = el('span', 'src', r.sheetLabel + (r.category && r.category !== r.situation && r.category !== r.sheetLabel ? ' · ' + r.category : ''));
    m.append(src);
    var cg = r.kind === 'official' ? changedOf(r.id) : null;
    if (cg) { var cgt = el('span', 'ptag chg', cg.k === 'new' ? '새 멘트' : '바뀜'); cgt.title = ago(cg.at) + ' 관리자가 ' + (cg.k === 'new' ? '새로 넣었어요' : '고쳤어요') + ' · ' + CHG_DAYS + '일 동안 표시'; m.append(cgt); }
    if (r.note && !open) { var n = el('span', 'ptag', '주의사항'); n.style.background = 'var(--warn-soft)'; n.style.color = 'var(--warn)'; m.append(n); }
    m.append(el('span', 'addedTag', '담김'), el('span', 'sp'));
    var fav = M.favorites.has(r.id), st = el('button', 'mini' + (fav ? ' on' : '')); st.type = 'button'; st.title = fav ? '즐겨찾기 빼기' : '즐겨찾기'; st.setAttribute('aria-label', st.title);
    var si = ic('star'); if (fav) si.setAttribute('fill', 'currentColor'); st.append(si);
    st.addEventListener('click', function (e) {
      e.stopPropagation();
      if (M.favorites.has(r.id)) { M.favorites.delete(r.id); M.favoriteOrder = M.favoriteOrder.filter(function (x) { return x !== r.id; }); toast('즐겨찾기에서 뺐어요'); }
      else { M.favorites.add(r.id); M.favoriteOrder.push(r.id); toast('즐겨찾기에 넣었어요'); }
      saveFav(); renderScripts();
    });
    m.append(st); c.append(m);
    c.append(rich(el('h3'), r.situation, terms));
    if (open) {
      if (r.note) { var cu = el('div', 'caution'); cu.append(ic('warn'), el('span', null, r.note)); c.append(cu); }
      var f = el('div', 'full');
      KBSearch.splitParagraphs(r.script).forEach(function (p) { var d = rich(el('p', 'para'), p, terms); d.title = '누르면 이 문단만 담아요'; d.addEventListener('click', function () { if (String(getSelection()).length) return; add(p, r); }); f.append(d); });
      c.append(f);
    } else {
      var pv = rich(el('p', 'pv'), KBSearch.preview(r, terms, opening), terms); pv.title = '눌러서 전체 보기';
      pv.addEventListener('click', function () { openId = r.id; renderScripts(); }); c.append(pv);
    }
    var a = el('div', 'acts');
    var rb = btn('교체', '', 'swap', function () { replaceWith(r.script, r); }); rb.title = '작성공간을 비우고 이 문안만 담아요';
    a.append(btn('담기', 'primary', 'plus', function () { add(r.script, r); }), rb,
      btn(open ? '접기' : '전체 보기', 'ghost', null, function () { openId = open ? '' : r.id; renderScripts(); }));
    var two = secondOf(r);
    if (two) { var po = pairOpen.has(r.id), pb = btn(po ? '2차 접기' : '2차 보기', 'ghost', null, function () { if (pairOpen.has(r.id)) pairOpen.delete(r.id); else pairOpen.add(r.id); renderScripts(); }); pb.title = '고객이 수긍하지 않을 때 쓰는 2차 안내: ' + two.situation; a.append(pb); }
    if (r.kind === 'mine') a.append(btn('고치기', 'ghost', 'edit', function () { editCustom(r.id); }));
    if (r.kind === 'pclosing') a.append(btn('고치기', 'ghost', 'edit', function () { editPClosing(r.id); }));
    if ((r.kind === 'closing' || r.kind === 'pclosing') && view === 'bye' && !q.trim()) { var sp = el('span'); sp.style.flex = '1'; a.append(sp, shortcutField(r.kind === 'closing' ? 'shared' : 'personal', r.id)); }
    c.append(a);
    if (two && pairOpen.has(r.id)) {
      var pz = el('div', 'pair'), ph = el('div', 'pair-h');
      ph.append(el('span', 'ptag', '2차'), el('b', null, two.situation), el('span', 'pair-s', '고객이 수긍하지 않을 때'));
      var pt = el('div', 'pair-t'); KBSearch.splitParagraphs(two.script).forEach(function (p) { pt.append(el('p', null, p)); });
      var pa = el('div', 'acts'); pa.append(btn('담기', 'primary', 'plus', function () { add(two.script, two); }), btn('교체', '', 'swap', function () { replaceWith(two.script, two); }));
      pz.append(ph, pt, pa); c.append(pz);
      c.classList.add('paired');
    }
    return c;
  }
  function renderScripts() {
    peekHide(true); renderCats();
    var R = $('results'), Sc = $('scope'); R.replaceChildren(); Sc.replaceChildren();
    if (!P && !M.custom.length) return;
    var rows, terms = null, searching = !!q.trim();
    if (searching) {
      var res = lastSearch && lastSearch.q === q ? lastSearch.res : idx.search(q, { limit: 200 }); lastSearch = { q: q, res: res };
      rows = res.list;
      var chip = el('span', 'chip'); chip.append(ic('globe'), '전체 문안에서 찾는 중'); Sc.append(chip, el('b', null, rows.length + '개'));
      if (res.loose) Sc.append(el('span', null, '· 꼭 맞는 문안이 없어 낱말이 많이 맞는 순으로 보여 줘요'));
      if (res.loose || !rows.length) noteMiss(q);
      if (view !== 'all') Sc.append(el('span', null, '· 검색을 지우면 보던 ‘' + viewName() + '’로 돌아가요'));
      R._terms = function (id) { return idx.termsFor(id, q, res.meta); };
    } else {
      rows = browseList(); Sc.append(el('b', null, viewName()), el('span', null, rows.length + '개'));
      if (view === 'mine') { var sp = el('span', 'grow'); Sc.append(sp, btn('새 멘트', 'sm', 'plus', function () { editCustom(''); })); }
      if (view === 'bye') { var sp2 = el('span', 'grow'); Sc.append(sp2, btn('내 끝인사 추가', 'sm', 'plus', function () { editPClosing(''); })); }
      R._terms = null;
    }
    if (view === 'bye' && !searching) R.append(greetingCard());
    if (!rows.length) {
      R.append(el('div', 'empty', searching ? '찾는 문안이 없어요.\n다른 말이나 초성(예: ㄱㅎㅈㅅ)으로 찾아보세요.' :
        view === 'fav' ? '자주 쓰는 문안의 ☆를 누르면 여기에 모여요.' : view === 'recent' ? '담거나 복사한 문안이 여기에 쌓여요.' : view === 'mine' ? '나만 쓰는 문안을 만들어 둘 수 있어요.\n위 [새 멘트]를 눌러 보세요.' : '아직 없어요.'));
      return;
    }
    var g = el('div', 'grid');
    rows.slice(0, limit).forEach(function (r) { g.append(card(r, R._terms ? R._terms(r.id) : null)); });
    R.append(g);
    if (rows.length > limit) { var more = btn('더 보기 (' + (rows.length - limit) + '개 남음)', '', null, function () { limit += 60; renderScripts(); }); more.style.margin = '14px auto 0'; more.style.display = 'flex'; R.append(more); }
  }
  function greetingCard() {
    var c = el('article', 'card'); c.style.marginBottom = '12px';
    var m = el('div', 'meta'); m.append(el('span', 'src', '첫인사 · 문안에서 가장 많이 쓰인 인사말')); c.append(m);
    c.append(el('p', 'pv', opening || '공통 인사말을 찾지 못했어요'));
    var a = el('div', 'acts'); a.append(btn('담기', 'primary', 'plus', function () { if (opening) add(opening, null); }));
    var sp = el('span'); sp.style.flex = '1'; a.append(sp, shortcutField('greeting', '')); c.append(a); return c;
  }
  var qT = 0;
  $('q').addEventListener('input', function () {
    var v = $('q').value; $('qx').hidden = !v; clearTimeout(qT);
    qT = setTimeout(function () { q = v; openId = ''; limit = 60; $('results').scrollTop = 0; renderScripts(); }, 60);
  });
  $('qx').addEventListener('click', function () { $('q').value = ''; q = ''; $('qx').hidden = true; openId = ''; renderScripts(); $('q').focus(); });
  $('q').addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('q').value) { e.preventDefault(); $('qx').click(); } });

  /* ───── 작성공간: [복사] [비우기] ───── */
  var note = $('note'), saveT = 0;
  function saveNote() { clearTimeout(saveT); saveT = setTimeout(function () { S.set(K.note, note.value); S.mirrorSoon(); }, 200); }
  function blanks() {
    var b = $('blank'); b.replaceChildren(); PLACEHOLDER.lastIndex = 0;
    var m = note.value.match(PLACEHOLDER);
    if (m) { b.append(ic('warn'), el('span', null, '채울 곳: ' + Array.from(new Set(m)).slice(0, 3).join(' ') + (m.length > 3 ? ' 외' : ''))); var go = el('button', null, '첫 칸으로'); go.type = 'button'; go.addEventListener('click', jumpBlank); b.append(go); }
    $('cc').textContent = note.value.length.toLocaleString() + '자';
    markAdded();
  }
  function jumpBlank() { PLACEHOLDER.lastIndex = 0; var m = PLACEHOLDER.exec(note.value); if (!m) return; note.focus(); note.setSelectionRange(m.index, m.index + m[0].length); }
  function splitP(t) { return KBSearch.splitParagraphs(t); }
  function add(text, r) {
    var addition = String(text || '').trim(); if (!addition) return;
    var cur = note.value.trim(), have = splitP(cur), inc = splitP(addition).filter(function (p) { return have.indexOf(p) < 0; });
    if (!inc.length) { toast('이미 담겨 있어요'); return; }
    note.value = cur ? cur + '\n\n' + inc.join('\n\n') : inc.join('\n\n');
    saveNote(); blanks(); touch(r); note.scrollTop = note.scrollHeight; toast('작성공간에 담았어요');
    if (curView !== 'scripts') setView('scripts', false);
  }
  /* [교체]: 작성공간을 비우고 이 문안만 담기 — 지운 글은 [되돌리기]로 살림 */
  function replaceWith(text, r) {
    var next = String(text || '').trim(); if (!next) return;
    var was = note.value;
    if (was.trim()) archive(was);
    note.value = next; saveNote(); blanks(); touch(r); note.scrollTop = 0;
    toast(was.trim() ? '작성공간을 이 문안으로 바꿨어요' : '작성공간에 담았어요', was.trim() ? { action: { label: '되돌리기', fn: function () { note.value = was; S.set(K.note, was); blanks(); note.focus(); } } } : null);
    if (curView !== 'scripts') setView('scripts', false);
  }
  /* 담김 표시: 문안의 모든 문단이 이미 작성공간에 있으면 카드에 ‘담김’ */
  function isAdded(text) {
    var have = splitP(note.value.trim()); if (!have.length) return false;
    var ps = splitP(String(text || '').trim()); return ps.length > 0 && ps.every(function (p) { return have.indexOf(p) >= 0; });
  }
  var markT = 0;
  function markAdded() {
    clearTimeout(markT);
    markT = setTimeout(function () { Array.prototype.forEach.call(document.querySelectorAll('#results .card[data-id]'), function (c) { var r = byId.get(c.dataset.id); c.classList.toggle('added', !!r && isAdded(r.script)); }); }, 120);
  }
  /* 미리보기: 카드에 마우스를 올리면 누르지 않아도 전체 문안이 옆에 뜸 */
  var peek = null, peekT = 0, peekFor = null, canHover = window.matchMedia ? matchMedia('(hover: hover) and (pointer: fine)').matches : true;
  function peekHide(now) { clearTimeout(peekT); if (now) { if (peek) peek.hidden = true; peekFor = null; return; } peekT = setTimeout(function () { if (peek) peek.hidden = true; peekFor = null; }, 120); }
  function peekShow(c, r, terms) {
    if (!c.isConnected || c.classList.contains('open')) return;
    if (!peek) {
      peek = el('div', 'peek'); peek.setAttribute('role', 'tooltip'); peek.hidden = true; document.body.append(peek);
      peek.addEventListener('mouseenter', function () { clearTimeout(peekT); });
      peek.addEventListener('mouseleave', function () { peekHide(false); });
    }
    peek.replaceChildren(); peekFor = c;
    var hd = el('div', 'pk-h'); hd.append(el('b', null, r.situation || '')); peek.append(hd);
    if (r.note) { var cu = el('div', 'caution'); cu.append(ic('warn'), el('span', null, r.note)); peek.append(cu); }
    var body = el('div', 'pk-b'); KBSearch.splitParagraphs(r.script).forEach(function (p) { body.append(rich(el('p'), p, terms)); }); peek.append(body);
    peek.hidden = false; peek.style.left = '0px'; peek.style.top = '0px';
    var cr = c.getBoundingClientRect(), pw = peek.offsetWidth, ph = peek.offsetHeight, vw = innerWidth, vh = innerHeight, gap = 10, x, y;
    if (vw - cr.right >= pw + gap + 8) x = cr.right + gap;
    else if (cr.left >= pw + gap + 8) x = cr.left - pw - gap;
    else x = Math.min(Math.max(8, cr.left), vw - pw - 8);
    if (x === cr.right + gap || x === cr.left - pw - gap) y = Math.min(Math.max(8, cr.top), vh - ph - 8);
    else { y = cr.bottom + gap; if (y + ph > vh - 8) y = Math.max(8, cr.top - ph - gap); }
    peek.style.left = Math.round(x) + 'px'; peek.style.top = Math.round(y) + 'px';
    if (body.scrollHeight > body.clientHeight + 2) { body.classList.add('more'); peek.append(el('div', 'pk-f', '길어서 앞부분만 보여요 · [전체 보기]로 펼쳐요')); }
  }
  function peekOn(c, r, terms) {
    if (!canHover) return;
    c.addEventListener('mouseenter', function () { clearTimeout(peekT); if (peekFor === c && peek && !peek.hidden) return; peekT = setTimeout(function () { peekShow(c, r, terms); }, 380); });
    c.addEventListener('mouseleave', function () { peekHide(false); });
    c.addEventListener('mousedown', function () { peekHide(true); });
  }
  document.addEventListener('scroll', function () { peekHide(true); }, true);
  window.addEventListener('blur', function () { peekHide(true); });
  function archive(text) { var d = S.json(K.drafts, []); if (!Array.isArray(d)) d = []; d.unshift({ text: text, savedAt: new Date().toISOString() }); S.put(K.drafts, d.slice(0, 5)); }
  // 채울 곳([고객명] 같은 빈칸)이 남아 있으면 바로 복사하지 않고 한 번 알려 줌 — [그래도 복사]로 그대로 복사
  $('copyBtn').addEventListener('click', function () {
    if (!note.value.trim()) { toast('작성공간이 비어 있어요'); return; }
    PLACEHOLDER.lastIndex = 0; var left = note.value.match(PLACEHOLDER);
    if (left && left.length) { jumpBlank(); toast('채울 곳 ' + left.length + '개가 남았어요 · ' + Array.from(new Set(left)).slice(0, 2).join(' '), { warn: true, action: { label: '그래도 복사', fn: function () { copyText(note.value, '복사했어요 · 상담창에 붙여 넣으세요'); } } }); return; }
    copyText(note.value, '복사했어요 · 상담창에 붙여 넣으세요');
  });
  $('clearBtn').addEventListener('click', function () {
    var was = note.value; if (!was.trim()) { toast('이미 비어 있어요'); return; }
    archive(was); note.value = ''; S.set(K.note, ''); blanks();
    toast('비웠어요', { action: { label: '되돌리기', fn: function () { note.value = was; S.set(K.note, was); blanks(); note.focus(); } } });
  });
  /* 초성 단축어: ㅇㅅ + 스페이스(또는 Tab) → 첫인사 */
  function shortcutText(e) { if (!e) return ''; if (e.kind === 'text') return String(e.text || ''); if (e.kind === 'greeting') return opening; var r = byId.get(e.id); return r ? r.script : ''; }
  function shortcutName(e) { if (!e) return ''; if (e.kind === 'text') { var t = String(e.text || '').replace(/\s+/g, ' ').trim(); return t.length > 14 ? t.slice(0, 14) + '…' : t; } if (e.kind === 'greeting') return '첫인사'; var r = byId.get(e.id); return r ? r.situation : ''; }
  function shortcutAtCaret(trailing) {
    var pos = note.selectionStart; if (pos !== note.selectionEnd) return null;
    var m = note.value.slice(0, pos).match(trailing ? /(^|[\s\n])([^\s\n]{1,6})[ ]$/ : /(^|[\s\n])([^\s\n]{1,6})$/);
    if (!m) return null; var e = M.shortcuts[m[2]]; if (!e) return null; var t = shortcutText(e); if (!t) return null;
    return { key: m[2], text: t, name: shortcutName(e), start: pos - m[2].length - (trailing ? 1 : 0), end: pos };
  }
  function expand(hit) {
    note.focus(); note.setSelectionRange(hit.start, hit.end);
    var ok = false; try { ok = document.execCommand('insertText', false, hit.text); } catch (e) {}
    if (!ok) { var v = note.value; note.value = v.slice(0, hit.start) + hit.text + v.slice(hit.end); note.setSelectionRange(hit.start + hit.text.length, hit.start + hit.text.length); }
    saveNote(); blanks(); snip(); toast(hit.key + ' → ' + hit.name);
  }
  function snip() { var h = shortcutAtCaret(false), s = $('snip'); if (!h) { s.hidden = true; return; } s.textContent = h.key + ' → ' + h.name + ' · 스페이스'; s.hidden = false; }
  note.addEventListener('input', function (e) {
    saveNote(); blanks();
    if (e && e.isComposing) return;
    if (note.value.slice(note.selectionStart - 1, note.selectionStart) === ' ') { var h = shortcutAtCaret(true); if (h) { expand(h); return; } }
    snip();
  });
  note.addEventListener('keydown', function (e) { if (e.key !== 'Tab' || e.shiftKey || e.ctrlKey || e.altKey) return; var h = shortcutAtCaret(false); if (!h) return; e.preventDefault(); expand(h); });
  note.addEventListener('blur', function () { $('snip').hidden = true; });
  /* 내 초성 단축어(작성공간 위 [단축어]): 초성 + 바뀔 글을 직접 만들기 · 작성공간에서 글을 골라 두고 누르면 그 글로 */
  var SC_KEY = /^[ㄱ-ㅎ]{1,6}$/;
  function scCount() { var all = M.shortcuts || {}, n = Object.keys(all).filter(function (k) { return shortcutText(all[k]); }).length; $('scN').textContent = n ? String(n) : ''; }
  function openShortcuts(prefill) {
    openDlg(function (d) {
      d.append(el('h2', null, '내 초성 단축어'), el('p', null, '작성공간에 초성을 쓰고 스페이스(또는 Tab)를 누르면 그 글로 바뀌어요. ㅇㅅ(첫인사)는 기본으로 들어 있어요. 이 PC에만 저장되고 백업 파일에도 들어가요.'));
      var k = el('input'); k.type = 'text'; k.id = 'sc-key'; k.maxLength = 6; k.placeholder = '예: ㄱㅅ'; k.autocomplete = 'off'; k.setAttribute('aria-label', '초성');
      var t = el('textarea'); t.id = 'sc-text'; t.maxLength = 4000; t.placeholder = '바뀔 글 · 예: 확인 후 바로 다시 안내드리겠습니다.'; t.value = prefill || ''; t.setAttribute('aria-label', '바뀔 글'); t.style.minHeight = '84px';
      var row = el('div', 'scadd'); row.append(field('초성 (ㄱ~ㅎ)', k), field('바뀔 글', t)); d.append(row);
      var res = el('div', 'res'); d.append(res);
      var list = el('div', 'sclist');
      var draw = function () {
        list.replaceChildren();
        var ks = Object.keys(M.shortcuts).filter(function (x) { return shortcutText(M.shortcuts[x]); }).sort(function (a, b) { var ga = M.shortcuts[a].kind === 'greeting' ? 0 : 1, gb = M.shortcuts[b].kind === 'greeting' ? 0 : 1; return ga - gb || a.localeCompare(b, 'ko'); });
        if (!ks.length) list.append(el('div', 'empty', '아직 단축어가 없어요.'));
        ks.forEach(function (key) {
          var e = M.shortcuts[key], r = el('div', 'scrow'), tx = el('div', 't');
          tx.append(el('small', null, e.kind === 'text' ? '내 글' : e.kind === 'greeting' ? '기본 · 첫인사' : '끝인사'), shortcutText(e).replace(/\s+/g, ' ').slice(0, 80)); tx.title = shortcutText(e);
          var kb = el('kbd', null, key);
          var x = btn('지우기', 'ghost sm', null, function () { var keep = M.shortcuts[key]; delete M.shortcuts[key]; S.put(K.shortcuts, M.shortcuts); draw(); scCount(); toast(key + ' 단축어를 지웠어요', { action: { label: '되돌리기', fn: function () { M.shortcuts[key] = keep; S.put(K.shortcuts, M.shortcuts); scCount(); } } }); });
          if (e.kind === 'text') { r.style.cursor = 'pointer'; r.title = '눌러서 고치기'; r.addEventListener('click', function (ev) { if (ev.target.closest('button')) return; k.value = key; t.value = e.text || ''; t.focus(); }); }
          if (e.kind === 'greeting') { r.classList.add('base'); x = el('span', 'fixed', '기본'); x.title = '첫인사 단축어는 늘 있어요. 초성을 바꾸려면 스크립트의 [첫인사] 카드에서 바꿔요'; }
          r.append(kb, tx, x); list.append(r);
        });
      };
      var add = function () {
        var key = k.value.replace(/\s+/g, ''), body = t.value.replace(/\r\n?/g, '\n').trim();
        if (!SC_KEY.test(key)) { res.className = 'res bad'; res.textContent = '초성은 ㄱ~ㅎ로만 1~6글자 써 주세요 (예: ㄱㅅ)'; k.focus(); return; }
        if (!body) { res.className = 'res bad'; res.textContent = '바뀔 글을 적어 주세요'; t.focus(); return; }
        var old = M.shortcuts[key];
        if (old && old.kind !== 'text' && shortcutText(old)) { res.className = 'res bad'; res.textContent = key + '는 ‘' + shortcutName(old) + '’에 쓰고 있어요. 다른 초성을 써 주세요'; k.focus(); return; }
        delete M.shortcuts[key]; M.shortcuts[key] = { kind: 'text', text: body.slice(0, 4000) }; S.put(K.shortcuts, M.shortcuts);
        res.className = 'res ok'; res.textContent = (old ? '바꿨어요 · ' : '만들었어요 · ') + '작성공간에서 ' + key + ' + 스페이스'; k.value = ''; t.value = ''; k.focus(); draw(); scCount();
      };
      k.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); t.focus(); } });
      t.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); add(); } });
      var a = el('div', 'acts'); var sp = el('span'); sp.style.flex = '1';
      a.append(sp, btn('닫기', 'ghost', null, function () { d.close(); }), btn('추가 (Ctrl+Enter)', 'primary', null, add));
      d.append(a, el('h3', null, '만든 단축어'), list); draw();
      setTimeout(function () { (prefill ? k : k).focus(); }, 0);
    });
  }
  $('scBtn').addEventListener('click', function () { var sel = note.value.slice(note.selectionStart, note.selectionEnd).trim(); openShortcuts(sel); });
  try { scCount(); } catch (e) {}

  /* ───── 내 멘트 · 내 끝인사 고치기 ───── */
  var dlg = $('dlg');
  function openDlg(build) { dlg.replaceChildren(); build(dlg); if (!dlg.open) dlg.showModal(); }
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  function field(label, node) { var w = el('div'); var l = el('label', null, label); if (node.id) l.htmlFor = node.id; w.append(l, node); return w; }
  function editCustom(id) {
    var cur = id ? M.custom.find(function (x) { return x.id === id; }) : null;
    openDlg(function (d) {
      d.append(el('h2', null, cur ? '내 멘트 고치기' : '새 멘트'), el('p', null, '이 PC에만 저장돼요. 다른 상담사에게는 보이지 않아요.'));
      var c = el('input'); c.type = 'text'; c.id = 'f-cat'; c.maxLength = 80; c.value = cur ? cur.category : '개인 문안';
      var t = el('input'); t.type = 'text'; t.id = 'f-title'; t.maxLength = 160; t.value = cur ? cur.situation : ''; t.placeholder = '예: 회수 일정 다시 안내';
      var b = el('textarea'); b.id = 'f-body'; b.maxLength = 20000; b.value = cur ? cur.script : ''; b.placeholder = '빈 줄로 문단을 나눠 주세요';
      var n = el('textarea'); n.id = 'f-note'; n.maxLength = 3000; n.value = cur ? cur.note : ''; n.placeholder = '고객에게 보내지 않는 메모(선택)'; n.style.minHeight = '60px';
      d.append(field('제목 · 필수', t), field('고객에게 보낼 문안 · 필수', b));
      if (!cur && note.value.trim()) { var g = btn('작성공간 글 가져오기', 'sm', null, function () { b.value = note.value.trim(); }); g.style.marginTop = '6px'; d.append(g); }
      d.append(field('분류', c), field('주의사항', n));
      var res = el('div', 'res'); d.append(res);
      var a = el('div', 'acts');
      if (cur) a.append(btn('지우기', 'ghost danger', 'trash', function () {
        var keep = cur; M.custom = M.custom.filter(function (x) { return x.id !== keep.id; }); M.customOrder = M.customOrder.filter(function (x) { return x !== keep.id; }); saveCustom(); d.close(); rebuild(); renderScripts();
        toast('지웠어요', { action: { label: '되돌리기', fn: function () { M.custom.push(keep); M.customOrder.push(keep.id); saveCustom(); rebuild(); renderScripts(); } } });
      }));
      var sp = el('span'); sp.style.flex = '1'; a.append(sp, btn('취소', 'ghost', null, function () { d.close(); }), btn('저장', 'primary', null, function () {
        var title = t.value.trim(), body = b.value.trim();
        if (!title || !body) { res.className = 'res bad'; res.textContent = '제목과 문안을 적어 주세요'; return; }
        var now = new Date().toISOString();
        if (cur) Object.assign(cur, { category: c.value.trim() || '개인 문안', situation: title, script: body, note: n.value.trim(), updatedAt: now });
        else { var nid = rid('custom_'); M.custom.push({ id: nid, source: 'custom', category: c.value.trim() || '개인 문안', situation: title, script: body, note: n.value.trim(), createdAt: now, updatedAt: now }); M.customOrder.push(nid); }
        saveCustom(); d.close(); rebuild(); view = 'mine'; cat = ''; S.set(K.view, view); renderScripts(); toast(cur ? '고쳤어요' : '내 멘트에 저장했어요');
      }));
      d.append(a); setTimeout(function () { (cur ? b : t).focus(); }, 0);
    });
  }
  function editPClosing(id) {
    var cur = id ? M.pclosings.find(function (x) { return x.id === id; }) : null;
    openDlg(function (d) {
      d.append(el('h2', null, cur ? '내 끝인사 고치기' : '내 끝인사 추가'), el('p', null, '이 PC에만 저장돼요. 초성을 적어 두면 작성공간에서 초성 + 스페이스로 바로 넣어요.'));
      var t = el('input'); t.type = 'text'; t.id = 'f-ctitle'; t.maxLength = 80; t.value = cur ? cur.title : ''; t.placeholder = '이름 (예: 주말 끝인사)';
      var b = el('textarea'); b.id = 'f-cbody'; b.maxLength = 10000; b.value = cur ? cur.body : '';
      var k = el('input'); k.type = 'text'; k.id = 'f-ckey'; k.maxLength = 6; k.value = cur ? shortcutKeyFor('personal', cur.id) : ''; k.placeholder = '예: ㅈㅁ';
      d.append(field('이름', t), field('끝인사 문안', b), field('초성 단축어(선택)', k));
      var res = el('div', 'res'); d.append(res);
      var a = el('div', 'acts');
      if (cur) a.append(btn('지우기', 'ghost danger', 'trash', function () { M.pclosings = M.pclosings.filter(function (x) { return x.id !== cur.id; }); setShortcut('personal', cur.id, ''); S.put(K.personalClosings, M.pclosings); d.close(); rebuild(); renderScripts(); toast('지웠어요'); }));
      var sp = el('span'); sp.style.flex = '1'; a.append(sp, btn('취소', 'ghost', null, function () { d.close(); }), btn('저장', 'primary', null, function () {
        var title = t.value.trim(), body = b.value.trim(); if (!title || !body) { res.className = 'res bad'; res.textContent = '이름과 문안을 적어 주세요'; return; }
        var now = new Date().toISOString(), target = cur;
        if (cur) Object.assign(cur, { title: title, body: body, updatedAt: now });
        else { target = { id: rid('personal_closing_'), title: title, body: body, source: 'personal', createdAt: now, updatedAt: now }; M.pclosings.push(target); }
        S.put(K.personalClosings, M.pclosings); setShortcut('personal', target.id, k.value);
        d.close(); rebuild(); view = 'bye'; S.set(K.view, view); renderScripts(); toast('저장했어요');
      }));
      d.append(a); setTimeout(function () { t.focus(); }, 0);
    });
  }

  /* ───── 문의 검색 · 불량가이드 · 공지(확장이 읽어 준 요청시트) ───── */
  var BD = null, ARCH = null, archLoading = null, Rrows = [], Drows = [], rtype = '', dkind = '', rlimit = 40, dlimit = 40, reqOpen = new Set();
  function norm(s) { return String(s || '').toLowerCase(); }
  function dateKey(d) { var m = String(d || '').match(/(20\d\d)\D{0,3}(\d{1,2})\D{0,3}(\d{1,2})/); return m ? Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]) : 0; }
  function yearAgoKey() { var d = new Date(Date.now() + 9 * 3600e3 - 365 * 864e5); return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate(); }
  // 검색어 속 제품코드(영문 2~4자 + 숫자 4자리 이상, 예: ACS12345 · AGL09993)와 같은 코드가 붙은 불량가이드 줄
  function defectsBySku(qq) {
    var skus = (String(qq || '').toUpperCase().match(/\b[A-Z]{2,4}\d{4,}[A-Z0-9-]*\b/g) || []).filter(function (v, i, a) { return a.indexOf(v) === i; });
    if (!skus.length || !Drows.length) return { skus: [], rows: [] };
    var rows = Drows.filter(function (x) { var c = String(x.sku || '').toUpperCase(); return skus.some(function (k) { return c.split(/[^A-Z0-9-]+/).indexOf(k) >= 0; }); });
    var hit = skus.filter(function (k) { return rows.some(function (x) { return String(x.sku || '').toUpperCase().split(/[^A-Z0-9-]+/).indexOf(k) >= 0; }); });
    return { skus: hit, rows: rows.slice().reverse() };
  }
  function isSku(s) { s = String(s || '').trim(); return /^[A-Za-z][A-Za-z0-9-]{4,}$/.test(s) && /\d/.test(s); }
  function rebuildReq() {
    var seen = new Set(), rows = [];
    var addRow = function (r) { var k = [r.d, r.c, String(r.q || '').slice(0, 40)].join('|'); if (seen.has(k)) return; seen.add(k); var hay = norm([r.c, r.n, r.t, r.q, r.sq, r.mf, r.fa, r.ch].join(' ')); rows.push(Object.assign({}, r, { k: dateKey(r.d), hay: hay, hayC: squash(hay), hayCho: KBSearch.cho([r.c, r.n, r.t].join(' ')) })); };
    if (BD && BD.req && Array.isArray(BD.req.rows)) BD.req.rows.forEach(addRow);
    if (ARCH) ARCH.forEach(addRow);
    rows.sort(function (a, b) { return b.k - a.k; }); Rrows = rows;
    Drows = (BD && BD.def && Array.isArray(BD.def.rows) ? BD.def.rows : []).map(function (x) { var hay = norm([x.sku, x.name, x.kind, x.sym, x.found, x.guide, x.note].join(' ')); return Object.assign({}, x, { hay: hay, hayC: squash(hay), hayCho: KBSearch.cho([x.sku, x.name, x.kind, x.sym].join(' ')) }); });
  }
  // 2024·2025 요청시트 사본: 비공개 저장소(cs-content)의 archive-2425.json.gz를 연결 코드로 받음(이 PC에 보관 · 바뀌었을 때만 다시 받음)
  //  예전 ‘검색기 연결’ 1.0.0은 확장 안에 사본이 있어서, 저장소에서 못 받으면 그쪽에서 받음
  var ARCH_FILE = 'archive-2425.json.gz';
  async function archFromRepo() {
    var c = CSContent.connOf(); if (!c) return null;
    var cache = null, key = 'https://cs-archive.invalid/' + encodeURIComponent(c.owner + '/' + c.repo), hit = null;
    try { cache = await caches.open('cs-archive-v1'); hit = await cache.match(key); } catch (e) { cache = null; }
    try {
      var r = await KBGitHub.getRaw(c, ARCH_FILE, hit ? hit.headers.get('x-etag') || '' : '');
      if (r.status === 304 && hit) return await hit.arrayBuffer();
      if (r.status === 200) { if (cache) { try { await cache.put(key, new Response(r.buf.slice(0), { headers: { 'x-etag': r.etag } })); } catch (e) {} } return r.buf; }
    } catch (e) { if (hit) return await hit.arrayBuffer(); }
    return null;
  }
  async function archFromBridge() {
    if (!CSBridge.ready) return null;
    var r = await CSBridge.call('archive', {}, 30000);
    var bin = atob(r.gz), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u.buffer;
  }
  async function ensureArchive() {
    if (ARCH || archLoading) return;
    archLoading = (async function () {
      try {
        var buf = await archFromRepo().catch(function () { return null; });
        if (!buf) buf = await archFromBridge().catch(function () { return null; });
        if (!buf) throw new Error('no archive');
        var text = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
        var d = JSON.parse(text); ARCH = Array.isArray(d.rows) ? d.rows : [];
      } catch (e) { ARCH = null; } // 못 받았으면 다음에 [문의 검색]을 열 때 다시 해 봄
      archLoading = ARCH ? archLoading : null;
      rebuildReq(); if (curView === 'req') renderReq();
    })();
  }
  function bridgeCard(list) {
    var c = el('div', 'setupcard');
    c.append(el('h3', null, '‘검색기 연결’ 확장이 없어요'),
      el('p', null, '문의 검색 · 불량가이드 · 사진은 이 PC 크롬에 깐 작은 확장 ‘슈피겐 CS 검색기 연결’이 회사 구글 계정으로 읽어 와요(상담기록기와는 따로예요). 설치한 뒤 이 화면을 새로고침해 주세요.'),
      el('p', null, '스크립트 · 관리자 공지는 확장 없이도 다 돼요.'));
    var a = el('div', 'acts'); a.append(btn('스토어에서 설치', 'primary', null, function () { window.open('https://chromewebstore.google.com/detail/ohphmjfibdbbepckglcdkgdomaipicno', '_blank', 'noopener'); }), btn('설치했어요 · 다시 확인', '', null, function () { location.reload(); })); c.append(a); list.append(c);
  }
  function problemLine(box) {
    if (!BD) return;
    var p = [];
    (BD.req && BD.req.sources || []).forEach(function (s) { if (s.error) p.push((s.label || '요청시트') + ': ' + s.error); });
    if (BD.def && BD.def.error) p.push('불량 모음: ' + BD.def.error);
    if (p.length) { var w = el('span', 'warn', '⚠ ' + p[0] + (BD.at ? ' · 마지막으로 읽은 사본으로 찾는 중' : '')); w.title = p.join('\n'); box.append(w); }
  }
  function infoLine(box, left, kind) {
    box.replaceChildren(el('b', null, left));
    if (!CSBridge.ready) return;
    var src = C && C.sources || {};
    var any = (src.requests && src.requests.length) || src.defects || src.notice;
    if (!any && kind !== 'notice') { box.append(el('span', null, kind === 'defect' ? '· 관리자가 ‘제품 불량 모음’ 탭을 연결하면 보여요' : '· 2024·2025 요청시트 · 2026년은 관리자가 연결하면 함께 찾아요')); return; }
    problemLine(box);
    var at = BD && BD.at; if (at) box.append(el('span', null, '· ' + ago(at) + ' 읽음 · 5분마다 저절로'));
    var g = el('span', 'grow'); box.append(g);
    var r = el('button', 'lk', BD && BD.busy ? '읽는 중…' : '지금 새로 읽기'); r.type = 'button';
    r.addEventListener('click', function () { r.disabled = true; r.textContent = '읽는 중…'; refreshBridge(true); }); box.append(r);
  }
  function chips(box, values, cur, pick) { box.replaceChildren(); values.forEach(function (v) { var b = el('button', 'fchip', v || '전체'); b.type = 'button'; b.setAttribute('aria-pressed', String(v === cur)); b.addEventListener('click', function () { pick(v); }); box.append(b); }); }
  function reqCard(r, toks) {
    var id = r.id || [r.d, r.c, (r.q || '').slice(0, 30)].join('|'), open = reqOpen.has(id), c = el('article', 'rcard');
    var m = el('div', 'meta'); m.append(el('span', null, r.d || r.yr || ''));
    if (r.c) { var sk = el('span', 'sku'); rich(sk, r.c, toks); m.append(sk); }
    if (r.t) m.append(el('span', 'ptag' + (/불량/.test(r.t) ? ' def' : ''), r.t));
    if (r.ch) m.append(el('span', null, r.ch));
    if (r.k && r.k < yearAgoKey()) { var od = el('span', 'ptag old', '1년 넘은 답변'); od.title = '지금 정책·재고·가격과 다를 수 있어요. 최신 공지·멘트와 맞춰 보고 안내해 주세요'; m.append(od); }
    var items = CSMedia.itemsOf(r), pics = items.filter(function (x) { return !x.link; });
    if (pics.length) m.append(el('span', null, '· 사진·영상 ' + pics.length));
    c.append(m);
    if (r.n) c.append(rich(el('h3'), r.n, toks));
    var dl = el('dl', 'qa'), long = false;
    var line = function (label, text, cls) { if (!text) return; dl.append(el('dt', null, label)); var dd = rich(el('dd', cls || ''), text, toks); if (!open && text.length > 180) { dd.classList.add('clamp'); long = true; } dl.append(dd); };
    line('문의', r.q); if (open && r.sq && r.sq !== r.q) line('상담 질문', r.sq);
    var answer = r.fa || r.mf; line(r.fa ? '최종 답변' : '답변', answer, 'ans');
    if (open && r.fa && r.mf && r.mf !== r.fa) line('피드백', r.mf);
    c.append(dl);
    if (long || (!open && r.sq && r.sq !== r.q)) { var mb = el('button', 'morebtn', '전체 보기 ▾'); mb.type = 'button'; mb.addEventListener('click', function () { reqOpen.add(id); c.replaceWith(reqCard(r, toks)); }); c.append(mb); }
    var st = CSMedia.strip(items, r.n || r.c || '사진', false); if (st) c.append(st);
    var a = el('div', 'acts');
    if (answer) a.append(btn('답변 복사', '', 'copy', function () { copyText(answer, '답변을 복사했어요'); }), btn('작성공간에 담기', '', 'plus', function () { add(answer, null); }));
    if (r.src && r.src.id) { var lk = el('a', 'btn ghost'); lk.href = 'https://docs.google.com/spreadsheets/d/' + r.src.id + '/edit#gid=' + (r.src.gid || 0) + '&range=A' + r.src.row; lk.target = '_blank'; lk.rel = 'noopener noreferrer'; lk.append(ic('ext'), '원본 줄 열기'); a.append(lk); }
    if (a.childNodes.length) c.append(a);
    return c;
  }
  // 띄어쓰기 무시(s26울트라 = S26 울트라) · 초성(ㄱㄹㅅㅇㅌ) — 제품코드·제품명·유형·증상의 첫소리
  function squash(v) { return String(v || '').replace(/[\s·\-_/()[\]{}.,!?~'"“”‘’:;]+/g, ''); }
  function searchRows(rows, qq, hayOf, skuOf) {
    var toks = norm(qq).split(/\s+/).filter(Boolean).slice(0, 8), sku = isSku(qq) ? qq.trim().toUpperCase() : '';
    if (!toks.length) return { rows: rows, toks: [], loose: false };
    var strict = [], loose = [], sq = toks.map(squash);
    rows.forEach(function (r) {
      var hay = hayOf(r), hc = r.hayC != null ? r.hayC : squash(hay), code = skuOf(r) || '', hits = 0, sc = 0;
      toks.forEach(function (t, i) {
        var hit = hay.indexOf(t) >= 0 || (sq[i].length >= 2 && hc.indexOf(sq[i]) >= 0) || (KBSearch.isCho(t) && String(r.hayCho || '').indexOf(t) >= 0);
        if (hit) { hits++; sc += norm(code).indexOf(t) >= 0 ? 8 : 1; }
      });
      if (sku && code === sku) sc += 100; else if (sku && code.indexOf(sku) === 0) sc += 60;
      var all = hits === toks.length || (sku && code.indexOf(sku) === 0);
      if (all) strict.push({ r: r, sc: sc + (r.k || 0) / 1e9 }); else if (hits) loose.push({ r: r, sc: hits * 10 + sc + (r.k || 0) / 1e9 });
    });
    var use = strict.length ? strict : loose; use.sort(function (a, b) { return b.sc - a.sc; });
    return { rows: use.map(function (x) { return x.r; }), toks: toks, loose: !strict.length && loose.length > 0 };
  }
  function renderReq() {
    var list = $('rlist'); list.replaceChildren();
    if (!CSBridge.ready) { infoLine($('rinfo'), '문의 검색', 'req'); bridgeCard(list); return; }
    var years = Array.from(new Set(Rrows.map(function (r) { return r.yr; }).filter(Boolean))).sort().reverse(), ys = $('ry'), keep = ys.value;
    ys.replaceChildren(new Option('전체 연도', '')); years.forEach(function (y) { ys.append(new Option(y + '년', y)); }); ys.value = years.indexOf(keep) >= 0 ? keep : '';
    var tc = new Map(); Rrows.forEach(function (r) { if (r.t) tc.set(r.t, (tc.get(r.t) || 0) + 1); });
    var types = Array.from(tc.entries()).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6).map(function (x) { return x[0]; });
    if (rtype && types.indexOf(rtype) < 0) rtype = '';
    chips($('rt'), [''].concat(types), rtype, function (v) { rtype = v; rlimit = 40; renderReq(); });
    var qq = $('rq').value.trim(), y = ys.value;
    var base = Rrows.filter(function (r) { return (!y || r.yr === y) && (!rtype || r.t === rtype); });
    var s = searchRows(base, qq, function (r) { return r.hay; }, function (r) { return r.c; });
    infoLine($('rinfo'), (qq ? '찾은 문의 ' : '요청시트 ') + s.rows.length.toLocaleString() + '건' + (ARCH ? '' : ' (2024·2025 불러오는 중)'), 'req');
    if (s.loose) $('rinfo').insertBefore(el('span', null, '· 모든 낱말이 맞는 문의가 없어 많이 맞는 순'), $('rinfo').childNodes[1] || null);
    // 10/17 검색어에 든 제품코드(ACS·AMP·AGL…)가 불량가이드에 있으면 맨 위에 크게(경각심) — 낱말 검색은 불량가이드를 섞지 않음
    var defHit = defectsBySku(qq);
    if (defHit.rows.length) {
      var al = el('div', 'defalert'); al.setAttribute('role', 'alert');
      al.append(el('b', null, '⚠ 불량가이드에 있는 제품이에요 · ' + defHit.skus.join(', ')), el('span', null, '안내하기 전에 아래 불량 내용을 꼭 확인해 주세요.'));
      list.append(al); defHit.rows.slice(0, 5).forEach(function (x) { list.append(defCard(x, s.toks)); });
      if (defHit.rows.length > 5) list.append(btn('불량가이드에서 ' + defHit.rows.length + '건 모두 보기', '', null, function () { $('dq').value = defHit.skus[0]; $('dq').dispatchEvent(new Event('input')); setView('defect'); }));
      list.append(el('div', 'sec', '비슷한 문의'));
    }
    if (!s.rows.length) { list.append(el('div', 'empty', Rrows.length ? '비슷한 문의가 없어요. 제품코드나 다른 말로 찾아보세요.' : '아직 읽은 요청시트가 없어요.')); return; }
    s.rows.slice(0, rlimit).forEach(function (r) { list.append(reqCard(r, s.toks)); });
    if (s.rows.length > rlimit) { var mb = btn('더 보기 (' + (s.rows.length - rlimit).toLocaleString() + '건 남음)', '', null, function () { rlimit += 40; renderReq(); }); mb.style.alignSelf = 'center'; list.append(mb); }
  }
  function isNewDef(x) { var f = BD && BD.seenDef && x.key ? BD.seenDef[x.key] : 0; return f > 1 && Date.now() - f < 7 * 864e5; }
  function defCard(x, toks) {
    var c = el('article', 'rcard'), m = el('div', 'meta');
    var sk = el('button', 'sku'); sk.type = 'button'; sk.title = '이 제품코드로 문의 찾기'; rich(sk, x.sku, toks);
    sk.addEventListener('click', function () { $('rq').value = x.sku; $('rq').dispatchEvent(new Event('input')); setView('req'); });
    m.append(el('span', 'ptag def', '불량'), sk);
    if (x.kind) m.append(el('span', null, x.kind));
    if (x.fixed) m.append(el('span', 'ptag ok', '가이드 확정'));
    else { var nf = el('span', 'ptag old', '확정 전 · 안내 전 확인'); nf.title = '아직 확정되지 않은 가이드예요. 고객에게 안내하기 전에 팀장에게 확인해 주세요'; m.append(nf); }
    if (isNewDef(x)) m.append(el('span', 'ptag new', '새로 올라옴'));
    c.append(m);
    if (x.name) c.append(rich(el('h3'), x.name, toks));
    var dl = el('dl', 'qa');
    [['증상', x.sym, ''], ['내부 확인', x.found, ''], ['고객 안내', x.guide, 'ans'], ['조치 기간', x.term, ''], ['비고', x.note, '']].forEach(function (f) { if (!f[1]) return; dl.append(el('dt', null, f[0])); dl.append(rich(el('dd', f[2]), f[1], toks)); });
    c.append(dl);
    var st = CSMedia.strip(CSMedia.itemsOf(x), x.name || x.sku, true); if (st) c.append(st);
    var a = el('div', 'acts');
    if (x.guide) a.append(btn('안내 복사', '', 'copy', function () { copyText(x.guide, '안내를 복사했어요'); }), btn('작성공간에 담기', '', 'plus', function () { add(x.guide, null); }));
    if (x.src && x.src.id) { var lk = el('a', 'btn ghost'); lk.href = 'https://docs.google.com/spreadsheets/d/' + x.src.id + '/edit#gid=' + (x.src.gid || 0) + '&range=A' + x.src.row; lk.target = '_blank'; lk.rel = 'noopener noreferrer'; lk.append(ic('ext'), '원본 줄 열기'); a.append(lk); }
    if (a.childNodes.length) c.append(a);
    return c;
  }
  function renderDefect() {
    var list = $('dlist'); list.replaceChildren();
    if (!CSBridge.ready) { infoLine($('dinfo'), '불량가이드', 'defect'); bridgeCard(list); return; }
    var kc = new Map(); Drows.forEach(function (x) { if (x.kind) kc.set(x.kind, (kc.get(x.kind) || 0) + 1); });
    var kinds = Array.from(kc.entries()).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 8).map(function (x) { return x[0]; });
    if (dkind && kinds.indexOf(dkind) < 0) dkind = '';
    chips($('dt'), [''].concat(kinds), dkind, function (v) { dkind = v; dlimit = 40; renderDefect(); });
    var qq = $('dq').value.trim(), base = Drows.filter(function (x) { return !dkind || x.kind === dkind; }).slice().reverse();
    var s = searchRows(base, qq, function (x) { return x.hay; }, function (x) { return x.sku; });
    var fresh = Drows.filter(isNewDef);
    infoLine($('dinfo'), (qq ? '찾은 불량 ' : '제품 불량 모음 ') + s.rows.length + '건' + (fresh.length && !qq ? ' · 최근 7일 새로 올라온 것 ' + fresh.length + '건' : ''), 'defect');
    var src = C && C.sources || {};
    if (!src.defects) { list.append(el('div', 'empty', '관리자가 ‘제품 불량 모음’ 탭 주소를 넣으면 여기에 보여요.\n(멘트 관리 → 연결 설정 → 요청시트)')); return; }
    if (!s.rows.length) { list.append(el('div', 'empty', Drows.length ? '찾는 불량이 없어요. 제품코드나 다른 말로 찾아보세요.' : '아직 읽은 불량 모음이 없어요.')); return; }
    if (!qq && !dkind && fresh.length) { s.rows = fresh.slice().reverse().concat(s.rows.filter(function (x) { return !isNewDef(x); })); }
    s.rows.slice(0, dlimit).forEach(function (x) { list.append(defCard(x, s.toks)); });
    if (s.rows.length > dlimit) { var mb = btn('더 보기 (' + (s.rows.length - dlimit) + '건 남음)', '', null, function () { dlimit += 40; renderDefect(); }); mb.style.alignSelf = 'center'; list.append(mb); }
  }
  /* 공지: 관리자 공지(멘트 관리) + 족보 ‘Daily 공지’ 탭 */
  function allNotices() {
    var out = [];
    var since = firstUse() - 14 * 864e5;
    (C && C.notices || []).forEach(function (n) { out.push({ id: 'a:' + n.id, title: n.title, body: n.body, by: n.by, at: n.at, pin: n.pin, important: n.important, media: [], links: [], from: '관리자', fresh: (n.at || 0) >= since }); });
    (BD && BD.notice && BD.notice.items || []).forEach(function (n) { out.push({ id: 's:' + n.id + ':' + (n.rev || 0), title: n.title, body: n.body, by: n.by, date: n.date, at: n.dk || 0, pin: false, important: n.important, media: n.media || [], links: n.links || [], from: '족보', fresh: !!n.needAck }); });
    out.sort(function (a, b) { return (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || (b.at || 0) - (a.at || 0); });
    return out;
  }
  // 이 PC에서 검색기를 처음 쓴 때(휴가 뒤에도 그동안 올라온 공지는 '새 공지'로 남게)
  function firstUse() { var v = Number(S.get('csx:firstUse') || 0); if (!v) { v = Date.now(); S.set('csx:firstUse', String(v)); S.mirrorSoon(); } return v; }
  function unreadNotices() { return allNotices().filter(function (n) { return n.fresh && M.seen.indexOf(n.id) < 0; }); }
  function markSeen(ids) { ids.forEach(function (id) { if (M.seen.indexOf(id) < 0) M.seen.push(id); }); M.seen = M.seen.slice(-500); S.put(K.seen, M.seen); renderBadges(); if (curView === 'notice') renderNotices();  syncReads(); }
  function linkify(node, text, terms) {
    var re = /https?:\/\/[^\s<>"']+/g, s = String(text || ''), i = 0, m;
    var put = function (t) { if (terms && terms.length) markText(node, t, terms); else node.append(t); };
    while ((m = re.exec(s))) { var url = m[0].replace(/[),.;]+$/, ''); put(s.slice(i, m.index)); var a = el('a', null, url); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; node.append(a); i = m.index + url.length; re.lastIndex = i; }
    put(s.slice(i)); return node;
  }
  /* 공지 검색: 낱말·제품코드는 그대로, 초성(ㄱㅎ)은 초성끼리 — 모든 낱말이 들어 있는 공지만 */
  function noticeHay(n) { var t = [n.title, n.body, n.by, n.from, (n.links || []).join(' '), (n.media || []).map(function (x) { return x && (x.name || x.title || '') || ''; }).join(' ')].join(' '); return { t: norm(t), c: KBSearch.cho(t) }; }
  function markText(node, text, toks) {
    var low = text.toLowerCase(), rs = [];
    toks.forEach(function (t) { if (KBSearch.isCho(t)) return; var i = 0, k; while ((k = low.indexOf(t, i)) >= 0) { rs.push([k, k + t.length]); i = k + t.length; } });
    rs.sort(function (a, b) { return a[0] - b[0] || b[1] - a[1]; });
    var i = 0; rs.forEach(function (r) { if (r[0] < i) return; if (r[0] > i) node.append(text.slice(i, r[0])); node.append(el('mark', null, text.slice(r[0], r[1]))); i = r[1]; });
    node.append(text.slice(i)); return node;
  }
  function filterNotices(all, qq) {
    var toks = norm(qq).split(/\s+/).filter(Boolean).slice(0, 8);
    if (!toks.length) return { rows: all, toks: [] };
    return { toks: toks, rows: all.filter(function (n) { var h = noticeHay(n); return toks.every(function (t) { return KBSearch.isCho(t) ? h.c.indexOf(t) >= 0 : h.t.indexOf(t) >= 0; }); }) };
  }
  function renderNotices() {
    var list = $('nlist'), all = allNotices(), un = all.filter(function (n) { return n.fresh && M.seen.indexOf(n.id) < 0; }); list.replaceChildren();
    var qq = $('nq').value.trim(), f = filterNotices(all, qq);
    var info = $('ninfo'); info.replaceChildren(el('b', null, qq ? '찾은 공지 ' + f.rows.length + '개' : '공지 ' + all.length + '개'));
    if (qq) info.append(el('span', null, '· 전체 ' + all.length + '개 중'));
    // 공지마다 읽고 [확인했어요] — 한꺼번에 확인 처리는 없음(팀장 화면의 '누가 읽었나'가 정확하게)
    if (un.length) info.append(el('span', null, '· 새 공지 ' + un.length + '개 · 읽고 공지마다 [확인했어요]'));
    if (BD && BD.notice && BD.notice.error) info.append(el('span', 'warn', '⚠ 족보 공지: ' + BD.notice.error));
    if (!all.length) { list.append(el('div', 'empty', C ? '아직 공지가 없어요.' : '연결 코드를 넣으면 공지가 여기에 보여요.')); return; }
    if (!f.rows.length) { list.append(el('div', 'empty', '‘' + qq + '’이(가) 들어 있는 공지가 없어요.\n다른 낱말이나 제품코드로 찾아보세요.')); return; }
    f.rows.forEach(function (n) {
      var isNew = un.indexOf(n) >= 0, c = el('article', 'ncard' + (isNew ? ' unread' : '')), h = el('div', 'nh');
      if (isNew) h.append(el('span', 'ptag new', '새 공지'));
      if (n.important) h.append(el('span', 'ptag def', '중요'));
      if (n.pin) h.append(el('span', 'ptag', '맨 위 고정'));
      h.append(f.toks.length ? markText(el('h3'), n.title || '(제목 없음)', f.toks) : el('h3', null, n.title || '(제목 없음)'));
      var when = n.date || (n.at ? new Date(n.at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }) : '');
      h.append(el('span', 'at', [when, n.by, n.from].filter(Boolean).join(' · ')));
      c.append(h);
      if (n.body) c.append(linkify(el('p', 'nb'), n.body, f.toks));
      var items = CSMedia.itemsOf({ media: n.media, at: (n.links || []).join(' ') }), st = CSMedia.strip(items, n.title, true); if (st) c.append(st);
      if (isNew) { var a = el('div', 'acts'); a.append(btn('확인했어요', 'primary', null, function () { markSeen([n.id]); })); c.append(a); }
      list.append(c);
    });
  }
  function renderBadges() {
    var n = unreadNotices().length, b = $('noticeBadge'); b.hidden = !n; b.textContent = n > 9 ? '9+' : String(n);
    var opened = Number(S.get('csx:defOpened') || 0), d = Drows.filter(function (x) { return isNewDef(x) && BD.seenDef[x.key] > opened; }).length, db = $('defBadge');
    db.hidden = !d; db.textContent = d > 9 ? '9+' : String(d);
    renderBanner();
  }
  /* 확장에서 받기 */
  var bdVersion = '';
  function pushSources() { if (CSBridge.ready) refreshBridge(false); }
  async function refreshBridge(force) {
    if (!CSBridge.ready) return;
    try {
      var r = await CSBridge.call('data', { sources: C && C.sources || {}, since: force ? '' : bdVersion, force: !!force }, 60000);
      if (r && !r.unchanged) { BD = r; bdVersion = r.version || ''; rebuildReq(); }
      else if (r && BD) { BD.at = r.at || BD.at; BD.busy = r.busy; }
    } catch (e) { /* 다음 차례에 */ }
    if (curView === 'req') renderReq(); else if (curView === 'defect') renderDefect(); else if (curView === 'notice') renderNotices();
    renderBadges();
  }
  setInterval(function () { if (!document.hidden) refreshBridge(false); }, 60000);
  ['rq', 'dq', 'nq'].forEach(function (id) {
    var i = $(id), x = i.parentNode.querySelector('.x'), t = 0;
    var go = function () { clearTimeout(t); t = setTimeout(function () { if (id === 'rq') { rlimit = 40; renderReq(); } else if (id === 'dq') { dlimit = 40; renderDefect(); } else renderNotices(); }, 90); };
    i.addEventListener('input', function () { x.hidden = !i.value; go(); });
    x.addEventListener('click', function () { i.value = ''; x.hidden = true; go(); i.focus(); });
    i.addEventListener('keydown', function (e) { if (e.key === 'Escape' && i.value) { e.preventDefault(); x.click(); } });
  });
  $('ry').addEventListener('change', function () { rlimit = 40; renderReq(); });

  /* ───── 요청·건의: 커뮤니티처럼 — 누구나 글 · 누구나 댓글. 쓴 사람은 기록기가 알려 준 이름(이름 칸 없음) ───── */
  var board = { posts: null, filter: 'all', at: 0, err: '' }, BSEEN = 'csx:boardSeen', BVISIT = 'csx:boardVisit', freshNow = new Set(); // freshNow: 이번에 보는 동안은 ‘새 글·새 댓글’ 표시를 남겨 둠
  function myName() { return CSWho.name(); }
  function seenMap() { var m = S.json(BSEEN, {}); return m && typeof m === 'object' ? m : {}; }
  function lastOther(p, me) { return (p.comments || []).reduce(function (t, c) { return c.author !== me ? Math.max(t, c.at || 0) : t; }, 0); }
  // 새것: 내 글에 다른 사람이 단 새 댓글 · 지난번에 본 뒤 다른 사람이 올린 글
  function boardNew(p) {
    var me = myName(), visit = Number(S.get(BVISIT) || 0);
    if (me && p.author === me) return lastOther(p, me) > (seenMap()[p.id] || p.at || 0);
    return !!visit && (p.at || 0) > visit;
  }
  function boardBadge() { var b = $('boardBadge'); if (!b) return; if (!S.get(BVISIT)) S.set(BVISIT, String(Date.now())); var n = (board.posts || []).filter(boardNew).length; b.hidden = !n; b.textContent = n > 9 ? '9+' : String(n); }
  async function loadBoard(show) {
    if (!CSTeam.ready()) return;
    if (show) renderBoard();
    try { var r = await CSTeam.call('board.list', {}, 20000); board.posts = r.posts || []; board.err = ''; board.at = Date.now(); }
    catch (e) { board.err = e.message || '불러오지 못했어요'; }
    boardBadge(); if (curView === 'board') renderBoard();
  }
  setInterval(function () { if (!document.hidden && CSTeam.ready() && (curView === 'board' || Date.now() - board.at > 5 * 60000)) loadBoard(false); }, 60000);
  CSWho.on(function () { if (curView === 'board') renderBoard(); if (curView === 'work') renderWork(); boardBadge(); syncReads(); });
  // 이름: 기록기가 알려 주면 그 이름. 없으면(기록기 없는 PC) 한 번만 적게 함
  function nameBox(onSet) {
    var me = myName(), w = el('span', 'who');
    if (CSWho.auto()) { w.append(el('span', 'muted', '쓴 사람'), el('b', null, me)); w.title = '기록기에 넣은 태그로 정해져요'; return w; }
    var nm = el('input', 'bname'); nm.type = 'text'; nm.maxLength = 20; nm.placeholder = '이름(성까지 · 김수빈)'; nm.value = me; nm.setAttribute('aria-label', '내 이름');
    nm.addEventListener('change', function () { CSWho.setManual(nm.value); if (onSet) onSet(); });
    w.append(nm); w._input = nm; return w;
  }
  function needName(box) { var n = myName(); if (n) return n; toast('이름을 적어 주세요', { warn: true }); if (box && box._input) box._input.focus(); return ''; }
  function renderBoard() {
    var L = $('blist'); if (!L) return; L.replaceChildren();
    var head = el('div', 'bhead'); head.append(el('h2', null, '요청·건의'), el('p', null, '필요한 멘트, 불편한 점, 바라는 기능… 무엇이든 적어 주세요.'));
    L.append(head);
    // 쓰기
    var w = el('div', 'bwrite'), who = nameBox(function () { renderBoard(); });
    var ta = el('textarea', 'bbody'); ta.placeholder = '예) 폴드8 힌지 소리 문의가 많은데 2차 안내 멘트가 있으면 좋겠어요'; ta.setAttribute('aria-label', '요청·건의 내용'); ta.maxLength = 4000;
    var go = btn('올리기', 'primary', 'plus', async function () {
      if (who._input) CSWho.setManual(who._input.value);
      var name = needName(who), body = ta.value.trim(); if (!name) return;
      if (!body) { toast('내용을 적어 주세요', { warn: true }); ta.focus(); return; }
      go.disabled = true;
      try { await CSTeam.call('board.post', { author: name, body: body }); ta.value = ''; toast('올렸어요'); board.filter = 'all'; await loadBoard(false); }
      catch (e) { toast(e.message, { warn: true }); } finally { go.disabled = false; }
    });
    var wr = el('div', 'brow'); wr.append(who, el('span', 'grow'), go); w.append(ta, wr); L.append(w);
    // 거르기: 전체 · 내 글
    var posts = board.posts || [], me = myName();
    var fs = el('div', 'filters'), F = [['all', '전체'], ['mine', '내 글']];
    var cnt = { all: posts.length, mine: posts.filter(function (p) { return me && p.author === me; }).length };
    F.forEach(function (f) { var b = el('button', 'fchip', f[1] + ' ' + cnt[f[0]]); b.type = 'button'; b.setAttribute('aria-pressed', String(board.filter === f[0])); b.addEventListener('click', function () { board.filter = f[0]; renderBoard(); }); fs.append(b); });
    L.append(fs);
    if (board.err && !board.posts) { L.append(el('div', 'empty', '요청·건의를 불러오지 못했어요.\n' + board.err)); return; }
    if (!board.posts) { L.append(el('div', 'empty', '불러오는 중…')); return; }
    var list = posts.filter(function (p) { return board.filter === 'mine' ? (me && p.author === me) : true; });
    if (!list.length) L.append(el('div', 'empty', board.filter === 'mine' ? '내가 쓴 글이 없어요.' : '아직 글이 없어요. 첫 글을 남겨 보세요.'));
    var seen = seenMap(), touched = false;
    list.forEach(function (p) {
      if (boardNew(p)) freshNow.add(p.id);
      var isFresh = freshNow.has(p.id), c = el('article', 'bpost' + (isFresh ? ' fresh' : '')), h = el('div', 'bph');
      h.append(el('span', 'av', String(p.author || '?').slice(0, 1)), el('b', null, p.author), el('span', 'muted', when(p.at)));
      if (isFresh) h.append(el('span', 'ptag new', me && p.author === me ? '새 댓글' : '새 글'));
      if ((p.comments || []).length) h.append(el('span', 'muted ccount', '댓글 ' + p.comments.length));
      c.append(h, el('p', 'bbody-t', p.body));
      (p.comments || []).forEach(function (m) {
        var r = el('div', 'bcm'); // 모두 이름만(직함 표시 없음)
        r.append(el('b', null, m.author), el('span', 'muted', when(m.at)));
        if (me && m.author === me) { var x = el('button', 'lk', '지우기'); x.type = 'button'; x.addEventListener('click', async function () { if (!confirm('이 댓글을 지울까요?')) return; try { await CSTeam.call('board.uncomment', { id: p.id, cid: m.id, author: me }); loadBoard(false); } catch (e) { toast(e.message, { warn: true }); } }); r.append(x); }
        r.append(el('p', null, m.body)); c.append(r);
      });
      var a = el('div', 'acts');
      var ci = el('input', 'bci'); ci.type = 'text'; ci.placeholder = '댓글 달기'; ci.maxLength = 2000; ci.setAttribute('aria-label', '댓글');
      var send = async function () { var body = ci.value.trim(); if (!body) return; var name = needName(who); if (!name) return; try { await CSTeam.call('board.comment', { id: p.id, author: name, body: body }); ci.value = ''; loadBoard(false); } catch (e) { toast(e.message, { warn: true }); } };
      ci.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); send(); } });
      a.append(ci, btn('달기', 'sm', null, send));
      if (me && p.author === me) a.append(btn('지우기', 'ghost sm', null, async function () { if (!confirm('이 글을 지울까요? 댓글도 함께 사라져요.')) return; try { await CSTeam.call('board.delete', { id: p.id, author: me }); loadBoard(false); } catch (e) { toast(e.message, { warn: true }); } }));
      c.append(a); L.append(c);
      if (me && p.author === me) { var lo = lastOther(p, me); if (lo > (seen[p.id] || 0)) { seen[p.id] = lo; touched = true; } }
    });
    if (curView === 'board') { if (touched) S.put(BSEEN, seen); S.set(BVISIT, String(Date.now())); setTimeout(boardBadge, 0); }
  }

  /* ───── 공지 확인: [확인했어요]를 누른 공지 번호·제목을 팀 서버에(관리 화면에서 누가 읽었는지 봄) ───── */
  var RSENT = 'csx:readSent', readT = 0;
  function syncReads() {
    clearTimeout(readT);
    readT = setTimeout(async function () {
      if (!CSTeam.ready()) return; var me = myName(); if (!me) return;
      var sent = S.json(RSENT, []); if (!Array.isArray(sent)) sent = [];
      var items = allNotices().filter(function (n) { return M.seen.indexOf(n.id) >= 0 && sent.indexOf(me + '|' + n.id) < 0; }).slice(0, 50).map(function (n) { return { id: n.id, title: String(n.title || '').slice(0, 80) }; });
      if (!items.length) return;
      try { await CSTeam.call('notice.read', { name: me, items: items }, 20000); S.put(RSENT, sent.concat(items.map(function (x) { return me + '|' + x.id; })).slice(-600)); } catch (e) { /* 다음에 */ }
    }, 1500);
  }

  /* ───── 근무: 그날 퇴근 시각만 적음(정시 19:00 뒤 넘은 시간이 야근) · 달력에 모두의 퇴근 시각 · 이달 야근 합계 ───── */
  var work = { month: '', items: null, cfg: null, err: '' }, OT_FROM = '19:00';
  function kstToday() { return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); }
  function monthOf(k) { return k.slice(0, 7); }
  function addMonth(m, n) { var y = Number(m.slice(0, 4)), mo = Number(m.slice(5, 7)) - 1 + n; y += Math.floor(mo / 12); mo = ((mo % 12) + 12) % 12; return y + '-' + String(mo + 1).padStart(2, '0'); }
  function hm(mins) { var h = Math.floor(mins / 60), m = mins % 60; return (h ? h + '시간' : '') + (m ? (h ? ' ' : '') + m + '분' : h ? '' : '0분'); }
  // 1.3.3: 한 번에 받기(work.get) · 지난번 받은 것을 먼저 바로 보여 주고 뒤에서 새로 받음
  var WK = 'csx:work:';
  function workCache(m) { var c = S.json(WK + m, null); return c && Array.isArray(c.items) ? c : null; }
  async function loadWork() {
    if (!work.month) work.month = monthOf(kstToday());
    var m = work.month, last = WorkClock.addDays(addMonth(m, 1) + '-01', -1);
    if (!work.items) { var c = workCache(m); if (c) { work.items = c.items; work.cfg = work.cfg || c.cfg; work.roster = work.roster || c.roster; if (curView === 'work') renderWork(); } }
    if (!CSTeam.ready()) return; // 연결 코드를 읽은 뒤 다시 부름(loadContent)
    var asked = m;
    try {
      var r;
      try { r = await CSTeam.call('work.get', { from: m + '-01', to: last }, 25000); }
      catch (e) { if (!/모르는 요청/.test(e.message || '')) throw e; var two = await Promise.all([CSTeam.call('ot.list', { from: m + '-01', to: last }, 25000), CSTeam.call('cfg.get', {}, 25000)]); r = { items: two[0].items, cfg: two[1].cfg, roster: two[1].roster }; }
      if (work.month !== asked) return;
      work.items = (r.items || []).filter(function (x) { return x.status !== '반려'; }); work.cfg = r.cfg || work.cfg || {}; work.roster = r.roster || work.roster || []; work.err = '';
      S.put(WK + m, { items: work.items, cfg: work.cfg, roster: work.roster, at: Date.now() });
    } catch (e) { if (work.month === asked) work.err = e.message || '불러오지 못했어요'; }
    if (curView === 'work') renderWork();
  }
  function renderWork() {
    var L = $('wlist'); if (!L) return; L.replaceChildren();
    var head = el('div', 'bhead'); head.append(el('h2', null, 'OT'), el('p', null, '야근한 날 퇴근 시각만 적어 주세요. 정시(19:00) 뒤로 넘은 시간이 야근으로 쌓여요.')); L.append(head);
    // 퇴근 시각 적기: 숫자 4자리(1940 → 19:40) · 10분 단위 · 17:00부터
    var w = el('div', 'bwrite wform'), who = nameBox(function () { renderWork(); });
    // 주말·공휴일은 출근하지 않음(근무 달력의 공휴일 포함) → 그런 날은 고를 수 없음 · [어제]는 직전 근무일
    var dk = kstToday(), yk = prevWorkday(dk), pick = work.pick || (isWorkday(dk) ? dk : yk);
    var days2 = el('div', 'wdays'), d = el('input', 'win wdate'); d.type = 'date'; d.value = pick; d.max = dk; d.setAttribute('aria-label', '날짜');
    var dayBtn = function (k, label, off) { var b = el('button', 'fchip', label); b.type = 'button'; b.setAttribute('aria-pressed', String(pick === k)); if (off) { b.disabled = true; b.title = '오늘은 근무일이 아니에요(주말·공휴일)'; } b.addEventListener('click', function () { work.pick = k; renderWork(); setTimeout(function () { var i = $('wtime'); if (i) i.focus(); }, 0); }); return b; };
    d.addEventListener('change', function () { if (!d.value) return; if (!isWorkday(d.value)) { toast(offName(d.value) + '은(는) 근무일이 아니라 OT를 적을 수 없어요', { warn: true }); d.value = pick; return; } work.pick = d.value; renderWork(); });
    days2.append(dayBtn(dk, '오늘', !isWorkday(dk)), dayBtn(yk, yk === WorkClock.addDays(dk, -1) ? '어제' : Number(yk.slice(5, 7)) + '/' + Number(yk.slice(8, 10)) + '(' + '일월화수목금토'[WorkClock.weekday(yk)] + ')'), d);
    var t = el('input', 'win wtime'); t.id = 'wtime'; t.type = 'text'; t.inputMode = 'numeric'; t.maxLength = 5; t.placeholder = '예: 1940'; t.autocomplete = 'off'; t.setAttribute('aria-label', '퇴근 시각(숫자 4자리)');
    var pv = el('span', 'wprev');
    var parse = function () { var v = parseClock(t.value); pv.className = 'wprev' + (v.err ? ' bad' : v.hm ? ' ok' : ''); pv.textContent = v.err || (v.hm ? v.hm + ' 퇴근 · 야근 ' + hm(Math.max(0, v.min - 19 * 60)) : ''); return v; };
    t.addEventListener('input', parse);
    var go = btn('적기', 'primary', 'plus', async function () {
      if (who._input) CSWho.setManual(who._input.value);
      var name = needName(who); if (!name) return;
      var v = parse(); if (!v.hm) { toast(v.err || '퇴근 시각을 숫자 4자리로 적어 주세요(예: 1940)', { warn: true }); t.focus(); return; }
      if (!isWorkday(d.value || pick)) { toast(offName(d.value || pick) + '은(는) 근무일이 아니라 OT를 적을 수 없어요', { warn: true }); return; }
      go.disabled = true;
      try { await CSTeam.call('ot.add', { name: name, date: d.value || pick, from: OT_FROM, to: v.hm }, 20000); toast(Number(pick.slice(5, 7)) + '/' + Number(pick.slice(8, 10)) + ' ' + v.hm + ' 퇴근으로 적었어요'); t.value = ''; parse(); work.month = monthOf(d.value || pick); await loadWork(); }
      catch (e) { toast(e.message, { warn: true }); } finally { go.disabled = false; }
    });
    t.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); go.click(); } });
    var r1 = el('div', 'brow wrow'); r1.append(lab2('날짜', days2), lab2('퇴근 시각', t), pv, el('span', 'grow'), who, go);
    w.append(el('p', 'whint', '퇴근 시각을 숫자 4자리로 적어 주세요. 예: 19시 40분 퇴근 → 1940'), r1); L.append(w);
    // 달 넘기기
    if (!work.month) work.month = monthOf(kstToday());
    var nav = el('div', 'filters wnav'), m = work.month;
    nav.append(btn('◀', 'sm', null, function () { work.month = addMonth(m, -1); work.items = null; renderWork(); loadWork(); }), el('b', null, Number(m.slice(0, 4)) + '년 ' + Number(m.slice(5, 7)) + '월'), btn('▶', 'sm', null, function () { work.month = addMonth(m, 1); work.items = null; renderWork(); loadWork(); }));
    L.append(nav);
    if (work.err && !work.items) { var eb = el('div', 'empty', '불러오지 못했어요.\n' + work.err); var rb = btn('다시 불러오기', 'sm', null, function () { work.err = ''; renderWork(); loadWork(); }); eb.append(el('br'), rb); L.append(eb); return; }
    if (work.err) L.append(el('div', 'scope', '새로 불러오지 못해 지난번 내용을 보여 줘요 · ' + work.err));
    // 내 이름은 성 뺀 이름으로 맞춰 비교(김수빈 → 수빈 · 서버도 같은 규칙)
    var items = work.items || [], hol = WorkClock.holidays(work.cfg || {}), me = (function (v) { var t = String(v || '').replace(/\s+/g, '').replace(/\d+$/, ''); return /^[가-힣]{3}$/.test(t) ? t.slice(1) : t; })(myName());
    // 순서: 명단에 적힌 성 포함 이름(강유미 · 김수빈 · 김영원 · 박범수 · 신호정) 가나다순 — 명단에 없으면 그 이름으로
    var fullOf = {}; (work.roster || []).forEach(function (x) { if (x && x.name) fullOf[x.name] = x.full || x.name; });
    items.forEach(function (x) { if (x.full && !fullOf[x.name]) fullOf[x.name] = x.full; });
    var ord = function (a, b) { return (fullOf[a] || a).localeCompare(fullOf[b] || b, 'ko'); }, nm = function (n) { return fullOf[n] || n; };
    items = items.slice().sort(function (a, b) { return ord(a.name, b.name); });
    var grid = el('div', 'wgrid');
    // 달력: 공휴일은 빨갛게 · 칸마다 그날 야근한 사람과 퇴근 시각
    // 평일만(토·일 칸은 뺌)
    var cal = el('div', 'wcal'); ['월', '화', '수', '목', '금'].forEach(function (x) { cal.append(el('div', 'wd', x)); });
    var first = m + '-01', fw = WorkClock.weekday(first), lead = fw === 0 || fw === 6 ? 0 : fw - 1, days = Number(WorkClock.addDays(addMonth(m, 1) + '-01', -1).slice(8, 10)), today = kstToday();
    for (var i = 0; i < lead; i++) cal.append(el('div', 'wc blank'));
    for (var dd = 1; dd <= days; dd++) {
      var k = m + '-' + String(dd).padStart(2, '0'), wd = WorkClock.weekday(k); if (wd === 0 || wd === 6) continue;
      var cell = el('div', 'wc' + (hol[k] || wd === 0 ? ' off' : wd === 6 ? ' sat' : '') + (k === today ? ' today' : ''));
      cell.append(el('span', 'n', String(dd)));
      if (hol[k]) cell.append(el('span', 'h', hol[k]));
      items.filter(function (x) { return x.date === k; }).forEach(function (x) { cell.append(el('span', 'ot' + (x.name === me ? ' me' : ''), nm(x.name) + ' ' + x.to)); });
      cal.append(cell);
    }
    // 이달 야근 합계(누구나 봄)
    // 이달 야근 합계 + 사람마다 한 칸(날짜 · 퇴근 · 야근) — 달력 옆 빈 자리에 좌르륵
    var sum = {}, by = {}; items.forEach(function (x) { sum[x.name] = (sum[x.name] || 0) + (x.mins || 0); (by[x.name] || (by[x.name] = [])).push(x); });
    var names = Object.keys(sum).sort(ord), all = 0;
    var side = el('div', 'wside'), tot = el('div', 'wsum');
    tot.append(el('h3', null, Number(m.slice(5, 7)) + '월 야근 합계'));
    if (!names.length) tot.append(el('p', 'muted', work.items ? '아직 없어요' : '불러오는 중…'));
    names.forEach(function (n) { all += sum[n]; var r = el('div', 'wsr' + (n === me ? ' me' : '')); r.append(el('span', null, n), el('small', null, by[n].length + '일'), el('b', null, hm(sum[n]))); tot.append(r); });
    var cards = el('div', 'wcards');
    names.forEach(function (n) {
      var c = el('div', 'wcard' + (n === me ? ' me' : '')), h = el('div', 'wch');
      h.append(el('span', 'av', nm(n).slice(0, 1)), el('b', null, nm(n)), el('span', 'grow'), el('span', 'muted', by[n].length + '일 · '), el('b', 'wct', hm(sum[n])));
      c.append(h); var wl = el('div', 'wcl'); c.append(wl);
      by[n].slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).forEach(function (x) {
        var r = el('div', 'wcr');
        r.append(el('span', 'd', Number(x.date.slice(5, 7)) + '/' + Number(x.date.slice(8, 10)) + ' (' + '일월화수목금토'[WorkClock.weekday(x.date)] + ')'), el('span', 't', x.to), el('span', 'grow'), el('span', 'm', hm(x.mins || 0)));
        if (x.name === me && x.status === '신청') { var del = el('button', 'wdel', '×'); del.type = 'button'; del.title = '이 날 지우기'; del.setAttribute('aria-label', '이 날 지우기'); del.addEventListener('click', async function () { if (!confirm(Number(x.date.slice(5, 7)) + '/' + Number(x.date.slice(8, 10)) + ' 기록을 지울까요?')) return; try { await CSTeam.call('ot.cancel', { id: x.id, name: me }); toast('지웠어요'); loadWork(); } catch (e) { toast(e.message, { warn: true }); } }); r.append(del); }
        wl.append(r);
      });
      cards.append(c);
    });
    side.append(tot, cards);
    grid.append(cal, side); L.append(grid);
    if (names.length) L.append(el('div', 'scope', '잘못 적었으면 같은 날로 다시 적으면 고쳐져요'));
  }
  // 퇴근 시각: 1940 · 19:40 · 940(→ 21:40) · 730(→ 19:30) · 10분 단위로 내림 — 17:00부터(자정 넘으면 2430처럼)
  function parseClock(raw) {
    var v = String(raw || '').replace(/[^0-9]/g, ''); if (!v) return {};
    if (v.length < 3) return { err: '숫자 4자리로 적어 주세요(예: 1940)' };
    var h = Number(v.slice(0, v.length - 2)), mi = Number(v.slice(-2));
    if (mi > 59 || h > 29) return { err: '시각을 확인해 주세요' };
    if (h < 12) h += 12; // 730 → 19:30 · 0930 → 21:30
    mi = Math.floor(mi / 10) * 10; // 10분 단위(1937 → 19:30)
    var min = h * 60 + mi;
    if (min < 17 * 60) return { err: '17:00 뒤 시각만 적을 수 있어요' };
    return { hm: String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0'), min: min };
  }
  function workCfg() { return work.cfg || (workCache(monthOf(kstToday())) || {}).cfg || {}; }
  function isWorkday(k) { return !!WorkClock.day(k, workCfg()); }
  function prevWorkday(k) { var x = WorkClock.addDays(k, -1); for (var i = 0; i < 20 && !isWorkday(x); i++) x = WorkClock.addDays(x, -1); return x; }
  function offName(k) { var h = WorkClock.holidays(workCfg())[k]; return Number(k.slice(5, 7)) + '/' + Number(k.slice(8, 10)) + (h ? ' ' + h : '(' + '일월화수목금토'[WorkClock.weekday(k)] + ')'); }
  function lab2(t, input) { var l = el('label', 'wl'); l.append(el('span', null, t), input); return l; }

  function when(t) { if (!t) return ''; var d = new Date(t), now = new Date(); var same = d.toDateString() === now.toDateString(); return same ? '오늘 ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') : (d.getMonth() + 1) + '/' + d.getDate(); }

  /* 못 찾은 검색어: 스크립트 검색에서 꼭 맞는 멘트가 없던 짧은 검색어만(2.5초 그대로 둔 것) 하루치로 모아 팀 서버에
     고객 문장을 붙여 넣은 긴 글 · 숫자 4자리 이상(주문번호·전화) · @(메일)이 들어간 건 안 모음 · 이름 없이 */
  var MISSQ = 'csx:missQ', missT = 0, missSent = new Set();
  function missOk(v) { v = String(v || '').replace(/\s+/g, ' ').trim(); return v.length >= 2 && v.length <= 20 && v.split(' ').length <= 4 && !/\d{4,}|@|https?:/i.test(v) ? v : ''; }
  function noteMiss(v) {
    clearTimeout(missT); var t = missOk(v); if (!t || missSent.has(t)) return;
    missT = setTimeout(function () { if (missOk(q) !== t) return; missSent.add(t); var m = S.json(MISSQ, {}), d = KBData.todayKey(); if (!m || m.day !== d) { if (m && m.day && m.counts) flushMiss(m); m = { day: d, counts: {} }; } m.counts[t] = (m.counts[t] || 0) + 1; S.put(MISSQ, m); }, 2500);
  }
  async function flushMiss(given, keep) {
    if (!CSTeam.ready()) return;
    var m = given || S.json(MISSQ, {}); if (!m || !m.counts || !Object.keys(m.counts).length) return;
    if (!given) S.put(MISSQ, { day: m.day, counts: {} });
    try { await CSTeam.call('miss.add', { day: m.day, counts: m.counts }, 20000, keep); } catch (e) { /* 예전 팀 서버면 버림 */ }
  }
  setInterval(function () { flushMiss(); }, 10 * 60000);
  document.addEventListener('visibilitychange', function () { if (document.hidden) flushMiss(null, true); });

  /* 멘트 사용 통계: 담기·교체한 멘트 번호만 하루치로 모아 10분마다 팀 서버에 보냄(고객 내용은 안 보냄) */
  var USE = 'csx:useQ';
  function queueUse(id) { var q = S.json(USE, {}); if (!q || typeof q !== 'object') q = {}; var d = KBData.todayKey(); if (q.day !== d) { if (q.day && q.counts) flushUse(q); q = { day: d, counts: {} }; } q.counts[id] = (q.counts[id] || 0) + 1; S.put(USE, q); }
  async function flushUse(given, keep) {
    if (!CSTeam.ready()) return;
    var q = given || S.json(USE, {}); if (!q || !q.counts || !Object.keys(q.counts).length) return;
    if (!given) S.put(USE, { day: q.day, counts: {} });
    try { await CSTeam.call('usage.add', { day: q.day, counts: q.counts }, 20000, keep); }
    catch (e) { if (!given) { var now = S.json(USE, {}); if (now && now.day === q.day) { Object.keys(q.counts).forEach(function (k) { now.counts[k] = (now.counts[k] || 0) + q.counts[k]; }); S.put(USE, now); } } }
  }
  setInterval(function () { flushUse(); }, 10 * 60000);
  document.addEventListener('visibilitychange', function () { if (document.hidden) flushUse(null, true); });

  /* ───── 계산기 ───── */
  var CALC_DEFAULT = { asFee: 6000, returnDays: 7, rates: [{ label: '1~12개월', rate: 30 }, { label: '13~24개월', rate: 60 }, { label: '25~36개월', rate: 80 }, { label: '37~48개월', rate: 90 }, { label: '49개월 이상', rate: 100, blocked: true }] };
  function calcCfg() { var c = C && C.sources && C.sources.calc; return c && c.rates && c.rates.length ? c : CALC_DEFAULT; }
  var WD = ['일', '월', '화', '수', '목', '금', '토'];
  function won(v) { return Number(v || 0).toLocaleString('ko-KR') + '원'; }
  function renderAs() {
    var out = $('asOut'); out.replaceChildren(); var raw = $('asIn').value.replace(/[^0-9]/g, ''); if (!raw) return;
    var price = parseInt(raw, 10); if (!price) { out.append(el('div', 'err', '올바른 금액을 넣어 주세요.')); return; }
    var cc = calcCfg(), fee = Number(cc.asFee) || 0;
    cc.rates.forEach(function (t) {
      var amt = Math.round(price * t.rate / 100), r = el('div', 'rate' + (t.blocked ? ' off' : '')), a = el('div', 'a'), b = el('div', 'b');
      a.append(el('b', null, t.label), el('span', null, t.rate + '%')); b.append(el('span', null, won(amt) + ' + 배송비'), el('b', null, won(amt + fee))); r.append(a, b); out.append(r);
    });
    var bl = cc.rates.filter(function (t) { return t.blocked; }).map(function (t) { return t.label; });
    out.append(el('div', 'memo', (bl.length ? bl.join(' · ') + '은(는) 유상교환이 아닌 일반 구매 안내 구간이에요. ' : '') + '배송비 ' + won(fee) + ' 포함 · 계산값은 참고용이니 최신 정책을 함께 확인해 주세요.'));
  }
  function renderDue() {
    var out = $('dueOut'); out.replaceChildren(); var v = $('dueIn').value.trim(); if (!v) return;
    var dg = v.replace(/[^0-9]/g, ''), y = +dg.slice(0, 4), mo = +dg.slice(4, 6), d = +dg.slice(6, 8), dt = new Date(y, mo - 1, d);
    if (dg.length !== 8 || dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) { out.append(el('div', 'err', '날짜를 알아보지 못했어요. 20260701 또는 2026-07-01 모양으로 넣어 주세요.')); return; }
    var days = Number(calcCfg().returnDays) || 7, now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate()), dl = new Date(dt); dl.setDate(dl.getDate() + days);
    var left = Math.round((dl - today) / 864e5), exp = left < 0, box = el('div', 'due');
    box.append(el('div', 'dlb', exp ? '반품·교환이 가능했던 마지막 날' : '반품·교환이 가능한 마지막 날'), el('div', 'dt', dl.getFullYear() + '년 ' + (dl.getMonth() + 1) + '월 ' + dl.getDate() + '일 (' + WD[dl.getDay()] + ')'),
      el('span', 'pill ' + (exp ? 'no' : 'ok'), exp ? '기한 지남 · ' + Math.abs(left) + '일 지남' : left === 0 ? '기한 안 · 오늘 마감' : '기한 안 · ' + left + '일 남음'));
    out.append(box);
    var key = dl.getFullYear() + '-' + String(dl.getMonth() + 1).padStart(2, '0') + '-' + String(dl.getDate()).padStart(2, '0'), we = dl.getDay() === 0 || dl.getDay() === 6, hol = WorkClock.holidays(workCfg())[key];
    if (we || hol) out.append(el('div', 'memo', '마감일이 ' + (hol ? '공휴일(' + hol + ')' : '주말') + '과 겹쳐요. 실제 접수 기한은 판매처 기준을 함께 확인해 주세요.'));
    out.append(el('div', 'memo', '수령일 다음 날부터 ' + days + '일째가 마지막 날이에요(관리자가 멘트 관리 [계산기]에서 바꿀 수 있어요).'));
    if (dt > today) out.append(el('div', 'memo', '수령일이 오늘보다 뒤예요. 날짜를 다시 확인해 주세요.'));
  }
  $('asIn').addEventListener('input', renderAs); $('dueIn').addEventListener('input', renderDue);
  function calcTab(due) { $('cDueTab').setAttribute('aria-selected', String(due)); $('cAsTab').setAttribute('aria-selected', String(!due)); $('cDue').hidden = !due; $('cAs').hidden = due; setTimeout(function () { (due ? $('dueIn') : $('asIn')).focus(); }, 0); }
  $('cDueTab').addEventListener('click', function () { calcTab(true); }); $('cAsTab').addEventListener('click', function () { calcTab(false); });
  $('calcBtn').addEventListener('click', function (e) { e.stopPropagation(); var open = $('calcPop').hidden; closePops(); if (open) { $('calcPop').hidden = false; $('calcBtn').setAttribute('aria-expanded', 'true'); calcTab($('cAs').hidden); } });
  function closePops() { $('calcPop').hidden = true; $('calcBtn').setAttribute('aria-expanded', 'false'); }
  ['calcPop'].forEach(function (id) { $(id).addEventListener('click', function (e) { e.stopPropagation(); }); });
  document.addEventListener('click', closePops);

  /* ───── 화면 밝기 ───── */
  function applyTheme() { var t = S.get(K.theme); if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }
  function isDark() { var t = document.documentElement.dataset.theme; return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; }
  $('themeBtn').addEventListener('click', function () { S.set(K.theme, isDark() ? 'light' : 'dark'); S.mirrorSoon(); applyTheme(); });

  /* ───── 위 띠: 연결 문제 · 고정 공지 ───── */
  function renderBanner() {
    var b = $('banner'), st = CSContent.status(); b.replaceChildren(); b.className = 'banner'; b.onclick = null;
    if (C && st.state && ['auth', 'bad', 'error'].indexOf(st.state) >= 0) {
      b.append(ic('warn'), el('span', 't', '최신 문안을 확인하지 못했어요 · ' + (st.message || '') + ' · 마지막으로 받은 문안으로 검색 중'));
      var d = el('button', null, '자세히'); d.type = 'button'; d.addEventListener('click', openSettings); b.append(d); b.hidden = false; return;
    }
    var pins = (C && C.notices || []).filter(function (n) { return n.pin && n.title; });
    if (pins.length) { b.className = 'banner pin'; b.append(ic('pin'), el('span', 't', '공지 · ' + pins.slice(0, 3).map(function (n) { return n.title; }).join('  ·  '))); b.onclick = function () { setView('notice'); }; b.hidden = false; return; }
    b.hidden = true;
  }

  /* ───── 설정 ───── */
  var installEvt = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; });
  function openSettings() {
    openDlg(function (d) {
      var st = CSContent.status(), conn = CSContent.connOf();
      d.append(el('h2', null, '설정'));
      var box = el('div', 'st');
      var l1 = el('div'); l1.append('지금 보는 문안: ', el('b', C && C.source === 'github' ? 'ok' : 'warn', C ? (C.source === 'github' ? '관리자가 올린 최신 문안' + (C.scripts.version ? ' (' + C.scripts.version + '판)' : '') : '확장에 들어 있는 기본 문안') : '없음')); box.append(l1);
      if (conn) { var l2 = el('div'); var bad = st.state && ['ok', 'none', 'empty'].indexOf(st.state) < 0; l2.append('마지막 확인: ', el('b', bad ? 'bad' : null, (st.checkedAt ? ago(st.checkedAt) : '아직') + (bad ? ' · ' + st.message : ' · 정상'))); box.append(l2); }
      var l3 = el('div'); l3.append('검색기 연결 확장: ', el('b', CSBridge.ready ? 'ok' : 'warn', CSBridge.ready ? '연결됨 (' + CSBridge.version + ')' : '연결 안 됨 · 문의 검색·불량가이드·사진은 이 확장이 있어야 해요')); box.append(l3);
      d.append(box);
      if (!(conn && conn.role === 'admin')) {
        d.append(el('h3', null, conn ? '연결 코드 바꾸기' : '연결 코드 넣기'), el('p', null, '관리자에게 받은 ‘CS연결-…’ 코드를 통째로 붙여 넣어 주세요.'));
        var ta = el('textarea', 'code'); ta.placeholder = 'CS연결-…'; ta.spellcheck = false; d.append(ta);
        var res = el('div', 'res'); d.append(res);
        var ra = el('div', 'acts');
        if (conn) ra.append(btn('연결 끊기', 'ghost danger', null, function () { CSContent.clearConn(); d.close(); loadContent(); }));
        var go = btn('연결', 'primary', null, async function () {
          go.disabled = true; res.className = 'res'; res.textContent = '확인하는 중…';
          var r = await CSContent.setCode(ta.value); go.disabled = false;
          if (!r.ok) { if (r.token) ta.value = ''; res.className = 'res bad'; res.textContent = r.error; return; }
          res.className = 'res ok'; res.textContent = '연결했어요'; loadContent(); setTimeout(function () { d.close(); }, 700);
        });
        ra.append(go); d.append(ra);
      }
      d.append(el('h3', null, '화면 밝기'));
      // 밝게 · 어둡게 두 가지만(아직 안 골랐으면 지금 보이는 쪽이 눌려 있음)
      var seg = el('div', 'seg'), cur = S.get(K.theme) || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      [['light', '밝게'], ['dark', '어둡게']].forEach(function (o) { var b = el('button', null, o[1]); b.type = 'button'; b.setAttribute('aria-pressed', String(cur === o[0])); b.addEventListener('click', function () { S.set(K.theme, o[0]); applyTheme(); openSettings(); }); seg.append(b); });
      d.append(seg);
      d.append(el('h3', null, '앱처럼 쓰기 · 탭으로 쓰기'));
      var standalone = matchMedia('(display-mode: standalone)').matches;
      d.append(el('p', null, standalone ? '지금 앱으로 설치해서 쓰고 있어요. 창 위치·크기는 다음에 열어도 그대로예요.' :
        '앱으로 설치하면 작업표시줄에 아이콘이 생기고 자기 창으로 떠요(반대쪽 모니터에 두기 좋아요). 그냥 크롬 탭으로 쓰려면 이 탭을 마우스 오른쪽 버튼 → [고정]을 누르세요.'));
      if (!standalone) {
        var ia = el('div', 'acts'); ia.style.justifyContent = 'flex-start';
        ia.append(btn('앱으로 설치', 'primary', null, async function () {
          if (installEvt) { installEvt.prompt(); try { await installEvt.userChoice; } catch (e) {} installEvt = null; d.close(); }
          else toast('주소창 오른쪽 끝의 설치 아이콘(화면에 ↓)을 누르거나, 크롬 ⋮ 메뉴 → 전송, 저장 및 공유 → ‘페이지를 앱으로 설치’를 눌러 주세요');
        }));
        d.append(ia);
      }
      d.append(el('h3', null, '개인 설정 백업 · 복원'), el('p', null, '즐겨찾기 · 내 멘트 · 내 끝인사 · 초성 단축어 · 최근 쓴 문안을 파일 하나로 옮겨요. 예전 검색기(구글 웹앱)에서 내려받은 백업 파일도 그대로 불러올 수 있어요.'));
      var file = el('input'); file.type = 'file'; file.accept = 'application/json,.json'; file.hidden = true; file.id = 'importFile';
      file.addEventListener('change', function () { importPersonal(file.files && file.files[0]); file.value = ''; });
      var ba = el('div', 'acts'); ba.style.justifyContent = 'flex-start';
      ba.append(btn('백업 파일 내려받기', '', null, exportPersonal), btn('백업 파일 불러오기', '', null, function () { file.click(); }), file);
      var drafts = S.json(K.drafts, []);
      if (Array.isArray(drafts) && drafts.length) ba.append(btn('비운 글 되살리기', 'ghost', null, function () { restoreDraftDlg(); }));
      d.append(ba);
      d.append(el('h3', null, '관리자'));
      var aa = el('div', 'acts'); aa.style.justifyContent = 'flex-start';
      var am = el('a', 'btn'); am.href = 'admin.html'; am.target = '_blank'; am.rel = 'noopener'; am.append(ic('edit'), '관리 열기'); aa.append(am); d.append(aa);
      var fa = el('div', 'acts'); fa.append(el('span', null, '화면 ' + (appVer || VERSION))); fa.firstChild.style.cssText = 'margin-right:auto;color:var(--ink3);font-size:12.5px';
      fa.append(btn('닫기', 'primary', null, function () { d.close(); })); d.append(fa);
    });
  }
  $('setBtn').addEventListener('click', openSettings);
  function restoreDraftDlg() {
    openDlg(function (d) {
      d.append(el('h2', null, '비운 글 되살리기'), el('p', null, '최근에 비운 글 5개까지 남아 있어요. 고르면 작성공간에 다시 넣어요.'));
      (S.json(K.drafts, []) || []).forEach(function (x) {
        var c = el('div', 'card'); c.style.marginBottom = '8px'; c.append(el('p', 'pv', x.text || ''));
        var a = el('div', 'acts'); a.append(btn('작성공간에 넣기', 'primary', null, function () { if (note.value.trim()) archive(note.value); note.value = x.text || ''; S.set(K.note, note.value); blanks(); d.close(); setView('scripts', false); note.focus(); }));
        a.append(el('span', null, x.savedAt ? new Date(x.savedAt).toLocaleString('ko-KR') : '')); a.lastChild.style.cssText = 'color:var(--ink3);font-size:12.5px'; c.append(a); d.append(c);
      });
      var f = el('div', 'acts'); f.append(btn('닫기', 'ghost', null, function () { d.close(); })); d.append(f);
    });
  }
  function exportPersonal() {
    var data = { format: 'cx-workbench-personal-v3', exportedAt: new Date().toISOString(), favorites: Array.from(M.favorites), favoriteOrder: M.favoriteOrder, recent: M.recent, usage: M.usage,
      customScripts: M.custom, customOrder: M.customOrder, personalClosings: M.pclosings, drafts: S.json(K.drafts, []), searchMisses: S.json(K.misses, []), note: note.value,
      theme: isDark() ? 'dark' : 'light', accent: S.get(K.accent) || 'blue', viewMode: 'grid', shortcuts: M.shortcuts };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }), a = el('a');
    a.href = URL.createObjectURL(blob); a.download = '상담검색기_개인설정_백업_' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '.json';
    document.body.append(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500); toast('백업 파일을 내려받았어요');
  }
  function importPersonal(file) {
    if (!file) return; if (file.size > 2 * 1024 * 1024) { toast('백업 파일이 너무 커요', { warn: true }); return; }
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var x = JSON.parse(String(rd.result || ''));
        if (!x || (x.format !== 'cx-workbench-personal-v2' && x.format !== 'cx-workbench-personal-v3')) throw new Error('이 검색기에서 만든 백업 파일이 아니에요');
        openDlg(function (d) {
          d.append(el('h2', null, '백업 파일로 바꿀까요?'), el('p', null, '지금 이 PC의 즐겨찾기 · 내 멘트 · 내 끝인사 · 초성 단축어 · 최근 쓴 문안이 백업 파일 내용으로 바뀌어요.'));
          var a = el('div', 'acts'); a.append(btn('취소', 'ghost', null, function () { d.close(); }), btn('바꾸기', 'primary', null, function () {
            S.put(K.customScripts, normCustom(x.customScripts)); S.put(K.customOrder, Array.isArray(x.customOrder) ? x.customOrder.map(String) : []);
            S.put(K.personalClosings, normPClosings(x.personalClosings)); S.put(K.favorites, Array.isArray(x.favorites) ? x.favorites.map(String) : []);
            S.put(K.favoriteOrder, Array.isArray(x.favoriteOrder) ? x.favoriteOrder.map(String) : []); S.put(K.recent, Array.isArray(x.recent) ? x.recent.map(String).slice(0, 12) : []);
            S.put(K.usage, x.usage && typeof x.usage === 'object' ? x.usage : {}); S.put(K.drafts, Array.isArray(x.drafts) ? x.drafts.slice(0, 5) : []);
            if (x.shortcuts && typeof x.shortcuts === 'object') S.put(K.shortcuts, x.shortcuts);
            if (typeof x.note === 'string') { note.value = textLimit(x.note, 100000); S.set(K.note, note.value); }
            if (x.theme === 'dark' || x.theme === 'light') S.set(K.theme, x.theme);
            loadPersonal(); applyTheme(); rebuild(); renderAll(); blanks(); d.close(); toast('개인 설정을 되살렸어요');
          })); d.append(a);
        });
      } catch (e) { toast(e.message || '백업 파일을 읽지 못했어요', { warn: true }); }
    };
    rd.onerror = function () { toast('백업 파일을 읽지 못했어요', { warn: true }); };
    rd.readAsText(file, 'utf-8');
  }

  /* ───── 처음: 연결 코드 ───── */
  function showOnboard(on) {
    var o = $('onboard'); if (!on) { o.hidden = true; return; }
    o.replaceChildren(); var b = el('div', 'box');
    b.append(el('h2', null, '연결 코드를 넣어 주세요'), el('p', null, '관리자에게 받은 ‘CS연결-…’ 코드를 아래에 붙여 넣으면 상담 문안·공지가 열려요. 한 번만 하면 돼요.'));
    var ta = el('textarea'); ta.placeholder = 'CS연결-…'; ta.spellcheck = false; ta.setAttribute('aria-label', '연결 코드'); b.append(ta);
    var res = el('div', 'res'); b.append(res);
    var go = btn('연결', 'primary big', null, async function () {
      go.disabled = true; res.className = 'res'; res.textContent = '확인하는 중…';
      var r = await CSContent.setCode(ta.value); go.disabled = false;
      if (!r.ok) { if (r.token) ta.value = ''; res.className = 'res bad'; res.textContent = r.error; return; }
      loadContent();
    });
    go.style.width = '100%'; b.append(go);
    b.append(el('p', null, CSBridge.ready ? '' : '‘검색기 연결’ 확장이 있는 PC는 연결 전에도 기본 문안으로 검색할 수 있어요.'));
    b.lastChild.style.cssText = 'margin:12px 0 0;font-size:13px;color:var(--ink3)';
    o.append(b); o.hidden = false; setTimeout(function () { ta.focus(); }, 0);
  }

  /* ───── 키 ───── */
  document.addEventListener('keydown', function (e) {
    if (CSMedia.isOpen()) return;
    var mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); var i = curView === 'req' ? $('rq') : curView === 'defect' ? $('dq') : curView === 'notice' ? $('nq') : $('q'); i.focus(); i.select(); return; }
    if (mod && e.key === 'Enter' && curView === 'scripts') { e.preventDefault(); $('copyBtn').click(); return; }
    if (e.key === 'Escape') closePops();
  });

  function renderAll() { renderScripts(); renderBadges(); if (curView === 'req') renderReq(); if (curView === 'defect') renderDefect(); if (curView === 'notice') renderNotices(); }
  CSContent.on(function (what) { if (what === 'content') loadContent(); else renderBanner(); });
  document.addEventListener('csbridge', function () { refreshBridge(false); });
  document.addEventListener('csbridge-event', function (e) { var d = e.detail || {}; if (d.what === 'data') refreshBridge(false); else if (d.what === 'view' && d.view) setView(d.view); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { refreshBridge(false); } });

  /* 새 판 알아채기: 화면을 새로 올리면(배포) 5분 안에 알아챔
     · 다른 창을 보고 있을 때(이 탭이 가려져 있을 때) 조용히 새로고침 · 보고 있으면 [새로고침] 알림만
     · 작성공간 글은 새로고침 전에 저장해 둬서 그대로 남음 */
  var appVer = '', newVer = false;
  async function checkVer() {
    if (!/^https?:$/.test(location.protocol)) return;
    try {
      var r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return;
      var v = String((await r.json()).v || ''); if (!v) return;
      if (!appVer) { appVer = v; return; }
      if (v !== appVer) { newVer = true; applyVer(); }
    } catch (e) {}
  }
  function applyVer() {
    if (!newVer) return;
    if (document.hidden) { try { S.set(K.note, note.value); } catch (e) {} location.reload(); return; }
    toast('검색기 새 판이 나왔어요', { action: { label: '새로고침', fn: function () { try { S.set(K.note, note.value); } catch (e) {} location.reload(); } } });
  }
  checkVer(); setInterval(function () { checkVer(); }, 5 * 60000);
  document.addEventListener('visibilitychange', function () { if (document.hidden) applyVer(); });

  // 기록기 Alt+S: 주소 끝 #find-… → 스크립트 화면 검색창에 커서
  function findFromHash() { if (!/^#find-/.test(location.hash || '')) return false; setView('scripts', false); var i = $('q'); setTimeout(function () { window.focus(); i.focus(); i.select(); }, 0); return true; }
  window.addEventListener('hashchange', findFromHash);

  /* ───── 시작 ───── */
  (async function boot() {
    applyTheme(); loadPersonal();
    note.value = S.get(K.note) || ''; blanks();
    var first = (location.hash || '').slice(1);
    if (!findFromHash()) setView(VIEWS.indexOf(first) >= 0 ? first : 'scripts', true);
    await CSBridge.wait(1500);
    var n = await S.restoreIfEmpty(); if (n) { loadPersonal(); note.value = S.get(K.note) || ''; blanks(); toast('저장해 둔 개인 설정을 되살렸어요'); }
    var back = await S.restoreExtra(); // 연결 코드가 지워졌으면 확장 보관본으로(다시 안 넣어도 됨)
    if (back) await CSContent.sync(true);
    else if (S.get(K.conn)) S.mirrorSoon(); // 예전부터 쓰던 PC도 이번에 한 벌 보관해 둠
    await loadContent();
    CSContent.sync(false).then(function () { renderBanner(); });
    refreshBridge(false);
  })();
  window.CSApp = { setView: setView, add: add, reload: loadContent };
})();
