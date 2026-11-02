(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  const LOOK = 90;      // px of look-ahead toward the aim
  const MAX_SHAKE = 18; // px at trauma 1
  let vw = 1280, vh = 720;
  let cx = 0, cy = 0, lx = 0, ly = 0, trauma = 0, shakeT = 0, sx = 0, sy = 0, shakeScale = 1, ready = false;

  function init() {
    vw = NR.config.VIEW.w; vh = NR.config.VIEW.h;
    shakeScale = NR.save.getSettings().shake / 100;
    NR.events.on('settings:change', function (e) { if (e.key === 'shake') shakeScale = e.value / 100; });
  }
  function resize(w, h) { vw = w; vh = h; }
  function addTrauma(t) { trauma = Math.min(1, trauma + t * shakeScale); }
  function noise(t, seed) { return Math.sin(t * 37.1 + seed) * 0.6 + Math.sin(t * 91.7 + seed * 2.3) * 0.4; }

  // alpha (optional) interpolates the followed player between sim steps
  function update(dt, alpha) {
    const W = NR.world.get(), p = W && W.player, A = NR.config.ARENA;
    if (p) {
      const a = alpha === undefined ? 1 : alpha;
      const tx = p.px + (p.x - p.px) * a, ty = p.py + (p.y - p.py) * a;
      const k = 1 - Math.exp(-6 * dt);
      lx += (Math.cos(p.aim) * LOOK - lx) * k; ly += (Math.sin(p.aim) * LOOK - ly) * k;
      const gx = tx + lx, gy = ty + ly;
      if (!ready) { cx = gx; cy = gy; ready = true; }
      const f = 1 - Math.exp(-9 * dt);
      cx += (gx - cx) * f; cy += (gy - cy) * f;
    } else if (!ready) { cx = A.w / 2; cy = A.h / 2; }
    cx = NR.util.clamp(cx, vw / 2, Math.max(vw / 2, A.w - vw / 2));
    cy = NR.util.clamp(cy, vh / 2, Math.max(vh / 2, A.h - vh / 2));
    if (trauma > 0) {
      trauma = Math.max(0, trauma - 1.6 * dt);
      shakeT += dt;
      const m = trauma * trauma * MAX_SHAKE;
      sx = noise(shakeT, 1) * m; sy = noise(shakeT, 7) * m;
    } else { sx = 0; sy = 0; }
  }
  function apply(ctx) { ctx.translate(Math.round(vw / 2 - cx + sx), Math.round(vh / 2 - cy + sy)); }
  function toWorld(px, py, out) { out = out || {}; out.x = px - vw / 2 + cx; out.y = py - vh / 2 + cy; return out; }
  function toScreen(wx, wy, out) { out = out || {}; out.x = wx - cx + vw / 2; out.y = wy - cy + vh / 2; return out; }
  NR.camera = { init, update, addTrauma, apply, toWorld, toScreen, resize };
})();
