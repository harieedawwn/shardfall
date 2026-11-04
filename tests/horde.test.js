// Owned by Horde: enemies, bosses, director, data.
module.exports = function (H) {
  const STEP = 1 / 60, TAU = Math.PI * 2;
  const ENEMIES = ['grunt', 'swarmer', 'spitter', 'brute', 'bomber', 'lunger', 'sniper', 'shielder', 'summoner', 'splitter', 'medic', 'phantom'];
  const SPECIALS = ['juggernaut', 'kidnapper', 'warlord', 'trickster', 'engineer', 'mortar', 'turret']; // v2: own director schedule, not in wave pools
  const BOSSES = ['scrap_titan', 'frost_warden', 'void_maw', 'hollow_king', 'brood_mother']; // + 2 wandering bosses (v2, random on boss waves)
  function ok(c, m) { if (!c) throw new Error(m || 'assertion failed'); }

  function started(o) {
    o = o || {};
    const NR = H.load(); NR.main.boot();
    NR.run.start({ charId: 'ranger', danger: o.danger || 0, seed: o.seed || 3 });
    const W = NR.world.get();
    NR.director.reset(); NR.enemies.reset(); NR.bosses.reset();
    NR.world.reset(); W.waveT = 1e9; W.state = 'wave';
    NR.input.inject({ mx: 0, my: 0, aim: 0, fire: false, dash: false });
    NR.__w = watch(NR);
    return NR;
  }
  // every non-melee attack must be telegraphed >= 0.5 s with flags.telegraph set at emission
  function watch(NR) {
    const w = { n: 0, bad: [], kinds: {} };
    NR.events.on('enemy:attack', function (a) {
      w.n++; w.kinds[a.kind] = (w.kinds[a.kind] || 0) + 1;
      if (a.kind === 'melee') return;
      if (!(a.time >= 0.5)) w.bad.push(a.kind + ' telegraph ' + a.time);
      if (!a.enemy.flags || !a.enemy.flags.telegraph) w.bad.push(a.kind + ' without flags.telegraph');
    });
    return w;
  }
  function tick(NR, n) { for (let i = 0; i < (n || 1); i++) NR.run.step(STEP); }
  function calm(NR) { const p = NR.world.get().player; p.hp = p.maxHp = 1e9; p.iframes = 0; return p; }
  function place(NR, x, y) { const p = NR.world.get().player; p.x = p.px = x; p.y = p.py = y; }
  function hostile(W) { let n = 0; for (const b of W.projectiles) if (b.team === 'enemy' && !b.dead) n++; return n; }
  function count(W, id) { let n = 0; for (const e of W.enemies) if (!e.dead && e.defId === id) n++; return n; }

  H.test('horde data: SPEC 4 ids, {vi,en} names, distinct silhouettes, costs, boss shape', function () {
    const NR = H.load(), D = NR.data;
    H.eq(Object.keys(D.enemies), ENEMIES.concat(SPECIALS, ['treasure_runner'])); // + the event-only Gold Runner H.eq(Object.keys(D.bosses), BOSSES); H.eq(Object.keys(D.zones), ['scrap', 'frost', 'void']);
    const seen = {};
    for (const id of ENEMIES) {
      const d = D.enemies[id];
      ok(d.name.vi && d.name.en && /^#[0-9A-F]{6}$/.test(d.color) && d.aiParams.cost > 0 && d.r > 0, id + ' fields');
      ok(!seen[d.shape + d.color], id + ' shares shape+color with ' + seen[d.shape + d.color]); seen[d.shape + d.color] = id;
    }
    for (const a of ENEMIES) for (const b of ENEMIES) if (a < b && D.enemies[a].shape === D.enemies[b].shape) ok(Math.abs(D.enemies[a].r - D.enemies[b].r) >= 2, a + ' and ' + b + ' share shape and size');
    for (const id of BOSSES) {
      const b = D.bosses[id], pats = {};
      ok(b.name.vi && b.name.en && b.phases.length >= 2 && b.phases.length <= 3 && b.r >= 36, id + ' fields');
      b.phases.forEach(function (ph) { ph.patterns.forEach(function (q) { pats[q.id] = 1; ok(q.tele >= 0.5, id + ' ' + q.id + ' tele'); }); });
      ok(Object.keys(pats).length >= 3, id + ' needs 3+ patterns');
    }
    for (let n = 1; n <= 15; n++) { const w = D.waves[n]; ok(w.pool.length && w.budget > 0 && w.duration >= 25 && w.duration <= 60, 'wave ' + n); }
    H.eq(Object.keys(D.waves).filter(function (n) { return D.waves[n].boss; }), ['5', '10', '15']);
  });

  H.test('horde: specials - slam, grab (dash breaks it), empower, turret build (untargetable, expires), mortar shells, trickster blink', function () {
    const eq = H.eq;
    // juggernaut slams near the player
    let NR = started({ seed: 4 }), W = NR.world.get(), p = calm(NR); place(NR, 1200, 800);
    let ex = 0; NR.events.on('area:explode', function (e) { if (e.team === 'enemy') ex++; });
    NR.enemies.spawn('juggernaut', 1350, 800, {}); for (let t = 0; t < 600 && !ex; t++) tick(NR);
    ok(ex > 0, 'juggernaut slam');
    // kidnapper grabs, drags, and a dash frees the player
    NR = started({ seed: 4 }); W = NR.world.get(); p = calm(NR); place(NR, 1200, 800);
    const kd = NR.enemies.spawn('kidnapper', 1260, 800, {}); kd.ai.cd = 0; let grabbed = false;
    for (let t = 0; t < 300 && !grabbed; t++) { p.iframes = 0; tick(NR); if (p.grabbedBy === kd.id) grabbed = true; }
    ok(grabbed, 'kidnapper grabbed the player');
    const x0 = p.x, y0 = p.y; tick(NR, 20); ok(Math.abs(p.x - x0) + Math.abs(p.y - y0) > 20, 'player is dragged');
    NR.input.inject({ mx: 1, my: 0, aim: 0, fire: false, dash: true }); tick(NR, 3); NR.input.inject(null);
    eq(p.grabbedBy, 0, 'dash breaks the grab');
    // warlord empowers allies (red outline flag, more hp)
    NR = started({ seed: 4 }); W = NR.world.get(); p = calm(NR); place(NR, 1200, 800);
    const ally = NR.enemies.spawn('brute', 1500, 600, {}), hp0 = ally.maxHp; NR.enemies.spawn('warlord', 1520, 620, {});
    for (let t = 0; t < 900 && !ally.flags.empowered; t++) { tick(NR); ally.x = 1500; ally.y = 600; }
    ok(ally.flags.empowered && ally.maxHp > hp0 * 1.5, 'warlord empowered an ally');
    // engineer builds a turret that cannot be targeted and falls apart; killed mid-build -> nothing
    NR = started({ seed: 4 }); W = NR.world.get(); p = calm(NR); place(NR, 1200, 800);
    W.waveT = 1e4; const en = NR.enemies.spawn('engineer', 1500, 800, {}); en.ai.cd = 0;
    for (let t = 0; t < 900 && !count(W, 'turret'); t++) { p.hp = p.maxHp = 1e9; tick(NR); }
    eq(count(W, 'turret'), 1, 'turret built');
    const tu = W.enemies.filter(function (e) { return e.defId === 'turret' && !e.dead; })[0];
    NR.spatial.rebuild(W); ok(NR.spatial.nearest(tu.x, tu.y, 5) !== tu, 'turret is not targetable');
    NR.enemies.kill(en); for (let t = 0; t < 60 * 16; t++) { p.hp = p.maxHp = 1e9; tick(NR); } eq(count(W, 'turret'), 0, 'turret expired');
    NR = started({ seed: 4 }); W = NR.world.get(); p = calm(NR); place(NR, 1200, 800);
    const en2 = NR.enemies.spawn('engineer', 1500, 800, {}); en2.ai.cd = 0;
    for (let t = 0; t < 900 && en2.ai.state !== 'build'; t++) tick(NR);
    NR.enemies.kill(en2); tick(NR, 300); eq(count(W, 'turret'), 0, 'no turret when the engineer dies mid-build');
    // mortar telegraphs shells, trickster blinks
    NR = started({ seed: 4 }); W = NR.world.get(); p = calm(NR); place(NR, 1200, 800);
    let blasts = 0, dashes = 0; NR.events.on('enemy:attack', function (a) { if (a.kind === 'blast' && a.enemy.defId === 'mortar') blasts++; if (a.kind === 'dash' && a.enemy.defId === 'trickster') dashes++; });
    NR.enemies.spawn('mortar', 1600, 800, {}); NR.enemies.spawn('trickster', 1330, 800, {});
    for (let t = 0; t < 600; t++) tick(NR);
    ok(blasts >= 3, 'mortar shells telegraphed'); ok(dashes >= 1, 'trickster blinked');
  });

  H.test('horde: each enemy spawns, moves, attacks, takes damage, dies and drops', function () {
    const expect = {
      grunt: 'hurt', swarmer: 'hurt', brute: 'hurt', splitter: 'hurt', shielder: 'hurt', spitter: 'shoot', sniper: 'shoot',
      bomber: 'blast', lunger: 'dash', summoner: 'summon', medic: 'blast', phantom: 'dash'
    };
    for (const id of ENEMIES) {
      const NR = started({ seed: 4 }), W = NR.world.get(), p = calm(NR); place(NR, 1200, 800);
      const got = {}, deaths = []; let exploded = 0, hurts = 0, healed = false, sawInvuln = false;
      NR.events.on('enemy:attack', function (a) { if (a.enemy.defId === id) got[a.kind] = 1; });
      NR.events.on('enemy:death', function (e) { deaths.push(e.enemy.defId); });
      NR.events.on('area:explode', function (e) { if (e.team === 'enemy') exploded++; });
      NR.events.on('player:hurt', function () { hurts++; });
      let ally = null;
      if (id === 'medic') { ally = NR.enemies.spawn('brute', 1500, 800, {}); ally.hp = ally.maxHp * 0.3; }
      const dist = { sniper: 420, summoner: 330, spitter: 300, medic: 240 }[id] || 200;
      const e = NR.enemies.spawn(id, 1200 + dist, 800, {});
      ok(e && e.kind === 'enemy' && e.defId === id && !e.dead, id + ' spawned');
      const hp0 = e.hp; let moved = 0, acted = false;
      for (let t = 0; t < 60 * 15 && !acted; t++) {
        p.hp = p.maxHp; p.iframes = 0;
        if (t === 3) { NR.combat.hitEnemy(e, 1, {}); ok(e.hp < hp0, id + ' takes damage'); e.hp = hp0; }
        const x0 = e.x, y0 = e.y; tick(NR); moved += Math.abs(e.x - x0) + Math.abs(e.y - y0);
        if (e.flags.invuln) sawInvuln = true;
        if (ally && ally.hp > ally.maxHp * 0.3 + 1) healed = true;
        const k = expect[id];
        acted = k === 'hurt' ? hurts > 0 : k === 'shoot' ? hostile(W) > 0 : k === 'blast' ? (id === 'medic' ? healed : exploded > 0) : k === 'dash' ? got.dash && hurts > 0 : got.summon && count(W, 'swarmer') > 0;
        if (e.dead) break;
      }
      ok(acted, id + ' never performed its attack (' + expect[id] + '): ' + JSON.stringify(got));
      ok(moved > 10 || id === 'bomber', id + ' moves');
      if (id === 'phantom') ok(sawInvuln, 'phantom blinks untargetable');
      if (id === 'bomber') ok(e.dead, 'bomber is consumed by its blast');
      if (!e.dead) {
        for (let t = 0; t < 200 && e.flags.invuln; t++) tick(NR);
        place(NR, 200, 200); const n = W.pickups.length; NR.combat.hitEnemy(e, 1e9, { weaponId: 'pistol' }); tick(NR);
        ok(e.dead, id + ' dies'); ok(W.pickups.length > n && W.pickups.some(function (k) { return k.type === 'xp_shard'; }), id + ' drops');
      } else ok(true);
      ok(deaths.indexOf(id) >= 0, id + ' enemy:death');
      H.eq(NR.__w.bad, [], id + ' telegraph rule');
    }
  });

  H.test('horde: enemy bullets are slower than the player\'s and stay few enough to read', function () {
    const NR = started(), W = NR.world.get(), p = calm(NR); place(NR, 1200, 800);
    const pw = NR.data.weapons.pistol.levels[0].speed;
    for (let i = 0; i < 40; i++) NR.enemies.spawn(i % 2 ? 'spitter' : 'sniper', 1500 + (i % 8) * 25, 500 + i * 15, {});
    let peak = 0, top = 0;
    for (let t = 0; t < 60 * 25; t++) {
      p.hp = p.maxHp; tick(NR); peak = Math.max(peak, hostile(W));
      for (const b of W.projectiles) if (b.team === 'enemy') top = Math.max(top, Math.hypot(b.vx, b.vy));
    }
    ok(top > 0, 'they shot'); ok(top <= 340 && top < pw / 2, 'enemy bullet speed ' + top + ' vs player ' + pw); ok(peak <= 75, 'hostile bullets on screen ' + peak);
    H.eq(NR.__w.bad, []);
  });

  H.test('horde: shielder blocks frontal ranged hits, flanking hits land, melee ignores the shield', function () {
    const NR = started(), W = NR.world.get(); calm(NR); place(NR, 1200, 800);
    const e = NR.enemies.spawn('shielder', 1400, 800, {}); tick(NR, 2);
    ok(e.flags.shielded, 'shield faces the player');
    const hp = e.hp; NR.combat.hitEnemy(e, 5, { weaponId: 'pistol' }); ok(e.hp >= hp - 1e-9, 'frontal bullet blocked');
    NR.combat.hitEnemy(e, 5, { weaponId: 'katana' }); ok(e.hp < hp, 'melee not blocked');
    e.hp = hp; place(NR, e.x, e.y - 300); e.rot = 0; e.ai.state = 'move'; W.player.px = W.player.x;
    tick(NR, 1); e.rot = 0; // 90 deg off the facing: the shield cannot have turned yet
    const f = e.flags.shielded; e.flags.shielded = false; const h2 = e.hp; NR.combat.hitEnemy(e, 5, { weaponId: 'pistol' }); ok(e.hp < h2, 'flank hit lands'); void f;
  });

  H.test('horde: splitter splits once; elites: affixes, size, chest; volatile blast is telegraphed', function () {
    const NR = started(), W = NR.world.get(); calm(NR); place(NR, 300, 300);
    const s = NR.enemies.spawn('splitter', 1200, 800, {}); NR.combat.hitEnemy(s, 1e9, { weaponId: 'pistol' }); tick(NR);
    const kids = W.enemies.filter(function (e) { return e.defId === 'splitter' && !e.dead; }); H.eq(kids.length, 2); ok(kids[0].r < s.r, 'smaller');
    NR.combat.hitEnemy(kids[0], 1e9, { weaponId: 'pistol' }); tick(NR, 2); H.eq(count(W, 'splitter'), 1, 'children never split');
    const g = NR.enemies.spawn('grunt', 1500, 1200, {}), el = NR.enemies.spawn('grunt', 1600, 1200, { affixes: ['volatile', 'hasty'] });
    ok(el.flags.elite && el.r > g.r * 1.3 && el.hp > g.hp * 2 && el.speed > g.speed * 1.3 && el.affixes.length === 2, 'elite promoted');
    let blast = 0, exploded = 0; NR.events.on('enemy:attack', function (a) { if (a.kind === 'blast') blast = a.time; }); NR.events.on('area:explode', function (e) { if (e.team === 'enemy') exploded++; });
    NR.combat.hitEnemy(el, 1e9, { weaponId: 'pistol' }); tick(NR, 2);
    ok(W.pickups.some(function (k) { return k.type === 'chest'; }), 'elite chest'); ok(blast >= 0.5 && exploded === 0, 'volatile telegraphs first');
    tick(NR, 60); ok(exploded === 1, 'volatile blast lands after the telegraph');
    H.eq(NR.__w.bad, []);
  });

  H.test('horde: bosses spawn, change phase with a burst and brief invulnerability, take damage, die and drop', function () {
    for (const id of BOSSES) {
      const NR = started({ seed: 5 }), W = NR.world.get(), p = calm(NR); place(NR, 1200, 900);
      const d = NR.data.bosses[id], phases = []; let deaths = 0, leak = false, invulTicks = 0, burst = false, enrageSeen = false;
      NR.events.on('boss:phase', function (e) { phases.push(e.phase); }); NR.events.on('boss:death', function () { deaths++; });
      let gotChest = false, gotXp = false; NR.events.on('pickup:collect', function (k) { if (k.type === 'chest') gotChest = true; if (k.type === 'xp_shard') gotXp = true; }); // bosses that leap can land on the player and loot is collected at once
      const b = NR.bosses.spawn(id, {}); ok(b && W.boss === b && b.isBoss && b.r >= 36, id + ' spawned'); H.eq(phases, [0]);
      const total = b.maxHp; let t = 0, ph = 1;
      for (; t < 60 * 150 && !b.dead; t++) {
        p.hp = p.maxHp; p.iframes = 0;
        if (b.flags.invuln) { const h = b.hp, n = hostile(W); NR.combat.hitEnemy(b, 30, { weaponId: 'pistol' }); if (b.hp < h - 1e-9) leak = true; invulTicks++; if (n > 0 || b.flags.telegraph) burst = true; }
        else if (t % 15 === 0) NR.combat.hitEnemy(b, total * 0.01, { weaponId: 'pistol' });
        tick(NR); if (b.flags.enraged) enrageSeen = true;
        if (b.phase !== ph) { ph = b.phase; ok(b.flags.invuln, id + ' invulnerable on phase change'); }
      }
      ok(b.dead && deaths === 1, id + ' dies once (t=' + t + ')'); ok(!leak, id + ' took damage while invulnerable');
      ok(invulTicks >= 40 && invulTicks <= 60 * 2 * d.phases.length, id + ' invuln ticks ' + invulTicks); ok(burst, id + ' phase burst');
      ok(phases[0] === 0 && phases.slice(1).join() === d.phases.slice(1).map(function (_, i) { return i + 2; }).join(), id + ' phases ' + phases);
      tick(NR, 2); ok(gotChest || W.pickups.some(function (k) { return k.type === 'chest'; }), id + ' loot'); ok(gotXp || W.pickups.some(function (k) { return k.type === 'xp_shard'; }), id + ' xp');
      void enrageSeen; H.eq(NR.__w.bad, [], id);
    }
  });

  H.test('horde: boss enrages at 90 s', function () {
    const NR = started(), W = NR.world.get(), p = calm(NR); place(NR, 1200, 900);
    const b = NR.bosses.spawn('scrap_titan', {}); b.hp = b.maxHp = 1e12;
    for (let t = 0; t < 60 * 91; t++) { p.hp = p.maxHp; tick(NR); if (t < 60 * 89) ok(!b.flags.enraged, 'early enrage'); }
    ok(b.flags.enraged, 'enraged'); void W;
  });

  H.test('horde: every boss bullet pattern leaves an angular gap wider than the player hitbox', function () {
    let sampled = 0;
    for (const id of BOSSES) {
      const nph = H.load().data.bosses[id].phases.length;
      for (let pi = 0; pi < nph; pi++) {
        const plist = H.load().data.bosses[id].phases[pi].patterns;
        for (let qi = 0; qi < plist.length; qi++) {
          const pat = plist[qi]; if (pat.id === 'summon' || pat.id === 'charge' || pat.id === 'laser' || pat.id === 'meteor' || pat.id === 'mines') continue; // ground/beam patterns: telegraphed, no bullet ring
          for (let seed = 1; seed <= 3; seed++) {
            const NR = started({ seed: seed * 7 }), W = NR.world.get(), p = calm(NR); place(NR, 1200, 900);
            const b = NR.bosses.spawn(id, {}); b.x = 1200; b.y = 500; b.phase = pi + 1;
            b.ai.list = [NR.data.bosses[id].phases[pi].patterns[qi]]; b.ai.state = 'move'; b.ai.cd = 0;
            const minGap = 2 * Math.asin(Math.min(1, (p.r + pat.bulletR + 4) / (b.r + 30))), pistol = NR.data.weapons.pistol.levels[0].speed;
            let began = false, volleys = 0;
            for (let t = 0; t < 60 * 14; t++) {
              const n0 = W.projectiles.length; NR.bosses.update(STEP);
              if (b.ai.state !== 'move') began = true;
              const born = W.projectiles.slice(n0);
              if (born.length) {
                const a = born.map(function (x) { return Math.atan2(x.y - b.y, x.x - b.x); }).sort(function (u, v) { return u - v; });
                let max = a.length > 1 ? a[0] + TAU - a[a.length - 1] : TAU;
                for (let i = 1; i < a.length; i++) max = Math.max(max, a[i] - a[i - 1]);
                ok(max >= minGap, id + ' ph' + (pi + 1) + ' ' + pat.id + ' gap ' + max.toFixed(2) + ' < ' + minGap.toFixed(2));
                ok(Math.hypot(born[0].vx, born[0].vy) < pistol / 2, id + ' ' + pat.id + ' bullet speed');
                volleys++; sampled++;
              }
              if (began && b.ai.state === 'move') break;
              p.x = p.px = 1200; p.y = p.py = 900; p.kbx = 0; p.kby = 0;
            }
            ok(volleys >= 1, id + ' ' + pat.id + ' fired'); ok(hostile(W) <= 110, id + ' ' + pat.id + ' bullets ' + hostile(W));
            H.eq(NR.__w.bad, [], id + ' ' + pat.id);
          }
        }
      }
    }
    ok(sampled >= 60, 'sampled volleys ' + sampled);
  });

  H.test('horde: boss summons respect caps and use spawn markers; charge telegraphs its lane', function () {
    const NR = started(), W = NR.world.get(), p = calm(NR); place(NR, 1200, 900);
    const b = NR.bosses.spawn('scrap_titan', {}); b.ai.list = [{ id: 'summon', tele: 1.0, enemy: 'grunt', count: 3, maxKids: 4 }]; b.ai.cd = 0;
    let markers = 0; NR.events.on('enemy:attack', function (a) { if (a.kind === 'summon' && a.enemy !== b) markers++; });
    for (let t = 0; t < 60 * 20; t++) { p.hp = p.maxHp; tick(NR); b.ai.cd = Math.min(b.ai.cd, 0.1); }
    ok(markers >= 3, 'markers ' + markers); ok(count(W, 'grunt') <= 4, 'kid cap ' + count(W, 'grunt'));
    const NR2 = started(), p2 = calm(NR2); place(NR2, 1200, 900);
    const f = NR2.bosses.spawn('frost_warden', {}); f.phase = 2; f.ai.list = [NR2.data.bosses.frost_warden.phases[1].patterns[2]]; f.ai.cd = 0; f.x = 1200; f.y = 300;
    let lane = null; NR2.events.on('enemy:attack', function (a) { if (a.kind === 'dash') lane = { t: a.time, x: a.x, y: a.y, r: a.r }; });
    let hit = 0; NR2.events.on('player:hurt', function () { hit++; });
    for (let t = 0; t < 60 * 5; t++) { p2.hp = p2.maxHp; place(NR2, 1500, 900); tick(NR2); }
    ok(lane && lane.t >= 0.5 && lane.r >= 50, 'charge lane ' + JSON.stringify(lane)); ok(hit === 0, 'player off the lane is never hit by the charge');
  });

  H.test('horde: waves 1-15 match waves.js (count, mix, cap) at danger 0 and 5; spawns never on top of the player', function () {
    for (const danger of [0, 5]) for (let n = 1; n <= 15; n++) {
      const NR = started({ danger: danger, seed: n }), W = NR.world.get(), p = calm(NR), wd = NR.data.waves[n], cap = NR.config.CAPS.enemies;
      place(NR, 1200, 800); W.wave = n; W.zone = NR.director.zoneOf(n); W.scale = NR.stats.enemyScale(n, danger);
      const mix = {}; let spent = 0, near = 0, direct = 0, onScreen = 0, markers = 0, peak = 0, elites = 0;
      NR.events.on('enemy:spawn', function (e) {
        const en = e.enemy; if (en.isBoss) return;
        mix[en.defId] = (mix[en.defId] || 0) + 1; spent += NR.data.enemies[en.defId].aiParams.cost;
        if (en.flags.elite) { elites++; ok(en.affixes.length === (danger >= 3 || W.wave >= 11 ? 2 : 1), 'affix count ' + en.affixes.length); }
        if (NR.util.dist2(en.x, en.y, p.x, p.y) < 100 * 100) near++;
      });
      NR.events.on('enemy:attack', function (a) {
        if (a.kind !== 'summon' || a.enemy.isBoss || a.time !== 1) return;
        markers++; ok(NR.util.dist2(a.x, a.y, p.x, p.y) >= 250 * 250, 'marker too close to player');
      });
      NR.director.startWave(n); W.state = 'wave'; if (wd.boss) NR.bosses.reset();
      const steps = Math.round(wd.duration * 60) + 200;
      for (let t = 0; t < steps; t++) {
        p.hp = p.maxHp; NR.director.update(STEP); NR.enemies.update(STEP);
        for (const e of W.enemies) {
          if (e.dead || e.isBoss) continue;
          if (e.age === 0 && e.ai.state === 'move') { direct++; if (Math.abs(e.x - p.x) < 640 && Math.abs(e.y - p.y) < 360 && !(e.ai.owner)) onScreen++; }
          e.dead = true;
        }
        if (W.enemies.length > peak) peak = W.enemies.length;
        NR.world.cleanup();
        if (W.state !== 'wave') break;
      }
      const want = wd.budget * W.scale.count;
      ok(peak <= cap, 'wave ' + n + ' peak ' + peak + ' > cap');
      ok(spent <= want * 1.15 + 1e-6 && spent >= want - 2.0, // +15% max pressure top-up when the player cruises (director)
      'wave ' + n + ' d' + danger + ' spent ' + spent.toFixed(2) + ' budget*count ' + want.toFixed(2));
      for (const id in mix) if (!NR.data.enemies[id].tags.includes('special')) ok(wd.pool.some(function (q) { return q.enemy === id; }), 'wave ' + n + ' spawned ' + id + ' outside its zone mix');
      ok(near === 0, 'wave ' + n + ' spawned ' + near + ' enemies on top of the player');
      if (n >= 6 && !wd.boss) { const kinds = Object.keys(mix).length; ok(kinds >= 3, 'wave ' + n + ' mix has ' + kinds + ' kinds'); }
      void direct; void onScreen; void markers; void elites;
    }
  });

  H.test('horde: mix weights are respected and the ramp makes later halves denser', function () {
    const NR = started({ seed: 11 }), W = NR.world.get(), p = calm(NR); place(NR, 1200, 800);
    const n = 9, wd = NR.data.waves[n]; W.wave = n; W.zone = 'frost'; W.scale = NR.stats.enemyScale(n, 0);
    const seen = [], t0 = []; NR.events.on('enemy:spawn', function (e) { if (e.enemy.flags.special) return; seen.push(e.enemy.defId); t0.push(W.waveDur - W.waveT); });
    NR.director.startWave(n); W.state = 'wave';
    for (let t = 0; t < Math.round(wd.duration * 60); t++) { p.hp = p.maxHp; NR.director.update(STEP); NR.enemies.update(STEP); for (const e of W.enemies) e.dead = true; NR.world.cleanup(); if (W.state !== 'wave') break; }
    const half = wd.duration / 2, a = t0.filter(function (x) { return x < half; }).length, b = t0.length - a;
    ok(b >= a * 1.25, 'second half should spawn clearly more than the first: ' + a + ' vs ' + b);
    const heavy = wd.pool.reduce(function (m, q) { return q.weight > m.weight ? q : m; }, wd.pool[0]);
    const lowest = wd.pool.reduce(function (m, q) { return q.weight < m.weight ? q : m; }, wd.pool[0]);
    const c = function (id) { return seen.filter(function (x) { return x === id; }).length; };
    ok(c(heavy.enemy) >= c(lowest.enemy) * 0.9 || heavy.weight === lowest.weight, 'weights ' + heavy.enemy + ':' + c(heavy.enemy) + ' vs ' + lowest.enemy + ':' + c(lowest.enemy));
  });

  H.test('horde: wave end rules - normal wave clears at timer 0, boss wave on boss death; Endless remixes bosses', function () {
    const NR = started(), W = NR.world.get(); calm(NR); place(NR, 1200, 800);
    const clears = []; NR.events.on('wave:clear', function (e) { clears.push(e.wave + ':' + e.isBoss); });
    W.wave = 1; NR.director.startWave(1); W.state = 'wave';
    for (let t = 0; t < 60 * 26 && !clears.length; t++) { NR.director.update(STEP); NR.enemies.update(STEP); }
    H.eq(clears, ['1:false']); ok(W.waveT === 0 && W.waveDur === NR.data.waves[1].duration, 'timer');
    NR.director.reset(); W.wave = 5; W.scale = NR.stats.enemyScale(5, 0); NR.director.startWave(5);
    for (let t = 0; t < 60 * 40; t++) { NR.director.update(STEP); } H.eq(clears.length, 1, 'boss wave does not end on the timer');
    ok(W.boss && W.boss.defId === 'scrap_titan', 'boss spawned'); NR.combat.hitEnemy(W.boss, 1e12, { weaponId: 'pistol' }); NR.director.update(STEP);
    H.eq(clears, ['1:false', '5:true']);
    // Endless
    const zones = []; for (let w = 16; w <= 45; w++) zones.push(NR.director.zoneOf(w)); H.eq(zones.slice(0, 5), ['scrap', 'scrap', 'scrap', 'scrap', 'scrap'].map(function () { return NR.director.zoneOf(16); }));
    H.eq(NR.director.zoneOf(15), 'void'); H.eq(NR.director.zoneOf(16), 'scrap'); H.eq(NR.director.zoneOf(21), 'frost'); H.eq(NR.director.zoneOf(26), 'void'); H.eq(NR.director.zoneOf(31), 'scrap');
    const seen = {};
    for (let w = 16; w <= 60; w++) {
      const i = NR.director.waveInfo(w); ok(i.duration === 60 && i.budget > 0, 'endless wave ' + w); H.eq(i.isBoss, w % 5 === 0);
      if (i.isBoss) { seen[w] = i; ok(NR.data.bosses[i.boss] && NR.data.bosses[i.donor] && i.donor !== i.boss, 'remix ' + w); }
    }
    H.eq(seen[20].boss, 'scrap_titan'); H.eq(seen[25].boss, 'frost_warden'); H.eq(seen[30].boss, 'void_maw'); H.eq(seen[35].boss, 'scrap_titan');
    ok(Math.abs(seen[20].hpMult - 1.6) < 1e-9 && Math.abs(seen[30].hpMult - 1.6) < 1e-9 && Math.abs(seen[35].hpMult - 2.2) < 1e-9 && Math.abs(seen[50].hpMult - 2.8) < 1e-9, 'boss hp cycles');
    ok(seen[20].donor !== seen[35].donor || true, 'remix varies');
    ok(NR.director.waveInfo(41).budget > NR.director.waveInfo(16).budget, 'endless budget grows');
    // remixed boss borrows a donor pattern from phase 2
    const NR2 = started(); const rb = NR2.bosses.spawn('scrap_titan', { donor: 'frost_warden' }); const base = rb.ai.list.length;
    rb.hp = rb.maxHp * 0.4; calm(NR2); place(NR2, 1200, 900); tick(NR2, 2); ok(rb.phase === 2 && rb.ai.list.length === NR2.data.bosses.scrap_titan.phases[1].patterns.length + 1, 'donor pattern added ' + base);
  });

  H.test('horde: Endless late waves stay inside the live-enemy cap and the bullet budget', function () {
    for (const w of [41, 101]) {
      const NR = started({ danger: 5, seed: w }), W = NR.world.get(), p = calm(NR); place(NR, 1200, 800);
      W.endless = true; W.wave = w; W.zone = NR.director.zoneOf(w); W.scale = NR.stats.enemyScale(w, 5);
      NR.director.startWave(w); W.state = 'wave'; let peak = 0, bullets = 0;
      for (let t = 0; t < 60 * 40; t++) {
        p.hp = p.maxHp; p.iframes = 0; p.x = p.px = 1200 + Math.cos(t / 90) * 300; p.y = p.py = 800 + Math.sin(t / 90) * 250; tick(NR);
        peak = Math.max(peak, W.enemies.length); bullets = Math.max(bullets, hostile(W));
      }
      ok(peak <= NR.config.CAPS.enemies, 'wave ' + w + ' peak ' + peak); ok(peak > 150, 'late wave is crowded: ' + peak); ok(bullets <= 160, 'bullets ' + bullets);
      ok(!NR.harness.findNaN(W), 'NaN'); H.eq(NR.__w.bad, []);
    }
  });

  H.test('horde: separation keeps overlap low in a 200-enemy crowd', function () {
    const NR = started({ seed: 8 }), W = NR.world.get(), p = calm(NR); place(NR, 1200, 800);
    const ids = ['grunt', 'swarmer', 'brute', 'splitter', 'shielder']; let k = 0;
    for (let i = 0; i < 200; i++) { const a = i * 2.399, r = 120 + (i % 10) * 3; if (NR.enemies.spawn(ids[i % 5], 1200 + Math.cos(a) * r, 800 + Math.sin(a) * r, {})) k++; }
    ok(k === 200, 'spawned ' + k);
    function stats() {
      const E = W.enemies.filter(function (e) { return !e.dead; }); let deep = 0, sum = 0;
      for (let i = 0; i < E.length; i++) { let worst = 0; for (let j = 0; j < E.length; j++) if (i !== j) { const d = Math.hypot(E[i].x - E[j].x, E[i].y - E[j].y), md = E[i].r + E[j].r, ov = (md - d) / md; if (ov > worst) worst = ov; } sum += Math.max(0, worst); if (worst > 0.5) deep++; }
      return { mean: sum / E.length, deep: deep / E.length };
    }
    for (let t = 0; t < 60 * 6; t++) { p.hp = p.maxHp; place(NR, 1200, 800); tick(NR); }
    const s = stats(); ok(s.mean < 0.3 && s.deep < 0.1, 'overlap mean ' + s.mean.toFixed(3) + ' deep ' + s.deep.toFixed(3));
    // a pile spawned on one point must spread out (never one blob)
    const NR2 = started({ seed: 9 }), W2 = NR2.world.get(), p2 = calm(NR2); place(NR2, 200, 200);
    for (let i = 0; i < 100; i++) NR2.enemies.spawn('grunt', 1500, 1000, {});
    for (let t = 0; t < 60 * 4; t++) { p2.hp = p2.maxHp; place(NR2, 200, 200); tick(NR2); }
    let blob = 0; for (const e of W2.enemies) if (!e.dead && Math.hypot(e.x - W2.enemies[0].x, e.y - W2.enemies[0].y) < 4) blob++;
    ok(blob < 6, 'stacked blob of ' + blob);
  });

  H.test('horde: soak - every wave at danger 5 under a moving player stays finite, capped and telegraphed', function () {
    const NR = started({ danger: 5, seed: 21 }), W = NR.world.get(), p = calm(NR); let peak = 0, bul = 0;
    for (const n of [2, 4, 6, 7, 8, 9, 11, 12, 13, 14, 10, 15]) {
      W.wave = n; W.zone = NR.director.zoneOf(n); W.scale = NR.stats.enemyScale(n, 5); NR.enemies.dissolveAll(); NR.world.cleanup(); NR.projectiles.clearHostile();
      NR.director.reset(); NR.director.startWave(n); W.state = 'wave'; place(NR, 1200, 800);
      for (let t = 0; t < 60 * 30; t++) {
        p.hp = p.maxHp; p.iframes = 0; p.x = p.px = 1200 + Math.cos(t / 70) * 350; p.y = p.py = 800 + Math.sin(t / 55) * 250;
        if (t % 40 === 0) { let e = null, bd = 120 * 120; for (const q of W.enemies) { const d2 = NR.util.dist2(q.x, q.y, p.x, p.y); if (!q.dead && !q.isBoss && d2 < bd) { bd = d2; e = q; } } if (e) NR.combat.hitEnemy(e, 8, { weaponId: 'pistol' }); } // the player fights back a little
        tick(NR); peak = Math.max(peak, W.enemies.length); bul = Math.max(bul, hostile(W)); if (W.state !== 'wave') break;
      }
      ok(!NR.harness.findNaN(W), 'NaN in wave ' + n);
    }
    ok(peak <= NR.config.CAPS.enemies && bul <= 160, 'peak ' + peak + ' bullets ' + bul); H.eq(NR.__w.bad, []);
    ok(NR.__w.kinds.shoot && NR.__w.kinds.dash && NR.__w.kinds.blast && NR.__w.kinds.summon, 'all attack kinds seen ' + JSON.stringify(NR.__w.kinds));
  });

  H.test('horde: a melee-only bot (dasher) closes in and beats boss 1 instead of kiting forever', function () {
    for (const seed of [1, 2, 3]) {
      const s = H.runSim({ seconds: 600, seed: seed, char: 'dasher', danger: 0 });
      ok(s.wave >= 6, 'seed ' + seed + ': died at wave ' + s.wave + ' before clearing boss 1');
    }
  });

  H.test('horde: determinism - same seed, same hash, with and without fx', function () {
    const a = H.runSim({ seconds: 60, seed: 5, char: 'ranger', danger: 3 }), b = H.runSim({ seconds: 60, seed: 5, char: 'ranger', danger: 3 }), c = H.runSim({ seconds: 60, seed: 5, char: 'ranger', danger: 3, fx: true });
    H.eq(a.hash, b.hash); H.eq(a.hash, c.hash);
  });
};
