/* 멘트 관리에 더한 화면 3 (팀 서버 1.3.0 · 기록기 2.4.0)
   · 업무 흐름: 시간대별 기록 · 시간당 건수 · 기록 사이 텀 · 게시판 사이트별 건수
   · 확인할 상담: 기록 안 한 상담 · 20분 넘긴 상담 · 오래된 상담 · 공지 확인
   · 근무 달력: 야근 신청 승인 · 이달 합계 · 공휴일 · 상담사 명단 · 비수기 */
(function () {
  'use strict';
  var A = function () { return window.KBAdminApp; }, T = function () { return window.KBTeam; };
  function mk(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function btn(label, cls, fn) { var b = mk('button', 'btn ' + (cls || 'ghost'), label); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; }
  function say(t, k) { if (A()) A().say(t, k); }
  var W = window.WorkClock, WD = ['일', '월', '화', '수', '목', '금', '토'];
  function today() { return W.dayKey(Date.now()); }
  function md(k) { return Number(k.slice(5, 7)) + '/' + Number(k.slice(8, 10)) + '(' + WD[W.weekday(k)] + ')'; }
  function hhmm(min) { return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0'); }
  function clock(ms) { return ms ? hhmm(W.minuteOf(ms)) : ''; }
  function hm(mins) { var h = Math.floor(mins / 60), m = mins % 60; return (h ? h + '시간' : '') + (m ? (h ? ' ' : '') + m + '분' : h ? '' : '0분'); }
  function diffDays(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5); }
  function addMonth(m, n) { var y = Number(m.slice(0, 4)), mo = Number(m.slice(5, 7)) - 1 + n; y += Math.floor(mo / 12); mo = ((mo % 12) + 12) % 12; return y + '-' + String(mo + 1).padStart(2, '0'); }
  function monthEnd(m) { return W.addDays(addMonth(m, 1) + '-01', -1); }
  function chName(ch) { return ch === 'naver' ? '톡톡' : '카톡'; }
  function link(x, label) { var a = mk('a', 'qlink', label || '열기'); if (x.u) { a.href = x.u; a.target = '_blank'; a.rel = 'noopener'; } else a.className += ' off'; return a; }
  function table(head, rows, cls) {
    var tb = mk('table', 'ttable' + (cls ? ' ' + cls : '')), tr = mk('tr'); head.forEach(function (h) { tr.append(mk('th', null, h)); });
    var th = mk('thead'); th.append(tr); tb.append(th); var bd = mk('tbody');
    rows.forEach(function (r) { var t2 = mk('tr', r.cls || null); r.cells.forEach(function (c) { var td = mk('td', c && c.cls || null); if (c && c.node) td.append(c.node); else td.textContent = c && typeof c === 'object' ? c.text : String(c); if (c && c.title) td.title = c.title; t2.append(td); }); bd.append(t2); });
    tb.append(bd); var wrap = mk('div', 'twrap'); wrap.append(tb); return wrap;
  }
  async function ready(w, title, desc) {
    if (CSTeam.ready()) CSTeam.get('cfg.get', {}).catch(function () {}); // 명단은 미리(다른 요청과 함께)
    w.replaceChildren(mk('h2', null, title), mk('p', 'desc', desc), mk('div', 'empty', '불러오는 중…'));
    if (!(await T().ensureUrl())) { T().needServer(w, title); return false; }
    return true;
  }
  var cfgCache = null;
  async function getCfg(force) { if (!cfgCache || force) cfgCache = await CSTeam.get('cfg.get', {}); return cfgCache; }
  // 명단(입사~퇴사 사이) — 비어 있으면 팀 현황에 신호를 보낸 이름
  function activeNames(roster, day, fallback) {
    var r = (roster || []).filter(function (x) { return (!x.start || x.start <= day) && (!x.end || x.end >= day); }).map(function (x) { return x.name; });
    return r.length ? r : (fallback || []);
  }

  /* ───── 상담사 모두를 한 화면에: 사람마다 한 칸(누를 필요 없음) ───── */
  async function teamNames(extra) {
    var cfg = await getCfg().catch(function () { return null; }), td = today(), set = {};
    activeNames(cfg && cfg.roster, td, []).forEach(function (n) { set[n] = 1; });
    (extra || []).forEach(function (n) { if (n) set[n] = 1; });
    var full = {}; ((cfg && cfg.roster) || []).forEach(function (x) { full[x.name] = x.full || x.name; });
    return Object.keys(set).sort(function (a, b) { return (a === '팀장') - (b === '팀장') || (full[a] || a).localeCompare(full[b] || b, 'ko'); });
  }
  function stat(label, value, cls, title) { var t = mk('div', 'st' + (cls ? ' ' + cls : '')); t.append(mk('b', null, value), mk('span', null, label)); if (title) t.title = title; return t; }
  function ago(t) { var m = Math.floor((Date.now() - t) / 60000); return m < 1 ? '방금' : m < 60 ? m + '분 전' : Math.floor(m / 60) + '시간 전'; }
  // 세로 막대(값 위에 숫자 · 아래 이름) — 한 가지 색, 마우스를 올리면 설명
  function bars(list, opt) {
    opt = opt || {}; var max = Math.max(1, opt.max || 0); list.forEach(function (x) { max = Math.max(max, x.v || 0); });
    var box = mk('div', 'vb' + (opt.cls ? ' ' + opt.cls : ''));
    list.forEach(function (x) {
      var c = mk('div', 'vc' + (x.cls ? ' ' + x.cls : '')), w = mk('div', 'vw'), b = mk('span', 'vbar');
      b.style.height = (x.v ? Math.max(4, x.v / max * 100) : 0) + '%'; w.append(b);
      c.append(mk('b', 'vv', x.v ? String(x.v) : (x.blank ? '' : '·')), w, mk('span', 'vl', x.label));
      if (x.title) c.title = x.title; box.append(c);
    });
    return box;
  }

  /* ───── 숫자 점검(2.4.2) ─────
     하루 숫자가 상식 밖이면 카드에 이유를 적어 줌. 기준은 일부러 넉넉하게(진짜 이상할 때만 뜨게) */
  function verLt(a, b) { var x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (var i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0); } return false; }
  function sanity(n, s, x, off, cs, cfg, now) {
    var out = [], WC = window.WorkClock;
    if (x && x.dup) out.push('같은 이름(' + n + ')으로 PC ' + (x.pcs || 2) + '대가 보내고 있어요 — 합쳐서 보여 줘요(대기는 겹치지 않게, 기록은 더해서). 한 크롬에 기록기가 두 개 깔렸거나 다른 PC에 같은 태그가 들어갔을 수 있어요' + (x.vs ? ' · 판 ' + x.vs.join(' / ') : ''));
    if (x && x.v && verLt(x.v, '2.4.2')) out.push('기록기 ' + x.v + ' — 2.4.2 전 판은 같은 상담을 여러 번 셀 수 있어요(곧 저절로 업데이트돼요)');
    if (s.answered >= 15 && s.answered > Math.max(3, s.records) * 3) out.push('답한 상담 ' + s.answered + '건에 기록은 ' + s.records + '건이에요. 기록을 빠뜨렸거나, 기록기 2.4.2 전이라 같은 상담을 여러 번 셌을 수 있어요');
    if (s.answered >= 10 && s.over20 / s.answered >= 0.6) out.push('답한 상담의 ' + Math.round(s.over20 / s.answered * 100) + '%가 20분 넘김이에요. 오래 남은 상담이 숫자를 끌어올렸는지 아래 대기를 봐 주세요');
    if (s.answered && s.waitSum / s.answered >= 120) out.push('평균 대기가 ' + Math.round(s.waitSum / s.answered) + '분이에요. 하루 넘게 남아 있던 상담이 섞였을 가능성이 커요');
    var pend = (cs && cs.pend) || [], longOnes = WC ? pend.filter(function (p) { return p.s && WC.bizMs(p.s, now, cfg, true) >= 4 * 3600e3; }) : [];
    if (longOnes.length) out.push('업무시간으로 4시간 넘게 대기로 남은 상담 ' + longOnes.length + '건. 답할 필요가 없는 상담(인사·감사)이면 패널에서 [보류]를 눌러야 숫자에서 빠져요');
    if (x && !off && cs && cs.st) Object.keys(cs.st).forEach(function (ch) { var v = cs.st[ch]; if (!v.ok && v.tag) out.push((ch === 'naver' ? '톡톡' : '카톡') + (v.at ? ' 목록 읽기가 정상이 아니에요(' + ago(v.at) + ' 마지막 확인)' : ' 목록을 한 번도 못 읽었어요(이 채널을 안 쓰면 기록기 설정에서 끄기)')); });
    return out;
  }

  /* ───── 팀 현황 카드: 지금 · 오늘 · 이번 주 · 확인할 것(상담사마다 한 칸) ───── */
  async function teamCards(r, R) {
    await (T().syncLead ? T().syncLead() : null);
    var P = T().person, td = today(), now = Date.now(), days = r.days || {};
    var q = await CSTeam.get('qa.get', { days: 1 }).catch(function () { return { days: {}, live: {} }; });
    // 숫자 점검용: 지금 대기 중인 상담(대기 시작 시각만) · 근무 설정(공휴일)
    var cl = await CSTeam.get('cases.get', {}).catch(function () { return { list: [] }; }), wcfg = ((await getCfg().catch(function () { return null; })) || {}).cfg || {};
    var cbn = {}; (cl.list || []).forEach(function (x) { cbn[P(x.name)] = x; });
    var live = {}; (r.live || []).forEach(function (x) { live[P(x.name)] = x; });
    var ql = {}; Object.keys(q.live || {}).forEach(function (n) { ql[P(n)] = q.live[n]; });
    var qd = (q.days || {})[td] || {}, rt = {}, late = {}; Object.keys(qd).forEach(function (n) { var k = P(n); rt[k] = (rt[k] || []).concat(qd[n].rt || []); late[k] = (late[k] || []).concat(qd[n].late || []); });
    var sum = function (name, keys) { var o = { answered: 0, waitSum: 0, over20: 0, maxWait: 0, holds: 0, records: 0 }; keys.forEach(function (d) { var x = days[d] || {}; Object.keys(x).forEach(function (n) { if (P(n) !== name) return; var v = x[n]; ['answered', 'waitSum', 'over20', 'holds', 'records'].forEach(function (k) { o[k] += v[k] || 0; }); o.maxWait = Math.max(o.maxWait, v.maxWait || 0); }); }); return o; };
    var dn = []; Object.keys(days).forEach(function (d) { Object.keys(days[d] || {}).forEach(function (n) { dn.push(P(n)); }); });
    var names = (await teamNames(Object.keys(live).concat(dn))).filter(function (n) { return n !== '팀장'; });
    var grid = mk('div', 'pgrid'), WDN = ['월', '화', '수', '목', '금', '토', '일'];
    // 순서는 늘 같게(명단 가나다순) — 급한 칸은 색으로 보임
    names.forEach(function (n) {
      var x = live[n], off = !x || now - x.at > 3 * 60000, hot = !off && (x.oldestMin || 0) >= 20, warm = !off && !hot && (x.oldestMin || 0) >= 10;
      var c = mk('div', 'pcard' + (off ? ' off' : hot ? ' hot' : warm ? ' warm' : ''));
      // 머리: 이름 · 지금
      var h = mk('div', 'pch'); h.append(mk('span', 'av', n.slice(0, 1)), mk('b', 'pn', n), mk('span', 'sp'));
      if (off) h.append(mk('span', 'pill off', x ? '신호 없음 · ' + ago(x.at) : '오늘 신호 없음'));
      else { h.append(mk('span', 'pill' + (hot ? ' hot' : warm ? ' warm' : ''), x.pending ? x.pending + '명 대기 · 가장 오래 ' + (x.oldestMin || 0) + '분' : '대기 없음')); }
      c.append(h);
      // 오늘
      var s = sum(n, [td]), row = mk('div', 'pst');
      row.append(stat('답한 상담', String(s.answered)), stat('평균 대기', s.answered ? Math.round(s.waitSum / s.answered) + '분' : '–', '', '업무시간 기준'), stat('20분 넘김', String(s.over20), s.over20 ? 'bad' : ''), stat('기록', String(s.records)));
      c.append(mk('div', 'psub', '오늘'), row);
      // 이번 주(요일별 답한 상담)
      var list = R.days.map(function (d, i) { var o = sum(n, [d]); return { d: d, i: i, v: o.answered, rec: o.records }; }).filter(function (o) { return o.i < 5 || o.v; })
        .map(function (o) { return { v: o.d > td ? 0 : o.v, blank: o.d > td, label: WDN[o.i], cls: o.d === td ? 'now' : '', title: md(o.d) + ' · 답한 상담 ' + o.v + ' · 기록 ' + o.rec }; });
      var wk = sum(n, R.days.filter(function (d) { return d <= td; })), mo = sum(n, Object.keys(days).filter(function (d) { return d.slice(0, 7) === R.month && d <= td; }));
      var wh = mk('div', 'psub'); wh.append(mk('span', null, '이번 주 답한 상담'), mk('span', 'sp'), mk('span', null, '주 ' + wk.answered + ' · ' + Number(R.month.slice(5)) + '월 ' + mo.answered));
      c.append(wh, bars(list, { cls: 'sm' }));
      // 숫자 점검: 말이 안 되는 숫자는 이유와 함께 바로 알려 줌(팀장이 일일이 보지 않아도 잡히게)
      var wl = sanity(n, s, x, off, cbn[n], wcfg, now);
      if (wl.length) { var wb = mk('div', 'pwarn'); wl.forEach(function (t) { wb.append(mk('div', null, '⚠ ' + t)); }); c.append(wb); }
      // 확인할 것 · 오늘 흐름(누르면 그 화면)
      var f = flowOf(rt[n] || []), qn = ql[n] || {}, miss = (qn.miss || []).length, lh = (qn.lh || []).length, lt = (late[n] || []).length;
      var ft = mk('div', 'pfoot');
      var tag = function (t, v, cls, view) { var b = mk('button', 'ptag' + (cls ? ' ' + cls : ''), t + ' ' + v); b.type = 'button'; b.addEventListener('click', function () { A().setView(view); }); ft.append(b); };
      // 2.4.0 전 기록기는 확인할 것·기록 시각을 안 보냄(신호는 오는데 qa가 없음) → 고장처럼 안 보이게 알려 줌
      if (x && !off && !ql[n]) ft.append(mk('div', 'pold', '기록기 업데이트 전이에요 · 확인할 것·업무 흐름·게시판 건수는 2.4.0으로 바뀐 뒤부터 쌓여요'));
      else {
        tag('기록 안 함', miss, miss ? 'bad' : 'ok', 'qa'); tag('20분 넘김', lt, lt ? 'bad' : 'ok', 'qa'); tag('오래된', lh, lh ? 'warn' : 'ok', 'qa');
        tag('시간당', f.n ? f.perHour.toFixed(1) : '–', '', 'flow'); tag('빈 구간', f.n ? f.long.length : '–', f.long.length ? 'warn' : '', 'flow');
      }
      c.append(ft);
      grid.append(c);
    });
    if (!names.length) grid.append(mk('div', 'empty', '아직 신호를 보낸 상담사가 없어요.'));
    return grid;
  }

  /* ───── 2.4.3 팀 현황 한 장(팀 서버 1.3.6 · 기록기 2.4.3) ─────
     위 네 칸: 지금 대기 · 기록 · 문의→기록 · 챙길 것 / 아래: 상담사마다 한 줄
     · '지금 대기'와 '챙길 것'은 늘 지금 숫자, '기록'과 '문의→기록'은 고른 기간(오늘·어제·이번 주·이번 달)
     · 기록 = 시트 저장이 확인된 기록(같은 날 같은 방 1건) · 문의→기록 = 고객 문의부터 기록 버튼까지 업무시간(채팅만)
     · 2.4.3 전 기록기는 문의→기록을 안 보냄('–') · 기록은 예전처럼 접수 기준 */
  var IR_TIP = '고객 문의부터 상담 기록 버튼을 누르기까지 걸린 업무시간이에요(채팅만 · 가운데 값). 실제 답변 완료 시간과는 달라요. 몰아서 기록하면 길게 나와요. 측정 = 문의 시작을 찾은 기록 수 / 기록 = 그 기간 채팅 기록 수';
  function periodKeys(period) {
    var td = today(), out = [];
    if (period === 'yday') { var y = W.addDays(td, -1); while (!W.day(y, {}) && out.length < 1 && y > W.addDays(td, -10)) y = W.addDays(y, -1); return [y]; }
    if (period === 'week') { var dow = (W.weekday(td) + 6) % 7; for (var i = dow; i >= 0; i--) out.push(W.addDays(td, -i)); return out; }
    if (period === 'month') { var d = td.slice(0, 8) + '01'; while (d <= td) { out.push(d); d = W.addDays(d, 1); } return out; }
    return [td];
  }
  function medianOf(v) { if (!v.length) return null; var a = v.slice().sort(function (x, y) { return x - y; }), h = a.length >> 1; return a.length % 2 ? a[h] : Math.round((a[h - 1] + a[h]) / 2); }
  function tile(label, big, sub, opt) {
    opt = opt || {}; var t = mk(opt.onClick ? 'button' : 'div', 'btile' + (opt.cls ? ' ' + opt.cls : ''));
    if (opt.onClick) { t.type = 'button'; t.addEventListener('click', opt.onClick); }
    var hd = mk('div', 'btl'); hd.append(mk('span', null, label)); if (opt.tag) hd.append(mk('span', 'btag', opt.tag)); if (opt.tip) { var i = mk('span', 'binfo', 'ⓘ'); i.title = opt.tip; hd.append(i); }
    t.append(hd, mk('b', 'bbig', big), mk('span', 'bsub', sub)); if (opt.tip) t.title = opt.tip; return t;
  }
  /* ───── 2.4.4 팀 현황: 상담사마다 가로 판 하나(목업2) ─────
     이름 줄: 카톡·톡톡 연결 상태 알약 + 한 줄 요약 · 지금 기다리는 고객(오래 기다린 순 5명: 이름·마지막 말) · 기록(건수·시간당·시간대 막대·공백 경고)
     · 답했는데 기록 없음(펼치면 목록: 답하기 전 고객 마지막 말 · 사이트에서 종료됐는지) */
  var openMiss = {};
  var CONN_LABEL = { ok: '연결됨', off: '안 씀', setup: '태그 없음', missing: '목록 탭 없음', login: '로그인 필요', reload: '새로고침 필요', connecting: '연결 중' };
  function connsOf(x, cs) {
    if (x && Array.isArray(x.conn) && x.conn.length) return x.conn;
    // 2.4.3 전 기록기: 팀장 보기 맞추기 자료(cs.st)로 짐작
    var out = []; ['kakao', 'naver'].forEach(function (ch) { var v = cs && cs.st && cs.st[ch]; if (v) out.push({ ch: ch, u: v.tag ? 1 : 0, s: v.ok ? 'ok' : v.tag ? 'connecting' : 'off', at: v.at || 0 }); });
    // 그것도 없으면 예전 글자(‘카톡 · 톡톡 끊김’)로
    if (!out.length && x && x.channels) String(x.channels).split('·').forEach(function (t) { t = t.trim(); var ch = /^톡톡/.test(t) ? 'naver' : /^카톡/.test(t) ? 'kakao' : ''; if (ch) out.push({ ch: ch, u: 1, s: /끊김/.test(t) ? 'connecting' : 'ok', at: 0 }); });
    return out;
  }
  function pill(ch, label, cls, title) { var p = mk('span', 'cpill ' + cls); p.append(mk('span', 'clg ' + ch, ch === 'naver' ? '톡톡' : ch === 'board' ? '게시판' : '카톡'), mk('span', null, label)); if (title) p.title = title; return p; }
  function bizHours(keys, now, cfg) { return keys.reduce(function (s, d) { var s0 = W.dayStart(d); return s + W.bizMs(s0, Math.min(now, s0 + 864e5), cfg, true); }, 0) / 3600e3; }
  function missStatus(x) { return x.e ? ['st end', '상담 종료됨'] : x.r ? ['st back', '고객이 다시 기다림'] : x.n || x.p ? ['st ing', '진행 중'] : ['st ing', '–']; }
  async function board(r, period) {
    await (T().syncLead ? T().syncLead() : null);
    var P = T().person, leadAs = P('팀장'), td = today(), now = Date.now(), days = r.days || {}, keys = periodKeys(period), isToday = keys.length === 1 && keys[0] === td;
    var back = Math.min(62, diffDays(keys[0], td) + 1);
    var got = await Promise.all([CSTeam.get('qa.get', { days: back }).catch(function () { return { days: {}, live: {} }; }), CSTeam.get('cases.get', {}).catch(function () { return { list: [] }; }), getCfg().catch(function () { return null; })]);
    var q = got[0], cl = got[1], wcfg = (got[2] || {}).cfg || {}, tok = await T().adminToken();
    var cbn = {}; (cl.list || []).forEach(function (x) { cbn[P(x.name)] = x; });
    var live = {}; (r.live || []).forEach(function (x) { live[P(x.name)] = x; });
    var ql = {}; Object.keys(q.live || {}).forEach(function (n) { ql[P(n)] = q.live[n]; });
    var dn = []; Object.keys(days).forEach(function (d) { Object.keys(days[d] || {}).forEach(function (n) { dn.push(P(n)); }); });
    var names = (await teamNames(Object.keys(live).concat(dn))).filter(function (n) { return n !== '팀장'; });
    var periodName = { today: '오늘', yday: '어제', week: '이번 주', month: '이번 달' }[period] || '오늘';
    var hours = bizHours(keys, now, wcfg), wd = W.day(td, wcfg), lead = r.lead && now - (r.lead.at || 0) <= 3 * 60000 ? r.lead : null;
    var box = mk('div', 'tboard2'), totP = 0, tot20 = 0, partAny = 0;
    var rtOf = function (n, d) { var qd = (q.days || {})[d] || {}, v = []; Object.keys(qd).forEach(function (k) { if (P(k) === n) v = v.concat(qd[k].rt || []); }); return v.sort(function (a, b) { return a - b; }); };
    var recOf = function (n, d, x, fresh) { var dd = days[d] || {}, s = 0, sites = {}; Object.keys(dd).forEach(function (k) { if (P(k) !== n) return; var v = dd[k] || {}; if (!(d === td && fresh && k !== '팀장')) s += v.records || 0; Object.keys(v.sites || {}).forEach(function (st) { sites[st] = (sites[st] || 0) + v.sites[st]; }); }); if (d === td && fresh) s += x.records || 0; return { n: s, sites: sites }; };
    var rows = mk('div', 'pplist');
    names.forEach(function (n) {
      var isLead = n === leadAs && !live[n], x = isLead ? lead : live[n], fresh = !!(x && now - x.at <= 3 * 60000), cs = cbn[n], qn = ql[n] || {};
      // 기간 기록 · 시간대
      var recN = 0, boardN = 0; keys.forEach(function (d) { var o = recOf(n, d, x, fresh && !isLead); recN += o.n; Object.keys(o.sites).forEach(function (s) { boardN += o.sites[s]; }); });
      var rtT = rtOf(n, td), lastMin = rtT.length ? rtT[rtT.length - 1] : -1, lastMs = lastMin >= 0 ? W.dayStart(td) + lastMin * 60000 : 0;
      var nowMin = W.minuteOf(now), inWork = !!(wd && nowMin >= wd.open && nowMin < wd.workEnd && (nowMin < wd.lunch[0] || nowMin >= wd.lunch[1]));
      var gap = isToday && fresh && inWork && lastMs ? Math.floor(W.bizMs(lastMs, now, wcfg, true) / 60000) : 0;
      var conns = fresh ? connsOf(x, cs) : [], bad = conns.filter(function (c) { return c.u && c.s !== 'ok'; });
      var miss = (qn.miss || []).slice().sort(function (a, b) { return (b.e || 0) - (a.e || 0) || (b.at || 0) - (a.at || 0); }), missE = miss.filter(function (m) { return m.e; }).length;
      var top = x && Array.isArray(x.top) ? x.top : null, pend = fresh && !isLead ? (x.pending || 0) : 0, oldest = fresh && !isLead ? (x.oldestMin || 0) : 0;
      if (fresh && !isLead) { totP += pend; tot20 += x.over20 || 0; if (bad.length) partAny = 1; }
      // 한 줄 요약
      var sayT = '', sayC = 'g';
      if (!x || !fresh) { sayT = x ? '기록기 꺼짐 · 마지막 신호 ' + clock(x.at) + ' (' + ago(x.at) + ')' : '오늘 신호 없음'; sayC = 'm'; }
      else if (bad.length && !isLead) { var b0 = bad[0]; sayT = chName(b0.ch) + ' 끊김(' + CONN_LABEL[b0.s] + ') — 아래 대기는 ' + (b0.at ? ago(b0.at) : '끊기기 전') + ' 기준'; sayC = 'r'; }
      else if (oldest >= 20) { sayT = oldest + '분 기다리는 고객' + (missE ? ' · 기록 빠짐 의심 ' + missE + '건' : ''); sayC = 'r'; }
      else if (missE) { sayT = '기록 빠짐 의심 ' + missE + '건'; sayC = 'a'; }
      else if (gap >= 30) { sayT = gap + '분째 기록 없음'; sayC = 'a'; }
      else sayT = isLead ? '대기 담당 없음 · 기록만' : '원활';
      var pp = mk('div', 'pp' + (sayC === 'r' ? ' alert' : '') + (!fresh ? ' offp' : ''));
      var h = mk('div', 'pph'), av = mk('span', 'av', n.slice(0, 1)); h.append(av, mk('b', 'pnm', n));
      if (!fresh) ['kakao', 'naver'].forEach(function (ch) { h.append(pill(ch, '모름', 'off')); });
      else conns.forEach(function (c) {
        var label = !c.u ? '안 씀' : c.s === 'ok' ? (isLead ? '팀 전체 보기' : '연결됨') : CONN_LABEL[c.s] || '확인 필요';
        if (c.u && c.s !== 'ok' && c.at) label += ' · ' + ago(c.at).replace(' 전', '째');
        h.append(pill(c.ch, label, !c.u ? 'off' : c.s === 'ok' ? 'ok' : 'bad', !c.u ? '이 채널은 기록기 설정에서 꺼져 있어요' : c.s === 'ok' ? '상담 목록을 정상으로 읽고 있어요' : '이 PC 기록기 패널에서 해당 채널의 안내대로 고치면 돼요'));
      });
      if (boardN && isToday) h.append(pill('board', '오늘 ' + boardN + '건', 'ok'));
      h.append(mk('span', 'psay ' + sayC, sayT));
      if (fresh) h.append(mk('span', 'psig', '신호 ' + ago(x.at)));
      pp.append(h);
      if (!fresh) { pp.append(mk('div', 'poff', (x ? '기록기가 꺼져 있어 지금 대기는 알 수 없어요 · ' : '') + periodName + ' 기록 ' + recN + '건' + (lastMs ? ' · 마지막 기록 ' + clock(lastMs) : ''))); rows.append(pp); return; }
      var body = mk('div', 'ppb');
      // ① 지금 기다리는 고객
      var c1 = mk('div', 'pcol'), l1 = mk('div', 'plab');
      if (isLead) { l1.append(mk('span', null, '지금 기다리는 고객')); c1.append(l1, mk('div', 'pnone m', '카톡·톡톡 대기를 맡지 않아요 (팀원 대기는 각자 칸에)')); }
      else {
        l1.append(mk('span', null, '지금 기다리는 고객 '), mk('b', null, pend + '명')); l1.append(mk('span', 'pr', bad.length ? '끊기기 전 기준' : '오래 기다린 순'));
        c1.append(l1);
        if (!pend) c1.append(mk('div', 'pnone', '기다리는 고객 없음'));
        else if (top) {
          var wl = mk('div', 'pwl');
          top.forEach(function (t) {
            var row = mk('div', 'pw' + (t.w >= 20 ? ' r' : t.w >= 10 ? ' a' : ''));
            var msg = mk('span', 'pmsg'); if (t.r) msg.append(mk('span', 'pre', '다시 옴')); msg.append(t.p || '(사진·파일 또는 내용 없음)'); msg.title = t.p || '';
            row.append(mk('span', 'pmin', t.w + '분'), mk('span', 'chb ' + t.ch, chName(t.ch)), mk('span', 'pcn', t.n || '이름 없음'), msg, link(t)); wl.append(row);
          });
          if (pend > top.length) wl.append(mk('div', 'pmore', '+ ' + (pend - top.length) + '명 더 (덜 기다린 고객)'));
          c1.append(wl);
        } else {
          var wt = mk('div', 'bwait'); ((cs && cs.pend) || []).slice().sort(function (a, b) { return (a.s || 0) - (b.s || 0); }).slice(0, 24).forEach(function (pp2) {
            var m = pp2.s ? Math.floor(W.bizMs(pp2.s, now, wcfg, !!pp2.r) / 60000) : 0; wt.append(mk('span', 'wchip' + (m >= 20 ? ' r' : m >= 10 ? ' o' : ''), m + ''));
          });
          if (!wt.childNodes.length) wt.append(mk('span', null, pend + '명 · 가장 오래 ' + oldest + '분'));
          c1.append(wt, mk('div', 'pmore', '고객 이름·메시지는 기록기 2.4.4부터 보여요'));
        }
      }
      // ② 기록
      var c2 = mk('div', 'pcol'), l2 = mk('div', 'plab'); l2.append(mk('span', null, periodName + ' 기록')); c2.append(l2);
      var kv = mk('div', 'pkv'), big = mk('span', 'pbig'); big.append(String(recN), mk('small', null, '건'));
      kv.append(big, mk('span', 'pph2', '시간당 ' + (hours >= 0.25 ? (recN / hours).toFixed(1) : '–') + '건')); c2.append(kv);
      if (isToday) c2.append(mk('div', 'pgap' + (gap >= 30 ? ' warn' : ''), lastMs ? '마지막 기록 ' + clock(lastMs) + ' · ' + (gap >= 30 ? gap + '분째 기록 없음' : ago(lastMs)) : '오늘 기록 아직 없음'));
      if (fresh && x.sending && isToday) c2.append(mk('div', 'pgap', '보내는 중 ' + x.sending + '건'));
      var hb = [];
      if (isToday && wd) { for (var hh = 10; hh < wd.workEnd / 60; hh++) { var cnt = rtT.filter(function (m) { return Math.floor(m / 60) === hh; }).length; hb.push({ v: cnt, label: hh === 13 ? '점심' : String(hh), cls: hh === 13 ? 'lunch' : hh * 60 > W.minuteOf(now) ? 'later' : '', blank: true, title: hh + '시 기록 ' + cnt + '건' }); } }
      else if (!isToday) keys.forEach(function (d) { if (!W.day(d, wcfg)) return; var o = recOf(n, d, x, fresh && !isLead && d === td); hb.push({ v: o.n, label: String(Number(d.slice(8))), blank: true, title: md(d) + ' 기록 ' + o.n + '건' }); });
      if (hb.length) c2.append(bars(hb, { cls: 'pbars' }));
      // ③ 답했는데 기록 없음
      var c3 = mk('div', 'pcol'), l3 = mk('div', 'plab'); l3.append(mk('span', null, '답했는데 기록 없음'), mk('span', 'pr', '지금')); c3.append(l3);
      if (isLead) c3.append(mk('div', 'pnone m', '대기를 맡지 않아 해당 없음'));
      else if (!miss.length) { var z = mk('div', 'pmiss z'); z.append(mk('b', null, '0건'), mk('span', null, '빠진 기록 없음')); c3.append(z); }
      else {
        var mb = mk('div', 'pmiss'); mb.append(mk('b', null, miss.length + '건'), mk('span', null, '대기에서 빠졌는데 오늘 그 상담방 기록이 팀 어디에도 없음'));
        var tg = mk('div', 'ptags'); if (missE) tg.append(mk('span', 'ptag d', '상담 종료 ' + missE)); if (miss.length - missE) tg.append(mk('span', 'ptag g', (miss.some(function (m) { return m.n || m.p; }) ? '아직 진행 중 ' : '상태 모름 ') + (miss.length - missE))); mb.append(tg);
        var tb = btn('', 'sm', function () { openMiss[n] = !openMiss[n]; paint(); });
        var paint = function () { tb.textContent = openMiss[n] ? '목록 접기 ▴' : '목록 펼치기 ▾'; tb.className = 'btn sm ' + (openMiss[n] ? 'ghost' : 'primary'); if (xpRef) xpRef.hidden = !openMiss[n]; };
        mb.append(tb); c3.append(mb);
      }
      body.append(c1, c2, c3); pp.append(body);
      // 펼친 목록(접어 둬도 만들어 두고 숨김 — 누르면 바로 열림)
      var xpRef = null;
      if (miss.length && !isLead) {
        var xp = mk('div', 'ppx'), xh = mk('div', 'ppxh'); xh.append(mk('b', null, n + ' · 답했는데 기록 없음 ' + miss.length + '건'), mk('span', 'muted', '종료된 상담이 위 · 종료됐는데 기록이 없으면 빠진 것일 가능성이 커요 · 진행 중이면 끝난 뒤 기록하면 돼요'));
        xp.append(xh);
        var t = mk('table', 'ttable pxt'), hr = mk('tr'); ['채널', '고객', '답한 시각', '답하기 전 고객 마지막 말', '상담 상태', ''].forEach(function (s) { hr.append(mk('th', null, s)); });
        var th = mk('thead'); th.append(hr); t.append(th); var bd = mk('tbody');
        miss.forEach(function (m) {
          var tr = mk('tr'), stt = missStatus(m), act = mk('td', 'pact');
          var ok = btn('기록 안 해도 돼요', 'ghost sm', async function () { try { var old = m.ch + ':' + m.id; try { await CSTeam.call('qa.ok', { key: 'miss:' + old + ':' + W.dayKey(m.at || Date.now()), adminToken: tok }); } catch (e1) { await CSTeam.call('qa.ok', { key: old, adminToken: tok }); } tr.remove(); say('목록에서 뺐어요', 'ok'); } catch (e) { say(e.message, 'err'); } });
          act.append(link(m), ok);
          var said = mk('td', 'pmsgc', m.p || (m.n ? '(사진·파일 또는 내용 없음)' : '기록기 2.4.4부터 보여요')); said.title = m.p || '';
          tr.append(mk('td').appendChild(mk('span', 'chb ' + m.ch, chName(m.ch))).parentNode, mk('td', 'pcn', m.n || '–'), mk('td', null, clock(m.at)), said, mk('td').appendChild(mk('span', stt[0], stt[1])).parentNode, act);
          bd.append(tr);
        });
        t.append(bd); var wrap = mk('div', 'twrap'); wrap.append(t); xp.append(wrap); pp.append(xp); xpRef = xp;
      }
      if (typeof paint === 'function' && miss.length && !isLead) paint();
      // 숫자 점검(오늘 기준)
      var o = { answered: 0, waitSum: 0, over20: 0, records: 0 }; Object.keys(days[td] || {}).forEach(function (k) { if (P(k) === n) ['answered', 'waitSum', 'over20', 'records'].forEach(function (f) { o[f] += (days[td][k] || {})[f] || 0; }); });
      var warn = isLead ? [] : sanity(n, o, x, !fresh, cs, wcfg, now).filter(function (s) { return !/목록 읽기가 정상이 아니에요|목록을 한 번도 못 읽었어요/.test(s); });
      if (warn.length) { var ww = mk('div', 'ppw'); warn.forEach(function (s) { ww.append(mk('div', null, '⚠ ' + s)); }); pp.append(ww); }
      rows.append(pp);
    });
    var top = mk('div', 'pnow');
    var nowB = mk('span', 'pnowb'); nowB.append('지금 기다리는 고객 ', mk('b', tot20 ? 'r' : null, totP + (partAny ? '+' : '') + '명'), tot20 ? ' · 20분 넘음 ' + tot20 + '명' : ''); top.append(nowB);
    var lg = mk('span', 'plg'); [['g', '10분 안'], ['a', '10분 넘음'], ['r', '20분 넘음']].forEach(function (x) { var s = mk('span'); s.append(mk('i', x[0]), x[1]); lg.append(s); }); lg.append(mk('span', null, '· 업무시간으로 셈(점심 빼고)')); top.append(lg);
    box.append(top, rows);
    if (!names.length) box.append(mk('div', 'empty', '아직 신호를 보낸 상담사가 없어요.'));
    box.append(mk('p', 'muted', '기록 = 시트에 저장된 것만 · 같은 고객은 하루 1건 · 시간당 = 기록 ÷ 지금까지 업무시간(점심 빼고) · 답했는데 기록 없음 = 다른 상담사가 그날 기록했으면 빠짐 아님(팀 전체 기준) · 고객 이름·메시지는 지금 화면에만(날짜별 자료에는 안 남김)'));
    return box;
  }
  function dayOf(ms) { return W.dayKey(ms || 0); }

  /* ───── 업무 흐름: 기록 시각으로 본 하루(상담사마다 한 칸) ───── */
  var fDay = '';
  // 기록 시각(분) → 시간당 · 텀(점심 12:30~14:00은 빼고) · 30분 넘게 빈 구간
  function flowOf(rt) {
    var t = (rt || []).slice().sort(function (a, b) { return a - b; }), L = W.LUNCH, n = t.length;
    var minus = function (a, b) { return Math.max(0, Math.min(b, L[1]) - Math.max(a, L[0])); };
    if (!n) return { n: 0, long: [], hours: {} };
    var span = Math.max(0, t[n - 1] - t[0] - minus(t[0], t[n - 1])), gaps = [], long = [];
    for (var i = 1; i < n; i++) { var g = t[i] - t[i - 1] - minus(t[i - 1], t[i]); gaps.push(g); if (g >= 30) long.push([t[i - 1], t[i], g]); }
    var sorted = gaps.slice().sort(function (a, b) { return a - b; }), med = sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : 0;
    return { n: n, t: t, first: t[0], last: t[n - 1], perHour: n / Math.max(1, span / 60), med: med, long: long, hours: t.reduce(function (o, m) { var h = Math.floor(m / 60); o[h] = (o[h] || 0) + 1; return o; }, {}) };
  }
  function dayNav(cur, td, go) {
    var nav = mk('div', 'ins qnav');
    var di = mk('input', 'in'); di.type = 'date'; di.value = cur; di.max = td; di.style.width = '160px'; di.addEventListener('change', function () { if (di.value) go(di.value); });
    nav.append(btn('◀ 전날', '', function () { go(W.addDays(cur, -1)); }), di, btn('다음 날 ▶', '', function () { if (cur < td) go(W.addDays(cur, 1)); }), btn('오늘', cur === td ? 'on' : '', function () { go(td); }), mk('span', null, md(cur) + (W.day(cur, {}) ? '' : ' · 쉬는 날')));
    Array.prototype.forEach.call(nav.querySelectorAll('button'), function (b) { b.className = b.className.replace('btn ghost', '').replace('btn ', '').trim(); });
    return nav;
  }
  async function flow(w) {
    await (T().syncLead ? T().syncLead() : null);
    var title = '업무 흐름';
    if (!(await ready(w, title, '기록한 시각으로 본 하루예요. 시간마다 몇 건 기록했는지 · 시간당 건수 · 기록과 기록 사이 간격 · 30분 넘게 기록이 없던 때(점심 빼고). 긴 통화나 어려운 상담도 빈 시간으로 보이니 참고용으로만 봐 주세요.'))) return;
    var td = today(); if (!fDay || fDay > td) fDay = td;
    var back = diffDays(fDay, td) + 1, q;
    try { q = await CSTeam.get('qa.get', { days: Math.min(62, back + 6) }); }
    catch (e) { w.lastChild.textContent = '불러오지 못했어요. ' + e.message; return; }
    w.lastChild.remove();
    var P = T().person, rtOf = function (d) { var o = {}, x = (q.days || {})[d] || {}; Object.keys(x).forEach(function (n) { var k = P(n); (o[k] || (o[k] = [])).push.apply(o[k], x[n].rt || []); }); return o; };
    var people = rtOf(fDay), F = {}; Object.keys(people).forEach(function (n) { F[n] = flowOf(people[n]); });
    w.append(dayNav(fDay, td, function (d) { fDay = d; flow(w); }));
    if (diffDays(fDay, td) >= 62) { w.append(mk('div', 'empty', '기록 시각은 62일 동안만 보관해요.')); return; }
    var names = await teamNames(Object.keys(people));
    // 시간 칸: 모두 같은 눈금(10시~18시 · 더 이르거나 늦은 기록이 있으면 넓힘)
    var lo = 10, hi = 18; Object.keys(F).forEach(function (n) { var f = F[n]; if (f.n) { lo = Math.min(lo, Math.floor(f.first / 60)); hi = Math.max(hi, Math.floor(f.last / 60)); } });
    var mx = 1; Object.keys(F).forEach(function (n) { for (var h = lo; h <= hi; h++) mx = Math.max(mx, F[n].hours[h] || 0); });
    var grid = mk('div', 'pgrid');
    names.forEach(function (n) {
      var f = F[n] || flowOf([]), c = mk('div', 'pcard' + (f.n ? '' : ' off'));
      var h = mk('div', 'pch'); h.append(mk('span', 'av', n.slice(0, 1)), mk('b', 'pn', n), mk('span', 'sp'), mk('span', 'pill' + (f.n ? '' : ' off'), f.n ? hhmm(f.first) + ' – ' + hhmm(f.last) : '기록 없음'));
      c.append(h);
      if (!f.n) { c.append(mk('div', 'pnone', '이날 기록한 시각이 없어요')); grid.append(c); return; }
      var row = mk('div', 'pst'); row.append(stat('기록', f.n + '건'), stat('시간당', f.perHour.toFixed(1) + '건', '', '첫 기록~마지막 기록 시간(점심 빼고)으로 나눔'), stat('기록 사이', f.med + '분', '', '기록과 기록 사이 시간의 가운데 값(점심 빼고)'), stat('30분+ 빈 시간', f.long.length + '번', f.long.length ? 'warn' : ''));
      c.append(row);
      var hs = []; for (var h2 = lo; h2 <= hi; h2++) hs.push({ v: f.hours[h2] || 0, label: String(h2), cls: h2 === 12 || h2 === 13 ? 'lunch' : '', title: h2 + '시대 기록 ' + (f.hours[h2] || 0) + '건' + (h2 === 12 || h2 === 13 ? ' (점심 12:30~14:00 포함)' : '') });
      c.append(mk('div', 'psub', '시간마다 기록한 건수 (시)'), bars(hs, { max: mx }));
      var gp = mk('div', 'pgap');
      if (!f.long.length) gp.append(mk('span', 'okc', '30분 넘게 빈 시간 없음'));
      else { gp.append(mk('span', 'gt', '30분 넘게 기록 없던 때')); f.long.forEach(function (x) { gp.append(mk('span', 'gchip', hhmm(x[0]) + ' ~ ' + hhmm(x[1]) + ' · ' + x[2] + '분')); }); }
      c.append(gp);
      // 최근 7일 기록 건수
      var wk = [], dl = []; for (var j = 0; dl.length < 7 && j < 14; j++) { var dj = W.addDays(fDay, -j), wj = W.weekday(dj); if (wj !== 0 && wj !== 6) dl.unshift(dj); }
      dl.forEach(function (d) { var ff = flowOf((rtOf(d)[n]) || []); wk.push({ v: ff.n, label: WD[W.weekday(d)], cls: d === fDay ? 'now' : '', title: md(d) + ' · 기록 ' + ff.n + '건' + (ff.n ? ' · 시간당 ' + ff.perHour.toFixed(1) : '') }); });
      c.append(mk('div', 'psub', '최근 평일 7일 기록 건수'), bars(wk, { cls: 'sm' }));
      grid.append(c);
    });
    if (!names.length) grid.append(mk('div', 'empty', '이날 기록 시각이 아직 없어요.\n상담사 기록기 2.4.0부터 쌓여요.'));
    w.append(grid);
  }

  /* ───── 게시판 건수: 그날 게시판 사이트별 기록 수(사람별) · 이달 합계 ───── */
  var sDay = '';
  async function sites(w) {
    await (T().syncLead ? T().syncLead() : null);
    var title = '게시판 건수';
    if (!(await ready(w, title, '게시판에서 기록할 때 고른 구매처로 저절로 세요. 상담사 PC는 1분마다 · 팀장 PC(태그 여러 개)는 5분마다 ‘팀장’ 줄로 들어와요.'))) return;
    var td = today(); if (!sDay || sDay > td) sDay = td;
    var mon = sDay.slice(0, 7), back = Math.max(diffDays(sDay, td), diffDays(mon + '-01', td)) + 1, g;
    try { g = await CSTeam.get('team.get', { days: Math.min(400, back) }); } catch (e) { w.lastChild.textContent = '불러오지 못했어요. ' + e.message; return; }
    w.lastChild.remove();
    var nav = mk('div', 'ins qnav');
    var di = mk('input', 'in'); di.type = 'date'; di.value = sDay; di.max = td; di.style.width = '160px'; di.addEventListener('change', function () { if (di.value) { sDay = di.value; sites(w); } });
    nav.append(btn('◀ 전날', '', function () { sDay = W.addDays(sDay, -1); sites(w); }), di, btn('다음 날 ▶', '', function () { if (sDay < td) { sDay = W.addDays(sDay, 1); sites(w); } }), btn('오늘', sDay === td ? 'on' : '', function () { sDay = td; sites(w); }), mk('span', null, md(sDay)));
    Array.prototype.forEach.call(nav.querySelectorAll('button'), function (b) { b.className = b.className.replace('btn ghost', '').replace('btn ', '').trim(); });
    w.append(nav);
    var days = g.days || {}, P = T().person;
    var sumBy = function (keys) { var o = {}; keys.forEach(function (d) { var x = days[d] || {}; Object.keys(x).forEach(function (n) { var k = P(n), s2 = (x[n] || {}).sites || {}; var t2 = o[k] || (o[k] = {}); Object.keys(s2).forEach(function (st) { t2[st] = (t2[st] || 0) + s2[st]; }); }); }); return o; };
    var siteTable = function (S, label) {
      var all2 = {}; Object.keys(S).forEach(function (n) { Object.keys(S[n]).forEach(function (st) { all2[st] = (all2[st] || 0) + S[n][st]; }); });
      var cols = Object.keys(all2).sort(function (a, b) { return all2[b] - all2[a]; }), ppl = Object.keys(S).filter(function (n) { return Object.keys(S[n]).length; }).sort(function (a, b) { return a.localeCompare(b, 'ko'); });
      if (!cols.length) return mk('div', 'empty', label + ' 게시판 기록이 없어요.');
      var rows = ppl.map(function (n) { var tot = 0; var cells = [n].concat(cols.map(function (c) { var v = S[n][c] || 0; tot += v; return { text: v ? String(v) : '–', cls: v ? '' : 'z' }; })); cells.push({ text: String(tot), cls: 'sum' }); return { cells: cells }; });
      var all = 0; rows.push({ cls: 'total', cells: ['합계'].concat(cols.map(function (c) { all += all2[c]; return String(all2[c]); }), [{ text: String(all), cls: 'sum' }]) });
      return table(['상담사'].concat(cols, ['합계']), rows, 'tsite');
    };
    var p1 = mk('div', 'panel'); p1.style.maxWidth = '1100px'; p1.append(mk('h3', 'qh', md(sDay)), siteTable(sumBy([sDay]), '이날'));
    var p2 = mk('div', 'panel'); p2.style.maxWidth = '1100px'; p2.append(mk('h3', 'qh', Number(mon.slice(5)) + '월 합계'), siteTable(sumBy(Object.keys(days).filter(function (d) { return d.slice(0, 7) === mon && d <= td; })), '이달'));
    w.append(p1, p2);
  }

  /* ───── 확인할 상담: 사람마다 한 칸(기록 안 함 · 20분 넘김 · 오래된 상담) · 공지 확인 ───── */
  var qDay = '';
  async function qa(w) {
    await (T().syncLead ? T().syncLead() : null);
    var title = '확인할 상담';
    if (!(await ready(w, title, '팀장만 보는 화면이에요(상담사 화면에는 안 나와요). 상담 번호와 링크만 있고 고객 이름·대화 내용은 없어요. [열기]를 누르면 그 상담이 새 탭에서 열려요(카카오·톡톡에 로그인돼 있어야 해요).'))) return;
    var td = today(); if (!qDay || qDay > td) qDay = td;
    var r, reads = {}, cfg = null;
    try { var got = await Promise.all([CSTeam.get('qa.get', { days: Math.min(62, diffDays(qDay, td) + 1) }), CSTeam.get('notice.reads', {}).catch(function () { return { reads: {} }; }), getCfg().catch(function () { return null; })]); r = got[0]; reads = got[1].reads || {}; cfg = got[2]; }
    catch (e) { w.lastChild.textContent = '불러오지 못했어요. ' + e.message; return; }
    w.lastChild.remove();
    var P = T().person, live = r.live || {}, tok = await T().adminToken();
    var by = {}, box = function (n) { return by[n] || (by[n] = { miss: [], late: [], lh: [] }); };
    Object.keys(live).forEach(function (n) { var b = box(P(n)); b.miss = b.miss.concat(live[n].miss || []); b.lh = b.lh.concat(live[n].lh || []); });
    var dd = (r.days || {})[qDay] || {}; Object.keys(dd).forEach(function (n) { var b = box(P(n)); b.late = b.late.concat((dd[n] || {}).late || []); });
    Object.keys(by).forEach(function (n) { by[n].late.sort(function (a, b) { return (b.w || 0) - (a.w || 0); }); by[n].lh.sort(function (a, b) { return (b.d || 0) - (a.d || 0); }); });
    var names = (await teamNames(Object.keys(by))).filter(function (n) { return n !== '팀장'; }), counts = {};
    names.forEach(function (n) { var b = by[n] || {}; counts[n] = (b.miss || []).length + (b.late || []).length + (b.lh || []).length; });
    var nav = dayNav(qDay, td, function (d) { qDay = d; qa(w); }); nav.prepend(mk('span', 'nl', '20분 넘긴 상담 날짜'));
    w.append(nav);
    var okBtn = function (x, row, card, miss) { return btn('확인함', 'ghost sm', async function () { try { var old = x.ch + ':' + x.id; if (miss) { try { await CSTeam.call('qa.ok', { key: 'miss:' + old + ':' + W.dayKey(x.at || Date.now()), adminToken: tok }); } catch (e1) { await CSTeam.call('qa.ok', { key: old, adminToken: tok }); /* 팀 서버 1.3.6 전 */ } } else await CSTeam.call('qa.ok', { key: old, adminToken: tok }); row.remove(); if (card) card(); say('목록에서 뺐어요', 'ok'); } catch (e) { say(e.message, 'err'); } }); };
    var team = names.filter(function (n) { return n !== '팀장'; });
    var unread = function (n) { return Object.keys(reads).filter(function (id) { return !Object.keys(reads[id].reads || {}).map(P).includes(n); }).map(function (id) { return reads[id]; }); };
    var card = function (n, wide) {
      var b = by[n] || { miss: [], late: [], lh: [] }, c = mk('div', 'qcard' + (wide ? ' wide' : '')), total = b.miss.length + b.late.length + b.lh.length;
      var h = mk('div', 'qch'); h.append(mk('span', 'av', n.slice(0, 1)), mk('b', 'pn', n), mk('span', 'sp'));
      var badge = function (t, v, cls) { if (v) h.append(mk('span', 'qbadge ' + cls, t + ' ' + v)); };
      badge('기록 안 함', b.miss.length, 'red'); badge('20분 넘김', b.late.length, 'red'); badge('오래된', b.lh.length, 'amber');
      if (!total) h.append(mk('span', 'qbadge ok', '확인할 것 없음'));
      c.append(h);
      var refresh = function () { if (!c.querySelector('.qrow')) c.classList.add('done'); };
      var sec = function (t, list, render) { if (!list.length) return; var s = mk('div', 'qsec'); s.append(mk('div', 'qst', t + ' ' + list.length)); list.forEach(function (x) { s.append(render(x)); }); c.append(s); };
      sec('기록 안 한 상담 · 지금', b.miss, function (x) { var row = mk('div', 'qrow'); row.append(mk('span', 'chb ' + x.ch, chName(x.ch)), mk('span', null, clock(x.at) + ' 답함'), mk('span', 'sp'), link(x), okBtn(x, row, refresh, true)); return row; });
      sec('20분 넘긴 상담 · ' + md(qDay), b.late, function (x) { var row = mk('div', 'qrow'); row.append(mk('span', 'chb ' + x.ch, chName(x.ch)), mk('b', 'qw', (x.w || 0) + '분'), mk('span', 'muted', clock(x.at) + ' 답함'), mk('span', 'sp'), link(x)); return row; });
      sec('오래된 상담 · 지금', b.lh, function (x) { var row = mk('div', 'qrow'); row.append(mk('span', 'chb ' + x.ch, chName(x.ch)), mk('span', null, (x.h ? '톡톡 보류 탭' : '진행중') + ' · 영업일 ' + (x.d || 0) + '일'), mk('span', 'sp'), link(x), okBtn(x, row, refresh)); return row; });
      var un = unread(n); if (un.length) { var s2 = mk('div', 'qsec'); s2.append(mk('div', 'qst', '아직 확인 안 한 공지 ' + un.length)); un.slice(0, 5).forEach(function (o) { s2.append(mk('div', 'qrow muted', o.title || '(제목 없음)')); }); c.append(s2); }
      if (!total && !un.length) c.classList.add('done');
      return c;
    };
    var g = mk('div', 'qgrid'); names.forEach(function (n) { g.append(card(n)); }); w.append(g);
    if (!names.length) w.append(mk('div', 'empty', '아직 신호를 보낸 상담사가 없어요.'));
    // 공지 확인
    var p4 = mk('div', 'panel wide'); p4.append(mk('h3', 'qh', '공지 확인'), mk('p', 'muted', '상담사가 검색기에서 [확인했어요]를 누른 공지(이름은 기록기 태그로 자동)'));
    var ids = Object.keys(reads).sort(function (a, b) { return (reads[b].first || 0) - (reads[a].first || 0); }).slice(0, 20);
    if (!ids.length) p4.append(mk('div', 'empty', '아직 확인한 공지가 없어요.'));
    else p4.append(table(['공지', '확인함', '아직'], ids.map(function (id) {
      var o = reads[id], who = Object.keys(o.reads || {}).map(P), not = team.filter(function (n) { return who.indexOf(n) < 0; });
      return { cells: [{ text: o.title || '(제목 없음)', title: id.indexOf('s:') === 0 ? '족보 Daily 공지' : '관리자 공지' }, { text: who.join(' · ') || '–' }, { text: not.join(' · ') || '모두 확인', cls: not.length ? 'warnc' : '' }] };
    }), 'tread'));
    if (!(cfg && cfg.roster && cfg.roster.length)) p4.append(mk('p', 'muted', '‘아직’ 칸은 근무 달력의 상담사 명단으로 셈 — 명단이 비어 있으면 팀 현황에 신호를 보낸 사람으로 셈'));
    w.append(p4);
  }

  /* ───── 근무 달력: 야근 신청 승인 · 공휴일 · 명단 · 비수기 ───── */
  var cMonth = '';
  async function cal(w) {
    await (T().syncLead ? T().syncLead() : null);
    var title = '근무 달력';
    if (!(await ready(w, title, '상담사가 검색기 [근무] 탭에 그날 퇴근 시각을 적으면 여기 쌓여요(정시 19:00 뒤 넘은 시간이 야근). 승인은 이 화면에서만 해요 · 상담사 화면에는 승인 여부가 안 보여요. 공휴일·비수기 설정은 팀 현황의 ‘기다린 시간’ 계산에도 쓰여요.'))) return;
    var td = today(); if (!cMonth) cMonth = td.slice(0, 7);
    var m = cMonth, from = m + '-01', to = monthEnd(m), back = diffDays(from, td) + 1;
    var got;
    try { got = await Promise.all([getCfg(true), CSTeam.get('ot.list', { from: from, to: to }), back > 0 && back <= 62 ? CSTeam.get('qa.get', { days: back }) : Promise.resolve({ days: {} }), CSTeam.get('team.get', { days: 1 }).catch(function () { return { live: [] }; })]); }
    catch (e) { w.lastChild.textContent = '불러오지 못했어요. ' + e.message; return; }
    w.lastChild.remove();
    var cfgAll = got[0], cfg = cfgAll.cfg || {}, roster = (cfgAll.roster || []).slice(), items = got[1].items || [], qd = got[2].days || {}, P = T().person;
    var fullOf = {}; roster.forEach(function (x) { fullOf[x.name] = x.full || x.name; }); items.forEach(function (x) { if (x.full && !fullOf[x.name]) fullOf[x.name] = x.full; });
    var nmOf = function (n) { return fullOf[n] || n; };
    items = items.slice().sort(function (a, b) { return (fullOf[a.name] || a.name).localeCompare(fullOf[b.name] || b.name, 'ko') || (a.date < b.date ? -1 : 1); });
    var liveNames = (got[3].live || []).map(function (x) { return P(x.name); });
    var hol = W.holidays(cfg);
    var lastRec = function (name, day) { var x = qd[day] || {}, best = -1; Object.keys(x).forEach(function (n) { if (P(n) === name) (x[n].rt || []).forEach(function (v) { best = Math.max(best, v); }); }); return best >= 0 ? hhmm(best) : ''; };
    var tok = await T().adminToken();
    var decide = async function (x, st) { var rep = ''; try { await CSTeam.call('ot.decide', { id: x.id, status: st, reply: rep || '', adminToken: tok }); say(st === '승인' ? '승인했어요' : '반려했어요(상담사 달력에서도 빠져요)', 'ok'); cal(w); } catch (e) { say(e.message, 'err'); } };
    // 달 넘기기 · 내려받기
    var nav = mk('div', 'ins qnav');
    nav.append(btn('◀', '', function () { cMonth = addMonth(m, -1); cal(w); }), mk('b', null, Number(m.slice(0, 4)) + '년 ' + Number(m.slice(5)) + '월'), btn('▶', '', function () { cMonth = addMonth(m, 1); cal(w); }), btn('이번 달', m === td.slice(0, 7) ? 'on' : '', function () { cMonth = td.slice(0, 7); cal(w); }),
      btn('엑셀(CSV) 내려받기', '', function () {
        var lines = [['날짜', '요일', '이름', '퇴근', '야근(분)', '야근', '상태', '그날 마지막 기록']].concat(items.map(function (x) { return [x.date, WD[W.weekday(x.date)], x.name, x.to, x.mins, hm(x.mins || 0), x.status, lastRec(x.name, x.date)]; }));
        var csv = '﻿' + lines.map(function (r) { return r.map(function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\r\n');
        var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = '야근_' + m + '.csv'; document.body.append(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      }));
    Array.prototype.forEach.call(nav.querySelectorAll('button'), function (b) { b.className = b.className.replace('btn ghost', '').replace('btn ', '').trim(); });
    w.append(nav);
    // 승인 기다리는 신청
    var wait = items.filter(function (x) { return x.status === '신청'; });
    var p1 = mk('div', 'panel'); p1.style.maxWidth = '980px'; p1.append(mk('h3', 'qh', '승인할 야근 ' + wait.length));
    if (!wait.length) p1.append(mk('div', 'empty', '이달에 승인할 야근이 없어요.'));
    wait.forEach(function (x) {
      var r2 = mk('div', 'qrow ot'), lr = lastRec(x.name, x.date);
      r2.append(mk('b', null, nmOf(x.name)), mk('span', null, md(x.date) + ' 퇴근 ' + x.to + ' · 야근 ' + hm(x.mins || 0)));
      if (x.note) r2.append(mk('span', 'muted', x.note));
      if (lr) r2.append(mk('span', 'chip use', '그날 마지막 기록 ' + lr));
      r2.append(mk('span', 'sp'), btn('승인', 'primary sm', function () { decide(x, '승인'); }), btn('반려', 'danger-ghost sm', function () { decide(x, '반려'); }));
      p1.append(r2);
    });
    w.append(p1);
    // 달력
    var p2 = mk('div', 'panel'); p2.style.maxWidth = '1100px'; p2.append(mk('h3', 'qh', '달력'));
    // 평일만(토·일 칸은 뺌)
    var grid = mk('div', 'wcal'); ['월', '화', '수', '목', '금'].forEach(function (x) { grid.append(mk('div', 'wd', x)); });
    var fw = W.weekday(from), lead = fw === 0 || fw === 6 ? 0 : fw - 1, nd = Number(to.slice(8, 10));
    for (var i = 0; i < lead; i++) grid.append(mk('div', 'wc blank'));
    for (var d = 1; d <= nd; d++) {
      var k = m + '-' + String(d).padStart(2, '0'), wd = W.weekday(k); if (wd === 0 || wd === 6) continue;
      var cell = mk('div', 'wc' + (hol[k] || wd === 0 ? ' off' : wd === 6 ? ' sat' : '') + (k === td ? ' today' : ''));
      cell.append(mk('span', 'n', String(d))); if (hol[k]) cell.append(mk('span', 'h', hol[k]));
      items.filter(function (x) { return x.date === k; }).forEach(function (x) { var o = mk('span', 'ot ' + (x.status === '승인' ? 'ok' : x.status === '반려' ? 'no' : 'wait'), nmOf(x.name) + ' ' + x.to); o.title = x.status + ' · 야근 ' + hm(x.mins || 0); cell.append(o); });
      grid.append(cell);
    }
    p2.append(grid);
    // 팀장이 바로 적기(바로 승인)
    var names = activeNames(roster, td, liveNames);
    var f = mk('div', 'facts'), sel = mk('select', 'sel'); sel.style.width = '120px'; sel.setAttribute('aria-label', '이름'); names.forEach(function (n) { sel.append(new Option(n, n)); });
    var di = mk('input', 'in'); di.type = 'date'; di.value = td.slice(0, 7) === m ? td : from; di.style.width = '150px';
    var ti = mk('input', 'in'); ti.type = 'time'; ti.value = '20:00'; ti.step = 600; ti.style.width = '120px'; ti.title = '퇴근 시각';
    f.append(sel, di, ti, btn('바로 적기(승인)', 'ghost sm', async function () { if (!sel.value) { say('아래 상담사 명단에 이름을 먼저 넣어 주세요', 'err'); return; } if (!ti.value || ti.value.slice(0, 5) <= '19:00') { say('정시(19:00)보다 늦은 퇴근 시각을 골라 주세요', 'err'); return; } try { await CSTeam.call('ot.add', { name: sel.value, date: di.value, from: '19:00', to: ti.value.slice(0, 5), adminToken: tok }); say('적었어요', 'ok'); cal(w); } catch (e) { say(e.message, 'err'); } }));
    p2.append(mk('p', 'muted', '팀장이 대신 적기(퇴근 시각 · 바로 승인돼요)'), f);
    w.append(p2);
    // 이달 합계
    var p3 = mk('div', 'panel'); p3.style.maxWidth = '980px'; p3.append(mk('h3', 'qh', Number(m.slice(5)) + '월 야근 합계'));
    var sum = {}; names.forEach(function (n) { sum[n] = { ok: 0, okN: 0, wait: 0, no: 0 }; });
    items.forEach(function (x) { var s2 = sum[x.name] || (sum[x.name] = { ok: 0, okN: 0, wait: 0, no: 0 }); if (x.status === '승인') { s2.ok += x.mins || 0; s2.okN++; } else if (x.status === '신청') s2.wait++; else s2.no++; });
    var sn = Object.keys(sum).sort(function (a, b) { return a.localeCompare(b, 'ko'); });
    var all = 0;
    p3.append(table(['상담사', '승인된 야근', '건수', '승인할 것', '반려'], sn.map(function (n) { var s2 = sum[n]; all += s2.ok; return { cells: [nmOf(n), { text: s2.ok ? hm(s2.ok) : '–' }, String(s2.okN), { text: String(s2.wait), cls: s2.wait ? 'warnc' : '' }, String(s2.no)] }; }).concat([{ cls: 'total', cells: ['합계', hm(all), '', '', ''] }])));
    var done = items.filter(function (x) { return x.status !== '신청'; });
    if (done.length) {
      var det = mk('details', 'qdet'); det.append(mk('summary', null, '처리한 신청 ' + done.length + '건 보기'));
      done.forEach(function (x) { var r3 = mk('div', 'qrow'); r3.append(mk('span', 'chip ' + (x.status === '승인' ? 'new' : 'err'), x.status), mk('b', null, nmOf(x.name)), mk('span', null, md(x.date) + ' 퇴근 ' + x.to + ' · 야근 ' + hm(x.mins || 0)), mk('span', 'sp'), btn('지우기', 'danger-ghost sm', async function () { try { await CSTeam.call('ot.cancel', { id: x.id, adminToken: tok }); cal(w); } catch (e) { say(e.message, 'err'); } })); det.append(r3); });
      p3.append(det);
    }
    w.append(p3);
    // 설정: 비수기 · 공휴일 · 명단
    var p4 = mk('div', 'panel'); p4.style.maxWidth = '980px'; p4.append(mk('h3', 'qh', '설정'));
    var save = async function (patch, msg) { try { await CSTeam.call('cfg.set', Object.assign({ adminToken: tok }, patch)); cfgCache = null; say(msg || '저장했어요', 'ok'); cal(w); } catch (e) { say(e.message, 'err'); } };
    var sw = mk('label', 'qsw'), cb = mk('input'); cb.type = 'checkbox'; cb.checked = !!cfg.offseason;
    cb.addEventListener('change', function () { save({ offseason: cb.checked }, cb.checked ? '비수기: 18시 뒤 새 문의도 셈' : '평소대로: 18시 뒤 새 문의는 다음 날 10시부터'); });
    sw.append(cb, mk('span', null, '비수기 — 18시(목 16시) 뒤에 들어온 새 문의도 바로 기다린 시간으로 셈'));
    p4.append(sw, mk('p', 'muted', '평소: 진행 중 상담(답한 상담에 고객이 다시 보냄)은 19시(목 17시)까지, 새 문의는 18시(목 16시)까지 셈 · 점심 12:30~14:00 · 주말·공휴일은 셈하지 않음'));
    // 공휴일(이 달과 다음 달)
    var hp = mk('div', 'qhol'), custom = Object.assign({}, cfg.holidays || {}), removed = (cfg.removed || []).slice();
    var range = Object.keys(hol).filter(function (k) { return k >= from && k <= monthEnd(addMonth(m, 1)); }).sort();
    hp.append(mk('b', null, '공휴일 (' + Number(m.slice(5)) + '·' + Number(addMonth(m, 1).slice(5)) + '월)'));
    if (!range.length) hp.append(mk('span', 'muted', ' 없음'));
    range.forEach(function (k) { var c = mk('span', 'chip use', md(k) + ' ' + hol[k] + ' '); var x = mk('button', 'lk', '✕'); x.type = 'button'; x.title = '공휴일에서 빼기'; x.addEventListener('click', function () { if (custom[k]) delete custom[k]; else removed.push(k); save({ holidays: custom, removed: removed }, '뺐어요'); }); c.append(x); hp.append(c); });
    var hd = mk('input', 'in'); hd.type = 'date'; hd.style.width = '150px'; var hn = mk('input', 'in'); hn.type = 'text'; hn.placeholder = '이름(예: 회사 창립일)'; hn.style.width = '180px';
    var hf = mk('div', 'facts'); hf.append(hd, hn, btn('쉬는 날 더하기', 'ghost sm', function () { if (!hd.value) return; custom[hd.value] = hn.value.trim() || '휴일'; removed = removed.filter(function (x) { return x !== hd.value; }); save({ holidays: custom, removed: removed }, '더했어요'); }));
    p4.append(hp, hf);
    // 명단
    p4.append(mk('b', null, '상담사 명단'), mk('p', 'muted', '성까지 적어 주세요(김수빈). 화면에는 성 뺀 이름(수빈)으로 나오고, 순서는 성까지 넣은 이름 가나다순이에요. 입사·퇴사일 사이에만 나와요.'));
    var rl = mk('div', 'qroster');
    var draw = function () {
      rl.replaceChildren();
      roster.forEach(function (x, i) {
        var r4 = mk('div', 'facts'), n = mk('input', 'in'), s1 = mk('input', 'in'), e1 = mk('input', 'in');
        n.type = 'text'; n.value = x.full || x.name; n.placeholder = '성까지(김수빈)'; n.style.width = '130px'; n.addEventListener('input', function () { x.name = n.value.trim(); x.full = ''; });
        s1.type = 'date'; s1.value = x.start || ''; s1.style.width = '150px'; s1.title = '입사일(비워도 돼요)'; s1.addEventListener('change', function () { x.start = s1.value; });
        e1.type = 'date'; e1.value = x.end || ''; e1.style.width = '150px'; e1.title = '퇴사일(근무 중이면 비워 둠)'; e1.addEventListener('change', function () { x.end = e1.value; });
        r4.append(n, mk('span', 'muted', '입사'), s1, mk('span', 'muted', '퇴사'), e1, btn('✕', 'danger-ghost sm', function () { roster.splice(i, 1); draw(); }));
        rl.append(r4);
      });
    };
    draw();
    if (!roster.length && liveNames.length) liveNames.filter(function (n) { return n !== '팀장'; }).forEach(function (n) { roster.push({ name: n, start: '', end: '' }); }), draw();
    var rf = mk('div', 'facts'); rf.append(btn('+ 사람 더하기', 'ghost sm', function () { roster.push({ name: '', start: td, end: '' }); draw(); }), btn('명단 저장', 'primary sm', function () { save({ roster: roster.filter(function (x) { return x.name; }) }, '명단을 저장했어요'); }));
    p4.append(rl, rf);
    w.append(p4);
  }

  var add = function () { if (!window.KBAdminExtra || !window.KBTeam) return setTimeout(add, 50); Object.assign(KBAdminExtra.views, { flow: flow, sites: sites, qa: qa, cal: cal }); };
  add();
  window.KBTeam2 = { flowOf: flowOf, teamNames: teamNames, teamCards: teamCards, board: board, sanity: sanity };
})();
