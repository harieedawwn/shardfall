// Owned by Horde. The 12 enemy behaviours, elite affixes, spawn markers, separation steering.
// Telegraph contract (read by fx): while an attack winds up, e.flags.telegraph is true, e.ai.state names the phase, e.ai.tx/ty is the aim or target point,
// and `enemy:attack` {enemy,kind,time,x,y,r} is emitted once at the start of the wind-up (time = wind-up length in s, always >= 0.5 for ranged/charge/area).
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  const TAU = Math.PI * 2, BULLET_CAP = 70, SQ_MAX = 400, BQ_MAX = 32, SEP_K = 0.6, EMPTY = {};
  const BLOCKED = { projectile: 1, spread: 1, homing: 1, drone: 1 };
  const AFFIX = { shielded: 1, splitter: 1, toxic: 1, hasty: 1, vampiric: 1, volatile: 1, magnetic: 1 };
  const TOX = { areaKind: 'circle', team: 'enemy', weaponId: null, x: 0, y: 0, r: 34, dmg: 0, tick: 0.5, life: 3, element: 'poison', statusChance: 0, color: '#8BD450', shape: 'ring' };
  const deathP = { enemy: null, weaponId: null, x: 0, y: 0, elite: false, isBoss: false };
  const spawnP = { enemy: null };
  const atkP = { enemy: null, kind: '', time: 0, x: 0, y: 0, r: 0 };
  const tmp = [], sq = [], bq = [];
  let hostile = 0, inited = false, medicSelf = null;

  for (let i = 0; i < SQ_MAX; i++) {
    sq.push({ on: false, defId: '', x: 0, y: 0, t: 0, hpMult: 1, dmgMult: 1, speedMult: 1, a0: '', a1: '', owner: 0, gen: 0,
      ghost: { id: 0, kind: 'enemy', x: 0, y: 0, px: 0, py: 0, r: 10, dead: false, age: 0, defId: '', shape: 'circle', color: '#FFFFFF', rot: 0, sx: 1, sy: 1, flash: 0, isBoss: false, flags: { telegraph: true } } });
  }
  for (let i = 0; i < BQ_MAX; i++) {
    bq.push({ on: false, x: 0, y: 0, r: 0, dmg: 0, t: 0,
      ghost: { id: 0, kind: 'enemy', x: 0, y: 0, px: 0, py: 0, r: 10, dead: false, age: 0, defId: '', shape: 'circle', color: '#FFFFFF', rot: 0, sx: 1, sy: 1, flash: 0, isBoss: false, flags: { telegraph: true } } });
  }

  function def(id) { return NR.data.enemies[id]; }
  function adiff(a, b) { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU; return d < 0 ? -d : d; }
  function reset() {
    for (let i = 0; i < SQ_MAX; i++) sq[i].on = false;
    for (let i = 0; i < BQ_MAX; i++) bq[i].on = false;
    hostile = 0; medicSelf = null; tmp.length = 0;
  }
  function init() {
    if (inited) return;
    inited = true;
    NR.events.on('damage:dealt', onDamage);
    NR.events.on('player:hurt', function (ev) { // Vampiric elites heal when their own touch lands
      if (ev.dodged || !ev.srcId) return;
      const E = NR.world.get().enemies;
      for (let i = 0; i < E.length; i++) {
        const e = E[i];
        if (e.id === ev.srcId && !e.dead && e.affixes && e.affixes.indexOf('vampiric') >= 0) { e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.25); e.flash = 0.05; return; }
      }
    });
  }
  // invulnerability and frontal shields give the damage back (hit already applied by combat)
  function onDamage(p) {
    const t = p.target;
    if (!t || t.dead || p.killed || !t.flags) return;
    if (t.flags.invuln) { t.hp += p.amount; return; }
    if (t.ak === 'shielder' && t.flags.shielded && p.weaponId) {
      const wd = NR.weapons && NR.weapons.def ? NR.weapons.def(p.weaponId) : null;
      if (wd && BLOCKED[wd.kind]) t.hp += p.amount;
    }
  }
  function emitAttack(e, kind, time, x, y, r) {
    atkP.enemy = e; atkP.kind = kind; atkP.time = time; atkP.x = x; atkP.y = y; atkP.r = r;
    NR.events.emit('enemy:attack', atkP);
  }
  function countHostile(W) {
    const P = W.projectiles; let n = 0;
    for (let i = 0; i < P.length; i++) if (P[i].team === 'enemy' && !P[i].dead) n++;
    hostile = n;
  }
  // bullet look per shooter (fx reads b.style): acid glob, sniper needle, trickster dart, turret bolt
  const STYLE = { kiter: 'glob', sniper: 'needle', trickster: 'dart', turret: 'bolt' };
  function fire(e, ang, speed, r, life) {
    const b = NR.projectiles.spawn({ team: 'enemy', x: e.x, y: e.y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: r, dmg: e.dmg, life: life || 4 });
    if (b) { b.color = e.color; b.style = STYLE[e.ak] || 'spike'; hostile++; }
    return b;
  }
  // aim with lead: where the player will be after the bullet's flight time
  function leadAng(e, p, speed) {
    const dx = p.x - e.x, dy = p.y - e.y, tt = Math.sqrt(dx * dx + dy * dy) / speed;
    return Math.atan2(p.y + (p.vy || 0) * tt * 0.85 - e.y, p.x + (p.vx || 0) * tt * 0.85 - e.x);
  }
  function aliveTurrets(owner) { const E = NR.world.get().enemies; let n = 0; for (let i = 0; i < E.length; i++) if (!E[i].dead && E[i].ak === 'turret' && E[i].ai.owner === owner) n++; return n; }

  // ---------- specials ----------
  function thinkSpecial(e, p, W, dt, d, ux, uy, sm) {
    const a = e.ai, ap = e.ap, A = NR.config.ARENA;
    switch (e.ak) {
      case 'juggernaut': { // relentless tank; when close it plants and slams the ground
        if (a.state === 'slam') {
          e.vx = 0; e.vy = 0; a.t -= dt * sm;
          if (a.t <= 0) { tele(e, false); NR.combat.explode(e.x, e.y, ap.blastR, e.dmg * 1.4, { team: 'enemy', element: 'physical', knock: 300 }); a.state = 'move'; a.cd = ap.cd; }
          return true;
        }
        e.vx = ux * e.speed; e.vy = uy * e.speed; e.kbx *= 0.2; e.kby *= 0.2; a.cd -= dt * sm;
        if (d < ap.range && a.cd <= 0) { a.state = 'slam'; a.t = ap.tele; tele(e, true); emitAttack(e, 'blast', ap.tele, e.x, e.y, ap.blastR); }
        return false;
      }
      case 'kidnapper': { // sprints in; on touch it grabs the player and drags them away (dash or a heavy hit breaks free)
        if (a.state === 'grab') {
          a.t -= dt;
          const free = p.dash && p.dash.t > 0, hurt = a.buf - e.hp > e.maxHp * ap.breakHp;
          if (a.t <= 0 || free || hurt || p.dead) { a.state = 'flee'; a.t = 1.2; a.cd = ap.cd; tele(e, false); p.grabbedBy = 0; return true; }
          // drag toward the far side from the arena centre (into the crowd and walls)
          const cx = A.w / 2, cy = A.h / 2, gx = e.x - cx, gy = e.y - cy, gd = Math.sqrt(gx * gx + gy * gy) || 1;
          e.vx = gx / gd * ap.drag; e.vy = gy / gd * ap.drag;
          return true;
        }
        if (a.state === 'flee') { e.vx = -ux * e.speed; e.vy = -uy * e.speed; a.t -= dt * sm; if (a.t <= 0) a.state = 'move'; return false; }
        a.cd -= dt * sm;
        // circle-strafe in, then lunge when the cooldown is up
        const w = a.cd > 0 ? 0.8 : 0;
        e.vx = (ux - uy * a.dir * w) * e.speed; e.vy = (uy + ux * a.dir * w) * e.speed;
        if (a.cd <= 0 && d < e.r + p.r + 4 && !(p.iframes > 0) && !p.grabbedBy) {
          a.state = 'grab'; a.t = ap.grabT; a.buf = e.hp; tele(e, true); p.grabbedBy = e.id;
          NR.combat.damagePlayer(e.dmg, e.id, {}); emitAttack(e, 'melee', 0, e.x, e.y, e.r);
        }
        return false;
      }
      case 'warlord': { // hangs back and empowers nearby enemies (bigger, tougher, harder hitting; red outline)
        if (a.state === 'buff') {
          e.vx = 0; e.vy = 0; a.t -= dt * sm;
          if (a.t <= 0) {
            tele(e, false); a.state = 'move'; a.cd = ap.cd;
            const n = NR.spatial.circle(e.x, e.y, ap.buffR, tmp);
            for (let k = 0; k < n; k++) {
              const o = tmp[k];
              if (o === e || o.dead || o.isBoss || o.flags.empowered || o.ak === 'turret') continue;
              o.flags.empowered = true; o.maxHp *= 1 + ap.hpBoost; o.hp = Math.min(o.maxHp, o.hp * (1 + ap.hpBoost) + o.maxHp * 0.2); o.dmg *= ap.dmgBoost; o.speed *= 1.1;
            }
          }
          return true;
        }
        steerKeep(e, p, d, ux, uy, ap.keepMin, ap.keepMax, dt); a.cd -= dt * sm;
        if (a.cd <= 0) { a.state = 'buff'; a.t = ap.tele; tele(e, true); emitAttack(e, 'blast', ap.tele, e.x, e.y, ap.buffR); }
        return false;
      }
      case 'trickster': { // small, tough, clever: dodges your shots, blinks to your flank, leads its aim
        if (a.hitCd2 > 0) { a.hitCd2 -= dt; if (a.hitCd2 <= 0) tele(e, false); }
        if (a.dodge > 0) { a.dodge -= dt; e.vx = a.dx * e.speed * 2.3; e.vy = a.dy * e.speed * 2.3; }
        else {
          steerKeep(e, p, d, ux, uy, ap.keepMin, ap.keepMax, dt);
          const P = W.projectiles;
          for (let i = 0; i < P.length; i++) {
            const b = P[i];
            if (b.dead || b.team !== 'player' || b.orb) continue;
            const bx = e.x - b.x, by = e.y - b.y, bd2 = bx * bx + by * by;
            if (bd2 > 140 * 140) continue;
            const bs = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 1;
            if ((bx * b.vx + by * b.vy) / bs < 0) continue; // moving away
            const side = (bx * b.vy - by * b.vx) > 0 ? 1 : -1;
            a.dodge = 0.22; a.dx = -b.vy / bs * side; a.dy = b.vx / bs * side; break;
          }
        }
        a.t -= dt;
        if (a.t <= 0 && (d < 170 || e.hp < a.buf - e.maxHp * 0.18)) { // blink behind the player's aim
          const ang = p.aim + Math.PI + NR.rng.range(-0.9, 0.9);
          e.x = NR.util.clamp(p.x + Math.cos(ang) * 230, 40, A.w - 40); e.y = NR.util.clamp(p.y + Math.sin(ang) * 230, 40, A.h - 40);
          e.px = e.x; e.py = e.y; a.t = ap.blinkCd; a.buf = e.hp; a.cd = Math.min(a.cd, 0.5);
          tele(e, true); a.hitCd2 = 0.5; emitAttack(e, 'dash', 0.5, e.x, e.y, e.r + 20);
        }
        if (a.buf === 0) a.buf = e.hp;
        a.cd -= dt * sm;
        if (a.cd <= 0) { a.cd = ap.cd; const ang = leadAng(e, p, ap.bulletSpeed); fire(e, ang, ap.bulletSpeed, ap.bulletR); fire(e, ang + 0.16, ap.bulletSpeed, ap.bulletR); }
        return false;
      }
      case 'engineer': { // picks a spot near you and builds an indestructible turret; kill it mid-build and nothing appears
        if (a.state === 'build') {
          e.vx = 0; e.vy = 0; a.t -= dt * sm;
          if (a.t <= 0) {
            tele(e, false); a.state = 'move'; a.cd = ap.cd;
            const tu = create(def('turret'), defIdT, a.tx, a.ty, { owner: e.id });
            if (tu) { tu.flags.invuln = true; tu.flags.structure = true; tu.ai.t = tu.ap.life; tu.ai.n = tu.ap.ammo; }
          }
          return true;
        }
        a.cd -= dt * sm;
        if (a.state !== 'goto' && a.cd <= 0 && aliveTurrets(e.id) < ap.maxTurrets) {
          const ang = NR.rng.range(0, TAU);
          a.tx = NR.util.clamp(p.x + Math.cos(ang) * 260, 60, A.w - 60); a.ty = NR.util.clamp(p.y + Math.sin(ang) * 260, 60, A.h - 60); a.state = 'goto';
        }
        if (a.state === 'goto') {
          const gx = a.tx - e.x, gy = a.ty - e.y, gd = Math.sqrt(gx * gx + gy * gy) || 1;
          if (gd < 12) { a.state = 'build'; a.t = ap.build; tele(e, true); emitAttack(e, 'summon', ap.build, a.tx, a.ty, 34); }
          else { e.vx = gx / gd * e.speed; e.vy = gy / gd * e.speed; }
          e.rot = Math.atan2(gy, gx);
          return true;
        }
        steerKeep(e, p, d, ux, uy, 300, 420, dt);
        return false;
      }
      case 'turret': { // stationary, untargetable, runs out of ammo or time and falls apart
        e.vx = 0; e.vy = 0; a.t -= dt; a.cd -= dt;
        e.rot = Math.atan2(p.y - e.y, p.x - e.x);
        if (a.cd <= 0 && a.n > 0) { a.cd = ap.rate; a.n--; fire(e, leadAng(e, p, ap.bulletSpeed), ap.bulletSpeed, ap.bulletR); }
        if (a.t <= 0 || a.n <= 0 && a.cd < -0.6) { e.dead = true; NR.events.emit('projectile:impact', { x: e.x, y: e.y, r: 20, element: 'physical', team: 'enemy', surface: 'expire' }); }
        return true;
      }
      case 'mortar': { // lobs shells at where you are going; each landing zone is telegraphed
        steerKeep(e, p, d, ux, uy, ap.keepMin, ap.keepMax, dt); a.cd -= dt * sm;
        if (a.cd <= 0) {
          a.cd = ap.cd;
          for (let k = 0; k < ap.shells; k++) {
            const lx = p.x + (p.vx || 0) * ap.flight * (k === 0 ? 1 : 0.5) + (k ? NR.rng.range(-110, 110) : 0), ly = p.y + (p.vy || 0) * ap.flight * (k === 0 ? 1 : 0.5) + (k ? NR.rng.range(-110, 110) : 0);
            queueBlast(NR.util.clamp(lx, 20, A.w - 20), NR.util.clamp(ly, 20, A.h - 20), ap.blastR, e.dmg, ap.flight + k * 0.18, e);
          }
        }
        return false;
      }
    }
    return false;
  }
  const defIdT = 'turret';

  // ---------- spawning ----------
  function create(d, defId, x, y, o) {
    const W = NR.world.get(), sc = W.scale, hp = d.hp * sc.hp * (o.hpMult || 1), ap = d.aiParams;
    const A = NR.config.ARENA;
    const e = NR.world.add('enemies', {
      defId: defId, ak: d.ai, ap: ap, x: NR.util.clamp(x, d.r, A.w - d.r), y: NR.util.clamp(y, d.r, A.h - d.r), r: d.r, hp: hp, maxHp: hp,
      speed: d.speed * sc.speed * (o.speedMult || 1), dmg: d.dmg * (o.dmgMult || 1), armor: d.armor, xp: d.xp * sc.xp * (o.xpMult || 1), gold: d.gold * sc.gold,
      isBoss: false, phase: 0, affixes: [], contact: d.contact,
      ai: { state: 'move', t: 0, cd: 0, n: 0, dodge: 0, hitCd2: 0, tx: 0, ty: 0, owner: o.owner || 0, gen: o.gen || 0, dir: NR.rng.chance(0.5) ? 1 : -1, ph: NR.rng.range(0, TAU), hit: false, buf: 0, dx: 0, dy: 0, a0: d.armor, hitCd: 0 },
      status: {}, kbx: 0, kby: 0, shape: d.shape, color: d.color, rot: 0, sx: 1, sy: 1, flash: 0,
      flags: { elite: false, boss: false, frozen: false, burning: false, poisoned: false, shielded: false, telegraph: false, invuln: false, hurt: false, enraged: false, empowered: false, structure: false, special: d.tags.indexOf('special') >= 0 }
    });
    if (!e) return null;
    if (ap.cd) e.ai.cd = NR.rng.range(0.6, Math.max(0.7, ap.cd * 0.7));
    if (W.player) e.rot = Math.atan2(W.player.y - e.y, W.player.x - e.x);
    if (o.affixes) for (let i = 0; i < o.affixes.length; i++) applyAffix(e, o.affixes[i]);
    if (o.scale) { e.r *= o.scale; }
    spawnP.enemy = e; NR.events.emit('enemy:spawn', spawnP);
    return e;
  }
  // opts: hpMult, dmgMult, speedMult, affixes, marker (s: wait behind a spawn marker first), owner, gen
  function spawn(defId, x, y, o) {
    o = o || EMPTY;
    const d = def(defId);
    if (!d) return null;
    if (o.marker > 0) {
      for (let i = 0; i < SQ_MAX; i++) {
        const q = sq[i];
        if (q.on) continue;
        q.on = true; q.defId = defId; q.x = x; q.y = y; q.t = o.marker; q.hpMult = o.hpMult || 1; q.dmgMult = o.dmgMult || 1; q.speedMult = o.speedMult || 1;
        q.a0 = o.affixes && o.affixes[0] || ''; q.a1 = o.affixes && o.affixes[1] || ''; q.owner = o.owner || 0; q.gen = o.gen || 0;
        const g = q.ghost; g.x = x; g.y = y; g.px = x; g.py = y; g.r = d.r; g.defId = defId; g.shape = d.shape; g.color = d.color; g.dead = false;
        emitAttack(g, 'summon', o.marker, x, y, d.r + 10);
        return null;
      }
      return null;
    }
    return create(d, defId, x, y, o);
  }
  const affTmp = [];
  function materialize(q) {
    const W = NR.world.get(), p = W.player, d = def(q.defId);
    q.on = false;
    if (!d) return;
    let x = q.x, y = q.y;
    if (p && !p.dead) { // never on top of the player
      const dx = x - p.x, dy = y - p.y, dd = Math.sqrt(dx * dx + dy * dy) || 1;
      if (dd < 110) { x = p.x + dx / dd * 150; y = p.y + dy / dd * 150; }
    }
    affTmp.length = 0; if (q.a0) affTmp.push(q.a0); if (q.a1) affTmp.push(q.a1);
    create(d, q.defId, x, y, { hpMult: q.hpMult, dmgMult: q.dmgMult, speedMult: q.speedMult, affixes: affTmp, owner: q.owner, gen: q.gen });
  }
  function queueBlast(x, y, r, dmg, t, src) {
    for (let i = 0; i < BQ_MAX; i++) {
      const b = bq[i];
      if (b.on) continue;
      b.on = true; b.x = x; b.y = y; b.r = r; b.dmg = dmg; b.t = t;
      const g = b.ghost; g.x = x; g.y = y; g.px = x; g.py = y; g.r = src.r; g.defId = src.defId; g.shape = src.shape; g.color = src.color; g.dead = false;
      emitAttack(g, 'blast', t, x, y, r);
      return;
    }
  }

  function applyAffix(e, id) {
    if (!AFFIX[id] || e.affixes.indexOf(id) >= 0) return;
    if (!e.flags.elite) { // promotion: bigger, tougher, richer
      e.flags.elite = true; e.r *= 1.35; e.hp *= 2.5; e.maxHp *= 2.5; e.xp *= 3; e.gold *= 2.5;
    }
    e.affixes.push(id);
    if (id === 'hasty') e.speed *= 1.35;
    else if (id === 'shielded') { e.maxShield = e.shield = e.maxHp * 0.6; e.flags.aegis = true; } // soaks damage before hp (combat.hitEnemy)
  }

  // ---------- per-tick ----------
  function separate(e) {
    const n = NR.spatial.circle(e.x, e.y, e.r + 2, tmp);
    let ox = 0, oy = 0;
    for (let k = 0; k < n; k++) {
      const o = tmp[k];
      if (o === e || o.dead) continue;
      let dx = e.x - o.x, dy = e.y - o.y;
      const md = e.r + o.r + 2, d2 = dx * dx + dy * dy;
      if (d2 >= md * md) continue;
      let d = Math.sqrt(d2);
      if (d < 0.01) { const a = (e.id * 2.399) % TAU; dx = Math.cos(a); dy = Math.sin(a); d = 1; }
      const share = o.isBoss ? 1 : (o.r * o.r) / (e.r * e.r + o.r * o.r), f = (md - d) * share * SEP_K / d;
      ox += dx * f; oy += dy * f;
    }
    e.x += ox; e.y += oy;
  }
  function nearAlly(o) { return o !== medicSelf && !o.isBoss && o.ak !== 'medic'; }
  function tele(e, on) { e.flags.telegraph = on; }

  function hitPlayer(e, p, W) {
    NR.combat.damagePlayer(e.dmg, e.id, {});
    emitAttack(e, 'melee', 0, e.x, e.y, e.r);
  }
  function steerKeep(e, p, d, ux, uy, keepMin, keepMax, dt) {
    let vx = 0, vy = 0;
    if (d > keepMax) { vx = ux; vy = uy; }
    else if (d < keepMin) { vx = -ux; vy = -uy; }
    else { vx = -uy * e.ai.dir * 0.55; vy = ux * e.ai.dir * 0.55; }
    e.vx = vx * e.speed; e.vy = vy * e.speed;
  }
  const SPECIAL = { juggernaut: 1, kidnapper: 1, warlord: 1, trickster: 1, engineer: 1, turret: 1, mortar: 1 };
  function think(e, p, W, dt, d, ux, uy, sm) {
    const a = e.ai, ap = e.ap, dn = W.danger | 0, cdm = 1 - 0.04 * dn;
    if (SPECIAL[e.ak]) { if (!thinkSpecial(e, p, W, dt, d, ux, uy, sm)) e.rot = Math.atan2(uy, ux); return; }
    switch (e.ak) {
      case 'walker': e.vx = ux * e.speed; e.vy = uy * e.speed; break;
      case 'runner': { // Gold Runner: flees, hugging the walls instead of getting cornered, bursts faster when you get close
        const A2 = NR.config.ARENA, M = 230;
        const wx = e.x < M ? (M - e.x) / M : e.x > A2.w - M ? -(e.x - (A2.w - M)) / M : 0, wy = e.y < M ? (M - e.y) / M : e.y > A2.h - M ? -(e.y - (A2.h - M)) / M : 0;
        let fx = -ux + wx * 1.6 - uy * a.dir * 0.55, fy = -uy + wy * 1.6 + ux * a.dir * 0.55;
        const fm = Math.sqrt(fx * fx + fy * fy) || 1, sp = e.speed * (d < ap.panic ? 1.25 : 1);
        e.vx = fx / fm * sp; e.vy = fy / fm * sp;
        if ((wx !== 0 || wy !== 0) && fx * ux + fy * uy > 0.2) a.dir = -a.dir; // heading toward the player along a wall: turn around
        e.rot = Math.atan2(e.vy, e.vx); return;
      }
      case 'weaver': {
        const w = Math.sin(e.age * 4 + a.ph) * ap.weave;
        e.vx = (ux - uy * w) * e.speed; e.vy = (uy + ux * w) * e.speed; break;
      }
      case 'splitter': {
        const w = Math.sin(e.age * 2.2 + a.ph) * 0.35;
        e.vx = (ux - uy * w) * e.speed; e.vy = (uy + ux * w) * e.speed; break;
      }
      case 'shielder': {
        const want = Math.atan2(uy, ux), diff = Math.atan2(Math.sin(want - e.rot), Math.cos(want - e.rot)), step = ap.turn * dt * sm;
        e.rot += Math.abs(diff) <= step ? diff : (diff < 0 ? -step : step);
        const blocking = adiff(e.rot, want) < ap.arc / 2;
        e.flags.shielded = blocking; e.armor = a.a0 + (blocking ? 60 : 0);
        e.vx = ux * e.speed; e.vy = uy * e.speed; return;
      }
      case 'kiter': {
        if (a.state === 'tele') {
          e.vx = 0; e.vy = 0; a.t -= dt * sm;
          if (a.t <= 0) {
            const ang = Math.atan2(a.ty - e.y, a.tx - e.x);
            fire(e, ang, ap.bulletSpeed, ap.bulletR);
            if (dn >= 3) { fire(e, ang + 0.14, ap.bulletSpeed, ap.bulletR); fire(e, ang - 0.14, ap.bulletSpeed, ap.bulletR); }
            a.state = 'move'; tele(e, false); a.cd = ap.cd * cdm * NR.rng.range(0.85, 1.15);
          }
        } else {
          steerKeep(e, p, d, ux, uy, ap.keepMin, ap.keepMax, dt);
          a.cd -= dt * sm;
          if (a.cd <= 0 && d < ap.keepMax + 80 && hostile < BULLET_CAP) {
            a.state = 'tele'; a.t = ap.tele; a.tx = p.x; a.ty = p.y; tele(e, true);
            emitAttack(e, 'shoot', ap.tele, p.x, p.y, ap.bulletR);
          }
        }
        break;
      }
      case 'sniper': {
        if (a.state === 'tele') {
          e.vx = 0; e.vy = 0; a.t -= dt * sm;
          if (a.t > ap.lockT) { a.tx = p.x; a.ty = p.y; } // tracks, then locks for the last lockT seconds
          if (a.t <= 0) {
            fire(e, Math.atan2(a.ty - e.y, a.tx - e.x), ap.bulletSpeed, ap.bulletR, 3);
            a.state = 'move'; tele(e, false); a.cd = ap.cd * cdm * NR.rng.range(0.9, 1.15);
          }
        } else {
          steerKeep(e, p, d, ux, uy, ap.keepMin, ap.keepMax, dt);
          a.cd -= dt * sm;
          if (a.cd <= 0 && d < ap.keepMax + 140 && hostile < BULLET_CAP) {
            a.state = 'tele'; a.t = ap.tele; a.tx = p.x; a.ty = p.y; tele(e, true);
            emitAttack(e, 'shoot', ap.tele, p.x, p.y, ap.bulletR);
          }
        }
        break;
      }
      case 'bomber': {
        if (a.state === 'tele') {
          e.vx = 0; e.vy = 0; a.t -= dt * sm;
          if (a.t <= 0) {
            tele(e, false);
            NR.combat.explode(e.x, e.y, ap.blastR, e.dmg, { team: 'enemy', element: 'fire' });
            kill(e, null);
          }
        } else {
          e.vx = ux * e.speed; e.vy = uy * e.speed;
          if (d < ap.fuseRange) { a.state = 'tele'; a.t = ap.tele; tele(e, true); emitAttack(e, 'blast', ap.tele, e.x, e.y, ap.blastR); }
        }
        break;
      }
      case 'lunger': {
        if (a.state === 'tele') {
          e.vx = 0; e.vy = 0; a.t -= dt * sm;
          if (a.t <= 0) { a.state = 'dash'; a.t = ap.dashT; a.hit = false; tele(e, false); }
        } else if (a.state === 'dash') {
          e.vx = a.dx * ap.dashSpeed; e.vy = a.dy * ap.dashSpeed; a.t -= dt * sm;
          if (!a.hit && d < e.r + p.r) { a.hit = true; hitPlayer(e, p, W); }
          if (a.t <= 0) { a.state = 'recover'; a.t = ap.recover; }
        } else if (a.state === 'recover') {
          e.vx = 0; e.vy = 0; a.t -= dt * sm;
          if (a.t <= 0) { a.state = 'move'; a.cd = ap.cd * cdm; }
        } else {
          e.vx = ux * e.speed; e.vy = uy * e.speed; a.cd -= dt * sm;
          if (d < ap.stalk && a.cd <= 0) {
            a.state = 'tele'; a.t = ap.tele; a.dx = ux; a.dy = uy; e.rot = Math.atan2(uy, ux); tele(e, true);
            a.tx = e.x + ux * ap.dashSpeed * ap.dashT; a.ty = e.y + uy * ap.dashSpeed * ap.dashT;
            emitAttack(e, 'dash', ap.tele, a.tx, a.ty, ap.width / 2);
          }
        }
        if (a.state !== 'dash' && a.state !== 'tele') e.rot = Math.atan2(uy, ux);
        return;
      }
      case 'summoner': {
        if (a.state === 'tele') {
          e.vx = 0; e.vy = 0; a.t -= dt * sm;
          if (a.t <= 0) {
            tele(e, false); a.state = 'move'; a.cd = ap.cd * cdm;
            let kids = 0; const E = W.enemies;
            for (let i = 0; i < E.length; i++) if (!E[i].dead && E[i].ai.owner === e.id) kids++;
            for (let k = 0; k < ap.count && kids < ap.maxKids; k++, kids++) {
              const ang = NR.rng.range(0, TAU);
              spawn('swarmer', e.x + Math.cos(ang) * (e.r + 16), e.y + Math.sin(ang) * (e.r + 16), { owner: e.id });
            }
          }
        } else {
          steerKeep(e, p, d, ux, uy, ap.keepMin, ap.keepMax, dt);
          a.cd -= dt * sm;
          if (a.cd <= 0 && W.enemies.length < NR.config.CAPS.enemies - 8) {
            a.state = 'tele'; a.t = ap.tele; tele(e, true); emitAttack(e, 'summon', ap.tele, e.x, e.y, 60);
          }
        }
        break;
      }
      case 'medic': {
        if (a.state === 'tele') {
          e.vx = 0; e.vy = 0; a.t -= dt * sm;
          if (a.t <= 0) {
            tele(e, false); a.state = 'move'; a.cd = ap.cd * cdm;
            const n = NR.spatial.circle(e.x, e.y, ap.healR, tmp);
            for (let i = 0; i < n; i++) { const o = tmp[i]; if (o !== e && !o.dead && !o.isBoss && o.hp < o.maxHp) o.hp = Math.min(o.maxHp, o.hp + o.maxHp * ap.healPct); }
          }
        } else {
          medicSelf = e;
          const ally = NR.spatial.nearest(e.x, e.y, 420, nearAlly);
          if (d < ap.flee) { e.vx = -ux * e.speed; e.vy = -uy * e.speed; }
          else if (ally) {
            const tx = ally.x - ux * 60, ty = ally.y - uy * 60, dx = tx - e.x, dy = ty - e.y, dd = Math.sqrt(dx * dx + dy * dy) || 1;
            const k = dd > 16 ? 1 : 0; e.vx = dx / dd * e.speed * k; e.vy = dy / dd * e.speed * k;
          } else { e.vx = ux * e.speed * 0.6; e.vy = uy * e.speed * 0.6; }
          a.cd -= dt * sm;
          if (a.cd <= 0) {
            const n = NR.spatial.circle(e.x, e.y, ap.healR, tmp); let hurt = false;
            for (let i = 0; i < n; i++) { const o = tmp[i]; if (o !== e && !o.dead && !o.isBoss && o.hp < o.maxHp * 0.85) { hurt = true; break; } }
            if (hurt) { a.state = 'tele'; a.t = ap.tele; tele(e, true); emitAttack(e, 'blast', ap.tele, e.x, e.y, ap.healR); } else a.cd = 0.5;
          }
        }
        break;
      }
      case 'phantom': {
        if (a.state === 'vanish') {
          e.vx = 0; e.vy = 0; a.t -= dt * sm;
          if (a.t <= 0) { // reappear at the marked point, vulnerable, winding up
            e.x = a.tx; e.y = a.ty; e.hp -= a.buf; a.buf = 0; e.flags.invuln = false;
            a.state = 'appear'; a.t = ap.appear; e.rot = Math.atan2(p.y - e.y, p.x - e.x);
          }
        } else if (a.state === 'appear') {
          e.vx = 0; e.vy = 0; a.t -= dt * sm; e.rot = Math.atan2(p.y - e.y, p.x - e.x);
          if (a.t <= 0) { a.state = 'strike'; a.t = ap.strikeT; a.hit = false; a.dx = ux; a.dy = uy; tele(e, false); }
        } else if (a.state === 'strike') {
          e.vx = a.dx * ap.strikeSpeed; e.vy = a.dy * ap.strikeSpeed; a.t -= dt * sm;
          if (!a.hit && d < e.r + p.r) { a.hit = true; hitPlayer(e, p, W); }
          if (a.t <= 0) { a.state = 'recover'; a.t = ap.recover; }
        } else if (a.state === 'recover') {
          e.vx = 0; e.vy = 0; a.t -= dt * sm;
          if (a.t <= 0) { a.state = 'move'; a.cd = ap.cd * cdm; }
        } else {
          e.vx = ux * e.speed; e.vy = uy * e.speed; a.cd -= dt * sm;
          if (d < ap.trigger && a.cd <= 0) {
            const A = NR.config.ARENA, ang = NR.rng.range(0, TAU);
            a.tx = NR.util.clamp(p.x + Math.cos(ang) * 125, 30, A.w - 30); a.ty = NR.util.clamp(p.y + Math.sin(ang) * 125, 30, A.h - 30);
            if (NR.util.dist2(a.tx, a.ty, p.x, p.y) < 100 * 100) { a.tx = NR.util.clamp(p.x - Math.cos(ang) * 125, 30, A.w - 30); a.ty = NR.util.clamp(p.y - Math.sin(ang) * 125, 30, A.h - 30); }
            a.state = 'vanish'; a.t = ap.vanish; a.buf = 1e6; e.hp += a.buf; e.flags.invuln = true; tele(e, true);
            emitAttack(e, 'dash', ap.vanish + ap.appear, a.tx, a.ty, e.r + 24);
          }
        }
        if (a.state === 'move') e.rot = Math.atan2(uy, ux);
        return;
      }
      default: e.vx = ux * e.speed; e.vy = uy * e.speed;
    }
    e.rot = Math.atan2(uy, ux);
  }

  // per-tick affix effects: Toxic Trail drops poison pools behind the elite, Magnetic drags the player in
  function eliteTick(e, p, W, dt) {
    const af = e.affixes, a = e.ai;
    for (let k = 0; k < af.length; k++) {
      const id = af[k];
      if (id === 'toxic') {
        a.trT = (a.trT || 0) - dt;
        if (a.trT <= 0 && W.areas.length < 150) { a.trT = 0.38; TOX.x = e.x; TOX.y = e.y; TOX.dmg = e.dmg * 0.45; TOX.weaponId = null; NR.combat.createArea(TOX); }
      } else if (id === 'magnetic' && !p.dead && !p.grabbedBy) {
        const dx = e.x - p.x, dy = e.y - p.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (d < 380 && d > e.r + p.r + 6) { const k2 = 520 * dt * (1 - d / 520); p.kbx += dx / d * k2; p.kby += dy / d * k2; }
      }
    }
  }
  function update(dt) {
    const W = NR.world.get(), p = W.player, E = W.enemies, A = NR.config.ARENA;
    NR.spatial.rebuild(W); // grid must match the post-cleanup list
    countHostile(W);
    for (let i = 0; i < SQ_MAX; i++) { const q = sq[i]; if (q.on && (q.t -= dt) <= 0) materialize(q); }
    for (let i = 0; i < BQ_MAX; i++) {
      const b = bq[i];
      if (b.on && (b.t -= dt) <= 0) { b.on = false; NR.combat.explode(b.x, b.y, b.r, b.dmg, { team: 'enemy', element: 'fire' }); }
    }
    for (let i = 0; i < E.length; i++) {
      const e = E[i];
      if (e.dead || e.isBoss) continue;
      e.px = e.x; e.py = e.y; e.age += dt;
      const st = e.status, f = e.flags;
      f.frozen = !!(st.freeze && st.freeze.t > 0); f.burning = !!(st.burn && st.burn.t > 0); f.poisoned = !!(st.poison && st.poison.t > 0);
      if (e.ai.hitCd > 0) e.ai.hitCd -= dt;
        if (st.pull && st.pull.t > 0) { // status.pull: 260 px/s toward the point, decaying over 0.4 s (Horde moves and expires it)
        const k = 260 * (st.pull.t / 0.4) * dt, dx = st.pull.x - e.x, dy = st.pull.y - e.y, dd = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dd > k) { e.x += dx / dd * k; e.y += dy / dd * k; }
        st.pull.t -= dt;
      }
      if (!p || p.dead) { e.vx = 0; e.vy = 0; continue; }
      if (f.frozen) { e.vx = 0; e.vy = 0; continue; }
      let sm = 1;
      if (st.chill && st.chill.t > 0) sm = 1 - 0.08 * (st.chill.n || st.chill.stacks || 1);
      const dx = p.x - e.x, dy = p.y - e.y, d = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / d, uy = dy / d;
      think(e, p, W, dt, d, ux, uy, sm);
      if (e.dead) continue;
      e.x += e.vx * dt * sm; e.y += e.vy * dt * sm;
      if (f.elite) eliteTick(e, p, W, dt);
      if (e.ai.state !== 'vanish') separate(e);
      e.x = NR.util.clamp(e.x, e.r, A.w - e.r); e.y = NR.util.clamp(e.y, e.r, A.h - e.r);
      if (e.ak === 'kidnapper' && e.ai.state === 'grab' && p.grabbedBy === e.id) { p.x = e.x - Math.cos(e.rot) * (e.r + p.r - 2); p.y = e.y - Math.sin(e.rot) * (e.r + p.r - 2); p.vx = 0; p.vy = 0; }
      if (e.contact && e.ai.hitCd <= 0 && NR.util.dist2(e.x, e.y, p.x, p.y) < (e.r + p.r) * (e.r + p.r)) { hitPlayer(e, p, W); e.ai.hitCd = 0.8; }
    }
  }

  function kill(e, weaponId) {
    if (e.dead) return;
    e.dead = true;
    deathP.enemy = e; deathP.weaponId = weaponId || null; deathP.x = e.x; deathP.y = e.y; deathP.elite = !!(e.flags && e.flags.elite); deathP.isBoss = !!e.isBoss;
    NR.events.emit('enemy:death', deathP);
    if (e.isBoss) { NR.bosses.kill(e); return; }
    const pl = NR.world.get().player;
    if (pl && pl.grabbedBy === e.id) pl.grabbedBy = 0;
    const ap = e.ap;
    if (e.flags.elite) {
      if (NR.pickups) NR.pickups.spawn('chest', e.x, e.y, 0);
      if (e.affixes.indexOf('volatile') >= 0) queueBlast(e.x, e.y, 90, e.dmg * 1.2, 0.7, e);
      if (e.affixes.indexOf('splitter') >= 0 && e.ai.gen === 0) { // Splitter elite: three small, fast copies
        for (let k = 0; k < 3; k++) {
          const ang = e.ai.ph + k * TAU / 3, c = spawn(e.defId, e.x + Math.cos(ang) * e.r * 0.8, e.y + Math.sin(ang) * e.r * 0.8, { gen: 1, hpMult: 0.3, speedMult: 1.2, xpMult: 0.25, scale: 0.55 });
          if (c) c.gold = 0;
        }
      }
    }
    if (e.ak === 'splitter' && e.ai.gen === 0 && ap) {
      for (let k = 0; k < ap.splits; k++) {
        const ang = e.ai.ph + k * Math.PI;
        const c = spawn('splitter', e.x + Math.cos(ang) * e.r * 0.7, e.y + Math.sin(ang) * e.r * 0.7, { gen: 1, hpMult: ap.childHp, speedMult: 1.15, xpMult: 0.4, scale: ap.childScale });
        if (c) c.gold = 0;
      }
    }
  }
  function dissolveAll() {
    const E = NR.world.get().enemies;
    for (let i = 0; i < E.length; i++) E[i].dead = true;
    for (let i = 0; i < SQ_MAX; i++) sq[i].on = false;
    for (let i = 0; i < BQ_MAX; i++) bq[i].on = false;
  }
  function alive() { const E = NR.world.get().enemies; let n = 0; for (let i = 0; i < E.length; i++) if (!E[i].dead) n++; return n; }
  NR.enemies = { init, reset, spawn, update, kill, applyAffix, dissolveAll, def, alive };
})();
