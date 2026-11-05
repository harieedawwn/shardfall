'use strict';
// Owner: Progression. Items, characters, level-up cards, shop, pickups, meta, save round-trips; prints price and rarity tables.
module.exports = function (H) {
  const test = H.test, eq = H.eq;
  function ok(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
  function near(a, b, m, eps) { if (Math.abs(a - b) > (eps || 1e-6)) throw new Error((m || 'near') + ': expected ' + b + ' got ' + a); }
  const EPS = 1e-6;

  function memStorage() {
    return { d: {}, getItem: function (k) { return Object.prototype.hasOwnProperty.call(this.d, k) ? this.d[k] : null; }, setItem: function (k, v) { this.d[k] = String(v); }, removeItem: function (k) { delete this.d[k]; } };
  }
  function boot(opts) {
    const NR = H.load(opts); NR.main.boot();
    return NR;
  }
  function fresh(charId, seed, danger, opts) {
    const NR = boot(opts);
    NR.run.start({ charId: charId || 'ranger', seed: seed || 5, danger: danger || 0 });
    return NR;
  }
  function W(NR) { return NR.world.get(); }
  function foe(NR, x, y, hp, id) {
    const e = NR.enemies.spawn(id || 'brute', x, y, {});
    e.hp = e.maxHp = hp || 100; e.armor = 0; e.dmg = 0;
    return e;
  }
  function sync(NR) { NR.spatial.rebuild(W(NR)); }
  function give(NR, id, n) { const p = W(NR).player; for (let i = 0; i < n; i++) ok(NR.items.grant(p, id, 'test'), 'grant ' + id + ' #' + (i + 1)); return p; }
  function chancy(NR, v) { const seen = []; NR.rng.chance = function (c) { seen.push(c); return v; }; return seen; }
  function killEv(NR, e, extra) {
    const o = { enemy: e, weaponId: 'pistol', x: e.x, y: e.y, elite: false, isBoss: false };
    for (const k in extra || {}) o[k] = extra[k];
    NR.events.emit('enemy:death', o);
  }
  function hitEv(NR, e, amount, extra) {
    const o = { weaponId: 'pistol', target: e, isBoss: false, amount: amount, crit: false, element: 'physical', x: e.x, y: e.y, killed: false };
    for (const k in extra || {}) o[k] = extra[k];
    NR.events.emit('damage:dealt', o);
  }
  function dashEv(NR) { const p = W(NR).player; NR.events.emit('player:dash', { x: p.x, y: p.y, dx: 1, dy: 0, charges: p.dash.charges }); }
  function hurtEv(NR, extra) {
    const p = W(NR).player, o = { amount: 5, hp: p.hp, srcId: 9, dodged: false, revived: false, x: p.x, y: p.y };
    for (const k in extra || {}) o[k] = extra[k];
    NR.events.emit('player:hurt', o);
  }
  function has(seen, v, m) { ok(seen.some(function (c) { return Math.abs(c - v) < 1e-9; }), (m || 'chance') + ' ' + v + ' in [' + seen + ']'); }
  function clearP(NR) { W(NR).pickups.forEach(function (k) { k.dead = true; }); NR.world.cleanup(); }
  function tick(NR, secs) { for (let t = 0; t < secs; t += 1 / 60) NR.items.update(1 / 60); }
  function maxOf(id) { return H.cur.data.items[id].maxStack; }
  const dealt = function (e) { return e.maxHp - e.hp; };

  // ---------------- registry ----------------
  test('progression: registry - 36 items, 4 rarities, ~1/3 stat trade-offs, 23 catalysts matching the 23 evolutions, {vi,en} text', function () {
    const NR = boot(), I = NR.data.items, ids = Object.keys(I);
    eq(ids.length, 36);
    const by = { common: 0, rare: 0, epic: 0, legendary: 0 };
    let trade = 0, hooked = 0, cats = 0;
    ids.forEach(function (id) {
      const d = I[id];
      ok(by[d.rarity] !== undefined, id + ' rarity'); by[d.rarity]++;
      ok(d.name.vi && d.name.en && d.desc.vi && d.desc.en, id + ' text in vi and en');
      ok(!/[{}]/.test(d.desc.vi + d.desc.en), id + ' unresolved template token');
      ok(d.cost > 0 && d.maxStack >= 1, id + ' cost/stack');
      if (d.hooks.length) hooked++; else { trade++; const sg = function (m) { return ((m.add || 0) + (m.pct || 0)) * (m.stat === 'dashCooldown' ? -1 : 1); };
        ok(d.mods.some(function (m) { return sg(m) > 0; }) && d.mods.some(function (m) { return sg(m) < 0; }), id + ' trade-off needs a plus and a minus'); }
      if (d.catalyst) { cats++; ok(d.hooks.length > 0 || d.mods.length > 0, id + ' catalyst has real stats or a behaviour'); }
    });
    ok(by.common > 0 && by.rare > 0 && by.epic > 0 && by.legendary > 0, JSON.stringify(by));
    ok(trade >= 8 && trade <= 12, 'trade-offs ' + trade + ' of 36'); eq(trade + hooked, 36);
    eq(cats, 23); eq(NR.data.evolutions.length, 23);
    eq(new Set(NR.data.evolutions.map(function (e) { return e.catalyst; })).size, 23, 'every evolution has its own catalyst');
    eq(new Set(NR.data.evolutions.map(function (e) { return e.weapon; })).size, 23, 'one evolution per base weapon');
    NR.data.evolutions.forEach(function (e) { ok(I[e.catalyst] && I[e.catalyst].catalyst, 'evolution catalyst ' + e.catalyst + ' is a catalyst item'); });
    const kinds = {}; ids.forEach(function (id) { I[id].hooks.forEach(function (h) { kinds[h.on] = 1; }); });
    ['kill', 'hit', 'dash', 'hurt', 'wave', 'shot'].forEach(function (k) { ok(kinds[k], 'a hook on ' + k); });
  });
  test('progression: descriptions are generated from the values (every number in the text comes from the data)', function () {
    const NR = boot(), I = NR.data.items, U = NR.data.itemUtil;
    for (const id in I) {
      const d = I[id];
      d.mods.forEach(function (m) {
        const v = Math.abs(m.pct || m.add), isPct = !!m.pct || ['dodge', 'critChance', 'luck', 'shopDiscount', 'critDamage'].indexOf(m.stat) >= 0;
        const s = isPct ? String(Math.round(v * 10000) / 100) + '%' : String(Math.round(v * 100) / 100);
        ok(d.desc.en.indexOf(s) >= 0 && d.desc.vi.indexOf(s) >= 0, id + ' mod ' + m.stat + ' shows ' + s + ' in both languages: ' + d.desc.en);
      });
      d.hooks.forEach(function (h) {
        for (const k in h.p) if (typeof h.p[k] === 'number' && (d.tpl.en.indexOf('{' + k) >= 0)) {
          const s = String(Math.round(U.val(h.p[k], 1) * 100) / 100);
          ok(d.desc.en.indexOf(s) >= 0 || d.desc.en.indexOf(String(Math.round(h.p[k] * 10000) / 100) + '%') >= 0, id + ' hook value ' + k + '=' + h.p[k]);
        }
      });
    }
    // changing a value changes the text (no hard-coded copies)
    const t = U.render('x {a%} y {a} z {b+}', { a: 0.25, b: [2, -1, 1] });
    eq(t, 'x 25% y 0.25 z 1');
  });

  // ---------------- every hook fires and stacks per its rule ----------------
  const SC = {}; // item id -> function (NR, n) running the hook and asserting; n = stack count
  const HP = [100, 130, 160]; // helper table indexes by n-1
  SC.vampire_fang = function (NR, n) {
    const p = give(NR, 'vampire_fang', n), seen = chancy(NR, true), e = foe(NR, 500, 500);
    p.hp = 10; killEv(NR, e);
    near(p.hp - 10, [2, 3, 4][n - 1], 'heal'); has(seen, [0.08, 0.12, 0.16][n - 1]);
    seen.length = 0; chancy(NR, false); p.hp = 10; killEv(NR, e); eq(p.hp, 10, 'no heal when the chance fails');
  };
  SC.ember_charm = function (NR, n) {
    const p = give(NR, 'ember_charm', n), seen = chancy(NR, true), a = foe(NR, 500, 500), b = foe(NR, 540, 500); sync(NR);
    hitEv(NR, a, 20);
    near(dealt(b), 10, 'burst = 50% of the hit'); ok(a.status.burn, 'ignites the target'); has(seen, [0.1, 0.15, 0.2][n - 1]);
    const c = foe(NR, 900, 900); sync(NR); hitEv(NR, c, 20, { weaponId: 'item:ember_charm' }); eq(dealt(c), 0, 'own damage never re-triggers');
  };
  SC.frost_charm = function (NR, n) {
    const p = give(NR, 'frost_charm', n), a = foe(NR, p.x + 50, p.y), b = foe(NR, p.x + 125, p.y, 100, 'swarmer'); sync(NR);
    dashEv(NR);
    near(dealt(a), [18, 28, 38][n - 1], 'nova damage'); ok(a.status.freeze, 'freezes');
    eq(dealt(b) > 0, n >= 2, 'radius grows per stack (110/135/160)');
  };
  SC.static_charm = function (NR, n) {
    const p = give(NR, 'static_charm', n), a = foe(NR, p.x + 200, p.y, 5000), cd = [1.6, 1.35, 1.1][n - 1], dmg = [26, 36, 46][n - 1]; sync(NR);
    const shot = function () { NR.events.emit('weapon:fire', { weaponId: 'pistol', slot: 0, kind: 'projectile', x: p.x, y: p.y, angle: 0 }); };
    shot(); near(dealt(a), dmg, 'first shot zaps at once');
    for (let i = 0; i < 60; i++) shot(); near(dealt(a), dmg, 'a flood of shots (many hands, fast fire) inside the cooldown adds nothing');
    p.vx = 100; // moving: no Steady Aim buff
    NR.items.update(cd - 0.05); shot(); near(dealt(a), dmg, 'still cooling down');
    NR.items.update(0.1); shot(); near(dealt(a), 2 * dmg, 'zaps again once ' + cd + 's passed');
  };
  SC.venom_vial = function (NR, n) {
    const p = give(NR, 'venom_vial', n), seen = chancy(NR, true), e = foe(NR, 700, 600);
    killEv(NR, e);
    const A = W(NR).areas; eq(A.length, 1); eq(A[0].element, 'poison'); eq(A[0].weaponId, 'item:venom_vial'); has(seen, [0.15, 0.22, 0.29][n - 1]);
  };
  SC.void_shard = function (NR, n) {
    const p = give(NR, 'void_shard', n), seen = chancy(NR, true), a = foe(NR, p.x + 60, p.y); sync(NR);
    hurtEv(NR); near(dealt(a), [45, 60, 75][n - 1], 'burst damage'); if (n < 3) has(seen, [0.5, 0.75][n - 1]);
    const b = foe(NR, p.x + 60, p.y + 5); sync(NR); hurtEv(NR, { dodged: true }); eq(dealt(b), 0, 'a dodge is not a hurt');
  };
  SC.bounty_badge = function (NR, n) {
    const p = give(NR, 'bounty_badge', n); chancy(NR, true);
    const g0 = p.gold, e = foe(NR, 800, 500);
    killEv(NR, e); eq(p.gold, g0, 'plain kills pay nothing'); eq(W(NR).pickups.filter(function (k) { return k.type === 'chest'; }).length, 0);
    killEv(NR, e, { elite: true }); near(p.gold - g0, [8, 14, 20][n - 1], 'elite bounty');
    ok(W(NR).pickups.some(function (k) { return k.type === 'chest'; }), 'chest chance rolled');
  };
  SC.cat_overclock = function (NR, n) {
    const p = give(NR, 'cat_overclock', n), base = 1 + 0.1 * n;
    near(p.stats.attackSpeed, base, 'stat part');
    dashEv(NR); near(p.stats.attackSpeed, base + [0.2, 0.3, 0.4][n - 1], 'dash buff'); dashEv(NR); near(p.stats.attackSpeed, base + [0.2, 0.3, 0.4][n - 1], 'buff refreshes, never stacks');
    tick(NR, 2.6); near(p.stats.attackSpeed, base, 'buff expires');
  };
  SC.cat_hollow_slug = function (NR, n) {
    const p = give(NR, 'cat_hollow_slug', n), full = foe(NR, 500, 500), half = foe(NR, 900, 900); half.hp = 50;
    hitEv(NR, full, 10); near(dealt(full), [4, 6, 8][n - 1], 'opening bonus'); hitEv(NR, half, 10); near(dealt(half), 50, 'no bonus below 90% (only its own 50 missing)');
  };
  SC.cat_fuel_tank = function (NR, n) {
    const p = give(NR, 'cat_fuel_tank', n), seen = chancy(NR, true), dying = foe(NR, 500, 500), b = foe(NR, 540, 500); sync(NR);
    killEv(NR, dying, { weaponId: 'pistol' }); eq(dealt(b), 0, 'only fire kills explode');
    killEv(NR, dying, { weaponId: 'ember_gun' }); near(dealt(b), 30, '30% of max HP'); has(seen, [0.35, 0.5, 0.65][n - 1]);
  };
  SC.phoenix_feather = function (NR, n) {
    const p = give(NR, 'phoenix_feather', n); eq(p.revives, 1); const a = foe(NR, p.x + 100, p.y); sync(NR);
    hurtEv(NR); eq(dealt(a), 0, 'a plain hit does not trigger it');
    p.hp = 1; p.iframes = 0; NR.player.hurt(50, 7);
    eq(p.revives, 0); near(dealt(a), 200, 'revive blast'); near(p.stats.damage, 1.25, 'damage buff');
  };
  SC.ghost_cloak = function (NR, n) {
    const p = give(NR, 'ghost_cloak', n); near(p.stats.dodge, 0.08, 'dodge stat'); p.dash.charges = 0;
    hurtEv(NR, { dodged: true }); eq(p.dash.charges, 1); hurtEv(NR, { dodged: true }); eq(p.dash.charges, 2); hurtEv(NR, { dodged: true }); eq(p.dash.charges, p.dash.max, 'capped at max');
  };
  SC.blast_core = function (NR, n) {
    const p = give(NR, 'blast_core', n), b = foe(NR, 540, 500, 1000), d = foe(NR, 500, 500); sync(NR);
    for (let i = 0; i < 9; i++) killEv(NR, d); eq(dealt(b), 0, 'nothing before the 10th kill'); killEv(NR, d); near(dealt(b), 45, '10th kill explodes');
    for (let i = 0; i < 10; i++) killEv(NR, d); near(dealt(b), 90, 'and again 10 kills later');
  };
  SC.cat_whetstone = function (NR, n) {
    const p = give(NR, 'cat_whetstone', n), a = foe(NR, 500, 500), b = foe(NR, 530, 500); sync(NR);
    near(p.stats.critDamage, 1.7, 'stat'); hitEv(NR, a, 20); eq(dealt(b), 0); hitEv(NR, a, 20, { crit: true }); near(dealt(b), 10, 'crit burst = 50%');
  };
  SC.cat_swarm_core = function (NR, n) {
    const p = give(NR, 'cat_swarm_core', n), e = foe(NR, 500, 500); eq(p.stats.projectiles, 1);
    for (let i = 0; i < 5; i++) killEv(NR, e); near(p.stats.attackSpeed, 1.05, 'ramps 1% per kill');
    for (let i = 0; i < 40; i++) killEv(NR, e); near(p.stats.attackSpeed, 1.2, 'capped at 20%');
    NR.events.emit('wave:clear', { wave: 1, isBoss: false }); near(p.stats.attackSpeed, 1, 'resets when the wave ends');
    killEv(NR, e); near(p.stats.attackSpeed, 1.01, 'and restarts');
  };
  SC.cat_tesla_gem = function (NR, n) {
    const p = give(NR, 'cat_tesla_gem', n), seen = chancy(NR, true), a = foe(NR, 500, 500), b = foe(NR, 540, 500); sync(NR);
    near(p.stats.statusPower, 1.2, 'stat'); hitEv(NR, a, 20, { element: 'fire' }); eq(dealt(b), 0, 'only shock arcs');
    hitEv(NR, a, 20, { element: 'shock' }); ok(dealt(b) > 0, 'arc hits a neighbour'); has(seen, 0.25);
  };
  SC.cat_detonator = function (NR, n) {
    const p = give(NR, 'cat_detonator', n), seen = chancy(NR, true), dying = foe(NR, 500, 500), b = foe(NR, 540, 500, 1000); sync(NR);
    near(p.stats.area, 1 + 0.12 * n, 'stat'); killEv(NR, dying); near(dealt(b), [16, 23, 30][n - 1], 'detonation damage'); has(seen, [0.2, 0.3, 0.4][n - 1]);
  };
  SC.cat_spore_sac = function (NR, n) {
    const p = give(NR, 'cat_spore_sac', n), seen = chancy(NR, true), a = foe(NR, 700, 600);
    near(p.stats.hpRegen, 0.4 * n, 'stat'); hitEv(NR, a, 20);
    const A = W(NR).areas; eq(A.length, 1); eq(A[0].element, 'poison'); eq(A[0].weaponId, 'item:cat_spore_sac'); has(seen, [0.06, 0.09, 0.12][n - 1]);
  };
  SC.cat_cold_snap = function (NR, n) {
    const p = give(NR, 'cat_cold_snap', n), amt = [0.15, 0.22, 0.29][n - 1];
    near(p.stats.critChance, 0.08 + 0.04 * n, 'stat'); near(p.stats.moveSpeed, 1);
    NR.events.emit('wave:start', { wave: 2, zone: 'scrap', isBoss: false, duration: 30 }); near(p.stats.moveSpeed, 1 + amt, 'wave start buff');
    tick(NR, 8.2); near(p.stats.moveSpeed, 1, 'buff expires');
  };
  SC.cat_capacitor = function (NR, n) {
    const p = give(NR, 'cat_capacitor', n), a = foe(NR, p.x + 50, p.y), b = foe(NR, p.x - 130, p.y, 100, 'swarmer'); sync(NR); // b is on the far side: out of reach of the stun's own arcs
    near(p.stats.critDamage, 1.5 + 0.15 * n, 'stat'); dashEv(NR);
    near(dealt(a), [16, 25, 34][n - 1], 'pulse damage'); ok(a.status.stun && a.status.stun.t > 0, 'stuns'); eq(dealt(b) > 0, n >= 3, 'radius grows per stack (100/120/140)');
  };
  SC.cat_rime_core = function (NR, n) {
    const p = give(NR, 'cat_rime_core', n), a = foe(NR, p.x + 100, p.y); sync(NR);
    near(p.stats.statusPower, 1.15, 'stat'); hurtEv(NR); near(dealt(a), 26, 'wave damage'); ok(a.status.freeze, 'freezes');
  };
  SC.cat_storm_rod = function (NR, n) {
    const p = give(NR, 'cat_storm_rod', n), b = foe(NR, 540, 500, 1000), d = foe(NR, 500, 500); sync(NR);
    near(p.stats.area, 1.15, 'stat'); for (let i = 0; i < 6; i++) killEv(NR, d); eq(dealt(b), 0, 'nothing before the 7th kill'); killEv(NR, d); near(dealt(b), 40, '7th kill bursts');
  };
  SC.glass_cannon = function (NR, n) { const p = give(NR, 'glass_cannon', n); near(p.stats.damage, 1.6); eq(p.maxHp, 70); };
  SC.time_dial = function (NR, n) {
    const p = give(NR, 'time_dial', n), seen = chancy(NR, true); p.dash.charges = 0;
    dashEv(NR); eq(p.dash.charges, 1, 'free dash'); has(seen, 0.35);
    chancy(NR, false); p.dash.charges = 0; dashEv(NR); eq(p.dash.charges, 0);
    NR.events.emit('wave:start', { wave: 2, zone: 'scrap', isBoss: false, duration: 30 }); eq(p.dash.charges, p.dash.max, 'refills each wave');
  };
  SC.golden_skull = function (NR, n) {
    const p = give(NR, 'golden_skull', n); near(p.stats.goldGain, 1.3); near(p.stats.luck, 0.2);
    const bonus = 5 + 2 * W(NR).wave; // the run adds its own clear payout
    p.gold = 100; NR.events.emit('wave:clear', { wave: 1, isBoss: false }); eq(p.gold, 110 + bonus);
    NR.run.setState('wave'); p.gold = 1000; NR.events.emit('wave:clear', { wave: 1, isBoss: false }); eq(p.gold, 1025 + bonus, 'interest capped at 25');
  };
  SC.echo_stone = function (NR, n) {
    const p = give(NR, 'echo_stone', n), seen = chancy(NR, true), a = foe(NR, 500, 500);
    hitEv(NR, a, 20, { weaponId: 'item:echo_stone' }); tick(NR, 0.5); eq(dealt(a), 0, 'echoes do not echo');
    hitEv(NR, a, 20); eq(dealt(a), 0, 'delayed'); tick(NR, 0.2); eq(dealt(a), 0); tick(NR, 0.2); near(dealt(a), 12, 'repeats at 60% after 0.3 s'); has(seen, 0.2);
  };

  test('progression: every behaviour item has a scenario, each hook fires, and the stack rule holds (1..max stacks)', function () {
    const probe = boot(), I = probe.data.items, fxUsed = {};
    for (const id in I) if (I[id].hooks.length) { ok(SC[id], 'scenario for ' + id); I[id].hooks.forEach(function (h) { fxUsed[h.fx] = 1; ok(probe.items.effects[h.fx], id + ' fx ' + h.fx + ' implemented'); }); }
    for (const id in SC) {
      const mx = I[id].maxStack;
      for (let n = 1; n <= Math.min(mx, 3); n++) {
        const NR = fresh('ranger', 11 + n);
        try { SC[id](NR, n); } catch (e) { throw new Error(id + ' x' + n + ': ' + e.message); }
      }
    }
  });
  test('progression: stack limits - grant refuses past maxStack, remove restores stats, trade-offs apply plus and minus', function () {
    const NR = fresh('ranger', 3), p = W(NR).player, I = NR.data.items;
    for (const id in I) {
      const d = I[id], before = {};
      d.mods.forEach(function (m) { before[m.stat] = p.stats[m.stat]; });
      let n = 0; while (NR.items.grant(p, id, 'test')) n++;
      eq(n, d.maxStack, id + ' stops at maxStack'); eq(p.items[id], d.maxStack);
      eq(NR.items.grant(p, id, 'test'), false);
      d.mods.forEach(function (m) {
        const up = (m.pct || m.add) > 0;
        if (m.stat === 'maxHp' || m.stat === 'revives') return; // derived fields checked elsewhere
        ok(up ? p.stats[m.stat] > before[m.stat] : p.stats[m.stat] < before[m.stat] || before[m.stat] === NR.stats.limits[m.stat].min, id + ' ' + m.stat + (up ? ' rises' : ' falls'));
      });
      while (NR.items.remove(p, id)) { /* sell all */ }
      ok(!p.items[id], id + ' removed');
      d.mods.forEach(function (m) { near(p.stats[m.stat], before[m.stat], id + ' ' + m.stat + ' restored', 1e-6); });
    }
  });
  test('progression: evolution - catalyst plus max-level base weapon evolves, either order', function () {
    const NR = fresh('ranger', 4), p = W(NR).player;
    let evo = 0; NR.events.on('weapon:evolve', function () { evo++; });
    give(NR, 'cat_overclock', 1);
    for (let i = 0; i < 6; i++) NR.weapons.add(p, 'pistol');
    eq(p.weapons[0].id, 'gatling_pistol'); eq(evo, 1);
    const q = fresh('ranger', 4), pp = W(q).player; for (let i = 0; i < 6; i++) q.weapons.add(pp, 'pistol'); eq(pp.weapons[0].id, 'pistol'); give(q, 'cat_overclock', 1); eq(pp.weapons[0].id, 'gatling_pistol');
  });
  test('progression: hooks run inside a busy guard (no recursion), and a full sim with many items stays finite', function () {
    const NR = fresh('ranger', 6), p = W(NR).player;
    ['ember_charm', 'blast_core', 'cat_tesla_gem', 'echo_stone', 'cat_fuel_tank', 'cat_whetstone', 'static_charm', 'venom_vial', 'void_shard', 'cat_hollow_slug'].forEach(function (id) { give(NR, id, 1); });
    for (let i = 0; i < 30; i++) foe(NR, 600 + (i % 6) * 30, 500 + Math.floor(i / 6) * 30, 40, 'grunt');
    sync(NR);
    for (let i = 0; i < 25; i++) { const e = W(NR).enemies[i]; hitEv(NR, e, 15, { element: i % 2 ? 'shock' : 'fire', crit: i % 3 === 0 }); }
    tick(NR, 1); ok(!H.findNaN(W(NR)), 'no NaN');
  });

  // ---------------- characters ----------------
  test('progression: 4 characters differ in stats, weapon, passive and unlock cost; start items are granted', function () {
    const NR = boot(), C = NR.data.characters, ids = Object.keys(C);
    eq(ids.length, 4);
    const weapons = {}, sig = {};
    ids.forEach(function (id) {
      const c = C[id];
      ok(NR.data.weapons[c.startWeapon] && !NR.data.weapons[c.startWeapon].evolved, id + ' weapon'); weapons[c.startWeapon] = 1;
      ok(c.name.vi && c.name.en && c.desc.vi && c.desc.en && c.passive.vi && c.passive.en, id + ' text'); ok(!/[{}]/.test(c.passive.vi + c.passive.en), id + ' passive tokens');
      const q = fresh(id, 8), p = W(q).player;
      sig[id] = [p.maxHp, p.stats.moveSpeed, p.stats.armor, p.dash.max, p.stats.damage, p.stats.shopDiscount].join('/');
      eq(p.weapons[0].id, c.startWeapon, id + ' starts with its weapon');
      c.startItems.forEach(function (it) { ok(p.items[it] === 1, id + ' start item ' + it); });
    });
    eq(Object.keys(weapons).length, 4, 'four different starting weapons'); eq(new Set(Object.values(sig)).size, 4, 'four different stat lines: ' + JSON.stringify(sig));
    eq(C.ranger.unlock.cost, 0); eq(C.dasher.unlock.cost, 0, 'dasher is a second starter'); const costs = ['bulwark', 'tinker'].map(function (i) { return C[i].unlock.cost; });
    ok(costs.every(function (c) { return c > 0; }) && new Set(costs).size === 2, 'unlock costs ' + costs); eq(NR.data.unlocks.chars.tinker, C.tinker.unlock.cost);
  });
  test('progression: character passives work (steady aim, blade dance, retaliate, engineer)', function () {
    let NR = fresh('ranger', 9), p = W(NR).player; p.vx = p.vy = 0;
    tick(NR, 0.2); near(p.stats.damage, 1, 'not yet'); tick(NR, 0.3); near(p.stats.damage, 1.2, 'standing still'); p.vx = 200; tick(NR, 0.5); near(p.stats.damage, 1, 'moving cancels');
    NR = fresh('dasher', 9); p = W(NR).player; dashEv(NR); near(p.stats.damage, 1.3); tick(NR, 2.6); near(p.stats.damage, 1);
    NR = fresh('bulwark', 9); p = W(NR).player; const e = foe(NR, p.x + 60, p.y); sync(NR); p.iframes = 0; NR.player.hurt(5, 1); near(dealt(e), 30, 'shockwave');
    NR = fresh('tinker', 9); p = W(NR).player; near(p.stats.statusPower, 1.3); near(p.stats.shopDiscount, 0.1); eq(p.items.cat_swarm_core, 1); near(p.stats.damage, 0.9);
  });

  // ---------------- level-up cards ----------------
  function randomLoadout(NR, r) {
    const W0 = W(NR), p = W0.player, bases = Object.keys(NR.data.weapons).filter(function (i) { return !NR.data.weapons[i].evolved; });
    p.weapons.length = 0;
    const want = Math.floor(r() * (Math.round(p.stats.weaponSlots) + 1));
    for (let i = 0; i < want; i++) {
      const id = bases[Math.floor(r() * bases.length)];
      if (p.weapons.some(function (w) { return w.id === id; })) continue;
      const lv = 1 + Math.floor(r() * NR.config.MAX_LEVEL);
      p.weapons.push({ id: id, lvl: lv, slot: p.weapons.length, cd: 0, paid: 0, dealt: 0 });
    }
    const ids = Object.keys(NR.data.items);
    for (let i = 0; i < 6; i++) { const id = ids[Math.floor(r() * ids.length)]; const k = Math.floor(r() * (NR.data.items[id].maxStack + 1)); for (let j = 0; j < k; j++) NR.items.grant(p, id, 'test'); }
    W0.wave = 1 + Math.floor(r() * 20);
    p.mods.push({ src: 'test', stat: 'luck', add: r() * 1.2, pct: 0, mult: 1 }); NR.stats.recalc(p);
  }
  function lcg(seed) { let s = seed >>> 0; return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

  test('progression: level-up cards - 4 unique, rarity-valid, weapon cards only when valid (1000 seeds)', function () {
    const NR = fresh('ranger', 1), U = NR.data.upgrades, TIER = { common: 0, rare: 1, epic: 2, legendary: 3 };
    let weaponCards = 0, fullNoWeapon = 0, traitCards = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      NR.run.start({ charId: ['ranger', 'dasher', 'bulwark', 'tinker'][seed % 4], seed: seed });
      const r = lcg(seed); randomLoadout(NR, r); const p = W(NR).player;
      const cards = NR.progression.rollCards(4, NR.stats.get(p, 'luck'), W(NR).wave);
      eq(cards.length, 4, 'seed ' + seed + ' cards');
      const st = {}, wp = {};
      cards.forEach(function (c) {
        ok(TIER[c.rarity] !== undefined, 'rarity');
        if (c.kind === 'weapon') {
          weaponCards++;
          ok(!wp[c.id], 'duplicate weapon card seed ' + seed); wp[c.id] = 1;
          ok(NR.data.weapons[c.id] && !NR.data.weapons[c.id].evolved, 'evolved weapon offered seed ' + seed);
          ok(NR.weapons.canAdd(p, c.id), 'invalid weapon card ' + c.id + ' seed ' + seed + ' (slots ' + p.weapons.length + '/' + Math.round(p.stats.weaponSlots) + ')');
          eq(c.stat, 'weapon'); ok(U.weapon, 'pseudo upgrade entry for UIs');
        } else if (c.kind === 'trait') {
          ok(NR.data.traits[c.id] && !wp['t:' + c.id], 'trait card ' + c.id); wp['t:' + c.id] = 1; ok(c.level >= 1 && c.level <= NR.data.traits[c.id].max, 'trait level'); eq(c.stat, 'trait');
        } else {
          eq(c.kind, 'stat'); ok(!st[c.stat], 'duplicate stat card seed ' + seed); st[c.stat] = 1;
          ok(U[c.stat] && !U[c.stat].nonStat, 'known stat'); ok(TIER[c.rarity] >= TIER[U[c.stat].min], c.stat + ' below its minimum rarity');
          near(c.add, U[c.stat].rarities[c.rarity].add); near(c.pct, U[c.stat].rarities[c.rarity].pct);
        }
      });
      ok(cards.some(function (c) { return c.kind === 'trait'; }), 'at least one trait card per offer, seed ' + seed); traitCards += cards.filter(function (c) { return c.kind === 'trait'; }).length;
      if (p.weapons.length >= Math.round(p.stats.weaponSlots) && p.weapons.every(function (w) { return w.lvl >= NR.config.MAX_LEVEL; })) { fullNoWeapon++; ok(!cards.some(function (c) { return c.kind === 'weapon'; }), 'weapon card with full maxed slots'); }
    }
    ok(weaponCards > 100, 'weapon cards do appear (' + weaponCards + ')'); ok(traitCards >= 1000 && traitCards < 1400, 'trait cards ' + traitCards);
    console.log('       (info) level-up weapon cards over 1000 seeds: ' + weaponCards + ', fully maxed loadouts checked: ' + fullNoWeapon);
  });
  test('progression: level-up odds - luck and wave raise rarity; picking applies stat and weapon cards; rerolls cost more each time', function () {
    const NR = fresh('ranger', 2), p = W(NR).player, share = function (luck, wave) { let hi = 0, tot = 0; for (let i = 0; i < 600; i++) NR.progression.rollCards(4, luck, wave).forEach(function (c) { tot++; if (c.rarity !== 'common') hi++; }); return hi / tot; };
    const a = share(0, 1), b = share(1, 1), c = share(0, 15); ok(b > a + 0.05 && c > a + 0.05, 'odds ' + [a, b, c].map(function (x) { return x.toFixed(2); }));
    // pick
    p.pending = 3; W(NR).levelup.rerolls = 0; NR.run.setState('levelup'); NR.progression.begin();
    const L = W(NR).levelup; L.cards = [{ kind: 'stat', stat: 'damage', rarity: 'rare', add: 0, pct: 0.128 }, { kind: 'weapon', stat: 'weapon', id: 'katana', rarity: 'common', add: 0, pct: 0, isNew: true, level: 1 }, { kind: 'stat', stat: 'maxHp', rarity: 'common', add: 10, pct: 0 }];
    NR.progression.pick(0); near(p.stats.damage, 1.128); eq(p.upgrades.length, 1); eq(p.pending, 2);
    W(NR).levelup.cards = [{ kind: 'weapon', stat: 'weapon', id: 'katana', rarity: 'common', add: 0, pct: 0, isNew: true, level: 1 }];
    NR.progression.pick(0); ok(p.weapons.some(function (w) { return w.id === 'katana'; }), 'weapon card adds the weapon'); eq(p.upgrades.length, 1, 'weapon cards are not stored as upgrades');
    p.gold = 100; W(NR).levelup.cards = [{ kind: 'stat', stat: 'maxHp', rarity: 'common', add: 10, pct: 0 }]; W(NR).levelup.rerolls = 0;
    ok(NR.progression.reroll()); eq(p.gold, 95); ok(NR.progression.reroll()); eq(p.gold, 85); eq(NR.progression.rerollPrice(), 15);
    p.gold = 0; eq(NR.progression.reroll(), false);
  });

  // ---------------- shop ----------------
  test('progression: shop offers are never invalid (full slots, maxed weapon, evolved or capped content) across 1000 seeds', function () {
    const NR = fresh('ranger', 1);
    let weaponOffers = 0, locks = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      NR.run.start({ charId: ['ranger', 'dasher', 'bulwark', 'tinker'][seed % 4], seed: seed });
      const r = lcg(seed * 7 + 1); randomLoadout(NR, r); const w = W(NR), p = w.player;
      NR.shop.open();
      let offers = w.shop.offers; eq(offers.length, 4);
      const check = function (label) {
        const seen = {};
        w.shop.offers.forEach(function (o) {
          if (o.sold) return;
          const key = o.kind + ':' + o.id; ok(!seen[key], label + ' duplicate offer ' + key + ' seed ' + seed); seen[key] = 1;
          ok(NR.shop.validOffer(p, o), label + ' invalid offer ' + key + ' seed ' + seed);
          if (o.kind === 'weapon') { weaponOffers++; const d = NR.data.weapons[o.id]; ok(!d.evolved, 'evolved weapon in shop'); ok(NR.weapons.canAdd(p, o.id), 'no slot / maxed: ' + o.id); }
          else ok(NR.items.count(p, o.id) < NR.data.items[o.id].maxStack, 'capped item offered ' + o.id);
          ok(NR.shop.price(o) >= 1 && o.price >= 1, 'price');
        });
      };
      check('open');
      p.gold = 1e6;
      if (seed % 3 === 0) { NR.shop.toggleLock(0); NR.shop.toggleLock(2); locks++; }
      const keep = w.shop.offers.map(function (o) { return o.locked ? o.kind + o.id : null; });
      eq(NR.shop.reroll(), true); check('reroll');
      w.shop.offers.forEach(function (o, i) { if (keep[i]) eq(o.kind + o.id, keep[i], 'locked offer survives a reroll'); });
      // buy everything, then the shop must not be able to hand out more than the player can take
      for (let i = 0; i < 4; i++) { const res = NR.shop.buy(i); if (!res.ok) ok(['sold'].indexOf(res.reason) < 0 || w.shop.offers[i].sold, 'buy ' + res.reason); }
      // a locked offer that became invalid is dropped on the next open
      w.wave++; NR.shop.open(); check('next shop');
    }
    ok(weaponOffers > 200, 'weapons are offered (' + weaponOffers + ')');
    console.log('       (info) shop: ' + weaponOffers + ' weapon offers checked, ' + locks + ' lock scenarios, 1000 seeds');
  });
  test('progression: shop rules - price scales with wave, discount, lock carries over, reroll cost rises, buy/sell', function () {
    const NR = fresh('ranger', 12), w = W(NR), p = w.player;
    const o = { kind: 'item', id: 'sharp_edge' }; w.wave = 1; const p1 = NR.shop.price(o); w.wave = 10; const p10 = NR.shop.price(o);
    eq(p1, 22); ok(p10 > p1 * 1.6, 'wave 10 price ' + p10); w.wave = 1;
    p.mods.push({ src: 'test', stat: 'shopDiscount', add: 0.5, pct: 0, mult: 1 }); NR.stats.recalc(p); eq(NR.shop.price(o), 11); p.mods.pop(); NR.stats.recalc(p);
    // lock carries to the next shop; rerolls reset per shop and cost more each time
    p.gold = 1000; NR.shop.open(); eq(NR.shop.rerollPrice(), 4);
    NR.shop.toggleLock(1); const kept = w.shop.offers[1].id, kind = w.shop.offers[1].kind;
    const costs = []; for (let i = 0; i < 4; i++) { costs.push(NR.shop.rerollPrice()); ok(NR.shop.reroll()); }
    ok(costs.every(function (c, i) { return i === 0 || c > costs[i - 1]; }), 'reroll costs rise ' + costs); eq(w.shop.offers[1].id, kept); eq(w.shop.offers[1].kind, kind);
    w.wave = 2; NR.shop.open(); eq(w.shop.offers[1].id, kept, 'locked offer is kept for the next wave'); eq(w.shop.rerolls, 0); eq(NR.shop.rerollPrice(), 5);
    eq(w.shop.offers[1].price, NR.shop.price(w.shop.offers[1]), 'repriced for the new wave');
    p.gold = 0; w.shop.offers[0] = { kind: 'item', id: 'thick_hide', price: 20, locked: false, sold: false }; eq(NR.shop.buy(0).reason, 'gold'); eq(NR.shop.reroll(), false);
    // weapons: buy, sell for half, never sell the last one
    p.gold = 500; p.weapons.length = 0; NR.weapons.add(p, 'pistol');
    w.shop.offers[0] = { kind: 'weapon', id: 'katana', price: 0, locked: false, sold: false }; const pr = NR.shop.price(w.shop.offers[0]); const g0 = p.gold;
    ok(NR.shop.buy(0).ok); eq(p.gold, g0 - pr); eq(p.weapons[1].paid, pr); eq(NR.shop.sellPrice('weapon', 1), Math.floor(pr / 2));
    ok(NR.shop.sell('weapon', 1)); eq(p.gold, g0 - pr + Math.floor(pr / 2)); eq(p.weapons.length, 1); eq(NR.shop.sell('weapon', 0), false, 'the last weapon cannot be sold');
    // an upgrade of a held weapon is priced by level and the slot-full case is refused
    w.shop.offers[2] = { kind: 'weapon', id: 'pistol', price: 0, locked: false, sold: false }; ok(NR.shop.price(w.shop.offers[2]) > 0);
    for (let i = 0; i < 3; i++) NR.weapons.add(p, ['ember_gun', 'scattergun', 'lancer'][i]); w.shop.offers[3] = { kind: 'weapon', id: 'flamer', price: 5, locked: false, sold: false };
    eq(NR.shop.buy(3).ok, false); eq(NR.shop.buy(3).reason, 'slots');
    // items: buy, sell back half
    w.shop.offers[0] = { kind: 'item', id: 'sharp_edge', price: 0, locked: false, sold: false }; const gg = p.gold, ip = NR.shop.price(w.shop.offers[0]);
    ok(NR.shop.buy(0).ok); ok(NR.shop.sell('item', 'sharp_edge')); eq(p.gold, gg - ip + Math.floor(ip / 2));
  });
  test('progression: shop events and rarity odds rise with wave and luck', function () {
    const NR = fresh('ranger', 13), w = W(NR), p = w.player, seen = [];
    NR.events.on('shop:change', function (e) { seen.push(e.reason + ':' + e.offers.length + ':' + e.rerollPrice); });
    p.gold = 100; NR.shop.open(); NR.shop.toggleLock(0); NR.shop.reroll(); eq(seen.map(function (s) { return s.split(':')[0]; }), ['open', 'lock', 'reroll']);
    const a = NR.shop.rarityOdds(1, 0), b = NR.shop.rarityOdds(10, 0), c = NR.shop.rarityOdds(10, 0.5), d = NR.shop.rarityOdds(15, 0);
    ok(a.rare < b.rare && b.epic < d.epic && b.legendary < c.legendary && a.legendary === 0 && d.legendary > 0, 'odds climb');
    near(a.common + a.rare + a.epic + a.legendary, 1);
    // measured
    const rate = function (wave) { w.wave = wave; let hi = 0, tot = 0; for (let i = 0; i < 400; i++) { w.shop.offers = []; NR.shop.open(); w.shop.offers.forEach(function (o) { if (o.kind !== 'item') return; tot++; if (NR.data.items[o.id].rarity !== 'common') hi++; }); } return hi / tot; };
    ok(rate(14) > rate(1) + 0.1, 'measured shop rarity rises with wave');
  });

  // ---------------- pickups ----------------
  test('progression: pickups - magnet range comes from stats, xp merges above 300 without losing value, collect effects', function () {
    const NR = fresh('ranger', 14), w = W(NR), p = w.player; p.x = 1000; p.y = 800; p.px = 1000; p.py = 800;
    const range = p.stats.pickupRange; eq(range, 70);
    const near1 = NR.pickups.spawn('gold', p.x + 60, p.y, 3), far = NR.pickups.spawn('gold', p.x + 130, p.y, 3);
    NR.pickups.update(1 / 60); ok(near1.x < p.x + 60, 'inside range is pulled'); eq(far.x, p.x + 130, 'outside range is not');
    give(NR, 'magnet_ring', 3); near(p.stats.pickupRange, 70 * 1.9, 'ring adds range'); NR.pickups.update(1 / 60); ok(far.x < p.x + 130, 'bigger range pulls the far one');
    clearP(NR);
    // merge
    const r = lcg(3); let total = 0;
    for (let i = 0; i < 380; i++) { const v = 1 + Math.floor(r() * 5); total += v; NR.pickups.spawn('xp_shard', 100 + r() * 2000, 100 + r() * 1300, v); }
    NR.pickups.update(1 / 60);
    let live = w.pickups.filter(function (k) { return !k.dead && k.type === 'xp_shard'; }), sum = 0; live.forEach(function (k) { sum += k.value; });
    ok(live.length <= 300, 'merged to ' + live.length); near(sum, total, 'xp conserved', 1e-6);
    const small = w.pickups.length; NR.pickups.update(1 / 60); eq(w.pickups.filter(function (k) { return !k.dead; }).length, live.length, 'no merging at or below 300');
    // collect: xp, gold, heart, magnet, nova bomb
    clearP(NR); p.hp = 10; p.gold = 0; const lv = p.level, cEv = [];
    NR.events.on('pickup:collect', function (e) { cEv.push(e.type); });
    NR.pickups.spawn('heart', p.x, p.y, 25); NR.pickups.spawn('gold', p.x, p.y, 7); NR.pickups.spawn('xp_shard', p.x, p.y, 1e4);
    const f = foe(NR, p.x + 300, p.y, 30); NR.pickups.spawn('nova_bomb', p.x, p.y, 0); sync(NR); NR.pickups.spawn('magnet', p.x, p.y, 0); const far2 = NR.pickups.spawn('gold', 5, 5, 1);
    NR.pickups.update(1 / 60);
    eq(p.hp, 35); eq(p.gold, 7); ok(p.level > lv, 'xp levelled up'); ok(f.hp < 30, 'nova bomb hurt the enemy'); ok(far2.magnet, 'magnet pulls everything'); eq(cEv.sort().join(), 'gold,heart,magnet,nova_bomb,xp_shard');
  });
  test('progression: drop tables - heart, magnet, nova bomb and chest rates, elite and boss drops, luck', function () {
    const NR = fresh('ranger', 15), w = W(NR), p = w.player; 
        const e = NR.enemies.spawn('grunt', 600, 600, {}), cnt = { heart: 0, magnet: 0, nova_bomb: 0, chest: 0 };
    const N = 30000;
    for (let i = 0; i < N; i++) { killEv(NR, e); w.pickups.forEach(function (k) { if (cnt[k.type] !== undefined) cnt[k.type]++; }); clearP(NR); }
    const within = function (got, exp, label) { const r = got / N; ok(Math.abs(r - exp) < Math.max(0.004, exp * 0.35), label + ' rate ' + r.toFixed(4) + ' expected ~' + exp); };
    within(cnt.heart, 0.012, 'heart'); within(cnt.magnet, 0.004, 'magnet'); within(cnt.nova_bomb, 0.003, 'nova'); within(cnt.chest, 0.0015, 'chest');
    const ce = { heart: 0, chest: 0 }; for (let i = 0; i < 3000; i++) { killEv(NR, e, { elite: true }); w.pickups.forEach(function (k) { if (ce[k.type] !== undefined) ce[k.type]++; }); clearP(NR); }
    ok(ce.heart / 3000 > 0.04 && ce.chest / 3000 > 0.03, 'elites drop more: ' + JSON.stringify(ce));
    clearP(NR); killEv(NR, e, { isBoss: true }); ok(w.pickups.some(function (k) { return k.type === 'chest'; }) && w.pickups.some(function (k) { return k.type === 'heart'; }), 'boss: chest and heart');
    clearP(NR); p.mods.push({ src: 'test', stat: 'luck', add: 4, pct: 0, mult: 1 }); NR.stats.recalc(p); let h2 = 0; for (let i = 0; i < 6000; i++) { killEv(NR, e); h2 += w.pickups.filter(function (k) { return k.type === 'heart'; }).length; clearP(NR); }
    ok(h2 / 6000 > 0.03, 'luck raises drops ' + (h2 / 6000).toFixed(3));
    // caps: never more than 3 hearts on the field
    p.mods.pop(); NR.stats.recalc(p); for (let i = 0; i < 4000; i++) killEv(NR, e, { elite: true }); ok(w.pickups.filter(function (k) { return k.type === 'heart'; }).length <= 3, 'heart cap');
  });
  test('progression: chest grants an item or a weapon level and emits the reveal (pickup:collect with kind/id); gold when nothing is left', function () {
    const NR = fresh('ranger', 16), w = W(NR), p = w.player, reveals = [], gains = [];
    NR.events.on('pickup:collect', function (e) { if (e.type === 'chest') reveals.push({ kind: e.kind, id: e.id, value: e.value }); });
    NR.events.on('item:gain', function (e) { gains.push(e.source); });
    let items = 0, weapons = 0;
    for (let i = 0; i < 60; i++) {
      const before = JSON.stringify(p.items), lv = p.weapons.map(function (x) { return x.lvl; }).join(), gi = gains.length;
      NR.pickups.spawn('chest', p.x, p.y, 0); NR.pickups.update(1 / 60);
      const r = reveals[reveals.length - 1]; ok(r, 'reveal emitted'); clearP(NR);
      if (r.kind === 'item') { items++; ok(p.items[r.id] >= 1 && JSON.stringify(p.items) !== before, 'item granted'); ok(gains[gains.length - 1] === 'chest' && gains.length === gi + 1, 'item:gain source chest'); }
      else if (r.kind === 'weapon') { weapons++; ok(p.weapons.map(function (x) { return x.lvl; }).join() !== lv || p.weapons.length > 0, 'weapon level'); ok(r.value >= 2); }
      if (r.kind === 'weapon' && p.weapons[0].lvl >= NR.config.MAX_LEVEL) NR.items.grant(p, 'sharp_edge', 'test');
    }
    ok(items > 5 && weapons > 3, 'both outcomes occur ' + items + '/' + weapons);
    // nothing left to give: every weapon maxed, every item capped
    p.weapons.forEach(function (x) { x.lvl = NR.config.MAX_LEVEL; }); for (const id in NR.data.items) while (NR.items.grant(p, id, 'test')) { /* cap */ }
    const g0 = p.gold; NR.pickups.spawn('chest', p.x, p.y, 0); NR.pickups.update(1 / 60); eq(reveals[reveals.length - 1].kind, 'gold'); ok(p.gold > g0);
  });

  // ---------------- meta ----------------
  test('progression: meta - 10 nodes with 3-5 levels, shard formula, buying, character and danger unlocks, codex', function () {
    const NR = boot({ storage: memStorage() }), N = NR.data.metaNodes, ids = Object.keys(N);
    eq(ids.length, 10); ids.forEach(function (id) { ok(N[id].max >= 3 && N[id].max <= 5, id + ' levels ' + N[id].max); eq(N[id].costs.length, N[id].max); ok(N[id].desc.vi && N[id].desc.en && N[id].name.vi && N[id].name.en); N[id].costs.forEach(function (c, i) { ok(c > 0 && (i === 0 || c > N[id].costs[i - 1]), id + ' costs rise'); }); });
    const m = NR.save.getMeta();
    eq(NR.meta.shardsFor('lose', { wave: 5, kills: 100, bossesKilled: 1 }), 3 * 5 + 4 + 20, 'shards: waves + kills + boss'); // danger 0 world
    NR.run.start({ charId: 'ranger', danger: 2, seed: 3 }); const mult = 1.6;
    eq(NR.meta.shardsFor('win', { wave: 15, kills: 500, bossesKilled: 3 }), Math.floor((45 + 20 + 60 + 60) * mult), 'danger multiplies');
    m.shards = 0; eq(NR.meta.buyNode('m_hp'), false, 'not enough shards'); m.shards = 1000;
    const c1 = NR.meta.nodeCost('m_hp'); ok(NR.meta.buyNode('m_hp')); eq(m.shards, 1000 - c1); eq(NR.meta.node('m_hp'), 1);
    while (NR.meta.buyNode('m_hp')) { /* max out */ } eq(NR.meta.node('m_hp'), N.m_hp.max); eq(NR.meta.nodeCost('m_hp'), 0); eq(NR.meta.buyNode('m_hp'), false);
    NR.meta.buyNode('m_slot'); NR.meta.buyNode('m_dash'); NR.meta.buyNode('m_revive'); NR.meta.buyNode('m_damage');
    NR.run.start({ charId: 'ranger', seed: 4 }); const p = W(NR).player;
    eq(p.maxHp, 100 + 10 * N.m_hp.max); eq(p.stats.weaponSlots, 5); eq(p.dash.max, 3); eq(p.revives, 1); near(p.stats.damage, 1.05);
    // characters
    eq(NR.meta.charUnlocked('dasher'), true, 'second starter');
    m.shards = 0; eq(NR.meta.charUnlocked('bulwark'), false); eq(NR.meta.unlockChar('bulwark'), false); m.shards = 1000;
    const ev = []; NR.events.on('meta:change', function (e) { ev.push(e.kind + ':' + e.id); });
    ok(NR.meta.unlockChar('bulwark')); ok(NR.meta.charUnlocked('bulwark')); eq(m.shards, 1000 - NR.data.unlocks.chars.bulwark); eq(NR.meta.unlockChar('bulwark'), false, 'only once'); eq(NR.meta.charUnlocked('ranger'), true);
    // danger unlock by winning, shards credited at run end, codex
    const disc = []; NR.events.on('codex:discover', function (e) { disc.push(e.kind + ':' + e.id); });
    NR.run.start({ charId: 'dasher', danger: 0, seed: 5 }); const W0 = W(NR); W0.wave = 15; W0.stats.kills = 250; const s0 = m.shards;
    NR.run.endRun('win'); eq(m.maxDanger, 1); ok(m.shards > s0 + 100, 'shards from the run'); eq(m.runs, 1); eq(m.wins, 1); eq(m.bestWave, 15); ok(ev.indexOf('danger:1') >= 0, 'danger unlock event');
    ok(NR.meta.dangerUnlocked(1) && !NR.meta.dangerUnlocked(2));
    NR.run.setState('menu'); NR.run.start({ charId: 'ranger', danger: 3, seed: 6 }); NR.run.endRun('win'); eq(m.maxDanger, 1, 'cannot skip danger levels');
    const cx = NR.save.getCodex(); ok(cx.character.dasher && cx.weapon.katana && cx.character.ranger && cx.weapon.pistol, 'codex: characters and starting weapons');
    ok(disc.indexOf('character:dasher') >= 0 && disc.filter(function (d) { return d === 'weapon:katana'; }).length === 1, 'codex:discover emitted once per entry');
    NR.items.grant(W(NR).player, 'echo_stone', 'test'); ok(NR.save.getCodex().item.echo_stone, 'items tracked');
    NR.events.emit('enemy:spawn', { enemy: { defId: 'grunt', isBoss: false } }); NR.events.emit('enemy:spawn', { enemy: { defId: 'scrap_titan', isBoss: true } }); ok(cx.enemy.grunt && cx.boss.scrap_titan, 'enemies and bosses tracked');
    NR.events.emit('weapon:evolve', { slot: 0, from: 'pistol', into: 'gatling_pistol' }); ok(cx.evolution.gatling_pistol, 'evolutions tracked');
  });
  test('progression: save round-trip - meta, codex and the run snapshot survive a reload (items, weapons, offers, rng, passives)', function () {
    const store = memStorage();
    let NR = boot({ storage: store }); const m = NR.save.getMeta();
    m.shards = 900; ['m_hp', 'm_hp', 'm_luck', 'm_slot', 'm_gold'].forEach(function (id) { ok(NR.meta.buyNode(id), id); }); ok(NR.meta.unlockChar('tinker'));
    NR.run.start({ charId: 'tinker', danger: 1, seed: 77 }); let w = W(NR), p = w.player;
    ['cat_overclock', 'echo_stone', 'rubber_boots', 'rubber_boots', 'vampire_fang'].forEach(function (id) { NR.items.grant(p, id, 'test'); });
    NR.weapons.add(p, 'katana'); p.gold = 400; p.level = 4;
    NR.events.emit('wave:clear', { wave: 1, isBoss: false }); for (let i = 0; i < 110; i++) NR.run.step(1 / 60); eq(NR.run.getState(), 'shop');
    NR.shop.toggleLock(2); const want = { items: JSON.stringify(p.items), weapons: JSON.stringify(p.weapons), offers: JSON.stringify(w.shop.offers), gold: p.gold, rng: NR.rng.getState(), maxHp: p.maxHp, stats: JSON.stringify(p.stats), slots: p.stats.weaponSlots };
    NR.run.snapshot(); NR.save.writeRun(NR.run.snapshot()); NR.save.flush();
    const NR2 = boot({ storage: store }); const m2 = NR2.save.getMeta();
    eq(JSON.stringify(m2), JSON.stringify(m), 'meta identical after reload'); eq(NR2.meta.node('m_hp'), 2); eq(NR2.meta.charUnlocked('tinker'), true); eq(JSON.stringify(NR2.save.getCodex()), JSON.stringify(NR.save.getCodex()));
    eq(NR2.run.continueRun(), true); w = W(NR2); p = w.player;
    eq(NR2.run.getState(), 'shop'); eq(JSON.stringify(p.items), want.items); eq(JSON.stringify(p.weapons), want.weapons); eq(JSON.stringify(w.shop.offers), want.offers); eq(p.gold, want.gold); eq(NR2.rng.getState(), want.rng);
    eq(p.maxHp, want.maxHp, 'meta + items + passive rebuilt'); eq(p.stats.weaponSlots, want.slots); near(p.stats.statusPower, 1.3, 'tinker passive restored'); eq(p.charId, 'tinker'); eq(w.danger, 1);
    // the restored run keeps playing: hooks are alive again and the shop works
    ok(NR2.items.active.dash.length > 0, 'item hooks rebuilt'); p.gold = 500; ok(NR2.shop.reroll()); NR2.run.leaveShop(); NR2.run.chooseRoute(0); eq(NR2.run.getState(), 'wave');
    for (let i = 0; i < 120; i++) NR2.run.step(1 / 60); ok(!H.findNaN(W(NR2)), 'steps cleanly after restore');
    // corrupt storage is survived
    store.setItem('shardfall.save', '{nope'); const NR3 = boot({ storage: store }); eq(NR3.save.getMeta().shards, 0);
  });

  // ---------------- tables ----------------
  test('progression: print price and rarity-odds tables', function () {
    const NR = fresh('ranger', 21), w = W(NR), p = w.player, pad = function (s, n) { s = String(s); while (s.length < n) s = ' ' + s; return s; };
    const waves = [1, 2, 3, 5, 8, 10, 12, 15, 20];
    const lines = ['', '       SHOP PRICES (gold) by wave - list cost x (1 + 0.08 x (wave-1)), no discount', '       wave   common(20) rare(45) epic(90) legend(140) weapon(30) up-L3(30) reroll#0 #1 #2 #3'];
    waves.forEach(function (wv) {
      w.wave = wv; w.shop.rerolls = 0; const rr = []; for (let i = 0; i < 4; i++) { w.shop.rerolls = i; rr.push(NR.shop.rerollPrice()); } w.shop.rerolls = 0;
      const b = function (cost) { return Math.round(cost * (1 + 0.08 * (wv - 1))); };
      lines.push('       ' + pad(wv, 4) + pad(b(20), 11) + pad(b(45), 9) + pad(b(90), 9) + pad(b(140), 11) + pad(b(30), 10) + pad(Math.round(b(30) * 1.25), 9) + pad(rr[0], 9) + pad(rr[1], 3) + pad(rr[2], 3) + pad(rr[3], 3));
    });
    lines.push('', '       RARITY ODDS (% of item offers: common / rare / epic / legendary), weights from NR.stats.rarityWeights x pool size', '       wave  luck 0%             luck 25%            luck 50%            luck 100%');
    [1, 3, 6, 10, 15, 20].forEach(function (wv) {
      const cols = [0, 0.25, 0.5, 1].map(function (lk) { const o = NR.shop.rarityOdds(wv, lk); return [o.common, o.rare, o.epic, o.legendary].map(function (x) { return pad((x * 100).toFixed(0), 3); }).join('/'); });
      lines.push('       ' + pad(wv, 4) + '  ' + cols.map(function (c) { return c + '          '; }).join('').replace(/\s+$/, ''));
    });
    lines.push('', '       META NODE COSTS (shards)'); const N = NR.data.metaNodes; for (const id in N) lines.push('       ' + id + ' ' + N[id].costs.join(' / ') + '  (total ' + N[id].costs.reduce(function (a, b) { return a + b; }, 0) + ')');
    lines.push('       characters: ' + Object.keys(NR.data.unlocks.chars).map(function (c) { return c + ' ' + NR.data.unlocks.chars[c]; }).join(', '));
    console.log(lines.join('\n'));
    ok(lines.length > 20);
  });
};
