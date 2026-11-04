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

  function reset() { hostile = 0; for (let i = 0; i < DB_MAX; i++) db[i].on = false; }
  function def(id) { return NR.data.bosses[id]; }
  function attack(b, kind, time, x, y, r) { atkP.enemy = b; atkP.kind = kind; atkP.time = time; atkP.x = x; atkP.y = y; atkP.r = r; NR.events.emit('enemy:attack', atkP); }
  function countHostile(W) {
    const P = W.projectiles; let n = 0;
    for (let i = 0; i < P.length; i++) if (P[i].team === 'enemy' && !P[i].dead) n++;
    hostile = n;
  }
  let style = 'spike';
  function bolt(b, ang, speed, r, shape, color) {
    const o = NR.projectiles.spawn({ team: 'enemy', x: b.x, y: b.y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: r, dmg: b.dmg * 0.5, life: 6 });
    if (o) { o.shape = shape || 'circle'; o.color = color || b.color; o.style = style; hostile++; }
    return o;
  }
  const PSTYLE = { stomp: 'spike', volley: 'shell', fan: 'shard', nova: 'shard', spiral: 'orb', vortex: 'orb', slam: 'spike', acid: 'glob' };
  // delayed ground blasts (meteors, mines): telegraphed circles that explode when their timer runs out
  const DB_MAX = 40, db = [];
  for (let i = 0; i < DB_MAX; i++) db.push({ on: false, x: 0, y: 0, r: 0, t: 0, dmg: 0 });
  function delayBlast(b, x, y, r, t, dmg) {
    const A = NR.config.ARENA;
    for (let i = 0; i < DB_MAX; i++) {
      const q = db[i]; if (q.on) continue;
      q.on = true; q.x = NR.util.clamp(x, 30, A.w - 30); q.y = NR.util.clamp(y, 30, A.h - 30); q.r = r; q.t = t; q.dmg = dmg;
      const tf = b.flags.telegraph; b.flags.telegraph = true; attack(b, 'blast', Math.max(0.5, t), q.x, q.y, r); b.flags.telegraph = tf;
      return;
    }
  }
  function tickBlasts(dt) {
    for (let i = 0; i < DB_MAX; i++) { const q = db[i]; if (q.on && (q.t -= dt) <= 0) { q.on = false; NR.combat.explode(q.x, q.y, q.r, q.dmg, { team: 'enemy', element: 'fire', knock: 200 }); } }
  }
  // laser: player inside the beam band takes damage (rate limited)
  function segDist2(px, py, x1, y1, x2, y2) {
    const vx = x2 - x1, vy = y2 - y1, L = vx * vx + vy * vy || 1, k = NR.util.clamp(((px - x1) * vx + (py - y1) * vy) / L, 0, 1), dx = x1 + vx * k - px, dy = y1 + vy * k - py;
    return dx * dx + dy * dy;
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
      case 'laser': a.base = aim - pat.sweep / 2 * a.dir; attack(b, 'beam', tt, b.x, b.y, pat.len); break;
      case 'slam': attack(b, 'blast', tt, p.x, p.y, pat.r); break;
      case 'acid': attack(b, 'shoot', tt, p.x, p.y, pat.bulletR); break;
      case 'meteor': case 'mines': attack(b, 'summon', tt, b.x, b.y, b.r + 60); break;
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
    style = PSTYLE[pat.id] || 'spike';
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
        if (a.t <= 0) { a.state = 'recover'; a.t = pat.recover; expose(b, pat.recover + 0.8); }
        break;
      }
      case 'laser': { // a sweeping beam; the telegraph shows where it starts, the sweep direction alternates
        a.t -= dt;
        if (a.step === 0) {
          a.step = 1; a.t = pat.dur;
          a.area = NR.combat.createArea({ areaKind: 'beam', team: 'enemy', x: b.x, y: b.y, angle: a.base, len: pat.len, w: pat.w, dmg: 0, tick: 99, life: pat.dur, element: 'void', color: '#FF3D6E' });
        }
        const ang = a.base + pat.sweep * a.dir * (1 - Math.max(0, a.t) / pat.dur);
        if (a.area && !a.area.dead) { a.area.x = b.x; a.area.y = b.y; a.area.angle = ang; }
        a.hitT = (a.hitT || 0) - dt;
        if (!p.dead && a.hitT <= 0 && segDist2(p.x, p.y, b.x, b.y, b.x + Math.cos(ang) * pat.len, b.y + Math.sin(ang) * pat.len) < (pat.w / 2 + p.r) * (pat.w / 2 + p.r)) { NR.combat.damagePlayer(b.dmg * 0.8, b.id, {}); a.hitT = 0.45; }
        b.rot = ang;
        if (a.t <= 0) { a.dir = -a.dir; endPattern(b); }
        break;
      }
      case 'slam': { // leaps onto the marked spot, shockwave + a ring of spikes with a safe lane
        const A = NR.config.ARENA;
        b.x = NR.util.clamp(a.tx, b.r, A.w - b.r); b.y = NR.util.clamp(a.ty, b.r, A.h - b.r); b.px = b.x; b.py = b.y;
        NR.combat.explode(b.x, b.y, pat.r, b.dmg * 1.1, { team: 'enemy', element: 'physical', knock: 380 });
        ring(b, pat.n, 3, NR.rng.range(0, TAU), pat.speed, pat.bulletR, 'diamond', '#F6F0DF');
        a.state = 'recover'; a.t = pat.recover; expose(b, pat.recover + 0.6);
        break;
      }
      case 'acid': { // lobbed globs in a fan, slow and fat
        if (a.step === 0 || (a.t -= dt) <= 0) {
          fan(b, Math.atan2(p.y - b.y, p.x - b.x), pat.count, pat.spread, pat.speed, pat.bulletR, 'circle', '#8BD450');
          a.step++; if (a.step >= pat.waves) endPattern(b); else a.t = 0.5;
        }
        break;
      }
      case 'meteor': { // a rain of telegraphed impacts around the player, staggered
        const A = NR.config.ARENA;
        for (let k = 0; k < pat.count; k++) delayBlast(b, p.x + NR.rng.range(-pat.spread, pat.spread), p.y + NR.rng.range(-pat.spread, pat.spread), pat.r, 0.9 + k * pat.stagger, b.dmg);
        endPattern(b); a.cd += pat.count * pat.stagger * 0.5; void A;
        break;
      }
      case 'mines': { // a ring of mines around the player with one open side; they blow after a delay
        const n = pat.count, gap = NR.rng.range(0, TAU);
        for (let k = 0; k < n; k++) { if (k === 0 || k === 1) continue; const an = gap + k * TAU / n; delayBlast(b, p.x + Math.cos(an) * pat.dist, p.y + Math.sin(an) * pat.dist, pat.r, pat.delay, b.dmg * 0.9); }
        endPattern(b);
        break;
      }
      default: endPattern(b);
    }
  }
  // weak point: the boss is armoured (half damage) except while its core is exposed (after slams/charges and on a cycle)
  const GUARD_ARMOR = 10;
  function expose(b, t) { b.ai.expT = Math.max(b.ai.expT || 0, t); }

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
    tickBlasts(dt);
    // core cycle: exposed for 3 s every 9 s (plus after slams/charges); armoured otherwise
    a.cyc = (a.cyc || 0) + dt;
    if (a.cyc >= 9) { a.cyc = 0; expose(b, 3); }
    if (a.expT > 0) a.expT -= dt;
    b.flags.exposed = a.expT > 0; b.armor = b.flags.exposed ? 0 : GUARD_ARMOR;
    // burst guard: losing more than 7% max hp within a second while armoured raises a short barrier (counters glass cannons)
    a.win = (a.win || 0) + dt;
    if (a.win >= 1) { a.win = 0; if (!b.flags.exposed && a.hp1 && a.hp1 - b.hp > b.maxHp * 0.07 && !(a.barCd > 0) && a.state !== 'phase') { a.barT = 1.4; a.barCd = 7; } a.hp1 = b.hp; }
    if (a.barCd > 0) a.barCd -= dt;
    if (a.barT > 0) { a.barT -= dt; b.flags.barrier = true; b.hp = Math.max(b.hp, a.barHp || b.hp); } else { b.flags.barrier = false; }
    a.barHp = b.hp;
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
