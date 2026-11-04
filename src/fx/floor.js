// Owner: FX
// Arena floor: flat zone color, thin solid tile lines, sparse flat props at the edge (pre-rendered once per zone),
// plus flat scorch/splat decals that fade by alpha and attack telegraphs that fill up before the hit.
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  const TILE = 160, TAU = Math.PI * 2;
  const decals = [], tele = [];
  const view = { x: 0, y: 0 };
  let inited = false;
  // [shape, palette index, shade, rMin, rMax]
  const PROPS = {
    scrap: [['square', 3, -0.25, 14, 24], ['circle', 4, -0.2, 11, 17], ['star', 1, 0.35, 12, 18], ['capsule', 4, -0.35, 18, 28], ['hex', 1, 0.15, 12, 20]],
    frost: [['diamond', 3, 0, 12, 24], ['circle', 5, -0.1, 14, 26], ['hex', 1, 0.25, 12, 20], ['tri', 3, 0.3, 12, 20]],
    void: [['tri', 3, 0, 12, 22], ['ring', 4, 0, 14, 24], ['circle', 4, -0.3, 9, 14], ['diamond', 3, -0.2, 14, 24], ['star', 5, -0.2, 10, 16]]
  };

  function init() {
    if (inited) return;
    inited = true;
    NR.events.on('run:start', clear);
    NR.events.on('enemy:attack', onAttack);
    NR.events.on('area:explode', function (e) {
      decal('scorch', e.x, e.y, Math.min(65, (e.r || 40) * 0.4), NR.config.INK);
    });
    NR.events.on('enemy:death', function (e) {
      if (e.elite || e.isBoss) decal('splat', e.x, e.y, e.isBoss ? 48 : 24, NR.config.INK);
    });
  }
  function rngFor(str) { let s = NR.util.hash(str) || 1; return function () { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shade(c, a) { return a ? NR.util.shade(c, a) : c; }

  // paints the whole arena onto any 2D context (offscreen cache, or the main canvas when no DOM exists)
  // paints the arena (or the x,y,w,h part of it; painters may draw more, the caller clips)
  function paint(c, zone, pal, rx, ry, rw, rh) {
    const A = NR.config.ARENA, S = NR.fx.shapes, rnd = rngFor('floor:' + zone);
    const ink = NR.config.INK;
    if (NR.fx.art && zone === 'scrap') { paintScrap(c, pal, rx || 0, ry || 0, rw || A.w, rh || A.h); return; }
    if (NR.fx.art && zone === 'frost') { paintFrost(c, pal, rx || 0, ry || 0, rw || A.w, rh || A.h); return; }
    if (NR.fx.art && zone === 'void') { paintVoid(c, pal, rx || 0, ry || 0, rw || A.w, rh || A.h); return; }
    c.fillStyle = pal[0]; c.fillRect(0, 0, A.w, A.h);

    if (zone === 'scrap') {
      // 1. Scrap Zone: Heavy industrial riveted steel deck & diamond plating
      for (let tx = 0; tx < A.w / TILE; tx++) {
        for (let ty = 0; ty < A.h / TILE; ty++) {
          const x0 = tx * TILE, y0 = ty * TILE;
          const rVal = rnd();
          if (rVal < 0.28) {
            // Diamond tread steel plate
            c.fillStyle = pal[1]; c.fillRect(x0 + 4, y0 + 4, TILE - 8, TILE - 8);
            c.strokeStyle = pal[2]; c.lineWidth = 1.5;
            c.beginPath();
            for (let d = 16; d < TILE - 8; d += 20) {
              c.moveTo(x0 + d, y0 + 6); c.lineTo(x0 + 6, y0 + d);
              c.moveTo(x0 + TILE - d, y0 + 6); c.lineTo(x0 + TILE - 6, y0 + d);
            }
            c.stroke();
          } else if (rVal < 0.42) {
            // Ventilation exhaust grille
            c.fillStyle = pal[2]; c.fillRect(x0 + 12, y0 + 12, TILE - 24, TILE - 24);
            c.fillStyle = ink;
            for (let gy = 20; gy < TILE - 20; gy += 10) c.fillRect(x0 + 16, y0 + gy, TILE - 32, 4);
          } else if (rVal < 0.6) {
            c.fillStyle = pal[1]; c.fillRect(x0 + 4, y0 + 4, TILE - 8, TILE - 8);
          }
          // Corner rivets on each plate
          c.fillStyle = pal[2];
          c.fillRect(x0 + 8, y0 + 8, 4, 4); c.fillRect(x0 + TILE - 12, y0 + 8, 4, 4);
          c.fillRect(x0 + 8, y0 + TILE - 12, 4, 4); c.fillRect(x0 + TILE - 12, y0 + TILE - 12, 4, 4);
        }
      }
      // Tile seams
      c.strokeStyle = pal[2]; c.lineWidth = 2; c.beginPath();
      for (let x = TILE; x < A.w; x += TILE) { c.moveTo(x, 0); c.lineTo(x, A.h); }
      for (let y = TILE; y < A.h; y += TILE) { c.moveTo(0, y); c.lineTo(A.w, y); }
      c.stroke();
      // Wall hazard yellow-and-black chevron borders
      c.fillStyle = pal[2];
      c.fillRect(0, 0, A.w, 20); c.fillRect(0, A.h - 20, A.w, 20); c.fillRect(0, 0, 20, A.h); c.fillRect(A.w - 20, 0, 20, A.h);
      c.fillStyle = pal[3];
      for (let x = 0; x < A.w; x += 48) {
        c.beginPath(); c.moveTo(x, 20); c.lineTo(x + 24, 0); c.lineTo(x + 36, 0); c.lineTo(x + 12, 20); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(x, A.h); c.lineTo(x + 24, A.h - 20); c.lineTo(x + 36, A.h - 20); c.lineTo(x + 12, A.h); c.closePath(); c.fill();
      }
      for (let y = 0; y < A.h; y += 48) {
        c.beginPath(); c.moveTo(20, y); c.lineTo(0, y + 24); c.lineTo(0, y + 36); c.lineTo(20, y + 12); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(A.w, y); c.lineTo(A.w - 20, y + 24); c.lineTo(A.w - 20, y + 36); c.lineTo(A.w, y + 12); c.closePath(); c.fill();
      }
    } else if (zone === 'frost') {
      // 2. Frost Zone: Chiseled permafrost stone slabs & crystalline ice fractures
      for (let tx = 0; tx < A.w / TILE; tx++) {
        for (let ty = 0; ty < A.h / TILE; ty++) {
          const x0 = tx * TILE, y0 = ty * TILE;
          const rVal = rnd();
          if (rVal < 0.35) c.fillStyle = pal[1]; else c.fillStyle = pal[0];
          c.fillRect(x0 + 3, y0 + 3, TILE - 6, TILE - 6);
          // Glacial ice fracture branching lines
          if (rVal < 0.45) {
            c.strokeStyle = '#CFEFFA'; c.lineWidth = 1.5; c.beginPath();
            c.moveTo(x0 + 20, y0 + 10); c.lineTo(x0 + 60, y0 + 50); c.lineTo(x0 + 110, y0 + 40);
            c.moveTo(x0 + 60, y0 + 50); c.lineTo(x0 + 75, y0 + 110);
            c.stroke();
          }
          // Embedded cyan frost gem deposits
          if (rVal < 0.2) {
            c.fillStyle = '#7FD3F0';
            c.beginPath(); c.moveTo(x0 + 30, y0 + 30); c.lineTo(x0 + 36, y0 + 24); c.lineTo(x0 + 42, y0 + 30); c.lineTo(x0 + 36, y0 + 36); c.closePath(); c.fill();
          }
        }
      }
      // Tile seams
      c.strokeStyle = pal[2]; c.lineWidth = 2.5; c.beginPath();
      for (let x = TILE; x < A.w; x += TILE) { c.moveTo(x, 0); c.lineTo(x, A.h); }
      for (let y = TILE; y < A.h; y += TILE) { c.moveTo(0, y); c.lineTo(A.w, y); }
      c.stroke();
      // Wall perimeter snowdrift banks
      c.fillStyle = pal[2];
      c.fillRect(0, 0, A.w, 18); c.fillRect(0, A.h - 18, A.w, 18); c.fillRect(0, 0, 18, A.h); c.fillRect(A.w - 18, 0, 18, A.h);
      c.fillStyle = '#CFEFFA';
      for (let x = 0; x < A.w; x += 60) {
        c.fillRect(x + 10, 18, 25, 4); c.fillRect(x + 30, A.h - 22, 25, 4);
      }
    } else {
      // 3. Void Zone: Dark obsidian flagstones & ancient cosmic runic circle
      for (let tx = 0; tx < A.w / TILE; tx++) {
        for (let ty = 0; ty < A.h / TILE; ty++) {
          const x0 = tx * TILE, y0 = ty * TILE;
          const rVal = rnd();
          if (rVal < 0.3) c.fillStyle = pal[1]; else c.fillStyle = pal[0];
          c.fillRect(x0 + 3, y0 + 3, TILE - 6, TILE - 6);
          // Cosmic star-rift fractures
          if (rVal < 0.35) {
            c.strokeStyle = '#A25CE0'; c.lineWidth = 1.5; c.beginPath();
            c.moveTo(x0 + 15, y0 + TILE - 15); c.lineTo(x0 + 70, y0 + 70); c.lineTo(x0 + TILE - 20, y0 + 30);
            c.stroke();
          }
        }
      }
      // Tile seams
      c.strokeStyle = pal[2]; c.lineWidth = 2; c.beginPath();
      for (let x = TILE; x < A.w; x += TILE) { c.moveTo(x, 0); c.lineTo(x, A.h); }
      for (let y = TILE; y < A.h; y += TILE) { c.moveTo(0, y); c.lineTo(A.w, y); }
      c.stroke();
      // Large cosmic occult runic circle in center of arena
      const cx = A.w / 2, cy = A.h / 2;
      c.strokeStyle = '#A25CE0'; c.lineWidth = 2.5;
      c.beginPath(); c.arc(cx, cy, 260, 0, TAU); c.stroke();
      c.beginPath(); c.arc(cx, cy, 220, 0, TAU); c.stroke();
      c.beginPath(); c.arc(cx, cy, 140, 0, TAU); c.stroke();
      // 8-pointed star in center
      c.beginPath();
      for (let i = 0; i < 8; i++) {
        const a1 = (i / 8) * TAU, a2 = ((i + 3) / 8) * TAU;
        c.moveTo(cx + Math.cos(a1) * 220, cy + Math.sin(a1) * 220);
        c.lineTo(cx + Math.cos(a2) * 220, cy + Math.sin(a2) * 220);
      }
      c.stroke();
      // Void wall border
      c.fillStyle = pal[2];
      c.fillRect(0, 0, A.w, 18); c.fillRect(0, A.h - 18, A.w, 18); c.fillRect(0, 0, 18, A.h); c.fillRect(A.w - 18, 0, 18, A.h);
      c.fillStyle = '#8A5BD1';
      for (let x = 0; x < A.w; x += 64) { c.fillRect(x + 12, 18, 20, 4); c.fillRect(x + 28, A.h - 22, 20, 4); }
    }

    // Sparse props hugging the walls
    const list = PROPS[zone] || PROPS.scrap, n = 46;
    for (let i = 0; i < n; i++) {
      const side = (rnd() * 4) | 0, along = rnd(), off = 34 + rnd() * 46, d = list[(rnd() * list.length) | 0];
      const x = side < 2 ? along * (A.w - 120) + 60 : (side === 2 ? off : A.w - off), y = side < 2 ? (side === 0 ? off : A.h - off) : along * (A.h - 120) + 60;
      S.draw(c, d[0], x, y, d[3] + rnd() * (d[4] - d[3]), rnd() * TAU, 1, 1, shade(pal[d[1]], d[2]), 3, false);
    }
  }
  // ---------- Flat++ floor painters (per-tile hashed so any chunk can be painted alone) ----------
  const T2 = 128, WALL = 30;
  function h2(x, y, k) { let n = Math.imul(x * 374761393 + y * 668265263 + (k || 0) * 2147483647, 1274126177); n = (n ^ (n >>> 13)) >>> 0; return (Math.imul(n, 1597334677) >>> 0) / 4294967296; }
  const tone = Object.create(null);
  function tc(base, amt) { const k = base + amt; let v = tone[k]; if (v === undefined) v = tone[k] = NR.util.shade(base, amt); return v; }
  function scrapProps() {
    const A = NR.config.ARENA, list = [], rnd = rngFor('props:scrap');
    for (let i = 0; i < 70; i++) {
      const side = (rnd() * 4) | 0, along = rnd(), off = WALL + 14 + rnd() * 70;
      const x = side < 2 ? 60 + along * (A.w - 120) : (side === 2 ? off : A.w - off), y = side < 2 ? (side === 0 ? off : A.h - off) : 60 + along * (A.h - 120);
      list.push({ k: (rnd() * 5) | 0, x: x, y: y, r: 12 + rnd() * 16, a: rnd() * TAU });
    }
    return list;
  }
  let propCache = null;
  function drawProp(c, pr, pal) {
    const ink = NR.config.INK, art = NR.fx.art, steel = NR.util.shade(pal[0], 0.28), rust = art.mix(pal[3], pal[0], 0.55), dark = NR.util.shade(pal[0], -0.35);
    c.save(); c.translate(pr.x, pr.y);
    c.fillStyle = 'rgba(11,10,18,0.35)'; c.beginPath(); c.ellipse(3, pr.r * 0.55, pr.r * 1.05, pr.r * 0.45, 0, 0, TAU); c.fill();
    c.rotate(pr.a); c.lineWidth = 2.2; c.strokeStyle = ink; c.lineJoin = 'round';
    const r = pr.r;
    if (pr.k === 0) { // gear
      c.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, rr = i % 2 ? r : r * 0.8; if (i) c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath();
      c.fillStyle = rust; c.fill(); c.stroke(); c.beginPath(); c.arc(0, 0, r * 0.32, 0, TAU); c.fillStyle = dark; c.fill(); c.stroke();
    } else if (pr.k === 1) { // pipe
      c.fillStyle = steel; c.fillRect(-r * 1.3, -r * 0.32, r * 2.6, r * 0.64); c.strokeRect(-r * 1.3, -r * 0.32, r * 2.6, r * 0.64);
      c.fillStyle = dark; c.fillRect(-r * 1.3, -r * 0.42, r * 0.3, r * 0.84); c.strokeRect(-r * 1.3, -r * 0.42, r * 0.3, r * 0.84);
      c.fillStyle = NR.util.shade(steel, 0.25); c.fillRect(-r * 0.9, -r * 0.22, r * 2, r * 0.12);
    } else if (pr.k === 2) { // crate
      c.fillStyle = art.mix(pal[3], pal[0], 0.35); c.fillRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6); c.strokeRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
      c.beginPath(); c.moveTo(-r * 0.8, -r * 0.8); c.lineTo(r * 0.8, r * 0.8); c.moveTo(r * 0.8, -r * 0.8); c.lineTo(-r * 0.8, r * 0.8); c.lineWidth = 1.6; c.stroke();
    } else if (pr.k === 3) { // tyre
      c.beginPath(); c.arc(0, 0, r * 0.9, 0, TAU); c.fillStyle = '#26232B'; c.fill(); c.stroke();
      c.beginPath(); c.arc(0, 0, r * 0.42, 0, TAU); c.fillStyle = dark; c.fill(); c.stroke();
    } else { // scrap plate heap
      c.fillStyle = steel; c.beginPath(); c.moveTo(-r, r * 0.2); c.lineTo(-r * 0.3, -r * 0.7); c.lineTo(r * 0.8, -r * 0.4); c.lineTo(r, r * 0.4); c.lineTo(0, r * 0.7); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = rust; c.beginPath(); c.moveTo(-r * 0.5, 0); c.lineTo(0, -r * 0.4); c.lineTo(r * 0.5, 0); c.lineTo(0, r * 0.35); c.closePath(); c.fill(); c.stroke();
    }
    c.restore();
  }
  function paintScrap(c, pal, rx, ry, rw, rh) {
    const A = NR.config.ARENA, art = NR.fx.art;
    const g0 = art.mix(pal[0], '#1A1C22', 0.25), g1 = art.mix(pal[1], '#1A1C22', 0.3), seam = NR.util.shade(g0, -0.32);
    c.fillStyle = seam; c.fillRect(rx, ry, rw, rh);
    const t0x = Math.floor(rx / T2), t0y = Math.floor(ry / T2), t1x = Math.floor((rx + rw) / T2), t1y = Math.floor((ry + rh) / T2);
    for (let ty = t0y; ty <= t1y; ty++) for (let tx = t0x; tx <= t1x; tx++) {
      const x0 = tx * T2, y0 = ty * T2, h = h2(tx, ty, 1), base = h < 0.32 ? g1 : g0, v = (h2(tx, ty, 2) - 0.5) * 0.06;
      const fill = tc(base, v);
      c.fillStyle = fill; c.fillRect(x0 + 2, y0 + 2, T2 - 4, T2 - 4);
      c.fillStyle = tc(fill, 0.07); c.fillRect(x0 + 2, y0 + 2, T2 - 4, 2); c.fillRect(x0 + 2, y0 + 2, 2, T2 - 4);
      c.fillStyle = tc(fill, -0.12); c.fillRect(x0 + 2, y0 + T2 - 4, T2 - 4, 2); c.fillRect(x0 + T2 - 4, y0 + 2, 2, T2 - 4);
      const d = h2(tx, ty, 3);
      if (d < 0.12) { // diamond tread
        c.strokeStyle = tc(fill, -0.1); c.lineWidth = 2; c.beginPath();
        for (let yy = 14; yy < T2 - 10; yy += 16) for (let xx = 14 + ((yy / 16) & 1) * 8; xx < T2 - 10; xx += 16) { c.moveTo(x0 + xx - 4, y0 + yy + 3); c.lineTo(x0 + xx + 4, y0 + yy - 3); }
        c.stroke();
      } else if (d < 0.2) { // floor vent, low contrast
        c.fillStyle = tc(fill, -0.2); c.fillRect(x0 + 26, y0 + 34, T2 - 52, T2 - 68);
        c.fillStyle = tc(fill, -0.32); for (let yy = y0 + 40; yy < y0 + T2 - 40; yy += 9) c.fillRect(x0 + 30, yy, T2 - 60, 4);
      } else if (d < 0.27) { // worn hazard paint
        c.save(); c.beginPath(); c.rect(x0 + 2, y0 + T2 * 0.38, T2 - 4, T2 * 0.24); c.clip();
        c.fillStyle = art.rgba(pal[3], 0.13); for (let xx = -T2; xx < T2 * 2; xx += 28) { c.beginPath(); c.moveTo(x0 + xx, y0 + T2 * 0.62); c.lineTo(x0 + xx + 14, y0 + T2 * 0.62); c.lineTo(x0 + xx + 44, y0 + T2 * 0.38); c.lineTo(x0 + xx + 30, y0 + T2 * 0.38); c.closePath(); c.fill(); }
        c.restore();
      }
      if (h2(tx, ty, 4) < 0.18) { // oil stain
        c.fillStyle = 'rgba(12,12,18,0.2)'; const ox = x0 + 20 + h2(tx, ty, 5) * 80, oy = y0 + 20 + h2(tx, ty, 6) * 80;
        c.beginPath(); c.ellipse(ox, oy, 18 + h2(tx, ty, 7) * 16, 10 + h2(tx, ty, 8) * 8, h2(tx, ty, 9) * 3, 0, TAU); c.fill();
        c.beginPath(); c.arc(ox + 22, oy + 6, 5, 0, TAU); c.fill();
      }
      if (h2(tx, ty, 10) < 0.25) { // scratches
        c.strokeStyle = 'rgba(237,227,200,0.06)'; c.lineWidth = 1.5; c.beginPath();
        const sx = x0 + 16 + h2(tx, ty, 11) * 90, sy = y0 + 16 + h2(tx, ty, 12) * 90; c.moveTo(sx, sy); c.lineTo(sx + 26, sy + 9); c.moveTo(sx + 4, sy + 7); c.lineTo(sx + 22, sy + 14); c.stroke();
      }
      c.fillStyle = tc(fill, -0.24);
      c.fillRect(x0 + 8, y0 + 8, 4, 4); c.fillRect(x0 + T2 - 12, y0 + 8, 4, 4); c.fillRect(x0 + 8, y0 + T2 - 12, 4, 4); c.fillRect(x0 + T2 - 12, y0 + T2 - 12, 4, 4);
      if (h2(tx, ty, 13) < 0.07) art.glow(c, x0 + T2 / 2, y0 + T2 / 2, 150, '#FFB25C', 0.07);
    }
    // arena wall: dark band, inner lip, muted hazard chevrons, bolts
    const wall = art.mix(pal[2], '#0F1114', 0.2), lip = NR.util.shade(pal[2], 0.25), chev = art.mix(pal[3], wall, 0.45);
    c.fillStyle = wall;
    c.fillRect(0, 0, A.w, WALL); c.fillRect(0, A.h - WALL, A.w, WALL); c.fillRect(0, 0, WALL, A.h); c.fillRect(A.w - WALL, 0, WALL, A.h);
    c.fillStyle = chev;
    for (let x = 0; x < A.w; x += 56) {
      if (x + 60 < rx || x - 60 > rx + rw) continue;
      c.beginPath(); c.moveTo(x, WALL - 8); c.lineTo(x + 16, 8); c.lineTo(x + 30, 8); c.lineTo(x + 14, WALL - 8); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(x, A.h - 8); c.lineTo(x + 16, A.h - WALL + 8); c.lineTo(x + 30, A.h - WALL + 8); c.lineTo(x + 14, A.h - 8); c.closePath(); c.fill();
    }
    for (let y = 0; y < A.h; y += 56) {
      if (y + 60 < ry || y - 60 > ry + rh) continue;
      c.beginPath(); c.moveTo(WALL - 8, y); c.lineTo(8, y + 16); c.lineTo(8, y + 30); c.lineTo(WALL - 8, y + 14); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(A.w - 8, y); c.lineTo(A.w - WALL + 8, y + 16); c.lineTo(A.w - WALL + 8, y + 30); c.lineTo(A.w - 8, y + 14); c.closePath(); c.fill();
    }
    c.fillStyle = NR.config.INK;
    c.fillRect(WALL, WALL, A.w - WALL * 2, 3); c.fillRect(WALL, A.h - WALL - 3, A.w - WALL * 2, 3); c.fillRect(WALL, WALL, 3, A.h - WALL * 2); c.fillRect(A.w - WALL - 3, WALL, 3, A.h - WALL * 2);
    c.fillStyle = lip;
    c.fillRect(WALL + 3, WALL + 3, A.w - WALL * 2 - 6, 2); c.fillRect(WALL + 3, WALL + 3, 2, A.h - WALL * 2 - 6);
    if (!propCache) propCache = scrapProps();
    for (let i = 0; i < propCache.length; i++) { const pr = propCache[i]; if (pr.x + 50 < rx || pr.x - 50 > rx + rw || pr.y + 50 < ry || pr.y - 50 > ry + rh) continue; drawProp(c, pr, pal); }
  }

  // ---------- frost: glacier slabs under drifted snow, hairline cracks, ice crystal clusters, icicled rock walls ----------
  function propList(key, n, band) {
    const A = NR.config.ARENA, list = [], rnd = rngFor('props:' + key);
    for (let i = 0; i < n; i++) {
      const side = (rnd() * 4) | 0, along = rnd(), off = WALL + 16 + rnd() * band;
      const x = side < 2 ? 60 + along * (A.w - 120) : (side === 2 ? off : A.w - off), y = side < 2 ? (side === 0 ? off : A.h - off) : 60 + along * (A.h - 120);
      list.push({ k: (rnd() * 4) | 0, x: x, y: y, r: 12 + rnd() * 18, a: rnd() * TAU, s: rnd() });
    }
    return list;
  }
  const PROPS2 = {};
  function crystal(c, x, y, r, a, light, mid, dark) {
    const ink = NR.config.INK;
    for (let i = 0; i < 3; i++) {
      const an = a + (i - 1) * 0.55, L = r * (i === 1 ? 1.5 : 1), w = r * 0.32, bx = x + Math.cos(an + Math.PI / 2) * (i - 1) * r * 0.25, by = y;
      const tx = bx + Math.cos(an - Math.PI / 2) * L, ty = by + Math.sin(an - Math.PI / 2) * L;
      const nx = Math.cos(an) * w, ny = Math.sin(an) * w;
      c.beginPath(); c.moveTo(bx - nx, by - ny); c.lineTo(tx - nx * 0.6, ty - ny * 0.6); c.lineTo(tx + Math.cos(an - Math.PI / 2) * w, ty + Math.sin(an - Math.PI / 2) * w); c.lineTo(tx + nx * 0.6, ty + ny * 0.6); c.lineTo(bx + nx, by + ny); c.closePath();
      c.fillStyle = mid; c.fill(); c.lineWidth = 2; c.strokeStyle = ink; c.stroke();
      c.beginPath(); c.moveTo(bx - nx * 0.2, by - ny * 0.2); c.lineTo(tx - nx * 0.45, ty - ny * 0.45); c.lineTo(tx + Math.cos(an - Math.PI / 2) * w * 0.7, ty + Math.sin(an - Math.PI / 2) * w * 0.7); c.lineTo(bx + nx * 0.2, by + ny * 0.2); c.closePath();
      c.fillStyle = light; c.fill();
      c.beginPath(); c.moveTo(bx + nx * 0.25, by + ny * 0.25); c.lineTo(tx + nx * 0.5, ty + ny * 0.5); c.lineTo(bx + nx, by + ny); c.closePath(); c.fillStyle = dark; c.fill();
    }
  }
  function paintFrost(c, pal, rx, ry, rw, rh) {
    const A = NR.config.ARENA, art = NR.fx.art, TL = 160;
    const g0 = art.mix(pal[0], '#1C2533', 0.2), g1 = art.mix(pal[1], '#1C2533', 0.32), seam = NR.util.shade(g0, -0.3);
    c.fillStyle = seam; c.fillRect(rx, ry, rw, rh);
    const t0x = Math.floor(rx / TL), t0y = Math.floor(ry / TL), t1x = Math.floor((rx + rw) / TL), t1y = Math.floor((ry + rh) / TL);
    for (let ty = t0y; ty <= t1y; ty++) for (let tx = t0x; tx <= t1x; tx++) {
      const x0 = tx * TL, y0 = ty * TL, h = h2(tx, ty, 21), fill = tc(h < 0.35 ? g1 : g0, (h2(tx, ty, 22) - 0.5) * 0.05);
      // slightly irregular slab (corners nudged), bevel light top-left, shade bottom-right
      const j = function (k) { return (h2(tx, ty, k) - 0.5) * 10; };
      c.beginPath(); c.moveTo(x0 + 3 + j(1), y0 + 3 + j(2)); c.lineTo(x0 + TL - 3 + j(3), y0 + 3 + j(4)); c.lineTo(x0 + TL - 3 + j(5), y0 + TL - 3 + j(6)); c.lineTo(x0 + 3 + j(7), y0 + TL - 3 + j(8)); c.closePath();
      c.fillStyle = fill; c.fill();
      c.lineWidth = 2; c.strokeStyle = tc(fill, 0.1); c.stroke();
      // snow lying on the slab
      if (h2(tx, ty, 23) < 0.55) art.glow(c, x0 + 30 + h2(tx, ty, 24) * 100, y0 + 30 + h2(tx, ty, 25) * 100, 50 + h2(tx, ty, 26) * 50, '#EAF4FB', 0.1);
      // hairline frost cracks (low contrast)
      if (h2(tx, ty, 27) < 0.4) {
        c.strokeStyle = 'rgba(234,244,251,0.13)'; c.lineWidth = 1.3; c.beginPath();
        let cx = x0 + 20 + h2(tx, ty, 28) * 60, cy = y0 + 20 + h2(tx, ty, 29) * 60; c.moveTo(cx, cy);
        for (let q = 0; q < 4; q++) { cx += 14 + h2(tx, ty, 30 + q) * 22; cy += (h2(tx, ty, 40 + q) - 0.3) * 30; c.lineTo(cx, cy); if (q === 1) { c.moveTo(cx, cy); c.lineTo(cx - 10, cy + 22); c.moveTo(cx, cy); } }
        c.stroke();
      }
      // sparkle specks
      c.fillStyle = 'rgba(234,244,251,0.35)';
      for (let q = 0; q < 4; q++) c.fillRect(x0 + h2(tx, ty, 50 + q) * TL, y0 + h2(tx, ty, 60 + q) * TL, 2, 2);
      if (h2(tx, ty, 70) < 0.06) art.glow(c, x0 + TL / 2, y0 + TL / 2, 170, '#7FD3F0', 0.08);
    }
    // icy rock wall with a snow cap and icicles
    const wall = art.mix(pal[2], '#0E141E', 0.15), cap = '#DCEAF4';
    c.fillStyle = wall; c.fillRect(0, 0, A.w, WALL); c.fillRect(0, A.h - WALL, A.w, WALL); c.fillRect(0, 0, WALL, A.h); c.fillRect(A.w - WALL, 0, WALL, A.h);
    c.fillStyle = 'rgba(220,234,244,0.55)'; c.fillRect(0, 0, A.w, 8); c.fillRect(0, 0, 8, A.h); c.fillRect(A.w - 8, 0, 8, A.h);
    c.fillStyle = NR.config.INK; c.fillRect(WALL, WALL, A.w - WALL * 2, 3); c.fillRect(WALL, A.h - WALL - 3, A.w - WALL * 2, 3); c.fillRect(WALL, WALL, 3, A.h - WALL * 2); c.fillRect(A.w - WALL - 3, WALL, 3, A.h - WALL * 2);
    c.fillStyle = cap;
    for (let x = WALL + 10; x < A.w - WALL; x += 26) { if (x + 30 < rx || x - 30 > rx + rw) continue; const L = 8 + h2(x, 1, 3) * 16; c.beginPath(); c.moveTo(x - 5, WALL + 2); c.lineTo(x, WALL + 2 + L); c.lineTo(x + 5, WALL + 2); c.closePath(); c.fill(); }
    for (let y = WALL + 10; y < A.h - WALL; y += 26) { if (y + 30 < ry || y - 30 > ry + rh) continue; const L = 6 + h2(y, 2, 3) * 12; c.beginPath(); c.moveTo(WALL + 2, y - 4); c.lineTo(WALL + 2 + L, y); c.lineTo(WALL + 2, y + 4); c.closePath(); c.fill(); c.beginPath(); c.moveTo(A.w - WALL - 2, y - 4); c.lineTo(A.w - WALL - 2 - L, y); c.lineTo(A.w - WALL - 2, y + 4); c.closePath(); c.fill(); }
    const P = PROPS2.frost || (PROPS2.frost = propList('frost', 60, 80));
    for (let i = 0; i < P.length; i++) {
      const pr = P[i]; if (pr.x + 60 < rx || pr.x - 60 > rx + rw || pr.y + 60 < ry || pr.y - 60 > ry + rh) continue;
      c.fillStyle = 'rgba(11,10,18,0.3)'; c.beginPath(); c.ellipse(pr.x + 3, pr.y + 4, pr.r * 1.1, pr.r * 0.45, 0, 0, TAU); c.fill();
      if (pr.k < 2) { crystal(c, pr.x, pr.y, pr.r, (pr.s - 0.5) * 0.6, '#EAF8FF', '#8FC1E3', '#4F7FA6'); art.glow(c, pr.x, pr.y - pr.r * 0.6, pr.r * 2.4, '#7FD3F0', 0.1); }
      else if (pr.k === 2) { // snow-capped rock
        c.beginPath(); c.moveTo(pr.x - pr.r, pr.y + pr.r * 0.3); c.lineTo(pr.x - pr.r * 0.6, pr.y - pr.r * 0.6); c.lineTo(pr.x + pr.r * 0.3, pr.y - pr.r * 0.8); c.lineTo(pr.x + pr.r, pr.y + pr.r * 0.2); c.lineTo(pr.x + pr.r * 0.2, pr.y + pr.r * 0.6); c.closePath();
        c.fillStyle = '#4A5A72'; c.fill(); c.lineWidth = 2; c.strokeStyle = NR.config.INK; c.stroke();
        c.beginPath(); c.moveTo(pr.x - pr.r * 0.65, pr.y - pr.r * 0.5); c.lineTo(pr.x + pr.r * 0.3, pr.y - pr.r * 0.78); c.lineTo(pr.x + pr.r * 0.75, pr.y - pr.r * 0.1); c.quadraticCurveTo(pr.x, pr.y - pr.r * 0.25, pr.x - pr.r * 0.65, pr.y - pr.r * 0.5); c.fillStyle = '#EAF4FB'; c.fill();
      } else { // frozen barrel
        c.fillStyle = '#5C6E86'; c.fillRect(pr.x - pr.r * 0.55, pr.y - pr.r * 0.8, pr.r * 1.1, pr.r * 1.4); c.lineWidth = 2; c.strokeStyle = NR.config.INK; c.strokeRect(pr.x - pr.r * 0.55, pr.y - pr.r * 0.8, pr.r * 1.1, pr.r * 1.4);
        c.fillStyle = '#EAF4FB'; c.fillRect(pr.x - pr.r * 0.55, pr.y - pr.r * 0.8, pr.r * 1.1, pr.r * 0.28);
        c.fillStyle = '#9FD7EE'; c.fillRect(pr.x + pr.r * 0.1, pr.y - pr.r * 0.5, pr.r * 0.14, pr.r * 0.7);
      }
    }
  }

  // ---------- void: staggered obsidian flagstones, faint rune inlays, glowing rift seams, abyss pits, floating shards ----------
  function paintVoid(c, pal, rx, ry, rw, rh) {
    const A = NR.config.ARENA, art = NR.fx.art, TW = 150, TH = 100;
    const g0 = art.mix(pal[0], '#120C1C', 0.25), g1 = art.mix(pal[1], '#120C1C', 0.35), seam = '#0C0814';
    c.fillStyle = seam; c.fillRect(rx, ry, rw, rh);
    const r0 = Math.floor(ry / TH) - 1, r1 = Math.floor((ry + rh) / TH) + 1;
    for (let row = r0; row <= r1; row++) {
      const off = (row & 1) * TW / 2, c0 = Math.floor((rx - off) / TW) - 1, c1 = Math.floor((rx + rw - off) / TW) + 1;
      for (let col = c0; col <= c1; col++) {
        const x0 = col * TW + off, y0 = row * TH, h = h2(col, row, 81), fill = tc(h < 0.3 ? g1 : g0, (h2(col, row, 82) - 0.5) * 0.06);
        if (h2(col, row, 83) < 0.05) { // abyss pit: starfield in a dark hole
          c.fillStyle = '#05030A'; c.fillRect(x0 + 4, y0 + 4, TW - 8, TH - 8);
          c.fillStyle = 'rgba(241,224,255,0.7)'; for (let q = 0; q < 10; q++) c.fillRect(x0 + 8 + h2(col, row, 90 + q) * (TW - 16), y0 + 8 + h2(col, row, 100 + q) * (TH - 16), 1.6, 1.6);
          c.strokeStyle = 'rgba(162,92,224,0.5)'; c.lineWidth = 2; c.strokeRect(x0 + 4, y0 + 4, TW - 8, TH - 8);
          continue;
        }
        c.fillStyle = fill; c.fillRect(x0 + 3, y0 + 3, TW - 6, TH - 6);
        c.fillStyle = 'rgba(200,160,255,0.08)'; c.fillRect(x0 + 3, y0 + 3, TW - 6, 2);
        c.fillStyle = tc(fill, -0.18); c.fillRect(x0 + 3, y0 + TH - 5, TW - 6, 2);
        if (h2(col, row, 84) < 0.07) { // faint rune inlay
          const cx = x0 + TW / 2, cy = y0 + TH / 2;
          c.strokeStyle = 'rgba(162,92,224,0.15)'; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, 18 + h2(col, row, 89) * 10, 0, TAU);
          c.moveTo(cx, cy - 16); c.lineTo(cx + 12, cy + 10); c.lineTo(cx - 12, cy + 10); c.closePath(); c.stroke();
        }
        if (h2(col, row, 85) < 0.14) { // rift seam glowing faintly
          c.strokeStyle = 'rgba(232,106,166,0.35)'; c.lineWidth = 1.6; c.beginPath();
          let px = x0 + 10, py = y0 + 20 + h2(col, row, 86) * 60; c.moveTo(px, py);
          for (let q = 0; q < 5; q++) { px += 22 + h2(col, row, 87 + q) * 8; py += (h2(col, row, 95 + q) - 0.5) * 22; c.lineTo(px, py); }
          c.stroke();
          art.glow(c, x0 + TW / 2, y0 + TH / 2, 80, '#E86AA6', 0.06);
        }
      }
    }
    // ritual circle at the centre (faint)
    const cx = A.w / 2, cy = A.h / 2;
    if (rx < cx + 300 && rx + rw > cx - 300 && ry < cy + 300 && ry + rh > cy - 300) {
      c.strokeStyle = 'rgba(162,92,224,0.18)'; c.lineWidth = 4;
      c.beginPath(); c.arc(cx, cy, 260, 0, TAU); c.stroke(); c.beginPath(); c.arc(cx, cy, 220, 0, TAU); c.stroke();
      c.beginPath(); for (let i = 0; i < 7; i++) { const a1 = i / 7 * TAU, a2 = (i + 3) / 7 * TAU; c.moveTo(cx + Math.cos(a1) * 220, cy + Math.sin(a1) * 220); c.lineTo(cx + Math.cos(a2) * 220, cy + Math.sin(a2) * 220); } c.stroke();
      art.glow(c, cx, cy, 300, '#A25CE0', 0.07);
    }
    // abyss edge: dark rim with a violet lip
    c.fillStyle = '#07040C'; c.fillRect(0, 0, A.w, WALL); c.fillRect(0, A.h - WALL, A.w, WALL); c.fillRect(0, 0, WALL, A.h); c.fillRect(A.w - WALL, 0, WALL, A.h);
    c.fillStyle = '#8A5BD1'; c.fillRect(WALL, WALL, A.w - WALL * 2, 2); c.fillRect(WALL, A.h - WALL - 2, A.w - WALL * 2, 2); c.fillRect(WALL, WALL, 2, A.h - WALL * 2); c.fillRect(A.w - WALL - 2, WALL, 2, A.h - WALL * 2);
    const P = PROPS2.void || (PROPS2.void = propList('void', 55, 90));
    for (let i = 0; i < P.length; i++) {
      const pr = P[i]; if (pr.x + 60 < rx || pr.x - 60 > rx + rw || pr.y + 60 < ry || pr.y - 60 > ry + rh) continue;
      c.fillStyle = 'rgba(5,3,10,0.4)'; c.beginPath(); c.ellipse(pr.x + 3, pr.y + 6, pr.r, pr.r * 0.4, 0, 0, TAU); c.fill();
      if (pr.k < 2) { crystal(c, pr.x, pr.y, pr.r, (pr.s - 0.5) * 0.8, '#F1E0FF', '#8A5BD1', '#4A2A78'); art.glow(c, pr.x, pr.y - pr.r * 0.6, pr.r * 2.6, '#A25CE0', 0.12); }
      else if (pr.k === 2) { // broken pillar
        c.fillStyle = '#2E2340'; c.fillRect(pr.x - pr.r * 0.5, pr.y - pr.r * 1.2, pr.r, pr.r * 1.5); c.lineWidth = 2; c.strokeStyle = NR.config.INK; c.strokeRect(pr.x - pr.r * 0.5, pr.y - pr.r * 1.2, pr.r, pr.r * 1.5);
        c.fillStyle = '#3B2D52'; c.beginPath(); c.moveTo(pr.x - pr.r * 0.5, pr.y - pr.r * 1.2); c.lineTo(pr.x - pr.r * 0.1, pr.y - pr.r * 1.45); c.lineTo(pr.x + pr.r * 0.5, pr.y - pr.r * 1.15); c.closePath(); c.fill(); c.stroke();
        c.strokeStyle = 'rgba(232,106,166,0.6)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(pr.x - pr.r * 0.2, pr.y - pr.r); c.lineTo(pr.x + pr.r * 0.1, pr.y - pr.r * 0.5); c.lineTo(pr.x - pr.r * 0.1, pr.y); c.stroke();
      } else { // fleshy pod split open on a glowing seam
        c.fillStyle = '#3A1E3A'; c.beginPath(); c.ellipse(pr.x, pr.y, pr.r * 0.9, pr.r * 0.6, 0, 0, TAU); c.fill(); c.lineWidth = 2; c.strokeStyle = NR.config.INK; c.stroke();
        c.strokeStyle = '#E86AA6'; c.lineWidth = 2; c.beginPath(); c.moveTo(pr.x - pr.r * 0.5, pr.y); c.quadraticCurveTo(pr.x, pr.y - pr.r * 0.18, pr.x + pr.r * 0.5, pr.y); c.stroke();
      }
    }
  }

  // ---------- chunked floor cache ----------
  // The arena is cached as CHUNK x CHUNK world-px tiles baked at fs = min(render scale, quality cap) device px per
  // world px (<= 1024 px per side, under the iOS Safari canvas limits). Chunks bake on demand, at most BAKE_PER_FRAME
  // per frame; an unbaked chunk shows the plain ground colour for that frame.
  const CHUNK = 512, BAKE_PER_FRAME = 3;
  let chunks = null, chunkKey = '';
  function chunkScale() {
    const R = NR.fx.render, V = R.view ? R.view() : null, art = NR.fx.art;
    const k = V ? V.k : 1, cap = art ? art.quality().floorMax : 1;
    return Math.max(0.5, Math.min(cap, Math.round(k * 4) / 4));
  }
  function bakeChunk(i, j, zone, pal, fs) {
    const A = NR.config.ARENA, w = Math.min(CHUNK, A.w - i * CHUNK), h = Math.min(CHUNK, A.h - j * CHUNK);
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(w * fs); cv.height = Math.ceil(h * fs);
    const c = cv.getContext('2d');
    if (!c) return null;
    c.setTransform(fs, 0, 0, fs, -i * CHUNK * fs, -j * CHUNK * fs);
    c.beginPath(); c.rect(i * CHUNK, j * CHUNK, w, h); c.clip();
    paint(c, zone, pal, i * CHUNK, j * CHUNK, w, h);
    return { img: cv, x: i * CHUNK, y: j * CHUNK, w: w, h: h };
  }
  function drawChunks(ctx, zone, pal, vw, vh) {
    const A = NR.config.ARENA;
    if (typeof document === 'undefined' || !document.createElement) { paint(ctx, zone, pal, 0, 0, A.w, A.h); return; }
    const fs = chunkScale(), key = zone + '|' + fs;
    const nx = Math.ceil(A.w / CHUNK), ny = Math.ceil(A.h / CHUNK);
    if (key !== chunkKey || !chunks) { chunkKey = key; chunks = new Array(nx * ny); for (let n = 0; n < chunks.length; n++) chunks[n] = null; }
    const i0 = Math.max(0, Math.floor(view.x / CHUNK)), j0 = Math.max(0, Math.floor(view.y / CHUNK));
    const i1 = Math.min(nx - 1, Math.floor((view.x + vw) / CHUNK)), j1 = Math.min(ny - 1, Math.floor((view.y + vh) / CHUNK));
    let baked = 0;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      let ch = chunks[j * nx + i];
      if (!ch && baked < BAKE_PER_FRAME) { ch = chunks[j * nx + i] = bakeChunk(i, j, zone, pal, fs); baked++; }
      if (ch) ctx.drawImage(ch.img, ch.x, ch.y, ch.w, ch.h);
      else { ctx.fillStyle = pal[0]; ctx.fillRect(i * CHUNK, j * CHUNK, Math.min(CHUNK, A.w - i * CHUNK), Math.min(CHUNK, A.h - j * CHUNK)); }
    }
  }
  function chunkStats() { let n = 0, maxSide = 0; if (chunks) for (let i = 0; i < chunks.length; i++) if (chunks[i]) { n++; maxSide = Math.max(maxSide, chunks[i].img.width, chunks[i].img.height); } return { baked: n, maxSide: maxSide }; }

  // ---------- decals ----------
  function decal(kind, x, y, r, color) {
    const cap = NR.config.CAPS.decals;
    while (decals.length >= cap) decals.shift();
    const blobs = [], n = kind === 'scorch' ? 9 : 5, scorch = kind === 'scorch';
    let s = ((x * 7919 + y * 104729) | 0) >>> 0 || 1;
    const rn = function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    for (let i = 0; i < n; i++) {
      const a = scorch ? i / n * TAU : rn() * TAU;
      blobs.push(scorch ? [Math.cos(a), Math.sin(a), 0.78 + rn() * 0.3] : [Math.cos(a) * (0.55 + rn() * 0.5), Math.sin(a) * (0.55 + rn() * 0.5), 0.2 + rn() * 0.22]);
    }
    decals.push({ kind: scorch ? 'scorch' : 'splat', x: x, y: y, r: r, color: color || NR.config.INK, t: 0, life: scorch ? 18 : 12, a0: scorch ? 0.5 : 0.6, blobs: blobs });
  }
  function drawDecals(c, pal, w, h) {
    const x0 = view.x - 160, y0 = view.y - 160, x1 = view.x + w + 160, y1 = view.y + h + 160;
    for (let i = 0; i < decals.length; i++) {
      const d = decals[i];
      if (d.x < x0 || d.x > x1 || d.y < y0 || d.y > y1) continue;
      const left = d.life - d.t;
      c.globalAlpha = d.a0 * (left < 4 ? left / 4 : 1);
      c.fillStyle = d.color;
      if (d.kind === 'scorch') {
        c.beginPath();
        for (let k = 0; k < d.blobs.length; k++) { const b = d.blobs[k], px = d.x + b[0] * d.r * b[2], py = d.y + b[1] * d.r * b[2]; if (k) c.lineTo(px, py); else c.moveTo(px, py); }
        c.closePath(); c.fill();
        c.fillStyle = pal[2]; c.beginPath(); c.arc(d.x, d.y, d.r * 0.5, 0, TAU); c.fill();
      } else {
        c.beginPath(); c.arc(d.x, d.y, d.r * 0.55, 0, TAU); c.fill();
        for (let k = 0; k < d.blobs.length; k++) { const b = d.blobs[k]; c.beginPath(); c.arc(d.x + b[0] * d.r, d.y + b[1] * d.r, d.r * b[2], 0, TAU); c.fill(); }
      }
    }
    c.globalAlpha = 1;
  }

  // ---------- telegraphs ----------
  function typeOf(kind) {
    const k = String(kind || '');
    if (/line|beam|lunge|dash|charge|shot|snipe|laser|bolt|spit|lance|pierce|rush/.test(k)) return 'line';
    if (/cone|sweep|swipe|slash|breath|fan|cleave/.test(k)) return 'cone';
    return 'zone';
  }
  // telegraph(kind, x, y, r, time, o{angle,w,arc,color,follow})
  function telegraph(kind, x, y, r, time, o) {
    o = o || {};
    if (tele.length >= 48) tele.shift();
    const type = typeOf(kind);
    tele.push({
      type: type, x: x, y: y, r: Math.max(10, r || 60), t: 0, time: Math.max(0.15, time || 0.6), angle: o.angle || 0, w: o.w || 28, arc: o.arc || 1.1,
      color: o.color || null, ent: o.follow || null, eid: o.follow ? o.follow.id : 0
    });
  }
  function onAttack(e) {
    const en = e.enemy, W = NR.world.get(), p = W.player;
    const ang = p && !p.dead ? Math.atan2(p.y - e.y, p.x - e.x) : (en && en.rot) || 0;
    telegraph(e.kind, e.x, e.y, e.r, e.time, { angle: ang, w: Math.max(20, ((en && en.r) || 10) * 1.7), follow: en });
  }
  // telegraphs (SPEC 12 priority 1): striped danger fill, a solid inner fill that grows to the hit moment, and a thick
  // two-tone rim (ink + hot magenta) that reads on every zone; no blinking, so reduceFlashing changes nothing but tint.
  let patCtx = null, pat = null, patCalm = null;
  function pattern(c, calm) {
    if (patCtx !== c) { patCtx = c; pat = null; patCalm = null; }
    const art = NR.fx.art;
    if (!art || !c.createPattern) return null;
    if (calm) { if (!patCalm) { const img = art.stripes(true); patCalm = img ? c.createPattern(img, 'repeat') : null; } return patCalm; }
    if (!pat) { const img = art.stripes(false); pat = img ? c.createPattern(img, 'repeat') : null; }
    return pat;
  }
  function teleShape(c, T, R) {
    c.beginPath();
    if (T.type === 'line') c.rect(0, -T.w / 2, R, T.w);
    else if (T.type === 'cone') { c.moveTo(T.x, T.y); c.arc(T.x, T.y, R, T.angle - T.arc / 2, T.angle + T.arc / 2); c.closePath(); }
    else c.arc(T.x, T.y, R, 0, TAU);
  }
  function drawTele(c, pal) {
    const art = NR.fx.art, calm = !!NR.save.getSettings().reduceFlashing, col = art ? (calm ? art.T.teleCalm : art.T.tele) : pal[4];
    const pt = pattern(c, calm);
    for (let i = 0; i < tele.length; i++) {
      const T = tele[i], f = Math.min(1, T.t / T.time);
      const line = T.type === 'line';
      if (line) { c.save(); c.translate(T.x, T.y); c.rotate(T.angle); }
      teleShape(c, T, T.r);
      if (pt) { c.fillStyle = pt; c.fill(); } else { c.globalAlpha = 0.18; c.fillStyle = col; c.fill(); c.globalAlpha = 1; }
      c.globalAlpha = 0.28 + 0.2 * f; c.fillStyle = T.color || col; teleShape(c, T, T.r * f); c.fill(); c.globalAlpha = 1;
      teleShape(c, T, T.r);
      c.lineJoin = 'round'; c.lineWidth = 6; c.strokeStyle = NR.config.INK; c.stroke();
      c.lineWidth = 3; c.strokeStyle = T.color || col; c.stroke();
      if (line) c.restore();
      if (art && !line) art.light(T.x, T.y, T.r * 1.1, col, 0.18 + 0.25 * f);
    }
    c.globalAlpha = 1;
  }

  function update(dt) {
    for (let i = decals.length - 1; i >= 0; i--) { const d = decals[i]; d.t += dt; if (d.t >= d.life) decals.splice(i, 1); }
    for (let i = tele.length - 1; i >= 0; i--) {
      const T = tele[i]; T.t += dt;
      if (T.ent && T.ent.id === T.eid && !T.ent.dead && T.type !== 'zone') { T.x = T.ent.x; T.y = T.ent.y; }
      if (T.t >= T.time + 0.06 || (T.ent && (T.ent.id !== T.eid || T.ent.dead) && T.t < T.time * 0.98 && T.type !== 'zone')) tele.splice(i, 1);
    }
  }
  function draw(ctx) {
    const R = NR.fx.render, zone = R.zone(), pal = R.palette(), sz = R.size();
    NR.camera.toWorld(0, 0, view);
    drawChunks(ctx, zone, pal, sz.w, sz.h);
    drawDecals(ctx, pal, sz.w, sz.h);
    drawTele(ctx, pal);
  }
  function clear() { decals.length = 0; tele.length = 0; }
  NR.fx = NR.fx || {};
  NR.fx.floor = { init: init, update: update, draw: draw, decal: decal, telegraph: telegraph, clear: clear, decalCount: function () { return decals.length; }, teleCount: function () { return tele.length; }, chunkStats: chunkStats };
})();
