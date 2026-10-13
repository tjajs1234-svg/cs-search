/* 슈피겐 CS 팀 서버 (Apps Script) — 기록 서버와 따로 둔 작은 서버
   · 요청·건의 게시판 · 멘트 사용 통계 · 팀 현황(상담사별 기다림 숫자)
   · 구글 시트를 쓰지 않아요. 자료는 이 스크립트를 만든 계정의 드라이브 폴더 ‘슈피겐CS 팀서버 자료’에 JSON 파일로 남아요.
   · 문의기록 시트·기록 서버(Code.gs 1.1.0)와는 아무 상관이 없어요.
   · 1.1.0: 팀장 보기 맞추기 — 상담사 기록기가 '내 상담 상태'(상담 번호 · 마지막 메시지 번호 · 대기 시작 · 보류 여부)를 보내고,
            팀장 기록기가 받아서 보류·우선 응대·답함을 상담사 화면과 똑같이 보여 줌. 고객 이름·대화 내용은 받지 않음
   · 1.2.0: 상담사별 일·주·월 집계 — 하루 합계를 13개월(400일) 보관(멘트 사용 통계는 그대로 62일)
            상담사 이름을 성 뺀 이름 하나로 통일(카톡 영원3 → 영원 · 톡톡 김영원 → 영원). 예전 기록기가 보낸 이름도 여기서 맞춤
   · 1.3.0: 업무시간 기준 대기(공휴일·비수기 설정을 기록기에 내려 줌) · 근무 달력(명단 · 야근 신청/승인) · 확인할 상담(기록 빠짐 · 20분 넘김 · 오래된 상담)
            · 기록 시각(시간대별 건수·텀)·게시판 사이트별 건수 · 공지 확인 · 요청·건의는 댓글로만(나도 필요해요·상태 없음)
   · 1.3.1: 야근은 퇴근 시각만(17:00부터 · 정시 19:00 뒤가 야근) · 같은 날 다시 적으면 고침 · 팀장 [확인함]
   · 1.3.2: 상담사 명단에 성까지(김수빈) 적으면 달력·목록이 성 포함 이름 가나다순
   · 1.3.3: 빠르게(드라이브 파일 번호·내용 캐시) · 근무 탭은 한 번에 받음(work.get)
   고치기(이미 배포한 뒤): 이 글 전체로 바꿔 붙여 넣기 → 저장 → 배포 → 배포 관리 → 연필(수정) → 버전: 새 버전 → 배포(주소 그대로)
   설치: script.google.com → 새 프로젝트 → 이 글 전체를 붙여 넣기 → 저장 → 배포 → 새 배포 → 웹 앱
        (실행: 나 · 액세스: 모든 사용자) → 나온 주소를 멘트 관리 ‘팀 서버 연결’에 붙여 넣기 */
var TEAM_VERSION = '1.3.3';
var TEAM_TOKEN = '1234';                        // 확장·검색기와 맞춘 값
var CONTENT_REPO = 'tjajs1234-svg/cs-content';  // 관리자 확인: 이 저장소에 쓰기 열쇠가 있는 사람만 관리자
var FOLDER_NAME = '슈피겐CS 팀서버 자료';
var KEEP_DAYS = 62, TEAM_KEEP_DAYS = 400, MAX_POSTS = 400, MAX_TEXT = 4000;
var STATUSES = ['접수', '진행 중', '완료', '보류'];

