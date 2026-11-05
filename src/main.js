(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  let booted = false;

  function initAll(list, arg) {
    for (let i = 0; i < list.length; i++) {
      const m = list[i].split('.');
      let o = NR;
      for (let j = 0; j < m.length && o; j++) o = o[m[j]];
      if (o && o.init) o.init(arg);
    }
  }
  // ?stress=1: 400 enemies, 600 projectiles, 1500 particles
  function stress() {
    const W = NR.world.get(), A = NR.config.ARENA, C = NR.config.CAPS, rng = NR.rng;
    const ids = Object.keys(NR.data.enemies);
    for (let i = 0; i < C.enemies; i++) NR.enemies.spawn(ids[i % ids.length], rng.range(100, A.w - 100), rng.range(100, A.h - 100), {});
    for (let i = 0; i < C.proj; i++) {
      const a = rng.range(0, 6.283);
      NR.projectiles.spawn({ team: 'enemy', x: rng.range(100, A.w - 100), y: rng.range(100, A.h - 100), vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, r: 5, dmg: 1, life: 3600 });
    }
    const fp = NR.fx && NR.fx.particles;
    if (fp) for (let i = 0; i < C.particles / 10; i++) fp.burst('hit', W.player.x + rng.range(-300, 300), W.player.y + rng.range(-200, 200), '#FFD43B', 10, {});
  }

  function boot() {
    if (booted) return;
    booted = true;
    NR.save.load();
    initAll(['i18n', 'camera']);
    const hasDom = typeof document !== 'undefined' && document.getElementById;
    const canvas = hasDom ? document.getElementById('game') : null;
    const root = hasDom ? document.getElementById('ui') : null;
    NR.input.init(canvas);
    initAll(['run', 'meta', 'items', 'pickups', 'enemies', 'bosses', 'director', 'waveEvents', 'traits', 'progression', 'shop', 'weapons', 'projectiles', 'combat', 'reactions']);
    if (NR.fx) {
      initAll(['fx.art']);
      if (canvas && NR.fx.render) NR.fx.render.init(canvas);
      initAll(['fx.particles', 'fx.floor', 'fx.juice', 'fx.audio']);
      if (canvas) {
        const unlock = function () { if (NR.fx.audio && NR.fx.audio.unlock) NR.fx.audio.unlock(); };
        document.addEventListener('pointerdown', unlock); document.addEventListener('keydown', unlock);
      }
    }
    if (root) initAll(['ui.hud', 'ui.screens', 'ui.touch'], root);
    NR.world.get();
    NR.loop.setCallbacks({
      step: function (dt) { NR.run.step(dt); },
      frame: function (dt, alpha) {
        NR.camera.update(dt, alpha);
        const fx = NR.fx;
        if (fx) {
          if (fx.juice) fx.juice.update(dt);
          if (fx.particles) fx.particles.update(dt);
          if (fx.floor) fx.floor.update(dt);
          if (fx.audio) fx.audio.update(dt);
        }
        if (NR.ui && NR.ui.hud) NR.ui.hud.update(dt);
        if (NR.input.consumePause()) NR.run.togglePause();
      },
      draw: function (alpha) { if (NR.fx && NR.fx.render) NR.fx.render.draw(NR.world.get(), alpha); }
    });
    if (hasDom) {
      if (NR.ui && NR.ui.screens) NR.ui.screens.show('menu');
      NR.loop.start();
      if (globalThis.location && /[?&]stress=1/.test(globalThis.location.search || '')) {
        NR.run.start({ charId: 'ranger', danger: 0, seed: 1 });
        stress();
      }
    }
  }

  NR.main = { boot: boot };
  // start the game only where a document exists (never in the Node harness)
  if (typeof document !== 'undefined' && document.addEventListener) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else if (document.readyState === 'interactive' || document.readyState === 'complete') boot();
  }
})();
