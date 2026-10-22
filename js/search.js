/* 문안 검색 — 예전 검색기(v6)의 검색 규칙을 그대로 옮기고 세 가지를 더함
   1) 초성 검색: ㄱㅎㅊㅎ → ‘교환 철회’ (제목·대분류의 첫소리)
   2) 고객 문장을 그대로 붙여 넣어도 0건으로 끝나지 않게: 꼭 맞는 문안이 없으면 낱말이 많이 맞는 순(가까운 문안)
   3) 말끝 정리 확대: ‘신청했는데’ → ‘신청’, ‘와요’ 같은 말끝은 버림
   4) (10/17) 반대 뜻 문안(철회·대신·유도·아님)은 검색어에 그 말이 있을 때만 위로 · 물음 말(언제·어떻게…)은 주제어보다 가볍게
   5) (10/21) 고객 말투(들떠요·깨졌어요·못 받았어요·안 와요) · ‘반품 취소’ = 반품 철회 · ‘(제품 이슈 아님)’은 ‘이슈’를 찾을 때만 아래로
      · 분류 이름에만 있는 기종(신제품(폴드8, 플립8))은 아주 약하게 · 점수가 같으면 이 PC에서 많이 쓴 멘트 먼저
   분류를 골라 둬도 검색은 늘 전체에서(가산점도 없음). 화면 코드와 시험이 같이 씀 */
