// Owned by Horde. 3 bosses, 2-3 phases each, data-driven patterns (src/data/bosses.js). Every pattern keeps a safe angular gap.
// Telegraph contract for fx: while winding up b.flags.telegraph is true and `enemy:attack` {enemy,kind,time,x,y,r} was emitted; b.flags.invuln during phase changes.
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  const TAU = Math.PI * 2, BOSS_CAP = 110, PHASE_T = 1.4, PHASE_BURST_AT = 0.8;
  const phaseP = { boss: null, phase: 0 };
  const deathP = { boss: null, x: 0, y: 0 };
  const spawnP = { enemy: null };
  const atkP = { enemy: null, kind: '', time: 0, x: 0, y: 0, r: 0 };
  let hostile = 0;

  function reset() { hostile = 0; }
  function def(id) { return NR.data.bosses[id]; }
  function attack(b, kind, time, x, y, r) { atkP.enemy = b; atkP.kind = kind; atkP.time = time; atkP.x = x; atkP.y = y; atkP.r = r; NR.events.emit('enemy:attack', atkP); }
  function countHostile(W) {
    const P = W.projectiles; let n = 0;
    for (let i = 0; i < P.length; i++) if (P[i].team === 'enemy' && !P[i].dead) n++;
    hostile = n;
  }
  function bolt(b, ang, speed, r, shape, color) {
    const o = NR.projectiles.spawn({ team: 'enemy', x: b.x, y: b.y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: r, dmg: b.dmg * 0.5, life: 6 });
    if (o) { o.shape = shape || 'circle'; o.color = color || b.color; hostile++; }
    return o;
  }
  // n bullets around the boss with `gapN` missing in a row centred on gapAng: flank-to-flank gap = (gapN+1) * 2PI/n
  function ring(b, n, gapN, gapAng, speed, r, shape, color) {
    const step = TAU / n, a0 = gapAng + (gapN + 1) / 2 * step;
    for (let k = 0; k < n - gapN; k++) bolt(b, a0 + k * step, speed, r, shape, color);
  }
  function fan(b, aim, count, spread, speed, r, shape, color) {
    const sp = count > 1 ? spread / (count - 1) : 0;
    for (let k = 0; k < count; k++) bolt(b, aim + (k - (count - 1) / 2) * sp, speed, r, shape, color);
  }

  function spawn(bossId, o) {
    o = o || {};
    const d = def(bossId), W = NR.world.get(), sc = W.scale, A = NR.config.ARENA;
    if (!d) return null;
    const hp = d.hp * sc.hp * (o.hpMult || 1);
    const b = NR.world.add('enemies', {
      defId: bossId, ak: 'boss', ap: null, x: A.w / 2, y: 220, r: d.r, hp: hp, maxHp: hp, speed: 55 * sc.speed, dmg: 22, armor: 0, xp: 60 * sc.xp, gold: d.reward.gold * sc.gold, contact: true,
      isBoss: true, phase: 1, affixes: [], donor: o.donor || '',
      ai: { state: 'move', t: 0, cd: 1.6, pat: null, last: -1, step: 0, n: 0, acc: 0, base: 0, gapAng: 0, tx: 0, ty: 0, dx: 0, dy: 0, hit: false, hitCd: 0, dir: NR.rng.chance(0.5) ? 1 : -1, list: null, lockHp: 0, kids: 0 },
      status: {}, kbx: 0, kby: 0, shape: d.shape, color: d.color, rot: 0, sx: 1, sy: 1, flash: 0,
      flags: { boss: true, elite: false, enraged: false, frozen: false, burning: false, poisoned: false, shielded: false, telegraph: false, invuln: false, hurt: false }
    });
    if (!b) return null;
    W.boss = b;
    buildList(b, 1);
    spawnP.enemy = b; NR.events.emit('enemy:spawn', spawnP);
    phaseP.boss = b; phaseP.phase = 0; NR.events.emit('boss:phase', phaseP);
    return b;
  }
  // patterns of the current phase; remixed bosses (Endless) also borrow one pattern of a donor boss from phase 2 on
  function buildList(b, ph) {
    const d = def(b.defId), list = d.phases[ph - 1].patterns.slice();
    if (b.donor && ph >= 2) {
      const dd = def(b.donor);
      if (dd) { const dp = dd.phases[Math.min(ph, dd.phases.length) - 1].patterns; list.push(dp[(ph - 1) % dp.length]); }
    }
    b.ai.list = list;
  }
  function phaseData(b) { return def(b.defId).phases[b.phase - 1]; }

  function startPattern(b, pat, p) {
    const a = b.ai, en = b.flags.enraged, tt = Math.max(0.5, pat.tele * (en ? 0.85 : 1));
    a.pat = pat; a.state = 'tele'; a.t = tt; a.step = 0; a.n = 0; a.acc = 0; a.hit = false; b.flags.telegraph = true;
    const aim = Math.atan2(p.y - b.y, p.x - b.x);
    a.gapAng = aim + NR.rng.range(-0.7, 0.7);
    a.tx = p.x; a.ty = p.y;
    switch (pat.id) {
      case 'stomp': case 'nova': attack(b, 'blast', tt, b.x, b.y, 230); break;
      case 'volley': case 'fan': case 'spiral': attack(b, 'shoot', tt, p.x, p.y, pat.bulletR); break;
      case 'summon': attack(b, 'summon', tt, b.x, b.y, b.r + 80); break;
      case 'vortex': attack(b, 'blast', tt, b.x, b.y, 320); break;
      case 'charge': {
        const dx = p.x - b.x, dy = p.y - b.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        a.dx = dx / d; a.dy = dy / d; a.tx = b.x + a.dx * pat.speed * pat.dur; a.ty = b.y + a.dy * pat.speed * pat.dur;
        attack(b, 'dash', tt, a.tx, a.ty, pat.width / 2); break;
      }
    }
  }
  function endPattern(b) {
    const a = b.ai, ph = phaseData(b);
    a.state = 'move'; a.pat = null; b.flags.telegraph = false;
    a.cd = ph.cd * (b.flags.enraged ? 0.7 : 1) * NR.rng.range(0.85, 1.15);
  }
  function emitRingAt(b, pat) {
    const shape = pat.id === 'nova' ? 'diamond' : 'circle', color = pat.id === 'nova' ? '#EAF4FB' : b.color;
    ring(b, pat.n, pat.gapN, b.ai.gapAng, pat.speed, pat.bulletR, shape, color);
  }
  // runs once per tick while state === 'tele' (wind-up) or 'act' (execution)
  function runPattern(b, p, dt, W) {
    const a = b.ai, pat = a.pat;
    if (a.state === 'tele') {
      a.t -= dt;
      if (a.t > 0) return;
      a.state = 'act'; b.flags.telegraph = false; a.acc = 0; a.step = 0; a.n = 0;
      if (pat.id === 'charge') a.t = pat.dur; else if (pat.id === 'spiral' || pat.id === 'vortex') { a.t = pat.dur; a.base = NR.rng.range(0, TAU); } else a.t = 0;
      if (pat.id === 'summon') {
        const E = W.enemies; let kids = 0;
        for (let i = 0; i < E.length; i++) if (!E[i].dead && E[i].ai.owner === b.id) kids++;
        for (let k = 0; k < pat.count && kids < pat.maxKids && E.length < NR.config.CAPS.enemies - 10; k++, kids++) {
          const ang = a.gapAng + k * TAU / pat.count;
          NR.enemies.spawn(pat.enemy, b.x + Math.cos(ang) * (b.r + 90), b.y + Math.sin(ang) * (b.r + 90), { marker: 0.8, owner: b.id });
        }
        endPattern(b); return;
      }
      if (hostile > BOSS_CAP && pat.id !== 'charge') { endPattern(b); a.cd = 0.4; return; } // never stack past the readable limit
    }
    // act
    switch (pat.id) {
      case 'stomp': case 'nova': {
        if (a.step === 0 || (a.t -= dt) <= 0) {
          emitRingAt(b, pat); a.step++;
          if (a.step >= pat.rings) { endPattern(b); } else a.t = pat.ringDelay;
        }
        break;
      }
      case 'volley': case 'fan': {
        if (a.step === 0 || (a.t -= dt) <= 0) {
          const aim = Math.atan2(p.y - b.y, p.x - b.x), total = pat.bursts || pat.waves;
          fan(b, aim, pat.count, pat.spread, pat.speed, pat.bulletR, pat.id === 'fan' ? 'tri' : 'circle', pat.id === 'fan' ? '#EAF4FB' : b.color);
          a.step++;
          if (a.step >= total) endPattern(b); else a.t = 0.45;
        }
        break;
      }
      case 'spiral': case 'vortex': {
        a.t -= dt; a.acc += dt;
        if (pat.id === 'vortex') {
          const dx = b.x - p.x, dy = b.y - p.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
          if (!p.dead && d < 700) { p.kbx += dx / d * pat.pull * dt; p.kby += dy / d * pat.pull * dt; }
        }
        while (a.acc >= pat.rate) {
          a.acc -= pat.rate; a.base += pat.spin * pat.rate;
          for (let k = 0; k < pat.arms; k++) bolt(b, a.base + k * TAU / pat.arms, pat.speed, pat.bulletR, 'circle', pat.id === 'vortex' ? '#A25CE0' : b.color);
        }
        if (a.t <= 0) endPattern(b);
        break;
      }
      case 'charge': {
        a.t -= dt;
        b.x = NR.util.clamp(b.x + a.dx * pat.speed * dt, b.r, NR.config.ARENA.w - b.r); b.y = NR.util.clamp(b.y + a.dy * pat.speed * dt, b.r, NR.config.ARENA.h - b.r);
        b.rot = Math.atan2(a.dy, a.dx);
        if (a.t <= 0) { a.state = 'recover'; a.t = pat.recover; }
        break;
      }
      default: endPattern(b);
    }
  }

  function enterPhase(b, ph) {
    const a = b.ai, d = def(b.defId), pd = d.phases[ph - 1];
    b.phase = ph; a.state = 'phase'; a.t = PHASE_T; a.step = 0; a.pat = null; a.lockHp = b.hp; a.gapAng = NR.rng.range(0, TAU);
    b.flags.invuln = true; b.flags.telegraph = true; if (pd.enraged) b.flags.enraged = true;
    buildList(b, ph);
    NR.projectiles.clearHostile(); hostile = 0;
    phaseP.boss = b; phaseP.phase = ph; NR.events.emit('boss:phase', phaseP);
    attack(b, 'blast', PHASE_BURST_AT, b.x, b.y, 260);
  }

  function update(dt) {
    const W = NR.world.get(), b = W.boss, p = W.player;
    if (!b || b.dead) return;
    const d = def(b.defId), a = b.ai, A = NR.config.ARENA;
    b.px = b.x; b.py = b.y; b.age += dt;
    if (b.age >= 90) b.flags.enraged = true;
    if (a.hitCd > 0) a.hitCd -= dt;
    countHostile(W);
    // phase change by hp ratio (one step at a time)
    if (b.phase < d.phases.length && a.state !== 'phase' && b.hp / b.maxHp < d.phases[b.phase].below) enterPhase(b, b.phase + 1);
    if (!p || p.dead) return;
    const dx = p.x - b.x, dy = p.y - b.y, dist = Math.sqrt(dx * dx + dy * dy) || 1, ph = phaseData(b);
    const en = b.flags.enraged, sp = b.speed * ph.speedMult * (en ? 1.5 : 1);
    if (a.state === 'phase') {
      b.hp = Math.max(b.hp, a.lockHp); a.lockHp = b.hp; a.t -= dt;
      if (b.flags.telegraph && a.t <= PHASE_T - PHASE_BURST_AT) { // the burst: a ring with a wide safe lane
        b.flags.telegraph = false;
        ring(b, 24, 4, Math.atan2(dy, dx) + NR.rng.range(-0.7, 0.7), 170, 6, 'circle', b.color);
      }
      if (a.t <= 0) { a.state = 'move'; b.flags.invuln = false; a.cd = 0.8; }
    } else if (a.state === 'move') {
      let vx = 0, vy = 0;
      if (dist > ph.keep + 40) { vx = dx / dist; vy = dy / dist; }
      else if (dist < ph.keep - 60) { vx = -dx / dist; vy = -dy / dist; }
      else { vx = -dy / dist * a.dir * 0.6; vy = dx / dist * a.dir * 0.6; }
      b.vx = vx * sp; b.vy = vy * sp;
      b.x = NR.util.clamp(b.x + b.vx * dt, b.r, A.w - b.r); b.y = NR.util.clamp(b.y + b.vy * dt, b.r, A.h - b.r);
      b.rot = Math.atan2(dy, dx);
      a.cd -= dt;
      if (a.cd <= 0) {
        const list = a.list; let i = NR.rng.int(0, list.length - 1);
        if (list.length > 1 && i === a.last) i = (i + 1) % list.length;
        a.last = i;
        if (hostile > BOSS_CAP && list[i].id !== 'charge' && list[i].id !== 'summon') a.cd = 0.3; else startPattern(b, list[i], p);
      }
    } else if (a.state === 'recover') {
      a.t -= dt; b.vx = 0; b.vy = 0;
      if (a.t <= 0) endPattern(b);
    } else { // tele / act
      if (a.state === 'tele' && a.pat.id !== 'charge') b.rot = Math.atan2(dy, dx);
      runPattern(b, p, dt, W);
    }
    if (a.state !== 'move') { b.vx = 0; b.vy = 0; }
    const cr = b.r + p.r;
    if (a.hitCd <= 0 && NR.util.dist2(b.x, b.y, p.x, p.y) < cr * cr) { NR.combat.damagePlayer(b.dmg, b.id, {}); a.hitCd = 1; }
  }

  function kill(b) {
    if (!b.dead) { NR.enemies.kill(b); return; }
    if (b._bossDead) return;
    b._bossDead = true;
    deathP.boss = b; deathP.x = b.x; deathP.y = b.y;
    NR.events.emit('boss:death', deathP);
    if (NR.pickups) { // boss loot: a chest and two hearts
      NR.pickups.spawn('chest', b.x, b.y, 0);
      NR.pickups.spawn('heart', b.x - 40, b.y + 20, 20); NR.pickups.spawn('heart', b.x + 40, b.y + 20, 20);
    }
  }
  NR.bosses = { reset, spawn, update, kill, def };
})();
