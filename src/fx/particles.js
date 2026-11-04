// Owner: FX
// Pooled flat particles (1500 hard cap), floating damage numbers, player trail and dash afterimages.
// Cosmetic PRNG only (never NR.rng). Quality steps down automatically when the frame time stays above 20 ms for 2 s.
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  const SHARD = 1, CHIP = 2, SPARK = 3, RING = 4, FLASH = 5, AFTER = 6, BOLT = 7, DROP = 8, SWIPE = 9, PUFF = 10, GLOW = 11, EMBER = 12;
  const QMUL = [1, 0.7, 0.45, 0.25];
  const SLOW_FRAME = 0.020, SLOW_TIME = 2, FAST_FRAME = 0.0135, FAST_TIME = 10;
  const TAU = Math.PI * 2;
  const PICK_COLOR = { xp_shard: '#7FD3F0', gold: '#FFD43B', heart: '#E86AA6', magnet: '#A25CE0', nova_bomb: '#FF7A2F', chest: '#C9A24B' };
  const STATUS_COLOR = { fire: '#FF7A2F', burn: '#FF7A2F', ice: '#7FD3F0', chill: '#7FD3F0', freeze: '#7FD3F0', shock: '#FFD43B', stun: '#FFD43B', poison: '#8BD450', toxin: '#8BD450', void: '#A25CE0' };
  const RED = '#E5484D';
  let pool = [], count = 0, cap = 1500, cursor = 0;
  const T = [];
  const later = [];
  const trail = [];
  let seed = 12345, inited = false, quality = 0, slowT = 0, fastT = 0, smooth = 1 / 60, spawned = 0, clock = 0, trailT = 0, ghostT = 0;
  const lastFire = Object.create(null), tri = Object.create(null);
  let spawnFx = 0, statusFx = 0;

  function rnd() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
  function rr(a, b) { return a + rnd() * (b - a); }
  function elColor(el) { return NR.config.ELEMENT_COLORS[el] || '#F2EFE6'; }
  function threeOf(c) {
    let t = tri[c];
    if (!t) { const S = NR.util.shade; t = tri[c] = /^#[0-9a-fA-F]{6}$/.test(c) ? [c, S(c, -0.25), S(c, 0.3)] : [c, c, c]; }
    return t;
  }
  function settings() { return NR.save.getSettings(); }
  function fxm() { return NR.fx; }

  function alloc(prio) {
    if (count < cap) { const p = pool[count++]; p.t = 0; p.pts = null; return p; }
    if (!prio) return null;
    cursor = (cursor + 1) % cap; const p = pool[cursor]; p.t = 0; p.pts = null; return p;
  }
  function grab(n) { // how many of n particles to really spawn this frame (quality + per-frame budget)
    let m = n * QMUL[quality];
    if (spawned > 320) m *= 0.35;
    spawned += m;
    return m < 1 ? (rnd() < m ? 1 : 0) : Math.round(m);
  }
  function mk(k, x, y, color, life, size) {
    const p = alloc(k === SHARD || k === RING || k === FLASH || k === BOLT);
    if (!p) return null;
    p.k = k; p.x = x; p.y = y; p.vx = 0; p.vy = 0; p.rot = 0; p.vr = 0; p.life = life; p.size = size; p.size1 = 0; p.color = color; p.drag = 0; p.a = 1;
    p.shape = 'circle'; p.n = 0; p.c2 = null;
    return p;
  }

  function init() {
    if (inited) return;
    inited = true;
    cap = NR.config.CAPS.particles;
    for (let i = 0; i < cap; i++) pool.push({ k: 0, x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, t: 0, life: 1, size: 1, size1: 0, color: '#FFFFFF', c2: null, drag: 0, a: 1, shape: 'circle', n: 0, pts: null });
    const E = NR.events;
    E.on('run:start', clear);
    E.on('enemy:death', onDeath);
    E.on('enemy:spawn', onSpawn);
    E.on('damage:dealt', onDamage);
    E.on('status:apply', onStatus);
    E.on('weapon:fire', onFire);
    E.on('weapon:evolve', function () { const p = NR.world.get().player; if (p) { ring(p.x, p.y, 110, '#FFD43B', 0.5); burst('star', p.x, p.y, '#FFD43B', 14, { speed: 220 }); } });
    E.on('projectile:impact', onImpact);
    E.on('chain:arc', onArc);
    E.on('status:react', onReact);
    E.on('area:explode', onExplode);
    E.on('player:hurt', onHurt);
    E.on('player:dash', onDash);
    E.on('player:death', onPlayerDeath);
    E.on('player:levelup', onLevelUp);
    E.on('pickup:collect', onPickup);
    E.on('boss:phase', function (e) { const b = e.boss; if (!b) return; ring(b.x, b.y, b.r * 3.2, b.color, 0.6); ring(b.x, b.y, b.r * 2, '#F2EFE6', 0.4); burst('death', b.x, b.y, b.color, 18, { size: 5, speed: 260 }); });
    E.on('boss:death', onBossDeath);
  }

  // ---------- spawners ----------
  function burst(kind, x, y, color, n, o) {
    o = o || {};
    const m = grab(n), t = threeOf(color), sp = o.speed || 170, sz = o.size || 4, life = o.life || 0.55;
    const a0 = o.angle === undefined ? 0 : o.angle, spread = o.spread === undefined ? TAU : o.spread;
    for (let i = 0; i < m; i++) {
      const a = a0 + (spread === TAU ? rnd() * TAU : (rnd() - 0.5) * spread), s = sp * (0.35 + rnd() * 0.8);
      let p;
      switch (kind) {
        case 'death': case 'shard': p = mk(SHARD, x, y, t[(rnd() * 3) | 0], life * rr(0.7, 1.25), sz * rr(0.7, 1.4)); if (p) p.drag = 3.2; break;
        case 'debris': case 'chip': p = mk(CHIP, x, y, t[1], life * rr(0.8, 1.5), sz * rr(0.6, 1.2)); if (p) p.drag = 4; break;
        case 'spark': case 'hit': p = mk(SPARK, x, y, rnd() < 0.4 ? t[2] : color, life * rr(0.3, 0.55), rr(2, 3.5)); if (p) { p.drag = 2.4; } break;
        case 'star': p = mk(SHARD, x, y, t[rnd() < 0.5 ? 0 : 2], life * rr(0.8, 1.3), sz * rr(1, 1.6)); if (p) { p.drag = 2.6; p.shape = 'star'; } break;
        case 'drop': p = mk(DROP, x, y, color, life * rr(0.6, 1), sz * rr(0.7, 1.2)); if (p) p.drag = 3; break;
        default: p = mk(CHIP, x, y, rnd() < 0.5 ? color : t[2], life * rr(0.6, 1), sz * rr(0.6, 1)); if (p) p.drag = 3.5;
      }
      if (!p) break;
      p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s; p.rot = rnd() * TAU; p.vr = rr(-9, 9);
      if (o.vy) p.vy += o.vy;
    }
  }
  function ring(x, y, r, color, life, o) {
    const p = mk(RING, x, y, color, life || 0.4, r * 0.25);
    if (!p) return;
    o = o || {};
    p.size1 = r; p.n = o.w || Math.min(14, 4 + r * 0.05); p.c2 = o.inner === undefined ? NR.fx.shapes.lightOf(color) : o.inner;
  }
  // smoke puffs (soft baked blobs that swell and fade), additive glows (fireball cores, hit flashes), glowing embers
  function smoke(x, y, color, n, size, speed, life) {
    const m = Math.max(1, Math.round(n * QMUL[quality]));
    for (let i = 0; i < m; i++) {
      const p = mk(PUFF, x + rr(-size, size) * 0.4, y + rr(-size, size) * 0.4, color, (life || 0.7) * rr(0.7, 1.3), size * rr(0.6, 1.1));
      if (!p) break;
      const a = rnd() * TAU, s = (speed || 40) * rr(0.3, 1);
      p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s - 18; p.drag = 2.2; p.size1 = p.size * rr(1.8, 2.6); p.rot = rnd() * TAU; p.vr = rr(-1.5, 1.5);
    }
  }
  function glow(x, y, color, size, life) { const p = mk(GLOW, x, y, color, life || 0.18, size); if (p) p.a = 1; }
  function embers(x, y, color, n, speed) {
    const m = Math.max(1, Math.round(n * QMUL[quality]));
    for (let i = 0; i < m; i++) {
      const p = mk(EMBER, x, y, color, rr(0.35, 0.8), rr(1.6, 3));
      if (!p) break;
      const a = rnd() * TAU, s = (speed || 220) * rr(0.4, 1);
      p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s - 40; p.drag = 1.6;
    }
  }
  function debris(x, y, color, n) { burst('debris', x, y, color, n, { speed: 130, size: 4 }); }
  function spark(x, y, color, n, angle, spread) { burst('spark', x, y, color, n, { angle: angle, spread: spread, speed: 300 }); }
  function flash(x, y, color, size, angle, life) {
    const p = mk(FLASH, x, y, color, life || 0.07, size);
    if (p) { p.rot = angle || 0; p.c2 = NR.fx.shapes.lightOf(color); }
  }
  function swipe(x, y, color, radius, angle, life) {
    const p = mk(SWIPE, x, y, color, life || 0.16, radius);
    if (p) { p.rot = angle; p.c2 = NR.fx.shapes.lightOf(color); }
  }
  function afterimage(x, y, shape, color, r, rot, life, a) {
    if (quality >= 3) return;
    const p = mk(AFTER, x, y, color, life || 0.28, r);
    if (p) { p.shape = shape; p.rot = rot || 0; p.a = a || 0.55; }
  }
  function bolt(points, color, life) {
    if (!points || points.length < 2) return;
    const n = Math.min(points.length, 6), pts = [];
    for (let i = 0; i < n - 1; i++) {
      const a = points[i], b = points[i + 1], dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1, seg = Math.max(2, Math.min(7, (d / 22) | 0));
      pts.push(a.x, a.y);
      for (let k = 1; k < seg; k++) { const f = k / seg, j = rr(-9, 9); pts.push(a.x + dx * f - dy / d * j, a.y + dy * f + dx / d * j); }
    }
    pts.push(points[n - 1].x, points[n - 1].y);
    const p = mk(BOLT, points[0].x, points[0].y, color, life || 0.2, 5);
    if (p) { p.pts = pts; p.c2 = NR.fx.shapes.lightOf(color); }
  }
  function text(x, y, str, color, size, tid, amount, crit) {
    if (T.length >= NR.config.CAPS.texts) {
      let w = -1; for (let i = 0; i < T.length; i++) if (!T[i].crit) { w = i; break; }
      if (w < 0) return; T.splice(w, 1);
    }
    T.push({ x: x + rr(-6, 6), y: y, str: str, color: color, size: size || 12, life: 0.8, age: 0, tid: tid || 0, amount: amount || 0, crit: !!crit, pop: 1, vy: 70 });
  }
  function schedule(delay, fn) { if (later.length < 24) later.push({ t: delay, fn: fn }); }

  // ---------- event handlers ----------
  function onDeath(e) {
    const en = e.enemy; if (!en) return;
    const r = en.r || 10, col = en.color || '#F2EFE6', boss = e.isBoss;
    if (boss) return;
    burst('death', e.x, e.y, col, 5 + r * 0.55, { size: 3 + r * 0.2, speed: 140 + r * 4 });
    glow(e.x, e.y, col, r * 2.2, 0.16); smoke(e.x, e.y, NR.fx.shapes.darkOf(col), 2 + r * 0.12, r * 1.4, 50, 0.7);
    embers(e.x, e.y, NR.fx.shapes.lightOf(col), 3 + r * 0.2, 180 + r * 5);
    burst('debris', e.x, e.y, col, 2 + r * 0.18, { size: 3 + r * 0.12, speed: 90 + r * 2 });
    if (r >= 14 || e.elite) ring(e.x, e.y, r * 2.2 + (e.elite ? 20 : 0), e.elite ? NR.fx.render.palette()[3] : col, 0.3);
    if (e.elite) burst('star', e.x, e.y, '#FFD43B', 8, { speed: 200 });
    if (NR.fx.floor) NR.fx.floor.decal('splat', e.x, e.y, r * 1.5, NR.fx.shapes.darkOf(col));
  }
  function onSpawn(e) {
    const en = e.enemy; if (!en || spawnFx > 6) return;
    spawnFx++;
    ring(en.x, en.y, (en.r || 10) * 2, en.color || '#F2EFE6', 0.25, { w: 3 });
  }
  function onDamage(e) {
    const t = e.target, col = elColor(e.element), amt = e.amount;
    burst('hit', e.x, e.y, col, e.crit ? 6 : 3, { speed: 260 });
    if (e.crit) glow(e.x, e.y, col, 34, 0.08);
    if (t && t.color && !e.killed) burst('chip', e.x, e.y, t.color, e.crit ? 4 : 2, { speed: 120, size: 3 });
    if (settings().damageNumbers) {
      const tid = t ? t.id : 0, shown = Math.max(1, Math.round(amt));
      for (let i = 0; i < T.length; i++) {
        const q = T[i];
        if (tid && q.tid === tid && q.age < 0.4) {
          q.amount += amt; q.str = NR.util.fmt(Math.max(1, Math.round(q.amount)));
          if (e.crit && !q.crit) { q.crit = true; q.color = '#FFD43B'; }
          q.size = q.crit ? Math.min(30, 20 + q.amount / 30) : Math.min(24, 12 + q.amount / 45);
          q.life = 0.8; q.age = Math.min(q.age, 0.1); q.pop = 1; return;
        }
      }
      text(e.x, e.y - (t ? t.r : 8) - 6, NR.util.fmt(shown), e.crit ? '#FFD43B' : '#F2EFE6', e.crit ? 20 + Math.min(8, amt / 40) : 12 + Math.min(6, amt / 50), tid, amt, e.crit);
    }
  }
  function onStatus(e) {
    if (statusFx > 8) return;
    statusFx++;
    const c = STATUS_COLOR[e.status] || elColor(e.status);
    burst(e.status && /ice|chill|freeze/.test(e.status) ? 'star' : 'drop', e.x, e.y, c, 4, { speed: 90, size: 3, vy: -30 });
  }
  function onFire(e) {
    const W = NR.data.weapons && NR.data.weapons[e.weaponId], k = e.kind;
    if (k === 'aura' || k === 'orbit' || k === 'beam' && false) return;
    const last = lastFire[e.weaponId] || -1;
    if (clock - last < 0.045) return;
    lastFire[e.weaponId] = clock;
    const col = (W && W.color) || '#F2EFE6', heavy = W && (W.evolved || W.sfx === 'shoot_heavy' || k === 'thrown' || k === 'spread');
    const ca = Math.cos(e.angle), sa = Math.sin(e.angle);
    if (k === 'melee') { swipe(e.x + ca * 10, e.y + sa * 10, col, 70, e.angle, 0.16); return; }
    flash(e.x + ca * 22, e.y + sa * 22, col, heavy ? 13 : 9, e.angle, 0.07);
    if (heavy) glow(e.x + ca * 24, e.y + sa * 24, '#FFC86B', 44, 0.05);
    if (heavy) smoke(e.x + ca * 26, e.y + sa * 26, '#8C8698', 2, 9, 60, 0.5);
    spark(e.x + ca * 24, e.y + sa * 24, col, heavy ? 3 : 1, e.angle, 0.7);
  }
  function onImpact(e) {
    const col = e.team === 'enemy' ? NR.fx.render.palette()[4] : elColor(e.element);
    if (e.surface === 'wall') { burst('chip', e.x, e.y, '#F2EFE6', 3, { speed: 90, size: 3 }); ring(e.x, e.y, 14 + e.r, col, 0.18, { w: 3 }); }
    else if (e.surface === 'player') burst('hit', e.x, e.y, col, 4, { speed: 220 });
    else if (e.surface === 'expire') burst('spark', e.x, e.y, col, 2, { speed: 90 });
    else if (e.surface === 'enemy' && e.team === 'player') { burst(e.element === 'ice' ? 'star' : 'spark', e.x, e.y, col, 3, { speed: 200 }); if (e.element === 'fire') embers(e.x, e.y, '#FFB347', 2, 120); }
  }
  // reactions: one distinct burst per reaction (flat shapes only) plus the reaction's name floating up from the target
  function onReact(e) {
    const d = NR.data.reactions && NR.data.reactions[e.reaction], col = d ? d.color : '#F2EFE6', r = e.r || 90, x = e.x, y = e.y;
    switch (e.reaction) {
      case 'shatter':
        burst('star', x, y, '#BFE9F7', 18, { speed: 340, size: 5 }); burst('chip', x, y, '#F2EFE6', 10, { speed: 260, size: 4 });
        ring(x, y, r, col, 0.35, { w: 8 }); ring(x, y, r * 0.55, '#FFFFFF', 0.22, { w: 4 });
        for (let k = 0; k < 6; k++) { const a = k * TAU / 6 + rnd() * 0.4; bolt([{ x: x, y: y }, { x: x + Math.cos(a) * r * 0.6, y: y + Math.sin(a) * r * 0.6 }, { x: x + Math.cos(a + 0.2) * r, y: y + Math.sin(a + 0.2) * r }], '#EAF4FB', 0.16); }
        break;
      case 'toxic_blast':
        smoke(x, y, '#6FA83A', 7, r * 0.5, 70, 1.1); burst('drop', x, y, col, 14, { speed: 220, size: 4, vy: -40 });
        ring(x, y, r, col, 0.4, { w: 9 }); ring(x, y, r * 0.5, '#CDEFA0', 0.28, { w: 5 });
        break;
      case 'superconduct':
        for (let k = 0; k < 7; k++) { const a = rnd() * TAU; bolt([{ x: x, y: y }, { x: x + Math.cos(a) * r * 0.5, y: y + Math.sin(a) * r * 0.5 }, { x: x + Math.cos(a + 0.4) * r, y: y + Math.sin(a + 0.4) * r }], k % 2 ? '#FFFFFF' : col, 0.24); }
        ring(x, y, r * 0.5, col, 0.3, { w: 6 }); burst('spark', x, y, col, 12, { speed: 360 });
        break;
      case 'implosion':
        burst('death', x, y, '#2A1E3F', 16, { speed: -230, size: 5, life: 0.5 }); burst('star', x, y, col, 10, { speed: -200 });
        ring(x, y, r, col, 0.45, { w: 10 }); ring(x, y, r * 0.35, '#F1E0FF', 0.3, { w: 8 }); glow(x, y, col, r * 0.8, 0.22);
        break;
      default: // steam
        smoke(x, y, '#DCE8F2', 8, r * 0.55, 45, 1.2); burst('drop', x, y, '#FFFFFF', 8, { speed: 120, size: 3, vy: -50 });
        ring(x, y, r, col, 0.4, { w: 6 });
    }
    if (d && settings().damageNumbers !== false) {
      const nm = NR.i18n.text(d.name), up = (function () { try { return nm.toLocaleUpperCase(NR.i18n.getLang()); } catch (er) { return nm.toUpperCase(); } })();
      text(x, y - (e.target ? e.target.r : 10) - 22, up, col, 17, 0, 0, true);
    }
  }
  function onArc(e) { bolt(e.points, elColor(e.element), 0.2); }
  function onExplode(e) {
    const col = e.team === 'enemy' ? NR.fx.render.palette()[4] : elColor(e.element), r = e.r;
    ring(e.x, e.y, r, col, 0.4, { w: Math.min(16, 5 + r * 0.04) });
    glow(e.x, e.y, '#FFB45A', r * 1.5, 0.25);
    smoke(e.x, e.y, '#5A5260', Math.min(6, 2 + r / 30), r * 0.42, 60 + r * 0.5, 0.9);
    embers(e.x, e.y, '#FFC86B', Math.min(18, 5 + r / 10), 200 + r * 1.5);
    if (r > 60) ring(e.x, e.y, r * 0.6, '#F2EFE6', 0.28, { w: 5 });
    // element signature
    if (e.element === 'ice') burst('star', e.x, e.y, '#BFE9F7', Math.min(16, 6 + r / 10), { speed: 220 + r });
    else if (e.element === 'poison') smoke(e.x, e.y, '#6FA83A', Math.min(7, 3 + r / 25), r * 0.5, 50, 1.4);
    else if (e.element === 'shock') { for (let k = 0; k < 4; k++) { const an = rnd() * TAU; bolt([{ x: e.x, y: e.y }, { x: e.x + Math.cos(an) * r * 0.6, y: e.y + Math.sin(an) * r * 0.6 }, { x: e.x + Math.cos(an + 0.3) * r, y: e.y + Math.sin(an + 0.3) * r }], '#FFE066', 0.22); } }
    else if (e.element === 'void') { ring(e.x, e.y, r * 0.3, '#A25CE0', 0.35, { w: 10 }); burst('death', e.x, e.y, '#2A1E3F', 10, { speed: -160 }); }
    burst('death', e.x, e.y, col, Math.min(26, 6 + r / 8), { speed: 120 + r, size: 4 + r * 0.02 });
    burst('spark', e.x, e.y, col, Math.min(14, 4 + r / 14), { speed: 180 + r * 1.2 });
    if (NR.fx.floor) NR.fx.floor.decal('scorch', e.x, e.y, Math.min(r * 0.8, 150), NR.config.INK);
  }
  function onHurt(e) {
    const p = NR.world.get().player; if (!p) return;
    if (e.dodged) { ring(e.x, e.y, 40, '#EAF4FB', 0.3, { w: 3 }); return; }
    const c = p.color || '#5FA8D3';
    burst('death', e.x, e.y, c, 8, { speed: 220 });
    burst('spark', e.x, e.y, RED, 6, { speed: 280 });
    ring(e.x, e.y, 54, RED, 0.3, { w: 5 });
    if (settings().damageNumbers) text(e.x, e.y - 26, '-' + NR.util.fmt(Math.max(1, Math.round(e.amount))), '#FF7B7B', 18);
    if (e.revived) { ring(e.x, e.y, 150, '#FFD43B', 0.6); burst('star', e.x, e.y, '#FFD43B', 16, { speed: 260 }); }
  }
  function onDash(e) {
    const p = NR.world.get().player; if (!p) return;
    const a = Math.atan2(e.dy, e.dx);
    burst('spark', e.x, e.y, '#F2EFE6', 7, { angle: a + Math.PI, spread: 0.9, speed: 320 });
    ring(e.x, e.y, 36, p.color, 0.22, { w: 4 });
    afterimage(e.x, e.y, p.shape, p.color, p.r, p.aim, 0.3, 0.6);
  }
  function onPlayerDeath(e) {
    const p = NR.world.get().player, c = p ? p.color : '#5FA8D3';
    burst('death', e.x, e.y, c, 30, { speed: 300, size: 6, life: 0.9 });
    burst('debris', e.x, e.y, c, 10, { speed: 160, size: 6 });
    ring(e.x, e.y, 160, RED, 0.6); ring(e.x, e.y, 90, '#F2EFE6', 0.4);
  }
  function onLevelUp(e) {
    const p = NR.world.get().player; if (!p) return;
    ring(p.x, p.y, 120, '#FFD43B', 0.55, { w: 8 }); ring(p.x, p.y, 70, '#F2EFE6', 0.4, { w: 5 });
    burst('star', p.x, p.y, '#FFD43B', 16, { speed: 260, size: 4, vy: -60, life: 0.8 });
  }
  function onPickup(e) {
    const c = PICK_COLOR[e.type] || '#F2EFE6';
    ring(e.x, e.y, 22, c, 0.22, { w: 3 });
    burst('chip', e.x, e.y, c, e.type === 'xp_shard' ? 3 : 6, { speed: 130, size: 3 });
    if (settings().damageNumbers && (e.type === 'gold' || e.type === 'heart') && e.value > 0) text(e.x, e.y - 14, '+' + NR.util.fmt(e.value), c, 11);
    if (e.type === 'chest') { ring(e.x, e.y, 90, c, 0.4); burst('star', e.x, e.y, c, 10, { speed: 220 }); }
  }
  function onBossDeath(e) {
    const b = e.boss, col = b ? b.color : '#F2EFE6', r = b ? b.r : 50;
    burst('death', e.x, e.y, col, 44, { speed: 380, size: 8, life: 1 });
    glow(e.x, e.y, '#FFE2A0', r * 9, 0.6); smoke(e.x, e.y, '#3A3440', 12, r * 1.2, 120, 1.6); embers(e.x, e.y, '#FFC86B', 30, 420);
    burst('debris', e.x, e.y, col, 14, { speed: 220, size: 8, life: 1 });
    ring(e.x, e.y, r * 5, col, 0.8, { w: 16 }); ring(e.x, e.y, r * 3, '#F2EFE6', 0.6, { w: 10 });
    for (let i = 1; i <= 4; i++) schedule(i * 0.16, function () {
      const x = e.x + rr(-r, r), y = e.y + rr(-r, r);
      burst('death', x, y, col, 16, { speed: 260, size: 6 }); ring(x, y, r * 1.8, i % 2 ? '#F2EFE6' : col, 0.4, { w: 8 });
    });
    if (NR.fx.floor) NR.fx.floor.decal('scorch', e.x, e.y, r * 2, NR.config.INK);
  }

  // ---------- per-frame ----------
  function setQuality(q) { quality = Math.max(0, Math.min(3, q | 0)); slowT = 0; fastT = 0; }
  function adapt(dt) {
    const d = Math.min(dt, 0.1);
    smooth += (d - smooth) * 0.1;
    if (smooth > SLOW_FRAME) { slowT += d; fastT = 0; } else { slowT = 0; if (smooth < FAST_FRAME) fastT += d; else fastT = 0; }
    if (slowT >= SLOW_TIME && quality < 3) { quality++; slowT = 0; }
    else if (fastT >= FAST_TIME && quality > 0) { quality--; fastT = 0; }
  }
  function update(dt) {
    if (!inited) return;
    clock += dt; spawned = 0; spawnFx = 0; statusFx = 0;
    adapt(dt);
    for (let i = later.length - 1; i >= 0; i--) { const l = later[i]; l.t -= dt; if (l.t <= 0) { later.splice(i, 1); l.fn(); } }
    const W = NR.world.get(), pl = W && W.player;
    if (pl && !pl.dead && (W.state === 'wave' || W.state === 'clear') && quality < 3) {
      trailT -= dt;
      if (trailT <= 0) {
        trailT = 0.016;
        const sp = pl.vx * pl.vx + pl.vy * pl.vy, dashing = pl.dash && pl.dash.t > 0;
        if (sp > 1600 || dashing) { if (trail.length >= 18) trail.shift(); trail.push({ x: pl.x, y: pl.y, t: 0, d: dashing ? 1 : 0 }); }
      }
      if (pl.dash && pl.dash.t > 0) { ghostT -= dt; if (ghostT <= 0) { ghostT = 0.028; afterimage(pl.x, pl.y, pl.shape, pl.color, pl.r, pl.aim, 0.3, 0.55); } }
    }
    for (let i = trail.length - 1; i >= 0; i--) { trail[i].t += dt; if (trail[i].t > 0.3) trail.splice(i, 1); }
    for (let i = 0; i < count; i++) {
      const p = pool[i];
      p.t += dt;
      if (p.t >= p.life) { const last = pool[count - 1]; pool[count - 1] = p; pool[i] = last; count--; i--; continue; }
      if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    }
    for (let i = T.length - 1; i >= 0; i--) {
      const t = T[i]; t.age += dt; t.life -= dt;
      if (t.life <= 0) { T.splice(i, 1); continue; }
      t.y -= t.vy * dt; t.vy *= Math.max(0, 1 - 3.5 * dt); if (t.pop > 0) t.pop = Math.max(0, t.pop - dt * 7);
    }
  }

  function drawUnder(ctx) {
    if (!inited) return;
    const W = NR.world.get(), pl = W && W.player;
    if (pl && trail.length > 1 && quality < 3) {
      const col = pl.color, dk = threeOf(col)[1], lt = threeOf(col)[2];
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1], b = trail[i], f = 1 - b.t / 0.3;
        if (f <= 0) continue;
        ctx.strokeStyle = b.d ? lt : dk; ctx.lineWidth = Math.max(2, pl.r * 1.5 * f * (b.d ? 1.1 : 0.8));
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }
    for (let i = 0; i < count; i++) {
      const p = pool[i];
      if (p.k !== AFTER) continue;
      const f = p.t / p.life; ctx.globalAlpha = Math.max(0, p.a * (1 - f));
      NR.fx.shapes.draw(ctx, p.shape, p.x, p.y, p.size, p.rot, 1, 1, p.color, 0, false);
    }
    ctx.globalAlpha = 1;
  }

  function polyFill(ctx, p, n, size, rot) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) { const a = rot + i / n * TAU; const x = p.x + Math.cos(a) * size, y = p.y + Math.sin(a) * size; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.closePath();
  }
  function draw(ctx) {
    const INK = NR.config.INK, art = NR.fx.art;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (art) for (let i = 0; i < count; i++) {
      const p = pool[i];
      if (p.k === PUFF) {
        const f = p.t / p.life, img = art.puff(p.color); if (!img) continue;
        const s = p.size + (p.size1 - p.size) * (1 - (1 - f) * (1 - f));
        ctx.globalAlpha = Math.max(0, (f < 0.15 ? f / 0.15 : 1 - (f - 0.15) / 0.85) * 0.5);
        ctx.drawImage(img, p.x - s, p.y - s, s * 2, s * 2);
      } else if (p.k === GLOW) { const f = p.t / p.life; art.light(p.x, p.y, p.size * (0.7 + f * 0.5), p.color, 1 - f); }
      else if (p.k === EMBER) { const f = p.t / p.life; art.light(p.x, p.y, 12 * (1 - f) + 4, p.color, 0.8 * (1 - f)); }
      else if (p.k === SPARK && (i & 1)) art.light(p.x, p.y, 14, p.color, 0.5 * (1 - p.t / p.life));
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < count; i++) {
      const p = pool[i];
      if (p.k === AFTER || p.k === PUFF || p.k === GLOW) continue;
      if (p.k === EMBER) { const f = p.t / p.life; ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size * (1 - f * 0.5), p.y - p.size * (1 - f * 0.5), p.size * 2 * (1 - f * 0.5), p.size * 2 * (1 - f * 0.5)); continue; }
      const f = p.t / p.life;
      switch (p.k) {
        case SHARD: {
          const s = p.size * (1 - f * 0.65);
          ctx.fillStyle = p.color;
          if (p.shape === 'star') { ctx.beginPath(); for (let k = 0; k < 8; k++) { const a = p.rot + k / 8 * TAU, rr2 = k % 2 ? s * 0.45 : s * 1.3; const x = p.x + Math.cos(a) * rr2, y = p.y + Math.sin(a) * rr2; if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.closePath(); }
          else polyFill(ctx, p, 3, s * 1.3, p.rot);
          ctx.fill();
          if (s > 3.2) { ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke(); }
          break;
        }
        case CHIP: {
          const s = p.size * (1 - f * 0.5);
          ctx.fillStyle = p.color; polyFill(ctx, p, 4, s * 1.2, p.rot + 0.785); ctx.fill();
          break;
        }
        case SPARK: {
          ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(1.5, p.size * (1 - f));
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05); ctx.stroke();
          break;
        }
        case DROP: {
          ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.8, p.size * (1 - f * 0.6)), 0, TAU); ctx.fill();
          break;
        }
        case RING: {
          const e = 1 - (1 - f) * (1 - f), r = p.size + (p.size1 - p.size) * e, w = Math.max(1, p.n * (1 - f));
          if (f > 0.65) ctx.globalAlpha = Math.max(0, (1 - f) / 0.35);
          ctx.strokeStyle = p.color; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke();
          if (w > 3) { ctx.strokeStyle = p.c2; ctx.lineWidth = w * 0.35; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke(); }
          ctx.globalAlpha = 1;
          break;
        }
        case FLASH: {
          const s = p.size * (1 - f * 0.5);
          ctx.fillStyle = p.color; ctx.beginPath();
          for (let k = 0; k < 8; k++) { const a = p.rot + k / 8 * TAU, rr2 = k % 2 ? s * 0.4 : s * (k % 4 === 0 ? 1.5 : 0.9); const x = p.x + Math.cos(a) * rr2, y = p.y + Math.sin(a) * rr2; if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = p.c2; ctx.beginPath(); ctx.arc(p.x, p.y, s * 0.4, 0, TAU); ctx.fill();
          break;
        }
        case SWIPE: {
          const sweep = 0.5 + f * 0.9, w = 12 * (1 - f) + 2;
          ctx.strokeStyle = INK; ctx.lineWidth = w + 4; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, p.rot - sweep, p.rot + sweep); ctx.stroke();
          ctx.strokeStyle = p.color; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, p.rot - sweep, p.rot + sweep); ctx.stroke();
          ctx.strokeStyle = p.c2; ctx.lineWidth = Math.max(1, w * 0.4); ctx.beginPath(); ctx.arc(p.x, p.y, p.size, p.rot - sweep, p.rot + sweep); ctx.stroke();
          break;
        }
        case BOLT: {
          const pts = p.pts; if (!pts) break;
          const w = Math.max(1.5, p.size * (1 - f));
          ctx.strokeStyle = p.color; ctx.lineWidth = w + 2; ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let k = 2; k < pts.length; k += 2) ctx.lineTo(pts[k], pts[k + 1]); ctx.stroke();
          ctx.strokeStyle = p.c2; ctx.lineWidth = Math.max(1, w * 0.45); ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let k = 2; k < pts.length; k += 2) ctx.lineTo(pts[k], pts[k + 1]); ctx.stroke();
          break;
        }
      }
    }
    ctx.lineCap = 'butt';
  }
  function drawTexts(ctx) {
    if (!T.length) return;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.strokeStyle = NR.config.INK;
    for (let i = 0; i < T.length; i++) {
      const t = T[i], sz = Math.round(t.size * (1 + t.pop * 0.5));
      ctx.font = '800 ' + sz + 'px "Shard Title", "Baloo 2", system-ui, sans-serif';
      if (t.life < 0.2) ctx.globalAlpha = Math.max(0, t.life / 0.2);
      ctx.lineWidth = t.crit ? 5 : 4; ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.color; ctx.fillText(t.str, t.x, t.y);
      ctx.globalAlpha = 1;
    }
  }
  function clear() { count = 0; T.length = 0; later.length = 0; trail.length = 0; cursor = 0; }

  NR.fx = NR.fx || {};
  NR.fx.particles = {
    init: init, update: update, draw: draw, drawUnder: drawUnder, drawTexts: drawTexts, burst: burst, ring: ring, debris: debris, spark: spark, flash: flash,
    bolt: bolt, afterimage: afterimage, text: text, clear: clear, smoke: smoke, glow: glow, embers: embers,
    count: function () { return count; }, textCount: function () { return T.length; }, quality: function () { return quality; }, setQuality: setQuality
  };
})();
