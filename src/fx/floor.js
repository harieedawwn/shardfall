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
  function drawTele(c, pal) {
    for (let i = 0; i < tele.length; i++) {
      const T = tele[i], f = Math.min(1, T.t / T.time), col = T.color || pal[4];
      c.fillStyle = col; c.strokeStyle = col; c.lineJoin = 'round';
      if (T.type === 'line') {
        c.save(); c.translate(T.x, T.y); c.rotate(T.angle);
        c.globalAlpha = 0.18; c.fillRect(0, -T.w / 2, T.r, T.w);
        c.globalAlpha = 0.5; c.fillRect(0, -T.w / 2, T.r * f, T.w);
        c.globalAlpha = 1; c.lineWidth = 3; c.strokeRect(0, -T.w / 2, T.r, T.w);
        c.restore();
      } else if (T.type === 'cone') {
        const a0 = T.angle - T.arc / 2, a1 = T.angle + T.arc / 2;
        c.globalAlpha = 0.18; c.beginPath(); c.moveTo(T.x, T.y); c.arc(T.x, T.y, T.r, a0, a1); c.closePath(); c.fill();
        c.globalAlpha = 0.5; c.beginPath(); c.moveTo(T.x, T.y); c.arc(T.x, T.y, T.r * f, a0, a1); c.closePath(); c.fill();
        c.globalAlpha = 1; c.lineWidth = 3; c.beginPath(); c.moveTo(T.x, T.y); c.arc(T.x, T.y, T.r, a0, a1); c.closePath(); c.stroke();
      } else {
        c.globalAlpha = 0.18; c.beginPath(); c.arc(T.x, T.y, T.r, 0, TAU); c.fill();
        c.globalAlpha = 0.5; c.beginPath(); c.arc(T.x, T.y, T.r * f, 0, TAU); c.fill();
        c.globalAlpha = 1; c.lineWidth = 3; c.beginPath(); c.arc(T.x, T.y, T.r, 0, TAU); c.stroke();
      }
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
