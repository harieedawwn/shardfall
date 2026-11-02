// Owner: Progression. 10 permanent nodes (3-5 levels each), unlock costs and danger gates.
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  NR.data = NR.data || {};
  const U = NR.data.itemUtil;
  // geometric cost ladder rounded to 5
  function ladder(c0, n, g) { const a = []; for (let i = 0; i < n; i++) a.push(Math.max(5, Math.round(c0 * Math.pow(g, i) / 5) * 5)); return a; }
  // levels: array (one entry per level) of mod lists granted AT that level; applied cumulatively.
  function node(vi, en, c0, g, levels) {
    const costs = ladder(c0, levels.length, g), d = {};
    ['vi', 'en'].forEach(function (l) {
      const t = levels.map(function (m) { return U.modText(m, l); });
      const same = t.every(function (x) { return x === t[0]; });
      d[l] = same ? (l === 'vi' ? 'Mỗi cấp: ' : 'Per level: ') + t[0]
        : t.map(function (x, i) { return (l === 'vi' ? 'Cấp ' : 'Lv ') + (i + 1) + ': ' + x; }).join(' | ');
    });
    return { name: { vi: vi, en: en }, desc: d, max: levels.length, costs: costs, levels: levels };
  }
  function rep(n, m) { const a = []; for (let i = 0; i < n; i++) a.push([m]); return a; }
  NR.data.metaNodes = {
    m_hp: node('Máu tối đa', 'Max HP', 20, 1.5, rep(5, { stat: 'maxHp', add: 10 })),
    m_damage: node('Sát thương', 'Damage', 30, 1.55, rep(5, { stat: 'damage', pct: 0.05 })),
    m_slot: node('Ô vũ khí', 'Weapon slots', 150, 2, [[{ stat: 'weaponSlots', add: 1 }], [{ stat: 'damage', pct: 0.03 }], [{ stat: 'weaponSlots', add: 1 }]]),
    m_gold: node('Vàng khởi đầu', 'Starting Gold', 15, 1.5, rep(5, { stat: 'startGold', add: 15 })),
    m_reroll: node('Giảm giá cửa hàng', 'Shop discount', 40, 1.8, rep(3, { stat: 'shopDiscount', add: 0.05 })),
    m_xp: node('Kinh nghiệm', 'Experience', 25, 1.5, rep(5, { stat: 'xpGain', pct: 0.05 })),
    m_luck: node('May mắn', 'Luck', 30, 1.55, rep(5, { stat: 'luck', add: 0.05 })),
    m_dash: node('Lướt', 'Dash', 120, 1.8, [[{ stat: 'dashCharges', add: 1 }], [{ stat: 'dashCooldown', pct: -0.08 }], [{ stat: 'dashCooldown', pct: -0.08 }]]),
    m_revive: node('Hồi sinh', 'Second wind', 200, 2, [[{ stat: 'revives', add: 1 }], [{ stat: 'hpRegen', add: 0.4 }], [{ stat: 'hpRegen', add: 0.4 }]]),
    m_magnet: node('Tầm hút', 'Pickup range', 20, 1.5, rep(5, { stat: 'pickupRange', pct: 0.1 }))
  };
  const costs = {}, C = NR.data.characters || {};
  for (const id in C) if (C[id].unlock && C[id].unlock.type === 'shards') costs[id] = C[id].unlock.cost;
  // danger d+1 unlocks when a run is won at danger d (max 5)
  NR.data.unlocks = { chars: costs, danger: { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 } };
})();
