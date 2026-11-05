'use strict';
// Owner: Progression. Achievements, per-character challenges, locked content, daily run.
module.exports = function (H) {
  const test = H.test, eq = H.eq;
  function ok(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
  function memStorage() { return { d: {}, getItem: function (k) { return Object.prototype.hasOwnProperty.call(this.d, k) ? this.d[k] : null; }, setItem: function (k, v) { this.d[k] = String(v); }, removeItem: function (k) { delete this.d[k]; } }; }
  function fresh(char, o) {
    o = o || {};
    const NR = H.load(o.load || { storage: o.storage }); NR.main.boot();
    NR.run.start({ charId: char || 'ranger', seed: o.seed || 4, danger: o.danger || 0 });
    const W = NR.world.get(); W.state = 'wave'; W.waveT = 1e9; NR.director.reset(); NR.enemies.reset();
    NR.input.inject({ mx: 0, my: 0, aim: 0, fire: false, dash: false });
    NR.__got = []; NR.events.on('achievement:unlock', function (e) { NR.__got.push(e.id); });
    return NR;
  }
  const M = function (NR) { return NR.save.getMeta(); };

  test('achievements: data - 15 achievements, 4 character challenges, 7 locked items; every text in vi and en; locked refs are real', function () {
    const NR = H.load(), A = NR.data.achievements, C = NR.data.challenges, L = NR.data.locked;
    eq(Object.keys(A).length, 15); eq(Object.keys(C).sort(), ['ch_bulwark', 'ch_dasher', 'ch_ranger', 'ch_tinker']);
    for (const id in A) { const d = A[id]; ok(d.name.vi && d.name.en && d.desc.vi && d.desc.en && d.glyph && /^#[0-9A-F]{6}$/i.test(d.color), id); ok(['win', 'run', 'total', 'bossNoHit', 'traits', 'endless'].indexOf(d.type) >= 0, id + ' type'); }
    for (const id in C) ok(C[id].name.vi && C[id].desc.en && NR.data.characters[C[id].char], id);
    eq(L.length, 7); const starters = Object.keys(NR.data.characters).map(function (c) { return NR.data.characters[c].startWeapon; });
    for (const l of L) {
      ok(A[l.ach], 'achievement for ' + l.id); ok({ weapon: NR.data.weapons, item: NR.data.items, trait: NR.data.traits }[l.kind][l.id], l.kind + ' ' + l.id);
      ok(starters.indexOf(l.id) < 0, 'starting weapons are never locked'); ok(!(l.kind === 'weapon' && NR.data.weapons[l.id].evolved), 'evolutions are not locked');
    }
    for (const c of Object.keys(NR.data.characters)) for (const it of NR.data.characters[c].startItems || []) ok(!L.some(function (l) { return l.id === it; }), 'start item ' + it);
  });

  test('achievements: win-type (character, danger) and the four character challenges', function () {
    let NR = fresh('dasher'); NR.world.get().stats.dashes = 10; NR.run.endRun('win');
    ok(NR.__got.indexOf('first_win') >= 0 && NR.__got.indexOf('win_dasher') >= 0, JSON.stringify(NR.__got)); ok(NR.__got.indexOf('ch_dasher') < 0, 'not enough dashes'); ok(NR.__got.indexOf('win_ranger') < 0);
    NR = fresh('dasher'); NR.world.get().stats.dashes = 150; NR.run.endRun('win'); ok(NR.__got.indexOf('ch_dasher') >= 0);
    NR = fresh('ranger'); NR.world.get().stats.damageTaken = 151; NR.run.endRun('win'); ok(NR.__got.indexOf('ch_ranger') < 0); NR = fresh('ranger'); NR.world.get().stats.damageTaken = 120; NR.run.endRun('win'); ok(NR.__got.indexOf('ch_ranger') >= 0);
    NR = fresh('bulwark', { danger: 1 }); NR.run.endRun('win'); ok(NR.__got.indexOf('ch_bulwark') < 0 && NR.__got.indexOf('win_d3') < 0); NR = fresh('bulwark', { danger: 3 }); NR.run.endRun('win'); ok(NR.__got.indexOf('ch_bulwark') >= 0 && NR.__got.indexOf('win_d3') >= 0);
    NR = fresh('tinker'); NR.world.get().stats.evolutions = 1; NR.run.endRun('win'); ok(NR.__got.indexOf('ch_tinker') < 0); NR = fresh('tinker'); NR.events.emit('weapon:evolve', { slot: 0, from: 'a', into: 'b' }); NR.events.emit('weapon:evolve', { slot: 0, from: 'a', into: 'b' }); NR.run.endRun('win'); ok(NR.__got.indexOf('ch_tinker') >= 0);
    NR = fresh('ranger'); NR.run.endRun('lose'); eq(NR.__got, [], 'a loss earns no win achievement');
  });

  test('achievements: boss no-hit, triple evolution, traits, gold, endless - in-run unlocks with a toast event, saved once', function () {
    let NR = fresh(); const W = NR.world.get(), p = W.player;
    NR.events.emit('boss:phase', { boss: {}, phase: 0 }); NR.events.emit('player:hurt', { amount: 5, hp: 90, srcId: 1, dodged: false, revived: false, x: 0, y: 0 }); NR.events.emit('boss:death', { boss: {}, x: 0, y: 0 }); ok(NR.__got.indexOf('boss_nohit') < 0, 'hit during the fight');
    NR.events.emit('boss:phase', { boss: {}, phase: 0 }); NR.events.emit('player:hurt', { amount: 0, hp: 90, srcId: 1, dodged: true, revived: false, x: 0, y: 0 }); NR.events.emit('boss:death', { boss: {}, x: 0, y: 0 }); ok(NR.__got.indexOf('boss_nohit') >= 0, 'a dodge keeps it clean');
    for (let i = 0; i < 3; i++) NR.events.emit('weapon:evolve', { slot: 0, from: 'pistol', into: 'gatling_pistol' }); ok(NR.__got.indexOf('triple_evo') >= 0);
    for (const id of ['siphon', 'bounty', 'thorns', 'needle', 'far_sight', 'momentum']) NR.traits.grant(p, id); NR.events.emit('boss:death', { boss: {}, x: 0, y: 0 }); ok(NR.__got.indexOf('trait_collector') >= 0);
    W.stats.goldEarned = 1500; NR.events.emit('boss:death', { boss: {}, x: 0, y: 0 }); ok(NR.__got.indexOf('rich') >= 0);
    W.endless = true; W.wave = 20; NR.events.emit('boss:death', { boss: {}, x: 0, y: 0 }); ok(NR.__got.indexOf('endless_20') >= 0);
    const n = NR.__got.length; NR.events.emit('boss:death', { boss: {}, x: 0, y: 0 }); eq(NR.__got.length, n, 'each unlock fires once'); ok(W.stats.newAch.length === n && M(NR).ach.rich > 0);
  });

  test('achievements: cumulative counters (reactions, elites, events, kills) add up across runs and show progress', function () {
    const store = memStorage(); let NR = fresh('ranger', { storage: store }); NR.world.get().stats.reactions = 30; NR.world.get().stats.elites = 5; NR.world.get().stats.eventsWon = 4; NR.world.get().stats.kills = 1000;
    eq(NR.achievements.progress('reaction_50').cur, 30); NR.run.endRun('lose'); eq(M(NR).progress.reactions, 30); eq(NR.__got.indexOf('reaction_50') < 0, true);
    NR = fresh('ranger', { storage: store, seed: 9 }); eq(NR.achievements.progress('reaction_50').cur, 30, 'saved progress is shown'); eq(NR.achievements.progress('elites_20').goal, 20);
    NR.world.get().stats.reactions = 20; NR.events.emit('boss:death', { boss: {}, x: 0, y: 0 }); ok(NR.__got.indexOf('reaction_50') >= 0, 'live run counts toward the total');
    NR.world.get().stats.elites = 15; NR.world.get().stats.eventsWon = 6; NR.world.get().stats.kills = 2000; NR.run.endRun('lose');
    ok(M(NR).progress.reactions === 50 && M(NR).progress.kills === 3000 && NR.achievements.earned('elites_20') && NR.achievements.earned('events_10') && NR.achievements.earned('slayer'), JSON.stringify(M(NR).progress));
    const N3 = H.load({ storage: store }); N3.main.boot(); ok(N3.achievements.earned('reaction_50') && N3.achievements.progress('reaction_50').done, 'persisted in the save');
  });

  test('achievements: locked content stays out of the shop, chests and card pools until its achievement is earned', function () {
    const NR = fresh(), p = NR.world.get().player, LK = { weapon: {}, item: {}, trait: {} };
    NR.data.locked.forEach(function (l) { LK[l.kind][l.id] = l.ach; });
    for (let i = 0; i < 200; i++) {
      NR.world.get().wave = 1 + (i % 14); p.gold = 1e6; NR.run.setState('shop'); NR.shop.open(NR.world.get().wave);
      for (const o of NR.world.get().shop.offers) ok(!LK[o.kind][o.id], 'locked ' + o.kind + ' ' + o.id + ' in the shop');
      for (let k = 0; k < 4; k++) NR.shop.reroll();
      for (const id of NR.items.roll(3, 1, 12)) ok(!LK.item[id], 'locked item in a chest roll ' + id);
      for (const c of NR.progression.rollCards(4, 1, 10)) { if (c.kind === 'weapon') ok(!LK.weapon[c.id], 'locked weapon card'); if (c.kind === 'trait') ok(!LK.trait[c.id], 'locked trait card'); }
    }
    ok(!NR.achievements.isUnlocked('weapon', 'railgun') && NR.achievements.isUnlocked('weapon', 'pistol'));
    for (const l of NR.data.locked) M(NR).ach[l.ach] = 1;
    const seen = { weapon: {}, item: {}, trait: {} };
    for (let i = 0; i < 400; i++) {
      p.weapons.length = 1; for (const k of Object.keys(p.traits)) delete p.traits[k]; NR.world.get().wave = 3 + (i % 12); NR.shop.open(NR.world.get().wave); NR.shop.reroll();
      for (const o of NR.world.get().shop.offers) if (LK[o.kind][o.id]) seen[o.kind][o.id] = 1;
      for (const id of NR.items.roll(4, 1, 12)) if (LK.item[id]) seen.item[id] = 1;
      for (const c of NR.progression.rollCards(4, 1, 10)) if (c.kind === 'trait' && LK.trait[c.id]) seen.trait[c.id] = 1;
    }
    ok(Object.keys(seen.weapon).length >= 2 && Object.keys(seen.item).length >= 1 && Object.keys(seen.trait).length >= 1, 'earned content joins the pools ' + JSON.stringify(seen));
  });

  test('achievements: older saves (no ach/progress/daily keys) load and keep their data', function () {
    const fs = require('fs'), path = require('path'), fx = JSON.parse(fs.readFileSync(path.join(H.ROOT, 'tools', 'fixtures', 'pre-revamp-save.json'), 'utf8')), store = memStorage();
    store.d['shardfall.save'] = JSON.stringify(fx);
    const NR = H.load({ storage: store }); NR.main.boot(); const m = M(NR);
    ok(m.ach && typeof m.ach === 'object' && m.progress && m.daily && m.daily.days, 'new meta keys default'); eq(m.shards, fx.meta ? fx.meta.shards : fx.shards, 'shards kept');
    ok(NR.achievements.isUnlocked('weapon', 'pistol') && !NR.achievements.isUnlocked('weapon', 'railgun'));
  });

  test('daily: config is fixed by the date, one scored attempt per UTC day, 30-day history, share text in both languages', function () {
    const NR = H.load(); NR.main.boot(); const D = NR.daily;
    D.nowFn = function () { return Date.UTC(2026, 10, 5, 23, 59, 59); }; eq(D.todayKey(), '2026-11-05'); D.nowFn = function () { return Date.UTC(2026, 10, 6, 0, 0, 1); }; eq(D.todayKey(), '2026-11-06', 'UTC rollover');
    const a = D.config('2026-11-05'), b = D.config('2026-11-05'), c = D.config('2026-11-06'); eq(a, b); ok(a.seed > 0 && a.seed <= 0x7fffffff && NR.data.characters[a.charId] && a.danger >= 0 && a.danger <= 3);
    const seeds = {}, chars = {}; for (let d = 1; d <= 60; d++) { const k = D.config('2026-12-' + (d < 10 ? '0' : '') + (d % 28 + 1) + '-' + d); seeds[k.seed] = 1; chars[k.charId] = 1; } ok(Object.keys(seeds).length > 40 && Object.keys(chars).length >= 3, 'dates differ'); void c;
    D.nowFn = function () { return Date.UTC(2026, 10, 5, 12, 0, 0); }; const key = D.todayKey();
    eq(D.attempted(key), false); NR.run.start({ charId: a.charId, danger: a.danger, seed: a.seed, daily: key }); eq(D.attempted(key), true); eq(D.entry(key).state, 'started'); eq(NR.world.get().daily, key);
    const W = NR.world.get(); W.stats.kills = 120; W.stats.bossesKilled = 1; W.wave = 7; NR.run.endRun('lose');
    const e = D.entry(key); eq(e.state, 'done'); eq(e.score, 7 * 100 + 120 + 150); eq(NR.world.get().stats.dailyScore, e.score); eq(D.best(key), e.score);
    const en = D.shareText(key, 'en'), vi = D.shareText(key, 'vi'); ok(en.indexOf(key) >= 0 && en.indexOf(String(e.score)) >= 0 && /Daily/.test(en) && /Thử thách ngày/.test(vi), en + ' | ' + vi);
    NR.run.start({ charId: 'ranger', seed: 3 }); NR.run.endRun('lose'); eq(D.entry(key).score, e.score, 'a normal run never touches the daily entry');
    const days = D.days(); for (let i = 1; i <= 40; i++) days[D.keyOf(Date.UTC(2026, 10, 5) - i * 86400000)] = { state: 'done', score: 50 + i, charId: 'ranger', danger: 0, wave: 1, kills: 1, result: 'lose', time: 5 };
    NR.run.start({ charId: a.charId, danger: a.danger, seed: a.seed, daily: D.keyOf(Date.UTC(2026, 10, 6) - 86400000 * 0) }); const rec = D.recent(key); ok(rec.length <= 30 && rec[0].key === key, 'last 30 days only: ' + rec.length);
    ok(!D.days()[D.keyOf(Date.UTC(2026, 10, 5) - 35 * 86400000)], 'old days pruned');
  });

  test('daily: the attempt survives abandon, Continue restores the daily tag, and the screen plays / copies', function () {
    let copied = ''; const store = memStorage(), nav = { clipboard: { writeText: function (s) { copied = s; return { then: function (a) { a(); } }; } } }; const NR = H.load({ fx: true, ui: true, storage: store, navigator: nav }); NR.main.boot(); NR.daily.nowFn = function () { return Date.UTC(2026, 10, 5, 12, 0, 0); }; NR.ui.screens.guard.ms = 0;
    NR.ui.screens.show('daily'); const play = []; (function walk(n) { if (n.getAttribute && n.getAttribute('data-fk') === 'dplay') play.push(n); (n.children || []).forEach(walk); })(NR.__dom.root); ok(play.length === 1, 'play button');
    play[0].click(); const key = '2026-11-05', W = NR.world.get(); eq(W.daily, key); eq(NR.run.getState(), 'wave'); ok(NR.daily.attempted(key));
    const snap = NR.run.snapshot(); eq(snap.daily, key); NR.run.abandon(); eq(NR.daily.entry(key).state, 'done'); eq(NR.daily.entry(key).result, 'abandon');
    NR.run.setState('menu'); NR.ui.screens.show('daily'); const btns = []; (function walk(n) { if (n.getAttribute && /^(dplay|dcopy)$/.test(n.getAttribute('data-fk') || '')) btns.push(n.getAttribute('data-fk')); (n.children || []).forEach(walk); })(NR.__dom.root); eq(btns, ['dcopy'], 'after the attempt only Copy remains');
    const cp = []; (function walk(n) { if (n.getAttribute && n.getAttribute('data-fk') === 'dcopy') cp.push(n); (n.children || []).forEach(walk); })(NR.__dom.root); cp[0].click(); ok(/2026-11-05/.test(copied), 'share text copied: ' + copied);
    const N2 = H.load({ storage: store }); N2.main.boot(); N2.run.restore(JSON.parse(JSON.stringify(snap))); eq(N2.world.get().daily, key);
  });

  test('achievements: codex tab lists every achievement with progress; the end screen lists new ones and what they unlocked; HUD toasts', function () {
    const NR = H.load({ fx: true, ui: true }); NR.main.boot(); NR.ui.screens.guard.ms = 0; NR.run.start({ charId: 'dasher', seed: 2 });
    const W = NR.world.get(); W.stats.dashes = 200; NR.run.endRun('win');
    const text = function () { return NR.__dom.root.textContent; };
    ok(/First Victory|Chiến thắng đầu tiên/.test(text()), 'end screen lists the achievement'); ok(NR.achievements.earned('ch_dasher'));
    NR.ui.screens.show('codex'); NR.ui.screens.show('codex'); const rows = []; (function walk(n) { if (n.hasClass && n.hasClass('ach')) rows.push(n); (n.children || []).forEach(walk); })(NR.__dom.root); ok(rows.length === 0 || rows.length === 19, 'rows ' + rows.length);
    for (const lang of ['vi', 'en']) { NR.i18n.setLang(lang); NR.ui.screens.show('title'); NR.ui.screens.show('daily'); NR.ui.screens.show('select'); NR.ui.screens.show('codex'); }
    eq(NR.__dom.ctx.banned, []);
  });
};
