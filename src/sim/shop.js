// Owner: Progression. The shop: 4 offers, wave-scaled prices, lock, rising reroll cost, selling.
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  const chP = { reason: 'open', offers: null, rerollPrice: 0, gold: 0 };
  const OFFERS = 4, WEAPON_SHARE = 0.35, WAVE_STEP = 0.08;
  let paidItems = {}; // id -> stack of prices paid (runtime only; restored runs fall back to half the list cost)

  function reset() { paidItems = {}; }
  function player() { return NR.world.get().player; }
  function disc() { return NR.stats.get(player(), 'shopDiscount'); }
  function defOf(o) { return o.kind === 'weapon' ? NR.data.weapons[o.id] : NR.data.items[o.id]; }
  function waveMul(wave) { return 1 + WAVE_STEP * (wave - 1); }
  function owned(p, id) { for (let i = 0; i < p.weapons.length; i++) if (p.weapons[i].id === id) return p.weapons[i]; return null; }
  // price of an offer now: list cost x wave scaling x discount; upgrading a held weapon costs 0.5 + 0.25 per current level
  function basePrice(kind, id, wave, p, disc_) {
    const d = kind === 'weapon' ? NR.data.weapons[id] : NR.data.items[id];
    let m = waveMul(wave);
    if (kind === 'weapon') { const w = owned(p, id); if (w) m *= 0.5 + 0.25 * w.lvl; }
    return Math.max(1, Math.round(d.cost * m * (1 - disc_)));
  }
  function price(o) { const W = NR.world.get(); return basePrice(o.kind, o.id, W.wave, W.player, disc()); }
  function rerollPrice() { const W = NR.world.get(); return Math.ceil((3 + W.wave) * (1 + 0.4 * W.shop.rerolls) * (1 - disc())); }
  function emit(reason) {
    const W = NR.world.get();
    chP.reason = reason; chP.offers = W.shop.offers; chP.rerollPrice = rerollPrice(); chP.gold = W.player.gold;
    NR.events.emit('shop:change', chP);
  }
  function validOffer(p, o) {
    if (!o || o.sold) return false;
    if (o.kind === 'weapon') { const d = NR.data.weapons[o.id]; return !!d && !d.evolved && NR.weapons.canAdd(p, o.id); }
    const d = NR.data.items[o.id];
    return !!d && NR.items.count(p, o.id) < d.maxStack;
  }
  function rollOne(taken, forceKind) {
    const W = NR.world.get(), p = W.player, w = NR.stats.rarityWeights(NR.stats.get(p, 'luck'), W.wave);
    const wp = [], ip = [];
    for (const id in NR.data.weapons) { const d = NR.data.weapons[id]; if (!taken['w:' + id] && !d.evolved && NR.weapons.canAdd(p, id)) wp.push(id); }
    for (const id in NR.data.items) { if (!taken['i:' + id] && NR.items.count(p, id) < NR.data.items[id].maxStack) ip.push(id); }
    let kind = forceKind || (NR.rng.chance(WEAPON_SHARE) ? 'weapon' : 'item');
    if (kind === 'weapon' && !wp.length) kind = 'item';
    if (kind === 'item' && !ip.length) kind = wp.length ? 'weapon' : '';
    if (!kind) return null;
    const pool = kind === 'weapon' ? wp : ip, src = kind === 'weapon' ? NR.data.weapons : NR.data.items;
    const id = NR.rng.weighted(pool, function (x) { return w[src[x].rarity || 'common']; });
    taken[(kind === 'weapon' ? 'w:' : 'i:') + id] = true;
    const o = { kind: kind, id: id, price: 0, locked: false, sold: false };
    o.price = price(o);
    return o;
  }
  // keeps still-valid locked offers, rerolls the rest
  function fill() {
    const W = NR.world.get(), p = W.player, old = W.shop.offers, taken = {}, keep = [], out = [];
    for (let i = 0; i < OFFERS; i++) {
      const o = old[i];
      if (o && o.locked && validOffer(p, o)) { o.price = price(o); keep[i] = o; taken[(o.kind === 'weapon' ? 'w:' : 'i:') + o.id] = true; }
    }
    for (let i = 0; i < OFFERS; i++) {
      out.push(keep[i] || rollOne(taken, i === 0 ? 'weapon' : null) || { kind: 'item', id: 'thick_hide', price: 0, locked: false, sold: true });
    }
    W.shop.offers = out;
  }
  function open() { NR.world.get().shop.rerolls = 0; fill(); emit('open'); }
  function buy(index) {
    const W = NR.world.get(), p = W.player, o = W.shop.offers[index];
    if (!o || o.sold) return { ok: false, reason: 'sold' };
    const pr = price(o);
    if (p.gold < pr) return { ok: false, reason: 'gold' };
    if (o.kind === 'weapon') {
      if (!NR.weapons.canAdd(p, o.id)) return { ok: false, reason: owned(p, o.id) ? 'max' : 'slots' };
      const r = NR.weapons.add(p, o.id);
      if (!r.ok) return { ok: false, reason: r.reason };
      p.weapons[r.slot].paid += pr;
    } else {
      if (!NR.items.grant(p, o.id, 'shop')) return { ok: false, reason: 'max' };
      (paidItems[o.id] = paidItems[o.id] || []).push(pr);
    }
    NR.player.spendGold(pr);
    o.sold = true; o.locked = false;
    emit('buy');
    return { ok: true, reason: '' };
  }
  function reroll() {
    const W = NR.world.get();
    if (!NR.player.spendGold(rerollPrice())) return false;
    W.shop.rerolls++;
    fill();
    emit('reroll');
    return true;
  }
  function toggleLock(i) { const o = NR.world.get().shop.offers[i]; if (o && !o.sold) { o.locked = !o.locked; emit('lock'); } }
  function sellPrice(kind, idOrSlot) {
    const p = player();
    if (kind === 'weapon') { const w = p.weapons[idOrSlot]; return w ? Math.floor(0.5 * w.paid) : 0; }
    const s = paidItems[idOrSlot], d = NR.data.items[idOrSlot];
    if (s && s.length) return Math.floor(0.5 * s[s.length - 1]);
    return d ? Math.floor(0.5 * d.cost) : 0;
  }
  function sell(kind, idOrSlot) {
    const p = player(), pr = sellPrice(kind, idOrSlot);
    if (kind === 'weapon') { if (p.weapons.length <= 1 || !NR.weapons.remove(p, idOrSlot)) return false; }
    else {
      if (!NR.items.remove(p, idOrSlot)) return false;
      if (paidItems[idOrSlot]) paidItems[idOrSlot].pop();
    }
    NR.player.addGold(pr);
    emit('sell');
    return true;
  }
  // effective odds of each rarity for an item offer (weights x pool size), for tuning tables
  function rarityOdds(wave, luck) {
    const w = NR.stats.rarityWeights(luck, wave), n = {}, out = {};
    let tot = 0;
    for (const id in NR.data.items) { const r = NR.data.items[id].rarity; n[r] = (n[r] || 0) + 1; }
    for (const r in n) { out[r] = w[r] * n[r]; tot += out[r]; }
    for (const r in out) out[r] /= tot;
    return out;
  }
  NR.shop = { reset, open, buy, reroll, toggleLock, sell, price, rerollPrice, sellPrice, rarityOdds, basePrice, validOffer };
})();
