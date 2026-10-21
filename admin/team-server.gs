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
   · 1.3.4: 큰 파일도 캐시(나눠 담기) · 요청·건의에 ‘팀장’ 대신 이름
   · 1.3.5: 기록기 판 · PC 이름표(같은 이름으로 PC 두 대 감지)
   · 1.3.6: (기록기 2.4.3과 함께) 오늘 기록 = 시트 저장 확인 건 · 보내는 중 · 문의→기록(채팅) · 한 채널 끊김 표시
            [확인함]을 기록 빠짐(그날만)과 오래된 상담(그 방에 새 메시지가 오면 다시 보임)으로 나눔 · 2.4.2 기록기가 보내도 예전처럼 동작
   · 1.3.7: (기록기 2.4.4와 함께) 팀 현황에 기다리는 고객 이름·마지막 말 · 기록 빠짐 상세(종료/진행 중) · 채널 연결 상태
            — 이름·말은 ‘지금 상태’(캐시 6시간)에만, 날짜별 파일에는 안 남김
            · 오늘 팀이 기록한 방을 모아 기록기에 돌려줌(누가 열든 “이미 오늘 기록된 상담” 알림) · 기록 빠짐은 팀 전체 기록 기준
            · 같은 이름으로 PC 두 대가 보내면 덮어쓰지 않고 합쳐 보여 줌
            · 못 찾은 검색어(miss.add/miss.get) · OT는 주말·공휴일에 적을 수 없음
   · 1.3.8: (기록기 2.4.14와 함께) 상담사별·채널별 건수(카톡 · 톡톡 · 게시판, 답한 상담도 채널별) — QA용
            · 기록 수가 바뀌면 5분을 안 기다리고 바로 하루 파일에 씀 · 전날 마지막 숫자를 다음 날 받아 채움(더 큰 숫자만)
   · 1.3.9: (기록기 2.4.15와 함께) 상담사별 카테고리별 기록 수(교환/반품 · 고장/불량 등) — 어려운 상담을 많이 맡았는지 참작용
            · 보류한 고객 10명(이름·마지막 말·보류한 시각)을 지금 상태에 — 팀 현황에서 누가 무엇을 보류해 뒀는지
   · 1.3.10: 날짜별 파일에 그날 기록한 방 · (기록기 2.4.17부터) 그날 답한 고객의 방을 짧은 숫자(방 번호를 바꾼 것 · 되돌릴 수 없음)로 남김
            — 팀 현황이 하루·이번 주·이번 달 모두 같은 고객을 1번으로 셀 수 있게(완료 기록 · 답한 상담)
   · 1.3.11: (기록기 2.4.18과 함께) 꺼짐 복구 — 상담사 이름별 카톡·톡톡 태그를 보관(tags.json · 바뀔 때만 씀)
            → 기록기를 다시 깐 PC의 패널 첫 화면에서 내 이름을 한 번 누르면 예전 태그를 불러옴(tags.get). 고객 정보 없음
   고치기(이미 배포한 뒤): 이 글 전체로 바꿔 붙여 넣기 → 저장 → 배포 → 배포 관리 → 연필(수정) → 버전: 새 버전 → 배포(주소 그대로)
   설치: script.google.com → 새 프로젝트 → 이 글 전체를 붙여 넣기 → 저장 → 배포 → 새 배포 → 웹 앱
        (실행: 나 · 액세스: 모든 사용자) → 나온 주소를 멘트 관리 ‘팀 서버 연결’에 붙여 넣기 */
