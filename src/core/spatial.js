(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  const CELL = 64;
  let cols = 1, rows = 1, head = new Int32Array(1).fill(-1), nxt = new Int32Array(512).fill(-1);
  let ents = [], count = 0, maxR = 0;

  function cellX(x) { const c = (x / CELL) | 0; return c < 0 ? 0 : c >= cols ? cols - 1 : c; }
  function cellY(y) { const c = (y / CELL) | 0; return c < 0 ? 0 : c >= rows ? rows - 1 : c; }

  function rebuild(W) {
    const A = NR.config.ARENA;
    const nc = Math.ceil(A.w / CELL), nr = Math.ceil(A.h / CELL);
    if (nc !== cols || nr !== rows) { cols = nc; rows = nr; head = new Int32Array(cols * rows); }
    head.fill(-1);
    const list = W.enemies;
    if (nxt.length < list.length) nxt = new Int32Array(list.length * 2);
    ents = list; count = list.length; maxR = 0;
    for (let i = 0; i < count; i++) {
      const e = list[i];
      if (e.dead || (e.flags && e.flags.structure)) { nxt[i] = -2; continue; } // structures (turrets) cannot be hit or targeted
      if (e.r > maxR) maxR = e.r;
      const c = cellY(e.y) * cols + cellX(e.x);
      nxt[i] = head[c]; head[c] = i;
    }
  }

  function circle(x, y, r, out) {
    out.length = 0;
    const m = r + maxR;
    const x0 = cellX(x - m), x1 = cellX(x + m), y0 = cellY(y - m), y1 = cellY(y + m);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      let g = count;
      for (let i = head[cy * cols + cx]; i >= 0 && --g >= 0; i = nxt[i]) {
        const e = ents[i];
        if (!e) continue;
        const dx = e.x - x, dy = e.y - y, rr = r + e.r;
        if (dx * dx + dy * dy <= rr * rr) out.push(e);
      }
    }
    return out.length;
  }

  // width w centred on the segment: hit when distance to segment <= w/2 + e.r
  function line(x1, y1, x2, y2, w, out) {
    out.length = 0;
    const hw = w * 0.5, m = hw + maxR;
    const minX = (x1 < x2 ? x1 : x2) - m, maxX = (x1 < x2 ? x2 : x1) + m;
    const minY = (y1 < y2 ? y1 : y2) - m, maxY = (y1 < y2 ? y2 : y1) + m;
    const x0 = cellX(minX), xe = cellX(maxX);
    const y0 = cellY(minY), ye = cellY(maxY);
    const sx = x2 - x1, sy = y2 - y1, L2 = sx * sx + sy * sy, invL2 = L2 > 0 ? 1 / L2 : 0;
    if (x0 === xe && y0 === ye) {
      let g = count;
      const idx = y0 * cols + x0;
      for (let i = head[idx]; i >= 0 && --g >= 0; i = nxt[i]) {
        const e = ents[i];
        if (!e) continue;
        const ex = e.x, ey = e.y;
        if (ex < minX || ex > maxX || ey < minY || ey > maxY) continue;
        let t = ((ex - x1) * sx + (ey - y1) * sy) * invL2;
        if (t < 0) t = 0; else if (t > 1) t = 1;
        const px = x1 + sx * t - ex, py = y1 + sy * t - ey, rr = hw + e.r;
        if (px * px + py * py <= rr * rr) out.push(e);
      }
      return out.length;
    }
    for (let cy = y0; cy <= ye; cy++) {
      const row = cy * cols;
      for (let cx = x0; cx <= xe; cx++) {
        let g = count;
        for (let i = head[row + cx]; i >= 0 && --g >= 0; i = nxt[i]) {
          const e = ents[i];
          if (!e) continue;
          const ex = e.x, ey = e.y;
          if (ex < minX || ex > maxX || ey < minY || ey > maxY) continue;
          let t = ((ex - x1) * sx + (ey - y1) * sy) * invL2;
          if (t < 0) t = 0; else if (t > 1) t = 1;
          const px = x1 + sx * t - ex, py = y1 + sy * t - ey, rr = hw + e.r;
          if (px * px + py * py <= rr * rr) out.push(e);
        }
      }
    }
    return out.length;
  }

  function nearest(x, y, r, filterFn) {
    const m = r + maxR;
    const x0 = cellX(x - m), x1 = cellX(x + m), y0 = cellY(y - m), y1 = cellY(y + m);
    let best = null, bd = Infinity;
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      let g = count;
      for (let i = head[cy * cols + cx]; i >= 0 && --g >= 0; i = nxt[i]) {
        const e = ents[i];
        if (!e) continue;
        const dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy, rr = r + e.r;
        if (d <= rr * rr && d < bd && (!filterFn || filterFn(e))) { bd = d; best = e; }
      }
    }
    return best;
  }
  NR.spatial = { rebuild, circle, line, nearest };
})();
