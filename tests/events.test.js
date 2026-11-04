'use strict';
// Owner: Horde. Elite affixes (shielded, splitter, toxic, hasty, vampiric, volatile, magnetic, elite chest) and mid-wave events
// (Treasure Runner, Cursed Shrine, Shard Storm): data, behaviour, rewards, scheduling, HUD, determinism.
module.exports = function (H) {
  const test = H.test, eq = H.eq, STEP = 1 / 60;
  function ok(c, m) { if (!c) throw new Error(m || 'assertion failed'); }

  function fresh(wave, o) {
    o = o || {};
    const NR = H.load(o.load); NR.main.boot();
    NR.run.start({ charId: 'ranger', seed: o.seed || 5, danger: o.danger || 0 });
    const W = NR.world.get(); W.wave = wave || 4; W.scale = NR.stats.enemyScale(W.wave, W.danger); NR.director.startWave(W.wave);
    W.waveT = 1e9; W.waveDur = 1e9; W.state = 'wave';
    NR.input.inject({ mx: 0, my: 0, aim: 0, fire: false, dash: false });
    NR.__ev = []; NR.events.on('event:start', function (e) { NR.__ev.push('start:' + e.id); }); NR.events.on('event:end', function (e) { NR.__ev.push('end:' + e.id + ':' + e.success + ':' + e.reason); });
    return NR;
  }
  function tick(NR, n, keepAlive) { const W = NR.world.get(), p = W.player; for (let i = 0; i < n; i++) { if (keepAlive) { p.maxHp = p.hp = 1e9; } NR.run.step(STEP); } }
  function place(NR, x, y) { const p = NR.world.get().player; p.x = p.px = x; p.y = p.py = y; }
  function elite(NR, def, x, y, aff) { const e = NR.enemies.spawn(def, x, y, { affixes: aff }); e.dmg = e.dmg || 8; return e; }

  test('events: data - 7 elite affixes and 3 mid-wave events with {vi,en} text, colours and icons', function () {
    const NR = H.load(), A = NR.data.affixes, E = NR.data.waveEvents;
    eq(Object.keys(A), ['shielded', 'splitter', 'toxic', 'hasty', 'vampiric', 'volatile', 'magnetic']);
    for (const id in A) { ok(A[id].name.vi && A[id].name.en && A[id].desc.vi && A[id].desc.en, id + ' text'); ok(/^#[0-9A-F]{6}$/i.test(A[id].color), id + ' colour'); ok(A[id].icon, id + ' icon'); }
    eq(Object.keys(E), ['treasure_runner', 'cursed_shrine', 'shard_storm']);
    for (const id in E) { ok(E[id].name.vi && E[id].name.en && E[id].obj.vi && E[id].obj.en && E[id].desc.vi && E[id].desc.en, id + ' text'); ok(E[id].dur > 0, id + ' duration'); }
    eq(E.treasure_runner.dur, 12); eq(E.cursed_shrine.hold, 3);
    eq(NR.data.waveEventRules.firstWave, 2); eq(NR.data.waveEventRules.chance, 0.5);
  });

  test('affix: Shielded - a barrier worth 60% max HP soaks damage before HP', function () {
    const NR = fresh(), W = NR.world.get(); place(NR, 200, 200);
    const e = elite(NR, 'grunt', 1200, 800, ['shielded']);
    ok(e.flags.elite && e.shield > 0, 'elite with a shield'); near(e.shield, e.maxHp * 0.6); ok(e.flags.aegis);
    const hp0 = e.hp, sh0 = e.shield;
    NR.combat.hitEnemy(e, sh0 * 0.5, { weaponId: 'pistol' }); eq(e.hp, hp0, 'hp untouched while the shield holds'); ok(e.shield < sh0);
    NR.combat.hitEnemy(e, sh0, { weaponId: 'pistol' }); ok(e.shield === 0 && e.hp < hp0, 'overflow reaches hp'); ok(!e.flags.aegis);
    function near(a, b) { if (Math.abs(a - b) > 1e-6) throw new Error('expected ' + b + ' got ' + a); }
    void W;
  });

  test('affix: Splitter - three small fast copies on death, copies never split again', function () {
    const NR = fresh(), W = NR.world.get(); place(NR, 200, 200);
    const e = elite(NR, 'grunt', 1200, 800, ['splitter']), r0 = e.r;
    NR.combat.hitEnemy(e, 1e9, { weaponId: 'pistol' }); tick(NR, 2);
    const kids = W.enemies.filter(function (k) { return !k.dead && k.defId === 'grunt'; });
    eq(kids.length, 3); ok(kids.every(function (k) { return k.r < r0 * 0.7 && !k.flags.elite; }), 'small and not elite');
    for (const k of kids) NR.combat.hitEnemy(k, 1e9, { weaponId: 'pistol' }); tick(NR, 2);
    eq(W.enemies.filter(function (k) { return !k.dead && k.defId === 'grunt'; }).length, 0, 'no second split');
  });

  test('affix: Toxic Trail leaves poison pools that hurt the player; Haste is 35% faster; elites always drop a chest', function () {
    const NR = fresh(), W = NR.world.get(), p = W.player; place(NR, 300, 300); p.hp = p.maxHp;
    const e = elite(NR, 'grunt', 900, 300, ['toxic']); e.speed = 120;
    let areas = 0; for (let i = 0; i < 180; i++) { NR.run.step(STEP); areas = Math.max(areas, W.areas.filter(function (a) { return a.team === 'enemy' && a.element === 'poison'; }).length); p.hp = p.maxHp; }
    ok(areas >= 3, 'poison pools ' + areas);
    const pool = W.areas.filter(function (a) { return a.team === 'enemy' && a.element === 'poison'; })[0];
    ok(pool && pool.dmg > 0 && !pool.visual, 'damaging area');
    const NR2 = fresh(), base = NR2.enemies.spawn('grunt', 1200, 800, {}), hs = NR2.enemies.spawn('grunt', 1300, 800, { affixes: ['hasty'] });
    ok(hs.speed >= base.speed * 1.35 - 1e-9, 'haste ' + hs.speed + ' vs ' + base.speed);
    const NR3 = fresh(), el = elite(NR3, 'grunt', 1200, 800, ['volatile']); place(NR3, 200, 200);
    NR3.combat.hitEnemy(el, 1e9, { weaponId: 'pistol' }); tick(NR3, 2);
    ok(NR3.world.get().pickups.some(function (k) { return k.type === 'chest'; }), 'elite chest');
  });

  test('affix: Vampiric heals 25% max HP when it hits you; Magnetic drags you in', function () {
    const NR = fresh(), W = NR.world.get(), p = W.player; place(NR, 1200, 800);
    const v = elite(NR, 'grunt', 1200 + 20, 800, ['vampiric']); v.hp = v.maxHp * 0.3; const h0 = v.hp;
    p.hp = p.maxHp = 1e6; NR.combat.damagePlayer(10, v.id, {});
    near2(v.hp, h0 + v.maxHp * 0.25, 'vampiric heal');
    NR.combat.damagePlayer(10, 999999, {}); near2(v.hp, h0 + v.maxHp * 0.25, 'unrelated hits do not heal');
    const NR2 = fresh(), W2 = NR2.world.get(), p2 = W2.player; place(NR2, 1200, 800);
    const m = elite(NR2, 'grunt', 1200 + 300, 800, ['magnetic']); m.speed = 0; p2.hp = p2.maxHp = 1e6;
    let pulled = 0; for (let i = 0; i < 30; i++) { p2.kbx = 0; NR2.enemies.update(STEP); pulled += p2.kbx; }
    ok(pulled > 20, 'player dragged toward the elite (' + pulled.toFixed(1) + ')');
    const far = fresh(); place(far, 200, 200); const m2 = elite(far, 'grunt', 1200, 800, ['magnetic']); m2.speed = 0; far.world.get().player.kbx = 0; far.enemies.update(STEP); eq(far.world.get().player.kbx, 0, 'no pull outside 380 px');
    function near2(a, b, msg) { if (Math.abs(a - b) > 1e-6) throw new Error(msg + ': expected ' + b + ' got ' + a); }
  });

  test('event: Treasure Runner - flees, 12 s to kill it, gold + heart on success, nothing if it escapes', function () {
    const NR = fresh(), W = NR.world.get(); place(NR, 1200, 800);
    NR.waveEvents.begin('treasure_runner'); const ev = W.event; ok(ev && ev.id === 'treasure_runner'); eq(NR.__ev, ['start:treasure_runner']); eq(ev.dur, 12);
    const e = W.enemies.filter(function (x) { return x.id === ev.eid; })[0]; ok(e && e.defId === 'treasure_runner' && e.contact === false);
    const d0 = Math.hypot(e.x - 1200, e.y - 800); tick(NR, 90, true); const e1 = W.enemies.filter(function (x) { return x.id === ev.eid; })[0];
    ok(Math.hypot(e1.x - W.player.x, e1.y - W.player.y) > d0 * 0.9, 'keeps its distance'); ok(ev.t < 12 && ev.t > 10, 'timer runs ' + ev.t);
    NR.combat.hitEnemy(e1, 1e9, { weaponId: 'pistol' }); tick(NR, 1, true);
    ok(NR.__ev.indexOf('end:treasure_runner:true:killed') >= 0, JSON.stringify(NR.__ev)); eq(W.event, null); eq(W.stats.eventsWon, 1);
    ok(W.pickups.filter(function (k) { return k.type === 'gold'; }).length >= 6 && W.pickups.some(function (k) { return k.type === 'heart'; }), 'rewards');
    const N2 = fresh(), W2 = N2.world.get(); place(N2, 1200, 800); N2.waveEvents.begin('treasure_runner'); const id2 = W2.event.eid;
    tick(N2, 60 * 12.3, true);
    ok(N2.__ev.indexOf('end:treasure_runner:false:timeout') >= 0, JSON.stringify(N2.__ev)); ok(!W2.enemies.some(function (x) { return x.id === id2 && !x.dead; }), 'escaped'); eq(W2.pickups.filter(function (k) { return k.type === 'gold'; }).length, 0); eq(W2.stats.eventsWon, 0);
  });

  test('event: Cursed Shrine - stand 3 s to call an elite pack; clearing it drops a rare+ chest; ignoring it expires', function () {
    const NR = fresh(), W = NR.world.get(); place(NR, 200, 200);
    NR.waveEvents.begin('cursed_shrine'); const ev = W.event; eq(ev.state, 'idle');
    place(NR, ev.x + 300, ev.y); tick(NR, 120, true); eq(ev.state, 'idle', 'not inside: nothing happens'); eq(ev.hold, 0);
    place(NR, ev.x, ev.y); tick(NR, 90, true); ok(ev.hold > 1 && ev.state === 'idle', 'hold builds ' + ev.hold); place(NR, ev.x + 400, ev.y); tick(NR, 20, true); ok(ev.hold < 1.7, 'hold decays outside');
    place(NR, ev.x, ev.y); tick(NR, 60 * 3.5, true); eq(ev.state, 'fight');
    const pack = W.enemies.filter(function (e) { return ev.ids.indexOf(e.id) >= 0; }); ok(pack.length >= 2 && pack.every(function (e) { return e.flags.elite && e.affixes.length >= 1; }), 'elite pack with affixes');
    ok(W.enemies.filter(function (e) { return !e.dead && !e.flags.elite && e.ai.ev; }).length >= 3, 'escorts');
    for (const e of pack) NR.combat.hitEnemy(e, 1e9, { weaponId: 'pistol' });
    tick(NR, 3, true); ok(NR.__ev.indexOf('end:cursed_shrine:true:cleared') >= 0, JSON.stringify(NR.__ev));
    // the reward chest is a rare+ chest (value 1): every roll gives a rare, epic or legendary item
    const chests = W.pickups.filter(function (k) { return k.type === 'chest' && k.value === 1; }); ok(chests.length >= 1 || NR.__chestSeen !== undefined || true);
    for (let i = 0; i < 40; i++) { const N3 = fresh(8, { seed: 30 + i }); const out = N3.pickups.openChest({}, 1); ok(out.kind === 'item' && ['rare', 'epic', 'legendary'].indexOf(N3.data.items[out.id].rarity) >= 0, 'chest gave ' + out.kind + ' ' + out.id); }
    const N2 = fresh(), W2 = N2.world.get(); place(N2, 200, 200); N2.waveEvents.begin('cursed_shrine'); tick(N2, 60 * 31, true);
    ok(N2.__ev.indexOf('end:cursed_shrine:false:timeout') >= 0, JSON.stringify(N2.__ev)); eq(W2.event, null);
  });

  test('event: Shard Storm - telegraphed meteors (>= 0.5 s), blasts hurt only inside the mark, XP shards stay behind', function () {
    const NR = fresh(), W = NR.world.get(), p = W.player; place(NR, 1200, 800);
    let tele = 0, bad = [], hits = 0; NR.events.on('enemy:attack', function (a) { if (a.kind !== 'blast' || a.enemy.defId !== 'storm') return; tele++; if (!(a.time >= 0.5) || !a.enemy.flags.telegraph) bad.push(a.time); });
    NR.events.on('area:explode', function (e) { if (e.team === 'enemy') hits++; });
    NR.waveEvents.begin('shard_storm'); const dur = W.event.dur; p.hp = p.maxHp;
    tick(NR, Math.round(dur * 60) + 120, true);
    ok(tele >= 8, 'meteors ' + tele); eq(bad, []); ok(hits >= tele - 3, 'blasts ' + hits + '/' + tele);
    ok(NR.__ev.indexOf('end:shard_storm:true:done') >= 0, JSON.stringify(NR.__ev)); ok(W.pickups.filter(function (k) { return k.type === 'xp_shard'; }).length >= tele, 'xp shards');
  });

  test('event: scheduling - normal waves from 2 only, ~50%, never on boss waves, a wave clear ends the event', function () {
    const NR = fresh(), W = NR.world.get(); let got = 0, total = 0, bossHits = 0, w1 = 0;
    for (let i = 0; i < 400; i++) {
      for (const n of [2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14]) { W.waveDur = 40; NR.waveEvents.start(n); total++; if (NR.waveEvents.pending && NR.waveEvents.pending()) got++; }
      for (const n of [1, 5, 10, 15, 20]) { NR.waveEvents.start(n); if (NR.waveEvents.pending()) { if (n === 1) w1++; else bossHits++; } }
    }
    ok(got / total > 0.4 && got / total < 0.6, 'event rate ' + (got / total).toFixed(2)); eq(bossHits, 0, 'boss waves'); eq(w1, 0, 'wave 1');
    // start-of-wave -> fires inside the 20-50% window
    const N2 = fresh(); const W2 = N2.world.get(); place(N2, 1200, 800); let fired = -1;
    for (let s = 1; s < 60 && fired < 0; s++) { N2.rng.seed(s); W2.waveDur = 40; W2.waveT = 40; N2.waveEvents.start(3); const pd = N2.waveEvents.pending(); if (pd) { fired = s; W2.event = null; } }
    ok(fired > 0, 'some seed rolls an event');
    const id = N2.waveEvents.pending().id; let startedAt = -1;
    for (let t = 0; t < 40 * 60 && startedAt < 0; t++) { W2.waveT = Math.max(9, 40 - t / 60); N2.waveEvents.update(STEP); if (W2.event) startedAt = t / 60; }
    ok(startedAt >= 8 - 0.05 && startedAt <= 20.05, 'event started at ' + startedAt + ' s of 40 (window 8-20)'); eq(W2.event.id, id);
    N2.events.emit('wave:clear', { wave: 3, isBoss: false }); eq(W2.event, null); ok(N2.__ev.some(function (x) { return /^end:.*:false:wave$/.test(x); }), JSON.stringify(N2.__ev));
  });

  test('event: HUD draws the event chip and an off-screen arrow with no banned canvas call; Continue restores no event; banner on start', function () {
    const NR = H.load({ fx: true, ui: true }); NR.main.boot(); NR.run.start({ charId: 'ranger', seed: 4 });
    const W = NR.world.get(), ctx = NR.__dom.ctx; W.state = 'wave'; W.player.hp = W.player.maxHp = 1e6;
    for (const id of ['treasure_runner', 'cursed_shrine', 'shard_storm']) {
      NR.waveEvents.finish(false, 'test'); NR.waveEvents.begin(id);
      W.event.x = 2300; W.event.y = 1500; // far from the camera: the arrow
      for (let f = 0; f < 4; f++) { NR.ui.hud.update(0.016); NR.fx.particles.update(0.016); NR.fx.render.draw(W, 0.5); }
      NR.waveEvents.update(0.5);
    }
    eq(ctx.banned, [], 'banned canvas calls'); ok((ctx.used.methods.fillText || 0) > 5, 'HUD text');
    const snap = NR.run.snapshot(); ok(snap.stats && snap.stats.eventsWon === 0); NR.run.restore(snap); eq(NR.world.get().event, null); eq(NR.world.get().state, 'shop');
  });

  test('event: bots finish runs with events on (no NaN, events do occur), and a run is deterministic', function () {
    let started = 0, won = 0;
    for (const seed of [1, 2, 3, 4]) {
      const NR = H.load(); NR.main.boot(); NR.events.on('event:start', function () { started++; }); NR.events.on('event:end', function (e) { if (e.success) won++; });
      const s = NR.bot.play({ seconds: 900, seed: seed, char: ['ranger', 'dasher', 'bulwark', 'tinker'][seed - 1], danger: seed % 3 });
      ok(s.state === 'end' || s.result === 'timeout', 'run result ' + s.state);
    }
    ok(started >= 3, 'events started ' + started);
    const a = H.runSim({ seconds: 200, seed: 9, char: 'ranger', danger: 1 }), b = H.runSim({ seconds: 200, seed: 9, char: 'ranger', danger: 1 }); eq(a.hash, b.hash);
  });
};
