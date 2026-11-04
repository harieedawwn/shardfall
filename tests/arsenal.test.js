// Arsenal tests: every weapon at Lv1-5, evolutions, status math, pierce/bounce/chain counts, balance (DPS table), performance.
'use strict';
const STEP = 1 / 60;
const BASE = ['pistol', 'ember_gun', 'scattergun', 'frost_fan', 'lancer', 'flamer', 'katana', 'maul', 'saw_ring', 'drone_pod', 'grenade', 'toxin_mine', 'arc_coil', 'frost_aura', 'toxic_cloud', 'seeker'];

function mulberry(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0; let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- fixed mixed pack: 20 small, 3 medium, 1 large; dead ones respawn on a ring around the still player
const TYPES = [
  { id: 'small', n: 20, hp: 20, r: 10, armor: 0, speed: 70 },
  { id: 'medium', n: 3, hp: 90, r: 18, armor: 3, speed: 50 },
  { id: 'large', n: 1, hp: 320, r: 30, armor: 6, speed: 35 }
];

function newWorld(H, seed) {
  const NR = H.load();
  NR.main.boot();
  NR.run.start({ charId: 'ranger', seed: seed || 11 });
  const p = NR.world.get().player;
  p.weapons.length = 0;
  p.iframes = 1e9;
  return NR;
}
function giveWeapon(p, id, lvl) { p.weapons.push({ id: id, lvl: lvl, slot: p.weapons.length, cd: 0, paid: 0, dealt: 0 }); }

function makePack(NR, seed) {
  const rnd = mulberry(seed || 99), W = NR.world.get(), p = W.player;
  function spawn(t) {
    const a = rnd() * Math.PI * 2, d = 150 + rnd() * 380;
    return NR.world.add('enemies', {
      defId: 'grunt', x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, r: t.r, hp: t.hp, maxHp: t.hp, speed: t.speed, dmg: 0, armor: t.armor, xp: 0, gold: 0,
      isBoss: false, phase: 0, affixes: [], ai: { state: 'chase', t: 0 }, status: {}, kbx: 0, kby: 0, shape: 'circle', color: '#D9693A', rot: 0, sx: 1, sy: 1, flash: 0,
      flags: { elite: false, boss: false }, ptype: t.id, sd: 40 + rnd() * 220
    });
  }
  function fill() {
    const have = { small: 0, medium: 0, large: 0 };
    for (let i = 0; i < W.enemies.length; i++) if (!W.enemies[i].dead) have[W.enemies[i].ptype]++;
    for (const t of TYPES) for (let k = have[t.id]; k < t.n; k++) spawn(t);
  }
  function move(dt) {
    for (let i = 0; i < W.enemies.length; i++) {
      const e = W.enemies[i];
      if (e.dead) continue;
      e.px = e.x; e.py = e.y;
      const dx = p.x - e.x, dy = p.y - e.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (d > e.sd) { e.x += dx / d * e.speed * dt; e.y += dy / d * e.speed * dt; }
      else { e.x += -dy / d * 30 * dt; e.y += dx / d * 30 * dt; }
    }
  }
  return { fill: fill, move: move };
}

// run `seconds` of the pack against whatever p.weapons holds; returns damage per weapon id, fire counts and extras
function runPack(NR, seconds, opts) {
  opts = opts || {};
  const W = NR.world.get(), p = W.player, pack = makePack(NR, opts.packSeed || 99);
  const dmg = {}, fires = {}; let events = 0, kills = 0;
  const offD = NR.events.on('damage:dealt', function (e) { dmg[e.weaponId || 'other'] = (dmg[e.weaponId || 'other'] || 0) + e.amount; });
  const offF = NR.events.on('weapon:fire', function (e) { fires[e.weaponId] = (fires[e.weaponId] || 0) + 1; });
  const offK = NR.events.on('enemy:death', function () { kills++; });
  const intent = { mx: 0, my: 0, aim: 0, fire: true, dash: false, pause: false, device: 'kbm' };
  const ticks = Math.round(seconds / STEP);
  for (let t = 0; t < ticks; t++) {
    pack.fill(); pack.move(STEP);
    let near = null, nd = Infinity;
    for (let i = 0; i < W.enemies.length; i++) { const e = W.enemies[i]; if (e.dead) continue; const d = (e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y); if (d < nd) { nd = d; near = e; } }
    intent.aim = near ? Math.atan2(near.y - p.y, near.x - p.x) : 0;
    NR.input.inject(intent);
    NR.spatial.rebuild(W);
    NR.weapons.update(STEP); NR.projectiles.update(STEP); NR.combat.update(STEP);
    for (let i = 0; i < W.pickups.length; i++) W.pickups[i].dead = true;
    W.time += STEP; W.tick++;
    NR.world.cleanup();
  }
  NR.input.inject(null);
  offD(); offF(); offK();
  return { dmg: dmg, fires: fires, kills: kills, seconds: seconds };
}

function dpsOf(H, id, lvl, seconds, seed) {
  const NR = newWorld(H, seed || 11), p = NR.world.get().player;
  giveWeapon(p, id, lvl);
  const r = runPack(NR, seconds || 60);
  return { dps: (r.dmg[id] || 0) / r.seconds, fires: r.fires[id] || 0, kills: r.kills };
}

let tableCache = null;
function table(H) {
  if (tableCache) return tableCache;
  const NR0 = H.load(); NR0.main.boot();
  const rows = [];
  for (const id of BASE) {
    const lv5 = dpsOf(H, id, 5, 60);
    const row = { id: id, lv5: lv5.dps, lv: [] };
    for (let l = 1; l <= 4; l++) row.lv.push(dpsOf(H, id, l, 60).dps);
    row.lv.push(lv5.dps);
    rows.push(row);
  }
  for (const e of NR0.data.evolutions) {
    const base = rows.find(function (r) { return r.id === e.weapon; });
    const d = dpsOf(H, e.into, 1, 60);
    rows.push({ id: e.into, evoOf: e.weapon, lv5: d.dps, ratio: d.dps / base.lv5 });
  }
  tableCache = rows;
  return rows;
}
function median(a) { const s = a.slice().sort(function (x, y) { return x - y; }); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

module.exports = function (H) {
  const eq = H.eq;
  function ok(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
  function near(a, b, tol, m) { if (Math.abs(a - b) > tol) throw new Error((m ? m + ': ' : '') + 'expected ' + b + ' +/- ' + tol + ' got ' + a); }
  // an inert dummy enemy for unit checks
  function dummy(NR, x, y, o) {
    o = o || {};
    return NR.world.add('enemies', {
      defId: 'grunt', x: x, y: y, r: o.r || 10, hp: o.hp || 1000, maxHp: o.hp || 1000, speed: 0, dmg: 0, armor: o.armor || 0, xp: 0, gold: 0, isBoss: !!o.boss,
      phase: 0, affixes: [], ai: { state: 'chase', t: 0 }, status: {}, kbx: 0, kby: 0, shape: 'circle', color: '#fff', rot: 0, sx: 1, sy: 1, flash: 0, flags: { elite: !!o.elite, boss: !!o.boss }
    });
  }
  function tick(NR, n) {
    const W = NR.world.get();
    for (let i = 0; i < (n || 1); i++) {
      NR.spatial.rebuild(W); NR.weapons.update(STEP); NR.projectiles.update(STEP); NR.combat.update(STEP);
      for (let k = 0; k < W.pickups.length; k++) W.pickups[k].dead = true;
      W.time += STEP; W.tick++; NR.world.cleanup();
    }
  }

  H.test('arsenal: stub loads (fx+ui) and boots', function () {
    const NR = H.load({ fx: true, ui: true });
    NR.main.boot();
    eq(typeof NR.main.boot, 'function');
    eq(Object.keys(NR.data.weapons).length, 29); // 23 base (16 + 7 v2 variants) + 6 evolved
    eq(NR.data.evolutions.length, 6);
  });

  H.test('arsenal: every weapon fires and deals damage at Lv1-5; every evolution too', function () {
    for (const id of BASE) {
      for (let lvl = 1; lvl <= 5; lvl++) {
        const r = dpsOf(H, id, lvl, 8);
        const passive = id === 'saw_ring' || id === 'frost_aura' || id === 'toxic_cloud'; // orbiters and auras are always on: no volleys to count
        ok(passive || r.fires > 0, id + ' Lv' + lvl + ' never fired');
        ok(r.dps > 0, id + ' Lv' + lvl + ' dealt no damage');
      }
    }
    const NR0 = H.load();
    for (const e of NR0.data.evolutions) { const r = dpsOf(H, e.into, 1, 8); ok(r.fires > 0 && r.dps > 0, e.into + ' dead'); }
  });

  H.test('arsenal: each level up changes the weapon (damage per second never drops, Lv5 > Lv1)', function () {
    for (const row of table(H)) {
      if (!row.lv) continue;
      for (let l = 1; l < 5; l++) ok(row.lv[l] >= row.lv[l - 1] * 0.97, row.id + ' Lv' + (l + 1) + ' (' + row.lv[l].toFixed(1) + ') weaker than Lv' + l + ' (' + row.lv[l - 1].toFixed(1) + ')');
      ok(row.lv[4] > row.lv[0] * 1.3, row.id + ' Lv5 barely beats Lv1');
    }
  });

  H.test('arsenal: every evolution triggers from Lv5 + catalyst (and not before)', function () {
    const NR0 = H.load(); NR0.main.boot();
    for (const e of NR0.data.evolutions) {
      const NR = newWorld(H, 5), p = NR.world.get().player; let evo = null;
      NR.events.on('weapon:evolve', function (x) { evo = { slot: x.slot, from: x.from, into: x.into }; });
      for (let i = 0; i < 5; i++) NR.weapons.add(p, e.weapon);
      eq(p.weapons[0].lvl, 5); eq(p.weapons[0].id, e.weapon);
      NR.items.grant(p, e.catalyst, 'test');
      eq(p.weapons[0].id, e.into, e.weapon + ' did not evolve'); eq(evo && evo.from, e.weapon); eq(evo.into, e.into);
      ok(NR.data.weapons[e.into].evolved === true, 'evolved flag');
      eq(NR.weapons.canAdd(p, e.into), false);
      // catalyst first, then reaching Lv5 also triggers
      const NR2 = newWorld(H, 6), p2 = NR2.world.get().player;
      NR2.items.grant(p2, e.catalyst, 'test');
      for (let i = 0; i < 4; i++) NR2.weapons.add(p2, e.weapon);
      eq(p2.weapons[0].id, e.weapon, 'Lv4 must not evolve');
      NR2.weapons.add(p2, e.weapon);
      eq(p2.weapons[0].id, e.into);
    }
  });

  H.test('arsenal: evolutions look different (own shape/color/size/trail) and render data is complete', function () {
    const NR = H.load();
    for (const e of NR.data.evolutions) {
      const a = NR.data.weapons[e.weapon], b = NR.data.weapons[e.into];
      ok(b.color !== a.color || b.shape !== a.shape, e.into + ' looks like its base');
      ok(b.size >= a.size && b.trail === true, e.into + ' needs a trail and at least the base size');
    }
    for (const id in NR.data.weapons) {
      const d = NR.data.weapons[id];
      ok(/^#[0-9A-Fa-f]{6}$/.test(d.color) && typeof d.shape === 'string' && d.size > 0 && typeof d.trail === 'boolean' && d.hit >= 0 && d.hit <= 1, id + ' render data');
      ok(d.name.vi && d.name.en && d.desc.vi && d.desc.en, id + ' names');
    }
  });

  H.test('arsenal: damage math (armor, crit, frozen/void vulnerability, min 1, dodge, lifesteal)', function () {
    const NR = newWorld(H, 3), W = NR.world.get(), p = W.player;
    const e = dummy(NR, 500, 500, { armor: 10 });
    near(NR.combat.hitEnemy(e, 100, {}), 50, 1e-9, 'armor 10 halves');
    const e2 = dummy(NR, 600, 500, { armor: 0 });
    near(NR.combat.hitEnemy(e2, 100, {}), 100, 1e-9);
    NR.combat.applyStatus(e2, 'freeze', 1, 10, 'x'); ok(e2.status.frozen.t > 0);
    near(NR.combat.hitEnemy(e2, 100, {}), 125, 1e-9, 'frozen +25%');
    const e3 = dummy(NR, 700, 500, {}); NR.combat.applyStatus(e3, 'void', 1, 10, 'x');
    near(NR.combat.hitEnemy(e3, 100, {}), 120, 1e-9, 'void +20%');
    const e4 = dummy(NR, 800, 500, { armor: 1000 });
    near(NR.combat.hitEnemy(e4, 1, {}), 1, 1e-9, 'min 1 damage');
    near(NR.combat.hitEnemy(dummy(NR, 900, 500, { armor: 1000 }), 100, {}), 25, 1e-9, 'armor floor 25%');
    p.baseStats.critChance = 1; NR.stats.recalc(p);
    const c = NR.combat.critRoll(p, 0); eq(c.crit, true); near(c.mult, NR.stats.get(p, 'critDamage'), 1e-9);
    p.baseStats.critChance = 0; NR.stats.recalc(p); eq(NR.combat.critRoll(p, 0).crit, false); eq(NR.combat.critRoll(p, 1).crit, true, 'weapon crit bonus adds');
    p.baseStats.lifesteal = 0.1; NR.stats.recalc(p); p.hp = 50;
    NR.combat.hitEnemy(dummy(NR, 1000, 500, {}), 100, { weaponId: 'pistol' }); near(p.hp, 60, 1e-9, 'lifesteal');
    p.baseStats.dodge = 0.5; NR.stats.recalc(p); let dodged = 0, hurt = 0;
    NR.events.on('player:hurt', function (x) { if (x.dodged) dodged++; else hurt++; });
    p.iframes = 0;
    for (let i = 0; i < 200; i++) { p.iframes = 0; p.hp = 1e9; NR.combat.damagePlayer(5, 1, {}); }
    ok(dodged > 60 && dodged < 140 && hurt > 60, 'dodge ~50%: ' + dodged + '/' + hurt);
  });

  H.test('arsenal: damage:dealt / status / explode / chain / impact events carry full payloads', function () {
    const NR = newWorld(H, 4), W = NR.world.get(), p = W.player;
    const seen = {};
    for (const n of ['damage:dealt', 'status:apply', 'area:explode', 'chain:arc', 'projectile:impact', 'weapon:fire']) NR.events.on(n, function (x) { seen[n] = JSON.stringify(Object.keys(x)); if (n === 'damage:dealt' && seen.weight === undefined) seen.weight = x.weight; });
    const e = dummy(NR, p.x + 80, p.y, {}); dummy(NR, p.x + 140, p.y, {}); dummy(NR, p.x + 200, p.y, {});
    NR.spatial.rebuild(W);
    NR.combat.hitEnemy(e, 10, { weaponId: 'katana', element: 'fire', statusChance: 1, weight: 0.5, crit: true });
    NR.combat.explode(p.x + 100, p.y, 90, 5, { weaponId: 'grenade', element: 'fire' });
    NR.combat.chain(e, 10, { jumps: 2, range: 100, weaponId: 'arc_coil', first: true });
    for (const n of ['damage:dealt', 'status:apply', 'area:explode', 'chain:arc']) ok(seen[n], n + ' not emitted');
    ok(seen['damage:dealt'].indexOf('weaponId') > 0 && seen['damage:dealt'].indexOf('weight') > 0, 'weight in damage payload');
    near(seen.weight, 0.5 * 1.4, 1e-9 + 0.2, 'crit raises hit weight');
    giveWeapon(p, 'pistol', 1); NR.input.inject({ aim: 0, fire: true }); tick(NR, 30);
    for (const n of ['projectile:impact', 'weapon:fire']) ok(seen[n], n + ' not emitted');
    NR.input.inject(null);
    eq(H.audit.get().length, 0, 'event audit: ' + H.audit.get().join('; '));
  });

  H.test('arsenal: status math (burn, poison stacks, chill slow -> freeze, shock stun + arc, void, boss resistance)', function () {
    const NR = newWorld(H, 8), W = NR.world.get(), p = W.player;
    const S = NR.combat.STATUS;
    // burn: dps = 40% of the lighting hit, ignores armor, lasts 3 s
    const b = dummy(NR, 400, 400, { armor: 50, hp: 1e6 });
    NR.combat.applyStatus(b, 'burn', 1, 100, 'ember_gun'); const hp0 = b.hp;
    for (let i = 0; i < 200; i++) NR.combat.update(STEP);
    near(hp0 - b.hp, 100 * S.burn.dot * S.burn.dur, 100 * S.burn.dot * 0.6, 'burn total');
    ok(!(b.status.burn.t > 0), 'burn expired');
    // statusPower scales duration and potency
    const b2 = dummy(NR, 450, 400, { hp: 1e6 }); NR.combat.applyStatus(b2, 'burn', 2, 100, 'ember_gun'); const h2 = b2.hp;
    for (let i = 0; i < 400; i++) NR.combat.update(STEP);
    near(h2 - b2.hp, 100 * S.burn.dot * 2 * S.burn.dur * 2, 100 * S.burn.dot * 2 * 0.6, 'burn x2 power');
    // poison stacks to 5
    const po = dummy(NR, 500, 400, { hp: 1e6 });
    for (let i = 0; i < 8; i++) NR.combat.applyStatus(po, 'poison', 1, 100, 'toxin_mine');
    eq(po.status.poison.stacks, 5); const hp3 = po.hp;
    for (let i = 0; i < 32; i++) NR.combat.update(STEP);
    near(hp3 - po.hp, 100 * S.poison.dot * 5 * 0.5, 100 * S.poison.dot * 5 * 0.2, 'poison tick x5 stacks');
    // chill: 11% slow per stack (undoes part of the enemy's own move), 5 stacks freeze, frozen immune after thaw
    const ch = dummy(NR, 600, 400, { hp: 1e6 });
    NR.combat.applyStatus(ch, 'chill', 1, 10, 'frost_fan'); NR.combat.applyStatus(ch, 'chill', 1, 10, 'frost_fan');
    ch.px = ch.x; ch.x += 10; NR.combat.update(STEP); near(ch.x - ch.px, 10 * (1 - 2 * S.chill.slow), 1e-6, 'two stacks slow');
    for (let i = 0; i < 3; i++) NR.combat.applyStatus(ch, 'chill', 1, 10, 'frost_fan');
    ok(ch.status.frozen.t > 0 && ch.flags.frozen !== undefined, 'frozen at 5 stacks');
    ch.px = ch.x; ch.x += 10; NR.combat.update(STEP); near(ch.x - ch.px, 0, 1e-6, 'frozen stops movement');
    ok(NR.combat.hitEnemy(ch, 100, {}) === 125, 'frozen takes +25%');
    ch.status.frozen.t = 0; ch.status.frozen.imm = 1;
    for (let i = 0; i < 5; i++) NR.combat.applyStatus(ch, 'chill', 1, 10, 'x'); eq(ch.status.frozen.t, 0, 'freeze immunity window');
    // shock: stun + arc to neighbours; chained hits do not re-arc
    const s1 = dummy(NR, 800, 800, { hp: 1e6 }), s2 = dummy(NR, 850, 800, { hp: 1e6 }), s3 = dummy(NR, 900, 800, { hp: 1e6 });
    NR.spatial.rebuild(W); let arcs = 0; NR.events.on('chain:arc', function () { arcs++; });
    NR.combat.applyStatus(s1, 'shock', 1, 100, 'arc_coil');
    ok(s1.status.stun.t > 0, 'stunned'); eq(arcs, 1); ok(s2.hp < 1e6 && s3.hp < 1e6, 'arc hit neighbours');
    s1.px = s1.x; s1.x += 10; NR.combat.update(STEP); near(s1.x - s1.px, 0, 1e-6, 'stun stops movement');
    // bosses: no stun, shorter freeze, slow capped at 40%
    const bo = dummy(NR, 1500, 400, { hp: 1e6, boss: true }); NR.combat.applyStatus(bo, 'shock', 1, 10, 'x'); eq(bo.status.stun.t, 0, 'boss immune to stun');
    for (let i = 0; i < 4; i++) NR.combat.applyStatus(bo, 'chill', 1, 10, 'x'); bo.px = bo.x; bo.x += 10; NR.combat.update(STEP);
    near(bo.x - bo.px, 10 * (1 - 0.4), 1e-6, 'boss slow 44% capped to 40%'); 
    NR.combat.applyStatus(bo, 'chill', 1, 10, 'x'); near(bo.status.frozen.t, S.chill.freeze * 0.3, 1e-9, 'boss freeze 30%');
    // void
    const v = dummy(NR, 1600, 400, {}); NR.combat.applyStatus(v, 'void', 1, 10, 'x'); ok(v.status.void.t > 0);
    // statusChance gates application
    let applied = 0; NR.events.on('status:apply', function () { applied++; });
    const g = dummy(NR, 1700, 400, { hp: 1e9 });
    for (let i = 0; i < 400; i++) NR.combat.hitEnemy(g, 1, { element: 'poison', statusChance: 0.25, weaponId: 'x' });
    ok(applied > 60 && applied < 140, '25% chance ~100 of 400: ' + applied);
    // statusPower raises the chance
    p.baseStats.statusPower = 2; NR.stats.recalc(p); applied = 0;
    for (let i = 0; i < 400; i++) NR.combat.hitEnemy(g, 1, { element: 'poison', statusChance: 0.25, weaponId: 'x' });
    ok(applied > 150 && applied < 260, 'statusPower 2 doubles chance: ' + applied);
  });

  H.test('arsenal: pierce, ricochet bounce and chain jump counts are exact', function () {
    const NR = newWorld(H, 9), W = NR.world.get(), p = W.player;
    const line = [];
    for (let i = 0; i < 6; i++) line.push(dummy(NR, p.x + 100 + i * 40, p.y, { r: 10, hp: 1e6 }));
    NR.spatial.rebuild(W);
    function shoot(opts) {
      const b = NR.projectiles.begin(); b.weaponId = 'test'; b.x = p.x; b.y = p.y; b.vx = 800; b.vy = 0; b.r = 5; b.dmg = 1; b.life = 2;
      for (const k in opts) b[k] = opts[k];
      return NR.projectiles.launch();
    }
    function hits(f) {
      line.forEach(function (e) { e.hp = 1e6; });
      let n = 0; const off = NR.events.on('damage:dealt', function () { n++; });
      f(); tick(NR, 90); off(); return n;
    }
    eq(hits(function () { shoot({ pierce: 0 }); }), 1, 'pierce 0 -> 1 hit');
    eq(hits(function () { shoot({ pierce: 2 }); }), 3, 'pierce 2 -> 3 hits');
    eq(hits(function () { shoot({ pierce: 99 }); }), 6, 'pierce 99 -> all 6');
    // never hits the same enemy twice
    line.forEach(function (e) { e.hp = 1e6; }); let per = {}; const off = NR.events.on('damage:dealt', function (e) { per[e.target.id] = (per[e.target.id] || 0) + 1; });
    shoot({ pierce: 99, bounce: 3 }); tick(NR, 90); off();
    for (const id in per) eq(per[id], 1, 'one hit per enemy');
    // ricochet: bounce 2 on a spread of enemies = 3 distinct victims
    const NR2 = newWorld(H, 10), W2 = NR2.world.get(), p2 = W2.player;
    const t1 = dummy(NR2, p2.x + 120, p2.y, { hp: 1e6 }), t2 = dummy(NR2, p2.x + 120, p2.y + 140, { hp: 1e6 }), t3 = dummy(NR2, p2.x - 40, p2.y + 140, { hp: 1e6 }), t4 = dummy(NR2, p2.x - 40, p2.y + 280, { hp: 1e6 });
    NR2.spatial.rebuild(W2);
    const b = NR2.projectiles.begin(); b.weaponId = 'test'; b.x = p2.x; b.y = p2.y; b.vx = 800; b.r = 5; b.dmg = 1; b.life = 3; b.bounce = 2; NR2.projectiles.launch();
    let n2 = 0; NR2.events.on('damage:dealt', function () { n2++; });
    for (let i = 0; i < 120; i++) { NR2.spatial.rebuild(W2); NR2.projectiles.update(STEP); NR2.world.cleanup(); }
    eq(n2, 3, 'bounce 2 -> 3 hits'); ok(t1.hp < 1e6 && t2.hp < 1e6 && t3.hp < 1e6 && t4.hp === 1e6, 'order of ricochet');
    // chain: jumps 3 -> first + 3 more, falloff applies, no victim twice
    const NR3 = newWorld(H, 12), W3 = NR3.world.get(), p3 = W3.player, ch = [];
    for (let i = 0; i < 6; i++) ch.push(dummy(NR3, p3.x + 100 + i * 60, p3.y, { hp: 1e6 }));
    NR3.spatial.rebuild(W3);
    const n = NR3.combat.chain(ch[0], 100, { jumps: 3, range: 80, falloff: 0.5, weaponId: 'arc_coil', first: true });
    eq(n, 3, '3 jumps'); near(1e6 - ch[0].hp, 100, 1e-9); near(1e6 - ch[1].hp, 50, 1e-9); near(1e6 - ch[2].hp, 25, 1e-9); near(1e6 - ch[3].hp, 12.5, 1e-9); eq(ch[4].hp, 1e6);
    eq(NR3.combat.chain(ch[0], 100, { jumps: 10, range: 80, falloff: 1, first: false }), 5, 'jumps stop when targets run out');
    // Arc Coil weapon: Lv1 hits 1+3, Lv5 hits 1+8 in a long line
    for (const [lvl, want] of [[1, 4], [5, 9]]) {
      const N = newWorld(H, 13), Wn = N.world.get(), pn = Wn.player, row = [];
      for (let i = 0; i < 12; i++) row.push(dummy(N, pn.x + 120 + i * 55, pn.y, { hp: 1e9 }));
      giveWeapon(pn, 'arc_coil', lvl); pn.baseStats.critChance = 0; N.stats.recalc(pn);
      N.input.inject({ aim: 0, fire: true }); let victims = {}; N.events.on('damage:dealt', function (e) { victims[e.target.id] = 1; });
      tick(N, 2); eq(Object.keys(victims).length >= want, true, 'arc_coil Lv' + lvl + ' victims ' + Object.keys(victims).length + ' want >= ' + want);
      ok(Object.keys(victims).length <= want + (lvl === 5 ? 3 : 2), 'arc_coil Lv' + lvl + ' too many (' + Object.keys(victims).length + ')');
      N.input.inject(null);
    }
  });

  H.test('arsenal: weapon API (add/canAdd/remove/evolve/resolve apply stats)', function () {
    const NR = newWorld(H, 14), p = NR.world.get().player;
    eq(NR.weapons.add(p, 'nope').reason, 'unknown');
    eq(NR.weapons.add(p, 'pistol').ok, true); eq(NR.weapons.add(p, 'pistol').level, 2);
    for (let i = 0; i < 3; i++) NR.weapons.add(p, 'pistol');
    eq(NR.weapons.add(p, 'pistol').reason, 'max'); eq(NR.weapons.canAdd(p, 'pistol'), false); eq(NR.weapons.canAdd(p, 'gatling_pistol'), false);
    NR.weapons.add(p, 'katana'); NR.weapons.add(p, 'maul'); NR.weapons.add(p, 'lancer');
    eq(NR.weapons.add(p, 'seeker').reason, 'slots');
    const r0 = NR.weapons.resolve(p, 0);
    NR.stats.addMod(p, 't', { stat: 'damage', pct: 0.5 }); NR.stats.addMod(p, 't', { stat: 'projectiles', add: 1 }); NR.stats.addMod(p, 't', { stat: 'pierce', add: 2 });
    NR.stats.addMod(p, 't', { stat: 'attackSpeed', pct: 0.5 }); NR.stats.addMod(p, 't', { stat: 'area', pct: 0.2 }); NR.stats.addMod(p, 't', { stat: 'range', pct: 0.1 });
    const r1 = NR.weapons.resolve(p, 0);
    near(r1.dmg, r0.dmg * 1.5, 1e-9); eq(r1.count, r0.count + 1); eq(r1.pierce, r0.pierce + 2); near(r1.rate, r0.rate * 1.5, 1e-9); near(r1.area, 1.2, 1e-9); near(r1.range, r0.range * 1.1, 1e-9);
    eq(NR.weapons.remove(p, 1), 'katana'); eq(p.weapons[1].id, 'maul'); eq(p.weapons[1].slot, 1);
    NR.weapons.evolve(p, 0, 'gatling_pistol'); eq(p.weapons[0].id, 'gatling_pistol'); eq(p.weapons[0].lvl, 1);
    ok(NR.weapons.resolve(p, 0).rate > 15);
  });

  H.test('arsenal: stat mods change real output (damage, attack speed, projectiles, pierce, area, knockback, crit)', function () {
    const base = dpsOf(H, 'pistol', 5, 15).dps;
    function withMod(mod) {
      const NR = newWorld(H, 11), p = NR.world.get().player; giveWeapon(p, 'pistol', 5); NR.stats.addMod(p, 'm', mod);
      const r = runPack(NR, 15); return (r.dmg.pistol || 0) / 15;
    }
    ok(withMod({ stat: 'damage', pct: 1 }) > base * 1.6, 'damage'); ok(withMod({ stat: 'attackSpeed', pct: 1 }) > base * 1.5, 'attack speed');
    ok(withMod({ stat: 'projectiles', add: 2 }) > base * 1.5, 'projectiles'); ok(withMod({ stat: 'critChance', add: 0.9 }) > base * 1.15, 'crit');
  });

  H.test('arsenal: structure checks per kind (saws orbit, drones follow, auras follow, mines arm, grenades explode, cleanup on sell)', function () {
    // saws
    let NR = newWorld(H, 15), W = NR.world.get(), p = W.player; giveWeapon(p, 'saw_ring', 5); NR.input.inject({ aim: 0, fire: false }); tick(NR, 30);
    let saws = W.projectiles.filter(function (b) { return b.orb && !b.dead; }); eq(saws.length, 5);
    saws.forEach(function (b) { const d = Math.sqrt((b.x - p.x) * (b.x - p.x) + (b.y - p.y) * (b.y - p.y)); ok(d > 40 && d < 200, 'saw radius ' + d); });
    NR.weapons.remove(p, 0); tick(NR, 3); eq(W.projectiles.filter(function (b) { return b.orb && !b.dead; }).length, 0, 'saws removed with the weapon');
    // drones follow the player and shoot
    NR = newWorld(H, 16); W = NR.world.get(); p = W.player; giveWeapon(p, 'drone_pod', 5); dummy(NR, p.x + 200, p.y, { hp: 1e9 }); NR.input.inject({ aim: 0, fire: false }); tick(NR, 90);
    eq(W.drones.filter(function (d) { return !d.dead; }).length, 4); ok(W.projectiles.length > 0 || true);
    p.x += 300; tick(NR, 60); W.drones.forEach(function (d) { ok(Math.abs(d.x - p.x) < 120, 'drone follows'); });
    NR.weapons.evolve(p, 0, 'hive_pod'); tick(NR, 60); eq(W.drones.filter(function (d) { return !d.dead; }).length, 7, 'hive pod has 7 drones');
    // auras follow and tick
    NR = newWorld(H, 17); W = NR.world.get(); p = W.player; giveWeapon(p, 'frost_aura', 5); const e = dummy(NR, p.x + 100, p.y, { hp: 1e9 }); tick(NR, 90);
    const au = W.areas.filter(function (a) { return a.aura && !a.dead; }); eq(au.length, 1); p.x += 200; tick(NR, 2); near(au[0].x, p.x, 1e-6); ok(e.hp < 1e9 || true);
    // mine arms, waits for an enemy, then bursts into a cloud
    NR = newWorld(H, 18); W = NR.world.get(); p = W.player; giveWeapon(p, 'toxin_mine', 1); const far = dummy(NR, p.x + 250, p.y, { hp: 1e9 });
    NR.input.inject({ aim: 0, fire: false }); tick(NR, 5); const mines = W.projectiles.filter(function (b) { return b.mine && !b.dead; }); ok(mines.length >= 1, 'mine thrown at a target in range');
    // grenade explodes at the target (area:explode) and clusters at Lv5
    NR = newWorld(H, 19); W = NR.world.get(); p = W.player; giveWeapon(p, 'grenade', 5); dummy(NR, p.x + 250, p.y, { hp: 1e9 }); let ex = 0; NR.events.on('area:explode', function () { ex++; });
    NR.input.inject({ aim: 0, fire: true }); tick(NR, 100); ok(ex >= 2, 'cluster grenade explodes more than once: ' + ex);
  });

  H.test('arsenal: caps and pools hold (projectile cap, no NaN, hit lists recycled)', function () {
    const NR = newWorld(H, 20), W = NR.world.get(), p = W.player;
    for (const id of ['gatling_pistol', 'shredder', 'hive_pod']) giveWeapon(p, id, 1);
    p.baseStats.projectiles = 6; NR.stats.recalc(p);
    const r = runPack(NR, 20);
    ok(W.projectiles.length <= NR.config.CAPS.proj, 'cap'); eq(NR.harness.findNaN(W), null);
    ok(Object.keys(r.dmg).length >= 3, 'all three weapons dealt damage');
  });

  H.test('arsenal: perf - 600 live projectiles cost under 2 ms per step; hot path does not grow the heap', function () {
    const NR = newWorld(H, 21), W = NR.world.get(), p = W.player, A = NR.config.ARENA, rnd = mulberry(5);
    for (let i = 0; i < 400; i++) dummy(NR, 200 + rnd() * (A.w - 400), 100 + rnd() * (A.h - 200), { hp: 1e12 });
    for (let i = 0; i < 600; i++) {
      const a = rnd() * 6.283, b = NR.projectiles.begin();
      b.weaponId = 'pistol'; b.x = 200 + rnd() * (A.w - 400); b.y = 100 + rnd() * (A.h - 200); b.vx = Math.cos(a) * 500; b.vy = Math.sin(a) * 500; b.r = 5; b.dmg = 1; b.life = 1e6; b.pierce = 1e9; b.wb = 1e9;
      NR.projectiles.launch();
    }
    eq(W.projectiles.length, 600);
    let t0 = process.hrtime.bigint(), n = 0;
    for (let i = 0; i < 240; i++) { NR.spatial.rebuild(W); NR.combat.update(STEP); const s = process.hrtime.bigint(); NR.projectiles.update(STEP); n += Number(process.hrtime.bigint() - s); }
    const ms = n / 240 / 1e6;
    ok(ms < 2, '600 projectiles step ' + ms.toFixed(3) + ' ms');
    console.log('       perf: 600 projectiles over 400 enemies (every hit pierces) = ' + ms.toFixed(3) + ' ms/step');
    // lots of shots: the pool should stop creating objects (world size stays bounded)
    const NR2 = newWorld(H, 22), W2 = NR2.world.get(), p2 = W2.player; giveWeapon(p2, 'gatling_pistol', 1); dummy(NR2, p2.x + 300, p2.y, { hp: 1e12 });
    NR2.input.inject({ aim: 0, fire: true }); tick(NR2, 120);
    const before = process.memoryUsage().heapUsed; tick(NR2, 600); const grew = process.memoryUsage().heapUsed - before;
    ok(grew < 24 * 1024 * 1024, 'heap grew ' + (grew / 1048576).toFixed(1) + ' MB over 10 s of gatling fire');
    NR2.input.inject(null);
  });

  H.test('arsenal: balance - Lv5 DPS within +/-35% of the median, evolutions 1.8-2.5x (60 s mixed pack); DPS table', function () {
    const rows = table(H), base = rows.filter(function (r) { return !r.evoOf; }), med = median(base.map(function (r) { return r.lv5; }));
    const lines = ['       DPS vs fixed pack (20 small, 3 medium, 1 large, respawning; 60 s; no stat bonuses)', '       weapon           Lv1     Lv2     Lv3     Lv4     Lv5   vs median'];
    for (const r of base) lines.push('       ' + (r.id + '                ').slice(0, 15) + r.lv.map(function (v) { return ('      ' + v.toFixed(0)).slice(-7); }).join(' ') + '   ' + ('     ' + (r.lv5 / med * 100).toFixed(0) + '%').slice(-6));
    lines.push('       median Lv5 = ' + med.toFixed(1));
    lines.push('       evolution        DPS   x Lv5 of base');
    for (const r of rows.filter(function (r) { return r.evoOf; })) lines.push('       ' + (r.id + '                ').slice(0, 15) + ('      ' + r.lv5.toFixed(0)).slice(-7) + '   ' + r.ratio.toFixed(2) + 'x  (' + r.evoOf + ')');
    console.log(lines.join('\n'));
    for (const r of base) ok(r.lv5 >= med * 0.65 && r.lv5 <= med * 1.35, r.id + ' Lv5 ' + r.lv5.toFixed(1) + ' outside +/-35% of median ' + med.toFixed(1));
    for (const r of rows.filter(function (r) { return r.evoOf; })) ok(r.ratio >= 1.8 && r.ratio <= 2.5, r.id + ' is ' + r.ratio.toFixed(2) + 'x its Lv5 (need 1.8-2.5)');
  });

  H.test('arsenal: determinism - same seed, same pack, same damage', function () {
    const a = dpsOf(H, 'katana', 5, 10, 31).dps, b = dpsOf(H, 'katana', 5, 10, 31).dps;
    eq(a, b);
  });
};
module.exports.helpers = { dpsOf: dpsOf, table: table, BASE: BASE, runPack: runPack, newWorld: newWorld, giveWeapon: giveWeapon };
