// Owned by Horde. Wave director: per-wave budget + zone mix (data/waves.js), ramp inside the wave, live-enemy cap, danger/elite scaling, Endless.
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  const startP = { wave: 0, zone: '', isBoss: false, duration: 0 };
  const clearP = { wave: 0, isBoss: false };
  const AFFIXES = ['shielded', 'splitter', 'toxic', 'hasty', 'vampiric', 'volatile', 'magnetic'];
  const RESERVE = 12;          // slots kept free for boss summons and splitter children
  const wfn = function (o) { return o.weight; };
  let chillT = 0, extra = 0;
  const spT = [], spId = []; let spN = 0, spI = 0;
  // [id, first wave at danger 0]; each danger level brings them one wave earlier (never before wave 2)
  const SPECIALS = [['trickster', 4], ['juggernaut', 5], ['kidnapper', 6], ['engineer', 7], ['mortar', 8], ['warlord', 10]];
  let info = null, total = 0, spent = 0, bossSpawned = false, cleared = false, minCost = 0.4, clock = 0, plN = 0;
  const plT = new Float64Array(128), plC = new Int32Array(128); // spawn-marker log: enemies waiting behind a marker count against the cap
  const affTmp = [];

  function reset() { usedBoss = {}; chillT = 0; extra = 0; spN = 0; spI = 0; info = null; total = 0; spent = 0; bossSpawned = false; cleared = false; clock = 0; plN = 0; }
  function pending() { let n = 0, j = 0; for (let i = 0; i < plN; i++) if (plT[i] > clock) { plT[j] = plT[i]; plC[j] = plC[i]; j++; n += plC[i]; } plN = j; return n; }
  function zoneOf(n) { return ['scrap', 'frost', 'void'][Math.floor((n - 1) / 5) % 3]; }
  function poolOf(obj) { const a = []; for (const id in obj) a.push({ enemy: id, weight: obj[id] }); return a; }
  function waveInfo(n) {
    if (n <= 15) {
      const w = NR.data.waves[n];
      return { zone: w.zone, isBoss: !!w.boss, duration: w.duration, budget: w.budget, boss: w.boss, pool: w.pool, eliteChance: w.eliteChance, hpMult: 1, donor: '' };
    }
    const E = NR.data.endless, zone = zoneOf(n), isBoss = n % E.bossEvery === 0;
    let boss = null, hpMult = 1, donor = '', budget = E.budgetBase + E.budgetPerWave * (n - 15);
    if (isBoss) {
      const k = n / E.bossEvery - 1, cycle = Math.floor(k / E.bosses.length), L = E.bosses.length;
      boss = E.bosses[k % L]; hpMult = 1 + E.bossHpPerCycle * cycle;
      let di = (k + 1 + cycle) % L; if (di === k % L) di = (di + 1) % L;
      donor = E.bosses[di];
      budget = E.bossBudget + E.bossBudgetPerCycle * cycle;
    }
    return { zone: zone, isBoss: isBoss, duration: E.duration, budget: budget, boss: boss, pool: poolOf(E.pools[zone]), eliteChance: E.eliteChance, hpMult: hpMult, donor: donor };
  }
  // boss waves pick from a small pool (zone boss or a wandering boss), never the same boss twice in a run
  const BOSS_POOL = { 5: ['scrap_titan', 'brood_mother'], 10: ['frost_warden', 'hollow_king', 'brood_mother'], 15: ['void_maw', 'hollow_king'] };
  let usedBoss = {};
  function pickBoss(W, n, def0) {
    const pool = BOSS_POOL[n]; if (!pool) return def0;
    const left = pool.filter(function (id) { return !usedBoss[id] && NR.data.bosses[id]; });
    if (!left.length) return def0;
    const k = (NR.util.hash('boss' + W.seed + ':' + n) >>> 0) % left.length, id = left[k];
    usedBoss[id] = true;
    return id;
  }
  function startWave(n) {
    const W = NR.world.get();
    info = waveInfo(n);
    if (info.isBoss && n <= 15) info.boss = pickBoss(W, n, info.boss);
    W.waveDur = info.duration; W.waveT = info.duration;
    total = info.budget * W.scale.count; spent = 0; chillT = 0; extra = 0; cleared = false; bossSpawned = false;
    startP.wave = n; startP.zone = info.zone; startP.isBoss = info.isBoss; startP.duration = info.duration;
    NR.events.emit('wave:start', startP);
    planSpecials(W, n);
    if (info.isBoss) bossSpawned = !!NR.bosses.spawn(info.boss, { hpMult: info.hpMult, donor: info.donor });
  }
  // specials: 3-7 per wave (more with wave and danger, 2 on boss waves), spread over 15%-85% of the wave
  function planSpecials(W, n) {
    const dn = W.danger | 0;
    let hs = NR.util.hash('sp' + W.seed + ':' + n) >>> 0; // own stream: does not shift NR.rng for the rest of the wave
    const R = { range: function (a, b) { hs = (Math.imul(hs, 1664525) + 1013904223) >>> 0; return a + hs / 4294967296 * (b - a); }, int: function (a, b) { return a + Math.floor(this.range(0, 0.9999) * (b - a + 1)); } };
    // rare at first, more later: danger 0 sees its first special on wave 4, one per wave until wave 7, then 2, then 3;
    // high danger starts earlier and ramps a little harder (cap 2 + danger, max 5). Boss waves only from danger 3.
    const unlock = function (w0) { return Math.max(2, w0 - dn); };
    const pool = [];
    for (let i = 0; i < SPECIALS.length; i++) if (n >= unlock(SPECIALS[i][1])) pool.push(SPECIALS[i][0]);
    let count = 0;
    if (pool.length) {
      const first = unlock(SPECIALS[0][1]);
      count = 1 + Math.floor((n - first) / 4) + (n >= 7 ? Math.floor(dn / 2) : 0);
      count = Math.min(count, 2 + dn, 5);
      if (info.isBoss) count = dn >= 3 ? 1 : 0;
    }
    spN = count; spI = 0;
    const dur = Math.max(10, info.duration - 3);
    for (let i = 0; i < count; i++) { spT[i] = dur * (0.15 + 0.7 * (i + R.range(0.1, 0.9)) / count); spId[i] = pool[R.int(0, pool.length - 1)]; }
  }
  function spawnSpecial(W, p, id) {
    const A = NR.config.ARENA, k = NR.util.hash('spp' + W.seed + ':' + W.wave + ':' + spI) >>> 0, ang = (k % 6283) / 1000, d = 380 + (k >>> 13) % 140;
    const x = NR.util.clamp(p.x + Math.cos(ang) * d, 80, A.w - 80), y = NR.util.clamp(p.y + Math.sin(ang) * d, 80, A.h - 80);
    NR.enemies.spawn(id, x, y, { marker: 1.2, hpMult: 0.75 + 0.12 * (W.danger | 0) });
  }
  const TAU_D = Math.PI * 2;
  function costOf(id) { return NR.data.enemies[id].aiParams.cost; }

  // a point outside the camera view (or inside it, behind a 1 s marker), never close to the player
  const pos = { x: 0, y: 0, marker: 0 };
  function pickPos(p) {
    const A = NR.config.ARENA, R = NR.rng;
    let ok = false;
    for (let t = 0; t < 12 && !ok; t++) {
      const a = R.range(0, Math.PI * 2), d = R.range(560, 780);
      pos.x = NR.util.clamp(p.x + Math.cos(a) * d, 40, A.w - 40); pos.y = NR.util.clamp(p.y + Math.sin(a) * d, 40, A.h - 40);
      ok = NR.util.dist2(pos.x, pos.y, p.x, p.y) >= 320 * 320;
    }
    if (!ok) { pos.x = p.x < A.w / 2 ? A.w - 60 : 60; pos.y = p.y < A.h / 2 ? A.h - 60 : 60; }
    const onScreen = Math.abs(pos.x - p.x) < 760 && Math.abs(pos.y - p.y) < 430;
    pos.marker = onScreen ? 1 : 0;
  }
  function spawnGroup(W, alive, elites) { // alive already includes enemies waiting behind markers
    const pool = info.pool, left = total - spent, cap = NR.config.CAPS.enemies - RESERVE;
    const soft = Math.min(cap, 40 + 12 * W.wave);
    if (alive >= soft) return -1;
    let pick = null;
    for (let tries = 0; tries < 6; tries++) { const c = NR.rng.weighted(pool, wfn); if (costOf(c.enemy) <= left + 1e-9) { pick = c.enemy; break; } }
    if (!pick) { for (let i = 0; i < pool.length; i++) if (costOf(pool[i].enemy) <= left + 1e-9) { pick = pool[i].enemy; break; } }
    if (!pick) return -2;
    const d = NR.data.enemies[pick], cost = costOf(pick);
    let n = d.aiParams.pack ? Math.min(d.aiParams.pack, Math.floor(left / cost + 1e-9)) : 1;
    n = Math.max(1, Math.min(n, cap - alive));
    pickPos(W.player);
    let aff = null;
    if (pick !== 'swarmer' && elites < 2 + Math.floor(W.wave / 4)) {
      const ch = Math.min(0.45, W.scale.elite + info.eliteChance);
      if (ch > 0 && NR.rng.chance(ch)) {
        affTmp.length = 0;
        const cnt = (W.danger >= 3 || W.wave >= 11) ? 2 : 1; // 1 affix, 2 from danger 3 or wave 11
        while (affTmp.length < cnt) { const id = NR.rng.pick(AFFIXES); if (affTmp.indexOf(id) < 0) affTmp.push(id); }
        aff = affTmp;
      }
    }
    for (let k = 0; k < n; k++) {
      const jx = n > 1 ? NR.rng.range(-38, 38) : 0, jy = n > 1 ? NR.rng.range(-38, 38) : 0;
      NR.enemies.spawn(pick, pos.x + jx, pos.y + jy, { marker: pos.marker, affixes: aff });
    }
    spent += n * cost;
    if (pos.marker > 0 && plN < 128) { plT[plN] = clock + pos.marker + 0.05; plC[plN] = n; plN++; }
    return n;
  }
  function update(dt) {
    const W = NR.world.get(), p = W.player;
    if (!info || cleared) return;
    clock += dt;
    if (W.waveT > 0) W.waveT = Math.max(0, W.waveT - dt);
    if (info.isBoss) {
      if (bossSpawned && (!W.boss || W.boss.dead)) { cleared = true; clearP.wave = W.wave; clearP.isBoss = true; NR.events.emit('wave:clear', clearP); return; }
    } else if (W.waveT <= 0) {
      cleared = true; NR.enemies.dissolveAll(); clearP.wave = W.wave; clearP.isBoss = false; NR.events.emit('wave:clear', clearP); return;
    }
    if (p && !p.dead && spI < spN && clock >= spT[spI] && W.waveT > 3) { spawnSpecial(W, p, spId[spI]); spI++; }
    // pressure: a player cruising at high HP with few enemies near gets a light top-up (at most +15% of the wave budget)
    if (!info.isBoss && p && !p.dead && W.waveT > 3) {
      let near = 0;
      const E0 = W.enemies;
      for (let i = 0; i < E0.length; i++) { const e = E0[i]; if (!e.dead && Math.abs(e.x - p.x) < 420 && Math.abs(e.y - p.y) < 420) near++; }
      if (p.hp >= p.maxHp * 0.85 && near < 6 + W.wave) chillT += dt; else chillT = Math.max(0, chillT - dt * 2);
      if (chillT > 6) {
        const base = info.budget * W.scale.count, add = Math.min(base * 0.15 - extra, base * 0.15 * dt / Math.max(10, info.duration * 0.5));
        if (add > 0) { extra += add; total += add; }
      }
    }
    if (W.waveT > 3 && p && !p.dead && spent < total - 1e-9) { // spawning stops 3 s before the end
      const T = Math.max(1, info.duration - 3), tau = NR.util.clamp((info.duration - W.waveT) / T, 0, 1);
      const target = (W.wave > 15) ? total * (0.16 + 0.84 * (0.45 * tau + 0.55 * tau * tau)) : total * (0.1 + 0.9 * (0.3 * tau + 0.7 * tau * tau)); // opening burst, then a spawn rate that climbs 0.3x -> 1.7x through the wave
      if (spent + minCost <= target + 1e-9) {
        const E = W.enemies; let alive = pending(), elites = 0;
        for (let i = 0; i < E.length; i++) if (!E[i].dead) { alive++; if (E[i].flags.elite) elites++; }
        while (spent + minCost <= target + 1e-9) {
          const n = spawnGroup(W, alive, elites);
          if (n < 0) { if (n === -2) spent = total; break; }
          alive += n;
        }
      }
    }
  }
  NR.director = { reset, startWave, update, waveInfo, zoneOf };
})();
