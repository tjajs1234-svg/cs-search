/* 슈피겐 CS 팀 서버 (Apps Script) — 기록 서버와 따로 둔 작은 서버
   · 요청·건의 게시판 · 멘트 사용 통계 · 팀 현황(상담사별 기다림 숫자)
   · 구글 시트를 쓰지 않아요. 자료는 이 스크립트를 만든 계정의 드라이브 폴더 ‘슈피겐CS 팀서버 자료’에 JSON 파일로 남아요.
   · 문의기록 시트·기록 서버(Code.gs 1.1.0)와는 아무 상관이 없어요.
   · 1.1.0: 팀장 보기 맞추기 — 상담사 기록기가 '내 상담 상태'(상담 번호 · 마지막 메시지 번호 · 대기 시작 · 보류 여부)를 보내고,
            팀장 기록기가 받아서 보류·우선 응대·답함을 상담사 화면과 똑같이 보여 줌. 고객 이름·대화 내용은 받지 않음
   고치기(이미 배포한 뒤): 이 글 전체로 바꿔 붙여 넣기 → 저장 → 배포 → 배포 관리 → 연필(수정) → 버전: 새 버전 → 배포(주소 그대로)
   설치: script.google.com → 새 프로젝트 → 이 글 전체를 붙여 넣기 → 저장 → 배포 → 새 배포 → 웹 앱
        (실행: 나 · 액세스: 모든 사용자) → 나온 주소를 멘트 관리 ‘팀 서버 연결’에 붙여 넣기 */
var TEAM_VERSION = '1.1.0';
var TEAM_TOKEN = '1234';                        // 확장·검색기와 맞춘 값
var CONTENT_REPO = 'tjajs1234-svg/cs-content';  // 관리자 확인: 이 저장소에 쓰기 열쇠가 있는 사람만 관리자
var FOLDER_NAME = '슈피겐CS 팀서버 자료';
var KEEP_DAYS = 62, MAX_POSTS = 400, MAX_TEXT = 4000;
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
  if (a === 'board.like') return withLock_(function () { return boardLike_(req); });
  if (a === 'board.comment') return withLock_(function () { return boardComment_(req); });
  if (a === 'board.status') return withLock_(function () { return boardStatus_(req); });
  if (a === 'board.delete') return withLock_(function () { return boardDelete_(req); });
  if (a === 'usage.add') return withLock_(function () { return usageAdd_(req); });
  if (a === 'usage.get') return { ok: true, days: usageGet_(Number(req.days) || 30) };
  if (a === 'team.beat') return teamBeat_(req);
  if (a === 'cases.get') return { ok: true, list: casesGet_(), now: Date.now() };
  if (a === 'team.get') return { ok: true, live: teamLive_(), days: teamDays_(Number(req.days) || 14), now: Date.now() };
  if (a === 'admin.check') return { ok: true, admin: isAdmin_(req.adminToken) };
  return { ok: false, error: '모르는 요청이에요: ' + a };
}

/* ── 저장: 드라이브 폴더 안 JSON 파일 ── */
function folder_() {
  var it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}
function readJson_(name, fallback) {
  var it = folder_().getFilesByName(name);
  if (!it.hasNext()) return fallback;
  try { return JSON.parse(it.next().getBlob().getDataAsString('UTF-8')); } catch (e) { return fallback; }
}
function writeJson_(name, obj) {
  var f = folder_(), it = f.getFilesByName(name), text = JSON.stringify(obj);
  if (it.hasNext()) it.next().setContent(text); else f.createFile(name, text, 'application/json');
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
  var mine = name_(req.author) && name_(req.author) === p.author && !p.comments.some(function (c) { return c.admin; });
  if (!mine && !isAdmin_(req.adminToken)) return { ok: false, error: '쓴 사람(관리자 답글이 달리기 전)이나 관리자만 지울 수 있어요' };
  writeJson_('board.json', posts.filter(function (x) { return x !== p; }));
  return { ok: true };
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
function pruneDays_(obj) { var from = dayKey_(Date.now() - KEEP_DAYS * 864e5); Object.keys(obj).forEach(function (k) { if (k < from) delete obj[k]; }); }

/* ── 팀 현황: 상담사 기록기가 1분마다 숫자만 보냄(고객 이름·내용 없음) ── */
function teamBeat_(req) {
  var who = name_(req.name); if (!who) return { ok: false, error: '이름이 없어요' };
  var live = req.live && typeof req.live === 'object' ? req.live : {}, now = Date.now();
  var row = { name: who, at: now, pending: num_(live.pending), oldestMin: num_(live.oldestMin), over10: num_(live.over10), over20: num_(live.over20), held: num_(live.held), records: num_(live.records), channels: text_(live.channels, 60) };
  // 사람마다 따로 담아 둠(여러 PC가 동시에 보내도 서로 덮어쓰지 않게) · 이름 목록은 새 사람이 생길 때만 고침
  var cache = CacheService.getScriptCache();
  cache.put('live:' + who, JSON.stringify(row), 21600);
  if (req.cases && typeof req.cases === 'object') cache.put('cases:' + who, JSON.stringify(cases_(req.cases, now, who)), 21600);
  var names = liveNames_();
  if (names.indexOf(who) < 0) withLock_(function () { var n = liveNames_(); if (n.indexOf(who) < 0) { n.push(who); PropertiesService.getScriptProperties().setProperty('liveNames', JSON.stringify(n.slice(-60))); } return { ok: true }; });
  // 하루 합계는 5분에 한 번만 파일에 남김(파일 쓰기를 줄임)
  var st = req.stats && typeof req.stats === 'object' ? req.stats : null, day = /^\d{4}-\d{2}-\d{2}$/.test(String(req.day)) ? String(req.day) : dayKey_();
  if (st && !cache.get('dayw:' + who + ':' + day)) {
    withLock_(function () {
      var t = readJson_('team.json', {}); if (!t || typeof t !== 'object') t = {};
      var d = t[day] || (t[day] = {});
      d[who] = { answered: num_(st.answered), waitSum: num_(st.waitSum), over20: num_(st.over20), maxWait: num_(st.maxWait), holds: num_(st.holds), records: num_(st.records), at: now };
      pruneDays_(t); writeJson_('team.json', t); return { ok: true };
    });
    cache.put('dayw:' + who + ':' + day, '1', 300);
  }
  return { ok: true };
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
function teamDays_(days) { var t = readJson_('team.json', {}), out = {}, from = dayKey_(Date.now() - (Math.min(days, KEEP_DAYS) - 1) * 864e5); Object.keys(t || {}).forEach(function (k) { if (k >= from) out[k] = t[k]; }); return out; }
