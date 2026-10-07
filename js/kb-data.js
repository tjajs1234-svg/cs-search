/* 상담 스크립트 검색기 — 문안 자료 다루기(검색 화면 · 멘트 관리 · 백그라운드 · 시험이 같이 씀)
   자료 모양(멘트): { version, config:{appTitle,serviceUrl,processingGuide,announcement}, closings:[{id,title,body}],
                     categories:[{id,name,cards:[{id,group,title,script,note}]}] }
   깃허브 파일 하나(cs-content.json): { format:'cs-content-1', scripts:{…멘트}, notices:[…], sources:{…}, updatedAt } */
(function (root) {
  'use strict';
  var T_CHANNEL = '[인입 채널별 접수 경로]';
  var T_FOLLOW = '[접수 후 처리 안내]';
  var DEFAULT_CONFIG = {
    appTitle: '상담 스크립트 검색기',
    serviceUrl: 'https://as.apps.spigen.com/',
    processingGuide: '신청해 주시면 담당자가 접수 순서대로 내용을 확인한 뒤, 처리 결과를 문자로 안내해 드릴 예정입니다.\n\n접수량에 따라 문자 안내까지 영업일 기준 1~2일 정도 소요될 수 있는 점 양해 부탁드립니다. 기다리시는 시간을 줄일 수 있도록 최대한 빠르게 살펴보겠습니다.',
    announcement: ''
  };
  var FILE_FORMAT = 'cs-content-1';
  var CODE_PREFIX = 'CS연결-';

  function str(v) { return v == null ? '' : String(v); }
  function clean(v) { return str(v).replace(/\s+/g, ' ').trim(); }
  function cleanMulti(v) {
    return str(v).replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  /* 공통 문구: 멘트 안의 {이름} 자리에 관리자가 한 곳에 적어 둔 글(계좌번호·매장 안내 등)이 들어감 */
  var PHRASE = /\{([^{}\n]{1,20})\}/g;
  function phraseKey(v) { return clean(v).replace(/[{}]/g, '').slice(0, 20); }
  function phrasesOf(c) {
    var seen = {};
    return (Array.isArray(c && c.phrases) ? c.phrases : []).map(function (p) { return p && { key: phraseKey(p.key), text: cleanMulti(p.text) }; })
      .filter(function (p) { if (!p || !p.key || !p.text || seen[p.key]) return false; seen[p.key] = 1; return true; }).slice(0, 100);
  }
  /* 끝나는 날(YYYY-MM-DD)이 지난 멘트는 상담사 화면에서 숨김(한국 시간 기준, 그날까지는 보임) */
  function todayKey(ms) { return new Date((ms || Date.now()) + 9 * 3600e3).toISOString().slice(0, 10); }
  function expired(card, ms) { var u = clean(card && card.until); return /^\d{4}-\d{2}-\d{2}$/.test(u) && u < todayKey(ms); }
  function configOf(sc) {
    var c = (sc && sc.config && typeof sc.config === 'object') ? sc.config : {};
    return {
      appTitle: clean(c.appTitle) || DEFAULT_CONFIG.appTitle,
      serviceUrl: clean(c.serviceUrl) || DEFAULT_CONFIG.serviceUrl,
      processingGuide: cleanMulti(c.processingGuide) || DEFAULT_CONFIG.processingGuide,
      announcement: cleanMulti(c.announcement),
      phrases: phrasesOf(c)
    };
  }
  /* 예전 검색기(Code.gs expandCommonText_)와 같은 바꾸기. 값이 비어도 멈추지 않고 기본값으로 */
  function expand(text, cfg) {
    var value = cleanMulti(text);
    cfg = cfg || DEFAULT_CONFIG;
    if (value.indexOf(T_CHANNEL) >= 0) {
      value = value.split(T_CHANNEL).join('신청 링크:\n' + (cfg.serviceUrl || DEFAULT_CONFIG.serviceUrl))
        .replace(/신청\s*(?:링크|경로)\s*:\s*\n+\s*(신청\s*(?:링크|경로)\s*:)/g, '$1');
    }
    if (value.indexOf(T_FOLLOW) >= 0) value = value.split(T_FOLLOW).join(cfg.processingGuide || DEFAULT_CONFIG.processingGuide);
    var ph = cfg.phrases || [];
    if (ph.length && value.indexOf('{') >= 0) value = value.replace(PHRASE, function (all, key) { var k = phraseKey(key); for (var i = 0; i < ph.length; i++) if (ph[i].key === k) return ph[i].text; return all; });
    return value;
  }
  function hash(s) {
    var h = 0x811c9dc5; s = str(s);
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  function stamp(ms) {
    var d = new Date((ms || Date.now()) + 9 * 3600e3);
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ':' + p(d.getUTCSeconds());
  }
  /* 멘트 자료가 쓸 만한지(빈 파일·망가진 파일로 상담사 화면이 비지 않게) */
  function validScripts(sc) {
    if (!sc || typeof sc !== 'object' || !Array.isArray(sc.categories)) return false;
    var n = 0;
    for (var i = 0; i < sc.categories.length; i++) {
      var c = sc.categories[i];
      if (!c || !c.id || !Array.isArray(c.cards)) return false;
      for (var j = 0; j < c.cards.length; j++) { var k = c.cards[j]; if (!k || !k.id) return false; n++; }
    }
    return n > 0;
  }
  function count(sc) { var n = 0; (sc && sc.categories || []).forEach(function (c) { n += (c.cards || []).length; }); return n; }

  /* 예전 검색기 화면(getAppData)과 같은 모양으로 바꿈 → 화면 코드를 거의 그대로 씀 */
  function toPayload(sc, meta) {
    meta = meta || {};
    var cfg = configOf(sc), records = [], sheets = [];
    (sc.categories || []).forEach(function (c, ci) {
      var name = clean(c.name) || '분류 ' + (ci + 1);
      (c.cards || []).forEach(function (k, ki) {
        if (expired(k, meta.now)) return;
        var title = clean(k.title), group = clean(k.group), script = expand(k.script, cfg), note = cleanMulti(k.note);
        if (!title && !group && !script && !note) return;
        if (sheets.indexOf(c.id) < 0) sheets.push(c.id);
        records.push({ id: str(k.id), source: 'official', sheet: str(c.id), sheetLabel: name, category: group || name,
          situation: title || group || '(제목 없음)', script: script, note: note, rowNumber: ki + 2 });
      });
    });
    var closings = (sc.closings || []).map(function (x, i) {
      var t = clean(x && x.title), b = expand(x && x.body, cfg);
      return t && b ? { id: str(x.id) || 'shared_closing_' + (i + 2), title: t, body: b, source: 'shared' } : null;
    }).filter(Boolean);
    var rev = hash(records.map(function (r) { return [r.id, r.sheet, r.sheetLabel, r.category, r.situation, r.script, r.note].join('|'); })
      .concat(closings.map(function (x) { return x.id + '|' + x.title + '|' + x.body; })).join('\n'));
    return {
      ok: true, schemaVersion: 2, appVersion: meta.appVersion || '', spreadsheetName: cfg.appTitle,
      loadedAt: stamp(meta.at), revision: rev, recordCount: records.length, sheetCount: sheets.length, sheets: sheets,
      records: records, sharedClosings: closings, source: meta.source || 'bundled', scriptsVersion: Number(sc.version) || 0,
      config: { appTitle: cfg.appTitle, announcement: cfg.announcement, processingTime: cfg.processingGuide, serviceUrl: cfg.serviceUrl,
        servicePath: '신청 링크:\n' + cfg.serviceUrl, channelToken: T_CHANNEL, followupToken: T_FOLLOW }
    };
  }

  /* 깃허브 파일 하나 → 정리된 내용(망가진 칸은 버림) */
  function parseContent(obj) {
    if (!obj || typeof obj !== 'object') throw new Error('파일 모양이 달라요');
    var sc = obj.format === FILE_FORMAT ? obj.scripts : (Array.isArray(obj.categories) ? obj : null);
    var out = { scripts: validScripts(sc) ? sc : null, notices: [], sources: { requests: [], defects: null, notice: null } };
    if (obj.format === FILE_FORMAT) {
      out.notices = (Array.isArray(obj.notices) ? obj.notices : []).filter(function (n) { return n && n.id && (clean(n.title) || clean(n.body)); }).slice(0, 200)
        .map(function (n) { return { id: str(n.id), title: clean(n.title).slice(0, 120), body: cleanMulti(n.body).slice(0, 20000), at: Number(n.at) || 0, by: clean(n.by).slice(0, 30), pin: !!n.pin, important: !!n.important }; });
      var s = obj.sources && typeof obj.sources === 'object' ? obj.sources : {};
      out.sources.requests = (Array.isArray(s.requests) ? s.requests : []).map(function (x) { return x && sheetRef(x.url) ? { url: str(x.url).trim(), label: clean(x.label).slice(0, 40) } : null; }).filter(Boolean).slice(0, 10);
      out.sources.defects = s.defects && sheetRef(s.defects.url) ? { url: str(s.defects.url).trim(), label: clean(s.defects.label).slice(0, 40) } : null;
      out.sources.notice = s.notice && sheetRef(s.notice.url) ? { url: str(s.notice.url).trim(), label: clean(s.notice.label).slice(0, 40) } : null;
      // 팀 서버(요청·건의 · 사용 통계 · 팀 현황) 주소: 앱스크립트 웹 앱 주소만
      if (s.team && /^https:\/\/script\.google\.com\/macros\/s\/[\w-]{20,}\/exec$/.test(str(s.team.url).trim())) out.sources.team = { url: str(s.team.url).trim() };
      out.updatedAt = Number(obj.updatedAt) || 0;
    }
    return out;
  }
  function buildFile(parts) {
    return { format: FILE_FORMAT, updatedAt: Date.now(), scripts: parts.scripts, notices: parts.notices || [], sources: parts.sources || { requests: [], defects: null, notice: null } };
  }

  /* 구글 시트 주소 → { id, gid } (탭을 연 채로 복사한 주소면 #gid= 가 붙어 있음) */
  function sheetRef(url) {
    var m = /\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/.exec(str(url));
    if (!m) return null;
    var g = /[#&?]gid=(\d+)/.exec(str(url));
    return { id: m[1], gid: g ? g[1] : '' };
  }

  /* 상담사용 연결 코드: 저장소 위치 + 읽기 전용 키를 한 줄로 묶음(암호가 아님 — 사내 메신저로만 전달) */
  function b64e(s) { var u = new TextEncoder().encode(s), b = ''; for (var i = 0; i < u.length; i++) b += String.fromCharCode(u[i]); return btoa(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function b64d(s) { s = str(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new TextDecoder().decode(u); }
  function makeCode(c) { return CODE_PREFIX + b64e(JSON.stringify({ v: 1, o: c.owner, r: c.repo, b: c.branch || '', p: c.path || '', t: c.token })); }
  function readCode(text) {
    var s = str(text).replace(/\s+/g, '');
    var i = s.indexOf(CODE_PREFIX); if (i < 0) return null;
    try {
      var o = JSON.parse(b64d(s.slice(i + CODE_PREFIX.length)));
      if (!o || o.v !== 1 || !/^[A-Za-z0-9-]{1,39}$/.test(o.o || '') || !/^[A-Za-z0-9._-]{1,100}$/.test(o.r || '') || !o.t) return null;
      return { owner: o.o, repo: o.r, branch: str(o.b), path: str(o.p) || 'cs-content.json', token: str(o.t) };
    } catch (e) { return null; }
  }
  /* 저장소 주소(https://github.com/아이디/저장소) → owner/repo */
  function repoRef(text) {
    var s = str(text).trim().replace(/\/+$/, '').replace(/\.git$/, '');
    var m = /github\.com[/:]([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100})/.exec(s) || /^([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100})$/.exec(s);
    return m ? { owner: m[1], repo: m[2] } : null;
  }

  var api = { T_CHANNEL: T_CHANNEL, T_FOLLOW: T_FOLLOW, DEFAULT_CONFIG: DEFAULT_CONFIG, FILE_FORMAT: FILE_FORMAT,
    clean: clean, cleanMulti: cleanMulti, configOf: configOf, expand: expand, hash: hash, stamp: stamp, validScripts: validScripts, count: count,
    toPayload: toPayload, parseContent: parseContent, buildFile: buildFile, sheetRef: sheetRef, makeCode: makeCode, readCode: readCode, repoRef: repoRef,
    b64e: b64e, b64d: b64d, phrasesOf: phrasesOf, phraseKey: phraseKey, todayKey: todayKey, expired: expired, PHRASE: PHRASE };
  root.KBData = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
