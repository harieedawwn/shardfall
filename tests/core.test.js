'use strict';
const fs = require('fs');
const path = require('path');

module.exports = function (H) {
  const test = H.test, eq = H.eq;
  const ok = function (c, m) { if (!c) throw new Error(m || 'assertion failed'); };
  const near = function (a, b, e, m) { if (Math.abs(a - b) > (e || 1e-6)) throw new Error((m || 'near') + ': ' + a + ' vs ' + b); };
  const STEP = 1 / 60;
  function booted(opts) { const NR = H.load(opts); NR.main.boot(); return NR; }
  function started(opts, run) {
    const NR = booted(opts);
    NR.run.start(Object.assign({ charId: 'ranger', danger: 0, seed: 11 }, run || {}));
    return NR;
  }
  function idle(NR) { NR.input.inject({ mx: 0, my: 0, aim: 0, fire: false, dash: false, pause: false, device: 'kbm' }); }
  function steps(NR, n) { for (let i = 0; i < n; i++) NR.run.step(STEP); }
  function memStorage(init) {
    const d = Object.assign({}, init || {});
    return { d: d, getItem: function (k) { return k in d ? d[k] : null; }, setItem: function (k, v) { d[k] = String(v); }, removeItem: function (k) { delete d[k]; } };
  }
  function walk(dir, exts, out) {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) walk(p, exts, out);
      else if (exts.indexOf(path.extname(f)) >= 0) out.push(p);
    }
    return out;
  }

  // ---------- rng / util / events / pool ----------
  test('rng: same seed -> same sequence, getState/setState resume', function () {
    const NR = H.load(), r = NR.rng;
    r.seed(42); const a = []; for (let i = 0; i < 20; i++) a.push(r.next());
    r.seed(42); const b = []; for (let i = 0; i < 20; i++) b.push(r.next());
    eq(a, b);
    r.seed(43); ok(r.next() !== a[0], 'different seeds should differ');
    r.seed(5); r.next(); r.next(); const s = r.getState(); const x = r.next(); r.next(); r.setState(s); eq(r.next(), x);
    for (const v of a) ok(v >= 0 && v < 1);
  });
  test('rng: int/range/chance/pick/weighted/shuffle', function () {
    const NR = H.load(), r = NR.rng; r.seed(9);
    let lo = 99, hi = -99;
    for (let i = 0; i < 2000; i++) { const v = r.int(3, 6); if (v < lo) lo = v; if (v > hi) hi = v; ok(Number.isInteger(v)); }
    eq([lo, hi], [3, 6]);
    for (let i = 0; i < 200; i++) { const v = r.range(-2, 2); ok(v >= -2 && v < 2); }
    let c = 0; for (let i = 0; i < 4000; i++) if (r.chance(0.25)) c++; ok(c > 800 && c < 1200, 'chance 0.25 -> ' + c);
    eq(r.chance(0), false); eq(r.chance(1), true);
    eq(r.pick([7]), 7);
    const cnt = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 3000; i++) cnt[r.weighted(['a', 'b', 'c'], function (k) { return k === 'a' ? 0 : k === 'b' ? 1 : 3; })]++;
    eq(cnt.a, 0); ok(cnt.c > cnt.b * 2, 'weights respected');
    const arr = [1, 2, 3, 4, 5, 6, 7, 8]; r.shuffle(arr); eq(arr.slice().sort(), [1, 2, 3, 4, 5, 6, 7, 8]);
  });
  test('util: clamp lerp dist2 angleTo shade hash clone ease fmt', function () {
    const u = H.load().util;
    eq(u.clamp(5, 0, 3), 3); eq(u.clamp(-1, 0, 3), 0); eq(u.lerp(0, 10, 0.25), 2.5); eq(u.dist2(0, 0, 3, 4), 25);
    near(u.angleTo(0, 0, 0, 1), Math.PI / 2);
    eq(u.shade('#FF8000', -1), '#000000'); eq(u.shade('#FF8000', 1), '#FFFFFF');
    ok(/^#[0-9A-F]{6}$/.test(u.shade('#2E3A32', -0.45)));
    eq(u.hash('abc'), u.hash('abc')); ok(u.hash('abc') !== u.hash('abd')); ok(Number.isInteger(u.hash(12)));
    const o = { a: [1, { b: 2 }] }, c = u.clone(o); c.a[1].b = 9; eq(o.a[1].b, 2);
    eq(u.ease('linear', 0.5), 0.5); eq(u.ease('outQuad', 1), 1); eq(u.ease('inQuad', 0), 0);
    eq(u.fmt(950), '950'); eq(u.fmt(12500), '12.5K'); eq(u.fmt(3000000), '3M');
  });
  test('events: on/off/emit/clearAll, safe unsubscribe while emitting', function () {
    const E = H.load().events; let n = 0, m = 0;
    const off = E.on('t', function (p) { n += p.v; });
    E.emit('t', { v: 2 }); off(); E.emit('t', { v: 5 }); eq(n, 2);
    const f = function () { m++; E.off('u', f); }; E.on('u', f); E.on('u', function () { m += 10; });
    E.emit('u', {}); eq(m, 11); E.emit('u', {}); eq(m, 21);
    E.clearAll(); E.emit('u', {}); eq(m, 21);
  });
  test('pool: reuse, cap, reset hook, double free', function () {
    const P = H.load().pool; let made = 0, resets = 0;
    const pool = P.make(function () { made++; return { n: made }; }, function () { resets++; }, 3);
    const a = pool.get(), b = pool.get(), c = pool.get();
    eq(pool.live, 3); eq(pool.get(), null);
    pool.free(b); pool.free(b); eq(pool.live, 2);
    const d = pool.get(); ok(d === b, 'freed object is reused'); eq(made, 3); eq(resets, 4);
    pool.free(a); pool.free(c); pool.free(d); eq(pool.live, 0);
  });

  // ---------- stats ----------
  test('stats: mods combine as (base+add)*(1+pct)*mult, removeMods restores', function () {
    const S = H.load().stats, p = { mods: [], stats: {} };
    S.recalc(p); eq(S.get(p, 'damage'), 1);
    S.addMod(p, 'a', { stat: 'damage', pct: 0.5 });
    S.addMod(p, 'b', { stat: 'damage', pct: 0.5, mult: 2 });
    near(S.get(p, 'damage'), 4);
    S.addMod(p, 'c', { stat: 'maxHp', add: 20, pct: 0.1 }); near(S.get(p, 'maxHp'), 132);
    S.removeMods(p, 'b'); near(S.get(p, 'damage'), 1.5); S.removeMods(p, 'a'); near(S.get(p, 'damage'), 1);
  });
  test('stats: limits (dodge .5, crit 1, dashCooldown .3, attackSpeed 4)', function () {
    const S = H.load().stats, p = { mods: [], stats: {} };
    S.addMod(p, 'x', { stat: 'dodge', add: 0.9 }); S.addMod(p, 'x', { stat: 'critChance', add: 2 });
    S.addMod(p, 'x', { stat: 'dashCooldown', pct: -0.95 }); S.addMod(p, 'x', { stat: 'attackSpeed', pct: 10 });
    eq(S.get(p, 'dodge'), 0.5); eq(S.get(p, 'critChance'), 1); eq(S.get(p, 'dashCooldown'), 0.3); eq(S.get(p, 'attackSpeed'), 4);
  });
  test('stats: xpNeed, armorMult, enemyScale, rarityWeights match SPEC 5', function () {
    const S = H.load().stats;
    eq(S.xpNeed(1), 12); eq(S.xpNeed(10), 186);
    eq(S.armorMult(0), 1); eq(S.armorMult(10), 0.5); eq(S.armorMult(1000), 0.25); eq(S.armorMult(-5), 1);
    const a = S.enemyScale(1, 0); eq([a.hp, a.dmg, a.speed.toFixed(3), a.count, a.elite, a.gold, a.xp, a.shardMult], [1, 1, '1.005', 1, 0, 1, 1, 1]);
    const b = S.enemyScale(5, 2);
    near(b.hp, 2.868); near(b.dmg, 1.612); near(b.speed, 1.065); near(b.count, 1.392); near(b.elite, 0.12); near(b.gold, 1.12); near(b.xp, 1.2); near(b.shardMult, 1.6);
    near(S.enemyScale(20, 0).hp / (1 + 0.18 * 19 + 0.012 * 361), Math.pow(1.07, 5));
    eq(S.enemyScale(10, 0).speed, 1.05);
    const r = S.rarityWeights(0.5, 8);
    near(r.common, 100); near(r.rare, 61.5); near(r.epic, 32); near(r.legendary, 4.5); eq(S.rarityWeights(0, 5).legendary, 0);
  });

  // ---------- spatial ----------
  test('spatial: circle/line/nearest agree with brute force, dead excluded', function () {
    const NR = H.load(), r = NR.rng; r.seed(3);
    const enemies = [];
    for (let i = 0; i < 300; i++) enemies.push({ x: r.range(0, 2400), y: r.range(0, 1600), r: r.range(6, 40), dead: r.chance(0.1) });
    NR.spatial.rebuild({ enemies: enemies });
    const out = [];
    for (let k = 0; k < 40; k++) {
      const x = r.range(0, 2400), y = r.range(0, 1600), R = r.range(20, 300);
      const n = NR.spatial.circle(x, y, R, out);
      const exp = enemies.filter(function (e) { return !e.dead && (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y) <= (R + e.r) * (R + e.r); });
      eq(n, exp.length); eq(out.length, n); eq(out.slice().sort(function (a, b) { return a.x - b.x; }), exp.sort(function (a, b) { return a.x - b.x; }));
      const x2 = x + r.range(-400, 400), y2 = y + r.range(-400, 400), w = r.range(10, 80);
      const nl = NR.spatial.line(x, y, x2, y2, w, out);
      const expL = enemies.filter(function (e) {
        if (e.dead) return false;
        const sx = x2 - x, sy = y2 - y, L2 = sx * sx + sy * sy; let t = L2 ? ((e.x - x) * sx + (e.y - y) * sy) / L2 : 0; t = Math.max(0, Math.min(1, t));
        const dx = x + sx * t - e.x, dy = y + sy * t - e.y; return dx * dx + dy * dy <= (w / 2 + e.r) * (w / 2 + e.r);
      });
      eq(nl, expL.length);
      const nr = NR.spatial.nearest(x, y, R);
      let best = null, bd = Infinity;
      for (const e of exp) { const d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y); if (d < bd) { bd = d; best = e; } }
      ok(nr === best, 'nearest mismatch');
    }
    const only = NR.spatial.nearest(1200, 800, 5000, function (e) { return e.r > 39; });
    ok(!only || only.r > 39);
    eq(NR.spatial.nearest(-5000, -5000, 10), null);
  });

  // ---------- save ----------
  const KEY = 'shardfall.save';
  test('save: defaults, round trip (Vietnamese text), settings event, run snapshot', function () {
    const store = memStorage();
    let NR = H.load({ storage: store });
    const d = NR.save.load();
    eq(d.v, 1); eq(d.settings.language, 'vi'); eq(d.meta.chars, ['ranger', 'dasher']); eq(d.meta.maxDanger, 0);
    NR.save.getMeta().shards = 77; NR.save.getMeta().nodes.m_hp = 2;
    NR.save.getCodex().item['Đồ ốc'] = true;
    let ev = null; NR.events.on('settings:change', function (e) { ev = e.key + '=' + e.value; });
    NR.save.setSetting('master', 0.5); eq(ev, 'master=0.5');
    NR.save.writeRun({ v: 1, seed: 5, note: 'Tiếng Việt: ặ ữ ợ' }); NR.save.flush();
    NR = H.load({ storage: store }); NR.save.load();
    eq(NR.save.getMeta().shards, 77); eq(NR.save.getMeta().nodes.m_hp, 2); eq(NR.save.getCodex().item['Đồ ốc'], true);
    eq(NR.save.getSettings().master, 0.5); eq(NR.save.readRun().note, 'Tiếng Việt: ặ ữ ợ');
    NR.save.clearRun(); eq(NR.save.readRun(), null);
    NR.save.resetAll(); eq(NR.save.getMeta().shards, 0);
  });
  test('save: migrate legacy v0 stepwise and fill missing defaults', function () {
    const store = memStorage(); store.d[KEY] = JSON.stringify({ shards: 42, nodes: { m_hp: 1 }, chars: ['ranger', 'dasher'], settings: { lang: 'en', master: 0.3 } });
    const NR = H.load({ storage: store }); const d = NR.save.load();
    eq(d.v, 1); eq(d.meta.shards, 42); eq(d.meta.nodes.m_hp, 1); eq(d.meta.chars, ['ranger', 'dasher']);
    eq(d.settings.language, 'en'); eq(d.settings.master, 0.3); eq(d.settings.sfx, 0.8); eq(d.codex.boss, {}); eq(d.run, null);
    NR.save.flush(); eq(JSON.parse(store.d[KEY]).v, 1);
    const s2 = memStorage(); s2.d[KEY] = JSON.stringify({ v: 1, meta: { shards: 5 }, settings: { shake: 'bad' } });
    const d2 = H.load({ storage: s2 }).save.load(); eq(d2.meta.shards, 5); eq(d2.meta.chars, ['ranger', 'dasher']); eq(d2.settings.shake, 100);
  });
  test('save: corrupt JSON and newer version -> defaults + backup, no exception', function () {
    const s1 = memStorage(); s1.d[KEY] = '{{{ not json';
    const d1 = H.load({ storage: s1 }).save.load(); eq(d1.v, 1); eq(d1.meta.shards, 0); eq(s1.d['shardfall.backup'], '{{{ not json');
    const raw = JSON.stringify({ v: 99, meta: { shards: 999 } }), s2 = memStorage(); s2.d[KEY] = raw;
    const d2 = H.load({ storage: s2 }).save.load(); eq(d2.meta.shards, 0); eq(s2.d['shardfall.backup'], raw);
  });
  test('save: blocked storage falls back to memory, game still runs', function () {
    const NR = H.load({ storage: 'blocked' });
    NR.save.load(); NR.save.setSetting('sfx', 0.1); eq(NR.save.getSettings().sfx, 0.1); NR.save.flush(); eq(NR.save.readRun(), null);
    NR.main.boot(); NR.run.start({ charId: 'ranger', danger: 0, seed: 1 }); idle(NR); steps(NR, 30); eq(NR.run.getState(), 'wave');
  });

  // ---------- input / loop / camera ----------
  test('input: inject, setVirtual, gamepad deadzone, keyboard cleared on blur', function () {
    let NR = booted();
    NR.input.inject({ mx: 1, my: 0, aim: 1.5, fire: true, dash: true });
    let i = NR.input.read(); eq([i.mx, i.my, i.aim, i.fire, i.dash], [1, 0, 1.5, true, true]);
    NR.input.inject(null); NR.input.clearVirtual();
    NR.input.setVirtual({ mx: 0.5, my: -1, aim: 0.7, fire: true, dash: true });
    i = NR.input.read(); eq(i.device, 'touch'); near(i.mx, 0.4472, 1e-3); near(i.my, -0.8944, 1e-3); eq(i.fire, true); eq(i.dash, true); near(i.aim, 0.7);
    NR.input.clearVirtual(); i = NR.input.read(); eq([i.mx, i.my, i.fire, i.dash], [0, 0, false, false]);
    NR.input.setVirtual({ pause: true }); eq(NR.input.consumePause(), true); eq(NR.input.consumePause(), false);
    const pad = { connected: true, axes: [0.1, 0.1, 0.9, 0], buttons: [] }; pad.buttons[0] = { pressed: true, value: 1 }; pad.buttons[7] = { pressed: false, value: 0 };
    NR = booted({ navigator: { getGamepads: function () { return [pad]; } } });
    i = NR.input.read(); eq(i.mx, 0); eq(i.my, 0); eq(i.device, 'pad'); eq(i.fire, true); eq(i.dash, true); near(i.aim, 0);
    pad.axes = [1, 0, 0, 0]; pad.buttons[0].pressed = false; pad.buttons[0].value = 0; i = NR.input.read(); near(i.mx, 1); eq(i.dash, false);
    NR = booted(); NR.input.init(null);
    NR.__fire('keydown', { code: 'KeyD', preventDefault: function () {} }); NR.__fire('keydown', { code: 'KeyW', preventDefault: function () {} });
    i = NR.input.read(); near(i.mx, 0.7071, 1e-3); near(i.my, -0.7071, 1e-3); eq(i.device, 'kbm');
    NR.__fire('keydown', { code: 'Space', preventDefault: function () {} }); eq(NR.input.read().dash, true);
    NR.__fire('blur'); i = NR.input.read(); eq([i.mx, i.my, i.dash], [0, 0, false]);
    NR.__fire('keydown', { code: 'Escape', preventDefault: function () {} }); eq(NR.input.consumePause(), true);
  });
  test('loop: fixed 60 Hz, catch-up cap, hit-stop, slow-mo, one draw per frame, auto-pause', function () {
    const NR = booted(), sb = NR.__sandbox; let T = 0;
    sb.performance.now = function () { return T; };
    let steps_ = 0, frames = 0, draws = 0;
    NR.loop.setCallbacks({ step: function () { steps_++; }, frame: function () { frames++; }, draw: function () { draws++; } });
    NR.loop.start();
    const frame = function (ms) { T += ms; const f = sb.__rafQueue.shift(); f(T); };
    for (let k = 0; k < 120; k++) frame(1000 / 60); near(steps_, 120, 1);
    steps_ = 0; for (let k = 0; k < 60; k++) frame(1000 / 144); near(steps_, 25, 2, 'steps at 144 Hz');
    eq(frames, draws); eq(frames, 180);
    steps_ = 0; frame(5000); ok(steps_ <= 5 && steps_ >= 1, 'catch-up capped: ' + steps_);
    steps_ = 0; NR.loop.hitStop(0.1); for (let k = 0; k < 5; k++) frame(16); eq(steps_, 0, 'hit-stop freezes steps');
    for (let k = 0; k < 10; k++) frame(16); ok(steps_ > 0);
    steps_ = 0; NR.loop.slowMo(0.5, 1); for (let k = 0; k < 30; k++) frame(1000 / 60); near(steps_, 15, 2, 'slow-mo halves steps');
    ok(NR.loop.fps() > 0);
    NR.run.start({ charId: 'ranger', danger: 0, seed: 1 }); eq(NR.run.getState(), 'wave');
    NR.__fire('blur'); eq(NR.run.getState(), 'paused', 'auto-pause on blur');
    NR.loop.stop();
  });
  test('camera: look-ahead toward aim, shake decays, toWorld/toScreen invert', function () {
    const NR = started(); NR.save.load(); NR.camera.init();
    const W = NR.world.get(), p = W.player; p.x = 1200; p.y = 800; p.px = 1200; p.py = 800; p.aim = 0;
    for (let i = 0; i < 240; i++) NR.camera.update(STEP, 1);
    const c = NR.camera.toWorld(640, 360, {}); ok(c.x > 1260 && c.x < 1300, 'look-ahead x=' + c.x); near(c.y, 800, 1);
    p.aim = Math.PI; for (let i = 0; i < 240; i++) NR.camera.update(STEP, 1); ok(NR.camera.toWorld(640, 360, {}).x < 1140);
    const tr = []; const fake = { translate: function (x, y) { tr.push([x, y]); } };
    NR.camera.addTrauma(1); NR.camera.update(STEP, 1); NR.camera.apply(fake);
    for (let i = 0; i < 200; i++) NR.camera.update(STEP, 1); NR.camera.apply(fake); NR.camera.apply(fake);
    eq(tr[1], tr[2]); const s = NR.camera.toScreen(1000, 700, {}), w = NR.camera.toWorld(s.x, s.y, {}); near(w.x, 1000); near(w.y, 700);
  });

  // ---------- world / player ----------
  test('world: pooled add honors CAPS, cleanup removes dead only, objects reused', function () {
    const NR = started(), W = NR.world.get(), cap = NR.config.CAPS.enemies;
    const list = [];
    for (let i = 0; i < cap; i++) { const e = NR.world.add('enemies', { x: i, y: 2 }); ok(e, 'add ' + i); list.push(e); }
    eq(NR.world.add(W.enemies, { x: 0, y: 0 }), null, 'cap respected');
    const ids = {}; for (const e of list) { ids[e.id] = 1; eq(e.kind, 'enemy'); eq(e.px, e.x); eq(e.dead, false); }
    eq(Object.keys(ids).length, cap);
    const first = list[5]; first.extra = 7; NR.world.remove(first); eq(first.dead, true); eq(W.enemies.length, cap);
    NR.world.cleanup(); eq(W.enemies.length, cap - 1);
    const again = NR.world.add('enemies', { x: 9, y: 9 }); ok(again === first, 'pooled object reused'); eq(again.extra, undefined); eq(again.dead, false); ok(!ids[again.id], 'fresh id');
    const pr = NR.world.add('projectiles', { x: 1, y: 1 }); eq(pr.kind, 'proj'); eq(W.projectiles.length, 1);
    NR.world.reset(); eq(W.enemies.length, 0); eq(W.projectiles.length, 0);
  });
  test('player: acceleration-based movement, aim, wall clamp', function () {
    const NR = started(), p = NR.world.get().player;
    NR.input.inject({ mx: 1, my: 0, aim: 0.8, fire: false, dash: false });
    NR.player.update(STEP, NR.input.read()); ok(p.vx > 0 && p.vx < 250 * p.stats.moveSpeed * 0.5, 'accelerates, vx=' + p.vx); near(p.aim, 0.8);
    for (let i = 0; i < 40; i++) NR.player.update(STEP, NR.input.read()); near(p.vx, 250 * p.stats.moveSpeed, 1e-6);
    NR.input.inject({ mx: 0, my: 0, aim: 0, fire: false, dash: false }); NR.player.update(STEP, NR.input.read()); ok(p.vx > 0, 'friction, not instant stop');
    for (let i = 0; i < 40; i++) NR.player.update(STEP, NR.input.read()); eq(p.vx, 0);
    p.x = 5; NR.input.inject({ mx: -1, my: 0, aim: 0, fire: false, dash: false }); for (let i = 0; i < 30; i++) NR.player.update(STEP, NR.input.read()); eq(p.x, p.r);
    NR.input.inject({ mx: 1, my: 1, aim: 0 }); NR.player.update(STEP, NR.input.read()); near(Math.hypot(p.vx, p.vy) / Math.hypot(1, 1) * Math.SQRT2, Math.hypot(p.vx, p.vy));
  });
  test('player: dash distance, i-frames, charges and one-at-a-time recharge', function () {
    const NR = started(), W = NR.world.get(), p = W.player; let dashes = 0, last = null;
    NR.events.on('player:dash', function (e) { dashes++; last = e.charges; });
    p.x = 600; p.y = 800; p.px = 600; p.py = 800;
    const max = p.dash.max; ok(max >= 2); eq(p.dash.charges, max);
    const x0 = p.x;
    NR.input.inject({ mx: 1, my: 0, aim: 0, dash: true }); NR.player.update(STEP, NR.input.read());
    eq(dashes, 1); eq(last, max - 1); ok(p.iframes > 0 && p.flags.invuln, 'dash grants i-frames');
    NR.input.inject({ mx: 1, my: 0, aim: 0, dash: false });
    for (let i = 0; i < 12; i++) NR.player.update(STEP, NR.input.read());
    ok(p.x - x0 >= p.dash.dist * 0.9, 'dash covers its distance, moved ' + (p.x - x0));
    eq(NR.player.hurt(10, 1), false, 'invulnerable while dashing');
    for (let i = 0; i < 30 && p.dash.t > 0; i++) NR.player.update(STEP, NR.input.read());
    const before = dashes;
    for (let k = 0; k < 2; k++) { NR.input.inject({ mx: 0, my: 1, aim: 0, dash: true }); NR.player.update(STEP, NR.input.read()); NR.input.inject({ mx: 0, my: 1, aim: 0, dash: false }); for (let i = 0; i < 12; i++) NR.player.update(STEP, NR.input.read()); }
    eq(dashes - before, max - 1, 'cannot dash with 0 charges');
    eq(p.dash.charges, 0);
    NR.input.inject({ mx: 0, my: 0, aim: 0, dash: false });
    p.dash.cd = 0; const cd = p.stats.dashCooldown; let n = 0;
    while (p.dash.charges < 1 && n++ < 1000) NR.player.update(STEP, NR.input.read());
    near(n * STEP, cd, 0.1, 'first charge returns after dashCooldown'); eq(p.dash.charges, 1);
    while (p.dash.charges < 2 && n++ < 3000) NR.player.update(STEP, NR.input.read());
    near(n * STEP, cd * 2, 0.15, 'charges come back one at a time');
    p.x = 1200; p.y = 800; NR.input.inject({ mx: 0, my: 0, aim: 1, dash: true }); NR.player.update(STEP, NR.input.read()); ok(p.dash.dy > 0.8, 'still dash follows aim');
  });
  test('player: hurt, dodge event, revive, death, heal, gold', function () {
    const NR = started(), W = NR.world.get(), p = W.player; let hurts = [], deaths = 0;
    NR.events.on('player:hurt', function (e) { hurts.push([e.amount, e.dodged, e.revived]); }); NR.events.on('player:death', function () { deaths++; });
    p.iframes = 0; eq(NR.player.hurt(10, 3), true); eq(p.hp, p.maxHp - 10); eq(NR.player.hurt(10, 3), false, 'hurt i-frames'); near(p.iframes, NR.config.HURT_IFRAMES);
    eq(NR.player.hurt(0, 3, { dodged: true }), false); eq(hurts[1], [0, true, false]); eq(p.hp, p.maxHp - 10); ok(p.iframes <= NR.config.HURT_IFRAMES, 'dodge grants no i-frames');
    eq(NR.player.heal(5), 5); eq(NR.player.heal(500), 5); eq(p.hp, p.maxHp);
    p.revives = 1; p.iframes = 0; NR.player.hurt(p.maxHp + 50, 3); eq(p.dead, false); eq(p.revives, 0); near(p.hp, p.maxHp * 0.5, 1); eq(hurts[hurts.length - 1][2], true); ok(p.iframes >= 1);
    p.iframes = 0; NR.player.hurt(p.maxHp + 50, 3); eq(p.dead, true); eq(deaths, 1); eq(p.hp, 0);
    const g = p.gold; NR.player.addGold(10); eq(p.gold, g + 10); eq(NR.player.spendGold(9999), false); eq(NR.player.spendGold(4), true); eq(p.gold, g + 6);
  });

  // ---------- run flow ----------
  test('run: every state transition (menu>wave>clear>levelup>shop>wave, pause, victory, endless, end)', function () {
    const NR = booted(), log = []; idle(NR);
    NR.events.on('state:change', function (e) { log.push(e.from + '>' + e.to); });
    let endRes = null; NR.events.on('run:end', function (e) { endRes = e.result; });
    eq(NR.run.getState(), 'menu');
    NR.run.start({ charId: 'ranger', danger: 0, seed: 21 }); let W = NR.world.get();
    eq(NR.run.getState(), 'wave'); eq(W.wave, 1); eq(W.zone, 'scrap'); eq(W.state, 'wave'); eq(log[0], 'menu>wave');
    // pause remembers the previous state; sim does not step while paused
    steps(NR, 5); const tk = W.tick; NR.run.togglePause(); eq(NR.run.getState(), 'paused'); eq(W.prevState, 'wave'); steps(NR, 10); eq(W.tick, tk);
    NR.run.togglePause(); eq(NR.run.getState(), 'wave'); steps(NR, 1); eq(W.tick, tk + 1);
    // wave -> clear (gold bonus 5+2w), sim still steps
    const g0 = W.player.gold; NR.events.emit('wave:clear', { wave: 1, isBoss: false }); eq(NR.run.getState(), 'clear'); eq(W.player.gold, g0 + 7);
    NR.run.togglePause(); eq(NR.run.getState(), 'paused'); NR.run.togglePause(); eq(NR.run.getState(), 'clear');
    // clear lasts 1.5 s, then shop (no pending)
    steps(NR, 80); eq(NR.run.getState(), 'clear'); steps(NR, 20); eq(NR.run.getState(), 'shop');
    eq(W.shop.offers.length, 4); ok(NR.save.readRun(), 'snapshot written entering the shop');
    NR.run.togglePause(); eq(NR.run.getState(), 'paused'); NR.run.togglePause(); eq(NR.run.getState(), 'shop');
    NR.run.leaveShop(); eq(NR.run.getState(), 'route', 'route choice before a normal wave'); ok(W.route.options.length >= 2 && W.route.options.length <= 3); NR.run.togglePause(); eq(NR.run.getState(), 'paused'); NR.run.togglePause(); eq(NR.run.getState(), 'route'); NR.run.chooseRoute(0); eq(NR.run.getState(), 'wave'); eq(W.wave, 2); ok(W.mod);
    // clear -> levelup only when queued, then shop
    W.player.pending = 2; NR.events.emit('wave:clear', { wave: 2, isBoss: false }); steps(NR, 100);
    eq(NR.run.getState(), 'levelup'); ok(W.levelup.cards.length > 0, 'cards offered');
    NR.progression.pick(0); eq(NR.run.getState(), 'levelup'); NR.progression.pick(0); eq(NR.run.getState(), 'shop'); eq(W.player.pending, 0);
    // abandon
    NR.run.abandon(); eq(NR.run.getState(), 'end'); eq(endRes, 'abandon'); eq(NR.save.readRun(), null);
    NR.run.setState('menu'); eq(NR.run.getState(), 'menu');
    // death -> end (lose)
    NR.run.start({ charId: 'dasher', danger: 1, seed: 22 }); W = NR.world.get(); idle(NR); steps(NR, 3);
    W.player.iframes = 0; W.player.revives = 0; NR.player.hurt(1e6, 9); steps(NR, 2);
    eq(NR.run.getState(), 'end'); eq(endRes, 'lose'); eq(W.stats.result, 'lose'); NR.run.setState('menu');
    // wave 15 clear -> victory -> finish (win)
    NR.run.start({ charId: 'ranger', danger: 0, seed: 23 }); W = NR.world.get(); idle(NR); W.wave = 15; W.player.hp = 1e6;
    NR.events.emit('wave:clear', { wave: 15, isBoss: true }); steps(NR, 100); eq(NR.run.getState(), 'victory');
    NR.run.endRun('win'); eq(NR.run.getState(), 'end'); eq(endRes, 'win'); ok(W.stats.shardsEarned >= 3 * 15, 'shards earned ' + W.stats.shardsEarned); eq(W.stats.wave, 15);
    NR.run.setState('menu');
    // wave 15 clear -> victory -> endless -> shop -> wave 16
    NR.run.start({ charId: 'ranger', danger: 0, seed: 24 }); W = NR.world.get(); idle(NR); W.wave = 15;
    NR.events.emit('wave:clear', { wave: 15, isBoss: true }); steps(NR, 100); eq(NR.run.getState(), 'victory');
    NR.run.enterEndless(); eq(NR.run.getState(), 'shop'); eq(W.endless, true); NR.run.leaveShop(); NR.run.chooseRoute(0); eq(NR.run.getState(), 'wave'); eq(W.wave, 16);
    W.player.hp = 1e6; NR.events.emit('wave:clear', { wave: 16, isBoss: false }); steps(NR, 100); eq(NR.run.getState(), 'shop', 'endless never returns to victory');
    ok(log.indexOf('clear>levelup') >= 0 && log.indexOf('levelup>shop') >= 0 && log.indexOf('shop>route') >= 0 && log.indexOf('route>wave') >= 0 && log.indexOf('end>menu') >= 0);
  });
  test('run: stats written by run only (kills, damage, dashes, bosses, per-weapon)', function () {
    const NR = started(), W = NR.world.get(), E = NR.events; idle(NR);
    E.emit('enemy:death', { enemy: {}, weaponId: 'pistol', x: 0, y: 0, elite: false, isBoss: false }); eq(W.stats.kills, 1);
    E.emit('boss:death', { boss: {}, x: 0, y: 0 }); eq(W.stats.bossesKilled, 1);
    E.emit('damage:dealt', { weaponId: 'pistol', target: {}, isBoss: false, amount: 7, crit: false, element: 'physical', x: 0, y: 0, killed: false });
    E.emit('damage:dealt', { weaponId: 'pistol', target: {}, isBoss: false, amount: 3, crit: false, element: 'physical', x: 0, y: 0, killed: false }); eq(W.stats.damageByWeapon.pistol, 10);
    W.player.iframes = 0; NR.player.hurt(12, 1); eq(W.stats.damageTaken, 12); NR.player.addGold(30); eq(W.stats.goldEarned, 30);
    E.emit('player:dash', { x: 0, y: 0, dx: 1, dy: 0, charges: 1 }); eq(W.stats.dashes, 1);
  });
  test('run: snapshot at the shop -> continueRun restores gold, weapons, items, offers, rng (also across contexts)', function () {
    const store = memStorage();
    let NR = H.load({ storage: store }); NR.main.boot(); idle(NR);
    NR.run.start({ charId: 'bulwark', danger: 2, seed: 31 }); let W = NR.world.get(); steps(NR, 20);
    W.player.gold = 321; NR.events.emit('wave:clear', { wave: 1, isBoss: false }); steps(NR, 100); eq(NR.run.getState(), 'shop');
    const snap = NR.run.snapshot(), want = { gold: W.player.gold, weapons: JSON.stringify(W.player.weapons), items: JSON.stringify(W.player.items), offers: JSON.stringify(W.shop.offers), rng: NR.rng.getState(), wave: W.wave, level: W.player.level };
    eq(snap.v, 1); eq(snap.charId, 'bulwark'); eq(snap.rng, want.rng);
    NR.run.start({ charId: 'ranger', danger: 0, seed: 99 }); eq(NR.run.continueRun(), true); W = NR.world.get();
    eq(NR.run.getState(), 'shop'); eq(W.player.charId, 'bulwark'); eq(W.player.gold, want.gold); eq(JSON.stringify(W.player.weapons), want.weapons); eq(JSON.stringify(W.player.items), want.items);
    eq(JSON.stringify(W.shop.offers), want.offers); eq(NR.rng.getState(), want.rng); eq(W.wave, want.wave); eq(W.danger, 2); eq(W.player.level, want.level);
    NR = H.load({ storage: store }); NR.main.boot(); eq(NR.run.continueRun(), true); W = NR.world.get();
    eq(NR.run.getState(), 'shop'); eq(W.player.gold, want.gold); eq(JSON.stringify(W.shop.offers), want.offers); eq(NR.rng.getState(), want.rng);
    NR.run.leaveShop(); if (NR.run.getState() === 'route') NR.run.chooseRoute(0); eq(W.wave, want.wave + 1); eq(NR.run.continueRun(), false, 'snapshot cleared once the wave starts');
  });

  // ---------- determinism / fx independence / bot ----------
  function sig(s) { const c = Object.assign({}, s); delete c.msPerTick; delete c.worstMs; return JSON.stringify(c); }
  test('determinism: same seed -> same result in two sims; different seed differs', function () {
    const a = H.runSim({ seconds: 90, seed: 7 }), b = H.runSim({ seconds: 90, seed: 7 }), c = H.runSim({ seconds: 90, seed: 8 });
    eq(sig(a), sig(b)); ok(a.hash !== c.hash, 'seed 8 should differ'); ok(a.kills > 0 && a.ticks > 0);
  });
  test('fx independence: sim hash with fx (and rendering) equals hash without', function () {
    const a = H.runSim({ seconds: 60, seed: 5 }), b = H.runSim({ seconds: 60, seed: 5, fx: true, render: true });
    eq(a.hash, b.hash); eq(a.kills, b.kills);
  });
  test('bot: runs complete without exception/NaN for every character at danger 0 and 5', function () {
    const chars = Object.keys(H.load().data.characters); eq(chars.length, 4);
    for (const ch of chars) for (const d of [0, 5]) {
      const s = H.runSim({ seconds: 40, seed: 1, char: ch, danger: d });
      ok(s.ticks > 0 && (s.state === 'wave' || s.state === 'clear' || s.state === 'end' || s.state === 'shop' || s.state === 'levelup'), ch + ' d' + d + ' state ' + s.state);
    }
  });
  test('events: only SPEC 8 names with required payload fields over a 3-run bot sweep', function () {
    const seen = {}; let problems = [];
    for (let seed = 1; seed <= 3; seed++) {
      const NR = H.load(); NR.main.boot(); NR.bot.play({ seconds: 70, seed: seed, char: ['ranger', 'dasher', 'tinker'][seed - 1], danger: seed });
      for (const k in H.audit.seen) seen[k] = 1; problems = problems.concat(H.audit.get());
    }
    eq(problems, []);
    const missing = Object.keys(H.EVENTS).filter(function (n) { return !seen[n] && H.OPTIONAL_EVENTS.indexOf(n) < 0; });
    if (missing.length) {
      if (process.argv.indexOf('--strict-events') >= 0) throw new Error('events never emitted: ' + missing.join(', '));
      console.log('       (info) not emitted yet by current modules: ' + missing.join(' '));
    }
  });
  test('fake canvas: 30 s bot render records zero banned calls, no gradient on the main canvas, none after warm-up', function () {
    const NR = H.load({ fx: true }); NR.main.boot(); const s = NR.bot.play({ seconds: 30, seed: 2, render: true });
    const ctx = NR.__dom.ctx; eq(ctx.banned, []); ok(Object.keys(ctx.used.methods).length > 3, 'something was drawn'); ok(s.ticks > 0);
    eq(ctx.gradients, [], 'gradients only on offscreen bake canvases');
    const FC = require('./fake-canvas');
    for (let i = 0; i < 30; i++) NR.fx.render.draw(NR.world.get(), 1);
    const g0 = FC.gradientTotal();
    for (let i = 0; i < 120; i++) NR.fx.render.draw(NR.world.get(), 1);
    eq(FC.gradientTotal(), g0, 'no gradient is created per frame: sprites seen once are baked once');
    const c = NR.fakeCanvas.create(10, 10); c.createLinearGradient(0, 0, 1, 1); c.shadowBlur = 4; c.globalCompositeOperation = 'screen'; c.filter = 'blur(2px)';
    eq(c.banned.length, 3, 'fake canvas detects banned features'); eq(c.gradients.length, 1, 'gradients recorded');
    const c3 = NR.fakeCanvas.create(10, 10); c3.globalCompositeOperation = 'lighter'; eq(c3.banned, []); eq(c3.additive.length, 1);
    const c2 = NR.fakeCanvas.create(10, 10); c2.globalCompositeOperation = 'source-over'; c2.fillRect(0, 0, 1, 1); eq(c2.banned, []); eq(c2.used.methods.fillRect, 1);
  });
  test('perf: stress 400 enemies + 600 projectiles averages <= 4 ms per tick', function () {
    const NR = started({}, { seed: 2 }), W = NR.world.get(), r = NR.rng, A = NR.config.ARENA; idle(NR);
    W.player.hp = 1e9; W.player.maxHp = 1e9; W.player.iframes = 0;
    const ids = Object.keys(NR.data.enemies);
    for (let i = 0; i < 400; i++) NR.enemies.spawn(ids[i % ids.length], r.range(100, A.w - 100), r.range(100, A.h - 100), {});
    for (let i = 0; i < 600; i++) { const a = r.range(0, 6.28); NR.projectiles.spawn({ team: 'enemy', x: r.range(100, A.w - 100), y: r.range(100, A.h - 100), vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, r: 5, dmg: 1, life: 100 }); }
    ok(W.enemies.length >= 300, 'enemies spawned: ' + W.enemies.length);
    steps(NR, 20); let t = 0; const N = 120;
    for (let i = 0; i < N; i++) { const t0 = process.hrtime.bigint(); NR.run.step(STEP); t += Number(process.hrtime.bigint() - t0) / 1e6; W.player.hp = 1e9; }
    ok(t / N <= 4, 'avg ms/tick ' + (t / N).toFixed(3));
  });

  // ---------- static checks ----------
  const SRC = path.join(H.ROOT, 'src'), CSS = path.join(H.ROOT, 'css');
  function codeFiles() { return walk(SRC, ['.js'], []).concat(fs.existsSync(CSS) ? walk(CSS, ['.css'], []) : []); }
  function shadowViolations(text) {
    const out = [], re = /(box-shadow|text-shadow|boxShadow|textShadow)\s*[:=]\s*(['"`]?)([^;}'"`\n]+)/g; let m;
    while ((m = re.exec(text))) {
      const val = m[3].replace(/rgba?\([^)]*\)|hsla?\([^)]*\)|#[0-9a-fA-F]+/g, ' ');
      for (const part of val.split(',')) {
        const lens = part.trim().split(/\s+/).filter(function (t) { return /^-?\d*\.?\d+(px|em|rem)?$/.test(t); });
        if (lens.length >= 3 && parseFloat(lens[2]) !== 0) out.push(m[1] + ': ' + m[3].trim());
      }
    }
    return out;
  }
  // SPEC 12 (Flat++): gradients only in the bake module (offscreen sprites), additive 'lighter' only in src/fx;
  // shadows/filters/blur/blend modes banned everywhere; CSS shadows never blurred.
  const BAKE_FILES = ['src/fx/art.js', 'src/fx/title.js']; // offscreen bake code only
  test('source scan: no banned visual feature in src or css (SPEC 12)', function () {
    const rules = [
      [/shadowBlur|shadowColor/, 'canvas shadow'],
      [/\.filter\s*=[^=]|style\.filter|['"]filter['"]|(^|[^-\w.])filter\s*:|backdrop-filter|backdropFilter/m, 'filter'],
      [/globalCompositeOperation\s*=\s*['"](?!lighter['"]|source-over['"])/, 'composite op'],
      [/(^|[^.\w])blur\s*\(/m, 'blur()'], [/mix-blend-mode|mixBlendMode/, 'blend mode']
    ];
    const bad = [];
    for (const f of codeFiles()) {
      const t = fs.readFileSync(f, 'utf8'), rel = path.relative(H.ROOT, f).split(path.sep).join('/');
      for (const [re, name] of rules) if (re.test(t)) bad.push(rel + ': ' + name);
      if (/create(Linear|Radial|Conic)Gradient/.test(t) && BAKE_FILES.indexOf(rel) < 0) bad.push(rel + ': canvas gradient outside the bake module');
      if (/globalCompositeOperation\s*=\s*['"]lighter/.test(t) && !/^src\/fx\//.test(rel)) bad.push(rel + ': additive blend outside src/fx');
      if (/\.js$/.test(rel) && /(linear|radial|conic)-gradient/.test(t)) bad.push(rel + ': css gradient from js');
      for (const s of shadowViolations(t)) bad.push(rel + ': blurred ' + s);
    }
    eq(bad, []);
    const sv = shadowViolations('a{box-shadow:4px 4px 0 #000, 2px 2px 3px red; text-shadow: 1px 1px 0 #fff}');
    eq(sv.length, 1, 'scanner flags blur radius > 0 only');
  });
  test('source scan: determinism and fx isolation (SPEC 15.3, 15.4)', function () {
    const bad = [];
    for (const f of walk(path.join(SRC, 'sim'), ['.js'], []).concat(walk(path.join(SRC, 'data'), ['.js'], []))) {
      if (/\b(document|window|Date|AudioContext)\b|Math\.random/.test(fs.readFileSync(f, 'utf8'))) bad.push(path.relative(H.ROOT, f));
    }
    eq(bad, []);
    const leaks = [];
    for (const f of walk(SRC, ['.js'], [])) {
      const rel = path.relative(SRC, f).split(path.sep)[0];
      if (rel === 'fx' || rel === 'core') continue;
      if (/loop\.(hitStop|slowMo)|camera\.addTrauma/.test(fs.readFileSync(f, 'utf8'))) leaks.push(path.relative(H.ROOT, f));
    }
    eq(leaks, []);
  });
  test('index.html: SPEC 6 script order, relative paths, no modules, .nojekyll, every file exists', function () {
    const html = fs.readFileSync(path.join(H.ROOT, 'index.html'), 'utf8'), list = H.scriptOrder();
    ok(!/type\s*=\s*["']module["']/.test(html), 'no type=module'); ok(!/https?:\/\//.test(html), 'no network refs');
    for (const s of list) { ok(!/^\//.test(s) && !/^[a-z]+:/.test(s), 'relative: ' + s); ok(fs.existsSync(path.join(H.ROOT, s)), 'exists: ' + s); }
    const core1 = ['config', 'util', 'rng', 'events', 'stats', 'spatial', 'pool'].map(function (n) { return 'src/core/' + n + '.js'; });
    eq(list.slice(0, 7), core1); eq(list.slice(7, 9), ['src/lang/vi.js', 'src/lang/en.js']);
    eq(list.slice(9, 14), ['i18n', 'save', 'input', 'camera', 'loop'].map(function (n) { return 'src/core/' + n + '.js'; }));
    // new files may be added anywhere in their group; the files SPEC 6 names must keep their relative order
    const sub = function (re, names, dir) {
      const exp = names.map(function (n) { return dir + n + '.js'; }), got = list.filter(function (s) { return re.test(s) && exp.indexOf(s) >= 0; });
      eq(got, exp);
    };
    sub(/^src\/sim\//, ['world', 'player', 'weapons', 'projectiles', 'combat', 'enemies', 'bosses', 'director', 'items', 'progression', 'shop', 'pickups', 'meta', 'run'], 'src/sim/');
    sub(/^src\/fx\//, ['shapes', 'art', 'actors', 'render', 'title', 'particles', 'floor', 'juice', 'audio'], 'src/fx/');
    sub(/^src\/ui\//, ['hud', 'screens', 'touch'], 'src/ui/');
    ok(list.indexOf('src/sim/reactions.js') > list.indexOf('src/sim/combat.js'), 'reactions after combat');
    eq(list[list.length - 1], 'src/main.js'); ok(fs.existsSync(path.join(H.ROOT, '.nojekyll')));
    ok(list.indexOf('src/data/weapons.js') > list.indexOf('src/core/loop.js') && list.indexOf('src/data/meta.js') < list.indexOf('src/sim/world.js'));
  });
  test('modules only register at load: loading all files touches no state and main does not boot without a document', function () {
    const NR = H.load(); ok(NR.main && NR.main.boot); eq(NR.world.get().state, 'menu');
    for (const m of ['config', 'util', 'rng', 'events', 'stats', 'spatial', 'pool', 'i18n', 'save', 'input', 'camera', 'loop', 'world', 'player', 'run', 'main']) ok(NR[m], 'NR.' + m);
  });
};
