/* 3.4.17 멘트 관리: ‘바뀐 곳’ 계산 · 최신 판 위에 내 수정 다시 얹기 · 보내기 전 점검.
   화면(scriptadmin.js)과 단위 시험(tests/script-diff.test.js)이 같이 쓰는 순수 함수라서 화면 코드와 따로 둠.
   자료 모양: { categories:[{id,name,cards:[{id,title,group,script,note}]}], closings:[{id,title,body}], config:{processingGuide,serviceUrl} } */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.ScriptDiff = factory(); })(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clone = x => JSON.parse(JSON.stringify(x == null ? null : x));
  const str = v => String(v == null ? '' : v);
  const CARD_F = ['title', 'group', 'script', 'note', 'until'];
  const FIELD_KO = { title: '제목', group: '꼬리표', script: '내용', note: '메모', until: '끝나는 날' };
  const nameOf = k => str(k && k.title).trim() || '(제목 없음)';
  const guideOf = d => str(d && d.config && d.config.processingGuide);
  const phrasesOf = d => (d && d.config && Array.isArray(d.config.phrases) ? d.config.phrases : []);
  const phrasesSig = d => JSON.stringify(phrasesOf(d).map(p => [str(p.key), str(p.text)]));

  /* 창구에서 받은 멘트 자료를 편집용으로: 판 번호 같은 덧붙은 값은 빼고, 빠진 칸은 채움 */
  function clean(d) {
    const o = clone(d) || {};
    delete o.version; delete o.fromServer;
    o.categories = (Array.isArray(o.categories) ? o.categories : []).filter(c => c && c.id).map(c => ({ ...c, name: str(c.name), cards: (Array.isArray(c.cards) ? c.cards : []).filter(k => k && k.id).map(k => ({ ...k, title: str(k.title), group: str(k.group), script: str(k.script), note: str(k.note) })) }));
    o.closings = (Array.isArray(o.closings) ? o.closings : []).filter(c => c && c.id).map(c => ({ ...c, title: str(c.title), body: str(c.body) }));
    o.config = o.config && typeof o.config === 'object' ? o.config : {};
    return o;
  }
  function index(d) {
    const cats = new Map(), cards = new Map();
    (d.categories || []).forEach((c, ci) => { cats.set(c.id, { cat: c, pos: ci }); (c.cards || []).forEach((k, i) => cards.set(k.id, { card: k, catId: c.id, catName: c.name, pos: i })); });
    return { cats, cards };
  }
  const sameCard = (a, b) => CARD_F.every(f => str(a[f]) === str(b[f]));
  const sameList = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  /* 한 분류 안에서 ‘둘 다 그 분류에 그대로 있는 멘트’의 순서가 달라졌는지 */
  function orderChanged(base, draft, catId) {
    const b = (base.categories || []).find(c => c.id === catId), m = (draft.categories || []).find(c => c.id === catId);
    if (!b || !m) return false;
    const mine = new Set(m.cards.map(k => k.id)), was = new Set(b.cards.map(k => k.id));
    return !sameList(b.cards.map(k => k.id).filter(id => mine.has(id)), m.cards.map(k => k.id).filter(id => was.has(id)));
  }
  function catsReordered(base, draft) {
    const mine = new Set((draft.categories || []).map(c => c.id)), was = new Set((base.categories || []).map(c => c.id));
    return !sameList((base.categories || []).map(c => c.id).filter(id => mine.has(id)), (draft.categories || []).map(c => c.id).filter(id => was.has(id)));
  }

  /* 바뀐 곳: 지금 상담원이 보는 판(base)과 내가 고친 것(draft)을 견줌 */
  function diff(base, draft) {
    const B = index(base), M = index(draft);
    const out = { added: [], removed: [], changed: [], catsAdded: [], catsRemoved: [], catsRenamed: [], catsReordered: false, reordered: [], closings: false, guide: false, phrases: false, items: [], count: 0 };
    for (const [id, m] of M.cards) {
      const b = B.cards.get(id);
      if (!b) { out.added.push({ id, title: nameOf(m.card), cat: m.catName }); continue; }
      const fields = CARD_F.filter(f => str(b.card[f]) !== str(m.card[f])), moved = b.catId !== m.catId;
      if (fields.length || moved) out.changed.push({ id, title: nameOf(m.card), cat: m.catName, fields, moved, from: moved ? b.catName : '' });
    }
    for (const [id, b] of B.cards) if (!M.cards.has(id)) out.removed.push({ id, title: nameOf(b.card), cat: b.catName });
    for (const [id, m] of M.cats) { const b = B.cats.get(id); if (!b) out.catsAdded.push({ id, name: m.cat.name }); else if (b.cat.name !== m.cat.name) out.catsRenamed.push({ id, from: b.cat.name, to: m.cat.name }); }
    for (const [id, b] of B.cats) if (!M.cats.has(id)) out.catsRemoved.push({ id, name: b.cat.name });
    out.catsReordered = catsReordered(base, draft);
    for (const c of draft.categories || []) if (orderChanged(base, draft, c.id)) out.reordered.push({ id: c.id, name: c.name });
    out.closings = JSON.stringify((base.closings || []).map(c => [c.id, c.title, c.body])) !== JSON.stringify((draft.closings || []).map(c => [c.id, c.title, c.body]));
    out.guide = guideOf(base) !== guideOf(draft);
    out.phrases = phrasesSig(base) !== phrasesSig(draft);
    // 사람이 읽는 목록(바뀐 곳 보기 · 보내기 전 확인). kind: 되돌릴 때 쓰는 종류
    const it = out.items;
    for (const x of out.added) it.push({ kind: 'added', id: x.id, tag: '새 멘트', text: x.title, sub: x.cat });
    for (const x of out.changed) it.push({ kind: 'changed', id: x.id, tag: x.fields.length ? '고침' : '옮김', text: x.title, sub: [x.fields.map(f => FIELD_KO[f]).join('·'), x.moved ? '‘' + x.from + '’ → ‘' + x.cat + '’' : ''].filter(Boolean).join(' · ') });
    for (const x of out.removed) it.push({ kind: 'removed', id: x.id, tag: '지움', text: x.title, sub: x.cat });
    for (const x of out.catsAdded) it.push({ kind: 'catAdded', id: x.id, tag: '새 분류', text: x.name, sub: '' });
    for (const x of out.catsRenamed) it.push({ kind: 'catRenamed', id: x.id, tag: '분류 이름', text: '‘' + x.from + '’ → ‘' + x.to + '’', sub: '' });
    for (const x of out.catsRemoved) it.push({ kind: 'catRemoved', id: x.id, tag: '분류 지움', text: x.name, sub: '' });
    if (out.catsReordered) it.push({ kind: 'catsOrder', id: '', tag: '순서', text: '분류 순서', sub: '' });
    for (const x of out.reordered) it.push({ kind: 'order', id: x.id, tag: '순서', text: '‘' + x.name + '’ 안의 멘트 순서', sub: '' });
    if (out.closings) it.push({ kind: 'closings', id: '', tag: '끝인사', text: '끝인사', sub: '' });
    if (out.guide) it.push({ kind: 'guide', id: '', tag: '공통 문구', text: '접수 후 처리 안내', sub: '' });
    if (out.phrases) it.push({ kind: 'phrases', id: '', tag: '공통 문구', text: '공통 문구', sub: phrasesOf(draft).map(p => '{' + str(p.key) + '}').join(' ').slice(0, 80) });
    out.count = it.length;
    return out;
  }
  /* 목록에 붙이는 표시: 'new' | 'changed' | '' */
  function cardState(baseIndex, card, catId) {
    const b = baseIndex.cards.get(card.id); if (!b) return 'new';
    return !sameCard(b.card, card) || b.catId !== catId ? 'changed' : '';
  }
  /* 이전 판 목록에 남길 한 줄(관리자가 따로 적지 않아도 되게) */
  function summary(d) {
    if (!d || !d.count) return '';
    const first = d.items[0]; const head = (first.tag === '고침' || first.tag === '옮김' || first.tag === '새 멘트' || first.tag === '지움' ? '‘' + first.text + '’ ' + first.tag : first.tag + (first.text && first.tag !== first.text ? ' ' + first.text : ''));
    return (head + (d.count > 1 ? ' 외 ' + (d.count - 1) + '건' : '')).slice(0, 190);
  }
  /* 한 항목만 원래대로(바뀐 곳 보기의 [원래대로]) — draft를 고쳐서 돌려줌 */
  function revert(base, draft, item) {
    const d = clone(draft), B = index(base), find = id => { for (const c of d.categories) { const i = c.cards.findIndex(k => k.id === id); if (i >= 0) return { c, i }; } return null; };
    const ensureCat = id => { let c = d.categories.find(x => x.id === id); if (!c) { const b = B.cats.get(id); if (!b) return null; c = { id, name: b.cat.name, cards: [] }; d.categories.splice(Math.min(b.pos, d.categories.length), 0, c); } return c; };
    if (item.kind === 'added') { const f = find(item.id); if (f) f.c.cards.splice(f.i, 1); }
    else if (item.kind === 'changed' || item.kind === 'removed') {
      const b = B.cards.get(item.id); if (!b) return d;
      const f = find(item.id); if (f) f.c.cards.splice(f.i, 1);
      const c = ensureCat(b.catId); if (c) c.cards.splice(Math.min(b.pos, c.cards.length), 0, clone(b.card));
    }
    else if (item.kind === 'catAdded') { const i = d.categories.findIndex(c => c.id === item.id); if (i >= 0 && !d.categories[i].cards.length) d.categories.splice(i, 1); }
    else if (item.kind === 'catRenamed') { const c = d.categories.find(x => x.id === item.id), b = B.cats.get(item.id); if (c && b) c.name = b.cat.name; }
    else if (item.kind === 'catRemoved') ensureCat(item.id);
    else if (item.kind === 'catsOrder') { const want = (base.categories || []).map(c => c.id); d.categories = stableBy(d.categories, want); }
    else if (item.kind === 'order') { const c = d.categories.find(x => x.id === item.id), b = B.cats.get(item.id); if (c && b) c.cards = stableBy(c.cards, b.cat.cards.map(k => k.id)); }
    else if (item.kind === 'closings') d.closings = clone(base.closings || []);
    else if (item.kind === 'guide') d.config = { ...(d.config || {}), processingGuide: guideOf(base) };
    else if (item.kind === 'phrases') d.config = { ...(d.config || {}), phrases: clone(phrasesOf(base)) };
    return d;
  }
  // want에 있는 것은 그 순서대로, 없는 것(새로 생긴 것)은 지금 자리 근처를 지키도록 앞 항목 뒤에 붙임
  function stableBy(list, want) {
    const pos = new Map(want.map((id, i) => [id, i]));
    const known = list.filter(x => pos.has(x.id)).sort((a, b) => pos.get(a.id) - pos.get(b.id));
    const out = []; let ki = 0;
    for (const x of list) { if (pos.has(x.id)) out.push(known[ki++]); else out.push(x); }
    return out;
  }

  /* 그 사이 다른 PC에서 멘트가 바뀌었을 때: 최신 판(latest) 위에 내가 고친 것만 다시 얹음.
     같은 멘트를 둘 다 고쳤으면 내 것이 이기고, 그 제목을 both로 알려 줌 */
  function rebase(base, draft, latest) {
    const B = index(base), M = index(draft), out = clean(latest), both = [];
    const catOf = id => out.categories.find(c => c.id === id);
    const find = id => { for (const c of out.categories) { const i = c.cards.findIndex(k => k.id === id); if (i >= 0) return { c, i, k: c.cards[i] }; } return null; };
    (draft.categories || []).forEach((c, i) => { if (!B.cats.has(c.id) && !catOf(c.id)) out.categories.splice(Math.min(i, out.categories.length), 0, { id: c.id, name: c.name, cards: [] }); });
    for (const c of draft.categories || []) { const b = B.cats.get(c.id); if (b && b.cat.name !== c.name) { const o = catOf(c.id); if (o) o.name = c.name; } }
    for (const [id] of B.cards) if (!M.cards.has(id)) { const f = find(id); if (f) f.c.cards.splice(f.i, 1); }
    (draft.categories || []).forEach(c => c.cards.forEach((k, pos) => {
      const b = B.cards.get(k.id);
      const mineChanged = !b || !sameCard(b.card, k), moved = !!b && b.catId !== c.id;
      if (!mineChanged && !moved) return;
      let target = catOf(c.id); if (!target) { target = { id: c.id, name: c.name, cards: [] }; out.categories.push(target); }
      const f = find(k.id);
      if (f) {
        if (b && mineChanged && !sameCard(f.k, b.card)) both.push(nameOf(k));
        if (mineChanged) for (const x of CARD_F) f.k[x] = str(k[x]);
        if (f.c.id !== c.id) { f.c.cards.splice(f.i, 1); target.cards.splice(Math.min(pos, target.cards.length), 0, f.k); }
      } else target.cards.splice(Math.min(pos, target.cards.length), 0, clone(k));
    }));
    for (const c of draft.categories || []) { const o = catOf(c.id); if (!o) continue;
      const want = c.cards.map(k => k.id), have = new Set(o.cards.map(k => k.id));
      // 남이 넣은 멘트가 없으면 내 순서 그대로, 있으면 내가 순서를 바꾼 분류만 내 순서를 따르고 남의 멘트는 제자리
      if (want.length === have.size && want.every(id => have.has(id))) o.cards = want.map(id => o.cards.find(k => k.id === id));
      else if (orderChanged(base, draft, c.id)) o.cards = stableBy(o.cards, want);
    }
    for (const [id] of B.cats) if (!M.cats.has(id)) { const i = out.categories.findIndex(c => c.id === id); if (i >= 0 && !out.categories[i].cards.length) out.categories.splice(i, 1); }
    { const want = (draft.categories || []).map(c => c.id), have = new Set(out.categories.map(c => c.id));
      if (want.length === have.size && want.every(id => have.has(id))) out.categories = want.map(id => out.categories.find(c => c.id === id));
      else if (catsReordered(base, draft)) out.categories = stableBy(out.categories, want); }
    if (JSON.stringify(base.closings || []) !== JSON.stringify(draft.closings || [])) out.closings = clone(draft.closings || []);
    if (guideOf(base) !== guideOf(draft)) out.config = { ...(out.config || {}), processingGuide: guideOf(draft) };
    if (phrasesSig(base) !== phrasesSig(draft)) out.config = { ...(out.config || {}), phrases: clone(phrasesOf(draft)) };
    return { data: out, both };
  }

  /* 보내기 전 점검: 막아야 할 것(errors)과 알려만 줄 것(warns) */
  function check(draft) {
    const errors = [], warns = [], names = new Map();
    for (const c of draft.categories || []) {
      const n = str(c.name).trim();
      if (!n) errors.push({ kind: 'catName', catId: c.id, text: '이름이 없는 분류가 있어요' });
      else if (names.has(n)) errors.push({ kind: 'catDup', catId: c.id, text: '‘' + n + '’ 분류가 두 개예요. 이름을 다르게 해 주세요' });
      names.set(n, 1);
      for (const k of c.cards || []) {
        if (!str(k.script).trim()) errors.push({ kind: 'empty', catId: c.id, id: k.id, text: '내용이 빈 멘트가 있어요: ' + nameOf(k) });
        else if (!str(k.title).trim()) warns.push({ kind: 'noTitle', catId: c.id, id: k.id, text: '제목이 없는 멘트가 있어요(찾기 어려워요)' });
      }
    }
    for (const c of draft.closings || []) if (!str(c.title).trim() || !str(c.body).trim()) errors.push({ kind: 'closing', id: c.id, text: '이름이나 내용이 빈 끝인사가 있어요' });
    // 멘트에 적은 {이름}이 공통 문구에 없으면 상담사 화면에 {이름}이 그대로 보임
    const keys = new Set(phrasesOf(draft).map(p => str(p.key).trim()));
    for (const c of draft.categories || []) for (const k of c.cards || []) for (const m of str(k.script).matchAll(/\{([^{}\n]{1,20})\}/g)) if (!keys.has(m[1].trim())) { errors.push({ kind: 'phrase', catId: c.id, id: k.id, text: '‘' + nameOf(k) + '’에 없는 공통 문구 {' + m[1] + '}가 있어요' }); break; }
    return { errors, warns };
  }
  return { clone, clean, index, diff, cardState, summary, revert, rebase, check, orderChanged, catsReordered, stableBy, CARD_F };
});
