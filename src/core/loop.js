(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  const MAX_STEPS = 5;      // catch-up cap per rendered frame
  const MAX_FRAME = 0.25;   // real seconds per frame considered at most
  let cb = { step: null, frame: null, draw: null };
  let running = false, raf = 0, last = 0, acc = 0, holdT = 0, slowS = 1, slowT = 0, fpsV = 60, hooked = false;

  function now() { const p = globalThis.performance; return p && p.now ? p.now() : Date.now(); }
  function setCallbacks(c) { cb = { step: c.step || null, frame: c.frame || null, draw: c.draw || null }; }
  function hitStop(sec) { if (sec > holdT) holdT = sec; }
  function slowMo(scale, sec) { slowS = scale; slowT = Math.max(slowT, sec); }
  function fps() { return fpsV; }

  function tick(t) {
    if (!running) return;
    raf = globalThis.requestAnimationFrame(tick);
    let real = (t - last) / 1000; last = t;
    if (!(real > 0)) real = 0;
    if (real > MAX_FRAME) real = MAX_FRAME;
    if (real > 0) fpsV += (1 / real - fpsV) * 0.1;
    const STEP = NR.config.STEP;
    let sim = real;
    if (holdT > 0) { holdT -= real; sim = 0; }
    if (slowT > 0) { slowT -= real; sim *= slowS; if (slowT <= 0) slowS = 1; }
    acc += sim;
    if (acc > MAX_STEPS * STEP) acc = MAX_STEPS * STEP;
    let n = 0;
    while (acc >= STEP && n < MAX_STEPS) { if (cb.step) cb.step(STEP); acc -= STEP; n++; }
    const alpha = acc / STEP;
    if (cb.frame) cb.frame(real, alpha);
    if (cb.draw) cb.draw(alpha);
  }

  function autoPause() {
    acc = 0; last = now();
    const r = NR.run;
    if (r && r.getState) {
      const s = r.getState();
      if (s === 'wave' || s === 'clear') r.togglePause();
    }
  }
  function hook() {
    if (hooked) return;
    hooked = true;
    const g = globalThis;
    if (g.document && g.document.addEventListener) {
      g.document.addEventListener('visibilitychange', function () { if (g.document.hidden) autoPause(); else { last = now(); acc = 0; } });
    }
    if (g.addEventListener) {
      g.addEventListener('blur', autoPause);
      g.addEventListener('focus', function () { last = now(); acc = 0; });
    }
  }
  function start() {
    if (running) return;
    hook();
    running = true; acc = 0; last = now();
    if (globalThis.requestAnimationFrame) raf = globalThis.requestAnimationFrame(tick);
  }
  function stop() {
    running = false;
    if (globalThis.cancelAnimationFrame && raf) globalThis.cancelAnimationFrame(raf);
  }
  NR.loop = { setCallbacks, start, stop, hitStop, slowMo, fps };
})();
