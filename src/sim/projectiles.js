// Arsenal - pooled projectiles: swept hit checks on the spatial hash, pierce, bounce, homing, orbit, mines, end effects.
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  const TWO_PI = 6.283185307179586;
  const tmp = [], tmp2 = [];
  const HP = []; // pool of hit-lists: flat [enemyId, blockedUntil, ...]
  const impactP = { x: 0, y: 0, r: 0, element: 'physical', team: 'player', surface: 'wall' };
  const HO = { weaponId: null, element: 'physical', crit: false, kx: 0, ky: 0, statusChance: 0, noChain: false, dot: false, weight: 0, spread: false };
  const EO = { team: 'player', element: 'physical', weaponId: null, statusChance: 0, knock: 0, crit: false, weight: 0, spread: false };
  const CO = { areaKind: 'circle', weaponId: null, x: 0, y: 0, r: 0, dmg: 0, tick: 0.5, life: 1, delay: 0, element: 'poison', statusChance: 0, shape: 'ring', color: '', visual: false };
  // onEnd codes
  const END_EXPLODE = 1, END_CLOUD = 2, END_CLUSTER = 3;

  // one scratch record: every field of a projectile, written in full on each spawn (the pool strips extras on reuse)
  const P = {
    team: 'player', weaponId: null, x: 0, y: 0, vx: 0, vy: 0, r: 5, dmg: 1, crit: false, element: 'physical', pierce: 0, hits: null, life: 1,
    knock: 0, statusChance: 0, homing: 0, hr: 0, orb: 0, oa: 0, orad: 0, ospd: 0, rehit: 0, fuse: 0, onEnd: 0, blastR: 0, bd: 0.6, cn: 0,
    bounce: 0, wb: 0, split: 0, pullS: 0, pullT: 0, ghost: 0, mine: 0, arm: 0, trig: 0, drag: 0, weight: 0, spread: 0, cb: -1, br: 0, sig: 0, cl: 0, cdmg: 0, dbl: 0,
    lay: 0, layT: 0, layR: 0, layD: 0, layL: 0, chn: 0, fz: 0, heal: 0, pr: 0, pd: 0,
    shape: 'circle', color: '#F2EFE6', size: 5, trail: false, rot: 0, sx: 1, sy: 1, flash: 0
  };

  // scratch for the areas projectiles leave behind (fire trails, burning patches)
  const LO = { areaKind: 'circle', team: 'player', weaponId: null, x: 0, y: 0, r: 30, dmg: 0, tick: 0.4, life: 1.5, element: 'fire', statusChance: 0.5, color: '#FF7A2F', shape: 'ring' };
  function leave(b, r, dmg, life, el, sc) {
    if (NR.world.get().areas.length >= 140) return;
    LO.weaponId = b.weaponId; LO.x = b.x; LO.y = b.y; LO.r = r; LO.dmg = dmg; LO.life = life; LO.element = el; LO.statusChance = sc; LO.color = b.color;
    NR.combat.createArea(LO);
  }
  let healAt = 0;
  const SP = [];
  function reset() { tmp.length = 0; tmp2.length = 0; HP.length = 0; SP.length = 0; healAt = 0; }
  function getHits() { return HP.length ? HP.pop() : []; }
  function putHits(b) {
    if (b._hs) { b._hs.clear(); if (SP.length < 512) SP.push(b._hs); b._hs = null; }
    const h = b.hits; if (h && h !== true) { h.length = 0; if (HP.length < 512) HP.push(h); }
    b.hits = null;
  }

  function resetScratch() {
    P.team = 'player'; P.weaponId = null; P.vx = 0; P.vy = 0; P.r = 5; P.dmg = 1; P.crit = false; P.element = 'physical'; P.pierce = 0; P.hits = null; P._hs = null;
    P.life = 1; P.knock = 0; P.statusChance = 0; P.homing = 0; P.hr = 0; P.orb = 0; P.oa = 0; P.orad = 0; P.ospd = 0; P.rehit = 0; P.fuse = 0;
    P.onEnd = 0; P.blastR = 0; P.bd = 0.6; P.cn = 0; P.bounce = 0; P.wb = 0; P.split = 0; P.pullS = 0; P.pullT = 0; P.ghost = 0; P.mine = 0; P.arm = 0;
    P.trig = 0; P.drag = 0; P.weight = 0; P.spread = 0; P.cb = -1; P.br = 0; P.sig = 0; P.cl = 0; P.cdmg = 0; P.dbl = 0; P.shape = 'circle'; P.color = '#F2EFE6';
    P.lay = 0; P.layT = 0; P.layR = 0; P.layD = 0; P.layL = 0; P.chn = 0; P.fz = 0; P.heal = 0; P.pr = 0; P.pd = 0;
    P.size = 5; P.trail = false; P.rot = 0; P.sx = 1; P.sy = 1; P.flash = 0;
  }

  // public spawn: o carries any of the scratch fields; missing ones take defaults. Returns the pooled entity or null at the cap.
  function spawn(o) {
    resetScratch();
    for (const k in o) if (k in P) P[k] = o[k];
    P.team = o.team || 'player'; P.weaponId = o.weaponId || null;
    P.element = o.element || 'physical';
    if (o.r === undefined) P.r = 5;
    if (o.size === undefined) P.size = P.r;
    P.color = o.color || (P.team === 'enemy' ? '#C95B73' : NR.config.ELEMENT_COLORS[P.element]);
    P.x = o.x; P.y = o.y;
    return NR.world.add('projectiles', P);
  }

  // allocation-free spawn for weapons: begin() returns the cleared scratch record, fill it, then launch()
  function begin() { resetScratch(); return P; }
  function launch() { return NR.world.add('projectiles', P); }

  function impact(b, surface) {
    impactP.x = b.x; impactP.y = b.y; impactP.r = b.r; impactP.element = b.element; impactP.team = b.team; impactP.surface = surface;
    NR.events.emit('projectile:impact', impactP);
  }

  function seen(b, id, t) {
    if (!b.rehit) return b._hs ? b._hs.has(id) : false;
    const h = b.hits;
    if (!h) return false;
    for (let j = 0; j < h.length; j += 2) if (h[j] === id && h[j + 1] > t) return true;
    return false;
  }
  function remember(b, id, t) {
    if (!b.rehit) {
      if (!b._hs) b._hs = SP.length ? SP.pop() : new Set();
      b._hs.add(id);
      b.hits = b.hits || true;
      return;
    }
    const h = b.hits || (b.hits = getHits());
    const until = b.rehit > 0 ? t + b.rehit : Infinity;
    for (let j = 0; j < h.length; j += 2) if (h[j] === id) { h[j + 1] = until; return; }
    if (b.rehit > 0 && h.length > 16) { // prune expired entries of long-lived orbiters
      let k = 0;
      for (let j = 0; j < h.length; j += 2) if (h[j + 1] > t) { h[k++] = h[j]; h[k++] = h[j + 1]; }
      h.length = k;
    }
    h.push(id, until);
  }

  let curB = null, curT = 0;
  function notSeen(e) { return !seen(curB, e.id, curT); }

  function child(b, ang, dmgMul, life) {
    resetScratch();
    P.team = b.team; P.weaponId = b.weaponId; P.x = b.x; P.y = b.y;
    const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 300;
    P.vx = Math.cos(ang) * sp; P.vy = Math.sin(ang) * sp; P.r = b.r * 0.8; P.dmg = b.dmg * dmgMul; P.crit = b.crit; P.element = b.element; P.pierce = 0;
    P.life = life; P.knock = b.knock; P.statusChance = b.statusChance; P.homing = b.homing; P.hr = b.hr; P.weight = b.weight; P.shape = b.shape;
    P.color = b.color; P.size = b.size * 0.8; P.trail = b.trail; P.pullS = b.pullS; P.rot = ang;
    return NR.world.add('projectiles', P);
  }

  // end of life: effects, event, and release. surface = expire | wall | enemy | player
  function end(b, surface, silent) {
    if (b.dead) return;
    b.dead = true;
    putHits(b);
    const oe = b.onEnd;
    if (oe) {
      EO.team = 'player'; EO.element = b.element; EO.weaponId = b.weaponId; EO.statusChance = b.statusChance; EO.knock = b.knock; EO.crit = b.crit;
      EO.weight = b.weight; EO.spread = !!b.spread;
      if (oe === END_EXPLODE) {
        NR.combat.explode(b.x, b.y, b.blastR, b.dmg * b.bd, EO);
        if (b.pr > 0) leave(b, b.pr, b.pd, 2.4, b.element, 0.5); // Phoenix Staff flames
      }
      else if (oe === END_CLOUD) {
        NR.combat.explode(b.x, b.y, b.blastR, b.dmg, EO);
        CO.weaponId = b.weaponId; CO.x = b.x; CO.y = b.y; CO.r = b.blastR; CO.dmg = b.cdmg; CO.life = b.cl; CO.element = b.element; CO.statusChance = b.statusChance;
        CO.delay = 0; CO.tick = 0.5; CO.color = b.color;
        NR.combat.createArea(CO);
        if (b.chn) { // Plague Mine: set off every other mine of the same weapon nearby, one after another
          const L = NR.world.get().projectiles; let c = 0;
          for (let i = 0; i < L.length; i++) {
            const q = L[i];
            if (q.dead || q === b || !q.mine || q.weaponId !== b.weaponId) continue;
            if ((q.x - b.x) * (q.x - b.x) + (q.y - b.y) * (q.y - b.y) < 300 * 300) { q.arm = 0; q.life = Math.min(q.life, 0.1 + 0.08 * (++c)); }
          }
        }
        if (b.dbl) { CO.delay = 0.55; CO.life = 0.7; CO.tick = 5; CO.dmg = b.dmg * 0.8; CO.r = b.blastR * 1.25; CO.color = b.color; NR.combat.createArea(CO); }
      } else if (oe === END_CLUSTER) {
        NR.combat.explode(b.x, b.y, b.blastR, b.dmg, EO);
        for (let k = 0; k < b.cn; k++) {
          const a = NR.rng.range(0, TWO_PI), c = child(b, a, 0.45, NR.rng.range(0.28, 0.5));
          if (c) { const sp = NR.rng.range(150, 230); c.vx = Math.cos(a) * sp; c.vy = Math.sin(a) * sp; c.ghost = 1; c.drag = 2.2; c.onEnd = END_EXPLODE; c.blastR = b.blastR * 0.55; c.bd = 1; c.homing = 0; c.shape = 'hex'; c.size = 5; c.r = 5; }
        }
      }
    }
    if (!silent) impact(b, surface);
  }

  function hit(b, e, t) {
    let kx = 0, ky = 0;
    if (b.knock > 0) {
      if (b.orb) { const pl = NR.world.get().player, dx = e.x - pl.x, dy = e.y - pl.y, d = Math.sqrt(dx * dx + dy * dy) || 1; kx = dx / d * b.knock; ky = dy / d * b.knock; }
      else { const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 1; kx = b.vx / sp * b.knock; ky = b.vy / sp * b.knock; }
    }
    HO.weaponId = b.weaponId; HO.element = b.element; HO.crit = b.crit; HO.kx = kx; HO.ky = ky; HO.statusChance = b.statusChance;
    HO.noChain = false; HO.dot = false; HO.weight = b.weight; HO.spread = !!b.spread;
    let dmg = b.dmg;
    if (b.cb >= 0) { const pl2 = NR.world.get().player, c = NR.combat.critRoll(pl2, b.cb); HO.crit = c.crit; dmg *= c.mult; }
    NR.combat.hitEnemy(e, dmg, HO);
    if (b.fz && !e.dead) NR.combat.applyStatus(e, 'freeze', NR.stats.get(NR.world.get().player, 'statusPower'), dmg, b.weaponId, 0); // Glacial Seeker: flash-freeze
    if (b.heal > 0 && t >= healAt) { healAt = t + 0.3; NR.player.heal(b.heal, 'saw'); }                                                    // Bloodsaw leech
    if (b.pierce > 0 || b.bounce > 0 || b.rehit > 0) remember(b, e.id, t);
    impact(b, 'enemy');
    if (b.split > 0) {
      const a = Math.atan2(b.vy, b.vx);
      b.split = 0;
      child(b, a + 0.55, 0.6, 0.9); child(b, a - 0.55, 0.6, 0.9);
    }
    if (b.orb) return;
    if (b.bounce > 0) { // ricochet to the nearest enemy not yet hit
      curB = b; curT = t;
      const nx = NR.spatial.nearest(e.x, e.y, 300, notSeen);
      if (nx && nx !== e) {
        const s2 = Math.sqrt(b.vx * b.vx + b.vy * b.vy), dx = nx.x - e.x, dy = nx.y - e.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        b.vx = dx / d * s2; b.vy = dy / d * s2; b.bounce--; b.x = e.x; b.y = e.y; b.px = e.x; b.py = e.y;
        if (b.life < 0.35) b.life = 0.35;
        return;
      }
    }
    if (--b.pierce < 0) end(b, 'enemy', true);
  }

  function steer(b, dt, t) {
    curB = b; curT = t;
    const tg = NR.spatial.nearest(b.x, b.y, b.hr || 380, notSeen);
    if (!tg) return;
    const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 1;
    let da = Math.atan2(tg.y - b.y, tg.x - b.x) - Math.atan2(b.vy, b.vx);
    while (da > Math.PI) da -= TWO_PI; while (da < -Math.PI) da += TWO_PI;
    const m = b.homing * dt, turn = da > m ? m : da < -m ? -m : da, a = Math.atan2(b.vy, b.vx) + turn;
    b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
  }

  function update(dt) {
    const W = NR.world.get(), A = NR.config.ARENA, PL = W.projectiles, pl = W.player, t = W.time;
    const anyEnemy = W.enemies.length > 0;
    for (let i = 0; i < PL.length; i++) {
      const b = PL[i];
      if (b.dead) { if (b.hits) putHits(b); continue; }
      b.px = b.x; b.py = b.y; b.age += dt; b.life -= dt;
      if (b.orb) {
        if (!pl || pl.dead) { b.dead = true; putHits(b); continue; }
        b.oa += b.ospd * dt;
        const c = Math.cos(b.oa), s = Math.sin(b.oa);
        const rad = b.br > 0 ? b.orad * (1 + b.br * Math.sin(b.age * 1.7)) : b.orad;
        b.x = pl.x + c * rad; b.y = pl.y + s * rad; b.vx = -s * rad * b.ospd; b.vy = c * rad * b.ospd; b.rot = b.oa * 2;
        if (b.age < dt * 1.5) { b.px = b.x; b.py = b.y; }
      } else {
        if (b.homing > 0) steer(b, dt, t);
        if (b.drag > 0) { const f = Math.max(0, 1 - b.drag * dt); b.vx *= f; b.vy *= f; }
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.lay > 0) { b.layT -= dt; if (b.layT <= 0) { b.layT += b.lay; leave(b, b.layR, b.layD, b.layL, b.element, 0.5); } } // Dragonfire trail
        if (b.ghost) b.rot += 9 * dt;
        else if (b.rot === 0 && (b.vx !== 0 || b.vy !== 0)) b.rot = Math.atan2(b.vy, b.vx);
        if (b.pullS > 0) {
          b.pullT -= dt;
          if (b.pullT <= 0 && anyEnemy) {
            b.pullT = 0.2;
            const n = NR.spatial.circle(b.x, b.y, 110, tmp2);
            for (let k = 0; k < n; k++) NR.combat.pull(tmp2[k], b.x, b.y, b.pullS);
          }
        }
        if (b.x < 0 || b.y < 0 || b.x > A.w || b.y > A.h) {
          if (b.wb > 0) {
            if (b.x < 0 || b.x > A.w) { b.vx = -b.vx; b.x = b.x < 0 ? 0 : A.w; }
            if (b.y < 0 || b.y > A.h) { b.vy = -b.vy; b.y = b.y < 0 ? 0 : A.h; }
            b.wb--; b.px = b.x; b.py = b.y; impact(b, 'wall');
          } else { end(b, 'wall'); continue; }
        }
      }
      if (b.mine) {
        if (b.arm > 0) b.arm -= dt;
        else if (anyEnemy && NR.spatial.nearest(b.x, b.y, b.trig, null)) b.life = 0;
      }
      if (b.life <= 0) { end(b, 'expire'); continue; }
      if (b.team === 'player') {
        if (b.ghost || b.mine || !anyEnemy) continue;
        const n = NR.spatial.line(b.px, b.py, b.x, b.y, b.r * 2, tmp);
        if (n === 0) continue;
        if (n > 1 && b.pierce < 99) NR.combat.sortNear(tmp, b.px, b.py);
        for (let k = 0; k < n; k++) {
          const e = tmp[k];
          if (e.dead || seen(b, e.id, t)) continue;
          hit(b, e, t);
          if (b.dead) break;
        }
      } else if (pl && !pl.dead) {
        const dx = pl.x - b.x, dy = pl.y - b.y, rr = pl.r + b.r;
        if (dx * dx + dy * dy <= rr * rr) { NR.combat.damagePlayer(b.dmg, b.id, {}); impact(b, 'player'); b.dead = true; }
      }
    }
  }

  function clearHostile() {
    const L = NR.world.get().projectiles;
    for (let i = 0; i < L.length; i++) if (L[i].team === 'enemy') L[i].dead = true;
  }
  NR.projectiles = { reset, spawn, begin, launch, update, clearHostile, END_EXPLODE, END_CLOUD, END_CLUSTER };
})();
