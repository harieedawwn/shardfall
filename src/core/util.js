(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function dist2(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; }
  function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
  function hex2(n) { n = Math.round(clamp(n, 0, 255)); return (n < 16 ? '0' : '') + n.toString(16).toUpperCase(); }
  // amt < 0: toward black, amt > 0: toward white
  function shade(hex, amt) {
    const h = String(hex).replace('#', '');
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    const t = clamp(Math.abs(amt), 0, 1), to = amt < 0 ? 0 : 255;
    return '#' + hex2(r + (to - r) * t) + hex2(g + (to - g) * t) + hex2(b + (to - b) * t);
  }
  function hash(v) { // FNV-1a over a string or a number, unsigned 32-bit
    const s = typeof v === 'string' ? v : String(v);
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  function clone(o) {
    if (o === null || typeof o !== 'object') return o;
    if (Array.isArray(o)) { const a = new Array(o.length); for (let i = 0; i < o.length; i++) a[i] = clone(o[i]); return a; }
    const r = {};
    for (const k in o) r[k] = clone(o[k]);
    return r;
  }
  const EASE = {
    linear: t => t,
    inQuad: t => t * t,
    outQuad: t => 1 - (1 - t) * (1 - t),
    inOutQuad: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    outCubic: t => 1 - Math.pow(1 - t, 3),
    outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    outElastic: t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1
  };
  function ease(name, t) { const f = EASE[name] || EASE.linear; return f(clamp(t, 0, 1)); }
  function fmt(n) {
    const a = Math.abs(n);
    if (a >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (a >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (a >= 1e4) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(Math.round(n));
  }
  NR.util = { clamp, lerp, dist2, angleTo, shade, hash, clone, ease, fmt };
})();
