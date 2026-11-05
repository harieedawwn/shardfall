// Daily run: one scored attempt per UTC day with a seed, character and danger fixed by the date. Results live in save.meta.daily.days
// (last 30 days kept). Not part of the sim: the date is read only here (NR.daily.now can be overridden by tests).
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  const KEEP_DAYS = 30, DANGERS = [0, 1, 2, 3];
  let inited = false;

  function now() { return NR.daily.nowFn ? NR.daily.nowFn() : Date.now(); }
  function keyOf(ms) {
    const d = new Date(ms), p = function (n) { return n < 10 ? '0' + n : String(n); };
    return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
  }
  function todayKey() { return keyOf(now()); }
  function dayNum(key) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key); return m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : 0; }
  function days() { const m = NR.save.getMeta(); if (!m.daily || typeof m.daily !== 'object') m.daily = { days: {} }; if (!m.daily.days || typeof m.daily.days !== 'object') m.daily.days = {}; return m.daily.days; }
  // fixed by the date: same key -> same seed, character and danger on every device
  function config(key) {
    const h = NR.util.hash('shardfall-daily:' + key) >>> 0, ids = Object.keys(NR.data.characters);
    return { key: key, seed: (h & 0x7fffffff) || 1, charId: ids[(h >>> 3) % ids.length], danger: DANGERS[(h >>> 11) % DANGERS.length] };
  }
  function entry(key) { return days()[key] || null; }
  function attempted(key) { return !!entry(key); }
  function score(st, result) { return Math.max(0, Math.round((st.wave || 0) * 100 + (st.kills || 0) + (st.bossesKilled || 0) * 150 + (result === 'win' ? 1000 : 0))); }
  function prune(today) {
    const d = days(), t = dayNum(today);
    for (const k in d) if (t - dayNum(k) >= KEEP_DAYS || dayNum(k) > t + 1) delete d[k];
  }
  // called when a daily run starts: the attempt is spent at once (abandoning counts)
  function begin(key) {
    const c = config(key);
    days()[key] = { state: 'started', charId: c.charId, danger: c.danger, seed: c.seed, score: 0, wave: 0, kills: 0, result: '', time: 0 };
    prune(key); NR.save.flush();
  }
  function finish(key, st, result) {
    const e = entry(key);
    if (!e || e.state === 'done') return null;
    e.state = 'done'; e.result = result; e.wave = st.wave || 0; e.kills = st.kills || 0; e.time = Math.round(st.time || 0); e.score = score(st, result); e.bosses = st.bossesKilled || 0;
    NR.save.flush();
    return e;
  }
  // [{key, entry}] newest first, only the last 30 days
  function recent(today) {
    const d = days(), t = dayNum(today || todayKey()), out = [];
    for (const k in d) if (t - dayNum(k) < KEEP_DAYS && dayNum(k) <= t) out.push({ key: k, entry: d[k] });
    out.sort(function (a, b) { return a.key < b.key ? 1 : -1; });
    return out;
  }
  function best(today) { let b = 0; const r = recent(today); for (let i = 0; i < r.length; i++) if (r[i].entry.state === 'done' && r[i].entry.score > b) b = r[i].entry.score; return b; }
  function shareText(key, lang) {
    const e = entry(key);
    if (!e || e.state !== 'done') return '';
    const ch = NR.data.characters[e.charId], name = ch ? ch.name[lang] || ch.name.en : e.charId, res = NR.lang[lang]['end.' + e.result] || e.result;
    const P = { date: key, name: name, danger: e.danger, wave: e.wave, score: e.score, result: res };
    return NR.lang[lang]['daily.share'].replace(/\{(\w+)\}/g, function (m, k) { return P[k] === undefined ? m : String(P[k]); });
  }
  function init() {
    if (inited) return;
    inited = true;
    NR.events.on('run:end', function (ev) {
      const W = NR.world.get();
      if (W && W.daily) { const e = finish(W.daily, ev.stats, ev.result); if (e) W.stats.dailyScore = e.score; }
    });
  }
  NR.daily = { init, todayKey, keyOf, config, entry, attempted, begin, finish, recent, best, score, shareText, days, KEEP_DAYS };
})();