function doGet(e) { return out_({ ok: true, app: 'cs-team', version: TEAM_VERSION }); }
function doPost(e) {
  var req = {};
  try { req = JSON.parse(e && e.postData && e.postData.contents || '{}'); } catch (err) { return out_({ ok: false, error: '요청 모양이 달라요' }); }
  try { return out_(handle_(req)); } catch (err) { return out_({ ok: false, error: String(err && err.message || err) }); }
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function handle_(req) {
  if (String(req.token || '') !== TEAM_TOKEN) return { ok: false, error: '열쇠가 맞지 않아요' };
  var a = String(req.action || '');
  if (a === 'ping') return { ok: true, version: TEAM_VERSION };
  if (a === 'board.list') return { ok: true, posts: listPosts_(), statuses: STATUSES };
  if (a === 'board.post') return withLock_(function () { return boardPost_(req); });
  if (a === 'board.like') return withLock_(function () { return boardLike_(req); }); // 예전 검색기용(1.3.0부터 화면에 없음)
  if (a === 'board.comment') return withLock_(function () { return boardComment_(req); });
  if (a === 'board.status') return withLock_(function () { return boardStatus_(req); });
  if (a === 'board.delete') return withLock_(function () { return boardDelete_(req); });
  if (a === 'usage.add') return withLock_(function () { return usageAdd_(req); });
  if (a === 'usage.get') return { ok: true, days: usageGet_(Number(req.days) || 30) };
  if (a === 'team.beat') return teamBeat_(req);
  if (a === 'cases.get') return { ok: true, list: casesGet_(), now: Date.now() };
  if (a === 'team.get') return { ok: true, live: teamLive_(), days: teamDays_(Number(req.days) || 14), now: Date.now() };
  if (a === 'admin.check') return { ok: true, admin: isAdmin_(req.adminToken) };
  if (a === 'board.uncomment') return withLock_(function () { return boardUncomment_(req); });
  if (a === 'qa.ok') return withLock_(function () { return qaOk_(req); });
  if (a === 'qa.get') return { ok: true, days: qaDays_(Number(req.days) || 7), live: qaLive_(), now: Date.now() };
  if (a === 'work.get') { var st = settings_(); return { ok: true, items: otList_(req), cfg: cfgOut_(st), roster: st.roster || [] }; }
  if (a === 'cfg.get') return { ok: true, cfg: cfgOut_(settings_()), roster: settings_().roster || [] };
  if (a === 'cfg.set') return withLock_(function () { return cfgSet_(req); });
  if (a === 'ot.list') return { ok: true, items: otList_(req) };
  if (a === 'ot.add') return withLock_(function () { return otAdd_(req); });
  if (a === 'ot.cancel') return withLock_(function () { return otCancel_(req); });
  if (a === 'ot.decide') return withLock_(function () { return otDecide_(req); });
  if (a === 'notice.read') return withLock_(function () { return noticeRead_(req); });
  if (a === 'notice.reads') return { ok: true, reads: readJson_('reads.json', {}) || {} };
  return { ok: false, error: '모르는 요청이에요: ' + a };
}

/* ── 저장: 드라이브 폴더 안 JSON 파일 ── */
// 1.3.3 빠르게: 폴더·파일 번호를 기억(드라이브에서 이름으로 찾지 않음) · 작은 파일은 내용도 6시간 캐시(쓰면 바로 바꿈)
function prop_() { return PropertiesService.getScriptProperties(); }
function folder_() {
  var p = prop_(), id = p.getProperty('folderId');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { p.deleteProperty('folderId'); } }
  var it = DriveApp.getFoldersByName(FOLDER_NAME), f = it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
  p.setProperty('folderId', f.getId()); return f;
}
function file_(name) {
  var p = prop_(), k = 'fid:' + name, id = p.getProperty(k);
  if (id) { try { return DriveApp.getFileById(id); } catch (e) { p.deleteProperty(k); } }
  var it = folder_().getFilesByName(name); if (!it.hasNext()) return null;
  var f = it.next(); p.setProperty(k, f.getId()); return f;
}
var CACHE_MAX = 90000;
function readJson_(name, fallback) {
  var c = CacheService.getScriptCache(), hit = c.get('j:' + name);
  if (hit !== null) { try { return JSON.parse(hit); } catch (e) {} }
  var f = file_(name); if (!f) return fallback;
  var t = f.getBlob().getDataAsString('UTF-8');
  if (t.length < CACHE_MAX) c.put('j:' + name, t, 21600);
  try { return JSON.parse(t); } catch (e) { return fallback; }
}
function writeJson_(name, obj) {
  var text = JSON.stringify(obj), f = file_(name), c = CacheService.getScriptCache();
  if (f) f.setContent(text); else { f = folder_().createFile(name, text, 'application/json'); prop_().setProperty('fid:' + name, f.getId()); }
  if (text.length < CACHE_MAX) c.put('j:' + name, text, 21600); else c.remove('j:' + name);
}
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, error: '잠시 뒤 다시 해 주세요(다른 요청 처리 중)' };
  try { return fn(); } finally { lock.releaseLock(); }
}
function text_(v, max) { return String(v == null ? '' : v).replace(/\r\n?/g, '\n').trim().slice(0, max || MAX_TEXT); }
function name_(v) { return text_(v, 20).replace(/\s+/g, ' '); }
function id_() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function dayKey_(ms) { return new Date((ms || Date.now()) + 9 * 3600e3).toISOString().slice(0, 10); }

