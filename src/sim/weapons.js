// Arsenal - weapon inventory (add/remove/evolve), stat resolution and the firing logic of every behavior kind.
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  const TWO_PI = 6.283185307179586;
  const gainP = { weaponId: '', slot: 0, level: 1, isNew: true };
  const fireP = { weaponId: '', slot: 0, kind: '', x: 0, y: 0, angle: 0 };
  const evoP = { slot: 0, from: '', into: '' };
  const RT = new WeakMap();           // runtime state per owned weapon object (never serialized into the snapshot)
  const R = {};                       // resolved scratch for the hot path
  const Q = [], Q2 = [];
  const HO = { weaponId: null, element: 'physical', crit: false, kx: 0, ky: 0, statusChance: 0, noChain: false, dot: false, weight: 0, spread: false };
  const XO = { team: 'player', element: 'physical', weaponId: null, statusChance: 0, knock: 0, crit: false, weight: 0, spread: false };
  const AO = { areaKind: 'circle', x: 0, y: 0, angle: 0, len: 0, arc: 0, w: 0, r: 0, dmg: 0, tick: 0.5, life: 0.1, delay: 0, follow: false, element: 'physical',
    weaponId: null, statusChance: 0, knock: 0, color: '#fff', shape: 'ring', visual: true, aura: false, freezeEvery: 0, critB: 0, weight: 0, spread: false };
  const CHO = { jumps: 3, range: 130, falloff: 0.8, weaponId: null, ox: 0, oy: 0, statusChance: 0, weight: 0, crit: false, first: true };
  const KEYS = ['dmg', 'rate', 'speed', 'range', 'count', 'pierce', 'area', 'crit', 'statusChance', 'knock', 'spread', 'jitter', 'r', 'bounce', 'wbounce', 'blast', 'blastDmg',
    'split', 'homing', 'pull', 'w', 'arc', 'patch', 'spreadFire', 'wave', 'stormArcs', 'aftershock', 'orad', 'ospd', 'breathe', 'jumps', 'jrange', 'falloff', 'stun', 'tick',
    'freezeEvery', 'plague', 'cloudDmg', 'cloudLife', 'trig', 'arm', 'cluster', 'dbl'];
  let sweepT = 0, plagueDepth = 0, inited = false;

  function W() { return NR.world.get(); }
  function def(id) { return NR.data.weapons[id]; }
  function find(p, id) { for (let i = 0; i < p.weapons.length; i++) if (p.weapons[i].id === id) return i; return -1; }
  function slots(p) { return Math.round(NR.stats.get(p, 'weaponSlots')); }
  function rtOf(w) { let r = RT.get(w); if (!r) { r = { sig: '', chk: 0, shots: 0, ang: 0, flip: 1, area: null, aid: 0, patchT: 0 }; RT.set(w, r); } return r; }

  function init() {
    if (inited) return;
    inited = true;
    NR.events.on('damage:dealt', function (e) { // per-weapon damage total shown by the UI
      const p = W().player;
      if (!p || !e.weaponId) return;
      for (let i = 0; i < p.weapons.length; i++) if (p.weapons[i].id === e.weaponId) { p.weapons[i].dealt = (p.weapons[i].dealt || 0) + e.amount; return; }
    });
    NR.events.on('enemy:death', function (e) { // Toxic Cloud Lv5 "plague": poisoned kills burst into gas
      const p = W().player, en = e.enemy;
      if (!p || !en || !en.status || !en.status.poison || !(en.status.poison.t > 0) || plagueDepth >= 3) return;
      const i = find(p, 'toxic_cloud');
      if (i < 0) return;
      resolveInto(p, p.weapons[i], R);
      if (!(R.plague > 0)) return;
      plagueDepth++;
      XO.team = 'player'; XO.element = 'poison'; XO.weaponId = 'toxic_cloud'; XO.statusChance = 1; XO.knock = 80; XO.crit = false; XO.weight = 0; XO.spread = false;
      NR.combat.explode(e.x, e.y, 70 * Math.sqrt(R.area), R.dmg * 1.3, XO);
      plagueDepth--;
    });
  }
  function reset() { Q.length = 0; Q2.length = 0; sweepT = 0; plagueDepth = 0; }

  function canAdd(p, id) {
    const d = def(id);
    if (!d || d.evolved) return false;
    const i = find(p, id);
    if (i >= 0) return p.weapons[i].lvl < NR.config.MAX_LEVEL;
    return p.weapons.length < slots(p);
  }
  function add(p, id) {
    const d = def(id);
    if (!d) return { ok: false, slot: -1, level: 0, reason: 'unknown' };
    let i = find(p, id), isNew = false;
    if (i >= 0) {
      if (d.evolved || p.weapons[i].lvl >= NR.config.MAX_LEVEL) return { ok: false, slot: i, level: p.weapons[i].lvl, reason: 'max' };
      p.weapons[i].lvl++;
    } else {
      if (p.weapons.length >= slots(p)) return { ok: false, slot: -1, level: 0, reason: 'slots' };
      p.weapons.push({ id: id, lvl: 1, slot: p.weapons.length, cd: 0, paid: 0, dealt: 0 });
      i = p.weapons.length - 1; isNew = true;
    }
    gainP.weaponId = id; gainP.slot = i; gainP.level = p.weapons[i].lvl; gainP.isNew = isNew;
    NR.events.emit('weapon:gain', gainP);
    return { ok: true, slot: i, level: p.weapons[i].lvl, reason: '' };
  }
  function killOwned(id) { // remove drones, saws and auras that belong to a weapon id
    const w = W(), D = w.drones, P = w.projectiles, A = w.areas;
    for (let i = 0; i < D.length; i++) if (D[i].wid === id) D[i].dead = true;
    for (let i = 0; i < P.length; i++) if (P[i].orb && P[i].weaponId === id) P[i].dead = true;
    for (let i = 0; i < A.length; i++) if (A[i].aura && A[i].weaponId === id) A[i].dead = true;
  }
  function remove(p, slot) {
    const w = p.weapons[slot];
    if (!w) return null;
    p.weapons.splice(slot, 1);
    for (let i = 0; i < p.weapons.length; i++) p.weapons[i].slot = i;
    if (find(p, w.id) < 0) killOwned(w.id);
    return w.id;
  }
  function evolve(p, slot, intoId) {
    const w = p.weapons[slot];
    if (!w || !def(intoId)) return;
    const old = w.id;
    evoP.slot = slot; evoP.from = old; evoP.into = intoId;
    w.id = intoId; w.lvl = 1;
    killOwned(old);
    NR.events.emit('weapon:evolve', evoP);
  }

  // Stats applied here: damage attackSpeed projSpeed range projectiles pierce area knockback (crit/status are rolled by combat)
  function resolveInto(p, w, out) {
    const d = def(w.id), S = p.stats;
    const L = d.levels[Math.min(w.lvl, d.levels.length) - 1];
    for (let i = 0; i < KEYS.length; i++) out[KEYS[i]] = 0;
    for (const k in L) out[k] = L[k];
    out.dmg = L.dmg * S.damage; out.rate = L.rate * S.attackSpeed; out.speed = L.speed * S.projSpeed; out.range = L.range * S.range;
    out.count = L.count + Math.round(S.projectiles); out.pierce = L.pierce >= 99 ? L.pierce : L.pierce + Math.round(S.pierce);
    out.area = L.area * S.area; out.knock = L.knock * S.knockback;
    return out;
  }
  function resolve(p, slot) { // public, allocates: for UI and tests
    const o = {};
    resolveInto(p, p.weapons[slot], o);
    return o;
  }

  function emitFire(w, i, d, p, a) {
    fireP.weaponId = w.id; fireP.slot = i; fireP.kind = d.kind; fireP.x = p.x; fireP.y = p.y; fireP.angle = a;
    NR.events.emit('weapon:fire', fireP);
  }
  function rsize(d, n) { return d.size * Math.min(2.5, Math.sqrt(n.area)); }

  // ---- projectile / spread / homing
  function fireBullets(p, w, i, d, n, a) {
    const cnt = Math.max(1, n.count), fan = d.kind === 'spread', rng = NR.rng, blast = n.blast > 0;
    const r = rsize(d, n);
    for (let k = 0; k < cnt; k++) {
      let ang = cnt > 1 ? a + (k / (cnt - 1) - 0.5) * n.spread : a;
      if (n.jitter > 0) ang += (rng.next() - 0.5) * 2 * n.jitter;
      const cr = NR.combat.critRoll(p, n.crit);
      const sp = fan ? n.speed * (0.9 + rng.next() * 0.2) : n.speed;
      const b = NR.projectiles.begin();
      b.weaponId = w.id; b.x = p.x + Math.cos(ang) * (p.r + 6); b.y = p.y + Math.sin(ang) * (p.r + 6);
      b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp; b.r = r; b.dmg = n.dmg * cr.mult; b.crit = cr.crit; b.element = d.element;
      b.pierce = n.pierce; b.life = n.range / sp; b.knock = n.knock; b.statusChance = n.statusChance; b.homing = n.homing; b.hr = 420;
      b.bounce = n.bounce; b.wb = n.wbounce; b.split = n.split; b.pullS = d.kind === 'homing' ? n.pull : 0; b.weight = d.hit; b.spread = n.spreadFire;
      if (blast) { b.onEnd = NR.projectiles.END_EXPLODE; b.blastR = n.blast * Math.sqrt(n.area); b.bd = n.blastDmg || 0.6; }
      b.shape = d.shape; b.color = d.color; b.size = r; b.trail = d.trail; b.rot = ang;
      NR.projectiles.launch();
    }
    emitFire(w, i, d, p, a);
  }

  // ---- beams: line segment queries (lancer) or cones (flamer, inferno jet)
  function fireBeam(p, w, i, d, n, a, rt) {
    const cone = n.arc > 0, cnt = cone ? 1 : Math.max(1, n.count), lim = n.pierce + 1;
    for (let k = 0; k < cnt; k++) {
      const ang = a + (k - (cnt - 1) / 2) * 0.14, cs = Math.cos(ang), sn = Math.sin(ang);
      const wd = cone ? 0 : n.w * Math.sqrt(n.area);
      let found, len = n.range;
      if (cone) {
        const arc = n.arc * (1 + 0.25 * (Math.max(1, n.count) - 1)) * Math.sqrt(n.area);
        found = NR.combat.queryCone(p.x, p.y, ang, len, arc, Q);
      } else found = NR.spatial.line(p.x + cs * p.r, p.y + sn * p.r, p.x + cs * len, p.y + sn * len, wd, Q);
      if (found > 1) NR.combat.sortNear(Q, p.x, p.y);
      const m = Math.min(found, lim);
      for (let j = 0; j < m; j++) {
        const e = Q[j];
        if (e.dead) continue;
        const cr = NR.combat.critRoll(p, n.crit);
        const dx = e.x - p.x, dy = e.y - p.y, dd = Math.sqrt(dx * dx + dy * dy) || 1;
        HO.weaponId = w.id; HO.element = d.element; HO.crit = cr.crit; HO.kx = dx / dd * n.knock; HO.ky = dy / dd * n.knock; HO.statusChance = n.statusChance;
        HO.noChain = false; HO.dot = false; HO.weight = d.hit; HO.spread = n.spreadFire > 0;
        NR.combat.hitEnemy(e, n.dmg * cr.mult, HO);
      }
      if (!cone && found > lim) { const last = Q[lim - 1]; len = Math.min(len, Math.sqrt((last.x - p.x) * (last.x - p.x) + (last.y - p.y) * (last.y - p.y)) + last.r); }
      AO.areaKind = cone ? 'cone' : 'beam'; AO.x = p.x; AO.y = p.y; AO.angle = ang; AO.len = len; AO.arc = cone ? n.arc * Math.sqrt(n.area) : 0; AO.w = wd; AO.r = cone ? len : wd;
      AO.dmg = 0; AO.life = cone ? 0.11 : 0.12; AO.element = d.element; AO.color = d.color; AO.shape = cone ? 'arc' : 'beam'; AO.weaponId = w.id; AO.visual = true;
      AO.follow = false; AO.aura = false; AO.tick = 0.5; AO.delay = 0; AO.statusChance = 0; AO.knock = 0; AO.freezeEvery = 0;
      NR.combat.createArea(AO);
      if (found > 0) emitImpact(p.x + cs * Math.min(len, Math.sqrt((Q[0].x - p.x) * (Q[0].x - p.x) + (Q[0].y - p.y) * (Q[0].y - p.y))), p.y + sn * Math.min(len, Math.sqrt((Q[0].x - p.x) * (Q[0].x - p.x) + (Q[0].y - p.y) * (Q[0].y - p.y))), d);
      if (n.patch > 0 && (rt.shots++ % 3) === 0) { // Inferno Jet: scorched ground at the tip
        AO.areaKind = 'circle'; AO.x = p.x + cs * len * 0.8; AO.y = p.y + sn * len * 0.8; AO.r = 46 * Math.sqrt(n.area); AO.len = 0; AO.arc = 0; AO.w = 0; AO.angle = 0;
        AO.dmg = n.dmg * 0.55; AO.tick = 0.4; AO.life = 2.4; AO.element = 'fire'; AO.statusChance = 0.4; AO.shape = 'ring'; AO.color = d.color; AO.visual = false; AO.weight = 0; AO.spread = true;
        NR.combat.createArea(AO); AO.spread = false;
      }
    }
    emitFire(w, i, d, p, a);
  }
  const impP = { x: 0, y: 0, r: 6, element: 'physical', team: 'player', surface: 'enemy' };
  function emitImpact(x, y, d) { impP.x = x; impP.y = y; impP.element = d.element; NR.events.emit('projectile:impact', impP); }

  // ---- melee: katana slashes (arc) and maul smash (circle)
  function fireMelee(p, w, i, d, n, a, rt) {
    if (n.r > 0) { // maul
      const cr = NR.combat.critRoll(p, n.crit), R2 = n.r * Math.sqrt(n.area);
      const cx = p.x + Math.cos(a) * n.range, cy = p.y + Math.sin(a) * n.range;
      XO.team = 'player'; XO.element = d.element; XO.weaponId = w.id; XO.statusChance = n.statusChance; XO.knock = n.knock; XO.crit = cr.crit; XO.weight = d.hit; XO.spread = false;
      NR.combat.explode(cx, cy, R2, n.dmg * cr.mult, XO);
      if (n.aftershock > 0) {
        AO.areaKind = 'circle'; AO.x = cx; AO.y = cy; AO.r = R2 * 1.55; AO.dmg = n.dmg * 0.6; AO.tick = 5; AO.delay = 0.32; AO.life = 0.4; AO.element = d.element;
        AO.statusChance = n.statusChance; AO.knock = n.knock * 0.6; AO.color = d.color; AO.shape = 'ring'; AO.visual = false; AO.weight = d.hit * 0.6; AO.len = 0; AO.arc = 0; AO.w = 0;
        AO.follow = false; AO.aura = false; AO.weaponId = w.id; AO.critB = n.crit; AO.freezeEvery = 0;
        NR.combat.createArea(AO);
      }
      emitFire(w, i, d, p, a);
      return;
    }
    const cnt = Math.max(1, n.count), len = n.range * Math.sqrt(n.area);
    for (let k = 0; k < cnt; k++) {
      const ang = a + (k === 0 ? 0 : k === 1 ? Math.PI : k === 2 ? Math.PI / 2 : -Math.PI / 2) + rt.flip * 0.0;
      const found = NR.combat.queryCone(p.x, p.y, ang, len, n.arc, Q);
      let first = null;
      for (let j = 0; j < found; j++) {
        const e = Q[j];
        if (e.dead) continue;
        const cr = NR.combat.critRoll(p, n.crit), dx = e.x - p.x, dy = e.y - p.y, dd = Math.sqrt(dx * dx + dy * dy) || 1;
        HO.weaponId = w.id; HO.element = d.element; HO.crit = cr.crit; HO.kx = dx / dd * n.knock; HO.ky = dy / dd * n.knock; HO.statusChance = n.statusChance;
        HO.noChain = false; HO.dot = false; HO.weight = d.hit; HO.spread = false;
        NR.combat.hitEnemy(e, n.dmg * cr.mult, HO);
        if (!first && !e.dead) first = e;
      }
      if (first && n.stormArcs > 0) {
        CHO.jumps = n.stormArcs; CHO.range = 140; CHO.falloff = 0.8; CHO.weaponId = w.id; CHO.ox = p.x; CHO.oy = p.y; CHO.statusChance = 0; CHO.weight = 0; CHO.crit = false; CHO.first = false; CHO.element = 'shock';
        NR.combat.chain(first, n.dmg * 0.5, CHO);
      }
      AO.areaKind = 'cone'; AO.x = p.x; AO.y = p.y; AO.angle = ang; AO.len = len; AO.arc = n.arc; AO.w = 0; AO.r = len; AO.dmg = 0; AO.life = 0.16; AO.element = d.element; AO.color = d.color;
      AO.shape = 'arc'; AO.weaponId = w.id; AO.visual = true; AO.follow = false; AO.aura = false; AO.tick = 0.5; AO.delay = 0; AO.statusChance = 0; AO.knock = 0; AO.freezeEvery = 0;
      NR.combat.createArea(AO);
      if (n.wave > 0) {
        const cr = NR.combat.critRoll(p, n.crit), b = NR.projectiles.begin();
        b.weaponId = w.id; b.x = p.x + Math.cos(ang) * (p.r + 10); b.y = p.y + Math.sin(ang) * (p.r + 10); b.vx = Math.cos(ang) * 640; b.vy = Math.sin(ang) * 640;
        b.r = 16 * Math.sqrt(n.area); b.dmg = n.dmg * n.wave * cr.mult; b.crit = cr.crit; b.element = d.element; b.pierce = 4; b.life = 0.6; b.knock = n.knock * 0.5;
        b.statusChance = n.statusChance; b.weight = d.hit * 0.5; b.shape = 'arc'; b.color = d.color; b.size = b.r; b.trail = true; b.rot = ang; b.sx = 1.6; b.sy = 0.7;
        NR.projectiles.launch();
      }
    }
    emitFire(w, i, d, p, a);
  }

  // ---- chain lightning (arc coil / tempest coil): nearest targets, each bolt jumps on
  function fireChain(p, w, i, d, n, a) {
    const found = NR.spatial.circle(p.x, p.y, n.range, Q);
    if (!found) return false;
    NR.combat.sortNear(Q, p.x, p.y);
    const cnt = Math.min(Math.max(1, n.count), found);
    for (let k = 0; k < cnt; k++) {
      const e = Q[k];
      if (e.dead) continue;
      const cr = NR.combat.critRoll(p, n.crit);
      CHO.jumps = n.jumps; CHO.range = n.jrange; CHO.falloff = n.falloff; CHO.weaponId = w.id; CHO.ox = p.x; CHO.oy = p.y; CHO.statusChance = n.statusChance;
      CHO.weight = d.hit; CHO.crit = cr.crit; CHO.first = true; CHO.element = d.element;
      NR.combat.chain(e, n.dmg * cr.mult, CHO);
    }
    emitFire(w, i, d, p, Math.atan2(Q[0].y - p.y, Q[0].x - p.x));
    return true;
  }

  // ---- thrown: grenade (manual) and toxin mine (auto)
  function fireThrown(p, w, i, d, n, a, rt) {
    const mine = n.trig > 0, cnt = Math.max(1, n.count);
    const tgt = NR.spatial.nearest(p.x, p.y, n.range, null);
    if (mine && !tgt) return false;
    const bs = Math.sqrt(n.area);
    for (let k = 0; k < cnt; k++) {
      let tx, ty;
      if (tgt) { tx = tgt.x; ty = tgt.y; } else { tx = p.x + Math.cos(a) * n.range * 0.65; ty = p.y + Math.sin(a) * n.range * 0.65; }
      if (cnt > 1 || mine) { tx += (NR.rng.next() - 0.5) * 90; ty += (NR.rng.next() - 0.5) * 90; }
      if (mine) { tx = p.x + (tx - p.x) * 0.6; ty = p.y + (ty - p.y) * 0.6; }
      let dx = tx - p.x, dy = ty - p.y, dist = Math.sqrt(dx * dx + dy * dy) || 1;
      if (dist > n.range) { dx *= n.range / dist; dy *= n.range / dist; dist = n.range; }
      const cr = NR.combat.critRoll(p, n.crit), b = NR.projectiles.begin();
      b.weaponId = w.id; b.x = p.x; b.y = p.y; b.dmg = n.dmg * cr.mult; b.crit = cr.crit; b.element = d.element; b.statusChance = n.statusChance; b.knock = n.knock; b.weight = d.hit;
      b.shape = d.shape; b.color = d.color; b.size = d.size; b.r = d.size; b.trail = d.trail; b.blastR = n.blast * bs;
      if (mine) {
        const k2 = 3; b.vx = dx / dist * dist * k2; b.vy = dy / dist * dist * k2; b.drag = k2; b.mine = 1; b.arm = n.arm; b.trig = 60 * bs; b.life = 14;
        b.onEnd = NR.projectiles.END_CLOUD; b.cdmg = n.cloudDmg; b.cl = n.cloudLife; b.dbl = n.dbl; b.bd = 1;
      } else {
        const sp = n.speed; b.vx = dx / dist * sp; b.vy = dy / dist * sp; b.life = dist / sp; b.ghost = 1; b.bd = 1;
        b.onEnd = n.cluster > 0 ? NR.projectiles.END_CLUSTER : NR.projectiles.END_EXPLODE; b.cn = n.cluster;
      }
      NR.projectiles.launch();
    }
    emitFire(w, i, d, p, a);
    return true;
  }

  // ---- orbiting saws
  function tendOrbit(p, w, d, rt) {
    resolveInto(p, w, R);
    const cnt = Math.max(1, R.count), sig = w.id + ':' + cnt + ':' + Math.round(R.dmg * 10) + ':' + Math.round(R.orad * R.area) + ':' + Math.round(R.ospd * 10) + ':' + R.breathe + ':' + Math.round(R.rate * 10);
    const P = W().projectiles;
    let live = 0, stale = false;
    for (let i = 0; i < P.length; i++) { const b = P[i]; if (b.orb && !b.dead && b.weaponId === w.id) { live++; if (rt.sig !== sig) { b.dead = true; stale = true; } } }
    if (rt.sig === sig && live === cnt) return;
    if (rt.sig === sig && live !== cnt) { for (let i = 0; i < P.length; i++) { const b = P[i]; if (b.orb && !b.dead && b.weaponId === w.id) b.dead = true; } }
    rt.sig = sig;
    const r = rsize(d, R);
    for (let k = 0; k < cnt; k++) {
      const b = NR.projectiles.begin();
      b.weaponId = w.id; b.x = p.x; b.y = p.y; b.orb = 1; b.oa = k / cnt * TWO_PI + rt.ang; b.orad = R.orad * Math.sqrt(R.area); b.ospd = R.ospd; b.br = R.breathe > 0 ? 0.4 : 0;
      b.rehit = 1 / Math.max(0.2, R.rate); b.dmg = R.dmg; b.cb = R.crit; b.element = d.element; b.pierce = 99; b.life = 1e9; b.knock = R.knock; b.statusChance = R.statusChance;
      b.weight = d.hit; b.r = r; b.size = r; b.shape = d.shape; b.color = d.color; b.trail = d.trail;
      NR.projectiles.launch();
    }
  }

  // ---- drones
  function tendDrones(p, w, i, d, rt, dt) {
    resolveInto(p, w, R);
    const cnt = Math.max(1, R.count), w0 = W(), D = w0.drones;
    let mine = 0;
    for (let k = 0; k < D.length; k++) if (D[k].wid === w.id && !D[k].dead) mine++;
    if (mine > cnt) { for (let k = D.length - 1; k >= 0 && mine > cnt; k--) if (D[k].wid === w.id && !D[k].dead) { D[k].dead = true; mine--; } }
    while (mine < cnt) {
      const dr = NR.world.add('drones', { x: p.x, y: p.y, r: d.size + 3, wid: w.id, ang: 0, cd: 0.3 + 0.12 * mine, shape: d.shape === 'hex' ? 'hex' : 'diamond', color: d.color, rot: 0, sx: 1, sy: 1, flash: 0, idx: mine });
      if (!dr) break;
      mine++;
    }
    rt.ang += dt * 1.6;
    let idx = 0;
    for (let k = 0; k < D.length; k++) {
      const dr = D[k];
      if (dr.dead || dr.wid !== w.id) continue;
      dr.px = dr.x; dr.py = dr.y; dr.age += dt;
      const a = rt.ang + idx / cnt * TWO_PI, rad = 56 + (cnt > 4 ? 14 : 0), tx = p.x + Math.cos(a) * rad, ty = p.y + Math.sin(a) * rad, f = Math.min(1, 10 * dt);
      dr.x += (tx - dr.x) * f; dr.y += (ty - dr.y) * f; idx++;
      dr.cd -= dt;
      const tg = NR.spatial.nearest(dr.x, dr.y, R.range, null);
      if (tg) dr.rot = Math.atan2(tg.y - dr.y, tg.x - dr.x);
      if (dr.cd <= 0 && tg) {
        let ang = Math.atan2(tg.y - dr.y, tg.x - dr.x);
        if (R.jitter > 0) ang += (NR.rng.next() - 0.5) * 2 * R.jitter;
        const cr = NR.combat.critRoll(p, R.crit), b = NR.projectiles.begin(), sp = R.speed;
        b.weaponId = w.id; b.x = dr.x; b.y = dr.y; b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp; b.r = d.size; b.dmg = R.dmg * cr.mult; b.crit = cr.crit; b.element = d.element;
        b.pierce = R.pierce; b.life = R.range / sp * 1.15; b.knock = R.knock; b.statusChance = R.statusChance; b.homing = R.homing; b.hr = 360; b.weight = d.hit;
        b.shape = d.shape === 'hex' ? 'diamond' : 'circle'; b.color = d.color; b.size = d.size; b.trail = d.trail; b.rot = ang;
        NR.projectiles.launch();
        dr.cd += 1 / R.rate; if (dr.cd < 0) dr.cd = 0;
        fireP.weaponId = w.id; fireP.slot = i; fireP.kind = d.kind; fireP.x = dr.x; fireP.y = dr.y; fireP.angle = ang;
        NR.events.emit('weapon:fire', fireP);
      }
    }
  }

  // ---- aura: one persistent following circle per weapon
  function tendAura(p, w, d, rt) {
    resolveInto(p, w, R);
    let a = rt.area;
    if (!a || a.id !== rt.aid || a.dead || a.kind !== 'area') {
      AO.areaKind = 'circle'; AO.x = p.x; AO.y = p.y; AO.r = R.r * Math.sqrt(R.area); AO.dmg = R.dmg; AO.tick = R.tick; AO.life = 1e9; AO.delay = 0; AO.follow = true;
      AO.element = d.element; AO.weaponId = w.id; AO.statusChance = R.statusChance; AO.knock = R.knock; AO.color = d.color; AO.shape = 'ring'; AO.visual = false; AO.aura = true;
      AO.freezeEvery = R.freezeEvery; AO.critB = R.crit; AO.weight = d.hit; AO.len = 0; AO.arc = 0; AO.w = 0; AO.angle = 0; AO.spread = false;
      a = NR.combat.createArea(AO);
      rt.area = a; rt.aid = a ? a.id : 0;
      return;
    }
    a.r = R.r * Math.sqrt(R.area); a.dmg = R.dmg; a.tick = R.tick; a.statusChance = R.statusChance; a.freezeEvery = R.freezeEvery; a.critB = R.crit; a.element = d.element; a.color = d.color;
  }

  function sweep(p) { // anything that outlived its weapon (sold, evolved) goes away
    const w0 = W(), D = w0.drones, P = w0.projectiles, A = w0.areas;
    for (let i = 0; i < D.length; i++) if (!D[i].dead && find(p, D[i].wid) < 0) D[i].dead = true;
    for (let i = 0; i < P.length; i++) if (P[i].orb && !P[i].dead && find(p, P[i].weaponId) < 0) P[i].dead = true;
    for (let i = 0; i < A.length; i++) if (A[i].aura && !A[i].dead && find(p, A[i].weaponId) < 0) A[i].dead = true;
  }

  function update(dt) {
    const w0 = W(), p = w0.player;
    if (!p || p.dead) return;
    const it = NR.input.read(), a = it.aim;
    if (--sweepT <= 0) { sweepT = 30; sweep(p); }
    for (let i = 0; i < p.weapons.length; i++) {
      const w = p.weapons[i], d = def(w.id);
      if (!d) continue;
      const rt = rtOf(w), kind = d.kind;
      if (kind === 'orbit') { if (--rt.chk <= 0) { rt.chk = 12; tendOrbit(p, w, d, rt); } continue; }
      if (kind === 'drone') { tendDrones(p, w, i, d, rt, dt); continue; }
      if (kind === 'aura') { if (--rt.chk <= 0) { rt.chk = 6; tendAura(p, w, d, rt); } continue; }
      if (w.cd > 0) w.cd -= dt;
      if (w.cd > 0) continue;
      if (!it.fire && !d.auto) { w.cd = 0; continue; }
      let guard = 0, fired = false;
      while (w.cd <= 0 && guard++ < 4) {
        resolveInto(p, w, R);
        let ok = true;
        if (kind === 'projectile' || kind === 'spread' || kind === 'homing') fireBullets(p, w, i, d, R, a);
        else if (kind === 'beam') fireBeam(p, w, i, d, R, a, rt);
        else if (kind === 'melee') fireMelee(p, w, i, d, R, a, rt);
        else if (kind === 'chain') ok = fireChain(p, w, i, d, R, a);
        else if (kind === 'thrown') ok = fireThrown(p, w, i, d, R, a, rt);
        else ok = false;
        if (!ok) { w.cd = 0; break; }
        fired = true; rt.flip = -rt.flip;
        w.cd += 1 / R.rate;
      }
      if (fired && w.cd < 0) w.cd = 0;
    }
  }
  NR.weapons = { init, reset, update, add, canAdd, remove, evolve, def, resolve };
})();