var TEAM_VERSION = '1.3.12';
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
  if (a === 'miss.add') return withLock_(function () { return missAdd_(req); });
  if (a === 'miss.get') return { ok: true, days: missGet_(Number(req.days) || 30) };
  if (a === 'team.beat') return teamBeat_(req);
  if (a === 'cases.get') return { ok: true, list: casesGet_(), now: Date.now() };
  if (a === 'team.get') return { ok: true, live: teamLive_(), lead: leadLive_(), days: teamDays_(Number(req.days) || 14), now: Date.now() };
  if (a === 'admin.check') return { ok: true, admin: isAdmin_(req.adminToken) };
  if (a === 'board.uncomment') return withLock_(function () { return boardUncomment_(req); });
  if (a === 'qa.ok') return withLock_(function () { return qaOk_(req); });
  if (a === 'tags.get') return { ok: true, list: tagsGet_() };
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
// 캐시: 한 칸에 3만 자까지 · 큰 파일(팀 숫자 등)은 여러 칸에 나눠 담음(8칸까지)
var CACHE_MAX = 30000, CACHE_PARTS = 8;
function cacheGet_(c, name) {
  var h = c.get('j:' + name); if (h === null) return null;
  if (h.charAt(0) !== 'n') return h;
  var n = Number(h.slice(1)), keys = []; for (var i = 0; i < n; i++) keys.push('j:' + name + ':' + i);
  var g = c.getAll(keys), out = ''; for (var j = 0; j < n; j++) { if (g[keys[j]] == null) return null; out += g[keys[j]]; }
  return out;
}
function cachePut_(c, name, text) {
  if (text.length <= CACHE_MAX) { c.put('j:' + name, text, 21600); return; }
  var n = Math.ceil(text.length / CACHE_MAX); if (n > CACHE_PARTS) { c.remove('j:' + name); return; }
  var o = {}; for (var i = 0; i < n; i++) o['j:' + name + ':' + i] = text.slice(i * CACHE_MAX, (i + 1) * CACHE_MAX);
  c.putAll(o, 21600); c.put('j:' + name, 'n' + n, 21600);
}
function readJson_(name, fallback) {
  var c = CacheService.getScriptCache(), hit = cacheGet_(c, name);
  if (hit !== null) { try { return JSON.parse(hit); } catch (e) {} }
  var f = file_(name); if (!f) return fallback;
  var t = f.getBlob().getDataAsString('UTF-8');
  cachePut_(c, name, t);
  try { return JSON.parse(t); } catch (e) { return fallback; }
}
function writeJson_(name, obj) {
  var text = JSON.stringify(obj), f = file_(name), c = CacheService.getScriptCache();
  if (f) f.setContent(text); else { f = folder_().createFile(name, text, 'application/json'); prop_().setProperty('fid:' + name, f.getId()); }
  cachePut_(c, name, text);
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
// 상담사 화면에는 ‘팀장’ 대신 이름만: 예전에 ‘팀장’으로 남은 글·댓글은 팀장이 댓글을 달 때 쓴 이름으로 보여 줌
function listPosts_() {
  var lead = settings_().leadName || '', fix = function (n) { return n === '팀장' && lead ? lead : n; };
  return posts_().sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); }).slice(0, 300).map(function (p) {
    p.author = fix(p.author); (p.comments || []).forEach(function (c) { c.author = fix(c.author); }); return p;
  });
}
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
  if (admin && who !== '팀장') { var st0 = settings_(); if (st0.leadName !== who) { st0.leadName = who; writeJson_('settings.json', st0); } }
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
// 1.3.7 못 찾은 검색어: 검색기 스크립트 검색에서 꼭 맞는 멘트가 없던 짧은 검색어(20자 · 숫자 4자리 이상·@ 없는 것만) — 날마다 300개까지 · 62일
function missAdd_(req) {
  var day = /^\d{4}-\d{2}-\d{2}$/.test(String(req.day)) ? String(req.day) : dayKey_(), c = req.counts && typeof req.counts === 'object' ? req.counts : {};
  var m = readJson_('miss.json', {}); if (!m || typeof m !== 'object') m = {}; var d = m[day] || (m[day] = {});
  Object.keys(c).slice(0, 100).forEach(function (k) { var q = text_(k, 200).replace(/\s+/g, ' '); if (q.length < 2 || q.length > 20 || /\d{4,}|@|https?:/i.test(q)) return; if (!(q in d) && Object.keys(d).length >= 300) return; d[q] = (d[q] || 0) + Math.min(50, num_(c[k]) || 1); });
  pruneDays_(m, KEEP_DAYS); writeJson_('miss.json', m); return { ok: true };
}
function missGet_(days) { var m = readJson_('miss.json', {}), out = {}, from = dayKey_(Date.now() - (Math.min(days, KEEP_DAYS) - 1) * 864e5); Object.keys(m || {}).forEach(function (k) { if (k >= from) out[k] = m[k]; }); return out; }
function pruneDays_(obj, keep) { var from = dayKey_(Date.now() - (keep || KEEP_DAYS) * 864e5); Object.keys(obj).forEach(function (k) { if (k < from) delete obj[k]; }); }
// 상담사 이름: 카톡 태그 영원3 → 영원(끝 숫자 뗌) · 톡톡 태그 김영원 → 영원(세 글자 한글이면 성 뺌). 기록기 match.js person과 같은 규칙
function person_(v) { var s = name_(v).replace(/\s+/g, '').replace(/\d+$/, ''); return /^[가-힣]{3}$/.test(s) ? s.slice(1) : s; }

/* ── 팀 현황: 상담사 기록기가 1분마다 보냄 ──
   1.3.7 PC마다 따로 받아 두고(p:…:이름:PC), 같은 이름의 PC가 10분 안에 둘 이상 보내면 합쳐서 보여 줌(덮어쓰지 않음)
     · 같은 태그를 넣은 PC는 같은 대기를 봄 → 대기·답함은 겹치지 않게(합집합 · 큰 값)
     · 기록은 PC마다 따로 누름 → 더하되 같은 날 같은 방은 1건
   고객 이름·마지막 말(top · miss의 n/p)은 캐시(‘지금 상태’, 6시간)에만 두고 qa.json·team.json에는 남기지 않음 */
