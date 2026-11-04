(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  const VERSION = 1;
  const BACKUP_KEY = 'shardfall.backup';
  const mem = {}; // in-memory fallback when storage is blocked
  let data = null;

  function defaults() {
    return {
      v: VERSION,
      meta: { shards: 0, nodes: {}, chars: ['ranger', 'dasher'], maxDanger: 0, runs: 0, wins: 0, bestWave: 0 },
      codex: { weapon: {}, item: {}, enemy: {}, boss: {}, evolution: {}, character: {} },
      settings: {
        language: 'vi', master: 0.8, music: 0.6, sfx: 0.8, shake: 100, reduceFlashing: false,
        damageNumbers: true, autoFire: false, aimAssist: true, showFps: false, fullscreen: false, quality: 'auto', autoAim: false
      },
      run: null
    };
  }
  function key() { return NR.config.SAVE_KEY; }

  // storage access never throws: blocked storage falls back to memory
  function sGet(k) {
    try { const ls = globalThis.localStorage; if (ls) { const v = ls.getItem(k); return v === undefined ? null : v; } } catch (e) { /* blocked */ }
    return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null;
  }
  function sSet(k, v) {
    try { const ls = globalThis.localStorage; if (ls) { ls.setItem(k, v); return true; } } catch (e) { /* blocked or full */ }
    mem[k] = v;
    return false;
  }
  function sDel(k) {
    try { const ls = globalThis.localStorage; if (ls) ls.removeItem(k); } catch (e) { /* blocked */ }
    delete mem[k];
  }

  // stepwise migrations: MIGRATIONS[n] upgrades a version-n save to n+1
  const MIGRATIONS = {
    // v0 (legacy flat layout) -> v1
    0: function (o) {
      const d = defaults();
      d.meta.shards = Number(o.shards) || 0;
      if (o.nodes && typeof o.nodes === 'object') d.meta.nodes = o.nodes;
      if (Array.isArray(o.chars)) d.meta.chars = o.chars;
      d.meta.maxDanger = Number(o.maxDanger) || 0;
      if (o.settings && typeof o.settings === 'object') {
        for (const k in o.settings) d.settings[k] = o.settings[k];
        if (o.settings.lang) d.settings.language = o.settings.lang;
      }
      d.v = 1;
      return d;
    }
  };
  function migrate(o) {
    let v = typeof o.v === 'number' ? o.v : 0;
    while (v < VERSION) {
      const f = MIGRATIONS[v];
      if (!f) throw new Error('no migration from v' + v);
      o = f(o); v = o.v;
    }
    return o;
  }
  function isObj(x) { return x && typeof x === 'object' && !Array.isArray(x); }
  function mergeDefaults(def, src) {
    const out = {};
    for (const k in def) {
      const d = def[k], s = src ? src[k] : undefined;
      if (isObj(d) && Object.keys(d).length && k !== 'nodes') out[k] = mergeDefaults(d, isObj(s) ? s : undefined);
      else if (s === undefined || (d !== null && typeof d !== typeof s) || (Array.isArray(d) !== Array.isArray(s))) {
        out[k] = (d !== null && typeof d === 'object') ? JSON.parse(JSON.stringify(d)) : d;
        if (d === null && s !== undefined) out[k] = s;
      } else out[k] = s;
    }
    if (src) for (const k in src) if (!(k in def)) out[k] = src[k]; // keep unknown/record keys (codex ids)
    return out;
  }

  function load() {
    const raw = sGet(key());
    data = null;
    if (raw !== null) {
      try {
        const o = JSON.parse(raw);
        if (!isObj(o)) throw new Error('not an object');
        if (typeof o.v === 'number' && o.v > VERSION) throw new Error('newer version');
        data = mergeDefaults(defaults(), migrate(o));
        data.v = VERSION;
      } catch (e) {
        sSet(BACKUP_KEY, raw); // keep the raw copy, start fresh
        data = null;
      }
    }
    if (!data) data = defaults();
    return data;
  }
  function ensure() { return data || load(); }
  function flush() { return sSet(key(), JSON.stringify(ensure())); }
  function getMeta() { return ensure().meta; }
  function getCodex() { return ensure().codex; }
  function getSettings() { return ensure().settings; }
  function setSetting(k, v) {
    ensure().settings[k] = v;
    flush();
    NR.events.emit('settings:change', { key: k, value: v });
  }
  function writeRun(snap) { ensure().run = snap; flush(); }
  function readRun() { const r = ensure().run; return r ? r : null; }
  function clearRun() { ensure().run = null; flush(); }
  function resetAll() { data = defaults(); flush(); return data; }

  NR.save = { load, flush, getMeta, getCodex, getSettings, setSetting, writeRun, readRun, clearRun, resetAll };
})();
