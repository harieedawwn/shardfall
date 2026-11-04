// Owner: FX
// Flat entity shapes: solid fill, dark outline, hard offset shadow. Every shape/color/size/outline/core combination
// is cached once as an offscreen sprite (body + shadow) and blitted with drawImage. No gradients, blur or glow.
// Includes high-detail procedural vector illustrations for all weapons, items, and pickups.
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  const ids = ['circle', 'square', 'tri', 'diamond', 'hex', 'star', 'cross', 'capsule', 'ring', 'arc', 'beam'];
  const KNOWN = {};
  for (let i = 0; i < ids.length; i++) KNOWN[ids[i]] = true;
  const MAX_SPRITES = 900;
  const HEX = /^#[0-9a-fA-F]{6}$/;
  const darkMap = Object.create(null), lightMap = Object.create(null);
  let sprites = Object.create(null), count = 0;

  function darkOf(c) { return darkMap[c] || (darkMap[c] = HEX.test(c) ? NR.util.shade(c, -0.45) : NR.config.INK); }
  function lightOf(c) { return lightMap[c] || (lightMap[c] = HEX.test(c) ? NR.util.shade(c, 0.72) : '#FFFFFF'); }

  function poly(ctx, n, r, inner) {
    ctx.beginPath();
    const pts = inner ? n * 2 : n;
    for (let i = 0; i < pts; i++) {
      const a = i / pts * Math.PI * 2 - Math.PI / 2, rr = inner && i % 2 ? r * 0.45 : r;
      if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
  }
  // outline path of a shape centred on the origin (beam starts at the origin and points along +x)
  function path(ctx, shape, r) {
    switch (shape) {
      case 'square': ctx.beginPath(); ctx.rect(-r, -r, r * 2, r * 2); break;
      case 'tri': poly(ctx, 3, r * 1.15); break;
      case 'diamond': poly(ctx, 4, r * 1.2); break;
      case 'hex': poly(ctx, 6, r); break;
      case 'star': poly(ctx, 5, r * 1.2, true); break;
      case 'cross': ctx.beginPath(); ctx.moveTo(-r / 3, -r); ctx.lineTo(r / 3, -r); ctx.lineTo(r / 3, -r / 3); ctx.lineTo(r, -r / 3); ctx.lineTo(r, r / 3); ctx.lineTo(r / 3, r / 3); ctx.lineTo(r / 3, r); ctx.lineTo(-r / 3, r); ctx.lineTo(-r / 3, r / 3); ctx.lineTo(-r, r / 3); ctx.lineTo(-r, -r / 3); ctx.lineTo(-r / 3, -r / 3); ctx.closePath(); break;
      case 'capsule': {
        const k = r / 2;
        ctx.beginPath(); ctx.moveTo(-r + k, -k); ctx.lineTo(r - k, -k); ctx.arc(r - k, 0, k, -Math.PI / 2, Math.PI / 2); ctx.lineTo(-r + k, k); ctx.arc(-r + k, 0, k, Math.PI / 2, Math.PI * 1.5); ctx.closePath(); break;
      }
      case 'ring': ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.moveTo(r * 0.62, 0); ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2, true); break;
      case 'arc': {
        const a = 0.95, ri = r * 0.55;
        ctx.beginPath(); ctx.moveTo(Math.cos(-a) * ri, Math.sin(-a) * ri); ctx.lineTo(Math.cos(-a) * r, Math.sin(-a) * r); ctx.arc(0, 0, r, -a, a);
        ctx.lineTo(Math.cos(a) * ri, Math.sin(a) * ri); ctx.arc(0, 0, ri, a, -a, true); ctx.closePath(); break;
      }
      case 'beam': ctx.beginPath(); ctx.rect(0, -r / 3, r * 4, r * 2 / 3); break;
      default: ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    }
  }
  function extent(shape, r) {
    switch (shape) {
      case 'beam': return r * 4;
      case 'star': case 'diamond': return r * 1.2;
      case 'tri': return r * 1.15;
      default: return r;
    }
  }
  function paintBody(c, shape, r, fill, ow, core) {
    path(c, shape, r); c.fillStyle = fill; c.fill(shape === 'ring' ? 'evenodd' : undefined);
    if (ow > 0) { c.lineWidth = ow; c.lineJoin = 'round'; c.strokeStyle = NR.config.INK; c.stroke(); }
    if (core && shape !== 'ring' && shape !== 'arc') {
      path(c, shape, shape === 'beam' ? r : r * 0.52); c.fillStyle = lightOf(fill); c.fill();
    }
  }
  function paintShadow(c, shape, r, fill, ow) {
    path(c, shape, r); c.fillStyle = darkOf(fill); c.fill(shape === 'ring' ? 'evenodd' : undefined);
    if (ow > 0) { c.lineWidth = ow; c.lineJoin = 'round'; c.strokeStyle = darkOf(fill); c.stroke(); }
  }
  function make(shape, r, fill, ow, core) {
    if (typeof document === 'undefined' || !document.createElement) return null;
    const half = Math.ceil(extent(shape, r) + ow + 3), size = half * 2;
    const body = document.createElement('canvas'), sh = document.createElement('canvas');
    body.width = body.height = sh.width = sh.height = size;
    const bc = body.getContext('2d'), sc = sh.getContext('2d');
    if (!bc || !sc) return null;
    bc.translate(half, half); sc.translate(half, half);
    paintBody(bc, shape, r, fill, ow, core);
    paintShadow(sc, shape, r, fill, ow);
    return { body: body, shadow: sh, half: half };
  }
  function clear() { sprites = Object.create(null); count = 0; }
  function sprite(shape, r, fill, ow, core) {
    const key = shape + '|' + fill + '|' + r + '|' + ow + '|' + (core ? 1 : 0);
    let s = sprites[key];
    if (s === undefined) {
      if (count >= MAX_SPRITES) clear();
      s = make(shape, r, fill, ow, core);
      sprites[key] = s; count++;
    }
    return s;
  }

  function drawVector(ctx, shape, x, y, r, rot, sx, sy, fill, ow, core) {
    const S = NR.config.SHADOW;
    ctx.save(); ctx.translate(x + S.x, y + S.y); if (rot) ctx.rotate(rot); ctx.scale(sx, sy); paintShadow(ctx, shape, r, fill, ow); ctx.restore();
    ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); ctx.scale(sx, sy); paintBody(ctx, shape, r, fill, ow, core); ctx.restore();
  }
  // draw(ctx, shape, x, y, r, rot, sx, sy, fill, outlineW, core): core = light solid centre inside the coloured rim
  function draw(ctx, shape, x, y, r, rot, sx, sy, fill, outlineW, core) {
    if (!KNOWN[shape]) shape = 'circle';
    const ow = outlineW === undefined ? 3 : outlineW, S = NR.config.SHADOW;
    fill = fill || '#F2EFE6';
    rot = shape === 'circle' || shape === 'ring' ? 0 : (rot || 0);
    sx = sx || 1; sy = sy || 1;
    const rq = Math.max(1, Math.round(r));
    const s = sprite(shape, rq, fill, ow, !!core);
    if (!s) { drawVector(ctx, shape, x, y, rq, rot, sx, sy, fill, ow, core); return; }
    const h = s.half;
    if (rot === 0 && sx === 1 && sy === 1) {
      ctx.drawImage(s.shadow, Math.round(x + S.x - h), Math.round(y + S.y - h));
      ctx.drawImage(s.body, Math.round(x - h), Math.round(y - h));
      return;
    }
    const c = Math.cos(rot), n = Math.sin(rot);
    const lx = (S.x * c + S.y * n) / sx, ly = (-S.x * n + S.y * c) / sy;
    ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
    ctx.drawImage(s.shadow, lx - h, ly - h);
    ctx.drawImage(s.body, -h, -h);
    ctx.restore();
  }
  function shadow(ctx, shape, x, y, r, rot, sx, sy, fill) {
    if (!KNOWN[shape]) shape = 'circle';
    const S = NR.config.SHADOW, rq = Math.max(1, Math.round(r)), f = fill || '#F2EFE6', s = sprite(shape, rq, f, 3, false);
    ctx.save(); ctx.translate(x + S.x, y + S.y); if (rot) ctx.rotate(rot); if ((sx || 1) !== 1 || (sy || 1) !== 1) ctx.scale(sx || 1, sy || 1);
    if (s) ctx.drawImage(s.shadow, -s.half, -s.half); else paintShadow(ctx, shape, rq, f, 3);
    ctx.restore();
  }

  // ============================================================================
  // PROCEDURAL VECTOR ARTWORK: WEAPONS, ITEMS & PICKUPS (SPEC 12 STRICT FLAT STYLE)
  // ============================================================================
  const TAU = Math.PI * 2;

  function polyN(c, x, y, r, n, rot) {
    rot = rot || 0;
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU - Math.PI / 2 + rot;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    ctxClose(c);
  }

  function starN(c, x, y, r, n, inner, rot) {
    rot = rot || 0;
    c.beginPath();
    const pts = n * 2;
    for (let i = 0; i < pts; i++) {
      const a = (i / pts) * TAU - Math.PI / 2 + rot;
      const rad = i % 2 ? r * inner : r;
      const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    ctxClose(c);
  }

  function ctxClose(c) { try { c.closePath(); } catch (e) {} }

  function makePainter(c, r, isShadow, opts) {
    opts = opts || {};
    const ink = opts.ink || (NR.config && NR.config.INK) || '#14121F';
    const shadowShade = opts.shadowShade || '#0B0A12';
    const silCol = opts.silColor || '#1D1530';
    const isSil = !!opts.sil;
    const lwBase = opts.line !== undefined ? opts.line : Math.max(1.5, r * 0.12);

    return {
      ink: ink,
      lw: lwBase,
      fs: function (fill, stroke, customLw) {
        if (isShadow) {
          c.fillStyle = shadowShade; c.fill();
          c.lineWidth = customLw || lwBase; c.lineJoin = 'round'; c.lineCap = 'round';
          c.strokeStyle = shadowShade; c.stroke();
        } else if (isSil) {
          c.fillStyle = silCol; c.fill();
          c.lineWidth = customLw || lwBase; c.lineJoin = 'round'; c.lineCap = 'round';
          c.strokeStyle = ink; c.stroke();
        } else {
          c.fillStyle = fill; c.fill();
          if (stroke !== null && stroke !== false) {
            c.lineWidth = customLw || lwBase; c.lineJoin = 'round'; c.lineCap = 'round';
            c.strokeStyle = stroke || ink; c.stroke();
          }
        }
      },
      f: function (fill) {
        if (isShadow) { c.fillStyle = shadowShade; c.fill(); }
        else if (isSil) { c.fillStyle = silCol; c.fill(); }
        else { c.fillStyle = fill; c.fill(); }
      },
      s: function (stroke, customLw) {
        if (isShadow) {
          c.lineWidth = customLw || lwBase; c.lineJoin = 'round'; c.lineCap = 'round';
          c.strokeStyle = shadowShade; c.stroke();
        } else if (isSil) {
          c.lineWidth = customLw || lwBase; c.lineJoin = 'round'; c.lineCap = 'round';
          c.strokeStyle = ink; c.stroke();
        } else {
          c.lineWidth = customLw || lwBase; c.lineJoin = 'round'; c.lineCap = 'round';
          c.strokeStyle = stroke || ink; c.stroke();
        }
      }
    };
  }

  // ---------- WEAPON ILLUSTRATION PATHS (16 base + 23 evolutions) ----------
  function renderWeaponIllustration(c, id, r, isShadow, opts) {
    const p = makePainter(c, r, isShadow, opts);
    const col = opts.col || null;

    switch (id) {
      case 'pistol': {
        const slide = col || '#8C86A0', grip = '#1F2822', metal = '#EDE3C8';
        c.beginPath(); c.moveTo(-r * 0.5, r * 0.1); c.lineTo(-r * 0.25, r * 0.1); c.lineTo(-r * 0.2, r * 0.75); c.lineTo(-r * 0.5, r * 0.75); ctxClose(c);
        p.fs(grip);
        c.beginPath(); c.rect(-r * 0.65, -r * 0.35, r * 1.15, r * 0.45);
        p.fs(slide);
        c.beginPath(); c.rect(r * 0.5, -r * 0.22, r * 0.2, r * 0.25);
        p.fs(metal);
        c.beginPath(); c.moveTo(-r * 0.45, -r * 0.28); c.lineTo(-r * 0.45, 0); c.moveTo(-r * 0.32, -r * 0.28); c.lineTo(-r * 0.32, 0);
        p.s(p.ink, p.lw * 0.8);
        break;
      }
      case 'gatling_pistol': {
        const brass = col || '#FFB703', steel = '#3C4B40', drum = '#D9693A';
        c.beginPath(); c.rect(-r * 0.4, r * 0.2, r * 0.4, r * 0.55);
        p.fs(steel);
        c.beginPath(); c.arc(-r * 0.2, 0, r * 0.4, 0, TAU);
        p.fs(drum);
        c.beginPath(); c.rect(-r * 0.65, -r * 0.4, r * 0.65, r * 0.7);
        p.fs(brass);
        c.beginPath();
        c.rect(0, -r * 0.32, r * 0.75, r * 0.2);
        c.rect(0, -r * 0.08, r * 0.82, r * 0.2);
        c.rect(0, r * 0.16, r * 0.75, r * 0.2);
        p.fs(steel);
        c.beginPath();
        c.rect(r * 0.32, -r * 0.38, r * 0.18, r * 0.82);
        c.rect(r * 0.7, -r * 0.38, r * 0.14, r * 0.82);
        p.fs(brass);
        break;
      }
      case 'ember_gun': {
        const body = col || '#FF7A2F', dark = '#1F2822', fire = '#FFD43B';
        c.beginPath(); c.moveTo(-r * 0.45, r * 0.18); c.lineTo(-r * 0.15, r * 0.18); c.lineTo(-r * 0.1, r * 0.75); c.lineTo(-r * 0.4, r * 0.75); ctxClose(c);
        p.fs(dark);
        c.beginPath(); c.arc(-r * 0.12, -r * 0.06, r * 0.32, 0, TAU);
        p.fs(fire);
        c.beginPath(); c.rect(r * 0.15, -r * 0.25, r * 0.58, r * 0.4);
        c.rect(-r * 0.58, -r * 0.38, r * 0.5, r * 0.45);
        p.fs(body);
        c.beginPath(); c.rect(r * 0.2, -r * 0.38, r * 0.5, r * 0.14);
        p.fs(dark);
        break;
      }
      case 'scattergun': {
        const wood = col || '#8C4A3B', steel = '#5A526E', brass = '#FFD43B';
        c.beginPath(); c.moveTo(-r * 0.7, r * 0.5); c.lineTo(-r * 0.25, r * 0.18); c.lineTo(-r * 0.2, 0); c.lineTo(-r * 0.7, r * 0.25); ctxClose(c);
        p.fs(wood);
        c.beginPath(); c.rect(-r * 0.2, -r * 0.2, r * 0.32, r * 0.4);
        p.fs(steel);
        c.beginPath();
        c.rect(r * 0.12, -r * 0.26, r * 0.68, r * 0.22);
        c.rect(r * 0.12, -r * 0.04, r * 0.68, r * 0.22);
        p.fs(steel);
        c.beginPath(); c.rect(r * 0.12, r * 0.06, r * 0.32, r * 0.22);
        p.fs(wood);
        c.beginPath(); c.arc(r * 0.75, -r * 0.32, r * 0.08, 0, TAU);
        p.f(brass);
        break;
      }
      case 'shredder': {
        const orange = col || '#E36414', dark = '#2A1E3F', steel = '#F2EFE6';
        c.beginPath(); c.rect(-r * 0.75, -r * 0.12, r * 0.38, r * 0.38);
        c.rect(-r * 0.44, r * 0.18, r * 0.32, r * 0.5);
        p.fs(dark);
        c.beginPath(); c.arc(-r * 0.06, r * 0.32, r * 0.35, 0, TAU);
        p.fs(orange);
        c.beginPath(); c.rect(-r * 0.38, -r * 0.26, r * 0.95, r * 0.38);
        p.fs(orange);
        c.beginPath();
        c.moveTo(r * 0.56, -r * 0.26); c.lineTo(r * 0.82, -r * 0.32); c.lineTo(r * 0.7, -r * 0.12);
        c.lineTo(r * 0.88, 0); c.lineTo(r * 0.7, r * 0.12); c.lineTo(r * 0.82, r * 0.26); c.lineTo(r * 0.56, r * 0.2);
        ctxClose(c);
        p.fs(steel);
        break;
      }
      case 'frost_fan': {
        const ice = col || '#7FD3F0', light = '#CFEFFA', rib = '#27384F';
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI * 0.82 + (i / 4) * Math.PI * 0.64;
          const a1 = a - 0.1, a2 = a + 0.1;
          c.beginPath();
          c.moveTo(0, r * 0.55);
          c.lineTo(Math.cos(a1) * r * 0.95, r * 0.55 + Math.sin(a1) * r * 0.95);
          c.lineTo(Math.cos(a) * r * 1.15, r * 0.55 + Math.sin(a) * r * 1.15);
          c.lineTo(Math.cos(a2) * r * 0.95, r * 0.55 + Math.sin(a2) * r * 0.95);
          ctxClose(c);
          p.fs(i % 2 === 0 ? ice : light);
        }
        c.beginPath(); c.arc(0, r * 0.55, r * 0.22, 0, TAU);
        p.fs(rib);
        break;
      }
      case 'lancer': {
        const blue = col || '#5FA8D3', dark = '#14121F', cyan = '#CFEFFA';
        c.beginPath(); c.moveTo(-r * 0.8, r * 0.12); c.lineTo(-r * 0.45, r * 0.12); c.lineTo(-r * 0.25, r * 0.25); c.lineTo(-r * 0.5, r * 0.32); ctxClose(c);
        p.fs(dark);
        c.beginPath();
        c.rect(-r * 0.65, -r * 0.22, r * 1.3, r * 0.18);
        c.rect(-r * 0.65, 0.02, r * 1.3, r * 0.18);
        p.fs(blue);
        c.beginPath();
        c.rect(-r * 0.2, -r * 0.32, r * 0.18, r * 0.62);
        c.rect(r * 0.2, -r * 0.32, r * 0.18, r * 0.62);
        p.fs(cyan);
        c.beginPath(); c.moveTo(r * 0.68, -r * 0.12); c.lineTo(r * 0.95, 0); c.lineTo(r * 0.68, r * 0.12); ctxClose(c);
        p.fs(cyan);
        break;
      }
      case 'flamer': {
        const red = col || '#E5484D', dark = '#3C4B40', flame = '#FF7A2F', yellow = '#FFD43B';
        c.beginPath(); c.rect(-r * 0.5, r * 0.12, r * 0.62, r * 0.38);
        p.fs(red);
        c.beginPath(); c.rect(-r * 0.65, -r * 0.25, r * 0.88, r * 0.38);
        p.fs(dark);
        c.beginPath(); c.moveTo(r * 0.25, -r * 0.32); c.lineTo(r * 0.62, -r * 0.38); c.lineTo(r * 0.62, r * 0.25); c.lineTo(r * 0.25, r * 0.2); ctxClose(c);
        p.fs(red);
        c.beginPath(); c.moveTo(r * 0.62, -r * 0.18); c.lineTo(r * 0.88, -r * 0.06); c.lineTo(r * 0.62, r * 0.06); ctxClose(c);
        p.f(flame);
        c.beginPath(); c.moveTo(r * 0.62, -r * 0.1); c.lineTo(r * 0.75, -r * 0.06); c.lineTo(r * 0.62, 0); ctxClose(c);
        p.f(yellow);
        break;
      }
      case 'inferno_jet': {
        const flame = col || '#FF3D00', gold = '#FFD43B', dark = '#1F2822';
        c.beginPath();
        c.rect(-r * 0.62, r * 0.18, r * 0.7, r * 0.38);
        c.rect(-r * 0.62, -r * 0.55, r * 0.7, r * 0.32);
        p.fs(flame);
        c.beginPath(); c.rect(-r * 0.7, -r * 0.25, r * 0.95, r * 0.5);
        p.fs(dark);
        c.beginPath(); c.moveTo(r * 0.25, -r * 0.45); c.lineTo(r * 0.75, -r * 0.5); c.lineTo(r * 0.75, r * 0.5); c.lineTo(r * 0.25, r * 0.45); ctxClose(c);
        p.fs(gold);
        c.beginPath(); c.moveTo(r * 0.75, -r * 0.25); c.lineTo(r * 1.05, 0); c.lineTo(r * 0.75, r * 0.25); ctxClose(c);
        p.fs(flame);
        break;
      }
      case 'katana': {
        const blade = col || '#F2EFE6', gold = '#FFD43B', hilt = '#8C4A3B';
        c.beginPath(); c.moveTo(-r * 0.75, r * 0.62); c.lineTo(-r * 0.25, r * 0.18); c.lineTo(-r * 0.12, r * 0.3); c.lineTo(-r * 0.62, r * 0.75); ctxClose(c);
        p.fs(hilt);
        c.beginPath(); c.ellipse(-r * 0.2, r * 0.2, r * 0.18, r * 0.38, Math.PI / 4, 0, TAU);
        p.fs(gold);
        c.beginPath();
        c.moveTo(-r * 0.06, r * 0.12);
        c.quadraticCurveTo(r * 0.38, -r * 0.25, r * 0.88, -r * 0.62);
        c.lineTo(r * 1.0, -r * 0.7);
        c.quadraticCurveTo(r * 0.44, -r * 0.12, 0.06, r * 0.25);
        ctxClose(c);
        p.fs(blade);
        break;
      }
      case 'storm_blade': {
        const blade = col || '#FFF3A3', lightning = '#7FD3F0', gold = '#FFD43B', dark = '#14121F';
        c.beginPath(); c.moveTo(-r * 0.82, r * 0.7); c.lineTo(-r * 0.25, r * 0.18); c.lineTo(-r * 0.12, r * 0.3); c.lineTo(-r * 0.7, r * 0.82); ctxClose(c);
        p.fs(dark);
        starN(c, -r * 0.2, r * 0.25, r * 0.32, 4, 0.45, Math.PI / 4);
        p.fs(gold);
        c.beginPath();
        c.moveTo(-r * 0.06, r * 0.12);
        c.quadraticCurveTo(r * 0.38, -r * 0.25, r * 0.95, -r * 0.7);
        c.lineTo(r * 1.08, -r * 0.82);
        c.quadraticCurveTo(r * 0.44, -r * 0.12, 0.06, r * 0.25);
        ctxClose(c);
        p.fs(blade);
        c.beginPath();
        c.moveTo(0.06, 0.06); c.lineTo(r * 0.25, -r * 0.06); c.lineTo(r * 0.38, -r * 0.25); c.lineTo(r * 0.62, -r * 0.32); c.lineTo(r * 0.82, -r * 0.58);
        p.s(lightning, p.lw * 1.1);
        break;
      }
      case 'maul': {
        const stone = col || '#8A5BD1', obsidian = '#1B1229', rune = '#E86AA6', iron = '#3C4B40';
        c.beginPath(); c.moveTo(-r * 0.75, r * 0.7); c.lineTo(r * 0.38, -r * 0.32);
        p.s(iron, p.lw * 1.5);
        c.beginPath();
        c.moveTo(r * 0.06, -r * 0.45); c.lineTo(r * 0.32, -r * 0.7); c.lineTo(r * 0.82, -r * 0.45); c.lineTo(r * 0.95, -r * 0.06);
        c.lineTo(r * 0.7, r * 0.2); c.lineTo(r * 0.45, r * 0.06); c.lineTo(r * 0.2, r * 0.25); c.lineTo(-r * 0.06, 0);
        ctxClose(c);
        p.fs(stone);
        c.beginPath(); c.moveTo(r * 0.06, -r * 0.45); c.lineTo(-r * 0.32, -r * 0.7); c.lineTo(-r * 0.06, 0); ctxClose(c);
        p.fs(obsidian);
        c.beginPath(); c.arc(r * 0.45, -r * 0.2, r * 0.15, 0, TAU);
        p.f(rune);
        break;
      }
      case 'saw_ring': {
        const steel = col || '#F2EFE6', iron = '#3C4B40', red = '#D9693A';
        c.beginPath();
        const numTeeth = 8;
        for (let i = 0; i < numTeeth; i++) {
          const a0 = (i / numTeeth) * TAU;
          const a1 = a0 + (TAU / numTeeth) * 0.45;
          const a2 = a0 + (TAU / numTeeth);
          if (i === 0) c.moveTo(Math.cos(a0) * r * 0.5, Math.sin(a0) * r * 0.5);
          c.lineTo(Math.cos(a1) * r * 0.88, Math.sin(a1) * r * 0.88);
          c.lineTo(Math.cos(a2) * r * 0.5, Math.sin(a2) * r * 0.5);
        }
        ctxClose(c);
        p.fs(steel);
        c.beginPath(); c.arc(0, 0, r * 0.32, 0, TAU);
        p.fs(iron);
        c.beginPath(); c.arc(0, 0, r * 0.12, 0, TAU);
        p.f(red);
        break;
      }
      case 'drone_pod': {
        const teal = col || '#5FB49C', yellow = '#FFE066', dark = '#1F2822';
        c.beginPath();
        c.moveTo(-r * 0.58, -r * 0.45); c.lineTo(-r * 0.2, -r * 0.12); c.lineTo(-r * 0.2, r * 0.12);
        c.lineTo(-r * 0.58, r * 0.45); c.lineTo(-r * 0.7, r * 0.25); c.lineTo(-r * 0.7, -r * 0.25);
        ctxClose(c);
        p.fs(dark);
        c.beginPath();
        c.moveTo(-r * 0.32, -r * 0.32); c.lineTo(r * 0.45, -r * 0.25); c.lineTo(r * 0.7, 0); c.lineTo(r * 0.45, r * 0.25); c.lineTo(-r * 0.32, r * 0.32);
        ctxClose(c);
        p.fs(teal);
        c.beginPath();
        c.rect(r * 0.5, -r * 0.25, r * 0.25, r * 0.12);
        c.rect(r * 0.5, r * 0.12, r * 0.25, r * 0.12);
        p.fs(dark);
        c.beginPath(); c.arc(r * 0.2, 0, r * 0.15, 0, TAU);
        p.f(yellow);
        break;
      }
      case 'hive_pod': {
        const gold = col || '#FFE066', dark = '#2E3A32', cyan = '#7FD3F0';
        polyN(c, 0, 0, r * 0.78, 6, 0);
        p.fs(dark);
        polyN(c, 0, 0, r * 0.52, 6, Math.PI / 6);
        p.fs(gold);
        c.beginPath(); c.arc(0, 0, r * 0.15, 0, TAU);
        p.f(dark);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU;
          c.beginPath(); c.arc(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3, r * 0.07, 0, TAU);
          p.f(cyan);
        }
        c.beginPath();
        c.moveTo(r * 0.38, -r * 0.5); c.lineTo(r * 0.7, -r * 0.75);
        c.moveTo(r * 0.38, r * 0.5); c.lineTo(r * 0.7, r * 0.75);
        p.s(p.ink, p.lw * 1.1);
        break;
      }
      case 'grenade': {
        const olive = col || '#3C4B40', brass = '#C9A24B', steel = '#EDE3C8';
        c.beginPath(); c.rect(-r * 0.38, -r * 0.2, r * 0.75, r * 0.95);
        p.fs(olive);
        c.beginPath();
        c.moveTo(-r * 0.38, r * 0.12); c.lineTo(r * 0.38, r * 0.12);
        c.moveTo(-r * 0.38, r * 0.45); c.lineTo(r * 0.38, r * 0.45);
        c.moveTo(0, -r * 0.2); c.lineTo(0, r * 0.75);
        p.s(p.ink, p.lw * 0.8);
        c.beginPath(); c.rect(-r * 0.2, -r * 0.45, r * 0.4, r * 0.25);
        p.fs(brass);
        c.beginPath();
        c.moveTo(-r * 0.12, -r * 0.45); c.lineTo(r * 0.32, -r * 0.52); c.lineTo(r * 0.38, r * 0.25);
        p.s(steel, p.lw * 0.8);
        c.beginPath(); c.arc(-r * 0.32, -r * 0.38, r * 0.18, 0, TAU);
        p.s(steel, p.lw * 0.8);
        break;
      }
      case 'toxin_mine': {
        const green = col || '#8BD450', dark = '#1F2822', yellow = '#FFD43B';
        polyN(c, 0, 0, r * 0.75, 6, 0);
        p.fs(dark);
        c.beginPath(); c.arc(0, 0, r * 0.38, 0, TAU);
        p.fs(green);
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * TAU - Math.PI / 2;
          c.beginPath(); c.arc(Math.cos(a) * r * 0.56, Math.sin(a) * r * 0.56, r * 0.12, 0, TAU);
          p.fs(yellow);
        }
        c.beginPath(); c.arc(0, 0, r * 0.12, 0, TAU);
        p.f('#FF3D00');
        break;
      }
      case 'arc_coil': {
        const copper = col || '#D9693A', silver = '#F2EFE6', spark = '#FFD43B';
        c.beginPath(); c.moveTo(-r * 0.7, r * 0.62); c.lineTo(r * 0.32, -r * 0.38);
        p.s('#3C4B40', p.lw * 1.5);
        c.beginPath();
        c.rect(-r * 0.12, 0.06, r * 0.38, r * 0.18);
        c.rect(0.06, -r * 0.12, r * 0.38, r * 0.18);
        c.rect(r * 0.25, -r * 0.32, r * 0.38, r * 0.18);
        p.fs(copper);
        c.beginPath(); c.arc(r * 0.5, -r * 0.55, r * 0.32, 0, TAU);
        p.fs(silver);
        c.beginPath();
        c.moveTo(r * 0.5, -r * 0.88); c.lineTo(r * 0.62, -r * 1.05); c.lineTo(r * 0.5, -r * 1.2);
        c.moveTo(r * 0.82, -r * 0.55); c.lineTo(r * 1.0, -r * 0.7); c.lineTo(r * 1.15, -r * 0.55);
        p.s(spark, p.lw * 1.1);
        break;
      }
      case 'tempest_coil': {
        const gem = col || '#FFFFFF', copper = '#D9693A', purple = '#A25CE0', yellow = '#FFD43B';
        c.beginPath(); c.rect(-r * 0.32, 0, r * 0.65, r * 0.7);
        p.fs(copper);
        c.beginPath();
        c.moveTo(-r * 0.45, r * 0.12); c.quadraticCurveTo(-r * 0.7, -r * 0.32, -r * 0.38, -r * 0.7);
        c.lineTo(-r * 0.25, -r * 0.62); c.quadraticCurveTo(-r * 0.5, -r * 0.25, -r * 0.25, r * 0.12);
        ctxClose(c);
        p.fs(copper);
        c.beginPath();
        c.moveTo(r * 0.45, r * 0.12); c.quadraticCurveTo(r * 0.7, -r * 0.32, r * 0.38, -r * 0.7);
        c.lineTo(r * 0.25, -r * 0.62); c.quadraticCurveTo(r * 0.5, -r * 0.25, r * 0.25, r * 0.12);
        ctxClose(c);
        p.fs(copper);
        polyN(c, 0, -r * 0.38, r * 0.38, 4, 0);
        p.fs(gem);
        c.beginPath();
        c.moveTo(0, -r * 0.75); c.lineTo(-r * 0.12, -r * 0.95); c.lineTo(0.06, -r * 1.08);
        p.s(yellow, p.lw * 1.2);
        c.beginPath(); c.moveTo(-r * 0.06, 0); c.lineTo(0.06, r * 0.25);
        p.s(purple, p.lw * 1.2);
        break;
      }
      case 'frost_aura': {
        const ice = col || '#7FD3F0', light = '#CFEFFA', dark = '#27384F';
        starN(c, 0, 0, r * 0.88, 6, 0.45, 0);
        p.fs(dark);
        c.beginPath(); c.arc(0, 0, r * 0.45, 0, TAU);
        p.fs(ice);
        polyN(c, 0, 0, r * 0.25, 4, 0);
        p.fs(light);
        break;
      }
      case 'toxic_cloud': {
        const green = col || '#8BD450', brass = '#C9A24B', dark = '#1F2822';
        c.beginPath();
        c.moveTo(-r * 0.2, -r * 0.32); c.lineTo(r * 0.2, -r * 0.32);
        c.lineTo(r * 0.45, r * 0.2); c.arc(0, r * 0.38, r * 0.45, 0, Math.PI); c.lineTo(-r * 0.45, r * 0.2);
        ctxClose(c);
        p.fs(dark);
        c.beginPath(); c.arc(0, r * 0.32, r * 0.35, 0, Math.PI); ctxClose(c);
        p.fs(green);
        c.beginPath(); c.rect(-r * 0.25, -r * 0.58, r * 0.5, r * 0.26);
        p.fs(brass);
        c.beginPath();
        c.arc(-r * 0.12, -r * 0.75, r * 0.15, 0, TAU);
        c.arc(r * 0.2, -r * 0.88, r * 0.12, 0, TAU);
        p.f(green);
        break;
      }
      case 'seeker': {
        const purple = col || '#A25CE0', dark = '#1B1229', eye = '#E86AA6', light = '#CFEFFA';
        c.beginPath(); c.ellipse(0, 0, r * 0.88, r * 0.38, Math.PI / 4, 0, TAU);
        p.s(purple, p.lw * 1.3);
        c.beginPath(); c.arc(0, 0, r * 0.5, 0, TAU);
        p.fs(dark);
        c.beginPath(); c.arc(r * 0.06, 0, r * 0.28, 0, TAU);
        p.f(eye);
        c.beginPath(); c.ellipse(r * 0.12, 0, r * 0.08, r * 0.22, 0, 0, TAU);
        p.f(dark);
        c.beginPath(); c.arc(0, -r * 0.12, r * 0.08, 0, TAU);
        p.f(light);
        break;
      }
      // ---- evolutions of the remaining weapons (17): each its own silhouette, flat fills, ink outline ----
      case 'dragonfire': {
        const fl = col || '#FF4A1C', dk = '#3A1A12', gold = '#FFD43B';
        c.beginPath(); c.rect(-r * 0.72, -r * 0.26, r * 0.95, r * 0.52); p.fs(dk);
        c.beginPath(); c.moveTo(r * 0.18, -r * 0.52); c.lineTo(r * 0.72, -r * 0.4); c.lineTo(r * 0.98, -r * 0.1); c.lineTo(r * 0.72, r * 0.4); c.lineTo(r * 0.18, r * 0.52); ctxClose(c); p.fs(fl);
        starN(c, r * 0.98, 0, r * 0.3, 4, 0.45, 0); p.fs(gold);
        c.beginPath(); c.arc(-r * 0.4, 0, r * 0.14, 0, TAU); p.fs(gold);
        c.beginPath(); c.moveTo(r * 0.32, -r * 0.2); c.lineTo(r * 0.6, 0); c.lineTo(r * 0.32, r * 0.2); p.s(dk, p.lw * 0.9);
        break;
      }
      case 'blizzard_fan': {
        const ice = col || '#D9F4FF', mid = '#7FD3F0', dk = '#27384F';
        starN(c, 0, 0, r * 0.98, 8, 0.4, 0); p.fs(ice);
        starN(c, 0, 0, r * 0.58, 8, 0.45, Math.PI / 8); p.fs(mid);
        c.beginPath(); c.arc(0, 0, r * 0.2, 0, TAU); p.fs(dk);
        break;
      }
      case 'prism_lance': {
        const pr = col || '#F0A6FF';
        c.beginPath(); c.rect(-r * 0.88, -r * 0.17, r * 0.62, r * 0.34); p.fs('#3C4B40');
        c.beginPath(); c.moveTo(-r * 0.28, -r * 0.52); c.lineTo(r * 0.2, 0); c.lineTo(-r * 0.28, r * 0.52); ctxClose(c); p.fs(pr);
        c.beginPath(); c.moveTo(r * 0.2, 0); c.lineTo(r * 1.0, -r * 0.42); p.s('#7FD3F0', p.lw * 1.3);
        c.beginPath(); c.moveTo(r * 0.2, 0); c.lineTo(r * 1.06, 0); p.s('#FFD43B', p.lw * 1.3);
        c.beginPath(); c.moveTo(r * 0.2, 0); c.lineTo(r * 1.0, r * 0.42); p.s('#E86AA6', p.lw * 1.3);
        break;
      }
      case 'singularity_maul': {
        const pur = col || '#7B3FD0';
        c.beginPath(); c.moveTo(-r * 0.85, r * 0.8); c.lineTo(r * 0.12, -r * 0.14); p.s('#8C4A3B', p.lw * 2.4);
        c.beginPath(); c.arc(r * 0.3, -r * 0.3, r * 0.58, 0, TAU); p.fs('#1B1229');
        c.beginPath(); c.arc(r * 0.3, -r * 0.3, r * 0.4, 0, TAU); p.s(pur, p.lw * 1.5);
        c.beginPath(); c.arc(r * 0.3, -r * 0.3, r * 0.2, 0, TAU); p.s('#E86AA6', p.lw);
        c.beginPath(); c.arc(r * 0.3, -r * 0.3, r * 0.08, 0, TAU); p.f('#F1E0FF');
        break;
      }
      case 'bloodsaw': {
        const red = col || '#E5484D';
        starN(c, -r * 0.2, r * 0.12, r * 0.74, 10, 0.78, 0); p.fs(red);
        c.beginPath(); c.arc(-r * 0.2, r * 0.12, r * 0.26, 0, TAU); p.fs('#14121F');
        starN(c, r * 0.36, -r * 0.3, r * 0.5, 9, 0.76, 0.2); p.fs('#B0262C');
        c.beginPath(); c.arc(r * 0.36, -r * 0.3, r * 0.14, 0, TAU); p.fs('#F2EFE6');
        c.beginPath(); c.moveTo(-r * 0.2, r * 0.5); c.lineTo(-r * 0.2, r * 0.82); p.s('#E5484D', p.lw * 1.3);
        break;
      }
      case 'carpet_bomb': {
        const org = col || '#FF9F1C';
        for (let i = 0; i < 3; i++) {
          const x = -r * 0.6 + i * r * 0.6;
          c.beginPath(); c.ellipse(x, 0, r * 0.28, r * 0.46, 0, 0, TAU); p.fs(i === 1 ? '#FFD43B' : org);
          c.beginPath(); c.moveTo(x - r * 0.18, -r * 0.5); c.lineTo(x, -r * 0.3); c.lineTo(x + r * 0.18, -r * 0.5); p.s('#3C4B40', p.lw * 1.1);
          c.beginPath(); c.rect(x - r * 0.1, r * 0.32, r * 0.2, r * 0.22); p.fs('#3C4B40');
        }
        break;
      }
      case 'plague_mine': {
        const g = col || '#B6F23A';
        starN(c, 0, 0, r * 0.96, 8, 0.62, 0); p.fs('#3C4B40');
        c.beginPath(); c.arc(0, 0, r * 0.52, 0, TAU); p.fs(g);
        c.beginPath(); c.arc(-r * 0.16, -r * 0.08, r * 0.1, 0, TAU); c.arc(r * 0.16, -r * 0.08, r * 0.1, 0, TAU); p.f('#14121F');
        c.beginPath(); c.rect(-r * 0.14, r * 0.14, r * 0.28, r * 0.14); p.f('#14121F');
        break;
      }
      case 'absolute_zero': {
        const ice = col || '#EAF8FF';
        starN(c, 0, 0, r * 0.98, 6, 0.3, 0); p.fs(ice);
        starN(c, 0, 0, r * 0.55, 6, 0.55, Math.PI / 6); p.fs('#7FD3F0');
        c.beginPath(); c.arc(0, 0, r * 0.2, 0, TAU); p.fs('#27384F');
        break;
      }
      case 'miasma': {
        const g = col || '#4DCB7B';
        c.beginPath(); c.arc(-r * 0.4, r * 0.14, r * 0.42, 0, TAU); c.arc(r * 0.04, -r * 0.18, r * 0.5, 0, TAU); c.arc(r * 0.46, r * 0.14, r * 0.4, 0, TAU); p.fs(g);
        c.beginPath(); c.arc(-r * 0.16, -r * 0.14, r * 0.09, 0, TAU); c.arc(r * 0.24, -r * 0.14, r * 0.09, 0, TAU); p.f('#14121F');
        c.beginPath(); c.moveTo(-r * 0.12, r * 0.1); c.lineTo(0.01, r * 0.2); c.lineTo(r * 0.2, r * 0.1); p.s('#14121F', p.lw * 0.9);
        c.beginPath(); c.arc(r * 0.6, -r * 0.62, r * 0.1, 0, TAU); p.f('#CDEFA0');
        break;
      }
      case 'wraith_seeker': {
        const pu = col || '#D9A8FF';
        c.beginPath(); c.arc(0, -r * 0.1, r * 0.56, Math.PI, 0); c.lineTo(r * 0.56, r * 0.66); c.lineTo(r * 0.28, r * 0.44); c.lineTo(0, r * 0.66); c.lineTo(-r * 0.28, r * 0.44); c.lineTo(-r * 0.56, r * 0.66); ctxClose(c); p.fs(pu);
        c.beginPath(); c.arc(-r * 0.2, -r * 0.14, r * 0.12, 0, TAU); c.arc(r * 0.2, -r * 0.14, r * 0.12, 0, TAU); p.f('#1B1229');
        c.beginPath(); c.arc(-r * 0.2, -r * 0.14, r * 0.05, 0, TAU); c.arc(r * 0.2, -r * 0.14, r * 0.05, 0, TAU); p.f('#E86AA6');
        break;
      }
      case 'bullet_hose': {
        const br = col || '#FFE066';
        c.beginPath(); c.rect(-r * 0.7, -r * 0.34, r * 0.5, r * 0.68); p.fs('#3C4B40');
        c.beginPath(); c.rect(-r * 0.2, -r * 0.46, r * 0.95, r * 0.2); c.rect(-r * 0.2, -r * 0.1, r * 1.0, r * 0.2); c.rect(-r * 0.2, r * 0.26, r * 0.95, r * 0.2); p.fs('#8C86A0');
        c.beginPath(); c.arc(-r * 0.46, r * 0.5, r * 0.3, 0, TAU); p.fs(br);
        c.beginPath(); c.moveTo(-r * 0.46, r * 0.5); c.lineTo(-r * 0.46, r * 0.8); p.s(br, p.lw * 1.2);
        c.beginPath(); c.rect(r * 0.7, -r * 0.5, r * 0.14, r * 1.0); p.fs('#14121F');
        break;
      }
      case 'hydra_bow': {
        const g = col || '#4BE06A';
        c.beginPath(); c.arc(-r * 0.35, 0, r * 0.85, -1.15, 1.15); p.s('#8C4A3B', p.lw * 2.2);
        for (let i = -1; i <= 1; i++) {
          c.beginPath(); c.moveTo(-r * 0.2, i * r * 0.24); c.lineTo(r * 0.55, i * r * 0.34); p.s('#F2EFE6', p.lw);
          c.beginPath(); c.moveTo(r * 0.55, i * r * 0.34 - r * 0.15); c.lineTo(r * 0.95, i * r * 0.4); c.lineTo(r * 0.55, i * r * 0.34 + r * 0.15); ctxClose(c); p.fs(g);
        }
        break;
      }
      case 'glacial_seeker': {
        const ic = col || '#CFF3FF';
        c.beginPath(); c.moveTo(0, -r * 0.82); c.lineTo(r * 0.42, 0); c.lineTo(0, r * 0.82); c.lineTo(-r * 0.42, 0); ctxClose(c); p.fs(ic);
        for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + Math.PI / 4; c.beginPath(); c.moveTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5); c.lineTo(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92); p.s('#7FD3F0', p.lw * 1.5); }
        c.beginPath(); c.arc(0, 0, r * 0.18, 0, TAU); p.fs('#27384F');
        break;
      }
      case 'thunder_ring': {
        const y = col || '#FFF27A';
        c.beginPath(); c.arc(0, 0, r * 0.72, 0, TAU); p.s('#14121F', p.lw * 3.2); c.beginPath(); c.arc(0, 0, r * 0.72, 0, TAU); p.s(y, p.lw * 1.8);
        for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + Math.PI / 4; starN(c, Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72, r * 0.3, 4, 0.4, a); p.fs('#FFFFFF'); }
        c.beginPath(); c.moveTo(r * 0.12, -r * 0.34); c.lineTo(-r * 0.2, 0); c.lineTo(r * 0.04, 0); c.lineTo(-r * 0.12, r * 0.34); p.s('#FFD43B', p.lw * 1.3);
        break;
      }
      case 'rail_reflector': {
        const cy = col || '#9AF0FF';
        c.beginPath(); c.rect(-r * 0.9, -r * 0.2, r * 1.2, r * 0.4); p.fs('#3C4B40');
        c.beginPath(); c.rect(-r * 0.5, -r * 0.1, r * 0.8, r * 0.2); p.fs(cy);
        c.beginPath(); c.moveTo(r * 0.3, -r * 0.5); c.lineTo(r * 0.62, -r * 0.2); c.lineTo(r * 0.62, r * 0.2); c.lineTo(r * 0.3, r * 0.5); ctxClose(c); p.fs('#8C86A0');
        c.beginPath(); c.moveTo(r * 0.62, 0); c.lineTo(r * 1.0, -r * 0.5); c.lineTo(r * 0.82, -r * 0.1); p.s(cy, p.lw * 1.3);
        break;
      }
      case 'skyhammer': {
        const y = col || '#FFE14D';
        c.beginPath(); c.moveTo(-r * 0.85, r * 0.8); c.lineTo(r * 0.1, -r * 0.1); p.s('#8C4A3B', p.lw * 2.4);
        c.beginPath(); c.rect(-r * 0.12, -r * 0.82, r * 0.9, r * 0.56); p.fs('#3C4B40');
        starN(c, r * 0.33, -r * 0.54, r * 0.34, 4, 0.4, Math.PI / 4); p.fs(y);
        c.beginPath(); c.moveTo(r * 0.7, -r * 0.2); c.lineTo(r * 0.5, r * 0.18); c.lineTo(r * 0.66, r * 0.18); c.lineTo(r * 0.46, r * 0.6); p.s(y, p.lw * 1.3);
        break;
      }
      case 'phoenix_staff': {
        const o = col || '#FFB300';
        c.beginPath(); c.moveTo(-r * 0.85, r * 0.85); c.lineTo(r * 0.12, -r * 0.1); p.s('#8C4A3B', p.lw * 2.2);
        c.beginPath(); c.moveTo(0, -r * 0.1); c.lineTo(-r * 0.46, -r * 0.5); c.lineTo(-r * 0.2, -r * 0.7); c.lineTo(r * 0.1, -r * 0.45); c.lineTo(r * 0.5, -r * 0.9); c.lineTo(r * 0.6, -r * 0.5); c.lineTo(r * 0.98, -r * 0.7); c.lineTo(r * 0.5, -r * 0.1); ctxClose(c); p.fs(o);
        c.beginPath(); c.arc(r * 0.2, -r * 0.3, r * 0.2, 0, TAU); p.fs('#FFF3A3');
        c.beginPath(); c.moveTo(r * 0.5, -r * 0.1); c.lineTo(r * 0.7, r * 0.2); c.lineTo(r * 0.3, 0); p.fs('#E8431A');
        break;
      }
      default: {
        c.beginPath(); c.arc(0, 0, r * 0.65, 0, TAU);
        p.fs(col || '#8C86A0');
        break;
      }
    }
  }

  // Developer 2's procedural vector renderers for all 30 items & 6 pickups
  // (Integrated cleanly with zero banned calls, hard drop shadows, and silhouette support)
  function renderItemIllustration(ctx, id, r, isShadow, opts) {
    const p = makePainter(ctx, r, isShadow, opts);

    switch (id) {
      case 'rubber_boots': {
        ctx.beginPath();
        ctx.moveTo(-r * 0.45, -r * 0.65); ctx.lineTo(-r * 0.05, -r * 0.65); ctx.lineTo(-r * 0.05, 0);
        ctx.quadraticCurveTo(r * 0.2, r * 0.15, r * 0.65, r * 0.35);
        ctx.quadraticCurveTo(r * 0.8, r * 0.48, r * 0.75, r * 0.62);
        ctx.lineTo(-r * 0.65, r * 0.62); ctx.lineTo(-r * 0.65, -r * 0.45);
        ctx.quadraticCurveTo(-r * 0.55, -r * 0.1, -r * 0.45, -r * 0.65);
        ctxClose(ctx);
        p.fs('#F5B82E');
        ctx.beginPath(); ctx.rect(-r * 0.68, r * 0.62, r * 1.45, r * 0.2);
        p.fs('#1F2822');
        ctx.beginPath();
        ctx.rect(-r * 0.65, r * 0.78, r * 0.25, r * 0.1);
        ctx.rect(-r * 0.2, r * 0.78, r * 0.18, r * 0.08);
        ctx.rect(r * 0.1, r * 0.78, r * 0.18, r * 0.08);
        ctx.rect(r * 0.4, r * 0.78, r * 0.22, r * 0.08);
        p.f('#14121F');
        ctx.beginPath(); ctx.rect(-r * 0.5, -r * 0.75, r * 0.5, r * 0.14);
        p.fs('#D99B26');
        ctx.beginPath(); ctx.arc(r * 0.55, r * 0.48, r * 0.15, 0, Math.PI * 2);
        p.f('#FFF085');
        break;
      }
      case 'lucky_coin': {
        ctx.beginPath(); ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
        p.fs('#E5A922');
        ctx.beginPath(); ctx.arc(0, 0, r * 0.68, 0, Math.PI * 2);
        p.fs('#FFD43B');
        const leafDist = r * 0.26, leafR = r * 0.22;
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          ctx.beginPath(); ctx.arc(Math.cos(a) * leafDist, Math.sin(a) * leafDist, leafR, 0, Math.PI * 2);
          p.fs('#5FB49C', '#14121F', Math.max(1, p.lw * 0.7));
        }
        ctx.beginPath(); ctx.arc(0, 0, r * 0.1, 0, Math.PI * 2);
        p.f('#3E8C77');
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(r * 0.2, r * 0.35, r * 0.38, r * 0.52);
        p.s('#3E8C77', Math.max(1.5, p.lw * 0.8));
        ctx.beginPath(); ctx.arc(0, 0, r * 0.6, -2.4, -1.2);
        p.s('#FFFFFF', Math.max(1.5, p.lw * 0.8));
        break;
      }
      case 'thick_hide': {
        ctx.beginPath();
        ctx.moveTo(-r * 0.7, -r * 0.75); ctx.lineTo(-r * 0.25, -r * 0.75); ctx.lineTo(0, -r * 0.2);
        ctx.lineTo(r * 0.25, -r * 0.75); ctx.lineTo(r * 0.7, -r * 0.75); ctx.lineTo(r * 0.5, -r * 0.1);
        ctx.lineTo(r * 0.65, r * 0.75); ctx.lineTo(-r * 0.65, r * 0.75); ctx.lineTo(-r * 0.5, -r * 0.1);
        ctxClose(ctx);
        p.fs('#8C4A28');
        ctx.beginPath(); ctx.rect(-r * 0.55, r * 0.6, r * 1.1, r * 0.12);
        p.f('#6E381A');
        for (let i = 0; i < 3; i++) {
          const y = -r * 0.05 + i * (r * 0.24);
          ctx.beginPath();
          ctx.moveTo(-r * 0.16, y - r * 0.08); ctx.lineTo(r * 0.16, y + r * 0.08);
          ctx.moveTo(r * 0.16, y - r * 0.08); ctx.lineTo(-r * 0.16, y + r * 0.08);
          p.s('#F2EFE6', Math.max(1.2, p.lw * 0.75));
        }
        const rivets = [[-r * 0.52, -r * 0.6], [r * 0.52, -r * 0.6], [-r * 0.52, r * 0.6], [r * 0.52, r * 0.6]];
        for (let i = 0; i < rivets.length; i++) {
          ctx.beginPath(); ctx.arc(rivets[i][0], rivets[i][1], r * 0.08, 0, Math.PI * 2);
          p.fs('#FFD43B', '#14121F', 1);
        }
        break;
      }
      case 'sharp_edge': {
        ctx.beginPath(); ctx.rect(-r * 0.6, r * 0.35, r * 0.3, r * 0.18);
        p.fs('#2A1E3F');
        ctx.beginPath(); ctx.arc(-r * 0.62, r * 0.44, r * 0.12, 0, Math.PI * 2);
        p.fs('#FFD43B');
        ctx.beginPath(); ctx.ellipse(-r * 0.22, r * 0.22, r * 0.3, r * 0.09, -Math.PI / 4, 0, Math.PI * 2);
        p.fs('#3C4B40');
        ctx.beginPath();
        ctx.moveTo(-r * 0.12, r * 0.12); ctx.lineTo(r * 0.75, -r * 0.75);
        ctx.lineTo(r * 0.55, -r * 0.35); ctx.lineTo(r * 0.48, -r * 0.42); ctx.lineTo(r * 0.38, -r * 0.22);
        ctx.lineTo(r * 0.32, -r * 0.28); ctx.lineTo(r * 0.22, -r * 0.08); ctx.lineTo(r * 0.15, -r * 0.15); ctx.lineTo(0.05, 0.05);
        ctxClose(ctx);
        p.fs('#D8E2EC');
        ctx.beginPath(); ctx.moveTo(-r * 0.05, 0.05); ctx.lineTo(r * 0.5, -r * 0.5);
        p.s('#8C9AA8', Math.max(1, p.lw * 0.7));
        for (let i = 0; i < 3; i++) {
          const d = -r * 0.52 + i * (r * 0.12);
          ctx.beginPath(); ctx.arc(d, -d + r * 0.1, r * 0.06, 0, Math.PI * 2);
          p.f('#FFD43B');
        }
        break;
      }
      case 'quick_fingers': {
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, r * 0.7); ctx.lineTo(r * 0.5, r * 0.7); ctx.lineTo(r * 0.55, 0);
        ctx.lineTo(r * 0.45, -r * 0.5); ctx.lineTo(r * 0.25, -r * 0.5); ctx.lineTo(r * 0.22, -r * 0.75);
        ctx.lineTo(0, -r * 0.75); ctx.lineTo(-r * 0.05, -r * 0.7); ctx.lineTo(-r * 0.25, -r * 0.4);
        ctx.lineTo(-r * 0.65, -r * 0.05); ctx.lineTo(-r * 0.45, r * 0.25);
        ctxClose(ctx);
        p.fs('#2E3A32');
        ctx.beginPath(); ctx.rect(-r * 0.35, -r * 0.2, r * 0.8, r * 0.22);
        p.fs('#3C4B40');
        for (let i = 0; i < 4; i++) {
          const x = -r * 0.25 + i * (r * 0.22);
          ctx.beginPath(); ctx.arc(x, -r * 0.09, r * 0.07, 0, Math.PI * 2);
          p.fs('#CFEFFA', '#14121F', 1);
        }
        ctx.beginPath(); ctx.rect(-r * 0.45, r * 0.45, r * 0.9, r * 0.16);
        p.fs('#1F2822');
        ctx.beginPath(); ctx.rect(-r * 0.15, r * 0.42, r * 0.3, r * 0.22);
        p.fs('#FFD43B');
        break;
      }
      case 'magnet_ring': {
        ctx.beginPath(); ctx.ellipse(0, r * 0.25, r * 0.65, r * 0.55, 0, 0, Math.PI * 2);
        p.fs('#A8A6B8');
        ctx.beginPath(); ctx.ellipse(0, r * 0.25, r * 0.42, r * 0.32, 0, 0, Math.PI * 2);
        p.f('#14121F');
        ctx.beginPath(); ctx.ellipse(0, -r * 0.35, r * 0.68, r * 0.42, 0, 0, Math.PI * 2);
        p.fs('#2A1E3F');
        ctx.beginPath();
        ctx.arc(-r * 0.2, -r * 0.35, r * 0.22, Math.PI, 0, false);
        ctx.lineTo(-r * 0.08, -r * 0.15); ctx.lineTo(-r * 0.28, -r * 0.15);
        ctxClose(ctx);
        p.fs('#E5484D', null);
        ctx.beginPath();
        ctx.arc(r * 0.2, -r * 0.35, r * 0.22, Math.PI, 0, false);
        ctx.lineTo(r * 0.28, -r * 0.15); ctx.lineTo(r * 0.08, -r * 0.15);
        ctxClose(ctx);
        p.fs('#5FA8D3', null);
        ctx.beginPath(); ctx.rect(-r * 0.2, -r * 0.57, r * 0.4, r * 0.12);
        p.f('#E5484D');
        ctx.beginPath();
        ctx.rect(-r * 0.28, -r * 0.18, r * 0.18, r * 0.08);
        ctx.rect(r * 0.1, -r * 0.18, r * 0.18, r * 0.08);
        p.fs('#F2EFE6', '#14121F', 1);
        break;
      }
      case 'iron_plating': {
        const s = r * 0.72, c = r * 0.18;
        ctx.beginPath();
        ctx.moveTo(-s + c, -s); ctx.lineTo(s - c, -s); ctx.lineTo(s, -s + c); ctx.lineTo(s, s - c);
        ctx.lineTo(s - c, s); ctx.lineTo(-s + c, s); ctx.lineTo(-s, s - c); ctx.lineTo(-s, -s + c);
        ctxClose(ctx);
        p.fs('#5A6577');
        ctx.beginPath();
        ctx.moveTo(-s + c, -s + c); ctx.lineTo(s - c, s - c);
        ctx.moveTo(s - c, -s + c); ctx.lineTo(-s + c, s - c);
        p.s('#3D4756', Math.max(2, p.lw * 1.4));
        ctx.beginPath(); ctx.rect(-r * 0.22, -r * 0.22, r * 0.44, r * 0.44);
        p.fs('#8A96A8');
        const b = r * 0.48;
        const bolts = [[-b, -b], [b, -b], [-b, b], [b, b]];
        for (let i = 0; i < 4; i++) {
          ctx.beginPath(); ctx.arc(bolts[i][0], bolts[i][1], r * 0.09, 0, Math.PI * 2);
          p.fs('#CFEFFA', '#14121F', 1);
        }
        break;
      }
      case 'scope_lens': {
        ctx.beginPath(); ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
        p.fs('#C9A24B');
        ctx.beginPath();
        ctx.rect(-r * 0.18, -r * 0.98, r * 0.36, r * 0.2);
        ctx.rect(r * 0.78, -r * 0.18, r * 0.2, r * 0.36);
        p.fs('#8C6A28');
        ctx.beginPath(); ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2);
        p.fs('#7FD3F0');
        ctx.beginPath();
        ctx.moveTo(-r * 0.65, 0); ctx.lineTo(r * 0.65, 0);
        ctx.moveTo(0, -r * 0.65); ctx.lineTo(0, r * 0.65);
        p.s('#14121F', Math.max(1.2, p.lw * 0.75));
        ctx.beginPath(); ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2);
        p.s('#14121F', Math.max(1, p.lw * 0.6));
        ctx.beginPath(); ctx.arc(0, 0, r * 0.52, -2.5, -1.2);
        p.s('#FFFFFF', Math.max(1.8, p.lw * 0.9));
        break;
      }
      case 'heart_locket': {
        ctx.beginPath(); ctx.arc(0, -r * 0.78, r * 0.14, 0, Math.PI * 2);
        p.fs('#FFD43B');
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.35);
        ctx.bezierCurveTo(-r * 0.45, -r * 0.85, -r * 0.9, -r * 0.2, -r * 0.75, r * 0.15);
        ctx.bezierCurveTo(-r * 0.65, r * 0.45, -r * 0.3, r * 0.68, 0, r * 0.85);
        ctx.bezierCurveTo(r * 0.3, r * 0.68, r * 0.65, r * 0.45, r * 0.75, r * 0.15);
        ctx.bezierCurveTo(r * 0.9, -r * 0.2, r * 0.45, -r * 0.85, 0, -r * 0.35);
        ctxClose(ctx);
        p.fs('#FFD43B');
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.15); ctx.lineTo(-r * 0.35, 0); ctx.lineTo(0, r * 0.55); ctx.lineTo(r * 0.35, 0);
        ctxClose(ctx);
        p.fs('#E5484D');
        ctx.beginPath(); ctx.moveTo(0, -r * 0.15); ctx.lineTo(0, r * 0.55);
        p.s('#FFF085', Math.max(1, p.lw * 0.6));
        ctx.beginPath(); ctx.moveTo(-r * 0.35, 0); ctx.lineTo(r * 0.35, 0);
        p.s('#8C2030', Math.max(1, p.lw * 0.6));
        break;
      }
      case 'spring_heel': {
        ctx.beginPath(); ctx.rect(-r * 0.55, -r * 0.75, r * 1.1, r * 0.22);
        p.fs('#3C4B40');
        ctx.beginPath();
        ctx.arc(-r * 0.35, -r * 0.64, r * 0.07, 0, Math.PI * 2);
        ctx.arc(r * 0.35, -r * 0.64, r * 0.07, 0, Math.PI * 2);
        p.fs('#FFD43B', '#14121F', 1);
        ctx.beginPath(); ctx.rect(-r * 0.08, -r * 0.55, r * 0.16, r * 1.05);
        p.fs('#1F2822');
        for (let i = 0; i < 4; i++) {
          const y = -r * 0.45 + i * (r * 0.24);
          ctx.beginPath(); ctx.ellipse(0, y, r * 0.45, r * 0.12, -0.2, 0, Math.PI * 2);
          p.fs('#CFEFFA', '#14121F', Math.max(1.5, p.lw));
        }
        ctx.beginPath(); ctx.rect(-r * 0.65, r * 0.55, r * 1.3, r * 0.22);
        p.fs('#1F2822');
        for (let i = 0; i < 4; i++) {
          const x = -r * 0.5 + i * (r * 0.32);
          ctx.beginPath(); ctx.rect(x, r * 0.77, r * 0.16, r * 0.08);
          p.f('#14121F');
        }
        break;
      }
      case 'vampire_fang': {
        ctx.beginPath(); ctx.rect(-r * 0.7, -r * 0.72, r * 1.4, r * 0.24);
        p.fs('#C95B73');
        ctx.beginPath();
        ctx.rect(-r * 0.16, -r * 0.48, r * 0.14, r * 0.28);
        ctx.rect(r * 0.02, -r * 0.48, r * 0.14, r * 0.28);
        p.fs('#F2EFE6');
        ctx.beginPath();
        ctx.moveTo(-r * 0.55, -r * 0.48); ctx.lineTo(-r * 0.22, -r * 0.48);
        ctx.quadraticCurveTo(-r * 0.24, 0, -r * 0.4, r * 0.45);
        ctx.quadraticCurveTo(-r * 0.52, 0, -r * 0.55, -r * 0.48);
        ctxClose(ctx);
        p.fs('#F2EFE6');
        ctx.beginPath();
        ctx.moveTo(r * 0.22, -r * 0.48); ctx.lineTo(r * 0.55, -r * 0.48);
        ctx.quadraticCurveTo(r * 0.52, 0, r * 0.38, r * 0.45);
        ctx.quadraticCurveTo(r * 0.24, 0, r * 0.22, -r * 0.48);
        ctxClose(ctx);
        p.fs('#F2EFE6');
        ctx.beginPath();
        ctx.moveTo(r * 0.38, r * 0.52);
        ctx.bezierCurveTo(r * 0.22, r * 0.7, r * 0.25, r * 0.88, r * 0.38, r * 0.88);
        ctx.bezierCurveTo(r * 0.51, r * 0.88, r * 0.54, r * 0.7, r * 0.38, r * 0.52);
        ctxClose(ctx);
        p.fs('#E5484D');
        ctx.beginPath(); ctx.arc(r * 0.34, r * 0.76, r * 0.05, 0, Math.PI * 2);
        p.f('#FFFFFF');
        break;
      }
      case 'ember_charm': {
        for (let i = 0; i < 2; i++) {
          const y = -r * 0.82 + i * (r * 0.22);
          ctx.beginPath(); ctx.ellipse(0, y, r * 0.1, r * 0.15, 0, 0, Math.PI * 2);
          p.fs('#8C86A0', '#14121F', 1);
        }
        ctx.beginPath();
        ctx.moveTo(-r * 0.35, -r * 0.45); ctx.lineTo(r * 0.45, -r * 0.4); ctx.lineTo(r * 0.72, 0.05);
        ctx.lineTo(r * 0.4, r * 0.65); ctx.lineTo(-r * 0.35, r * 0.72); ctx.lineTo(-r * 0.65, 0.15);
        ctxClose(ctx);
        p.fs('#FF7A2F');
        ctx.beginPath();
        ctx.moveTo(-r * 0.2, -r * 0.3); ctx.lineTo(r * 0.1, -r * 0.05); ctx.lineTo(-r * 0.15, r * 0.35); ctx.lineTo(r * 0.25, r * 0.5);
        ctx.moveTo(r * 0.1, -r * 0.05); ctx.lineTo(r * 0.5, 0.05);
        p.s('#FFD43B', Math.max(2, p.lw * 1.1));
        ctx.beginPath();
        ctx.moveTo(-r * 0.4, -r * 0.55); ctx.lineTo(-r * 0.55, 0.1); ctx.lineTo(-r * 0.25, r * 0.7);
        ctx.moveTo(r * 0.4, -r * 0.55); ctx.lineTo(r * 0.6, 0.05); ctx.lineTo(r * 0.25, r * 0.7);
        p.s('#2A1E3F', Math.max(2, p.lw * 1.3));
        const sparks = [[-r * 0.6, -r * 0.5], [r * 0.65, -r * 0.3], [0, r * 0.85]];
        for (let i = 0; i < 3; i++) {
          const sx = sparks[i][0], sy = sparks[i][1], sr = r * 0.08;
          ctx.beginPath();
          ctx.moveTo(sx, sy - sr); ctx.lineTo(sx + sr, sy); ctx.lineTo(sx, sy + sr); ctx.lineTo(sx - sr, sy);
          ctxClose(ctx);
          p.f('#FFD43B');
        }
        break;
      }
      case 'frost_charm': {
        ctx.beginPath(); ctx.arc(0, -r * 0.8, r * 0.12, 0, Math.PI * 2);
        p.fs('#CFEFFA', '#14121F', 1);
        const numArms = 6;
        for (let i = 0; i < numArms; i++) {
          const a = (i / numArms) * Math.PI * 2 - Math.PI / 2;
          const cos = Math.cos(a), sin = Math.sin(a);
          const armLen = r * 0.72;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(cos * armLen, sin * armLen);
          p.s('#7FD3F0', Math.max(2.5, p.lw * 1.3));
          ctx.beginPath(); ctx.arc(cos * armLen, sin * armLen, r * 0.08, 0, Math.PI * 2);
          p.fs('#CFEFFA', '#14121F', 1);
          const d = r * 0.42;
          const perpA = a + Math.PI / 2;
          const pCos = Math.cos(perpA) * r * 0.18, pSin = Math.sin(perpA) * r * 0.18;
          ctx.beginPath();
          ctx.moveTo(cos * d - pCos, sin * d - pSin);
          ctx.lineTo(cos * (d + r * 0.12), sin * (d + r * 0.12));
          ctx.lineTo(cos * d + pCos, sin * d + pSin);
          p.s('#7FD3F0', Math.max(1.5, p.lw * 0.8));
        }
        polyN(ctx, 0, 0, r * 0.24, 6, 0);
        p.fs('#CFEFFA');
        ctx.beginPath(); ctx.arc(0, 0, r * 0.1, 0, Math.PI * 2);
        p.f('#FFFFFF');
        break;
      }
      case 'static_charm': {
        ctx.beginPath(); ctx.arc(0, -r * 0.8, r * 0.12, 0, Math.PI * 2);
        p.fs('#C9A24B');
        ctx.beginPath(); ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
        p.fs('#8C6A28');
        ctx.beginPath(); ctx.arc(0, 0, r * 0.58, 0, Math.PI * 2);
        p.fs('#2A1E3F');
        ctx.beginPath();
        ctx.moveTo(r * 0.25, -r * 0.52); ctx.lineTo(-r * 0.2, -r * 0.05); ctx.lineTo(r * 0.05, -r * 0.05);
        ctx.lineTo(-r * 0.35, r * 0.55); ctx.lineTo(0, r * 0.12); ctx.lineTo(-r * 0.18, r * 0.12);
        ctxClose(ctx);
        p.fs('#FFD43B');
        const sparkNodes = [[-r * 0.35, -r * 0.3], [r * 0.35, r * 0.3]];
        for (let i = 0; i < sparkNodes.length; i++) {
          ctx.beginPath(); ctx.arc(sparkNodes[i][0], sparkNodes[i][1], r * 0.06, 0, Math.PI * 2);
          p.fs('#CFEFFA', '#14121F', 1);
        }
        break;
      }
      case 'venom_vial': {
        ctx.beginPath(); ctx.rect(-r * 0.22, -r * 0.85, r * 0.44, r * 0.2);
        p.fs('#8C5A32');
        ctx.beginPath(); ctx.rect(-r * 0.28, -r * 0.65, r * 0.56, r * 0.1);
        p.fs('#A8DAB5');
        ctx.beginPath();
        ctx.moveTo(-r * 0.18, -r * 0.55); ctx.lineTo(r * 0.18, -r * 0.55);
        ctx.quadraticCurveTo(r * 0.72, -r * 0.1, r * 0.65, r * 0.55);
        ctx.quadraticCurveTo(r * 0.5, r * 0.82, 0, r * 0.82);
        ctx.quadraticCurveTo(-r * 0.5, r * 0.82, -r * 0.65, r * 0.55);
        ctx.quadraticCurveTo(-r * 0.72, -r * 0.1, -r * 0.18, -r * 0.55);
        ctxClose(ctx);
        p.fs('#CFEFFA');
        ctx.beginPath();
        ctx.moveTo(-r * 0.58, r * 0.15); ctx.quadraticCurveTo(0, r * 0.05, r * 0.58, r * 0.15);
        ctx.quadraticCurveTo(r * 0.5, r * 0.78, 0, r * 0.78); ctx.quadraticCurveTo(-r * 0.5, r * 0.78, -r * 0.58, r * 0.15);
        ctxClose(ctx);
        p.fs('#8BD450');
        ctx.beginPath(); ctx.arc(0, r * 0.42, r * 0.16, 0, Math.PI * 2); ctx.rect(-r * 0.1, r * 0.48, r * 0.2, r * 0.12);
        p.f('#F2EFE6');
        ctx.beginPath(); ctx.arc(-r * 0.06, r * 0.42, r * 0.04, 0, Math.PI * 2); ctx.arc(r * 0.06, r * 0.42, r * 0.04, 0, Math.PI * 2);
        p.f('#14121F');
        ctx.beginPath(); ctx.arc(-r * 0.22, r * 0.26, r * 0.06, 0, Math.PI * 2); ctx.arc(r * 0.24, 0, r * 0.05, 0, Math.PI * 2);
        p.f('#FFF085');
        break;
      }
      case 'void_shard': {
        ctx.beginPath();
        ctx.moveTo(r * 0.1, -r * 0.88); ctx.lineTo(r * 0.6, -r * 0.15); ctx.lineTo(r * 0.45, r * 0.5);
        ctx.lineTo(-r * 0.1, r * 0.85); ctx.lineTo(-r * 0.65, r * 0.2); ctx.lineTo(-r * 0.5, -r * 0.35);
        ctxClose(ctx);
        p.fs('#2A1E3F');
        ctx.beginPath();
        ctx.moveTo(r * 0.1, -r * 0.88); ctx.lineTo(-r * 0.1, r * 0.85); ctx.lineTo(-r * 0.65, r * 0.2); ctx.lineTo(-r * 0.5, -r * 0.35);
        ctxClose(ctx);
        p.f('#1F1530');
        ctx.beginPath();
        ctx.moveTo(r * 0.1, -r * 0.88); ctx.lineTo(0.05, -r * 0.1); ctx.lineTo(-r * 0.1, r * 0.85);
        p.s('#E86AA6', Math.max(2.5, p.lw * 1.3));
        ctx.beginPath(); ctx.moveTo(-r * 0.6, -r * 0.6); ctx.lineTo(-r * 0.45, -r * 0.5); ctx.lineTo(-r * 0.65, -r * 0.4); ctxClose(ctx);
        p.fs('#A25CE0');
        ctx.beginPath(); ctx.moveTo(r * 0.65, r * 0.4); ctx.lineTo(r * 0.75, r * 0.55); ctx.lineTo(r * 0.55, r * 0.6); ctxClose(ctx);
        p.fs('#A25CE0');
        break;
      }
      case 'bounty_badge': {
        const pts = 6;
        ctx.beginPath();
        for (let i = 0; i < pts * 2; i++) {
          const a = (i / (pts * 2)) * Math.PI * 2 - Math.PI / 2;
          const rad = i % 2 === 0 ? r * 0.82 : r * 0.45;
          const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctxClose(ctx);
        p.fs('#FFD43B');
        for (let i = 0; i < pts; i++) {
          const a = (i / pts) * Math.PI * 2 - Math.PI / 2;
          ctx.beginPath(); ctx.arc(Math.cos(a) * (r * 0.82), Math.sin(a) * (r * 0.82), r * 0.08, 0, Math.PI * 2);
          p.fs('#C9A24B', '#14121F', 1);
        }
        ctx.beginPath(); ctx.arc(0, 0, r * 0.36, 0, Math.PI * 2);
        p.fs('#2A1E3F');
        ctx.beginPath(); ctx.arc(0, -r * 0.05, r * 0.15, 0, Math.PI * 2); ctx.rect(-r * 0.08, 0, r * 0.16, r * 0.12);
        p.f('#F2EFE6');
        ctx.beginPath(); ctx.arc(-r * 0.05, -r * 0.05, r * 0.035, 0, Math.PI * 2); ctx.arc(r * 0.05, -r * 0.05, r * 0.035, 0, Math.PI * 2);
        p.f('#14121F');
        break;
      }
      case 'cat_overclock': {
        ctx.beginPath(); ctx.rect(-r * 0.72, -r * 0.72, r * 1.44, r * 1.44);
        p.fs('#1F2822');
        const pinW = r * 0.1, pinL = r * 0.14;
        for (let i = -1.5; i <= 1.5; i++) {
          const off = i * (r * 0.32);
          ctx.beginPath();
          ctx.rect(off - pinW / 2, -r * 0.82, pinW, pinL);
          ctx.rect(off - pinW / 2, r * 0.68, pinW, pinL);
          ctx.rect(-r * 0.82, off - pinW / 2, pinL, pinW);
          ctx.rect(r * 0.68, off - pinW / 2, pinL, pinW);
          p.f('#FFD43B');
        }
        ctx.beginPath(); ctx.rect(-r * 0.46, -r * 0.46, r * 0.92, r * 0.92);
        p.fs('#3C4B40');
        ctx.beginPath(); ctx.arc(0, r * 0.1, r * 0.3, Math.PI, 0, false);
        p.s('#E5484D', Math.max(2, p.lw * 1.2));
        ctx.beginPath(); ctx.arc(0, r * 0.1, r * 0.3, -Math.PI / 4, 0, false);
        p.s('#FFD43B', Math.max(2.5, p.lw * 1.4));
        ctx.beginPath(); ctx.moveTo(0, r * 0.1); ctx.lineTo(r * 0.22, -r * 0.1);
        p.s('#FFFFFF', Math.max(1.5, p.lw * 0.9));
        break;
      }
      case 'cat_hollow_slug': {
        ctx.beginPath(); ctx.rect(-r * 0.35, -r * 0.05, r * 0.7, r * 0.75);
        p.fs('#C9A24B');
        ctx.beginPath(); ctx.rect(-r * 0.4, r * 0.65, r * 0.8, r * 0.15);
        p.fs('#8C6A28');
        ctx.beginPath();
        ctx.moveTo(-r * 0.35, -r * 0.05); ctx.quadraticCurveTo(-r * 0.72, -r * 0.3, -r * 0.65, -r * 0.65);
        ctx.lineTo(-r * 0.25, -r * 0.42); ctx.lineTo(0, -r * 0.75); ctx.lineTo(r * 0.25, -r * 0.42);
        ctx.lineTo(r * 0.65, -r * 0.65); ctx.quadraticCurveTo(r * 0.72, -r * 0.3, r * 0.35, -r * 0.05);
        ctxClose(ctx);
        p.fs('#D9693A');
        ctx.beginPath(); ctx.ellipse(0, -r * 0.28, r * 0.22, r * 0.14, 0, 0, Math.PI * 2);
        p.fs('#14121F');
        ctx.beginPath(); ctx.arc(-r * 0.45, -r * 0.45, r * 0.08, 0, Math.PI * 2); ctx.arc(r * 0.45, -r * 0.45, r * 0.08, 0, Math.PI * 2);
        p.f('#EDE3C8');
        break;
      }
      case 'cat_fuel_tank': {
        ctx.beginPath(); ctx.rect(-r * 0.5, -r * 0.35, r * 1.0, r * 1.05);
        p.fs('#E5484D');
        ctx.beginPath(); ctx.arc(0, -r * 0.35, r * 0.5, Math.PI, 0, false); ctx.arc(0, r * 0.65, r * 0.5, 0, Math.PI, false);
        p.fs('#9E1B28');
        ctx.beginPath();
        ctx.rect(-r * 0.52, -r * 0.15, r * 1.04, r * 0.14);
        ctx.rect(-r * 0.52, r * 0.35, r * 1.04, r * 0.14);
        p.fs('#3C4B40');
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(r * 0.18, r * 0.1); ctx.lineTo(0, r * 0.2); ctx.lineTo(-r * 0.18, r * 0.1);
        ctxClose(ctx);
        p.fs('#FFD43B', '#14121F', 1);
        ctx.beginPath(); ctx.rect(-r * 0.12, -r * 0.62, r * 0.24, r * 0.2);
        p.fs('#8C6A28');
        ctx.beginPath(); ctx.ellipse(0, -r * 0.72, r * 0.38, r * 0.12, 0, 0, Math.PI * 2);
        p.fs('#FFD43B');
        break;
      }
      case 'phoenix_feather': {
        ctx.beginPath();
        ctx.moveTo(-r * 0.4, r * 0.75);
        ctx.quadraticCurveTo(-r * 0.75, r * 0.3, -r * 0.7, -r * 0.1); ctx.lineTo(-r * 0.5, -r * 0.12);
        ctx.quadraticCurveTo(-r * 0.65, -r * 0.4, -r * 0.2, -r * 0.78); ctx.lineTo(r * 0.2, -r * 0.85);
        ctx.quadraticCurveTo(r * 0.65, -r * 0.45, r * 0.5, -r * 0.1); ctx.lineTo(r * 0.65, 0.05);
        ctx.quadraticCurveTo(r * 0.55, r * 0.4, -r * 0.4, r * 0.75);
        ctxClose(ctx);
        p.fs('#E5484D');
        ctx.beginPath();
        ctx.moveTo(-r * 0.35, r * 0.65);
        ctx.quadraticCurveTo(-r * 0.4, 0, 0, -r * 0.65);
        ctx.quadraticCurveTo(r * 0.35, 0, -r * 0.35, r * 0.65);
        p.f('#FFD43B');
        ctx.beginPath();
        ctx.moveTo(-r * 0.45, r * 0.85); ctx.quadraticCurveTo(-r * 0.1, 0, r * 0.2, -r * 0.85);
        p.s('#FFF085', Math.max(2, p.lw * 1.1));
        ctx.beginPath();
        ctx.arc(r * 0.4, -r * 0.75, r * 0.06, 0, Math.PI * 2);
        ctx.arc(r * 0.1, -r * 0.95, r * 0.05, 0, Math.PI * 2);
        p.f('#FFD43B');
        break;
      }
      case 'ghost_cloak': {
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.85);
        ctx.quadraticCurveTo(r * 0.6, -r * 0.5, r * 0.65, r * 0.1);
        ctx.lineTo(r * 0.55, r * 0.75); ctx.lineTo(r * 0.35, r * 0.55); ctx.lineTo(r * 0.15, r * 0.82);
        ctx.lineTo(-r * 0.05, r * 0.6); ctx.lineTo(-r * 0.3, r * 0.85); ctx.lineTo(-r * 0.55, r * 0.65);
        ctx.quadraticCurveTo(-r * 0.65, -r * 0.5, 0, -r * 0.85);
        ctxClose(ctx);
        p.fs('#3B2A58');
        ctx.beginPath(); ctx.arc(0, -r * 0.05, r * 0.48, 0.4, Math.PI - 0.4);
        p.s('#7FD3F0', Math.max(2, p.lw * 1.1));
        ctx.beginPath(); ctx.ellipse(0, -r * 0.35, r * 0.28, r * 0.22, 0, 0, Math.PI * 2);
        p.fs('#14121F');
        ctx.beginPath();
        ctx.ellipse(-r * 0.12, -r * 0.35, r * 0.08, r * 0.03, -0.2, 0, Math.PI * 2);
        ctx.ellipse(r * 0.12, -r * 0.35, r * 0.08, r * 0.03, 0.2, 0, Math.PI * 2);
        p.f('#CFEFFA');
        break;
      }
      case 'blast_core': {
        ctx.beginPath(); ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2);
        p.fs('#3C4B40');
        ctx.beginPath(); ctx.rect(-r * 0.72, -r * 0.24, r * 1.44, r * 0.48);
        p.fs('#FFD43B');
        ctx.beginPath();
        for (let i = -2; i <= 2; i++) {
          const x = i * (r * 0.3);
          ctx.moveTo(x - r * 0.1, -r * 0.24); ctx.lineTo(x + r * 0.08, r * 0.24);
          ctx.lineTo(x + r * 0.18, r * 0.24); ctx.lineTo(x, -r * 0.24);
        }
        ctxClose(ctx);
        p.f('#14121F');
        const vents = [[0, -r * 0.78], [r * 0.78, 0], [0, r * 0.78], [-r * 0.78, 0]];
        for (let i = 0; i < 4; i++) {
          ctx.beginPath(); ctx.arc(vents[i][0], vents[i][1], r * 0.12, 0, Math.PI * 2);
          p.fs('#FF7A2F', '#14121F', 1);
        }
        ctx.beginPath(); ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2);
        p.fs('#FF7A2F', '#14121F', 1);
        break;
      }
      case 'cat_whetstone': {
        ctx.beginPath(); ctx.rect(-r * 0.75, r * 0.2, r * 1.5, r * 0.45);
        p.fs('#6E381A');
        ctx.beginPath(); ctx.rect(-r * 0.68, -r * 0.1, r * 1.36, r * 0.3);
        p.fs('#5A6577');
        ctx.beginPath(); ctx.rect(-r * 0.68, -r * 0.48, r * 1.36, r * 0.38);
        p.fs('#8C9AA8');
        ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.42); ctx.lineTo(r * 0.5, -r * 0.18);
        p.s('#CFEFFA', Math.max(2, p.lw * 1.1));
        ctx.beginPath();
        ctx.moveTo(-r * 0.3, r * 0.05); ctx.lineTo(-r * 0.15, 0); ctx.lineTo(-r * 0.3, -r * 0.05);
        ctx.moveTo(r * 0.15, 0); ctx.lineTo(r * 0.3, -r * 0.05);
        p.s('#FFD43B', Math.max(1.5, p.lw * 0.8));
        break;
      }
      case 'cat_swarm_core': {
        polyN(ctx, 0, 0, r * 0.82, 6, 0);
        p.fs('#2A1E3F');
        const cellR = r * 0.25, cellDist = r * 0.45;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const cx = Math.cos(a) * cellDist, cy = Math.sin(a) * cellDist;
          polyN(ctx, cx, cy, cellR, 6, Math.PI / 6);
          p.fs('#FFD43B', '#14121F', Math.max(1, p.lw * 0.7));
        }
        ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
        p.fs('#E86AA6');
        ctx.beginPath(); ctx.arc(0, 0, r * 0.09, 0, Math.PI * 2);
        p.f('#FFFFFF');
        break;
      }
      case 'cat_tesla_gem': {
        ctx.beginPath(); ctx.rect(-r * 0.55, r * 0.45, r * 1.1, r * 0.35);
        p.fs('#D9693A');
        ctx.beginPath();
        ctx.moveTo(-r * 0.45, r * 0.45); ctx.quadraticCurveTo(-r * 0.75, 0, -r * 0.4, -r * 0.5);
        ctx.lineTo(-r * 0.25, -r * 0.42); ctx.quadraticCurveTo(-r * 0.52, 0, -r * 0.3, r * 0.45);
        ctxClose(ctx);
        p.fs('#D9693A');
        ctx.beginPath();
        ctx.moveTo(r * 0.45, r * 0.45); ctx.quadraticCurveTo(r * 0.75, 0, r * 0.4, -r * 0.5);
        ctx.lineTo(r * 0.25, -r * 0.42); ctx.quadraticCurveTo(r * 0.52, 0, r * 0.3, r * 0.45);
        ctxClose(ctx);
        p.fs('#D9693A');
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.85); ctx.lineTo(r * 0.38, -r * 0.1); ctx.lineTo(0, r * 0.55); ctx.lineTo(-r * 0.38, -r * 0.1);
        ctxClose(ctx);
        p.fs('#A25CE0');
        ctx.beginPath(); ctx.moveTo(0, -r * 0.85); ctx.lineTo(0, r * 0.55);
        p.s('#CFEFFA', Math.max(1.5, p.lw * 0.8));
        ctx.beginPath();
        ctx.moveTo(-r * 0.3, -r * 0.45); ctx.lineTo(-r * 0.15, -r * 0.3); ctx.lineTo(r * 0.15, -r * 0.35); ctx.lineTo(r * 0.3, -r * 0.45);
        p.s('#FFD43B', Math.max(2, p.lw * 1.1));
        break;
      }
      case 'glass_cannon': {
        const wx = -r * 0.2, wy = r * 0.35, wr = r * 0.42;
        ctx.beginPath(); ctx.arc(wx, wy, wr, 0, Math.PI * 2);
        p.fs('#C9A24B');
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI;
          ctx.beginPath();
          ctx.moveTo(wx + Math.cos(a) * wr, wy + Math.sin(a) * wr);
          ctx.lineTo(wx - Math.cos(a) * wr, wy - Math.sin(a) * wr);
          p.s('#8C6A28', Math.max(1.5, p.lw * 0.8));
        }
        ctx.beginPath(); ctx.arc(wx, wy, r * 0.12, 0, Math.PI * 2);
        p.fs('#14121F');
        ctx.beginPath();
        ctx.moveTo(-r * 0.45, r * 0.15); ctx.lineTo(-r * 0.25, -r * 0.1); ctx.lineTo(r * 0.65, -r * 0.55);
        ctx.lineTo(r * 0.75, -r * 0.35); ctx.lineTo(-r * 0.15, r * 0.35);
        ctxClose(ctx);
        p.fs('#CFEFFA');
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(r * 0.1, r * 0.18);
        ctx.moveTo(r * 0.3, -r * 0.25); ctx.lineTo(r * 0.4, -r * 0.08);
        p.s('#7FD3F0', Math.max(2, p.lw * 1.2));
        ctx.beginPath(); ctx.ellipse(r * 0.7, -r * 0.45, r * 0.14, r * 0.08, -Math.PI / 4, 0, Math.PI * 2);
        p.fs('#A25CE0');
        ctx.beginPath(); ctx.moveTo(-r * 0.3, -r * 0.05); ctx.lineTo(r * 0.5, -r * 0.48);
        p.s('#FFFFFF', Math.max(1.8, p.lw * 0.9));
        break;
      }
      case 'time_dial': {
        ctx.beginPath(); ctx.arc(0, -r * 0.8, r * 0.14, 0, Math.PI * 2);
        p.fs('#FFD43B');
        ctx.beginPath(); ctx.rect(-r * 0.1, -r * 0.7, r * 0.2, r * 0.15);
        p.fs('#C9A24B');
        const teeth = 12;
        ctx.beginPath();
        for (let i = 0; i < teeth * 2; i++) {
          const a = (i / (teeth * 2)) * Math.PI * 2;
          const rad = i % 2 === 0 ? r * 0.75 : r * 0.68;
          const x = Math.cos(a) * rad, y = Math.sin(a) * rad + r * 0.05;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctxClose(ctx);
        p.fs('#C9A24B');
        const cy = r * 0.05;
        ctx.beginPath(); ctx.arc(0, cy, r * 0.56, 0, Math.PI * 2);
        p.fs('#F2EFE6');
        ctx.beginPath(); ctx.arc(r * 0.18, cy + r * 0.15, r * 0.18, 0, Math.PI * 2);
        p.fs('#D9693A', '#14121F', 1);
        ctx.beginPath(); ctx.arc(0, cy, r * 0.08, 0, Math.PI * 2);
        p.fs('#14121F');
        ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(r * 0.25, cy - r * 0.15);
        p.s('#14121F', Math.max(2.5, p.lw * 1.3));
        ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(-r * 0.32, cy - r * 0.28);
        p.s('#14121F', Math.max(1.8, p.lw * 0.9));
        break;
      }
      case 'golden_skull': {
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, r * 0.65); ctx.lineTo(r * 0.5, r * 0.65); ctx.lineTo(r * 0.52, r * 0.25);
        ctx.quadraticCurveTo(r * 0.8, 0, r * 0.7, -r * 0.35);
        ctx.quadraticCurveTo(r * 0.5, -r * 0.85, 0, -r * 0.85);
        ctx.quadraticCurveTo(-r * 0.5, -r * 0.85, -r * 0.7, -r * 0.35);
        ctx.quadraticCurveTo(-r * 0.8, 0, -r * 0.52, r * 0.25);
        ctxClose(ctx);
        p.fs('#FFD43B');
        ctx.beginPath();
        ctx.moveTo(-r * 0.4, r * 0.45); ctx.lineTo(r * 0.4, r * 0.45);
        ctx.moveTo(-r * 0.2, r * 0.35); ctx.lineTo(-r * 0.2, r * 0.65);
        ctx.moveTo(0, r * 0.35); ctx.lineTo(0, r * 0.65);
        ctx.moveTo(r * 0.2, r * 0.35); ctx.lineTo(r * 0.2, r * 0.65);
        p.s('#C9A24B', Math.max(1.5, p.lw * 0.8));
        ctx.beginPath(); ctx.moveTo(0, -r * 0.05); ctx.lineTo(r * 0.1, r * 0.15); ctx.lineTo(-r * 0.1, r * 0.15);
        ctxClose(ctx);
        p.fs('#14121F');
        ctx.beginPath();
        ctx.ellipse(-r * 0.3, -r * 0.2, r * 0.18, r * 0.15, -0.15, 0, Math.PI * 2);
        ctx.ellipse(r * 0.3, -r * 0.2, r * 0.18, r * 0.15, 0.15, 0, Math.PI * 2);
        p.fs('#8BD450');
        ctx.beginPath();
        ctx.arc(-r * 0.34, -r * 0.24, r * 0.05, 0, Math.PI * 2);
        ctx.arc(r * 0.26, -r * 0.24, r * 0.05, 0, Math.PI * 2);
        p.f('#FFFFFF');
        break;
      }
      case 'echo_stone': {
        for (let i = 1; i <= 3; i++) {
          const wr = r * (0.35 + i * 0.18);
          ctx.beginPath(); ctx.arc(0, 0, wr, -1.2, 1.2, false);
          p.s('#8BD450', Math.max(1.5, (4 - i) * 0.7 * p.lw));
          ctx.beginPath(); ctx.arc(0, 0, wr, Math.PI - 1.2, Math.PI + 1.2, false);
          p.s('#8BD450', Math.max(1.5, (4 - i) * 0.7 * p.lw));
        }
        ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
        p.fs('#3C4B40');
        ctx.beginPath(); ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2);
        p.fs('#CFEFFA');
        const numTeeth = 8;
        for (let i = 0; i < numTeeth; i++) {
          const a = (i / numTeeth) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * (r * 0.32), Math.sin(a) * (r * 0.32));
          ctx.lineTo(Math.cos(a) * (r * 0.18), Math.sin(a) * (r * 0.18));
          p.s('#7FD3F0', Math.max(1.5, p.lw * 0.8));
        }
        ctx.beginPath(); ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2);
        p.fs('#FFFFFF', '#14121F', 1);
        break;
      }
      default: {
        ctx.beginPath(); ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2);
        p.fs('#C9A24B');
        break;
      }
    }
  }

  // ---------- PICKUP ILLUSTRATION PATHS (6 types) ----------
  function renderPickupIllustration(ctx, type, r, isShadow, opts) {
    const p = makePainter(ctx, r, isShadow, opts);

    switch (type) {
      case 'xp_shard': {
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.95); ctx.lineTo(r * 0.75, -r * 0.1); ctx.lineTo(0, r * 0.95); ctx.lineTo(-r * 0.75, -r * 0.1);
        ctxClose(ctx);
        p.fs('#7FD3F0');
        ctx.beginPath();
        ctx.moveTo(-r * 0.75, -r * 0.1); ctx.lineTo(0, r * 0.95); ctx.lineTo(0, -r * 0.1);
        ctxClose(ctx);
        p.f('#3A8AA5');
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.95); ctx.lineTo(0, -r * 0.1); ctx.lineTo(-r * 0.75, -r * 0.1);
        ctxClose(ctx);
        p.f('#CFEFFA');
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.45); ctx.lineTo(r * 0.35, -r * 0.1); ctx.lineTo(0, r * 0.3); ctx.lineTo(-r * 0.35, -r * 0.1);
        ctxClose(ctx);
        p.fs('#CFEFFA', '#14121F', 1);
        ctx.beginPath(); ctx.arc(0, -r * 0.65, r * 0.08, 0, Math.PI * 2);
        p.f('#FFFFFF');
        break;
      }
      case 'gold': {
        ctx.beginPath(); ctx.ellipse(-r * 0.2, r * 0.2, r * 0.65, r * 0.45, -0.2, 0, Math.PI * 2);
        p.fs('#C9A24B');
        ctx.beginPath(); ctx.ellipse(r * 0.08, -r * 0.08, r * 0.7, r * 0.52, 0.15, 0, Math.PI * 2);
        p.fs('#FFD43B');
        ctx.beginPath(); ctx.ellipse(r * 0.08, -r * 0.08, r * 0.52, r * 0.38, 0.15, 0, Math.PI * 2);
        p.s('#C9A24B', Math.max(1.5, p.lw * 0.8));
        ctx.beginPath(); ctx.arc(r * 0.08, -r * 0.08, r * 0.18, 0, Math.PI * 2);
        p.fs('#FFF085', '#14121F', 1);
        ctx.beginPath(); ctx.arc(r * 0.08, -r * 0.08, r * 0.62, -2.4, -1.0);
        p.s('#FFFFFF', Math.max(1.5, p.lw * 0.8));
        break;
      }
      case 'heart': {
        ctx.beginPath();
        ctx.rect(-r * 0.42, -r * 0.85, r * 0.24, r * 0.22);
        ctx.rect(r * 0.18, -r * 0.85, r * 0.24, r * 0.22);
        p.fs('#C9A24B');
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.35);
        ctx.bezierCurveTo(-r * 0.45, -r * 0.85, -r * 0.9, -r * 0.2, -r * 0.75, r * 0.15);
        ctx.bezierCurveTo(-r * 0.65, r * 0.45, -r * 0.3, r * 0.68, 0, r * 0.9);
        ctx.bezierCurveTo(r * 0.3, r * 0.68, r * 0.65, r * 0.45, r * 0.75, r * 0.15);
        ctx.bezierCurveTo(r * 0.9, -r * 0.2, r * 0.45, -r * 0.85, 0, -r * 0.35);
        ctxClose(ctx);
        p.fs('#E86AA6');
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.1); ctx.lineTo(-r * 0.35, r * 0.15); ctx.lineTo(0, r * 0.62); ctx.lineTo(r * 0.35, r * 0.15);
        ctxClose(ctx);
        p.f('#E5484D');
        ctx.beginPath(); ctx.arc(-r * 0.38, -r * 0.35, r * 0.22, -2.6, -1.0);
        p.s('#FFFFFF', Math.max(1.8, p.lw * 0.9));
        break;
      }
      case 'magnet': {
        ctx.beginPath();
        ctx.arc(0, -r * 0.1, r * 0.72, Math.PI, 0, false);
        ctx.lineTo(r * 0.72, r * 0.65); ctx.lineTo(r * 0.32, r * 0.65); ctx.lineTo(r * 0.32, -r * 0.1);
        ctx.arc(0, -r * 0.1, r * 0.32, 0, Math.PI, true);
        ctx.lineTo(-r * 0.32, r * 0.65); ctx.lineTo(-r * 0.72, r * 0.65);
        ctxClose(ctx);
        p.fs('#E5484D');
        ctx.beginPath();
        ctx.arc(0, -r * 0.1, r * 0.72, -Math.PI / 2, 0, false);
        ctx.lineTo(r * 0.72, r * 0.65); ctx.lineTo(r * 0.32, r * 0.65); ctx.lineTo(r * 0.32, -r * 0.1);
        ctx.arc(0, -r * 0.1, r * 0.32, 0, -Math.PI / 2, true);
        ctxClose(ctx);
        p.f('#5FA8D3');
        ctx.beginPath();
        ctx.rect(-r * 0.72, r * 0.45, r * 0.4, r * 0.2);
        ctx.rect(r * 0.32, r * 0.45, r * 0.4, r * 0.2);
        p.fs('#F2EFE6');
        ctx.beginPath(); ctx.arc(0, r * 0.55, r * 0.25, 0, Math.PI);
        p.s('#FFD43B', Math.max(1.5, p.lw * 0.8));
        break;
      }
      case 'nova_bomb': {
        const numSpikes = 6;
        for (let i = 0; i < numSpikes; i++) {
          const a = (i / numSpikes) * Math.PI * 2;
          const cos = Math.cos(a), sin = Math.sin(a);
          ctx.beginPath(); ctx.moveTo(cos * (r * 0.5), sin * (r * 0.5)); ctx.lineTo(cos * (r * 0.95), sin * (r * 0.95));
          p.s('#1F2822', Math.max(2.5, p.lw * 1.3));
          ctx.beginPath(); ctx.arc(cos * (r * 0.95), sin * (r * 0.95), r * 0.09, 0, Math.PI * 2);
          p.fs('#FFD43B', '#14121F', 1);
        }
        ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
        p.fs('#FF7A2F');
        ctx.beginPath(); ctx.rect(-r * 0.62, -r * 0.16, r * 1.24, r * 0.32);
        p.fs('#FFD43B');
        ctx.beginPath();
        for (let i = -1; i <= 1; i++) {
          const x = i * (r * 0.32);
          ctx.moveTo(x - r * 0.08, -r * 0.16); ctx.lineTo(x + r * 0.08, r * 0.16);
        }
        p.s('#14121F', Math.max(1.5, p.lw * 0.8));
        ctx.beginPath(); ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2);
        p.fs('#FFFFFF', '#14121F', 1);
        break;
      }
      case 'chest': {
        ctx.beginPath(); ctx.rect(-r * 0.75, -r * 0.05, r * 1.5, r * 0.75);
        p.fs('#C9A24B');
        ctx.beginPath();
        ctx.moveTo(-r * 0.8, -r * 0.05); ctx.quadraticCurveTo(0, -r * 0.82, r * 0.8, -r * 0.05);
        ctxClose(ctx);
        p.fs('#C9A24B');
        const strapX = [-r * 0.42, r * 0.42];
        for (let i = 0; i < 2; i++) {
          const sx = strapX[i];
          ctx.beginPath(); ctx.rect(sx - r * 0.1, -r * 0.05, r * 0.2, r * 0.75);
          p.fs('#1F2822');
          ctx.beginPath();
          ctx.arc(sx, r * 0.15, r * 0.05, 0, Math.PI * 2);
          ctx.arc(sx, r * 0.5, r * 0.05, 0, Math.PI * 2);
          p.f('#EDE3C8');
        }
        ctx.beginPath(); ctx.rect(-r * 0.82, -r * 0.1, r * 1.64, r * 0.12);
        p.fs('#2E3A32');
        ctx.beginPath(); ctx.rect(-r * 0.16, -r * 0.12, r * 0.32, r * 0.35);
        p.fs('#FFD43B');
        ctx.beginPath(); ctx.arc(0, 0, r * 0.05, 0, Math.PI * 2); ctx.rect(-r * 0.02, 0, r * 0.04, r * 0.08);
        p.f('#14121F');
        break;
      }
      default: {
        ctx.beginPath(); ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2);
        p.fs('#C9A24B');
        break;
      }
    }
  }

  // Public entry points for weapons, items, and pickups
  function drawWeapon(ctx, weaponId, x, y, r, opts) {
    opts = opts || {};
    const rot = opts.rot || 0;
    const shX = opts.shX !== undefined ? opts.shX : Math.max(1.5, Math.round(r * 0.12));
    const shY = opts.shY !== undefined ? opts.shY : Math.max(2, Math.round(r * 0.16));

    if (opts.shadow !== false && shX > 0 && shY > 0) {
      ctx.save(); ctx.translate(x + shX, y + shY); if (rot) ctx.rotate(rot);
      renderWeaponIllustration(ctx, weaponId, r, true, opts);
      ctx.restore();
    }
    ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot);
    renderWeaponIllustration(ctx, weaponId, r, false, opts);
    ctx.restore();
  }

  function drawItem(ctx, itemId, x, y, r, opts) {
    opts = opts || {};
    const rot = opts.rot || 0;
    const shX = opts.shX !== undefined ? opts.shX : Math.max(1.5, Math.round(r * 0.12));
    const shY = opts.shY !== undefined ? opts.shY : Math.max(2, Math.round(r * 0.16));

    if (opts.shadow !== false && shX > 0 && shY > 0) {
      ctx.save(); ctx.translate(x + shX, y + shY); if (rot) ctx.rotate(rot);
      renderItemIllustration(ctx, itemId, r, true, opts);
      ctx.restore();
    }
    ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot);
    renderItemIllustration(ctx, itemId, r, false, opts);
    ctx.restore();
  }

  function drawPickup(ctx, pickupType, x, y, r, opts) {
    opts = opts || {};
    const rot = opts.rot || 0;
    const shX = opts.shX !== undefined ? opts.shX : Math.max(1.5, Math.round(r * 0.12));
    const shY = opts.shY !== undefined ? opts.shY : Math.max(2, Math.round(r * 0.16));

    if (opts.shadow !== false && shX > 0 && shY > 0) {
      ctx.save(); ctx.translate(x + shX, y + shY); if (rot) ctx.rotate(rot);
      renderPickupIllustration(ctx, pickupType, r, true, opts);
      ctx.restore();
    }
    ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot);
    renderPickupIllustration(ctx, pickupType, r, false, opts);
    ctx.restore();
  }

  NR.fx = NR.fx || {};
  NR.fx.shapes = {
    draw: draw,
    shadow: shadow,
    ids: ids,
    has: function (s) { return !KNOWN[s]; },
    clear: clear,
    count: function () { return count; },
    darkOf: darkOf,
    lightOf: lightOf,
    path: path,
    drawWeapon: drawWeapon,
    // ids with their own illustration here (the HUD/UI icon renderer delegates to these)
    weaponArt: ['dragonfire', 'blizzard_fan', 'prism_lance', 'singularity_maul', 'bloodsaw', 'carpet_bomb', 'plague_mine', 'absolute_zero', 'miasma', 'wraith_seeker', 'bullet_hose', 'hydra_bow', 'glacial_seeker', 'thunder_ring', 'rail_reflector', 'skyhammer', 'phoenix_staff'],
    drawItem: drawItem,
    drawPickup: drawPickup
  };
})();
