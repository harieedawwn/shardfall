'use strict';
// Owner: Progression. Mechanic traits (20 level-up cards), trait cards in every offer, snapshot/Continue, route modifiers.
module.exports = function (H) {
  const test = H.test, eq = H.eq, STEP = 1 / 60;
  function ok(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
  function near(a, b, m, e) { if (Math.abs(a - b) > (e || 1e-6)) throw new Error((m || 'near') + ': expected ' + b + ' got ' + a); }

  function fresh(char, seed) {
    const NR = H.load(); NR.main.boot();
    NR.run.start({ charId: char || 'ranger', seed: seed || 6, danger: 0 });
    const W = NR.world.get(); W.waveT = 1e9; W.state = 'wave'; NR.director.reset(); NR.enemies.reset();
    NR.input.inject({ mx: 0, my: 0, aim: 0, fire: false, dash: false });
    const p = W.player; p.x = p.px = 1200; p.y = p.py = 800; p.hp = p.maxHp;
    return NR;
  }
  function foe(NR, x, y, hp) { const e = NR.enemies.spawn('brute', x, y, {}); e.hp = e.maxHp = hp || 1000; e.armor = 0; e.dmg = 0; e.speed = 0; return e; }
  function sync(NR) { NR.spatial.rebuild(NR.world.get()); }
  function give(NR, id, lvl) { const p = NR.world.get().player; for (let i = 0; i < lvl; i++) ok(NR.traits.grant(p, id), 'grant ' + id); return p; }
  function dash(NR, p) { NR.events.emit('player:dash', { x: p.x, y: p.y, dx: 1, dy: 0, charges: 1 }); }
  function death(NR, e, wid, elite) { NR.events.emit('enemy:death', { enemy: e, weaponId: wid || 'pistol', x: e.x, y: e.y, elite: !!elite, isBoss: false }); }
  const dealt = function (e) { return e.maxHp - e.hp; };

  test('traits: data - 20 traits with {vi,en} text, levels 1-3, resolved templates; 5 routes', function () {
    const NR = H.load(), T = NR.data.traits, ids = Object.keys(T);
    eq(ids.length, 20);
    for (const id of ids) {
      const d = T[id];
      ok(d.name.vi && d.name.en && d.synergy.vi && d.synergy.en && /^#[0-9A-F]{6}$/i.test(d.color) && d.glyph, id + ' fields'); ok(d.max >= 1 && d.max <= 3, id + ' max');
      for (let l = 1; l <= d.max; l++) for (const lang of ['vi', 'en']) { const s = NR.traits.text(id, l, lang); ok(s && !/[{}]/.test(s), id + ' text ' + lang + ' lv' + l + ': ' + s); }
    }
    ok(ids.filter(function (id) { return T[id].max >= 2; }).length >= 15, 'most traits stack');
    const R = NR.data.routes; eq(Object.keys(R).sort(), ['calm', 'elite_hunt', 'gold_rush', 'omen', 'swarm']);
    for (const id in R) ok(R[id].name.vi && R[id].name.en && R[id].desc.vi && R[id].desc.en, id + ' route text');
  });

  test('traits: stat traits - split shot, needle, far sight, light feet (levels stack, never past max)', function () {
    const NR = fresh(), p = give(NR, 'split_shot', 2); eq(p.stats.projectiles, 2); near(p.stats.damage, 1 - 0.45); ok(!NR.traits.grant(p, 'split_shot'), 'max level');
    give(NR, 'needle', 2); eq(p.stats.pierce, 1); near(p.stats.projSpeed, 1.15);
    give(NR, 'far_sight', 1); near(p.stats.range, 1.15); ok(p.stats.critChance >= 0.08 + 0.04 - 1e-9);
    const cd0 = p.stats.dashCooldown; give(NR, 'light_feet', 3); near(p.stats.dashCooldown, cd0 * 0.6, 'cooldown', 1e-6); near(p.stats.moveSpeed, 1.09);
  });

  test('traits: Ricochet adds bounces to bullets and drones', function () {
    const NR = fresh(), p = give(NR, 'ricochet', 2), W = NR.world.get(); foe(NR, 1600, 800); sync(NR);
    NR.input.inject({ mx: 0, my: 0, aim: 0, fire: true, dash: false }); NR.weapons.update(STEP);
    const b = W.projectiles.filter(function (q) { return q.team === 'player' && q.weaponId === 'pistol'; });
    ok(b.length > 0 && b.every(function (q) { return q.bounce >= 2; }), 'bounce ' + (b[0] && b[0].bounce));
  });

  test('traits: Ember Dash fire trail, Shockstep shockwave, Dash Refund (once per dash, inside the window)', function () {
    const NR = fresh(), p = give(NR, 'ember_dash', 2), W = NR.world.get();
    dash(NR, p); const fire = W.areas.filter(function (a) { return a.weaponId === 'trait:ember_dash'; }); ok(fire.length >= 3 && fire[0].element === 'fire' && fire[0].dmg > 0, 'trail ' + fire.length);
    const N2 = fresh(), p2 = give(N2, 'shockstep', 1), e = foe(N2, 1260, 800); sync(N2); dash(N2, p2); near(dealt(e), 14, 'shockwave'); ok(e.kbx > 0, 'pushed away');
    const N3 = fresh(), p3 = give(N3, 'dash_refund', 1), W3 = N3.world.get(), v = foe(N3, 1500, 800, 10); p3.dash.charges = 0; p3.dash.max = 3;
    dash(N3, p3); death(N3, v); eq(p3.dash.charges, 1, 'refund'); death(N3, v); eq(p3.dash.charges, 1, 'only once per dash');
    W3.time += 5; dash(N3, p3); W3.time += 2; death(N3, v); eq(p3.dash.charges, 1, 'too late');
  });

  test('traits: Dead Eye - standing still arms a guaranteed crit that the next volley consumes', function () {
    const NR = fresh(), p = give(NR, 'dead_eye', 1);
    eq(NR.traits.critForced(), false); for (let i = 0; i < 50; i++) NR.traits.update(STEP); eq(NR.traits.critForced(), false, 'not yet');
    for (let i = 0; i < 20; i++) NR.traits.update(STEP); eq(NR.traits.critForced(), true); eq(NR.combat.critRoll(p, 0).crit, true);
    NR.events.emit('weapon:fire', { weaponId: 'pistol', slot: 0, kind: 'projectile', x: 0, y: 0, angle: 0 }); eq(NR.traits.critForced(), false, 'consumed');
    p.vx = 200; for (let i = 0; i < 90; i++) NR.traits.update(STEP); eq(NR.traits.critForced(), false, 'moving never arms it');
  });

  test('traits: Shatter Master boosts Shatter and frozen vulnerability', function () {
    function shatterDmg(lvl) {
      const NR = fresh(), a = foe(NR, 1400, 800, 1e6), b = foe(NR, 1450, 800, 1e6); sync(NR); if (lvl) give(NR, 'shatter_master', lvl);
      a.status = { frozen: { t: 3, imm: 5 } }; a.status.freeze = a.status.frozen; NR.combat.hitEnemy(a, 100, { weaponId: 'pistol', element: 'physical' });
      return { blast: dealt(b), vuln: 0, NR: NR };
    }
    const base = shatterDmg(0), boosted = shatterDmg(3); ok(base.blast > 0 && boosted.blast > base.blast * 2.2, 'shatter ' + base.blast + ' -> ' + boosted.blast);
    const NR = fresh(), e = foe(NR, 1400, 800, 1e6); e.status = { frozen: { t: 3, imm: 5 } }; e.status.freeze = e.status.frozen; e.rxAt = 1e9;
    const d0 = NR.combat.hitEnemy(e, 100, { weaponId: 'pistol', element: 'physical' }); give(NR, 'shatter_master', 3); const d1 = NR.combat.hitEnemy(e, 100, { weaponId: 'pistol', element: 'physical' });
    near(d1 / d0, (1.25 + 0.3) / 1.25, 'frozen vulnerability', 1e-9);
  });

  test('traits: Adrenaline, Momentum and Crit Surge are live buffs that switch on and off', function () {
    const NR = fresh(), p = give(NR, 'adrenaline', 1); NR.traits.update(STEP); near(p.stats.attackSpeed, 1);
    p.hp = p.maxHp * 0.3; NR.traits.update(STEP); near(p.stats.attackSpeed, 1.3); p.hp = p.maxHp; NR.traits.update(STEP); near(p.stats.attackSpeed, 1);
    const N2 = fresh(), p2 = give(N2, 'momentum', 2); N2.traits.update(STEP); near(p2.stats.damage, 1); p2.vx = 200; N2.traits.update(STEP); near(p2.stats.damage, 1.14); p2.vx = 0; N2.traits.update(STEP); near(p2.stats.damage, 1);
    const N3 = fresh(), p3 = give(N3, 'crit_surge', 1), e = foe(N3, 1500, 800); N3.traits.update(STEP); near(p3.stats.attackSpeed, 1);
    N3.events.emit('damage:dealt', { weaponId: 'pistol', target: e, isBoss: false, amount: 10, crit: true, element: 'physical', x: 0, y: 0, killed: false, dot: false });
    N3.traits.update(STEP); near(p3.stats.attackSpeed, 1.15, 'surge'); for (let i = 0; i < 160; i++) N3.traits.update(STEP); near(p3.stats.attackSpeed, 1, 'surge ends after 2.5 s');
  });

  test('traits: Siphon heals, Bounty pays for elites, Chain Kill arcs without looping, Thorn Burst and Second Wind react to damage', function () {
    const NR = fresh(), p = give(NR, 'siphon', 2), e = foe(NR, 1500, 800); p.hp = 10; death(NR, e); near(p.hp, 11);
    const N2 = fresh(), p2 = give(N2, 'bounty', 1), g0 = p2.gold; death(N2, foe(N2, 1500, 800), 'pistol', false); eq(p2.gold, g0); death(N2, foe(N2, 1500, 800), 'pistol', true); eq(p2.gold, g0 + 12);
    const N3 = fresh(), W3 = N3.world.get(); give(N3, 'chain_kill', 2); const dying = foe(N3, 1500, 800, 50), n1 = foe(N3, 1560, 800), n2 = foe(N3, 1620, 800), far = foe(N3, 2200, 1400); sync(N3);
    let evs = 0; N3.events.on('damage:dealt', function (x) { if (x.weaponId === 'trait:chain_kill') evs++; });
    death(N3, dying); ok(dealt(n1) > 0 && dealt(n2) > 0 && dealt(far) === 0, 'arc to the nearest two'); ok(evs >= 2 && evs < 6, 'bounded ' + evs);
    n1.hp = 1; n2.hp = 1; sync(N3); const before = evs; NR.rng; N3.combat.hitEnemy(n1, 50, { weaponId: 'trait:chain_kill' }); death(N3, n1, 'trait:chain_kill'); eq(evs, before + 1, 'trait kills do not chain again'); void W3;
    const N4 = fresh(), p4 = give(N4, 'thorns', 2), near1 = foe(N4, 1260, 800); sync(N4); N4.combat.damagePlayer(5, 0, {}); near(dealt(near1), 18, 'thorn burst'); ok(near1.kbx > 0, 'knock back'); void p4;
    const N5 = fresh(), p5 = give(N5, 'second_wind', 1), W5 = N5.world.get(); p5.hp = p5.maxHp * 0.25; p5.iframes = 0; N5.events.emit('player:hurt', { amount: 1, hp: p5.hp, srcId: 0, dodged: false, revived: false, x: 0, y: 0 });
    near(p5.hp, p5.maxHp * 0.55, 'second wind'); p5.hp = p5.maxHp * 0.2; N5.events.emit('player:hurt', { amount: 1, hp: p5.hp, srcId: 0, dodged: false, revived: false, x: 0, y: 0 }); near(p5.hp, p5.maxHp * 0.2, 'once per wave');
    N5.events.emit('wave:start', { wave: 2, zone: 'scrap', isBoss: false, duration: 30 }); N5.events.emit('player:hurt', { amount: 1, hp: p5.hp, srcId: 0, dodged: false, revived: false, x: 0, y: 0 }); ok(p5.hp > p5.maxHp * 0.4, 'ready again next wave'); void W5;
  });

  test('traits: Executioner and Focus Fire change damage (own and item damage excluded)', function () {
    const NR = fresh(), e = foe(NR, 1500, 800, 1000); give(NR, 'executioner', 1);
    const full = NR.combat.hitEnemy(e, 10, { weaponId: 'pistol' }); e.hp = 200; const low = NR.combat.hitEnemy(e, 10, { weaponId: 'pistol' }); near(low / full, 1.2, 'executioner'); e.hp = 200; near(NR.combat.hitEnemy(e, 10, { weaponId: 'item:x' }), 10, 'items unaffected');
    const N2 = fresh(), a = foe(N2, 1500, 800, 1e6), b = foe(N2, 1600, 800, 1e6); give(N2, 'focus_fire', 1);
    const d = []; for (let i = 0; i < 7; i++) d.push(N2.combat.hitEnemy(a, 10, { weaponId: 'pistol' })); near(d[0], 10); near(d[1], 10.4); near(d[5], 12, 'capped at 5 stacks'); near(d[6], 12); near(N2.combat.hitEnemy(b, 10, { weaponId: 'pistol' }), 10, 'new target resets');
  });

  test('traits: every offer holds a trait card (and the card text/synergy are filled); a maxed trait is never offered', function () {
    const NR = fresh(); let sawMatch = false;
    for (let i = 0; i < 300; i++) { const c = NR.progression.rollCards(4, 0, 5), t = c.filter(function (x) { return x.kind === 'trait'; }); ok(t.length >= 1 && t.length <= 2, 'trait cards ' + t.length); t.forEach(function (x) { ok(x.level === 1 && x.isNew && NR.traits.text(x.id, x.level, 'en')); if (x.match) sawMatch = true; }); }
    ok(sawMatch, 'build matches are flagged'); const p = NR.world.get().player; for (const id of Object.keys(NR.data.traits)) while (NR.traits.grant(p, id)); eq(NR.traits.available(p), []);
    const c = NR.progression.rollCards(4, 0, 5); ok(c.every(function (x) { return x.kind !== 'trait'; }) && c.length === 4, 'no trait cards when all are maxed');
    const N2 = fresh(); NR.rng; N2.world.get().levelup.cards = [{ kind: 'trait', stat: 'trait', id: 'siphon', rarity: 'rare', add: 0, pct: 0, isNew: true, level: 1 }]; const p2 = N2.world.get().player; p2.pending = 1; N2.run.setState('levelup'); N2.progression.pick(0); eq(p2.traits.siphon, 1);
  });

  test('traits: saved with the shop snapshot, restored by Continue; older saves without traits load', function () {
    const NR = fresh('dasher', 8), p = NR.world.get().player; give(NR, 'split_shot', 2); give(NR, 'light_feet', 1); give(NR, 'siphon', 3);
    const snap = NR.run.snapshot(); eq(snap.player.traits, { split_shot: 2, light_feet: 1, siphon: 3 });
    const N2 = H.load(); N2.main.boot(); N2.run.restore(JSON.parse(JSON.stringify(snap))); const q = N2.world.get().player;
    eq(q.traits, { split_shot: 2, light_feet: 1, siphon: 3 }); eq(q.stats.projectiles, p.stats.projectiles); near(q.stats.dashCooldown, p.stats.dashCooldown);
    const old = JSON.parse(JSON.stringify(snap)); delete old.player.traits; const N3 = H.load(); N3.main.boot(); N3.run.restore(old); eq(N3.world.get().player.traits, {}); eq(N3.run.getState(), 'shop');
    const fs = require('fs'), path = require('path'), fx = JSON.parse(fs.readFileSync(path.join(H.ROOT, 'tools', 'fixtures', 'pre-revamp-save.json'), 'utf8'));
    const store = { d: { 'shardfall.save': JSON.stringify(fx) }, getItem: function (k) { return this.d[k] === undefined ? null : this.d[k]; }, setItem: function (k, v) { this.d[k] = String(v); }, removeItem: function (k) { delete this.d[k]; } };
    const N4 = H.load({ storage: store }); N4.main.boot(); ok(N4.save.getMeta() && N4.save.getSettings()); if (fx.run) { ok(N4.run.continueRun(), 'old run restores'); eq(N4.world.get().player.traits, {}); }
  });

  test('routes: after the shop (never before a boss), 2-3 options, applied to that wave only; Calm = no event, Omen = event', function () {
    const NR = fresh(), W = NR.world.get(); W.wave = 1; NR.run.setState('shop'); NR.run.leaveShop(); eq(NR.run.getState(), 'route'); ok(W.route.options.length >= 2 && W.route.options.length <= 3);
    eq(new Set(W.route.options).size, W.route.options.length); const base = NR.stats.enemyScale(2, 0);
    NR.run.chooseRoute(0); const id = W.mod; ok(NR.data.routes[id]); eq(NR.run.getState(), 'wave'); eq(W.wave, 2);
    const m = NR.data.routes[id].mods; near(W.scale.count, base.count * (m.count || 1), 'count'); near(W.scale.gold, base.gold * (m.gold || 1), 'gold'); near(W.scale.hp, base.hp * (m.hp || 1), 'hp'); near(W.scale.elite, base.elite + (m.elite || 0), 'elite');
    W.wave = 4; NR.run.setState('shop'); NR.run.leaveShop(); eq(NR.run.getState(), 'wave', 'wave 5 is a boss: no route'); eq(W.mod, '');
    // Calm / Omen toggle the event roll
    const N2 = fresh(), W2 = N2.world.get(); W2.pendingMod = 'omen'; W2.wave = 2; N2.run.setState('shop'); W2.pendingMod = 'omen'; W2.state = 'shop'; N2.run.leaveShop(); N2.run.chooseRoute(0);
    for (let s = 0; s < 30; s++) { W2.pendingMod = 'omen'; N2.run.setState('wave'); N2.run.setState('shop'); }
    let forced = 0, calm = 0;
    for (let s = 0; s < 40; s++) { W2.mod = 'omen'; N2.waveEvents.start(3); if (N2.waveEvents.pending()) forced++; W2.mod = 'calm'; N2.waveEvents.start(3); if (N2.waveEvents.pending()) calm++; }
    eq(forced, 40, 'omen always rolls an event'); eq(calm, 0, 'calm never does');
    N2.run.setState('route'); ok(N2.run.chooseRoute(7) === false, 'bad index ignored');
  });

  test('routes: the screen answers keys 1-3, the HUD banner names the route; bots pick traits and routes and finish', function () {
    const NR = H.load({ fx: true, ui: true }); NR.main.boot(); NR.run.start({ charId: 'ranger', seed: 2 }); NR.ui.screens.guard.ms = 0;
    const W = NR.world.get(); W.player.gold = 0; NR.run.setState('clear'); NR.run.setState('shop'); NR.run.leaveShop(); eq(NR.ui.screens.current(), 'route');
    const cards = []; (function walk(n) { if (n.hasClass && n.hasClass('route')) cards.push(n); (n.children || []).forEach(walk); })(NR.__dom.root); ok(cards.length >= 2, 'route cards drawn');
    NR.ui.hud.draw(NR.__dom.ctx, W, 0); eq(NR.__dom.ctx.banned, []);
    let traits = 0, routes = 0;
    for (const seed of [1, 2, 3]) { const N = H.load(); N.main.boot(); N.events.on('state:change', function (e) { if (e.to === 'route') routes++; }); const s = N.bot.play({ seconds: 700, seed: seed, char: ['ranger', 'tinker', 'bulwark'][seed - 1], danger: 1 }); ok(s.state === 'end' || s.result === 'timeout'); traits += Object.keys(N.world.get().player.traits || {}).length; }
    ok(traits >= 3 && routes >= 3, 'bots took traits ' + traits + ' and routes ' + routes);
    const a = H.runSim({ seconds: 200, seed: 12, char: 'dasher', danger: 0 }), b = H.runSim({ seconds: 200, seed: 12, char: 'dasher', danger: 0 }); eq(a.hash, b.hash);
  });

  test('traits: HUD draws trait badges and the shop/pause screens list them (vi and en) without banned calls', function () {
    const NR = H.load({ fx: true, ui: true }); NR.main.boot(); NR.run.start({ charId: 'ranger', seed: 4 });
    const W = NR.world.get(), p = W.player, ctx = NR.__dom.ctx; W.state = 'wave'; for (const id of Object.keys(NR.data.traits)) NR.traits.grant(p, id);
    for (const lang of ['vi', 'en']) { NR.i18n.setLang(lang); NR.ui.hud.update(0.016); NR.ui.hud.draw(ctx, W, 0.5); NR.ui.screens.show('shop'); NR.ui.screens.show('pause'); }
    for (const id of Object.keys(NR.data.traits)) { NR.ui.hud.drawTrait(ctx, id, 30, 30, 20, NR.data.traits[id].color, {}); NR.ui.hud.drawTrait(ctx, id, 30, 30, 20, '#fff', { sil: true }); }
    eq(ctx.banned, []);
  });
};
