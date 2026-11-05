/* 사진·영상: 구글 드라이브 링크 → 작은 사진(보이는 것만 불러옴) → 누르면 크게(← → · 원래 크기 · Esc)
   · 드라이브는 한꺼번에 사진을 많이 부르면 막히므로: 화면에 들어온 것만, 동시에 4장까지, 작은 크기로
   · 이 브라우저에서 바로 안 보이면(쿠키 막힘 등) ‘검색기 연결’ 확장이 대신 받아 옴 · 그래도 안 되면 ‘권한 없음’ 표시 + 원본 열기 */
(function (root) {
  'use strict';
  var VIDEO = /\.(mp4|mov|m4v|avi|wmv|webm|3gp|mkv)$/i, IMAGE = /\.(jpe?g|png|gif|webp|heic|bmp)$/i;
  function str(v) { return v == null ? '' : String(v); }
  function driveId(url) {
    var u = str(url), m = /\/file\/d\/([A-Za-z0-9_-]{20,})/.exec(u) || /[?&]id=([A-Za-z0-9_-]{20,})/.exec(u) || /\/d\/([A-Za-z0-9_-]{20,})\/?(?:view|preview|edit)?/.exec(u);
    return m && /drive\.google\.com|docs\.google\.com|drive\.usercontent\.google\.com/.test(u) ? m[1] : '';
  }
  function resourceKey(url) { var m = /[?&]resourcekey=([A-Za-z0-9_-]+)/.exec(str(url)); return m ? m[1] : ''; }
  /* 줄 하나의 사진 목록: [{ url, id, name, video }] — 확장이 준 media가 있으면 그것, 없으면 글자 속 주소 */
  function itemsOf(row) {
    var out = [], seen = {};
    var add = function (url, name) {
      url = str(url).trim(); if (!/^https:\/\//.test(url)) return;
      var id = driveId(url), key = id || url; if (seen[key]) return; seen[key] = 1;
      var nm = str(name).trim();
      var isDriveFolder = /drive\.google\.com\/drive\/folders\//.test(url);
      if (!id && !IMAGE.test(url.split('?')[0])) { out.push({ url: url, name: nm, link: true, folder: isDriveFolder }); return; }
      out.push({ url: url, id: id, rk: resourceKey(url), name: nm, video: VIDEO.test(nm) || VIDEO.test(url.split('?')[0]) });
    };
    (Array.isArray(row.media) ? row.media : []).forEach(function (m) { if (m) add(m.url, m.name); });
    str(row.at).split(/\s+/).forEach(function (u) { add(u, ''); });
    return out;
  }
  function thumbUrl(it, w) {
    if (it.id) return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(it.id) + '&sz=w' + (w || 400) + (it.rk ? '&resourcekey=' + encodeURIComponent(it.rk) : '');
    return it.url;
  }
  function openUrl(it) { return it.id ? 'https://drive.google.com/file/d/' + it.id + '/view' + (it.rk ? '?resourcekey=' + it.rk : '') : it.url; }
  function previewUrl(it) { return 'https://drive.google.com/file/d/' + it.id + '/preview' + (it.rk ? '?resourcekey=' + it.rk : ''); }

  /* 동시에 4장까지 */
  var queue = [], active = 0, MAX = 4;
  function pump() { while (active < MAX && queue.length) { var job = queue.shift(); active++; job(function () { active--; pump(); }); } }
  var proxied = new Map(); // id|w → dataURL (확장이 대신 받은 것)
  function load(img, it, w, onFail) {
    queue.push(function (done) {
      var finished = false, end = function () { if (!finished) { finished = true; done(); } };
      if (!img.isConnected) { end(); return; } // 화면이 다시 그려져 사라진 사진은 건너뜀(줄이 막히지 않게)
      var tryProxy = function () {
        var k = it.id + '|' + w;
        if (!it.id || !root.CSBridge) { onFail('open'); end(); return; }
        if (proxied.has(k)) { img.onload = function () { img.classList.add('ok'); }; img.onerror = function () { onFail('open'); }; img.src = proxied.get(k); end(); return; }
        CSBridge.call('photo', { id: it.id, rk: it.rk || '', w: w }, 30000).then(function (r) {
          if (r && r.dataUrl) { proxied.set(k, r.dataUrl); if (proxied.size > 120) proxied.delete(proxied.keys().next().value); img.onload = function () { img.classList.add('ok'); }; img.onerror = function () { onFail('open'); }; img.src = r.dataUrl; }
          else onFail('denied');
        }, function (e) { onFail(e.kind === 'denied' ? 'denied' : e.kind === 'login' ? 'login' : 'open'); }).then(end, end);
      };
      img.onload = function () { img.onload = img.onerror = null; img.classList.add('ok'); end(); };
      img.onerror = function () { img.onload = img.onerror = null; tryProxy(); };
      img.referrerPolicy = 'no-referrer';
      img.src = thumbUrl(it, w);
      setTimeout(end, 15000); // 너무 오래 걸려도 다음 사진을 막지 않게(사진은 계속 받아짐)
    });
    pump();
  }
  /* 보이는 것 + 한 화면쯤 아래까지 미리. 목록은 자기 안에서 스크롤되므로 그 목록을 기준으로 봄 */
  var observers = new Map();
  function observerFor(rootEl) {
    var key = rootEl || document;
    if (observers.has(key)) return observers.get(key);
    var o = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (!e.isIntersecting) return; o.unobserve(e.target); var f = e.target._load; if (f) f(); });
    }, { root: rootEl || null, rootMargin: '600px 0px' });
    observers.set(key, o); return o;
  }
  var io = 'IntersectionObserver' in window;
  function watch(b) {
    if (!io) { b._load(); return; }
    // 붙은 뒤에 어느 목록 안인지 알 수 있음
    requestAnimationFrame(function () { if (!b.isConnected) return; var root = b.closest('.results'); observerFor(root && root.scrollHeight > root.clientHeight + 4 ? root : null).observe(b); });
  }

  /* 크게 보기 판: 검색기 웹은 #lb · 검색기 연결(구글 시트 위)은 자기 상자를 줌(root.CSMediaLB) */
  function LB() { return root.CSMediaLB ? root.CSMediaLB() : document.getElementById('lb'); }
  function svgIcon(p) { var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.innerHTML = p; return s; }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  var NO = { denied: '이 계정으로는\n볼 수 없는 사진', login: '구글 로그인이\n필요해요', open: '여기서 못 보는 사진\n눌러서 원본 열기' };

  /* 사진 줄. title: 크게 볼 때 위에 쓸 이름 */
  function strip(items, title, big) {
    var pics = items.filter(function (x) { return !x.link; }), links = items.filter(function (x) { return x.link; });
    var wrap = el('div');
    if (pics.length) {
      var s = el('div', 'photos' + (big ? ' big' : '')), max = big ? 5 : 4;
      pics.slice(0, max).forEach(function (it, i) {
        var b = el('button', 'ph'); b.type = 'button'; b.title = it.video ? '영상 보기' : '크게 보기'; b.setAttribute('aria-label', (it.video ? '영상 ' : '사진 ') + (i + 1) + ' 크게 보기');
        var sp = el('span', 'spin'), im = el('img'); im.alt = ''; im.decoding = 'async'; b.append(sp, im);
        var fail = function (kind) { sp.remove(); im.remove(); b.append(el('span', 'no', NO[kind] || NO.open)); b.dataset.fail = kind; };
        im._done = function () { sp.remove(); };
        im.addEventListener('load', function () { sp.remove(); });
        b._load = function () { load(im, it, big ? 480 : 360, fail); };
        watch(b);
        if (it.video) { var p = el('span', 'play'), ii = el('i'); ii.append(svgIcon('<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>')); p.append(ii); b.append(p); }
        if (i === max - 1 && pics.length > max) b.append(el('span', 'more', '+' + (pics.length - max + 1)));
        else b.append(el('span', 'lbl', it.video ? '영상' : String(i + 1)));
        b.addEventListener('click', function () { openViewer(pics, i, title); });
        s.append(b);
      });
      wrap.append(s);
    }
    if (links.length) {
      var l = el('div', 'links'); l.style.marginTop = pics.length ? '8px' : '0';
      links.slice(0, 6).forEach(function (it) { var a = el('a', 'btn sm', it.folder ? '드라이브 폴더 열기 ↗' : (it.name || '첨부 링크 열기') + ' ↗'); a.href = it.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; l.append(a); });
      wrap.append(l);
    }
    return pics.length || links.length ? wrap : null;
  }

  /* 크게 보기 */
  var V = null, lastFocus = null;
  /* 2026-11-05.2 영상이면 바로 재생: 시트 링크엔 파일 이름이 없어 사진인지 영상인지 모름 → 검색기 연결(1.0.9)이 드라이브에서 종류를 알아 옴
     · 영상이면 그 자리에서 재생 화면으로 바꿈 · 확장이 없거나 예전 판이면 지금처럼 [영상이면 재생] */
  var kinds = new Map(); // id → 'video' | 'image' | ''
  function checkKinds(items) {
    var B = root.CSBridge; if (!B || !B.ready) return;
    items.forEach(function (it) {
      if (!it.id || it.video || it.kindAsked) return; it.kindAsked = true;
      var known = kinds.get(it.id);
      var apply = function (k) {
        if (k !== 'video') return; it.video = true; it.auto = true;
        if (V && V.items.indexOf(it) >= 0) { if (V.items[V.i] === it && !V.play) draw(); else markStrip(); }
      };
      if (known != null) { apply(known); return; }
      B.call('kind', { id: it.id, rk: it.rk || '' }, 20000).then(function (r) { var k = r && r.kind || ''; kinds.set(it.id, k); apply(k); }, function () {});
    });
  }
  function markStrip() { if (!V) return; var bs = LB().querySelectorAll('.strip button'); V.items.forEach(function (t, j) { if (t.video && bs[j] && !bs[j].querySelector('.play')) { var p = el('span', 'play'), ii = el('i'); ii.append(svgIcon('<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>')); p.append(ii); bs[j].append(p); } }); }
  function openViewer(items, i, title) { lastFocus = document.activeElement; V = { items: items, i: i, s: 1, play: false, title: title || '' }; draw(); checkKinds(items); LB().hidden = false; var c = LB().querySelector('.close'); if (c) c.focus(); }
  function close() { LB().hidden = true; LB().replaceChildren(); V = null; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  function step(d) { if (!V || V.items.length < 2) return; V.i = (V.i + d + V.items.length) % V.items.length; V.s = 1; V.play = false; draw(); }
  function btn(cls, label, icon, fn) { var b = el('button', cls); b.type = 'button'; if (icon) b.append(svgIcon(icon)); if (label) b.append(label); b.addEventListener('click', fn); return b; }
  function draw() {
    var L = LB(), it = V.items[V.i], later = []; L.replaceChildren();
    var top = el('div', 'lbtop');
    top.append(el('b', null, V.title || '사진'), el('span', 'cnt', (V.i + 1) + ' / ' + V.items.length));
    if (it.name) top.append(el('span', 'cnt', it.name));
    top.append(el('span', 'sp'));
    if (it.id && !it.video && !V.play) {
      var zg = el('div', 'zgrp'); zg.setAttribute('role', 'group'); zg.setAttribute('aria-label', '크기');
      var zo = btn('lbb zb', '축소', '<path d="M5 12h14"/>', function () { zoomBy(-1); }); zo.title = '작게 (−)'; zo.setAttribute('aria-label', '작게');
      var zl = btn('lbb zl', '맞춤', null, function () { setZoom(1); }); zl.title = '화면에 맞추기 (0)';
      var zi = btn('lbb zb', '확대', '<path d="M5 12h14M12 5v14"/>', function () { zoomBy(1); }); zi.title = '크게 (+)'; zi.setAttribute('aria-label', '크게');
      var zr = el('input', 'zr'); zr.type = 'range'; zr.min = '100'; zr.max = '800'; zr.step = '5'; zr.value = '100'; zr.title = '끌어서 크기 고르기'; zr.setAttribute('aria-label', '크기 막대');
      zr.addEventListener('input', function () { setZoom(Number(zr.value) / 100); });
      zg.append(zo, zl, zi); top.append(zg, zr); V.zl = zl; V.zo = zo; V.zi = zi; V.zr = zr;
    }
    if (it.id && it.video && it.auto) top.append(btn('lbb', '사진으로 보기', '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-8 8"/>', function () { it.video = false; it.auto = false; V.play = false; draw(); })); // 혹시 사진인데 영상으로 잘못 알았을 때
    if (it.id && !it.video && !V.play) top.append(btn('lbb', '영상이면 재생', '<path d="M7 4.5v15l12-7.5z"/>', function () { V.play = true; draw(); }));
    var o = el('a', 'lbb'); o.href = openUrl(it); o.target = '_blank'; o.rel = 'noopener noreferrer'; o.append(svgIcon('<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'), '드라이브에서 열기'); top.append(o);
    var x = btn('lbb close', '닫기', '<path d="M6 6l12 12M18 6 6 18"/>', close); x.title = '닫기 (Esc)'; top.append(x);
    var st = el('div', 'stage'); V.st = st; V.im = null; V.fitW = 0; V.hi = false;
    if ((it.video || V.play) && it.id) {
      var f = el('iframe'); f.src = previewUrl(it); f.allow = 'autoplay; fullscreen'; f.setAttribute('allowfullscreen', ''); f.title = '드라이브 미리보기'; f.referrerPolicy = 'no-referrer'; st.append(f);
    } else {
      var im = el('img'); im.alt = V.title || '사진'; im.referrerPolicy = 'no-referrer';
      im.draggable = false; V.im = im;
      st.append(im); panZoom(st, im);
      im.addEventListener('load', function () { fitSmall(); });
      later.push(function () { load(im, it, bigW(), function (kind) { im.remove(); st.append(el('div', 'msg', (kind === 'denied' ? '이 계정으로는 볼 수 없는 사진이에요.' : kind === 'login' ? '구글 로그인이 필요해요.' : '여기서는 사진을 불러오지 못했어요.') + '\n위쪽 [드라이브에서 열기]로 원본을 열어 보세요.')); }); });
    }
    if (V.items.length > 1) {
      var l = btn('navb l', '', '<path d="m15 5-7 7 7 7"/>', function () { step(-1); }); l.title = '이전 (←)'; l.setAttribute('aria-label', '이전 사진');
      var r = btn('navb r', '', '<path d="m9 5 7 7-7 7"/>', function () { step(1); }); r.title = '다음 (→)'; r.setAttribute('aria-label', '다음 사진');
      st.append(l, r);
    }
    var sp = el('div', 'strip');
    V.items.forEach(function (t, j) {
      var b = el('button'); b.type = 'button'; b.setAttribute('aria-current', String(j === V.i)); b.title = (j + 1) + '번째';
      var im2 = el('img'); im2.alt = ''; b.append(im2); later.push(function () { load(im2, t, 160, function () {}); });
      b.addEventListener('click', function () { V.i = j; V.s = 1; V.play = false; draw(); });
      sp.append(b);
    });
    var hint = el('div', 'lbhint', it.id && !it.video && !V.play ? '방향키 위 확대 · 아래 축소 · 왼쪽 이전 사진 · 오른쪽 다음 사진 · 0번 원래대로 · 마우스 휠로도 확대·축소' : '← → 다음 사진 · Esc 닫기');
    L.append(top, st, sp, hint);
    markStrip();
    later.forEach(function (f) { f(); }); // 화면에 붙인 뒤에 불러와야 ‘사라진 사진’으로 건너뛰지 않음
    zoomUi();
  }
  /* 큰 사진 크기: 화면 크기 × 화면 선명도(최소 1600 · 최대 4000, 백 단위로 맞춰 같은 사진을 또 받지 않게) */
  function bigW() { var px = Math.max(window.innerWidth || 0, window.innerHeight || 0) * (window.devicePixelRatio || 1); return Math.max(1600, Math.min(4000, Math.ceil(px / 400) * 400)); }
  /* 작게 올린 사진도 '맞춤'에서 화면 가득(원래 크기보다 작은 화면이면 그대로 줄여 맞춤) */
  function fitSmall() {
    var st = V && V.st, im = V && V.im; if (!st || !im || V.s !== 1 || !im.naturalWidth) return;
    var aw = st.clientWidth - (window.innerWidth <= 860 ? 24 : 140), ah = st.clientHeight - 8;
    if (aw <= 0 || ah <= 0) return;
    var k = Math.min(aw / im.naturalWidth, ah / im.naturalHeight);
    im.style.width = k > 1 ? Math.floor(im.naturalWidth * k) + 'px' : '';
  }
  window.addEventListener('resize', function () { if (V && V.s === 1) fitSmall(); });
  /* 크기 조절: 맞춤(1) → 1.5 → 2 → 3 → 4배. 다시 그리지 않고 그 자리에서 바꿈(사진이 깜빡이지 않게) */
  var STEPS = [1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5, 6, 8]; // 2026-11-05.2 잘게(주인: 무조건 2배 같다)
  function zoomUi() {
    if (!V || !V.zl) return;
    V.zl.textContent = V.s === 1 ? '맞춤' : Math.round(V.s * 100) + '%';
    V.zo.disabled = V.s <= 1; V.zi.disabled = V.s >= STEPS[STEPS.length - 1];
    if (V.zr && document.activeElement !== V.zr) V.zr.value = String(Math.round(V.s * 100));
  }
  // 지금 크기 다음 단계(막대로 맞춘 크기 사이에서도 바로 위·아래 단계로)
  function zoomBy(d, cx, cy) {
    if (!V) return; var n = V.s, t = null;
    if (d > 0) { for (var i = 0; i < STEPS.length; i++) if (STEPS[i] > n + 0.001) { t = STEPS[i]; break; } }
    else { for (var j = STEPS.length - 1; j >= 0; j--) if (STEPS[j] < n - 0.001) { t = STEPS[j]; break; } }
    if (t != null) setZoom(t, cx, cy);
  }
  function setZoom(n, cx, cy) {
    var st = V && V.st, im = V && V.im; if (!st || !im || !im.naturalWidth) return;
    if (V.s === 1) V.fitW = im.getBoundingClientRect().width; // 맞춤일 때 크기를 기준으로
    var r = st.getBoundingClientRect(), x = cx == null ? r.width / 2 : cx - r.left, y = cy == null ? r.height / 2 : cy - r.top;
    var fx = (st.scrollLeft + x) / Math.max(1, st.scrollWidth), fy = (st.scrollTop + y) / Math.max(1, st.scrollHeight);
    V.s = n;
    if (n === 1) { st.classList.remove('zoom'); im.style.width = ''; st.scrollLeft = st.scrollTop = 0; fitSmall(); zoomUi(); return; }
    st.classList.add('zoom'); im.style.width = Math.round(V.fitW * n) + 'px';
    st.scrollLeft = fx * st.scrollWidth - x; st.scrollTop = fy * st.scrollHeight - y;
    if (n >= 1.5 && !V.hi) { V.hi = true; var it = V.items[V.i]; var hi = new Image(); hi.referrerPolicy = 'no-referrer'; hi.onload = function () { if (V && V.im === im) im.src = hi.src; }; hi.src = thumbUrl(it, 4000); } // 크게 볼 땐 원본에 가까운 사진으로(받아지면 바꿈 · 드라이브는 원본보다 크게는 안 줌)
    zoomUi();
  }
  /* 휠 = 크기 · 끌기 = 옮기기 · 한 번 누르기 = 맞춤 ↔ 2배 */
  function panZoom(st, im) {
    var drag = null;
    // 휠 한 칸 = 한 단계 · 터치패드처럼 잘게 여러 번 오면 모아서 한 단계(한 번에 너무 커지지 않게)
    var acc = 0, accT = 0;
    st.addEventListener('wheel', function (e) {
      if (!V || !V.im) return; e.preventDefault();
      var d = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY, now = Date.now();
      if (now - accT > 300) acc = 0; accT = now; acc += d;
      if (Math.abs(acc) < 60 && Math.abs(d) < 60) return;
      var dir = acc < 0 ? 1 : -1; acc = 0; zoomBy(dir, e.clientX, e.clientY);
    }, { passive: false });
    st.addEventListener('pointerdown', function (e) { if (e.button !== 0 || e.target.closest('.navb')) return; drag = { x: e.clientX, y: e.clientY, l: st.scrollLeft, t: st.scrollTop, moved: false, onImg: e.target === im }; try { st.setPointerCapture(e.pointerId); } catch (x) {} });
    st.addEventListener('pointermove', function (e) {
      if (!drag) return; var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) { drag.moved = true; st.classList.add('grab'); }
      if (drag.moved && V && V.s > 1) { st.scrollLeft = drag.l - dx; st.scrollTop = drag.t - dy; }
    });
    var up = function (e) {
      if (!drag) return; var d = drag; drag = null; st.classList.remove('grab');
      // 2026-11-05.2 사진을 눌러도 크기는 안 바뀜(주인: 누를 때마다 말고 휠·방향키로)
    };
    st.addEventListener('pointerup', up); st.addEventListener('pointercancel', up);
  }
  document.addEventListener('keydown', function (e) {
    if (!V) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); zoomBy(1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); zoomBy(-1); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomBy(1); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomBy(-1); }
    else if (e.key === '0') { e.preventDefault(); setZoom(1); }
  }, true);

  /* 붙여 넣으면 사진 화면(2026-11-04.4): AS 시트 사진 칸처럼 드라이브 주소만 든 글을 Ctrl+V 하면 검색하지 않고 바로 크게 보기
     · 시트에서 여러 줄 칸을 복사하면 앞뒤에 따옴표가 붙음 → 뺌 · 주소 말고 다른 글이 섞이면 원래대로 붙여 넣음
     · 글을 쓰는 큰 칸(textarea·직접 쓰는 칸)에서는 원래대로 */
  function pastedItems(text, html) {
    var t = str(text).replace(/["'“”‘’]/g, ' ').trim(), urls = [];
    if (t) { var rest = t.replace(/https?:\/\/[^\s"'<>]+/g, function (u) { urls.push(u); return ' '; }); if (/[^\s,;·|]/.test(rest)) return []; }
    if (!urls.length && html) { var m, re = /href="([^"]+)"/g; while ((m = re.exec(str(html)))) urls.push(m[1].replace(/&amp;/g, '&')); }
    var hasDrive = urls.some(function (u) { return driveId(u); }); if (!hasDrive) return [];
    return itemsOf({ at: urls.join(' ') }).filter(function (x) { return !x.link; });
  }
  document.addEventListener('paste', function (e) {
    if (V || root.CSMediaNoPaste || !LB()) return; // 구글 시트 위에서는 붙여 넣기를 가로채지 않음
    var tg = e.target, cd = e.clipboardData; if (!cd) return;
    if (tg && tg.closest && (tg.closest('textarea') || tg.closest('[contenteditable=""],[contenteditable="true"]'))) return;
    var items = pastedItems(cd.getData('text/plain'), cd.getData('text/html')); if (!items.length) return;
    e.preventDefault(); e.stopPropagation();
    openViewer(items, 0, '붙여 넣은 사진·영상 ' + items.length + '개');
  }, true);

  root.CSMedia = { pastedItems: pastedItems, _state: function () { return { active: active, queue: queue.length, zoom: V ? V.s : 0 }; }, itemsOf: itemsOf, strip: strip, openViewer: openViewer, isOpen: function () { return !!V; }, driveId: driveId, thumbUrl: thumbUrl };
})(window);
