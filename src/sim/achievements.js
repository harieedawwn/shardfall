// Owner: Progression. Achievements + per-character challenges (data: src/data/achievements.js). Earned ids live in save.meta.ach
// (id -> run number), cumulative counters in save.meta.progress. Evaluated on gameplay events; emits 'achievement:unlock'.
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  const unlockP = { id: '', kind: 'achievement', content: null };
  const COUNTERS = ['reactions', 'elites', 'eventsWon', 'kills'];
  let inited = false;

  function M() { return NR.save.getMeta(); }
  function W() { return NR.world.get(); }
  function ach() { const m = M(); if (!m.ach || typeof m.ach !== 'object') m.ach = {}; return m.ach; }
  function prog() { const m = M(); if (!m.progress || typeof m.progress !== 'object') m.progress = {}; return m.progress; }
  function def(id) { return NR.data.achievements[id] || NR.data.challenges[id]; }
  function earned(id) { return !!ach()[id]; }
  function all() { return Object.keys(NR.data.achievements).concat(Object.keys(NR.data.challenges)); }
  function contentOf(id) { return NR.data.locked.filter(function (l) { return l.ach === id; }); }

  // is this weapon / item / trait available in pools? (locked content needs its achievement)
  function isUnlocked(kind, id) {
    const L = NR.data.locked;
    for (let i = 0; i < L.length; i++) if (L[i].kind === kind && L[i].id === id) return earned(L[i].ach);
    return true;
  }
  // { cur, goal } for display; cumulative counters include the live run
  function progress(id) {
    const d = def(id), w = W(), st = w && w.stats ? w.stats : {};
    if (earned(id)) return { cur: 1, goal: 1, done: true };
    switch (d.type) {
      case 'total': return { cur: Math.min(d.goal, (prog()[d.stat] | 0) + (w && w.state !== 'menu' ? st[d.stat] | 0 : 0)), goal: d.goal, done: false };
      case 'run': return { cur: Math.min(d.goal, w && w.state !== 'menu' ? st[d.stat] | 0 : 0), goal: d.goal, done: false };
      case 'traits': return { cur: Math.min(d.goal, w && w.player && w.state !== 'menu' ? NR.traits.count(w.player) : 0), goal: d.goal, done: false };
      case 'endless': return { cur: Math.min(d.wave, w && w.endless && w.state !== 'menu' ? w.wave : 0), goal: d.wave, done: false };
    }
    return { cur: 0, goal: 1, done: false };
  }
  function winOk(d, w) {
    if (d.char && (!w.player || w.player.charId !== d.char)) return false;
    if (d.minDanger !== undefined && w.danger < d.minDanger) return false;
    if (d.maxDamageTaken !== undefined && w.stats.damageTaken > d.maxDamageTaken) return false;
    if (d.minDashes !== undefined && w.stats.dashes < d.minDashes) return false;
    if (d.minEvolutions !== undefined && (w.stats.evolutions | 0) < d.minEvolutions) return false;
    return true;
  }
  function met(d, w, result) {
    const st = w.stats;
    switch (d.type) {
      case 'win': return result === 'win' && winOk(d, w);
      case 'run': return (st[d.stat] | 0) >= d.goal;
      case 'total': return (prog()[d.stat] | 0) + (st[d.stat] | 0) >= d.goal;
      case 'bossNoHit': return (st.bossNoHit | 0) >= 1;
      case 'traits': return !!w.player && NR.traits.count(w.player) >= d.goal;
      case 'endless': return !!w.endless && w.wave >= d.wave;
    }
    return false;
  }
  function unlock(id) {
    const w = W(), kind = NR.data.achievements[id] ? 'achievement' : 'challenge';
    ach()[id] = (M().runs | 0) + 1;
    w.stats.newAch.push(id);
    unlockP.id = id; unlockP.kind = kind; unlockP.content = contentOf(id);
    NR.save.flush();
    NR.events.emit('achievement:unlock', unlockP);
  }
  function evaluate(result) {
    const w = W();
    if (!w || !w.player || w.state === 'menu') return 0;
    let n = 0;
    const ids = all();
    for (let i = 0; i < ids.length; i++) { const id = ids[i]; if (!earned(id) && met(def(id), w, result)) { unlock(id); n++; } }
    return n;
  }
  function init() {
    if (inited) return;
    inited = true;
    const E = NR.events, ev = function () { evaluate(''); };
    E.on('boss:death', ev); E.on('weapon:evolve', ev); E.on('event:end', ev); E.on('state:change', ev);
    E.on('status:react', function () { if ((W().stats.reactions & 3) === 0) evaluate(''); });
    E.on('enemy:death', function (e) { if (e.elite) evaluate(''); });
    E.on('run:end', function (e) {
      evaluate(e.result);
      const w = W(), p = prog(); // fold this run into the cumulative counters after the win checks
      for (let i = 0; i < COUNTERS.length; i++) p[COUNTERS[i]] = (p[COUNTERS[i]] | 0) + (w.stats[COUNTERS[i]] | 0);
      NR.save.flush();
    });
  }
  NR.achievements = { init, evaluate, earned, isUnlocked, progress, all, def, contentOf };
})();
