/* 멘트 관리에 더한 화면 2: 요청·건의 처리 · 팀 현황(상담사별 기다림 · 하루 합계) · 멘트 사용 통계 · 팀 서버 연결
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
  async function adminName() { var c = await KBAdmin.getConn(); return c && c.name || '팀장'; }
  function needServer(w, title) {
    w.replaceChildren(mk('h2', null, title), mk('div', 'empty', '팀 서버가 아직 연결되지 않았어요.\n왼쪽 아래 [팀 서버 연결]에서 한 번만 연결해 주세요.'));
    var b = btn('팀 서버 연결로 가기', 'primary', function () { A().setView('teamsetup'); }); b.style.margin = '0 auto'; b.style.display = 'flex'; w.append(b);
  }

  /* ───── 요청·건의 ───── */
  var bFilter = 'open';
  async function board(w) {
    var T = '요청·건의';
    w.replaceChildren(mk('h2', null, T), mk('p', 'desc', '상담사가 검색기 [요청·건의] 탭에 올린 글이에요. 상태를 바꾸고 답글을 달면 쓴 사람 화면에 ‘새 답’으로 보여요.'), mk('div', 'empty', '불러오는 중…'));
    if (!(await ensureUrl())) { needServer(w, T); return; }
    var r; try { r = await CSTeam.call('board.list', {}); } catch (e) { w.lastChild.textContent = '불러오지 못했어요. ' + e.message; return; }
    var posts = r.posts || [], sts = r.statuses || ['접수', '진행 중', '완료', '보류'];
    w.lastChild.remove();
    var p = mk('div', 'panel');
    var fs = mk('div', 'ins'), F = [['open', '처리할 것'], ['done', '완료'], ['hold', '보류'], ['all', '전체']];
    var n = { open: posts.filter(function (x) { return x.status === '접수' || x.status === '진행 중'; }).length, done: posts.filter(function (x) { return x.status === '완료'; }).length, hold: posts.filter(function (x) { return x.status === '보류'; }).length, all: posts.length };
    F.forEach(function (f) { var b = mk('button', null, f[1] + ' ' + n[f[0]]); b.type = 'button'; if (bFilter === f[0]) b.className = 'on'; b.addEventListener('click', function () { bFilter = f[0]; board(w); }); fs.append(b); });
    p.append(fs);
    var list = posts.filter(function (x) { return bFilter === 'all' || (bFilter === 'open' ? (x.status === '접수' || x.status === '진행 중') : bFilter === 'done' ? x.status === '완료' : x.status === '보류'); });
    if (!list.length) p.append(mk('div', 'empty', bFilter === 'open' ? '처리할 요청이 없어요.' : '없어요.'));
    list.forEach(function (x) {
      var c = mk('div', 'bpost'), h = mk('div', 'bph');
      var sel = mk('select', 'sel'); sel.setAttribute('aria-label', '상태'); sts.forEach(function (s) { sel.append(new Option(s, s)); }); sel.value = x.status;
      sel.addEventListener('change', async function () { sel.disabled = true; try { await CSTeam.call('board.status', { id: x.id, status: sel.value, adminToken: await adminToken() }); say('‘' + sel.value + '’(으)로 바꿨어요', 'ok'); board(w); } catch (e) { say(e.message, 'err'); sel.value = x.status; sel.disabled = false; } });
      h.append(sel, mk('b', null, x.author), mk('span', 'muted', when(x.at)));
      if ((x.likes || []).length) { var lk = mk('span', 'chip cat', '나도 필요 ' + x.likes.length); lk.title = x.likes.join(', '); h.append(lk); }
      c.append(h, mk('p', 'bbody-t', x.body));
      (x.comments || []).forEach(function (m) { var r2 = mk('div', 'bcm' + (m.admin ? ' admin' : '')); r2.append(mk('b', null, (m.admin ? '팀장 · ' : '') + m.author), mk('span', 'muted', when(m.at)), mk('p', null, m.body)); c.append(r2); });
      var a = mk('div', 'facts'), ci = mk('input', 'in'); ci.type = 'text'; ci.placeholder = '답글 (상담사 화면에 ‘팀장’으로 보여요)'; ci.style.flex = '1 1 260px';
      var send = async function () { var body = ci.value.trim(); if (!body) return; try { await CSTeam.call('board.comment', { id: x.id, author: await adminName(), body: body, adminToken: await adminToken() }); board(w); } catch (e) { say(e.message, 'err'); } };
      ci.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); send(); } });
      a.append(ci, btn('답글 달기', 'primary sm', send), btn('지우기', 'danger-ghost sm', async function () {
        if (!(await A().confirmDlg('이 글을 지울까요?', '‘' + x.body.slice(0, 40) + '…’ 글과 답글이 모두 사라져요.', '지우기', true))) return;
        try { await CSTeam.call('board.delete', { id: x.id, adminToken: await adminToken() }); board(w); } catch (e) { say(e.message, 'err'); }
      }));
      c.append(a); p.append(c);
    });
    w.append(p);
  }

  /* ───── 팀 현황: 지금(1분마다) + 하루 합계 ───── */
  var tDay = 'today', tTimer = 0;
  async function team(w) {
    clearTimeout(tTimer);
    var T = '팀 현황';
    if (!w.querySelector('.tgrid')) w.replaceChildren(mk('h2', null, T), mk('p', 'desc', '상담사 기록기가 1분마다 보내는 숫자예요(고객 이름·대화 내용은 안 보내요). 20분 넘게 기다리는 고객이 있으면 빨갛게 보여요. 이 화면은 30초마다 새로 읽어요.'), mk('div', 'empty', '불러오는 중…'));
    if (!(await ensureUrl())) { needServer(w, T); return; }
    var r; try { r = await CSTeam.call('team.get', { days: 14 }); } catch (e) { w.replaceChildren(mk('h2', null, T), mk('div', 'empty', '불러오지 못했어요. ' + e.message)); return; }
    var keepScroll = w.scrollTop;
    w.replaceChildren(mk('h2', null, T), mk('p', 'desc', '상담사 기록기가 1분마다 보내는 숫자예요(고객 이름·대화 내용은 안 보내요). 20분 넘게 기다리는 고객이 있으면 빨갛게 보여요. 이 화면은 30초마다 새로 읽어요.'));
    var ub = await updateBox(); if (ub) w.append(ub);
    var live = (r.live || []).slice().sort(function (a, b) { return (b.oldestMin || 0) - (a.oldestMin || 0); });
    var g = mk('div', 'tgrid');
    if (!live.length) g.append(mk('div', 'empty', '아직 신호를 보낸 상담사가 없어요.\n상담사 PC 기록기가 2.3.11 이상이어야 해요(팀 서버 주소가 들어 있는 판).'));
    live.forEach(function (x) {
      var off = Date.now() - x.at > 3 * 60000, hot = !off && (x.oldestMin || 0) >= 20, warm = !off && !hot && (x.oldestMin || 0) >= 10;
      var c = mk('div', 'tcard' + (off ? ' off' : hot ? ' hot' : warm ? ' warm' : ''));
      var h = mk('div', 'th'); h.append(mk('b', null, x.name), mk('span', 'muted', off ? '신호 없음 · ' + ago(x.at) : ago(x.at))); c.append(h);
      var big = mk('div', 'tbig'); big.append(mk('span', 'n', off ? '–' : String(x.pending || 0)), mk('span', 'u', '명 대기'));
      var old = mk('div', 'told', off ? '기록기가 꺼져 있거나 목록 탭을 닫았어요' : x.pending ? '가장 오래 ' + (x.oldestMin || 0) + '분' : '기다리는 고객 없음'); c.append(big, old);
      var m = mk('div', 'tmeta'); m.append(mk('span', null, '20분 넘음 ' + (x.over20 || 0)), mk('span', null, '보류 ' + (x.held || 0)), mk('span', null, '오늘 기록 ' + (x.records || 0)));
      if (x.channels) m.append(mk('span', null, x.channels));
      c.append(m); g.append(c);
    });
    w.append(g);
    // 하루 합계
    var days = r.days || {}, keys = Object.keys(days).sort().reverse(), today = KBData.todayKey();
    var p = mk('div', 'panel'); p.style.maxWidth = '980px';
    var hd = mk('div', 'ins'); hd.append(mk('span', null, '하루 합계'));
    [['today', '오늘'], ['yday', '어제'], ['d7', '최근 7일'], ['d14', '최근 14일']].forEach(function (f) { var b = mk('button', null, f[1]); b.type = 'button'; if (tDay === f[0]) b.className = 'on'; b.addEventListener('click', function () { tDay = f[0]; team(w); }); hd.append(b); });
    p.append(hd);
    var pick = tDay === 'today' ? [today] : tDay === 'yday' ? [KBData.todayKey(Date.now() - 864e5)] : keys.slice(0, tDay === 'd7' ? 7 : 14);
    var sum = {};
    pick.forEach(function (d) { var x = days[d] || {}; Object.keys(x).forEach(function (n) { var s = sum[n] || (sum[n] = { answered: 0, waitSum: 0, over20: 0, maxWait: 0, holds: 0, records: 0 }), v = x[n]; ['answered', 'waitSum', 'over20', 'holds', 'records'].forEach(function (k) { s[k] += v[k] || 0; }); s.maxWait = Math.max(s.maxWait, v.maxWait || 0); }); });
    var names = Object.keys(sum).sort(function (a, b) { return sum[b].over20 - sum[a].over20 || a.localeCompare(b); });
    if (!names.length) p.append(mk('div', 'empty', '이 기간 합계가 아직 없어요.'));
    else {
      var tb = mk('table', 'ttable'), tr = mk('tr');
      ['상담사', '답한 상담', '평균 대기', '20분 넘김', '가장 오래', '보류', '기록'].forEach(function (t) { tr.append(mk('th', null, t)); }); var th = mk('thead'); th.append(tr); tb.append(th);
      var bd = mk('tbody');
      names.forEach(function (n) { var s = sum[n], r2 = mk('tr'); r2.append(mk('td', null, n), mk('td', null, String(s.answered)), mk('td', null, s.answered ? Math.round(s.waitSum / s.answered) + '분' : '–'), mk('td', s.over20 ? 'bad' : null, String(s.over20)), mk('td', s.maxWait >= 20 ? 'bad' : null, s.maxWait ? s.maxWait + '분' : '–'), mk('td', null, String(s.holds)), mk('td', null, String(s.records))); bd.append(r2); });
      tb.append(bd); var wrap = mk('div', 'twrap'); wrap.append(tb); p.append(wrap);
      p.append(mk('p', 'muted', '평균 대기 = 고객이 기다리기 시작해서 답할 때까지 걸린 시간의 평균 · 20분 넘김 = 한 번이라도 20분 넘게 기다리게 한 상담 수'));
    }
    w.append(p);
    w.scrollTop = keepScroll;
    tTimer = setTimeout(function () { if (A() && document.querySelector('.tgrid') && w.isConnected) team(w); }, 30000);
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
      mk('p', null, '팀장 화면에 상담사의 보류 · 답함 · 우선 응대가 상담사 화면과 똑같이 보이게 하는 판이에요. 주소는 그대로예요.'),
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

  window.KBTeam = { usage: usage, loadUsage: loadUsage };
  var add = function () { if (!window.KBAdminExtra) return setTimeout(add, 50); Object.assign(KBAdminExtra.views, { board: board, team: team, teamsetup: setup }); };
  add();
  setTimeout(loadUsage, 1500);
})();
