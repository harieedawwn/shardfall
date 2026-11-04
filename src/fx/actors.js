// Owner: FX
// Character and enemy sprites ("Flat++"): chunky cel-shaded bodies with ink outlines, faces with eyes, baked once per
// (type, size, variant, scale) through NR.fx.art and blitted with one setTransform + drawImage per entity.
// Bodies do not rotate with aim: they flip left/right; eyes and held weapons follow the aim. Sprites are anchored at
// the feet so squash/stretch and bobbing stay grounded. Variants: 0/1 walk frames, 2 hit flash, 3 frozen.
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  const TAU = Math.PI * 2;
  const V_STEP_A = 0, V_STEP_B = 1, V_FLASH = 2, V_FROZEN = 3;
  const FROZEN = '#BFE9F7', FLASH = '#FFFFFF';
  // visual radius vs hitbox: the player is drawn larger (forgiving), enemies only slightly
  const PLAYER_VIS = 1.45, ENEMY_VIS = 1.15, ENEMY_PAD = 2;

  function A() { return NR.fx.art; }
  function ink() { return A().T.ink; }

  // ---------- shared painters ----------
  function shadowEllipse(g, R) {
    g.fillStyle = 'rgba(11,10,18,0.42)';
    g.beginPath(); g.ellipse(0, 0, R * 0.95, R * 0.32, 0, 0, TAU); g.fill();
  }
  // a face looking right: two eyes with pupils pushed forward, optional angry brow
  function eyes(g, x, y, s, gap, o) {
    o = o || {};
    const T = A().T, lw = Math.max(1.4, s * 0.32);
    for (let i = -1; i <= 1; i += 2) {
      const ex = x + (i < 0 ? -gap * 0.42 : gap * 0.58), ey = y, rx = s * (i < 0 ? 0.88 : 1), ry = s * 1.12;
      g.beginPath(); g.ellipse(ex, ey, rx, ry, 0, 0, TAU); g.fillStyle = o.white || T.eye; g.fill();
      g.lineWidth = lw; g.strokeStyle = T.ink; g.stroke();
      if (!o.noPupil) { g.beginPath(); g.ellipse(ex + rx * 0.32, ey + ry * 0.1, rx * 0.5, ry * 0.55, 0, 0, TAU); g.fillStyle = T.pupil; g.fill();
        g.beginPath(); g.arc(ex + rx * 0.12, ey - ry * 0.25, Math.max(0.6, rx * 0.2), 0, TAU); g.fillStyle = '#FFFFFF'; g.fill(); }
    }
    if (o.angry) {
      g.lineWidth = lw * 1.3; g.strokeStyle = T.ink; g.beginPath();
      g.moveTo(x - gap * 0.42 - s, y - s * 1.5); g.lineTo(x - gap * 0.42 + s * 0.9, y - s * 0.95);
      g.moveTo(x + gap * 0.58 + s * 1.05, y - s * 1.55); g.lineTo(x + gap * 0.58 - s * 0.8, y - s * 0.95);
      g.stroke();
    }
  }
  function mode(variant, base) { return variant === V_FLASH ? FLASH : variant === V_FROZEN ? FROZEN : base; }
  function body(g, path, color, variant, lw, R) {
    const a = A();
    if (variant === V_FLASH || variant === V_FROZEN) a.flat(g, path, mode(variant, color), lw);
    else a.cel(g, path, color, lw, { r: R });
  }

  // ---------- enemy designs (paint around body centre (0,0), facing +x) ----------
  const DESIGNS = {
    // rusty scrap gremlin: round body, steel helmet with rivets, angry eyes, jagged grin, stubby legs
    grunt: function (g, R, color, v) {
      const T = A().T, step = v === V_STEP_B ? 1 : -1, lw = Math.max(2.4, R * 0.18);
      g.fillStyle = mode(v, '#2A2522');
      for (let i = -1; i <= 1; i += 2) { g.beginPath(); g.ellipse(i * R * 0.42 + step * i * R * 0.08, R * 0.88, R * 0.26, R * 0.2, 0, 0, TAU); g.fill(); g.lineWidth = lw * 0.7; g.strokeStyle = T.ink; g.stroke(); }
      const path = function (gg, cont) { if (!cont) gg.beginPath(); gg.ellipse(0, 0, R * 0.98, R * 0.92, 0, 0, TAU); };
      body(g, path, color, v, lw, R);
      // helmet
      const hp = function (gg, cont) { if (!cont) gg.beginPath(); gg.moveTo(-R * 0.92, -R * 0.18); gg.quadraticCurveTo(-R * 0.85, -R * 1.12, R * 0.05, -R * 1.08); gg.quadraticCurveTo(R * 0.9, -R * 1.02, R * 0.94, -R * 0.24); gg.lineTo(R * 0.4, -R * 0.42); gg.lineTo(-R * 0.4, -R * 0.38); gg.closePath(); };
      if (v === V_FLASH || v === V_FROZEN) A().flat(g, hp, mode(v, '#6E7680'), lw); else A().cel(g, hp, '#6E7680', lw, { r: R * 0.9, top: -R * 1.1, bot: -R * 0.2 });
      g.fillStyle = T.ink; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(-R * 0.5 + i * R * 0.42, -R * 0.68 - (i === 1 ? R * 0.1 : 0), R * 0.07, 0, TAU); g.fill(); }
      if (v !== V_FLASH) eyes(g, R * 0.28, -R * 0.1, R * 0.2, R * 0.62, { angry: true });
      // grin
      g.beginPath(); g.moveTo(R * 0.02, R * 0.36); g.lineTo(R * 0.7, R * 0.3); g.lineTo(R * 0.62, R * 0.52); g.lineTo(R * 0.08, R * 0.55); g.closePath();
      g.fillStyle = T.ink; g.fill();
      g.fillStyle = '#F6F0DF'; g.beginPath(); g.moveTo(R * 0.14, R * 0.36); g.lineTo(R * 0.24, R * 0.47); g.lineTo(R * 0.34, R * 0.35); g.lineTo(R * 0.46, R * 0.46); g.lineTo(R * 0.58, R * 0.33); g.closePath(); g.fill();
    },
    // tiny beetle: forward-pointing triangle shell, one big eye, six legs
    swarmer: function (g, R, color, v) {
      const T = A().T, step = v === V_STEP_B ? 1 : -1, lw = Math.max(1.8, R * 0.2);
      g.strokeStyle = T.ink; g.lineWidth = lw * 0.8;
      g.beginPath();
      for (let i = -1; i <= 1; i++) { const o = (i * step) * R * 0.18; g.moveTo(i * R * 0.45, R * 0.35); g.lineTo(i * R * 0.6 + o, R * 0.95); }
      g.stroke();
      const path = function (gg, cont) { if (!cont) gg.beginPath(); gg.moveTo(R * 1.15, R * 0.05); gg.quadraticCurveTo(R * 0.2, -R * 1.15, -R * 1.0, -R * 0.55); gg.quadraticCurveTo(-R * 1.18, R * 0.2, -R * 0.75, R * 0.62); gg.quadraticCurveTo(R * 0.2, R * 0.75, R * 1.15, R * 0.05); gg.closePath(); };
      body(g, path, color, v, lw, R);
      g.strokeStyle = T.ink; g.lineWidth = lw * 0.6; g.beginPath(); g.moveTo(-R * 0.75, -R * 0.4); g.quadraticCurveTo(-R * 0.1, -R * 0.15, R * 0.2, R * 0.55); g.stroke();
      g.beginPath(); g.moveTo(R * 0.7, -R * 0.35); g.quadraticCurveTo(R * 1.1, -R * 1.0, R * 1.35, -R * 0.95); g.stroke();
      if (v !== V_FLASH) {
        g.beginPath(); g.ellipse(R * 0.42, -R * 0.12, R * 0.34, R * 0.38, 0, 0, TAU); g.fillStyle = T.eye; g.fill(); g.lineWidth = lw * 0.7; g.strokeStyle = T.ink; g.stroke();
        g.beginPath(); g.arc(R * 0.55, -R * 0.08, R * 0.18, 0, TAU); g.fillStyle = T.pupil; g.fill();
      }
    },
    // spitter toad: squat diamond body, two bulging eyes on top, brass spit nozzle forward, puffy cheek sac
    spitter: function (g, R, color, v) {
      const T = A().T, step = v === V_STEP_B ? 1 : -1, lw = Math.max(2.2, R * 0.18);
      g.fillStyle = mode(v, A().shade(color, -0.25));
      for (let i = -1; i <= 1; i += 2) { g.beginPath(); g.ellipse(i * R * 0.55 + step * i * R * 0.06, R * 0.78, R * 0.34, R * 0.2, 0, 0, TAU); g.fill(); g.lineWidth = lw * 0.7; g.strokeStyle = T.ink; g.stroke(); }
      // nozzle
      const np = function (gg, cont) { if (!cont) gg.beginPath(); gg.rect(R * 0.55, R * 0.02, R * 0.72, R * 0.34); };
      if (v === V_FLASH || v === V_FROZEN) A().flat(g, np, mode(v, '#C9A24B'), lw * 0.8); else A().cel(g, np, '#C9A24B', lw * 0.8, { r: R * 0.4, top: 0, bot: R * 0.4, hi: false });
      g.fillStyle = T.ink; g.beginPath(); g.ellipse(R * 1.27, R * 0.19, R * 0.08, R * 0.16, 0, 0, TAU); g.fill();
      const path = function (gg, cont) { if (!cont) gg.beginPath(); gg.moveTo(R * 0.95, R * 0.1); gg.quadraticCurveTo(R * 0.7, -R * 0.75, 0, -R * 0.82); gg.quadraticCurveTo(-R * 0.85, -R * 0.75, -R * 1.02, R * 0.12); gg.quadraticCurveTo(-R * 0.75, R * 0.85, 0, R * 0.82); gg.quadraticCurveTo(R * 0.75, R * 0.8, R * 0.95, R * 0.1); gg.closePath(); };
      body(g, path, color, v, lw, R);
      // belly
      g.beginPath(); g.ellipse(R * 0.08, R * 0.4, R * 0.55, R * 0.3, 0, 0, TAU); g.fillStyle = mode(v, A().mix(color, '#F6F0DF', 0.45)); g.fill();
      // eye stalks
      for (let i = 0; i < 2; i++) {
        const ex = -R * 0.18 + i * R * 0.55, ey = -R * 0.78;
        g.beginPath(); g.arc(ex, ey, R * 0.3, 0, TAU); g.fillStyle = mode(v, color); g.fill(); g.lineWidth = lw * 0.8; g.strokeStyle = T.ink; g.stroke();
      }
      if (v !== V_FLASH) eyes(g, R * 0.02, -R * 0.8, R * 0.19, R * 0.55, {});
    }
  };

  // ---------- generic enemy (the other types): data shape, cel shading, menacing eyes and a mouth ----------
  function shapePath(shape, R) { return function (gg) { NR.fx.shapes.path(gg, shape, R); }; }
  function generic(shape) {
    return function (g, R, color, v) {
      const T = A().T, lw = Math.max(2.4, R * 0.16), path = shapePath(shape, R * 0.95);
      if (v === V_FLASH || v === V_FROZEN) { A().flat(g, path, mode(v, color), lw); }
      else {
        path(g); g.fillStyle = color; g.fill();
        g.save(); path(g); g.clip();
        g.fillStyle = A().shade(color, -0.3); g.beginPath(); g.arc(R * 0.35, R * 0.55, R * 1.05, 0, TAU); g.fill();
        g.fillStyle = color; g.beginPath(); g.arc(-R * 0.08, -R * 0.12, R * 0.95, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.32)'; g.beginPath(); g.ellipse(-R * 0.35, -R * 0.5, R * 0.3, R * 0.16, -0.5, 0, TAU); g.fill();
        g.restore();
        path(g); g.lineWidth = lw; g.strokeStyle = T.ink; g.stroke();
      }
      if (v === V_FLASH) return;
      // narrowed eyes: dark sockets with a hot pupil
      for (let i = 0; i < 2; i++) {
        const ex = R * (0.08 + i * 0.42), ey = -R * 0.12;
        g.fillStyle = T.ink; g.beginPath(); g.ellipse(ex, ey, R * 0.17, R * 0.13, 0, 0, TAU); g.fill();
        g.fillStyle = '#FFE08A'; g.beginPath(); g.ellipse(ex + R * 0.04, ey + R * 0.02, R * 0.08, R * 0.06, 0, 0, TAU); g.fill();
      }
      g.strokeStyle = T.ink; g.lineWidth = lw * 0.7; g.beginPath(); g.moveTo(-R * 0.08, -R * 0.36); g.lineTo(R * 0.24, -R * 0.24); g.moveTo(R * 0.72, -R * 0.38); g.lineTo(R * 0.44, -R * 0.26); g.stroke();
      g.beginPath(); g.moveTo(R * 0.1, R * 0.3); g.quadraticCurveTo(R * 0.35, R * 0.18, R * 0.62, R * 0.3); g.stroke();
    };
  }
  ['brute', 'bomber', 'lunger', 'sniper', 'shielder', 'summoner', 'splitter', 'medic', 'phantom'].forEach(function (id) {
    DESIGNS[id] = function (g, R, color, v) { const d = NR.data.enemies[id]; generic(d ? d.shape : 'circle')(g, R, color, v); };
  });
  // dread overlay: later zones make every enemy nastier (dark veins, back spikes, extra glowing eyes, fanged maw)
  function dread(g, R, lvl, v) {
    if (!lvl || v === V_FLASH) return;
    const T = A().T, lw = Math.max(2, R * 0.13), eye = lvl >= 2 ? '#FF2E4D' : '#FF6A3D';
    // spikes along the back
    const n = 2 + lvl * 2;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * 0.95 + (i / Math.max(1, n - 1)) * Math.PI * 0.65, bx = Math.cos(a) * R * 0.85, by = Math.sin(a) * R * 0.85, L = R * (0.35 + 0.15 * lvl);
      g.beginPath(); g.moveTo(bx + Math.cos(a + 1.4) * R * 0.12, by + Math.sin(a + 1.4) * R * 0.12); g.lineTo(bx + Math.cos(a) * L, by + Math.sin(a) * L); g.lineTo(bx + Math.cos(a - 1.4) * R * 0.12, by + Math.sin(a - 1.4) * R * 0.12); g.closePath();
      g.fillStyle = '#1C1626'; g.fill(); g.lineWidth = lw * 0.6; g.strokeStyle = T.ink; g.stroke();
    }
    // veins / cracks
    g.strokeStyle = lvl >= 2 ? 'rgba(255,46,77,0.55)' : 'rgba(30,22,40,0.6)'; g.lineWidth = lw * 0.45;
    g.beginPath(); g.moveTo(-R * 0.7, R * 0.1); g.lineTo(-R * 0.35, R * 0.25); g.lineTo(-R * 0.2, R * 0.55); g.moveTo(-R * 0.35, R * 0.25); g.lineTo(-R * 0.05, R * 0.1); g.stroke();
    // extra eyes
    const ex = lvl >= 2 ? [[-0.25, -0.5, 0.1], [0.55, -0.6, 0.08], [-0.45, -0.15, 0.07], [0.15, -0.65, 0.07]] : [[-0.25, -0.5, 0.09]];
    for (let i = 0; i < ex.length; i++) {
      g.fillStyle = T.ink; g.beginPath(); g.arc(R * ex[i][0], R * ex[i][1], R * ex[i][2] * 1.5, 0, TAU); g.fill();
      g.fillStyle = eye; g.beginPath(); g.arc(R * ex[i][0], R * ex[i][1], R * ex[i][2], 0, TAU); g.fill();
    }
    // fanged maw
    if (lvl >= 2) {
      g.fillStyle = '#120A14'; g.beginPath(); g.ellipse(R * 0.42, R * 0.4, R * 0.36, R * 0.18, 0, 0, TAU); g.fill();
      g.fillStyle = '#F6F0DF';
      for (let i = 0; i < 4; i++) { const tx = R * (0.14 + i * 0.18); g.beginPath(); g.moveTo(tx, R * 0.28); g.lineTo(tx + R * 0.06, R * 0.44); g.lineTo(tx + R * 0.12, R * 0.28); g.closePath(); g.fill(); }
    }
  }

  // ---------- player designs: hooded wanderers, face hidden in the hood's shadow (no cartoon eyes) ----------
  // tier 0..3 grows with power (level, evolved weapons, rare items): pauldrons, longer trimmed cape, bigger crest, shard halo
  function hooded(o) {
    return function (g, R, color, v, tier) {
      const T = A().T, lw = Math.max(2.6, R * 0.14), cloak = o.cloak, trim = tier >= 2 ? '#FFC23D' : o.trim;
      // cape behind (longer with tier)
      const cl = 1.05 + tier * 0.12;
      const cape = function (gg, cont) { if (!cont) gg.beginPath(); gg.moveTo(-R * 0.55, -R * 0.55); gg.quadraticCurveTo(-R * (1.15 + tier * 0.1), R * 0.1, -R * (1.2 + tier * 0.12), R * cl);
        gg.lineTo(-R * 0.6, R * (cl - 0.12)); gg.lineTo(-R * 0.25, R * cl); gg.lineTo(R * 0.2, R * 0.6); gg.closePath(); };
      body(g, cape, cloak, v, lw * 0.85, R);
      if (tier >= 2 && v !== V_FLASH) { g.strokeStyle = trim; g.lineWidth = lw * 0.5; g.beginPath(); g.moveTo(-R * (1.2 + tier * 0.12), R * cl); g.lineTo(-R * 0.6, R * (cl - 0.12)); g.lineTo(-R * 0.25, R * cl); g.stroke(); }
      // torso / robe
      const torso = function (gg, cont) { if (!cont) gg.beginPath(); gg.moveTo(-R * 0.62, -R * 0.2); gg.quadraticCurveTo(-R * 0.78, R * 0.75, -R * 0.55, R * 0.95); gg.lineTo(R * 0.6, R * 0.95);
        gg.quadraticCurveTo(R * 0.8, R * 0.7, R * 0.62, -R * 0.2); gg.closePath(); };
      body(g, torso, color, v, lw, R);
      // belt + accent
      if (v !== V_FLASH) { g.fillStyle = A().shade(cloak, -0.25); g.fillRect(-R * 0.66, R * 0.42, R * 1.32, R * 0.16); g.fillStyle = trim; g.fillRect(R * 0.05, R * 0.4, R * 0.18, R * 0.2); }
      // pauldrons from tier 1
      if (tier >= 1) for (let i = -1; i <= 1; i += 2) {
        const pd = function (gg, cont) { if (!cont) gg.beginPath(); gg.ellipse(i * R * 0.6, -R * 0.08, R * 0.3, R * 0.22, i * 0.4, 0, TAU); };
        body(g, pd, tier >= 3 ? '#2B2440' : '#5C5670', v, lw * 0.7, R * 0.4);
        if (v !== V_FLASH) { g.fillStyle = trim; g.beginPath(); g.arc(i * R * 0.6, -R * 0.1, R * 0.06, 0, TAU); g.fill(); }
      }
      // hood: tall, peak swept back, deep opening facing +x
      const hood = function (gg, cont) { if (!cont) gg.beginPath(); gg.moveTo(-R * 0.62, -R * 0.05); gg.quadraticCurveTo(-R * 0.95, -R * 0.9, -R * 0.55, -R * 1.45);
        gg.quadraticCurveTo(-R * 0.25, -R * 1.62, -R * 0.62, -R * 1.92); gg.quadraticCurveTo(R * 0.2, -R * 1.7, R * 0.58, -R * 1.05); gg.quadraticCurveTo(R * 0.82, -R * 0.55, R * 0.66, -R * 0.08); gg.closePath(); };
      body(g, hood, cloak, v, lw, R);
      // face opening in deep shadow, lit only along the jaw edge (moody, no eyes)
      const face = function (gg, cont) { if (!cont) gg.beginPath(); gg.moveTo(R * 0.02, -R * 1.18); gg.quadraticCurveTo(R * 0.62, -R * 1.08, R * 0.6, -R * 0.55); gg.quadraticCurveTo(R * 0.5, -R * 0.18, R * 0.1, -R * 0.2);
        gg.quadraticCurveTo(-R * 0.1, -R * 0.62, R * 0.02, -R * 1.18); gg.closePath(); };
      if (v === V_FLASH) A().flat(g, face, '#FFFFFF', 0);
      else {
        face(g); g.fillStyle = '#0E0B16'; g.fill();
        g.save(); face(g); g.clip();
        g.fillStyle = A().mix(o.skin, '#0E0B16', 0.55); g.beginPath(); g.ellipse(R * 0.36, -R * 0.3, R * 0.3, R * 0.16, -0.3, 0, TAU); g.fill();
        g.restore();
        g.strokeStyle = A().mix(o.rim, '#0E0B16', 0.2); g.lineWidth = lw * 0.45; g.beginPath(); g.moveTo(R * 0.55, -R * 0.62); g.quadraticCurveTo(R * 0.48, -R * 0.25, R * 0.18, -R * 0.22); g.stroke();
      }
      // scarf over the chin
      const sc = function (gg, cont) { if (!cont) gg.beginPath(); gg.moveTo(-R * 0.62, -R * 0.25); gg.quadraticCurveTo(0, -R * 0.02, R * 0.7, -R * 0.3); gg.lineTo(R * 0.66, R * 0.02); gg.quadraticCurveTo(0, R * 0.22, -R * 0.6, R * 0.04); gg.closePath(); };
      body(g, sc, o.scarf, v, lw * 0.8, R * 0.5);
      // crest shard on the hood (bigger + crowned with tier)
      const cs = 1 + tier * 0.22;
      const cr = function (gg, cont) { if (!cont) gg.beginPath(); gg.moveTo(-R * 0.5, -R * (1.9 + 0.35 * cs)); gg.lineTo(-R * (0.5 - 0.16 * cs), -R * 1.85); gg.lineTo(-R * 0.5, -R * 1.62); gg.lineTo(-R * (0.5 + 0.16 * cs), -R * 1.85); gg.closePath(); };
      body(g, cr, o.crest, v, lw * 0.6, R * 0.3);
      if (tier >= 3 && v !== V_FLASH) for (let i = -1; i <= 1; i += 2) { const c2 = function (gg, cont) { if (!cont) gg.beginPath(); gg.moveTo(-R * (0.5 + i * 0.34), -R * 2.05); gg.lineTo(-R * (0.5 + i * 0.26), -R * 1.82); gg.lineTo(-R * (0.5 + i * 0.4), -R * 1.78); gg.closePath(); }; body(g, c2, o.crest, v, lw * 0.5, R * 0.2); }
      if (o.extra) o.extra(g, R, v, tier, lw);
    };
  }
  const CHARS = {
    ranger: { body: hooded({ cloak: '#2E3A4F', scarf: '#B8452F', trim: '#6FD6F2', crest: '#7FE3F5', skin: '#C9A88F', rim: '#6FD6F2' }), crest: '#7FE3F5' },
    dasher: { body: hooded({ cloak: '#3A2430', scarf: '#E8C547', trim: '#FF7A2F', crest: '#FFD43B', skin: '#D9B08C', rim: '#FFD43B',
      extra: function (g, R, v, tier, lw) { const sh = function (gg, cont) { if (!cont) gg.beginPath(); gg.rect(-R * 1.0, -R * 1.25, R * 0.14, R * 1.7); }; g.save(); g.rotate(-0.5); body(g, sh, '#1F1A24', v, lw * 0.6, R * 0.3); g.restore(); } }), crest: '#FFD43B' },
    bulwark: { body: hooded({ cloak: '#3C3A44', scarf: '#8C4A3B', trim: '#FFC23D', crest: '#FF9A5C', skin: '#B08A72', rim: '#FF9A5C' }), crest: '#FF9A5C', scale: 1.08 },
    tinker: { body: hooded({ cloak: '#24403A', scarf: '#C9A24B', trim: '#8BD450', crest: '#8BD450', skin: '#C9A88F', rim: '#8BD450',
      extra: function (g, R, v, tier, lw) { if (v === V_FLASH) return; g.fillStyle = '#C9A24B'; g.strokeStyle = A().T.ink; g.lineWidth = lw * 0.5; for (let i = 0; i < 2; i++) { g.beginPath(); g.arc(-R * 0.05 + i * R * 0.32, -R * 1.22, R * 0.13, 0, TAU); g.fill(); g.stroke(); } } }), crest: '#8BD450' }
  };
  // power tier from what the player has gathered (purely cosmetic)
  function tierOf(p) {
    let evo = 0, rare = 0;
    const W = NR.data.weapons;
    for (let i = 0; i < p.weapons.length; i++) { const d = W[p.weapons[i].id]; if (d && d.evolved) evo++; }
    for (const id in p.items) { const d = NR.data.items[id]; if (d && (d.rarity === 'legendary' || d.rarity === 'epic')) rare += p.items[id]; }
    const score = p.level / 7 + evo * 1.2 + rare * 0.5;
    return score >= 4 ? 3 : score >= 2.6 ? 2 : score >= 1.4 ? 1 : 0;
  }

  // ---------- sprite cache ----------
  const st = { e: null, p: null };
  function enemyStore() { if (!st.e) st.e = A().store(); return st.e; }
  function playerStore() { if (!st.p) st.p = A().store(); return st.p; }
  // per defId: arrays indexed by variant, keyed by rounded radius; the store is wiped when the art scale changes
  function enemySprite(defId, r, color, variant, lvl) {
    const design = DESIGNS[defId];
    if (!design) return null;
    lvl = lvl | 0;
    const S = enemyStore(), R = Math.round((r * ENEMY_VIS + ENEMY_PAD) * 2) / 2, bk = lvl ? defId + lvl : defId;
    let bucket = S.map[bk];
    if (!bucket) bucket = S.map[bk] = Object.create(null);
    let arr = bucket[R];
    if (!arr) arr = bucket[R] = [undefined, undefined, undefined, undefined];
    let sp = arr[variant];
    if (sp === undefined) {
      const ext = R * 1.75 + 4, feet = R * 0.92;
      sp = arr[variant] = A().bake(ext * 2, ext + feet + R * 0.5, ext, ext + feet, function (g) {
        shadowEllipse(g, R);
        g.translate(0, -feet);
        if (lvl) { const dark = A().mix(color, '#1A1024', 0.18 * lvl); design(g, R, dark, variant); } else design(g, R, color, variant);
        dread(g, R, lvl, variant);
      });
      if (sp) sp.feet = feet;
    }
    return sp;
  }
  function playerSprite(charId, r, color, variant, tier) {
    const ch = CHARS[charId];
    if (!ch) return null;
    tier = tier | 0;
    const S = playerStore(), R = Math.round(r * PLAYER_VIS * (ch.scale || 1) * 2) / 2, key = charId + R + 't' + tier;
    let arr = S.map[key];
    if (!arr) arr = S.map[key] = [undefined, undefined, undefined, undefined];
    let sp = arr[variant];
    if (sp === undefined) {
      const ext = R * 2.6 + 4, feet = R * 0.95;
      sp = arr[variant] = A().bake(ext * 2, ext + feet + R * 0.5, ext, ext + feet, function (g) {
        shadowEllipse(g, R * 1.05);
        g.translate(0, -feet);
        ch.body(g, R, color, variant, tier);
      });
      if (sp) { sp.feet = feet; sp.R = R; }
    }
    return sp;
  }
  function has(defId) { return !!DESIGNS[defId]; }
  function hasChar(id) { return !!CHARS[id]; }
  function face(id) { return null; }
  function crest(id) { return CHARS[id] && CHARS[id].crest; }

  // blit a feet-anchored sprite at world (x, y = body centre) with flip and squash, using the base transform m
  function draw(ctx, m, sp, x, y, flip, sx, sy) {
    if (!sp) return;
    const k = m.a, fy = y + sp.feet;
    ctx.setTransform(k * flip * sx, 0, 0, k * sy, m.e + x * k, m.f + fy * k);
    ctx.drawImage(sp.img, -sp.ax, -sp.ay, sp.w, sp.h);
  }

  NR.fx = NR.fx || {};
  NR.fx.actors = {
    enemySprite: enemySprite, playerSprite: playerSprite, has: has, hasChar: hasChar, face: face, crest: crest, tierOf: tierOf, draw: draw, eyes: eyes,
    V_STEP_A: V_STEP_A, V_STEP_B: V_STEP_B, V_FLASH: V_FLASH, V_FROZEN: V_FROZEN, PLAYER_VIS: PLAYER_VIS, ENEMY_VIS: ENEMY_VIS
  };
})();
