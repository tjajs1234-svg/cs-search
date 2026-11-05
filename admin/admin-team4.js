/* 팀 현황 넷째 칸 [팀 기록](2026-11-01 주인) — 상담사 화면 [팀 기록] 탭과 같은 숫자(js/teamstats.js) · 기간은 여기서만 고름
   · 시간당 기록(기록 ÷ 기록기가 켜져 있던 업무시간) 순 · 등수 · 기록 · 하루 평균 · 근무일 · 일한 시간 · 1등과 차이
   · 2026-11-03 응대(답한 고객 · 기록 상관없음)를 같은 표에: 시간당 응대 많은 순 · 응대 등수와 기록 등수 둘 다 · AS 시트 본 시간은 일한 시간에서 뺌
   · 문의 분류: 사람 × 카테고리 + 어려운 상담 비율(교환/반품 · 고장/불량 · A/S · 불만) — 이 비율은 관리 화면에만(상담사 화면엔 없음)
   · 2026-11-03.5 오늘을 볼 때만 끝에 '한줄평'(상담사 화면과 같은 문장) + 회색 줄(팀 평균과 차이 · 어려운 분류 %) — 이 회색 줄은 관리 화면에만
   · 같은 고객(상담방)은 고른 기간 안에서 한 주(월~금)에 1건 · 기록한 방 자료(qa)는 62일만 남아 그보다 앞선 날은 그대로 셈 */
