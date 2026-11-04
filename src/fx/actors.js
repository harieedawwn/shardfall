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

  // ---------- player designs ----------
  const CHARS = {
    // round scout in a hooded scarf with a glowing shard crest
    ranger: { body: function (g, R, color, v) {
      const T = A().T, lw = Math.max(2.6, R * 0.15);
      // scarf tail behind
      const tail = function (gg, cont) { if (!cont) gg.beginPath(); gg.moveTo(-R * 0.4, R * 0.1); gg.quadraticCurveTo(-R * 1.25, R * 0.0, -R * 1.45, R * 0.5); gg.lineTo(-R * 1.05, R * 0.55); gg.quadraticCurveTo(-R * 1.0, R * 0.35, -R * 0.35, R * 0.42); gg.closePath(); };
      body(g, tail, '#2F6B4F', v, lw * 0.8, R * 0.6);
      const path = function (gg, cont) { if (!cont) gg.beginPath(); gg.ellipse(0, 0, R * 0.9, R, 0, 0, TAU); };
      body(g, path, color, v, lw, R);
      // hood rim
      const hood = function (gg, cont) { if (!cont) gg.beginPath(); gg.moveTo(-R * 0.86, -R * 0.05); gg.quadraticCurveTo(-R * 0.9, -R * 1.05, R * 0.05, -R * 1.02); gg.quadraticCurveTo(R * 0.85, -R * 0.95, R * 0.88, -R * 0.1); gg.quadraticCurveTo(R * 0.55, -R * 0.62, R * 0.02, -R * 0.62); gg.quadraticCurveTo(-R * 0.55, -R * 0.6, -R * 0.86, -R * 0.05); gg.closePath(); };
      body(g, hood, '#2F6B4F', v, lw * 0.85, R);
      // scarf wrap
      const sc = function (gg, cont) { if (!cont) gg.beginPath(); gg.moveTo(-R * 0.82, R * 0.22); gg.quadraticCurveTo(0, R * 0.5, R * 0.82, R * 0.22); gg.lineTo(R * 0.74, R * 0.5); gg.quadraticCurveTo(0, R * 0.78, -R * 0.74, R * 0.5); gg.closePath(); };
      body(g, sc, '#3E8A63', v, lw * 0.8, R * 0.5);
      // crest shard
      const cr = function (gg, cont) { if (!cont) gg.beginPath(); gg.moveTo(R * 0.05, -R * 1.62); gg.lineTo(R * 0.26, -R * 1.1); gg.lineTo(R * 0.05, -R * 0.92); gg.lineTo(-R * 0.16, -R * 1.1); gg.closePath(); };
      body(g, cr, '#7FE3F5', v, lw * 0.7, R * 0.35);
      g.fillStyle = '#FFFFFF'; g.beginPath(); g.moveTo(R * 0.04, -R * 1.48); g.lineTo(R * 0.11, -R * 1.15); g.lineTo(R * 0.0, -R * 1.12); g.closePath(); g.fill();
    }, face: { x: 0.3, y: -0.2, s: 0.2, gap: 0.62 } }
  };

  // ---------- sprite cache ----------
  const st = { e: null, p: null };
  function enemyStore() { if (!st.e) st.e = A().store(); return st.e; }
  function playerStore() { if (!st.p) st.p = A().store(); return st.p; }
  // per defId: arrays indexed by variant, keyed by rounded radius; the store is wiped when the art scale changes
  function enemySprite(defId, r, color, variant) {
    const design = DESIGNS[defId];
    if (!design) return null;
    const S = enemyStore(), R = Math.round((r * ENEMY_VIS + ENEMY_PAD) * 2) / 2;
    let bucket = S.map[defId];
    if (!bucket) bucket = S.map[defId] = Object.create(null);
    let arr = bucket[R];
    if (!arr) arr = bucket[R] = [undefined, undefined, undefined, undefined];
    let sp = arr[variant];
    if (sp === undefined) {
      const ext = R * 1.75 + 4, feet = R * 0.92;
      sp = arr[variant] = A().bake(ext * 2, ext + feet + R * 0.5, ext, ext + feet, function (g) {
        shadowEllipse(g, R);
        g.translate(0, -feet);
        design(g, R, color, variant);
      });
      if (sp) sp.feet = feet;
    }
    return sp;
  }
  function playerSprite(charId, r, color, variant) {
    const ch = CHARS[charId];
    if (!ch) return null;
    const S = playerStore(), R = Math.round(r * PLAYER_VIS * 2) / 2, key = charId + R;
    let arr = S.map[key];
    if (!arr) arr = S.map[key] = [undefined, undefined, undefined, undefined];
    let sp = arr[variant];
    if (sp === undefined) {
      const ext = R * 1.8 + 4, feet = R * 0.95;
      sp = arr[variant] = A().bake(ext * 2, ext + feet + R * 0.5, ext, ext + feet, function (g) {
        shadowEllipse(g, R * 1.05);
        g.translate(0, -feet);
        ch.body(g, R, color, variant);
      });
      if (sp) { sp.feet = feet; sp.R = R; }
    }
    return sp;
  }
  function has(defId) { return !!DESIGNS[defId]; }
  function hasChar(id) { return !!CHARS[id]; }
  function face(id) { return CHARS[id] && CHARS[id].face; }

  // blit a feet-anchored sprite at world (x, y = body centre) with flip and squash, using the base transform m
  function draw(ctx, m, sp, x, y, flip, sx, sy) {
    if (!sp) return;
    const k = m.a, fy = y + sp.feet;
    ctx.setTransform(k * flip * sx, 0, 0, k * sy, m.e + x * k, m.f + fy * k);
    ctx.drawImage(sp.img, -sp.ax, -sp.ay, sp.w, sp.h);
  }

  NR.fx = NR.fx || {};
  NR.fx.actors = {
    enemySprite: enemySprite, playerSprite: playerSprite, has: has, hasChar: hasChar, face: face, draw: draw, eyes: eyes,
    V_STEP_A: V_STEP_A, V_STEP_B: V_STEP_B, V_FLASH: V_FLASH, V_FROZEN: V_FROZEN, PLAYER_VIS: PLAYER_VIS, ENEMY_VIS: ENEMY_VIS
  };
})();
