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
  function openViewer(items, i, title) { lastFocus = document.activeElement; V = { items: items, i: i, zoom: false, play: false, title: title || '' }; draw(); document.getElementById('lb').hidden = false; var c = document.querySelector('#lb .close'); if (c) c.focus(); }
  function close() { document.getElementById('lb').hidden = true; document.getElementById('lb').replaceChildren(); V = null; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  function step(d) { if (!V || V.items.length < 2) return; V.i = (V.i + d + V.items.length) % V.items.length; V.zoom = false; V.play = false; draw(); }
  function btn(cls, label, icon, fn) { var b = el('button', cls); b.type = 'button'; if (icon) b.append(svgIcon(icon)); if (label) b.append(label); b.addEventListener('click', fn); return b; }
  function draw() {
    var L = document.getElementById('lb'), it = V.items[V.i], later = []; L.replaceChildren();
    var top = el('div', 'lbtop');
    top.append(el('b', null, V.title || '사진'), el('span', 'cnt', (V.i + 1) + ' / ' + V.items.length));
    if (it.name) top.append(el('span', 'cnt', it.name));
    top.append(el('span', 'sp'));
    if (it.id && !it.video) top.append(btn('lbb', V.zoom ? '화면에 맞추기' : '원래 크기', '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5' + (V.zoom ? '' : 'M10.5 8v5') + 'M8 10.5h5"/>', function () { V.zoom = !V.zoom; draw(); }));
    if (it.id && !it.video && !V.play) top.append(btn('lbb', '영상이면 재생', '<path d="M7 4.5v15l12-7.5z"/>', function () { V.play = true; draw(); }));
    var o = el('a', 'lbb'); o.href = openUrl(it); o.target = '_blank'; o.rel = 'noopener noreferrer'; o.append(svgIcon('<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'), '드라이브에서 열기'); top.append(o);
    var x = btn('lbb close', '닫기', '<path d="M6 6l12 12M18 6 6 18"/>', close); x.title = '닫기 (Esc)'; top.append(x);
    var st = el('div', 'stage' + (V.zoom ? ' zoom' : ''));
    if ((it.video || V.play) && it.id) {
      var f = el('iframe'); f.src = previewUrl(it); f.allow = 'autoplay; fullscreen'; f.setAttribute('allowfullscreen', ''); f.title = '드라이브 미리보기'; f.referrerPolicy = 'no-referrer'; st.append(f);
    } else {
      var im = el('img'); im.alt = V.title || '사진'; im.referrerPolicy = 'no-referrer';
      im.addEventListener('click', function () { V.zoom = !V.zoom; draw(); });
      st.append(im);
      later.push(function () { load(im, it, V.zoom ? 2400 : 1600, function (kind) { im.remove(); st.append(el('div', 'msg', (kind === 'denied' ? '이 계정으로는 볼 수 없는 사진이에요.' : kind === 'login' ? '구글 로그인이 필요해요.' : '여기서는 사진을 불러오지 못했어요.') + '\n위쪽 [드라이브에서 열기]로 원본을 열어 보세요.')); }); });
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
      b.addEventListener('click', function () { V.i = j; V.zoom = false; V.play = false; draw(); });
      sp.append(b);
    });
    L.append(top, st, sp);
    later.forEach(function (f) { f(); }); // 화면에 붙인 뒤에 불러와야 ‘사라진 사진’으로 건너뛰지 않음
  }
  document.addEventListener('keydown', function (e) {
    if (!V) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
  }, true);

  root.CSMedia = { _state: function () { return { active: active, queue: queue.length }; }, itemsOf: itemsOf, strip: strip, openViewer: openViewer, isOpen: function () { return !!V; }, driveId: driveId, thumbUrl: thumbUrl };
})(window);
