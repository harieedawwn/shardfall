// Owner: FX
// Frame renderer. Draws every entity with high-detail procedural vector anatomy, dynamic stride cycles,
// distinct character classes, held weapon recoil, and 12 unique animated enemy models + multi-part bosses.
// Strictly compliant with SPEC 12: flat style, solid fills, crisp INK (#14121F) 2.5-3px outlines,
// hard offset shadows. Zero gradients, zero blur, zero bloom, zero neon.
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  const TAU = Math.PI * 2;
  const FALLBACK_PAL = ['#2E3A32', '#3C4B40', '#1F2822', '#C9A24B', '#D9693A', '#EDE3C8'];
  const ICE = '#7FD3F0', FROZEN = '#CFEFFA';
  const view = { x: 0, y: 0 }, sz = { w: 1280, h: 720 };
  const evoCache = Object.create(null);
  let ctx = null, zone = 'scrap', cw = 1280, ch = 720, pal = FALLBACK_PAL, t = 0;
  let lastFireT = -10, lastFireSlot = 0, lastFireKind = '', lastFireWeapon = '';
  const M = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };   // world -> device transform of this frame (camera applied)
  let calm = false, blinkT = 0, dreadLvl = 0;
  function readM(c) { const m = c.getTransform ? c.getTransform() : null; if (m) { M.a = m.a; M.b = m.b; M.c = m.c; M.d = m.d; M.e = m.e; M.f = m.f; } }
  function resetM(c) { c.setTransform(M.a, M.b, M.c, M.d, M.e, M.f); }

  function now() { const p = globalThis.performance; return (p && p.now ? p.now() : Date.now()) / 1000; }
  // ---------- responsive viewport ----------
  // The canvas covers the real visual viewport at min(devicePixelRatio, quality cap) x renderScale. The visible world keeps
  // its short side at SHORT (720) world px; the long side follows the screen up to 21:9 (LONG = 1680), beyond that the
  // world is centred and the sides get a decorative frame. K = device px per world px, (ox, oy) = world rect offset.
  const SHORT = 720, LONG = 1680;
  const V = { cssW: 1280, cssH: 720, dpr: 1, bw: 1280, bh: 720, k: 1, ox: 0, oy: 0, worldW: 1280, worldH: 720, portrait: false, ver: 0 };
  let canvasEl = null, dirty = true, artVer = -1;
  function fit() {
    const g = globalThis, vv = g.visualViewport, art = NR.fx.art;
    let cw0 = vv && vv.width > 0 ? vv.width : g.innerWidth, ch0 = vv && vv.height > 0 ? vv.height : g.innerHeight;
    if (!(cw0 > 0) || !(ch0 > 0)) { cw0 = NR.config.VIEW.w; ch0 = NR.config.VIEW.h; }
    const Q = art ? art.quality() : { maxDpr: 1 }, rs = art ? art.renderScale() : 1;
    const dpr = Math.max(0.5, Math.min(g.devicePixelRatio || 1, Q.maxDpr) * rs);
    const bw = Math.max(1, Math.round(cw0 * dpr)), bh = Math.max(1, Math.round(ch0 * dpr));
    if (canvasEl) {
      if (canvasEl.style) { canvasEl.style.width = cw0 + 'px'; canvasEl.style.height = ch0 + 'px'; canvasEl.style.left = (vv ? vv.offsetLeft || 0 : 0) + 'px'; canvasEl.style.top = (vv ? vv.offsetTop || 0 : 0) + 'px'; }
      if (canvasEl.width !== bw) canvasEl.width = bw;
      if (canvasEl.height !== bh) canvasEl.height = bh;
    }
    const asp = cw0 / ch0;
    let vw, vh;
    if (asp >= 1) { vh = SHORT; vw = Math.min(LONG, SHORT * asp); } else { vw = SHORT; vh = Math.min(LONG, SHORT / asp); }
    const k = Math.min(bw / vw, bh / vh);
    V.cssW = cw0; V.cssH = ch0; V.dpr = bw / cw0; V.bw = bw; V.bh = bh; V.k = k;
    V.ox = Math.round((bw - vw * k) / 2); V.oy = Math.round((bh - vh * k) / 2);
    V.worldW = vw; V.worldH = vh; V.portrait = asp < 1; V.ver++;
    cw = vw; ch = vh; sz.w = vw; sz.h = vh;
    NR.camera.resize(vw, vh);
    if (art) { art.setScale(k); artVer = art.version(); }
    dirty = false;
  }
  function markDirty() { dirty = true; }
  // client (CSS px) -> world-view px (what NR.camera.toWorld expects)
  function toView(clientX, clientY, out) {
    out = out || {};
    let left = 0, top = 0;
    if (canvasEl && canvasEl.getBoundingClientRect) { const r = canvasEl.getBoundingClientRect(); left = r.left; top = r.top; }
    out.x = ((clientX - left) * V.dpr - V.ox) / V.k;
    out.y = ((clientY - top) * V.dpr - V.oy) / V.k;
    return out;
  }
  function init(canvas) {
    canvasEl = canvas;
    ctx = canvas.getContext('2d');
    cw = NR.config.VIEW.w; ch = NR.config.VIEW.h;
    fit();
    const g = globalThis;
    if (g.addEventListener) {
      g.addEventListener('resize', markDirty);
      g.addEventListener('orientationchange', markDirty);
      if (g.visualViewport && g.visualViewport.addEventListener) { g.visualViewport.addEventListener('resize', markDirty); g.visualViewport.addEventListener('scroll', markDirty); }
    }
    NR.events.on('wave:start', function (e) { setZone(e.zone); });
    NR.events.on('run:start', function () { setZone('scrap'); });
    NR.events.on('settings:change', function (e) { if (e.key === 'quality') dirty = true; });
    NR.events.on('weapon:fire', function (e) {
      lastFireT = now();
      lastFireSlot = e.slot || 0;
      lastFireKind = e.kind || '';
      lastFireWeapon = e.weaponId || '';
    });
  }
  function resize(w, h) { if (w && h) { cw = w; ch = h; sz.w = w; sz.h = h; NR.camera.resize(w, h); } else dirty = true; }
  function setZone(id) { if (NR.data.zones && NR.data.zones[id]) zone = id; }
  function palette() { const z = NR.data.zones && NR.data.zones[zone]; return z ? z.palette : FALLBACK_PAL; }
  function inView(x, y, m) { return x > view.x - m && x < view.x + cw + m && y > view.y - m && y < view.y + ch + m; }
  function evolved(id) {
    let v = evoCache[id];
    if (v === undefined) { const d = NR.data.weapons && NR.data.weapons[id]; v = evoCache[id] = !!(d && d.evolved); }
    return v;
  }
  function active(v) { return v && (v === true || v.t > 0 || (typeof v === 'number' && v > 0)); }
  function shade(c, f) { return NR.util ? NR.util.shade(c, f) : c; }

  // ---------- status visuals: flat shapes only ----------
  function statusFx(c, e, x, y, r) {
    const S = e.status; if (!S) return;
    for (const k in S) {
      const v = S[k];
      if (!active(v) || k === 'pull' || k === 'slow_none') continue;
      const seed = (e.id * 0.137) % 1;
      if (/burn|fire|ignite/.test(k)) {
        for (let i = 0; i < 3; i++) {
          const ph = (t * 1.7 + i / 3 + seed) % 1, fx = x + Math.sin(i * 2.1 + e.id) * r * 0.7, fy = y + r * 0.3 - ph * r * 1.7, s = 4 * (1 - ph) + 1.2;
          c.fillStyle = i % 2 ? '#FFD43B' : '#FF7A2F'; c.fillRect(fx - s, fy - s, s * 2, s * 2);
        }
      } else if (/chill|freeze|frozen|ice|cold/.test(k)) {
        for (let i = 0; i < 3; i++) {
          const a = t * 1.6 + i * 2.094 + seed * 6, cx = x + Math.cos(a) * (r + 5), cy = y + Math.sin(a) * (r + 5);
          c.beginPath(); c.moveTo(cx, cy - 5); c.lineTo(cx + 3.2, cy); c.lineTo(cx, cy + 5); c.lineTo(cx - 3.2, cy); c.closePath();
          c.fillStyle = ICE; c.fill(); c.lineWidth = 1.5; c.strokeStyle = NR.config.INK; c.stroke();
        }
      } else if (/shock|stun|elec|arc/.test(k)) {
        const j = Math.floor(t * 14) + e.id;
        c.strokeStyle = '#FFD43B'; c.lineWidth = 2.5; c.lineJoin = 'miter';
        for (let b = 0; b < 2; b++) {
          const a = (j * 1.7 + b * 3.1) % TAU;
          c.beginPath(); c.moveTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5);
          for (let s = 1; s <= 4; s++) { const aa = a + (s % 2 ? 0.28 : -0.28), rr = r * (0.5 + s * 0.3); c.lineTo(x + Math.cos(aa) * rr, y + Math.sin(aa) * rr); }
          c.stroke();
        }
        c.lineJoin = 'round';
      } else if (/poison|toxin|venom|acid/.test(k)) {
        for (let i = 0; i < 3; i++) {
          const ph = (t * 1.2 + i / 3 + seed) % 1, dx = x + Math.cos(i * 2.4 + e.id) * r * 0.6, dy = y - r * 0.4 + ph * r * 1.5, s = 3.2 * (1 - ph * 0.5);
          c.fillStyle = '#8BD450'; c.beginPath(); c.arc(dx, dy, s, 0, TAU); c.fill();
        }
      } else {
        for (let i = 0; i < 2; i++) { const a = t * 2 + i * Math.PI + seed * 6, cx = x + Math.cos(a) * (r + 4), cy = y + Math.sin(a) * (r + 4); c.fillStyle = '#A25CE0'; c.fillRect(cx - 2.5, cy - 2.5, 5, 5); }
      }
    }
  }
  function isFrozen(e) {
    if (e.flags && e.flags.frozen) return true;
    const S = e.status; if (!S) return false;
    return active(S.freeze) || active(S.frozen);
  }
  function telegraphing(e) {
    const f = e.flags;
    if (e.telegraph || (f && (f.telegraph || f.charging || f.windup))) return true;
    const s = e.ai && e.ai.state;
    return s === 'windup' || s === 'telegraph' || s === 'charge' || s === 'aim';
  }

  // ---------- vector polygon & star helper ----------
  function star(c, x, y, r, n, inner) {
    c.beginPath();
    const pts = n * 2;
    for (let i = 0; i < pts; i++) {
      const a = (i / pts) * TAU - Math.PI / 2;
      const rad = i % 2 ? r * inner : r;
      if (i === 0) c.moveTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
      else c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    c.closePath();
  }

  // ---------- procedural weapon models held in player hands ----------
  function drawHeldWeapon(c, wId, isEvo, recoil) {
    c.save();
    c.translate(-recoil, 0);
    const ink = NR.config.INK;
    c.strokeStyle = ink;
    c.lineJoin = 'round';
    c.lineWidth = 2;

    switch (wId) {
      case 'pistol': {
        c.fillStyle = '#1F2822'; c.fillRect(8, 0, 5, 7); c.strokeRect(8, 0, 5, 7);
        c.fillStyle = '#8C86A0'; c.fillRect(7, -4, 15, 6); c.strokeRect(7, -4, 15, 6);
        c.fillStyle = ink; c.fillRect(22, -3, 3, 4);
        c.fillStyle = '#FFD43B'; c.beginPath(); c.arc(10, 3, 1, 0, TAU); c.fill();
        break;
      }
      case 'gatling_pistol': {
        c.fillStyle = '#1F2822'; c.fillRect(8, 0, 5, 7); c.strokeRect(8, 0, 5, 7);
        c.fillStyle = '#3C4B40'; c.beginPath(); c.arc(10, 5, 4, 0, TAU); c.fill(); c.stroke();
        c.fillStyle = '#FFB703'; c.fillRect(7, -5, 14, 8); c.strokeRect(7, -5, 14, 8);
        c.fillStyle = '#5A526E';
        c.fillRect(21, -5, 10, 2); c.fillRect(21, -2, 10, 2); c.fillRect(21, 1, 10, 2);
        c.fillStyle = '#FFD43B'; c.fillRect(25, -6, 2, 10);
        break;
      }
      case 'ember_gun': {
        c.fillStyle = '#1F2822'; c.fillRect(8, 0, 5, 7); c.strokeRect(8, 0, 5, 7);
        c.fillStyle = '#2E3A32'; c.fillRect(7, -5, 15, 8); c.strokeRect(7, -5, 15, 8);
        c.fillStyle = '#FF7A2F'; c.fillRect(10, -3, 8, 4);
        c.fillStyle = '#FFD43B'; c.fillRect(12, -2, 4, 2);
        c.fillStyle = '#FF7A2F';
        c.beginPath(); c.moveTo(22, -5); c.lineTo(26, -3); c.lineTo(26, 1); c.lineTo(22, 3); c.closePath(); c.fill(); c.stroke();
        break;
      }
      case 'scattergun': {
        c.fillStyle = '#8C4A3B'; c.fillRect(6, -1, 9, 6); c.strokeRect(6, -1, 9, 6);
        c.fillStyle = '#5A526E'; c.fillRect(5, -5, 20, 8); c.strokeRect(5, -5, 20, 8);
        c.fillStyle = ink; c.fillRect(9, -2, 7, 5);
        c.fillStyle = '#8C4A3B'; c.fillRect(13, 1, 7, 4); c.strokeRect(13, 1, 7, 4);
        break;
      }
      case 'shredder': {
        c.fillStyle = '#3C4B40'; c.fillRect(6, -1, 9, 6); c.strokeRect(6, -1, 9, 6);
        c.fillStyle = '#E36414'; c.fillRect(8, 3, 5, 7); c.strokeRect(8, 3, 5, 7);
        c.fillStyle = '#5A526E'; c.fillRect(5, -6, 20, 9); c.strokeRect(5, -6, 20, 9);
        c.fillStyle = ink; c.fillRect(23, -7, 4, 11);
        break;
      }
      case 'frost_fan': {
        c.fillStyle = '#5A526E'; c.fillRect(6, -3, 12, 6); c.strokeRect(6, -3, 12, 6);
        c.fillStyle = '#CFEFFA';
        c.beginPath(); c.moveTo(18, -6); c.lineTo(26, -8); c.lineTo(22, -3); c.closePath(); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(18, -2); c.lineTo(28, 0); c.lineTo(18, 2); c.closePath(); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(18, 6); c.lineTo(26, 8); c.lineTo(22, 3); c.closePath(); c.fill(); c.stroke();
        break;
      }
      case 'lancer':
      case 'void_lance': {
        const fill = isEvo ? '#A25CE0' : '#5FA8D3';
        c.fillStyle = fill; c.fillRect(6, -3, 26, 6); c.strokeRect(6, -3, 26, 6);
        c.fillStyle = '#14121F'; c.fillRect(12, -5, 16, 2); c.fillRect(12, 3, 16, 2);
        c.fillStyle = isEvo ? '#CFEFFA' : '#FFD43B';
        c.fillRect(14, -2, 3, 4); c.fillRect(20, -2, 3, 4);
        break;
      }
      case 'katana':
      case 'storm_blade': {
        c.fillStyle = '#8C4A3B'; c.fillRect(-2, -2, 8, 4); c.strokeRect(-2, -2, 8, 4);
        c.fillStyle = '#FFD43B'; c.fillRect(6, -5, 3, 10); c.strokeRect(6, -5, 3, 10);
        c.fillStyle = isEvo ? '#CFEFFA' : '#F2EFE6';
        c.beginPath(); c.moveTo(9, -2); c.lineTo(34, -4); c.lineTo(37, -1); c.lineTo(9, 2); c.closePath();
        c.fill(); c.stroke();
        if (isEvo) {
          c.fillStyle = '#FFD43B';
          c.beginPath(); c.moveTo(14, -1); c.lineTo(19, -3); c.lineTo(24, 0); c.lineTo(29, -3); c.stroke();
        }
        break;
      }
      case 'maul': {
        c.fillStyle = '#5A2E22'; c.fillRect(0, -2, 20, 4); c.strokeRect(0, -2, 20, 4);
        c.fillStyle = '#3B2A58'; c.fillRect(18, -8, 12, 16); c.strokeRect(18, -8, 12, 16);
        c.fillStyle = '#A25CE0'; c.beginPath(); c.arc(24, 0, 3, 0, TAU); c.fill();
        c.fillStyle = '#C9A24B';
        c.beginPath(); c.moveTo(30, -4); c.lineTo(34, 0); c.lineTo(30, 4); c.closePath(); c.fill(); c.stroke();
        break;
      }
      case 'flamer':
      case 'inferno_jet': {
        c.fillStyle = '#E5484D'; c.fillRect(7, 2, 12, 7); c.strokeRect(7, 2, 12, 7);
        c.fillStyle = '#3C4B40'; c.fillRect(5, -4, 18, 7); c.strokeRect(5, -4, 18, 7);
        c.fillStyle = ink; c.fillRect(23, -6, 5, 11); c.strokeRect(23, -6, 5, 11);
        c.fillStyle = '#FF7A2F';
        c.beginPath(); c.moveTo(28, -2); c.lineTo(33, 0); c.lineTo(28, 2); c.closePath(); c.fill();
        break;
      }
      case 'saw_ring':
      case 'saw_blade':
      case 'maelstrom': {
        c.fillStyle = '#3C4B40'; c.fillRect(4, -2, 12, 4); c.strokeRect(4, -2, 12, 4);
        const spin = t * 18;
        c.save(); c.translate(22, 0); c.rotate(spin);
        c.fillStyle = isEvo ? '#7FD3F0' : '#F2EFE6';
        star(c, 0, 0, 10, 8, 0.6); c.fill(); c.stroke();
        c.fillStyle = ink; c.beginPath(); c.arc(0, 0, 3, 0, TAU); c.fill();
        c.restore();
        break;
      }
      case 'drone_pod':
      case 'hive_pod':
      case 'overseer_swarm': {
        c.fillStyle = isEvo ? '#FFD43B' : '#5FB49C';
        c.fillRect(6, -7, 14, 14); c.strokeRect(6, -7, 14, 14);
        c.fillStyle = ink;
        c.beginPath(); c.arc(10, -3, 2, 0, TAU); c.arc(16, -3, 2, 0, TAU); c.arc(10, 3, 2, 0, TAU); c.arc(16, 3, 2, 0, TAU); c.fill();
        break;
      }
      case 'grenade': {
        c.fillStyle = '#3C4B40';
        c.beginPath(); c.ellipse(16, 0, 6, 8, Math.PI / 4, 0, TAU); c.fill(); c.stroke();
        c.fillStyle = '#8C86A0'; c.fillRect(10, -5, 4, 4); c.strokeRect(10, -5, 4, 4);
        break;
      }
      case 'toxin_mine': {
        c.fillStyle = '#3C4B40';
        c.beginPath(); c.ellipse(16, 0, 8, 5, 0, 0, TAU); c.fill(); c.stroke();
        c.fillStyle = '#8BD450'; c.beginPath(); c.arc(16, 0, 2.5, 0, TAU); c.fill();
        break;
      }
      case 'arc_coil':
      case 'tempest_coil': {
        c.fillStyle = '#5A2E22'; c.fillRect(6, -2, 12, 4); c.strokeRect(6, -2, 12, 4);
        c.fillStyle = '#D9693A'; c.fillRect(18, -4, 8, 8); c.strokeRect(18, -4, 8, 8);
        c.fillStyle = isEvo ? '#FFFFFF' : '#FFD43B';
        c.beginPath(); c.arc(28, 0, 3.5, 0, TAU); c.fill(); c.stroke();
        break;
      }
      case 'frost_aura': {
        c.fillStyle = '#CFEFFA';
        c.save(); c.translate(16, 0); c.rotate(t * 4);
        star(c, 0, 0, 8, 6, 0.5); c.fill(); c.stroke();
        c.restore();
        break;
      }
      case 'toxic_cloud': {
        c.fillStyle = '#5A526E'; c.fillRect(8, -4, 6, 8); c.strokeRect(8, -4, 6, 8);
        c.fillStyle = '#8BD450'; c.beginPath(); c.arc(17, 0, 5, 0, TAU); c.fill(); c.stroke();
        break;
      }
      case 'seeker': {
        c.fillStyle = '#2A1E3F'; c.beginPath(); c.arc(18, 0, 6, 0, TAU); c.fill(); c.stroke();
        c.fillStyle = '#E86AA6'; c.fillRect(17, -2, 2, 4);
        break;
      }
      default: {
        c.fillStyle = '#8C86A0'; c.fillRect(7, -3, 14, 6); c.strokeRect(7, -3, 14, 6);
        break;
      }
    }
    c.restore();
  }

  // ---------- procedural character player renderer ----------
  function drawPlayer(c, p, a, q) {
    const AC = NR.fx.actors;
    if (AC && AC.hasChar(p.charId)) { drawActorPlayer(c, p, a, AC); return; }
    const S = NR.fx.shapes, ink = NR.config.INK;
    const x = p.px + (p.x - p.px) * a, y = p.py + (p.y - p.py) * a, r = p.r || 14;
    const dashing = p.dash && p.dash.t > 0;
    const dashAngle = dashing ? Math.atan2(p.dash.dy, p.dash.dx) : 0;
    const sp = Math.hypot(p.vx || 0, p.vy || 0);
    const moveAngle = sp > 8 ? Math.atan2(p.vy, p.vx) : p.aim;
    const walkPhase = sp > 10 ? (t * Math.min(22, 8 + sp * 0.05)) : 0;
    const bob = Math.sin(t * 7) * (sp > 8 ? 1.4 : 0.6);
    const charId = p.charId || 'ranger';

    let fill = p.color || '#5FA8D3';
    if (p.hurtT > 0.19 || p.flash > 0) fill = '#FFFFFF';
    const ghost = p.iframes > 0 && !(p.hurtT > 0.19) && Math.floor(t * 16) % 2 === 1;
    if (ghost) c.globalAlpha = 0.45;

    // Fast fallback for ultra-low stress quality
    if (q >= 3) {
      let rot = p.aim, sx = 1, sy = 1;
      if (dashing) { rot = dashAngle; sx = 1.35; sy = 0.78; }
      S.draw(c, p.shape || 'circle', x, y, r, rot, sx, sy, fill, 3, false);
      if (!dashing) S.draw(c, 'tri', x + Math.cos(p.aim) * (r + 9), y + Math.sin(p.aim) * (r + 9), 4.5, p.aim + Math.PI / 2, 1, 1, pal[5], 2, false);
      if (ghost) c.globalAlpha = 1;
      return;
    }

    // 1. Dash speed-slice lines & ghost trail
    if (dashing) {
      c.save();
      c.strokeStyle = '#EDE3C8'; c.lineWidth = 2; c.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        const offX = -Math.cos(dashAngle) * 22 + Math.sin(dashAngle) * (i * 9);
        const offY = -Math.sin(dashAngle) * 22 - Math.cos(dashAngle) * (i * 9);
        c.beginPath(); c.moveTo(x + offX, y + offY); c.lineTo(x + offX - Math.cos(dashAngle) * 18, y + offY - Math.sin(dashAngle) * 18); c.stroke();
      }
      c.restore();
    }

    // 2. Animated stepping boots / feet
    const stride = Math.sin(walkPhase) * Math.min(7, sp * 0.035);
    const leftFootX = x + Math.cos(moveAngle) * stride - Math.sin(moveAngle) * 7;
    const leftFootY = y + Math.sin(moveAngle) * stride + Math.cos(moveAngle) * 7;
    const rightFootX = x - Math.cos(moveAngle) * stride + Math.sin(moveAngle) * 7;
    const rightFootY = y - Math.sin(moveAngle) * stride - Math.cos(moveAngle) * 7;

    c.save();
    // Feet shadows
    c.fillStyle = ink;
    c.beginPath();
    c.ellipse(leftFootX + 2, leftFootY + 3, 5, 3.5, moveAngle, 0, TAU);
    c.ellipse(rightFootX + 2, rightFootY + 3, 5, 3.5, moveAngle, 0, TAU);
    c.fill();
    // Boots
    c.fillStyle = '#1F2822'; c.strokeStyle = ink; c.lineWidth = 2;
    c.beginPath(); c.ellipse(leftFootX, leftFootY, 4.5, 3, moveAngle, 0, TAU); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(rightFootX, rightFootY, 4.5, 3, moveAngle, 0, TAU); c.fill(); c.stroke();
    // Armor spat
    c.fillStyle = shade(fill, -0.2);
    c.beginPath(); c.arc(leftFootX, leftFootY, 2.2, 0, TAU); c.fill();
    c.beginPath(); c.arc(rightFootX, rightFootY, 2.2, 0, TAU); c.fill();
    c.restore();

    // 3. Back Gear / Cloak / Scarf (behind torso)
    c.save();
    c.translate(x, y + bob);
    c.rotate(p.aim);

    if (charId === 'ranger') {
      // Flowing tactical hooded cloak
      const flap = Math.sin(t * 8) * 4;
      c.fillStyle = '#2E3A32'; c.strokeStyle = ink; c.lineWidth = 2.5; c.lineJoin = 'round';
      c.beginPath();
      c.moveTo(-r * 0.6, -r * 0.7);
      c.lineTo(-r * 1.5, -r * 0.9 + flap * 0.5);
      c.lineTo(-r * 1.8, 0 + flap);
      c.lineTo(-r * 1.5, r * 0.9 + flap * 0.5);
      c.lineTo(-r * 0.6, r * 0.7);
      c.closePath();
      c.fill(); c.stroke();
      // Cape gold trim
      c.strokeStyle = '#C9A24B'; c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(-r * 1.5, -r * 0.8 + flap * 0.5);
      c.lineTo(-r * 1.7, 0 + flap);
      c.lineTo(-r * 1.5, r * 0.8 + flap * 0.5);
      c.stroke();
    } else if (charId === 'dasher') {
      // Flowing ninja haori scarf tails
      const s1 = Math.sin(t * 12) * 6;
      const s2 = Math.sin(t * 12 + 1.2) * 6;
      c.fillStyle = '#1F2822'; c.strokeStyle = ink; c.lineWidth = 2;
      // Scarf ribbon 1
      c.beginPath(); c.moveTo(-r * 0.5, -4); c.lineTo(-r * 1.4, -9 + s1); c.lineTo(-r * 2.1, -11 + s1 * 1.5); c.lineTo(-r * 1.6, -4 + s1); c.closePath(); c.fill(); c.stroke();
      // Scarf ribbon 2
      c.beginPath(); c.moveTo(-r * 0.5, 4); c.lineTo(-r * 1.4, 9 + s2); c.lineTo(-r * 2.1, 11 + s2 * 1.5); c.lineTo(-r * 1.6, 4 + s2); c.closePath(); c.fill(); c.stroke();
      // Gold tips
      c.fillStyle = '#E8C547';
      c.fillRect(-r * 2.1, -12 + s1 * 1.5, 5, 4);
      c.fillRect(-r * 2.1, 10 + s2 * 1.5, 5, 4);
      // Twin crossed katana sheaths
      c.fillStyle = '#3C4B40'; c.strokeStyle = ink; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-r * 0.8, -r * 0.8); c.lineTo(r * 0.5, r * 0.7); c.stroke();
      c.beginPath(); c.moveTo(-r * 0.8, r * 0.8); c.lineTo(r * 0.5, -r * 0.7); c.stroke();
    } else if (charId === 'bulwark') {
      // Dual heavy exhaust stacks on back
      c.fillStyle = '#1F2822'; c.strokeStyle = ink; c.lineWidth = 2.5;
      c.fillRect(-r * 1.1, -r * 0.8, 8, 5); c.strokeRect(-r * 1.1, -r * 0.8, 8, 5);
      c.fillRect(-r * 1.1, r * 0.45, 8, 5); c.strokeRect(-r * 1.1, r * 0.45, 8, 5);
      // Steam dots
      if (Math.sin(t * 14) > 0.4) {
        c.fillStyle = '#EDE3C8';
        c.beginPath(); c.arc(-r * 1.4, -r * 0.6, 2, 0, TAU); c.fill();
        c.beginPath(); c.arc(-r * 1.4, r * 0.6, 2, 0, TAU); c.fill();
      }
    } else if (charId === 'tinker') {
      // Backpack generator and articulated servo robot arm
      c.fillStyle = '#2E3A32'; c.strokeStyle = ink; c.lineWidth = 2.5;
      c.fillRect(-r * 1.1, -r * 0.6, 9, r * 1.2); c.strokeRect(-r * 1.1, -r * 0.6, 9, r * 1.2);
      c.fillStyle = '#C9A24B'; c.beginPath(); c.arc(-r * 0.7, 0, 3, 0, TAU); c.fill();
      // Articulated robotic arm extending out
      const armWob = Math.sin(t * 8) * 0.2;
      c.strokeStyle = ink; c.lineWidth = 2.5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-r * 0.6, -r * 0.5); c.lineTo(-r * 0.2, -r * 1.1 + armWob * 4); c.lineTo(r * 0.7, -r * 1.1); c.stroke();
      // Mini mechanical claw
      c.fillStyle = '#FFD43B'; c.strokeStyle = ink; c.lineWidth = 1.5;
      c.beginPath(); c.arc(r * 0.7, -r * 1.1, 3, -1, 1); c.stroke();
    }
    c.restore();

    // 4. Main Character Body & Hard Shadow
    c.save();
    c.translate(x, y + bob);
    c.rotate(p.aim);
    const S_off = NR.config.SHADOW;

    // Hard drop shadow
    c.fillStyle = ink;
    c.beginPath();
    c.ellipse(S_off.x * 0.8, S_off.y * 0.8, r * 0.95, r * 0.8, 0, 0, TAU);
    c.fill();

    // Torso armor plate
    c.fillStyle = fill; c.strokeStyle = ink; c.lineWidth = 3; c.lineJoin = 'round';
    if (charId === 'bulwark') {
      // Heavy hexagonal cuirass with hazard chevrons
      c.beginPath();
      c.moveTo(-r * 0.7, -r * 0.75); c.lineTo(r * 0.6, -r * 0.85); c.lineTo(r * 0.9, 0); c.lineTo(r * 0.6, r * 0.85); c.lineTo(-r * 0.7, r * 0.75); c.lineTo(-r * 0.9, 0);
      c.closePath();
      c.fill(); c.stroke();
      // Heavy pauldrons
      c.fillStyle = '#8C4A3B';
      c.beginPath(); c.arc(-r * 0.1, -r * 0.9, 5.5, 0, TAU); c.fill(); c.stroke();
      c.beginPath(); c.arc(-r * 0.1, r * 0.9, 5.5, 0, TAU); c.fill(); c.stroke();
      // Hazard chest stripe
      c.fillStyle = '#FFD43B';
      c.fillRect(-r * 0.3, -4, 8, 8); c.strokeRect(-r * 0.3, -4, 8, 8);
    } else if (charId === 'dasher') {
      // Angular cyber-ninja cuirass
      c.beginPath();
      c.moveTo(-r * 0.7, -r * 0.6); c.lineTo(r * 0.8, -r * 0.4); c.lineTo(r * 1.0, 0); c.lineTo(r * 0.8, r * 0.4); c.lineTo(-r * 0.7, r * 0.6);
      c.closePath();
      c.fill(); c.stroke();
      c.fillStyle = '#1F2822';
      c.beginPath(); c.moveTo(-r * 0.3, -3); c.lineTo(r * 0.4, 0); c.lineTo(-r * 0.3, 3); c.closePath(); c.fill();
    } else if (charId === 'tinker') {
      // Utility harness with belt and brass buckle
      c.beginPath(); c.arc(0, 0, r * 0.85, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = '#3C4B40'; c.fillRect(-r * 0.7, -3, r * 1.4, 6); c.strokeRect(-r * 0.7, -3, r * 1.4, 6);
      c.fillStyle = '#FFD43B'; c.fillRect(-3, -4, 6, 8); c.strokeRect(-3, -4, 6, 8);
    } else {
      // Ranger tactical cuirass & ammo bandolier
      c.beginPath(); c.arc(0, 0, r * 0.85, 0, TAU); c.fill(); c.stroke();
      c.strokeStyle = '#1F2822'; c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(-r * 0.6, -r * 0.5); c.lineTo(r * 0.6, r * 0.5); c.stroke();
      c.fillStyle = '#FFD43B';
      c.fillRect(-2, -3, 4, 3); c.fillRect(2, 1, 4, 3);
    }

    // 5. Head, Helm & Visor
    c.fillStyle = shade(fill, 0.2); c.strokeStyle = ink; c.lineWidth = 2.5;
    c.beginPath(); c.arc(r * 0.25, 0, r * 0.52, 0, TAU); c.fill(); c.stroke();

    // Specific headgear/visors
    if (charId === 'ranger') {
      // Pointed cowl with cyan visor slit
      c.fillStyle = '#2E3A32';
      c.beginPath(); c.moveTo(-r * 0.1, -r * 0.6); c.lineTo(r * 0.75, 0); c.lineTo(-r * 0.1, r * 0.6); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#8FC1E3'; c.fillRect(r * 0.45, -2, 3.5, 4);
    } else if (charId === 'dasher') {
      // Ninja mask with angular gold visor band
      c.fillStyle = '#14121F'; c.fillRect(r * 0.2, -4, 7, 8);
      c.fillStyle = '#FFD43B'; c.fillRect(r * 0.45, -2.5, 4, 5);
    } else if (charId === 'bulwark') {
      // Heavy T-visor bucket helm
      c.fillStyle = '#14121F';
      c.fillRect(r * 0.4, -4.5, 4, 9);
      c.fillRect(r * 0.2, -1.5, 7, 3);
      c.fillStyle = '#FF7A2F'; c.fillRect(r * 0.45, -3.5, 2.5, 7);
    } else if (charId === 'tinker') {
      // Dual brass welding goggles on brow
      c.fillStyle = '#C9A24B'; c.strokeStyle = ink; c.lineWidth = 1.5;
      c.beginPath(); c.arc(r * 0.35, -3.5, 3.5, 0, TAU); c.fill(); c.stroke();
      c.beginPath(); c.arc(r * 0.35, 3.5, 3.5, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = '#5FB49C';
      c.beginPath(); c.arc(r * 0.35, -3.5, 2, 0, TAU); c.fill();
      c.beginPath(); c.arc(r * 0.35, 3.5, 2, 0, TAU); c.fill();
    }

    // 6. Arms and Held Active Weapon
    const timeSinceFire = t - lastFireT;
    let recoil = 0;
    if (timeSinceFire >= 0 && timeSinceFire < 0.12) recoil = (1 - timeSinceFire / 0.12) * 5;

    const w0 = p.weapons && p.weapons[0];
    const wId = lastFireWeapon || (w0 ? w0.id : 'pistol');
    const isEvo = evolved(wId);

    // Left & Right Hands gripping weapon
    c.fillStyle = shade(fill, -0.1); c.strokeStyle = ink; c.lineWidth = 2;
    c.beginPath(); c.arc(r * 0.65 - recoil, -4, 3, 0, TAU); c.fill(); c.stroke();
    c.beginPath(); c.arc(r * 0.55 - recoil, 4, 3, 0, TAU); c.fill(); c.stroke();

    // Render weapon model
    drawHeldWeapon(c, wId, isEvo, recoil);

    // Muzzle flash on weapon fire instant
    if (timeSinceFire >= 0 && timeSinceFire < 0.055) {
      c.fillStyle = '#FFD43B'; c.strokeStyle = ink; c.lineWidth = 2;
      star(c, 26 - recoil, 0, 9, 5, 0.45); c.fill(); c.stroke();
    }

    c.restore();
    if (ghost) c.globalAlpha = 1;
  }

  // Flat++ player: baked body that flips with the aim, stepping boots, live eyes that look along the aim, held weapon
  function drawActorPlayer(c, p, a, AC) {
    const art = NR.fx.art, ink = NR.config.INK;
    const x = p.px + (p.x - p.px) * a, y = p.py + (p.y - p.py) * a, r = p.r || 14;
    const dashing = p.dash && p.dash.t > 0, sp = Math.hypot(p.vx || 0, p.vy || 0), moving = sp > 10;
    const flip = Math.cos(p.aim) >= 0 ? 1 : -1;
    const hurt = p.hurtT > 0.19 || p.flash > 0;
    const variant = hurt && !calm ? AC.V_FLASH : AC.V_STEP_A, tier = AC.tierOf(p);
    const spr = AC.playerSprite(p.charId, r, p.color || '#5FA8D3', variant, tier);
    if (!spr) return;
    const R = spr.R, feet = spr.feet, walk = moving ? t * Math.min(16, 7 + sp * 0.03) : 0;
    let sx = 1, sy = 1;
    if (dashing) { sx = 1.22; sy = 0.84; }
    else if (moving) { const k = 0.07 * Math.abs(Math.sin(walk)); sy = 1 + k; sx = 1 - k * 0.5; }
    else { const k = 0.03 * Math.sin(t * 3); sy = 1 + k; sx = 1 - k * 0.5; }
    const ghost = p.iframes > 0 && !(p.hurtT > 0.19) && !calm && Math.floor(t * 16) % 2 === 1;
    if (ghost) c.globalAlpha = 0.5;
    // boots
    const st = moving ? Math.sin(walk) * R * 0.22 : 0, fy = y + feet - R * 0.12;
    c.fillStyle = '#2A2333'; c.strokeStyle = ink; c.lineWidth = 2.2;
    for (let i = -1; i <= 1; i += 2) {
      const bx = x + i * R * 0.38 + st * i * flip, by = fy - (moving ? Math.max(0, Math.sin(walk + (i > 0 ? Math.PI : 0))) * R * 0.12 : 0);
      c.beginPath(); c.ellipse(bx + flip * R * 0.06, by, R * 0.26, R * 0.17, 0, 0, TAU); c.fill(); c.stroke();
    }
    AC.draw(c, M, spr, x, y, flip, sx, sy);
    resetM(c);
    // face: body centre after squash around the feet
    const cy = y + feet * (1 - sy), fc = AC.face(p.charId);
    if (fc && variant !== AC.V_FLASH) {
      const ex = x + flip * R * fc.x * sx, ey = cy + R * fc.y * sy, es = R * fc.s, gap = R * fc.gap;
      blinkT -= 0;
      const blink = !calm && (t % 3.7) < 0.12;
      const lx = Math.cos(p.aim) * es * 0.35, ly = Math.sin(p.aim) * es * 0.35;
      for (let i = -1; i <= 1; i += 2) {
        const px = ex + flip * (i < 0 ? -gap * 0.42 : gap * 0.58), rx = es * (i < 0 ? 0.88 : 1), ry = es * 1.12;
        if (blink) { c.strokeStyle = ink; c.lineWidth = 2; c.beginPath(); c.moveTo(px - rx, ey); c.lineTo(px + rx, ey); c.stroke(); continue; }
        c.fillStyle = art.T.eye; c.beginPath(); c.ellipse(px, ey, rx, ry, 0, 0, TAU); c.fill();
        c.lineWidth = Math.max(1.6, es * 0.3); c.strokeStyle = ink; c.stroke();
        c.fillStyle = art.T.pupil; c.beginPath(); c.ellipse(px + lx, ey + ly, rx * 0.5, ry * 0.56, 0, 0, TAU); c.fill();
        c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(px + lx - rx * 0.18, ey + ly - ry * 0.25, Math.max(0.8, rx * 0.2), 0, TAU); c.fill();
      }
      // small mouth, a determined smile
      c.strokeStyle = ink; c.lineWidth = 1.8; c.beginPath(); c.arc(ex + flip * gap * 0.1, ey + es * 1.9, es * 0.55, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke();
    }
    // crest glow, and a shard halo of orbiting motes once the build is strong
    const cc = AC.crest(p.charId) || '#7FE3F5';
    art.light(x - flip * R * 0.5 * sx, cy - R * 2.0 * sy, R * (1.2 + tier * 0.4), cc, 0.5 + tier * 0.1);
    if (tier >= 2) {
      const n = tier >= 3 ? 6 : 3;
      for (let i = 0; i < n; i++) {
        const an = t * 1.6 + i * TAU / n, ox = Math.cos(an) * R * 1.5, oy = Math.sin(an) * R * 0.55;
        const mx = x + ox, my = cy + oy - R * 0.2;
        c.fillStyle = NR.config.INK; c.beginPath(); c.moveTo(mx, my - 6); c.lineTo(mx + 4, my); c.lineTo(mx, my + 6); c.lineTo(mx - 4, my); c.closePath(); c.fill();
        c.fillStyle = cc; c.beginPath(); c.moveTo(mx, my - 4); c.lineTo(mx + 2.5, my); c.lineTo(mx, my + 4); c.lineTo(mx - 2.5, my); c.closePath(); c.fill();
        art.light(mx, my, 18, cc, 0.5);
      }
    }
    // held weapon at the front hand, rotated to the aim (mirrored when aiming left so it never draws upside down)
    const timeSinceFire = t - lastFireT;
    const recoil = timeSinceFire >= 0 && timeSinceFire < 0.12 ? (1 - timeSinceFire / 0.12) * 5 : 0;
    const w0 = p.weapons && p.weapons[0], wId = lastFireWeapon || (w0 ? w0.id : 'pistol');
    const hx = x + flip * R * 0.42, hy = cy + R * 0.32;
    c.save(); c.translate(hx, hy); c.rotate(p.aim); if (flip < 0) c.scale(1, -1); c.scale(1.2, 1.2);
    drawHeldWeapon(c, HELD_ALIAS[wId] || wId, evolved(wId), recoil);
    c.fillStyle = p.color || '#5FA8D3'; c.strokeStyle = ink; c.lineWidth = 2;
    c.beginPath(); c.arc(9 - recoil, 3, 3.4, 0, TAU); c.fill(); c.stroke();
    if (timeSinceFire >= 0 && timeSinceFire < 0.055) {
      c.fillStyle = '#FFE9A8'; c.strokeStyle = ink; c.lineWidth = 1.6;
      star(c, 27 - recoil, 0, 7, 5, 0.45); c.fill(); c.stroke();
    }
    c.restore();
    if (timeSinceFire >= 0 && timeSinceFire < 0.07) art.light(hx + Math.cos(p.aim) * 30, hy + Math.sin(p.aim) * 30, 46, '#FFC86B', 0.9);
    if (ghost) c.globalAlpha = 1;
  }

  // ---------- procedural enemy visual models (12 types) ----------
  function drawGrunt(c, e, x, y, r, rot, fill) {
    const ink = NR.config.INK;
    c.save(); c.translate(x, y); c.rotate(rot);
    // Bipedal walker legs
    const legWob = Math.sin(t * 11 + e.id) * 4;
    c.fillStyle = '#1F2822'; c.strokeStyle = ink; c.lineWidth = 2;
    c.fillRect(-r * 0.7, -r * 0.8 + legWob, 6, 4); c.strokeRect(-r * 0.7, -r * 0.8 + legWob, 6, 4);
    c.fillRect(-r * 0.7, r * 0.4 - legWob, 6, 4); c.strokeRect(-r * 0.7, r * 0.4 - legWob, 6, 4);
    // Armored chassis
    c.fillStyle = fill; c.strokeStyle = ink; c.lineWidth = 2.5; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(-r * 0.8, -r * 0.7); c.lineTo(r * 0.8, -r * 0.5); c.lineTo(r * 0.9, 0); c.lineTo(r * 0.8, r * 0.5); c.lineTo(-r * 0.8, r * 0.7); c.closePath();
    c.fill(); c.stroke();
    // Snapping pincer claws
    const clawSnap = Math.sin(t * 8 + e.id) * 0.15;
    c.fillStyle = '#5A526E';
    c.beginPath(); c.moveTo(r * 0.6, -r * 0.5); c.lineTo(r * 1.3, -r * 0.7 + clawSnap * 6); c.stroke();
    c.beginPath(); c.moveTo(r * 0.6, r * 0.5); c.lineTo(r * 1.3, r * 0.7 - clawSnap * 6); c.stroke();
    // Glowing horizontal sensor slit
    c.fillStyle = '#FFD43B'; c.fillRect(r * 0.3, -2, 4, 4);
    c.restore();
  }

  function drawSwarmer(c, e, x, y, r, rot, fill) {
    const ink = NR.config.INK;
    c.save(); c.translate(x, y); c.rotate(rot);
    // 6 articulated skittering legs
    c.strokeStyle = ink; c.lineWidth = 2; c.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      const legA = Math.sin(t * 22 + i * 1.6 + e.id) * 4;
      c.beginPath(); c.moveTo(-i * 3, -r * 0.5); c.lineTo(-i * 4, -r * 1.4 + legA); c.stroke();
      c.beginPath(); c.moveTo(-i * 3, r * 0.5); c.lineTo(-i * 4, r * 1.4 - legA); c.stroke();
    }
    // Segmented chitin thorax
    c.fillStyle = fill; c.strokeStyle = ink; c.lineWidth = 2; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(-r * 1.1, 0); c.lineTo(-r * 0.2, -r * 0.7); c.lineTo(r * 1.1, 0); c.lineTo(-r * 0.2, r * 0.7); c.closePath();
    c.fill(); c.stroke();
    // Mandibles
    c.fillStyle = '#FF7A2F';
    c.beginPath(); c.moveTo(r * 0.9, -3); c.lineTo(r * 1.4, -1); c.lineTo(r * 0.9, 0); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(r * 0.9, 3); c.lineTo(r * 1.4, 1); c.lineTo(r * 0.9, 0); c.closePath(); c.fill(); c.stroke();
    c.restore();
  }

  function drawSpitter(c, e, x, y, r, rot, fill) {
    const ink = NR.config.INK;
    c.save(); c.translate(x, y); c.rotate(rot);
    // Tripod planted legs
    c.strokeStyle = ink; c.lineWidth = 2.5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-r * 0.4, 0); c.lineTo(-r * 1.3, 0); c.stroke();
    c.beginPath(); c.moveTo(0, -r * 0.4); c.lineTo(-r * 0.7, -r * 1.2); c.stroke();
    c.beginPath(); c.moveTo(0, r * 0.4); c.lineTo(-r * 0.7, r * 1.2); c.stroke();
    // Swollen pulsating venom abdomen
    const pulse = 1 + 0.14 * Math.sin(t * 8 + e.id);
    c.fillStyle = fill; c.strokeStyle = ink; c.lineWidth = 2.5;
    c.beginPath(); c.ellipse(-r * 0.4, 0, r * 0.75 * pulse, r * 0.65 * pulse, 0, 0, TAU); c.fill(); c.stroke();
    // Acid mortar nozzle
    c.fillStyle = '#3C4B40';
    c.fillRect(r * 0.1, -3.5, r * 1.1, 7); c.strokeRect(r * 0.1, -3.5, r * 1.1, 7);
    // Acid drop
    c.fillStyle = '#FFD43B'; c.beginPath(); c.arc(r * 1.2, 0, 2.5, 0, TAU); c.fill();
    c.restore();
  }

  function drawBrute(c, e, x, y, r, rot, fill) {
    const ink = NR.config.INK;
    c.save(); c.translate(x, y); c.rotate(rot);
    const stomp = Math.sin(t * 6 + e.id) * 3;
    // Spiked clenched iron fists
    c.fillStyle = '#5A526E'; c.strokeStyle = ink; c.lineWidth = 3;
    c.beginPath(); c.arc(r * 0.4, -r * 1.0 + stomp, 6, 0, TAU); c.fill(); c.stroke();
    c.beginPath(); c.arc(r * 0.4, r * 1.0 - stomp, 6, 0, TAU); c.fill(); c.stroke();
    // Spikes on knuckles
    c.fillStyle = '#EDE3C8';
    c.fillRect(r * 0.65, -r * 1.0 + stomp - 2, 4, 4);
    c.fillRect(r * 0.65, r * 1.0 - stomp - 2, 4, 4);
    // Heavy spiked iron pauldron armor
    c.fillStyle = fill; c.strokeStyle = ink; c.lineWidth = 3.5; c.lineJoin = 'round';
    c.fillRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6); c.strokeRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
    // Horned iron crest
    c.fillStyle = '#1F2822';
    c.beginPath(); c.moveTo(-r * 0.5, -r * 0.9); c.lineTo(r * 0.5, 0); c.lineTo(-r * 0.5, r * 0.9); c.closePath(); c.fill(); c.stroke();
    // Red glowing slit eyes
    c.fillStyle = '#FF7A2F'; c.fillRect(r * 0.3, -4, 4, 8);
    c.restore();
  }

  function drawBomber(c, e, x, y, r, rot, fill) {
    const ink = NR.config.INK;
    c.save(); c.translate(x, y); c.rotate(rot);
    // Jittery high-frequency vibrating legs
    const jit = Math.sin(t * 30 + e.id) * 2;
    c.strokeStyle = ink; c.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4;
      c.beginPath(); c.moveTo(Math.cos(a) * (r * 0.7), Math.sin(a) * (r * 0.7)); c.lineTo(Math.cos(a) * (r * 1.25) + jit, Math.sin(a) * (r * 1.25)); c.stroke();
    }
    // Hexagonal bomb chassis
    c.fillStyle = fill; c.strokeStyle = ink; c.lineWidth = 2.5;
    star(c, 0, 0, r * 0.9, 3, 1); c.fill(); c.stroke();
    // Yellow hazard warning chevrons
    c.fillStyle = '#FFD43B';
    c.fillRect(-r * 0.4, -3, r * 0.8, 6); c.strokeRect(-r * 0.4, -3, r * 0.8, 6);
    // Burning fuse spark on top
    c.strokeStyle = '#8C4A3B'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(-r * 0.6, -r * 0.8); c.stroke();
    c.fillStyle = Math.floor(t * 18) % 2 ? '#FFD43B' : '#FF7A2F';
    c.beginPath(); c.arc(-r * 0.6, -r * 0.8, 3.5, 0, TAU); c.fill();
    c.restore();
  }

  function drawLunger(c, e, x, y, r, rot, fill) {
    const ink = NR.config.INK;
    c.save(); c.translate(x, y); c.rotate(rot);
    const charging = telegraphing(e) || (e.ai && e.ai.state === 'dash');
    const bladeAngle = charging ? 0.35 : 1.3;
    // Coiled rear legs
    c.strokeStyle = ink; c.lineWidth = 2.5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-r * 0.5, -r * 0.6); c.lineTo(-r * 1.3, -r * 0.9); c.stroke();
    c.beginPath(); c.moveTo(-r * 0.5, r * 0.6); c.lineTo(-r * 1.3, r * 0.9); c.stroke();
    // Streamlined carapace body
    c.fillStyle = fill; c.strokeStyle = ink; c.lineWidth = 2.5;
    c.beginPath(); c.ellipse(0, 0, r * 1.1, r * 0.65, 0, 0, TAU); c.fill(); c.stroke();
    // Serrated mantis scythes
    c.fillStyle = '#CFEFFA'; c.strokeStyle = ink; c.lineWidth = 2;
    c.save(); c.translate(r * 0.7, -r * 0.4); c.rotate(-bladeAngle);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(r * 1.4, -2); c.lineTo(r * 1.1, 4); c.closePath(); c.fill(); c.stroke();
    c.restore();
    c.save(); c.translate(r * 0.7, r * 0.4); c.rotate(bladeAngle);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(r * 1.4, 2); c.lineTo(r * 1.1, -4); c.closePath(); c.fill(); c.stroke();
    c.restore();
    c.restore();
  }

  function drawSniper(c, e, x, y, r, rot, fill) {
    const ink = NR.config.INK;
    c.save(); c.translate(x, y); c.rotate(rot);
    // 3 Gyroscopic rotating stabilizer fins
    const spin = t * 3 + e.id;
    c.fillStyle = '#3C4B40'; c.strokeStyle = ink; c.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const a = spin + (i / 3) * TAU;
      c.beginPath(); c.moveTo(Math.cos(a) * (r * 0.6), Math.sin(a) * (r * 0.6)); c.lineTo(Math.cos(a) * (r * 1.35), Math.sin(a) * (r * 1.35)); c.lineTo(Math.cos(a + 0.3) * (r * 0.8), Math.sin(a + 0.3) * (r * 0.8)); c.closePath(); c.fill(); c.stroke();
    }
    // Fuselage
    c.fillStyle = fill; c.strokeStyle = ink; c.lineWidth = 2.5;
    c.beginPath(); c.arc(0, 0, r * 0.75, 0, TAU); c.fill(); c.stroke();
    // Extended heavy railgun barrel
    c.fillStyle = '#14121F';
    c.fillRect(r * 0.3, -2.5, r * 1.4, 5); c.strokeRect(r * 0.3, -2.5, r * 1.4, 5);
    // Sniper optic lens
    c.fillStyle = '#FF7A2F'; c.beginPath(); c.arc(r * 0.5, 0, 3, 0, TAU); c.fill();
    c.restore();
  }

  function drawShielder(c, e, x, y, r, rot, fill) {
    const ink = NR.config.INK;
    c.save(); c.translate(x, y); c.rotate(rot);
    // Heavy marching legs
    const legWob = Math.sin(t * 8 + e.id) * 3;
    c.fillStyle = '#1F2822'; c.fillRect(-r * 0.7, -r * 0.6 + legWob, 6, 4); c.fillRect(-r * 0.7, r * 0.3 - legWob, 6, 4);
    // Armored body behind shield
    c.fillStyle = fill; c.strokeStyle = ink; c.lineWidth = 2.5;
    c.beginPath(); c.arc(-r * 0.2, 0, r * 0.7, 0, TAU); c.fill(); c.stroke();
    // Massive curved ballistic tower shield in front
    c.fillStyle = '#C9A24B'; c.strokeStyle = ink; c.lineWidth = 3.5; c.lineJoin = 'round';
    c.beginPath();
    c.arc(r * 0.3, 0, r * 1.1, -1.05, 1.05, false);
    c.lineTo(r * 0.7, r * 0.85);
    c.arc(r * 0.3, 0, r * 0.85, 1.05, -1.05, true);
    c.closePath();
    c.fill(); c.stroke();
    // Viewport slot in shield
    c.fillStyle = ink; c.fillRect(r * 0.85, -2, 4, 4);
    c.restore();
  }

  function drawSummoner(c, e, x, y, r, rot, fill) {
    const ink = NR.config.INK;
    c.save(); c.translate(x, y); c.rotate(rot);
    // Undulating dark warlock robes
    const wave = Math.sin(t * 7 + e.id) * 3;
    c.fillStyle = '#1F2822'; c.strokeStyle = ink; c.lineWidth = 2.5; c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(-r * 0.8, -r * 0.8 + wave); c.lineTo(r * 0.7, 0); c.lineTo(-r * 0.8, r * 0.8 - wave); c.lineTo(-r * 1.2, 0); c.closePath();
    c.fill(); c.stroke();
    // Dark horned hood
    c.fillStyle = fill;
    c.beginPath(); c.arc(0, 0, r * 0.65, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = '#CFEFFA'; c.beginPath(); c.arc(r * 0.3, 0, 3, 0, TAU); c.fill();
    // 3 Orbiting void runes
    for (let i = 0; i < 3; i++) {
      const a = t * 2.5 + (i / 3) * TAU;
      const rx = Math.cos(a) * (r + 7), ry = Math.sin(a) * (r + 7);
      c.fillStyle = '#A25CE0'; c.strokeStyle = ink; c.lineWidth = 1.5;
      c.fillRect(rx - 2.5, ry - 2.5, 5, 5); c.strokeRect(rx - 2.5, ry - 2.5, 5, 5);
    }
    c.restore();
  }

  function drawSplitter(c, e, x, y, r, rot, fill) {
    const ink = NR.config.INK;
    c.save(); c.translate(x, y); c.rotate(rot);
    // Amoebic undulating membrane
    c.fillStyle = fill; c.strokeStyle = ink; c.lineWidth = 2.5;
    c.beginPath();
    const pts = 8;
    for (let i = 0; i < pts; i++) {
      const a = (i / pts) * TAU;
      const rad = r * (0.85 + 0.15 * Math.sin(t * 6 + i * 1.4 + e.id));
      const px = Math.cos(a) * rad, py = Math.sin(a) * rad;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath(); c.fill(); c.stroke();
    // Twin spinning bio-nuclei cores
    const coreA = t * 4 + e.id;
    const d = r * 0.42;
    c.fillStyle = '#14121F';
    c.beginPath(); c.arc(Math.cos(coreA) * d, Math.sin(coreA) * d, r * 0.28, 0, TAU); c.fill();
    c.beginPath(); c.arc(Math.cos(coreA + Math.PI) * d, Math.sin(coreA + Math.PI) * d, r * 0.28, 0, TAU); c.fill();
    c.fillStyle = '#CFEFFA';
    c.beginPath(); c.arc(Math.cos(coreA) * d, Math.sin(coreA) * d, 2, 0, TAU); c.fill();
    c.beginPath(); c.arc(Math.cos(coreA + Math.PI) * d, Math.sin(coreA + Math.PI) * d, 2, 0, TAU); c.fill();
    c.restore();
  }

  function drawMedic(c, e, x, y, r, rot, fill) {
    const ink = NR.config.INK;
    c.save(); c.translate(x, y); c.rotate(rot);
    // Spinning green cross rotor
    const rotor = t * 14;
    c.save(); c.rotate(rotor);
    c.fillStyle = '#8BD450'; c.strokeStyle = ink; c.lineWidth = 1.5;
    c.fillRect(-r * 1.1, -2, r * 2.2, 4); c.strokeRect(-r * 1.1, -2, r * 2.2, 4);
    c.fillRect(-2, -r * 1.1, 4, r * 2.2); c.strokeRect(-2, -r * 1.1, 4, r * 2.2);
    c.restore();
    // White/green triage drone hull
    c.fillStyle = '#F2EFE6'; c.strokeStyle = ink; c.lineWidth = 2.5;
    c.beginPath(); c.arc(0, 0, r * 0.8, 0, TAU); c.fill(); c.stroke();
    // Medical cross insignia
    c.fillStyle = '#E5484D';
    c.fillRect(-r * 0.5, -2.5, r, 5); c.fillRect(-2.5, -r * 0.5, 5, r);
    c.restore();
  }

  function drawPhantom(c, e, x, y, r, rot, fill) {
    const ink = NR.config.INK;
    c.save(); c.translate(x, y); c.rotate(rot);
    // Ethereal spectral cloak tails
    const f1 = Math.sin(t * 9 + e.id) * 4;
    const f2 = Math.sin(t * 9 + 1.5 + e.id) * 4;
    c.fillStyle = fill; c.strokeStyle = ink; c.lineWidth = 2.5; c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(-r * 0.6, -r * 0.7); c.lineTo(-r * 1.4, -r * 0.9 + f1); c.lineTo(-r * 1.8, 0); c.lineTo(-r * 1.4, r * 0.9 + f2); c.lineTo(-r * 0.6, r * 0.7);
    c.lineTo(r * 0.9, 0); c.closePath();
    c.fill(); c.stroke();
    // Dual reverse-grip curved phantom daggers
    c.fillStyle = '#CFEFFA'; c.strokeStyle = ink; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(r * 0.3, -r * 0.7); c.lineTo(r * 0.8, -r * 1.1); c.lineTo(r * 0.1, -r * 1.0); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(r * 0.3, r * 0.7); c.lineTo(r * 0.8, r * 1.1); c.lineTo(r * 0.1, r * 1.0); c.closePath(); c.fill(); c.stroke();
    // Faceless shadow visor
    c.fillStyle = '#14121F'; c.beginPath(); c.arc(r * 0.2, 0, 4, 0, TAU); c.fill();
    c.restore();
  }

  // ---------- epic multi-part boss renderers ----------
  function drawBoss(c, e, x, y, r, rot, fill) {
    const ink = NR.config.INK, id = e.defId || 'scrap_titan';
    c.save(); c.translate(x, y); c.rotate(rot);

    if (id === 'scrap_titan') {
      // 1. Scrap Titan: Colossal hydraulic mech
      const stomp = Math.sin(t * 5) * 5;
      // 4 heavy hydraulic piston walker legs
      c.fillStyle = '#1F2822'; c.strokeStyle = ink; c.lineWidth = 3.5;
      c.fillRect(-r * 0.9, -r * 1.15 + stomp, 14, 18); c.strokeRect(-r * 0.9, -r * 1.15 + stomp, 14, 18);
      c.fillRect(-r * 0.9, r * 0.75 - stomp, 14, 18); c.strokeRect(-r * 0.9, r * 0.75 - stomp, 14, 18);
      // Twin industrial smokestacks venting dark smoke
      c.fillStyle = '#3C4B40';
      c.fillRect(-r * 1.1, -r * 0.6, 16, 10); c.strokeRect(-r * 1.1, -r * 0.6, 16, 10);
      c.fillRect(-r * 1.1, r * 0.35, 16, 10); c.strokeRect(-r * 1.1, r * 0.35, 16, 10);
      // Main armored hexagonal chassis
      c.fillStyle = fill; c.strokeStyle = ink; c.lineWidth = 4;
      star(c, 0, 0, r * 0.95, 3, 1); c.fill(); c.stroke();
      // Hazard diagonal yellow stripes across chest
      c.fillStyle = '#FFD43B';
      c.fillRect(-r * 0.45, -10, r * 0.9, 20); c.strokeRect(-r * 0.45, -10, r * 0.9, 20);
      // Rotating furnace gear in center
      const gearSpin = t * 4;
      c.save(); c.rotate(gearSpin);
      c.fillStyle = '#C9A24B'; c.strokeStyle = ink; c.lineWidth = 2.5;
      star(c, 0, 0, 15, 6, 0.75); c.fill(); c.stroke();
      c.fillStyle = '#FF7A2F'; c.beginPath(); c.arc(0, 0, 6, 0, TAU); c.fill();
      c.restore();
      // Crushing hydraulic claws
      c.fillStyle = '#5A526E'; c.strokeStyle = ink; c.lineWidth = 3;
      c.fillRect(r * 0.6, -r * 0.85, 18, 12); c.strokeRect(r * 0.6, -r * 0.85, 18, 12);
      c.fillRect(r * 0.6, r * 0.55, 18, 12); c.strokeRect(r * 0.6, r * 0.55, 18, 12);
    } else if (id === 'frost_warden') {
      // 2. Frost Warden: Glacial crystal ice titan
      // 4 Orbiting ice barrier crystal shards
      for (let i = 0; i < 4; i++) {
        const a = t * 2 + (i / 4) * TAU;
        const cx = Math.cos(a) * (r * 1.35), cy = Math.sin(a) * (r * 1.35);
        c.fillStyle = '#CFEFFA'; c.strokeStyle = ink; c.lineWidth = 2;
        c.save(); c.translate(cx, cy); c.rotate(a + Math.PI / 4);
        c.fillRect(-6, -6, 12, 12); c.strokeRect(-6, -6, 12, 12);
        c.restore();
      }
      // Faceted crystalline diamond armor
      c.fillStyle = fill; c.strokeStyle = ink; c.lineWidth = 4;
      star(c, 0, 0, r * 0.95, 2, 0.65); c.fill(); c.stroke();
      // Glacial 5-point ice crown
      c.fillStyle = '#CFEFFA'; c.strokeStyle = ink; c.lineWidth = 2.5;
      star(c, r * 0.5, 0, 18, 5, 0.55); c.fill(); c.stroke();
      // Colossal frost greatsword
      c.fillStyle = '#7FD3F0'; c.strokeStyle = ink; c.lineWidth = 3;
      c.beginPath(); c.moveTo(r * 0.4, -6); c.lineTo(r * 1.7, -10); c.lineTo(r * 2.1, 0); c.lineTo(r * 1.7, 10); c.lineTo(r * 0.4, 6); c.closePath();
      c.fill(); c.stroke();
    } else {
      // 3. Void Maw: Cosmic horror with counter-rotating jaw rings
      // 6 Undulating waving tentacles
      c.strokeStyle = ink; c.lineWidth = 4; c.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        const wave = Math.sin(t * 6 + i) * 16;
        c.beginPath();
        c.moveTo(Math.cos(a) * (r * 0.6), Math.sin(a) * (r * 0.6));
        c.lineTo(Math.cos(a) * (r * 1.25) + wave, Math.sin(a) * (r * 1.25));
        c.lineTo(Math.cos(a) * (r * 1.6) + wave * 1.4, Math.sin(a) * (r * 1.6));
        c.stroke();
      }
      // Ring 1 (outer, rotates clockwise)
      c.save(); c.rotate(t * 0.8);
      c.fillStyle = fill; c.strokeStyle = ink; c.lineWidth = 3.5;
      star(c, 0, 0, r * 0.92, 12, 0.78); c.fill(); c.stroke();
      c.restore();
      // Ring 2 (middle, counter-clockwise)
      c.save(); c.rotate(-t * 1.2);
      c.fillStyle = '#A25CE0'; c.strokeStyle = ink; c.lineWidth = 3;
      star(c, 0, 0, r * 0.65, 8, 0.72); c.fill(); c.stroke();
      c.restore();
      // Singularity eye core
      c.fillStyle = ink; c.beginPath(); c.arc(0, 0, r * 0.35, 0, TAU); c.fill();
      c.fillStyle = '#E86AA6'; c.beginPath(); c.arc(0, 0, r * 0.18, 0, TAU); c.fill();
    }

    c.restore();
  }

  // ---------- generic or procedural enemy dispatcher ----------
  function drawEnemy(c, e, a, q) {
    const x = e.px + (e.x - e.px) * a + (e.kox || 0), y = e.py + (e.y - e.py) * a + (e.koy || 0), r = e.r || 10;
    if (!inView(x, y, r * 2 + 50)) return;
    const AC = NR.fx.actors;
    if (AC && !e.isBoss && AC.has(e.defId)) { drawActorEnemy(c, e, x, y, r, AC); return; }
    const S = NR.fx.shapes, flags = e.flags || {};
    let sx = e.sx || 1, sy = e.sy || 1;
    if (q < 3) {
      const sp = Math.hypot(e.vx || 0, e.vy || 0), st = Math.min(0.14, sp / 700), wob = Math.sin(t * 9 + e.id) * 0.04 * Math.min(1, sp / 60);
      sx *= 1 + st + wob; sy *= 1 - st * 0.6 - wob;
    }
    let fill = e.color || '#F2EFE6';
    const tele = telegraphing(e);
    if (e.flash > 0) fill = '#FFFFFF';
    else if (isFrozen(e)) fill = FROZEN;
    else if (tele) { fill = Math.floor(t * 11) % 2 ? pal[5] : fill; const k = 1 + 0.08 * Math.sin(t * 24); sx *= k; sy *= k; }
    const ghost = typeof e.alpha === 'number' ? e.alpha : (flags.phased || flags.invisible || flags.cloaked ? 0.42 : 1);
    if (ghost < 1) c.globalAlpha = ghost;

    // Elite & enrage aura rings
    if (flags.elite) {
      c.lineWidth = 6; c.strokeStyle = NR.config.INK; c.beginPath(); c.arc(x, y, r + 8, 0, TAU); c.stroke();
      c.lineWidth = 3; c.strokeStyle = pal[3]; c.beginPath(); c.arc(x, y, r + 8, 0, TAU); c.stroke();
    }
    if (flags.enraged) {
      const k = 0.5 + 0.5 * Math.sin(t * 10);
      c.lineWidth = 4; c.strokeStyle = pal[4]; c.beginPath(); c.arc(x, y, r + 10 + k * 4, 0, TAU); c.stroke();
    }

    // Procedural custom vector character drawing per enemy definition
    const defId = e.defId;
    if (e.isBoss) {
      drawBoss(c, e, x, y, r, e.rot || 0, fill);
    } else if (q < 3 && defId) {
      switch (defId) {
        case 'grunt': drawGrunt(c, e, x, y, r, e.rot || 0, fill); break;
        case 'swarmer': drawSwarmer(c, e, x, y, r, e.rot || 0, fill); break;
        case 'spitter': drawSpitter(c, e, x, y, r, e.rot || 0, fill); break;
        case 'brute': drawBrute(c, e, x, y, r, e.rot || 0, fill); break;
        case 'bomber': drawBomber(c, e, x, y, r, e.rot || 0, fill); break;
        case 'lunger': drawLunger(c, e, x, y, r, e.rot || 0, fill); break;
        case 'sniper': drawSniper(c, e, x, y, r, e.rot || 0, fill); break;
        case 'shielder': drawShielder(c, e, x, y, r, e.rot || 0, fill); break;
        case 'summoner': drawSummoner(c, e, x, y, r, e.rot || 0, fill); break;
        case 'splitter': drawSplitter(c, e, x, y, r, e.rot || 0, fill); break;
        case 'medic': drawMedic(c, e, x, y, r, e.rot || 0, fill); break;
        case 'phantom': drawPhantom(c, e, x, y, r, e.rot || 0, fill); break;
        default: S.draw(c, e.shape || 'circle', x, y, r, e.rot || 0, sx, sy, fill, r < 9 ? 2 : 3, false);
      }
    } else {
      S.draw(c, e.shape || 'circle', x, y, r, e.rot || 0, sx, sy, fill, r < 9 ? 2 : 3, false);
    }

    if (ghost < 1) c.globalAlpha = 1;
    if (e.status && (q < 2 || flags.elite || e.isBoss)) statusFx(c, e, x, y, r);
  }

  // Flat++ sprite enemy: feet-anchored baked sprite, flips toward its facing, bobs/steps, hit flash and frozen variants
  function drawActorEnemy(c, e, x, y, r, AC) {
    const art = NR.fx.art, flags = e.flags || {};
    const sp = Math.hypot(e.vx || 0, e.vy || 0), moving = sp > 12;
    let variant = moving ? (Math.floor(t * 7 + e.id * 0.37) & 1) : 0;
    if (e.flash > 0 && !calm) variant = AC.V_FLASH; else if (isFrozen(e)) variant = AC.V_FROZEN;
    let sx = e.sx || 1, sy = e.sy || 1;
    if (!art.reduced() || true) {
      const ph = t * (moving ? 12 : 3.2) + e.id * 1.7;
      const k = moving ? 0.07 * Math.abs(Math.sin(ph)) : 0.035 * Math.sin(ph);
      sy *= 1 + k; sx *= 1 - k * 0.6;
    }
    const tele = telegraphing(e);
    if (tele) { const k = 1 + 0.07 * (calm ? 1 : 0.5 + 0.5 * Math.sin(t * 22)); sx *= k; sy *= k; }
    const rot = e.rot || 0, flip = Math.cos(rot) >= 0 ? 1 : -1;
    const ghost = typeof e.alpha === 'number' ? e.alpha : (flags.phased || flags.invisible || flags.cloaked ? 0.42 : 1);
    if (flags.elite) {
      c.lineWidth = 5; c.strokeStyle = NR.config.INK; c.beginPath(); c.ellipse(x, y + r * 0.95, r * 1.45, r * 0.55, 0, 0, TAU); c.stroke();
      c.lineWidth = 2.5; c.strokeStyle = art.T.elite; c.stroke();
      art.light(x, y, r * 3.2, art.T.elite, 0.35 + 0.15 * Math.sin(t * 3 + e.id));
    }
    if (ghost < 1) c.globalAlpha = ghost;
    const lvl = dreadLvl;
    AC.draw(c, M, AC.enemySprite(e.defId, r, e.color || '#F2EFE6', variant, lvl), x, y, flip, sx, sy);
    if (lvl >= 2 && (e.id & 3) === 0) art.light(x, y - r * 0.4, r * 1.6, '#FF2E4D', 0.35);
    resetM(c);
    if (ghost < 1) c.globalAlpha = 1;
    if (tele) {
      // warning pip above the head: magenta diamond with a white "!" (steady when reduceFlashing)
      const hy = y - r * 1.15 * 1.55 - 8, s2 = 6;
      c.fillStyle = NR.config.INK; c.beginPath(); c.moveTo(x, hy - s2 - 2.5); c.lineTo(x + s2 + 2.5, hy); c.lineTo(x, hy + s2 + 2.5); c.lineTo(x - s2 - 2.5, hy); c.closePath(); c.fill();
      c.fillStyle = art.T.tele; c.beginPath(); c.moveTo(x, hy - s2); c.lineTo(x + s2, hy); c.lineTo(x, hy + s2); c.lineTo(x - s2, hy); c.closePath(); c.fill();
      c.fillStyle = '#FFFFFF'; c.fillRect(x - 1, hy - 3.5, 2, 4.5); c.fillRect(x - 1, hy + 2, 2, 1.8);
    }
    if (e.status) statusFx(c, e, x, y, r);
  }

  function drawAreas(c, W, a) {
    for (let i = 0; i < W.areas.length; i++) {
      const ar = W.areas[i]; if (ar.dead) continue;
      const col = ar.color || pal[5], k = 1 - Math.pow(1 - Math.min(1, (ar.age || 0) / 0.15), 3), enemy = ar.team === 'enemy';
      if (!inView(ar.x, ar.y, (ar.len || ar.r || 60) + 80)) continue;
      c.fillStyle = enemy ? pal[4] : col; c.strokeStyle = enemy ? pal[4] : col; c.lineWidth = 3; c.lineJoin = 'round';
      if (ar.len > 0 && ar.arc > 0) {
        const a0 = (ar.angle || 0) - ar.arc / 2, a1 = (ar.angle || 0) + ar.arc / 2, R = ar.len * k;
        c.globalAlpha = enemy ? 0.26 : 0.2; c.beginPath(); c.moveTo(ar.x, ar.y); c.arc(ar.x, ar.y, R, a0, a1); c.closePath(); c.fill();
        c.globalAlpha = 1; c.beginPath(); c.moveTo(ar.x, ar.y); c.arc(ar.x, ar.y, R, a0, a1); c.closePath(); c.stroke();
      } else if (ar.len > 0 && ar.w > 0) {
        c.save(); c.translate(ar.x, ar.y); c.rotate(ar.angle || 0);
        c.globalAlpha = enemy ? 0.26 : 0.22; c.fillRect(0, -ar.w / 2, ar.len * k, ar.w);
        c.globalAlpha = 1; c.strokeRect(0, -ar.w / 2, ar.len * k, ar.w); c.restore();
      } else {
        const R = (ar.r || 20) * k;
        c.globalAlpha = enemy ? 0.26 : 0.18; c.beginPath(); c.arc(ar.x, ar.y, R, 0, TAU); c.fill();
        c.globalAlpha = 1; c.beginPath(); c.arc(ar.x, ar.y, R, 0, TAU); c.stroke();
      }
    }
    c.globalAlpha = 1;
  }

  const PICK_LIGHT = { xp_shard: '#6FD6F2', gold: '#FFC23D', heart: '#FF5C8A', magnet: '#FF6B6B', nova_bomb: '#FF9A3D', chest: '#FFC23D' };
  function drawPickups(c, W, a, p) {
    const S = NR.fx.shapes, ink = NR.config.INK;
    for (let i = 0; i < W.pickups.length; i++) {
      const k = W.pickups[i]; if (k.dead) continue;
      const x = k.px + (k.x - k.px) * a, y = k.py + (k.y - k.py) * a;
      if (!inView(x, y, 60)) continue;
      if (k.magnet && p && !p.dead) {
        const dx = p.x - x, dy = p.y - y, d = Math.sqrt(dx * dx + dy * dy) || 1, L = Math.min(d, 46);
        c.strokeStyle = k.color; c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); c.lineTo(x + dx / d * L, y + dy / d * L); c.stroke(); c.lineCap = 'butt';
      }
      if (!k.magnet && k.life < 4 && Math.floor(t * 9) % 2) continue;
      const bob = Math.sin((k.bob || 0) * 4 + k.id) * 2.5, pulse = 1 + 0.06 * Math.sin(t * 6 + k.id);
      if (NR.fx.art) { const lc = PICK_LIGHT[k.type]; if (lc) NR.fx.art.light(x, y + bob, (k.r || 6) * (k.type === 'chest' ? 6 : 3.4), lc, k.type === 'xp_shard' ? 0.38 : 0.5); }
      const pr = (k.r || 6) * pulse;

      // Realistic floor contact shadow
      c.fillStyle = '#0B0A12';
      c.beginPath();
      c.ellipse(x, y + pr * 0.8, pr * 0.85, pr * 0.35, 0, 0, TAU);
      c.fill();

      if (k.type === 'chest') {
        c.fillStyle = '#8C4A3B'; c.fillRect(x - pr, y + bob - pr * 0.4, pr * 2, pr * 1.4);
        c.strokeStyle = ink; c.lineWidth = 2; c.strokeRect(x - pr, y + bob - pr * 0.4, pr * 2, pr * 1.4);
        c.fillStyle = '#C9A24B'; c.fillRect(x - pr * 1.1, y + bob - pr * 0.9, pr * 2.2, pr * 0.6);
        c.strokeRect(x - pr * 1.1, y + bob - pr * 0.9, pr * 2.2, pr * 0.6);
        c.fillStyle = '#FFD43B'; c.fillRect(x - pr * 0.25, y + bob - pr * 0.4, pr * 0.5, pr * 0.6);
        c.strokeRect(x - pr * 0.25, y + bob - pr * 0.4, pr * 0.5, pr * 0.6);
      } else if (k.type === 'heart') {
        c.beginPath();
        c.moveTo(x, y + bob + pr * 0.85);
        c.bezierCurveTo(x - pr * 1.1, y + bob, x - pr, y + bob - pr * 0.85, x, y + bob - pr * 0.35);
        c.bezierCurveTo(x + pr, y + bob - pr * 0.85, x + pr * 1.1, y + bob, x, y + bob + pr * 0.85);
        c.closePath();
        c.fillStyle = '#E86AA6'; c.fill();
        c.strokeStyle = ink; c.lineWidth = 2; c.stroke();
        c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(x - pr * 0.35, y + bob - pr * 0.3, pr * 0.16, 0, TAU); c.fill();
      } else if (k.type === 'gold') {
        c.fillStyle = '#FFD43B'; c.beginPath(); c.arc(x, y + bob, pr, 0, TAU); c.fill();
        c.strokeStyle = ink; c.lineWidth = 2; c.stroke();
        c.fillStyle = '#C9A24B'; c.beginPath(); c.arc(x, y + bob, pr * 0.65, 0, TAU); c.fill();
        c.fillStyle = '#14121F'; c.beginPath(); c.arc(x, y + bob, pr * 0.2, 0, TAU); c.fill();
      } else if (k.type === 'xp_shard') {
        c.fillStyle = '#7FD3F0'; c.strokeStyle = ink; c.lineWidth = 2;
        c.beginPath(); c.moveTo(x, y + bob - pr * 1.1); c.lineTo(x + pr * 0.8, y + bob); c.lineTo(x, y + bob + pr * 1.1); c.lineTo(x - pr * 0.8, y + bob); c.closePath();
        c.fill(); c.stroke();
        c.fillStyle = '#CFEFFA';
        c.beginPath(); c.moveTo(x, y + bob - pr * 1.1); c.lineTo(x + pr * 0.8, y + bob); c.lineTo(x, y + bob + pr * 1.1); c.closePath(); c.fill();
        c.fillStyle = '#FFFFFF';
        c.beginPath(); c.arc(x - pr * 0.2, y + bob - pr * 0.3, pr * 0.15, 0, TAU); c.fill();
      } else if (k.type === 'magnet') {
        c.save(); c.translate(x, y + bob);
        c.fillStyle = '#E5484D'; c.beginPath();
        c.arc(0, 0, pr * 0.9, -Math.PI, 0, false);
        c.lineTo(pr * 0.9, pr * 0.6); c.lineTo(pr * 0.45, pr * 0.6);
        c.arc(0, 0, pr * 0.45, 0, -Math.PI, true);
        c.lineTo(-pr * 0.9, pr * 0.6); c.closePath();
        c.fill(); c.strokeStyle = ink; c.lineWidth = 2; c.stroke();
        c.fillStyle = '#F2EFE6';
        c.fillRect(-pr * 0.9, pr * 0.25, pr * 0.45, pr * 0.35); c.strokeRect(-pr * 0.9, pr * 0.25, pr * 0.45, pr * 0.35);
        c.fillRect(pr * 0.45, pr * 0.25, pr * 0.45, pr * 0.35); c.strokeRect(pr * 0.45, pr * 0.25, pr * 0.45, pr * 0.35);
        c.restore();
      } else if (k.type === 'nova_bomb') {
        c.save(); c.translate(x, y + bob);
        c.fillStyle = '#1F2822'; c.beginPath(); c.arc(0, pr * 0.1, pr * 0.85, 0, TAU); c.fill();
        c.strokeStyle = ink; c.lineWidth = 2; c.stroke();
        c.fillStyle = '#8C4A3B'; c.fillRect(-pr * 0.2, -pr * 0.85, pr * 0.4, pr * 0.3);
        c.strokeRect(-pr * 0.2, -pr * 0.85, pr * 0.4, pr * 0.3);
        c.strokeStyle = '#8C4A3B'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(0, -pr * 0.85); c.lineTo(pr * 0.5, -pr * 1.1); c.stroke();
        c.fillStyle = (Math.floor(t * 18) % 2) ? '#FFD43B' : '#FF7A2F';
        c.beginPath(); c.arc(pr * 0.55, -pr * 1.15, pr * 0.25, 0, TAU); c.fill();
        c.fillStyle = '#FFFFFF';
        c.beginPath(); c.arc(-pr * 0.25, -pr * 0.15, pr * 0.16, 0, TAU); c.fill();
        c.restore();
      } else {
        S.draw(c, k.shape || 'circle', x, y + bob, k.r || 6, (k.rot || 0) + (k.shape === 'star' || k.shape === 'hex' ? t * 0.8 : 0), pulse, pulse, k.color || '#F2EFE6', 2, false);
      }
    }
  }

  const PHYS_SHOT = { pistol: 1, gatling_pistol: 1, scattergun: 1, smg: 1, venom_bow: 1, shredder: 0 };
  const HELD_ALIAS = { smg: 'pistol', venom_bow: 'lancer', frost_seeker: 'seeker', chakram: 'saw_ring', railgun: 'lancer', thunder_hammer: 'maul', comet_staff: 'grenade' };
  function drawBullets(c, W, a, enemy) {
    const S = NR.fx.shapes, P = W.projectiles, tint = pal[4], ink = NR.config.INK;
    for (let i = 0; i < P.length; i++) {
      const b = P[i]; if (b.dead || (b.team === 'enemy') !== enemy) continue;
      const x = b.px + (b.x - b.px) * a, y = b.py + (b.y - b.py) * a;
      if (!inView(x, y, 80)) continue;
      const evo = !enemy && b.weaponId && evolved(b.weaponId), r = (b.r || 5) + (enemy ? 1.5 : 1) + (evo ? 2 : 0);
      if (enemy) {
        const art = NR.fx.art, hs = art.hostileBullet(b.r || 5);
        if (hs) {
          const ang = t * 3 + b.id * 0.7, ca = Math.cos(ang) * M.a, sa = Math.sin(ang) * M.a;
          c.setTransform(ca, sa, -sa, ca, M.e + x * M.a, M.f + y * M.a);
          c.drawImage(hs.img, -hs.ax, -hs.ay, hs.w, hs.h);
          art.light(x, y, (b.r || 5) * 4.2, art.T.hostileGlow, 0.55);
        } else S.draw(c, b.shape || 'circle', x, y, r, b.rot || 0, b.sx || 1, b.sy || 1, b.color || tint, 4, true);
      } else if (PHYS_SHOT[b.weaponId]) {
        const art = NR.fx.art, ps = art.playerBullet(b.color && b.color[0] === '#' && b.color.length === 7 ? b.color : '#F2EFE6', b.r || 4, evo);
        if (ps) {
          const ang = Math.atan2(b.vy || 0, b.vx || 1), ca = Math.cos(ang) * M.a, sa = Math.sin(ang) * M.a;
          c.setTransform(ca, sa, -sa, ca, M.e + x * M.a, M.f + y * M.a);
          c.drawImage(ps.img, -ps.ax, -ps.ay, ps.w, ps.h);
          art.light(x, y, (b.r || 4) * 3.2, '#FFD27A', evo ? 0.35 : 0.22);
        }
      } else {
        if (evo) { c.lineWidth = 2.5; c.strokeStyle = pal[5]; c.beginPath(); c.arc(x, y, r + 4, 0, TAU); c.stroke(); }
        if (b.weaponId === 'seeker') {
          // Guided micro-missile
          const ang = Math.atan2(b.vy || 0, b.vx || 1);
          c.save(); c.translate(x, y); c.rotate(ang);
          // Missile body
          c.fillStyle = '#F2EFE6'; c.strokeStyle = ink; c.lineWidth = 2;
          c.beginPath();
          c.moveTo(r * 1.6, 0); c.lineTo(r * 0.6, -r * 0.55); c.lineTo(-r * 1.2, -r * 0.55); c.lineTo(-r * 1.2, r * 0.55); c.lineTo(r * 0.6, r * 0.55);
          c.closePath(); c.fill(); c.stroke();
          // Red warhead tip
          c.fillStyle = '#E86AA6'; c.beginPath();
          c.moveTo(r * 1.6, 0); c.lineTo(r * 0.8, -r * 0.45); c.lineTo(r * 0.8, r * 0.45); c.closePath(); c.fill();
          // Stabilizer fins
          c.fillStyle = '#3C4B40';
          c.beginPath();
          c.moveTo(-r * 0.8, -r * 0.55); c.lineTo(-r * 1.4, -r * 1.1); c.lineTo(-r * 1.1, -r * 0.55);
          c.moveTo(-r * 0.8, r * 0.55); c.lineTo(-r * 1.4, r * 1.1); c.lineTo(-r * 1.1, r * 0.55);
          c.fill(); c.stroke();
          // Thruster plume
          c.fillStyle = (Math.floor(t * 24) % 2) ? '#FFD43B' : '#FF7A2F';
          c.beginPath(); c.moveTo(-r * 1.2, -r * 0.35); c.lineTo(-r * 1.9, 0); c.lineTo(-r * 1.2, r * 0.35); c.closePath(); c.fill();
          c.restore();
        } else if (b.weaponId === 'saw_ring' || b.weaponId === 'shredder') {
          // Buzzsaw blade
          c.save(); c.translate(x, y); c.rotate(t * 22);
          c.fillStyle = evo ? '#FFD43B' : '#F2EFE6'; c.strokeStyle = ink; c.lineWidth = 2;
          c.beginPath();
          const teeth = evo ? 10 : 8, ro = r * 1.3, ri = r * 0.75;
          for (let ti = 0; ti < teeth; ti++) {
            const a1 = (ti / teeth) * TAU, a2 = a1 + (Math.PI / teeth);
            if (ti === 0) c.moveTo(Math.cos(a1) * ro, Math.sin(a1) * ro); else c.lineTo(Math.cos(a1) * ro, Math.sin(a1) * ro);
            c.lineTo(Math.cos(a2) * ri, Math.sin(a2) * ri);
          }
          c.closePath(); c.fill(); c.stroke();
          c.fillStyle = '#14121F'; c.beginPath(); c.arc(0, 0, r * 0.35, 0, TAU); c.fill();
          c.restore();
        } else if (b.weaponId === 'grenade') {
          // Pineapple grenade projectile
          c.save(); c.translate(x, y); c.rotate(t * 8);
          c.fillStyle = '#3C4B40'; c.strokeStyle = ink; c.lineWidth = 2;
          c.beginPath(); c.arc(0, 0, r * 1.05, 0, TAU); c.fill(); c.stroke();
          c.fillStyle = '#C9A24B'; c.fillRect(-r * 0.25, -r * 1.3, r * 0.5, r * 0.4);
          c.strokeRect(-r * 0.25, -r * 1.3, r * 0.5, r * 0.4);
          c.strokeStyle = '#1F2822'; c.lineWidth = 1.5;
          c.beginPath(); c.moveTo(-r * 0.8, 0); c.lineTo(r * 0.8, 0); c.moveTo(0, -r * 0.8); c.lineTo(0, r * 0.8); c.stroke();
          c.restore();
        } else if (b.weaponId === 'flamer' || b.weaponId === 'inferno_jet') {
          // Expanding flame tongue
          const ang = Math.atan2(b.vy || 0, b.vx || 1);
          c.save(); c.translate(x, y); c.rotate(ang);
          c.fillStyle = evo ? '#FF3D00' : '#FF7A2F'; c.strokeStyle = ink; c.lineWidth = 2;
          c.beginPath();
          c.moveTo(r * 1.4, 0);
          c.bezierCurveTo(r * 0.5, -r * 1.2, -r * 1.0, -r * 0.9, -r * 1.3, 0);
          c.bezierCurveTo(-r * 1.0, r * 0.9, r * 0.5, r * 1.2, r * 1.4, 0);
          c.closePath(); c.fill(); c.stroke();
          c.fillStyle = '#FFD43B';
          c.beginPath(); c.arc(0, 0, r * 0.55, 0, TAU); c.fill();
          c.fillStyle = '#FFFFFF';
          c.beginPath(); c.arc(r * 0.3, 0, r * 0.25, 0, TAU); c.fill();
          c.restore();
        } else if (b.weaponId === 'lancer') {
          // High-velocity rail slug
          const ang = Math.atan2(b.vy || 0, b.vx || 1);
          c.save(); c.translate(x, y); c.rotate(ang);
          c.fillStyle = '#CFEFFA'; c.strokeStyle = ink; c.lineWidth = 2;
          c.fillRect(-r * 1.6, -r * 0.35, r * 3.2, r * 0.7);
          c.strokeRect(-r * 1.6, -r * 0.35, r * 3.2, r * 0.7);
          c.fillStyle = '#7FD3F0';
          c.fillRect(-r * 0.6, -r * 0.6, r * 0.35, r * 1.2);
          c.fillRect(r * 0.6, -r * 0.6, r * 0.35, r * 1.2);
          c.restore();
        } else if (b.weaponId === 'frost_fan') {
          // Sharp crystalline ice shard
          const ang = Math.atan2(b.vy || 0, b.vx || 1);
          c.save(); c.translate(x, y); c.rotate(ang);
          c.fillStyle = '#CFEFFA'; c.strokeStyle = ink; c.lineWidth = 2;
          c.beginPath();
          c.moveTo(r * 1.6, 0); c.lineTo(0, -r * 0.55); c.lineTo(-r * 1.2, 0); c.lineTo(0, r * 0.55);
          c.closePath(); c.fill(); c.stroke();
          c.fillStyle = '#7FD3F0';
          c.beginPath();
          c.moveTo(r * 1.6, 0); c.lineTo(0, 0); c.lineTo(-r * 1.2, 0); c.lineTo(0, r * 0.55);
          c.closePath(); c.fill();
          c.restore();
        } else if (b.weaponId === 'toxin_mine') {
          // Proximity bio-mine
          c.save(); c.translate(x, y);
          c.fillStyle = '#3C4B40'; c.strokeStyle = ink; c.lineWidth = 2;
          c.beginPath(); c.arc(0, 0, r * 1.05, 0, TAU); c.fill(); c.stroke();
          c.fillStyle = (Math.floor(t * 6) % 2) ? '#8BD450' : '#4E9E20';
          c.beginPath(); c.arc(0, 0, r * 0.5, 0, TAU); c.fill();
          c.fillStyle = '#14121F';
          for (let ti = 0; ti < 4; ti++) {
            const ta = (ti / 4) * TAU;
            c.fillRect(Math.cos(ta) * r * 0.85 - 1.5, Math.sin(ta) * r * 0.85 - 1.5, 3, 3);
          }
          c.restore();
        } else if (b.weaponId === 'void_lance') {
          // Hyper-velocity dark matter void lance
          const ang = Math.atan2(b.vy || 0, b.vx || 1);
          c.save(); c.translate(x, y); c.rotate(ang);
          c.fillStyle = '#A25CE0'; c.strokeStyle = ink; c.lineWidth = 2;
          c.beginPath();
          c.moveTo(r * 2.2, 0); c.lineTo(-r * 1.8, -r * 0.4); c.lineTo(-r * 1.2, 0); c.lineTo(-r * 1.8, r * 0.4);
          c.closePath(); c.fill(); c.stroke();
          c.fillStyle = '#FFFFFF';
          c.beginPath(); c.moveTo(r * 1.8, 0); c.lineTo(-r * 0.6, -r * 0.18); c.lineTo(-r * 0.6, r * 0.18); c.closePath(); c.fill();
          c.strokeStyle = '#CFEFFA'; c.lineWidth = 1.8;
          c.beginPath(); c.ellipse(-r * 0.2, 0, r * 0.35, r * 0.75, Math.PI / 3, 0, TAU); c.stroke();
          c.restore();
        } else if (b.weaponId === 'ember_gun') {
          // Fiery molten plasma projectile
          const ang = Math.atan2(b.vy || 0, b.vx || 1);
          c.save(); c.translate(x, y); c.rotate(ang);
          c.fillStyle = '#FF7A2F'; c.strokeStyle = ink; c.lineWidth = 2;
          c.beginPath();
          c.moveTo(r * 1.3, 0);
          c.bezierCurveTo(r * 0.8, -r * 0.9, -r * 0.8, -r * 0.8, -r * 1.2, 0);
          c.bezierCurveTo(-r * 0.8, r * 0.8, r * 0.8, r * 0.9, r * 1.3, 0);
          c.closePath(); c.fill(); c.stroke();
          c.fillStyle = '#FFD43B'; c.beginPath(); c.arc(r * 0.2, 0, r * 0.55, 0, TAU); c.fill();
          c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(r * 0.4, 0, r * 0.25, 0, TAU); c.fill();
          c.restore();
        } else if (b.weaponId === 'maelstrom') {
          // Colossal glacial ice shuriken buzzsaw
          c.save(); c.translate(x, y); c.rotate(-t * 26);
          c.fillStyle = '#7FD3F0'; c.strokeStyle = ink; c.lineWidth = 2.5;
          star(c, 0, 0, r * 1.45, 8, 0.55); c.fill(); c.stroke();
          c.fillStyle = '#CFEFFA';
          star(c, 0, 0, r * 0.9, 8, 0.6); c.fill();
          c.fillStyle = '#14121F'; c.beginPath(); c.arc(0, 0, r * 0.35, 0, TAU); c.fill();
          c.restore();
        } else if (b.weaponId === 'storm_blade') {
          // Crackling electric storm wave
          const ang = Math.atan2(b.vy || 0, b.vx || 1);
          c.save(); c.translate(x, y); c.rotate(ang);
          c.fillStyle = '#7FD3F0'; c.strokeStyle = ink; c.lineWidth = 2;
          c.beginPath();
          c.arc(0, 0, r * 1.4, -0.9, 0.9, false);
          c.arc(r * 0.5, 0, r * 0.9, 0.9, -0.9, true);
          c.closePath(); c.fill(); c.stroke();
          c.strokeStyle = '#FFD43B'; c.lineWidth = 2;
          c.beginPath(); c.moveTo(-r * 0.4, -r * 0.8); c.lineTo(r * 0.2, 0); c.lineTo(-r * 0.4, r * 0.8); c.stroke();
          c.restore();
        } else if (b.weaponId === 'tempest_coil') {
          // High-voltage ball lightning
          c.save(); c.translate(x, y);
          c.fillStyle = '#FFD43B'; c.strokeStyle = ink; c.lineWidth = 2;
          star(c, 0, 0, r * 1.25, 6, 0.6); c.fill(); c.stroke();
          c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(0, 0, r * 0.55, 0, TAU); c.fill();
          c.restore();
        } else if (b.weaponId === 'pistol' || b.weaponId === 'gatling_pistol' || b.weaponId === 'scattergun') {
          // Aerodynamic kinetic bullet slug
          const ang = Math.atan2(b.vy || 0, b.vx || 1);
          c.save(); c.translate(x, y); c.rotate(ang);
          c.fillStyle = b.color || '#FFD43B'; c.strokeStyle = ink; c.lineWidth = 1.8;
          c.beginPath();
          c.moveTo(r * 1.3, 0);
          c.bezierCurveTo(r * 1.1, -r * 0.6, -r * 0.6, -r * 0.6, -r * 0.8, -r * 0.5);
          c.lineTo(-r * 0.8, r * 0.5);
          c.bezierCurveTo(-r * 0.6, r * 0.6, r * 1.1, r * 0.6, r * 1.3, 0);
          c.closePath(); c.fill(); c.stroke();
          c.strokeStyle = '#8B6514'; c.lineWidth = 1.5;
          c.beginPath(); c.moveTo(-r * 0.4, -r * 0.5); c.lineTo(-r * 0.4, r * 0.5); c.stroke();
          c.restore();
        } else {
          S.draw(c, b.shape || 'circle', x, y, r, b.rot || 0, b.sx || 1, b.sy || 1, b.color || '#F2EFE6', 3, true);
        }
      }
    }
  }

  function drawCombatDrone(c, d, x, y, r, rot, col) {
    const ink = NR.config.INK;
    const isEvo = d.weaponId === 'hive_pod' || evolved(d.weaponId || '');
    c.save();
    c.translate(x, y);
    c.rotate(rot);

    // Hard ground shadow
    c.fillStyle = '#0B0A12';
    c.beginPath();
    c.ellipse(1.5, 2.5, r * 0.9, r * 0.5, 0, 0, TAU);
    c.fill();

    // Swept wings
    c.fillStyle = isEvo ? '#C9A24B' : '#3C4B40';
    c.strokeStyle = ink;
    c.lineWidth = 2;
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(0, -r * 0.3);
    c.lineTo(-r * 0.8, -r * 1.1);
    c.lineTo(-r * 0.4, -r * 1.1);
    c.lineTo(r * 0.4, -r * 0.3);
    c.closePath();
    c.fill(); c.stroke();

    c.beginPath();
    c.moveTo(0, r * 0.3);
    c.lineTo(-r * 0.8, r * 1.1);
    c.lineTo(-r * 0.4, r * 1.1);
    c.lineTo(r * 0.4, r * 0.3);
    c.closePath();
    c.fill(); c.stroke();

    // Twin or Quad blasters on wing tips
    c.fillStyle = '#14121F';
    c.fillRect(-r * 0.3, -r * 1.15, r * 0.8, r * 0.22);
    c.fillRect(-r * 0.3, r * 0.93, r * 0.8, r * 0.22);
    if (isEvo) {
      c.fillRect(-r * 0.1, -r * 1.35, r * 0.7, r * 0.18);
      c.fillRect(-r * 0.1, r * 1.17, r * 0.7, r * 0.18);
    }

    // Fuselage / hull
    c.fillStyle = isEvo ? '#FFD43B' : (col || '#5FB49C');
    c.beginPath();
    c.moveTo(r * 1.1, 0);
    c.lineTo(r * 0.2, -r * 0.6);
    c.lineTo(-r * 0.8, -r * 0.45);
    c.lineTo(-r * 0.6, 0);
    c.lineTo(-r * 0.8, r * 0.45);
    c.lineTo(r * 0.2, r * 0.6);
    c.closePath();
    c.fill(); c.stroke();

    // Armor plating trim
    c.fillStyle = isEvo ? '#FFFFFF' : '#EDE3C8';
    c.beginPath();
    c.moveTo(r * 0.5, 0);
    c.lineTo(-r * 0.2, -r * 0.3);
    c.lineTo(-r * 0.2, r * 0.3);
    c.closePath();
    c.fill();

    // Sensor eye / reactor core
    c.fillStyle = isEvo ? '#E5484D' : '#FFD43B';
    c.beginPath();
    c.arc(r * 0.2, 0, r * 0.22, 0, TAU);
    c.fill();

    // Thruster exhaust flame
    const flameW = (Math.floor(t * 20) % 2 ? 0.9 : 0.6) * r;
    c.fillStyle = isEvo ? '#FF7A2F' : '#7FD3F0';
    c.beginPath();
    c.moveTo(-r * 0.6, -r * 0.2);
    c.lineTo(-r * 0.6 - flameW, 0);
    c.lineTo(-r * 0.6, r * 0.2);
    c.closePath();
    c.fill();

    c.restore();
  }

  function draw(W, alpha) {
    if (!ctx || !W) return;
    const F = NR.fx;
    if (F.art) { F.art.tickFrame(); if (F.art.version() !== artVer) dirty = true; }
    if (dirty) fit();
    t = now(); pal = palette();
    const q = F.particles ? F.particles.quality() : 0, a = alpha === undefined ? 1 : alpha;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = NR.config.INK; ctx.fillRect(0, 0, V.bw, V.bh);
    if (V.ox > 0 || V.oy > 0) drawFrame();
    ctx.setTransform(V.k, 0, 0, V.k, V.ox, V.oy);
    ctx.save();
    if (V.ox > 0 || V.oy > 0) { ctx.beginPath(); ctx.rect(0, 0, cw, ch); ctx.clip(); }
    NR.camera.apply(ctx);
    readM(ctx);
    NR.camera.toWorld(0, 0, view);
    calm = !!NR.save.getSettings().reduceFlashing;
    dreadLvl = W.wave > 10 ? 2 : W.wave > 5 ? 1 : 0;
    if (F.art) F.art.setView(view.x, view.y, view.x + cw, view.y + ch);
    const p = W.player;
    if (F.floor) F.floor.draw(ctx);
    if (F.particles) F.particles.drawUnder(ctx);
    drawPickups(ctx, W, a, p);
    drawAreas(ctx, W, a);
    const E = W.enemies;
    for (let i = 0; i < E.length; i++) { const e = E[i]; if (!e.dead && !e.isBoss) drawEnemy(ctx, e, a, q); }
    for (let i = 0; i < E.length; i++) { const e = E[i]; if (!e.dead && e.isBoss) drawEnemy(ctx, e, a, q); }
    const D = W.drones;
    for (let i = 0; i < D.length; i++) {
      const d = D[i]; if (d.dead) continue;
      const x = d.px + (d.x - d.px) * a, y = d.py + (d.y - d.py) * a + Math.sin(t * 5 + d.id) * 2;
      if (q >= 3) {
        F.shapes.draw(ctx, d.shape || 'diamond', x, y, d.r || 8, d.rot || t * 2, 1, 1, d.color || pal[5], 3, false);
      } else {
        drawCombatDrone(ctx, d, x, y, d.r || 8, d.rot || t * 2, d.color || pal[5]);
      }
    }
    drawBullets(ctx, W, a, false);
    resetM(ctx);
    if (p && !p.dead) drawPlayer(ctx, p, a, q);
    if (F.particles) F.particles.draw(ctx);
    drawBullets(ctx, W, a, true);
    resetM(ctx);
    if (F.art) F.art.flushLights(ctx);
    if (F.particles) F.particles.drawTexts(ctx);
    ctx.restore();
    // screen-space atmosphere: parallax motes + baked vignette (quality permitting)
    if (F.art) {
      const Q = F.art.quality();
      ctx.setTransform(V.k, 0, 0, V.k, V.ox, V.oy);
      F.art.drawMotes(ctx, zone, view.x, view.y, cw, ch, t);
      if (Q.vignette) { const vg = F.art.vignette(zone, pal[2] || '#14121F'); if (vg) ctx.drawImage(vg, 0, 0, cw, ch); }
    }
    ctx.setTransform(V.k, 0, 0, V.k, V.ox, V.oy);
    if (F.juice) F.juice.drawOverlay(ctx, cw, ch);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  // decorative frame beside a world wider than 21:9 (or above/below it): zone wall colour, ink rails, rivet studs
  function drawFrame() {
    const wall = pal[2] || '#1F2822', k = V.k, x1 = V.ox + cw * k, y1 = V.oy + ch * k;
    ctx.fillStyle = wall;
    if (V.ox > 0) { ctx.fillRect(0, 0, V.ox, V.bh); ctx.fillRect(x1, 0, V.bw - x1, V.bh); }
    if (V.oy > 0) { ctx.fillRect(0, 0, V.bw, V.oy); ctx.fillRect(0, y1, V.bw, V.bh - y1); }
    ctx.fillStyle = NR.config.INK;
    const rail = Math.max(4, Math.round(6 * k));
    if (V.ox > 0) { ctx.fillRect(V.ox - rail, 0, rail, V.bh); ctx.fillRect(x1, 0, rail, V.bh); }
    if (V.oy > 0) { ctx.fillRect(0, V.oy - rail, V.bw, rail); ctx.fillRect(0, y1, V.bw, rail); }
    ctx.fillStyle = pal[3] || '#C9A24B';
    const st = Math.round(64 * k), s = Math.max(3, Math.round(5 * k));
    if (V.ox > 0) for (let y = st / 2; y < V.bh; y += st) { ctx.fillRect(V.ox / 2 - s, y - s, s * 2, s * 2); ctx.fillRect(x1 + (V.bw - x1) / 2 - s, y - s, s * 2, s * 2); }
  }
  NR.fx = NR.fx || {};
  NR.fx.render = { init: init, resize: resize, fit: fit, toView: toView, view: function () { return V; }, draw: draw, setZone: setZone, palette: palette, zone: function () { return zone; }, size: function () { return sz; } };
})();
