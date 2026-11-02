// Owner: FX
// Render/FX checks: a busy 600-frame scene through the recording fake canvas (no banned visual feature), the particle
// budget, flash caps, adaptive quality, audio no-op in Node and with a fake AudioContext, and sim determinism with fx.
module.exports = function (H) {
  function ok(c, msg) { if (!c) throw new Error(msg); }

  // load with fx+ui, recording every canvas the fx code creates (sprites, floor cache) next to the main one
  function boot() {
    const NR = H.load({ fx: true, ui: true });
    const doc = NR.__dom.document, made = [], orig = doc.createElement.bind(doc);
    doc.createElement = function (tag) { const e = orig(tag); if (String(tag).toLowerCase() === 'canvas') made.push(e); return e; };
    NR.main.boot();
    return { NR: NR, made: made, ctx: NR.__dom.ctx };
  }
  function allCtx(b) { const out = [b.ctx]; for (const c of b.made) if (c._ctx) out.push(c._ctx); return out; }

  function populate(NR) {
    const W = NR.world.get(), p = W.player, S = NR.fx.shapes.ids, E = NR.events;
    p.maxHp = 999999; p.hp = 999999;
    const ids = Object.keys(NR.data.enemies), made = [];
    for (let i = 0; i < ids.length * 3; i++) {
      const a = i * 0.7, e = NR.enemies.spawn(ids[i % ids.length], p.x + Math.cos(a) * (140 + i * 9), p.y + Math.sin(a) * (110 + i * 7), {});
      if (e) made.push(e);
    }
    const st = [{ burn: { t: 5 } }, { chill: { t: 5 } }, { shock: { t: 5 } }, { poison: { t: 5 } }, { freeze: { t: 5 } }, { burn: { t: 5 }, poison: { t: 5 }, shock: { t: 5 } }, { void: { t: 5 } }, { pull: { t: 1 } }];
    made.forEach(function (e, i) {
      e.shape = S[i % S.length]; e.status = st[i % st.length];
      if (i % 5 === 0) e.flags.elite = true;
      if (i % 11 === 0) e.flags.frozen = true;
      if (i % 7 === 0) e.flags.telegraph = true;
      if (i % 13 === 0) e.flags.phased = true;
    });
    const boss = NR.bosses.spawn('scrap_titan', {});
    if (boss) { boss.flags.enraged = true; boss.status = { burn: { t: 9 }, chill: { t: 9 } }; }
    for (let i = 0; i < S.length * 2; i++) {
      const enemy = i % 2 === 0, b = NR.projectiles.spawn({ team: enemy ? 'enemy' : 'player', weaponId: i % 4 ? 'pistol' : 'gatling_pistol', x: p.x + 40 + i * 14, y: p.y - 60 + (i % 5) * 30, vx: 30, vy: 10, r: 5, dmg: 1, element: ['fire', 'ice', 'shock', 'poison', 'void', 'physical'][i % 6], life: 600 });
      if (b) b.shape = S[i % S.length];
    }
    NR.combat.createArea({ areaKind: 'circle', x: p.x + 100, y: p.y, r: 60, life: 600, element: 'fire' });
    NR.combat.createArea({ areaKind: 'cone', x: p.x, y: p.y + 120, len: 130, arc: 1.2, life: 600, element: 'ice', team: 'enemy' });
    NR.combat.createArea({ areaKind: 'line', x: p.x - 120, y: p.y, len: 200, w: 30, angle: 0.5, life: 600, element: 'shock' });
    ['xp_shard', 'gold', 'heart', 'magnet', 'nova_bomb', 'chest'].forEach(function (t, i) {
      const k = NR.pickups.spawn(t, p.x + 60 + i * 25, p.y + 50, 5);
      if (k && i % 2) k.magnet = true;
    });
    for (let i = 0; i < 3; i++) NR.world.add('drones', { x: p.x + 30 * i, y: p.y + 40, r: 8, shape: 'diamond', color: '#FFD43B', rot: 0, sx: 1, sy: 1, flash: 0 });
    return made;
  }

  function fireEvents(NR, f, en) {
    const E = NR.events, p = NR.world.get().player, x = p.x + 80, y = p.y;
    if (f % 3 === 0) E.emit('damage:dealt', { weaponId: 'pistol', target: en, isBoss: false, amount: 12 + f % 50, crit: f % 6 === 0, element: ['fire', 'ice', 'shock', 'poison', 'void', 'physical'][f % 6], x: en.x, y: en.y, killed: false });
    if (f % 4 === 0) E.emit('weapon:fire', { weaponId: ['pistol', 'katana', 'scattergun', 'grenade'][f % 4], slot: 0, kind: ['projectile', 'melee', 'spread', 'thrown'][(f / 4) % 4 | 0], x: p.x, y: p.y, angle: f * 0.1 });
    if (f % 5 === 0) E.emit('status:apply', { target: en, status: ['burn', 'chill', 'shock', 'poison'][f % 4], stacks: 1, x: en.x, y: en.y });
    if (f % 17 === 0) E.emit('chain:arc', { points: [{ x: x, y: y }, { x: x + 50, y: y + 20 }, { x: x + 90, y: y - 30 }], element: 'shock' });
    if (f % 23 === 0) E.emit('area:explode', { x: x, y: y, r: [60, 140, 260, 600][(f / 23) % 4 | 0], element: 'fire', team: f % 2 ? 'player' : 'enemy', weaponId: 'grenade' });
    if (f % 29 === 0) E.emit('enemy:attack', { enemy: en, kind: ['slam', 'lunge', 'cone_sweep', 'snipe'][(f / 29) % 4 | 0], time: 0.6, x: en.x, y: en.y, r: 140 });
    if (f % 31 === 0) E.emit('enemy:death', { enemy: en, weaponId: 'pistol', x: en.x, y: en.y, elite: f % 2 === 0, isBoss: false });
    if (f % 37 === 0) E.emit('projectile:impact', { x: x, y: y, r: 5, element: 'fire', team: f % 2 ? 'player' : 'enemy', surface: ['wall', 'enemy', 'player', 'expire'][(f / 37) % 4 | 0] });
    if (f % 41 === 0) E.emit('pickup:collect', { type: ['xp_shard', 'gold', 'heart', 'chest', 'magnet'][(f / 41) % 5 | 0], value: 7, x: x, y: y });
    if (f % 53 === 0) E.emit('player:hurt', { amount: 15, hp: p.hp, srcId: 1, dodged: f % 2 === 0, revived: false, x: p.x, y: p.y });
    if (f % 59 === 0) E.emit('player:dash', { x: p.x, y: p.y, dx: 1, dy: 0, charges: 1 });
    if (f % 61 === 0) E.emit('player:levelup', { level: 3, pending: 1 });
    if (f % 67 === 0) E.emit('weapon:evolve', { slot: 0, from: 'pistol', into: 'gatling_pistol' });
    if (f === 100) E.emit('boss:phase', { boss: en, phase: 2 });
    if (f === 200) E.emit('wave:start', { wave: 6, zone: 'frost', isBoss: false, duration: 30 });
    if (f === 300) E.emit('wave:start', { wave: 11, zone: 'void', isBoss: true, duration: 60 });
    if (f === 400) E.emit('boss:death', { boss: en, x: en.x, y: en.y });
    if (f === 450) E.emit('player:death', { x: p.x, y: p.y });
    if (f === 520) E.emit('wave:clear', { wave: 11, isBoss: true });
  }

  H.test('fx: busy 600-frame scene renders every shape and status, no banned canvas feature', function () {
    const b = boot(), NR = b.NR, F = NR.fx, STEP = NR.config.STEP;
    NR.run.start({ charId: 'ranger', danger: 0, seed: 5 });
    populate(NR);
    const W0 = NR.world.get(), en = W0.enemies[0];
    let maxP = 0, frames = 0;
    for (let f = 0; f < 600; f++) {
      NR.input.inject({ mx: Math.cos(f / 40), my: Math.sin(f / 33), aim: f * 0.1, fire: true, dash: f % 90 === 0 });
      NR.run.step(STEP);
      const W = NR.world.get();
      if (f === 250) { W.player.maxHp = 100; W.player.hp = 12; } // low-HP frame
      if (f === 330) { W.player.hp = 100; }
      fireEvents(NR, f, W.enemies.length ? W.enemies[f % W.enemies.length] : en);
      NR.camera.update(STEP, 1);
      F.juice.update(STEP); F.particles.update(STEP); F.floor.update(STEP); F.audio.update(STEP);
      F.render.draw(W, 0.5);
      const n = F.particles.count();
      if (n > maxP) maxP = n;
      ok(n <= NR.config.CAPS.particles, 'particles over budget: ' + n);
      ok(F.particles.textCount() <= NR.config.CAPS.texts, 'too many damage numbers');
      frames++;
    }
    ok(frames === 600, 'did not render 600 frames');
    ok(maxP > 100, 'scene was not busy enough (max particles ' + maxP + ')');
    const ctxs = allCtx(b);
    ok(b.made.length >= NR.fx.shapes.ids.length, 'sprites were not cached offscreen');
    for (const c of ctxs) H.eq(c.banned, [], 'banned canvas feature used');
    ok(b.ctx.used.methods.drawImage > 1000, 'sprites were not blitted');
    ok(b.ctx.used.methods.fillRect > 0 && b.ctx.used.methods.arc > 0 && b.ctx.used.methods.stroke > 0, 'flat fills/strokes missing');
    H.eq(NR.fx.shapes.count() <= 900, true, 'sprite cache unbounded');
  });

  H.test('fx: sprite cache is stable and unknown shapes fall back to a circle', function () {
    const b = boot(), NR = b.NR, S = NR.fx.shapes, ctx = b.ctx;
    const ids = S.ids.concat(['unknown_shape_xyz']);
    ids.forEach(function (id) { S.draw(ctx, id, 50, 50, 12, 0.5, 1.2, 0.8, '#D9693A', 3, id === 'circle'); });
    const n = S.count();
    ids.forEach(function (id) { S.draw(ctx, id, 90, 40, 12, 1.1, 1, 1, '#D9693A', 3, id === 'circle'); });
    H.eq(S.count(), n, 'second pass created new sprites');
    H.eq(ctx.banned, [], 'banned feature in shapes');
    S.draw(ctx, 'hex', 10, 10, 9, 0, 1, 1, 'white', 3, false); // non-hex colors must not throw
  });

  H.test('fx: particle pool, decals and texts never exceed their caps', function () {
    const b = boot(), NR = b.NR, F = NR.fx, C = NR.config.CAPS;
    NR.run.start({ charId: 'ranger', danger: 0, seed: 2 });
    for (let i = 0; i < 400; i++) {
      F.particles.burst('death', 500, 500, '#D9693A', 40, {}); F.particles.burst('hit', 500, 500, '#FFD43B', 40, {}); F.particles.ring(500, 500, 100, '#FFFFFF', 1);
      F.particles.text(500, 500, '9', '#fff', 12); F.floor.decal(i % 2 ? 'scorch' : 'splat', 400 + i, 400, 30, '#14121F');
      F.particles.bolt([{ x: 0, y: 0 }, { x: 80, y: 40 }], '#FFD43B', 0.2); F.particles.afterimage(1, 1, 'tri', '#FFFFFF', 10, 0, 0.3, 0.5);
      ok(F.particles.count() <= C.particles, 'particles ' + F.particles.count());
    }
    H.eq(F.particles.count(), C.particles, 'pool should fill to exactly the cap');
    ok(F.particles.textCount() <= C.texts, 'texts over cap');
    ok(F.floor.decalCount() <= C.decals, 'decals over cap');
    for (let i = 0; i < 200; i++) F.particles.update(0.016);
    H.eq(F.particles.count(), 0, 'particles did not expire');
  });

  H.test('fx: damage numbers merge per target and obey the setting', function () {
    const b = boot(), NR = b.NR, F = NR.fx;
    NR.run.start({ charId: 'ranger', danger: 0, seed: 2 });
    const t = NR.enemies.spawn('brute', 600, 600, {});
    for (let i = 0; i < 10; i++) NR.events.emit('damage:dealt', { weaponId: 'pistol', target: t, isBoss: false, amount: 5, crit: false, element: 'physical', x: t.x, y: t.y, killed: false });
    H.eq(F.particles.textCount(), 1, 'hits on one target must merge');
    NR.events.emit('damage:dealt', { weaponId: 'pistol', target: t, isBoss: false, amount: 40, crit: true, element: 'physical', x: t.x, y: t.y, killed: false });
    H.eq(F.particles.textCount(), 1, 'crit merges into the live number');
    NR.save.setSetting('damageNumbers', false);
    F.particles.clear();
    NR.events.emit('damage:dealt', { weaponId: 'pistol', target: t, isBoss: false, amount: 5, crit: false, element: 'physical', x: t.x, y: t.y, killed: false });
    H.eq(F.particles.textCount(), 0, 'damageNumbers=false must hide numbers');
  });

  H.test('fx: reduce flashing caps full-screen flashes at 3 per second at lower opacity', function () {
    const b = boot(), NR = b.NR, J = NR.fx.juice;
    NR.save.setSetting('reduceFlashing', true);
    let okN = 0;
    for (let i = 0; i < 60; i++) { J.update(0.016); if (J.screenFlash('#FFFFFF', 0.85, 0.3)) okN++; }
    ok(okN <= 3, 'more than 3 flashes in ~1 s: ' + okN);
    ok(okN >= 1, 'no flash at all');
    const c = NR.__dom.ctx; c.globalAlpha = 1; J.update(1.2); ok(J.screenFlash('#FFFFFF', 1, 0.5), 'flash refused after the window passed');
    const seen = []; const pr = new Proxy(c, { set: function (t, k, v) { if (k === 'globalAlpha') seen.push(v); t[k] = v; return true; }, get: function (t, k) { return t[k]; } });
    J.drawOverlay(pr, 1280, 720);
    ok(seen.length && seen[0] <= 0.41 && seen[0] > 0, 'reduced flash opacity wrong: ' + seen[0]);
    NR.save.setSetting('reduceFlashing', false);
  });

  H.test('fx: quality steps down after 2 s above 20 ms and back up after a long calm spell', function () {
    const b = boot(), P = b.NR.fx.particles;
    P.setQuality(0);
    for (let i = 0; i < 60; i++) P.update(0.025); // 1.5 s of slow frames
    H.eq(P.quality(), 0, 'stepped down too early');
    for (let i = 0; i < 40; i++) P.update(0.025); // 2.5 s total
    ok(P.quality() >= 1, 'did not step down after 2 s of slow frames');
    for (let i = 0; i < 400; i++) P.update(0.025);
    H.eq(P.quality(), 3, 'quality floor not reached');
    for (let i = 0; i < 2500; i++) P.update(0.008); // 20 s fast
    ok(P.quality() < 3, 'never recovered');
  });

  H.test('fx: sim hash is identical with and without rendering fx', function () {
    const a = H.runSim({ seconds: 20, seed: 7, char: 'ranger', danger: 0 });
    const c = H.runSim({ seconds: 20, seed: 7, char: 'ranger', danger: 0, fx: true, render: true });
    H.eq(c.hash, a.hash, 'fx changed the simulation');
  });

  H.test('fx: audio loads and no-ops safely in Node without AudioContext', function () {
    const b = boot(), NR = b.NR, A = NR.fx.audio;
    H.eq(typeof globalThis.AudioContext, 'undefined');
    H.eq(A.unlock(), false); H.eq(A.ready(), false);
    H.eq(A.sfx('hit'), false); A.music('scrap'); A.music('frost', true); A.music(null); A.update(0.016); A.applySettings(); A.init();
    NR.run.start({ charId: 'ranger', danger: 0, seed: 1 });
    NR.events.emit('player:levelup', { level: 2, pending: 0 }); NR.events.emit('boss:death', { boss: null, x: 0, y: 0 });
    NR.events.emit('settings:change', { key: 'master', value: 0.3 });
    NR.__dom.document.fire('pointerdown', {}); // unlock path from main.js
  });

  function fakeAC(rec) {
    class Param { constructor(list) { this.value = 0; this.list = list; } setValueAtTime(v) { this.value = v; if (this.list) this.list.push(v); } linearRampToValueAtTime() {} exponentialRampToValueAtTime() {} cancelScheduledValues() {} setTargetAtTime(v) { this.target = v; rec.targets.push(v); } }
    class Node { constructor() { this.gain = new Param(); this.frequency = new Param(); this.Q = new Param(); this.threshold = new Param(); this.knee = new Param(); this.ratio = new Param(); this.attack = new Param(); this.release = new Param(); } connect(n) { return n; } disconnect() {} }
    return class FakeAC {
      constructor() { this.currentTime = 1; this.sampleRate = 8000; this.state = 'running'; this.destination = new Node(); rec.made++; }
      createGain() { return new Node(); }
      createDynamicsCompressor() { return new Node(); }
      createBiquadFilter() { return new Node(); }
      createOscillator() { const n = new Node(); n.frequency = new Param(rec.freqs); n.start = function () { rec.started++; }; n.stop = function () {}; return n; }
      createBufferSource() { const n = new Node(); n.start = function () { rec.started++; }; n.stop = function () {}; return n; }
      createBuffer(c, len) { return { getChannelData: function () { return new Float32Array(len); } }; }
      resume() { rec.resumed++; this.state = 'running'; }
      suspend() { rec.suspended++; this.state = 'suspended'; }
    };
  }

  H.test('fx: audio with a fake AudioContext: rate limits, pitch variation, music loop, hidden tab, buses', function () {
    const b = boot(), NR = b.NR, A = NR.fx.audio, doc = NR.__dom.document;
    const rec = { started: 0, freqs: [], targets: [], made: 0, resumed: 0, suspended: 0 };
    NR.__sandbox.AudioContext = fakeAC(rec);
    H.eq(A.unlock(), true); H.eq(A.ready(), true); H.eq(rec.made, 1);
    A.unlock(); H.eq(rec.made, 1, 'unlock must be idempotent');
    ok(rec.targets.length >= 3, 'master/music/sfx buses not set from settings');
    // a stack of identical sounds in the same instant is rate limited
    let played = 0; for (let i = 0; i < 300; i++) if (A.sfx('hit')) played++;
    ok(played >= 1 && played <= 5, 'hit stack not limited: ' + played);
    played = 0; for (let i = 0; i < 300; i++) if (A.sfx('shoot_light')) played++;
    ok(played >= 1 && played <= 4, 'shoot stack not limited: ' + played);
    // fresh context with a controllable clock for the time-based checks
    const rec2 = { started: 0, freqs: [], targets: [], made: 0, resumed: 0, suspended: 0 };
    const Ctor = fakeAC(rec2); let inst = null;
    const b2 = boot(); b2.NR.__sandbox.AudioContext = function () { inst = new Ctor(); return inst; };
    const A2 = b2.NR.fx.audio; A2.unlock(); ok(inst, 'fake context not created');
    let n = 0; for (let i = 0; i < 60; i++) { inst.currentTime += 0.2; if (A2.sfx('kill')) n++; }
    ok(n >= 50, 'sounds not playable after the limit window: ' + n);
    const uniq = {}; rec2.freqs.forEach(function (f) { uniq[Math.round(f)] = 1; });
    ok(Object.keys(uniq).length > 8, 'no pitch variation');
    // music: every zone plus the boss variant schedule notes ahead of the clock
    ['scrap', 'frost', 'void', 'menu'].forEach(function (z) {
      const s0 = rec2.started; A2.music(z);
      for (let i = 0; i < 200; i++) { inst.currentTime += 0.05; A2.update(0.05); }
      ok(rec2.started - s0 > (z === 'menu' ? 30 : 100), 'music ' + z + ' produced only ' + (rec2.started - s0) + ' voices');
    });
    const s1 = rec2.started; A2.music('frost', true);
    for (let i = 0; i < 200; i++) { inst.currentTime += 0.05; A2.update(0.05); }
    ok(rec2.started - s1 > 200, 'boss variant too sparse');
    // hidden tab: suspended, silent, no scheduling
    b2.NR.__dom.document.hidden = true; A2.update(0.016);
    ok(rec2.suspended >= 1, 'context not suspended when hidden');
    const s2 = rec2.started; inst.currentTime += 5; A2.update(0.016);
    H.eq(A2.sfx('hurt'), false, 'sfx while hidden'); H.eq(rec2.started, s2, 'scheduled audio while hidden');
    b2.NR.__dom.document.hidden = false; A2.update(0.016);
    ok(rec2.resumed >= 1, 'context not resumed');
    // every event produces sound without throwing
    b2.NR.run.start({ charId: 'ranger', danger: 0, seed: 3 });
    const s3 = rec2.started, en = b2.NR.world.get().enemies[0] || b2.NR.enemies.spawn('grunt', 500, 500, {});
    const E = b2.NR.events;
    ['pistol', 'katana'].forEach(function (w, i) { inst.currentTime += 1; E.emit('weapon:fire', { weaponId: w, slot: 0, kind: i ? 'melee' : 'projectile', x: 0, y: 0, angle: 0 }); });
    inst.currentTime += 1; E.emit('player:hurt', { amount: 5, hp: 90, srcId: 0, dodged: false, revived: false, x: 0, y: 0 });
    inst.currentTime += 1; E.emit('area:explode', { x: 0, y: 0, r: 300, element: 'fire', team: 'player', weaponId: null });
    inst.currentTime += 1; E.emit('boss:death', { boss: en, x: 0, y: 0 });
    inst.currentTime += 1; E.emit('pickup:collect', { type: 'xp_shard', value: 1, x: 0, y: 0 });
    ok(rec2.started > s3, 'events produced no sound');
    // settings reach the buses
    const t0 = rec2.targets.length; b2.NR.save.setSetting('master', 0.25);
    ok(rec2.targets.length > t0 && rec2.targets.indexOf(0.25) >= 0, 'master volume setting not applied');
  });
};
