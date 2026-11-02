(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  let map = Object.create(null);
  // Copy-on-write listener arrays: emit iterates a stable array even if listeners (un)subscribe.
  function on(name, fn) {
    const a = map[name];
    map[name] = a ? a.concat([fn]) : [fn];
    return function () { off(name, fn); };
  }
  function off(name, fn) {
    const a = map[name];
    if (!a) return;
    const i = a.indexOf(fn);
    if (i < 0) return;
    if (a.length === 1) delete map[name]; else { const b = a.slice(); b.splice(i, 1); map[name] = b; }
  }
  function emit(name, payload) {
    const a = map[name];
    if (!a) return;
    for (let i = 0; i < a.length; i++) a[i](payload, name);
  }
  function clearAll() { map = Object.create(null); }
  NR.events = { on, off, emit, clearAll };
})();
