// Owner: UI. DOM-overlay screens: title, character select, level-up, shop, pause, settings, meta upgrades, codex, victory, run end.
// Mouse, keyboard, gamepad and touch navigable; every string goes through NR.i18n; content names come from the data ({vi, en}).
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  NR.ui = NR.ui || {};

  const t = function (k, p) { return NR.i18n.t(k, p); };
  const tx = function (o) { return NR.i18n.text(o); };
  const RARITIES = ['common', 'rare', 'epic', 'legendary'];
  const RCOL = { common: '#A8A6B8', rare: '#5FA8D3', epic: '#A25CE0', legendary: '#FFD43B' };
  const ELEMS = { physical: '#F2EFE6', fire: '#FF7A2F', ice: '#7FD3F0', shock: '#FFD43B', poison: '#8BD450', void: '#A25CE0' };
  const STAT_GROUPS = [
    ['survival', ['maxHp', 'hpRegen', 'armor', 'dodge', 'revives']],
    ['offense', ['damage', 'attackSpeed', 'critChance', 'critDamage', 'area', 'range', 'projectiles', 'pierce', 'projSpeed', 'knockback', 'statusPower', 'lifesteal']],
    ['utility', ['moveSpeed', 'dashCharges', 'dashCooldown', 'pickupRange', 'xpGain', 'goldGain', 'luck', 'shopDiscount', 'weaponSlots']]
  ];
  // [kind, suffix]; kind: int | d1 | d2 | pct
  const SF = {
    maxHp: ['int'], hpRegen: ['d1', '/s'], armor: ['int'], dodge: ['pct'], revives: ['int'], damage: ['pct'], attackSpeed: ['pct'], critChance: ['pct'],
    critDamage: ['pct'], area: ['pct'], range: ['pct'], projectiles: ['int'], pierce: ['int'], projSpeed: ['pct'], knockback: ['pct'], statusPower: ['pct'],
    lifesteal: ['pct'], moveSpeed: ['pct'], dashCharges: ['int'], dashCooldown: ['d2', 's'], pickupRange: ['int', 'px'], xpGain: ['pct'], goldGain: ['pct'],
    luck: ['pct'], shopDiscount: ['pct'], weaponSlots: ['int'], startGold: ['int']
  };
  const LOW_IS_GOOD = { dashCooldown: true };
  const BRANCH = {
    maxHp: 'vital', hpRegen: 'vital', armor: 'vital', dodge: 'vital', revives: 'vital', damage: 'power', attackSpeed: 'power', critChance: 'power', critDamage: 'power',
    weaponSlots: 'power', area: 'power', moveSpeed: 'move', dashCharges: 'move', dashCooldown: 'move', pickupRange: 'move', startGold: 'fortune', shopDiscount: 'fortune',
    luck: 'fortune', goldGain: 'fortune', xpGain: 'fortune'
  };
  const BRANCH_ORDER = ['vital', 'power', 'move', 'fortune'];

  // ---------- state ----------
  let root = null, cur = null, curEl = null, openedAt = 0, settingsFrom = 'title', tipEl = null, msgEl = null, msgT = 0, padWait = true;
  const SCREENS = {};
  const D = { charId: 'ranger', danger: 0, codexTab: 'weapon', codexSel: null, statsOpen: false, confirm: null, lastOpen: null, newDanger: 0, record: false, tab: 0 };
  const pad = { prev: {}, hold: 0, dir: '', nextAt: 0 };
  let input = 'kbm';

  // ---------- tiny DOM helpers (only touch `document` lazily, never at load) ----------
  function add(parent, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { for (let i = 0; i < c.length; i++) add(parent, c[i]); return; }
    if (typeof c === 'string' || typeof c === 'number') { parent.appendChild(document.createTextNode(String(c))); return; }
    parent.appendChild(c);
  }
  function h(tag, cls, kids) { const e = document.createElement(tag); if (cls) e.className = cls; add(e, kids); return e; }
  function now() { const p = globalThis.performance; return p && p.now ? p.now() : Date.now(); }
  function later(fn, ms) { return globalThis.setTimeout ? globalThis.setTimeout(fn, ms) : 0; }
  function clear(e) { while (e.children && e.children.length) e.removeChild(e.children[0]); e.textContent = ''; }
  function walk(e, fn) { const k = e.children || []; for (let i = 0; i < k.length; i++) { fn(k[i]); walk(k[i], fn); } }
  function world() { return NR.world.get(); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sfx(name) { try { const a = NR.fx && NR.fx.audio; if (a && a.sfx) a.sfx(name); } catch (e) { /* audio is optional */ } }
  function upper(s) { try { return String(s).toLocaleUpperCase(NR.i18n.getLang()); } catch (e) { return String(s).toUpperCase(); } }
  function mmss(sec) { sec = Math.max(0, Math.round(sec)); const m = Math.floor(sec / 60), s = sec % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
  function pct(v) { return Math.round(v * 100) + '%'; }
  function num(n) { return NR.util.fmt(n); }

  // ---------- flat shape icons on small canvases ----------
  function icon(shape, color, size, sil) {
    const c = document.createElement('canvas');
    c.className = 'ico' + (sil ? ' sil' : '');
    const dpr = Math.max(1, Math.min(2, globalThis.devicePixelRatio || 1));
    c.width = Math.round(size * dpr); c.height = c.width;
    c.style.width = size + 'px'; c.style.height = size + 'px';
    c.setAttribute('aria-hidden', 'true');
    let g = null;
    try { g = c.getContext ? c.getContext('2d') : null; } catch (e) { g = null; }
    if (g && NR.ui.hud) {
      g.scale(dpr, dpr);
      const opts = { line: Math.max(1.8, size * 0.06), shadow: sil ? 0 : Math.max(1.5, size * 0.05), sil: !!sil };
      if (shape === 'shard' || shape === 'diamond') {
        NR.ui.hud.drawPickup(g, 'xp_shard', size / 2, size / 2, size * 0.38, color, opts);
      } else if (shape === 'gold') {
        NR.ui.hud.drawPickup(g, 'gold', size / 2, size / 2, size * 0.38, color, opts);
      } else if (NR.ui.hud.drawEntityIcon && NR.data && ((NR.data.weapons && NR.data.weapons[shape]) || (NR.data.items && NR.data.items[shape]) || (NR.data.characters && NR.data.characters[shape]) || (NR.data.upgrades && NR.data.upgrades[shape]))) {
        NR.ui.hud.drawEntityIcon(g, '', shape, size / 2, size / 2, size * 0.40, sil ? '#1D1530' : color, opts);
      } else if (NR.ui.hud.shape) {
        NR.ui.hud.shape(g, shape || 'circle', size / 2, size / 2, size * 0.32, sil ? '#1D1530' : color, opts);
      }
    }
    return c;
  }
  function itemShape(d) { const r = d && d.rarity; return r === 'legendary' ? 'star' : r === 'epic' ? 'hex' : r === 'rare' ? 'diamond' : 'circle'; }
  function defOf(kind, id) {
    if (kind === 'weapon' || kind === 'evolution') return NR.data.weapons[id];
    if (kind === 'item') return NR.data.items[id];
    if (kind === 'stat') return NR.data.upgrades[id];
    if (kind === 'enemy') return NR.data.enemies[id];
    if (kind === 'boss') return NR.data.bosses[id];
    if (kind === 'character') return NR.data.characters[id];
    return null;
  }
  function iconOf(kind, id, size, sil) {
    const c = document.createElement('canvas');
    c.className = 'ico' + (sil ? ' sil' : '');
    const dpr = Math.max(1, Math.min(2, globalThis.devicePixelRatio || 1));
    c.width = Math.round(size * dpr); c.height = c.width;
    c.style.width = size + 'px'; c.style.height = size + 'px';
    c.setAttribute('aria-hidden', 'true');
    let g = null;
    try { g = c.getContext ? c.getContext('2d') : null; } catch (e) { g = null; }
    if (g && NR.ui.hud) {
      g.scale(dpr, dpr);
      const d = defOf(kind, id) || {};
      const col = d.color || (d.rarity && RCOL[d.rarity]) || '#F2EFE6';
      const opts = { line: Math.max(1.8, size * 0.06), shadow: sil ? 0 : Math.max(1.5, size * 0.05), sil: !!sil };
      if (NR.ui.hud.drawEntityIcon) {
        NR.ui.hud.drawEntityIcon(g, kind, id, size / 2, size / 2, size * 0.40, sil ? '#1D1530' : col, opts);
      } else {
        const shape = kind === 'item' ? (d.shape || itemShape(d)) : (d.shape || 'circle');
        NR.ui.hud.shape(g, shape, size / 2, size / 2, size * 0.32, sil ? '#1D1530' : col, opts);
      }
    }
    return c;
  }
  function cur2(kind, n, cls) {
    return h('span', 'cur ' + (cls || ''), [kind === 'shard' ? icon('shard', '#7FD3F0', 18) : icon('gold', '#FFD43B', 18), h('b', '', String(n))]);
  }
  const gold = function (n, cls) { return cur2('gold', n, cls); };
  const shards = function (n, cls) { return cur2('shard', n, cls); };

  // ---------- stats formatting ----------
  function fmtVal(k, v) {
    const f = SF[k] || ['int'];
    let s;
    if (f[0] === 'pct') s = pct(v); else if (f[0] === 'd1') s = (Math.round(v * 10) / 10).toFixed(1); else if (f[0] === 'd2') s = v.toFixed(2); else s = String(Math.round(v));
    return f[1] ? s + f[1] : s;
  }
  function fmtDelta(k, add, p) {
    if (p) return (p > 0 ? '+' : '') + (Math.round(p * 1000) / 10) + '%';
    const f = SF[k] || ['int'], sg = add > 0 ? '+' : '';
    if (f[0] === 'pct') return sg + (Math.round(add * 1000) / 10) + '%';
    if (f[0] === 'd1') return sg + (Math.round(add * 10) / 10) + '/s';
    if (f[0] === 'd2') return sg + add.toFixed(2) + 's';
    return sg + (Math.round(add * 100) / 100) + (f[1] === 'px' ? 'px' : '');
  }
  function previewStat(p, stat, add, pc) {
    const d = { baseStats: p.baseStats, mods: (p.mods || []).concat([{ src: 'preview', stat: stat, add: add || 0, pct: pc || 0, mult: 1 }]), stats: {} };
    NR.stats.recalc(d);
    return d.stats[stat];
  }
  function modLine(m) { return fmtDelta(m.stat, m.add || 0, m.pct || 0) + ' ' + t('stat.' + m.stat); }
  function modsText(mods) { return (mods || []).map(modLine).join(' · '); }

  // ---------- messages, tooltips ----------
  function flash(text, bad) {
    if (!root) return;
    if (!msgEl) { msgEl = h('div', 'msg'); msgEl.setAttribute('role', 'status'); root.appendChild(msgEl); }
    msgEl.textContent = text; msgEl.className = 'msg show' + (bad ? ' bad' : '');
    if (msgEl.parentNode !== root) root.appendChild(msgEl);
    msgT = now();
    const mark = msgT;
    later(function () { if (msgT === mark && msgEl) msgEl.className = 'msg'; }, 2200);
  }
  function setTip(e, v, focusable) { e._tip = v; if (focusable && e.getAttribute('tabindex') === null && e.tagName !== 'BUTTON') e.setAttribute('tabindex', '0'); return e; }
  function tipOf(e) { while (e) { if (e._tip) return e; e = e.parentNode; } return null; }
  function showTip(src) {
    if (!tipEl || !src) return;
    const v = typeof src._tip === 'function' ? src._tip() : src._tip;
    if (!v) return hideTip();
    clear(tipEl);
    const lines = Array.isArray(v) ? v : String(v).split('\n');
    for (let i = 0; i < lines.length; i++) tipEl.appendChild(h('div', i === 0 ? 'tp-h' : 'tp-l', lines[i]));
    tipEl.className = 'tip show';
    try {
      const r = src.getBoundingClientRect(), vw = globalThis.innerWidth || 1280, vh = globalThis.innerHeight || 720, w = tipEl.offsetWidth || 240, hh = tipEl.offsetHeight || 80;
      let x = r.left + r.width / 2 - w / 2, y = r.bottom + 8;
      if (y + hh > vh - 6) y = Math.max(6, r.top - hh - 8);
      tipEl.style.left = Math.round(clamp(x, 6, Math.max(6, vw - w - 6))) + 'px'; tipEl.style.top = Math.round(y) + 'px';
    } catch (e) { /* no layout in tests */ }
  }
  function hideTip() { if (tipEl) tipEl.className = 'tip'; }

  // ---------- buttons and guard ----------
  const GUARD = { ms: 280 };
  function guarded() { const d = SCREENS[cur]; return !!(d && d.guard && now() - openedAt < GUARD.ms); }
  // o: { fk, off, offMsg, auto, label }
  function btn(cls, kids, fn, o) {
    o = o || {};
    const b = h('button', 'btn' + (cls ? ' ' + cls : ''), kids);
    b.setAttribute('type', 'button');
    if (o.fk) b.setAttribute('data-fk', o.fk);
    if (o.auto) b.setAttribute('data-auto', '1');
    if (o.label) b.setAttribute('aria-label', o.label);
    if (o.off) { b.setAttribute('aria-disabled', 'true'); b.className += ' off'; }
    b.addEventListener('click', function (ev) {
      if (guarded()) return;
      if (o.off) { sfx('ui_deny'); if (o.offMsg) flash(o.offMsg, true); return; }
      sfx('ui_click');
      fn(ev);
    });
    return b;
  }
  // first click arms, second click (within 3 s) confirms
  function confirmBtn(cls, label, sure, fn, o) {
    let armed = false, mark = 0;
    const b = btn(cls, label, function () {
      if (!armed) {
        armed = true; mark = now(); b.className += ' armed'; clear(b); b.appendChild(document.createTextNode(sure));
        later(function () { if (armed && now() - mark >= 2900) { armed = false; b.className = b.className.replace(' armed', ''); clear(b); add(b, label); } }, 3000);
        return;
      }
      armed = false; fn();
    }, o);
    return b;
  }
  function keycap(k) { return h('kbd', 'kh', k); }

  function seg(items, current, onPick, cls) {
    const w = h('div', 'seg' + (cls ? ' ' + cls : ''));
    w.setAttribute('role', 'group');
    items.forEach(function (it) {
      const b = btn((it.value === current ? 'on' : '') + (it.cls ? ' ' + it.cls : ''), it.label, function () { onPick(it.value); }, { fk: 'seg-' + it.value, off: it.off, offMsg: it.offMsg });
      b.setAttribute('aria-pressed', it.value === current ? 'true' : 'false');
      if (it.tip) setTip(b, it.tip);
      w.appendChild(b);
    });
    return w;
  }
  function langToggle() {
    const L = NR.i18n.getLang();
    return seg([{ value: 'vi', label: 'VI' }, { value: 'en', label: 'EN' }], L, function (v) { NR.save.setSetting('language', v); }, 'lang');
  }
  function foot(extraKb, extraPad) {
    const f = h('div', 'foot');
    f.appendChild(h('span', 'kb', t('hint.kb') + (extraKb ? ' · ' + extraKb : '')));
    f.appendChild(h('span', 'pd', t('hint.pad') + (extraPad ? ' · ' + extraPad : '')));
    return f;
  }
  function scr(name, cls) {
    const e = h('div', 'scr scr-' + name + (cls ? ' ' + cls : ''));
    e.setAttribute('role', 'dialog'); e.setAttribute('aria-modal', 'true');
    return e;
  }
  function head(title, sub, back) {
    const hd = h('header', 'hd');
    if (back) hd.appendChild(btn('back', [h('span', 'arr', ''), t('common.back')], back, { fk: 'back', label: t('common.back') }));
    hd.appendChild(h('div', 'ht', [h('h2', 'h', title), sub ? h('p', 'sub', sub) : null]));
    return hd;
  }
  function charName(id) { const d = NR.data.characters[id]; return d ? tx(d.name) : id; }
  function rarityTag(r) { const s = h('span', 'tag r-' + r, t('rarity.' + r)); return s; }
  function pips(n, max, cls) {
    const w = h('span', 'pips ' + (cls || '')); w.setAttribute('aria-label', n + '/' + max);
    for (let i = 0; i < max; i++) w.appendChild(h('i', i < n ? 'on' : ''));
    return w;
  }

  // ---------- generic: stats panel ----------
  function statsPanel(p, id) {
    const box = h('section', 'stats' + (D.statsOpen ? ' open' : ''));
    box.appendChild(h('h3', 'h sm', t('stats.title')));
    const defs = NR.stats.defaults, st = p.stats || {};
    STAT_GROUPS.forEach(function (g) {
      const gr = h('div', 'sg');
      gr.appendChild(h('h4', 'sgt', t('stats.group.' + g[0])));
      g[1].forEach(function (k) {
        const v = st[k] === undefined ? defs[k] : st[k], base = defs[k];
        let cls = 'sr';
        if (Math.abs(v - base) > 1e-9) { const better = LOW_IS_GOOD[k] ? v < base : v > base; cls += better ? ' up' : ' down'; }
        const r = h('div', cls, [h('span', 'sn', t('stat.' + k)), h('b', 'sv', fmtVal(k, v))]);
        setTip(r, function () { return [t('stat.' + k), t('tip.' + k), t('tip.now', { v: fmtVal(k, v), base: fmtVal(k, base) })]; }, true);
        gr.appendChild(r);
      });
      box.appendChild(gr);
    });
    return box;
  }

  // ---------- generic: weapon / item facts ----------
  function weaponLevel(d, lvl) { return d.levels ? d.levels[clamp(lvl, 1, d.levels.length) - 1] : null; }
  function weaponChips(d, lvl) {
    const L = weaponLevel(d, lvl), out = [];
    out.push(h('span', 'chip el-' + d.element, t('element.' + d.element)));
    out.push(h('span', 'chip', t('kind.' + d.kind)));
    if (L) {
      out.push(h('span', 'chip', t('wp.dmg', { n: Math.round(L.dmg * 10) / 10 })));
      out.push(h('span', 'chip', t('wp.rate', { n: (Math.round(L.rate * 10) / 10).toFixed(1) })));
    }
    return out;
  }
  function itemInfo(d) { return tx(d.desc) || modsText(d.mods); }
  function evoFor(id) { const ev = NR.data.evolutions || []; for (let i = 0; i < ev.length; i++) if (ev[i].weapon === id) return ev[i]; return null; }
  function weaponTip(id, lvl) {
    const d = NR.data.weapons[id];
    const lines = [tx(d.name) + (d.evolved ? '' : '  ' + t('shop.lvl', { n: lvl })), tx(d.desc)];
    const L = weaponLevel(d, lvl);
    if (L) lines.push(t('wp.dmg', { n: Math.round(L.dmg * 10) / 10 }) + ' · ' + t('wp.rate', { n: L.rate.toFixed(1) }) + ' · ' + t('wp.count', { n: L.count || 1 }));
    const ev = evoFor(id);
    if (ev && NR.data.items[ev.catalyst]) lines.push(t('shop.evo', { item: tx(NR.data.items[ev.catalyst].name), name: tx(NR.data.weapons[ev.into].name) }));
    return lines;
  }

  // =====================================================================================================
  // TITLE
  // =====================================================================================================
  function decor() {
    const d = h('div', 'decor'); d.setAttribute('aria-hidden', 'true');
    const cols = ['#C9A24B', '#E86AA6', '#7FD3F0', '#A25CE0', '#D9693A', '#8BD450', '#FFD43B'];
    const shapes = ['tri', 'sq', 'dia', 'hex', 'tri', 'dia', 'sq', 'hex', 'tri'];
    for (let i = 0; i < shapes.length; i++) {
      const s = h('i', 'sh ' + shapes[i]);
      s.style.left = (52 + (i * 37) % 44) + '%'; s.style.top = (6 + (i * 53) % 78) + '%';
      s.style.background = cols[i % cols.length];
      s.style.animationDelay = (-i * 1.7) + 's'; s.style.animationDuration = (9 + (i % 4) * 2.5) + 's';
      d.appendChild(s);
    }
    return d;
  }
  SCREENS.title = {
    guard: false,
    build: function () {
      const meta = NR.save.getMeta(), run = NR.save.readRun();
      const s = scr('title', 'solid');
      s.appendChild(decor());
      const top = h('div', 'tt-top'); top.appendChild(langToggle()); s.appendChild(top);
      const col = h('div', 'tt-col');
      col.appendChild(h('h1', 'logo', t('game.title')));
      col.appendChild(h('p', 'tagline', t('title.tagline')));
      const menu = h('nav', 'tt-menu');
      menu.appendChild(btn('pri big', t('menu.play'), function () { show('select'); }, { fk: 'play', auto: true }));
      if (run && NR.data.characters[run.charId]) {
        menu.appendChild(btn('big', [h('span', '', t('menu.continue')), h('small', 'bsub', t('menu.continueInfo', { wave: run.wave, name: charName(run.charId) }))], function () {
          if (!NR.run.continueRun()) flash(t('menu.continueFail'), true);
        }, { fk: 'cont' }));
      }
      menu.appendChild(btn('big', [h('span', '', t('menu.upgrades')), shards(meta.shards)], function () { show('meta'); }, { fk: 'meta' }));
      menu.appendChild(btn('big', t('menu.codex'), function () { show('codex'); }, { fk: 'codex' }));
      menu.appendChild(btn('big', t('menu.settings'), function () { settingsFrom = 'title'; show('settings'); }, { fk: 'settings' }));
      col.appendChild(menu);
      col.appendChild(h('p', 'tt-stats', t('title.stats', { best: meta.bestWave || 0, runs: meta.runs || 0, wins: meta.wins || 0 })));
      col.appendChild(h('p', 'rotate', t('hint.rotate')));
      s.appendChild(col);
      s.appendChild(foot('', ''));
      return s;
    }
  };

  // =====================================================================================================
  // CHARACTER SELECT + DANGER
  // =====================================================================================================
  function charPreview(id) {
    const ch = NR.data.characters[id], S = NR.stats, base = {};
    for (const k in S.defaults) base[k] = S.defaults[k];
    const dd = ch.dash || {};
    if (dd.charges !== undefined) base.dashCharges = dd.charges;
    if (dd.cd !== undefined) base.dashCooldown = dd.cd;
    if (ch.base) for (const k in ch.base) base[k] = ch.base[k];
    const p = { baseStats: base, mods: [], stats: {} };
    try { if (NR.meta && NR.meta.applyToRun) NR.meta.applyToRun(p); } catch (e) { /* preview only */ }
    S.recalc(p);
    return p.stats;
  }
  const PREVIEW_STATS = ['maxHp', 'armor', 'moveSpeed', 'dashCharges', 'dashCooldown', 'damage', 'attackSpeed'];
  function unlockCost(id) { const u = NR.data.unlocks && NR.data.unlocks.chars; return u && u[id] !== undefined ? u[id] : (NR.data.characters[id].unlock ? NR.data.characters[id].unlock.cost || 0 : 0); }
  function dangerMult(d) {
    const a = NR.stats.enemyScale(1, 0), b = NR.stats.enemyScale(1, d);
    return { hp: b.hp / a.hp, dmg: b.dmg / a.dmg, count: b.count / a.count, shard: b.shardMult / a.shardMult };
  }
  const x2 = function (v) { return '×' + (Math.round(v * 100) / 100); };

  SCREENS.select = {
    guard: false,
    back: function () { show('title'); },
    build: function () {
      const meta = NR.save.getMeta(), ids = Object.keys(NR.data.characters);
      if (!NR.meta.charUnlocked(D.charId)) D.charId = 'ranger';
      if (!NR.data.characters[D.charId]) D.charId = ids[0];
      D.danger = clamp(D.danger, 0, NR.meta.maxDanger());
      const s = scr('select', 'solid');
      const wrap = h('div', 'wrap');
      wrap.appendChild(head(t('select.title'), t('select.sub'), function () { show('title'); }));
      const body = h('div', 'sel-body');
      // list
      const list = h('div', 'chars'); list.setAttribute('role', 'listbox');
      ids.forEach(function (id) {
        const d = NR.data.characters[id], ok = NR.meta.charUnlocked(id), on = id === D.charId;
        const b = h('button', 'btn card char' + (on ? ' on' : '') + (ok ? '' : ' locked'), [
          iconOf('character', id, 44, !ok),
          h('span', 'cn', [h('b', '', ok ? tx(d.name) : '???'), h('small', '', ok ? tx(d.desc) : t('select.locked'))]),
          ok ? null : h('span', 'clk', [h('i', 'lock'), shards(unlockCost(id))])
        ]);
        b.setAttribute('type', 'button'); b.setAttribute('data-fk', 'ch-' + id); b.setAttribute('aria-pressed', on ? 'true' : 'false');
        if (on) b.setAttribute('data-auto', '1');
        b.addEventListener('click', function () { sfx('ui_click'); D.charId = id; rerender(); });
        list.appendChild(b);
      });
      body.appendChild(list);
      // preview
      const id = D.charId, ch = NR.data.characters[id], ok = NR.meta.charUnlocked(id), pv = h('section', 'panel preview');
      pv.appendChild(h('div', 'pv-top', [iconOf('character', id, 72, !ok), h('div', 'pv-name', [h('h3', 'h', ok ? tx(ch.name) : '???'), h('p', '', tx(ch.desc))])]));
      if (tx(ch.passive)) pv.appendChild(h('p', 'passive', [h('b', '', t('select.passive') + ': '), tx(ch.passive)]));
      const st = charPreview(id), all = ids.map(charPreview);
      const sl = h('div', 'pstats');
      PREVIEW_STATS.forEach(function (k) {
        let mx = 0, mn = Infinity;
        all.forEach(function (a) { mx = Math.max(mx, a[k]); mn = Math.min(mn, a[k]); });
        let f = LOW_IS_GOOD[k] ? (st[k] > 0 ? mn / st[k] : 0) : (mx > 0 ? st[k] / mx : 0);
        const n = Math.round(clamp(f, 0, 1) * 10);
        const bar = h('span', 'sbar'); for (let i = 0; i < 10; i++) bar.appendChild(h('i', i < n ? 'on' : ''));
        const r = h('div', 'pr', [h('span', 'sn', t('stat.' + k)), bar, h('b', 'sv', fmtVal(k, st[k]))]);
        setTip(r, [t('stat.' + k), t('tip.' + k)], true);
        sl.appendChild(r);
      });
      pv.appendChild(sl);
      const wd = ch.startWeapon && NR.data.weapons[ch.startWeapon];
      if (wd) {
        const wbox = h('div', 'pv-weapon', [iconOf('weapon', ch.startWeapon, 40), h('div', '', [h('b', '', [t('select.startWeapon') + ': ', tx(wd.name)]), h('div', 'chips', weaponChips(wd, 1))])]);
        setTip(wbox, weaponTip(ch.startWeapon, 1), true);
        pv.appendChild(wbox);
      }
      if (!ok) {
        const c = unlockCost(id), can = meta.shards >= c;
        pv.appendChild(btn(can ? 'pri' : '', [t('select.unlock'), shards(c)], function () { if (NR.meta.unlockChar(id)) { flash(t('select.unlocked', { name: charName(id) })); rerender(); } }, { fk: 'unlock', off: !can, offMsg: t('select.needShards', { n: c - meta.shards }) }));
      }
      body.appendChild(pv);
      wrap.appendChild(body);
      // danger
      const dg = h('section', 'panel danger');
      dg.appendChild(h('h3', 'h sm', t('menu.danger')));
      const row = h('div', 'dg-row');
      for (let d = 0; d <= 5; d++) {
        const lock = d > NR.meta.maxDanger();
        const b = btn('dg' + (d === D.danger ? ' on' : '') + (lock ? ' lockd' : ''), lock ? [String(d), h('i', 'lock')] : String(d), function () { D.danger = d; rerender(); },
          { fk: 'dg-' + d, off: lock, offMsg: t('danger.locked', { n: d - 1 }) });
        b.setAttribute('aria-pressed', d === D.danger ? 'true' : 'false');
        setTip(b, lock ? [t('danger.' + d), t('danger.locked', { n: d - 1 })] : [t('danger.' + d), t('danger.effect', { hp: x2(dangerMult(d).hp), dmg: x2(dangerMult(d).dmg), count: x2(dangerMult(d).count), shard: x2(dangerMult(d).shard) })]);
        row.appendChild(b);
      }
      dg.appendChild(row);
      const m = dangerMult(D.danger);
      dg.appendChild(h('p', 'dg-info', [h('b', '', t('danger.' + D.danger)), ' — ', t('danger.effect', { hp: x2(m.hp), dmg: x2(m.dmg), count: x2(m.count), shard: x2(m.shard) })]));
      wrap.appendChild(dg);
      const act = h('div', 'actions');
      act.appendChild(btn('pri big go', t('select.start'), function () {
        NR.run.start({ charId: D.charId, danger: D.danger, seed: Date.now() % 2147483647 });
      }, { fk: 'start', off: !ok, offMsg: t('select.locked') }));
      wrap.appendChild(act);
      wrap.appendChild(foot('', ''));
      s.appendChild(wrap);
      return s;
    }
  };

  // =====================================================================================================
  // LEVEL UP
  // =====================================================================================================
  SCREENS.levelup = {
    guard: true,
    build: function () {
      const W = world(), p = W.player, L = W.levelup, open = D.lastOpen && D.lastOpen.cards === L.cards ? D.lastOpen : null;
      const cards = L.cards || [];
      const price = open && open.rerollPrice !== undefined ? open.rerollPrice : 5 + 5 * (L.rerolls || 0);
      const s = scr('levelup');
      const pn = h('section', 'panel lv');
      pn.appendChild(h('div', 'lv-top', [
        h('h2', 'h ttl', t('levelup.title')),
        h('p', 'sub', t('levelup.sub', { n: L.level || p.level, left: Math.max(0, p.pending - 1) }))
      ]));
      const row = h('div', 'cards');
      if (!cards.length) pn.appendChild(btn('pri', t('common.continue'), function () { NR.run.onLevelUpsDone(); }, { fk: 'cont', auto: true }));
      cards.forEach(function (c, i) {
        const isW = c.kind === 'weapon' || !!c.id;
        const wdef = isW ? NR.data.weapons[c.id] : null;
        const d = isW ? null : NR.data.upgrades[c.stat];
        const cv = isW ? 0 : p.stats[c.stat], nv = isW ? 0 : previewStat(p, c.stat, c.add, c.pct);
        const nameStr = isW ? tx(wdef.name) : tx(d.name);
        const deltaStr = isW ? (c.isNew ? 'NEW' : ('Lv ' + c.level)) : fmtDelta(c.stat, c.add, c.pct);
        const ftStr = isW ? (c.isNew ? t('shop.weapon') : ('Lv ' + (c.level - 1) + '  →  Lv ' + c.level)) : (fmtVal(c.stat, cv) + '  →  ' + fmtVal(c.stat, nv));
        const iconEl = isW ? iconOf('weapon', c.id, 42) : (c.stat ? iconOf('stat', c.stat, 38) : null);
        const b = h('button', 'btn card up r-' + c.rarity, [
          h('span', 'band', [h('span', '', t('rarity.' + c.rarity)), keycap(String(i + 1))]),
          h('span', 'ub', [
            iconEl ? h('div', 'uico', [iconEl]) : null,
            h('b', 'big', deltaStr),
            h('span', 'nm', nameStr),
            h('span', 'ft', ftStr)
          ])
        ]);
        b.setAttribute('type', 'button'); b.setAttribute('data-fk', 'c' + i); if (i === 0) b.setAttribute('data-auto', '1');
        b.setAttribute('aria-label', nameStr + ' ' + deltaStr + ', ' + t('rarity.' + c.rarity));
        b.style.animationDelay = (i * 45) + 'ms';
        b.addEventListener('click', function () { if (guarded()) return; sfx('ui_click'); NR.progression.pick(i); });
        if (isW) {
          setTip(b, [nameStr, tx(wdef.desc) || '']);
        } else {
          setTip(b, [nameStr, t('tip.' + c.stat), t('tip.now', { v: fmtVal(c.stat, cv), base: fmtVal(c.stat, NR.stats.defaults[c.stat]) })]);
        }
        row.appendChild(b);
      });
      pn.appendChild(row);
      const can = p.gold >= price;
      const act = h('div', 'actions');
      act.appendChild(btn('rr', [h('span', '', t('levelup.reroll')), gold(price), keycap('R')], function () { NR.progression.reroll(); },
        { fk: 'reroll', off: !can, offMsg: t('shop.err.gold') }));
      act.appendChild(h('span', 'have', [t('levelup.have'), ' ', gold(p.gold)]));
      pn.appendChild(act);
      pn.appendChild(foot('1-4 ' + t('levelup.pick') + ' · R ' + t('levelup.reroll'), 'A ' + t('levelup.pick') + ' · Y ' + t('levelup.reroll')));
      s.appendChild(pn);
      return s;
    }
  };

  // =====================================================================================================
  // SHOP
  // =====================================================================================================
  function offerReason(o, p) {
    if (o.sold) return '';
    if (o.kind === 'weapon') { if (!NR.weapons.canAdd(p, o.id)) return p.weapons.some(function (w) { return w.id === o.id; }) ? 'max' : 'slots'; }
    else if (NR.items.count(p, o.id) >= NR.data.items[o.id].maxStack) return 'max';
    return '';
  }
  function offerCard(o, i, p) {
    const d = o.kind === 'weapon' ? NR.data.weapons[o.id] : NR.data.items[o.id];
    const price = NR.shop.price(o), reason = offerReason(o, p), poor = p.gold < price;
    const owned = o.kind === 'weapon' ? p.weapons.filter(function (w) { return w.id === o.id; })[0] : null;
    const rar = d.rarity || 'common';
    const card = h('article', 'card offer r-' + rar + (o.sold ? ' sold' : '') + (o.locked ? ' locked' : ''));
    card.appendChild(h('div', 'band', [h('span', '', t(o.kind === 'weapon' ? 'shop.weapon' : 'shop.item') + ' · ' + t('rarity.' + rar)), keycap(String(i + 1))]));
    const body = h('div', 'ob');
    body.appendChild(h('div', 'otop', [iconOf(o.kind, o.id, 46), h('div', 'oname', [h('b', 'nm', tx(d.name)),
      o.kind === 'weapon' ? h('small', 'upg', owned ? t('shop.upgrade', { a: owned.lvl, b: Math.min(owned.lvl + 1, NR.config.MAX_LEVEL) }) : t('shop.new')) : (owned === null && NR.items.count(p, o.id) ? h('small', 'upg', t('shop.owned', { n: NR.items.count(p, o.id) })) : null)])]));
    body.appendChild(h('p', 'od', o.kind === 'weapon' ? tx(d.desc) : itemInfo(d)));
    if (o.kind === 'weapon') body.appendChild(h('div', 'chips', weaponChips(d, owned ? Math.min(owned.lvl + 1, NR.config.MAX_LEVEL) : 1)));
    else if ((d.mods || []).length && tx(d.desc)) body.appendChild(h('div', 'chips', h('span', 'chip', modsText(d.mods))));
    card.appendChild(body);
    if (o.sold) card.appendChild(h('div', 'stamp', t('shop.sold')));
    const f = h('div', 'of');
    const label = o.sold ? t('shop.sold') : reason === 'max' ? t('shop.max') : reason === 'slots' ? t('shop.noslot') : t('shop.buy');
    const bb = btn('buy' + (poor && !o.sold && !reason ? ' poor' : ''), o.sold || reason ? label : [label, gold(price)], function () { buy(i); }, { fk: 'buy' + i, off: o.sold || !!reason || poor, offMsg: reason ? t('shop.err.' + reason) : t('shop.err.gold') });
    if (!o.sold && i === 0) bb.setAttribute('data-auto', '1');
    f.appendChild(bb);
    const lk = btn('lk' + (o.locked ? ' on' : ''), o.locked ? t('shop.unlock') : t('shop.lock'), function () { NR.shop.toggleLock(i); }, { fk: 'lock' + i, off: o.sold });
    lk.setAttribute('aria-pressed', o.locked ? 'true' : 'false');
    f.appendChild(lk);
    card.appendChild(f);
    setTip(card, o.kind === 'weapon' ? weaponTip(o.id, owned ? Math.min(owned.lvl + 1, NR.config.MAX_LEVEL) : 1) : [tx(d.name), itemInfo(d), t('shop.stack', { n: NR.items.count(p, o.id), max: d.maxStack })]);
    return card;
  }
  function buy(i) {
    const o = world().shop.offers[i];
    if (!o || o.sold) return;
    const r = NR.shop.buy(i);
    if (r && r.ok) { sfx('ui_buy'); const d = o.kind === 'weapon' ? NR.data.weapons[o.id] : NR.data.items[o.id]; flash(t('shop.bought', { name: tx(d.name) })); }
    else { sfx('ui_deny'); flash(t('shop.err.' + (r && r.reason ? r.reason : 'gold')), true); }
  }
  function weaponSlot(w, i, p) {
    const d = NR.data.weapons[w.id], maxL = d.evolved ? 1 : NR.config.MAX_LEVEL, price = NR.shop.sellPrice('weapon', i);
    let st = null;
    try { st = NR.weapons.resolve(p, i); } catch (e) { st = null; }
    const rar = d.rarity || 'common', ev = evoFor(w.id);
    const c = h('article', 'card wslot r-' + rar + (d.evolved ? ' evo' : ''));
    c.appendChild(h('div', 'otop', [iconOf('weapon', w.id, 44), h('div', 'oname', [h('b', 'nm', tx(d.name)), h('span', 'lvl', [pips(d.evolved ? 1 : w.lvl, maxL), h('small', '', d.evolved ? t('shop.evolved') : (w.lvl >= maxL ? t('shop.max') : t('shop.lvl', { n: w.lvl })))])])]));
    c.appendChild(h('div', 'chips', st
      ? [h('span', 'chip el-' + d.element, t('element.' + d.element)), h('span', 'chip', t('wp.dmg', { n: Math.round(st.dmg * 10) / 10 })), h('span', 'chip', t('wp.rate', { n: st.rate.toFixed(1) }))]
      : weaponChips(d, w.lvl)));
    if (ev && !d.evolved && NR.data.items[ev.catalyst]) c.appendChild(h('p', 'evo-h' + (w.lvl >= NR.config.MAX_LEVEL ? ' ready' : ''), t('shop.evo', { item: tx(NR.data.items[ev.catalyst].name), name: tx(NR.data.weapons[ev.into].name) })));
    if (p.weapons.length > 1) c.appendChild(confirmBtn('sell', [t('shop.sellShort'), gold(price)], t('shop.sellSure', { n: price }), function () { sell('weapon', i); }, { fk: 'sw' + i }));
    setTip(c, weaponTip(w.id, w.lvl));
    return c;
  }
  function sell(kind, key) {
    if (NR.shop.sell(kind, key)) sfx('ui_buy'); else flash(t('shop.err.sell'), true);
  }
  function itemChip(id, n, p) {
    const d = NR.data.items[id], price = NR.shop.sellPrice('item', id);
    const c = h('div', 'ichip r-' + (d.rarity || 'common'), [iconOf('item', id, 30), h('span', 'in', [h('b', '', tx(d.name)), n > 1 ? h('small', '', '×' + n) : null]),
      confirmBtn('sell sm', [t('shop.sellShort'), gold(price)], t('shop.sellSure', { n: price }), function () { sell('item', id); }, { fk: 'si-' + id })]);
    setTip(c, [tx(d.name), itemInfo(d), t('shop.stack', { n: n, max: d.maxStack })]);
    return c;
  }
  SCREENS.shop = {
    guard: true, once: true,
    build: function (o) {
      const W = world(), p = W.player, offers = W.shop.offers || [];
      const s = scr('shop', 'solid');
      const wrap = h('div', 'wrap');
      const rp = NR.shop.rerollPrice(), poor = p.gold < rp;
      const hd = h('header', 'hd shop-hd');
      hd.appendChild(h('div', 'ht', [h('h2', 'h ttl', t('shop.title')), h('p', 'sub', t('shop.sub', { n: W.wave }))]));
      hd.appendChild(h('div', 'hd-gold', [h('small', '', t('shop.gold')), gold(p.gold, 'big')]));
      const acts = h('div', 'hd-act');
      acts.appendChild(btn('rr' + (poor ? ' poor' : ''), [t('shop.reroll'), gold(rp), keycap('R')], function () { if (NR.shop.reroll()) sfx('ui_click'); }, { fk: 'reroll', off: poor, offMsg: t('shop.err.gold') }));
      acts.appendChild(btn('pri big next', [t('shop.next'), keycap('N')], function () { NR.run.leaveShop(); }, { fk: 'next' }));
      hd.appendChild(acts);
      wrap.appendChild(hd);
      const main = h('div', 'shop-main');
      const A = h('div', 'col-a');
      const so = h('section', 'sec'); so.appendChild(h('h3', 'h sm', t('shop.offers')));
      const og = h('div', 'offers'); offers.forEach(function (of, i) { og.appendChild(offerCard(of, i, p)); }); so.appendChild(og); A.appendChild(so);
      const slots = Math.round(p.stats.weaponSlots || 4);
      const sw = h('section', 'sec'); sw.appendChild(h('h3', 'h sm', t('shop.weapons', { n: p.weapons.length, max: slots })));
      const wg = h('div', 'wslots');
      for (let i = 0; i < Math.max(slots, p.weapons.length); i++) wg.appendChild(p.weapons[i] ? weaponSlot(p.weapons[i], i, p) : h('div', 'wslot empty', [h('span', '', t('shop.emptySlot'))]));
      sw.appendChild(wg); A.appendChild(sw);
      const ids = Object.keys(p.items).sort(function (a, b) { return RARITIES.indexOf(NR.data.items[b].rarity) - RARITIES.indexOf(NR.data.items[a].rarity); });
      const si = h('section', 'sec'); si.appendChild(h('h3', 'h sm', t('shop.items', { n: ids.length })));
      const ig = h('div', 'ichips');
      if (!ids.length) ig.appendChild(h('p', 'none', t('shop.noItems')));
      ids.forEach(function (id) { ig.appendChild(itemChip(id, p.items[id], p)); });
      si.appendChild(ig); A.appendChild(si);
      main.appendChild(A);
      const B = h('div', 'col-b');
      B.appendChild(btn('stats-toggle', t(D.statsOpen ? 'stats.hide' : 'stats.show'), function () { D.statsOpen = !D.statsOpen; rerender(); }, { fk: 'stog' }));
      B.appendChild(statsPanel(p));
      main.appendChild(B);
      wrap.appendChild(main);
      wrap.appendChild(foot('1-4 ' + t('shop.buy') + ' · R ' + t('shop.reroll') + ' · N ' + t('shop.next'), 'Y ' + t('shop.reroll')));
      s.appendChild(wrap);
      return s;
    }
  };

  // =====================================================================================================
  // PAUSE
  // =====================================================================================================
  SCREENS.pause = {
    guard: false,
    back: function () { NR.run.togglePause(); },
    build: function () {
      const W = world(), p = W.player;
      const s = scr('pause');
      const pn = h('div', 'panel pz');
      const L = h('div', 'pz-l');
      L.appendChild(h('h2', 'h ttl', t('pause.title')));
      if (p) L.appendChild(h('p', 'sub', t('pause.info', { wave: W.wave, time: mmss(W.time), name: charName(p.charId), lvl: p.level })));
      const m = h('div', 'menu');
      m.appendChild(btn('pri big', t('pause.resume'), function () { NR.run.togglePause(); }, { fk: 'resume', auto: true }));
      m.appendChild(btn('big', t('menu.settings'), function () { settingsFrom = 'pause'; show('settings'); }, { fk: 'settings' }));
      m.appendChild(confirmBtn('big dng', t('pause.quit'), t('pause.quitSure'), function () { NR.run.abandon(); }, { fk: 'quit' }));
      L.appendChild(m);
      L.appendChild(foot('Esc ' + t('pause.resume'), 'Start ' + t('pause.resume')));
      pn.appendChild(L);
      if (p) {
        const R = h('div', 'pz-r');
        const wl = h('div', 'pz-w');
        p.weapons.forEach(function (w) { const d = NR.data.weapons[w.id]; const e = h('span', 'pw', [iconOf('weapon', w.id, 26), h('b', '', d.evolved ? 'EVO' : String(w.lvl))]); setTip(e, weaponTip(w.id, w.lvl), true); wl.appendChild(e); });
        Object.keys(p.items).forEach(function (id) { const d = NR.data.items[id]; const e = h('span', 'pw', [iconOf('item', id, 22), p.items[id] > 1 ? h('b', '', '×' + p.items[id]) : null]); setTip(e, [tx(d.name), itemInfo(d)], true); wl.appendChild(e); });
        R.appendChild(wl);
        R.appendChild(statsPanel(p));
        pn.appendChild(R);
      }
      s.appendChild(pn);
      return s;
    }
  };

  // =====================================================================================================
  // SETTINGS
  // =====================================================================================================
  function setFullscreen(on) {
    const d = globalThis.document;
    try {
      if (on) { const el = d.documentElement, f = el.requestFullscreen || el.webkitRequestFullscreen; if (f) f.call(el); }
      else if (d.fullscreenElement && d.exitFullscreen) d.exitFullscreen();
    } catch (e) { /* not allowed */ }
    NR.save.setSetting('fullscreen', on);
  }
  function sliderRow(key, max) {
    const val = NR.save.getSettings()[key], steps = 10;
    const row = h('div', 'srow');
    row.appendChild(h('label', 'sl-l', t('set.' + key)));
    const sl = h('div', 'sl'); sl.setAttribute('role', 'slider'); sl.setAttribute('tabindex', '0'); sl.setAttribute('data-slider', key); sl.setAttribute('data-fk', 'sl-' + key);
    sl.setAttribute('aria-valuemin', '0'); sl.setAttribute('aria-valuemax', String(max)); sl.setAttribute('aria-valuenow', String(Math.round(val * (max === 1 ? 100 : 1))));
    sl.setAttribute('aria-label', t('set.' + key));
    const bar = h('div', 'sbar big');
    for (let i = 0; i < steps; i++) bar.appendChild(h('i', i < Math.round(val / max * steps) ? 'on' : ''));
    sl.appendChild(bar);
    const out = h('b', 'sv', max === 1 ? pct(val) : Math.round(val) + '%');
    function put(frac) {
      const n = clamp(Math.round(frac * steps), 0, steps), v = max === 1 ? n / steps : n * (max / steps);
      if (v === NR.save.getSettings()[key]) return;
      NR.save.setSetting(key, v);
      const k = bar.children;
      for (let i = 0; i < k.length; i++) k[i].className = i < n ? 'on' : '';
      out.textContent = max === 1 ? pct(v) : Math.round(v) + '%';
      sl.setAttribute('aria-valuenow', String(Math.round(v * (max === 1 ? 100 : 1))));
      sfx('ui_move');
    }
    sl._adjust = function (dir) { const v = NR.save.getSettings()[key]; put(clamp(v / max + dir / steps, 0, 1)); };
    let drag = false;
    function at(ev) { const r = sl.getBoundingClientRect(); if (r.width > 0) put((ev.clientX - r.left) / r.width); }
    sl.addEventListener('pointerdown', function (ev) { drag = true; try { sl.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ } at(ev); });
    sl.addEventListener('pointermove', function (ev) { if (drag) at(ev); });
    sl.addEventListener('pointerup', function () { drag = false; });
    sl.addEventListener('pointercancel', function () { drag = false; });
    row.appendChild(sl); row.appendChild(out);
    return row;
  }
  function toggleRow(key, onChange) {
    const on = !!NR.save.getSettings()[key];
    const row = h('div', 'srow tg');
    row.appendChild(h('label', 'sl-l', t('set.' + key)));
    const b = btn('sw' + (on ? ' on' : ''), [h('i', 'knob'), h('span', '', t(on ? 'common.on' : 'common.off'))], function () {
      const v = !NR.save.getSettings()[key];
      if (onChange) onChange(v); else NR.save.setSetting(key, v);
      rerender();
    }, { fk: 'tg-' + key });
    b.setAttribute('role', 'switch'); b.setAttribute('aria-checked', on ? 'true' : 'false'); b.setAttribute('aria-label', t('set.' + key));
    row.appendChild(b);
    row.appendChild(h('p', 'sd', t('set.' + key + 'Tip')));
    return row;
  }
  SCREENS.settings = {
    guard: false,
    back: function () { show(settingsFrom === 'pause' && world().state === 'paused' ? 'pause' : 'title'); },
    build: function () {
      const S = NR.save.getSettings();
      const s = scr('settings', 'solid');
      const wrap = h('div', 'wrap narrow');
      wrap.appendChild(head(t('settings.title'), null, function () { SCREENS.settings.back(); }));
      const pn = h('div', 'panel setp');
      const lang = h('section', 'sset');
      lang.appendChild(h('h3', 'h sm', t('set.group.general')));
      lang.appendChild(h('div', 'srow', [h('label', 'sl-l', t('settings.language')), langToggle()]));
      pn.appendChild(lang);
      const au = h('section', 'sset'); au.appendChild(h('h3', 'h sm', t('set.group.audio')));
      au.appendChild(sliderRow('master', 1)); au.appendChild(sliderRow('music', 1)); au.appendChild(sliderRow('sfx', 1));
      pn.appendChild(au);
      const gp = h('section', 'sset'); gp.appendChild(h('h3', 'h sm', t('set.group.gameplay')));
      gp.appendChild(toggleRow('autoFire')); gp.appendChild(toggleRow('aimAssist')); gp.appendChild(toggleRow('damageNumbers'));
      pn.appendChild(gp);
      const gf = h('section', 'sset'); gf.appendChild(h('h3', 'h sm', t('set.group.display')));
      gf.appendChild(sliderRow('shake', 100)); gf.appendChild(toggleRow('reduceFlashing')); gf.appendChild(toggleRow('showFps')); gf.appendChild(toggleRow('fullscreen', setFullscreen));
      pn.appendChild(gf);
      const ct = h('section', 'sset ctl'); ct.appendChild(h('h3', 'h sm', t('set.group.controls')));
      const dl = h('dl', 'keys');
      ['move', 'aim', 'dash', 'pause', 'pad', 'touch'].forEach(function (k) { dl.appendChild(h('dt', '', t('ctl.' + k))); dl.appendChild(h('dd', '', t('ctl.' + k + 'V'))); });
      ct.appendChild(dl); pn.appendChild(ct);
      const dt = h('section', 'sset'); dt.appendChild(h('h3', 'h sm', t('set.group.data')));
      dt.appendChild(h('p', 'sd', t('set.resetTip')));
      dt.appendChild(confirmBtn('dng', t('set.reset'), t('set.resetSure'), function () {
        const d = NR.save.resetAll(), st = d.settings;
        NR.i18n.setLang(st.language);
        for (const k in st) NR.events.emit('settings:change', { key: k, value: st[k] });
        flash(t('set.resetDone'));
        refresh();
      }, { fk: 'reset' }));
      pn.appendChild(dt);
      wrap.appendChild(pn);
      wrap.appendChild(foot('← → ' + t('set.adjust'), '← → ' + t('set.adjust')));
      s.appendChild(wrap);
      return s;
    }
  };

  // =====================================================================================================
  // META UPGRADES
  // =====================================================================================================
  function branchOf(id, d) { return d.branch || BRANCH[d.mods && d.mods[0] ? d.mods[0].stat : ''] || 'fortune'; }
  function reqMet(d) { const r = d.requires ? [].concat(d.requires) : []; for (let i = 0; i < r.length; i++) if (!NR.meta.node(r[i])) return false; return true; }
  SCREENS.meta = {
    guard: false,
    back: function () { show('title'); },
    build: function () {
      const nodes = NR.data.metaNodes, have = NR.meta.shards();
      const s = scr('meta', 'solid');
      const wrap = h('div', 'wrap');
      const hd = head(t('meta.title'), t('meta.sub'), function () { show('title'); });
      hd.appendChild(h('div', 'hd-gold', [h('small', '', t('meta.shards')), shards(have, 'big')]));
      wrap.appendChild(hd);
      const tree = h('div', 'tree');
      const groups = {};
      Object.keys(nodes).forEach(function (id) { const b = branchOf(id, nodes[id]); (groups[b] = groups[b] || []).push(id); });
      const order = BRANCH_ORDER.filter(function (b) { return groups[b]; }).concat(Object.keys(groups).filter(function (b) { return BRANCH_ORDER.indexOf(b) < 0; }));
      let first = true;
      order.forEach(function (b) {
        const col = h('section', 'branch b-' + b);
        col.appendChild(h('h3', 'h sm bh', t('meta.branch.' + b)));
        groups[b].sort(function (a, c) { return (nodes[a].costs[0] || 0) - (nodes[c].costs[0] || 0); }).forEach(function (id) {
          const d = nodes[id], lv = NR.meta.node(id), cost = NR.meta.nodeCost(id), maxed = lv >= d.max, ok = reqMet(d), can = !maxed && ok && have >= cost;
          const card = h('article', 'card node' + (maxed ? ' maxed' : '') + (lv > 0 ? ' has' : '') + (ok ? '' : ' gated'));
          card.appendChild(h('div', 'nt', [h('b', 'nm', tx(d.name)), pips(lv, d.max, 'big')]));
          card.appendChild(h('p', 'od', tx(d.desc)));
          card.appendChild(h('p', 'eff', t('meta.perLevel') + ' ' + modsText(d.mods)));
          const reqs = d.requires ? [].concat(d.requires).filter(function (r) { return nodes[r]; }) : [];
          if (!ok) card.appendChild(h('p', 'req', t('meta.requires', { name: reqs.map(function (r) { return tx(nodes[r].name); }).join(', ') })));
          const bb = btn(maxed ? 'maxb' : 'buy' + (can ? '' : ' poor'), maxed ? t('meta.max') : [t('meta.buy'), shards(cost)], function () {
            if (NR.meta.buyNode(id)) { sfx('ui_buy'); flash(t('meta.bought', { name: tx(d.name) })); }
          }, { fk: 'n-' + id, off: maxed || !can, offMsg: !ok ? t('meta.requires', { name: reqs.map(function (r) { return tx(nodes[r].name); }).join(', ') }) : maxed ? '' : t('meta.need', { n: cost - have }) });
          if (first) { bb.setAttribute('data-auto', '1'); first = false; }
          card.appendChild(bb);
          col.appendChild(card);
        });
        tree.appendChild(col);
      });
      wrap.appendChild(tree);
      wrap.appendChild(foot('', ''));
      s.appendChild(wrap);
      return s;
    }
  };

  // =====================================================================================================
  // CODEX
  // =====================================================================================================
  const CODEX_TABS = ['weapon', 'item', 'enemy', 'boss', 'character', 'evolution'];
  function codexIds(kind) {
    if (kind === 'weapon') return Object.keys(NR.data.weapons).filter(function (id) { return !NR.data.weapons[id].evolved; });
    if (kind === 'item') return Object.keys(NR.data.items);
    if (kind === 'enemy') return Object.keys(NR.data.enemies);
    if (kind === 'boss') return Object.keys(NR.data.bosses);
    if (kind === 'character') return Object.keys(NR.data.characters);
    if (kind === 'evolution') return (NR.data.evolutions || []).map(function (e) { return e.into; });
    return [];
  }
  function found(kind, id) {
    const c = NR.save.getCodex(), k = c[kind] || {};
    if (k[id]) return true;
    if (kind === 'evolution') { const e = (NR.data.evolutions || []).filter(function (x) { return x.into === id; })[0]; return !!(e && (k[e.weapon + '+' + e.catalyst] || (c.weapon && c.weapon[id]))); }
    if (kind === 'character') return NR.meta.charUnlocked(id) && !!(k[id]);
    return false;
  }
  function codexDetail(kind, id) {
    const d = defOf(kind, id), box = h('section', 'panel cdx-d');
    if (!d) return box;
    box.appendChild(h('div', 'pv-top', [iconOf(kind, id, 72), h('div', 'pv-name', [h('h3', 'h', tx(d.name)), d.rarity ? rarityTag(d.rarity) : null])]));
    if (d.desc && tx(d.desc)) box.appendChild(h('p', 'od', tx(d.desc)));
    const rows = [];
    if (kind === 'weapon' || kind === 'evolution') {
      rows.push([t('codex.kind'), t('kind.' + d.kind)], [t('codex.element'), t('element.' + d.element)]);
      const L = d.levels[d.levels.length - 1];
      if (L) rows.push([t('codex.maxDmg'), String(Math.round(L.dmg * 10) / 10)], [t('codex.rate'), L.rate.toFixed(1) + '/s']);
      if (kind === 'evolution') { const e = NR.data.evolutions.filter(function (x) { return x.into === id; })[0]; if (e) rows.push([t('codex.recipe'), t('codex.recipeFmt', { weapon: tx(NR.data.weapons[e.weapon].name), item: NR.data.items[e.catalyst] ? tx(NR.data.items[e.catalyst].name) : e.catalyst })]); }
      else { const ev = evoFor(id); if (ev && found('evolution', ev.into)) rows.push([t('codex.evolvesTo'), tx(NR.data.weapons[ev.into].name)]); else if (ev) rows.push([t('codex.evolvesTo'), '???']); }
    } else if (kind === 'item') {
      rows.push([t('codex.stack'), String(d.maxStack)]);
      if ((d.mods || []).length) rows.push([t('codex.effect'), modsText(d.mods)]);
    } else if (kind === 'enemy') {
      rows.push([t('stat.maxHp'), String(d.hp)], [t('codex.speed'), String(d.speed)], [t('codex.damage'), String(d.dmg)]);
    } else if (kind === 'boss') {
      rows.push([t('stat.maxHp'), String(d.hp)], [t('codex.phases'), String((d.phases || []).length)]);
      if (d.zone && NR.data.zones && NR.data.zones[d.zone]) rows.push([t('codex.zone'), tx(NR.data.zones[d.zone].name)]);
    } else if (kind === 'character') {
      const st = charPreview(id);
      PREVIEW_STATS.forEach(function (k) { rows.push([t('stat.' + k), fmtVal(k, st[k])]); });
      if (d.startWeapon && NR.data.weapons[d.startWeapon]) rows.push([t('select.startWeapon'), tx(NR.data.weapons[d.startWeapon].name)]);
      if (d.passive && tx(d.passive)) rows.push([t('select.passive'), tx(d.passive)]);
    }
    const dl = h('dl', 'facts');
    rows.forEach(function (r) { dl.appendChild(h('dt', '', r[0])); dl.appendChild(h('dd', '', r[1])); });
    box.appendChild(dl);
    return box;
  }
  SCREENS.codex = {
    guard: false,
    back: function () { show('title'); },
    build: function () {
      const s = scr('codex', 'solid');
      const wrap = h('div', 'wrap');
      let tot = 0, got = 0;
      CODEX_TABS.forEach(function (k) { const ids = codexIds(k); tot += ids.length; ids.forEach(function (id) { if (found(k, id)) got++; }); });
      wrap.appendChild(head(t('codex.title'), t('codex.progress', { n: got, total: tot }), function () { show('title'); }));
      const tabs = h('div', 'tabs'); tabs.setAttribute('role', 'tablist');
      CODEX_TABS.forEach(function (k) {
        const ids = codexIds(k), n = ids.filter(function (id) { return found(k, id); }).length;
        const b = btn('tab' + (k === D.codexTab ? ' on' : ''), [t('codex.tab.' + k), h('small', '', n + '/' + ids.length)], function () { D.codexTab = k; D.codexSel = null; rerender(); }, { fk: 'tab-' + k });
        b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', k === D.codexTab ? 'true' : 'false');
        tabs.appendChild(b);
      });
      wrap.appendChild(tabs);
      const ids = codexIds(D.codexTab);
      if (!D.codexSel || ids.indexOf(D.codexSel) < 0) D.codexSel = ids[0] || null;
      const body = h('div', 'cdx-body');
      const grid = h('div', 'cdx-grid');
      ids.forEach(function (id) {
        const ok = found(D.codexTab, id), on = id === D.codexSel;
        const b = h('button', 'btn cx' + (ok ? '' : ' dark') + (on ? ' on' : ''), [iconOf(D.codexTab, id, 48, !ok), h('span', 'cxn', ok ? tx(defOf(D.codexTab, id).name) : '???')]);
        b.setAttribute('type', 'button'); b.setAttribute('data-fk', 'cx-' + id); if (on) b.setAttribute('data-auto', '1');
        b.setAttribute('aria-label', ok ? tx(defOf(D.codexTab, id).name) : t('codex.unknown'));
        b.addEventListener('click', function () { sfx('ui_click'); D.codexSel = id; rerender(); });
        grid.appendChild(b);
      });
      body.appendChild(grid);
      if (D.codexSel) {
        if (found(D.codexTab, D.codexSel)) body.appendChild(codexDetail(D.codexTab, D.codexSel));
        else body.appendChild(h('section', 'panel cdx-d', [h('div', 'pv-top', [iconOf(D.codexTab, D.codexSel, 72, true), h('div', 'pv-name', [h('h3', 'h', '???')])]), h('p', 'od', t('codex.hidden.' + D.codexTab))]));
      }
      wrap.appendChild(body);
      wrap.appendChild(foot('', 'LB/RB ' + t('codex.tabs')));
      s.appendChild(wrap);
      return s;
    }
  };

  // =====================================================================================================
  // VICTORY / RUN END
  // =====================================================================================================
  SCREENS.victory = {
    guard: true,
    build: function () {
      const W = world(), p = W.player, st = W.stats;
      const s = scr('victory');
      const pn = h('section', 'panel vic');
      pn.appendChild(h('h2', 'h ttl gold', t('victory.title')));
      pn.appendChild(h('p', 'sub', t('victory.sub', { n: NR.config.WAVES })));
      pn.appendChild(h('div', 'grid4', [kv(t('end.time'), mmss(W.time)), kv(t('end.level'), p ? p.level : 1), kv(t('end.kills'), num(st.kills)), kv(t('end.gold'), num(st.goldEarned))]));
      const act = h('div', 'actions col');
      act.appendChild(btn('pri big', [h('span', '', t('victory.endless')), h('small', 'bsub', t('victory.endlessInfo'))], function () { NR.run.enterEndless(); }, { fk: 'endless', auto: true }));
      act.appendChild(btn('big', [h('span', '', t('victory.finish')), h('small', 'bsub', t('victory.finishInfo'))], function () { NR.run.endRun('win'); }, { fk: 'finish' }));
      pn.appendChild(act);
      pn.appendChild(foot('', ''));
      s.appendChild(pn);
      return s;
    }
  };
  function kv(k, v) { return h('div', 'kv', [h('small', '', k), h('b', '', String(v))]); }

  let countRaf = 0;
  SCREENS.end = {
    guard: true,
    build: function (o) {
      const W = world(), st = W.stats, p = W.player, res = st.result || 'abandon';
      const s = scr('end', 'solid');
      const wrap = h('div', 'wrap');
      const band = h('header', 'end-band res-' + res, [h('h2', 'h ttl', t('end.' + res)), h('p', 'sub', t('end.sub', { name: p ? charName(p.charId) : '', danger: W.danger }))]);
      wrap.appendChild(band);
      const body = h('div', 'end-body');
      const L = h('section', 'panel');
      L.appendChild(h('div', 'grid4', [
        kv(t('end.wave'), st.wave + (st.wave >= NR.config.WAVES && !W.endless ? '' : '')), kv(t('end.time'), mmss(st.time || W.time)), kv(t('end.level'), st.level), kv(t('end.kills'), num(st.kills)),
        kv(t('end.gold'), num(st.goldEarned)), kv(t('end.damageTaken'), num(Math.round(st.damageTaken))), kv(t('end.dashes'), num(st.dashes)), kv(t('end.bosses'), num(st.bossesKilled))
      ]));
      if (D.record) L.appendChild(h('p', 'note rec', t('end.record')));
      if (D.newDanger) L.appendChild(h('p', 'note unl', t('end.unlockedDanger', { n: D.newDanger })));
      const shN = h('b', 'sh-n', '+' + (st.shardsEarned || 0));
      L.appendChild(h('div', 'shard-earn', [icon('diamond', '#7FD3F0', 34), h('small', '', t('end.shards')), shN]));
      if (o && o.first && (st.shardsEarned || 0) > 0 && globalThis.requestAnimationFrame && !NR.save.getSettings().reduceFlashing) countUp(shN, st.shardsEarned);
      body.appendChild(L);
      // damage per weapon
      const R = h('section', 'panel dmg');
      R.appendChild(h('h3', 'h sm', t('end.damageByWeapon')));
      const rows = Object.keys(st.damageByWeapon || {}).map(function (id) { return [id, st.damageByWeapon[id]]; }).sort(function (a, b) { return b[1] - a[1]; });
      const total = rows.reduce(function (a, r) { return a + r[1]; }, 0), top = rows.length ? rows[0][1] : 1;
      if (!rows.length) R.appendChild(h('p', 'none', t('end.noDamage')));
      const tb = h('table', 'dtab'); const tbody = h('tbody');
      rows.forEach(function (r) {
        const d = NR.data.weapons[r[0]];
        const fill = h('i', '', '');
        fill.style.width = Math.max(2, Math.round(r[1] / top * 100)) + '%';
        fill.style.background = (d && d.color) || '#C9A24B';
        tbody.appendChild(h('tr', '', [
          h('td', 'dn', [d ? iconOf('weapon', r[0], 26) : null, h('span', '', d ? tx(d.name) : t('end.other'))]),
          h('td', 'db', h('span', 'dbar', fill)),
          h('td', 'dv', num(Math.round(r[1]))), h('td', 'dp', total > 0 ? Math.round(r[1] / total * 100) + '%' : '0%')
        ]));
      });
      tb.appendChild(tbody); R.appendChild(tb);
      body.appendChild(R);
      wrap.appendChild(body);
      const act = h('div', 'actions');
      act.appendChild(btn('pri big', t('end.again'), function () {
        NR.run.start({ charId: p ? p.charId : D.charId, danger: W.danger || 0, seed: Date.now() % 2147483647 });
      }, { fk: 'again', auto: true }));
      act.appendChild(btn('big', t('end.back'), function () { NR.run.setState('menu'); }, { fk: 'menu' }));
      act.appendChild(btn('big', t('menu.upgrades'), function () { NR.run.setState('menu'); show('meta'); }, { fk: 'meta' }));
      wrap.appendChild(act);
      wrap.appendChild(foot('', ''));
      s.appendChild(wrap);
      return s;
    }
  };
  function countUp(el, target) {
    const t0 = now();
    if (countRaf && globalThis.cancelAnimationFrame) globalThis.cancelAnimationFrame(countRaf);
    function step() {
      const k = clamp((now() - t0) / 900, 0, 1), v = Math.round(target * (1 - Math.pow(1 - k, 3)));
      el.textContent = '+' + v;
      if (k < 1) countRaf = globalThis.requestAnimationFrame(step);
    }
    el.textContent = '+0';
    countRaf = globalThis.requestAnimationFrame(step);
  }

  // =====================================================================================================
  // SCREEN MANAGER
  // =====================================================================================================
  function activeFk(scope) {
    const a = globalThis.document && globalThis.document.activeElement;
    if (!a || !scope) return null;
    let found2 = null;
    walk(scope, function (e) { if (e === a) found2 = e; });
    return found2 ? found2.getAttribute('data-fk') : null;
  }
  function focusEl(e) { if (e && e.focus) { try { e.focus({ preventScroll: false }); } catch (err) { e.focus(); } } }
  function focusables(scope) {
    const out = [];
    walk(scope, function (e) {
      if ((e.tagName === 'BUTTON' || e.getAttribute('tabindex') === '0') && e.getAttribute('data-nofocus') !== '1') out.push(e);
    });
    return out;
  }
  function autofocus(scope) {
    let pick = null, firstF = null;
    walk(scope, function (e) {
      if (!pick && e.getAttribute('data-auto') === '1') pick = e;
      if (!firstF && e.tagName === 'BUTTON') firstF = e;
    });
    focusEl(pick || firstF);
  }
  function renderScreen(name, o) {
    const def = SCREENS[name];
    const prev = curEl, same = cur === name;
    const saved = prev && same ? { fk: activeFk(prev), top: prev.scrollTop } : null;
    const el = def.build(o || {});
    if (o && o.first) el.className += ' enter';
    hideTip();
    if (prev) prev.remove();
    root.appendChild(el);
    if (msgEl && msgEl.parentNode === root) root.appendChild(msgEl);
    if (tipEl && tipEl.parentNode === root) root.appendChild(tipEl);
    cur = name; curEl = el;
    if (!same || (o && o.first)) { openedAt = now(); padWait = true; }
    if (saved) {
      el.scrollTop = saved.top;
      let tgt = null;
      if (saved.fk) walk(el, function (e) { if (!tgt && e.getAttribute('data-fk') === saved.fk) tgt = e; });
      if (tgt) focusEl(tgt); else autofocus(el);
    } else autofocus(el);
  }
  function show(name, o) {
    if (!root) return;
    if (name === 'menu') name = 'title';
    if (!SCREENS[name]) return;
    renderScreen(name, { first: o && o.first !== undefined ? !!o.first : cur !== name });
  }
  function rerender() { if (cur) renderScreen(cur, { first: false }); }
  function refresh() { rerender(); }
  function hide(name) {
    if (!curEl || (name && name !== cur && !(name === 'menu' && cur === 'title'))) return;
    curEl.remove(); curEl = null; cur = null; hideTip();
  }
  function hideAll() { hide(); }
  function back() { const d = cur && SCREENS[cur]; if (d && d.back) { sfx('ui_back'); d.back(); return true; } return false; }

  // ---------- keyboard ----------
  function setInput(dev) { if (input === dev) return; input = dev; if (root && root.setAttribute) root.setAttribute('data-input', dev); }
  function dirOf(code) {
    switch (code) {
      case 'ArrowLeft': case 'KeyA': return 'left';
      case 'ArrowRight': case 'KeyD': return 'right';
      case 'ArrowUp': case 'KeyW': return 'up';
      case 'ArrowDown': case 'KeyS': return 'down';
      default: return '';
    }
  }
  function rectOf(e) { try { return e.getBoundingClientRect(); } catch (err) { return { left: 0, top: 0, width: 0, height: 0 }; } }
  function move(dir) {
    if (!curEl) return;
    const list = focusables(curEl);
    if (!list.length) return;
    const a = globalThis.document && globalThis.document.activeElement;
    if (!a || list.indexOf(a) < 0) { focusEl(list[0]); return; }
    if (a._adjust && (dir === 'left' || dir === 'right')) { a._adjust(dir === 'right' ? 1 : -1); return; }
    const ra = rectOf(a), ax = ra.left + ra.width / 2, ay = ra.top + ra.height / 2;
    let best = null, bs = Infinity;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (c === a) continue;
      const r = rectOf(c);
      if (r.width === 0 && r.height === 0) continue;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2, dx = cx - ax, dy = cy - ay;
      const prim = dir === 'right' ? dx : dir === 'left' ? -dx : dir === 'down' ? dy : -dy;
      if (prim <= 3) continue;
      const sec = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
      const score = prim + sec * 2.2;
      if (score < bs) { bs = score; best = c; }
    }
    if (best) { sfx('ui_move'); focusEl(best); if (best.scrollIntoView) { try { best.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { /* old browsers */ } } }
  }
  function activate() {
    const a = globalThis.document && globalThis.document.activeElement;
    if (a && curEl && a.click && a.tagName === 'BUTTON') { let inside = false; walk(curEl, function (e) { if (e === a) inside = true; }); if (inside) { a.click(); return true; } }
    return false;
  }
  function pickNumber(n) {
    if (cur === 'levelup') { const c = world().levelup.cards || []; if (c[n] && !guarded()) { sfx('ui_click'); NR.progression.pick(n); } }
    else if (cur === 'shop') buy(n);
  }
  function onKey(e) {
    if (!cur || e.ctrlKey || e.metaKey || e.altKey) return;
    setInput('kbm');
    const code = e.code || '', d = dirOf(code);
    if (d) {
      const a = globalThis.document && globalThis.document.activeElement;
      if (a && a.tagName === 'INPUT') return;
      e.preventDefault(); move(d); return;
    }
    if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') {
      e.preventDefault();
      if (!e.repeat) activate();
      return;
    }
    if (e.repeat) return;
    const m = /^(?:Digit|Numpad)([1-4])$/.exec(code);
    if (m && (cur === 'levelup' || cur === 'shop')) { e.preventDefault(); pickNumber(Number(m[1]) - 1); return; }
    if (code === 'KeyR' && (cur === 'levelup' || cur === 'shop')) { e.preventDefault(); reroll(); return; }
    if (code === 'KeyN' && cur === 'shop') { e.preventDefault(); if (!guarded()) NR.run.leaveShop(); return; }
    if (code === 'Tab') setInput('kbm');
  }
  function reroll() {
    if (guarded()) return;
    if (cur === 'levelup') { if (!NR.progression.reroll()) flash(t('shop.err.gold'), true); }
    else if (cur === 'shop') { if (!NR.shop.reroll()) flash(t('shop.err.gold'), true); }
  }

  // ---------- gamepad (menus only; the game itself reads the pad through NR.input) ----------
  function pollPad(dt) {
    const nav = globalThis.navigator, pads = nav && nav.getGamepads ? nav.getGamepads() : null;
    if (!pads) return;
    let gp = null;
    for (let i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) { gp = pads[i]; break; }
    if (!gp) { pad.prev = {}; return; }
    const b = gp.buttons || [], ax = gp.axes || [];
    const down = function (i) { return !!(b[i] && (b[i].pressed || b[i].value > 0.5)); };
    const st = world().state;
    let any = false;
    const cur2b = {};
    for (let i = 0; i < b.length; i++) { cur2b[i] = down(i); if (cur2b[i]) any = true; }
    const edge = function (i) { return cur2b[i] && !pad.prev[i]; };
    let dir = '';
    if (cur2b[12]) dir = 'up'; else if (cur2b[13]) dir = 'down'; else if (cur2b[14]) dir = 'left'; else if (cur2b[15]) dir = 'right';
    else { const x = ax[0] || 0, y = ax[1] || 0; if (Math.abs(x) > 0.6 || Math.abs(y) > 0.6) dir = Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : (y > 0 ? 'down' : 'up'); }
    if (any || dir) setInput('pad');
    if (padWait) { if (!any && !dir) padWait = false; pad.prev = cur2b; return; }
    // Start pauses/resumes where the sim is not polling the pad
    if (edge(9) && (st === 'paused' || st === 'levelup' || st === 'shop')) NR.run.togglePause();
    if (cur) {
      if (dir) {
        if (dir !== pad.dir) { pad.dir = dir; pad.nextAt = 0.38; move(dir); }
        else { pad.nextAt -= dt; if (pad.nextAt <= 0) { pad.nextAt = 0.12; move(dir); } }
      } else pad.dir = '';
      if (edge(0)) activate();
      if (edge(1)) { if (!back() && (st === 'levelup' || st === 'shop')) NR.run.togglePause(); }
      if (edge(3) && (cur === 'levelup' || cur === 'shop')) reroll();
      if (cur === 'codex' && (edge(4) || edge(5))) cycleTab(edge(5) ? 1 : -1);
    } else pad.dir = '';
    pad.prev = cur2b;
  }
  function cycleTab(d) { const i = CODEX_TABS.indexOf(D.codexTab); D.codexTab = CODEX_TABS[(i + d + CODEX_TABS.length) % CODEX_TABS.length]; D.codexSel = null; rerender(); }

  // called every frame from NR.ui.hud.update (real time)
  function tick(dt) {
    if (!root) return;
    pollPad(dt);
    // screens that own "back" (Esc / Start in menu screens) consume the pause request so main does not toggle pause
    const st = world().state;
    if (cur && (st === 'menu' || st === 'end' || (st === 'paused' && cur === 'settings'))) {
      if (NR.input.consumePause()) back();
    }
  }

  // ---------- events + init ----------
  function onState(e) {
    const to = e.to;
    if (to === 'menu') show('title');
    else if (to === 'paused') show('pause');
    else if (to === 'levelup') show('levelup');
    else if (to === 'shop') show('shop', { first: e.from !== 'paused' });
    else if (to === 'victory') show('victory');
    else if (to === 'end') {
      const st = world().stats, m = NR.save.getMeta();
      D.record = (st.wave || 0) > (m.bestWave || 0);
      show('end');
    } else hideAll();
  }
  function init(r) {
    if (!r) return;
    root = r;
    tipEl = h('div', 'tip'); tipEl.setAttribute('role', 'tooltip'); root.appendChild(tipEl);
    const coarse = !!(globalThis.matchMedia && globalThis.matchMedia('(pointer: coarse)').matches);
    input = ''; setInput(coarse ? 'touch' : 'kbm');
    const E = NR.events;
    E.on('state:change', onState);
    E.on('run:start', function () { D.newDanger = 0; D.record = false; });
    E.on('levelup:open', function (e) { D.lastOpen = e; if (world().state === 'levelup') show('levelup', { first: true }); });
    E.on('shop:change', function (e) { if (cur === 'shop') show('shop', { first: false }); });
    const calm = function () { root.setAttribute('data-calm', NR.save.getSettings().reduceFlashing ? '1' : '0'); };
    calm();
    E.on('settings:change', function (e) { if (e.key === 'language') refresh(); else if (e.key === 'reduceFlashing') calm(); });
    E.on('meta:change', function (e) {
      if (e.kind === 'danger') { D.newDanger = Number(e.id) || 0; }
      if (cur === 'meta' || cur === 'select' || cur === 'end' || cur === 'title') rerender();
    });
    E.on('codex:discover', function () { if (cur === 'codex') rerender(); });
    if (globalThis.addEventListener) {
      globalThis.addEventListener('keydown', onKey);
      globalThis.addEventListener('pointerdown', function (ev) { setInput(ev.pointerType === 'touch' ? 'touch' : 'kbm'); }, true);
    }
    root.addEventListener('pointerover', function (ev) { const s = tipOf(ev.target); if (s) showTip(s); });
    root.addEventListener('pointerout', function (ev) { if (ev.pointerType !== 'touch' && tipOf(ev.target)) hideTip(); });
    root.addEventListener('pointerdown', function (ev) { if (!tipOf(ev.target)) hideTip(); });
    root.addEventListener('focusin', function (ev) { const s = tipOf(ev.target); if (s) showTip(s); else hideTip(); });
    root.addEventListener('focusout', function () { hideTip(); });
    root.addEventListener('scroll', hideTip, true);
    if (globalThis.document && globalThis.document.addEventListener) {
      globalThis.document.addEventListener('fullscreenchange', function () {
        const on = !!globalThis.document.fullscreenElement;
        if (!!NR.save.getSettings().fullscreen !== on) { NR.save.setSetting('fullscreen', on); if (cur === 'settings') rerender(); }
      });
    }
  }

  NR.ui.screens = { guard: GUARD, init: init, show: show, hide: hide, refresh: refresh, back: back, tick: tick, current: function () { return cur; }, toast: flash, names: Object.keys(SCREENS) };
})();