/* ── 관리자 확인: 멘트 저장소(cs-content)에 쓰기 권한이 있는 깃허브 열쇠인지(빈 글을 올려 보아 422면 쓰기 가능) ── */
function isAdmin_(token) {
  token = String(token || '');
  if (!/^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/.test(token)) return false;
  var key = 'adm:' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token)).slice(0, 40);
  var cache = CacheService.getScriptCache();
  if (cache.get(key) === '1') return true;
  var res = UrlFetchApp.fetch('https://api.github.com/repos/' + CONTENT_REPO + '/contents/.team-write-check', {
    method: 'put', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' },
    payload: JSON.stringify({ message: 'check', content: '!!' })
  });
  var ok = res.getResponseCode() === 422;
  if (ok) cache.put(key, '1', 21600);
  return ok;
}

/* ── 요청·건의 게시판 ── */
function posts_() { var p = readJson_('board.json', []); return Array.isArray(p) ? p : []; }
function listPosts_() { return posts_().sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); }).slice(0, 300); }
function find_(posts, id) { for (var i = 0; i < posts.length; i++) if (posts[i].id === id) return posts[i]; return null; }
function boardPost_(req) {
  var body = text_(req.body), author = name_(req.author);
  if (!author) return { ok: false, error: '이름을 적어 주세요' };
  if (!body) return { ok: false, error: '내용을 적어 주세요' };
  var posts = posts_(), now = Date.now();
  var p = { id: id_(), author: author, title: text_(req.title, 80), body: body, at: now, updated: now, status: '접수', likes: [], comments: [] };
  posts.push(p);
  if (posts.length > MAX_POSTS) posts = posts.sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); }).slice(0, MAX_POSTS);
  writeJson_('board.json', posts);
  return { ok: true, post: p };
}
function boardLike_(req) {
  var posts = posts_(), p = find_(posts, String(req.id || '')), who = name_(req.author);
  if (!p) return { ok: false, error: '글을 찾지 못했어요' };
  if (!who) return { ok: false, error: '이름을 적어 주세요' };
  var i = p.likes.indexOf(who);
  if (i >= 0) p.likes.splice(i, 1); else p.likes.push(who);
  writeJson_('board.json', posts);
  return { ok: true, post: p };
}
function boardComment_(req) {
  var posts = posts_(), p = find_(posts, String(req.id || '')), body = text_(req.body, 2000), who = name_(req.author);
  if (!p) return { ok: false, error: '글을 찾지 못했어요' };
  if (!body || !who) return { ok: false, error: '이름과 내용을 적어 주세요' };
  var admin = !!req.adminToken && isAdmin_(req.adminToken);
  if (req.adminToken && !admin) return { ok: false, error: '관리자 열쇠를 확인하지 못했어요' };
  var now = Date.now();
  p.comments.push({ id: id_(), author: who, body: body, at: now, admin: admin });
  p.updated = now; if (admin) p.adminAt = now;
  writeJson_('board.json', posts);
  return { ok: true, post: p };
}
function boardStatus_(req) {
  if (!isAdmin_(req.adminToken)) return { ok: false, error: '관리자만 바꿀 수 있어요' };
  var posts = posts_(), p = find_(posts, String(req.id || '')), st = String(req.status || '');
  if (!p) return { ok: false, error: '글을 찾지 못했어요' };
  if (STATUSES.indexOf(st) < 0) return { ok: false, error: '모르는 상태예요' };
  var now = Date.now();
  p.status = st; p.updated = now; p.adminAt = now;
  if (req.link) p.link = text_(req.link, 200);
  writeJson_('board.json', posts);
  return { ok: true, post: p };
}
function boardDelete_(req) {
  var posts = posts_(), p = find_(posts, String(req.id || ''));
  if (!p) return { ok: true };
  var mine = name_(req.author) && name_(req.author) === p.author;
  if (!mine && !isAdmin_(req.adminToken)) return { ok: false, error: '쓴 사람이나 관리자만 지울 수 있어요' };
  writeJson_('board.json', posts.filter(function (x) { return x !== p; }));
  return { ok: true };
}

