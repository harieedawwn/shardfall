// Owner: Arsenal. Element reactions (data: src/data/reactions.js) and element set bonuses (3+ weapons of one element).
// check() is called by combat.hitEnemy for every non-DoT hit that does not kill; it looks at the statuses the target already carries.
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  const MAX_PER_TICK = 5;
  const reactP = { reaction: '', target: null, x: 0, y: 0, element: 'physical', r: 0 };
  const XO = { team: 'player', element: 'physical', weaponId: null, statusChance: 0, knock: 0, crit: false, weight: 0, spread: false, silent: true, noReact: true };
  const CO = { jumps: 6, range: 190, falloff: 0.85, weaponId: null, statusChance: 0, weight: 0, crit: false, first: false };
  const tmp = [];
  let inited = false, tickN = -1, perTick = 0;
  const ORDER = [];

  function W() { return NR.world.get(); }
  function wdef(id) { return NR.data.weapons[id]; }

  // ---- set bonuses
  function setCount(p, el) {
    if (!p || !p.weapons) return 0;
    let n = 0;
    for (let i = 0; i < p.weapons.length; i++) { const d = wdef(p.weapons[i].id); if (d && d.element === el) n++; }
    return n;
  }
  function setActive(p, el) { return setCount(p, el) >= (NR.data.setMin || 3); }
  // [{element,count,active}] for every element the player holds at least one weapon of (UI)
  function sets(p) {
    const out = [], els = Object.keys(NR.data.sets || {});
    for (let i = 0; i < els.length; i++) {
      const n = setCount(p, els[i]);
      if (n > 0) out.push({ element: els[i], count: n, active: n >= (NR.data.setMin || 3) });
    }
    return out;
  }

  // ---- reactions
  function has(e, key) {
    const s = e.status;
    if (!s) return false;
    switch (key) {
      case 'frozen': return !!(s.frozen && s.frozen.t > 0);
      case 'chill': return !!(s.chill && s.chill.t > 0 && s.chill.stacks > 0);
      case 'burn': return !!(s.burn && s.burn.t > 0);
      case 'poison': return !!(s.poison && s.poison.t > 0 && s.poison.stacks > 0);
      case 'void': return !!(s.void && s.void.t > 0);
    }
    return false;
  }
  function consume(e, key) {
    const s = e.status, o = key === 'frozen' ? s.frozen : s[key];
    if (!o) return;
    o.t = 0;
    if (key === 'chill') o.stacks = 0;
  }
  function pick(e, el) {
    for (let i = 0; i < ORDER.length; i++) {
      const d = NR.data.reactions[ORDER[i]], pr = d.pairs;
      for (let k = 0; k < pr.length; k++) if (pr[k][0] === el && has(e, pr[k][1])) return { id: ORDER[i], status: pr[k][1], d: d };
    }
    return null;
  }
  function size(d, e, hit) {
    const base = Math.max(hit * d.mult, e.maxHp * d.hpPct * (e.isBoss ? 0.25 : 1));
    return base;
  }
  function blast(x, y, r, dmg, el, id, knock, sc) {
    XO.element = el; XO.weaponId = 'reaction:' + id; XO.knock = knock || 0; XO.statusChance = sc || 0;
    NR.combat.explode(x, y, r, dmg, XO);
  }

  // returns the reaction id that fired ('' when none). hit = raw damage of the triggering hit.
  function check(e, el, hit, wid) {
    const st = e.status;
    if (!st || e.dead || !(hit > 0)) return '';
    if (typeof wid === 'string' && wid.charCodeAt(0) === 114 && wid.indexOf('reaction:') === 0) return ''; // reactions never chain into reactions
    const w = W();
    if (e.rxAt > w.time) return '';
    const m = pick(e, el);
    if (!m) return '';
    if (w.tick !== tickN) { tickN = w.tick; perTick = 0; }
    if (perTick >= MAX_PER_TICK) return '';
    perTick++;
    const d = m.d, id = m.id, p = w.player;
    e.rxAt = w.time + d.cd;
    const x = e.x, y = e.y;
    if (id === 'shatter') {
      consume(e, 'frozen');
      blast(x, y, d.r, size(d, e, hit), 'ice', id, d.knock, 0);
    } else if (id === 'toxic_blast') {
      consume(e, 'burn');
      blast(x, y, d.r, size(d, e, hit), 'poison', id, d.knock, 1);
    } else if (id === 'superconduct') {
      consume(e, 'chill');
      CO.weaponId = 'reaction:' + id; CO.jumps = d.jumps; CO.range = d.range;
      NR.combat.hitEnemy(e, size(d, e, hit), { weaponId: CO.weaponId, element: 'shock', noChain: true });
      if (!e.dead) NR.combat.chain(e, size(d, e, hit), CO);
    } else if (id === 'implosion') {
      if (m.status === 'void') consume(e, 'void');
      consume(e, 'burn');
      const n = NR.spatial.circle(x, y, d.r, tmp);
      for (let i = 0; i < n && i < 24; i++) { const o = tmp[i]; if (o !== e && !o.dead) NR.combat.pull(o, x, y, d.pull); }
      blast(x, y, d.core, size(d, e, hit), 'void', id, 0, 0);
    } else if (id === 'steam') {
      consume(e, 'burn'); consume(e, 'chill');
      if (w.areas.length < 150) {
        NR.combat.createArea({
          areaKind: 'circle', team: 'player', weaponId: 'reaction:' + id, x: x, y: y, r: d.r, dmg: size(d, e, hit) * 0.5, tick: 0.5, life: d.life,
          element: 'ice', statusChance: 1, color: d.color, shape: 'ring'
        });
      }
    }
    reactP.reaction = id; reactP.target = e; reactP.x = x; reactP.y = y; reactP.element = d.element; reactP.r = d.r || 90;
    NR.events.emit('status:react', reactP);
    void p;
    return id;
  }

  function init() {
    if (inited) return;
    inited = true;
    for (const k in NR.data.reactions) ORDER.push(k);
    // Fire set: a burning enemy that dies sets its neighbours alight
    NR.events.on('enemy:death', function (ev) {
      const en = ev.enemy, p = W().player;
      if (!en || !p || !en.status || !en.status.burn || !(en.status.burn.t > 0) || !setActive(p, 'fire')) return;
      const b = en.status.burn, n = NR.spatial.circle(en.x, en.y, 110, tmp);
      let k = 0;
      for (let i = 0; i < n && k < 3; i++) {
        const o = tmp[i];
        if (o === en || o.dead || (o.status && o.status.burn && o.status.burn.t > 0)) continue;
        NR.combat.applyStatus(o, 'burn', 1, b.dps / NR.combat.STATUS.burn.dot, b.src, 2); k++;
      }
    });
  }
  function reset() { tickN = -1; perTick = 0; }

  NR.reactions = { init, reset, check, setCount, setActive, sets };
})();