(function (root) {
  'use strict';
  var STOP_WORDS = ['고객', '문의', '제품', '관련', '사용', '사용중', '지금', '갑자기', '계속', '자꾸', '너무', '그냥',
    '조금', '정도', '해주세요', '있어요', '같아요', '했는데', '하는데', '됩니다', '되나요', '입니다', '그리고',
    '오늘', '어제', '아직', '구매', '이거', '저거', '현재', '경우', '부분', '현상', '증상', '안녕하세요', '혹시', '부탁', '드립니다', '감사합니다'];
  var SEED_TERMS = ['충전', '필름', '케이스', '지문', '배송', '반품', '교환', '재입고', '단종', '발열', '호환', '셀카봉',
    '허브', '맥세이프', '그립톡', '리모컨', '어댑터', '케이블', '취소', '환불', '전화', '통화', '파손', '유격',
    '폴드', '플립', '아라미드', '강화유리', '옵틱프로', '힌지', '블루투스', '키보드', '마우스'];
  var SYNONYMS = [
    { keys: ['안됨', '안돼', '안되', '작동안됨', '동작안됨'], terms: ['안됨', '안 되', '안돼', '되지', '작동하지', '동작하지', '인식되지'] },
    { keys: ['끊김', '끊겨', '왔다갔다', '간헐', '반복충전'], terms: ['끊김', '끊기', '중단', '반복', '재연결', '간헐', '됐다가'] },
    { keys: ['느림', '느려', '저속'], terms: ['느림', '느리', '속도', '저속'] },
    { keys: ['뜨거움', '뜨거워', '발열'], terms: ['발열', '뜨거', '열이', '온도'] },
    { keys: ['들뜸', '들떠', '들떴', '들뜨', '떠요', '떴어', '벌어짐'], terms: ['들뜸', '뜨는', '벌어짐', '기포', '밀착'] },
    { keys: ['전화', '통화', '전화요청'], terms: ['전화', '통화', '유선', 'ob'] },
    { keys: ['재입고', '입고', '품절'], terms: ['재입고', '입고', '품절', '판매일정'] },
    { keys: ['호환', '맞나요', '사용가능'], terms: ['호환', '사용가능', '지원', '간섭'] },
    { keys: ['불량', '고장'], terms: ['불량', '고장', '이상', '작동', '동작', '접수'] },
    { keys: ['지문', '지문인식'], terms: ['지문', '인식'] },
    { keys: ['탄내', '타는냄새', '그을음', '탄냄새', '눌은내'], terms: ['탄', '냄새', '스파크', '발열', '안전', '부풀'] },
    { keys: ['부풀', '빵빵', '부었', '팽창'], terms: ['부풀', '안전', '발열', '스파크'] },
    { keys: ['자석', '자력', '붙는힘', '쩍쩍'], terms: ['자석', '자력', '약함', '맥세이프', '부착'] },
    { keys: ['약함', '약해', '약한', '약하게', '약하'], terms: ['약함', '약하', '약한', '약하게', '약해'] },
    { keys: ['택배', '배달', '물건'], terms: ['배송', '출고', '택배', '송장', '수령'] },
    { keys: ['딸깍', '덜그럭', '달그락', '흔들', '덜컹'], terms: ['유격', '소음', '흔들'] },
    { keys: ['누렇', '누래', '황변', '변색', '색변'], terms: ['황변', '변색', '투명'] },
    { keys: ['김서림', '습기', '성에', '뿌옇'], terms: ['습기', '김', '옵틱'] },
    { keys: ['언제와', '언제오', '언제받', '언제되', '얼마나걸', '언제'], terms: ['기간', '지연', '일정', '출고', '배송'] },
    { keys: ['환불', '돈', '입금', '계좌'], terms: ['환불', '계좌', '입금', '기간'] },
    { keys: ['깨짐', '깨져', '깨졌', '깨진', '금감', '금이', '금갔', '금간', '금가', '갈라', '균열'], terms: ['파손', '깨짐', '균열', '스크래치'] },
    // 2026-10-21 못 받았어요 · 안 와요 · 아직 안 왔어요(안·못은 다음 말과 붙여 읽음)
    { keys: ['못받', '안와', '안왔', '안옴', '안오', '미수령', '미도착'], terms: ['못받', '미수령', '미도착', '지연', '분실'] }
  ];
  // 문안 제목·분류에 이 말이 있으면 '반대 뜻'(반품 철회 · 교환 대신 반품 유도 · ~ 아님). 검색어에 같은 말이 없으면 아래로
  var REVERSE = ['철회', '대신', '유도', '아님', '아닌'];
  // ‘아님·아닌’은 바로 앞 말을 부정함: ‘(오배송 아님)’은 오배송을 찾을 때만 반대 뜻 · ‘(제품 이슈 아님)’은 ‘먼지’를 찾을 땐 그냥 멘트
  var NOT_WORDS = ['아님', '아닌'];
  // ‘반품 취소’ · ‘교환 취소’는 고객이 신청을 거두겠다는 뜻(= 철회). 주문 ‘취소’ 멘트보다 ‘반품 철회’가 위로
  var WITHDRAW_OF = ['반품', '교환'];
  // 물음 말: 주제어(환불·배송…)보다 가볍게 셈(‘환불 언제’가 ‘배송 기간, 언제 받을 수 있나요’로 가지 않게)
  // 2026-10-22 처리 말(무엇을 해 달라는지): 이 말이 제목·작은 분류에 맞은 멘트를 같은 점수의 다른 멘트보다 위로
  //  ‘배송 취소’ → ‘취소 불가’가 ‘출고 전 배송지 변경’(본문에만 취소)보다 먼저
  var ACTION = ['취소', '철회', '반품', '교환', '환불', '신청'];
  var QWORDS = ['언제', '어떻게', '얼마나', '어디', '어디서', '왜', '방법', '가능', '가능한지', '뭐', '무엇'];
  var CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  // 2026-10-22 붙여 쓴 업무 말 나누기: 교환신청 → 교환 신청 · 반품취소 → 반품 취소(= 철회) · 출고전 → 출고 전
  //  (붙여 쓰면 한 낱말로 찾아서 ‘교환신청’이 ‘교환 신청은 … 철회되었습니다’ 본문 하나에만 맞았음)
  var JOIN_HEAD = '배송지|재입고|반품|교환|주문|배송|환불|출고|결제|입고|주소|옵션|취소|철회|접수|구매';
  var JOIN_TAIL = '신청|취소|철회|접수|변경|요청|지연|완료|불가|가능|기간|일정|방법|전|후';
  var JOIN_RE = new RegExp('(' + JOIN_HEAD + ')(' + JOIN_TAIL + ')(?=[가-힣]{0,4}(?:$|[^가-힣]))', 'g');

  function str(v) { return v == null ? '' : String(v); }
  /* 소문자 · 전각 영숫자를 반각으로 · 한글 첫소리(ㄱ~ㅎ)는 그대로 둠(NFKC는 첫소리를 다른 글자로 바꿔서 쓰지 않음) */
  function normalizeSearchText(value) {
    var v = str(value).toLowerCase().replace(/[！-～]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); });
    try { v = v.normalize('NFC'); } catch (e) { /* 그대로 */ }
    return v.replace(/[×✕]/g, 'x');
  }
  function compact(v) { return normalizeSearchText(v).replace(/[\s·\-_/()[\]{}.,!?~'"“”‘’:;]+/g, ''); }
  function cho(s) {
    var o = '';
    for (var i = 0; i < str(s).length; i++) {
      var ch = s.charAt(i), x = ch.charCodeAt(0);
      if (x >= 0xAC00 && x <= 0xD7A3) o += CHO.charAt(Math.floor((x - 0xAC00) / 588));
      else if (/[0-9a-zA-Zㄱ-ㅎ]/.test(ch)) o += ch.toLowerCase();
    }
    return o;
  }
  function isCho(t) { return /^[ㄱ-ㅎ]{2,}$/.test(t); }
  var ENDINGS = /(했는데요|했는데|했어요|했나요|했습니다|하는데|하나요|할게요|인가요|되나요|됐어요|됐는데|돼요|되요|와요|해요|어요|아요|나요|는데|은데|으로는|에서는|으로|에서|에게|까지|부터|처럼|보다|이랑|하고|이며|인데|은|는|이|가|을|를|에|도|만|해)$/u;
  function normalizeToken(token) {
    var v = normalizeSearchText(token).trim().replace(/^[^0-9a-z가-힣ㄱ-ㅎ]+|[^0-9a-z가-힣ㄱ-ㅎ]+$/g, '');
    if (isCho(v)) return v;
    if (v.length > 2 && !/\d/.test(v)) {
      var s = v.replace(ENDINGS, '');
      if (s.length >= 2 && s !== v) v = s;
      else if (/요$/.test(v)) v = v.slice(0, -1); // 들떠요 → 들떠 · 안돼요 → 안돼 · 깨져요 → 깨져
    }
    return v;
  }
  function preprocessQuery(q) {
    return normalizeSearchText(q)
      .replace(/(^|[\s,.!?~])(안|못)\s+(?=[가-힣])/g, '$1$2') // 안 와요 → 안와요 · 못 받았어요 → 못받았어요
      .replace(JOIN_RE, '$1 $2')
      .replace(/(\d+)\s*in\s*(\d+)/gi, '$1in$2')
      .replace(/(\d+(?:\.\d+)?)\s*(kw|mah|mm|cm|gb|tb|hz|w|v|a)\b/gi, '$1$2')
      .replace(/\b([a-z])\s+(\d{1,4}[a-z]*)\b/gi, '$1$2');
  }
  function isModelOrSpecToken(t) { return /\d/.test(t) && (/[a-z가-힣]/i.test(t) || /^\d+(?:\.\d+)?(?:w|kw|mah|v|a|mm|cm|gb|tb|hz)$/i.test(t)); }
  function tokenize(query) {
    var words = preprocessQuery(query).match(/[0-9a-z가-힣ㄱ-ㅎ]+/g) || [], unique = [], fallback = [];
    words.forEach(function (word) {
      var t = normalizeToken(word);
      if (!t || /^\d{6,}$/.test(t)) return;
      if (t.length < 2 && !/^\d$/.test(t)) return;
      if (/^[ㄱ-ㅎ]+$/.test(t) && t.length < 2) return;
      if (fallback.indexOf(t) < 0) fallback.push(t);
      if (!isModelOrSpecToken(t) && !/^\d+$/.test(t) && STOP_WORDS.indexOf(t) >= 0) return;
      if (/^(와요|해요|어요|아요|나요|줘요|봐요|가요|돼요|되요|주세요|주세)$/.test(t)) return;
      if (unique.indexOf(t) < 0) unique.push(t);
    });
    if (!unique.length && fallback.length) unique.push(fallback[0]);
    return unique.slice(0, 10);
  }
  function synonymGroupFor(token) {
    var n = compact(token);
    for (var i = 0; i < SYNONYMS.length; i++) {
      if (SYNONYMS[i].keys.some(function (k) { k = compact(k); return n === k || (k.length >= 2 && n.indexOf(k) === 0); })) return SYNONYMS[i];
    }
    return null;
  }
  function tokenAlternatives(token, ctx) {
    var out = [{ term: token, kind: 'direct', quality: 1 }], seen = new Set([compact(token)]), g = synonymGroupFor(token);
    var put = function (t, q) { var k = compact(t); if (!k || seen.has(k)) return; seen.add(k); out.push({ term: t, kind: 'synonym', quality: q }); };
    if (g) g.terms.forEach(function (t) { put(t, 0.74); });
    if (ctx && ctx.withdraw && token === '취소') put('철회', 1); // 반품 취소 = 반품 철회
    var fam = /^([가-힣]{2,})\d+$/.exec(token); if (fam) put(fam[1], 0.55); // 플립8 → 플립(같은 기종 줄기)
    return out;
  }
  /* ‘아님·아닌’ 바로 앞 말: ‘(오배송·배송지연 아님)’ → 오배송 · 배송지연 / ‘(제품 이슈 아님)’ → 이슈 */
  function negatedWords(text) {
    var t = normalizeSearchText(text), out = [], re = /(아님|아닌)/g, m;
    while ((m = re.exec(t))) {
      var before = t.slice(0, m.index).replace(/[\s]+$/, ''), w = before.split(/[\s(]+/).pop() || '';
      w.split(/[·,/]+/).forEach(function (x) { x = compact(x); if (x.length >= 2) out.push(x); });
    }
    return out;
  }
  function editDistanceAtMostOne(a, b) {
    a = compact(a); b = compact(b);
    if (!a || !b || Math.abs(a.length - b.length) > 1) return false;
    if (a === b) return true;
    if (a.length === b.length) { var d = 0; for (var i = 0; i < a.length; i++) if (a[i] !== b[i] && ++d > 1) return false; return true; }
    var s = a.length < b.length ? a : b, l = a.length < b.length ? b : a, si = 0, li = 0, dd = 0;
    while (si < s.length && li < l.length) { if (s[si] === l[li]) { si++; li++; } else { dd++; li++; if (dd > 1) return false; } }
    return true;
  }
  function field(value) { var t = normalizeSearchText(value); return { text: t, compact: compact(t), words: t.split(/[\s·\-_/()[\]{}.,!?~'"“”‘’:;]+/).filter(Boolean) }; }
  function buildDoc(r) {
    return { situation: field(r.situation), category: field(r.category), sheet: field(r.sheetLabel), script: field(r.script), note: field(r.note),
      models: (normalizeSearchText(r.situation).match(MODEL_RE) || []).map(compact),
      cho: cho(r.situation) + ' ' + cho(r.category), negated: negatedWords(r.situation).concat(negatedWords(r.category)) };
  }
  function termInField(f, term) {
    var n = compact(term); if (!n) return false;
    if (/^\d+$/.test(n)) return new RegExp('(^|[^0-9])' + n + '([^0-9]|$)').test(f.text);
    return f.compact.indexOf(n) >= 0;
  }
  function fuzzyWordHit(f, token) { if (token.length < 4 || /\d/.test(token)) return false; return f.words.some(function (w) { return editDistanceAtMostOne(w, token); }); }
  // 기종 이름 모양(글자 + 숫자): 폴드8 · 플립8 · s26 · 아이폰17 (25w · 1차처럼 숫자가 먼저인 건 아님)
  var MODEL_RE = /[a-z가-힣]+\d+[a-z]*/g;
  var FIELDS = [{ name: 'situation', weight: 96 }, { name: 'category', weight: 70 }, { name: 'sheet', weight: 55 }, { name: 'script', weight: 34 }, { name: 'note', weight: 14 }];

  function tokenCandidates(doc, token, ctx) {
    var c = [];
    if (isCho(token)) {
      if (doc.cho.replace(/\s/g, '').indexOf(token) >= 0 || doc.cho.split(' ').some(function (x) { return x.indexOf(token) >= 0; })) c.push({ token: token, term: token, kind: 'direct', field: 'situation', evidence: 'cho:' + token, value: 120, cho: true });
      return c;
    }
    // 기종 이름(플립8 · s26)이 분류 이름에만 있으면 아주 약하게: ‘신제품(폴드8, 플립8)’ 분류의 폴드8 멘트가 ‘플립8’에 위로 오지 않게
    var model = isModelOrSpecToken(token);
    tokenAlternatives(token, ctx).forEach(function (alt) {
      var needle = compact(alt.term);
      FIELDS.forEach(function (fi) {
        var f = doc[fi.name]; if (!termInField(f, alt.term)) return;
        if (model && (fi.name === 'category' || fi.name === 'sheet')) { c.push({ token: token, term: alt.term, kind: alt.kind, field: fi.name, evidence: needle, value: 4, weak: true }); return; }
        // 2026-10-22 큰 분류 이름(주문·배송·취소)에만 있는 말은 약하게: ‘배송 취소’에 취소와 상관없는 배송 멘트가 1등으로 오지 않게
        if (fi.name === 'sheet') { c.push({ token: token, term: alt.term, kind: alt.kind, field: fi.name, evidence: needle, value: 12, weak: true }); return; }
        var v = Math.round(fi.weight * alt.quality);
        if (f.compact === needle) v += fi.name === 'situation' ? 52 : 14;
        if (alt.kind === 'direct') v += 7;
        c.push({ token: token, term: alt.term, kind: alt.kind, field: fi.name, evidence: needle, value: v });
      });
    });
    if (!c.some(function (x) { return x.kind === 'direct'; })) {
      ['situation', 'category'].forEach(function (fn) { if (fuzzyWordHit(doc[fn], token)) c.push({ token: token, term: token, kind: 'fuzzy', field: fn, evidence: compact(token), value: fn === 'situation' ? 42 : 30 }); });
    }
    if (QWORDS.indexOf(token) >= 0) c.forEach(function (x) { x.value = Math.round(x.value * 0.4); });
    var ko = { direct: 3, synonym: 2, fuzzy: 1 };
    c.sort(function (a, b) { return b.value - a.value || ko[b.kind] - ko[a.kind]; });
    return c;
  }
  function phraseScore(doc, raw) {
    var q = compact(raw); if (!q) return { bonus: 0, field: '' };
    var best = { bonus: 0, field: '' };
    [{ f: 'situation', e: 360, c: 250 }, { f: 'category', e: 190, c: 130 }, { f: 'sheet', e: 120, c: 90 }, { f: 'script', e: 95, c: 76 }, { f: 'note', e: 32, c: 24 }].forEach(function (it) {
      var v = doc[it.f].compact; if (!v) return;
      var b = v === q ? it.e : (q.length >= 2 && v.indexOf(q) >= 0 ? it.c : 0);
      if (b > best.bonus) best = { bonus: b, field: it.f };
    });
    return best;
  }
  function scoreRecord(doc, tokens, raw, minimumOverride, ctx) {
    var plans = tokens.map(function (t, i) { var c = tokenCandidates(doc, t, ctx); return { token: t, index: i, candidates: c, hasDirect: c.some(function (x) { return x.kind === 'direct'; }) }; });
    plans.sort(function (a, b) { return Number(b.hasDirect) - Number(a.hasDirect) || (b.candidates[0] ? b.candidates[0].value : 0) - (a.candidates[0] ? a.candidates[0].value : 0) || a.index - b.index; });
    var used = new Set(), matches = [];
    plans.forEach(function (p) { for (var i = 0; i < p.candidates.length; i++) { var c = p.candidates[i]; if (used.has(c.evidence)) continue; used.add(c.evidence); c.index = p.index; matches.push(c); break; } });
    matches.sort(function (a, b) { return a.index - b.index; });
    // 약하게 맞은 것(분류 이름에만 있는 기종)은 ‘맞은 낱말 수’ 가산에서 뺌(목록에는 남음)
    var matched = matches.length, strong = matches.filter(function (m) { return !m.weak; }).length, total = tokens.length, coverage = total ? strong / total : 0, phrase = phraseScore(doc, raw);
    var minimum = minimumOverride || (total <= 1 ? 1 : Math.max(2, Math.ceil(total * 0.6)));
    if (matched < minimum && phrase.bonus < 130) return null;
    var score = matches.reduce(function (s, m) { return s + m.value; }, 0) + Math.round(coverage * 220) + strong * strong * 9 + (strong === total ? 110 : 0) + phrase.bonus;
    var q = compact(raw), head = doc.situation.compact + ' ' + doc.category.compact, withdraw = !!(ctx && ctx.withdraw);
    var inTitle = function (t) { return termInField(doc.situation, t) || (withdraw && t === '취소' && termInField(doc.situation, '철회')); };
    // 낱말이 모두 문안 제목에 있으면 조금 더 위로(본문에 붙어 있는 것보다)
    if (total >= 2 && tokens.every(function (t) { return !isCho(t) && QWORDS.indexOf(t) < 0 ? inTitle(t) : true; })) score += 90;
    if (total >= 2) matches.forEach(function (m) { if (!m.weak && ACTION.indexOf(m.token) >= 0 && (m.field === 'situation' || m.field === 'category')) score += 30; });
    if (REVERSE.some(function (w) {
      if (head.indexOf(w) < 0 || q.indexOf(w) >= 0) return false;
      if (w === '철회' && withdraw) return false;
      if (NOT_WORDS.indexOf(w) >= 0) return doc.negated.some(function (n) { return q.indexOf(n) >= 0; });
      return true;
    })) score -= 320;
    // 다른 기종 멘트: ‘플립8’을 찾는데 제목이 ‘폴드8 …’(또는 ‘폴드 …’만)이면 아래로 — 본문에 ‘폴드8·플립8’이 함께 적혀 있어도
    if (ctx && ctx.models && ctx.models.length && ctx.models.some(function (m) {
      if (termInField(doc.situation, m.m) || (m.fam && termInField(doc.situation, m.fam))) return false;
      return doc.models.some(function (x) { return x !== m.m; }) || (ctx.families || []).some(function (g) { return g !== m.fam && termInField(doc.situation, g); });
    })) score -= 480;
    return { score: score, coverage: coverage, matched: matched, total: total, matches: matches };
  }

  /* records: [{ id, situation, category, sheetLabel, script, note }] */
  function createIndex(records) {
    var docs = new Map();
    records.forEach(function (r) { docs.set(r.id, buildDoc(r)); });
    // 이 문안 묶음에 나오는 기종 줄기(폴드8 · 플립8 → 폴드 · 플립)
    var families = []; records.forEach(function (r) { (normalizeSearchText(r.situation + ' ' + r.category).match(/[가-힣]{2,}(?=\d)/g) || []).forEach(function (f) { if (families.indexOf(f) < 0) families.push(f); }); });
    function search(query, opts) {
      opts = opts || {};
      var tokens = tokenize(query), out = { list: [], meta: new Map(), loose: false, tokens: tokens };
      if (!String(query || '').trim() || !tokens.length) return out;
      var ctx = { withdraw: tokens.indexOf('취소') >= 0 && WITHDRAW_OF.some(function (w) { return tokens.indexOf(w) >= 0; }), families: families,
        models: tokens.filter(function (t) { return /^[a-z가-힣]+\d+[a-z]*$/.test(t); }).map(function (t) { var f = /^([가-힣]{2,})\d/.exec(t); return { m: t, fam: f ? f[1] : '' }; }) };
      // 점수가 같으면 opts.rank(id)가 큰 것(이 PC에서 많이 담은 멘트) 먼저 — 점수가 다르면 안 건드림
      var rank = typeof opts.rank === 'function' ? opts.rank : function () { return 0; };
      var run = function (minimum) {
        var scored = [];
        records.forEach(function (r, i) { var res = scoreRecord(docs.get(r.id), tokens, query, minimum, ctx); if (res) scored.push({ r: r, res: res, i: i, u: Number(rank(r.id)) || 0 }); });
        scored.sort(function (a, b) { return b.res.score - a.res.score || b.u - a.u || b.res.coverage - a.res.coverage || b.res.matched - a.res.matched || a.i - b.i; });
        return scored;
      };
      var s = run(0);
      // 고객 문장 그대로: 꼭 맞는 것이 없으면 한 낱말이라도 맞는 것 중 많이 맞는 순
      if (!s.length && tokens.length >= 2) { s = run(1); out.loose = s.length > 0; }
      s.slice(0, opts.limit || 200).forEach(function (x) { out.list.push(x.r); out.meta.set(x.r.id, x.res); });
      return out;
    }
    function termsFor(id, query, meta) {
      var terms = tokenize(query).filter(function (t) { return !isCho(t); }), m = meta && meta.get(id);
      if (m) m.matches.forEach(function (x) { if (!x.cho) terms.push(x.term); });
      var seen = new Set();
      return terms.filter(function (t) { var k = compact(t); if (!k || seen.has(k)) return false; seen.add(k); return true; })
        .sort(function (a, b) { return compact(b).length - compact(a).length; }).slice(0, 20);
    }
    return { search: search, termsFor: termsFor };
  }
  /* 강조: 글자 사이 띄어쓰기·기호가 있어도 찾음. [시작, 끝] 구간 목록을 돌려줌(화면은 textContent로 그림) */
  function ranges(text, terms) {
    var out = [], s = str(text);
    if (!terms || !terms.length) return out;
    var pats = terms.map(function (t) {
      var chars = compact(t).split('').map(function (c) { return c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
      return chars.length ? chars.join('[\\s·\\-_/]*') : '';
    }).filter(Boolean);
    if (!pats.length) return out;
    var re; try { re = new RegExp('(' + pats.join('|') + ')', 'gi'); } catch (e) { return out; }
    var m; while ((m = re.exec(s))) { if (!m[0]) { re.lastIndex++; continue; } out.push([m.index, m.index + m[0].length]); }
    return out;
  }
  function splitParagraphs(t) { return str(t).split(/\n{2,}/).map(function (p) { return p.trim(); }).filter(Boolean); }
  function commonOpening(records) {
    var counts = new Map();
    records.forEach(function (r) { var f = splitParagraphs(r.script)[0]; if (!f || f.length < 6 || f.length > 140) return; counts.set(f, (counts.get(f) || 0) + 1); });
    var best = '', n = 0; counts.forEach(function (c, t) { if (c > n) { n = c; best = t; } });
    return n >= 3 && n >= records.length * 0.15 ? best : '';
  }
  /* 미리보기: 검색 중이면 맞은 곳 근처, 아니면 공통 인사말을 건너뛴 본문 */
  function preview(record, terms, opening) {
    var paras = splitParagraphs(record.script);
    if (!paras.length) return '';
    if (terms && terms.length) {
      var src = str(record.script), rs = ranges(src, terms);
      if (rs.length) {
        var best = rs[0], bs = -1;
        rs.forEach(function (c) { var sc = 0; rs.forEach(function (o) { if (Math.abs(o[0] - c[0]) <= 180) sc++; }); if (sc > bs) { bs = sc; best = c; } });
        var start = Math.max(0, best[0] - 60), end = Math.min(src.length, start + 220);
        if (start > 0) { var sp = src.lastIndexOf(' ', best[0]); if (sp > start && sp < best[0]) start = sp + 1; }
        return (start > 0 ? '… ' : '') + src.slice(start, end).replace(/\s+/g, ' ').trim() + (end < src.length ? ' …' : '');
      }
    }
    if (opening && paras.length > 1 && paras[0] === opening) return paras.slice(1).join('  ');
    return paras.join('  ');
  }

  /* 문의 검색 · 불량가이드(요청시트 줄): 스크립트 검색과 같은 말끝·비슷한 말 규칙(‘충전 안 돼요’ ≈ ‘충전 안됨’)
     rows: 줄 목록 · hayOf(r): 찾을 글(소문자) · skuOf(r): 제품코드. r.hayC(띄어쓰기 뺀 글) · r.hayCho(초성)가 있으면 씀
     모든 낱말이 맞는 줄이 없으면 많이 맞는 순(loose) — 이때도 숫자가 든 기종·제품코드 낱말(S26 · ACS1234)은 꼭 맞아야 함(다른 기종 답변이 섞이지 않게) */
  function squashRaw(v) { return str(v).replace(/[\s·\-_/()[\]{}.,!?~'"“”‘’:;]+/g, ''); }
  function isSku(v) { v = str(v).trim(); return /^[A-Za-z][A-Za-z0-9-]{4,}$/.test(v) && /\d/.test(v); }
  function searchRows(rows, qq, hayOf, skuOf) {
    var raw = str(qq).trim(), sku = isSku(raw) ? raw.toUpperCase() : '';
    var toks = raw ? tokenize(raw).slice(0, 8) : [];
    if (!toks.length) return { rows: rows, toks: [], loose: false, missing: [] };
    var plans = toks.map(function (t) {
      var model = isModelOrSpecToken(t), alts = isCho(t) || model ? [] : tokenAlternatives(t).slice(1).map(function (a) { return a.term; });
      return { t: t, sq: squashRaw(t), model: model, cho: isCho(t), alts: alts.map(function (a) { return { a: normalizeSearchText(a), sq: squashRaw(normalizeSearchText(a)) }; }) };
    });
    var has = function (hay, hc, term, sq) { return hay.indexOf(term) >= 0 || (sq.length >= 2 && hc.indexOf(sq) >= 0); };
    var strict = [], loose = [], dropped = 0;
    rows.forEach(function (r) {
      var hay = hayOf(r), hc = r.hayC != null ? r.hayC : squashRaw(hay), code = str(skuOf(r)), lc = code.toLowerCase(), hits = 0, sc = 0, mustOk = true;
      plans.forEach(function (p) {
        var direct = p.cho ? str(r.hayCho).indexOf(p.t) >= 0 : has(hay, hc, p.t, p.sq);
        var syn = !direct && p.alts.some(function (x) { return has(hay, hc, x.a, x.sq); });
        if (direct) { hits++; sc += lc.indexOf(p.t) >= 0 ? 8 : 1; } else if (syn) { hits++; sc += 0.7; } else if (p.model) mustOk = false;
      });
      if (sku && code.toUpperCase() === sku) sc += 100; else if (sku && code.toUpperCase().indexOf(sku) === 0) sc += 60;
      var all = hits === plans.length || (sku && code.toUpperCase().indexOf(sku) === 0);
      if (all) strict.push({ r: r, sc: sc + (r.k || 0) / 1e9 });
      else if (hits && mustOk) loose.push({ r: r, sc: hits * 10 + sc + (r.k || 0) / 1e9 });
      else if (hits) dropped++;
    });
    var use = strict.length ? strict : loose; use.sort(function (a, b) { return b.sc - a.sc; });
    var hl = []; plans.forEach(function (p) { if (!p.cho) hl.push(p.t); p.alts.forEach(function (x) { if (hl.indexOf(x.a) < 0) hl.push(x.a); }); });
    // missing: 일부만 맞는 줄은 있었지만 기종·제품코드 낱말이 없어서 뺀 경우 그 낱말들
    var missing = !strict.length && !loose.length && dropped ? plans.filter(function (p) { return p.model; }).map(function (p) { return p.t; }) : [];
    return { rows: use.map(function (x) { return x.r; }), toks: hl, loose: !strict.length && loose.length > 0, missing: missing };
  }

  var api = { searchRows: searchRows, isSku: isSku, tokenize: tokenize, normalizeToken: normalizeToken, alternatives: function (t) { return tokenAlternatives(t).map(function (a) { return a.term; }); }, isModelToken: isModelOrSpecToken, compact: compact, cho: cho, isCho: isCho, createIndex: createIndex, ranges: ranges,
    preview: preview, commonOpening: commonOpening, splitParagraphs: splitParagraphs, SYNONYMS: SYNONYMS, SEED_TERMS: SEED_TERMS };
  root.KBSearch = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
