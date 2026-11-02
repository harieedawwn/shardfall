// Owned by Horde. Pure data: zone palettes, 15 wave definitions, Endless rules.
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  NR.data = NR.data || {};
  NR.data.zones = {
    scrap: { name: { vi: 'Bãi Phế Liệu', en: 'Scrapyard' }, waves: [1, 5], palette: ['#2E3A32', '#3C4B40', '#1F2822', '#C9A24B', '#D9693A', '#EDE3C8'], boss: 'scrap_titan' },
    frost: { name: { vi: 'Đồng Băng', en: 'Frostfield' }, waves: [6, 10], palette: ['#27384F', '#35506E', '#1A2638', '#8FC1E3', '#C95B73', '#EAF4FB'], boss: 'frost_warden' },
    void: { name: { vi: 'Hư Không', en: 'The Void' }, waves: [11, 15], palette: ['#2A1E3F', '#3B2A58', '#1B1229', '#8A5BD1', '#E86AA6', '#F1E0FF'], boss: 'void_maw' }
  };
  // budget = enemy "points" (see aiParams.cost); pool = zone enemy mix with weights. Boss waves carry a small add budget.
  const BUDGET = [12, 16, 20, 25, 10, 28, 33, 38, 44, 14, 48, 54, 60, 66, 18];
  const POOL = [
    { grunt: 6, swarmer: 3 },
    { grunt: 5, swarmer: 3, spitter: 2 },
    { grunt: 4, swarmer: 3, spitter: 2, brute: 1 },
    { grunt: 4, swarmer: 3, spitter: 2, brute: 1, bomber: 2 },
    { grunt: 3, swarmer: 3, bomber: 1 },
    { grunt: 3, swarmer: 3, spitter: 2, lunger: 3 },
    { grunt: 2, swarmer: 2, spitter: 2, lunger: 3, shielder: 2 },
    { swarmer: 2, spitter: 2, lunger: 2, shielder: 2, sniper: 2, bomber: 1 },
    { grunt: 2, lunger: 2, shielder: 2, sniper: 2, medic: 2, splitter: 2 },
    { grunt: 3, lunger: 2, shielder: 1 },
    { spitter: 2, splitter: 2, medic: 2, phantom: 3, summoner: 1, brute: 1 },
    { swarmer: 2, shielder: 2, sniper: 2, phantom: 3, summoner: 2, splitter: 2 },
    { lunger: 2, bomber: 2, medic: 2, phantom: 3, summoner: 2, brute: 2, sniper: 1 },
    { grunt: 1, swarmer: 2, spitter: 1, lunger: 1, bomber: 1, sniper: 1, shielder: 1, summoner: 1, splitter: 1, medic: 1, phantom: 2, brute: 1 },
    { swarmer: 3, phantom: 2, bomber: 1 }
  ];
  const BOSS = { 5: 'scrap_titan', 10: 'frost_warden', 15: 'void_maw' };
  const W = {};
  for (let n = 1; n <= 15; n++) {
    const pool = [];
    for (const id in POOL[n - 1]) pool.push({ enemy: id, weight: POOL[n - 1][id] });
    W[n] = {
      zone: n <= 5 ? 'scrap' : n <= 10 ? 'frost' : 'void', duration: Math.min(60, Math.max(25, 25 + 2.5 * (n - 1))),
      budget: BUDGET[n - 1], pool: pool, boss: BOSS[n] || null, eliteChance: n <= 3 ? 0 : 0.02
    };
  }
  NR.data.waves = W;
  // Endless (wave 16+): zones cycle, boss every 5 waves, remixed with a donor boss's patterns
  NR.data.endless = {
    duration: 60, budgetBase: 66, budgetPerWave: 6, bossEvery: 5, bossBudget: 18, bossBudgetPerCycle: 4, bossHpPerCycle: 0.6,
    eliteChance: 0.04, bosses: ['scrap_titan', 'frost_warden', 'void_maw'],
    pools: {
      scrap: { grunt: 3, swarmer: 3, spitter: 2, brute: 2, bomber: 2, lunger: 1, splitter: 1 },
      frost: { swarmer: 2, spitter: 2, lunger: 3, shielder: 3, sniper: 2, medic: 2, splitter: 2 },
      void: { swarmer: 1, bomber: 1, sniper: 2, medic: 2, phantom: 3, summoner: 2, brute: 2, shielder: 1 }
    }
  };
})();
