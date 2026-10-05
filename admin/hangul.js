/* 3.4.11: 한글 검색 도우미
   - 초성 검색: ㄱㅎㅈㅅ → ‘교환 접수 안내’, ㄱㅅㅂ → ‘김수빈’
   - 치는 중인 글자도 찾기: 한글 입력기로 ‘교환’을 치는 동안 칸에는 ‘교ㅎ’ → ‘교화’ → ‘교환’이 차례로 들어가는데,
     예전에는 그 사이 ‘찾는 멘트가 없어요’가 깜빡였음. 마지막 글자가 아직 조합 중이면 그 글자로 시작할 수 있는 모든 글자로 봄
     (교ㅎ = 교하~교힣, 교화 = 교화~교홯).
   생각은 toss/es-hangul(MIT · getChoseong, 자모 분해)에서 가져왔고, 이 앱에 필요한 부분만 작게 새로 씀(외부 파일·설치 없음). */
(function (root) {
  'use strict';
  const BASE = 0xAC00, LAST = 0xD7A3, CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  const isSyl = c => { const x = c.charCodeAt(0); return x >= BASE && x <= LAST; };
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  /* 초성만 뽑기(띄어쓰기는 뺌): ‘교환 접수’ → ‘ㄱㅎㅈㅅ’. 한글이 아닌 글자는 소문자로 그대로 */
  function cho(s) {
    let o = '';
    for (const ch of String(s || '')) {
      if (isSyl(ch)) o += CHO[Math.floor((ch.charCodeAt(0) - BASE) / 588)];
      else if (!/\s/.test(ch)) o += ch.toLowerCase();
    }
    return o;
  }
  /* 초성만으로 된 검색어인지(두 글자 이상, 예: ㄱㅎ) */
  const isCho = t => /^[ㄱ-ㅎ]{2,}$/.test(String(t || ''));
  /* 마지막 글자가 조합 중일 때 받아 줄 글자 모임(정규식 [ ]) — 없으면 '' */
  function lastClass(t) {
    const ch = String(t || '').slice(-1); if (!ch) return '';
    const i = CHO.indexOf(ch);
    if (i >= 0) { const a = BASE + i * 588; return '[' + ch + String.fromCharCode(a) + '-' + String.fromCharCode(a + 587) + ']'; }
    if (isSyl(ch) && (ch.charCodeAt(0) - BASE) % 28 === 0) { const a = ch.charCodeAt(0); return '[' + ch + '-' + String.fromCharCode(a + 27) + ']'; }
    return '';
  }
  /* 검색어 한 낱말의 검사기. partial = 이 낱말의 마지막 글자가 아직 조합 중(입력기 composition 중인 마지막 낱말)
     test(글) → 들어 있는지 · choOnly = 초성 검색어(따로 준비한 초성 글에서 찾음) */
  function tester(t, o) {
    t = String(t || '');
    let re = null;
    if (o && o.partial && t) { const c = lastClass(t); if (c) re = new RegExp(esc(t.slice(0, -1)) + c); }
    return { t, choOnly: isCho(t), partial: !!re, test: s => (re ? re.test(String(s || '')) : String(s || '').includes(t)) };
  }
  const api = { cho, isCho, lastClass, tester };
  root.DeskHangul = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