var FRESH_PC = 10 * 60e3;
function pcOf_(req) { return /^[a-z0-9]{8}$/.test(String(req.pc || '')) ? String(req.pc) : 'x'; }
function jget_(cache, k) { try { return JSON.parse(cache.get(k) || 'null'); } catch (e) { return null; } }
function pcsTouch_(cache, who, pc, now) {
  var m = jget_(cache, 'pcs:' + who) || {}; m[pc] = now;
  Object.keys(m).forEach(function (k) { if (now - m[k] > 12 * 3600e3) delete m[k]; });
  cache.put('pcs:' + who, JSON.stringify(m), 21600); return m;
}
function freshPcs_(m, now) { return Object.keys(m || {}).filter(function (k) { return now - m[k] < FRESH_PC; }); }
function okUrl_(u) { return /^https:\/\/(business\.kakao\.com|center-pf\.kakao\.com|partner\.talk\.naver\.com)\//.test(String(u || '')) ? String(u).slice(0, 300) : ''; }
var CONN_STATES = /^(ok|off|setup|missing|login|reload|connecting)$/;
function connList_(v) { return Array.isArray(v) ? v.slice(0, 4).filter(function (x) { return x && (x.ch === 'kakao' || x.ch === 'naver'); }).map(function (x) { return { ch: x.ch, u: x.u ? 1 : 0, s: CONN_STATES.test(String(x.s)) ? String(x.s) : 'connecting', at: ms_(x.at) }; }) : []; }
// 1.3.9 보류한 고객 10명(이름·마지막 말·보류한 시각) — 캐시(지금 상태)에만
function holdList_(v) { return Array.isArray(v) ? v.slice(0, 10).filter(function (x) { return x && x.id; }).map(function (x) { var o = { ch: x.ch === 'naver' ? 'naver' : 'kakao', id: caseText_(x.id), n: text_(x.n, 20), p: text_(x.p, 60).replace(/\s+/g, ' '), at: ms_(x.at), u: okUrl_(x.u) }; if (x.s) o.s = 1; return o; }) : []; }
function topList_(v) { return Array.isArray(v) ? v.slice(0, 5).filter(function (x) { return x && x.id; }).map(function (x) { var o = { ch: x.ch === 'naver' ? 'naver' : 'kakao', id: caseText_(x.id), n: text_(x.n, 20), p: text_(x.p, 60).replace(/\s+/g, ' '), w: num_(x.w), u: okUrl_(x.u) }; if (x.r) o.r = 1; return o; }) : []; }
function pwList_(v) { return Array.isArray(v) ? v.slice(0, 200).filter(function (x) { return x && x.k; }).map(function (x) { return { k: caseText_(x.k), w: num_(x.w) }; }) : []; }
function rrList_(v, max) { return Array.isArray(v) ? v.slice(0, max || 200).filter(function (x) { return x && /^(kakao|naver):.{1,100}$/.test(String(x.k || '')); }).map(function (x) { var o = { k: String(x.k), t: ms_(x.t) }; var c = text_(x.c, 20); if (c) o.c = c; return o; }) : []; }
function byKey_(lists, keyOf, pick) { var m = {}; lists.forEach(function (l) { (l || []).forEach(function (x) { var k = keyOf(x); m[k] = m[k] ? pick(m[k], x) : x; }); }); return Object.keys(m).map(function (k) { return m[k]; }); }
function chKey_(x) { return x.ch + ':' + x.id; }

function teamBeat_(req) {
  if (req.lead) return leadBeat_(req);
  var who = person_(req.name); if (!who) return { ok: false, error: '이름이 없어요' };
  var live = req.live && typeof req.live === 'object' ? req.live : {}, now = Date.now(), cache = CacheService.getScriptCache(), pc = pcOf_(req);
  tagsSave_(who, req.tags, cache);
  var row = { name: who, at: now, pending: num_(live.pending), oldestMin: num_(live.oldestMin), over10: num_(live.over10), over20: num_(live.over20), held: num_(live.held), records: num_(live.records), channels: text_(live.channels, 60) };
  if (pc !== 'x') row.pc = pc;
  if (req.v) row.v = text_(req.v, 12);
  if (live.sending) row.sending = num_(live.sending);
  if (live.part) row.part = 1;
  var irv = ir_(live.ir); if (irv) row.ir = irv;
  // 1.3.7 기다리는 고객 5명(이름·마지막 말) · 모든 대기의 기다린 분 · 채널 연결 상태
  if (Array.isArray(live.top)) row.top = topList_(live.top);
  if (Array.isArray(live.hold)) row.hold = holdList_(live.hold);
  if (Array.isArray(live.pw)) row.pw = pwList_(live.pw);
  if (Array.isArray(live.conn)) row.conn = connList_(live.conn);
  var qa = req.qa && typeof req.qa === 'object' ? qaClean_(req.qa, true) : null;
  var cs = req.cases && typeof req.cases === 'object' ? cases_(req.cases, now, who) : null;
  var day = /^\d{4}-\d{2}-\d{2}$/.test(String(req.day)) ? String(req.day) : dayKey_();
  var st = req.stats && typeof req.stats === 'object' ? statsClean_(req.stats, now) : null;
  // PC마다 받아 둠
  var put = {}; put['p:live:' + who + ':' + pc] = JSON.stringify(row);
  if (qa) put['p:qa:' + who + ':' + pc] = JSON.stringify({ at: now, miss: qa.miss, lh: qa.lh, rt: qa.rt, late: qa.late, rr: qa.rr, ar: qa.ar, sd: qa.sd, day: day });
  if (cs) put['p:cases:' + who + ':' + pc] = JSON.stringify(cs);
  if (st) put['p:st:' + who + ':' + pc] = JSON.stringify(st);
  cache.putAll(put, 21600);
  var pcs = freshPcs_(pcsTouch_(cache, who, pc, now), now);
  // 같은 이름의 다른 PC(10분 안) 것을 읽어 합침
  var keys = []; pcs.forEach(function (p) { ['live', 'qa', 'cases', 'st'].forEach(function (k) { keys.push('p:' + k + ':' + who + ':' + p); }); });
  var g = cache.getAll(keys), parts = { live: [], qa: [], cases: [], st: [] };
  pcs.forEach(function (p) { ['live', 'qa', 'cases', 'st'].forEach(function (k) { try { var v = JSON.parse(g['p:' + k + ':' + who + ':' + p] || 'null'); if (v && now - (v.at || 0) < FRESH_PC) parts[k].push(v); } catch (e) {} }); });
  var mq = mergeQa_(parts.qa), mrow = mergeLive_(parts.live, mq, now);
  if (parts.live.length > 1) { mrow.dup = 1; mrow.pcs = parts.live.length; }
  var out = {}; out['live:' + who] = JSON.stringify(mrow);
  if (parts.qa.length) out['qa:' + who] = JSON.stringify({ at: now, miss: mq.miss, lh: mq.lh });
  if (parts.cases.length) out['cases:' + who] = JSON.stringify(mergeCases_(parts.cases, who, now));
  cache.putAll(out, 21600);
  var names = liveNames_();
  if (names.indexOf(who) < 0) withLock_(function () { var n = liveNames_(); if (n.indexOf(who) < 0) { n.push(who); PropertiesService.getScriptProperties().setProperty('liveNames', JSON.stringify(n.slice(-60))); } return { ok: true }; });
  // 하루 합계는 5분에 한 번만 파일에 남김(파일 쓰기를 줄임) · 이름·말은 빼고
  // 1.3.8 기록 수(채널별)가 바뀌면 5분을 안 기다리고 바로 씀 — 퇴근하며 크롬을 꺼도 마지막 기록까지 남게
  // 1.3.12 기록기가 켜져 있던 업무시간(분) — 면담 화면 '시간당'을 이 시간으로 나눔
  var onMin = onlineAdd_(cache, who, day, now);
  var ms = st ? mergeStats_(parts.st, mrow, mq) : null, rsig = ms ? [ms.records, ms.kakao, ms.naver, JSON.stringify(ms.sites), JSON.stringify(ms.cats || {})].join('|') : '';
  if (ms && (!cache.get('dayw:' + who + ':' + day) || cache.get('dayr:' + who + ':' + day) !== rsig)) {
    withLock_(function () {
      var t = readJson_('team.json', {}); if (!t || typeof t !== 'object') t = {};
      var d = t[day] || (t[day] = {});
      d[who] = { answered: ms.answered, waitSum: ms.waitSum, over20: ms.over20, maxWait: ms.maxWait, holds: ms.holds, records: ms.records, sites: ms.sites, cats: ms.cats || {}, kakao: ms.kakao, naver: ms.naver, ach: ms.ach, on: onMin, at: now };
      if (ms.ir) d[who].ir = ir_(ms.ir); if (ms.sending) d[who].sending = ms.sending;
      pruneDays_(t, TEAM_KEEP_DAYS); writeJson_('team.json', t);
      if (parts.qa.length) { var q = readJson_('qa.json', {}); if (!q || typeof q !== 'object') q = {}; var qd = q[day] || (q[day] = {}); qd[who] = { rt: mq.rt, late: mq.late, miss: mq.miss.map(qaPlain_), at: now }; var irl = irList_(ms.ir); if (irl.length) qd[who].irv = irl; var rk = roomHash_(mq.rr); if (rk.length) qd[who].rk = rk; if (mq.hasAr) qd[who].ak = roomHash_(mq.ar); if (mq.hasSd) qd[who].sd = sdPack_(mq.sd, day); pruneDays_(q, KEEP_DAYS); writeJson_('qa.json', q); }
      return { ok: true };
    });
    cache.put('dayw:' + who + ':' + day, '1', 300); cache.put('dayr:' + who + ':' + day, rsig, 21600);
  }
  prevFill_(who, req.prev, day, cache);
  return { ok: true, cfg: cfgOut_(settings_()), recs: teamRecs_(dayKey_(now)) };
}
// 1.3.11 꺼짐 복구: 이름별 태그(기록기 2.4.18이 박동에 실어 보냄) — 바뀔 때만 파일에 씀
function tagsSave_(who, tags, cache) {
  if (!tags || typeof tags !== 'object' || who === '팀장') return;
  var t = { kakao: text_(tags.kakao, 80), naver: text_(tags.naver, 80) }, sig = t.kakao + '|' + t.naver;
  if (!t.kakao && !t.naver) return;
  if (cache.get('tagsig:' + who) === sig) return;
  withLock_(function () { var all = readJson_('tags.json', {}); if (!all || typeof all !== 'object') all = {}; all[who] = { kakao: t.kakao, naver: t.naver, at: Date.now() }; writeJson_('tags.json', all); return { ok: true }; });
  cache.put('tagsig:' + who, sig, 21600);
}
function tagsGet_() {
  var all = readJson_('tags.json', {}); if (!all || typeof all !== 'object') all = {};
  return Object.keys(all).filter(function (n) { return n !== '팀장'; }).map(function (n) { return { name: n, kakao: all[n].kakao || '', naver: all[n].naver || '', at: all[n].at || 0 }; }).sort(function (a, b) { return a.name > b.name ? 1 : -1; });
}
// 1.3.10 기록한 방 → 짧은 숫자(k/n + 해시). 방 번호 자체는 남기지 않음 · 같은 방은 같은 숫자
// 1.3.12 이 PC에서 답을 보낸 방(기록기 2.4.22) → 방마다 그날 처음·마지막 보낸 때(분) · 방 열쇠는 짧은 숫자로
function sdList_(v) { return v.slice(-600).filter(function (x) { return x && /^(kakao|naver):[A-Za-z0-9_.-]{1,64}$/.test(String(x.k || '')) && ms_(x.t); }).map(function (x) { return { k: String(x.k), t: ms_(x.t) }; }); }
function hash1_(k) { var h = 2166136261; for (var i = 0; i < k.length; i++) { h ^= k.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return k.charAt(0) + h.toString(36); }
function sdPack_(list, day) {
  var out = {}, n = 0, start = Date.parse(day + 'T00:00:00+09:00');
  (list || []).forEach(function (x) {
    if (!x || dayKey_(x.t) !== day) return; var h = hash1_(String(x.k)), m = Math.floor((x.t - start) / 60000), o = out[h];
    if (!o) { if (n >= 400) return; n++; out[h] = [m, m]; } else { o[0] = Math.min(o[0], m); o[1] = Math.max(o[1], m); }
  });
  return out;
}
// 1.3.12 켜져 있던 업무시간: 박동 사이가 3분 안이면 그 사이의 업무시간(월~금 10시~19시, 목 17시 · 점심 12:30~14:00 빼고)을 더함
function bizMin_(a, b) {
  var KST = 9 * 3600e3, d0 = Math.floor((a + KST) / 864e5), wd = new Date(d0 * 864e5).getUTCDay(); if (wd === 0 || wd === 6) return 0;
  var base = d0 * 864e5 - KST, m0 = (a - base) / 60000, m1 = Math.min((b - base) / 60000, 1440), end = wd === 4 ? 17 * 60 : 19 * 60;
  var ov = function (x0, x1) { return Math.max(0, Math.min(m1, x1) - Math.max(m0, x0)); };
  return Math.max(0, ov(600, end) - ov(750, 840));
}
function onlineAdd_(cache, who, day, now) {
  var k = 'onl:' + who + ':' + day, v = jget_(cache, k);
  if (!v || typeof v !== 'object') { var t = readJson_('team.json', {}), row = t && t[day] && t[day][who]; v = { l: 0, m: Number(row && row.on) || 0 }; }
  if (v.l && now > v.l && now - v.l <= 180000) v.m += bizMin_(v.l, now);
  v.l = now; cache.put(k, JSON.stringify(v), 21600);
  return Math.round(v.m * 10) / 10;
}
function roomHash_(rr) {
  var seen = {}, out = [];
  (rr || []).forEach(function (x) {
    var k = String(x && x.k || ''), h = 2166136261; if (!/^(kakao|naver):/.test(k)) return;
    for (var i = 0; i < k.length; i++) { h ^= k.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    var v = k.charAt(0) + h.toString(36); if (!seen[v]) { seen[v] = 1; out.push(v); }
  });
  return out.slice(0, 400);
}
function ach_(o) { var out = {}; if (o && typeof o === 'object') ['kakao', 'naver'].forEach(function (k) { var n = num_(o[k]); if (n) out[k] = n; }); return out; }
// 1.3.8 전날 마지막 숫자: 기록기가 다음 날 보내 줌 → 하루 파일의 그 사람 칸을 더 큰 숫자로만 채움(줄이지 않음) · 사람·날짜마다 한 번
function prevFill_(who, p, today, cache) {
  if (!p || typeof p !== 'object' || !/^\d{4}-\d{2}-\d{2}$/.test(String(p.day)) || String(p.day) >= today || String(p.day) < dayKey_(Date.now() - 3 * 864e5)) return;
  var key = 'prevw:' + who + ':' + p.day + ':' + [num_(p.records), num_(p.kakao), num_(p.naver), num_(p.answered)].join('|');
  if (cache.get(key)) return;
  withLock_(function () {
    var t = readJson_('team.json', {}); if (!t || typeof t !== 'object') t = {};
    var d = t[p.day] || (t[p.day] = {}), o = d[who] || (d[who] = { answered: 0, waitSum: 0, over20: 0, maxWait: 0, holds: 0, records: 0, sites: {}, at: Date.now() }), ch = 0;
    ['records', 'kakao', 'naver', 'answered'].forEach(function (k) { var n = num_(p[k]); if (n > (o[k] || 0)) { o[k] = n; ch = 1; } });
    var ps = sites_(p.sites), os = o.sites || (o.sites = {}); Object.keys(ps).forEach(function (k) { if (ps[k] > (os[k] || 0)) { os[k] = ps[k]; ch = 1; } });
    var pa = ach_(p.ach), oa = o.ach || (o.ach = {}); Object.keys(pa).forEach(function (k) { if (pa[k] > (oa[k] || 0)) { oa[k] = pa[k]; ch = 1; } });
    var pc = sites_(p.cats), oc = o.cats || (o.cats = {}); Object.keys(pc).forEach(function (k) { if (pc[k] > (oc[k] || 0)) { oc[k] = pc[k]; ch = 1; } });
    if (ch) writeJson_('team.json', t);
    return { ok: true };
  });
  cache.put(key, '1', 21600);
}
function statsClean_(st, now) { return { at: now, answered: num_(st.answered), waitSum: num_(st.waitSum), over20: num_(st.over20), maxWait: num_(st.maxWait), holds: num_(st.holds), records: num_(st.records), sending: num_(st.sending), sites: sites_(st.sites), cats: sites_(st.cats), kakao: num_(st.kakao), naver: num_(st.naver), ach: ach_(st.ach), ir: st.ir && typeof st.ir === 'object' ? { n: num_(st.ir.n), m: num_(st.ir.m), med: st.ir.med, o30: num_(st.ir.o30), v: irList_(st.ir) } : null }; }
// 기록 겹침: 같은 날 같은 방을 두 PC가 다 기록했으면 1건
function recOverlap_(qas, ch) { var all = 0, uniq = {}; qas.forEach(function (q) { (q.rr || []).forEach(function (x) { if (ch && String(x.k).indexOf(ch + ':') !== 0) return; all++; uniq[x.k] = 1; }); }); return all - Object.keys(uniq).length; }
function mergeQa_(qas) {
  var first = function (a, b) { return (a.n || a.p) ? a : b; };
  return {
    miss: byKey_(qas.map(function (q) { return q.miss; }), chKey_, first).slice(0, 80),
    lh: byKey_(qas.map(function (q) { return q.lh; }), chKey_, function (a, b) { return (a.last || 0) >= (b.last || 0) ? a : b; }).slice(0, 80),
    late: byKey_(qas.map(function (q) { return q.late; }), chKey_, function (a, b) { return (a.w || 0) >= (b.w || 0) ? a : b; }).slice(0, 100),
    rt: qas.length > 1 ? [].concat.apply([], qas.map(function (q) { return q.rt || []; })).sort(function (a, b) { return a - b; }).slice(0, 400) : (qas[0] && qas[0].rt || []),
    rr: byKey_(qas.map(function (q) { return q.rr; }), function (x) { return x.k; }, function (a, b) { return a.t <= b.t ? a : b; }),
    ar: byKey_(qas.map(function (q) { return q.ar; }), function (x) { return x.k; }, function (a, b) { return a.t <= b.t ? a : b; }), hasAr: qas.some(function (q) { return Array.isArray(q.ar); }),
    sd: [].concat.apply([], qas.map(function (q) { return q.sd || []; })), hasSd: qas.some(function (q) { return Array.isArray(q.sd); }),
    overlap: recOverlap_(qas), overK: recOverlap_(qas, 'kakao'), overN: recOverlap_(qas, 'naver')
  };
}
function mergeLive_(rows, mq, now) {
  rows = rows.slice().sort(function (a, b) { return b.at - a.at; });
  var r = JSON.parse(JSON.stringify(rows[0])); r.at = now;
  if (rows.length > 1) {
    var hasPw = rows.every(function (x) { return Array.isArray(x.pw); });
    if (hasPw) {
      var pw = byKey_(rows.map(function (x) { return x.pw; }), function (x) { return x.k; }, function (a, b) { return a.w >= b.w ? a : b; });
      r.pending = pw.length; r.oldestMin = pw.reduce(function (m, x) { return Math.max(m, x.w); }, 0);
      r.over10 = pw.filter(function (x) { return x.w >= 10; }).length; r.over20 = pw.filter(function (x) { return x.w >= 20; }).length;
    } else ['pending', 'oldestMin', 'over10', 'over20'].forEach(function (k) { r[k] = Math.max.apply(null, rows.map(function (x) { return x[k] || 0; })); });
    r.held = Math.max.apply(null, rows.map(function (x) { return x.held || 0; }));
    r.records = Math.max(0, rows.reduce(function (s, x) { return s + (x.records || 0); }, 0) - mq.overlap);
    r.sending = rows.reduce(function (s, x) { return s + (x.sending || 0); }, 0);
    rows.forEach(function (x) { if (x.ir && (!r.ir || (x.ir.n || 0) > (r.ir.n || 0))) r.ir = x.ir; });
    r.top = byKey_(rows.map(function (x) { return x.top; }), chKey_, function (a, b) { var w = a.w >= b.w ? a : b, z = w === a ? b : a, o = JSON.parse(JSON.stringify(w)); if (!o.n) o.n = z.n || ''; if (!o.p) o.p = z.p || ''; return o; }).sort(function (a, b) { return b.w - a.w; }).slice(0, 5);
    if (rows.some(function (x) { return Array.isArray(x.hold); })) r.hold = byKey_(rows.map(function (x) { return x.hold; }), chKey_, function (a, b) { return (b.at || 0) > (a.at || 0) ? b : a; }).sort(function (a, b) { return (b.at || 0) - (a.at || 0); }).slice(0, 10);
    var conn = {}; rows.forEach(function (x) { (x.conn || []).forEach(function (c) { var o = conn[c.ch]; if (!o) conn[c.ch] = JSON.parse(JSON.stringify(c)); else { if (c.u) o.u = 1; if (c.s === 'ok') o.s = 'ok'; o.at = Math.max(o.at || 0, c.at || 0); } }); });
    r.conn = Object.keys(conn).map(function (k) { return conn[k]; });
    r.part = r.conn.some(function (c) { return c.u && c.s !== 'ok'; }) ? 1 : 0; if (!r.part) delete r.part;
    var vs = {}; rows.forEach(function (x) { if (x.v) vs[x.v] = 1; }); if (Object.keys(vs).length > 1) r.vs = Object.keys(vs);
  }
  delete r.pw; r.miss = mq.miss.length; r.lh = mq.lh.length;
  return r;
}
function mergeCases_(list, who, now) {
  var st = {}; list.forEach(function (c) { Object.keys(c.st || {}).forEach(function (ch) { var v = c.st[ch], o = st[ch]; if (!o || (v.ok && !o.ok) || (v.ok === o.ok && (v.at || 0) > (o.at || 0))) st[ch] = v; }); });
  var u = function (k, pick) { return byKey_(list.map(function (c) { return c[k]; }), chKey_, pick).slice(0, CASE_MAX); };
  return { name: who, at: now, st: st, pend: u('pend', function (a, b) { return b.s && (!a.s || b.s < a.s) ? b : a; }), hold: u('hold', function (a) { return a; }), done: u('done', function (a) { return a; }) };
}
function mergeStats_(sts, mrow, mq) {
  if (!sts.length) return { answered: 0, waitSum: 0, over20: 0, maxWait: 0, holds: 0, records: mrow.records || 0, sites: {}, cats: {} };
  // 1.3.8 채널별: PC 한 대면 그대로 · 두 대면 더하고 같은 방 겹침만 뺌
  var sumOf = function (k) { return sts.reduce(function (a, x) { return a + (x[k] || 0); }, 0); }, ach = {};
  sts.forEach(function (x) { Object.keys(x.ach || {}).forEach(function (c) { ach[c] = Math.max(ach[c] || 0, x.ach[c]); }); });
  var top = sts.slice().sort(function (a, b) { return b.answered - a.answered; })[0], sites = {};
  sts.forEach(function (x) { Object.keys(x.sites || {}).forEach(function (k) { sites[k] = (sites[k] || 0) + x.sites[k]; }); });
  var cats = {}; sts.forEach(function (x) { Object.keys(x.cats || {}).forEach(function (k) { cats[k] = (cats[k] || 0) + x.cats[k]; }); });
  var ir = null; sts.forEach(function (x) { if (x.ir && (!ir || (x.ir.n || 0) > (ir.n || 0))) ir = x.ir; });
  return { answered: top.answered, waitSum: top.waitSum, over20: top.over20, holds: top.holds, maxWait: Math.max.apply(null, sts.map(function (x) { return x.maxWait || 0; })),
    records: sts.length > 1 ? (mrow.records || 0) : top.records, sending: sts.reduce(function (s, x) { return s + (x.sending || 0); }, 0), sites: sites, cats: cats, ir: ir,
    kakao: Math.max(0, sumOf('kakao') - (sts.length > 1 && mq ? mq.overK || 0 : 0)), naver: Math.max(0, sumOf('naver') - (sts.length > 1 && mq ? mq.overN || 0 : 0)), ach: sts.length > 1 ? ach : (top.ach || {}) };
}
// 1.3.7 오늘 팀이 기록한 방(누가 열든 기록 창에 "이미 오늘 기록된 상담" 알림) — 방 열쇠 · 시각 · 기록한 사람(명단의 성 포함 이름) · 분류
//  팀장 PC가 기록한 건 이름 없이(상담사 화면에 '팀장'을 쓰지 않음)
function teamRecs_(day) {
  var cache = CacheService.getScriptCache(), names = liveNames_().concat(['팀장']), now = Date.now();
  var pm = cache.getAll(names.map(function (n) { return 'pcs:' + n; })), keys = [], owner = {};
  names.forEach(function (n) { var m = null; try { m = JSON.parse(pm['pcs:' + n] || 'null'); } catch (e) {} Object.keys(m || {}).forEach(function (p) { if (now - m[p] < 12 * 3600e3) { var k = 'p:qa:' + n + ':' + p; keys.push(k); owner[k] = n; } }); });
  if (!keys.length) return { day: day, list: [] };
  var g = cache.getAll(keys), full = {}, ro = settings_().roster || [], best = {};
  ro.forEach(function (r) { if (r && r.name && r.full) full[r.name] = r.full; });
  keys.forEach(function (k) {
    var q = null; try { q = JSON.parse(g[k] || 'null'); } catch (e) {} if (!q || q.day !== day) return;
    var n = owner[k] === '팀장' ? '' : (full[owner[k]] || owner[k]);
    (q.rr || []).forEach(function (x) { if (!best[x.k] || x.t < best[x.k].t) best[x.k] = { k: x.k, t: x.t, n: n, c: x.c || '' }; });
  });
  return { day: day, list: Object.keys(best).map(function (k) { return best[k]; }).slice(0, 2000) };
}
// 팀장 PC: 기록 수 · 기록 시각 · 게시판 사이트별 건수 · 1.3.7 연결 상태 · 오늘 기록한 방(팀 현황 카드·팀장 보기에는 안 나옴)
function leadBeat_(req) {
  var who = '팀장', st = req.stats && typeof req.stats === 'object' ? req.stats : {}, qa = req.qa && typeof req.qa === 'object' ? qaClean_(req.qa) : { rt: [], rr: [] };
  var day = /^\d{4}-\d{2}-\d{2}$/.test(String(req.day)) ? String(req.day) : dayKey_(), now = Date.now(), cache = CacheService.getScriptCache(), pc = pcOf_(req);
  var live = req.live && typeof req.live === 'object' ? req.live : {};
  var put = {}; put['p:qa:' + who + ':' + pc] = JSON.stringify({ at: now, rr: qa.rr || [], day: day });
  put['live:' + who] = JSON.stringify({ name: who, at: now, conn: connList_(live.conn), records: num_(live.records || st.records), sending: num_(live.sending), v: text_(req.v, 12) });
  cache.putAll(put, 21600); pcsTouch_(cache, who, pc, now);
  var lsig = [num_(st.records), num_(st.kakao), num_(st.naver), JSON.stringify(sites_(st.sites))].join('|');
  if (!cache.get('dayw:' + who + ':' + day) || cache.get('dayr:' + who + ':' + day) !== lsig) {
    withLock_(function () {
      var t = readJson_('team.json', {}); if (!t || typeof t !== 'object') t = {};
      var d = t[day] || (t[day] = {}); d[who] = { answered: 0, waitSum: 0, over20: 0, maxWait: 0, holds: 0, records: num_(st.records), sites: sites_(st.sites), kakao: num_(st.kakao), naver: num_(st.naver), at: now };
      pruneDays_(t, TEAM_KEEP_DAYS); writeJson_('team.json', t);
      var q = readJson_('qa.json', {}); if (!q || typeof q !== 'object') q = {}; var qd = q[day] || (q[day] = {}); qd[who] = { rt: qa.rt, late: [], miss: [], at: now }; pruneDays_(q, KEEP_DAYS); writeJson_('qa.json', q);
      return { ok: true };
    });
    cache.put('dayw:' + who + ':' + day, '1', 300); cache.put('dayr:' + who + ':' + day, lsig, 21600);
  }
  prevFill_(who, req.prev, day, cache);
  return { ok: true, cfg: cfgOut_(settings_()), recs: teamRecs_(dayKey_(now)) };
}
/* ── 1.3.0 확인할 상담 · 기록 시각 ── */
function sites_(o) { var out = {}; if (o && typeof o === 'object') Object.keys(o).slice(0, 40).forEach(function (k) { var n = num_(o[k]); if (n) out[text_(k, 30) || '게시판'] = n; }); return out; }
function qaItem_(x) { var o = { ch: x.ch === 'naver' ? 'naver' : 'kakao', id: caseText_(x.id), u: okUrl_(x.u), at: ms_(x.at) }; if (x.w) o.w = num_(x.w); if (x.d) o.d = num_(x.d); if (x.h) o.h = 1; var last = ms_(x.last); if (last) o.last = last; return o; }
// 1.3.7 기록 빠짐 상세(캐시에만): 이름 · 답하기 전 고객 마지막 말 · 사이트에서 종료됨(e) · 고객이 다시 기다림(r)
function qaMissItem_(x) { var o = qaItem_(x), n = text_(x.n, 20), p = text_(x.p, 60).replace(/\s+/g, ' '); if (n) o.n = n; if (p) o.p = p; if (x.e) o.e = 1; if (x.r) o.r = 1; return o; }
function qaPlain_(x) { var o = {}; Object.keys(x).forEach(function (k) { if (k !== 'n' && k !== 'p') o[k] = x[k]; }); return o; }
function qaClean_(q, withNames) {
  var list = function (v, n, f) { return Array.isArray(v) ? v.slice(0, n).filter(function (x) { return x && x.id; }).map(f || qaItem_) : []; };
  var rt = Array.isArray(q.rt) ? q.rt.slice(0, 400).map(function (v) { return Math.max(0, Math.min(1439, Math.floor(Number(v) || 0))); }) : [];
  return { rt: rt, late: list(q.late, 100), miss: list(q.miss, 80, withNames ? qaMissItem_ : qaItem_), lh: list(q.lh, 80), rr: rrList_(q.rr), ar: Array.isArray(q.ar) ? rrList_(q.ar, 300) : null, sd: Array.isArray(q.sd) ? sdList_(q.sd) : null };
}
function qaDays_(days) { var q = readJson_('qa.json', {}), out = {}, from = dayKey_(Date.now() - (Math.min(days, KEEP_DAYS) - 1) * 864e5); Object.keys(q || {}).forEach(function (k) { if (k >= from) out[k] = q[k]; }); return out; }
function qaLive_() {
  var names = liveNames_(), out = {}; if (!names.length) return out;
  var got = CacheService.getScriptCache().getAll(names.map(function (n) { return 'qa:' + n; })), now = Date.now(), ok = readJson_('qaok.json', {}) || {};
  // 1.3.7 다른 상담사가 그날 그 방을 기록했으면 빠짐 아님(팀 전체 기준)
  var today = dayKey_(now), rec = {}; teamRecs_(today).list.forEach(function (x) { rec[x.k] = 1; });
  var keepMiss = function (x) { return qaMissKeep_(x, ok) && !(dayKey_(x.at || now) === today && rec[x.ch + ':' + x.id]); }, keepLong = function (x) { return qaLongKeep_(x, ok); };
  names.forEach(function (n) { try { var v = JSON.parse(got['qa:' + n] || 'null'); if (v && now - (v.at || 0) < 12 * 3600e3) { v.miss = (v.miss || []).filter(keepMiss); v.lh = (v.lh || []).filter(keepLong); out[n] = v; } } catch (e) {} });
  return out;
}
// 팀장이 [확인함]을 누른 상담은 ‘기록 안 한 상담’ · ‘오래된 상담’에서 뺌(7일 보관)
// 1.3.6 기록 빠짐은 'miss:채널:방:날짜'(그날만) · 오래된 상담은 '채널:방'이되 누른 뒤 그 방에 새 메시지가 오면 다시 보임
//       예전 관리 화면이 보낸 '채널:방'은 기록 빠짐에선 그날 누른 것만 인정
function qaMissKeep_(x, ok) {
  var day = dayKey_(x.at || Date.now()), old = ok[x.ch + ':' + x.id];
  return !ok['miss:' + x.ch + ':' + x.id + ':' + day] && !(old && dayKey_(old) === day);
}
function qaLongKeep_(x, ok) { var at = ok[x.ch + ':' + x.id]; return !(at && (!x.last || x.last <= at)); }
function ir_(v) { if (!v || typeof v !== 'object') return null; var o = { n: num_(v.n), m: num_(v.m), o30: num_(v.o30) }; var med = Number(v.med); if (isFinite(med) && med >= 0 && v.med !== null) o.med = Math.min(Math.round(med), 1e5); return o; }
function irList_(v) { return v && Array.isArray(v.v) ? v.v.slice(0, 150).map(function (x) { return Math.max(0, Math.min(1e5, Math.round(Number(x) || 0))); }) : []; }
function qaOk_(req) {
  if (!isAdmin_(req.adminToken)) return { ok: false, error: '관리자만 할 수 있어요' };
  var k = String(req.key || ''); if (!/^(miss:)?(kakao|naver):.{1,100}$/.test(k)) return { ok: false, error: '상담 확인 필요' };
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
  // 1.3.7 주말·공휴일은 근무일이 아님(출근하지 않음) — 근무 달력에 더한 공휴일 포함(기본 공휴일은 검색기·관리 화면이 막음)
  var wd = new Date(date + 'T00:00:00Z').getUTCDay(), hol = cfgOut_(settings_()).holidays;
  if (wd === 0 || wd === 6 || hol[date]) return { ok: false, error: '주말·공휴일은 근무일이 아니라 OT를 적을 수 없어요' };
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
function leadLive_() { var v = jget_(CacheService.getScriptCache(), 'live:팀장'); return v && Date.now() - (v.at || 0) < 12 * 3600e3 ? v : null; }
function teamDays_(days) { var t = readJson_('team.json', {}), out = {}, from = dayKey_(Date.now() - (Math.min(days, TEAM_KEEP_DAYS) - 1) * 864e5); Object.keys(t || {}).forEach(function (k) { if (k >= from) out[k] = t[k]; }); return out; }
