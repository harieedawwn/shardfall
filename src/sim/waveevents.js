// Owner: Horde. Mid-wave events: Treasure Runner, Cursed Shrine, Shard Storm (data: src/data/events.js).
// At most one event per normal wave (never on boss waves), from wave 2, ~50%. State lives in W.event for HUD/fx:
//   { id, x, y, r, t (s left), dur, state, progress (0-1), hold }.  Emits event:start / event:end through NR.events.
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  const startP = { id: '', x: 0, y: 0, duration: 0, wave: 0 };
  const endP = { id: '', success: false, x: 0, y: 0, reason: '' };
  const atkP = { enemy: null, kind: 'blast', time: 0, x: 0, y: 0, r: 0 };
  const TAU = Math.PI * 2, MQ = 12;
  const mq = [];
  for (let i = 0; i < MQ; i++) mq.push({ on: false, x: 0, y: 0, t: 0, r: 0, g: { id: 0, kind: 'enemy', x: 0, y: 0, px: 0, py: 0, r: 10, dead: false, age: 0, defId: 'storm', shape: 'circle', color: '#7FD3F0', rot: 0, sx: 1, sy: 1, flash: 0, isBoss: false, flags: { telegraph: true } } });
  let pend = null, inited = false, token = 0;

  function W() { return NR.world.get(); }
  function D(id) { return NR.data.waveEvents[id]; }
  function reset() { pend = null; token = 0; for (let i = 0; i < MQ; i++) mq[i].on = false; const w = NR.world.get(); if (w) w.event = null; }
  function init() {
    if (inited) return;
    inited = true;
    NR.events.on('wave:clear', function () { pend = null; if (W().event) finish(false, 'wave'); });
    NR.events.on('player:death', function () { pend = null; if (W().event) finish(false, 'death'); });
    NR.events.on('enemy:death', function (e) {
      const w = W(), ev = w.event;
      if (ev && ev.id === 'treasure_runner' && e.enemy && e.enemy.id === ev.eid) finish(true, 'killed', e.x, e.y);
    });
  }

  // decide at wave start: maybe an event, at 20-50% of the wave
  function start(n) {
    const w = W(), R = NR.data.waveEventRules;
    pend = null; w.event = null;
    const rt = w.mod && NR.data.routes[w.mod], force = rt && rt.event === 'force';
    if (!w.player || n < R.firstWave || NR.director.waveInfo(n).isBoss || (rt && rt.event === 'none')) return; // Calm: no event, Omen: always
    if (!force && !NR.rng.chance(R.chance)) return;
    const ids = Object.keys(NR.data.waveEvents), id = ids[NR.rng.int(0, ids.length - 1)];
    pend = { id: id, at: w.waveDur * NR.rng.range(R.startFrom, R.startTo) };
  }

  function spot(p, dmin, dmax, margin) {
    const A = NR.config.ARENA, U = NR.util;
    for (let t = 0; t < 14; t++) {
      const a = NR.rng.range(0, TAU), d = NR.rng.range(dmin, dmax), x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
      if (x > margin && x < A.w - margin && y > margin && y < A.h - margin) return { x: x, y: y };
    }
    return { x: U.clamp(A.w - p.x, margin, A.w - margin), y: U.clamp(A.h - p.y, margin, A.h - margin) };
  }
  function begin(id) {
    const w = W(), p = w.player, d = D(id), n = w.wave;
    let pt;
    const ev = { id: id, x: 0, y: 0, r: 0, t: d.dur, dur: d.dur, state: 'active', progress: 0, hold: 0, eid: 0, ids: null, fx: 0, spawnT: 0.6 };
    if (id === 'treasure_runner') {
      pt = spot(p, 520, 700, 120); ev.x = pt.x; ev.y = pt.y;
      const e = NR.enemies.spawn('treasure_runner', pt.x, pt.y, {});
      if (!e) return;
      ev.eid = e.id; ev.state = 'chase';
    } else if (id === 'cursed_shrine') {
      pt = spot(p, 380, 620, 200); ev.x = pt.x; ev.y = pt.y; ev.r = d.r; ev.state = 'idle';
    } else {
      pt = { x: p.x, y: p.y }; ev.x = p.x; ev.y = p.y; ev.state = 'storm';
    }
    w.event = ev;
    startP.id = id; startP.x = ev.x; startP.y = ev.y; startP.duration = d.dur; startP.wave = n;
    NR.events.emit('event:start', startP);
  }
  function finish(success, reason, x, y) {
    const w = W(), ev = w.event;
    if (!ev) return;
    w.event = null;
    const px = x === undefined ? ev.x : x, py = y === undefined ? ev.y : y;
    if (ev.id === 'treasure_runner') {
      const E = w.enemies;
      if (success) reward(ev, px, py); else for (let i = 0; i < E.length; i++) if (E[i].id === ev.eid) E[i].dead = true; // it got away
    } else if (ev.id === 'cursed_shrine' && success) reward(ev, ev.x, ev.y);
    if (success) w.stats.eventsWon++;
    endP.id = ev.id; endP.success = success; endP.x = px; endP.y = py; endP.reason = reason || '';
    NR.events.emit('event:end', endP);
  }
  function reward(ev, x, y) {
    const w = W(), p = w.player, n = w.wave;
    if (ev.id === 'treasure_runner') {
      const gm = NR.stats.get(p, 'goldGain'), total = Math.round((26 + 7 * n) * gm * w.scale.gold);
      for (let i = 0; i < 6; i++) { const a = i * TAU / 6; NR.pickups.spawn('gold', x + Math.cos(a) * 26, y + Math.sin(a) * 26, Math.max(1, Math.round(total / 6))); }
      NR.pickups.spawn('heart', x, y + 30, Math.max(10, Math.round(p.maxHp * 0.15)));
    } else if (ev.id === 'cursed_shrine') {
      NR.pickups.spawn('chest', x, y, 1); // value 1 = at least a rare item
      NR.pickups.spawn('heart', x + 34, y + 12, Math.max(10, Math.round(p.maxHp * 0.15)));
    }
  }

  // ---- shrine: elite pack
  function summonPack(ev) {
    const w = W(), n = w.wave, pool = ['grunt', 'brute', 'spitter', 'splitter', 'shielder', 'lunger'], ids = [];
    const nel = n >= 9 ? 3 : 2, nesc = 3 + (n >= 6 ? 2 : 0);
    for (let i = 0; i < nel + nesc; i++) {
      const a = i * TAU / (nel + nesc) + NR.rng.range(-0.2, 0.2), id = i < nel ? pool[NR.rng.int(0, pool.length - 1)] : (i % 2 ? 'grunt' : 'swarmer');
      const af = [], cnt = i < nel ? ((w.danger >= 3 || n >= 11) ? 2 : 1) : 0, AF = Object.keys(NR.data.affixes);
      while (af.length < cnt) { const x = AF[NR.rng.int(0, AF.length - 1)]; if (af.indexOf(x) < 0) af.push(x); }
      const e = NR.enemies.spawn(id, ev.x + Math.cos(a) * 190, ev.y + Math.sin(a) * 190, { affixes: af.length ? af : null, hpMult: i < nel ? 1.1 : 1 });
      if (e) { e.ai.ev = 1; if (i < nel) ids.push(e.id); }
    }
    ev.ids = ids; ev.state = 'fight'; ev.t = 0; ev.total = ids.length;
  }

  // ---- storm: telegraphed meteors
  function queueMeteor(x, y, r, t, col) {
    for (let i = 0; i < MQ; i++) {
      const q = mq[i];
      if (q.on) continue;
      q.on = true; q.x = x; q.y = y; q.t = t; q.r = r;
      const g = q.g; g.x = x; g.y = y; g.px = x; g.py = y; g.r = 12; g.color = col; g.dead = false;
      atkP.enemy = g; atkP.time = t; atkP.x = x; atkP.y = y; atkP.r = r;
      NR.events.emit('enemy:attack', atkP);
      return;
    }
  }
  function tickMeteors(dt) {
    const w = W(), p = w.player;
    for (let i = 0; i < MQ; i++) {
      const q = mq[i];
      if (!q.on || (q.t -= dt) > 0) continue;
      q.on = false;
      NR.combat.explode(q.x, q.y, q.r, 12 + 2.2 * w.wave, { team: 'enemy', element: 'void', knock: 160 });
      const n = 2 + (w.wave >= 8 ? 1 : 0), xv = (1.6 + 0.4 * w.wave) * w.scale.xp * (p ? NR.stats.get(p, 'xpGain') : 1);
      for (let k = 0; k < n; k++) { const a = NR.rng.range(0, TAU); NR.pickups.spawn('xp_shard', q.x + Math.cos(a) * 22, q.y + Math.sin(a) * 22, xv); }
    }
  }

  function update(dt) {
    const w = W(), p = w.player;
    if (pend && w.state === 'wave' && p && !p.dead) {
      if (w.waveDur - w.waveT >= pend.at && w.waveT > 8) { const id = pend.id; pend = null; begin(id); }
    }
    tickMeteors(dt);
    const ev = w.event;
    if (!ev || !p || p.dead) return;
    const d = D(ev.id);
    if (ev.id === 'treasure_runner') {
      ev.t -= dt; ev.progress = 1 - ev.t / ev.dur;
      let e = null; for (let i = 0; i < w.enemies.length; i++) if (w.enemies[i].id === ev.eid) { e = w.enemies[i]; break; }
      if (e && !e.dead) { ev.x = e.x; ev.y = e.y; }
      if (!e || e.dead) { if (ev.t > 0) finish(false, 'lost'); return; }
      if (ev.t <= 0) finish(false, 'timeout');
    } else if (ev.id === 'cursed_shrine') {
      if (ev.state === 'idle') {
        ev.t -= dt;
        const dx = p.x - ev.x, dy = p.y - ev.y, inside = dx * dx + dy * dy <= ev.r * ev.r;
        ev.hold = Math.max(0, Math.min(d.hold, ev.hold + (inside ? dt : -dt * 1.5)));
        ev.progress = ev.hold / d.hold;
        if (ev.hold >= d.hold) summonPack(ev);
        else if (ev.t <= 0) finish(false, 'timeout');
      } else {
        let alive = 0;
        for (let i = 0; i < w.enemies.length; i++) { const e = w.enemies[i]; if (!e.dead && ev.ids.indexOf(e.id) >= 0) alive++; }
        ev.progress = 1 - alive / Math.max(1, ev.total);
        if (alive === 0) finish(true, 'cleared');
      }
    } else if (ev.id === 'shard_storm') {
      ev.t -= dt; ev.progress = 1 - ev.t / ev.dur;
      ev.spawnT -= dt;
      if (ev.spawnT <= 0 && ev.t > 1.2) {
        ev.spawnT = NR.rng.range(0.38, 0.7);
        const A = NR.config.ARENA, U = NR.util, near = NR.rng.chance(0.4), a = NR.rng.range(0, TAU), dd = near ? NR.rng.range(0, 90) : NR.rng.range(120, 420);
        queueMeteor(U.clamp(p.x + Math.cos(a) * dd + (p.vx || 0) * 0.5, 60, A.w - 60), U.clamp(p.y + Math.sin(a) * dd + (p.vy || 0) * 0.5, 60, A.h - 60), 78, 1.1, d.color);
      }
      if (ev.t <= 0) finish(true, 'done');
    }
  }
  NR.waveEvents = { init, reset, start, update, begin, finish, pending: function () { return pend; }, current: function () { return W().event; } };
})();
