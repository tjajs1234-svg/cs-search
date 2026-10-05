/* 멘트 관리에 더한 화면: 공지 · 요청시트 연결 · 깃허브 연결(처음 연결 화면 포함)
   공지와 요청시트 주소는 [상담원에게 보내기]와 따로, 각 화면의 버튼으로 바로 올라감(멘트 수정 중이어도 섞이지 않음) */
(function () {
  'use strict';
  var A = function () { return window.KBAdminApp; };
  function mk(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function btn(label, cls, fn) { var b = mk('button', 'btn ' + (cls || 'ghost'), label); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; }
  function lab(t, hint) { var l = mk('div', 'lab', t); if (hint) l.append(mk('small', null, hint)); return l; }
  function input(value, ph, type) { var i = mk('input', 'in'); i.type = type || 'text'; i.value = value || ''; if (ph) i.placeholder = ph; i.spellcheck = false; return i; }
  function say(t, k) { if (A()) A().say(t, k); else alert(t); }
  function rid() { return 'n_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function when(t) { return t ? KBData.stamp(t).slice(5, 16).replace('-', '/') : ''; }
  function loading(w, title, desc) { w.replaceChildren(mk('h2', null, title), mk('p', 'desc', desc), mk('div', 'empty', '불러오는 중…')); }
  function failed(w, title, e) { w.replaceChildren(mk('h2', null, title), mk('div', 'empty', '불러오지 못했어요. ' + (e && e.message || '') + '\n잠시 뒤 다시 눌러 주세요.')); }

  /* ───── 공지 ───── */
  var editing = null;
  async function notices(w) {
    var T = '공지', D = '상담사 화면 맨 위 [공지] 탭에 보여요. 새 공지는 빨간 숫자로 알리고, 상담사가 [확인했어요]를 누르면 꺼져요. [공지 올리기]를 누르면 2분 안에 모든 PC에 반영돼요(멘트 보내기와 따로).';
    loading(w, T, D);
    var cur; try { cur = await KBAdmin.latest(); } catch (e) { failed(w, T, e); return; }
    var list = cur.parsed ? cur.parsed.notices.slice() : [];
    w.replaceChildren(mk('h2', null, T), mk('p', 'desc', D));
    var p = mk('div', 'panel');
    var form = mk('div', 'clrow'); form.style.gridTemplateColumns = 'minmax(0,1fr)';
    var t = input(editing ? editing.title : '', '제목 (예: 추석 연휴 배송 일정 안내)'); t.maxLength = 120;
    var b = mk('textarea', 'ta'); b.value = editing ? editing.body : ''; b.placeholder = '내용 · 주소(https://…)는 상담사 화면에서 눌러서 열 수 있어요'; b.style.minHeight = '140px';
    var opts = mk('div', 'ins'), imp = mk('input'), pin = mk('input'); imp.type = pin.type = 'checkbox';
    imp.checked = !!(editing && editing.important); pin.checked = !!(editing && editing.pin);
    var l1 = mk('label'), l2 = mk('label'); l1.append(imp, ' 중요(빨간 표시)'); l2.append(pin, ' 맨 위에 고정 · 스크립트 화면 위 띠에도 보임');
    opts.append(l1, l2);
    var acts = mk('div', 'facts');
    if (editing) acts.append(btn('고치기 취소', 'ghost', function () { editing = null; notices(w); }));
    acts.append(mk('span', 'sp'));
    var go = btn(editing ? '고친 공지 올리기' : '공지 올리기', 'primary', async function () {
      var title = t.value.trim(), body = b.value.replace(/\r\n?/g, '\n').trim();
      if (!title) { say('제목을 적어 주세요', 'err'); t.focus(); return; }
      go.disabled = true; go.textContent = '올리는 중…';
      var item = { id: editing ? editing.id : rid(), title: title, body: body, important: imp.checked, pin: pin.checked, at: editing ? editing.at : Date.now(), by: '' };
      try {
        await KBAdmin.saveNotices(function (ns) {
          var i = ns.findIndex(function (n) { return n.id === item.id; });
          if (i >= 0) ns[i] = item; else ns.unshift(item);
          return ns.slice(0, 200);
        }, (editing ? '공지 고침: ' : '공지: ') + title);
        say(editing ? '공지를 고쳤어요' : '공지를 올렸어요. 2분 안에 모든 PC에 보여요', 'ok');
        editing = null; notices(w);
      } catch (e) { go.disabled = false; go.textContent = '다시 올리기'; say((e && e.message) || '올리지 못했어요', 'err'); }
    });
    acts.append(go);
    form.append(lab(editing ? '공지 고치기' : '새 공지'), t, b, opts, acts);
    p.append(form);
    p.append(mk('div', 'colhd', '올린 공지 ' + list.length + '개'));
    if (!list.length) p.append(mk('div', 'empty', '아직 올린 공지가 없어요.'));
    list.sort(function (a, b) { return (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || (b.at || 0) - (a.at || 0); }).forEach(function (n) {
      var r = mk('div', 'hrow'); r.style.gridTemplateColumns = '96px minmax(0,1fr) auto auto';
      var tags = [n.pin ? '고정' : '', n.important ? '중요' : ''].filter(Boolean).join(' · ');
      r.append(mk('span', 'muted', when(n.at)));
      var tt = mk('span', 'note'); tt.append(mk('b', null, n.title)); if (tags) tt.append(mk('span', 'muted', '  ' + tags)); tt.title = n.body || '';
      r.append(tt);
      r.append(btn('고치기', 'ghost sm', function () { editing = n; notices(w); w.scrollTop = 0; }));
      r.append(btn('지우기', 'danger-ghost sm', async function () {
        if (!(await A().confirmDlg('이 공지를 지울까요?', '‘' + n.title + '’ 공지가 상담사 화면에서 사라져요. (깃허브 이전 판에는 남아 있어요)', '지우기', true))) return;
        try { await KBAdmin.saveNotices(function (ns) { return ns.filter(function (x) { return x.id !== n.id; }); }, '공지 지움: ' + n.title); say('지웠어요', 'ok'); notices(w); }
        catch (e) { say(e.message || '지우지 못했어요', 'err'); }
      }));
      p.append(r);
    });
    w.append(p);
  }

  /* ───── 요청시트 연결 ───── */
  async function sources(w) {
    var T = '요청시트 연결', D = '상담사 화면의 [문의 검색]·[불량가이드]·[공지]가 읽을 구글 시트예요. 앱스크립트 없이, 각 상담사 PC의 ‘검색기 연결’ 확장이 그 PC 크롬에 로그인된 회사 구글 계정으로 5분마다 읽어요(시트에는 아무것도 쓰지 않고, 고객 이름·연락처·주문번호 열은 읽지 않아요). 2024·2025년 요청시트는 확장에 이미 들어 있어요.';
    loading(w, T, D);
    var cur; try { cur = await KBAdmin.latest(); } catch (e) { failed(w, T, e); return; }
    var src = cur.parsed ? cur.parsed.sources : { requests: [], defects: null };
    var rows = src.requests.length ? src.requests.map(function (x) { return { label: x.label, url: x.url }; }) : [{ label: '2026 제품관련 문의', url: '' }];
    var def = { label: '제품 불량 모음', url: src.defects ? src.defects.url : '' };
    var ntc = { label: '족보 Daily 공지', url: src.notice ? src.notice.url : '' };
    w.replaceChildren(mk('h2', null, T), mk('p', 'desc', D));
    var how = mk('details', 'more'); how.open = !src.requests.length;
    how.append(mk('summary', null, '주소 복사하는 법(처음 한 번)'));
    var hi = mk('div', 'inner');
    ['① 크롬에서 요청시트(구글 시트)를 엽니다.', '② 아래쪽 탭에서 ‘2026 제품관련 문의’ 탭을 한 번 누릅니다.', '③ 맨 위 주소창을 눌러 주소 전체를 복사합니다(끝에 #gid=숫자 가 붙어 있으면 맞아요).', '④ 아래 칸에 붙여 넣고 [읽어 보기]로 확인한 뒤 [저장]을 누릅니다.', '⑤ 불량 모음은 ‘제품 불량 모음’ 탭, 공지는 족보 시트의 ‘Daily 공지’ 탭 주소를 같은 방법으로 넣어요.', '⑥ 새해가 되면 ‘2027 …’ 탭 주소를 한 줄 더 넣으면 돼요. 한 번 넣으면 그다음부터는 5분마다 저절로 읽어요(파일을 올릴 필요 없음).']
      .forEach(function (s) { hi.append(mk('div', null, s)); });
    how.append(hi);
    var p = mk('div', 'panel'); p.append(how);
    var box = mk('div', 'panel');
    function check(kind, getUrl, getLabel, out) {
      return btn('읽어 보기', 'ghost sm', async function () {
        var url = getUrl(); out.className = 'muted'; out.textContent = '';
        if (!KBData.sheetRef(url)) { out.className = 'chip err'; out.textContent = '구글 시트 주소 모양이 아니에요'; return; }
        if (!(await KBSheets.hasAccess())) { out.className = 'chip err'; out.textContent = '‘검색기 연결’ 확장이 있는 PC에서 확인할 수 있어요'; return; }
        out.textContent = '읽는 중…';
        try {
          if (kind === 'req') {
            var r = await KBSheets.readRequests({ url: url, label: getLabel() });
            var found = Object.keys(r.map).filter(function (f) { return KBSheets.FIELD_KO[f]; }).map(function (f) { return KBSheets.FIELD_KO[f] + '(' + r.map[f].header + ')'; });
            out.className = r.rows.length ? 'muted' : 'chip err';
            out.textContent = (r.rows.length ? '✓ ' + r.rows.length.toLocaleString() + '줄 읽음' : '읽은 줄이 없어요') + ' · 찾은 열: ' + (found.join(', ') || '없음') + (r.warnings.length ? ' · ⚠ ' + r.warnings.join(' · ') : '');
          } else if (kind === 'notice') {
            var nn = await KBSheets.readNotice({ url: url });
            out.className = nn.items.length ? 'muted' : 'chip err';
            out.textContent = (nn.items.length ? '✓ 공지 ' + nn.items.length + '개 읽음 · 맨 위: ' + (nn.items[0].title || '') : '읽은 공지가 없어요') + (nn.warnings.length ? ' · ⚠ ' + nn.warnings.join(' · ') : '');
          } else {
            var d = await KBSheets.readDefects({ url: url });
            out.className = d.rows.length ? 'muted' : 'chip err';
            out.textContent = (d.rows.length ? '✓ 불량 ' + d.rows.length + '건 읽음' : '읽은 불량이 없어요') + (d.warnings.length ? ' · ⚠ ' + d.warnings.join(' · ') : '');
          }
        } catch (e) { out.className = 'chip err'; out.textContent = e.message || '읽지 못했어요'; }
      });
    }
    function drawRows() {
      box.replaceChildren(lab('요청시트 탭', '연도마다 한 줄'));
      rows.forEach(function (r, i) {
        var row = mk('div', 'clrow'); row.style.gridTemplateColumns = '180px minmax(0,1fr) auto 34px';
        var l = input(r.label, '이름 (예: 2026 제품관련 문의)'); l.maxLength = 40; l.addEventListener('input', function () { r.label = l.value; });
        var u = input(r.url, 'https://docs.google.com/spreadsheets/d/…/edit#gid=…'); u.addEventListener('input', function () { r.url = u.value.trim(); });
        var out = mk('div', 'muted'); out.style.gridColumn = '1 / -1'; out.style.fontSize = '12px';
        var x = mk('button', 'tb', '✕'); x.type = 'button'; x.title = '이 줄 빼기'; x.addEventListener('click', function () { rows.splice(i, 1); drawRows(); });
        row.append(l, u, check('req', function () { return r.url; }, function () { return r.label; }, out), x, out);
        box.append(row);
      });
      var add = btn('+ 요청시트 탭 추가', 'ghost', function () { rows.push({ label: '', url: '' }); drawRows(); }); add.style.alignSelf = 'flex-start'; box.append(add);
      box.append(lab('제품 불량 모음 탭', '불량가이드 화면'));
      var drow = mk('div', 'clrow'); drow.style.gridTemplateColumns = 'minmax(0,1fr) auto';
      var du = input(def.url, 'https://docs.google.com/spreadsheets/d/…/edit#gid=…'); du.addEventListener('input', function () { def.url = du.value.trim(); });
      var dout = mk('div', 'muted'); dout.style.gridColumn = '1 / -1'; dout.style.fontSize = '12px';
      drow.append(du, check('def', function () { return def.url; }, null, dout), dout);
      box.append(drow);
      box.append(lab('족보 ‘Daily 공지’ 탭', '공지 화면 · 시트에 쓰던 대로 쓰면 저절로 보여요'));
      var nrow = mk('div', 'clrow'); nrow.style.gridTemplateColumns = 'minmax(0,1fr) auto';
      var nu = input(ntc.url, 'https://docs.google.com/spreadsheets/d/…/edit#gid=…'); nu.addEventListener('input', function () { ntc.url = nu.value.trim(); });
      var nout = mk('div', 'muted'); nout.style.gridColumn = '1 / -1'; nout.style.fontSize = '12px';
      nrow.append(nu, check('notice', function () { return ntc.url; }, null, nout), nout);
      box.append(nrow);
    }
    drawRows();
    p.append(box);
    var acts = mk('div', 'facts'); acts.append(mk('span', 'sp'));
    var save = btn('저장', 'primary', async function () {
      var reqs = rows.filter(function (r) { return r.url; });
      var bad = reqs.filter(function (r) { return !KBData.sheetRef(r.url); }).concat(def.url && !KBData.sheetRef(def.url) ? [def] : []).concat(ntc.url && !KBData.sheetRef(ntc.url) ? [ntc] : []);
      if (bad.length) { say('구글 시트 주소가 아닌 칸이 있어요: ' + (bad[0].label || bad[0].url).slice(0, 40), 'err'); return; }
      save.disabled = true; save.textContent = '저장하는 중…';
      try {
        await KBAdmin.saveSources({ requests: reqs.map(function (r) { return { url: r.url, label: r.label.trim() }; }), defects: def.url ? { url: def.url, label: '제품 불량 모음' } : null, notice: ntc.url ? { url: ntc.url, label: '족보 Daily 공지' } : null });
        say('저장했어요. 상담사 PC에는 2분 안에 반영돼요', 'ok'); sources(w);
      } catch (e) { save.disabled = false; save.textContent = '저장'; say(e.message || '저장하지 못했어요', 'err'); }
    });
    acts.append(save); p.append(acts);
    w.append(p);
  }

  /* ───── 깃허브 연결 ───── */
  function guideSteps() {
    var d = mk('details', 'more');
    d.append(mk('summary', null, '처음 한 번: 깃허브 저장소와 키 만드는 법 (자세한 그림: 함께 드린 ‘CS_처음부터_설명서’ 04번)'));
    var i = mk('div', 'inner');
    [
      '① github.com 에 로그인 → 오른쪽 위 ＋ → New repository',
      '② Repository name: cs-content · 아래에서 반드시 Private(비공개) 고르기 → Create repository',
      '③ 오른쪽 위 내 사진 → Settings → 왼쪽 맨 아래 Developer settings → Personal access tokens → Fine-grained tokens → Generate new token',
      '④ [관리 키] 이름: CS 관리 · Expiration: Custom → 1년 뒤 날짜 · Repository access: Only select repositories → cs-content · Permissions: [+ Add permissions] → Contents 체크 → Access를 Read and write로 → Generate token → 나온 키를 복사해 아래 ‘관리 키’ 칸에 붙여 넣기',
      '⑤ [사용 키] 같은 방법으로 하나 더: 이름 CS 사용 · Contents: Read-only → 복사해 두었다가, 연결된 뒤 ‘상담사용 연결 코드 만들기’에 붙여 넣기',
      '키는 비밀번호와 같아요. 관리 키는 이 PC 말고 어디에도 붙여 넣지 마세요. 1년이 지나면 같은 방법으로 새로 만들어 바꿔 주면 돼요.'
    ].forEach(function (s) { i.append(mk('div', null, s)); });
    d.append(i);
    return d;
  }
  function connectForm(onDone, have) {
    var p = mk('div', 'panel');
    var repo = input(have ? 'https://github.com/' + have.owner + '/' + have.repo : '', 'https://github.com/내아이디/cs-content');
    var tok = input('', have ? '바꿀 때만 새 관리 키를 붙여 넣으세요' : 'github_pat_…', 'password'); tok.autocomplete = 'off';
    var who = input(have && have.name || '', '예: 김수빈 (이전 판 목록에 남는 이름 · 비워도 돼요)'); who.maxLength = 20;
    var out = mk('div', 'muted'); out.style.fontSize = '12.5px'; out.style.whiteSpace = 'pre-line';
    p.append(lab('저장소 주소', '깃허브에서 만든 비공개 저장소'), repo, lab('관리 키', '쓰기 권한 키 · 이 PC에만 저장'), tok, lab('내 이름', '선택'), who);
    var acts = mk('div', 'facts'); acts.append(mk('span', 'sp'));
    var go = btn(have ? '연결 바꾸기' : '연결 확인', 'primary', async function () {
      var ref = KBData.repoRef(repo.value), token = tok.value.trim() || (have && have.token) || '';
      if (!ref) { out.className = 'chip err'; out.textContent = '저장소 주소를 확인해 주세요 (예: https://github.com/아이디/cs-content)'; return; }
      if (!token) { out.className = 'chip err'; out.textContent = '관리 키를 붙여 넣어 주세요'; return; }
      var c = { owner: ref.owner, repo: ref.repo, branch: '', path: 'cs-content.json', token: token, name: who.value.trim() };
      go.disabled = true; out.className = 'muted'; out.textContent = '확인하는 중…';
      try {
        var info = await KBGitHub.repoInfo(c);
        if (!info.private) { out.className = 'chip err'; out.textContent = '공개(Public) 저장소예요. 아무나 볼 수 있으니 저장소 Settings → 맨 아래 Change visibility → Private 로 바꾼 뒤 다시 눌러 주세요.'; go.disabled = false; return; }
        var f = await KBGitHub.getFile(c, '');
        await chrome.storage.local.set({ [KBAdmin.KEY]: c });
        if (f.status === 404) {
          out.textContent = '연결됐어요. 저장소가 아직 비어 있어서, 지금 확장에 들어 있는 문안(운영 시트 258개)을 처음으로 올릴게요…';
          var sc = await KBAdmin.bundled(); sc.version = 1; sc.at = KBData.stamp(Date.now()).slice(0, 16); sc.by = c.name; sc.note = '처음 올림(운영 시트에서 가져온 문안)';
          await KBGitHub.putFile(c, KBData.buildFile({ scripts: sc, notices: [], sources: { requests: [], defects: null } }), '', '멘트 1판 · 처음 올림(운영 시트에서 가져온 문안 ' + KBData.count(sc) + '개)');
        } else if (!KBData.parseContent(f.json).scripts) {
          out.className = 'chip err'; out.textContent = '저장소의 cs-content.json 파일이 망가져 있어요. [이전 판 · 되돌리기]로 되돌리거나 관리자에게 문의해 주세요.'; go.disabled = false; return;
        }
        out.className = 'muted'; out.textContent = '✓ 연결됐어요.';
        setTimeout(onDone, 500);
      } catch (e) {
        go.disabled = false; out.className = 'chip err';
        out.textContent = (e.status === 403 || e.status === 404 && /권한|찾지/.test(e.message) ? e.message + '\n(키를 만들 때 Repository access에서 이 저장소를 골랐는지, Contents가 Read and write인지 확인해 주세요)' : e.message || '연결하지 못했어요');
      }
    });
    acts.append(go); p.append(acts, out);
    return p;
  }
  async function github(w) {
    var c = await KBAdmin.getConn();
    w.replaceChildren(mk('h2', null, '깃허브 연결'), mk('p', 'desc', '멘트·공지·요청시트 주소는 깃허브의 비공개 저장소 파일 하나(cs-content.json)에 보관돼요. 올릴 때마다 한 판씩 남아서 언제든 되돌릴 수 있어요. 상담사 PC는 ‘상담사용 연결 코드’로 읽기만 해요.'));
    var p = mk('div', 'panel');
    if (c) {
      var st = mk('div', 'clrow'); st.style.gridTemplateColumns = 'minmax(0,1fr)';
      st.append(mk('div', null, '연결된 저장소: ' + c.owner + '/' + c.repo + (c.name ? ' · ' + c.name : '')));
      var a = mk('a', null, '깃허브에서 저장소 열기 ↗'); a.href = 'https://github.com/' + c.owner + '/' + c.repo; a.target = '_blank'; a.rel = 'noopener'; st.append(a);
      p.append(st);
      // 상담사용 연결 코드
      p.append(lab('상담사용 연결 코드 만들기', '읽기 전용 ‘사용 키’로 만들어요'));
      var rk = input('', '사용 키(Contents: Read-only) 붙여 넣기 · github_pat_…', 'password'); rk.autocomplete = 'off';
      var out = mk('textarea', 'ta'); out.readOnly = true; out.hidden = true; out.style.minHeight = '70px'; out.style.fontFamily = 'ui-monospace,Consolas,monospace'; out.style.fontSize = '12px';
      var msg = mk('div', 'muted'); msg.style.fontSize = '12.5px'; msg.style.whiteSpace = 'pre-line';
      var row = mk('div', 'facts'); row.append(mk('span', 'sp'));
      var cp = btn('코드 복사', 'ghost', async function () { try { await navigator.clipboard.writeText(out.value); say('복사했어요. 사내 메신저로 상담사에게 보내 주세요', 'ok'); } catch (e) { out.select(); } });
      cp.hidden = true;
      var mkc = btn('연결 코드 만들기', 'primary', async function () {
        var t = rk.value.trim(); if (!t) { msg.textContent = '사용 키를 붙여 넣어 주세요'; return; }
        if (t === c.token) { msg.textContent = '관리 키와 같은 키예요. 상담사용은 읽기 전용(Read-only) 키를 따로 만들어 주세요(관리 키가 퍼지면 누구나 멘트를 바꿀 수 있어요).'; return; }
        var rc = { owner: c.owner, repo: c.repo, branch: c.branch || '', path: c.path || 'cs-content.json', token: t };
        mkc.disabled = true; msg.textContent = '사용 키로 읽어 보는 중…';
        try {
          var f = await KBGitHub.getFile(rc, '');
          if (f.status !== 200) { msg.textContent = '사용 키로 파일을 읽지 못했어요. 먼저 멘트를 한 번 올려 주세요.'; mkc.disabled = false; return; }
          out.value = KBData.makeCode(rc); out.hidden = false; cp.hidden = false;
          msg.textContent = '✓ 만들었어요. 상담사는 스크립트 검색기 오른쪽 위 톱니바퀴 → 연결 코드 넣기에 붙여 넣으면 돼요.\n이 코드 안에는 읽기 전용 키가 들어 있어요. 사내 메신저로만 보내 주세요.';
        } catch (e) { msg.textContent = e.message || '확인하지 못했어요'; }
        mkc.disabled = false;
      });
      row.append(cp, mkc);
      p.append(rk, row, out, msg);
      p.append(lab('연결 바꾸기', '저장소나 관리 키를 바꿀 때'));
      p.append(connectForm(function () { location.reload(); }, c));
      var off = btn('이 PC에서 관리자 연결 끊기', 'danger-ghost sm', async function () {
        if (!(await A().confirmDlg('관리자 연결을 끊을까요?', '이 PC에서 관리 키를 지워요. 깃허브의 멘트는 그대로예요. 다시 쓰려면 관리 키를 다시 넣어야 해요.', '끊기', true))) return;
        await chrome.storage.local.remove(KBAdmin.KEY); location.reload();
      });
      off.style.alignSelf = 'flex-start'; p.append(off);
    }
    p.append(guideSteps());
    w.append(p);
  }

  /* 처음(관리 키가 없을 때): 화면 전체에 연결 카드 */
  function connectScreen() {
    window.KBAdminExtra.connecting = true; // 처음 연결 화면에서는 뒤에서 오는 변경으로 본 화면을 그리지 않음
    document.title = '멘트 관리 · 깃허브 연결';
    var wrap = mk('div', 'edit'); wrap.style.height = '100%';
    var box = mk('div', 'form'); box.style.margin = '6vh auto 0'; box.style.maxWidth = '640px';
    box.append(mk('h2', null, '멘트 관리 — 처음 연결'));
    box.append(mk('p', 'muted', '관리자 PC에서 한 번만 하면 돼요. 깃허브에 비공개 저장소와 키 두 개(관리 키 · 사용 키)를 만든 뒤, 아래에 저장소 주소와 관리 키를 넣고 [연결 확인]을 누르세요. 저장소가 비어 있으면 지금 문안 258개를 처음으로 올려 줘요.'));
    box.append(guideSteps());
    box.append(connectForm(function () { location.reload(); }, null));
    wrap.append(box);
    document.body.replaceChildren(wrap);
  }

  window.KBAdminExtra = { views: { notices: notices, sources: sources, github: github }, connectScreen: connectScreen };
})();
