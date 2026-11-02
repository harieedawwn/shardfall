(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  let s = 1;
  function seed(n) { s = (Number(n) >>> 0) || 0x9e3779b9; }
  function next() { // mulberry32
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function int(a, b) { return a + Math.floor(next() * (b - a + 1)); }
  function range(a, b) { return a + next() * (b - a); }
  function chance(p) { return next() < p; }
  function pick(arr) { return arr.length ? arr[Math.floor(next() * arr.length)] : undefined; }
  function weighted(arr, fn) {
    let total = 0;
    for (let i = 0; i < arr.length; i++) total += Math.max(0, fn ? fn(arr[i], i) : arr[i]);
    if (total <= 0) return arr.length ? arr[0] : undefined;
    let r = next() * total;
    for (let i = 0; i < arr.length; i++) {
      r -= Math.max(0, fn ? fn(arr[i], i) : arr[i]);
      if (r < 0) return arr[i];
    }
    return arr[arr.length - 1];
  }
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function getState() { return s >>> 0; }
  function setState(v) { s = v >>> 0; }
  NR.rng = { seed, next, int, range, chance, pick, weighted, shuffle, getState, setState };
})();
