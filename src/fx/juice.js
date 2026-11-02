// Owner: FX
// Screen juice driven by NR.events: hit-stop by hit weight, trauma shake (rate-limited), enemy hit flash / squash / knock
// visuals, slow-mo, full-screen flashes (capped), and the low-HP warning frame. Settings are read live.
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  const RED = '#E5484D';
  const tracked = [];
  let inited = false, clock = 0, bucket = 0.5, hitCd = 0, lowT = 0, lowK = 0;
  const flashStarts = [];
  const fl = { color: '#FFFFFF', a: 0, t: 0, dur: 0.01 };

  function settings() { return NR.save.getSettings(); }
  function reduced() { return !!settings().reduceFlashing; }

  function init() {
    if (inited) return;
    inited = true;
    const E = NR.events;
    E.on('run:start', function () { tracked.length = 0; fl.t = 0; flashStarts.length = 0; bucket = 0.5; lowT = 0; lowK = 0; });
    E.on('damage:dealt', onDamage);
    E.on('enemy:death', function (e) {
      const en = e.enemy, r = en ? en.r : 10;
      if (e.isBoss) return;
      if (e.elite) { shake(0.14); hitStop(0.05); } else if (r >= 18) shake(0.07); else shake(0.015);
    });
    E.on('player:hurt', function (e) {
      if (e.dodged) return;
      const p = NR.world.get().player, k = p ? Math.min(1, e.amount / Math.max(1, p.maxHp)) : 0.1;
      shake(0.3 + k * 0.6, true); hitStop(0.04 + k * 0.1);
      if (p) flash(p, 0.06);
      screenFlash(RED, 0.22, 0.18);
    });
    E.on('player:death', function () { shake(0.85, true); slowMo(0.25, 1.2); screenFlash(RED, 0.4, 0.5); });
    E.on('player:dash', function () { shake(0.05); });
    E.on('area:explode', function (e) {
      const k = Math.max(0.05, Math.min(0.45, e.r / 700));
      shake(k, e.team === 'enemy');
      if (e.r >= 200) hitStop(0.04);
      if (e.r >= 400) screenFlash('#FFFFFF', 0.45, 0.22);
    });
    E.on('weapon:fire', function (e) { if (e.kind === 'thrown') shake(0.02); });
    E.on('pickup:collect', function (e) { if (e.type === 'chest') shake(0.1); });
    E.on('boss:phase', function (e) { if (e.phase > 0) { shake(0.5, true); hitStop(0.08); } });
    E.on('boss:death', function () {
      slowMo(0.3, 1.2); shake(0.9, true); hitStop(0.12);
      screenFlash('#FFFFFF', 0.85, 0.6, true);
    });
  }

  // ---------- per-entity visuals ----------
  function track(e) {
    if (e._tr === e.id) return;
    e._tr = e.id; tracked.push(e);
    if (e.sx === undefined) e.sx = 1;
    if (e.sy === undefined) e.sy = 1;
    e.fvx = 0; e.fvy = 0; e.kox = 0; e.koy = 0;
  }
  function flash(e, amt) { if (!e) return; track(e); e.flash = amt === undefined ? 0.06 : amt; }
  function squash(e, sx, sy) { if (!e) return; track(e); e.sx = sx; e.sy = sy; e.fvx = 0; e.fvy = 0; }
  function knock(e, dx, dy, px) {
    track(e);
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    e.kox = (e.kox || 0) + dx / d * px; e.koy = (e.koy || 0) + dy / d * px;
  }
  function onDamage(e) {
    const t = e.target; if (!t || t.dead && !e.killed) return;
    const W = NR.world.get(), p = W.player;
    flash(t, 0.06);
    const big = t.r >= 30 || t.isBoss;
    if (e.crit) squash(t, big ? 0.93 : 0.7, big ? 1.07 : 1.38); else squash(t, big ? 0.96 : 0.8, big ? 1.04 : 1.25);
    if (p) knock(t, t.x - p.x, t.y - p.y, (e.crit ? 9 : 5) * (big ? 0.4 : 1));
    let w = 0;
    if (e.crit) w = 0.03;
    if (t.maxHp && e.amount >= t.maxHp * 0.3) w = Math.max(w, 0.035);
    if (e.killed) w = Math.max(w, t.isBoss ? 0 : (t.flags && t.flags.elite ? 0.05 : 0.012));
    if (w > 0) hitStop(w);
    if (e.crit) shake(0.03);
  }

  // ---------- global effects ----------
  function hitStop(sec) {
    if (hitCd > 0 || !(sec > 0)) return;
    hitCd = 0.1;
    NR.loop.hitStop(sec * (reduced() ? 0.5 : 1));
  }
  // shake requests pass through a token bucket so a mass kill cannot pin the camera at full trauma
  function shake(t, force) {
    if (force) { NR.camera.addTrauma(t); return; }
    const a = Math.min(t, bucket);
    if (a <= 0) return;
    bucket -= a; NR.camera.addTrauma(a);
  }
  function slowMo(scale, sec) { NR.loop.slowMo(scale, sec); }
  // full-screen solid overlay; "reduce flashing" = at most 3 per second at 40% opacity
  function screenFlash(color, alpha, dur, force) {
    const red = reduced(), now = clock;
    let n = 0;
    for (let i = flashStarts.length - 1; i >= 0; i--) { if (now - flashStarts[i] > 1) flashStarts.splice(i, 1); else n++; }
    if (n >= (red ? 3 : 6)) return false;
    flashStarts.push(now);
    fl.color = color; fl.a = alpha * (red ? 0.4 : 1); fl.t = dur; fl.dur = dur;
    return true;
  }
  function flashCount() { let n = 0; for (let i = 0; i < flashStarts.length; i++) if (clock - flashStarts[i] <= 1) n++; return n; }

  function update(dt) {
    clock += dt;
    bucket = Math.min(0.5, bucket + dt * 0.7);
    if (hitCd > 0) hitCd -= dt;
    if (fl.t > 0) fl.t -= dt;
    for (let i = tracked.length - 1; i >= 0; i--) {
      const e = tracked[i];
      if (e._tr !== e.id || e.dead) { tracked.splice(i, 1); if (e._tr === e.id) e._tr = 0; continue; }
      if (e.flash > 0) e.flash -= dt;
      const kd = Math.exp(-14 * dt); e.kox *= kd; e.koy *= kd;
      e.fvx += ((1 - e.sx) * 260 - e.fvx * 15) * dt; e.sx += e.fvx * dt;
      e.fvy += ((1 - e.sy) * 260 - e.fvy * 15) * dt; e.sy += e.fvy * dt;
      if (e.flash <= 0 && Math.abs(e.sx - 1) < 0.01 && Math.abs(e.sy - 1) < 0.01 && Math.abs(e.fvx) < 0.1 && Math.abs(e.kox) < 0.2 && Math.abs(e.koy) < 0.2) {
        e.sx = 1; e.sy = 1; e.flash = 0; e.kox = 0; e.koy = 0; e._tr = 0; tracked.splice(i, 1);
      }
    }
    const W = NR.world.get(), p = W && W.player;
    if (p && !p.dead && (W.state === 'wave' || W.state === 'clear') && p.hp / p.maxHp < 0.3) {
      lowK = Math.min(1, (0.3 - p.hp / p.maxHp) / 0.3);
      lowT += dt * (reduced() ? 5 : 7 + lowK * 6);
    } else lowK = 0;
  }

  // screen-space overlays (identity transform): low-HP frame first, then flashes
  function drawOverlay(ctx, w, h) {
    if (lowK > 0) {
      const red = reduced(), pulse = 0.5 + 0.5 * Math.sin(lowT), th = 14 + lowK * 14;
      const a = red ? 0.22 + 0.1 * pulse : 0.3 + 0.35 * pulse;
      ctx.fillStyle = RED; ctx.globalAlpha = Math.min(0.75, a * (0.7 + lowK * 0.5));
      ctx.fillRect(0, 0, w, th); ctx.fillRect(0, h - th, w, th); ctx.fillRect(0, th, th, h - th * 2); ctx.fillRect(w - th, th, th, h - th * 2);
      ctx.globalAlpha = 1;
    }
    if (fl.t > 0) {
      const k = Math.min(1, fl.t / fl.dur);
      ctx.fillStyle = fl.color; ctx.globalAlpha = Math.min(1, fl.a * (k > 0.7 ? 1 : k / 0.7));
      ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1;
    }
  }
  NR.fx = NR.fx || {};
  NR.fx.juice = { init: init, update: update, flash: flash, squash: squash, knock: knock, hitStop: hitStop, shake: shake, slowMo: slowMo, screenFlash: screenFlash, flashCount: flashCount, drawOverlay: drawOverlay };
})();
