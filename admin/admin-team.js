/* 멘트 관리에 더한 화면 2: 요청·건의 처리 · 팀 현황(그리기는 admin-team3.js) · 못 찾은 검색어 · 멘트 사용 통계 · 연결 설정(요청시트 · 깃허브 · 팀 서버)
   자료는 팀 서버(앱스크립트 · team-server.gs)에. 주소는 cs-content.json의 sources.team으로 모든 상담사에게 전해짐 */
(function () {
  'use strict';
  var A = function () { return window.KBAdminApp; };
  function mk(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function btn(label, cls, fn) { var b = mk('button', 'btn ' + (cls || 'ghost'), label); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; }
  function lab(t, hint) { var l = mk('div', 'lab', t); if (hint) l.append(mk('small', null, hint)); return l; }
  function say(t, k) { if (A()) A().say(t, k); }
  function when(t) { return t ? KBData.stamp(t).slice(5, 16).replace('-', '/') : ''; }
  function ago(t) { var m = Math.floor((Date.now() - t) / 60000); return m < 1 ? '방금' : m < 60 ? m + '분 전' : Math.floor(m / 60) + '시간 전'; }
  var loaded = false;
  async function ensureUrl() {
    if (loaded && CSTeam.ready()) return true;
    try { var cur = await KBAdmin.latest(); var t = cur.parsed && cur.parsed.sources && cur.parsed.sources.team; CSTeam.set(t && t.url); loaded = true; } catch (e) {}
    return CSTeam.ready();
  }
  async function adminToken() { var c = await KBAdmin.getConn(); return c && c.token || ''; }
  // 댓글에 직함 대신 이름(관리 화면에 연결할 때 적은 이름 · 성 뺀 이름)
  async function adminName() { var c = null; try { c = await KBAdmin.getConn(); } catch (e) {} var raw = String(c && c.name || '').replace(/\s+/g, ''); if (!raw || /^(관리자|팀장|admin)$/i.test(raw)) return 'CS팀'; var n = person(raw); return n && n !== '팀장' ? n : 'CS팀'; }
  function needServer(w, title) {
    w.replaceChildren(mk('h2', null, title), mk('div', 'empty', '팀 서버가 아직 연결되지 않았어요.\n왼쪽 아래 [연결 설정] → [팀 서버]에서 한 번만 연결해 주세요.'));
    var b = btn('팀 서버 연결로 가기', 'primary', function () { cTab = 'teamsetup'; A().setView('conn'); }); b.style.margin = '0 auto'; b.style.display = 'flex'; w.append(b);
  }

  /* ───── 요청·건의: 커뮤니티처럼(상태 없음 · 댓글로 주고받기) ───── */
  async function board(w) {
    var T = '요청·건의';
    w.replaceChildren(mk('h2', null, T), mk('p', 'desc', '상담사들이 검색기 [요청·건의]에 올린 글과 댓글이에요. 여기서 단 댓글도 상담사 화면에는 이름으로만 보여요.'), mk('div', 'empty', '불러오는 중…'));
    if (!(await ensureUrl())) { needServer(w, T); return; }
    var r; try { r = await CSTeam.call('board.list', {}); } catch (e) { w.lastChild.textContent = '불러오지 못했어요. ' + e.message; return; }
    var posts = r.posts || [];
    w.lastChild.remove();
    var p = mk('div', 'panel');
    p.append(mk('div', 'ins', '글 ' + posts.length + '개 · 최근에 댓글이 달린 글이 위로'));
    if (!posts.length) p.append(mk('div', 'empty', '아직 글이 없어요.'));
    posts.forEach(function (x) {
      var c = mk('div', 'bpost'), h = mk('div', 'bph');
      h.append(mk('b', null, x.author), mk('span', 'muted', when(x.at)));
      if ((x.comments || []).length) h.append(mk('span', 'chip cat', '댓글 ' + x.comments.length));
      c.append(h, mk('p', 'bbody-t', x.body));
      (x.comments || []).forEach(function (m) {
        var r2 = mk('div', 'bcm' + (m.admin || m.author === '팀장' ? ' admin' : ''));
        var del = btn('지우기', 'danger-ghost sm', async function () { try { await CSTeam.call('board.uncomment', { id: x.id, cid: m.id, adminToken: await adminToken() }); board(w); } catch (e) { say(e.message, 'err'); } });
        r2.append(mk('b', null, m.author), mk('span', 'muted', when(m.at)), del, mk('p', null, m.body)); c.append(r2);
      });
      var a = mk('div', 'facts'), ci = mk('input', 'in'); ci.type = 'text'; ci.placeholder = '댓글 (상담사 화면에는 이름으로 보여요)'; ci.style.flex = '1 1 260px';
      var send = async function () { var body = ci.value.trim(); if (!body) return; try { await CSTeam.call('board.comment', { id: x.id, author: await adminName(), body: body, adminToken: await adminToken() }); board(w); } catch (e) { say(e.message, 'err'); } };
      ci.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); send(); } });
      a.append(ci, btn('댓글 달기', 'primary sm', send), btn('글 지우기', 'danger-ghost sm', async function () {
        if (!(await A().confirmDlg('이 글을 지울까요?', '‘' + x.body.slice(0, 40) + '…’ 글과 댓글이 모두 사라져요.', '지우기', true))) return;
        try { await CSTeam.call('board.delete', { id: x.id, adminToken: await adminToken() }); board(w); } catch (e) { say(e.message, 'err'); }
      }));
      c.append(a); p.append(c);
    });
    w.append(p);
  }

  /* ───── 팀 현황(2026-10-18 한 화면): 챙길 것 먼저 · 줄 세우기 비교 · 상담사별 표 · 면담 화면(admin-team3.js) ───── */
  var tTimer = 0;
  // 상담사 이름: 카톡 태그 영원3 → 영원 · 톡톡 태그 김영원 → 영원(기록기 match.js person · 팀 서버 person_과 같은 규칙)
  // 예전 판이 '김영원'으로 쌓아 둔 날도 '영원'으로 합쳐 보여 줌
  // 팀장 PC가 보낸 숫자(이름 ‘팀장’)는 관리 화면에 연결할 때 적은 이름(예: 수빈) 칸으로 합쳐 보여 줌
  var leadAs = '';
  function person(n) { var s = String(n || '').replace(/\s+/g, '').replace(/\d+$/, ''); s = /^[가-힣]{3}$/.test(s) ? s.slice(1) : s; return s === '팀장' && leadAs ? leadAs : s; }
  function kstToday() { return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); }
  // 기간: today · yday · week · month · 'd:YYYY-MM-DD' / 면담: 상담사 이름(비면 전체)
  // 2026-10-20 완성판: 화면 셋 — 지금(놓치는 고객) · 피드백(이야기할 것) · 숫자(QA 표). 고른 화면은 기억
  function tstore(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }
  var tMode = /^(now|fb|num)$/.test(tstore('kb:tmode') || '') ? tstore('kb:tmode') : 'fb';
  var tPeriod = 'week', tWho = '';
  function needDays(period) {
    var td = kstToday(), from = td;
    if (/^d:/.test(period)) from = period.slice(2); else if (period === 'month') from = td.slice(0, 8) + '01'; else if (period === 'week' || period === 'yday') from = new Date(Date.parse(td + 'T00:00:00Z') - 10 * 864e5).toISOString().slice(0, 10); else if (period === 'lweek') from = new Date(Date.parse(td + 'T00:00:00Z') - 15 * 864e5).toISOString().slice(0, 10);
    return Math.min(400, Math.max(2, Math.round((Date.parse(td + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 864e5) + 1, Math.round((Date.parse(td + 'T00:00:00Z') - Date.parse(td.slice(0, 8) + '01T00:00:00Z')) / 864e5) + 1));
  }
  async function team(w) {
    clearTimeout(tTimer);
    var T = '팀 현황', DESC = '상담사 기록기가 1분마다 보내요. 숫자는 시트에 저장된 기록만 세요. 기다리는 고객의 이름·마지막 말은 지금 상태에만 보이고 날짜별 자료에는 안 남아요. 기다린 시간은 업무시간만 셈(주말·공휴일·점심·퇴근 뒤 빼고).';
    if (!w.querySelector('.tview')) w.replaceChildren(mk('h2', null, T), mk('p', 'desc', DESC), mk('div', 'empty', '불러오는 중…'));
    if (!(await ensureUrl())) { needServer(w, T); return; }
    CSTeam.get('cfg.get', {}).catch(function () {});
    var r; try { r = await CSTeam.get('team.get', { days: needDays(tPeriod) }, 0); } catch (e) { w.replaceChildren(mk('h2', null, T), mk('div', 'empty', '불러오지 못했어요. ' + e.message)); return; }
    var again = function () { team(w); };
    var g = window.KBTeam3 ? await KBTeam3.render(r, { mode: tWho ? 'fb' : tMode, period: tMode === 'now' && !tWho ? 'today' : tPeriod, person: tWho, who: function (n) { tWho = n || ''; w.scrollTop = 0; team(w); }, again: again }) : mk('div', 'empty', '불러오는 중…');
    var modes = mk('div', 'tmodes'); [['now', '지금', '놓치는 고객이 있나'], ['fb', '피드백', '누구와 무슨 이야기를 하나'], ['num', '숫자', 'QA 표 · 내려받기']].forEach(function (f) { var b = mk('button', 'tmode' + (tMode === f[0] && !tWho ? ' on' : '')); b.type = 'button'; b.dataset.mode = f[0]; b.append(mk('b', null, f[1]), mk('span', null, f[2])); b.addEventListener('click', function () { tMode = f[0]; tWho = ''; tstore('kb:tmode', f[0]); team(w); }); modes.append(b); });
    var nav = mk('div', 'ins bper'); nav.append(mk('span', null, '기간'));
    [['today', '오늘'], ['yday', '어제'], ['week', '이번 주'], ['lweek', '지난주'], ['month', '이번 달']].forEach(function (f) { var b = mk('button', tPeriod === f[0] ? 'on' : null, f[1]); b.type = 'button'; b.addEventListener('click', function () { tPeriod = f[0]; team(w); }); nav.append(b); });
    var td0 = kstToday(), di = mk('input', 'in' + (/^d:/.test(tPeriod) ? ' on' : '')); di.type = 'date'; di.max = td0; di.value = /^d:/.test(tPeriod) ? tPeriod.slice(2) : ''; di.title = '날짜 하나 고르기(그날 기록 · 하루 흐름)';
    di.addEventListener('change', function () { if (di.value) { tPeriod = di.value === td0 ? 'today' : 'd:' + di.value; team(w); } });
    nav.append(di, mk('span', 'muted', tMode === 'num' ? '기간은 건수에만 · 지금 기다리는 고객·기록 안 함은 늘 지금' : '하루 숫자로는 이야기할 것을 고르지 않아요(이번 주 · 지난주 · 이번 달)'));
    if (tMode === 'now' && !tWho) nav.hidden = true;
    var ub = tWho ? null : await updateBox();
    var keepScroll = w.scrollTop;
    w.replaceChildren(mk('h2', null, T), mk('p', 'desc', DESC));
    if (ub) w.append(ub);
    w.append(modes, nav, g);
    w.scrollTop = keepScroll;
    tTimer = setTimeout(function () { if (A() && document.querySelector('.tview') && w.isConnected && !w.querySelector('.tview :focus, details.tdet[open] :focus')) team(w); }, 30000);
  }

  /* ───── 못 찾은 검색어(최근 30일): 상담사가 스크립트에서 찾다가 꼭 맞는 멘트가 없던 짧은 검색어 ───── */
  async function misses(w) {
    var T = '못 찾은 검색어', D = '상담사가 검색기 [스크립트]에서 찾았는데 꼭 맞는 멘트가 없던 검색어예요(최근 30일 · 많이 나온 순). 짧은 검색어만 이름 없이 모아요 — 고객 문장을 붙여 넣은 긴 글, 숫자 4자리 이상, 메일 주소는 안 모아요.';
    w.replaceChildren(mk('h2', null, T), mk('p', 'desc', D), mk('div', 'empty', '불러오는 중…'));
    if (!(await ensureUrl())) { needServer(w, T); return; }
    var r; try { r = await CSTeam.call('miss.get', { days: 30 }); } catch (e) { w.lastChild.textContent = /모르는 요청/.test(e.message || '') ? '팀 서버를 1.3.7로 배포하면 모이기 시작해요([팀 현황]의 노란 상자).' : '불러오지 못했어요. ' + e.message; return; }
    var sum = {}, last = {}; Object.keys(r.days || {}).sort().forEach(function (d) { var x = r.days[d] || {}; Object.keys(x).forEach(function (k) { sum[k] = (sum[k] || 0) + x[k]; last[k] = d; }); });
    var keys = Object.keys(sum).sort(function (a, b) { return sum[b] - sum[a] || (last[b] > last[a] ? 1 : -1); });
    w.lastChild.remove();
    var p = mk('div', 'panel'); p.style.maxWidth = '720px';
    p.append(mk('div', 'ins', '검색어 ' + keys.length + '개'));
    if (!keys.length) p.append(mk('div', 'empty', '아직 모인 검색어가 없어요.'));
    keys.slice(0, 200).forEach(function (k) { var row = mk('div', 'hrow'); row.style.gridTemplateColumns = 'minmax(0,1fr) 70px 90px'; row.append(mk('b', null, k), mk('span', null, sum[k] + '번'), mk('span', 'muted', '마지막 ' + Number(last[k].slice(5, 7)) + '/' + Number(last[k].slice(8, 10)))); p.append(row); });
    p.append(mk('p', 'muted', '자주 나오는 말은 멘트 제목이나 내용에 그 말을 넣으면 다음부터 찾혀요.'));
    w.append(p);
  }

  /* ───── 멘트 사용 통계(최근 30일): 멘트 목록에 ‘30일 N회’로 보여 줌 ───── */
  var usage = { map: null, at: 0 };
  async function loadUsage() {
    if (!(await ensureUrl())) return;
    try { var r = await CSTeam.call('usage.get', { days: 30 }); var m = {}; Object.keys(r.days || {}).forEach(function (d) { var x = r.days[d]; Object.keys(x).forEach(function (id) { m[id] = (m[id] || 0) + x[id]; }); }); usage.map = m; usage.at = Date.now(); if (A() && A().refresh) A().refresh(); } catch (e) {}
  }

  /* ───── 팀 서버 코드 새 판 알림: 배포해 둔 서버 판이 이 사이트의 team-server.gs보다 예전이면 고치는 법을 보여 줌 ───── */
  async function gsText() { var t = await (await fetch('admin/team-server.gs', { cache: 'no-store' })).text(); return t; }
  var verCheck = null;
  function serverVersion() {
    // 확인에 성공한 결과만 기억(주소를 넣기 전·연결 실패는 다음에 다시 물음)
    if (!verCheck) verCheck = (async function () {
      if (!CSTeam.url) return null;
      var t = await gsText().catch(function () { return ''; }), m = /TEAM_VERSION\s*=\s*'([\d.]+)'/.exec(t);
      if (!m) return null;
      var r = await CSTeam.call('ping', {}, 15000).catch(function () { return null; });
      return r ? { now: String(r.version || ''), latest: m[1] } : null;
    })();
    var p = verCheck; p.then(function (v) { if (!v && verCheck === p) verCheck = null; });
    return p;
  }
  async function updateBox() {
    var v = await serverVersion(); if (!v || v.now === v.latest) return null;
    var box = mk('div', 'upd');
    box.append(mk('b', null, '팀 서버 코드 새 판(' + v.latest + ')이 있어요 · 지금 ' + (v.now || '예전 판')),
      mk('p', null, '이번 판(1.3.12): 면담 화면이 ‘누가 답했나’(어느 PC에서 답을 보냈나, 기록기 2.4.22)와 기록기 켜진 시간을 알아요. 1.3.11 태그 불러오기 · 1.3.10의 같은 고객 한 번 세기(이번 주·이번 달) · 1.3.9 카테고리 · 1.3.8 채널별 건수도 그대로 들어 있어요. 주소는 그대로예요.'),
      mk('p', null, '① [코드 복사] → ② 앱스크립트 편집기에서 글을 모두 지우고 붙여 넣기 → 저장(Ctrl+S) → ③ [배포] → [배포 관리] → 연필(수정) → 버전: [새 버전] → [배포]'));
    var cp = btn('코드 복사', 'ghost', async function () { try { await navigator.clipboard.writeText(await gsText()); say('코드를 복사했어요. 앱스크립트 편집기에 붙여 넣어 주세요', 'ok'); } catch (e) { say('복사하지 못했어요: ' + e.message, 'err'); } });
    var again = btn('다 했어요 · 다시 확인', 'ghost', function () { verCheck = null; updateBox().then(function (b) { if (!b) { box.remove(); say('팀 서버가 새 판이에요', 'ok'); } else say('아직 예전 판이에요. [새 버전]으로 배포했는지 확인해 주세요', 'err'); }); });
    var row = mk('div', 'facts'); row.append(cp, again); box.append(row);
    return box;
  }

  /* ───── 팀 서버 연결(처음 한 번) ───── */
  async function setup(w) {
    var T = '팀 서버 연결';
    w.replaceChildren(mk('h2', null, T), mk('p', 'desc', '요청·건의 게시판 · 멘트 사용 통계 · 팀 현황에 쓰는 작은 서버예요. 구글 시트를 쓰지 않고, 문의기록 시트·기록 서버와도 상관없어요. 처음 한 번만 아래대로 만들면 돼요(5분).'));
    await ensureUrl();
    var ub = await updateBox(); if (ub) w.append(ub);
    var p = mk('div', 'panel');
    var steps = mk('ol', 'steps');
    [['script.google.com', ' 을 열고 왼쪽 위 [새 프로젝트]를 눌러요. (회사 구글 계정)'],
     ['', '가운데 글을 모두 지우고, 아래 [코드 복사]를 눌러 붙여 넣은 뒤 저장(Ctrl+S)해요.'],
     ['', '오른쪽 위 [배포] → [새 배포] → 왼쪽 톱니 → [웹 앱]을 골라요. 실행: ‘나’ · 액세스 권한: ‘모든 사용자’ → [배포].'],
     ['', '권한 확인 창이 뜨면 계정을 고르고 [고급] → [(안전하지 않은 페이지)로 이동] → [허용]. 내 드라이브에 자료 폴더를 만들려고 묻는 거예요.'],
     ['', '나온 ‘웹 앱 URL’(https://script.google.com/macros/s/…/exec)을 복사해 아래 칸에 붙여 넣고 [연결 확인] → [저장].']].forEach(function (s, i) {
      var li = mk('li'); if (i === 0) { var a = mk('a', null, s[0]); a.href = 'https://script.google.com/home/projects/create'; a.target = '_blank'; a.rel = 'noopener'; li.append(a, s[1]); } else li.append(s[1]); steps.append(li); });
    p.append(steps);
    var cp = btn('코드 복사', 'ghost', async function () { try { var t = await (await fetch('admin/team-server.gs', { cache: 'no-store' })).text(); await navigator.clipboard.writeText(t); say('코드를 복사했어요. 앱스크립트 편집기에 붙여 넣어 주세요', 'ok'); } catch (e) { say('복사하지 못했어요: ' + e.message, 'err'); } });
    cp.style.alignSelf = 'flex-start'; p.append(cp);
    var u = mk('input', 'in'); u.type = 'text'; u.placeholder = 'https://script.google.com/macros/s/…/exec'; u.value = CSTeam.url || ''; u.spellcheck = false;
    var res = mk('div', 'muted');
    var test = btn('연결 확인', 'ghost', async function () {
      var v = u.value.trim(); if (!CSTeam.valid(v)) { res.textContent = '주소 모양이 달라요. ‘웹 앱 URL’(…/exec로 끝남)을 붙여 넣어 주세요.'; return; }
      var old = CSTeam.url; CSTeam.set(v); res.textContent = '확인하는 중…';
      try { var r = await CSTeam.call('ping', {}, 20000); var a = await CSTeam.call('admin.check', { adminToken: await adminToken() }, 20000); res.textContent = '✓ 연결됐어요(팀 서버 ' + r.version + ')' + (a.admin ? ' · 관리자 확인됨' : ' · 관리자 확인 안 됨: 깃허브 연결(관리 열쇠)을 확인해 주세요'); }
      catch (e) { res.textContent = '연결하지 못했어요: ' + e.message + ' — 배포할 때 액세스 권한을 ‘모든 사용자’로 했는지 확인해 주세요.'; CSTeam.set(old); }
    });
    var save = btn('저장', 'primary', async function () {
      var v = u.value.trim(); if (v && !CSTeam.valid(v)) { say('주소 모양이 달라요', 'err'); return; }
      save.disabled = true; try { await KBAdmin.saveSources({ team: v ? { url: v } : null }, v ? '팀 서버 연결' : '팀 서버 연결 끊음'); CSTeam.set(v); say(v ? '저장했어요. 2분 안에 상담사 검색기에 [요청·건의] 탭이 생겨요' : '연결을 끊었어요', 'ok'); } catch (e) { say(e.message, 'err'); } finally { save.disabled = false; }
    });
    var row = mk('div', 'facts'); row.append(test, save);
    p.append(lab('웹 앱 URL', '저장하면 모든 상담사 검색기에 함께 전해져요'), u, row, res);
    p.append(mk('p', 'muted', '상담사 기록기(팀 현황 · 팀장 보기 맞추기)는 2.3.11부터 이 주소가 들어 있어요. 주소를 바꾸면 기록기 새 판이 필요해요.'));
    w.append(p);
  }

  /* ───── 연결 설정(2026-10-18): 요청시트 · 깃허브 · 팀 서버를 한 메뉴의 탭 셋으로 ───── */
  var cTab = 'sources', ORIG = {}, CONN_TABS = [['sources', '요청시트'], ['github', '깃허브'], ['teamsetup', '팀 서버']];
  function conn(w, tab) {
    if (tab) cTab = tab;
    var bar = mk('div', 'ctabs'), sub = mk('div', 'csub');
    CONN_TABS.forEach(function (t) { var b = mk('button', 'ctab' + (cTab === t[0] ? ' on' : ''), t[1]); b.type = 'button'; b.dataset.tab = t[0]; if (t[0] === 'teamsetup' && !CSTeam.url) { b.append(mk('i', 'cdot')); b.title = '아직 연결 안 됨'; } b.addEventListener('click', function () { conn(w, t[0]); }); bar.append(b); });
    w.replaceChildren(mk('h2', null, '연결 설정'), mk('p', 'desc', '처음 한 번 맞추면 거의 안 들어오는 곳이라 한 메뉴로 묶었어요.'), bar, sub);
    if (cTab === 'teamsetup') ensureUrl().then(function () { var d = bar.querySelector('[data-tab="teamsetup"] .cdot'); if (d && CSTeam.url) d.remove(); });
    ORIG[cTab](sub);
  }
  function syncLead() { return adminName().then(function (n) { if (n && n !== 'CS팀') leadAs = n; }).catch(function () {}); }
  window.KBTeam = { syncLead: syncLead, usage: usage, loadUsage: loadUsage, ensureUrl: ensureUrl, adminToken: adminToken, needServer: needServer, person: person, when: when };
  var add = function () { if (!window.KBAdminExtra) return setTimeout(add, 50);
    var V = KBAdminExtra.views; ORIG = { sources: V.sources, github: V.github, teamsetup: setup };
    // 예전 메뉴 이름(sources · github · teamsetup)으로 와도 연결 설정의 그 탭
    Object.assign(V, { board: board, team: team, misses: misses, conn: function (w) { conn(w); }, sources: function (w) { conn(w, 'sources'); }, github: function (w) { conn(w, 'github'); }, teamsetup: function (w) { conn(w, 'teamsetup'); } }); };
  add();
  setTimeout(loadUsage, 1500);
})();
