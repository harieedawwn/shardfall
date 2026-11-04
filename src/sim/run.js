(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  const CLEAR_TIME = 1.5;
  const RESET_MODULES = ['weapons', 'projectiles', 'combat', 'reactions', 'enemies', 'bosses', 'director', 'items', 'progression', 'shop', 'pickups'];
  const stateP = { from: '', to: '' };
  const startP = { seed: 0, charId: '', danger: 0, endless: false };
  const endP = { result: '', stats: null };
  let clearT = 0, deathFlag = false, pausedFrom = null, inited = false, runs = 0;

  function W() { return NR.world.get(); }
  function call(mod, fn, a, b) { const m = NR[mod]; if (m && m[fn]) return m[fn](a, b); }

  function init() {
    if (inited) return;
    inited = true;
    const E = NR.events;
    E.on('wave:clear', function (e) { onWaveClear(e); });
    E.on('player:death', function () { deathFlag = true; });
    E.on('player:hurt', function (e) { if (!e.dodged) W().stats.damageTaken += e.amount; });
    E.on('player:dash', function () { W().stats.dashes++; });
    E.on('enemy:death', function () { W().stats.kills++; });
    E.on('boss:death', function () { W().stats.bossesKilled++; });
    E.on('status:react', function () { W().stats.reactions++; });
    E.on('damage:dealt', function (e) {
      const d = W().stats.damageByWeapon, id = e.weaponId || 'other';
      d[id] = (d[id] || 0) + e.amount;
    });
  }

  function setState(s) {
    const w = W(), from = w.state;
    if (from === s) return;
    w.prevState = from; w.state = s;
    stateP.from = from; stateP.to = s;
    NR.events.emit('state:change', stateP);
  }
  function getState() { return W().state; }

  function resetModules() {
    NR.world.reset();
    if (NR.player.reset) NR.player.reset();
    for (let i = 0; i < RESET_MODULES.length; i++) call(RESET_MODULES[i], 'reset');
  }
  function finishPlayer(p) {
    p.hp = p.maxHp; p.dash.charges = p.dash.max;
    p.gold = Math.max(0, Math.round(p.stats.startGold));
  }

  function begin(opts, snap) {
    const seed = opts.seed !== undefined ? opts.seed : NR.util.hash('run' + (++runs));
    const w = NR.world.create({ seed: seed, charId: opts.charId, danger: opts.danger || 0, endless: !!opts.endless });
    NR.rng.seed(seed);
    deathFlag = false; pausedFrom = null; clearT = 0;
    resetModules();
    const p = NR.player.create(opts.charId);
    call('meta', 'applyToRun', p);
    finishPlayer(p);
    return w;
  }

  function start(opts) {
    opts = opts || {};
    const charId = (NR.data.characters[opts.charId] ? opts.charId : 'ranger');
    const danger = NR.util.clamp(opts.danger | 0, 0, 5);
    const w = begin({ seed: opts.seed, charId: charId, danger: danger });
    const p = w.player, ch = NR.data.characters[charId];
    if (ch.startWeapon) call('weapons', 'add', p, ch.startWeapon);
    const si = ch.startItems || [];
    for (let i = 0; i < si.length; i++) call('items', 'grant', p, si[i], 'start');
    finishPlayer(p); p.gold = Math.max(p.gold, 0);
    startP.seed = w.seed; startP.charId = charId; startP.danger = danger; startP.endless = false;
    w.state = 'menu';
    NR.events.emit('run:start', startP);
    startWave(1);
    setState('wave');
  }

  function startWave(n) {
    const w = W();
    w.wave = n; w.zone = NR.director.zoneOf(n);
    w.scale = NR.stats.enemyScale(n, w.danger);
    NR.director.startWave(n);
  }

  function onWaveClear(e) {
    const w = W();
    if (w.state !== 'wave') return;
    clearT = CLEAR_TIME;
    setState('clear');
    NR.player.addGold(5 + 2 * w.wave);
    call('projectiles', 'clearHostile');
    call('enemies', 'dissolveAll');
  }

  function step(dt) {
    const w = W();
    if (w.state !== 'wave' && w.state !== 'clear') return;
    const intent = NR.input.read();
    const p = w.player;
    if (w.state === 'wave') NR.director.update(dt);
    if (p && !p.dead) NR.player.update(dt, intent);
    NR.enemies.update(dt); NR.bosses.update(dt);
    NR.spatial.rebuild(w);
    NR.weapons.update(dt);
    NR.projectiles.update(dt);
    NR.combat.update(dt);
    NR.pickups.update(dt);
    NR.items.update(dt);
    // bookkeeping
    w.time += dt; w.tick++;
    if (deathFlag) { deathFlag = false; NR.world.cleanup(); endRun('lose'); return; }
    if (w.state === 'clear') {
      clearT -= dt;
      if (clearT <= 0) afterClear();
    }
    NR.world.cleanup();
  }

  function afterClear() {
    if (NR.progression.pending() > 0) {
      setState('levelup');
      if (!NR.progression.begin()) onLevelUpsDone();
    } else onLevelUpsDone();
  }

  function onLevelUpsDone() {
    const w = W();
    if (w.state === 'end' || w.state === 'menu') return;
    if (w.wave >= NR.config.WAVES && !w.endless) { setState('victory'); return; }
    openShop();
  }
  function openShop() {
    const w = W();
    NR.shop.open(w.wave);
    NR.save.writeRun(snapshot());
    setState('shop');
  }
  function leaveShop() {
    const w = W();
    if (w.state !== 'shop') return;
    NR.save.clearRun(); // the snapshot is only valid while standing in the shop
    startWave(w.wave + 1);
    setState('wave');
  }
  function enterEndless() {
    const w = W();
    if (w.state !== 'victory') return;
    w.endless = true;
    openShop();
  }
  function togglePause() {
    const w = W();
    if (w.state === 'paused') {
      const to = pausedFrom || 'wave'; pausedFrom = null;
      setState(to);
      return;
    }
    if (w.state === 'wave' || w.state === 'clear' || w.state === 'levelup' || w.state === 'shop') {
      pausedFrom = w.state;
      setState('paused');
      w.prevState = pausedFrom;
    }
  }
  function abandon() {
    const s = W().state;
    if (s === 'menu' || s === 'end') return;
    endRun('abandon');
  }
  function endRun(result) {
    const w = W();
    if (w.state === 'menu' || w.state === 'end') return;
    const p = w.player, st = w.stats;
    st.time = w.time; st.wave = w.wave; st.level = p ? p.level : 1; st.result = result;
    st.shardsEarned = NR.meta && NR.meta.shardsFor ? NR.meta.shardsFor(result, st) : 0;
    NR.save.clearRun();
    pausedFrom = null;
    setState('end');
    endP.result = result; endP.stats = st;
    NR.events.emit('run:end', endP);
    NR.save.flush();
  }

  function snapshot() {
    const w = W(), p = w.player;
    return NR.util.clone({
      v: 1, seed: w.seed, rng: NR.rng.getState(), charId: p.charId, danger: w.danger, wave: w.wave, endless: w.endless,
      time: w.time,
      player: { hp: p.hp, gold: p.gold, xp: p.xp, level: p.level, weapons: p.weapons, items: p.items, upgrades: p.upgrades, revives: p.revives },
      shop: { offers: w.shop.offers, rerolls: w.shop.rerolls },
      stats: w.stats
    });
  }

  function continueRun() {
    const snap = NR.save.readRun();
    if (!snap || !NR.data.characters[snap.charId]) return false;
    restore(snap);
    return true;
  }
  function restore(snap) {
    snap = NR.util.clone(snap);
    const w = begin({ seed: snap.seed, charId: snap.charId, danger: snap.danger }, snap);
    const p = w.player, S = NR.stats;
    w.endless = !!snap.endless; w.wave = snap.wave; w.zone = NR.director.zoneOf(snap.wave);
    w.scale = S.enemyScale(snap.wave, w.danger); w.time = snap.time || 0;
    const ps = snap.player;
    p.level = ps.level; p.xp = ps.xp;
    p.weapons = ps.weapons;
    for (const id in ps.items) { for (let i = 0; i < ps.items[id]; i++) call('items', 'grant', p, id, 'restore'); }
    p.upgrades = ps.upgrades || [];
    for (let i = 0; i < p.upgrades.length; i++) {
      const u = p.upgrades[i], def = NR.data.upgrades[u.stat], v = def && def.rarities[u.rarity];
      if (v) S.addMod(p, 'upgrade:' + i, { stat: u.stat, add: v.add, pct: v.pct });
    }
    p.gold = ps.gold;
    p.hp = Math.min(ps.hp, p.maxHp);
    if (ps.revives !== undefined) p.revives = ps.revives;
    w.shop.offers = snap.shop.offers; w.shop.rerolls = snap.shop.rerolls;
    const keep = snap.stats; for (const k in keep) w.stats[k] = keep[k];
    NR.rng.setState(snap.rng);
    startP.seed = w.seed; startP.charId = p.charId; startP.danger = w.danger; startP.endless = w.endless;
    NR.events.emit('run:start', startP);
    NR.rng.setState(snap.rng);
    setState('shop');
  }

  NR.run = { init, start, continueRun, step, setState, getState, togglePause, abandon, endRun, enterEndless, leaveShop, onLevelUpsDone, snapshot, restore };
})();
