(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  // make(factory, resetFn, cap) -> {get(), free(o), live}
  function make(factory, resetFn, cap) {
    const stack = [];
    let created = 0;
    const pool = {
      live: 0,
      get() {
        if (pool.live >= cap) return null;
        let o;
        if (stack.length) o = stack.pop();
        else { o = factory(); created++; }
        o._free = false;
        if (resetFn) resetFn(o);
        pool.live++;
        return o;
      },
      free(o) {
        if (!o || o._free) return;
        o._free = true;
        stack.push(o);
        pool.live--;
      },
      get created() { return created; }
    };
    return pool;
  }
  NR.pool = { make };
})();