(function () {
  'use strict';
  function mk(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  var S = function () { return window.KBTeamStats; }, T2 = function () { return window.KBTeam2; }, W = window.WorkClock, WD = ['일', '월', '화', '수', '목', '금', '토'];
  function f1(v) { return v == null ? '–' : (Math.round(v * 10) / 10).toFixed(1); }
  function md(k) { return Number(k.slice(5, 7)) + '/' + Number(k.slice(8, 10)) + '(' + WD[W.weekday(k)] + ')'; }
  function hm(m) { m = Math.round(m); var h = Math.floor(m / 60), r = m % 60; return (h ? h + '시간' : '') + (r ? (h ? ' ' : '') + r + '분' : h ? '' : '0분'); }
  function btn(label, cls, fn) { var b = mk('button', 'btn ' + (cls || 'ghost'), label); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; }
  function say(t, k) { if (window.KBAdminApp) window.KBAdminApp.say(t, k); }
  function hhmm(ms) { var d = new Date(ms + 9 * 3600e3); return d.getUTCHours() + ':' + String(d.getUTCMinutes()).padStart(2, '0'); }
  /* 2026-11-05.3(팀 서버 1.3.22, 주인 11/05) 팀장 PC 숫자 섞임: 막은 알림 + [오늘 숫자 다시 받기] — 오늘을 볼 때만 · 관리 화면에만 */
  function fixPanel(r, R, st) {
    var p = mk('div', 'tpanel tfix'), h = mk('div', 'tph'); h.append(mk('b', null, '오늘 숫자가 이상할 때'), mk('span', 'muted', '팀장 PC 태그를 바꾸다 이름이 하나만 남으면, 그동안 팀장 PC 숫자가 그 상담사 숫자에 섞일 수 있어요(팀 서버 1.3.22부터 막아요)')); p.append(h);
    ((r && r.mixed) || []).forEach(function (x) { var o = R.people.filter(function (y) { return y.n === x.name; })[0]; p.append(mk('p', 'tfix-mx', '팀장 PC가 ' + hhmm(x.first) + (x.at - x.first > 60e3 ? '~' + hhmm(x.at) : '') + '에 \'' + (o ? o.full : x.name) + '\' 이름으로 보낸 숫자는 ' + (o ? o.full : x.name) + ' 님 숫자에 넣지 않았어요.')); });
    var row = mk('div', 'facts'), sel = mk('select'); sel.append(mk('option', null, '이름 고르기'));
    R.people.forEach(function (o) { var op = mk('option', null, o.full + ' · 지금 완료(기록) ' + o.rec + '건'); op.value = o.n; sel.append(op); }); sel.firstChild.value = '';
    var go = btn('오늘 숫자 다시 받기', 'ghost', async function () {
      var o = R.people.filter(function (y) { return y.n === sel.value; })[0]; if (!o) { say('이름을 골라 주세요', 'err'); return; }
      if (!confirm(o.full + ' 님의 오늘 숫자(완료 기록 · 응대)를 비우고, ' + o.full + ' 님 기록기가 다음에 보내는 숫자로 다시 채울까요?\n켜 둔 시간은 그대로예요. 1~2분 뒤 [새로 고침]을 눌러 주세요.')) return;
      try { var c = await KBAdmin.getConn(); var j = await CSTeam.call('team.reday', { name: o.n, adminToken: (c && c.token) || '' }); if (!j || !j.ok) throw new Error((j && j.error) || '서버가 받지 않았어요(팀 서버 1.3.22가 필요해요)'); say(o.full + ' 님 오늘 숫자를 비웠어요. 1~2분 뒤 새로 고침하면 ' + o.full + ' 님 PC 숫자로 보여요', 'ok'); if (st.again) setTimeout(st.again, 1500); } catch (e) { say((e && e.message) || '하지 못했어요', 'err'); }
    });
    row.append(sel, go); p.append(row);
    p.append(mk('p', 'muted tfoot', '시트에 적힌 건수와 많이 다를 때만 눌러 주세요. 그 사람 기록기가 켜져 있어야 다시 채워져요.'));
    return p;
  }
  function pct(v) { return v == null ? '–' : Math.round(v * 100) + '%'; }
  var NAME = { today: '오늘', yday: '어제', week: '이번 주', lweek: '지난주', month: '이번 달', lmonth: '지난달' };
  function label(period, keys) {
    if (NAME[period]) return NAME[period] + (keys.length > 1 ? ' ' + md(keys[0]) + '~' + md(keys[keys.length - 1]) : ' ' + md(keys[0]));
    return keys.length > 1 ? md(keys[0]) + '~' + md(keys[keys.length - 1]) : md(keys[0]);
  }
  async function render(r, st) {
    var keys = S().periodKeys(st.period), back = Math.min(62, S().daysBack(keys));
    var got = await Promise.all([CSTeam.get('qa.get', { days: Math.max(14, back) }, st.maxAge || 0).catch(function () { return null; }), CSTeam.get('cfg.get', {}).catch(function () { return null; }), CSTeam.get('ot.list', { from: keys[0], to: keys[keys.length - 1] }, st.maxAge || 0).catch(function () { return null; })]);
    var R = S().compute(r, got[0], keys, { roster: (got[1] || {}).roster, ot: (got[2] || {}).items || [] }), wrap = mk('div', 'tview trec');
    var nWork = 0; keys.forEach(function (d) { if (W.day(d, (got[1] || {}).cfg || {})) nWork++; });
    // 시간당 응대 · 기록(한 표 · 시간당 응대 많은 순)
    var p1 = mk('div', 'tpanel'), h1 = mk('div', 'tph'); h1.append(mk('b', null, '시간당 응대 · 기록 · ' + label(st.period, keys)), mk('span', 'muted', '근무일 ' + nWork + '일 · 시간당 응대 많은 순 · 응대 = 답을 보낸 서로 다른 고객(기록 상관없음, 한 주에 같은 고객 1명) · 일한 시간 = 기록기가 켜져 있던 근무시간(10~19시 · 목 17시 · 점심 12:30~14:00 빼고 · 야근한 날은 19시 뒤 켜 둔 시간도 OT 퇴근·마지막 기록까지 · AS 시트 본 시간은 뺌)'));
    if (!R.people.length) p1.append(mk('div', 'pnone', '이 기간 기록이 없어요'));
    else {
      var byR = S().byResp(R.people), bestR = byR.filter(function (o) { return o.rph != null; })[0] || null, rr = 0, lastR = null;
      byR.forEach(function (o, i) { if (o.rph == null) { o.rrank = null; return; } var k = Math.round(o.rph * 10); if (k !== lastR) { rr = i + 1; lastR = k; } o.rrank = rr; });
      var isToday = keys.length === 1 && keys[0] === S().periodKeys('today')[0], pw = isToday ? S().prevWorkday(keys[0]) : null, prev = {};
      if (pw && r && r.days && r.days[pw.key]) S().compute(r, got[0], [pw.key], { roster: (got[1] || {}).roster }).people.forEach(function (o) { prev[o.n] = { ph: o.ph, rt: o.rt || [], label: pw.label }; });
      var rvCell = function (o) {
        var ln = S().oneLine(R, o, { prev: prev[o.n], off: !!((got[1] || {}).cfg || {}).offseason }), box = mk('div', 'trk-rv');
        if (ln.dash) box.append(mk('span', 'z2', '–')); else { var said = function (cls, t, tip) { var e = mk('span', cls); String(t || '').split(/(?<=[.?!])\s+/).forEach(function (x) { if (x) e.append(mk('span', 's', x)); }); if (tip) e.append(mk('span', 'tip', tip)); return e; }; // 2026-11-04 문장마다 한 줄
        (ln.goods || (ln.good ? [ln.good] : [])).forEach(function (g) { box.append(said('it good', g)); }); (ln.fixes || []).forEach(function (f) { box.append(said('it fix' + (f.strong ? ' strong' : '') + (f.gap ? ' gap' : ''), f.t, f.tip)); }); }
        var oth = R.people.filter(function (x) { return x !== o && !x.board && x.ph != null; }), avg = oth.length ? oth.reduce(function (a, x) { return a + x.ph; }, 0) / oth.length : null, g = [];
        if (o.board) g.push('게시판 ' + o.bd + '건 · 채팅 응대 ' + o.resp + '명');
        else if (avg && o.ph != null) { var d = Math.round((o.ph - avg) / avg * 100); g.push(Math.abs(d) < 5 ? '기록 팀 평균과 비슷' : '팀 평균보다 기록 ' + Math.abs(d) + '% ' + (d > 0 ? '많음' : '적음')); }
        if (o.hardPct != null) g.push('어려운 분류 ' + pct(o.hardPct)); if (o.as) g.push('AS로 뺀 시간 ' + hm(o.as));
        if (g.length) box.append(mk('span', 'gray', g.join(' · ')));
        return { node: box, cls: 'trk-rvc' };
      };
      var rows = byR.map(function (o) {
        var gap = bestR && o.rph != null && o !== bestR && bestR.rph > 0 ? '−' + f1(bestR.rph - o.rph) + '명 (' + Math.round((bestR.rph - o.rph) / bestR.rph * 100) + '%)' : '–';
        return { cells: [{ text: o.rrank ? o.rrank + '등' : '–', cls: 'trk-rk' }, { text: o.full, cls: 'trk-nm' }, { text: o.rph == null ? '–' : f1(o.rph) + '명', cls: 'trk-big trk-rsp' }, o.resp + '명', { text: o.ph == null ? '–' : f1(o.ph) + '건', cls: 'trk-big' }, o.rank ? o.rank + '등' : '–', o.rec + '건', o.perDay == null ? '–' : f1(o.perDay) + '건', o.work + '일', o.on ? hm(o.on) : '–', o.as ? hm(o.as) : '–', { text: gap, cls: 'z2' }].concat(isToday ? [rvCell(o)] : []) };
      });
      p1.append(T2().table(['응대 등수', '이름', '시간당 응대', '응대', '시간당 기록', '기록 등수', '기록', '하루 평균', '근무일', '일한 시간', 'AS로 뺀 시간', '1등과 차이(응대)'].concat(isToday ? ['한줄평(상담사 화면과 같음 · 회색 줄은 여기만)'] : []), rows, 'trk-t1'));
      var notes = [];
      if (R.people.some(function (o) { return o.ph == null || o.rph == null; })) notes.push('– = 기록기가 켜져 있던 시간이 1시간이 안 되거나, 켜진 시간 자료가 없는 날(팀 서버 1.3.12 전)');
      var rd = R.people.reduce(function (s, o) { return s + o.redup; }, 0); if (rd) notes.push('같은 주에 같은 고객을 다시 기록한 ' + rd + '건은 빼고 셌어요');
      if (R.noQa.length) notes.push(md(R.noQa[0]) + (R.noQa.length > 1 ? ' 등 ' + R.noQa.length + '일' : '') + '은 기록한 방 자료가 없어(두 달 지남) 같은 고객 합치기 없이 셌어요');
      notes.forEach(function (t) { p1.append(mk('p', 'muted tfoot', t)); });
    }
    wrap.append(p1);
    // 문의 분류(관리 화면은 어려운 상담 비율도)
    var p2 = mk('div', 'tpanel'), h2 = mk('div', 'tph'); h2.append(mk('b', null, '문의 분류 · ' + label(st.period, keys)), mk('span', 'muted', '주황 = 어려운 상담(교환/반품 · 고장/불량 · A/S · 불만) · 이 비율은 상담사 화면에 안 나와요')); p2.append(h2);
    var ppl = R.people.filter(function (o) { return o.catN > 0; });
    if (!ppl.length) p2.append(mk('div', 'pnone', '카테고리가 남은 기록이 없어요(기록기 2.4.15부터 모여요)'));
    else {
      var head = ['이름'].concat(R.catOrder, ['합계', '어려운 상담']);
      var rows2 = ppl.map(function (o) { var top = 0; R.catOrder.forEach(function (c) { if ((o.cats[c] || 0) > top) top = o.cats[c]; }); return { cells: [{ text: o.full, cls: 'trk-nm' }].concat(R.catOrder.map(function (c) { return { text: o.cats[c] ? String(o.cats[c]) : '·', cls: (S().isHard(c) && o.cats[c] ? 'thard' : '') + (o.cats[c] && o.cats[c] === top ? ' ttop' : '') }; }), [{ text: String(o.catN), cls: 'trk-b' }, pct(o.hardPct)]) }; });
      rows2.push({ cls: 'trk-sum', cells: [{ text: '팀 합계', cls: 'trk-nm' }].concat(R.catOrder.map(function (c) { return { text: String(R.cats[c]), cls: 'trk-b' }; }), [{ text: String(R.total.catN), cls: 'trk-b' }, pct(R.total.hardPct)]) });
      var tb = T2().table(head, rows2, 'tcatt trk-t2' + (R.catOrder.length > 12 ? ' many' : ''));
      tb.querySelectorAll('td.thard').forEach(function (td) { var b = mk('b', null, td.textContent); td.textContent = ''; td.append(b); });
      p2.append(tb);
    }
    wrap.append(p2);
    if (keys.length === 1 && keys[0] === S().periodKeys('today')[0] && R.people.length) wrap.append(fixPanel(r, R, st));
    wrap.append(mk('p', 'muted tfoot', '상담사 화면 [팀 기록] 탭은 오늘만 · 이름 · 시간당 응대 · 오늘 응대 · 시간당 기록 · 오늘 기록 · 카테고리 건수만 보여요(등수 · 1등과 차이 · AS로 뺀 시간 · 어려운 상담은 이 화면에만).'));
    return wrap;
  }
  window.KBTeam4 = { render: render };
})();
