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
  async function adminName() { return '팀장'; }
  function needServer(w, title) {
    w.replaceChildren(mk('h2', null, title), mk('div', 'empty', '팀 서버가 아직 연결되지 않았어요.\n왼쪽 아래 [팀 서버 연결]에서 한 번만 연결해 주세요.'));
    var b = btn('팀 서버 연결로 가기', 'primary', function () { A().setView('teamsetup'); }); b.style.margin = '0 auto'; b.style.display = 'flex'; w.append(b);
  }

  /* ───── 요청·건의: 커뮤니티처럼(상태 없음 · 댓글로 주고받기) ───── */
  async function board(w) {
    var T = '요청·건의';
    w.replaceChildren(mk('h2', null, T), mk('p', 'desc', '상담사들이 검색기 [요청·건의]에 올린 글과 댓글이에요. 여기서 단 댓글은 상담사 화면에 ‘팀장’으로 강조돼요.'), mk('div', 'empty', '불러오는 중…'));
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
        r2.append(mk('b', null, (m.admin && m.author !== '팀장' ? '팀장 · ' : '') + m.author), mk('span', 'muted', when(m.at)), del, mk('p', null, m.body)); c.append(r2);
      });
      var a = mk('div', 'facts'), ci = mk('input', 'in'); ci.type = 'text'; ci.placeholder = '댓글 (상담사 화면에 ‘팀장’으로 보여요)'; ci.style.flex = '1 1 260px';
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

  /* ───── 팀 현황: 지금(1분마다) + 상담사별 일·주·월 + 하루 합계 ───── */
  var tDay = 'today', tTimer = 0, tWeek = 0;
  // 상담사 이름: 카톡 태그 영원3 → 영원 · 톡톡 태그 김영원 → 영원(기록기 match.js person · 팀 서버 person_과 같은 규칙)
  // 예전 판이 '김영원'으로 쌓아 둔 날도 '영원'으로 합쳐 보여 줌
  function person(n) { var s = String(n || '').replace(/\s+/g, '').replace(/\d+$/, ''); return /^[가-힣]{3}$/.test(s) ? s.slice(1) : s; }
  function dayMs(key) { return Date.parse(key + 'T00:00:00Z'); }
  function keyOf(ms) { return new Date(ms).toISOString().slice(0, 10); }
  function addDays(key, n) { return keyOf(dayMs(key) + n * 864e5); }
  // 고른 주(tWeek: 0 이번 주, -1 지난주 …)의 월요일~일요일 · 월간은 그 주 일요일(오늘을 넘지 않게)이 든 달
  function weekRange(off) {
    var today = KBData.todayKey(), dow = (new Date(dayMs(today)).getUTCDay() + 6) % 7, mon = addDays(today, -dow + 7 * off), sun = addDays(mon, 6);
    var ref = sun > today ? today : sun;
    return { today: today, mon: mon, sun: sun, days: [0, 1, 2, 3, 4, 5, 6].map(function (i) { return addDays(mon, i); }), month: ref.slice(0, 7) };
  }
  function needDays(off) { var w = weekRange(off), from = w.mon < w.month + '-01' ? w.mon : w.month + '-01'; return Math.min(400, Math.max(14, Math.round((dayMs(w.today) - dayMs(from)) / 864e5) + 1)); }
  // 날짜 → 이름 → { answered, records } (이름은 성 뺀 이름으로 합침)
  function byPerson(days) {
    var out = {};
    Object.keys(days || {}).forEach(function (d) { var x = days[d] || {}, o = out[d] = {}; Object.keys(x).forEach(function (n) { var k = person(n); if (!k) return; var v = x[n] || {}, s = o[k] || (o[k] = { answered: 0, records: 0 }); s.answered += v.answered || 0; s.records += v.records || 0; }); });
    return out;
  }
  function countPanel(w, days) {
    var R = weekRange(tWeek), P = byPerson(days), WD = ['월', '화', '수', '목', '금', '토', '일'];
    var p = mk('div', 'panel'); p.style.maxWidth = '980px';
    var hd = mk('div', 'ins'); hd.append(mk('span', null, '상담사별 건수'));
    var prev = btn('◀ 지난주', null, function () { tWeek--; team(w); }), cur = btn('이번 주', null, function () { tWeek = 0; team(w); }), next = btn('다음 주 ▶', null, function () { tWeek++; team(w); });
    [prev, cur, next].forEach(function (b) { b.className = ''; }); if (tWeek === 0) { cur.className = 'on'; next.disabled = true; }
    var md = function (k) { return Number(k.slice(5, 7)) + '/' + Number(k.slice(8, 10)); };
    hd.append(prev, cur, next, mk('span', null, md(R.mon) + '(월) ~ ' + md(R.sun) + '(일)'));
    p.append(hd);
    var weekend = [5, 6].filter(function (i) { var o = P[R.days[i]] || {}; return Object.keys(o).some(function (n) { return o[n].answered || o[n].records; }); });
    var cols = [0, 1, 2, 3, 4].concat(weekend);
    var names = {}, add = function (d) { Object.keys(P[d] || {}).forEach(function (n) { names[n] = 1; }); };
    R.days.forEach(add); Object.keys(P).forEach(function (d) { if (d.slice(0, 7) === R.month) add(d); });
    var list = Object.keys(names).sort(function (a, b) { return a.localeCompare(b, 'ko'); });
    if (!list.length) { p.append(mk('div', 'empty', '이 주에는 쌓인 숫자가 아직 없어요.')); w.append(p); return; }
    var get = function (n, d) { var o = P[d] && P[d][n]; return o || { answered: 0, records: 0 }; };
    var sumOf = function (n, keys) { return keys.reduce(function (s, d) { var o = get(n, d); s.answered += o.answered; s.records += o.records; return s; }, { answered: 0, records: 0 }); };
    var monthKeys = Object.keys(P).filter(function (d) { return d.slice(0, 7) === R.month && d <= R.today; });
    var cellOf = function (o, future, cls) {
      var td = mk('td', 'tc' + (cls ? ' ' + cls : ''));
      if (future) { td.textContent = ''; return td; }
      if (!o.answered && !o.records) { td.append(mk('span', 'z', '–')); return td; }
      td.append(mk('b', null, String(o.answered)), mk('small', null, '기록 ' + o.records)); return td;
    };
    var tb = mk('table', 'ttable tcount'), tr = mk('tr');
    tr.append(mk('th', null, '상담사'));
    cols.forEach(function (i) { var th = mk('th', R.days[i] === R.today ? 'now' : null, WD[i] + ' ' + md(R.days[i])); tr.append(th); });
    tr.append(mk('th', 'sum', '주간'), mk('th', 'sum', Number(R.month.slice(5)) + '월'));
    var th = mk('thead'); th.append(tr); tb.append(th);
    var bd = mk('tbody'), tot = { days: {}, week: { answered: 0, records: 0 }, month: { answered: 0, records: 0 } };
    list.forEach(function (n) {
      var r = mk('tr'); r.append(mk('td', null, n));
      cols.forEach(function (i) { var d = R.days[i], o = get(n, d), t = tot.days[d] || (tot.days[d] = { answered: 0, records: 0 }); t.answered += o.answered; t.records += o.records; r.append(cellOf(o, d > R.today)); });
      var wk = sumOf(n, R.days.filter(function (d) { return d <= R.today; })), mo = sumOf(n, monthKeys);
      ['answered', 'records'].forEach(function (k) { tot.week[k] += wk[k]; tot.month[k] += mo[k]; });
      r.append(cellOf(wk, false, 'sum'), cellOf(mo, false, 'sum')); bd.append(r);
    });
    var tr2 = mk('tr', 'total'); tr2.append(mk('td', null, '팀 합계'));
    cols.forEach(function (i) { var d = R.days[i]; tr2.append(cellOf(tot.days[d] || { answered: 0, records: 0 }, d > R.today)); });
    tr2.append(cellOf(tot.week, false, 'sum'), cellOf(tot.month, false, 'sum')); bd.append(tr2);
    tb.append(bd); var wrap = mk('div', 'twrap'); wrap.append(tb); p.append(wrap);
    p.append(mk('p', 'muted', '큰 숫자 = 답한 상담(카톡·톡톡 대기 목록에서 빠진 수) · 작은 숫자 = 기록(게시판 포함) · 상담사 PC 기록기가 켜져 있던 동안만 세요 · 이름은 성 뺀 이름(카톡 영원3 · 톡톡 김영원 → 영원)'));
    w.append(p);
  }
  async function team(w) {
    clearTimeout(tTimer);
    var T = '팀 현황';
    if (!w.querySelector('.tgrid')) w.replaceChildren(mk('h2', null, T), mk('p', 'desc', '상담사 기록기가 1분마다 보내는 숫자예요(고객 이름·대화 내용은 안 보내요). 기다린 시간은 업무시간만 셈(주말·공휴일·점심·퇴근 뒤 빼고 · 18시 뒤 새 문의는 다음 날 10시부터). 20분 넘게 기다리는 고객이 있으면 빨갛게 보여요. 30초마다 새로 읽어요.'), mk('div', 'empty', '불러오는 중…'));
    if (!(await ensureUrl())) { needServer(w, T); return; }
    var r; try { r = await CSTeam.call('team.get', { days: needDays(tWeek) }); } catch (e) { w.replaceChildren(mk('h2', null, T), mk('div', 'empty', '불러오지 못했어요. ' + e.message)); return; }
    var keepScroll = w.scrollTop;
    w.replaceChildren(mk('h2', null, T), mk('p', 'desc', '상담사 기록기가 1분마다 보내는 숫자예요(고객 이름·대화 내용은 안 보내요). 기다린 시간은 업무시간만 셈(주말·공휴일·점심·퇴근 뒤 빼고 · 18시 뒤 새 문의는 다음 날 10시부터). 20분 넘게 기다리는 고객이 있으면 빨갛게 보여요. 30초마다 새로 읽어요.'));
    var ub = await updateBox(); if (ub) w.append(ub);
    // 상담사 고르기: 전체 · 사람별 한 장
    var K2 = window.KBTeam2, dn = []; Object.keys(r.days || {}).forEach(function (d) { Object.keys(r.days[d] || {}).forEach(function (n) { dn.push(person(n)); }); });
    var names = K2 ? (await K2.teamNames((r.live || []).map(function (x) { return person(x.name); }).concat(dn))).filter(function (n) { return n !== '팀장'; }) : [];
    if (K2) {
      w.append(K2.personBar(names, null, function () { team(w); }));
      var who = K2.picked();
      if (who && who !== '팀장') {
        var R0 = weekRange(tWeek), wn = mk('div', 'ins qnav'), md0 = function (k) { return Number(k.slice(5, 7)) + '/' + Number(k.slice(8, 10)); };
        var pv = btn('◀ 지난주', null, function () { tWeek--; team(w); }), cu = btn('이번 주', null, function () { tWeek = 0; team(w); }), nx = btn('다음 주 ▶', null, function () { tWeek++; team(w); });
        [pv, cu, nx].forEach(function (b) { b.className = ''; }); if (tWeek === 0) { cu.className = 'on'; nx.disabled = true; }
        wn.append(pv, cu, nx, mk('span', null, md0(R0.mon) + '(월) ~ ' + md0(R0.sun) + '(일)'));
        await K2.personTeam(w, who, r, R0); w.insertBefore(wn, w.querySelector('.panel.wide:last-of-type'));
        w.scrollTop = keepScroll;
        tTimer = setTimeout(function () { if (A() && w.isConnected && document.querySelector('.phead')) team(w); }, 30000);
        return;
      }
    }
    var live = (r.live || []).slice().sort(function (a, b) { return (b.oldestMin || 0) - (a.oldestMin || 0); });
    var g = mk('div', 'tgrid');
    if (!live.length) g.append(mk('div', 'empty', '아직 신호를 보낸 상담사가 없어요.\n상담사 PC 기록기가 2.3.11 이상이어야 해요(팀 서버 주소가 들어 있는 판).'));
    live.forEach(function (x) {
      var off = Date.now() - x.at > 3 * 60000, hot = !off && (x.oldestMin || 0) >= 20, warm = !off && !hot && (x.oldestMin || 0) >= 10;
      var c = mk('div', 'tcard go' + (off ? ' off' : hot ? ' hot' : warm ? ' warm' : '')); c.title = '눌러서 ' + person(x.name) + ' 한 장 보기';
      c.addEventListener('click', function (e) { if (e.target.closest('a')) return; if (window.KBTeam2) { KBTeam2.pick(person(x.name)); team(w); } });
      var h = mk('div', 'th'); h.append(mk('b', null, x.name), mk('span', 'muted', off ? '신호 없음 · ' + ago(x.at) : ago(x.at))); c.append(h);
      var big = mk('div', 'tbig'); big.append(mk('span', 'n', off ? '–' : String(x.pending || 0)), mk('span', 'u', '명 대기'));
      var old = mk('div', 'told', off ? '기록기가 꺼져 있거나 목록 탭을 닫았어요' : x.pending ? '가장 오래 ' + (x.oldestMin || 0) + '분' : '기다리는 고객 없음'); c.append(big, old);
      var m = mk('div', 'tmeta'); m.append(mk('span', null, '20분 넘음 ' + (x.over20 || 0)), mk('span', null, '보류 ' + (x.held || 0)), mk('span', null, '오늘 기록 ' + (x.records || 0)));
      if (x.miss) { var ms = mk('a', 'tlink', '기록 안 함 ' + x.miss); ms.href = '#'; ms.addEventListener('click', function (e) { e.preventDefault(); A().setView('qa'); }); m.append(ms); }
      if (x.lh) { var lh = mk('a', 'tlink', '오래된 상담 ' + x.lh); lh.href = '#'; lh.addEventListener('click', function (e) { e.preventDefault(); A().setView('qa'); }); m.append(lh); }
      if (x.channels) m.append(mk('span', null, x.channels));
      c.append(m); g.append(c);
    });
    w.append(g);
    countPanel(w, r.days || {});
    // 하루 합계
    var days = r.days || {}, keys = Object.keys(days).sort().reverse(), today = KBData.todayKey();
    var p = mk('div', 'panel'); p.style.maxWidth = '980px';
    var hd = mk('div', 'ins'); hd.append(mk('span', null, '하루 합계'));
    [['today', '오늘'], ['yday', '어제'], ['d7', '최근 7일'], ['d14', '최근 14일']].forEach(function (f) { var b = mk('button', null, f[1]); b.type = 'button'; if (tDay === f[0]) b.className = 'on'; b.addEventListener('click', function () { tDay = f[0]; team(w); }); hd.append(b); });
    p.append(hd);
    var pick = tDay === 'today' ? [today] : tDay === 'yday' ? [KBData.todayKey(Date.now() - 864e5)] : keys.slice(0, tDay === 'd7' ? 7 : 14);
    var sum = {};
    pick.forEach(function (d) { var x = days[d] || {}; Object.keys(x).forEach(function (n) { var s = sum[person(n)] || (sum[person(n)] = { answered: 0, waitSum: 0, over20: 0, maxWait: 0, holds: 0, records: 0 }), v = x[n]; ['answered', 'waitSum', 'over20', 'holds', 'records'].forEach(function (k) { s[k] += v[k] || 0; }); s.maxWait = Math.max(s.maxWait, v.maxWait || 0); }); });
    var names = Object.keys(sum).sort(function (a, b) { return sum[b].over20 - sum[a].over20 || a.localeCompare(b); });
    if (!names.length) p.append(mk('div', 'empty', '이 기간 합계가 아직 없어요.'));
    else {
      var tb = mk('table', 'ttable'), tr = mk('tr');
      ['상담사', '답한 상담', '평균 대기', '20분 넘김', '가장 오래', '보류', '기록'].forEach(function (t) { tr.append(mk('th', null, t)); }); var th = mk('thead'); th.append(tr); tb.append(th);
      var bd = mk('tbody');
      names.forEach(function (n) { var s = sum[n], r2 = mk('tr'); r2.append(mk('td', null, n), mk('td', null, String(s.answered)), mk('td', null, s.answered ? Math.round(s.waitSum / s.answered) + '분' : '–'), mk('td', s.over20 ? 'bad' : null, String(s.over20)), mk('td', s.maxWait >= 20 ? 'bad' : null, s.maxWait ? s.maxWait + '분' : '–'), mk('td', null, String(s.holds)), mk('td', null, String(s.records))); bd.append(r2); });
      tb.append(bd); var wrap = mk('div', 'twrap'); wrap.append(tb); p.append(wrap);
      p.append(mk('p', 'muted', '평균 대기 = 고객이 기다리기 시작해서 답할 때까지 걸린 시간의 평균 · 20분 넘김 = 한 번이라도 20분 넘게 기다리게 한 상담 수 · 기록기 2.4.0부터 업무시간만 셈(주말·공휴일·점심·퇴근 뒤 빼고)'));
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

  window.KBTeam = { usage: usage, loadUsage: loadUsage, ensureUrl: ensureUrl, adminToken: adminToken, needServer: needServer, person: person, when: when };
  var add = function () { if (!window.KBAdminExtra) return setTimeout(add, 50); Object.assign(KBAdminExtra.views, { board: board, team: team, teamsetup: setup }); };
  add();
  setTimeout(loadUsage, 1500);
})();
