'use strict';
// Dev-only screenshot matrix (Playwright + the pre-installed Chromium). Not loaded by the game.
//   node tools/shots.js --out docs/screenshots/after [--sizes a,b] [--screens x,y] [--engine chromium|webkit|firefox] [--q low|medium|high|auto]
// Opens index.html over file:// (no server needed), drives the game through its public API, saves JPEGs as
// <out>/<size>/<screen>[.<lang>].jpg and writes <out>/report.json with console errors, network requests and overflow checks.
const fs = require('fs');
const path = require('path');
const pw = require('playwright');

const root = path.join(__dirname, '..');
function arg(name, def) { const i = process.argv.indexOf('--' + name); return i < 0 ? def : process.argv[i + 1]; }
const OUT = path.resolve(root, arg('out', 'docs/screenshots/after'));
const ENGINE = arg('engine', 'chromium');
const QUALITY = arg('q', '');
const SIZES = {
  'desk-1920x1080': { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
  'desk-1366x768': { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 },
  'desk-1440x900': { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  'ultra-2560x1080': { viewport: { width: 2560, height: 1080 }, deviceScaleFactor: 1 },
  'win-1280x800@1.25': { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.25 },
  'iphoneSE-land': { viewport: { width: 667, height: 375 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, safe: [0, 0, 0, 0] },
  'iphone15pro-land': { viewport: { width: 852, height: 393 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, safe: [0, 59, 21, 59] },
  'iphone15pro-port': { viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, safe: [59, 0, 34, 0] },
  'pixel7-land': { viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true },
  'android-640x360': { viewport: { width: 640, height: 360 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  'ipad-land': { viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  'ipad-port': { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
};
// text-heavy screens are also shot in English on these sizes
const EN_SIZES = ['desk-1366x768', 'iphoneSE-land', 'iphone15pro-port', 'ipad-port'];
const TEXT_SCREENS = ['select', 'levelup', 'shop', 'settings', 'codex', 'meta', 'end'];
const SCREENS = ['menu', 'select', 'wave1', 'stress', 'boss', 'levelup', 'shop', 'pause', 'settings', 'codex', 'meta', 'end'];

const pick = function (list, csv) { if (!csv) return list; const w = csv.split(','); return list.filter(function (x) { return w.indexOf(x) >= 0; }); };
const sizes = pick(Object.keys(SIZES), arg('sizes', ''));
const screens = pick(SCREENS, arg('screens', ''));

// runs inside the page: put the game into the named state
function setup(name) {
  const NR = window.NR, S = NR.ui.screens;
  const godMode = function () { const p = NR.world.get().player; p.hp = p.maxHp = 1e6; };
  const fight = function () { NR.input.inject({ mx: 0.15, my: 0.05, aim: 0, fire: true, dash: false, pause: false, device: 'kbm' }); };
  switch (name) {
    case 'menu': return 800;
    case 'select': S.show('select'); return 900;
    case 'wave1': NR.run.start({ charId: 'ranger', danger: 0, seed: 3 }); godMode(); fight(); return 5000;
    case 'boss': {
      NR.run.start({ charId: 'ranger', danger: 0, seed: 3 }); godMode(); fight();
      const W = NR.world.get(); W.wave = 5; W.zone = 'scrap'; W.scale = NR.stats.enemyScale(5, 0); NR.director.startWave(5);
      return 4000;
    }
    case 'levelup': NR.run.start({ charId: 'ranger', danger: 0, seed: 3 }); godMode(); NR.progression.addXp(60); NR.events.emit('wave:clear', { wave: 1, isBoss: false }); return 3000;
    case 'shop': {
      NR.run.start({ charId: 'ranger', danger: 0, seed: 3 }); godMode(); NR.world.get().player.gold = 140;
      NR.events.emit('wave:clear', { wave: 1, isBoss: false }); return 3000;
    }
    case 'pause': NR.run.start({ charId: 'ranger', danger: 0, seed: 3 }); godMode(); fight(); setTimeout(function () { NR.input.inject(null); NR.run.togglePause(); }, 2500); return 3300;
    case 'settings': S.show('settings'); return 900;
    case 'codex': S.show('codex'); return 900;
    case 'meta': S.show('meta'); return 900;
    case 'end': NR.run.start({ charId: 'ranger', danger: 0, seed: 3 }); godMode(); fight(); setTimeout(function () { NR.input.inject(null); NR.run.endRun('lose'); }, 2000); return 3200;
  }
  return 500;
}

// runs inside the page: find text clipped by its box or elements outside the viewport, and small tap targets
function audit() {
  const vw = innerWidth, vh = innerHeight, bad = [];
  const all = document.querySelectorAll('#ui *');
  for (let i = 0; i < all.length && bad.length < 25; i++) {
    const e = all[i], cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const label = (e.className && String(e.className).slice(0, 40)) + ' "' + String(e.textContent || '').trim().slice(0, 24) + '"';
    if (r.right > vw + 1 || r.bottom > vh + 1 || r.left < -1 || r.top < -1) {
      if (!e.closest('.scroll, [data-scroll]') && cs.position !== 'static') bad.push('offscreen ' + label);
    }
    if (e.children.length === 0 && e.textContent.trim() && cs.overflow !== 'visible' && (e.scrollWidth > e.clientWidth + 1)) bad.push('clipped ' + label);
    if ((e.tagName === 'BUTTON' || e.getAttribute('role') === 'button') && (r.width < 44 || r.height < 44) && matchMedia('(pointer: coarse)').matches) bad.push('tap<44 ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' ' + label);
  }
  return bad;
}

(async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await pw[ENGINE].launch();
  const url = 'file://' + path.join(root, 'index.html');
  const report = {};
  for (const sz of sizes) {
    const S = SIZES[sz];
    fs.mkdirSync(path.join(OUT, sz), { recursive: true });
    for (const scr of screens) {
      const langs = EN_SIZES.indexOf(sz) >= 0 && TEXT_SCREENS.indexOf(scr) >= 0 ? ['vi', 'en'] : ['vi'];
      for (const lang of langs) {
        const ctxOpts = { viewport: S.viewport, deviceScaleFactor: S.deviceScaleFactor };
        if (ENGINE !== 'firefox') { ctxOpts.isMobile = !!S.isMobile; }
        ctxOpts.hasTouch = !!S.hasTouch;
        const context = await browser.newContext(ctxOpts);
        const page = await context.newPage();
        const errors = [], net = [];
        page.on('console', function (m) { if (m.type() === 'error') errors.push(m.text()); });
        page.on('pageerror', function (e) { errors.push(String(e)); });
        page.on('request', function (r) { if (!/^(file|data|blob):/.test(r.url())) net.push(r.url()); });
        const seed = { language: lang };
        if (QUALITY) seed.quality = QUALITY;
        await page.addInitScript(function (s) {
          try {
            const raw = localStorage.getItem('shardfall.save');
            const d = raw ? JSON.parse(raw) : { v: 1, settings: {} };
            d.settings = Object.assign(d.settings || {}, s);
            localStorage.setItem('shardfall.save', JSON.stringify(d));
          } catch (e) { /* storage blocked */ }
        }, seed);
        if (S.safe) {
          // emulate notch insets: override the --sa* variables css/ui.css fills from env(safe-area-inset-*)
          await page.addInitScript(function (s) {
            const set = function () {
              const st = document.documentElement.style;
              st.setProperty('--sat', s[0] + 'px'); st.setProperty('--sar', s[1] + 'px'); st.setProperty('--sab', s[2] + 'px'); st.setProperty('--sal', s[3] + 'px');
            };
            if (document.documentElement) set(); else document.addEventListener('readystatechange', set, { once: true });
          }, S.safe);
        }
        const target = url + (scr === 'stress' ? '?stress=1' : '');
        await page.goto(target);
        await page.waitForTimeout(400);
        let wait = 600;
        if (scr !== 'stress') wait = await page.evaluate(setup, scr);
        else wait = 2500;
        await page.waitForTimeout(wait);
        const issues = await page.evaluate(audit);
        const file = path.join(OUT, sz, scr + (langs.length > 1 ? '.' + lang : '') + '.jpg');
        await page.screenshot({ path: file, type: 'jpeg', quality: 62 });
        const fps = await page.evaluate(function () { return Math.round(window.NR.loop.fps()); });
        report[sz + '/' + scr + '/' + lang] = { errors: errors, network: net, issues: issues, fps: fps };
        if (errors.length || net.length) console.log('!! ' + sz + ' ' + scr + ' ' + lang + ' errors=' + errors.length + ' net=' + net.length);
        await context.close();
      }
    }
    console.log('done ' + sz);
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
  let e = 0, n = 0, iss = 0;
  for (const k in report) { e += report[k].errors.length; n += report[k].network.length; iss += report[k].issues.length; }
  console.log('shots: ' + Object.keys(report).length + ', console errors ' + e + ', network requests ' + n + ', layout issues ' + iss);
})().catch(function (err) { console.error(err); process.exit(1); });
