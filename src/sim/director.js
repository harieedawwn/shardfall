// Owned by Horde. Wave director: per-wave budget + zone mix (data/waves.js), ramp inside the wave, live-enemy cap, danger/elite scaling, Endless.
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  const startP = { wave: 0, zone: '', isBoss: false, duration: 0 };
  const clearP = { wave: 0, isBoss: false };
  const AFFIXES = ['hasty', 'plated', 'volatile', 'regen'];
  const RESERVE = 12;          // slots kept free for boss summons and splitter children
  const wfn = function (o) { return o.weight; };
  let info = null, total = 0, spent = 0, bossSpawned = false, cleared = false, minCost = 0.4, clock = 0, plN = 0;
  const plT = new Float64Array(128), plC = new Int32Array(128); // spawn-marker log: enemies waiting behind a marker count against the cap
  const affTmp = [];

  function reset() { info = null; total = 0; spent = 0; bossSpawned = false; cleared = false; clock = 0; plN = 0; }
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
  function startWave(n) {
    const W = NR.world.get();
    info = waveInfo(n);
    W.waveDur = info.duration; W.waveT = info.duration;
    total = info.budget * W.scale.count; spent = 0; cleared = false; bossSpawned = false;
    startP.wave = n; startP.zone = info.zone; startP.isBoss = info.isBoss; startP.duration = info.duration;
    NR.events.emit('wave:start', startP);
    if (info.isBoss) bossSpawned = !!NR.bosses.spawn(info.boss, { hpMult: info.hpMult, donor: info.donor });
  }
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
        const cnt = W.danger >= 4 ? 2 : 1;
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
