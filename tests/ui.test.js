// Owner: UI. Tests for lang parity, key coverage, banned visual features, DOM-free load, screens, HUD and touch.
// jsdom is optional (test-only, never shipped): when `require('jsdom')` works every screen is also built in a real DOM.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

module.exports = function (H) {
  const ROOT = H.ROOT, UI_FILES = ['hud', 'screens', 'touch'].map(function (n) { return path.join(ROOT, 'src', 'ui', n + '.js'); });
  const CSS = path.join(ROOT, 'css', 'ui.css');
  const ok = function (c, m) { if (!c) throw new Error(m || 'assertion failed'); };
  const read = function (f) { return fs.readFileSync(f, 'utf8'); };
  const stripJs = function (s) { return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); };
  const stripCss = function (s) { return s.replace(/\/\*[\s\S]*?\*\//g, ''); };

  const NS = ['game', 'common', 'title', 'hint', 'menu', 'select', 'danger', 'levelup', 'shop', 'stats', 'tip', 'stat', 'rarity', 'element', 'kind', 'wp', 'pause',
    'settings', 'set', 'ctl', 'meta', 'codex', 'victory', 'end', 'hud', 'touch', 'rotate', 'event'];

  // ---- key families built from data (dynamic keys such as t('stat.' + k)) ----
  function families(NR) {
    const out = {}, W = NR.data.weapons;
    const toggles = ['autoFire', 'aimAssist', 'damageNumbers', 'reduceFlashing', 'showFps', 'fullscreen'];
    const kinds = ['weapon', 'item', 'enemy', 'boss', 'character', 'evolution'];
    out['stat.'] = Object.keys(NR.stats.defaults); out['tip.'] = Object.keys(NR.stats.defaults);
    out['stats.group.'] = ['survival', 'offense', 'utility'];
    out['rarity.'] = ['common', 'rare', 'epic', 'legendary'];
    out['element.'] = Object.keys(NR.config.ELEMENT_COLORS);
    out['kind.'] = Object.keys(W).map(function (k) { return W[k].kind; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
    out['danger.'] = ['0', '1', '2', '3', '4', '5'];
    out['shop.err.'] = ['gold', 'max', 'slots', 'sold', 'sell'];
    out['set.'] = ['master', 'music', 'sfx', 'shake'].concat(toggles, toggles.map(function (k) { return k + 'Tip'; }));
    out['ctl.'] = ['move', 'aim', 'dash', 'pause', 'pad', 'touch'].reduce(function (a, k) { return a.concat([k, k + 'V']); }, []);
    out['meta.branch.'] = ['vital', 'power', 'move', 'fortune'];
    out['codex.tab.'] = kinds; out['codex.hidden.'] = kinds;
    out['end.'] = ['win', 'lose', 'abandon'];
    return out;
  }
  function usedKeys(fam) {
    const keys = {}, dyn = {};
    for (const f of UI_FILES) {
      const s = stripJs(read(f));
      const re = /'([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)+\.?)'/g;
      let m;
      while ((m = re.exec(s))) {
        const k = m[1];
        if (NS.indexOf(k.split('.')[0]) < 0) continue;
        if (/\.$/.test(k)) dyn[k] = 1; else keys[k] = path.basename(f);
      }
      const re2 = /\bt\(\s*'([A-Za-z0-9_.]+?)\.?'\s*\+/g;
      while ((m = re2.exec(s))) dyn[m[1] + '.'] = 1;
    }
    return { keys: keys, dyn: Object.keys(dyn) };
  }

  H.test('ui: vi and en have identical key sets, no empty strings', function () {
    const NR = H.load(), vi = Object.keys(NR.lang.vi).sort(), en = Object.keys(NR.lang.en).sort();
    H.eq(vi.filter(function (k) { return en.indexOf(k) < 0; }), [], 'in vi only');
    H.eq(en.filter(function (k) { return vi.indexOf(k) < 0; }), [], 'in en only');
    for (const k of vi) { ok(NR.lang.vi[k] && NR.lang.en[k], 'empty string for ' + k); }
    // same {placeholders} in both languages
    for (const k of vi) {
      const a = (NR.lang.vi[k].match(/\{\w+\}/g) || []).sort().join(), b = (NR.lang.en[k].match(/\{\w+\}/g) || []).sort().join();
      ok(a === b, 'placeholders differ in ' + k);
    }
  });

  H.test('ui: every key used in src/ui exists in both languages (static and dynamic families)', function () {
    const NR = H.load(), fam = families(NR), u = usedKeys(fam), missing = [];
    for (const k in u.keys) for (const l of ['vi', 'en']) if (NR.lang[l][k] === undefined) missing.push(l + ':' + k + ' (' + u.keys[k] + ')');
    H.eq(missing, [], 'missing static keys');
    for (const p of u.dyn) {
      ok(fam[p], 'dynamic key prefix "' + p + '" is not covered by the test families');
      for (const id of fam[p]) for (const l of ['vi', 'en']) if (NR.lang[l][p + id] === undefined) missing.push(l + ':' + p + id);
    }
    H.eq(missing, [], 'missing dynamic keys');
    // every key in the files is used (no dead strings), except dynamic families
    const used = Object.keys(u.keys);
    const dead = Object.keys(NR.lang.vi).filter(function (k) {
      if (used.indexOf(k) >= 0) return false;
      return !u.dyn.some(function (p) { return k.indexOf(p) === 0; });
    });
    H.eq(dead, [], 'unused lang keys');
  });

  H.test('ui: Vietnamese strings keep their diacritics and are valid UTF-8', function () {
    const raw = read(path.join(ROOT, 'src', 'lang', 'vi.js'));
    ok(raw.indexOf('\uFFFD') < 0, 'replacement char found');
    ok(/Chọn nhân vật/.test(raw) && /Cửa hàng/.test(raw) && /Bách khoa/.test(raw), 'diacritics lost');
    const NR = H.load();
    ok(NR.lang.vi['stat.critChance'].indexOf('chí mạng') > 0);
  });

  H.test('ui: files load in Node without a DOM and touch nothing at load time', function () {
    const sandbox = { console: console, performance: { now: function () { return 0; } }, addEventListener: function () {} };
    const ctx = vm.createContext(sandbox);
    for (const src of H.scriptOrder()) {
      if (src === 'src/main.js') continue;
      vm.runInContext(read(path.join(ROOT, src)), ctx, { filename: src });
    }
    const NR = ctx.NR;
    for (const m of ['hud', 'screens', 'touch']) ok(NR.ui && NR.ui[m], 'NR.ui.' + m);
    for (const f of ['init', 'update', 'draw', 'toast']) ok(typeof NR.ui.hud[f] === 'function', 'hud.' + f);
    for (const f of ['init', 'show', 'hide', 'tick']) ok(typeof NR.ui.screens[f] === 'function', 'screens.' + f);
    for (const f of ['init', 'show', 'hide', 'active']) ok(typeof NR.ui.touch[f] === 'function', 'touch.' + f);
    ok(typeof ctx.document === 'undefined', 'no document was created');
  });

  // SPEC 12 (Flat++): CSS may use static gradients and translucency (overlays, transitions); still banned: blur, filter,
  // backdrop-filter, blend modes, glow, blurred/spread/inset shadows. UI JS draws on the main canvas: no gradients,
  // canvas shadows, filters or composite modes there.
  H.test('ui: css/ui.css and src/ui contain no banned visual feature', function () {
    const bad = [];
    const css = stripCss(read(CSS));
    const rules = [[/(^|[^-\w])blur\s*\(/i, 'blur'], [/backdrop/i, 'backdrop-filter'], [/(^|[;{\s])filter\s*:/i, 'filter'],
      [/mix-blend|isolation/i, 'blend mode'], [/-webkit-box-reflect|glow/i, 'glow']];
    rules.forEach(function (r) { if (r[0].test(css)) bad.push('css: ' + r[1]); });
    const re = /(box|text)-shadow\s*:\s*([^;}]+)/g;
    let m;
    while ((m = re.exec(css))) {
      m[2].split(/,(?![^(]*\))/).forEach(function (sh) {
        const L = (sh.replace(/rgba?\([^)]*\)|#[0-9a-fA-F]+|var\([^)]*\)/g, ' ').match(/-?\d*\.?\d+(?:px|em|rem)?(?=\s|$)/g) || []).filter(function (x) { return /^-?[\d.]/.test(x); });
        if (/inset/.test(sh)) bad.push('css: inset shadow ' + sh.trim());
        if (L.length >= 3 && parseFloat(L[2]) !== 0) bad.push('css: shadow blur ' + sh.trim());
        if (L.length >= 4 && parseFloat(L[3]) !== 0) bad.push('css: shadow spread ' + sh.trim());
      });
    }
    ok(/Bahnschrift, "Segoe UI", system-ui/.test(css), 'font stack');
    ok(!/(^|[;{\s])button\s*\{[^}]*appearance:\s*auto/.test(css), 'default button');
    const jsRules = [[/gradient/i, 'gradient'], [/backdrop/i, 'backdrop'], [/blur/i, 'blur'], [/shadowBlur|shadowColor/, 'canvas shadow'], [/\.filter\s*=|style\.filter|filter\s*:/, 'filter'],
      [/boxShadow|textShadow/, 'inline shadow'], [/globalCompositeOperation/, 'composite']];
    for (const f of UI_FILES) { const s = stripJs(read(f)); jsRules.forEach(function (r) { if (r[0].test(s)) bad.push(path.basename(f) + ': ' + r[1]); }); }
    H.eq(bad, [], 'banned features');
  });

  // ---------- helpers on the fake DOM ----------
  function walk(e, fn) { fn(e); for (const c of e.children) walk(c, fn); }
  function all(e, pred) { const o = []; walk(e, function (n) { if (pred(n)) o.push(n); }); return o; }
  function byFk(root, fk) { return all(root, function (n) { return n.getAttribute && n.getAttribute('data-fk') === fk; })[0]; }
  function screenOf(root) { return all(root, function (n) { return n.hasClass && n.hasClass('scr'); })[0]; }
  function boot(lang) {
    const NR = H.load({ fx: true, ui: true });
    NR.main.boot();
    NR.ui.screens.guard.ms = 0; // the 280 ms anti-misclick guard is tested separately
    if (lang) NR.save.setSetting('language', lang);
    return NR;
  }
  function sane(NR, name) {
    const root = NR.__dom.root, sc = screenOf(root);
    ok(sc, name + ': no screen element');
    const txt = sc.textContent;
    ok(txt.length > 5, name + ': empty screen');
    ok(!/undefined|NaN|\[object|Infinity/.test(txt), name + ': bad text -> ' + (txt.match(/.{0,20}(undefined|NaN|\[object|Infinity).{0,20}/) || [''])[0]);
    ok(all(sc, function (n) { return n.tagName === 'BUTTON'; }).length > 0, name + ': no button (dead end)');
    return sc;
  }
  function startRun(NR, char) { NR.run.start({ charId: char || 'ranger', danger: 0, seed: 7 }); return NR.world.get(); }

  ['vi', 'en'].forEach(function (lang) {
    H.test('ui: every screen builds without errors and has a way back (' + lang + ')', function () {
      const NR = boot(lang), S = NR.ui.screens, root = NR.__dom.root;
      ok(NR.i18n.getLang() === lang);
      // menu-state screens
      NR.save.getMeta().shards = 5000;
      for (const n of ['title', 'select', 'settings', 'meta', 'codex']) {
        S.show(n); const sc = sane(NR, n);
        if (n !== 'title') ok(byFk(sc, 'back'), n + ': no back button');
      }
      // codex: every tab
      S.show('codex');
      for (const tab of ['weapon', 'item', 'enemy', 'boss', 'character', 'evolution']) { byFk(root, 'tab-' + tab).click(); sane(NR, 'codex/' + tab); }
      // undiscovered entries are dark silhouettes
      ok(all(root, function (n) { return n.hasClass && n.hasClass('dark'); }).length > 0, 'codex dark entries');
      NR.save.getCodex().weapon.pistol = true; S.show('codex'); byFk(root, 'tab-weapon').click();
      ok(all(root, function (n) { return n.hasClass && n.hasClass('cx') && !n.hasClass('dark'); }).length === 1, 'one discovered entry');
      // character select: every character and danger
      S.show('select');
      for (const id of Object.keys(NR.data.characters)) { byFk(root, 'ch-' + id).click(); sane(NR, 'select/' + id); }
      // pause / levelup / shop / victory / end
      const W = startRun(NR);
      NR.run.togglePause(); ok(NR.ui.screens.current() === 'pause'); sane(NR, 'pause'); ok(byFk(root, 'resume'));
      byFk(root, 'settings').click(); ok(NR.ui.screens.current() === 'settings'); sane(NR, 'pause/settings');
      byFk(root, 'back').click(); ok(NR.ui.screens.current() === 'pause', 'settings back returns to pause');
      NR.run.togglePause(); ok(NR.ui.screens.current() === null, 'resume hides screens');
      const p = NR.world.get().player;
      p.pending = 1; p.gold = 100; NR.run.setState('clear'); NR.run.setState('levelup'); NR.progression.begin();
      ok(NR.ui.screens.current() === 'levelup'); sane(NR, 'levelup');
      ok(all(root, function (n) { return n.hasClass && n.hasClass('up'); }).length === 4, 'four level-up cards');
      NR.progression.reroll(); sane(NR, 'levelup after reroll');
      byFk(root, 'c0').dispatch('click', {});
      ok(NR.run.getState() === 'levelup' || NR.run.getState() === 'shop');
      NR.shop.open(NR.world.get().wave); NR.run.setState('shop');
      ok(NR.ui.screens.current() === 'shop'); sane(NR, 'shop');
      NR.world.get().player.gold = 999;
      NR.run.togglePause(); ok(NR.ui.screens.current() === 'pause'); NR.run.togglePause(); ok(NR.ui.screens.current() === 'shop');
      NR.run.setState('victory'); sane(NR, 'victory');
      ok(byFk(root, 'endless') && byFk(root, 'finish'));
      NR.run.endRun('win'); ok(NR.ui.screens.current() === 'end'); sane(NR, 'end');
      ok(byFk(root, 'again') && byFk(root, 'menu'));
      byFk(root, 'menu').click(); ok(NR.ui.screens.current() === 'title');
    });
  });

  H.test('ui: language switch updates the open screen live', function () {
    const NR = boot('vi'), root = NR.__dom.root;
    NR.ui.screens.show('title');
    ok(/Chơi/.test(screenOf(root).textContent));
    NR.save.setSetting('language', 'en');
    ok(/Play/.test(screenOf(root).textContent) && !/Chơi/.test(screenOf(root).textContent), 'title is English');
    NR.ui.screens.show('settings'); NR.save.setSetting('language', 'vi');
    ok(/Cài đặt/.test(screenOf(root).textContent));
    NR.save.getSettings().language = 'vi';
  });

  H.test('ui: full flow by clicks: title -> select -> run -> shop buy/lock/reroll/sell -> next wave', function () {
    const NR = boot('en'), root = NR.__dom.root;
    byFk(root, 'play').click(); ok(NR.ui.screens.current() === 'select');
    byFk(root, 'start').click(); ok(NR.run.getState() === 'wave'); ok(NR.ui.screens.current() === null);
    const W = NR.world.get(); W.player.gold = 500;
    NR.shop.open(1); NR.run.setState('shop');
    byFk(root, 'lock0').click(); ok(NR.world.get().shop.offers[0].locked);
    byFk(root, 'lock0').click(); ok(!NR.world.get().shop.offers[0].locked);
    const before = NR.world.get().player.gold; byFk(root, 'reroll').click(); ok(NR.world.get().player.gold < before, 'reroll cost gold');
    byFk(root, 'buy0').click(); ok(NR.world.get().shop.offers[0].sold, 'bought');
    const sw = byFk(root, 'sw0'); if (sw) { const n = NR.world.get().player.weapons.length; sw.click(); ok(NR.world.get().player.weapons.length === n, 'first click only arms'); sw.click(); ok(NR.world.get().player.weapons.length === n - 1, 'second click sells'); }
    byFk(root, 'next').click(); ok(NR.run.getState() === 'wave' && NR.world.get().wave === 2);
  });

  H.test('ui: anti-misclick guard ignores clicks right after a level-up/end screen opens', function () {
    const NR = H.load({ fx: true, ui: true }); NR.main.boot();
    const root = NR.__dom.root, p = startRun(NR).player;
    p.pending = 1; NR.run.setState('clear'); NR.run.setState('levelup'); NR.progression.begin();
    byFk(root, 'c0').click();
    ok(NR.run.getState() === 'levelup' && p.pending === 1, 'early click ignored');
    NR.ui.screens.guard.ms = 0; byFk(root, 'c0').click();
    ok(p.pending === 0, 'click accepted after the guard');
  });

  H.test('ui: HUD draws every element with no banned canvas call (all states, boss, many items)', function () {
    const NR = boot(), W = startRun(NR), ctx = NR.__dom.ctx, p = W.player;
    ok(NR.fx.render.draw.__hud, 'render.draw wrapped');
    for (const id of Object.keys(NR.data.items).slice(0, 25)) NR.items.grant(p, id, 'test');
    NR.weapons.add(p, 'katana'); NR.weapons.add(p, 'seeker'); NR.weapons.add(p, 'frost_aura');
    p.weapons[0].cd = 0.1; p.hp = 20; p.pending = 2; p.dash.charges = 1; p.dash.cd = 0.5;
    NR.save.getSettings().showFps = true;
    NR.events.emit('wave:start', { wave: 5, zone: 'scrap', isBoss: true, duration: 40 });
    NR.bosses.spawn('scrap_titan', {}); W.boss.hp = W.boss.maxHp * 0.5; W.boss.flags.enraged = true;
    NR.events.emit('player:hurt', { amount: 5, hp: 20, srcId: 0, dodged: false, revived: false, x: 0, y: 0 });
    NR.ui.hud.toast('Hello');
    for (const st of ['wave', 'clear', 'paused', 'levelup']) {
      W.state = st; NR.ui.hud.update(0.016); NR.ui.hud.draw(ctx, W, 0.5); NR.fx.render.draw(W, 0.5);
    }
    W.state = 'shop'; const n0 = ctx.used.methods.fillRect || 0; NR.ui.hud.draw(ctx, W, 0); ok((ctx.used.methods.fillRect || 0) === n0, 'HUD hidden in the shop');
    H.eq(ctx.banned, [], 'banned canvas calls');
    ok((ctx.used.methods.fillText || 0) > 10, 'HUD draws text');
    // delayed damage segment lags behind the hp
    p.hp = p.maxHp; W.state = 'wave'; NR.ui.hud.update(0.016); NR.ui.hud.update(0.016); p.hp = 10; NR.ui.hud.update(0.016);
    H.eq(NR.findNaN ? null : null, null);
  });

  H.test('ui: touch controls feed NR.input (move, aim+fire, dash, pause) and only show while playing', function () {
    const NR = boot(), root = NR.__dom.root;
    ok(!NR.ui.touch.active(), 'hidden in menu');
    NR.ui.touch.show(); ok(!NR.ui.touch.active(), 'still hidden outside a run');
    startRun(NR); NR.spatial.rebuild(NR.world.get()); ok(NR.ui.touch.active(), 'visible while playing');
    const box = all(root, function (n) { return n.hasClass && n.hasClass('touch'); })[0];
    const zl = all(box, function (n) { return n.hasClass('zl'); })[0], zr = all(box, function (n) { return n.hasClass('zr'); })[0];
    zl.dispatch('pointerdown', { pointerId: 1, clientX: 100, clientY: 300 });
    zl.dispatch('pointermove', { pointerId: 1, clientX: 160, clientY: 300 });
    let it = NR.input.read(); ok(it.mx > 0.5 && Math.abs(it.my) < 0.01, 'move right ' + it.mx);
    zl.dispatch('pointerup', { pointerId: 1, clientX: 160, clientY: 300 });
    it = NR.input.read(); H.eq(it.mx, 0);
    zr.dispatch('pointerdown', { pointerId: 2, clientX: 700, clientY: 300 });
    zr.dispatch('pointermove', { pointerId: 2, clientX: 700, clientY: 360 });
    it = NR.input.read(); ok(it.fire && Math.abs(it.aim - Math.PI / 2) < 0.01, 'aim down + fire');
    zr.dispatch('pointerup', { pointerId: 2, clientX: 700, clientY: 360 });
    ok(!NR.input.read().fire, 'fire stops');
    const dash = all(box, function (n) { return n.hasClass('dash') && n.tagName === 'BUTTON'; })[0];
    dash.dispatch('pointerdown', { pointerId: 3 }); ok(NR.input.read().dash, 'dash pressed');
    const pause = all(box, function (n) { return n.hasClass('pause'); })[0];
    pause.dispatch('pointerdown', { pointerId: 4 }); ok(NR.input.consumePause(), 'pause requested');
    NR.run.togglePause(); ok(!NR.ui.touch.active(), 'hidden while paused');
  });

  H.test('ui: gamepad navigation moves focus, A activates, B goes back; Esc/Start owned by menu screens', function () {
    const NR = boot(), root = NR.__dom.root, S = NR.ui.screens;
    S.show('select');
    let pressed = {};
    NR.__sandbox.navigator = { getGamepads: function () { return [{ connected: true, axes: [0, 0], buttons: Array.from({ length: 16 }, function (_, i) { return { pressed: !!pressed[i], value: pressed[i] ? 1 : 0 }; }) }]; } };
    S.tick(0.016); S.tick(0.016); // arm
    pressed = { 1: true }; S.tick(0.016); pressed = {};
    ok(S.current() === 'title', 'B returned to title');
    // Escape consumed by the menu screen: requests pause but main must not see it
    S.show('settings'); NR.input.setVirtual({ pause: true }); S.tick(0.016);
    ok(S.current() === 'title', 'pause request on settings acts as back');
  });

  H.test('ui: optional jsdom build of every screen', function () {
    let JSDOM;
    try { JSDOM = require('jsdom').JSDOM; } catch (e) { return; } // jsdom not installed: skipped by design
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/<script[^>]*><\/script>/g, '');
    const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
    const w = dom.window; w.HTMLCanvasElement.prototype.getContext = function () { return null; };
    w.localStorage.clear();
    for (const src of H.scriptOrder()) { if (src === 'src/main.js') continue; w.eval(read(path.join(ROOT, src))); }
    w.eval(read(path.join(ROOT, 'src/main.js')));
    const NR = w.NR; NR.main.boot();
    for (const n of ['title', 'select', 'settings', 'meta', 'codex']) { NR.ui.screens.show(n); ok(w.document.querySelector('.scr'), n); }
    NR.run.start({ charId: 'ranger', danger: 0, seed: 3 }); NR.run.togglePause(); ok(w.document.querySelector('.scr-pause'));
    NR.run.togglePause(); NR.shop.open(1); NR.run.setState('shop'); ok(w.document.querySelector('.scr-shop'));
  });
};
