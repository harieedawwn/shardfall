// Owner: Progression. Pickups: spawning, drop tables, magnet, xp-shard merging, chests.
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  const colP = { type: '', value: 0, x: 0, y: 0, kind: '', id: '' };
  const LOOK = {
    xp_shard: ['diamond', '#7FD3F0', 6], gold: ['circle', '#FFD43B', 7], heart: ['cross', '#E86AA6', 8],
    magnet: ['hex', '#A25CE0', 8], nova_bomb: ['star', '#FF7A2F', 9], chest: ['square', '#C9A24B', 12]
  };
  const LIFE = { xp_shard: 45, gold: 30, heart: 20, magnet: 15, nova_bomb: 15, chest: 90 };
  const MERGE_OVER = 300;
  // chance per kill: [normal, elite]; luck scales every chance by (1 + luck). boss: one chest and one heart, always.
  const DROPS = { heart: [0.012, 0.06, 3], magnet: [0.004, 0.02, 1], nova_bomb: [0.003, 0.02, 1], chest: [0.0015, 0.05, 2] };
  let inited = false;

  function init() {
    if (inited) return;
    inited = true;
    NR.events.on('enemy:death', function (e) { dropFor(e); });
    NR.events.on('wave:clear', function () { collectAll(); });
  }
  function reset() {}
  function onField(type) { const P = NR.world.get().pickups; let n = 0; for (let i = 0; i < P.length; i++) if (!P[i].dead && P[i].type === type) n++; return n; }
  function dropFor(e) {
    const p = NR.world.get().player;
    if (!p) return;
    const en = e.enemy, x = e.x, y = e.y;
    spawn('xp_shard', x, y, en.xp * NR.stats.get(p, 'xpGain'));
    const g = en.gold * NR.stats.get(p, 'goldGain'), v = Math.floor(g) + (NR.rng.chance(g - Math.floor(g)) ? 1 : 0);
    if (v > 0) spawn('gold', x + 6, y + 4, v);
    if (e.isBoss) {
      spawn('chest', x - 24, y, 0);
      spawn('heart', x + 24, y, healValue(p));
      return;
    }
    const lk = 1 + Math.max(0, NR.stats.get(p, 'luck')), el = e.elite ? 1 : 0;
    for (const type in DROPS) {
      const d = DROPS[type];
      if (!NR.rng.chance(d[el] * lk)) continue;
      if (onField(type) >= d[2]) continue;
      spawn(type, x - 8 + 16 * (type.length % 2), y - 6, type === 'heart' ? healValue(p) : 0);
      break; // at most one special drop per kill
    }
  }
  function healValue(p) { return Math.max(10, Math.round(p.maxHp * 0.15)); }
  function spawn(type, x, y, value) {
    const l = LOOK[type];
    if (!l) return null;
    return NR.world.add('pickups', { type: type, value: value || 0, n: 1, life: LIFE[type], magnet: false, bob: 0, x: x, y: y, r: l[2], shape: l[0], color: l[1], rot: 0, sx: 1, sy: 1, flash: 0 });
  }
  function collectAll() { const P = NR.world.get().pickups; for (let i = 0; i < P.length; i++) P[i].magnet = true; }

  // chest: a weapon level (40%, when one is upgradable) or an item (luck-boosted rarity); gold if neither is possible
  function openChest(out) {
    const W = NR.world.get(), p = W.player, M = NR.config.MAX_LEVEL;
    out = out || colP;
    out.kind = 'gold'; out.id = ''; out.value = 0;
    const up = [];
    for (let i = 0; i < p.weapons.length; i++) if (NR.weapons.canAdd(p, p.weapons[i].id)) up.push(p.weapons[i].id);
    if (up.length && NR.rng.chance(0.4)) { if (giveWeapon(p, up, out)) return out; }
    const ids = NR.items.roll(1, NR.stats.get(p, 'luck') + 0.3, W.wave + 3);
    if (ids.length && NR.items.grant(p, ids[0], 'chest')) { out.kind = 'item'; out.id = ids[0]; out.value = p.items[ids[0]]; return out; }
    if (up.length && giveWeapon(p, up, out)) return out;
    const g = 25 + 5 * W.wave; NR.player.addGold(g); out.value = g;
    return out;
  }
  function giveWeapon(p, up, out) {
    const id = NR.rng.pick(up), r = NR.weapons.add(p, id);
    if (!r.ok) return false;
    out.kind = 'weapon'; out.id = id; out.value = r.level;
    return true;
  }
  function collect(pk, p) {
    pk.dead = true;
    colP.type = pk.type; colP.value = pk.value; colP.x = pk.x; colP.y = pk.y; colP.kind = ''; colP.id = '';
    if (pk.type === 'xp_shard') NR.progression.addXp(pk.value);
    else if (pk.type === 'gold') NR.player.addGold(pk.value);
    else if (pk.type === 'heart') NR.player.heal(pk.value || 20);
    else if (pk.type === 'magnet') collectAll();
    else if (pk.type === 'nova_bomb') NR.combat.explode(p.x, p.y, 600, (50 + 5 * NR.world.get().wave) * NR.stats.get(p, 'damage'), { team: 'player', element: 'physical', weaponId: null });
    else if (pk.type === 'chest') openChest(colP); // fills kind/id/value: this payload is the reveal event
    NR.events.emit('pickup:collect', colP);
  }
  // merge xp shards into per-cell stacks (cells double until at most MERGE_OVER remain); total value is conserved
  function mergeXp(P) {
    let list = [];
    for (let i = 0; i < P.length; i++) if (!P[i].dead && P[i].type === 'xp_shard') list.push(P[i]);
    for (let cell = 100; list.length > MERGE_OVER && cell <= 3200; cell *= 2) {
      const map = new Map(), next = [];
      for (let i = 0; i < list.length; i++) {
        const k = list[i], key = Math.floor(k.x / cell) * 4096 + Math.floor(k.y / cell), t = map.get(key);
        if (!t) { map.set(key, k); next.push(k); continue; }
        t.value += k.value; t.n += k.n; t.magnet = t.magnet || k.magnet; if (k.life > t.life) t.life = k.life;
        k.dead = true;
      }
      list = next;
    }
    for (let i = 0; i < list.length; i++) { const k = list[i]; if (k.n > 1) k.r = Math.min(13, 6 + Math.log(k.n) * 2); }
  }
  function update(dt) {
    const W = NR.world.get(), p = W.player, P = W.pickups;
    if (!p || p.dead) return;
    const range = NR.stats.get(p, 'pickupRange');
    let nxp = 0;
    for (let i = 0; i < P.length; i++) {
      const k = P[i];
      if (k.dead) continue;
      k.px = k.x; k.py = k.y; k.age += dt; k.life -= dt; k.bob += dt;
      if (k.life <= 0 && !k.magnet) { k.dead = true; continue; }
      if (k.type === 'xp_shard') nxp++;
      const dx = p.x - k.x, dy = p.y - k.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (k.magnet || d < range) { const s = (k.magnet ? 900 : 420) * dt; k.x += dx / d * Math.min(s, d); k.y += dy / d * Math.min(s, d); }
      if (d < k.r + p.r + 4) collect(k, p);
    }
    if (nxp > MERGE_OVER) mergeXp(P);
  }
  NR.pickups = { init, reset, spawn, update, collectAll, openChest, mergeXp, drops: DROPS };
})();
