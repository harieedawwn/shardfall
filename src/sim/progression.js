// Owner: Progression. XP, level-ups and the 4-card level-up offer.
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  const lvP = { level: 1, pending: 0 };
  const openP = { level: 1, cards: null, rerollPrice: 0, pending: 0 };
  const RAR = ['common', 'rare', 'epic', 'legendary'];
  const TIER = { common: 0, rare: 1, epic: 2, legendary: 3 };
  const WEAPON_CHANCE = 0.25, MAX_WEAPON_CARDS = 2, CARDS = 4;

  function reset() {}
  function pending() { const p = NR.world.get().player; return p ? p.pending : 0; }
  function addXp(n) {
    const p = NR.world.get().player;
    if (!p || !(n > 0)) return;
    p.xp += n;
    while (p.xp >= NR.stats.xpNeed(p.level)) {
      p.xp -= NR.stats.xpNeed(p.level); p.level++; p.pending++;
      lvP.level = p.level; lvP.pending = p.pending;
      NR.events.emit('player:levelup', lvP);
    }
  }
  // Weapons that can be offered right now: not evolved, and either a free slot or an upgradable copy we hold.
  function validWeapons(p) {
    const out = [], W = NR.data.weapons;
    for (const id in W) if (!W[id].evolved && NR.weapons.canAdd(p, id) && (!NR.achievements || NR.achievements.isUnlocked('weapon', id))) out.push(id);
    return out;
  }
  // n cards: no duplicate stat or weapon, rarity weighted by luck and wave, weapon cards only when valid
  // every offer holds at least one trait card while any trait can still be taken (a second one with 20% chance); the rest are stat/weapon cards
  function rollCards(n, luck, wave) {
    const p = NR.world.get().player, out = [], usedT = {};
    let nt = 0;
    if (p && NR.traits) {
      const first = NR.traits.rollCard(p, usedT, wave);
      if (first) { usedT[first.id] = true; nt = 1; out.push(first); if (n > 3 && NR.rng.chance(0.2)) { const sec = NR.traits.rollCard(p, usedT, wave); if (sec) { usedT[sec.id] = true; nt++; out.push(sec); } } }
    }
    const rest = rollStatWeapon(n - nt, luck, wave);
    for (let i = 0; i < rest.length; i++) out.push(rest[i]);
    // trait cards sit in the last slots so the familiar stat cards keep their positions
    out.sort(function (a, b) { return (a.kind === 'trait' ? 1 : 0) - (b.kind === 'trait' ? 1 : 0); });
    return out;
  }
  function rollStatWeapon(n, luck, wave) {
    const p = NR.world.get().player, w = NR.stats.rarityWeights(luck, wave), out = [];
    const U = NR.data.upgrades, statKeys = Object.keys(U).filter(function (k) { return !U[k].nonStat; });
    const weapons = p ? validWeapons(p) : [];
    const usedS = {}, usedW = {};
    let wc = 0;
    for (let i = 0; i < n; i++) {
      const rar = NR.rng.weighted(RAR, function (r) { return w[r]; });
      const wpool = wc < MAX_WEAPON_CARDS ? weapons.filter(function (id) { return !usedW[id] && (NR.data.weapons[id].rarity || 'common') === rar; }) : [];
      if (wpool.length && NR.rng.chance(WEAPON_CHANCE)) {
        const id = NR.rng.pick(wpool);
        usedW[id] = true; wc++;
        const own = p.weapons.filter(function (x) { return x.id === id; })[0];
        out.push({ kind: 'weapon', stat: 'weapon', id: id, rarity: rar, add: 0, pct: 0, isNew: !own, level: own ? own.lvl + 1 : 1 });
        continue;
      }
      let pool = statKeys.filter(function (k) { return !usedS[k] && TIER[U[k].min] <= TIER[rar]; });
      if (!pool.length) pool = statKeys.filter(function (k) { return !usedS[k]; });
      if (!pool.length) break;
      const key = NR.rng.pick(pool), v = U[key].rarities[rar];
      usedS[key] = true;
      out.push({ kind: 'stat', stat: key, rarity: rar, add: v.add, pct: v.pct });
    }
    return out;
  }
  function rerollPrice() { return 5 + 5 * NR.world.get().levelup.rerolls; }
  function openCards() {
    const W = NR.world.get(), p = W.player, L = W.levelup;
    L.cards = rollCards(CARDS, NR.stats.get(p, 'luck'), W.wave);
    L.level = p.level - p.pending + 1;
    openP.level = L.level; openP.cards = L.cards; openP.rerollPrice = rerollPrice(); openP.pending = p.pending;
    NR.events.emit('levelup:open', openP);
  }
  function begin() {
    const W = NR.world.get();
    if (!W.player || W.player.pending <= 0) return false;
    W.levelup.rerolls = 0;
    openCards();
    return true;
  }
  function pick(index) {
    const W = NR.world.get(), p = W.player, c = W.levelup.cards[index];
    if (!c) return p.pending;
    if (c.kind === 'trait') {
      NR.traits.grant(p, c.id);
    } else if (c.kind === 'weapon') {
      if (!NR.weapons.add(p, c.id).ok) NR.player.addGold(20 + 4 * W.wave); // cannot happen unless the loadout changed under the card
    } else {
      NR.stats.addMod(p, 'upgrade:' + p.upgrades.length, { stat: c.stat, add: c.add, pct: c.pct });
      p.upgrades.push({ stat: c.stat, rarity: c.rarity });
    }
    p.pending--;
    if (p.pending > 0) { W.levelup.rerolls = 0; openCards(); }
    else { W.levelup.cards = []; NR.run.onLevelUpsDone(); }
    return p.pending;
  }
  function reroll() {
    const W = NR.world.get();
    if (!W.levelup.cards.length || !NR.player.spendGold(rerollPrice())) return false;
    W.levelup.rerolls++;
    openCards();
    return true;
  }
  NR.progression = { reset, addXp, begin, pick, reroll, rollCards, pending, rerollPrice, validWeapons };
})();
