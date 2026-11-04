// Owner: Progression. Item inventory, event-hook dispatcher and the effect library.
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  const gainP = { itemId: '', count: 0, source: '' };
  const KEYS = ['kill', 'hit', 'dash', 'hurt', 'dodge', 'revive', 'wave', 'clear', 'shot'];
  const ACTIVE = {};
  const tmp = [];
  let inited = false, busy = 0, buffs = [], delayed = [], ctr = {}, cds = {}, ramp = 0, stillT = 0;
  for (let i = 0; i < KEYS.length; i++) ACTIVE[KEYS[i]] = [];

  function val(h, key, n) { return NR.data.itemUtil.val(h.p[key], n); }
  function W() { return NR.world.get(); }
  function count(p, id) { return p.items[id] || 0; }
  function dmgStat(p) { return NR.stats.get(p, 'damage'); }
  function src(id) { return 'item:' + id; }

  // ---------- timed stat buffs (never touch maxHp) ----------
  function buff(p, key, stat, pct, dur) {
    for (let i = 0; i < buffs.length; i++) {
      const b = buffs[i];
      if (b.key !== key) continue;
      if (b.pct !== pct) { NR.stats.removeMods(p, b.src); NR.stats.addMod(p, b.src, { stat: stat, pct: pct }); b.pct = pct; }
      if (dur > b.t) b.t = dur;
      return;
    }
    const s = 'buff:' + key;
    NR.stats.addMod(p, s, { stat: stat, pct: pct });
    buffs.push({ key: key, src: s, t: dur, pct: pct });
  }
  function clearBuffs(p) {
    for (let i = 0; i < buffs.length; i++) NR.stats.removeMods(p, buffs[i].src);
    buffs.length = 0;
  }
  function hasBuff(key) { for (let i = 0; i < buffs.length; i++) if (buffs[i].key === key) return true; return false; }

  // ---------- effect helpers ----------
  function status(p, e, name, dmg) {
    if (!name || !e || e.dead || !NR.combat.applyStatus) return;
    NR.combat.applyStatus(e, name, NR.stats.get(p, 'statusPower'), dmg);
  }
  function statusArea(p, x, y, r, name, dmg) {
    if (!name) return;
    const n = NR.spatial.circle(x, y, r, tmp);
    for (let i = 0; i < n && i < 16; i++) status(p, tmp[i], name, dmg);
  }
  function boom(p, id, x, y, r, dmg, element, stName) {
    NR.combat.explode(x, y, r, dmg, { team: 'player', element: element || 'physical', weaponId: src(id) });
    if (stName) statusArea(p, x, y, r, stName, dmg);
  }
  function chance(c) { return c >= 1 || NR.rng.chance(c); }
  function nearestEnemy(p, r) {
    let best = null, bd = r * r;
    const E = W().enemies;
    for (let i = 0; i < E.length; i++) {
      const e = E[i];
      if (e.dead) continue;
      const d = NR.util.dist2(p.x, p.y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  function weaponElement(id) { const w = id && NR.data.weapons[id]; return w ? w.element : ''; }

  // ---------- effect library: fx(p, n, h, ev, id) ----------
  const fx = {
    heal: function (p, n, h) { if (chance(val(h, 'chance', n))) NR.player.heal(val(h, 'heal', n)); },
    burst: function (p, n, h, ev, id) {
      if (!chance(val(h, 'chance', n))) return;
      const dmg = h.p.dmg !== undefined ? val(h, 'dmg', n) * dmgStat(p) : ev.amount * val(h, 'dmgPct', n);
      const x = ev.x !== undefined ? ev.x : p.x, y = ev.y !== undefined ? ev.y : p.y;
      boom(p, id, x, y, val(h, 'r', n), dmg, h.p.element, null);
      if (h.on === 'hit' && ev.target && !ev.target.dead) status(p, ev.target, h.p.status, dmg);
    },
    nova: function (p, n, h, ev, id) { boom(p, id, p.x, p.y, val(h, 'r', n), val(h, 'dmg', n) * dmgStat(p), h.p.element, h.p.status); },
    arc: function (p, n, h, ev, id) {
      ctr[id] = (ctr[id] || 0) + 1;
      if (ctr[id] < Math.round(val(h, 'every', n))) return;
      ctr[id] = 0;
      const e = nearestEnemy(p, 650);
      if (!e) return;
      const dmg = val(h, 'dmg', n) * dmgStat(p), o = { weaponId: src(id), element: 'shock' };
      NR.combat.hitEnemy(e, dmg, o);
      NR.combat.chain(e, dmg, o);
    },
    // time-gated bolt: one per cooldown no matter how many weapon hands fire or how fast (static_charm)
    zap: function (p, n, h, ev, id) {
      if (cds[id] > 0) return;
      const e = nearestEnemy(p, 650);
      if (!e) return;
      cds[id] = val(h, 'cd', n);
      const dmg = val(h, 'dmg', n) * dmgStat(p), o = { weaponId: src(id), element: 'shock' };
      NR.combat.hitEnemy(e, dmg, o);
      NR.combat.chain(e, dmg, o);
    },
    cloud: function (p, n, h, ev, id) {
      if (!chance(val(h, 'chance', n)) || W().areas.length > 120) return;
      NR.combat.createArea({
        areaKind: 'circle', team: 'player', weaponId: src(id), x: ev.x, y: ev.y, r: h.p.r, dmg: h.p.dps * 0.5 * dmgStat(p), tick: 0.5, life: h.p.life,
        element: h.p.element, statusChance: 0.3
      });
    },
    bounty: function (p, n, h, ev) {
      if (!ev.elite && !ev.isBoss) return;
      NR.player.addGold(Math.round(val(h, 'gold', n)));
      if (chance(val(h, 'chest', n))) NR.pickups.spawn('chest', ev.x, ev.y, 0);
    },
    buff: function (p, n, h) { buff(p, h.p.key, h.p.stat, val(h, 'amount', n), h.p.dur); },
    opener: function (p, n, h, ev, id) {
      const t = ev.target;
      if (ev.killed || !t || t.dead || !(t.maxHp > 0) || (t.hp + ev.amount) / t.maxHp < h.p.above) return;
      NR.combat.hitEnemy(t, ev.amount * val(h, 'bonus', n), { weaponId: src(id), element: ev.element });
    },
    fireBurst: function (p, n, h, ev, id) {
      const e = ev.enemy;
      if (!e || !(weaponElement(ev.weaponId) === 'fire' || (e.status && e.status.burn))) return;
      if (!chance(val(h, 'chance', n))) return;
      const dmg = Math.min(e.maxHp * h.p.hpPct, 40 + 25 * W().wave);
      boom(p, id, ev.x, ev.y, h.p.r, dmg, 'fire', null);
    },
    refund: function (p, n, h) { p.dash.charges = Math.min(p.dash.max, p.dash.charges + h.p.charges); },
    everyKill: function (p, n, h, ev, id) {
      ctr[id] = (ctr[id] || 0) + 1;
      if (ctr[id] < h.p.every) return;
      ctr[id] = 0;
      boom(p, id, ev.x, ev.y, h.p.r, h.p.dmg * dmgStat(p), h.p.element, null);
    },
    critSplash: function (p, n, h, ev, id) { if (ev.crit) boom(p, id, ev.x, ev.y, h.p.r, ev.amount * h.p.mult, 'physical', null); },
    ramp: function (p, n, h) {
      ramp++;
      const a = Math.min(h.p.cap, h.p.step * ramp);
      if (a > 0) buff(p, h.p.key, h.p.stat, a, 9999);
    },
    shockArc: function (p, n, h, ev, id) {
      if (ev.element !== 'shock' || !ev.target || !chance(h.p.chance)) return;
      NR.combat.chain(ev.target, ev.amount * h.p.mult, { weaponId: src(id), element: 'shock' });
    },
    freeCharge: function (p, n, h) { if (chance(h.p.chance)) p.dash.charges = Math.min(p.dash.max, p.dash.charges + 1); },
    dashFill: function (p) { p.dash.charges = p.dash.max; },
    interest: function (p, n, h) { NR.player.addGold(Math.min(h.p.cap, Math.floor(p.gold * h.p.rate))); },
    echo: function (p, n, h, ev, id) {
      if (ev.killed || !ev.target || delayed.length >= 48 || !chance(h.p.chance)) return;
      delayed.push({ t: h.p.delay, id: ev.target.id, amt: ev.amount * h.p.mult, element: ev.element, src: src(id) });
    },
    // character passives
    dashBuff: function (p, n, h) { buff(p, 'char_dash', 'damage', h.p.dmg, h.p.dur); },
    retaliate: function (p, n, h, ev, id) { boom(p, id, p.x, p.y, h.p.r, h.p.dmg * dmgStat(p), 'physical', null); },
    still: function () {}, mods: function () {}
  };

  // ---------- dispatcher ----------
  function rebuild(p) {
    for (let i = 0; i < KEYS.length; i++) ACTIVE[KEYS[i]].length = 0;
    if (!p) return;
    const ch = NR.data.characters[p.charId], pf = ch && ch.passiveFx;
    if (pf && pf.fx === 'dashBuff') ACTIVE.dash.push({ id: 'char:' + p.charId, h: { on: 'dash', fx: 'dashBuff', p: pf.p }, ch: true });
    if (pf && pf.fx === 'retaliate') ACTIVE.hurt.push({ id: 'char:' + p.charId, h: { on: 'hurt', fx: 'retaliate', p: pf.p }, ch: true });
    for (const id in p.items) {
      const d = NR.data.items[id];
      if (!d) continue;
      for (let i = 0; i < d.hooks.length; i++) { const h = d.hooks[i]; ACTIVE[h.on].push({ id: id, h: h, ch: false }); }
    }
  }
  function fire(key, payload) {
    if (busy) return;
    const list = ACTIVE[key];
    if (!list.length) return;
    const p = W().player;
    if (!p || p.dead) return;
    const ev = {};
    if (payload) for (const k in payload) ev[k] = payload[k];
    busy++;
    try {
      for (let i = 0; i < list.length; i++) {
        const a = list[i], f = fx[a.h.fx];
        if (f) f(p, a.ch ? 1 : Math.max(1, count(p, a.id)), a.h, ev, a.id);
      }
    } finally { busy--; }
  }

  function init() {
    if (inited) return;
    inited = true;
    const E = NR.events;
    const f = function () { const p = W().player; if (p) checkEvolutions(p); };
    E.on('weapon:gain', f); E.on('item:gain', f);
    E.on('enemy:death', function (e) { fire('kill', e); });
    E.on('damage:dealt', function (e) { if (!(typeof e.weaponId === 'string' && e.weaponId.indexOf('item:') === 0)) fire('hit', e); });
    E.on('player:dash', function (e) { fire('dash', e); });
    E.on('player:hurt', function (e) {
      if (e.dodged) { fire('dodge', e); return; }
      fire('hurt', e);
      if (e.revived) fire('revive', e);
    });
    E.on('wave:start', function (e) { ctr = {}; ramp = 0; stillT = 0; fire('wave', e); });
    E.on('wave:clear', function (e) {
      fire('clear', e);
      const p = W().player;
      if (p) clearBuffs(p);
      delayed.length = 0; ramp = 0;
    });
    E.on('weapon:fire', function (e) { fire('shot', e); });
    E.on('run:start', function () {
      const p = W().player;
      if (!p) return;
      const ch = NR.data.characters[p.charId], pf = ch && ch.passiveFx;
      if (pf) for (let i = 0; i < pf.mods.length; i++) NR.stats.addMod(p, 'char:' + p.charId, pf.mods[i]);
      rebuild(p);
    });
  }
  function reset() { buffs = []; delayed = []; ctr = {}; cds = {}; ramp = 0; stillT = 0; busy = 0; rebuild(null); }

  function grant(p, id, source) {
    const d = NR.data.items[id];
    if (!d || count(p, id) >= d.maxStack) return false;
    p.items[id] = count(p, id) + 1;
    for (let i = 0; i < d.mods.length; i++) NR.stats.addMod(p, src(id), d.mods[i]);
    rebuild(p);
    gainP.itemId = id; gainP.count = p.items[id]; gainP.source = source || '';
    NR.events.emit('item:gain', gainP);
    return true;
  }
  function remove(p, id) {
    const d = NR.data.items[id], n = count(p, id);
    if (!d || n < 1) return false;
    NR.stats.removeMods(p, src(id));
    if (n === 1) delete p.items[id]; else p.items[id] = n - 1;
    for (let k = 0; k < n - 1; k++) for (let i = 0; i < d.mods.length; i++) NR.stats.addMod(p, src(id), d.mods[i]);
    rebuild(p);
    return true;
  }
  // n distinct item ids weighted by rarity (wave and luck raise rare odds); owned-to-the-cap items are never offered
  function roll(n, luck, wave, filterFn) {
    const p = W().player, w = NR.stats.rarityWeights(luck, wave), ids = [];
    let pool = Object.keys(NR.data.items).filter(function (id) {
      const d = NR.data.items[id];
      return (!p || count(p, id) < d.maxStack) && (!filterFn || filterFn(id, d));
    });
    for (let i = 0; i < n && pool.length; i++) {
      const id = NR.rng.weighted(pool, function (x) { return w[NR.data.items[x].rarity]; });
      ids.push(id); pool = pool.filter(function (x) { return x !== id; });
    }
    return ids;
  }
  function checkEvolutions(p) {
    const ev = NR.data.evolutions || [];
    for (let i = 0; i < ev.length; i++) {
      for (let s = 0; s < p.weapons.length; s++) {
        const w = p.weapons[s];
        if (w.id === ev[i].weapon && w.lvl >= NR.config.MAX_LEVEL && count(p, ev[i].catalyst) > 0) NR.weapons.evolve(p, s, ev[i].into);
      }
    }
  }
  function update(dt) {
    const w = W(), p = w.player;
    if (!p || p.dead) return;
    busy++;
    try {
      for (let i = buffs.length - 1; i >= 0; i--) {
        const b = buffs[i];
        b.t -= dt;
        if (b.t <= 0) { NR.stats.removeMods(p, b.src); buffs.splice(i, 1); }
      }
      for (const k in cds) if (cds[k] > 0) cds[k] -= dt;
      for (let i = delayed.length - 1; i >= 0; i--) {
        const d = delayed[i];
        d.t -= dt;
        if (d.t > 0) continue;
        delayed.splice(i, 1);
        for (let k = 0; k < w.enemies.length; k++) {
          const e = w.enemies[k];
          if (e.id === d.id && !e.dead) { NR.combat.hitEnemy(e, d.amt, { weaponId: d.src, element: d.element }); break; }
        }
      }
      const ch = NR.data.characters[p.charId], pf = ch && ch.passiveFx;
      if (pf && pf.fx === 'still') {
        const v = p.vx * p.vx + p.vy * p.vy + p.kbx * p.kbx + p.kby * p.kby;
        if (v < 25) stillT += dt; else stillT = 0;
        if (stillT >= pf.p.wait) buff(p, 'char_still', 'damage', pf.p.dmg, 0.15);
      }
    } finally { busy--; }
  }
  function state() { return { buffs: buffs.length, delayed: delayed.length, counters: ctr }; }
  NR.items = { init, reset, grant, remove, count, roll, checkEvolutions, update, effects: fx, state, active: ACTIVE };
})();