function boardUncomment_(req) {
  var posts = posts_(), p = find_(posts, String(req.id || '')); if (!p) return { ok: true };
  var cid = String(req.cid || ''), c = null; p.comments.forEach(function (x) { if (x.id === cid) c = x; }); if (!c) return { ok: true };
  var mine = name_(req.author) && name_(req.author) === c.author;
  if (!mine && !isAdmin_(req.adminToken)) return { ok: false, error: '쓴 사람이나 관리자만 지울 수 있어요' };
  p.comments = p.comments.filter(function (x) { return x !== c; });
  writeJson_('board.json', posts); return { ok: true, post: p };
}

/* ── 멘트 사용 통계: 하루마다 멘트별 담기·교체 횟수 ── */
function usageAdd_(req) {
  var counts = req.counts && typeof req.counts === 'object' ? req.counts : {}, day = /^\d{4}-\d{2}-\d{2}$/.test(String(req.day)) ? String(req.day) : dayKey_();
  var u = readJson_('usage.json', {}); if (!u || typeof u !== 'object') u = {};
  var d = u[day] || (u[day] = {});
  Object.keys(counts).slice(0, 400).forEach(function (id) { var n = Math.max(0, Math.min(500, Math.floor(Number(counts[id]) || 0))); if (n && /^[\w.-]{1,60}$/.test(id)) d[id] = (d[id] || 0) + n; });
  pruneDays_(u);
  writeJson_('usage.json', u);
  return { ok: true };
}
function usageGet_(days) { var u = readJson_('usage.json', {}), out = {}, from = dayKey_(Date.now() - (Math.min(days, KEEP_DAYS) - 1) * 864e5); Object.keys(u || {}).forEach(function (k) { if (k >= from) out[k] = u[k]; }); return out; }
function pruneDays_(obj, keep) { var from = dayKey_(Date.now() - (keep || KEEP_DAYS) * 864e5); Object.keys(obj).forEach(function (k) { if (k < from) delete obj[k]; }); }
// 상담사 이름: 카톡 태그 영원3 → 영원(끝 숫자 뗌) · 톡톡 태그 김영원 → 영원(세 글자 한글이면 성 뺌). 기록기 match.js person과 같은 규칙
function person_(v) { var s = name_(v).replace(/\s+/g, '').replace(/\d+$/, ''); return /^[가-힣]{3}$/.test(s) ? s.slice(1) : s; }

