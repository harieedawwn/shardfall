// Owner: Progression. Meta-progression: Shards, permanent nodes, unlocks, codex. Persisted through NR.save (meta + codex).
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  const STARTERS = ['ranger', 'dasher']; // characters open from the first run
  const chP = { kind: 'shards', id: '' };
  const cdP = { kind: '', id: '' };
  let inited = false;

  function M() { return NR.save.getMeta(); }
  function init() {
    if (inited) return;
    inited = true;
    const E = NR.events;
    E.on('run:end', function (e) {
      const m = M(), W = NR.world.get();
      m.shards += e.stats.shardsEarned | 0; m.runs++;
      if (e.result === 'win') {
        m.wins++;
        if (W.danger === m.maxDanger && m.maxDanger < 5) { m.maxDanger = W.danger + 1; chP.kind = 'danger'; chP.id = String(m.maxDanger); E.emit('meta:change', chP); }
      }
      if (e.stats.wave > m.bestWave) m.bestWave = e.stats.wave;
      NR.save.flush();
    });
    E.on('run:start', function (e) { discover('character', e.charId); });
    E.on('weapon:gain', function (e) { discover('weapon', e.weaponId); });
    E.on('weapon:evolve', function (e) { discover('evolution', e.into); discover('weapon', e.into); });
    E.on('item:gain', function (e) { discover('item', e.itemId); });
    E.on('enemy:spawn', function (e) { const en = e.enemy; if (en && en.defId) discover(en.isBoss ? 'boss' : 'enemy', en.defId); });
  }
  function node(id) { return M().nodes[id] || 0; }
  function nodeMax(id) { const d = NR.data.metaNodes[id]; return d ? d.max : 0; }
  function nodeCost(id) { const d = NR.data.metaNodes[id], l = node(id); return d && l < d.max ? d.costs[l] : 0; }
  function shards() { return M().shards; }
  function buyNode(id) {
    const c = nodeCost(id);
    if (!c || M().shards < c) return false;
    M().shards -= c; M().nodes[id] = node(id) + 1; NR.save.flush();
    chP.kind = 'node'; chP.id = id; NR.events.emit('meta:change', chP);
    return true;
  }
  function charUnlocked(id) { return !!NR.data.characters[id] && (STARTERS.indexOf(id) >= 0 || M().chars.indexOf(id) >= 0); }
  function unlockCost(id) { const c = NR.data.unlocks.chars[id]; return c === undefined ? 0 : c; }
  function unlockChar(id) {
    const c = NR.data.unlocks.chars[id];
    if (c === undefined || charUnlocked(id) || M().shards < c) return false;
    M().shards -= c; M().chars.push(id); NR.save.flush();
    chP.kind = 'char'; chP.id = id; NR.events.emit('meta:change', chP);
    return true;
  }
  function maxDanger() { return M().maxDanger; }
  function dangerUnlocked(d) { return d >= 0 && d <= 5 && d <= M().maxDanger; }
  // every owned level adds its mod list (node.levels[i] = what level i+1 grants)
  function applyToRun(p) {
    for (const id in NR.data.metaNodes) {
      const d = NR.data.metaNodes[id], l = Math.min(node(id), d.max);
      for (let k = 0; k < l; k++) for (let i = 0; i < d.levels[k].length; i++) NR.stats.addMod(p, 'meta:' + id, d.levels[k][i]);
    }
  }
  function discover(kind, id) {
    const c = NR.save.getCodex()[kind];
    if (!c || !id || c[id]) return;
    c[id] = true;
    cdP.kind = kind; cdP.id = id; NR.events.emit('codex:discover', cdP);
  }
  function codexCount(kind) { return Object.keys(NR.save.getCodex()[kind] || {}).length; }
  // Shards: 3 per wave reached, 1 per 25 kills, 20 per boss, 60 for a win; all multiplied by the danger bonus (1 + 0.3 x danger)
  function breakdown(result, st) {
    const W = NR.world.get(), mult = W.scale && W.scale.shardMult ? W.scale.shardMult : 1;
    const waves = 3 * (st.wave || 0), kills = (st.kills || 0) / 25, bosses = 20 * (st.bossesKilled || 0), win = result === 'win' ? 60 : 0;
    return { waves: waves, kills: kills, bosses: bosses, win: win, mult: mult, total: Math.floor((waves + kills + bosses + win) * mult) };
  }
  function shardsFor(result, st) { return breakdown(result, st).total; }
  NR.meta = { init, node, nodeMax, buyNode, nodeCost, shards, charUnlocked, unlockChar, unlockCost, maxDanger, dangerUnlocked, applyToRun, discover, codexCount, shardsFor, breakdown };
})();
