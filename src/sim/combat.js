// Arsenal - combat math: damage, crit, armor, dodge, knockback, hit weight, statuses, areas, chains, explosions.
(function () {
  const NR = globalThis.NR = globalThis.NR || {};

  // ---- status tuning ("Stats & Formulas"): power = statusPower stat, scales duration and potency
  const ST = {
    burn: { dur: 3, dot: 0.4 },                       // dps = 40% of the hit that lit it, ignores armor
    poison: { dur: 4, dot: 0.14, max: 5 },            // per stack dps = 14% of the hit, stacks to 5, ignores armor
    chill: { dur: 3, slow: 0.11, max: 5, freeze: 1.4, immune: 2 }, // 11% slow per stack; 5 stacks -> frozen
    shock: { stun: 0.45, immune: 1.5, arcs: 2, arc: 0.5 },
    void: { dur: 4, vuln: 0.2 }
  };
  const STATUS_OF = { fire: 'burn', ice: 'chill', shock: 'shock', poison: 'poison', void: 'void' };
  const TICK = 0.5, FROZEN_VULN = 1.25, ICE_SET_VULN = 0.25, SLOW_CAP = 0.6, BOSS_SLOW_CAP = 0.4;
  const NO = {};

  const crit = { crit: false, mult: 1 };
  const dmgP = { weaponId: null, target: null, isBoss: false, amount: 0, crit: false, element: 'physical', x: 0, y: 0, killed: false, weight: 0, dot: false };
  const stP = { target: null, status: '', stacks: 1, x: 0, y: 0 };
  const exP = { x: 0, y: 0, r: 0, element: 'physical', team: 'player', weaponId: null };
  const arcP = { points: [], element: 'shock' };
  const HO = { weaponId: null, element: 'physical', crit: false, kx: 0, ky: 0, statusChance: 0, noChain: false, dot: false, weight: 0, spread: false };
  const PTS = []; for (let i = 0; i < 16; i++) PTS.push({ x: 0, y: 0 });
  const SC = []; let sd = 0; // scratch arrays by call depth (queries can nest through kills and chains)
  function grab() { const a = SC[sd] || (SC[sd] = []); sd++; return a; }
  function drop() { sd--; }

  function reset() { sd = 0; arcP.points.length = 0; }
  function W() { return NR.world.get(); }
  function critRoll(p, bonus) {
    const c = NR.util.clamp(NR.stats.get(p, 'critChance') + (bonus || 0), 0, 1);
    crit.crit = (NR.traits && NR.traits.critForced()) || NR.rng.chance(c); // Dead Eye forces the crit of the next volley
    crit.mult = crit.crit ? NR.stats.get(p, 'critDamage') : 1;
    return crit;
  }

  // ---- damage to enemies
  // o: weaponId element crit kx ky statusChance noChain dot weight spread noStatus
  function hitEnemy(e, dmg, o) {
    o = o || NO;
    if (e.dead || !(dmg > 0)) return 0;
    const wid = o.weaponId || null, el = o.element || 'physical', isCrit = !!o.crit, dot = !!o.dot;
    const kx = o.kx || 0, ky = o.ky || 0, sChance = o.statusChance || 0, noChain = !!o.noChain, sp = !!o.spread, weight = o.weight || 0;
    if (e.dodge > 0 && !dot && NR.rng.chance(e.dodge)) return 0;
    const st = e.status;
    let m = dot ? 1 : NR.stats.armorMult(e.armor || 0);
    if (!dot && NR.traits) m *= NR.traits.hitMult(e, wid, dot); // Executioner, Focus Fire
    if (st) {
      if (st.frozen && st.frozen.t > 0) m *= FROZEN_VULN + (NR.reactions && NR.reactions.setActive(W().player, 'ice') ? ICE_SET_VULN : 0) + (NR.traits ? NR.traits.frozenBonus() : 0);
      if (st.void && st.void.t > 0) m *= 1 + ST.void.vuln * (st.void.pw || 1) * (e.isBoss ? 0.5 : 1);
    }
    const dealt = Math.max(1, dmg * m);
    if (e.shield > 0) { // Shielded elites: the barrier soaks the hit first
      const ab = Math.min(e.shield, dealt); e.shield -= ab; e.hp -= dealt - ab;
      if (e.shield <= 0 && e.flags) e.flags.aegis = false;
    } else e.hp -= dealt;
    if (kx || ky) {
      const km = e.isBoss ? 0.15 : NR.util.clamp(14 / (e.r || 12), 0.4, 1.4);
      e.kbx = (e.kbx || 0) + kx * km; e.kby = (e.kby || 0) + ky * km;
    }
    const killed = e.hp <= 0;
    let wt = weight * (isCrit ? 1.4 : 1) * (e.isBoss ? 0.5 : 1) + (killed && weight > 0 ? 0.15 : 0);
    if (wt > 1) wt = 1;
    dmgP.weaponId = wid; dmgP.target = e; dmgP.isBoss = !!e.isBoss; dmgP.amount = dealt; dmgP.crit = isCrit;
    dmgP.element = el; dmgP.x = e.x; dmgP.y = e.y; dmgP.killed = killed; dmgP.weight = dot ? 0 : wt; dmgP.dot = dot;
    NR.events.emit('damage:dealt', dmgP);
    if (killed) {
      NR.enemies.kill(e, wid);
    } else {
      if (!dot && st && NR.reactions) NR.reactions.check(e, el, dmg, wid);
      if (sChance > 0 && !o.noStatus && !e.dead) {
        const p = W().player, pw = p ? NR.stats.get(p, 'statusPower') : 1;
        const s = STATUS_OF[el];
        if (s && NR.rng.chance(Math.min(1, sChance * pw))) applyStatus(e, s, pw, dmg, wid, (noChain ? 1 : 0) | (sp ? 2 : 0));
      }
    }
    if (!dot && wid) {
      const p = W().player, ls = p ? NR.stats.get(p, 'lifesteal') : 0;
      if (ls > 0) NR.player.heal(dealt * ls);
    }
    return dealt;
  }

  function damagePlayer(amount, srcId, opts) {
    const w = W(), p = w.player;
    if (!p || p.dead) return false;
    const dodge = NR.stats.get(p, 'dodge');
    if (dodge > 0 && NR.rng.chance(dodge)) return NR.player.hurt(0, srcId, { dodged: true });
    return NR.player.hurt(Math.max(1, amount * w.scale.dmg * NR.stats.armorMult(NR.stats.get(p, 'armor'))), srcId, opts);
  }

  // ---- statuses. bits: 1 = no arc (shock from a chain), 2 = spreading fire
  function applyStatus(e, status, power, srcDmg, wid, bits) {
    if (e.dead) return false;
    power = power || 1; srcDmg = srcDmg || 0; bits = bits | 0;
    const s = e.status || (e.status = {});
    const boss = !!e.isBoss;
    let stacks = 1, name = status;
    if (status === 'burn') {
      const o = s.burn || (s.burn = { t: 0, dps: 0, acc: 0, src: null, spread: false });
      const dps = srcDmg * ST.burn.dot * power;
      o.dps = o.t > 0 ? Math.max(o.dps, dps) : dps; o.t = ST.burn.dur * power; o.src = wid || o.src; o.spread = o.spread || !!(bits & 2);
    } else if (status === 'poison') {
      const o = s.poison || (s.poison = { t: 0, dps: 0, acc: 0, src: null, stacks: 0 });
      if (o.t <= 0) o.stacks = 0;
      o.stacks = Math.min(ST.poison.max + (NR.reactions && NR.reactions.setActive(W().player, 'poison') ? 1 : 0), o.stacks + 1); stacks = o.stacks;
      const dps = srcDmg * ST.poison.dot * power;
      o.dps = o.t > 0 ? Math.max(o.dps, dps) : dps; o.t = ST.poison.dur * power; o.src = wid || o.src;
    } else if (status === 'chill' || status === 'freeze') {
      const o = s.chill || (s.chill = { t: 0, stacks: 0 });
      const fz = s.freeze || s.frozen || (s.freeze = s.frozen = { t: 0, imm: 0 });
      if (o.t <= 0) o.stacks = 0;
      if (status === 'chill') { o.stacks = Math.min(ST.chill.max, o.stacks + 1); o.t = ST.chill.dur * power; }
      stacks = o.stacks;
      if ((status === 'freeze' || o.stacks >= ST.chill.max) && fz.t <= 0 && fz.imm <= 0) {
        fz.t = ST.chill.freeze * power * (boss ? 0.3 : 1); fz.imm = fz.t + ST.chill.immune; o.stacks = 0; o.t = 0; name = 'frozen'; stacks = 1;
      } else if (status === 'freeze') return false;
    } else if (status === 'shock') {
      const o = s.stun || (s.stun = { t: 0, imm: 0 });
      if (!boss && o.t <= 0 && o.imm <= 0) { o.t = ST.shock.stun * power * (e.flags && e.flags.elite ? 0.5 : 1); o.imm = o.t + ST.shock.immune; }
      if (!(bits & 1)) chain(e, srcDmg * ST.shock.arc, { jumps: ST.shock.arcs, weaponId: wid, noChain: true, range: 110, falloff: 0.7 });
    } else if (status === 'void') {
      const o = s.void || (s.void = { t: 0, pw: 1 });
      o.t = ST.void.dur * power; o.pw = power;
    } else return false;
    stP.target = e; stP.status = name; stP.stacks = stacks; stP.x = e.x; stP.y = e.y;
    NR.events.emit('status:apply', stP);
    return true;
  }

  // ---- queries
  function inCone(e, x, y, ang, arc) {
    const dx = e.x - x, dy = e.y - y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    let da = Math.atan2(dy, dx) - ang;
    while (da > Math.PI) da -= 6.283185307; while (da < -Math.PI) da += 6.283185307;
    return Math.abs(da) <= arc / 2 + Math.atan2(e.r || 0, d);
  }
  // enemies in a cone (origin, direction, length, total arc); out is filled and returned count
  function queryCone(x, y, ang, len, arc, out) {
    const tmp = grab();
    NR.spatial.circle(x, y, len, tmp);
    out.length = 0;
    for (let i = 0; i < tmp.length; i++) { const e = tmp[i]; if (!e.dead && inCone(e, x, y, ang, arc)) out.push(e); }
    drop();
    return out.length;
  }
  // nearest-first ordering for pierce limits (insertion sort, tiny arrays)
  function sortNear(a, x, y) {
    for (let i = 1; i < a.length; i++) {
      const e = a[i], d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
      let j = i - 1;
      while (j >= 0 && (a[j].x - x) * (a[j].x - x) + (a[j].y - y) * (a[j].y - y) > d) { a[j + 1] = a[j]; j--; }
      a[j + 1] = e;
    }
  }

  // ---- explosions
  // o: team element weaponId statusChance knock crit weight noChain
  function explode(x, y, r, dmg, o) {
    o = o || NO;
    const team = o.team || 'player', el = o.element || 'physical';
    let n = 0;
    if (team === 'player') {
      const arr = grab();
      const cnt = NR.spatial.circle(x, y, r, arr), kn = o.knock || 0, c = !!o.crit;
      for (let i = 0; i < cnt; i++) {
        const e = arr[i]; if (e.dead) continue;
        const dx = e.x - x, dy = e.y - y, d = Math.sqrt(dx * dx + dy * dy) || 1, fall = o.falloff ? (1 - 0.35 * Math.min(1, d / (r + e.r))) : 1;
        HO.weaponId = o.weaponId || null; HO.element = el; HO.crit = c; HO.kx = dx / d * kn; HO.ky = dy / d * kn;
        HO.statusChance = o.statusChance || 0; HO.noChain = !!o.noChain; HO.dot = false; HO.weight = o.weight || 0; HO.spread = !!o.spread;
        hitEnemy(e, dmg * fall, HO); n++;
      }
      drop();
    } else {
      const p = W().player;
      if (p && !p.dead && NR.util.dist2(x, y, p.x, p.y) <= (r + p.r) * (r + p.r)) { damagePlayer(dmg, 0, {}); n = 1; }
    }
    if (o.silent) return n;
    exP.x = x; exP.y = y; exP.r = r; exP.element = el; exP.team = team; exP.weaponId = o.weaponId || null;
    NR.events.emit('area:explode', exP);
    return n;
  }

  // ---- lasting areas. areaKind: circle | cone | beam. o: x y angle len arc w r dmg tick life delay follow element
  //   weaponId team statusChance knock pull grow critB freezeEvery shape color aura
  const AP = {
    areaKind: 'circle', team: 'player', weaponId: null, x: 0, y: 0, angle: 0, len: 0, arc: 0, w: 0, r: 10, dmg: 0, tick: 0.5, tickT: 0, life: 1,
    delay: 0, follow: false, element: 'physical', statusChance: 0, knock: 0, pull: 0, grow: 0, critB: 0, freezeEvery: 0, pulses: 0, aura: false,
    weight: 0, spread: false, shape: 'ring', color: '#F2EFE6', visual: false, flash: 0, sx: 1, sy: 1, rot: 0
  };
  function createArea(o) {
    const kind = o.areaKind || 'circle', el = o.element || 'physical';
    AP.areaKind = kind; AP.team = o.team || 'player'; AP.weaponId = o.weaponId || null; AP.x = o.x || 0; AP.y = o.y || 0; AP.angle = o.angle || 0;
    AP.len = o.len || 0; AP.arc = o.arc || 0; AP.w = o.w || 0; AP.r = o.r || o.w || 10; AP.dmg = o.dmg || 0; AP.tick = o.tick || 0.5;
    AP.life = o.life || 1; AP.delay = o.delay || 0; AP.tickT = AP.delay; AP.follow = !!o.follow; AP.element = el;
    AP.statusChance = o.statusChance || 0; AP.knock = o.knock || 0; AP.pull = o.pull || 0; AP.grow = o.grow || 0; AP.critB = o.critB || 0;
    AP.freezeEvery = o.freezeEvery || 0; AP.pulses = 0; AP.aura = !!o.aura; AP.weight = o.weight || 0; AP.spread = !!o.spread;
    AP.shape = o.shape || (kind === 'cone' ? 'arc' : kind === 'beam' ? 'beam' : 'ring'); AP.color = o.color || NR.config.ELEMENT_COLORS[el];
    AP.visual = !!o.visual || !(AP.dmg > 0 || AP.pull > 0);
    return NR.world.add('areas', AP);
  }

  function chain(e, dmg, o) {
    o = o || NO;
    const jumps = (o.jumps === undefined ? 3 : o.jumps) + (NR.reactions && NR.reactions.setActive(W().player, 'shock') ? 1 : 0), range = o.range || 120, fall = o.falloff === undefined ? 0.5 : o.falloff;
    const wid = o.weaponId || null, el = o.element || 'shock';
    const vis = grab(), near = grab();
    vis.length = 0;
    let np = 0, n = 0, cur = e, d = dmg;
    arcP.points.length = 0;
    if (o.ox !== undefined && np < 16) { const q = PTS[np++]; q.x = o.ox; q.y = o.oy; arcP.points.push(q); }
    if (np < 16) { const q = PTS[np++]; q.x = e.x; q.y = e.y; arcP.points.push(q); }
    vis.push(e.id);
    if (o.first) strike(e, d, wid, el, o);
    for (let j = 0; j < jumps; j++) {
      NR.spatial.circle(cur.x, cur.y, range, near);
      let best = null, bd = Infinity;
      for (let i = 0; i < near.length; i++) {
        const f = near[i];
        if (f.dead || vis.indexOf(f.id) >= 0) continue;
        const dd = (f.x - cur.x) * (f.x - cur.x) + (f.y - cur.y) * (f.y - cur.y);
        if (dd < bd) { bd = dd; best = f; }
      }
      if (!best) break;
      d *= fall; vis.push(best.id);
      if (np < 16) { const q = PTS[np++]; q.x = best.x; q.y = best.y; arcP.points.push(q); }
      strike(best, d, wid, el, o); n++;
      cur = best;
    }
    drop(); drop();
    if (arcP.points.length > 1) { arcP.element = el; NR.events.emit('chain:arc', arcP); }
    return n;
  }
  function strike(f, d, wid, el, o) {
    HO.weaponId = wid; HO.element = el; HO.crit = !!o.crit; HO.kx = 0; HO.ky = 0; HO.statusChance = o.statusChance || 0;
    HO.noChain = true; HO.dot = false; HO.weight = o.weight || 0; HO.spread = false;
    hitEnemy(f, d, HO);
  }

  function pull(e, x, y, strength) {
    const dx = x - e.x, dy = y - e.y, d = Math.sqrt(dx * dx + dy * dy);
    if (d < 14) return;
    const k = strength * (e.isBoss ? 0.1 : 1) * (NR.reactions && NR.reactions.setActive(W().player, 'void') ? 1.5 : 1) / d;
    e.kbx = (e.kbx || 0) + dx * k; e.kby = (e.kby || 0) + dy * k;
  }

  // ---- per-tick: areas, statuses, knockback
  function dot(e, amt, el, src) {
    HO.weaponId = src; HO.element = el; HO.crit = false; HO.kx = 0; HO.ky = 0; HO.statusChance = 0; HO.noChain = true; HO.dot = true; HO.weight = 0; HO.spread = false;
    hitEnemy(e, amt, HO);
  }
  function tickArea(a, w) {
    const p = w.player;
    if (a.team !== 'player') {
      if (p && !p.dead && a.areaKind === 'circle' && NR.util.dist2(a.x, a.y, p.x, p.y) <= (a.r + p.r) * (a.r + p.r)) damagePlayer(a.dmg, 0, {});
      return;
    }
    const arr = grab();
    let n;
    if (a.areaKind === 'circle') n = NR.spatial.circle(a.x, a.y, a.r, arr);
    else if (a.areaKind === 'cone') n = queryCone(a.x, a.y, a.angle, a.len, a.arc, arr);
    else n = NR.spatial.line(a.x, a.y, a.x + Math.cos(a.angle) * a.len, a.y + Math.sin(a.angle) * a.len, a.w, arr);
    a.pulses++;
    const frz = a.freezeEvery > 0 && a.pulses % a.freezeEvery === 0;
    for (let i = 0; i < n; i++) {
      const e = arr[i]; if (e.dead) continue;
      const dx = e.x - a.x, dy = e.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (a.dmg > 0) {
        const c = critRoll(p, a.critB);
        HO.weaponId = a.weaponId; HO.element = a.element; HO.crit = c.crit;
        if (a.areaKind === 'circle') { HO.kx = dx / d * a.knock; HO.ky = dy / d * a.knock; } else { HO.kx = Math.cos(a.angle) * a.knock; HO.ky = Math.sin(a.angle) * a.knock; }
        HO.statusChance = a.statusChance; HO.noChain = false; HO.dot = false; HO.weight = a.weight; HO.spread = a.spread;
        hitEnemy(e, a.dmg * c.mult, HO);
      }
      if (a.pull > 0 && !e.dead) pull(e, a.x, a.y, a.pull);
      if (frz && !e.dead) applyStatus(e, 'freeze', p ? NR.stats.get(p, 'statusPower') : 1, a.dmg, a.weaponId, 0);
    }
    drop();
  }

  function update(dt) {
    const w = W(), A = NR.config.ARENA, E = w.enemies, K = Math.exp(-8 * dt), p = w.player;
    const AR = w.areas;
    for (let i = 0; i < AR.length; i++) {
      const a = AR[i];
      if (a.dead) continue;
      a.px = a.x; a.py = a.y; a.age += dt; a.life -= dt;
      if (a.follow && p) { a.x = p.x; a.y = p.y; }
      if (a.grow) a.r += a.grow * dt;
      if (!a.visual) {
        a.tickT -= dt;
        if (a.tickT <= 0 && a.age >= a.delay) { a.tickT += a.tick; if (a.tickT < 0) a.tickT = 0; tickArea(a, w); }
      }
      if (a.life <= 0) a.dead = true;
    }
    for (let i = 0; i < E.length; i++) {
      const e = E[i];
      if (e.dead) continue;
      const s = e.status;
      if (s) updateStatus(e, s, dt, w);
      if (e.dead) continue;
      if (e.kbx || e.kby) {
        e.x = NR.util.clamp(e.x + e.kbx * dt, e.r, A.w - e.r); e.y = NR.util.clamp(e.y + e.kby * dt, e.r, A.h - e.r);
        e.kbx *= K; e.kby *= K;
        if (Math.abs(e.kbx) < 1) e.kbx = 0; if (Math.abs(e.kby) < 1) e.kby = 0;
      }
    }
  }

  const tmpN = [];
  function updateStatus(e, s, dt, w) {
    let slow = 0;
    const f = e.flags;
    const b = s.burn;
    if (b && b.t > 0) {
      b.t -= dt; b.acc += dt;
      if (b.acc >= TICK) {
        b.acc -= TICK; dot(e, b.dps * TICK, 'fire', b.src);
        if (e.dead) return;
        if (b.spread && NR.rng.chance(0.3)) {
          const n = NR.spatial.circle(e.x, e.y, e.r + 46, tmpN);
          for (let i = 0; i < n; i++) { const o = tmpN[i]; if (o !== e && !o.dead && !(o.status && o.status.burn && o.status.burn.t > 0)) { applyStatus(o, 'burn', 1, b.dps / ST.burn.dot, b.src, 2); break; } }
        }
      }
    }
    const po = s.poison;
    if (po && po.t > 0) {
      po.t -= dt; po.acc += dt;
      if (po.acc >= TICK) { po.acc -= TICK; dot(e, po.dps * po.stacks * TICK, 'poison', po.src); if (e.dead) return; }
    }
    const ch = s.chill;
    if (ch && ch.t > 0) { ch.t -= dt; slow = ch.stacks * ST.chill.slow; if (ch.t <= 0) ch.stacks = 0; }
    const fz = s.frozen;
    if (fz) { if (fz.t > 0) { fz.t -= dt; slow = 1; } if (fz.imm > 0) fz.imm -= dt; }
    const sn = s.stun;
    if (sn) { if (sn.t > 0) { sn.t -= dt; slow = 1; } if (sn.imm > 0) sn.imm -= dt; }
    const vo = s.void;
    if (vo && vo.t > 0) vo.t -= dt;
    if (f) { f.frozen = !!(fz && fz.t > 0); f.burning = !!(b && b.t > 0); f.poisoned = !!(po && po.t > 0); f.chilled = !!(ch && ch.t > 0); f.stunned = !!(sn && sn.t > 0); f.marked = !!(vo && vo.t > 0); }
    if (slow > 0) {
      if (slow > 0.999) slow = 1; else { const cap = e.isBoss ? BOSS_SLOW_CAP : SLOW_CAP; if (slow > cap) slow = cap; }
      // enemies move themselves before combat.update: undo part of this tick's own movement
      const mx = e.x - e.px, my = e.y - e.py;
      if (mx * mx + my * my < 3600 && (mx || my)) { e.x -= mx * slow; e.y -= my * slow; }
    }
  }

  NR.combat = { reset, hitEnemy, damagePlayer, critRoll, applyStatus, explode, createArea, chain, pull, update, queryCone, sortNear, STATUS: ST };
})();