/* ── 팀 현황: 상담사 기록기가 1분마다 숫자만 보냄(고객 이름·내용 없음) ── */
function teamBeat_(req) {
  if (req.lead) return leadBeat_(req);
  var who = person_(req.name); if (!who) return { ok: false, error: '이름이 없어요' };
  var live = req.live && typeof req.live === 'object' ? req.live : {}, now = Date.now();
  var row = { name: who, at: now, pending: num_(live.pending), oldestMin: num_(live.oldestMin), over10: num_(live.over10), over20: num_(live.over20), held: num_(live.held), records: num_(live.records), channels: text_(live.channels, 60) };
  // 사람마다 따로 담아 둠(여러 PC가 동시에 보내도 서로 덮어쓰지 않게) · 이름 목록은 새 사람이 생길 때만 고침
  var cache = CacheService.getScriptCache();
  cache.put('live:' + who, JSON.stringify(row), 21600);
  if (req.cases && typeof req.cases === 'object') cache.put('cases:' + who, JSON.stringify(cases_(req.cases, now, who)), 21600);
  var qa = req.qa && typeof req.qa === 'object' ? qaClean_(req.qa) : null;
  if (qa) { row.miss = qa.miss.length; row.lh = qa.lh.length; cache.put('live:' + who, JSON.stringify(row), 21600); cache.put('qa:' + who, JSON.stringify({ at: now, miss: qa.miss, lh: qa.lh }), 21600); }
  var names = liveNames_();
  if (names.indexOf(who) < 0) withLock_(function () { var n = liveNames_(); if (n.indexOf(who) < 0) { n.push(who); PropertiesService.getScriptProperties().setProperty('liveNames', JSON.stringify(n.slice(-60))); } return { ok: true }; });
  // 하루 합계는 5분에 한 번만 파일에 남김(파일 쓰기를 줄임)
  var st = req.stats && typeof req.stats === 'object' ? req.stats : null, day = /^\d{4}-\d{2}-\d{2}$/.test(String(req.day)) ? String(req.day) : dayKey_();
  if (st && !cache.get('dayw:' + who + ':' + day)) {
    withLock_(function () {
      var t = readJson_('team.json', {}); if (!t || typeof t !== 'object') t = {};
      var d = t[day] || (t[day] = {});
      d[who] = { answered: num_(st.answered), waitSum: num_(st.waitSum), over20: num_(st.over20), maxWait: num_(st.maxWait), holds: num_(st.holds), records: num_(st.records), sites: sites_(st.sites), at: now };
      pruneDays_(t, TEAM_KEEP_DAYS); writeJson_('team.json', t);
      // 기록 시각 · 20분 넘긴 상담 · 기록 빠짐(그날 마지막 모습) — 62일 보관
      if (qa) { var q = readJson_('qa.json', {}); if (!q || typeof q !== 'object') q = {}; var qd = q[day] || (q[day] = {}); qd[who] = { rt: qa.rt, late: qa.late, miss: qa.miss, at: now }; pruneDays_(q, KEEP_DAYS); writeJson_('qa.json', q); }
      return { ok: true };
    });
    cache.put('dayw:' + who + ':' + day, '1', 300);
  }
  return { ok: true, cfg: cfgOut_(settings_()) };
}
// 팀장 PC: 기록 수 · 기록 시각 · 게시판 사이트별 건수만(팀 현황 카드·팀장 보기에는 안 나옴)
function leadBeat_(req) {
  var who = '팀장', st = req.stats && typeof req.stats === 'object' ? req.stats : {}, qa = req.qa && typeof req.qa === 'object' ? qaClean_(req.qa) : { rt: [] };
  var day = /^\d{4}-\d{2}-\d{2}$/.test(String(req.day)) ? String(req.day) : dayKey_(), now = Date.now();
  withLock_(function () {
    var t = readJson_('team.json', {}); if (!t || typeof t !== 'object') t = {};
    var d = t[day] || (t[day] = {}); d[who] = { answered: 0, waitSum: 0, over20: 0, maxWait: 0, holds: 0, records: num_(st.records), sites: sites_(st.sites), at: now };
    pruneDays_(t, TEAM_KEEP_DAYS); writeJson_('team.json', t);
    var q = readJson_('qa.json', {}); if (!q || typeof q !== 'object') q = {}; var qd = q[day] || (q[day] = {}); qd[who] = { rt: qa.rt, late: [], miss: [], at: now }; pruneDays_(q, KEEP_DAYS); writeJson_('qa.json', q);
    return { ok: true };
  });
  return { ok: true, cfg: cfgOut_(settings_()) };
}
/* ── 1.3.0 확인할 상담 · 기록 시각 ── */
function sites_(o) { var out = {}; if (o && typeof o === 'object') Object.keys(o).slice(0, 40).forEach(function (k) { var n = num_(o[k]); if (n) out[text_(k, 30) || '게시판'] = n; }); return out; }
function qaItem_(x) { var o = { ch: x.ch === 'naver' ? 'naver' : 'kakao', id: caseText_(x.id), u: /^https:\/\/(business\.kakao\.com|center-pf\.kakao\.com|partner\.talk\.naver\.com)\//.test(String(x.u || '')) ? String(x.u).slice(0, 300) : '', at: ms_(x.at) }; if (x.w) o.w = num_(x.w); if (x.d) o.d = num_(x.d); if (x.h) o.h = 1; return o; }
function qaClean_(q) {
  var list = function (v, n) { return Array.isArray(v) ? v.slice(0, n).filter(function (x) { return x && x.id; }).map(qaItem_) : []; };
  var rt = Array.isArray(q.rt) ? q.rt.slice(0, 400).map(function (v) { return Math.max(0, Math.min(1439, Math.floor(Number(v) || 0))); }) : [];
  return { rt: rt, late: list(q.late, 100), miss: list(q.miss, 80), lh: list(q.lh, 80) };
}
function qaDays_(days) { var q = readJson_('qa.json', {}), out = {}, from = dayKey_(Date.now() - (Math.min(days, KEEP_DAYS) - 1) * 864e5); Object.keys(q || {}).forEach(function (k) { if (k >= from) out[k] = q[k]; }); return out; }
function qaLive_() {
  var names = liveNames_(), out = {}; if (!names.length) return out;
  var got = CacheService.getScriptCache().getAll(names.map(function (n) { return 'qa:' + n; })), now = Date.now(), ok = readJson_('qaok.json', {}) || {};
  var keep = function (x) { return !ok[x.ch + ':' + x.id]; };
  names.forEach(function (n) { try { var v = JSON.parse(got['qa:' + n] || 'null'); if (v && now - (v.at || 0) < 12 * 3600e3) { v.miss = (v.miss || []).filter(keep); v.lh = (v.lh || []).filter(keep); out[n] = v; } } catch (e) {} });
  return out;
}
// 팀장이 [확인함]을 누른 상담은 ‘기록 안 한 상담’ · ‘오래된 상담’에서 뺌(7일)
function qaOk_(req) {
  if (!isAdmin_(req.adminToken)) return { ok: false, error: '관리자만 할 수 있어요' };
  var k = String(req.key || ''); if (!/^(kakao|naver):.{1,80}$/.test(k)) return { ok: false, error: '상담 확인 필요' };
  var ok = readJson_('qaok.json', {}) || {}, now = Date.now(); ok[k] = now;
  Object.keys(ok).forEach(function (x) { if (now - ok[x] > 7 * 864e5) delete ok[x]; });
  writeJson_('qaok.json', ok); return { ok: true };
}

/* ── 1.3.0 근무 설정: 비수기 · 공휴일(기본값은 기록기 workclock.js에) · 상담사 명단(입사·퇴사일) ── */
function settings_() { var s = readJson_('settings.json', {}); return s && typeof s === 'object' ? s : {}; }
function cfgOut_(s) { return { offseason: !!s.offseason, holidays: s.holidays && typeof s.holidays === 'object' ? s.holidays : {}, removed: Array.isArray(s.removed) ? s.removed : [] }; }
function dateOk_(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')); }
function cfgSet_(req) {
  if (!isAdmin_(req.adminToken)) return { ok: false, error: '관리자만 바꿀 수 있어요' };
  var s = settings_();
  if (typeof req.offseason === 'boolean') s.offseason = req.offseason;
  if (req.holidays && typeof req.holidays === 'object') { var h = {}; Object.keys(req.holidays).slice(0, 200).forEach(function (k) { if (dateOk_(k)) h[k] = text_(req.holidays[k], 20) || '휴일'; }); s.holidays = h; }
  if (Array.isArray(req.removed)) s.removed = req.removed.filter(dateOk_).slice(0, 200);
  // 명단: 성까지 적으면(김수빈) 이름은 성 뺀 이름(수빈) · 순서는 성까지 넣은 이름 가나다순
  if (Array.isArray(req.roster)) s.roster = req.roster.slice(0, 60).map(function (r) { var raw = name_(r && r.name).replace(/\s+/g, ''), full = /^[가-힣]{3}$/.test(raw) ? raw : name_(r && r.full).replace(/\s+/g, ''); return { name: person_(raw), full: /^[가-힣]{3}$/.test(full) ? full : '', start: dateOk_(r && r.start) ? r.start : '', end: dateOk_(r && r.end) ? r.end : '' }; }).filter(function (r) { return r.name; }).sort(function (a, b) { return (a.full || a.name).localeCompare(b.full || b.name, 'ko'); });
  writeJson_('settings.json', s);
  return { ok: true, cfg: cfgOut_(s), roster: s.roster || [] };
}

/* ── 1.3.0 야근(OT): 상담사가 신청 → 팀장이 승인/반려. 팀장이 적으면 바로 승인 ── */
var OT_STATUS = ['신청', '승인', '반려'];
function ots_() { var v = readJson_('ot.json', []); return Array.isArray(v) ? v : []; }
function hm_(v) { var m = /^(\d{1,2}):(\d{2})$/.exec(String(v || '')); if (!m) return -1; var n = Number(m[1]) * 60 + Number(m[2]); return Number(m[1]) <= 30 && Number(m[2]) < 60 ? n : -1; }
function otList_(req) {
  var from = dateOk_(req.from) ? req.from : '', to = dateOk_(req.to) ? req.to : '9999';
  var who = req.name ? person_(req.name) : '';
  return ots_().filter(function (x) { return x.date >= from && x.date <= to && (!who || x.name === who); }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.at || 0) - (b.at || 0); });
}
// 상담사는 그날 퇴근 시각만 적음(정시 19:00 뒤 넘은 시간이 야근) · 같은 날 다시 적으면 고쳐짐
function otAdd_(req) {
  var raw = name_(req.name).replace(/\s+/g, ''), name = person_(raw), date = String(req.date || ''), from = req.from || '19:00', f = hm_(from), t = hm_(req.to);
  // 보여 줄 이름: 성까지 적었으면 그대로(김수빈) · 아니면 명단의 성 포함 이름
  var full = /^[가-힣]{3}$/.test(raw) ? raw : ''; if (!full) (settings_().roster || []).forEach(function (r) { if (r.name === name && r.full) full = r.full; });
  if (!name) return { ok: false, error: '이름이 없어요' };
  if (!dateOk_(date)) return { ok: false, error: '날짜를 골라 주세요' };
  if (f < 0 || t < 17 * 60) return { ok: false, error: '퇴근 시각을 확인해 주세요(17:00부터)' };
  var admin = !!req.adminToken && isAdmin_(req.adminToken);
  if (req.adminToken && !admin) return { ok: false, error: '관리자 열쇠를 확인하지 못했어요' };
  var list = ots_(), now = Date.now(), x = null;
  list.forEach(function (o) { if (o.name === name && o.date === date && o.status !== '반려') x = o; });
  if (x) { if (full) x.full = full; if (x.to !== req.to || admin) { x.from = from; x.to = req.to; x.mins = Math.max(0, t - f); x.status = admin ? '승인' : '신청'; x.at = now; } if (req.note != null) x.note = text_(req.note, 200); }
  else { x = { id: id_(), name: name, full: full, date: date, from: from, to: req.to, mins: Math.max(0, t - f), note: text_(req.note, 200), status: admin ? '승인' : '신청', at: now, by: admin ? '팀장' : name }; list.push(x); }
  if (admin) x.decidedAt = now;
  var cut = dayKey_(now - TEAM_KEEP_DAYS * 864e5); list = list.filter(function (o) { return o.date >= cut; });
  writeJson_('ot.json', list);
  return { ok: true, item: x };
}
function otCancel_(req) {
  var list = ots_(), id = String(req.id || ''), who = person_(req.name), admin = !!req.adminToken && isAdmin_(req.adminToken), x = null;
  list.forEach(function (o) { if (o.id === id) x = o; }); if (!x) return { ok: true };
  if (!admin && !(who && who === x.name && x.status === '신청')) return { ok: false, error: '승인 전 내 신청만 지울 수 있어요' };
  writeJson_('ot.json', list.filter(function (o) { return o !== x; })); return { ok: true };
}
function otDecide_(req) {
  if (!isAdmin_(req.adminToken)) return { ok: false, error: '관리자만 승인할 수 있어요' };
  var list = ots_(), id = String(req.id || ''), st = String(req.status || ''), x = null;
  if (OT_STATUS.indexOf(st) < 0) return { ok: false, error: '모르는 상태예요' };
  list.forEach(function (o) { if (o.id === id) x = o; }); if (!x) return { ok: false, error: '신청을 찾지 못했어요' };
  x.status = st; x.decidedAt = Date.now(); if (req.reply != null) x.reply = text_(req.reply, 200);
  writeJson_('ot.json', list); return { ok: true, item: x };
}

/* ── 1.3.0 공지 확인: 상담사가 [확인했어요]를 누른 공지(번호 · 제목만) ── */
function noticeRead_(req) {
  var who = person_(req.name); if (!who) return { ok: false, error: '이름이 없어요' };
  var items = Array.isArray(req.items) ? req.items.slice(0, 100) : [], r = readJson_('reads.json', {}), now = Date.now();
  if (!r || typeof r !== 'object') r = {};
  items.forEach(function (it) {
    var id = text_(it && it.id, 80); if (!id) return;
    var o = r[id] || (r[id] = { title: text_(it.title, 80), first: now, reads: {} });
    if (it.title) o.title = text_(it.title, 80);
    if (!o.reads[who]) o.reads[who] = now;
  });
  var keys = Object.keys(r).sort(function (a, b) { return (r[b].first || 0) - (r[a].first || 0); });
  keys.slice(200).forEach(function (k) { delete r[k]; });
  writeJson_('reads.json', r); return { ok: true };
}
/* ── 팀장 보기 맞추기: 상담사 PC가 본 내 상담 상태(상담 번호와 메시지 번호만) ── */
var CASE_MAX = 300;
function ms_(v) { var n = Number(v); return isFinite(n) && n > 0 && n < 4102444800000 ? Math.round(n) : 0; }
function caseText_(v) { return String(v == null ? '' : v).slice(0, 80); }
function caseList_(list, withSince) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, CASE_MAX).filter(function (x) { return x && (x.ch === 'kakao' || x.ch === 'naver') && x.id; }).map(function (x) {
    var o = { ch: x.ch, id: caseText_(x.id), m: caseText_(x.m), at: ms_(x.at) };
    if (withSince) { o.s = ms_(x.s); o.r = x.r ? 1 : 0; }
    return o;
  });
}
function cases_(c, now, who) {
  var st = {};
  ['kakao', 'naver'].forEach(function (ch) { var v = c.st && c.st[ch]; if (v && typeof v === 'object') st[ch] = { ok: !!v.ok, at: ms_(v.at), tag: text_(v.tag, 40) }; });
  return { name: who, at: now, st: st, pend: caseList_(c.pend, true), hold: caseList_(c.hold, false), done: caseList_(c.done, false) };
}
function casesGet_() {
  var names = liveNames_(); if (!names.length) return [];
  var got = CacheService.getScriptCache().getAll(names.map(function (n) { return 'cases:' + n; })), now = Date.now();
  return names.map(function (n) { try { return JSON.parse(got['cases:' + n] || 'null'); } catch (e) { return null; } }).filter(function (r) { return r && now - (r.at || 0) < 15 * 60e3; });
}
function num_(v) { var n = Number(v); return isFinite(n) && n > 0 ? Math.min(Math.round(n), 1e7) : 0; }
function liveNames_() { try { var v = JSON.parse(PropertiesService.getScriptProperties().getProperty('liveNames') || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
function teamLive_() {
  var names = liveNames_(); if (!names.length) return [];
  var got = CacheService.getScriptCache().getAll(names.map(function (n) { return 'live:' + n; })), now = Date.now();
  return names.map(function (n) { try { return JSON.parse(got['live:' + n] || 'null'); } catch (e) { return null; } }).filter(function (r) { return r && now - (r.at || 0) < 12 * 3600e3; });
}
function teamDays_(days) { var t = readJson_('team.json', {}), out = {}, from = dayKey_(Date.now() - (Math.min(days, TEAM_KEEP_DAYS) - 1) * 864e5); Object.keys(t || {}).forEach(function (k) { if (k >= from) out[k] = t[k]; }); return out; }
