(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  const defaults = {
    maxHp: 100, hpRegen: 0, armor: 0, dodge: 0, moveSpeed: 1,
    dashCharges: 2, dashCooldown: 1.2,
    damage: 1, attackSpeed: 1, critChance: 0.05, critDamage: 1.5,
    area: 1, range: 1, projectiles: 0, pierce: 0,
    pickupRange: 70, // px (flat base; cards/items use add or pct)
    xpGain: 1, goldGain: 1, luck: 0, statusPower: 1,
    knockback: 1, lifesteal: 0, projSpeed: 1, weaponSlots: 4,
    shopDiscount: 0, revives: 0, startGold: 0
  };
  const limits = {};
  for (const k in defaults) limits[k] = { min: 0, max: Infinity };
  limits.maxHp.min = 1;
  limits.dodge.max = 0.5;
  limits.critChance.max = 1;
  limits.dashCooldown.min = 0.3;
  limits.attackSpeed.min = 0.1; limits.attackSpeed.max = 4;
  limits.dashCharges.min = 1;
  limits.shopDiscount.max = 0.9;

  function base(p) { return p.baseStats || defaults; }

  function recalc(p) {
    const b = base(p), st = p.stats || (p.stats = {});
    const mods = p.mods || (p.mods = []);
    for (const k in defaults) {
      let add = 0, pct = 0, mult = 1;
      for (let i = 0; i < mods.length; i++) {
        const m = mods[i];
        if (m.stat !== k) continue;
        add += m.add; pct += m.pct; mult *= m.mult;
      }
      const bv = b[k] === undefined ? defaults[k] : b[k];
      const lim = limits[k];
      let v = (bv + add) * (1 + pct) * mult;
      if (v < lim.min) v = lim.min; else if (v > lim.max) v = lim.max;
      st[k] = v;
    }
    // keep the player's derived fields in sync (Core is the sole writer)
    const maxHp = Math.round(st.maxHp);
    if (p.maxHp !== undefined) {
      const old = p.maxHp;
      p.maxHp = maxHp;
      if (p.hp !== undefined) {
        if (maxHp > old && old > 0) p.hp += maxHp - old;
        if (p.hp > maxHp) p.hp = maxHp;
      }
    }
    if (p.dash) {
      const nm = Math.round(st.dashCharges);
      if (nm > p.dash.max) p.dash.charges += nm - p.dash.max;
      p.dash.max = nm;
      if (p.dash.charges > nm) p.dash.charges = nm;
    }
    if (p.revives !== undefined) {
      const rv = Math.round(st.revives), prev = p._revStat || 0;
      p.revives += rv - prev;
      if (p.revives < 0) p.revives = 0;
      p._revStat = rv;
    }
    return st;
  }

  function addMod(p, src, mod) {
    (p.mods || (p.mods = [])).push({
      src: src, stat: mod.stat, add: mod.add || 0, pct: mod.pct || 0,
      mult: mod.mult === undefined ? 1 : mod.mult
    });
    recalc(p);
  }
  function removeMods(p, src) {
    const m = p.mods;
    if (!m) return;
    let j = 0;
    for (let i = 0; i < m.length; i++) if (m[i].src !== src) m[j++] = m[i];
    m.length = j;
    recalc(p);
  }
  function get(p, key) {
    const st = p && p.stats;
    if (st && st[key] !== undefined) return st[key];
    return defaults[key];
  }
  function xpNeed(L) { return Math.round(6 + 5 * L + 1.3 * L * L); }
  function armorMult(a) { return Math.max(0.25, 10 / (10 + Math.max(0, a))); }
  function enemyScale(w, d) {
    const n = w - 1;
    let hp = (1 + 0.18 * n + 0.012 * n * n) * (1 + 0.25 * d);
    let dmg = (1 + 0.06 * n) * (1 + 0.15 * d);
    let count = (1 + 0.04 * n) * (1 + 0.1 * d);
    if (w > 15) {
      const e = w - 15;
      hp *= Math.pow(1.07, e); dmg *= Math.pow(1.04, e); count *= Math.pow(1.03, e);
    }
    return {
      hp: hp, dmg: dmg,
      speed: Math.min(1.4, 1 + 0.005 * w + 0.02 * d),
      count: count,
      elite: Math.min(0.3, Math.max(0, 0.03 * (w - 3))) + 0.03 * d,
      gold: 1 + 0.03 * n,
      xp: 1 + 0.05 * n,
      shardMult: 1 + 0.3 * d
    };
  }
  const TIER = { common: 0, rare: 1, epic: 2, legendary: 3 };
  function rarityWeights(luck, w) {
    const b = {
      common: 100, rare: 25 + 2 * w, epic: 4 + 1.5 * w,
      legendary: w < 6 ? 0 : 1 + 0.4 * (w - 6)
    };
    const r = {};
    for (const k in b) r[k] = b[k] * (1 + luck * TIER[k]);
    return r;
  }
  NR.stats = { recalc, addMod, removeMods, get, xpNeed, armorMult, enemyScale, rarityWeights, defaults, limits };
})();
