// Owner: Progression. Level-up stat cards. Values per rarity; 'min' = lowest rarity at which the card can appear.
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  NR.data = NR.data || {};
  const MULT = { common: 1, rare: 1.6, epic: 2.5, legendary: 4 };
  // key, vi, en, kind('add'|'pct'|'int'), base, min rarity, explicit values (overrides MULT)
  const L = [
    ['maxHp', 'Máu tối đa', 'Max HP', 'add', 10], ['hpRegen', 'Hồi máu', 'HP Regen', 'add', 0.4],
    ['armor', 'Giáp', 'Armor', 'int', 1, 'common', { common: 1, rare: 2, epic: 3, legendary: 5 }],
    ['dodge', 'Né tránh', 'Dodge', 'add', 0.02], ['moveSpeed', 'Tốc độ chạy', 'Move Speed', 'pct', 0.05],
    ['dashCharges', 'Lần lướt', 'Dash Charges', 'int', 1, 'epic', { common: 1, rare: 1, epic: 1, legendary: 2 }],
    ['dashCooldown', 'Hồi lướt', 'Dash Cooldown', 'pct', -0.05], ['damage', 'Sát thương', 'Damage', 'pct', 0.08], ['attackSpeed', 'Tốc độ bắn', 'Attack Speed', 'pct', 0.06],
    ['critChance', 'Tỉ lệ chí mạng', 'Crit Chance', 'add', 0.03], ['critDamage', 'Sát thương chí mạng', 'Crit Damage', 'add', 0.1], ['area', 'Vùng đánh', 'Area', 'pct', 0.06],
    ['range', 'Tầm', 'Range', 'pct', 0.06],
    ['projectiles', 'Đạn', 'Projectiles', 'int', 1, 'epic', { common: 1, rare: 1, epic: 1, legendary: 2 }],
    ['pierce', 'Xuyên', 'Pierce', 'int', 1, 'rare', { common: 1, rare: 1, epic: 2, legendary: 3 }],
    ['pickupRange', 'Tầm hút', 'Pickup Range', 'pct', 0.15], ['xpGain', 'Kinh nghiệm', 'XP Gain', 'pct', 0.1], ['goldGain', 'Vàng', 'Gold Gain', 'pct', 0.1],
    ['luck', 'May mắn', 'Luck', 'add', 0.1], ['statusPower', 'Sức hiệu ứng', 'Status Power', 'pct', 0.1]
  ];
  const U = {};
  L.forEach(function (d) {
    const r = {};
    for (const k in MULT) {
      const v = d[6] ? d[6][k] : (d[3] === 'int' ? Math.round(d[4] * MULT[k]) : Math.round(d[4] * MULT[k] * 1000) / 1000);
      r[k] = d[3] === 'pct' ? { add: 0, pct: v } : { add: v, pct: 0 };
    }
    U[d[0]] = { name: { vi: d[1], en: d[2] }, min: d[5] || 'common', rarities: r };
  });
  // pseudo entry for weapon cards ({kind:'weapon', stat:'weapon', id}); never rolled as a stat, never stored in p.upgrades
  U.weapon = { name: { vi: 'Vũ khí', en: 'Weapon' }, nonStat: true, min: 'common', rarities: {} };
  NR.data.upgrades = U;
})();
