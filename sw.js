/* 앱으로 설치했을 때 필요한 것. 화면 파일만 보관(문안·문의 자료는 보관하지 않음).
   늘 새 판을 먼저 받아 보고(인터넷이 되면 고친 화면이 바로 반영), 안 되면 보관해 둔 판으로 엶 */
var CACHE = 'cs-search-shell-v2';
self.addEventListener('install', function (e) { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // 깃허브·구글로 가는 요청은 건드리지 않음
  e.respondWith((async function () {
    var c = await caches.open(CACHE);
    try {
      var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, 4000);
      var res = await fetch(req, { cache: 'no-cache', signal: ctl.signal }); clearTimeout(t);
      if (res && res.ok && res.type === 'basic') c.put(req, res.clone());
      return res;
    } catch (err) {
      var hit = await c.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') { var idx = await c.match('./'); if (idx) return idx; }
      throw err;
    }
  })());
});
