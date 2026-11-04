'use strict';
// Dev-only stress benchmark: opens index.html?stress=1 over file:// in headless Chromium and measures, for each
// graphics quality, the real FPS and the CPU time spent inside NR.fx.render.draw (incl. the HUD) per frame.
//   node tools/fps.js [--q low,medium,high,auto] [--w 1280 --h 720 --dpr 1] [--secs 6]
// Headless Chromium uses a software rasteriser, so numbers are only comparable with each other (before/after),
// not with real hardware.
const path = require('path');
const pw = require('playwright');
function arg(n, d) { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; }
const qs = String(arg('q', 'default')).split(',');
const W = +arg('w', 1280), H = +arg('h', 720), DPR = +arg('dpr', 1), SECS = +arg('secs', 6);

(async function () {
  const browser = await pw.chromium.launch();
  const rows = [];
  for (const q of qs) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
    const page = await ctx.newPage();
    if (q !== 'default') {
      await page.addInitScript(function (qq) {
        try { localStorage.setItem('shardfall.save', JSON.stringify({ v: 1, settings: { quality: qq } })); } catch (e) { /* ignore */ }
      }, q);
    }
    await page.goto('file://' + path.join(__dirname, '..', 'index.html') + '?stress=1');
    await page.waitForTimeout(1500);
    const r = await page.evaluate(function (secs) {
      return new Promise(function (done) {
        const R = NR.fx.render, orig = R.draw, ms = [];
        R.draw = function (Wd, a) { const t0 = performance.now(); orig.call(R, Wd, a); ms.push(performance.now() - t0); };
        let frames = 0; const t0 = performance.now();
        function f() { frames++; if (performance.now() - t0 < secs * 1000) requestAnimationFrame(f); else end(); }
        function end() {
          R.draw = orig;
          ms.sort(function (a, b) { return a - b; });
          const avg = ms.reduce(function (a, b) { return a + b; }, 0) / ms.length;
          const W = NR.world.get();
          done({
            fps: +(frames / secs).toFixed(1), renderAvg: +avg.toFixed(2), render95: +ms[Math.floor(ms.length * 0.95)].toFixed(2),
            enemies: W.enemies.length, proj: W.projectiles.length,
            canvas: document.getElementById('game').width + 'x' + document.getElementById('game').height
          });
        }
        requestAnimationFrame(f);
      });
    }, SECS);
    r.quality = q;
    rows.push(r);
    console.log(JSON.stringify(r));
    await ctx.close();
  }
  await browser.close();
})().catch(function (e) { console.error(e); process.exit(1); });
