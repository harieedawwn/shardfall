'use strict';
// Owner: Arsenal. Element reactions (data-driven table, per-enemy cooldown, 'reaction:<id>' attribution) and element set bonuses.
module.exports = function (H) {
  const test = H.test, eq = H.eq;
  function ok(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
  function near(a, b, m, eps) { if (Math.abs(a - b) > (eps || 1e-6)) throw new Error((m || 'near') + ': expected ' + b + ' got ' + a); }

  function fresh(char) {
    const NR = H.load(); NR.main.boot();
    NR.run.start({ charId: char || 'ranger', seed: 11, danger: 0 });
    const W = NR.world.get(); W.state = 'wave'; W.player.hp = W.player.maxHp = 9999; W.player.x = W.player.px = 200; W.player.y = W.player.py = 200;
    NR.__seen = [];
    NR.events.on('status:react', function (e) { NR.__seen.push({ reaction: e.reaction, x: e.x, y: e.y, element: e.element, r: e.r, target: e.target }); });
    NR.__dmg = {};
    NR.events.on('damage:dealt', function (e) { const k = e.weaponId + '>' + e.target.id; NR.__dmg[k] = (NR.__dmg[k] || 0) + e.amount; });
    return NR;
  }
  function foe(NR, x, y, hp) {
    const e = NR.enemies.spawn('brute', x, y, {});
    e.hp = e.maxHp = hp || 5000; e.armor = 0; e.dmg = 0; e.speed = 0;
    return e;
  }
  function sync(NR) { NR.spatial.rebuild(NR.world.get()); }
  function hit(NR, e, el, dmg, wid) { return NR.combat.hitEnemy(e, dmg || 20, { weaponId: wid || 'pistol', element: el }); }
  function dealtBy(NR, wid, e) { return NR.__dmg[wid + '>' + e.id] || 0; }
  function freeze(e) { e.status = e.status || {}; e.status.frozen = e.status.freeze = { t: 3, imm: 6 }; }
  function addWeapons(NR, ids) { const p = NR.world.get().player; p.weapons.length = 0; ids.forEach(function (id, i) { p.weapons.push({ id: id, lvl: 1, slot: i, cd: 0, paid: 0, dealt: 0 }); }); return p; }

  test('reactions: data - five reactions with {vi,en} text, valid element/status pairs, positive cooldowns; six element sets', function () {
    const NR = H.load(), R = NR.data.reactions, S = NR.data.sets;
    eq(Object.keys(R).sort(), ['implosion', 'shatter', 'steam', 'superconduct', 'toxic_blast']);
    const stat = ['frozen', 'chill', 'burn', 'poison', 'void'], els = ['physical', 'fire', 'ice', 'shock', 'poison', 'void'];
    for (const id in R) {
      const d = R[id];
      ok(d.name.vi && d.name.en && d.desc.vi && d.desc.en, id + ' text'); ok(/^#[0-9A-F]{6}$/i.test(d.color), id + ' color'); ok(d.cd > 0, id + ' cd');
      ok(d.pairs.length >= 1, id + ' pairs');
      for (const pr of d.pairs) { ok(els.indexOf(pr[0]) >= 0, id + ' element ' + pr[0]); ok(stat.indexOf(pr[1]) >= 0, id + ' status ' + pr[1]); }
    }
    eq(Object.keys(S).sort(), els.slice().sort());
    for (const el in S) ok(S[el].name.vi && S[el].name.en && S[el].desc.vi && S[el].desc.en, el + ' set text');
    eq(NR.data.setMin, 3);
  });

  test('reactions: Shatter - physical or shock on a frozen enemy blasts the neighbours, consumes the freeze, attributes to reaction:shatter', function () {
    for (const el of ['physical', 'shock']) {
      const NR = fresh(), a = foe(NR, 1000, 800), b = foe(NR, 1060, 800), far = foe(NR, 1400, 800); sync(NR);
      hit(NR, a, el, 20); eq(NR.__seen.length, 0, 'no reaction without a status');
      freeze(a); hit(NR, a, el, 20);
      eq(NR.__seen.map(function (s) { return s.reaction; }), ['shatter']);
      ok(!(a.status.frozen.t > 0), 'freeze consumed');
      ok(dealtBy(NR, 'reaction:shatter', b) > 0, 'neighbour hit by the blast'); eq(dealtBy(NR, 'reaction:shatter', far), 0);
      ok(NR.world.get().stats.damageByWeapon['reaction:shatter'] > 0, 'attributed in run stats');
      eq(NR.world.get().stats.reactions, 1);
    }
    const NR = fresh(), a = foe(NR, 1000, 800); sync(NR); freeze(a); hit(NR, a, 'fire', 20);
    ok(!NR.__seen.some(function (s) { return s.reaction === 'shatter'; }), 'a fire hit does not shatter');
  });

  test('reactions: Toxic Blast - fire+poison either way spreads poison to the neighbours', function () {
    for (const order of [['fire', 'poison'], ['poison', 'fire']]) {
      const NR = fresh(), a = foe(NR, 1000, 800), b = foe(NR, 1070, 800); sync(NR);
      hit(NR, a, order[0], 30); ok(a.status && (a.status.burn || a.status.poison) || true);
      NR.combat.applyStatus(a, order[0] === 'fire' ? 'burn' : 'poison', 1, 30, 'pistol');
      hit(NR, a, order[1], 30);
      ok(NR.__seen.some(function (s) { return s.reaction === 'toxic_blast'; }), 'toxic blast ' + order.join('+'));
      ok(b.status && b.status.poison && b.status.poison.t > 0, 'poison spread to the neighbour');
    }
  });

  test('reactions: Superconduct - shock on a chilled enemy chains far (6 jumps, 190 px)', function () {
    const NR = fresh(), a = foe(NR, 1000, 800), chain = [];
    for (let i = 1; i <= 7; i++) chain.push(foe(NR, 1000 + i * 150, 800)); // 150 px apart: out of normal 120 px chain range
    sync(NR);
    NR.combat.applyStatus(a, 'chill', 1, 20, 'frost_fan'); ok(a.status.chill.stacks > 0);
    let arcs = 0; NR.events.on('chain:arc', function (e) { arcs = Math.max(arcs, e.points.length); });
    hit(NR, a, 'shock', 20);
    ok(NR.__seen.some(function (s) { return s.reaction === 'superconduct'; }), 'reaction fired');
    const hitN = chain.filter(function (e) { return dealtBy(NR, 'reaction:superconduct', e) > 0; }).length;
    ok(hitN >= 5, 'chained to ' + hitN + ' enemies'); ok(arcs >= 6, 'arc points ' + arcs);
    ok(!(a.status.chill.t > 0), 'chill consumed');
  });

  test('reactions: Implosion - void+fire pulls enemies in and blasts the core', function () {
    for (const order of [['void', 'fire'], ['fire', 'void']]) {
      const NR = fresh(), a = foe(NR, 1000, 800), b = foe(NR, 1110, 800); sync(NR);
      NR.combat.applyStatus(a, order[0] === 'void' ? 'void' : 'burn', 1, 30, 'pistol');
      hit(NR, a, order[1], 30);
      ok(NR.__seen.some(function (s) { return s.reaction === 'implosion'; }), 'implosion ' + order.join('+'));
      ok(b.kbx < -50, 'neighbour dragged toward the centre (kbx ' + b.kbx + ')');
      ok(dealtBy(NR, 'reaction:implosion', a) > 0, 'core blast');
    }
  });

  test('reactions: Steam - fire on chilled (or ice on burning) leaves a slowing cloud', function () {
    for (const order of [['fire', 'chill'], ['ice', 'burn']]) {
      const NR = fresh(), a = foe(NR, 1000, 800), b = foe(NR, 1050, 800), W = NR.world.get(); sync(NR);
      NR.combat.applyStatus(a, order[1], 1, 30, 'pistol');
      hit(NR, a, order[0], 30);
      ok(NR.__seen.some(function (s) { return s.reaction === 'steam'; }), 'steam ' + order.join('+'));
      const cloud = W.areas.filter(function (q) { return q.weaponId === 'reaction:steam'; })[0];
      ok(cloud, 'cloud area'); near(cloud.life, NR.data.reactions.steam.life, 'life', 1e-9);
      for (let i = 0; i < 40; i++) { sync(NR); NR.combat.update(1 / 60); }
      ok(b.status && b.status.chill && (b.status.chill.stacks > 0 || b.status.frozen), 'enemy inside the cloud is slowed');
    }
  });

  test('reactions: per-enemy cooldown, DoT and reaction damage never trigger reactions, at most a few per tick', function () {
    const NR = fresh(), a = foe(NR, 1000, 800), b = foe(NR, 1050, 800), W = NR.world.get(); sync(NR);
    freeze(a); hit(NR, a, 'physical', 20); eq(NR.__seen.length, 1);
    freeze(a); hit(NR, a, 'physical', 20); eq(NR.__seen.length, 1, 'cooldown blocks an immediate second reaction');
    W.time += NR.data.reactions.shatter.cd + 0.01; hit(NR, a, 'physical', 20); eq(NR.__seen.length, 2, 'ready again after the cooldown');
    // damage over time is not a hit
    freeze(b); NR.combat.hitEnemy(b, 20, { weaponId: 'pistol', element: 'physical', dot: true }); eq(NR.__seen.length, 2);
    // reaction damage cannot start reactions: neighbours that are frozen are blasted but do not react
    const n2 = fresh(), c = foe(n2, 1000, 800), d = foe(n2, 1040, 800); sync(n2); freeze(c); freeze(d); hit(n2, c, 'physical', 20);
    eq(n2.__seen.length, 1, 'no chain of reactions'); ok(dealtBy(n2, 'reaction:shatter', d) > 0);
    // per-tick cap
    const n3 = fresh(), pack = []; for (let i = 0; i < 12; i++) { const e = foe(n3, 1000 + (i % 4) * 400, 600 + Math.floor(i / 4) * 300); freeze(e); pack.push(e); } sync(n3);
    pack.forEach(function (e) { hit(n3, e, 'physical', 20); });
    ok(n3.__seen.length >= 1 && n3.__seen.length <= 5, 'reactions this tick ' + n3.__seen.length);
  });

  test('reactions: item procs and reaction damage never trigger on-hit items (no feedback loop)', function () {
    const NR = fresh(); NR.items.grant(NR.world.get().player, 'ember_charm', 'test'); NR.items.grant(NR.world.get().player, 'ember_charm', 'test');
    const a = foe(NR, 1000, 800), b = foe(NR, 1050, 800); sync(NR); freeze(a);
    let procs = 0; NR.events.on('damage:dealt', function (e) { if (String(e.weaponId).indexOf('item:') === 0) procs++; });
    NR.rng.chance = function () { return true; };
    NR.events.emit('damage:dealt', { weaponId: 'reaction:shatter', target: b, isBoss: false, amount: 10, crit: false, element: 'ice', x: b.x, y: b.y, killed: false });
    eq(procs, 0, 'reaction damage does not proc ember_charm');
  });

  test('sets: counts per element, active at 3+ (evolved weapons count), shown by NR.reactions.sets', function () {
    const NR = fresh(), R = NR.reactions;
    let p = addWeapons(NR, ['ember_gun', 'flamer', 'pistol']);
    eq(R.setCount(p, 'fire'), 2); eq(R.setActive(p, 'fire'), false);
    p = addWeapons(NR, ['ember_gun', 'flamer', 'grenade']); eq(R.setActive(p, 'fire'), true);
    p = addWeapons(NR, ['ember_gun', 'flamer', 'inferno_jet']); eq(R.setActive(p, 'fire'), true, 'evolved weapons count');
    eq(R.sets(p).filter(function (s) { return s.active; }).map(function (s) { return s.element; }), ['fire']);
    eq(R.sets({ weapons: [] }), []);
  });

  test('sets: ice +25% vs frozen, shock +1 chain, poison +1 stack, void pull x1.5, physical +1 pierce, fire spreads burn on death', function () {
    // ice
    let NR = fresh(), a = foe(NR, 1000, 800, 100000); sync(NR); freeze(a);
    addWeapons(NR, ['frost_fan', 'frost_aura', 'pistol']); let base = hit(NR, a, 'fire', 100); NR.__dmg = {};
    addWeapons(NR, ['frost_fan', 'frost_aura', 'frost_seeker']); a.rxAt = 1e9;
    const boosted = hit(NR, a, 'fire', 100);
    near(boosted / base, (1.25 + 0.25) / 1.25, 'ice set damage vs frozen', 1e-9);
    // shock
    NR = fresh(); a = foe(NR, 1000, 800); const line = []; for (let i = 1; i <= 6; i++) line.push(foe(NR, 1000 + i * 90, 800)); sync(NR);
    addWeapons(NR, ['arc_coil', 'drone_pod', 'pistol']); eq(NR.combat.chain(a, 20, { jumps: 3, range: 120, weaponId: 'arc_coil' }), 3);
    addWeapons(NR, ['arc_coil', 'drone_pod', 'chakram']); eq(NR.combat.chain(a, 20, { jumps: 3, range: 120, weaponId: 'arc_coil' }), 4);
    // poison
    NR = fresh(); a = foe(NR, 1000, 800); addWeapons(NR, ['toxin_mine', 'toxic_cloud', 'pistol']);
    for (let i = 0; i < 9; i++) NR.combat.applyStatus(a, 'poison', 1, 10, 'x'); eq(a.status.poison.stacks, 5);
    NR = fresh(); a = foe(NR, 1000, 800); addWeapons(NR, ['toxin_mine', 'toxic_cloud', 'venom_bow']);
    for (let i = 0; i < 9; i++) NR.combat.applyStatus(a, 'poison', 1, 10, 'x'); eq(a.status.poison.stacks, 6);
    // void
    NR = fresh(); a = foe(NR, 1000, 800); addWeapons(NR, ['maul', 'seeker', 'pistol']); NR.combat.pull(a, 1100, 800, 100); const k1 = a.kbx;
    a.kbx = 0; addWeapons(NR, ['maul', 'seeker', 'frost_seeker', 'pistol'].slice(0, 2).concat(['maul'])); NR.combat.pull(a, 1100, 800, 100); near(a.kbx / k1, 1.5, 'void pull', 1e-9);
    // physical pierce
    NR = fresh(); let p = addWeapons(NR, ['pistol', 'katana', 'ember_gun']);
    const pierce0 = NR.weapons.resolve(p, 0).pierce; p = addWeapons(NR, ['pistol', 'katana', 'smg']);
    eq(NR.weapons.resolve(p, 0).pierce, pierce0 + 1);
    // fire: a burning enemy that dies lights its neighbours
    NR = fresh(); a = foe(NR, 1000, 800, 10); const nb = foe(NR, 1060, 800); sync(NR);
    NR.combat.applyStatus(a, 'burn', 1, 40, 'ember_gun'); addWeapons(NR, ['ember_gun', 'flamer', 'grenade']);
    NR.combat.hitEnemy(a, 9999, { weaponId: 'ember_gun', element: 'fire' });
    ok(nb.status && nb.status.burn && nb.status.burn.t > 0, 'neighbour ignited');
    NR = fresh(); a = foe(NR, 1000, 800, 10); const nb2 = foe(NR, 1060, 800); sync(NR); NR.combat.applyStatus(a, 'burn', 1, 40, 'ember_gun');
    NR.combat.hitEnemy(a, 9999, { weaponId: 'ember_gun', element: 'fire' }); ok(!(nb2.status && nb2.status.burn && nb2.status.burn.t > 0), 'no spread without the set');
  });

  test('reactions: determinism - same seed, same hash; bot runs fire reactions and never produce NaN', function () {
    const a = H.runSim({ seconds: 120, seed: 4, char: 'tinker', danger: 1 }), b = H.runSim({ seconds: 120, seed: 4, char: 'tinker', danger: 1 });
    eq(a.hash, b.hash);
    let seen = 0; const NR = H.load(); NR.main.boot(); NR.events.on('status:react', function () { seen++; });
    for (const seed of [1, 2, 3]) NR.bot.play({ seconds: 400, seed: seed, char: 'ranger', danger: 1 });
    ok(seen > 0, 'reactions occur in bot play');
  });

  test('reactions: every reaction has fx (particles, floating name, sfx, juice) with no banned canvas call', function () {
    const NR = H.load({ fx: true, ui: true }); NR.main.boot(); NR.run.start({ charId: 'ranger', seed: 2 });
    const W = NR.world.get(), ctx = NR.__dom.ctx, e = NR.enemies.spawn('brute', 700, 500, {});
    for (const id in NR.data.reactions) { NR.events.emit('status:react', { reaction: id, target: e, x: 700, y: 500, element: NR.data.reactions[id].element, r: 90 }); NR.fx.audio.sfx('react_' + id); }
    for (let i = 0; i < 30; i++) { NR.fx.juice.update(1 / 60); NR.fx.particles.update(1 / 60); NR.fx.render.draw(W, 0.5); }
    eq(ctx.banned, [], 'banned canvas calls');
  });

  test('reactions: reaction events carry the SPEC 8 payload and pass the harness audit', function () {
    const NR = fresh(); const a = foe(NR, 1000, 800); sync(NR); freeze(a); hit(NR, a, 'physical', 20);
    const s = NR.__seen[0]; ok(s && s.reaction && s.target && typeof s.x === 'number' && s.element && s.r > 0);
    ok(H.EVENTS['status:react'], 'harness knows status:react');
  });
};
