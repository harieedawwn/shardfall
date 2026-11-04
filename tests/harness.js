'use strict';
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const fakeCanvas = require('./fake-canvas');

const ROOT = path.join(__dirname, '..');
// SPEC section 8: event -> required payload fields
const EVENTS = {
  'state:change': ['from', 'to'], 'run:start': ['seed', 'charId', 'danger', 'endless'], 'run:end': ['result', 'stats'],
  'wave:start': ['wave', 'zone', 'isBoss', 'duration'], 'wave:clear': ['wave', 'isBoss'],
  'weapon:fire': ['weaponId', 'slot', 'kind', 'x', 'y', 'angle'], 'weapon:gain': ['weaponId', 'slot', 'level', 'isNew'],
  'weapon:evolve': ['slot', 'from', 'into'], 'projectile:impact': ['x', 'y', 'r', 'element', 'team', 'surface'],
  'damage:dealt': ['weaponId', 'target', 'isBoss', 'amount', 'crit', 'element', 'x', 'y', 'killed'],
  'status:apply': ['target', 'status', 'stacks', 'x', 'y'], 'status:react': ['reaction', 'target', 'x', 'y', 'element', 'r'], 'event:start': ['id', 'x', 'y', 'duration', 'wave'], 'event:end': ['id', 'success', 'x', 'y', 'reason'], 'chain:arc': ['points', 'element'],
  'area:explode': ['x', 'y', 'r', 'element', 'team', 'weaponId'],
  'player:hurt': ['amount', 'hp', 'srcId', 'dodged', 'revived', 'x', 'y'], 'player:dash': ['x', 'y', 'dx', 'dy', 'charges'],
  'player:death': ['x', 'y'], 'player:levelup': ['level', 'pending'], 'levelup:open': ['level', 'cards', 'rerollPrice', 'pending'],
  'shop:change': ['reason', 'offers', 'rerollPrice', 'gold'], 'item:gain': ['itemId', 'count', 'source'],
  'enemy:spawn': ['enemy'], 'enemy:death': ['enemy', 'weaponId', 'x', 'y', 'elite', 'isBoss'],
  'enemy:attack': ['enemy', 'kind', 'time', 'x', 'y', 'r'], 'boss:phase': ['boss', 'phase'], 'boss:death': ['boss', 'x', 'y'],
  'pickup:collect': ['type', 'value', 'x', 'y'], 'meta:change': ['kind', 'id'], 'codex:discover': ['kind', 'id'],
  'settings:change': ['key', 'value'], 'input:device': ['device']
};
const OPTIONAL_EVENTS = ['input:device', 'settings:change', 'codex:discover', 'meta:change'];

const H = { ROOT: ROOT, EVENTS: EVENTS, OPTIONAL_EVENTS: OPTIONAL_EVENTS, tests: [], audit: null, cur: null };

// script order = index.html order
H.scriptOrder = function () {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const out = [], re = /<script[^>]*\ssrc="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
};

