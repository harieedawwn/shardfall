// Owner: FX
// Cinematic title scene drawn on the game canvas behind the main menu: twilight sky with a shattered crystal moon,
// a rain of falling shards, ruined skyline layers with parallax, the horde massing on the horizon, drifting fog and
// embers, god rays, and the hooded hero (the real in-game art, large) on a cliff with fluttering scarf, floating
// armed hands and an orbiting shard halo. Letterboxed, slow push-in, pointer parallax. All gradients are baked once
// per screen size on offscreen canvases; per frame it is drawImage + a few paths. Cosmetic PRNG only.
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  const TAU = Math.PI * 2;
  let key = '', L = null, mx = 0, my = 0, smx = 0, smy = 0, inited = false, seed = 1;
  const SH = 22, shard = [];   // falling shards
  const EM = 60, ember = [];   // rising embers
  function rnd() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
  function A() { return NR.fx.art; }
  function cv(w, h) { return A().canvas(w, h); }
  function rgba(c, a) { return A().rgba(c, a); }

  function init() {
    if (inited) return;
    inited = true;
    const g = globalThis;
    if (g.addEventListener) g.addEventListener('pointermove', function (e) { const w = g.innerWidth || 1, h = g.innerHeight || 1; mx = e.clientX / w * 2 - 1; my = e.clientY / h * 2 - 1; });
    seed = 7;
    for (let i = 0; i < SH; i++) shard.push({ x: rnd(), y: rnd(), s: 0.4 + rnd() * 1.2, v: 0.6 + rnd() * 0.8, c: rnd() < 0.5 ? '#7FE3F5' : rnd() < 0.5 ? '#B57CFF' : '#FFC86B' });
    for (let i = 0; i < EM; i++) ember.push({ x: rnd(), y: rnd(), s: 1 + rnd() * 2.2, v: 0.02 + rnd() * 0.05, p: rnd() * TAU });
  }

  // ---------- baked layers ----------
  function skyline(w, h, color, n, hMin, hMax, lit, sd) {
    const c = cv(w * 2, h); if (!c) return null;
    const g = c.getContext('2d'); let s = sd;
    const r = function () { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
    g.fillStyle = color;
    let x = 0;
    g.beginPath(); g.moveTo(0, h);
    while (x < w * 2) {
      const bw = w * (0.03 + r() * 0.07), bh = h * (hMin + r() * (hMax - hMin)), top = h - bh;
      g.lineTo(x, top + r() * 10);
      if (r() < 0.35) { g.lineTo(x + bw * 0.2, top - bh * 0.25); g.lineTo(x + bw * 0.3, top); } // broken spire
      if (r() < 0.3) { g.lineTo(x + bw * 0.5, top + bh * 0.12); g.lineTo(x + bw * 0.62, top - bh * 0.08); } // jagged break
      g.lineTo(x + bw, top + r() * 14);
      x += bw;
    }
    g.lineTo(w * 2, h); g.closePath(); g.fill();
    if (lit) { // burning windows / fires
      for (let i = 0; i < n; i++) {
        const fx = r() * w * 2, fy = h * (1 - (hMin + r() * (hMax - hMin)) * 0.8);
        const gr = g.createRadialGradient(fx, fy, 0, fx, fy, 14 + r() * 18);
        gr.addColorStop(0, rgba(lit, 0.9)); gr.addColorStop(0.3, rgba(lit, 0.35)); gr.addColorStop(1, rgba(lit, 0));
        g.fillStyle = gr; g.fillRect(fx - 40, fy - 40, 80, 80);
        g.fillStyle = '#FFE2A0'; g.fillRect(fx - 1.5, fy - 1.5, 3, 3);
      }
    }
    return c;
  }
  function build(w, h, dpr) {
    const o = {};
    // sky: deep violet zenith -> bruised magenta horizon -> ember glow
    o.sky = cv(256, 256);
    if (o.sky) {
      const g = o.sky.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, '#07050F'); gr.addColorStop(0.35, '#1A1030'); gr.addColorStop(0.6, '#4A1E44'); gr.addColorStop(0.72, '#8A3A3E'); gr.addColorStop(0.8, '#3A1A2E'); gr.addColorStop(1, '#0B0814');
      g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
      const hg = g.createRadialGradient(170, 180, 0, 170, 180, 170);
      hg.addColorStop(0, 'rgba(255,140,80,0.35)'); hg.addColorStop(1, 'rgba(255,140,80,0)'); g.fillStyle = hg; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 160; i++) { g.fillStyle = 'rgba(241,224,255,' + (0.2 + rnd() * 0.7) + ')'; g.fillRect(rnd() * 256, rnd() * 130, rnd() < 0.1 ? 1.4 : 0.7, rnd() < 0.1 ? 1.4 : 0.7); }
    }
    // shattered crystal moon with halo
    o.moon = cv(512, 512);
    if (o.moon) {
      const g = o.moon.getContext('2d'), hg = g.createRadialGradient(256, 256, 60, 256, 256, 256);
      hg.addColorStop(0, 'rgba(190,220,255,0.55)'); hg.addColorStop(0.45, 'rgba(160,120,255,0.18)'); hg.addColorStop(1, 'rgba(120,80,200,0)');
      g.fillStyle = hg; g.fillRect(0, 0, 512, 512);
      const dg = g.createRadialGradient(220, 220, 10, 256, 256, 130);
      dg.addColorStop(0, '#FFFFFF'); dg.addColorStop(0.5, '#CFE8FF'); dg.addColorStop(1, '#8A9EE0');
      g.fillStyle = dg; g.beginPath(); g.arc(256, 256, 128, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(40,30,80,0.3)'; g.lineWidth = 2; g.beginPath();
      g.moveTo(256, 128); g.lineTo(240, 210); g.lineTo(290, 260); g.lineTo(250, 330); g.lineTo(270, 384);
      g.moveTo(240, 210); g.lineTo(160, 230); g.moveTo(290, 260); g.lineTo(370, 240); g.moveTo(250, 330); g.lineTo(180, 350); g.stroke();
    }
    // god ray wedge
    o.ray = cv(64, 512);
    if (o.ray) {
      const g = o.ray.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 512);
      gr.addColorStop(0, 'rgba(200,180,255,0.5)'); gr.addColorStop(1, 'rgba(200,180,255,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(28, 0); g.lineTo(36, 0); g.lineTo(64, 512); g.lineTo(0, 512); g.closePath(); g.fill();
    }
    // shard trail
    o.trail = cv(256, 32);
    if (o.trail) {
      const g = o.trail.getContext('2d'), gr = g.createLinearGradient(0, 0, 256, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.8, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0.95)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, 16); g.lineTo(256, 8); g.lineTo(256, 24); g.closePath(); g.fill();
    }
    // fog band
    o.fog = cv(256, 64);
    if (o.fog) {
      const g = o.fog.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 64);
      gr.addColorStop(0, 'rgba(120,70,140,0)'); gr.addColorStop(0.5, 'rgba(120,70,140,0.38)'); gr.addColorStop(1, 'rgba(120,70,140,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 256, 64);
    }
    // skyline layers (far / mid with fires / near ruins)
    o.far = skyline(w, Math.round(h * 0.45), '#2A1838', 0, 0.25, 0.75, null, 11);
    o.mid = skyline(w, Math.round(h * 0.42), '#170D22', 14, 0.18, 0.6, '#FF7A3D', 23);
    // hero (baked large, the in-game hooded art at tier 3)
    const portrait = w < h, R = Math.round((portrait ? w * 0.13 : h * 0.105));
    o.R = R;
    o.hero = A().bake(R * 6, R * 6, R * 3, R * 3.2, function (g) { NR.fx.actors.paintHero(g, 'ranger', R, 3); }, dpr);
    // cliff: jagged rock with rim light from the moon
    o.cliff = cv(Math.round(w * 0.6), Math.round(h * 0.4));
    if (o.cliff) {
      const g = o.cliff.getContext('2d'), cw = o.cliff.width, ch = o.cliff.height;
      g.fillStyle = '#0C0812'; g.beginPath(); g.moveTo(0, ch);
      g.lineTo(cw * 0.08, ch * 0.55); g.lineTo(cw * 0.2, ch * 0.42); g.lineTo(cw * 0.32, ch * 0.3); g.lineTo(cw * 0.45, ch * 0.22); g.lineTo(cw * 0.6, ch * 0.24);
      g.lineTo(cw * 0.7, ch * 0.32); g.lineTo(cw * 0.82, ch * 0.3); g.lineTo(cw * 0.92, ch * 0.45); g.lineTo(cw, ch * 0.5); g.lineTo(cw, ch); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(200,180,255,0.55)'; g.lineWidth = 2.5; g.beginPath();
      g.moveTo(cw * 0.2, ch * 0.42); g.lineTo(cw * 0.32, ch * 0.3); g.lineTo(cw * 0.45, ch * 0.22); g.lineTo(cw * 0.6, ch * 0.24); g.lineTo(cw * 0.7, ch * 0.32); g.stroke();
      g.fillStyle = 'rgba(255,122,61,0.18)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(cw * (0.25 + i * 0.1), ch); g.lineTo(cw * (0.3 + i * 0.1), ch * (0.5 + (i % 2) * 0.15)); g.lineTo(cw * (0.33 + i * 0.1), ch); g.fill(); }
      // scattered weapons stuck in the rock (a battlefield)
      g.strokeStyle = '#2A2238'; g.lineWidth = 5; g.beginPath(); g.moveTo(cw * 0.15, ch * 0.62); g.lineTo(cw * 0.1, ch * 0.35); g.moveTo(cw * 0.86, ch * 0.5); g.lineTo(cw * 0.93, ch * 0.22); g.stroke();
    }
    return o;
  }

  // ---------- per frame ----------
  function draw(ctx, V, t) {
    init();
    const w = Math.round(V.cssW), h = Math.round(V.cssH), dpr = V.dpr, k = w + 'x' + h + '@' + dpr;
    if (k !== key || !L) { key = k; L = build(w, h, dpr); }
    const reduced = A().reduced() || (globalThis.matchMedia && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches);
    smx += (mx - smx) * 0.04; smy += (my - smy) * 0.04;
    const px = reduced ? 0 : smx, py = reduced ? 0 : smy, tt = reduced ? 0 : t;
    const portrait = w < h, push = 1 + 0.025 * Math.sin(tt * 0.12);
    ctx.setTransform(dpr * push, 0, 0, dpr * push, -(w * dpr * (push - 1)) / 2, -(h * dpr * (push - 1)) / 2);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (L.sky) ctx.drawImage(L.sky, 0, 0, w, h);
    // moon + god rays
    const mxp = w * (portrait ? 0.5 : 0.62) - px * 10, myp = h * (portrait ? 0.2 : 0.28) - py * 8, mr = Math.min(w, h) * 0.24;
    if (L.ray) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const an = 0.35 + i * 0.22 + Math.sin(tt * 0.2 + i) * 0.03;
        ctx.save(); ctx.translate(mxp, myp); ctx.rotate(an); ctx.globalAlpha = 0.07 + 0.03 * Math.sin(tt * 0.5 + i * 2);
        ctx.drawImage(L.ray, -mr * 0.25, 0, mr * 0.5, h * 1.2); ctx.restore();
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    if (L.moon) ctx.drawImage(L.moon, mxp - mr * 2, myp - mr * 2, mr * 4, mr * 4);
    // moon fragments drifting apart
    for (let i = 0; i < 7; i++) {
      const an = i * 0.9 + 0.3, d = mr * (1.05 + 0.08 * Math.sin(tt * 0.3 + i)), fx = mxp + Math.cos(an) * d, fy = myp + Math.sin(an) * d * 0.9, s = mr * (0.05 + (i % 3) * 0.025);
      ctx.save(); ctx.translate(fx, fy); ctx.rotate(tt * 0.1 * (i & 1 ? 1 : -1) + i);
      ctx.fillStyle = '#AFC4F5'; ctx.beginPath(); ctx.moveTo(0, -s * 1.4); ctx.lineTo(s, 0); ctx.lineTo(0, s * 1.2); ctx.lineTo(-s * 0.8, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#EAF2FF'; ctx.beginPath(); ctx.moveTo(0, -s * 1.4); ctx.lineTo(s, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // falling shards with trails
    if (L.trail) {
      for (let i = 0; i < SH; i++) {
        const S = shard[i], ph = (S.y + tt * 0.07 * S.v) % 1.2, x = ((S.x + ph * 0.5) % 1.1) * w - w * 0.05, y = ph * h * 0.8 - h * 0.1, ang = 1.05, len = 90 * S.s;
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5; ctx.drawImage(L.trail, -len, -4 * S.s, len, 8 * S.s);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        ctx.fillStyle = S.c; ctx.beginPath(); ctx.moveTo(3 * S.s, 0); ctx.lineTo(0, -2.2 * S.s); ctx.lineTo(-3 * S.s, 0); ctx.lineTo(0, 2.2 * S.s); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
    // skylines with parallax
    const horizon = h * (portrait ? 0.62 : 0.58);
    if (L.far) { const ox = ((tt * 4 + px * 14) % w + w) % w; ctx.drawImage(L.far, -ox, horizon - L.far.height, L.far.width, L.far.height); }
    if (L.fog) { ctx.globalAlpha = 0.8; ctx.drawImage(L.fog, 0, horizon - h * 0.06, w, h * 0.12); ctx.globalAlpha = 1; }
    // the horde massing on the ridge: dark spiky silhouettes with glowing fissures
    const ridge = horizon + h * 0.05;
    for (let i = 0; i < 40; i++) {
      const hx = ((i * 0.0287 + 0.02) % 1) * w * 1.1 - px * 22, sz = h * (0.011 + (i % 5) * 0.004) * (i % 7 === 0 ? 1.8 : 1), sway = Math.sin(tt * 1.3 + i) * sz * 0.12, hy = ridge + (i % 3) * sz * 0.7;
      if (portrait && Math.abs(hx - w / 2) < w * 0.18) continue;
      // hunched, spined silhouettes (no faces): a body mound, a ridge of back spines, long arms; a glowing fissure down the spine
      ctx.fillStyle = '#0B0714'; ctx.beginPath();
      ctx.moveTo(hx - sz * 1.3, hy + sz * 0.6); ctx.quadraticCurveTo(hx - sz * 1.2 + sway, hy - sz * 1.2, hx + sway * 0.5, hy - sz * 1.4);
      for (let k = 0; k < 4; k++) { const f = k / 4; ctx.lineTo(hx - sz * 0.2 + f * sz * 1.2 + sway, hy - sz * (1.4 - f * 0.6) - sz * 0.55); ctx.lineTo(hx + f * sz * 1.2 + sz * 0.15 + sway, hy - sz * (1.3 - f * 0.6)); }
      ctx.quadraticCurveTo(hx + sz * 1.4, hy - sz * 0.2, hx + sz * 1.2, hy + sz * 0.6); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#0B0714'; ctx.lineWidth = sz * 0.22; ctx.beginPath(); ctx.moveTo(hx - sz * 0.9, hy - sz * 0.3); ctx.lineTo(hx - sz * 1.7 - sway, hy + sz * 0.8); ctx.stroke();
      ctx.strokeStyle = i % 4 ? 'rgba(255,61,79,0.85)' : 'rgba(255,154,61,0.85)'; ctx.lineWidth = Math.max(1, sz * 0.09); ctx.beginPath();
      ctx.moveTo(hx - sz * 0.1 + sway, hy - sz * 1.1); ctx.lineTo(hx + sz * 0.2 + sway, hy - sz * 0.6); ctx.lineTo(hx + sz * 0.05, hy - sz * 0.1); ctx.stroke();
    }
    if (L.mid) { const ox = ((tt * 9 + px * 30) % w + w) % w; ctx.drawImage(L.mid, -ox, h - L.mid.height + h * 0.06, L.mid.width, L.mid.height); }
    // embers rising
    ctx.fillStyle = '#FFB45A';
    for (let i = 0; i < EM; i++) {
      const E = ember[i], ph = (E.y - tt * E.v) % 1, yy = (ph < 0 ? ph + 1 : ph) * h, xx = (E.x * w + Math.sin(tt * 0.8 + E.p) * 18 - px * 40 + w) % w;
      ctx.globalAlpha = 0.35 + 0.5 * Math.abs(Math.sin(tt * 2 + E.p)); ctx.fillRect(xx, yy, E.s, E.s);
    }
    ctx.globalAlpha = 1;
    // cliff + hero
    const hx = portrait ? w * 0.5 : w * 0.7 - px * 26, feet = portrait ? h * 0.4 : h * 0.74 - py * 6;
    if (L.cliff) ctx.drawImage(L.cliff, hx - L.cliff.width * 0.52, feet - L.cliff.height * 0.24, L.cliff.width, L.cliff.height);
    hero(ctx, hx, feet, tt, reduced);
    // fog in front, vignette, letterbox
    if (L.fog) { ctx.globalAlpha = 0.55; ctx.drawImage(L.fog, -px * 30, h * 0.82, w * 1.1, h * 0.2); ctx.globalAlpha = 1; }
    const vg = A().vignette('title', '#0B0814'); if (vg) ctx.drawImage(vg, 0, 0, w, h);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bar = Math.round(h * (portrait ? 0.035 : 0.07));
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, w, bar); ctx.fillRect(0, h - bar, w, bar);
  }

  function hero(ctx, x, feet, tt, reduced) {
    const R = L.R, sp = L.hero, ink = NR.config.INK;
    const cy = feet - R * 0.95, breathe = 1 + 0.015 * Math.sin(tt * 1.6);
    // aura on the ground
    const ls = A().lightSprite('#7FE3F5');
    if (ls) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35; ctx.drawImage(ls, x - R * 3, cy - R * 3, R * 6, R * 6); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    // scarf ribbons streaming in the wind (behind the body)
    for (let k = 0; k < 2; k++) {
      ctx.strokeStyle = k ? '#7A2A1E' : '#B8452F'; ctx.lineWidth = R * (k ? 0.22 : 0.16); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - R * 0.3, cy - R * 0.15);
      for (let i = 1; i <= 6; i++) { const f = i / 6; ctx.lineTo(x - R * 0.3 - f * R * 3.2, cy - R * 0.15 + Math.sin(tt * 4.5 - i * 0.9 + k) * R * 0.25 * f - f * R * 0.4 + k * R * 0.15); }
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
    if (sp) { ctx.save(); ctx.translate(x, cy); ctx.scale(breathe, 2 - breathe); ctx.drawImage(sp.img, -sp.ax, -sp.ay, sp.w, sp.h); ctx.restore(); }
    // four armed hands floating around, weapons pointed down-left at the horde
    const guns = ['railgun', 'smg', 'flamer', 'comet_staff'], aim = Math.PI * 0.86 + Math.sin(tt * 0.6) * 0.05;
    for (let i = 0; i < 4; i++) {
      const th = -Math.PI / 2 + (i + 0.5) / 4 * TAU, hx = x + Math.cos(th) * R * 1.55, hy = cy + Math.sin(th) * R * 1.0 + Math.sin(tt * 1.4 + i) * R * 0.05;
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(aim); ctx.scale(1, -1); ctx.scale(R / 30, R / 30); ctx.translate(-8, 0);
      NR.fx.render.drawHeldWeapon(ctx, guns[i], 0);
      ctx.fillStyle = '#5FA8D3'; ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(9, 3, 3.6, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    // crest glow + orbiting shard halo
    if (ls) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6 + 0.2 * Math.sin(tt * 3);
      const cx = x - R * 0.5, cyy = cy - R * 2.15; ctx.drawImage(ls, cx - R * 1.4, cyy - R * 1.4, R * 2.8, R * 2.8);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    for (let i = 0; i < 6; i++) {
      const an = tt * 0.9 + i * TAU / 6, ox = Math.cos(an) * R * 1.9, oy = Math.sin(an) * R * 0.6, s = R * 0.12, front = Math.sin(an) > 0;
      if (!front && i % 2) continue;
      const sx = x + ox, sy = cy - R * 0.2 + oy;
      ctx.fillStyle = ink; ctx.beginPath(); ctx.moveTo(sx, sy - s * 1.6); ctx.lineTo(sx + s, sy); ctx.lineTo(sx, sy + s * 1.6); ctx.lineTo(sx - s, sy); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#7FE3F5'; ctx.beginPath(); ctx.moveTo(sx, sy - s * 1.2); ctx.lineTo(sx + s * 0.6, sy); ctx.lineTo(sx, sy + s * 1.2); ctx.lineTo(sx - s * 0.6, sy); ctx.closePath(); ctx.fill();
    }
    void reduced;
  }

  NR.fx = NR.fx || {};
  NR.fx.title = { init: init, draw: draw };
})();
