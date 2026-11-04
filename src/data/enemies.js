// Owned by Horde. Pure data. `aiParams.cost` is the wave-budget price of one enemy.
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  NR.data = NR.data || {};
  // id, shape, color, vi, en, r, hp, speed, dmg, armor, contact, ai, aiParams
  const L = [
    ['grunt', 'circle', '#D9693A', 'Lính quèn', 'Grunt', 12, 20, 70, 8, 0, true, 'walker', { cost: 1, wobble: 0 }],
    ['swarmer', 'tri', '#E8C547', 'Bầy nhỏ', 'Swarmer', 7, 8, 115, 4, 0, true, 'weaver', { cost: 0.4, pack: 5, weave: 0.9 }],
    ['spitter', 'diamond', '#8BD450', 'Kẻ phun', 'Spitter', 11, 18, 55, 6, 0, true, 'kiter', { cost: 1.5, keepMin: 230, keepMax: 330, cd: 2.8, tele: 0.6, bulletSpeed: 170, bulletR: 5 }],
    ['brute', 'square', '#8C4A3B', 'Hộ pháp', 'Brute', 22, 70, 45, 14, 2, true, 'walker', { cost: 3, wobble: 0 }],
    ['bomber', 'hex', '#E86AA6', 'Kẻ đánh bom', 'Bomber', 11, 14, 95, 20, 0, false, 'bomber', { cost: 1.3, fuseRange: 85, tele: 0.7, blastR: 80 }],
    ['lunger', 'capsule', '#C95B73', 'Kẻ lao tới', 'Lunger', 12, 24, 60, 12, 0, false, 'lunger', { cost: 1.6, stalk: 215, tele: 0.7, dashSpeed: 520, dashT: 0.4, recover: 1.0, cd: 1.6, width: 30 }],
    ['sniper', 'cross', '#8FC1E3', 'Xạ thủ', 'Sniper', 11, 16, 40, 18, 0, false, 'sniper', { cost: 2, keepMin: 380, keepMax: 520, cd: 4.2, tele: 1.2, lockT: 0.4, bulletSpeed: 330, bulletR: 5 }],
    ['shielder', 'square', '#C9A24B', 'Khiên sắt', 'Shielder', 15, 40, 50, 10, 0, true, 'shielder', { cost: 2.2, turn: 1.3, arc: 1.15 }],
    ['summoner', 'star', '#8A5BD1', 'Triệu hồi sư', 'Summoner', 14, 30, 40, 5, 0, false, 'summoner', { cost: 3, keepMin: 300, keepMax: 420, cd: 7, tele: 0.9, count: 2, maxKids: 6 }],
    ['splitter', 'circle', '#5FB49C', 'Kẻ phân tách', 'Splitter', 15, 30, 60, 8, 0, true, 'splitter', { cost: 2, splits: 2, childScale: 0.65, childHp: 0.45 }],
    ['medic', 'cross', '#EAF4FB', 'Y sĩ', 'Medic', 13, 20, 55, 4, 0, false, 'medic', { cost: 2, cd: 3.8, tele: 0.6, healR: 120, healPct: 0.25, flee: 220 }],
    ['phantom', 'diamond', '#A25CE0', 'Bóng ma', 'Phantom', 14, 22, 80, 14, 0, false, 'phantom', { cost: 2.2, trigger: 260, vanish: 0.55, appear: 0.6, strikeSpeed: 400, strikeT: 0.28, recover: 0.9, cd: 2.4 }]
  ];
  // Specials (v2): heavy hitters the director drops into every wave on its own schedule (not in the wave budget pools).
  const SP = [
    ['juggernaut', 'hex', '#6B5E7A', 'Kẻ Nghiền', 'Juggernaut', 30, 520, 46, 24, 6, true, 'juggernaut', { cost: 0, cd: 3.6, tele: 0.9, blastR: 140, range: 230 }],
    ['kidnapper', 'capsule', '#3E7A64', 'Kẻ Bắt Cóc', 'Snatcher', 16, 170, 150, 8, 2, false, 'kidnapper', { cost: 0, cd: 3, grabT: 1.5, drag: 210, breakHp: 0.22 }],
    ['warlord', 'star', '#B8452F', 'Kẻ Tiếp Sức', 'Warlord', 18, 260, 52, 12, 3, false, 'warlord', { cost: 0, cd: 4.5, tele: 0.9, buffR: 280, hpBoost: 0.7, dmgBoost: 1.25, keepMin: 280, keepMax: 400 }],
    ['trickster', 'tri', '#4FA8F0', 'Bóng Láu', 'Trickster', 10, 120, 165, 10, 1, false, 'trickster', { cost: 0, cd: 1.5, keepMin: 210, keepMax: 330, blinkCd: 2.4, bulletSpeed: 340, bulletR: 5 }],
    ['engineer', 'square', '#C9A24B', 'Thợ Pháo', 'Engineer', 14, 150, 105, 6, 1, false, 'engineer', { cost: 0, build: 2.6, cd: 5, maxTurrets: 2 }],
    ['mortar', 'diamond', '#8A6A44', 'Pháo Thủ', 'Mortar', 16, 220, 48, 18, 2, false, 'mortar', { cost: 0, cd: 3.4, shells: 3, blastR: 74, flight: 1.15, keepMin: 360, keepMax: 480 }],
    ['turret', 'cross', '#E0B03C', 'Tháp Súng', 'Turret', 14, 1, 0, 9, 0, false, 'turret', { cost: 0, life: 13, ammo: 16, rate: 0.85, bulletSpeed: 300, bulletR: 5 }]
  ];
  const E = {};
  L.forEach(function (d) {
    const cost = d[12].cost;
    E[d[0]] = {
      name: { vi: d[3], en: d[4] }, shape: d[1], color: d[2], r: d[5], hp: d[6], speed: d[7], dmg: d[8], armor: d[9],
      xp: Math.round((1.2 + cost) * 10) / 10, gold: Math.round((0.3 + 0.25 * cost) * 100) / 100,
      ai: d[11], aiParams: d[12], contact: d[10], tags: []
    };
  });
  SP.forEach(function (d) {
    E[d[0]] = {
      name: { vi: d[3], en: d[4] }, shape: d[1], color: d[2], r: d[5], hp: d[6], speed: d[7], dmg: d[8], armor: d[9],
      xp: d[0] === 'turret' ? 0 : 14, gold: d[0] === 'turret' ? 0 : 3, ai: d[11], aiParams: d[12], contact: d[10], tags: d[0] === 'turret' ? ['special', 'structure'] : ['special']
    };
  });
  E.swarmer.tags = ['pack']; E.spitter.tags = ['ranged']; E.sniper.tags = ['ranged']; E.lunger.tags = ['charge'];
  E.bomber.tags = ['area']; E.summoner.tags = ['summon']; E.shielder.tags = ['shield']; E.phantom.tags = ['blink'];
  E.medic.tags = ['support']; E.splitter.tags = ['split']; E.brute.tags = ['heavy'];
  NR.data.enemies = E;
})();
