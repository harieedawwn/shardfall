// Owner: Progression. Mechanic traits: level-up cards that change how you play (data: src/data/traits.js).
// p.traits = { id: level }. Stat parts are mods (source 'trait:<id>'); the rest are event hooks and the dynamic buffs below.
// Trait damage is attributed to 'trait:<id>' (end screen) and never re-triggers kill chains.
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  const TAU = Math.PI * 2;
  const st = { still: 0, ready: false, dashT: -99, dashRefunded: true, focusId: 0, focusN: 0, windUsed: false, surgeT: 0, adr: false, mom: false, surge: false };
  const trailP = { areaKind: 'circle', team: 'player', weaponId: null, x: 0, y: 0, r: 34, dmg: 0, tick: 0.4, life: 2, element: 'fire', statusChance: 0.4, color: '#FF7A2F', shape: 'ring' };
  let inited = false;

  function W() { return NR.world.get(); }
  function P() { return W().player; }
  function D(id) { return NR.data.traits[id]; }
  function lv(p, id) { return p && p.traits ? p.traits[id] | 0 : 0; }
  function val(id, key, level) { const d = D(id); return d.vals[key][Math.min(level, d.max) - 1]; }
  function cur(id, key) { const p = P(), l = lv(p, id); return l > 0 ? val(id, key, l) : 0; }
  function reset() { st.still = 0; st.ready = false; st.dashT = -99; st.dashRefunded = true; st.focusId = 0; st.focusN = 0; st.windUsed = false; st.surgeT = 0; st.adr = false; st.mom = false; st.surge = false; }
  function dmgStat(p) { return NR.stats.get(p, 'damage'); }
  const SRC = 'trait:';

  // stat mods owned by a trait at its current level
  function applyMods(p, id) {
    NR.stats.removeMods(p, SRC + id);
    const l = lv(p, id);
    if (l <= 0) return;
    const S = NR.stats, s = SRC + id;
    switch (id) {
      case 'split_shot': S.addMod(p, s, { stat: 'projectiles', add: l }); S.addMod(p, s, { stat: 'damage', pct: -val(id, 'a', l) }); break;
      case 'needle': S.addMod(p, s, { stat: 'pierce', add: val(id, 'a', l) }); S.addMod(p, s, { stat: 'projSpeed', pct: val(id, 'b', l) }); break;
      case 'far_sight': S.addMod(p, s, { stat: 'range', pct: val(id, 'a', l) }); S.addMod(p, s, { stat: 'critChance', add: val(id, 'b', l) }); break;
      case 'light_feet': S.addMod(p, s, { stat: 'dashCooldown', pct: -val(id, 'a', l) }); S.addMod(p, s, { stat: 'moveSpeed', pct: val(id, 'b', l) }); break;
    }
  }
  // grant one level (or set a level when restoring); returns false at max
  function grant(p, id, level) {
    const d = D(id);
    if (!d) return false;
    p.traits = p.traits || {};
    const now = lv(p, id), to = level !== undefined ? Math.min(level, d.max) : now + 1;
    if (to > d.max || to <= now && level === undefined) return false;
    p.traits[id] = to;
    applyMods(p, id);
    return true;
  }
  function count(p) { return p && p.traits ? Object.keys(p.traits).length : 0; }

  // ---- build matching and card rolling
  function ownsMatch(p, m) {
    if (!m) return false;
    for (let i = 0; i < p.weapons.length; i++) {
      const d = NR.data.weapons[p.weapons[i].id];
      if (!d) continue;
      if (m.elements && m.elements.indexOf(d.element) >= 0) return true;
      if (m.kinds && m.kinds.indexOf(d.kind) >= 0) return true;
    }
    return false;
  }
  function matches(p, id) { return ownsMatch(p, D(id).match); }
  function available(p) { const out = []; for (const id in NR.data.traits) if (lv(p, id) < D(id).max) out.push(id); return out; }
  // one trait card: never one of `used`, build matches are twice as likely, epics are rarer early
  function rollCard(p, used, wave) {
    const pool = available(p).filter(function (id) { return !used[id]; });
    if (!pool.length) return null;
    const id = NR.rng.weighted(pool, function (x) { return (matches(p, x) ? 2 : 1) * (D(x).rarity === 'epic' ? (wave >= 4 ? 0.8 : 0.4) : 1); });
    const l = lv(p, id);
    return { kind: 'trait', stat: 'trait', id: id, rarity: D(id).rarity, add: 0, pct: 0, isNew: l === 0, level: l + 1, match: matches(p, id) };
  }
  function text(id, level, lang) {
    const d = D(id);
    return d.tpl[lang].replace(/\{(\w+)(%)?\}/g, function (m, k, pc) {
      const a = d.vals[k]; if (!a) return m;
      const v = a[Math.min(level, d.max) - 1];
      return pc ? String(Math.round(v * 100)) + '%' : String(Math.round(v * 100) / 100).replace('.', lang === 'vi' ? ',' : '.');
    });
  }

  // ---- dynamic buffs
  function dyn(p, key, on, mod) {
    const was = st[key];
    if (on === was) return;
    st[key] = on;
    if (on) NR.stats.addMod(p, SRC + 'dyn:' + key, mod); else NR.stats.removeMods(p, SRC + 'dyn:' + key);
  }
  function update(dt) {
    const w = W(), p = w.player;
    if (!p || p.dead || !p.traits) return;
    const t = p.traits;
    if (t.adrenaline) dyn(p, 'adr', p.hp < p.maxHp * 0.4, { stat: 'attackSpeed', pct: val('adrenaline', 'a', t.adrenaline) });
    const sp2 = p.vx * p.vx + p.vy * p.vy;
    if (t.momentum) dyn(p, 'mom', sp2 > 900, { stat: 'damage', pct: val('momentum', 'a', t.momentum) });
    if (t.crit_surge) { if (st.surgeT > 0) st.surgeT -= dt; dyn(p, 'surge', st.surgeT > 0, { stat: 'attackSpeed', pct: val('crit_surge', 'a', t.crit_surge) }); }
    if (t.dead_eye) { if (sp2 < 400 && !p.dash.t) st.still += dt; else st.still = 0; if (st.still >= val('dead_eye', 'a', t.dead_eye)) st.ready = true; }
  }
  // consulted by combat.critRoll: Dead Eye's guaranteed crit (consumed when the volley is announced)
  function critForced() { return st.ready; }
  // damage multiplier for one player hit (Executioner, Focus Fire); called by combat.hitEnemy before the armour math
  function hitMult(e, wid, dot) {
    const p = P();
    if (dot || !p || !p.traits) return 1;
    if (typeof wid === 'string' && (wid.indexOf('trait:') === 0 || wid.indexOf('item:') === 0 || wid.indexOf('reaction:') === 0)) return 1;
    let m = 1;
    const ex = p.traits.executioner, ff = p.traits.focus_fire;
    if (ex && e.maxHp > 0 && e.hp < e.maxHp * 0.3) m *= 1 + val('executioner', 'a', ex);
    if (ff) {
      if (st.focusId === e.id) { if (st.focusN < 5) st.focusN++; } else { st.focusId = e.id; st.focusN = 0; }
      m *= 1 + val('focus_fire', 'a', ff) * st.focusN;
    }
    return m;
  }
  function shatterBonus() { return cur('shatter_master', 'a'); }
  function frozenBonus() { return cur('shatter_master', 'b'); }

  function boom(p, id, x, y, r, dmg, el, knock) {
    NR.combat.explode(x, y, r, dmg * dmgStat(p), { team: 'player', element: el, weaponId: SRC + id, knock: knock });
  }
  function init() {
    if (inited) return;
    inited = true;
    const E = NR.events;
    E.on('wave:start', function () { st.windUsed = false; st.focusId = 0; st.focusN = 0; });
    E.on('weapon:fire', function () { st.ready = false; st.still = 0; });
    E.on('damage:dealt', function (e) {
      const p = P();
      if (!p || !p.traits || !p.traits.crit_surge || !e.crit || e.dot) return;
      st.surgeT = 2.5;
    });
    E.on('player:dash', function (e) {
      const p = P(), w = W();
      if (!p || !p.traits) return;
      st.dashT = w.time; st.dashRefunded = false;
      const t = p.traits;
      if (t.ember_dash) {
        const a = val('ember_dash', 'a', t.ember_dash), life = val('ember_dash', 'b', t.ember_dash), dist = p.dash.dist || 150;
        for (let k = 0; k < 4 && w.areas.length < 150; k++) {
          trailP.weaponId = SRC + 'ember_dash'; trailP.x = e.x + e.dx * dist * k / 3; trailP.y = e.y + e.dy * dist * k / 3; trailP.dmg = (8 + 2 * w.wave) * a * dmgStat(p); trailP.life = life;
          NR.combat.createArea(trailP);
        }
      }
      if (t.shockstep) boom(p, 'shockstep', e.x, e.y, 130, val('shockstep', 'a', t.shockstep), 'shock', 260);
    });
    E.on('enemy:death', function (e) {
      const p = P(), w = W();
      if (!p || !p.traits || p.dead) return;
      const t = p.traits, own = typeof e.weaponId === 'string' && e.weaponId.indexOf('trait:') === 0;
      if (t.dash_refund && !st.dashRefunded && w.time - st.dashT <= val('dash_refund', 'a', t.dash_refund)) { st.dashRefunded = true; p.dash.charges = Math.min(p.dash.max, p.dash.charges + 1); }
      if (t.siphon) NR.player.heal(val('siphon', 'a', t.siphon));
      if (t.bounty && e.elite) NR.player.addGold(Math.round(val('bounty', 'a', t.bounty)));
      if (t.chain_kill && !own && e.enemy && !e.isBoss) {
        const o = NR.spatial.nearest(e.x, e.y, 170, null);
        if (o) {
          const dmg = Math.min(e.enemy.maxHp * 0.5, 40 + 14 * w.wave) * dmgStat(p), opts = { weaponId: SRC + 'chain_kill', element: 'shock' };
          NR.combat.hitEnemy(o, dmg, opts);
          if (!o.dead) NR.combat.chain(o, dmg * 0.7, { jumps: val('chain_kill', 'a', t.chain_kill) - 1, range: 150, falloff: 0.8, weaponId: SRC + 'chain_kill', element: 'shock' });
        }
      }
    });
    E.on('player:hurt', function (e) {
      const p = P();
      if (!p || !p.traits || e.dodged || p.dead) return;
      const t = p.traits;
      if (t.thorns) boom(p, 'thorns', p.x, p.y, 110, val('thorns', 'a', t.thorns), 'physical', 340);
      if (t.second_wind && !st.windUsed && p.hp < p.maxHp * 0.3) { st.windUsed = true; NR.player.heal(p.maxHp * val('second_wind', 'a', t.second_wind)); }
    });
  }
  NR.traits = { init, reset, grant, lv, count, available, rollCard, matches, text, update, critForced, hitMult, shatterBonus, frozenBonus, applyMods, state: st };
})();
