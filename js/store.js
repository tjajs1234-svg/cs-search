/* 이 PC에만 저장하는 것들. 개인 설정 저장 이름은 예전 검색기(v6)와 똑같이 둬서 백업 파일을 그대로 주고받을 수 있음.
   브라우저 기록을 지워도 되살릴 수 있게 ‘검색기 연결’ 확장에 한 벌 더 보관(확장이 있을 때) */
(function (root) {
  'use strict';
  var K = {
    favorites: 'cx_gas_workbench_favorites_v2', favoriteOrder: 'cx_gas_workbench_favorite_order_v2', recent: 'cx_gas_workbench_recent_v2',
    usage: 'cx_gas_workbench_usage_v2', note: 'cx_gas_workbench_note_v2', drafts: 'cx_gas_workbench_drafts_v2', theme: 'cx_gas_workbench_theme_v2',
    accent: 'cx_gas_workbench_accent_v1', shortcuts: 'cx_gas_workbench_shortcuts_v1', customScripts: 'cx_gas_workbench_custom_scripts_v2',
    customOrder: 'cx_gas_workbench_custom_order_v2', personalClosings: 'cx_gas_workbench_personal_closings_v1', viewMode: 'cx_gas_workbench_view_mode_v1',
    misses: 'cx_gas_workbench_search_misses_v1',
    // 새 화면에서 더한 것
    conn: 'csx:kbConn', admin: 'csx:kbAdmin', content: 'csx:kbContent', sync: 'csx:kbSync', seen: 'csx:noticeSeen', view: 'csx:view', cat: 'csx:cat'
  };
  var PERSONAL = ['favorites', 'favoriteOrder', 'recent', 'usage', 'note', 'drafts', 'theme', 'shortcuts', 'customScripts', 'customOrder', 'personalClosings', 'misses', 'seen'];
  var ok = true;
  function get(k) { try { return localStorage.getItem(k); } catch (e) { ok = false; return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { ok = false; return false; } }
  function del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function json(k, fb) { try { var r = get(k); if (r == null) return fb; var v = JSON.parse(r); return v == null ? fb : v; } catch (e) { return fb; } }
  function put(k, v) { var r = set(k, JSON.stringify(v)); if (PERSONAL.some(function (p) { return K[p] === k; })) mirrorSoon(); return r; }

  /* 확장에 한 벌 보관 */
  var mt = 0;
  function snapshot() { var o = {}; PERSONAL.forEach(function (p) { var v = get(K[p]); if (v != null) o[K[p]] = v; }); return o; }
  function mirrorSoon() { clearTimeout(mt); mt = setTimeout(function () { if (root.CSBridge && CSBridge.ready) CSBridge.call('mirror.save', { data: snapshot() }).catch(function () {}); }, 800); }
  /* 이 브라우저에 개인 설정이 하나도 없는데 확장에 보관본이 있으면 되살림 → 되살린 개수 */
  async function restoreIfEmpty() {
    var have = PERSONAL.some(function (p) { return p !== 'theme' && p !== 'seen' && get(K[p]) != null; });
    if (have || !root.CSBridge) return 0;
    var r = null; try { r = await CSBridge.call('mirror.load', {}); } catch (e) { return 0; }
    var data = r && r.data; if (!data || typeof data !== 'object') return 0;
    var n = 0; Object.keys(data).forEach(function (k) { if (/^(cx_gas_workbench_|csx:noticeSeen)/.test(k) && typeof data[k] === 'string') { set(k, data[k]); n++; } });
    return n;
  }
  root.CSStore = { K: K, get: get, set: set, del: del, json: json, put: put, writable: function () { return ok; }, restoreIfEmpty: restoreIfEmpty, mirrorSoon: mirrorSoon, snapshot: snapshot };
})(window);
