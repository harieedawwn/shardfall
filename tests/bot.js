'use strict';
// Headless player. Factory: require('./bot')(NR) -> { create, play }
module.exports = function (NR) {
  function mkRnd(seed) {
    let s = (seed >>> 0) || 1;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function create(opts) {
    opts = opts || {};
    const rnd = mkRnd(((opts.seed | 0) ^ 0xB07) >>> 0);
    const st = { lastDash: -999, tick: 0, strafe: 1, prevDash: false, reach: 999, reachT: -999 };
    const intent = { mx: 0, my: 0, aim: 0, fire: false, dash: false, pause: false, device: 'kbm' };
    const A = NR.config.ARENA;

    // how far the build can hurt: melee/orbit/aura builds must close in, anything with a gun keeps the kiting game
    function reachOf(p) {
      let best = 0;
      for (let i = 0; i < p.weapons.length; i++) {
        const d = NR.data.weapons[p.weapons[i].id];
        if (!d) continue;
        const r = NR.weapons.resolve(p, i);
        let v;
        if (d.kind === 'melee') v = r.r > 0 ? r.range + r.r * 0.6 : r.range * Math.sqrt(r.area || 1);
        else if (d.kind === 'orbit') v = (r.orad || 90) * 1.25;
        else if (d.kind === 'aura') v = (r.r || 120) * 1.1;
        else if (d.kind === 'beam' && r.arc > 0) v = r.range;
        else if (d.kind === 'drone') v = 600;
        else v = r.range || 500;
        if (v > best) best = v;
      }
      return best || 600;
    }

    function think(W) {
      const p = W.player;
      st.tick++;
      if (p && !p.dead && st.tick - st.reachT >= 30) { st.reach = reachOf(p); st.reachT = st.tick; }
      if (p && !p.dead && st.reach < 300) return thinkMelee(W, p);
      intent.dash = false; intent.fire = false; intent.mx = 0; intent.my = 0;
      if (!p || p.dead) return intent;
      if (st.tick % 180 === 0) st.strafe = rnd() < 0.5 ? -1 : 1;
      let ax = 0, ay = 0, near = null, nd = Infinity, threat = false;
      const E = W.enemies;
      for (let i = 0; i < E.length; i++) {
        const e = E[i];
        if (e.dead) continue;
        const dx = p.x - e.x, dy = p.y - e.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (d < nd) { nd = d; near = e; }
        if (d < 300) { const w = (1 - d / 300) * (1 - d / 300) * (e.isBoss ? 2 : 1); ax += dx / d * w; ay += dy / d * w; }
        if (d - e.r < p.r + 34) threat = true;
      }
      const P = W.projectiles;
      for (let i = 0; i < P.length; i++) {
        const b = P[i];
        if (b.dead || b.team !== 'enemy') continue;
        const dx = p.x - b.x, dy = p.y - b.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (d < 160) { const w = (1 - d / 160) * 0.8; ax += dx / d * w; ay += dy / d * w; if (d < b.r + p.r + 36) threat = true; }
      }
      // keep away from walls
      const M = 220;
      if (p.x < M) ax += (M - p.x) / M * 1.6; else if (p.x > A.w - M) ax -= (p.x - (A.w - M)) / M * 1.6;
      if (p.y < M) ay += (M - p.y) / M * 1.6; else if (p.y > A.h - M) ay -= (p.y - (A.h - M)) / M * 1.6;
      if (near && nd < 420) { // strafe around the closest enemy
        const tx = -(p.y - near.y) / nd * st.strafe, ty = (p.x - near.x) / nd * st.strafe;
        ax += tx * 0.55; ay += ty * 0.55;
      } else {
        let pk = null, pd = 520 * 520;
        for (let i = 0; i < W.pickups.length; i++) {
          const k = W.pickups[i], dx = k.x - p.x, dy = k.y - p.y, d2 = dx * dx + dy * dy;
          if (!k.dead && d2 < pd) { pd = d2; pk = k; }
        }
        if (pk) { const d = Math.sqrt(pd) || 1; ax += (pk.x - p.x) / d * 0.7; ay += (pk.y - p.y) / d * 0.7; }
        else if (near) { ax -= (p.x - near.x) / nd * 0.5; ay -= (p.y - near.y) / nd * 0.5; }
      }
      const m = Math.sqrt(ax * ax + ay * ay);
      if (m > 1) { ax /= m; ay /= m; }
      intent.mx = ax; intent.my = ay;
      if (near) { intent.aim = Math.atan2(near.y - p.y, near.x - p.x); intent.fire = nd < 800; }
      else intent.aim = Math.atan2(ay, ax);
      if (threat && p.dash.charges > 0 && p.iframes <= 0 && !st.prevDash && st.tick - st.lastDash > 20 && m > 0.1) {
        intent.dash = true; st.lastDash = st.tick;
      }
      st.prevDash = intent.dash;
      return intent;
    }

    // melee mode: walk into the nearest enemy (bosses included), strafe around it, dodge bullets, dash through danger
    function thinkMelee(W, p) {
      intent.dash = false; intent.fire = false; intent.mx = 0; intent.my = 0;
      if (st.tick % 120 === 0) st.strafe = rnd() < 0.5 ? -1 : 1;
      const want = st.reach * 0.55;
      let ax = 0, ay = 0, near = null, nd = Infinity, bulletThreat = false, contact = false;
      const E = W.enemies;
      for (let i = 0; i < E.length; i++) {
        const e = E[i];
        if (e.dead) continue;
        const dx = p.x - e.x, dy = p.y - e.y, d = Math.sqrt(dx * dx + dy * dy) || 1, edge = d - e.r;
        if (edge < nd) { nd = edge; near = e; }
        if (edge < 40) { const w = (1 - edge / 40) * 0.6; ax += dx / d * w; ay += dy / d * w; }
        if (edge < p.r + 18) contact = true;
      }
      const P = W.projectiles;
      for (let i = 0; i < P.length; i++) {
        const b = P[i];
        if (b.dead || b.team !== 'enemy') continue;
        const dx = p.x - b.x, dy = p.y - b.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (d < 150) { const w = (1 - d / 150) * 1.1; ax += dx / d * w; ay += dy / d * w; if (d < b.r + p.r + 34) bulletThreat = true; }
      }
      const A = NR.config.ARENA, M = 120;
      if (p.x < M) ax += (M - p.x) / M * 1.4; else if (p.x > A.w - M) ax -= (p.x - (A.w - M)) / M * 1.4;
      if (p.y < M) ay += (M - p.y) / M * 1.4; else if (p.y > A.h - M) ay -= (p.y - (A.h - M)) / M * 1.4;
      let aim = p.aim || 0;
      if (near) {
        const ex = near.x - p.x, ey = near.y - p.y, d = Math.sqrt(ex * ex + ey * ey) || 1;
        if (nd > want) { ax += ex / d * 1.4; ay += ey / d * 1.4; }            // close in
        const tx = -ey / d * st.strafe, ty = ex / d * st.strafe;             // orbit it while hitting
        ax += tx * (nd <= want ? 0.9 : 0.25); ay += ty * (nd <= want ? 0.9 : 0.25);
        aim = Math.atan2(ey, ex); intent.fire = nd < st.reach + 80;
      } else {
        let pk = null, pd = 700 * 700;
        for (let i = 0; i < W.pickups.length; i++) { const k = W.pickups[i], dx = k.x - p.x, dy = k.y - p.y, d2 = dx * dx + dy * dy; if (!k.dead && d2 < pd) { pd = d2; pk = k; } }
        if (pk) { const d = Math.sqrt(pd) || 1; ax += (pk.x - p.x) / d; ay += (pk.y - p.y) / d; }
      }
      const m = Math.sqrt(ax * ax + ay * ay);
      if (m > 1) { ax /= m; ay /= m; }
      intent.mx = ax; intent.my = ay; intent.aim = aim;
      const hurt = p.hp < p.maxHp * 0.5;
      const far = near && nd > 320 && p.dash.charges >= p.dash.max && p.dash.max >= 2;
      if ((bulletThreat || (contact && hurt) || far) && p.dash.charges > 0 && p.iframes <= 0 && !st.prevDash && st.tick - st.lastDash > 20 && m > 0.1) {
        intent.dash = true; st.lastDash = st.tick;
      }
      st.prevDash = intent.dash;
      return intent;
    }

    function act(W) {
      const s = W.state;
      if (s === 'levelup') {
        for (let g = 0; g < 200 && W.state === 'levelup'; g++) {
          const n = W.levelup.cards.length;
          if (!n) break;
          NR.progression.pick(Math.floor(rnd() * n));
        }
      } else if (s === 'shop') {
        const failed = {};
        for (let g = 0; g < 40; g++) {
          const cand = [];
          for (let i = 0; i < W.shop.offers.length; i++) {
            const o = W.shop.offers[i];
            if (!o.sold && !failed[i] && NR.shop.price(o) <= W.player.gold) cand.push(i);
          }
          if (!cand.length) break;
          const i = cand[Math.floor(rnd() * cand.length)];
          const r = NR.shop.buy(i);
          if (!r || !r.ok) failed[i] = true;
        }
        NR.run.leaveShop();
      } else if (s === 'victory') {
        if (opts.endless) NR.run.enterEndless(); else NR.run.endRun('win');
      } else if (s === 'paused') NR.run.togglePause();
    }
    return { think: think, act: act };
  }

  // play({seconds,seed,char,danger,endless,render}) -> summary
  function play(opts) {
    opts = opts || {};
    const seconds = opts.seconds || 60, seed = opts.seed === undefined ? 1 : opts.seed;
    const STEP = NR.config.STEP, maxTicks = Math.round(seconds / STEP);
    const bot = create({ seed: seed, endless: opts.endless });
    NR.run.start({ charId: opts.char || 'ranger', danger: opts.danger || 0, seed: seed });
    let ticks = 0, stuck = 0, sumMs = 0, worst = 0, maxWave = 1, W = NR.world.get();
    const peak = { enemies: 0, projectiles: 0, areas: 0, pickups: 0, drones: 0 };
    while (ticks < maxTicks) {
      W = NR.world.get();
      const s = W.state;
      if (s === 'wave' || s === 'clear') {
        stuck = 0;
        NR.input.inject(bot.think(W));
        const t0 = process.hrtime.bigint();
        NR.run.step(STEP);
        const ms = Number(process.hrtime.bigint() - t0) / 1e6;
        sumMs += ms; if (ms > worst) worst = ms;
        ticks++;
        W = NR.world.get();
        if (W.wave > maxWave) maxWave = W.wave;
        if (W.enemies.length > peak.enemies) peak.enemies = W.enemies.length;
        if (W.projectiles.length > peak.projectiles) peak.projectiles = W.projectiles.length;
        if (W.areas.length > peak.areas) peak.areas = W.areas.length;
        if (W.pickups.length > peak.pickups) peak.pickups = W.pickups.length;
        if (W.drones.length > peak.drones) peak.drones = W.drones.length;
        const bad = NR.harness.findNaN(W);
        if (bad) throw new Error('NaN/Infinity at tick ' + W.tick + ': ' + bad);
        if (opts.render && NR.fx) {
          NR.camera.update(STEP, 1);
          if (NR.fx.juice) NR.fx.juice.update(STEP);
          if (NR.fx.particles) NR.fx.particles.update(STEP);
          if (NR.fx.floor) NR.fx.floor.update(STEP);
          if (NR.fx.render) NR.fx.render.draw(W, 0.5);
        }
      } else if (s === 'end' || s === 'menu') break;
      else {
        bot.act(W);
        if (++stuck > 20) throw new Error('bot stuck in state ' + NR.world.get().state);
      }
    }
    NR.input.inject(null);
    W = NR.world.get();
    const ended = W.state === 'end';
    return {
      state: W.state, result: ended ? W.stats.result : 'timeout', wave: maxWave, kills: W.stats.kills, damageTaken: Math.round(W.stats.damageTaken),
      ticks: ticks, msPerTick: Math.round(sumMs / Math.max(1, ticks) * 1000) / 1000, worstMs: Math.round(worst * 1000) / 1000,
      peak: peak, damageByWeapon: W.stats.damageByWeapon, seed: seed, char: opts.char || 'ranger', danger: opts.danger || 0,
      hash: NR.harness.hashWorld(W)
    };
  }
  return { create: create, play: play };
};
