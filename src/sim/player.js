(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  const ACCEL = 2600, FRICTION = 2200, BASE_SPEED = 250, DASH_TIME = 0.14, DEF_DIST = 150, DEF_IFRAMES = 0.25, REVIVE_IFRAMES = 2;
  let prevDash = false, initedEvents = false;
  const hurtP = { amount: 0, hp: 0, srcId: 0, dodged: false, revived: false, x: 0, y: 0 };
  const dashP = { x: 0, y: 0, dx: 0, dy: 0, charges: 0 };
  const deathP = { x: 0, y: 0 };

  function initEvents() {
    if (initedEvents) return;
    initedEvents = true;
    NR.events.on('enemy:death', function (e) {
      const p = NR.world && NR.world.get() ? NR.world.get().player : null;
      if (p && !p.dead) {
        p.ultCharge = Math.min(100, (p.ultCharge || 0) + (e.elite ? 16 : e.isBoss ? 35 : 4));
      }
    });
  }

  function reset() { prevDash = false; }

  function create(charId) {
    const chars = (NR.data && NR.data.characters) || {};
    const ch = chars[charId] || chars.ranger || {};
    const A = NR.config.ARENA, S = NR.stats;
    const dash = ch.dash || {};
    const base = {};
    for (const k in S.defaults) base[k] = S.defaults[k];
    if (dash.charges !== undefined) base.dashCharges = dash.charges;
    if (dash.cd !== undefined) base.dashCooldown = dash.cd;
    if (ch.base) for (const k in ch.base) base[k] = ch.base[k];
    const p = {
      id: 0, kind: 'player', x: A.w / 2, y: A.h / 2, px: A.w / 2, py: A.h / 2, vx: 0, vy: 0, r: 14, dead: false, age: 0,
      shape: ch.shape || 'circle', color: ch.color || '#5FA8D3', rot: 0, sx: 1, sy: 1, flash: 0,
      flags: { invuln: false, hurt: false },
      charId: charId, hp: 0, maxHp: 0, gold: 0, xp: 0, level: 1, pending: 0,
      weapons: [], items: {}, upgrades: [], mods: [], baseStats: base, stats: {},
      dash: { charges: 0, max: 0, cd: 0, t: 0, dx: 1, dy: 0, iframes: dash.iframes !== undefined ? dash.iframes : DEF_IFRAMES, dist: dash.dist || DEF_DIST },
      traits: {}, iframes: 0, hurtT: 0, aim: 0, revives: 0, _revStat: 0, status: {}, kbx: 0, kby: 0
    };
    p.maxHp = 1; p.hp = 1;
    p.ultCharge = 0;
    initEvents();
    S.recalc(p);
    p.hp = p.maxHp; p.dash.charges = p.dash.max;
    NR.world.get().player = p;
    prevDash = false;
    return p;
  }

  function update(dt, intent) {
    const p = NR.world.get().player;
    if (!p || p.dead) return;
    const S = NR.stats, A = NR.config.ARENA, st = p.stats;
    p.px = p.x; p.py = p.y; p.age += dt;
    p.aim = intent.aim;
    if (p.iframes > 0) p.iframes -= dt;
    if (p.hurtT > 0) p.hurtT -= dt;
    p.flags.invuln = p.iframes > 0; p.flags.hurt = p.hurtT > 0;
    if (st.hpRegen > 0 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + st.hpRegen * dt);

    // dash charges recharge one at a time
    const d = p.dash;
    if (d.charges < d.max) {
      if (d.cd <= 0) d.cd = st.dashCooldown;
      d.cd -= dt;
      if (d.cd <= 0) { d.charges++; d.cd = d.charges < d.max ? st.dashCooldown : 0; }
    }
    let mx = intent.mx, my = intent.my;
    const mlen = Math.sqrt(mx * mx + my * my);
    if (mlen > 1) { mx /= mlen; my /= mlen; }
    const wantDash = intent.dash && !prevDash;
    prevDash = intent.dash;
    if (wantDash && d.charges >= 1 && d.t <= 0) {
      let dx = Math.cos(p.aim), dy = Math.sin(p.aim);
      if (mlen >= 0.1) { dx = mx / Math.max(mlen, 1) ; dy = my / Math.max(mlen, 1); const l = Math.sqrt(dx * dx + dy * dy) || 1; dx /= l; dy /= l; }
      d.dx = dx; d.dy = dy; d.t = DASH_TIME;
      if (d.cd <= 0) d.cd = st.dashCooldown;
      d.charges--;
      if (p.iframes < d.iframes) p.iframes = d.iframes;
      p.flags.invuln = true;
      dashP.x = p.x; dashP.y = p.y; dashP.dx = dx; dashP.dy = dy; dashP.charges = d.charges;
      NR.events.emit('player:dash', dashP);
    }
    if (d.t > 0) {
      const sp = d.dist / DASH_TIME;
      p.vx = d.dx * sp; p.vy = d.dy * sp;
      d.t -= dt;
      if (d.t <= 0) { d.t = 0; const ms = BASE_SPEED * st.moveSpeed; p.vx = d.dx * ms; p.vy = d.dy * ms; }
    } else {
      const ms = BASE_SPEED * st.moveSpeed;
      const tx = mx * ms, ty = my * ms;
      const ex = tx - p.vx, ey = ty - p.vy, el = Math.sqrt(ex * ex + ey * ey);
      const mag = (mlen > 0.01 ? ACCEL : FRICTION) * dt;
      if (el <= mag) { p.vx = tx; p.vy = ty; } else { p.vx += ex / el * mag; p.vy += ey / el * mag; }
    }
    // knockback (written by combat) decays quickly
    p.x += (p.vx + p.kbx) * dt; p.y += (p.vy + p.kby) * dt;
    const kd = Math.exp(-9 * dt); p.kbx *= kd; p.kby *= kd;
    if (Math.abs(p.kbx) < 1) p.kbx = 0; if (Math.abs(p.kby) < 1) p.kby = 0;
    const r = p.r;
    if (p.x < r) { p.x = r; if (p.vx < 0) p.vx = 0; } else if (p.x > A.w - r) { p.x = A.w - r; if (p.vx > 0) p.vx = 0; }
    if (p.y < r) { p.y = r; if (p.vy < 0) p.vy = 0; } else if (p.y > A.h - r) { p.y = A.h - r; if (p.vy > 0) p.vy = 0; }
    p.rot = p.aim;

    // Ultimate Ability activation
    if (intent && intent.ult && (p.ultCharge >= 100)) {
      p.ultCharge = 0;
      const TAU = Math.PI * 2, dmgMult = NR.stats.get(p, 'damage');
      if (p.charId === 'dasher') {
        p.iframes = Math.max(p.iframes, 1.6);
        const near = [];
        NR.spatial.circle(p.x, p.y, 420, near);
        const valid = near.filter(function (e) { return !e.dead; });
        const strikes = Math.min(6, Math.max(1, valid.length));
        for (let i = 0; i < strikes; i++) {
          const tgt = valid[i % valid.length] || p;
          NR.combat.hitEnemy(tgt, Math.round(90 * dmgMult), { weaponId: 'ult', crit: true, element: 'physical' });
          NR.combat.createArea({ areaKind: 'cone', x: tgt.x, y: tgt.y, len: 130, arc: 2.4, life: 0.25, element: 'shock', team: 'player' });
        }
      } else if (p.charId === 'bulwark') {
        p.iframes = Math.max(p.iframes, 2.5);
        const P = NR.world.get().projectiles;
        for (let i = 0; i < P.length; i++) {
          if (P[i].team === 'enemy' && Math.hypot(P[i].x - p.x, P[i].y - p.y) < 550) P[i].dead = true;
        }
        NR.combat.explode(p.x, p.y, 450, Math.round(110 * dmgMult), { team: 'player', element: 'physical', weaponId: null });
        const near = [];
        NR.spatial.circle(p.x, p.y, 450, near);
        for (let i = 0; i < near.length; i++) {
          if (!near[i].dead) { near[i].status = near[i].status || {}; near[i].status.stun = { t: 3.0 }; }
        }
      } else if (p.charId === 'tinker') {
        for (let i = 0; i < 2; i++) {
          NR.world.add('drones', { x: p.x + (i ? 25 : -25), y: p.y - 20, r: 10, shape: 'diamond', color: '#5FB49C', rot: 0, sx: 1, sy: 1, flash: 0, life: 15 });
        }
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * TAU;
          NR.projectiles.spawn({
            team: 'player', weaponId: 'seeker', x: p.x, y: p.y,
            vx: Math.cos(a) * 400, vy: Math.sin(a) * 400, r: 6,
            dmg: Math.round(28 * dmgMult), life: 4, pierce: 2, ricochet: 2, shape: 'diamond', color: '#5FB49C'
          });
        }
        p.dash.charges = p.dash.max;
      } else {
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * TAU;
          NR.projectiles.spawn({
            team: 'player', weaponId: 'pistol', x: p.x, y: p.y,
            vx: Math.cos(a) * 600, vy: Math.sin(a) * 600, r: 6,
            dmg: Math.round(38 * dmgMult), life: 3, pierce: 5, ricochet: 3, shape: 'star', color: '#FFD43B'
          });
        }
        NR.combat.explode(p.x, p.y, 220, Math.round(60 * dmgMult), { team: 'player', element: 'fire', weaponId: 'pistol' });
      }
    }
  }

  // amount is final (armor and scaling already applied by combat.damagePlayer)
  function hurt(amount, srcId, opts) {
    const p = NR.world.get().player;
    if (!p || p.dead) return false;
    if (opts && opts.dodged) {
      hurtP.amount = 0; hurtP.hp = p.hp; hurtP.srcId = srcId || 0; hurtP.dodged = true; hurtP.revived = false; hurtP.x = p.x; hurtP.y = p.y;
      NR.events.emit('player:hurt', hurtP);
      return false;
    }
    if (p.iframes > 0 || !(amount > 0)) return false;
    p.hp -= amount;
    p.iframes = NR.config.HURT_IFRAMES; p.hurtT = 0.25;
    p.flags.invuln = true; p.flags.hurt = true;
    let revived = false;
    if (p.hp <= 0) {
      if (p.revives > 0) { p.revives--; p.hp = Math.max(1, Math.round(p.maxHp * 0.5)); p.iframes = REVIVE_IFRAMES; revived = true; }
    }
    hurtP.amount = amount; hurtP.hp = p.hp; hurtP.srcId = srcId || 0; hurtP.dodged = false; hurtP.revived = revived; hurtP.x = p.x; hurtP.y = p.y;
    NR.events.emit('player:hurt', hurtP);
    if (p.hp <= 0) {
      p.hp = 0; p.dead = true;
      deathP.x = p.x; deathP.y = p.y;
      NR.events.emit('player:death', deathP);
    }
    return true;
  }
  function heal(n) {
    const p = NR.world.get().player;
    if (!p || p.dead || !(n > 0)) return 0;
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + n);
    return p.hp - before;
  }
  function addGold(n) {
    const p = NR.world.get().player;
    if (!p || !(n > 0)) return;
    p.gold += n;
    NR.world.get().stats.goldEarned += n;
  }
  function spendGold(n) {
    const p = NR.world.get().player;
    if (!p || n < 0 || p.gold < n) return false;
    p.gold -= n;
    return true;
  }
  NR.player = { create, update, hurt, heal, addGold, spendGold, reset };
})();