// load(opts{fx,ui,storage}) -> NR in a fresh vm context with no DOM (fake DOM when fx/ui requested)
H.load = function (opts) {
  opts = opts || {};
  const audit = { seen: {}, problems: [], _p: {} };
  const listeners = {};
  const t0 = process.hrtime.bigint();
  const sandbox = {
    console: console,
    performance: { now: function () { return Number(process.hrtime.bigint() - t0) / 1e6; } },
    addEventListener: function (t, f) { (listeners[t] = listeners[t] || []).push(f); },
    removeEventListener: function () {},
    __rafQueue: []
  };
  sandbox.requestAnimationFrame = function (f) { sandbox.__rafQueue.push(f); return sandbox.__rafQueue.length; };
  sandbox.cancelAnimationFrame = function () {};
  if (opts.storage === 'blocked') {
    Object.defineProperty(sandbox, 'localStorage', { get: function () { throw new Error('SecurityError: storage blocked'); } });
  } else if (opts.storage) sandbox.localStorage = opts.storage;
  let dom = null;
  if (opts.fx || opts.ui) { dom = fakeCanvas.fakeDom(); sandbox.document = dom.document; }
  if (opts.navigator) sandbox.navigator = opts.navigator;
  const ctx = vm.createContext(sandbox);
  for (const src of H.scriptOrder()) {
    if (/^src\/fx\//.test(src) && !opts.fx) continue;
    if (/^src\/ui\//.test(src) && !opts.ui) continue;
    const file = path.join(ROOT, src);
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
    if (src === 'src/core/events.js') {
      const NR0 = ctx.NR, orig = NR0.events.emit;
      NR0.events.emit = function (name, payload) {
        audit.seen[name] = (audit.seen[name] || 0) + 1;
        const sch = EVENTS[name];
        if (!sch) audit._p['unknown event ' + name] = 1;
        else for (let i = 0; i < sch.length; i++) if (!payload || !(sch[i] in payload)) audit._p[name + ' missing ' + sch[i]] = 1;
        return orig(name, payload);
      };
    }
  }
  const NR = ctx.NR;
  audit.get = function () { return Object.keys(audit._p); };
  H.audit = audit; H.cur = NR;
  NR.harness = H; NR.fakeCanvas = fakeCanvas;
  NR.bot = require('./bot')(NR);
  NR.__sandbox = sandbox; NR.__dom = dom; NR.__listeners = listeners;
  NR.__fire = function (type, ev) { (listeners[type] || []).forEach(function (f) { f(ev || {}); }); };
  return NR;
};

H.test = function (name, fn) { H.tests.push({ name: name, fn: fn }); };

H.eq = function (a, b, msg) {
  if (!deepEq(a, b)) throw new Error((msg ? msg + ': ' : '') + 'expected ' + show(b) + ' got ' + show(a));
};
function show(v) { try { const s = JSON.stringify(v); return s === undefined ? String(v) : (s.length > 160 ? s.slice(0, 160) + '...' : s); } catch (e) { return String(v); } }
function deepEq(a, b) {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-9;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!deepEq(a[k], b[k])) return false;
  return true;
}

// hash of sim-only state (never reads fx fields)
H.hashWorld = function (W) {
  const NR = H.cur;
  let h = 0x811c9dc5;
  const mix = function (v) { h ^= (v | 0); h = Math.imul(h, 16777619); };
  const num = function (v) { mix(Math.round(v * 1000)); };
  const str = function (s) { s = String(s); for (let i = 0; i < s.length; i++) mix(s.charCodeAt(i)); mix(0); };
  mix(W.tick); mix(W.wave); str(W.state); num(W.time); num(W.waveT);
  const p = W.player;
  if (p) { num(p.x); num(p.y); num(p.hp); num(p.gold); num(p.xp); mix(p.level); mix(p.pending); for (const w of p.weapons) { str(w.id); mix(w.lvl); } for (const k of Object.keys(p.items).sort()) { str(k); mix(p.items[k]); } }
  for (const e of W.enemies) { str(e.defId); num(e.x); num(e.y); num(e.hp); }
  mix(W.projectiles.length); for (const e of W.projectiles) { num(e.x); num(e.y); }
  mix(W.pickups.length); mix(W.areas.length); mix(W.drones.length);
  mix(W.stats.kills); num(W.stats.damageTaken); mix(W.stats.goldEarned | 0);
  if (NR && NR.rng) mix(NR.rng.getState());
  return h >>> 0;
};

// returns a path to the first non-finite number found in live entities, or null
H.findNaN = function (W) {
  const bad = function (o, keys) { for (const k of keys) if (typeof o[k] === 'number' && !isFinite(o[k])) return k; return null; };
  const P = ['x', 'y', 'vx', 'vy', 'hp', 'maxHp', 'gold', 'xp', 'aim', 'iframes'];
  const E = ['x', 'y', 'vx', 'vy', 'hp', 'r', 'speed', 'dmg'];
  let k;
  if (W.player && (k = bad(W.player, P))) return 'player.' + k;
  for (let i = 0; i < W.enemies.length; i++) if ((k = bad(W.enemies[i], E))) return 'enemies[' + i + '].' + k;
  for (let i = 0; i < W.projectiles.length; i++) if ((k = bad(W.projectiles[i], ['x', 'y', 'vx', 'vy', 'dmg']))) return 'projectiles[' + i + '].' + k;
  for (let i = 0; i < W.pickups.length; i++) if ((k = bad(W.pickups[i], ['x', 'y', 'value']))) return 'pickups[' + i + '].' + k;
  if (!isFinite(W.time) || !isFinite(W.waveT)) return 'time';
  return null;
};

// runSim(opts{seconds,seed,char,danger,fx,render}) -> summary
H.runSim = function (opts) {
  const NR = H.load({ fx: !!opts.fx || !!opts.render });
  NR.main.boot();
  return NR.bot.play(opts);
};

module.exports = H;
