(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  const LISTS = { enemies: 'enemy', projectiles: 'proj', areas: 'area', pickups: 'pickup', drones: 'drone' };
  const COMMON = { id: 1, kind: 1, x: 1, y: 1, px: 1, py: 1, vx: 1, vy: 1, r: 1, dead: 1, age: 1, _free: 1 };
  let W = null, pools = null, nextId = 1;

  function makePools() {
    const C = NR.config.CAPS;
    const caps = { enemies: C.enemies, projectiles: C.proj, areas: 200, pickups: 500, drones: 32 };
    const out = {};
    for (const name in LISTS) {
      out[name] = NR.pool.make(function () {
        return { id: 0, kind: '', x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, r: 8, dead: false, age: 0 };
      }, function (o) {
        for (const k in o) if (!COMMON[k]) delete o[k];
        o.dead = false; o.age = 0; o.vx = 0; o.vy = 0; o.r = 8;
      }, caps[name]);
    }
    return out;
  }
  function blank(opts) {
    opts = opts || {};
    const danger = opts.danger || 0;
    return {
      seed: opts.seed === undefined ? 1 : opts.seed, tick: 0, time: 0, state: 'menu', prevState: null,
      wave: 0, zone: 'scrap', danger: danger, endless: !!opts.endless,
      waveT: 0, waveDur: 0, player: null,
      enemies: [], projectiles: [], areas: [], pickups: [], drones: [], boss: null, event: null,
      shop: { offers: [], rerolls: 0 }, levelup: { cards: [], level: 0, rerolls: 0 },
      scale: NR.stats.enemyScale(1, danger),
      stats: { kills: 0, goldEarned: 0, damageTaken: 0, dashes: 0, bossesKilled: 0, shardsEarned: 0, reactions: 0, elites: 0, eventsWon: 0, damageByWeapon: {} }
    };
  }
  // new world; the previous W object is abandoned (always re-read NR.world.get())
  function create(opts) {
    pools = makePools(); nextId = 1;
    W = blank(opts);
    return W;
  }
  function get() { if (!W) create({}); return W; }
  function reset() { // clear every entity list and pool of the current world
    get();
    pools = makePools(); nextId = 1;
    for (const name in LISTS) W[name].length = 0;
    W.boss = null;
  }
  function listName(list) {
    if (typeof list === 'string') return list;
    for (const n in LISTS) if (W[n] === list) return n;
    return null;
  }
  function add(list, props) {
    get();
    const name = listName(list);
    if (!name || !pools[name]) return null;
    const o = pools[name].get();
    if (!o) return null;
    o.id = nextId++; o.kind = LISTS[name];
    o.x = 0; o.y = 0;
    if (props) for (const k in props) o[k] = props[k];
    o.px = o.x; o.py = o.y;
    W[name].push(o);
    return o;
  }
  function remove(e) { if (e) e.dead = true; }
  function cleanup() { // step 12: the only place entities leave the lists
    for (const name in LISTS) {
      const a = W[name], pool = pools[name];
      let j = 0;
      for (let i = 0; i < a.length; i++) {
        const e = a[i];
        if (e.dead) pool.free(e); else a[j++] = e;
      }
      a.length = j;
    }
    if (W.boss && W.boss.dead) W.boss = null;
  }
  NR.world = { create, get, add, remove, cleanup, reset };
})();
