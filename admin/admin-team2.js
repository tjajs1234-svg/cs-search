/* 멘트 관리에 더한 화면 3 (팀 서버 1.3.0 · 기록기 2.4.0)
   · 팀 현황(admin-team3.js)이 쓰는 도구: 하루 흐름(flowOf) · 숫자 점검 · 연결 상태 · 기간 · 채널별 CSV · 게시판 구매처별 표
   · 공지 확인(공지 화면 아래) · 근무 달력: 연차·공가 승인(2026-11-10) · 야근 · 이달 합계 · 공휴일 · 상담사 명단 · 비수기 */
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
  function hm(mins) { var h = Math.floor(mins / 60), m = mins % 60; return (h ? h + '시간' : '') + (m ? (h ? ' ' : '') + m + '분' : h ? '' : '0분'); }
  function diffDays(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5); }
  function addMonth(m, n) { var y = Number(m.slice(0, 4)), mo = Number(m.slice(5, 7)) - 1 + n; y += Math.floor(mo / 12); mo = ((mo % 12) + 12) % 12; return y + '-' + String(mo + 1).padStart(2, '0'); }
  function monthEnd(m) { return W.addDays(addMonth(m, 1) + '-01', -1); }
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
  function ago(t) { var m = Math.floor((Date.now() - t) / 60000); return m < 1 ? '방금' : m < 60 ? m + '분 전' : Math.floor(m / 60) + '시간 전'; }

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

  // 기간 → 날짜 목록(오늘 · 어제 · 이번 주 · 이번 달 · 'd:날짜' 하루)
  function periodKeys(period) {
    var td = today(), out = [];
    if (/^d:\d{4}-\d{2}-\d{2}$/.test(period || '')) return [period.slice(2)]; // 2.4.14 날짜 하나 고르기
    if (period === 'lmonth' || /^r:/.test(period || '')) return KBTeamStats.periodKeys(period); // 2026-11-01 지난달 · 날짜 범위
    if (period === 'yday') { var y = W.addDays(td, -1); while (!W.day(y, {}) && out.length < 1 && y > W.addDays(td, -10)) y = W.addDays(y, -1); return [y]; }
    // 2026-10-20 지난주(월~일) — 피드백은 주로 지난주를 봄
    if (period === 'lweek') { var dw = (W.weekday(td) + 6) % 7, mon = W.addDays(td, -dw - 7); for (var j = 0; j < 7; j++) out.push(W.addDays(mon, j)); return out; }
    if (period === 'week') { var dow = (W.weekday(td) + 6) % 7; for (var i = dow; i >= 0; i--) out.push(W.addDays(td, -i)); return out; }
    if (period === 'month') { var d = td.slice(0, 8) + '01'; while (d <= td) { out.push(d); d = W.addDays(d, 1); } return out; }
    return [td];
  }
  /* ───── 2.4.4 팀 현황: 상담사마다 가로 판 하나(목업2) ─────
     이름 줄: 카톡·톡톡 연결 상태 알약 + 한 줄 요약 · 지금 기다리는 고객(오래 기다린 순 5명: 이름·마지막 말) · 기록(건수·시간당·시간대 막대·공백 경고)
     · 답했는데 기록 없음(펼치면 목록: 답하기 전 고객 마지막 말 · 사이트에서 종료됐는지) */
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
  function missStatus(x) { return x.e ? ['st end', '상담 종료됨'] : x.r ? ['st back', '고객이 다시 기다림'] : x.n || x.p ? ['st ing', '진행 중'] : ['st ing', '–']; }

  /* ───── 하루 흐름: 기록 시각으로 본 하루 ───── */
  // 기록 시각(분) → 시간당 · 텀(점심 12:30~14:00은 빼고) · 30분 넘게 빈 구간
  function flowOf(rt) {
    var t = (rt || []).slice().sort(function (a, b) { return a - b; }), L = W.LUNCH, n = t.length;
    var minus = function (a, b) { return Math.max(0, Math.min(b, L[1]) - Math.max(a, L[0])); };
    if (!n) return { n: 0, t: [], long: [], hours: {}, span: 0 };
    var span = Math.max(0, t[n - 1] - t[0] - minus(t[0], t[n - 1])), gaps = [], long = [];
    for (var i = 1; i < n; i++) { var g = t[i] - t[i - 1] - minus(t[i - 1], t[i]); gaps.push(g); if (g >= 30) long.push([t[i - 1], t[i], g]); }
    var sorted = gaps.slice().sort(function (a, b) { return a - b; }), med = sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : 0;
    return { n: n, t: t, first: t[0], last: t[n - 1], perHour: n / Math.max(1, span / 60), span: Math.max(60, span), med: med, long: long, hours: t.reduce(function (o, m) { var h = Math.floor(m / 60); o[h] = (o[h] || 0) + 1; return o; }, {}) };
  }
  /* ───── 채널별 건수 CSV(QA): 날짜 × 상담사 × 카톡 · 톡톡 · 게시판 + 답한 상담 ───── */
  //  기록 수 = 시트 저장이 확인된 기록 · 같은 날 같은 방 1건(기록기 2.4.13~). 채널 구분은 기록기 2.4.14 · 팀 서버 1.3.8부터
  function chanRow(v) {
    var board = 0; Object.keys(v.sites || {}).forEach(function (k) { board += v.sites[k] || 0; });
    var kakao = v.kakao || 0, naver = v.naver || 0, rec = v.records || 0, rest = Math.max(0, rec - board - kakao - naver);
    return { kakao: kakao, naver: naver, board: board, rest: rest, rec: Math.max(rec, kakao + naver + board), ans: v.answered || 0, ak: (v.ach || {}).kakao || 0, an: (v.ach || {}).naver || 0 };
  }
  function chanSum(days, keys, P) {
    var o = {}; keys.forEach(function (d) { var x = days[d] || {}; Object.keys(x).forEach(function (n) { var k = P(n), r = chanRow(x[n] || {}), t = o[k] || (o[k] = { kakao: 0, naver: 0, board: 0, rest: 0, rec: 0, ans: 0, ak: 0, an: 0 }); Object.keys(r).forEach(function (f) { t[f] += r[f]; }); }); }); return o;
  }
  function chanCsv(days, mon, td, P) {
    var lines = [['날짜', '상담사', '카톡', '톡톡', '게시판', '채팅(구분 전)', '기록 합계', '답한 상담', '답한 상담(카톡)', '답한 상담(톡톡)']];
    Object.keys(days).filter(function (d) { return d.slice(0, 7) === mon && d <= td; }).sort().forEach(function (d) {
      var S = chanSum(days, [d], P); Object.keys(S).sort(function (a, b) { return a.localeCompare(b, 'ko'); }).forEach(function (n) { var r = S[n]; if (r.rec || r.ans) lines.push([d, n, r.kakao, r.naver, r.board, r.rest, r.rec, r.ans, r.ak, r.an]); });
    });
    var csv = '\ufeff' + lines.map(function (r) { return r.map(function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = '상담사별건수_' + mon + '.csv'; document.body.append(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  // 게시판 구매처별 표(사람 × 구매처) — 팀 현황 아래 접는 칸
  function siteTable(S, label) {
    var all2 = {}; Object.keys(S).forEach(function (n) { Object.keys(S[n]).forEach(function (st) { all2[st] = (all2[st] || 0) + S[n][st]; }); });
    var cols = Object.keys(all2).sort(function (a, b) { return all2[b] - all2[a]; }), ppl = Object.keys(S).filter(function (n) { return Object.keys(S[n]).length; }).sort(function (a, b) { return a.localeCompare(b, 'ko'); });
    if (!cols.length) return mk('div', 'empty', label + ' 게시판 기록이 없어요.');
    var rows = ppl.map(function (n) { var tot = 0; var cells = [n].concat(cols.map(function (c) { var v = S[n][c] || 0; tot += v; return { text: v ? String(v) : '–', cls: v ? '' : 'z' }; })); cells.push({ text: String(tot), cls: 'sum' }); return { cells: cells }; });
    var all = 0; rows.push({ cls: 'total', cells: ['합계'].concat(cols.map(function (c) { all += all2[c]; return String(all2[c]); }), [{ text: String(all), cls: 'sum' }]) });
    return table(['상담사'].concat(cols, ['합계']), rows, 'tsite');
  }

  /* ───── 공지 확인(공지 화면 아래): 누가 [확인했어요]를 언제 체크했는지 · 2026-11-01 공지마다 펼쳐서 사람별 시각(초까지) ───── */
  function fullTime(ms) { var d = new Date(ms); return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + [d.getHours(), d.getMinutes(), d.getSeconds()].map(function (v) { return String(v).padStart(2, '0'); }).join(':'); }
  function dayTxt(ms) { var d = new Date(ms); return (d.getMonth() + 1) + '월 ' + d.getDate() + '일'; }
  // 지금 관리 공지(cs-content) + 서버에 확인이 남은 족보 공지 → [{ id, title, at, from, rev }]
  function noticeList(reads, admin, nhide) {
    var out = [], have = {}; nhide = nhide || [];
    (admin || []).forEach(function (n) { var id = 'a:' + n.id + (n.rev ? ':' + n.rev : ''); have[id] = 1; out.push({ id: id, title: n.title, at: Math.max(n.at || 0, n.rev ? n.ed || 0 : 0), ed: n.rev ? n.ed || 0 : 0, from: '관리자', hidden: !!n.hidden, raw: n }); });
    Object.keys(reads).forEach(function (id) {
      if (have[id]) return; if (admin && /^a:/.test(id)) return; // 지운 공지 · 고치기 전 판은 뺌
      var base = /^s:/.test(id) ? id.replace(/:\d+$/, '') : '';
      out.push({ id: id, title: reads[id].title, at: reads[id].first || 0, from: base ? '족보' : '관리자', base: base, hidden: !!(base && nhide.indexOf(base) >= 0) });
    });
    return out.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
  }
  async function noticeData() {
    var got = await Promise.all([CSTeam.get('notice.reads', {}), getCfg().catch(function () { return null; }), CSTeam.get('team.get', { days: 1 }).catch(function () { return { live: [] }; }),
      window.KBAdmin ? KBAdmin.latest().then(function (c) { return c.parsed || null; }).catch(function () { return null; }) : Promise.resolve(null)]);
    var reads = got[0].reads || {}, cfg = got[1], P = T().person;
    var team = activeNames(cfg && cfg.roster, today(), (got[2].live || []).map(function (x) { return P(x.name); })).filter(function (n) { return n !== '팀장'; });
    var cp = got[3];
    return { reads: reads, team: team, list: noticeList(reads, cp ? cp.notices : null, cp && cp.sources && cp.sources.nhide || []), nhide: cp && cp.sources && cp.sources.nhide || [], ntop: cp && cp.sources && cp.sources.ntop || [], topA: cp ? (cp.notices || []).filter(function (x) { return x.top && !x.hidden; }).length : 0, hasAdmin: !!cp, roster: !!(cfg && cfg.roster && cfg.roster.length), P: P };
  }
  function whoRead(D, id) { var o = (D.reads[id] || {}).reads || {}, m = {}; Object.keys(o).forEach(function (k) { var n = D.P(k); if (!m[n] || o[k] > m[n]) m[n] = o[k]; }); return m; }
  async function noticeReads(w) {
    if (!(await T().ensureUrl())) return;
    var D; try { D = await noticeData(); } catch (e) { return; }
    var p4 = mk('div', 'panel wide nreads'); p4.append(mk('h3', 'qh', '공지 확인'), mk('p', 'muted', '공지를 누르면 사람마다 확인 시각이 보여요'));
    // 2026-11-02 공지 확인에서도 [숨기기](족보·관리 공지) · [지우기](관리 공지) — 숨기면 상담사 화면에서 빠지고 아래 '숨긴 공지'에서 되돌림
    var redraw = function () { if (window.KBAdminExtra && KBAdminExtra.views && KBAdminExtra.views.notices) KBAdminExtra.views.notices(w); else noticeReads(w); };
    var act = async function (n, what) {
      try {
        if (n.from === '족보') {
          // 2026-11-05 족보 공지 상단 고정: sources.ntop('s:번호|고정한 때') · 관리 공지 고정과 합쳐 3개까지
          if (what === 'top' || what === 'untop') {
            var nt = D.ntop.filter(function (x) { return x.split('|')[0] !== n.base; });
            if (what === 'top') { if (nt.length + D.topA >= 3) { say('고정은 3개까지예요. 하나를 [고정 풀기] 한 뒤 다시 해 주세요', 'err'); return; } nt.unshift(n.base + '|' + Date.now()); }
            await KBAdmin.saveSources({ ntop: nt }, (what === 'top' ? '족보 공지 고정: ' : '족보 공지 고정 풀기: ') + (n.title || ''));
            say(what === 'top' ? '고정했어요. 2분 안에 상담사 공지 탭 맨 위에 보여요' : '고정을 풀었어요', 'ok'); redraw(); return;
          }
          var nh = D.nhide.filter(function (x) { return x !== n.base; }); if (what === 'hide') nh.push(n.base);
          await KBAdmin.saveSources({ nhide: nh }, (what === 'hide' ? '족보 공지 숨김: ' : '족보 공지 되돌림: ') + (n.title || ''));
        } else if (what === 'del') {
          if (!(await window.KBAdminApp.confirmDlg('이 공지를 지울까요?', '‘' + (n.title || '') + '’ 공지가 아예 사라져요. 잠깐 안 보이게만 하려면 [숨기기]를 쓰세요.', '지우기', true))) return;
          await KBAdmin.saveNotices(function (ns) { return ns.filter(function (x) { return x.id !== n.raw.id; }); }, '공지 지움: ' + (n.title || ''));
        } else {
          var h = what === 'hide';
          await KBAdmin.saveNotices(function (ns) { return ns.map(function (x) { return x.id === n.raw.id ? Object.assign({}, x, { hidden: h, hid: h ? Date.now() : 0 }) : x; }); }, (h ? '공지 숨김: ' : '공지 되돌림: ') + (n.title || ''));
        }
        say(what === 'hide' ? '숨겼어요. 2분 안에 상담사 화면에서 빠져요' : what === 'del' ? '지웠어요' : '되돌렸어요. 2분 안에 상담사 화면에 다시 보여요', 'ok'); redraw();
      } catch (e) { say((e && e.message) || '바꾸지 못했어요', 'err'); }
    };
    var acts = function (n) {
      var a = mk('span', 'nract'); if (!D.hasAdmin || (n.from === '관리자' && !n.raw)) return a;
      var b = function (label, cls, what) { var x = btn(label, cls, function (e) { e.preventDefault(); e.stopPropagation(); act(n, what); }); x.classList.add('sm'); return x; };
      if (n.from === '족보' && !n.hidden) { var on = D.ntop.some(function (x) { return x.split('|')[0] === n.base; }); a.append(b(on ? '고정 풀기' : '고정', on ? 'nflag on ntopbtn' : 'ghost nflag ntopbtn', on ? 'untop' : 'top')); }
      if (n.hidden) a.append(b('되돌리기', 'ghost nunhide', 'show')); else a.append(b('숨기기', 'ghost nhide', 'hide'));
      if (n.from === '관리자') a.append(b('지우기', 'danger-ghost', 'del'));
      return a;
    };
    var shownAll = D.list.filter(function (n) { return !n.hidden; }), hidAll = D.list.filter(function (n) { return n.hidden; });
    var rows = shownAll.slice(0, 30);
    if (!rows.length) p4.append(mk('div', 'empty', '아직 공지가 없어요.'));
    var box = mk('div', 'nrl');
    var one = function (n, into) {
      var m = whoRead(D, n.id), done = D.team.filter(function (x) { return m[x]; }), not = D.team.filter(function (x) { return !m[x]; });
      var extra = Object.keys(m).filter(function (x) { return D.team.indexOf(x) < 0; });
      var det = mk('details', 'nrd'), sm = mk('summary', 'nrs');
      var tt = mk('span', 'nrt'); tt.append(mk('b', null, n.title || '(제목 없음)')); if (n.ed) tt.append(mk('span', 'ntag', dayTxt(n.ed) + ' 고침')); if (n.from === '족보') tt.append(mk('span', 'ntag g', '족보')); if (n.hidden) tt.append(mk('span', 'ntag g', '숨김'));
      sm.append(tt, mk('span', 'muted nrdt', n.at ? dayTxt(n.at) : ''), mk('span', 'nrc', '확인 ' + done.length + ' / ' + D.team.length), mk('span', 'nrn ' + (not.length ? 'warnc' : 'okc'), not.length ? (not.length === D.team.length && D.team.length > 1 ? D.team.length + '명 모두 아직' : '아직: ' + not.join(' · ')) : '모두 확인'));
      det.append(sm);
      var ul = mk('div', 'nrp');
      D.team.concat(extra).forEach(function (x) { var r = mk('div', 'nrpr'); r.append(mk('span', null, x), m[x] ? mk('b', 'okc', fullTime(m[x]) + ' 확인') : mk('b', 'warnc', '아직')); ul.append(r); });
      sm.append(acts(n));
      det.append(ul); into.append(det);
      w.querySelectorAll('.rcnt').forEach(function (e) { if (e.dataset.nid === n.id) e.textContent = '확인 ' + done.length + '/' + D.team.length; });
    };
    rows.forEach(function (n) { one(n, box); });
    p4.append(box);
    if (hidAll.length) { var hb = mk('details', 'nrhid'); hb.append(mk('summary', 'colhd', '숨긴 공지 ' + hidAll.length + '개 · 상담사 화면에 안 보여요')); var hl = mk('div', 'nrl'); hidAll.forEach(function (n) { one(n, hl); }); hb.append(hl); p4.append(hb); }
    p4.append(mk('p', 'muted', '[숨기기]: 상담사 화면에서만 빠지고 확인 기록은 남아요 · 족보 공지는 시트에서 지워야 아예 사라져요(여기선 숨기기만)'));
    if (!D.roster) p4.append(mk('p', 'muted', '‘아직’은 근무 달력의 상담사 명단으로 셈 — 명단이 비어 있으면 팀 현황에 신호를 보낸 사람으로 셈'));
    if (w.isConnected) { var old = w.querySelector('.nreads'); if (old) old.remove(); w.append(p4); }
  }
  /* 면담 화면 한 줄: 그 기간에 올라온(고친) 공지 중 이 사람이 확인한 것 · 안 한 것 */
  async function noticeLine(who, keys, el) {
    try {
      if (!CSTeam.ready()) return;
      var D = await noticeData(), from = Date.parse(keys[0] + 'T00:00:00+09:00'), to = Date.parse(keys[keys.length - 1] + 'T23:59:59+09:00');
      var P = D.P(who), list = D.list.filter(function (n) { return n.at >= from && n.at <= to; });
      el.replaceChildren(); el.hidden = false;
      var hh = mk('div', 'tph'); hh.append(mk('b', null, '공지 확인'), mk('span', 'muted', '검색기에서 [확인했어요]를 체크한 시각 · 공지 내용을 잘못 안내했을 때 근거')); el.append(hh);
      if (!list.length) { el.append(mk('div', 'pnone', '이 기간에 올라온 공지가 없어요.')); return; }
      var done = [], not = [];
      list.forEach(function (n) { var t = whoRead(D, n.id)[P]; if (t) done.push({ n: n, t: t }); else if (!n.hidden) not.push(n); }); // 숨긴 공지는 안 읽어도 탓하지 않음
      list = list.filter(function (n) { return !n.hidden || whoRead(D, n.id)[P]; }); if (!list.length) { el.append(mk('div', 'pnone', '이 기간에 올라온 공지가 없어요.')); return; }
      el.append(mk('div', 'tnl' + (not.length ? ' r' : ''), '공지 ' + list.length + '개 중 ' + done.length + '개 확인' + (not.length ? ' · 확인 안 한 공지: ' + not.map(function (n) { return '‘' + (n.title || '') + '’'; }).join(', ') : ' ✓')));
      done.forEach(function (x) { var r = mk('div', 'nrpr'); r.append(mk('span', null, x.n.title || '(제목 없음)'), mk('b', 'okc', fullTime(x.t) + ' 확인')); el.append(r); });
    } catch (e) { /* 공지 줄은 없어도 됨 */ }
  }

  /* ───── 근무 달력: 야근 신청 승인 · 공휴일 · 명단 · 비수기 ───── */
  var cMonth = '';
  async function cal(w) {
    await (T().syncLead ? T().syncLead() : null);
    var title = '근무 달력';
    if (!(await ready(w, title, '퇴근 시각을 적으면 바로 야근으로 쌓여요(19:00 뒤).'))) return;
    var td = today(); if (!cMonth) cMonth = td.slice(0, 7);
    var m = cMonth, from = m + '-01', to = monthEnd(m), back = diffDays(from, td) + 1;
    var got, tok = await T().adminToken();
    // 2026-11-10 연차·공가·결근(팀 서버 1.3.29): 승인 기다리는 건 달과 상관없이 다 · 사유는 관리 열쇠로만 받음 · 예전 서버면 null
    var lvFrom = W.addDays(from < td ? from : td, -62);
    try { got = await Promise.all([getCfg(true), CSTeam.get('ot.list', { from: from, to: to }), back > 0 && back <= 62 ? CSTeam.get('qa.get', { days: back }) : Promise.resolve({ days: {} }), CSTeam.get('team.get', { days: 1 }).catch(function () { return { live: [] }; }),
      CSTeam.call('leave.list', { from: lvFrom, to: '9999-12-31', adminToken: tok }, 25000).then(function (r) { return r.items || []; }).catch(function () { return null; })]); }
    catch (e) { w.lastChild.textContent = '불러오지 못했어요. ' + e.message; return; }
    w.lastChild.remove();
    var cfgAll = got[0], cfg = cfgAll.cfg || {}, roster = (cfgAll.roster || []).slice(), items = (got[1].items || []).filter(function (x) { return x.status !== '반려'; }), qd = got[2].days || {}, P = T().person;
    var fullOf = {}; roster.forEach(function (x) { fullOf[x.name] = x.full || x.name; }); items.forEach(function (x) { if (x.full && !fullOf[x.name]) fullOf[x.name] = x.full; });
    var nmOf = function (n) { return fullOf[n] || n; };
    items = items.slice().sort(function (a, b) { return (fullOf[a.name] || a.name).localeCompare(fullOf[b.name] || b.name, 'ko') || (a.date < b.date ? -1 : 1); });
    var liveNames = (got[3].live || []).map(function (x) { return P(x.name); });
    var hol = W.holidays(cfg);
    var lastRec = function (name, day) { var x = qd[day] || {}, best = -1; Object.keys(x).forEach(function (n) { if (P(n) === name) (x[n].rt || []).forEach(function (v) { best = Math.max(best, v); }); }); return best >= 0 ? hhmm(best) : ''; };
    var leaves = got[4];
    // 달 넘기기 · 내려받기
    var nav = mk('div', 'ins qnav');
    nav.append(btn('◀', '', function () { cMonth = addMonth(m, -1); cal(w); }), mk('b', null, Number(m.slice(0, 4)) + '년 ' + Number(m.slice(5)) + '월'), btn('▶', '', function () { cMonth = addMonth(m, 1); cal(w); }), btn('이번 달', m === td.slice(0, 7) ? 'on' : '', function () { cMonth = td.slice(0, 7); cal(w); }),
      btn('엑셀(CSV) 내려받기', '', function () {
        var lines = [['날짜', '요일', '이름', '퇴근', '야근(분)', '야근', '적은 사람', '그날 마지막 기록']].concat(items.map(function (x) { return [x.date, WD[W.weekday(x.date)], x.name, x.to, x.mins, hm(x.mins || 0), x.by === '팀장' ? '팀장' : '본인', lastRec(x.name, x.date)]; }));
        var csv = '﻿' + lines.map(function (r) { return r.map(function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\r\n');
        var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = '야근_' + m + '.csv'; document.body.append(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      }));
    Array.prototype.forEach.call(nav.querySelectorAll('button'), function (b) { b.className = b.className.replace('btn ghost', '').replace('btn ', '').trim(); });
    w.append(nav);
    // 2026-11-10 승인 기다리는 휴가(연차·공가) — 누르는 순간 화면에 먼저 반영, 저장은 뒤에서(안 되면 되돌리고 알림)
    var lvP = mk('div', 'panel lvp'); lvP.style.maxWidth = '1100px';
    var lvKey = function (x) { return x.grp || x.id; };
    var groups = function (list) { var g = {}, order = []; list.forEach(function (x) { var k2 = lvKey(x); if (!g[k2]) { g[k2] = []; order.push(k2); } g[k2].push(x); }); return order.map(function (k2) { return g[k2].sort(function (a, b) { return a.date < b.date ? -1 : 1; }); }); };
    var lvLabel = function (x) { return x.kind === '연차' && x.part && x.part !== '하루' ? x.part + ' 반차' : x.kind === '연차' ? '연차 · 하루' : x.kind; };
    var lvDays = function (g) { return g.reduce(function (n, x) { return n + (x.kind === '연차' && x.part && x.part !== '하루' ? 0.5 : 1); }, 0); };
    var when = function (ms) { if (!ms) return ''; var k2 = W.dayKey(ms), d2 = new Date(ms); return md(k2) + ' ' + String(d2.getHours()).padStart(2, '0') + ':' + String(d2.getMinutes()).padStart(2, '0'); };
    var lvAct = async function (g, apply, send, okMsg) {
      var keep = g.map(function (x) { return Object.assign({}, x); }), keepList = leaves.slice();
      apply(); g.forEach(function (x) { x._p = true; }); drawLv(); drawCalLv();
      try { var r = await send(); (r && r.items || []).forEach(function (y) { leaves.forEach(function (x, i) { if (x.id === y.id) leaves[i] = y; }); }); g.forEach(function (x) { delete x._p; }); say(okMsg, 'ok'); }
      catch (e) { leaves = keepList; keep.forEach(function (y) { leaves.forEach(function (x, i) { if (x.id === y.id) leaves[i] = y; }); }); say(e.message, 'err'); }
      drawLv(); drawCalLv();
    };
    var lvRow = function (g, pending) {
      var x = g[0], r = mk('div', 'lvrow' + (x._p ? ' pend' : '')), dates = g.length > 1 ? md(g[0].date) + ' ~ ' + md(g[g.length - 1].date) : md(x.date);
      var dCell = mk('span'); dCell.append(document.createTextNode(dates + ' · '), mk('b', null, String(lvDays(g)) + '일')); if (x.note) dCell.append(mk('span', 'why', '사유: ' + x.note));
      var others = []; leaves.forEach(function (y) { if (y.name !== x.name && y.status !== '반려' && g.some(function (z) { return z.date === y.date; })) others.push(nmOf(y.name) + ' ' + y.kind + ' ' + md(y.date)); });
      var info = pending ? (others.length ? mk('span', 'clash', '같은 날 ' + others.slice(0, 2).join(', ') + (others.length > 2 ? ' 외 ' + (others.length - 2) : '')) : mk('span', 'mu', '같은 날 쉬는 사람 없음'))
        : mk('span', 'mu', x.status === '반려' ? '반려' : x.kind === '결근' && x.by !== '팀장' ? '본인이 적음(승인 없음)' : x.by === '팀장' ? '관리에서 적음' : (x.decidedAt ? md(W.dayKey(x.decidedAt)) + ' 승인' : '승인'));
      var acts = mk('span', 'acts');
      if (pending) {
        acts.append(btn('✓ 승인', 'sm okb', function () { lvAct(g, function () { g.forEach(function (y) { y.status = '승인'; y.decidedAt = Date.now(); }); }, function () { return CSTeam.call('leave.decide', { grp: x.grp, id: x.grp ? '' : x.id, status: '승인', adminToken: tok }, 25000); }, nmOf(x.name) + ' ' + x.kind + ' 승인했어요'); }),
          btn('반려', 'danger-ghost sm', function () { lvAct(g, function () { g.forEach(function (y) { y.status = '반려'; }); }, function () { return CSTeam.call('leave.decide', { grp: x.grp, id: x.grp ? '' : x.id, status: '반려', adminToken: tok }, 25000); }, nmOf(x.name) + ' ' + x.kind + ' 반려했어요'); }));
      } else {
        if (x.kind !== '결근' && x.by !== '팀장') acts.append(btn('되돌리기', 'ghost sm', function () { lvAct(g, function () { g.forEach(function (y) { y.status = '대기'; }); }, function () { return CSTeam.call('leave.decide', { grp: x.grp, id: x.grp ? '' : x.id, status: '대기', adminToken: tok }, 25000); }, '승인 기다리는 곳으로 되돌렸어요'); }));
        acts.append(btn('지우기', 'danger-ghost sm', function () { if (!confirm(nmOf(x.name) + ' ' + dates + ' ' + x.kind + '을(를) 지울까요?')) return; lvAct(g, function () { leaves = leaves.filter(function (y) { return g.indexOf(y) < 0; }); }, function () { return CSTeam.call('leave.cancel', { grp: x.grp, id: x.grp ? '' : x.id, adminToken: tok }, 25000); }, '지웠어요'); }));
      }
      r.append(mk('span', 'k', nmOf(x.name)), mk('span', 'tagk', lvLabel(x)), dCell, mk('span', 'mu', '신청 ' + when(x.at)), info, acts);
      return r;
    };
    var drawLv = function () {
      lvP.replaceChildren();
      if (!leaves) { lvP.append(mk('h3', 'qh', '연차·공가·결근'), mk('p', 'muted', '팀 서버를 1.3.29로 바꿔 붙이면 상담사가 검색기 [근태]에서 신청한 연차·공가가 여기에 나오고 승인할 수 있어요.')); return; }
      var pend = groups(leaves.filter(function (x) { return x.status === '대기'; })).sort(function (a, b) { return a[0].date < b[0].date ? -1 : 1; });
      var h = mk('h3', 'qh', '승인 기다리는 휴가'); h.append(mk('span', 'cnt', String(pend.length))); lvP.append(h);
      if (!pend.length) lvP.append(mk('p', 'muted', '지금 기다리는 신청이 없어요'));
      pend.forEach(function (g) { lvP.append(lvRow(g, true)); });
      var done = groups(leaves.filter(function (x) { return x.status !== '대기' && x.date >= from && x.date <= to; }));
      if (done.length) { var det = mk('details', 'qdet'); det.append(mk('summary', null, Number(m.slice(5)) + '월 처리한 휴가 ' + done.length + '건 보기 · 되돌리기 · 지우기')); done.forEach(function (g) { det.append(lvRow(g, false)); }); lvP.append(det); }
      lvP.append(mk('p', 'muted', '승인·반려는 [되돌리기]로 다시 고를 수 있어요. 같은 날 이미 쉬는 사람이 있으면 빨간 글씨로 알려 줘요. 사유는 이 화면에만 보여요.'));
    };
    var cellOf = {};
    var drawCalLv = function () {
      Object.keys(cellOf).forEach(function (k2) {
        Array.prototype.slice.call(cellOf[k2].querySelectorAll('.ot.lv')).forEach(function (n) { n.remove(); });
        (leaves || []).filter(function (x) { return x.date === k2 && x.status !== '반려'; }).forEach(function (x) {
          var o = mk('span', 'ot lv'); o.append(document.createTextNode(nmOf(x.name) + ' '), mk('b', null, x.kind === '연차' && x.part && x.part !== '하루' ? x.part + '반차' : x.kind));
          if (x.kind !== '결근') o.append(x.status === '승인' ? mk('span', 'lvok', '✓') : mk('span', 'lvwait', '⏳ 대기'));
          if (x.note) o.title = '사유: ' + x.note; cellOf[k2].append(o);
        });
      });
    };
    if (leaves) leaves.forEach(function (x) { if (x.full && !fullOf[x.name]) fullOf[x.name] = x.full; });
    drawLv(); w.append(lvP);
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
      items.filter(function (x) { return x.date === k; }).forEach(function (x) { var o = mk('span', 'ot ok', nmOf(x.name) + ' ' + x.to); o.title = '야근 ' + hm(x.mins || 0) + (x.by === '팀장' ? ' · 팀장이 적음' : ''); cell.append(o); });
      cellOf[k] = cell; grid.append(cell);
    }
    drawCalLv();
    p2.append(grid);
    // 팀장이 대신 적기
    var names = activeNames(roster, td, liveNames);
    var f = mk('div', 'facts'), sel = mk('select', 'sel'); sel.style.width = '120px'; sel.setAttribute('aria-label', '이름'); names.forEach(function (n) { sel.append(new Option(n, n)); });
    var di = mk('input', 'in'); di.type = 'date'; di.value = td.slice(0, 7) === m ? td : from; di.style.width = '150px';
    var ti = mk('input', 'in'); ti.type = 'time'; ti.value = '20:00'; ti.step = 600; ti.style.width = '120px'; ti.title = '퇴근 시각';
    f.append(sel, di, ti, btn('대신 적기', 'ghost sm', async function () { if (!sel.value) { say('아래 상담사 명단에 이름을 먼저 넣어 주세요', 'err'); return; } if (!ti.value || ti.value.slice(0, 5) <= '19:00') { say('정시(19:00)보다 늦은 퇴근 시각을 골라 주세요', 'err'); return; } var k3 = di.value; if (cellOf[k3]) { var tmp = mk('span', 'ot ok', nmOf(sel.value) + ' ' + ti.value.slice(0, 5)); tmp.style.opacity = '.5'; tmp.title = '저장 중…'; cellOf[k3].append(tmp); } say('적는 중…'); try { await CSTeam.call('ot.add', { name: sel.value, date: di.value, from: '19:00', to: ti.value.slice(0, 5), adminToken: tok }); say('적었어요', 'ok'); cal(w); } catch (e) { if (tmp) tmp.remove(); say(e.message, 'err'); } }));
    p2.append(mk('p', 'muted', '팀장이 대신 적기(퇴근 시각 · 같은 날 다시 적으면 고쳐져요)'), f);
    w.append(p2);
    // 이달 합계
    var p3 = mk('div', 'panel'); p3.style.maxWidth = '980px'; p3.append(mk('h3', 'qh', Number(m.slice(5)) + '월 야근 합계'));
    var sum = {}; names.forEach(function (n) { sum[n] = { ok: 0, okN: 0 }; });
    items.forEach(function (x) { var s2 = sum[x.name] || (sum[x.name] = { ok: 0, okN: 0 }); s2.ok += x.mins || 0; s2.okN++; });
    var sn = Object.keys(sum).sort(function (a, b) { return a.localeCompare(b, 'ko'); });
    var all = 0;
    p3.append(table(['상담사', '야근', '일수'], sn.map(function (n) { var s2 = sum[n]; all += s2.ok; return { cells: [nmOf(n), { text: s2.ok ? hm(s2.ok) : '–' }, String(s2.okN)] }; }).concat([{ cls: 'total', cells: ['합계', hm(all), ''] }])));
    if (items.length) {
      var det = mk('details', 'qdet'); det.append(mk('summary', null, '적힌 야근 ' + items.length + '건 보기 · 지우기'));
      items.forEach(function (x) { var r3 = mk('div', 'qrow'); r3.append(mk('b', null, nmOf(x.name)), mk('span', null, md(x.date) + ' 퇴근 ' + x.to + ' · 야근 ' + hm(x.mins || 0)), mk('span', 'muted', x.by === '팀장' ? '팀장이 적음' : ''), mk('span', 'sp'), btn('지우기', 'danger-ghost sm', async function () { r3.style.opacity = '.4'; try { await CSTeam.call('ot.cancel', { id: x.id, adminToken: tok }); r3.remove(); say('지웠어요', 'ok'); cal(w); } catch (e) { r3.style.opacity = ''; say(e.message, 'err'); } })); det.append(r3); });
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
    // 2026-11-03 AS 시트 주소(시트 번호만 저장) · 기록기 2.4.27이 이 시트를 월~금 14~17시에 5분 넘게 앞에 두고 답을 안 보내면 그 시간을 시간당 숫자에서 빼고, 회신 대기 알림도 쉼
    var asw = mk('div', 'qas'), asIn = mk('input', 'in'); asIn.type = 'text'; asIn.placeholder = 'AS 시트 주소 붙여 넣기 (https://docs.google.com/spreadsheets/d/…)'; asIn.style.width = '420px'; asIn.autocomplete = 'off';
    var asNow = cfg.asSheet ? '저장됨 (시트 번호 끝 ' + String(cfg.asSheet).slice(-4) + ')' : '아직 없음';
    asw.append(mk('b', null, 'AS 시트 '), mk('span', 'muted', asNow + ' '), asIn,
      btn('저장', 'sm', function () { var v = asIn.value.trim(); if (!v) { say('주소를 붙여 넣어 주세요', 'err'); return; } save({ asSheet: v }, 'AS 시트를 저장했어요'); }),
      cfg.asSheet ? btn('지우기', 'danger-ghost sm', function () { save({ asSheet: '' }, 'AS 시트를 지웠어요'); }) : '');
    p4.append(asw, mk('p', 'muted', '상담사 PC에서 이 시트가 앞에 떠 있으면 회신 대기 알림이 쉬어요. 월~금 14~17시에 5분 넘게 보고 그동안 답을 하나도 안 보냈으면 그 시간은 시간당 기록·응대에서 빼요. 잠깐 보거나 보면서 답하면 상담 시간이에요. 시트 내용은 읽지 않아요.'));
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

  var add = function () { if (!window.KBAdminExtra || !window.KBTeam) return setTimeout(add, 50); // 2026-10-18 '업무 흐름'·'상담사별 건수'·'확인할 상담'은 팀 현황 한 화면으로(예전 주소로 와도 팀 현황)
    var toTeam = function (w) { return KBAdminExtra.views.team(w); };
    Object.assign(KBAdminExtra.views, { flow: toTeam, sites: toTeam, qa: toTeam, cal: cal }); };
  add();
  window.KBTeam2 = { flowOf: flowOf, teamNames: teamNames, sanity: sanity, periodKeys: periodKeys, getCfg: getCfg, connsOf: connsOf, pill: pill, missStatus: missStatus, CONN_LABEL: CONN_LABEL, table: table, chanCsv: chanCsv, siteTable: siteTable, noticeReads: noticeReads, noticeLine: noticeLine, fullTime: fullTime };
})();
