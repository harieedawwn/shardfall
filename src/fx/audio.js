// Owner: FX
// WebAudio only. Unlocked on the first user input; every sound is synthesized (oscillators + filtered noise), with pitch
// variation and per-sound rate limits so stacks never get harsh. Buses: sfx and music -> master -> compressor -> out.
// Procedural music loop per zone (bass, arpeggio, drums, 110-128 BPM) plus a boss variant. Silent while the tab is hidden.
// Everything no-ops safely when AudioContext does not exist (Node, old browsers, blocked audio).
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  const MAX_VOICES = 26, LOOKAHEAD = 0.25;
  let AC = null, master = null, sfxBus = null, musicBus = null, duck = null, comp = null, noiseBuf = null;
  let inited = false, hidden = false, seed = 90210, ended = [], comboN = 0, comboT = -9;
  let track = null, want = null, duckLevel = 1;
  const lim = Object.create(null);

  function rnd() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function settings() { try { return NR.save.getSettings(); } catch (e) { return null; } }

  // ---------- low-level voices ----------
  function voiceOk(prio, t) {
    let j = 0;
    for (let i = 0; i < ended.length; i++) if (ended[i] > t) ended[j++] = ended[i];
    ended.length = j;
    return prio > 1 || ended.length < MAX_VOICES;
  }
  function osc(type, f0, f1, t0, dur, vol, dest, filt) {
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    if (filt) { const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(filt, t0); o.connect(f); f.connect(g); } else o.connect(g);
    g.connect(dest); o.start(t0); o.stop(t0 + dur + 0.03);
    ended.push(t0 + dur + 0.03);
  }
  function noise(t0, dur, vol, ftype, f0, f1, dest) {
    const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    s.buffer = noiseBuf; f.type = ftype; f.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t0, rnd() * 0.5); s.stop(t0 + dur + 0.03);
    ended.push(t0 + dur + 0.03);
  }

  // ---------- sfx recipes: fn(t, pitch, vol) ----------
  const SFX = {
    shoot_light: { min: 45, win: 4, v: 0.16, fn: function (t, p, v) { osc('square', 900 * p, 320 * p, t, 0.07, v, sfxBus); noise(t, 0.04, v * 0.4, 'highpass', 3500, 3500, sfxBus); } },
    shoot_heavy: { min: 70, win: 3, v: 0.26, fn: function (t, p, v) { osc('sawtooth', 340 * p, 70 * p, t, 0.17, v, sfxBus, 1800); osc('sine', 130 * p, 48, t, 0.16, v, sfxBus); noise(t, 0.12, v * 0.8, 'lowpass', 2600, 300, sfxBus); } },
    melee: { min: 90, win: 3, v: 0.22, fn: function (t, p, v) { noise(t, 0.13, v, 'bandpass', 700 * p, 2400 * p, sfxBus); osc('triangle', 320 * p, 150 * p, t, 0.1, v * 0.6, sfxBus); } },
    hit: { min: 35, win: 5, v: 0.16, fn: function (t, p, v) { noise(t, 0.035, v, 'highpass', 1600, 1600, sfxBus); osc('triangle', 430 * p, 190 * p, t, 0.055, v, sfxBus); } },
    hit_crit: { min: 60, win: 3, v: 0.22, fn: function (t, p, v) { osc('square', 700 * p, 1500 * p, t, 0.08, v * 0.8, sfxBus); noise(t, 0.06, v, 'highpass', 2200, 2200, sfxBus); osc('sine', 1400 * p, 900 * p, t + 0.05, 0.1, v * 0.6, sfxBus); } },
    kill: { min: 30, win: 4, v: 0.2, fn: function (t, p, v) { osc('square', 280 * p, 90 * p, t, 0.12, v * 0.7, sfxBus, 1500); noise(t, 0.1, v * 0.7, 'lowpass', 2200, 350, sfxBus); } },
    kill_big: { min: 90, win: 2, v: 0.32, prio: 2, fn: function (t, p, v) { osc('sine', 130 * p, 38, t, 0.32, v, sfxBus); noise(t, 0.26, v, 'lowpass', 1100, 140, sfxBus); osc('square', 220 * p, 70, t, 0.18, v * 0.5, sfxBus, 900); } },
    hurt: { min: 120, win: 2, v: 0.34, prio: 2, fn: function (t, p, v) { osc('sawtooth', 220 * p, 60, t, 0.26, v, sfxBus, 1400); noise(t, 0.16, v * 0.8, 'lowpass', 1800, 250, sfxBus); } },
    dodge: { min: 100, win: 2, v: 0.18, fn: function (t, p, v) { osc('sine', 900 * p, 1700 * p, t, 0.1, v, sfxBus); } },
    dash: { min: 90, win: 2, v: 0.22, fn: function (t, p, v) { noise(t, 0.17, v, 'bandpass', 400 * p, 2600 * p, sfxBus); osc('triangle', 200 * p, 520 * p, t, 0.12, v * 0.4, sfxBus); } },
    pickup_xp: { min: 28, win: 4, v: 0.13, fn: function (t, p, v) { const k = Math.pow(2, Math.min(comboN, 12) / 12); osc('triangle', 660 * p * k, 990 * p * k, t, 0.08, v, sfxBus); } },
    pickup_gold: { min: 40, win: 3, v: 0.15, fn: function (t, p, v) { osc('square', 1046 * p, 1046 * p, t, 0.06, v * 0.6, sfxBus); osc('square', 1568 * p, 1568 * p, t + 0.05, 0.1, v * 0.6, sfxBus); } },
    pickup_heart: { min: 80, win: 2, v: 0.2, fn: function (t, p, v) { osc('sine', 523 * p, 523 * p, t, 0.12, v, sfxBus); osc('sine', 659 * p, 659 * p, t + 0.07, 0.12, v, sfxBus); osc('sine', 784 * p, 784 * p, t + 0.14, 0.2, v, sfxBus); } },
    pickup_chest: { min: 150, win: 1, v: 0.25, prio: 2, fn: function (t, p, v) { const n = [392, 494, 587, 784]; for (let i = 0; i < n.length; i++) osc('square', n[i] * p, n[i] * p, t + i * 0.07, 0.16, v * 0.5, sfxBus, 2400); } },
    pickup_magnet: { min: 200, win: 1, v: 0.22, fn: function (t, p, v) { osc('sine', 300 * p, 1300 * p, t, 0.3, v, sfxBus); osc('triangle', 600 * p, 1800 * p, t, 0.25, v * 0.5, sfxBus); } },
    levelup: { min: 300, win: 1, v: 0.26, prio: 2, fn: function (t, p, v) { const n = [523, 659, 784, 1046, 1318]; for (let i = 0; i < n.length; i++) osc('square', n[i], n[i], t + i * 0.075, 0.18, v * 0.5, sfxBus, 3000); osc('sine', 1046, 2093, t + 0.35, 0.4, v * 0.5, sfxBus); } },
    explosion: { min: 80, win: 2, v: 0.34, fn: function (t, p, v) { noise(t, 0.45, v, 'lowpass', 1900, 120, sfxBus); osc('sine', 100 * p, 34, t, 0.4, v, sfxBus); } },
    explosion_big: { min: 150, win: 1, v: 0.42, prio: 2, fn: function (t, p, v) { noise(t, 0.8, v, 'lowpass', 2200, 90, sfxBus); osc('sine', 85 * p, 28, t, 0.7, v, sfxBus); osc('sawtooth', 160 * p, 40, t, 0.4, v * 0.4, sfxBus, 700); } },
    shock: { min: 70, win: 3, v: 0.18, fn: function (t, p, v) { noise(t, 0.12, v, 'highpass', 2500, 2500, sfxBus); osc('square', 1500 * p, 220 * p, t, 0.1, v * 0.6, sfxBus); } },
    status: { min: 90, win: 3, v: 0.1, fn: function (t, p, v) { noise(t, 0.09, v, 'bandpass', 1500 * p, 800, sfxBus); } },
    telegraph: { min: 140, win: 2, v: 0.09, fn: function (t, p, v) { osc('triangle', 280 * p, 340 * p, t, 0.06, v, sfxBus); } },
    boss_intro: { min: 400, win: 1, v: 0.34, prio: 2, fn: function (t, p, v) { osc('sawtooth', 70, 45, t, 0.9, v, sfxBus, 500); osc('sine', 55, 40, t, 1, v, sfxBus); noise(t, 0.7, v * 0.5, 'lowpass', 400, 80, sfxBus); } },
    boss_phase: { min: 400, win: 1, v: 0.36, prio: 2, fn: function (t, p, v) { osc('sawtooth', 120, 50, t, 0.6, v, sfxBus, 800); noise(t, 0.5, v, 'lowpass', 1500, 100, sfxBus); } },
    boss_death: { min: 800, win: 1, v: 0.45, prio: 2, fn: function (t, p, v) { noise(t, 1.4, v, 'lowpass', 2400, 70, sfxBus); osc('sawtooth', 220, 30, t, 1.2, v * 0.7, sfxBus, 900); osc('sine', 90, 26, t, 1.3, v, sfxBus); for (let i = 1; i < 5; i++) noise(t + i * 0.16, 0.3, v * 0.6, 'lowpass', 1800, 150, sfxBus); } },
    wave_start: { min: 500, win: 1, v: 0.2, fn: function (t, p, v) { osc('square', 440, 440, t, 0.1, v * 0.5, sfxBus, 2000); osc('square', 660, 660, t + 0.11, 0.16, v * 0.5, sfxBus, 2000); } },
    wave_clear: { min: 500, win: 1, v: 0.22, fn: function (t, p, v) { const n = [523, 659, 784, 1046]; for (let i = 0; i < n.length; i++) osc('triangle', n[i], n[i], t + i * 0.08, 0.2, v, sfxBus); } },
    player_death: { min: 800, win: 1, v: 0.4, prio: 2, fn: function (t, p, v) { osc('sawtooth', 420, 28, t, 1, v, sfxBus, 1200); noise(t, 0.8, v * 0.7, 'lowpass', 1600, 100, sfxBus); } },
    evolve: { min: 400, win: 1, v: 0.28, prio: 2, fn: function (t, p, v) { osc('sawtooth', 200, 1200, t, 0.5, v * 0.5, sfxBus, 3000); const n = [784, 1046, 1568]; for (let i = 0; i < n.length; i++) osc('square', n[i], n[i], t + 0.4 + i * 0.07, 0.2, v * 0.4, sfxBus, 3000); } },
    ui_click: { min: 30, win: 3, v: 0.16, fn: function (t, p, v) { osc('square', 1200 * p, 900 * p, t, 0.03, v * 0.6, sfxBus, 3000); } },
    ui_hover: { min: 40, win: 3, v: 0.08, fn: function (t, p, v) { osc('sine', 900 * p, 900 * p, t, 0.025, v, sfxBus); } },
    ui_confirm: { min: 80, win: 2, v: 0.2, fn: function (t, p, v) { osc('sine', 660, 660, t, 0.08, v, sfxBus); osc('sine', 990, 990, t + 0.06, 0.12, v, sfxBus); } },
    ui_back: { min: 80, win: 2, v: 0.16, fn: function (t, p, v) { osc('sine', 600, 400, t, 0.1, v, sfxBus); } },
    ui_buy: { min: 80, win: 2, v: 0.2, fn: function (t, p, v) { osc('square', 1046, 1046, t, 0.05, v * 0.5, sfxBus, 3000); osc('square', 1568, 1568, t + 0.05, 0.1, v * 0.5, sfxBus, 3000); noise(t + 0.02, 0.05, v * 0.4, 'highpass', 5000, 5000, sfxBus); } },
    ui_error: { min: 100, win: 2, v: 0.16, fn: function (t, p, v) { osc('square', 160, 120, t, 0.15, v * 0.6, sfxBus, 800); } },
    blip: { min: 60, win: 3, v: 0.12, fn: function (t, p, v) { osc('sine', 600 * p, 500 * p, t, 0.05, v, sfxBus); } }
  };
  const ALIAS = { shoot: 'shoot_light', 'shoot_light': 'shoot_light', explode: 'explosion', coin: 'pickup_gold', xp: 'pickup_xp', heal: 'pickup_heart', click: 'ui_click', hover: 'ui_hover', confirm: 'ui_confirm', back: 'ui_back', buy: 'ui_buy', error: 'ui_error', crit: 'hit_crit', hurt_player: 'hurt' };

  function sfx(name, o) {
    if (!AC || hidden) return false;
    const key = SFX[name] ? name : (ALIAS[name] || 'blip'), d = SFX[key], t = AC.currentTime;
    let L = lim[key]; if (!L) L = lim[key] = { last: -9, win: [] };
    if (t - L.last < d.min / 1000) return false;
    let j = 0; for (let i = 0; i < L.win.length; i++) if (t - L.win[i] < 0.25) L.win[j++] = L.win[i];
    L.win.length = j;
    if (L.win.length >= d.win || !voiceOk(d.prio || 0, t)) return false;
    L.last = t; L.win.push(t);
    const pv = ((o && o.pitch) || 1) * (1 + (rnd() - 0.5) * 0.12), vol = d.v * ((o && o.vol) || 1);
    try { d.fn(t + 0.002, pv, vol); } catch (e) { return false; }
    return true;
  }

  // ---------- music ----------
  const MIN = [0, 3, 7, 12], MAJ = [0, 4, 7, 12], DIM = [0, 3, 6, 12];
  // bass/arp: 16 steps, -1 = rest, otherwise semitone offset above the bar root (bass) or chord-tone index (arp)
  const TRACKS = {
    scrap: { bpm: 112, root: 33, chords: [[0, MIN], [8, MAJ], [3, MAJ], [10, MAJ]], bass: [0, -1, -1, 0, -1, -1, 12, -1, 0, -1, 7, -1, 0, -1, 12, -1], arp: [0, -1, 1, -1, 2, -1, 3, -1, 2, -1, 1, -1, 2, -1, 3, -1], kick: [0, 6, 8, 11], snare: [4, 12], hat: [2, 6, 10, 14], bw: 'sawtooth', aw: 'square', av: 0.5 },
    frost: { bpm: 118, root: 38, chords: [[0, MIN], [10, MAJ], [8, MAJ], [10, MAJ]], bass: [0, -1, 0, -1, 12, -1, 0, -1, 0, -1, 7, -1, 12, -1, 7, -1], arp: [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 3, 2, 1, 2], kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14, 15], bw: 'triangle', aw: 'triangle', av: 0.8 },
    void: { bpm: 124, root: 28, chords: [[0, MIN], [1, MAJ], [0, MIN], [11, DIM]], bass: [0, -1, 0, 0, -1, 12, -1, 0, 0, -1, 7, -1, 0, 0, 12, 13], arp: [0, -1, 2, 1, -1, 3, 2, -1, 0, -1, 2, 1, -1, 3, 1, 2], kick: [0, 3, 8, 10, 14], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], bw: 'sawtooth', aw: 'square', av: 0.45 },
    boss: { bpm: 128, root: 28, chords: [[0, MIN], [8, MAJ], [10, MAJ], [11, DIM]], bass: [0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0, 7, 7, 10, 11], arp: [0, 1, 2, 3, 2, 3, 2, 1, 0, 1, 2, 3, 3, 2, 1, 0], kick: [0, 2, 4, 6, 8, 10, 12, 14], snare: [4, 12, 15], hat: [1, 3, 5, 7, 9, 11, 13, 15], bw: 'sawtooth', aw: 'square', av: 0.5, heavy: true },
    menu: { bpm: 110, root: 33, chords: [[0, MIN], [8, MAJ], [3, MAJ], [10, MAJ]], bass: [0, -1, -1, -1, -1, -1, -1, -1, 7, -1, -1, -1, -1, -1, -1, -1], arp: [0, -1, 1, -1, 2, -1, 1, -1, 3, -1, 2, -1, 1, -1, 0, -1], kick: [], snare: [], hat: [4, 12], bw: 'triangle', aw: 'triangle', av: 0.7 }
  };
  const BOSS_SHIFT = { scrap: 0, frost: 5, void: 2 };

  function startTrack(id, boss) {
    const key = boss ? 'boss' : (TRACKS[id] ? id : 'scrap'), zid = boss ? id : key;
    if (track && track.key === key && track.zone === zid) return;
    const t = AC.currentTime;
    if (track) { track.g.gain.cancelScheduledValues(t); track.g.gain.setTargetAtTime(0, t, 0.15); track.dead = t + 1; oldTracks.push(track); }
    const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + 0.5); g.connect(duck);
    const def = TRACKS[key];
    track = { key: key, zone: zid, def: def, g: g, step: 0, next: t + 0.12, shift: boss ? (BOSS_SHIFT[id] || 0) : 0 };
  }
  const oldTracks = [];
  function stopTrack() {
    if (!track) return;
    const t = AC.currentTime; track.g.gain.setTargetAtTime(0, t, 0.2); track.dead = t + 1.2; oldTracks.push(track); track = null;
  }
  function music(id, boss) {
    want = (id === null || id === undefined || id === 'stop') ? null : { id: id, boss: !!boss };
    if (!AC || !master) return;
    if (!want) stopTrack(); else startTrack(want.id, want.boss);
  }
  function playStep(tr, t) {
    const d = tr.def, s = tr.step % 16, bar = ((tr.step / 16) | 0) % 4, ch = d.chords[bar], sd = 60 / d.bpm / 4, root = d.root + ch[0] + tr.shift;
    const bo = d.bass[s];
    if (bo >= 0) osc(d.bw, mtof(root + bo), mtof(root + bo), t, sd * (d.heavy ? 1.6 : 2.2), 0.2, tr.g, d.heavy ? 900 : 700);
    const ai = d.arp[s];
    if (ai >= 0) { const m = root + 24 + ch[1][ai]; osc(d.aw, mtof(m), mtof(m), t, sd * 1.9, 0.045 * d.av, tr.g, 2600); }
    if (d.kick.indexOf(s) >= 0) { osc('sine', 150, 42, t, 0.16, 0.5, tr.g); }
    if (d.snare.indexOf(s) >= 0) { noise(t, 0.13, 0.17, 'bandpass', 1900, 1200, tr.g); osc('triangle', 210, 140, t, 0.08, 0.14, tr.g); }
    if (d.hat.indexOf(s) >= 0) noise(t, 0.035, d.heavy ? 0.08 : 0.06, 'highpass', 7500, 7500, tr.g);
  }
  function musicUpdate() {
    if (!track) return;
    const t = AC.currentTime;
    if (track.next < t - 0.4) track.next = t + 0.05; // stalled (tab throttled): do not burst-schedule the backlog
    let n = 0;
    while (track.next < t + LOOKAHEAD && n++ < 16) { playStep(track, track.next); track.next += 60 / track.def.bpm / 4; track.step++; }
    for (let i = oldTracks.length - 1; i >= 0; i--) if (t > oldTracks[i].dead) { try { oldTracks[i].g.disconnect(); } catch (e) { /* already gone */ } oldTracks.splice(i, 1); }
  }

  // ---------- lifecycle ----------
  function applySettings() {
    if (!AC || !master) return;
    const s = settings(), t = AC.currentTime;
    if (!s) return;
    master.gain.setTargetAtTime(Math.max(0, Math.min(1, s.master === undefined ? 0.8 : s.master)), t, 0.03);
    musicBus.gain.setTargetAtTime(Math.max(0, Math.min(1, s.music === undefined ? 0.6 : s.music)) * 0.55, t, 0.03);
    sfxBus.gain.setTargetAtTime(Math.max(0, Math.min(1, s.sfx === undefined ? 0.8 : s.sfx)), t, 0.03);
  }
  function unlock() {
    if (AC) { if (!hidden && AC.state === 'suspended' && AC.resume) try { AC.resume(); } catch (e) { /* ignore */ } return true; }
    const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctor) return false;
    try {
      AC = new Ctor();
      comp = AC.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 18; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
      master = AC.createGain(); sfxBus = AC.createGain(); musicBus = AC.createGain(); duck = AC.createGain();
      duck.connect(musicBus); musicBus.connect(master); sfxBus.connect(master); master.connect(comp); comp.connect(AC.destination);
      const len = Math.max(1, Math.floor(AC.sampleRate)), buf = AC.createBuffer(1, len, AC.sampleRate), data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = rnd() * 2 - 1;
      noiseBuf = buf;
      if (AC.resume) AC.resume();
      applySettings();
      if (want) music(want.id, want.boss);
      return true;
    } catch (e) { AC = null; master = null; return false; }
  }
  function setHidden(h) {
    hidden = h;
    if (!AC) return;
    try { if (h) { if (AC.suspend) AC.suspend(); } else if (AC.resume) AC.resume(); } catch (e) { /* ignore */ }
  }
  function setDuck(k) {
    duckLevel = k;
    if (AC && duck) duck.gain.setTargetAtTime(k, AC.currentTime, 0.15);
  }
  function update(dt) {
    if (typeof document !== 'undefined' && document && typeof document.hidden === 'boolean' && document.hidden !== hidden) setHidden(document.hidden);
    if (!AC || hidden || !master) return;
    musicUpdate();
  }

  function pickupSfx(type) {
    const now = AC ? AC.currentTime : 0;
    if (type === 'xp_shard') { comboN = now - comboT < 0.45 ? comboN + 1 : 0; comboT = now; sfx('pickup_xp'); }
    else if (type === 'gold') sfx('pickup_gold');
    else if (type === 'heart') sfx('pickup_heart');
    else if (type === 'chest') sfx('pickup_chest');
    else if (type === 'magnet' || type === 'nova_bomb') sfx('pickup_magnet');
    else sfx('pickup_gold');
  }
  function init() {
    if (inited) return;
    inited = true;
    const E = NR.events;
    E.on('weapon:fire', function (e) {
      const k = e.kind;
      if (k === 'aura' || k === 'orbit') return;
      if (k === 'melee') { sfx('melee'); return; }
      const d = NR.data.weapons && NR.data.weapons[e.weaponId];
      sfx(d && d.sfx ? d.sfx : 'shoot_light');
    });
    E.on('damage:dealt', function (e) { sfx(e.crit ? 'hit_crit' : 'hit'); });
    E.on('enemy:death', function (e) { if (e.isBoss) return; sfx(e.elite || (e.enemy && e.enemy.r >= 18) ? 'kill_big' : 'kill'); });
    E.on('player:hurt', function (e) { sfx(e.dodged ? 'dodge' : 'hurt'); });
    E.on('player:dash', function () { sfx('dash'); });
    E.on('player:death', function () { sfx('player_death'); music(null); });
    E.on('player:levelup', function () { sfx('levelup'); });
    E.on('pickup:collect', function (e) { pickupSfx(e.type); });
    E.on('area:explode', function (e) { sfx(e.r >= 200 ? 'explosion_big' : 'explosion'); });
    E.on('chain:arc', function () { sfx('shock'); });
    E.on('status:apply', function () { sfx('status'); });
    E.on('enemy:attack', function () { sfx('telegraph'); });
    E.on('weapon:evolve', function () { sfx('evolve'); });
    E.on('boss:phase', function (e) { sfx(e.phase > 0 ? 'boss_phase' : 'boss_intro'); });
    E.on('boss:death', function () { sfx('boss_death'); });
    E.on('wave:start', function (e) { music(e.zone, e.isBoss); sfx(e.isBoss ? 'boss_intro' : 'wave_start'); });
    E.on('wave:clear', function () { sfx('wave_clear'); });
    E.on('run:start', function () { music('scrap'); setDuck(1); });
    E.on('run:end', function () { music(null); });
    E.on('state:change', function (e) {
      if (e.to === 'menu') music('menu');
      setDuck(e.to === 'wave' || e.to === 'clear' || e.to === 'menu' ? 1 : 0.4);
    });
    E.on('settings:change', function () { applySettings(); });
    if (typeof document !== 'undefined' && document && document.addEventListener) {
      document.addEventListener('visibilitychange', function () { setHidden(!!document.hidden); });
    }
  }
  NR.fx = NR.fx || {};
  NR.fx.audio = { init: init, unlock: unlock, sfx: sfx, music: music, update: update, applySettings: applySettings, ready: function () { return !!AC; }, tracks: Object.keys(TRACKS) };
})();
