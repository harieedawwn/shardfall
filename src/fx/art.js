// Owner: FX
// "Flat++" art kit: colour tokens, graphics quality presets, sprite baking (gradients are only ever used here, on
// offscreen canvases, once per sprite/scale/zone), additive light sprites (batched, capped per quality), hostile and
// player bullet sprites, telegraph stripes, vignette and parallax motes. Never touches sim state; cosmetic PRNG only.
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  const TAU = Math.PI * 2;

  // ---------- tokens (mirrored as CSS variables in css/ui.css :root) ----------
  const T = {
    ink: '#14121F', ink2: '#0B0A12', night: '#1A1428', panel: '#251C38', panel2: '#30254A', line: '#46386A',
    cream: '#F6F0DF', mute: '#B8B0CC', dim: '#8F88A6', amber: '#FFC23D', cyan: '#6FD6F2', good: '#8BD450', bad: '#FF5468',
    hp: '#FF5C8A', hpLag: '#F6F0DF', xp: '#6FD6F2', ult: '#B57CFF', gold: '#FFC23D', white: '#FFFFFF',
    rarity: { common: '#B9B6C8', rare: '#4FA8F0', epic: '#B26CF5', legendary: '#FFC23D' },
    hostile: '#FF3D6E', hostileGlow: '#FF5C86', tele: '#FF3D6E', teleCalm: '#FF7A93',
    eye: '#FFFDF4', pupil: '#14121F', elite: '#FFC23D'
  };

  // ---------- graphics quality ----------
  const PRESETS = {
    low: { id: 'low', maxDpr: 1, lights: 0, motes: 0, floorMax: 1, vignette: false, detail: 0 },
    medium: { id: 'medium', maxDpr: 1.5, lights: 90, motes: 18, floorMax: 1.5, vignette: true, detail: 1 },
    high: { id: 'high', maxDpr: 2, lights: 260, motes: 36, floorMax: 2, vignette: true, detail: 2 }
  };
  const SCALES = [1, 0.85, 0.72];
  let setting = 'auto', Q = PRESETS.high, scaleIx = 0, slowT = 0, fastT = 0, lastDraw = 0, version = 1, reduced = false;

  function hasDom() { return typeof document !== 'undefined' && !!document.createElement; }
  function autoPreset() {
    const g = globalThis, n = g.navigator || {};
    let touch = false;
    try { touch = !!(g.matchMedia && g.matchMedia('(pointer: coarse)').matches); } catch (e) { touch = false; }
    const mem = n.deviceMemory || 4, cores = n.hardwareConcurrency || 4;
    if (touch && (mem <= 3 || cores <= 4)) return 'low';
    if (touch) return 'medium';
    if (mem <= 2 || cores <= 2) return 'medium';
    return 'high';
  }
  function applyQuality(v) {
    setting = PRESETS[v] || v === 'auto' ? v : 'auto';
    Q = PRESETS[setting === 'auto' ? autoPreset() : setting];
    scaleIx = 0; slowT = 0; fastT = 0; version++;
  }
  // called once per drawn frame with the real frame time; only 'auto' adapts (resolution first, then preset)
  function frameTime(dt) {
    if (setting !== 'auto' || !(dt > 0) || dt > 0.25) return;
    if (dt > 0.022) { slowT += dt; fastT = 0; } else if (dt < 0.0145) { fastT += dt; slowT = 0; } else { slowT = Math.max(0, slowT - dt); }
    if (slowT > 2) {
      slowT = 0;
      if (scaleIx < SCALES.length - 1) { scaleIx++; version++; }
      else if (Q.id === 'high') { Q = PRESETS.medium; version++; } else if (Q.id === 'medium') { Q = PRESETS.low; scaleIx = 0; version++; }
    } else if (fastT > 10 && scaleIx > 0) { fastT = 0; scaleIx--; version++; }
  }
  function tickFrame() {
    const p = globalThis.performance, now = p && p.now ? p.now() : 0;
    if (lastDraw) frameTime((now - lastDraw) / 1000);
    lastDraw = now;
  }

  // ---------- colour helpers (only used while baking or once per id) ----------
  function shade(c, a) { return NR.util.shade(c, a); }
  function hex2(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) {
    const x = hex2(a), y = hex2(b), o = [0, 0, 0];
    for (let i = 0; i < 3; i++) o[i] = Math.round(x[i] + (y[i] - x[i]) * t);
    return '#' + ((1 << 24) | (o[0] << 16) | (o[1] << 8) | o[2]).toString(16).slice(1).toUpperCase();
  }
  function rgba(c, a) { const x = hex2(c); return 'rgba(' + x[0] + ',' + x[1] + ',' + x[2] + ',' + a + ')'; }

  // ---------- sprite baking ----------
  // S = device pixels per world unit. Sprites are baked at S so they blit 1:1; caches are dropped when S changes bucket.
  let S = 1, gen = 0;
  const stores = [];
  function store() { const s = { map: Object.create(null) }; stores.push(s); return s; }
  function setScale(s) {
    const b = Math.max(0.375, Math.min(4, Math.round(s * 8) / 8));
    if (b === S) return false;
    S = b; gen++;
    for (let i = 0; i < stores.length; i++) stores[i].map = Object.create(null);
    return true;
  }
  function canvas(w, h) {
    if (!hasDom()) return null;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
    return c;
  }
  // paint(g) draws in world units around (0,0); the sprite covers [-ax, w-ax] x [-ay, h-ay]
  function bake(w, h, ax, ay, paint, scale) {
    const s = scale || S, c = canvas(w * s + 2, h * s + 2);
    if (!c) return null;
    const g = c.getContext('2d');
    if (!g) return null;
    g.setTransform(s, 0, 0, s, (ax * s) + 1, (ay * s) + 1);
    g.lineJoin = 'round'; g.lineCap = 'round';
    paint(g);
    return { img: c, w: (w * s + 2) / s, h: (h * s + 2) / s, ax: ax + 1 / s, ay: ay + 1 / s };
  }
  function get(st, key, make) {
    let v = st.map[key];
    if (v === undefined) { v = make(); st.map[key] = v; }
    return v;
  }
  function blit(ctx, sp, x, y) { if (sp) ctx.drawImage(sp.img, x - sp.ax, y - sp.ay, sp.w, sp.h); }

  // cel-shaded fill of the current path: soft vertical gradient (top light, bottom dark), hard shadow crescent,
  // small highlight; then the ink outline. pathFn(g) must rebuild the path. lw in world px.
  function cel(g, pathFn, color, lw, o) {
    o = o || {};
    const top = o.top === undefined ? -o.r : o.top, bot = o.bot === undefined ? o.r : o.bot, r = o.r || 10;
    pathFn(g);
    const gr = g.createLinearGradient(0, top, 0, bot);
    gr.addColorStop(0, shade(color, 0.22)); gr.addColorStop(0.5, color); gr.addColorStop(1, shade(color, -0.12));
    g.fillStyle = gr; g.fill();
    if (o.shadow !== false) {
      g.save(); pathFn(g); g.clip();
      g.fillStyle = shade(color, -0.3);
      g.beginPath(); g.rect(-r * 3, -r * 3, r * 6, r * 6);
      g.translate(-r * 0.22, -r * 0.3); pathFn(g, true);
      g.fill('evenodd');
      g.restore();
    }
    if (o.hi !== false) {
      g.save(); pathFn(g); g.clip();
      g.fillStyle = rgba('#FFFFFF', o.hiA || 0.38);
      g.beginPath(); g.ellipse(-r * 0.38, -r * 0.5, r * 0.32, r * 0.18, -0.5, 0, TAU); g.fill();
      g.restore();
    }
    if (lw > 0) { pathFn(g); g.lineWidth = lw; g.strokeStyle = o.ink || T.ink; g.stroke(); }
  }
  // flat silhouette (white hit flash / frozen tint) with ink outline
  function flat(g, pathFn, color, lw) {
    pathFn(g); g.fillStyle = color; g.fill();
    if (lw > 0) { pathFn(g); g.lineWidth = lw; g.strokeStyle = T.ink; g.stroke(); }
  }

  // soft light pool painted into a baked canvas (floor chunks): radial gradient, bake time only
  function glow(g, x, y, r, color, a) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba(color, a)); gr.addColorStop(0.6, rgba(color, a * 0.35)); gr.addColorStop(1, rgba(color, 0));
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // soft smoke/dust puff (baked once per colour): lumpy radial blob, drawn with alpha by particles
  const puffImg = Object.create(null);
  function puff(color) {
    let c = puffImg[color];
    if (c === undefined) {
      c = canvas(64, 64);
      if (c) {
        const g = c.getContext('2d'), blobs = [[32, 32, 26], [22, 28, 15], [42, 26, 16], [36, 42, 14], [24, 40, 12]];
        for (let i = 0; i < blobs.length; i++) {
          const b = blobs[i], gr = g.createRadialGradient(b[0], b[1], 0, b[0], b[1], b[2]);
          gr.addColorStop(0, rgba(color, 0.55)); gr.addColorStop(0.6, rgba(color, 0.28)); gr.addColorStop(1, rgba(color, 0));
          g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
        }
      }
      puffImg[color] = c;
    }
    return c;
  }

  // ---------- light sprites (additive, batched, capped) ----------
  const lightImg = Object.create(null);
  const LMAX = 300, lx = new Float32Array(LMAX), ly = new Float32Array(LMAX), lr = new Float32Array(LMAX), la = new Float32Array(LMAX), lc = new Array(LMAX);
  let ln = 0, vx0 = -1e9, vy0 = -1e9, vx1 = 1e9, vy1 = 1e9;
  function lightSprite(color) {
    let c = lightImg[color];
    if (c === undefined) {
      c = canvas(64, 64);
      if (c) {
        const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, rgba(mix(color, '#FFFFFF', 0.55), 0.95)); gr.addColorStop(0.25, rgba(color, 0.55));
        gr.addColorStop(0.6, rgba(color, 0.16)); gr.addColorStop(1, rgba(color, 0));
        g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      }
      lightImg[color] = c;
    }
    return c;
  }
  function setView(x0, y0, x1, y1) { vx0 = x0; vy0 = y0; vx1 = x1; vy1 = y1; }
  function light(x, y, r, color, a) {
    if (ln >= Q.lights || ln >= LMAX) return;
    if (x + r < vx0 || x - r > vx1 || y + r < vy0 || y - r > vy1) return;
    lx[ln] = x; ly[ln] = y; lr[ln] = r; la[ln] = a === undefined ? 1 : a; lc[ln] = color; ln++;
  }
  const BLOOM = 0.5; // global additive strength: lights accent, they do not wash the scene
  function flushLights(ctx) {
    if (!ln) return;
    const k = (reduced ? 0.6 : 1) * BLOOM;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < ln; i++) {
      const img = lightSprite(lc[i]);
      if (!img) continue;
      ctx.globalAlpha = Math.min(1, la[i] * k);
      ctx.drawImage(img, lx[i] - lr[i], ly[i] - lr[i], lr[i] * 2, lr[i] * 2);
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ln = 0;
  }
  function lightCount() { return ln; }

  // ---------- bullets ----------
  const bul = store();
  // hostile: 4-point thorn with white inner rim and hot core; distinct shape (not just colour) and bright rim
  function hostileBullet(r) {
    const R = Math.max(5, Math.round(r + 3));
    return get(bul, 'h' + R, function () {
      const ext = R * 1.5 + 3;
      return bake(ext * 2, ext * 2, ext, ext, function (g) {
        const path = function (gg) {
          gg.beginPath();
          for (let i = 0; i < 8; i++) {
            const a = i / 8 * TAU - Math.PI / 4, rr = i % 2 ? R * 0.62 : R * 1.42;
            if (i) gg.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else gg.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
          }
          gg.closePath();
        };
        path(g); g.lineWidth = 2.6; g.strokeStyle = T.ink; g.stroke();
        path(g); g.fillStyle = '#FFFFFF'; g.fill();
        g.beginPath(); g.arc(0, 0, R * 0.62, 0, TAU); g.fillStyle = T.hostile; g.fill();
        g.beginPath(); g.arc(-R * 0.16, -R * 0.18, R * 0.2, 0, TAU); g.fillStyle = '#FFE3EA'; g.fill();
      });
    });
  }
  // styled hostile shots: every style keeps the ink outline + white inner rim (colour-blind safe), shapes differ
  const HSTY = {
    glob: ['#7FE04A', function (g, R) { g.beginPath(); g.ellipse(0, 0, R * 1.2, R, 0, 0, TAU); g.moveTo(-R * 1.1, 0); g.quadraticCurveTo(-R * 2, R * 0.2, -R * 1.9, R * 0.9); g.quadraticCurveTo(-R * 1.4, R * 0.6, -R * 1.0, R * 0.55); }],
    needle: ['#FF3D6E', function (g, R) { g.beginPath(); g.moveTo(R * 2.4, 0); g.lineTo(0, -R * 0.55); g.lineTo(-R * 1.6, 0); g.lineTo(0, R * 0.55); g.closePath(); }],
    dart: ['#4FA8F0', function (g, R) { g.beginPath(); g.moveTo(R * 1.6, 0); g.lineTo(-R * 0.9, -R * 1.0); g.lineTo(-R * 0.4, 0); g.lineTo(-R * 0.9, R * 1.0); g.closePath(); }],
    bolt: ['#FFC23D', function (g, R) { g.beginPath(); g.rect(-R * 1.4, -R * 0.55, R * 2.8, R * 1.1); }],
    shell: ['#FF7A2F', function (g, R) { g.beginPath(); g.moveTo(R * 1.5, 0); g.quadraticCurveTo(R * 1.2, -R, 0, -R); g.lineTo(-R * 1.2, -R * 0.8); g.lineTo(-R * 1.2, R * 0.8); g.lineTo(0, R); g.quadraticCurveTo(R * 1.2, R, R * 1.5, 0); g.closePath(); }],
    shard: ['#7FD3F0', function (g, R) { g.beginPath(); g.moveTo(R * 1.7, 0); g.lineTo(R * 0.2, -R * 0.8); g.lineTo(-R * 1.3, -R * 0.3); g.lineTo(-R * 0.9, R * 0.5); g.lineTo(R * 0.3, R * 0.75); g.closePath(); }],
    orb: ['#B57CFF', function (g, R) { g.beginPath(); g.arc(0, 0, R * 1.15, 0, TAU); }]
  };
  function hostileStyled(style, r) {
    const st = HSTY[style];
    if (!st) return hostileBullet(r);
    const R = Math.max(4, Math.round(r + 1.5));
    return get(bul, style + R, function () {
      const ext = R * 2.6 + 3;
      return bake(ext * 2, ext * 2, ext, ext, function (g) {
        st[1](g); g.lineWidth = 2.8; g.strokeStyle = T.ink; g.stroke();
        st[1](g); g.fillStyle = '#FFFFFF'; g.fill();
        g.save(); g.scale(0.7, 0.7); st[1](g); g.fillStyle = st[0]; g.fill(); g.restore();
        if (style === 'orb') { g.beginPath(); g.arc(0, 0, R * 0.38, 0, TAU); g.fillStyle = '#14121F'; g.fill(); }
        g.beginPath(); g.arc(-R * 0.2, -R * 0.25, R * 0.18, 0, TAU); g.fillStyle = 'rgba(255,255,255,0.8)'; g.fill();
      });
    });
  }
  function hostileColor(style) { const st = HSTY[style]; return st ? st[0] : T.hostileGlow; }
  const ORIENT = { needle: 1, dart: 1, bolt: 1, shell: 1, shard: 1, glob: 1 };

  // player shots: elongated, element coloured but muted, no ink outline (less contrast than hostile shots)
  function playerBullet(color, r, evo) {
    const R = Math.max(3, Math.round(r));
    return get(bul, 'p' + color + R + (evo ? 'e' : ''), function () {
      const L = R * (evo ? 3.6 : 3), Wd = R * 1.25, body = mix(color, T.ink, 0.12), core = mix(color, '#FFFFFF', 0.55);
      return bake(L + 4, Wd * 2 + 4, L * 0.7 + 2, Wd + 2, function (g) {
        const cap = function (gg, w) { gg.beginPath(); gg.moveTo(L * 0.3, -w); gg.lineTo(-L * 0.55, -w * 0.35); gg.lineTo(-L * 0.7, 0); gg.lineTo(-L * 0.55, w * 0.35); gg.lineTo(L * 0.3, w); gg.arc(L * 0.3, 0, w, Math.PI / 2, -Math.PI / 2, true); gg.closePath(); };
        cap(g, Wd * 0.62); g.fillStyle = shade(body, -0.35); g.fill();
        cap(g, Wd * 0.48); g.fillStyle = body; g.fill();
        g.beginPath(); g.ellipse(L * 0.2, 0, Wd * 0.62, Wd * 0.26, 0, 0, TAU); g.fillStyle = core; g.fill();
        if (evo) { g.beginPath(); g.ellipse(-L * 0.25, 0, L * 0.25, Wd * 0.14, 0, 0, TAU); g.fillStyle = '#FFFFFF'; g.fill(); }
      });
    });
  }

  // ---------- telegraph stripes ----------
  let stripeImg = null, stripeCalmImg = null;
  function stripes(calm) {
    if (calm ? stripeCalmImg : stripeImg) return calm ? stripeCalmImg : stripeImg;
    const c = canvas(24, 24);
    if (!c) return null;
    const g = c.getContext('2d');
    g.fillStyle = rgba(calm ? T.teleCalm : T.tele, calm ? 0.16 : 0.2); g.fillRect(0, 0, 24, 24);
    g.strokeStyle = rgba(calm ? T.teleCalm : T.tele, 0.5); g.lineWidth = 5;
    g.beginPath(); g.moveTo(-6, 30); g.lineTo(30, -6); g.moveTo(-18, 18); g.lineTo(18, -18); g.moveTo(6, 42); g.lineTo(42, 6); g.stroke();
    if (calm) stripeCalmImg = c; else stripeImg = c;
    return c;
  }

  // ---------- vignette (baked per zone, stretched to the screen) ----------
  const vig = Object.create(null);
  function vignette(zone, tint) {
    let c = vig[zone];
    if (c === undefined) {
      c = canvas(320, 180);
      if (c) {
        const g = c.getContext('2d'), gr = g.createRadialGradient(160, 90, 40, 160, 90, 200);
        gr.addColorStop(0, rgba(tint, 0)); gr.addColorStop(0.55, rgba(tint, 0.12)); gr.addColorStop(1, rgba(T.ink2, 0.62));
        g.fillStyle = gr; g.fillRect(0, 0, 320, 180);
      }
      vig[zone] = c;
    }
    return c;
  }

  // ---------- parallax motes (dust / snow / void specks), screen space ----------
  const MOTES = 48, mx = new Float32Array(MOTES), my = new Float32Array(MOTES), ms = new Float32Array(MOTES), mz = new Float32Array(MOTES);
  let moteSeed = 7, motesReady = false;
  function mrnd() { moteSeed = (Math.imul(moteSeed, 1664525) + 1013904223) >>> 0; return moteSeed / 4294967296; }
  const MOTE = { scrap: ['#E9C98A', 0.05, -6], frost: ['#EAF4FB', 0.22, 26], void: ['#C9A3FF', 0.08, -10] };
  function drawMotes(ctx, zone, camX, camY, w, h, t) {
    const n = Math.min(MOTES, Q.motes);
    if (!n || reduced) return;
    if (!motesReady) { for (let i = 0; i < MOTES; i++) { mx[i] = mrnd(); my[i] = mrnd(); ms[i] = 0.6 + mrnd() * 1.4; mz[i] = 0.12 + mrnd() * 0.3; } motesReady = true; }
    const m = MOTE[zone] || MOTE.scrap;
    ctx.fillStyle = m[0];
    for (let i = 0; i < n; i++) {
      const px = mx[i] * (w + 40) - camX * mz[i] + Math.sin(t * 0.7 + i) * 14 + m[1] * 0 , py = my[i] * (h + 40) - camY * mz[i] + t * m[2] * ms[i];
      const x = ((px % (w + 40)) + (w + 40)) % (w + 40) - 20, y = ((py % (h + 40)) + (h + 40)) % (h + 40) - 20;
      ctx.globalAlpha = 0.18 + 0.22 * mz[i] * 3;
      const s = ms[i] * (zone === 'frost' ? 2.2 : 1.6);
      ctx.fillRect(x, y, s, s);
    }
    ctx.globalAlpha = 1;
  }

  function init() {
    const st = NR.save && NR.save.getSettings ? NR.save.getSettings() : {};
    applyQuality(st.quality || 'auto');
    reduced = !!st.reduceFlashing;
    NR.events.on('settings:change', function (e) {
      if (e.key === 'quality') applyQuality(e.value);
      else if (e.key === 'reduceFlashing') reduced = !!e.value;
    });
  }

  NR.fx = NR.fx || {};
  NR.fx.art = {
    T: T, PRESETS: PRESETS, init: init, applyQuality: applyQuality, frameTime: frameTime, tickFrame: tickFrame,
    quality: function () { return Q; }, setting: function () { return setting; }, renderScale: function () { return SCALES[scaleIx]; },
    version: function () { return version; }, reduced: function () { return reduced; },
    scale: function () { return S; }, gen: function () { return gen; }, setScale: setScale,
    store: store, bake: bake, glow: glow, puff: puff, get: get, blit: blit, cel: cel, flat: flat, mix: mix, rgba: rgba, shade: shade, canvas: canvas,
    light: light, flushLights: flushLights, lightCount: lightCount, lightSprite: lightSprite, setView: setView,
    hostileBullet: hostileBullet, hostileStyled: hostileStyled, hostileColor: hostileColor, orient: function (s) { return !!ORIENT[s]; }, playerBullet: playerBullet, stripes: stripes, vignette: vignette, drawMotes: drawMotes
  };
})();
