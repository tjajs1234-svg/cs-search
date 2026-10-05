/* 문안 검색 — 예전 검색기(v6)의 검색 규칙을 그대로 옮기고 세 가지를 더함
   1) 초성 검색: ㄱㅎㅊㅎ → ‘교환 철회’ (제목·대분류의 첫소리)
   2) 고객 문장을 그대로 붙여 넣어도 0건으로 끝나지 않게: 꼭 맞는 문안이 없으면 낱말이 많이 맞는 순(가까운 문안)
   3) 말끝 정리 확대: ‘신청했는데’ → ‘신청’, ‘와요’ 같은 말끝은 버림
   분류를 골라 둬도 검색은 늘 전체에서(가산점도 없음). 화면 코드와 시험이 같이 씀 */
(function (root) {
  'use strict';
  var STOP_WORDS = ['고객', '문의', '제품', '관련', '사용', '사용중', '지금', '갑자기', '계속', '자꾸', '너무', '그냥',
    '조금', '정도', '해주세요', '있어요', '같아요', '했는데', '하는데', '됩니다', '되나요', '입니다', '그리고',
    '오늘', '어제', '구매', '이거', '저거', '현재', '경우', '부분', '현상', '증상', '안녕하세요', '혹시', '부탁', '드립니다', '감사합니다'];
  var SEED_TERMS = ['충전', '필름', '케이스', '지문', '배송', '반품', '교환', '재입고', '단종', '발열', '호환', '셀카봉',
    '허브', '맥세이프', '그립톡', '리모컨', '어댑터', '케이블', '취소', '환불', '전화', '통화', '파손', '유격',
    '폴드', '플립', '아라미드', '강화유리', '옵틱프로', '힌지', '블루투스', '키보드', '마우스'];
  var SYNONYMS = [
    { keys: ['안됨', '안돼', '안되', '작동안됨', '동작안됨'], terms: ['안됨', '안 되', '되지', '작동하지', '동작하지', '인식되지'] },
    { keys: ['끊김', '끊겨', '왔다갔다', '간헐', '반복충전'], terms: ['끊김', '끊기', '중단', '반복', '재연결', '간헐', '됐다가'] },
    { keys: ['느림', '느려', '저속'], terms: ['느림', '느리', '속도', '저속'] },
    { keys: ['뜨거움', '뜨거워', '발열'], terms: ['발열', '뜨거', '열이', '온도'] },
    { keys: ['들뜸', '떠요', '벌어짐'], terms: ['들뜸', '뜨는', '벌어짐', '기포', '밀착'] },
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
    { keys: ['깨짐', '깨져', '금감', '금이'], terms: ['파손', '깨짐', '균열', '스크래치'] }
  ];
  var CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';

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
  var ENDINGS = /(했는데요|했는데|했어요|했나요|했습니다|하는데|하나요|할게요|인가요|되나요|됐어요|됐는데|돼요|되요|와요|해요|어요|아요|나요|는데|은데|으로는|에서는|으로|에서|에게|까지|부터|처럼|보다|이랑|하고|이며|인데|은|는|이|가|을|를|에|도|만)$/u;
  function normalizeToken(token) {
    var v = normalizeSearchText(token).trim().replace(/^[^0-9a-z가-힣ㄱ-ㅎ]+|[^0-9a-z가-힣ㄱ-ㅎ]+$/g, '');
    if (isCho(v)) return v;
    if (v.length > 2 && !/\d/.test(v)) { var s = v.replace(ENDINGS, ''); if (s.length >= 2) v = s; }
    return v;
  }
  function preprocessQuery(q) {
    return normalizeSearchText(q)
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
      if (/^(와요|해요|어요|아요|나요|줘요|봐요|가요|돼요|되요)$/.test(t)) return;
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
  function tokenAlternatives(token) {
    var out = [{ term: token, kind: 'direct', quality: 1 }], seen = new Set([compact(token)]), g = synonymGroupFor(token);
    if (g) g.terms.forEach(function (t) { var k = compact(t); if (!k || seen.has(k)) return; seen.add(k); out.push({ term: t, kind: 'synonym', quality: 0.74 }); });
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
      cho: cho(r.situation) + ' ' + cho(r.category) };
  }
  function termInField(f, term) {
    var n = compact(term); if (!n) return false;
    if (/^\d+$/.test(n)) return new RegExp('(^|[^0-9])' + n + '([^0-9]|$)').test(f.text);
    return f.compact.indexOf(n) >= 0;
  }
  function fuzzyWordHit(f, token) { if (token.length < 4 || /\d/.test(token)) return false; return f.words.some(function (w) { return editDistanceAtMostOne(w, token); }); }
  var FIELDS = [{ name: 'situation', weight: 96 }, { name: 'category', weight: 70 }, { name: 'sheet', weight: 55 }, { name: 'script', weight: 34 }, { name: 'note', weight: 14 }];

  function tokenCandidates(doc, token) {
    var c = [];
    if (isCho(token)) {
      if (doc.cho.replace(/\s/g, '').indexOf(token) >= 0 || doc.cho.split(' ').some(function (x) { return x.indexOf(token) >= 0; })) c.push({ token: token, term: token, kind: 'direct', field: 'situation', evidence: 'cho:' + token, value: 120, cho: true });
      return c;
    }
    tokenAlternatives(token).forEach(function (alt) {
      var needle = compact(alt.term);
      FIELDS.forEach(function (fi) {
        var f = doc[fi.name]; if (!termInField(f, alt.term)) return;
        var v = Math.round(fi.weight * alt.quality);
        if (f.compact === needle) v += fi.name === 'situation' ? 52 : 14;
        if (alt.kind === 'direct') v += 7;
        c.push({ token: token, term: alt.term, kind: alt.kind, field: fi.name, evidence: needle, value: v });
      });
    });
    if (!c.some(function (x) { return x.kind === 'direct'; })) {
      ['situation', 'category'].forEach(function (fn) { if (fuzzyWordHit(doc[fn], token)) c.push({ token: token, term: token, kind: 'fuzzy', field: fn, evidence: compact(token), value: fn === 'situation' ? 42 : 30 }); });
    }
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
  function scoreRecord(doc, tokens, raw, minimumOverride) {
    var plans = tokens.map(function (t, i) { var c = tokenCandidates(doc, t); return { token: t, index: i, candidates: c, hasDirect: c.some(function (x) { return x.kind === 'direct'; }) }; });
    plans.sort(function (a, b) { return Number(b.hasDirect) - Number(a.hasDirect) || (b.candidates[0] ? b.candidates[0].value : 0) - (a.candidates[0] ? a.candidates[0].value : 0) || a.index - b.index; });
    var used = new Set(), matches = [];
    plans.forEach(function (p) { for (var i = 0; i < p.candidates.length; i++) { var c = p.candidates[i]; if (used.has(c.evidence)) continue; used.add(c.evidence); c.index = p.index; matches.push(c); break; } });
    matches.sort(function (a, b) { return a.index - b.index; });
    var matched = matches.length, total = tokens.length, coverage = total ? matched / total : 0, phrase = phraseScore(doc, raw);
    var minimum = minimumOverride || (total <= 1 ? 1 : Math.max(2, Math.ceil(total * 0.6)));
    if (matched < minimum && phrase.bonus < 130) return null;
    var score = matches.reduce(function (s, m) { return s + m.value; }, 0) + Math.round(coverage * 220) + matched * matched * 9 + (matched === total ? 110 : 0) + phrase.bonus;
    return { score: score, coverage: coverage, matched: matched, total: total, matches: matches };
  }

  /* records: [{ id, situation, category, sheetLabel, script, note }] */
  function createIndex(records) {
    var docs = new Map();
    records.forEach(function (r) { docs.set(r.id, buildDoc(r)); });
    function search(query, opts) {
      opts = opts || {};
      var tokens = tokenize(query), out = { list: [], meta: new Map(), loose: false, tokens: tokens };
      if (!String(query || '').trim() || !tokens.length) return out;
      var run = function (minimum) {
        var scored = [];
        records.forEach(function (r, i) { var res = scoreRecord(docs.get(r.id), tokens, query, minimum); if (res) scored.push({ r: r, res: res, i: i }); });
        scored.sort(function (a, b) { return b.res.score - a.res.score || b.res.coverage - a.res.coverage || b.res.matched - a.res.matched || a.i - b.i; });
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

  var api = { tokenize: tokenize, normalizeToken: normalizeToken, compact: compact, cho: cho, isCho: isCho, createIndex: createIndex, ranges: ranges,
    preview: preview, commonOpening: commonOpening, splitParagraphs: splitParagraphs, SYNONYMS: SYNONYMS, SEED_TERMS: SEED_TERMS };
  root.KBSearch = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
