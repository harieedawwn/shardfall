// Owner: UI. Canvas HUD (HP + delayed damage, XP, wave/timer, gold, weapon slots, dash charges, boss bar, items, FPS).
// Drawn in screen space after NR.fx.render.draw (hud.js wraps render.draw once; if FX already calls hud.draw, it is not drawn twice).
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  NR.ui = NR.ui || {};
  const FONT = 'Bahnschrift, "Segoe UI", system-ui, sans-serif';
  const C = {
    ink: '#14121F', ink2: '#0B0A12', panel: '#2A1E3F', cream: '#F2EFE6', mute: '#8C86A0', hp: '#E86AA6', hpLag: '#F2EFE6', hpLow: '#E5484D',
    xp: '#7FD3F0', gold: '#FFD43B', boss: '#C95B73', dash: '#7FD3F0', good: '#8BD450', slot: '#3B2A58',
    steel: '#7E8B9B', darkMetal: '#353945', brightSteel: '#C4D1DE',
    brass: '#D8A038', darkBrass: '#8B6514', wood: '#8A5229', darkWood: '#5A3215',
    ruby: '#E86AA6', azure: '#7FD3F0', toxic: '#8BD450', void: '#A25CE0', flame: '#FF7A2F'
  };
  const RCOL = { common: '#A8A6B8', rare: '#5FA8D3', epic: '#A25CE0', legendary: '#FFD43B' };
  const clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };

  // ---------- shared flat shape painter (also used by screens.js for icons) ----------
  function poly(g, n, r, inner) {
    const pts = inner ? n * 2 : n;
    for (let i = 0; i < pts; i++) {
      const a = i / pts * Math.PI * 2 - Math.PI / 2, rr = inner && i % 2 ? r * 0.45 : r;
      if (i === 0) g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.closePath();
  }
  function shapePath(g, shape, r) {
    g.beginPath();
    switch (shape) {
      case 'square': g.rect(-r, -r, r * 2, r * 2); break;
      case 'tri': poly(g, 3, r * 1.15, false); break;
      case 'diamond': poly(g, 4, r * 1.2, false); break;
      case 'hex': poly(g, 6, r, false); break;
      case 'star': poly(g, 5, r * 1.2, true); break;
      case 'cross': g.rect(-r, -r / 3, r * 2, r * 2 / 3); g.rect(-r / 3, -r, r * 2 / 3, r * 2); break;
      case 'capsule': g.rect(-r, -r / 2, r * 2, r); break;
      case 'beam': g.rect(-r * 1.1, -r / 3, r * 2.2, r * 2 / 3); break;
      case 'ring': g.arc(0, 0, r, 0, Math.PI * 2, false); g.moveTo(r * 0.5, 0); g.arc(0, 0, r * 0.5, 0, Math.PI * 2, true); break;
      case 'arc': g.arc(0, 0, r * 1.1, -1.1, 1.1, false); g.arc(0, 0, r * 0.55, 1.1, -1.1, true); g.closePath(); break;
      default: g.arc(0, 0, r, 0, Math.PI * 2, false);
    }
  }
  // fill: solid color; o = { line, shadow, rot, ink, sil }
  function drawShape(g, shape, x, y, r, fill, o) {
    if (NR.data && NR.data.weapons && NR.data.weapons[shape]) {
      return drawWeaponIcon(g, shape, x, y, r, fill, o);
    }
    if (NR.data && NR.data.items && NR.data.items[shape]) {
      return drawItemIcon(g, shape, x, y, r, fill, o);
    }
    if (NR.data && NR.data.characters && NR.data.characters[shape]) {
      return drawCharacterIcon(g, shape, x, y, r, fill, o);
    }
    if (/^(chest|heart|gold|xp_shard|magnet|nova_bomb|shard)$/.test(shape)) {
      return drawPickupIcon(g, shape, x, y, r, fill, o);
    }
    if (NR.data && NR.data.upgrades && NR.data.upgrades[shape]) {
      return drawStatIcon(g, shape, x, y, r, fill, o);
    }
    o = o || {};
    const line = o.line === undefined ? Math.max(2, r * 0.18) : o.line, sh = o.shadow === undefined ? Math.max(1, r * 0.16) : o.shadow;
    const rot = o.rot || 0;
    g.save();
    g.translate(x, y); g.rotate(rot);
    if (sh > 0) { g.save(); g.translate(sh, sh); shapePath(g, shape, r); g.fillStyle = C.ink2; g.fill(); g.restore(); }
    shapePath(g, shape, r);
    g.fillStyle = fill; g.fill();
    g.lineWidth = line; g.lineJoin = 'round'; g.strokeStyle = o.ink || C.ink; g.stroke();
    g.restore();
  }

  function shade(c, amt) { return NR.util ? NR.util.shade(c, amt) : c; }

  // ---------- procedural realistic vector weapon illustrations ----------
  function renderWeapon(g, id, r, col, sil, lw) {
    const silCol = '#1D1530';
    function fPoly(pts, fill, stroke) {
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.closePath();
      if (fill) { g.fillStyle = sil ? silCol : fill; g.fill(); }
      if (stroke !== false && lw > 0) { g.lineWidth = lw; g.strokeStyle = C.ink; g.lineJoin = 'round'; g.stroke(); }
    }
    function fRect(rx, ry, rw, rh, fill, stroke) {
      if (fill) { g.fillStyle = sil ? silCol : fill; g.fillRect(rx, ry, rw, rh); }
      if (stroke !== false && lw > 0) { g.lineWidth = lw; g.strokeStyle = C.ink; g.lineJoin = 'round'; g.strokeRect(rx, ry, rw, rh); }
    }
    function fCircle(cx, cy, cr, fill, stroke) {
      g.beginPath(); g.arc(cx, cy, cr, 0, Math.PI * 2);
      if (fill) { g.fillStyle = sil ? silCol : fill; g.fill(); }
      if (stroke !== false && lw > 0) { g.lineWidth = lw; g.strokeStyle = C.ink; g.stroke(); }
    }
    function fLine(x1, y1, x2, y2, strokeColor, customW) {
      if (sil && strokeColor !== C.ink) return;
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2);
      g.lineWidth = customW || lw; g.strokeStyle = strokeColor || C.ink; g.lineCap = 'round'; g.stroke();
      g.lineCap = 'butt';
    }

    switch (id) {
      case 'pistol': {
        fPoly([[-r * 0.55, -r * 0.05], [-r * 0.2, -r * 0.05], [-r * 0.4, r * 0.85], [-r * 0.78, r * 0.75]], '#1F2822');
        fPoly([[-r * 0.5, 0], [-r * 0.25, 0], [-r * 0.4, r * 0.75], [-r * 0.68, r * 0.68]], '#3C4B40');
        fCircle(-r * 0.38, r * 0.25, r * 0.07, '#C9A24B');
        fCircle(-r * 0.52, r * 0.55, r * 0.07, '#C9A24B');
        fPoly([[-r * 0.18, 0], [r * 0.22, 0], [r * 0.22, r * 0.35], [-r * 0.05, r * 0.35]], '#1F2822');
        fLine(r * 0.05, 0, 0, r * 0.2, C.ink);
        fRect(-r * 0.75, -r * 0.52, r * 1.55, r * 0.48, col);
        fRect(-r * 0.75, -r * 0.52, r * 1.55, r * 0.12, shade(col, 0.25), false);
        fLine(-r * 0.6, -r * 0.42, -r * 0.6, -r * 0.15);
        fLine(-r * 0.48, -r * 0.42, -r * 0.48, -r * 0.15);
        fLine(-r * 0.36, -r * 0.42, -r * 0.36, -r * 0.15);
        fRect(r * 0.68, -r * 0.65, r * 0.1, r * 0.15, '#1F2822');
        fRect(r * 0.05, -r * 0.48, r * 0.3, r * 0.18, '#14121F');
        fRect(r * 0.8, -r * 0.44, r * 0.18, r * 0.32, '#1F2822');
        break;
      }
      case 'gatling_pistol': {
        fPoly([[-r * 0.55, -r * 0.05], [-r * 0.2, -r * 0.05], [-r * 0.4, r * 0.85], [-r * 0.78, r * 0.75]], '#1F2822');
        fCircle(-r * 0.05, r * 0.42, r * 0.42, '#3C4B40');
        fCircle(-r * 0.05, r * 0.42, r * 0.28, '#FFD43B');
        fCircle(-r * 0.05, r * 0.42, r * 0.12, '#14121F');
        fRect(-r * 0.7, -r * 0.45, r * 0.85, r * 0.45, col);
        fRect(r * 0.15, -r * 0.5, r * 0.9, r * 0.12, '#5A526E');
        fRect(r * 0.15, -r * 0.32, r * 0.9, r * 0.12, '#5A526E');
        fRect(r * 0.15, -r * 0.14, r * 0.9, r * 0.12, '#5A526E');
        fRect(r * 0.45, -r * 0.53, r * 0.12, r * 0.54, '#FFD43B');
        fRect(r * 0.9, -r * 0.53, r * 0.12, r * 0.54, '#FFD43B');
        fRect(-r * 0.2, -r * 0.42, r * 0.25, r * 0.18, '#14121F');
        break;
      }
      case 'ember_gun': {
        fPoly([[-r * 0.6, -r * 0.05], [-r * 0.2, -r * 0.05], [-r * 0.45, r * 0.85], [-r * 0.8, r * 0.75]], '#1B1229');
        fRect(-r * 0.75, -r * 0.48, r * 1.5, r * 0.46, '#2E3A32');
        fRect(-r * 0.3, -r * 0.38, r * 0.75, r * 0.26, '#FF7A2F');
        fRect(-r * 0.2, -r * 0.32, r * 0.55, r * 0.14, '#FFD43B');
        for (let i = 0; i < 4; i++) fRect(-r * 0.6 + i * r * 0.22, -r * 0.62, r * 0.12, r * 0.16, '#8C4A3B');
        fPoly([[r * 0.75, -r * 0.52], [r * 1.05, -r * 0.68], [r * 1.05, r * 0.12], [r * 0.75, -r * 0.04]], '#FF7A2F');
        fCircle(r * 1.15, -r * 0.25, r * 0.15, '#FFD43B');
        fCircle(r * 0.95, -r * 0.5, r * 0.08, '#FF7A2F');
        break;
      }
      case 'scattergun': {
        fPoly([[-r * 0.9, r * 0.4], [-r * 0.4, r * 0.1], [-r * 0.25, -r * 0.1], [-r * 0.6, -r * 0.2], [-r * 0.95, 0]], '#8C4A3B');
        fRect(-r * 0.3, -r * 0.35, r * 0.45, r * 0.42, '#5A526E');
        fRect(r * 0.15, -r * 0.38, r * 0.95, r * 0.2, col);
        fRect(r * 0.15, -r * 0.18, r * 0.95, r * 0.2, col);
        fLine(r * 0.15, -r * 0.18, r * 1.1, -r * 0.18, C.ink);
        fRect(r * 0.1, -r * 0.02, r * 0.65, r * 0.24, '#8C4A3B');
        for (let i = 0; i < 4; i++) fLine(r * 0.18 + i * r * 0.14, -r * 0.02, r * 0.18 + i * r * 0.14, r * 0.22, '#5A2E22');
        fCircle(r * 1.08, -r * 0.42, r * 0.06, '#C9A24B');
        break;
      }
      case 'shredder': {
        fPoly([[-r * 0.85, r * 0.35], [-r * 0.35, r * 0.05], [-r * 0.2, -r * 0.15], [-r * 0.55, -r * 0.25], [-r * 0.9, -r * 0.05]], '#3C4B40');
        fPoly([[-r * 0.1, -r * 0.05], [r * 0.2, -r * 0.05], [r * 0.1, r * 0.7], [-r * 0.2, r * 0.65]], '#E36414');
        fLine(-r * 0.15, r * 0.25, r * 0.15, r * 0.18, '#FFD43B', 2.5);
        fLine(-r * 0.18, r * 0.48, r * 0.12, r * 0.41, '#FFD43B', 2.5);
        fRect(-r * 0.25, -r * 0.45, r * 1.25, r * 0.48, col);
        fRect(r * 0.9, -r * 0.52, r * 0.25, r * 0.62, '#1F2822');
        fLine(r * 0.95, -r * 0.38, r * 1.1, -r * 0.38, '#E36414');
        fLine(r * 0.95, -r * 0.15, r * 1.1, -r * 0.15, '#E36414');
        fRect(r * 0.1, 0, r * 0.6, r * 0.25, '#1F2822');
        break;
      }
      case 'frost_fan': {
        fRect(-r * 0.6, -r * 0.25, r * 0.7, r * 0.5, '#5A526E');
        fRect(-r * 0.5, r * 0.15, r * 0.6, r * 0.3, '#CFEFFA');
        fPoly([[-r * 0.05, -r * 0.1], [r * 0.9, -r * 0.65], [r * 1.05, -r * 0.5], [r * 0.1, -r * 0.02]], '#7FD3F0');
        fPoly([[-r * 0.05, -r * 0.1], [r * 1.1, -r * 0.12], [r * 1.1, r * 0.12], [-r * 0.05, 0.1]], '#CFEFFA');
        fPoly([[-r * 0.05, 0.02], [r * 1.05, r * 0.5], [r * 0.9, r * 0.65], [-r * 0.05, 0.1]], '#7FD3F0');
        fCircle(-r * 0.2, 0, r * 0.16, '#EAF4FB');
        break;
      }
      case 'lancer': {
        fPoly([[-r * 0.85, r * 0.35], [-r * 0.4, r * 0.1], [-r * 0.25, -r * 0.15], [-r * 0.6, -r * 0.25]], '#1F2822');
        fRect(-r * 0.2, -r * 0.5, r * 0.5, r * 0.2, '#5A526E');
        fCircle(0, -r * 0.4, r * 0.09, '#7FD3F0');
        fRect(-r * 0.3, -r * 0.25, r * 1.45, r * 0.14, col);
        fRect(-r * 0.3, r * 0.05, r * 1.45, r * 0.14, col);
        fRect(r * 0.1, -r * 0.32, r * 0.15, r * 0.58, '#7FD3F0');
        fRect(r * 0.5, -r * 0.32, r * 0.15, r * 0.58, '#7FD3F0');
        fRect(r * 0.9, -r * 0.32, r * 0.15, r * 0.58, '#7FD3F0');
        fPoly([[r * 1.15, -r * 0.1], [r * 1.35, 0], [r * 1.15, r * 0.1]], '#CFEFFA');
        break;
      }
      case 'void_lance': {
        fLine(-r * 0.9, r * 0.9, r * 0.2, -r * 0.2, '#1B1229', lw * 2.5);
        fCircle(-r * 0.2, r * 0.2, r * 0.45, null, true);
        fPoly([[r * 0.1, -r * 0.1], [r * 0.95, -r * 0.95], [r * 0.7, -r * 0.3]], '#A25CE0');
        fPoly([[r * 0.1, -r * 0.1], [r * 0.95, -r * 0.95], [r * 0.3, -r * 0.7]], '#E86AA6');
        fCircle(r * 0.45, -r * 0.45, r * 0.15, '#F1E0FF');
        break;
      }
      case 'flamer': {
        fRect(-r * 0.7, -r * 0.2, r * 1.4, r * 0.28, '#3C4B40');
        fRect(-r * 0.4, r * 0.15, r * 0.9, r * 0.5, '#E5484D');
        fCircle(-r * 0.2, r * 0.4, r * 0.18, '#F2EFE6');
        fLine(-r * 0.2, r * 0.4, -r * 0.1, r * 0.3, '#14121F');
        fRect(r * 0.65, -r * 0.28, r * 0.22, r * 0.44, '#14121F');
        fPoly([[r * 0.85, -r * 0.18], [r * 1.25, -r * 0.28], [r * 1.05, 0]], '#FF7A2F');
        fPoly([[r * 0.95, -r * 0.15], [r * 1.18, -r * 0.22], [r * 1.05, -r * 0.05]], '#FFD43B');
        break;
      }
      case 'inferno_jet': {
        fRect(-r * 0.5, -r * 0.7, r * 0.85, r * 0.4, '#FF3D00');
        fRect(-r * 0.5, r * 0.3, r * 0.85, r * 0.4, '#FF3D00');
        fLine(-r * 0.4, -r * 0.5, -r * 0.1, -r * 0.5, '#FFD43B', 2.5);
        fLine(-r * 0.4, r * 0.5, -r * 0.1, r * 0.5, '#FFD43B', 2.5);
        fRect(-r * 0.7, -r * 0.28, r * 1.4, r * 0.56, '#3C4B40');
        fPoly([[r * 0.65, -r * 0.35], [r * 1.05, -r * 0.48], [r * 1.05, -r * 0.12], [r * 0.65, -r * 0.18]], '#FF7A2F');
        fPoly([[r * 0.65, r * 0.18], [r * 1.05, r * 0.12], [r * 1.05, r * 0.48], [r * 0.65, r * 0.35]], '#FF7A2F');
        fPoly([[r * 1.05, -r * 0.3], [r * 1.35, -r * 0.35], [r * 1.18, -r * 0.2]], '#FFD43B');
        fPoly([[r * 1.05, r * 0.3], [r * 1.35, r * 0.35], [r * 1.18, r * 0.2]], '#FFD43B');
        break;
      }
      case 'katana': {
        fLine(-r * 0.85, r * 0.85, -r * 0.3, r * 0.3, '#8C4A3B', lw * 3.5);
        fLine(-r * 0.8, r * 0.8, -r * 0.35, r * 0.35, '#FFD43B', 1.5);
        fCircle(-r * 0.25, r * 0.25, r * 0.28, '#C9A24B');
        fPoly([[-r * 0.2, r * 0.2], [r * 0.7, -r * 0.55], [r * 0.95, -r * 0.95], [r * 0.55, -r * 0.7]], '#F2EFE6');
        fPoly([[-r * 0.15, r * 0.15], [r * 0.65, -r * 0.5], [r * 0.95, -r * 0.95]], '#FFFFFF', false);
        break;
      }
      case 'storm_blade': {
        fLine(-r * 0.85, r * 0.85, -r * 0.3, r * 0.3, '#1B1229', lw * 3.5);
        fCircle(-r * 0.25, r * 0.25, r * 0.28, '#FFD43B');
        fPoly([[-r * 0.2, r * 0.2], [r * 0.7, -r * 0.55], [r * 0.95, -r * 0.95], [r * 0.55, -r * 0.7]], '#CFEFFA');
        fPoly([[-r * 0.1, r * 0.1], [r * 0.2, -r * 0.1], [r * 0.15, -r * 0.25], [r * 0.5, -r * 0.45], [r * 0.8, -r * 0.8]], '#FFD43B');
        break;
      }
      case 'maul': {
        fLine(-r * 0.7, r * 0.7, r * 0.2, -r * 0.2, '#5A2E22', lw * 3);
        fPoly([[r * 0.05, -r * 0.55], [r * 0.55, -r * 1.05], [r * 0.95, -r * 0.65], [r * 0.45, -r * 0.15]], '#3B2A58');
        fCircle(r * 0.5, -r * 0.6, r * 0.25, '#A25CE0');
        fCircle(r * 0.5, -r * 0.6, r * 0.1, '#F1E0FF');
        fPoly([[r * 0.55, -r * 1.05], [r * 0.75, -r * 1.25], [r * 0.85, -r * 0.95]], '#C9A24B');
        break;
      }
      case 'saw_ring': {
        g.beginPath();
        const teeth = 8;
        for (let i = 0; i < teeth; i++) {
          const a = (i / teeth) * Math.PI * 2;
          const a2 = a + Math.PI / teeth;
          const r1 = r * 0.95, r2 = r * 0.65;
          if (i === 0) g.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
          else g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
          g.lineTo(Math.cos(a2) * r2, Math.sin(a2) * r2);
        }
        g.closePath();
        g.fillStyle = sil ? silCol : '#F2EFE6'; g.fill();
        g.lineWidth = lw; g.strokeStyle = C.ink; g.stroke();
        fCircle(0, 0, r * 0.35, '#C9A24B');
        fCircle(0, 0, r * 0.15, '#14121F');
        break;
      }
      case 'maelstrom': {
        g.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2, a2 = a + Math.PI / 10;
          if (i === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          g.lineTo(Math.cos(a2) * r * 0.68, Math.sin(a2) * r * 0.68);
        }
        g.closePath();
        g.fillStyle = sil ? silCol : '#7FD3F0'; g.fill();
        g.lineWidth = lw; g.strokeStyle = C.ink; g.stroke();
        fCircle(0, 0, r * 0.45, '#CFEFFA');
        fCircle(0, 0, r * 0.2, '#1B1229');
        break;
      }
      case 'drone_pod': {
        fCircle(-r * 0.55, 0, r * 0.32, '#3C4B40');
        fCircle(r * 0.55, 0, r * 0.32, '#3C4B40');
        fPoly([[-r * 0.45, -r * 0.4], [r * 0.45, -r * 0.4], [r * 0.6, r * 0.2], [0, r * 0.55], [-r * 0.6, r * 0.2]], '#5FB49C');
        fCircle(0, 0, r * 0.24, '#7FD3F0');
        fCircle(0, 0, r * 0.1, '#FFFFFF');
        fLine(0, -r * 0.4, 0, -r * 0.75, C.ink, lw);
        fCircle(0, -r * 0.78, r * 0.08, '#FFD43B');
        break;
      }
      case 'hive_pod': {
        fPoly([[0, -r * 0.95], [r * 0.85, -r * 0.45], [r * 0.85, r * 0.45], [0, r * 0.95], [-r * 0.85, r * 0.45], [-r * 0.85, -r * 0.45]], '#FFE066');
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          fCircle(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.16, '#3C4B40');
        }
        fCircle(0, 0, r * 0.26, '#FF7A2F');
        fCircle(0, 0, r * 0.12, '#FFFFFF');
        break;
      }
      case 'grenade': {
        fRect(-r * 0.18, -r * 0.75, r * 0.36, r * 0.25, '#8C86A0');
        fPoly([[r * 0.15, -r * 0.7], [r * 0.45, -r * 0.5], [r * 0.45, r * 0.3], [r * 0.35, r * 0.3]], '#5A526E');
        fCircle(-r * 0.42, -r * 0.65, r * 0.22, null, true);
        g.beginPath(); g.ellipse(0, r * 0.1, r * 0.68, r * 0.75, 0, 0, Math.PI * 2);
        g.fillStyle = sil ? silCol : '#3C4B40'; g.fill();
        g.lineWidth = lw; g.strokeStyle = C.ink; g.stroke();
        fLine(-r * 0.5, 0, r * 0.5, 0, '#1F2822', lw);
        fLine(-r * 0.45, r * 0.3, r * 0.45, r * 0.3, '#1F2822', lw);
        fLine(0, -r * 0.55, 0, r * 0.75, '#1F2822', lw);
        break;
      }
      case 'toxin_mine': {
        g.beginPath(); g.ellipse(0, 0, r * 0.95, r * 0.55, 0, 0, Math.PI * 2);
        g.fillStyle = sil ? silCol : '#3C4B40'; g.fill();
        g.lineWidth = lw; g.strokeStyle = C.ink; g.stroke();
        fCircle(0, 0, r * 0.35, '#8BD450');
        fCircle(0, 0, r * 0.16, '#FF7A2F');
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          fCircle(Math.cos(a) * r * 0.65, Math.sin(a) * r * 0.38, r * 0.1, '#1F2822');
        }
        break;
      }
      case 'arc_coil': {
        fPoly([[-r * 0.6, r * 0.8], [r * 0.6, r * 0.8], [r * 0.3, r * 0.55], [-r * 0.3, r * 0.55]], '#C9A24B');
        fRect(-r * 0.22, -r * 0.35, r * 0.44, r * 0.9, '#1F2822');
        for (let i = 0; i < 4; i++) fRect(-r * 0.32, -r * 0.28 + i * r * 0.22, r * 0.64, r * 0.1, '#D9693A');
        fCircle(0, -r * 0.55, r * 0.28, '#FFD43B');
        fLine(-r * 0.35, -r * 0.65, -r * 0.6, -r * 0.9, '#FFF3A3', lw);
        fLine(r * 0.35, -r * 0.65, r * 0.6, -r * 0.9, '#FFF3A3', lw);
        break;
      }
      case 'tempest_coil': {
        fRect(-r * 0.65, r * 0.6, r * 1.3, r * 0.25, '#C9A24B');
        fLine(-r * 0.45, r * 0.6, -r * 0.45, -r * 0.4, '#C9A24B', lw * 1.5);
        fLine(r * 0.45, r * 0.6, r * 0.45, -r * 0.4, '#C9A24B', lw * 1.5);
        fCircle(0, 0, r * 0.4, '#7FD3F0');
        fCircle(0, 0, r * 0.2, '#FFFFFF');
        fPoly([[-r * 0.25, -r * 0.75], [r * 0.25, -r * 0.75], [0, -r * 0.4]], '#FFD43B');
        fLine(-r * 0.3, -r * 0.1, r * 0.3, r * 0.1, '#FFFFFF', lw * 1.5);
        break;
      }
      case 'frost_aura': {
        fCircle(0, 0, r * 0.85, null, true);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          fLine(0, 0, Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85, '#CFEFFA', lw * 1.8);
          const bx = Math.cos(a) * r * 0.55, by = Math.sin(a) * r * 0.55;
          fLine(bx, by, bx + Math.cos(a + 0.6) * r * 0.25, by + Math.sin(a + 0.6) * r * 0.25, '#7FD3F0', lw);
          fLine(bx, by, bx + Math.cos(a - 0.6) * r * 0.25, by + Math.sin(a - 0.6) * r * 0.25, '#7FD3F0', lw);
        }
        fCircle(0, 0, r * 0.32, '#7FD3F0');
        fCircle(0, 0, r * 0.15, '#FFFFFF');
        break;
      }
      case 'toxic_cloud': {
        fRect(-r * 0.2, -r * 0.85, r * 0.4, r * 0.25, '#8C4A3B');
        fRect(-r * 0.15, -r * 0.6, r * 0.3, r * 0.35, '#5A526E');
        fCircle(0, r * 0.15, r * 0.65, '#5A526E');
        fCircle(0, r * 0.18, r * 0.5, '#8BD450');
        fCircle(-r * 0.18, r * 0.25, r * 0.1, '#CFEFFA');
        fCircle(r * 0.2, r * 0.1, r * 0.08, '#CFEFFA');
        fCircle(r * 0.55, -r * 0.55, r * 0.28, '#8BD450');
        fCircle(r * 0.75, -r * 0.4, r * 0.2, '#5FB49C');
        break;
      }
      case 'seeker': {
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
          const sx = Math.cos(a) * r * 0.78, sy = Math.sin(a) * r * 0.78;
          fPoly([[sx, sy - r * 0.2], [sx + r * 0.15, sy], [sx, sy + r * 0.2], [sx - r * 0.15, sy]], '#A25CE0');
        }
        fCircle(0, 0, r * 0.55, '#1B1229');
        fPoly([[0, -r * 0.38], [r * 0.18, 0], [0, r * 0.38], [-r * 0.18, 0]], '#E86AA6');
        fCircle(0, 0, r * 0.1, '#F1E0FF');
        break;
      }
      default: {
        fCircle(0, 0, r * 0.8, col);
        break;
      }
    }
  }

  // ---------- procedural realistic vector item illustrations ----------
  function renderItem(g, id, r, col, sil, lw) {
    const silCol = '#1D1530';
    function fPoly(pts, fill, stroke) {
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.closePath();
      if (fill) { g.fillStyle = sil ? silCol : fill; g.fill(); }
      if (stroke !== false && lw > 0) { g.lineWidth = lw; g.strokeStyle = C.ink; g.lineJoin = 'round'; g.stroke(); }
    }
    function fRect(rx, ry, rw, rh, fill, stroke) {
      if (fill) { g.fillStyle = sil ? silCol : fill; g.fillRect(rx, ry, rw, rh); }
      if (stroke !== false && lw > 0) { g.lineWidth = lw; g.strokeStyle = C.ink; g.lineJoin = 'round'; g.strokeRect(rx, ry, rw, rh); }
    }
    function fCircle(cx, cy, cr, fill, stroke) {
      g.beginPath(); g.arc(cx, cy, cr, 0, Math.PI * 2);
      if (fill) { g.fillStyle = sil ? silCol : fill; g.fill(); }
      if (stroke !== false && lw > 0) { g.lineWidth = lw; g.strokeStyle = C.ink; g.stroke(); }
    }
    function fLine(x1, y1, x2, y2, strokeColor, customW) {
      if (sil && strokeColor !== C.ink) return;
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2);
      g.lineWidth = customW || lw; g.strokeStyle = strokeColor || C.ink; g.lineCap = 'round'; g.stroke();
      g.lineCap = 'butt';
    }

    switch (id) {
      case 'rubber_boots': {
        fPoly([[-r * 0.5, -r * 0.7], [r * 0.1, -r * 0.7], [r * 0.1, 0], [r * 0.7, r * 0.2], [r * 0.75, r * 0.65], [-r * 0.65, r * 0.65], [-r * 0.65, -r * 0.2]], col || '#FFD43B');
        fRect(-r * 0.7, r * 0.65, r * 1.5, r * 0.2, '#1F2822');
        for (let i = 0; i < 5; i++) fRect(-r * 0.6 + i * r * 0.3, r * 0.85, r * 0.15, r * 0.1, '#14121F');
        fRect(-r * 0.55, -r * 0.78, r * 0.7, r * 0.12, '#3C4B40');
        break;
      }
      case 'lucky_coin': {
        fCircle(0, 0, r * 0.85, '#FFD43B');
        fCircle(0, 0, r * 0.68, null, true);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          fCircle(Math.cos(a) * r * 0.28, Math.sin(a) * r * 0.28, r * 0.22, '#8BD450');
        }
        fCircle(0, 0, r * 0.1, '#14121F');
        break;
      }
      case 'thick_hide': {
        fPoly([[-r * 0.7, -r * 0.6], [r * 0.7, -r * 0.6], [r * 0.85, 0], [r * 0.6, r * 0.75], [0, r * 0.6], [-r * 0.6, r * 0.75], [-r * 0.85, 0]], '#8C4A3B');
        fLine(-r * 0.4, -r * 0.4, r * 0.4, r * 0.4, '#14121F', lw * 1.5);
        fLine(-r * 0.4, r * 0.4, r * 0.4, -r * 0.4, '#14121F', lw * 1.5);
        fPoly([[-r * 0.3, -r * 0.1], [r * 0.3, -r * 0.1], [0, r * 0.2]], '#EDE3C8');
        break;
      }
      case 'sharp_edge': {
        fLine(-r * 0.7, r * 0.7, -r * 0.2, r * 0.2, '#5A2E22', lw * 3.5);
        fLine(-r * 0.35, r * 0.05, -r * 0.05, r * 0.35, '#C9A24B', lw * 2);
        fPoly([[-r * 0.15, r * 0.15], [r * 0.8, -r * 0.8], [r * 0.7, -r * 0.4], [r * 0.2, -r * 0.05]], '#F2EFE6');
        fLine(0, 0, r * 0.6, -r * 0.6, '#8C86A0', lw);
        break;
      }
      case 'quick_fingers': {
        fPoly([[-r * 0.5, r * 0.7], [r * 0.5, r * 0.7], [r * 0.6, -r * 0.1], [r * 0.4, -r * 0.7], [0, -r * 0.75], [-r * 0.4, -r * 0.6], [-r * 0.6, 0]], '#8C4A3B');
        for (let i = -1; i <= 1; i++) fCircle(i * r * 0.25, -r * 0.15, r * 0.1, '#C9A24B');
        fRect(-r * 0.55, r * 0.5, r * 1.1, r * 0.18, '#1F2822');
        break;
      }
      case 'magnet_ring': {
        g.beginPath();
        g.arc(0, 0, r * 0.85, -Math.PI, 0, false);
        g.lineTo(r * 0.85, r * 0.55); g.lineTo(r * 0.45, r * 0.55);
        g.arc(0, 0, r * 0.45, 0, -Math.PI, true);
        g.lineTo(-r * 0.85, r * 0.55);
        g.closePath();
        g.fillStyle = sil ? silCol : '#5A526E'; g.fill();
        g.lineWidth = lw; g.strokeStyle = C.ink; g.stroke();
        fRect(-r * 0.85, r * 0.25, r * 0.4, r * 0.35, '#E5484D');
        fRect(r * 0.45, r * 0.25, r * 0.4, r * 0.35, '#5FA8D3');
        fRect(-r * 0.85, r * 0.55, r * 0.4, r * 0.15, '#F2EFE6');
        fRect(r * 0.45, r * 0.55, r * 0.4, r * 0.15, '#F2EFE6');
        break;
      }
      case 'iron_plating': {
        fPoly([[-r * 0.7, -r * 0.65], [r * 0.7, -r * 0.65], [r * 0.85, r * 0.2], [0, r * 0.85], [-r * 0.85, r * 0.2]], '#5A526E');
        fLine(0, -r * 0.65, 0, r * 0.85, '#8C86A0', lw * 1.5);
        fCircle(-r * 0.5, -r * 0.45, r * 0.08, '#14121F');
        fCircle(r * 0.5, -r * 0.45, r * 0.08, '#14121F');
        fCircle(-r * 0.55, r * 0.25, r * 0.08, '#14121F');
        fCircle(r * 0.55, r * 0.25, r * 0.08, '#14121F');
        break;
      }
      case 'scope_lens': {
        fCircle(0, 0, r * 0.85, '#C9A24B');
        fCircle(0, 0, r * 0.65, '#5FA8D3');
        fLine(-r * 0.65, 0, r * 0.65, 0, '#14121F', lw * 1.2);
        fLine(0, -r * 0.65, 0, r * 0.65, '#14121F', lw * 1.2);
        fCircle(0, 0, r * 0.25, null, true);
        fLine(-r * 0.35, -r * 0.35, -r * 0.1, -r * 0.55, '#FFFFFF', lw * 2);
        break;
      }
      case 'heart_locket': {
        fCircle(0, -r * 0.78, r * 0.15, '#C9A24B');
        g.beginPath();
        g.moveTo(0, r * 0.65);
        g.bezierCurveTo(-r * 0.95, -0.05, -r * 0.75, -r * 0.75, 0, -r * 0.4);
        g.bezierCurveTo(r * 0.75, -r * 0.75, r * 0.95, -0.05, 0, r * 0.65);
        g.closePath();
        g.fillStyle = sil ? silCol : '#FFD43B'; g.fill();
        g.lineWidth = lw; g.strokeStyle = C.ink; g.stroke();
        fCircle(0, -r * 0.05, r * 0.25, '#E5484D');
        break;
      }
      case 'spring_heel': {
        fRect(-r * 0.6, -r * 0.75, r * 1.2, r * 0.2, '#5A526E');
        fRect(-r * 0.6, r * 0.6, r * 1.2, r * 0.2, '#1F2822');
        for (let i = 0; i < 4; i++) {
          const sy = -r * 0.45 + i * r * 0.28;
          fLine(-r * 0.45, sy, r * 0.45, sy + r * 0.14, '#C9A24B', lw * 2.5);
        }
        break;
      }
      case 'vampire_fang': {
        fPoly([[-r * 0.65, -r * 0.5], [-r * 0.2, -r * 0.5], [-r * 0.35, r * 0.45]], '#F2EFE6');
        fPoly([[r * 0.2, -r * 0.5], [r * 0.65, -r * 0.5], [r * 0.35, r * 0.45]], '#F2EFE6');
        fCircle(-r * 0.35, r * 0.6, r * 0.12, '#E5484D');
        fCircle(r * 0.35, r * 0.6, r * 0.12, '#E5484D');
        break;
      }
      case 'ember_charm': {
        fPoly([[0, -r * 0.85], [r * 0.75, -r * 0.2], [r * 0.55, r * 0.75], [-r * 0.55, r * 0.75], [-r * 0.75, -r * 0.2]], '#3C4B40');
        fPoly([[0, -r * 0.6], [r * 0.35, r * 0.05], [r * 0.25, r * 0.5], [-r * 0.25, r * 0.5], [-r * 0.35, r * 0.05]], '#FF7A2F');
        fPoly([[0, -r * 0.25], [r * 0.18, r * 0.2], [0, r * 0.45], [-r * 0.18, r * 0.2]], '#FFD43B');
        break;
      }
      case 'frost_charm': {
        fCircle(0, 0, r * 0.82, '#CFEFFA');
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          fLine(0, 0, Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, '#5FA8D3', lw * 1.8);
        }
        fPoly([[0, -r * 0.45], [r * 0.45, 0], [0, r * 0.45], [-r * 0.45, 0]], '#7FD3F0');
        break;
      }
      case 'static_charm': {
        fCircle(0, 0, r * 0.82, '#3C4B40');
        fPoly([[r * 0.1, -r * 0.65], [-r * 0.35, 0], [0, 0], [-r * 0.1, r * 0.65], [r * 0.35, 0], [0, 0]], '#FFD43B');
        break;
      }
      case 'venom_vial': {
        fRect(-r * 0.25, -r * 0.8, r * 0.5, r * 0.25, '#8C4A3B');
        fRect(-r * 0.2, -r * 0.55, r * 0.4, r * 0.2, '#5A526E');
        fCircle(0, r * 0.2, r * 0.65, '#5A526E');
        fCircle(0, r * 0.25, r * 0.5, '#8BD450');
        fCircle(0, r * 0.2, r * 0.15, '#14121F');
        break;
      }
      case 'void_shard': {
        fPoly([[-r * 0.6, r * 0.7], [-r * 0.2, -r * 0.85], [r * 0.7, -r * 0.4], [r * 0.4, r * 0.8]], '#2A1E3F');
        fPoly([[-r * 0.2, -r * 0.85], [r * 0.1, -r * 0.1], [r * 0.4, r * 0.8]], '#A25CE0');
        fLine(-r * 0.1, -r * 0.3, 0, r * 0.5, '#E86AA6', lw * 1.5);
        break;
      }
      case 'bounty_badge': {
        g.beginPath();
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
          const rad = i % 2 ? r * 0.45 : r * 0.9;
          if (i === 0) g.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
          else g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
        }
        g.closePath();
        g.fillStyle = sil ? silCol : '#FFD43B'; g.fill();
        g.lineWidth = lw; g.strokeStyle = C.ink; g.stroke();
        fCircle(0, 0, r * 0.35, '#C9A24B');
        fCircle(0, 0, r * 0.15, '#FFD43B');
        break;
      }
      case 'cat_overclock': {
        for (let i = -2; i <= 2; i++) {
          fLine(i * r * 0.3, -r * 0.85, i * r * 0.3, -r * 0.55, '#FFD43B', lw * 1.8);
          fLine(i * r * 0.3, r * 0.55, i * r * 0.3, r * 0.85, '#FFD43B', lw * 1.8);
        }
        fRect(-r * 0.65, -r * 0.65, r * 1.3, r * 1.3, '#1F2822');
        fRect(-r * 0.35, -r * 0.35, r * 0.7, r * 0.7, '#FFD43B');
        fRect(-r * 0.15, -r * 0.15, r * 0.3, r * 0.3, '#FF7A2F');
        break;
      }
      case 'cat_hollow_slug': {
        fRect(-r * 0.4, -r * 0.2, r * 0.8, r * 0.9, '#C9A24B');
        fPoly([[-r * 0.4, -r * 0.2], [r * 0.4, -r * 0.2], [r * 0.2, -r * 0.75], [-r * 0.2, -r * 0.75]], '#E5484D');
        fCircle(0, -r * 0.75, r * 0.15, '#14121F');
        fRect(-r * 0.5, r * 0.65, r * 1.0, r * 0.15, '#FFD43B');
        break;
      }
      case 'cat_fuel_tank': {
        fRect(-r * 0.5, -r * 0.5, r * 1.0, r * 1.2, '#E5484D');
        fRect(-r * 0.25, -r * 0.8, r * 0.5, r * 0.3, '#C9A24B');
        fCircle(0, 0, r * 0.3, '#F2EFE6');
        fLine(0, 0, r * 0.15, -r * 0.15, '#14121F', lw * 1.5);
        break;
      }
      case 'cat_whetstone': {
        fRect(-r * 0.8, 0, r * 1.6, r * 0.55, '#5A2E22');
        fRect(-r * 0.7, -r * 0.4, r * 1.4, r * 0.4, '#8C86A0');
        fRect(-r * 0.7, -r * 0.75, r * 1.4, r * 0.35, '#CFEFFA');
        fCircle(r * 0.3, -r * 0.55, r * 0.08, '#FFFFFF');
        break;
      }
      case 'cat_swarm_core': {
        fPoly([[0, -r * 0.85], [r * 0.75, -r * 0.4], [r * 0.75, r * 0.4], [0, r * 0.85], [-r * 0.75, r * 0.4], [-r * 0.75, -r * 0.4]], '#3C4B40');
        fPoly([[0, -r * 0.5], [r * 0.45, -r * 0.25], [r * 0.45, r * 0.25], [0, r * 0.5], [-r * 0.45, r * 0.25], [-r * 0.45, -r * 0.25]], '#FFD43B');
        fCircle(0, 0, r * 0.18, '#FF7A2F');
        break;
      }
      case 'cat_tesla_gem': {
        fPoly([[0, -r * 0.85], [r * 0.65, -r * 0.3], [r * 0.45, r * 0.75], [-r * 0.45, r * 0.75], [-r * 0.65, -r * 0.3]], '#FFD43B');
        fCircle(0, 0, r * 0.75, null, true);
        fLine(-r * 0.75, 0, r * 0.75, 0, '#C9A24B', lw * 2);
        break;
      }
      case 'phoenix_feather': {
        fPoly([[-r * 0.6, r * 0.75], [-r * 0.2, -r * 0.2], [r * 0.6, -r * 0.85], [r * 0.65, -r * 0.4], [0.2, r * 0.3]], '#E5484D');
        fPoly([[-r * 0.4, r * 0.5], [0, 0], [r * 0.5, -r * 0.7], [r * 0.4, -r * 0.3]], '#FFD43B');
        fLine(-r * 0.65, r * 0.85, r * 0.6, -r * 0.85, '#FFF3A3', lw * 1.5);
        break;
      }
      case 'ghost_cloak': {
        fPoly([[0, -r * 0.8], [r * 0.75, 0], [r * 0.6, r * 0.85], [r * 0.2, r * 0.6], [0, r * 0.85], [-r * 0.2, r * 0.6], [-r * 0.6, r * 0.85], [-r * 0.75, 0]], '#8C86A0');
        fPoly([[0, -r * 0.45], [r * 0.3, 0], [0, r * 0.35], [-r * 0.3, 0]], '#14121F');
        fCircle(-r * 0.12, -r * 0.05, r * 0.06, '#7FD3F0');
        fCircle(r * 0.12, -r * 0.05, r * 0.06, '#7FD3F0');
        break;
      }
      case 'blast_core': {
        fRect(-r * 0.7, -r * 0.65, r * 1.4, r * 1.3, '#E5484D');
        for (let i = 0; i < 4; i++) {
          fLine(-r * 0.6 + i * r * 0.4, -r * 0.65, -r * 0.3 + i * r * 0.4, r * 0.65, '#FFD43B', lw * 2);
        }
        fRect(-r * 0.4, -r * 0.25, r * 0.8, r * 0.5, '#14121F');
        fCircle(0, 0, r * 0.12, '#FFD43B');
        break;
      }
      case 'glass_cannon': {
        fRect(-r * 0.7, -r * 0.25, r * 1.4, r * 0.5, '#CFEFFA');
        fCircle(-r * 0.2, 0, r * 0.4, '#7FD3F0');
        fPoly([[r * 0.7, -r * 0.35], [r * 1.0, -r * 0.45], [r * 1.0, r * 0.45], [r * 0.7, r * 0.35]], '#CFEFFA');
        fCircle(-r * 0.2, 0, r * 0.18, '#FFFFFF');
        break;
      }
      case 'time_dial': {
        fCircle(0, -r * 0.8, r * 0.18, '#C9A24B');
        fCircle(0, 0, r * 0.8, '#FFD43B');
        fCircle(0, 0, r * 0.62, '#F2EFE6');
        fLine(0, 0, 0, -r * 0.45, '#14121F', lw * 1.8);
        fLine(0, 0, r * 0.35, 0, '#14121F', lw * 1.8);
        fCircle(0, 0, r * 0.08, '#C9A24B');
        break;
      }
      case 'golden_skull': {
        fCircle(0, -r * 0.15, r * 0.65, '#FFD43B');
        fRect(-r * 0.38, r * 0.15, r * 0.76, r * 0.5, '#C9A24B');
        fCircle(-r * 0.22, -r * 0.1, r * 0.18, '#E5484D');
        fCircle(r * 0.22, -r * 0.1, r * 0.18, '#E5484D');
        fPoly([[0, r * 0.1], [-r * 0.08, r * 0.25], [r * 0.08, r * 0.25]], '#14121F');
        for (let i = 0; i < 3; i++) fLine(-r * 0.2 + i * r * 0.2, r * 0.35, -r * 0.2 + i * r * 0.2, r * 0.65, '#14121F', lw);
        break;
      }
      case 'echo_stone': {
        fCircle(0, 0, r * 0.88, null, true);
        fCircle(0, 0, r * 0.62, null, true);
        fPoly([[0, -r * 0.5], [r * 0.38, 0], [0, r * 0.5], [-r * 0.38, 0]], '#7FD3F0');
        fCircle(0, 0, r * 0.15, '#FFFFFF');
        break;
      }
      default: {
        fCircle(0, 0, r * 0.75, col || '#FFD43B');
        break;
      }
    }
  }

  // ---------- procedural realistic vector character portraits ----------
  function renderCharacter(g, id, r, col, sil, lw) {
    const silCol = '#1D1530';
    function fPoly(pts, fill, stroke) {
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.closePath();
      if (fill) { g.fillStyle = sil ? silCol : fill; g.fill(); }
      if (stroke !== false && lw > 0) { g.lineWidth = lw; g.strokeStyle = C.ink; g.lineJoin = 'round'; g.stroke(); }
    }
    function fRect(rx, ry, rw, rh, fill, stroke) {
      if (fill) { g.fillStyle = sil ? silCol : fill; g.fillRect(rx, ry, rw, rh); }
      if (stroke !== false && lw > 0) { g.lineWidth = lw; g.strokeStyle = C.ink; g.lineJoin = 'round'; g.strokeRect(rx, ry, rw, rh); }
    }
    function fCircle(cx, cy, cr, fill, stroke) {
      g.beginPath(); g.arc(cx, cy, cr, 0, Math.PI * 2);
      if (fill) { g.fillStyle = sil ? silCol : fill; g.fill(); }
      if (stroke !== false && lw > 0) { g.lineWidth = lw; g.strokeStyle = C.ink; g.stroke(); }
    }
    function fLine(x1, y1, x2, y2, strokeColor, customW) {
      if (sil && strokeColor !== C.ink) return;
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2);
      g.lineWidth = customW || lw; g.strokeStyle = strokeColor || C.ink; g.lineCap = 'round'; g.stroke();
      g.lineCap = 'butt';
    }

    switch (id) {
      case 'ranger': {
        fPoly([[0, -r * 0.85], [r * 0.65, 0], [0, r * 0.85], [-r * 0.65, 0]], '#2E3A32');
        fRect(-r * 0.45, -r * 0.15, r * 0.9, r * 0.3, '#14121F');
        fRect(-r * 0.35, -r * 0.1, r * 0.7, r * 0.2, '#7FD3F0');
        break;
      }
      case 'dasher': {
        fCircle(0, 0, r * 0.75, '#1F2822');
        fRect(-r * 0.6, -r * 0.45, r * 1.2, r * 0.3, '#FFD43B');
        fPoly([[-r * 0.4, 0], [-r * 0.1, 0], [-r * 0.2, r * 0.15]], '#FF7A2F');
        fPoly([[r * 0.4, 0], [r * 0.1, 0], [r * 0.2, r * 0.15]], '#FF7A2F');
        break;
      }
      case 'bulwark': {
        fRect(-r * 0.65, -r * 0.75, r * 1.3, r * 1.5, '#5A526E');
        fRect(-r * 0.55, -r * 0.15, r * 1.1, r * 0.3, '#14121F');
        fRect(-r * 0.15, -r * 0.6, r * 0.3, r * 1.2, '#14121F');
        fRect(-r * 0.45, -r * 0.08, r * 0.9, r * 0.16, '#FF7A2F');
        break;
      }
      case 'tinker': {
        fCircle(0, 0, r * 0.75, '#3C4B40');
        fCircle(-r * 0.32, -r * 0.05, r * 0.3, '#C9A24B');
        fCircle(r * 0.32, -r * 0.05, r * 0.3, '#C9A24B');
        fCircle(-r * 0.32, -r * 0.05, r * 0.18, '#5FB49C');
        fCircle(r * 0.32, -r * 0.05, r * 0.18, '#5FB49C');
        fLine(-r * 0.1, -r * 0.05, r * 0.1, -r * 0.05, '#14121F', lw * 2);
        break;
      }
      default: {
        fCircle(0, 0, r * 0.75, col || '#5FA8D3');
        break;
      }
    }
  }

  // ---------- procedural realistic vector pickup illustrations ----------
  function renderPickup(g, id, r, col, sil, lw) {
    const silCol = '#1D1530';
    function fPoly(pts, fill, stroke) {
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.closePath();
      if (fill) { g.fillStyle = sil ? silCol : fill; g.fill(); }
      if (stroke !== false && lw > 0) { g.lineWidth = lw; g.strokeStyle = C.ink; g.lineJoin = 'round'; g.stroke(); }
    }
    function fRect(rx, ry, rw, rh, fill, stroke) {
      if (fill) { g.fillStyle = sil ? silCol : fill; g.fillRect(rx, ry, rw, rh); }
      if (stroke !== false && lw > 0) { g.lineWidth = lw; g.strokeStyle = C.ink; g.lineJoin = 'round'; g.strokeRect(rx, ry, rw, rh); }
    }
    function fCircle(cx, cy, cr, fill, stroke) {
      g.beginPath(); g.arc(cx, cy, cr, 0, Math.PI * 2);
      if (fill) { g.fillStyle = sil ? silCol : fill; g.fill(); }
      if (stroke !== false && lw > 0) { g.lineWidth = lw; g.strokeStyle = C.ink; g.stroke(); }
    }
    function fLine(x1, y1, x2, y2, strokeColor, customW) {
      if (sil && strokeColor !== C.ink) return;
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2);
      g.lineWidth = customW || lw; g.strokeStyle = strokeColor || C.ink; g.lineCap = 'round'; g.stroke();
      g.lineCap = 'butt';
    }

    switch (id) {
      case 'chest': {
        fRect(-r * 0.7, -r * 0.1, r * 1.4, r * 0.8, '#8C4A3B');
        fPoly([[-r * 0.8, -r * 0.1], [r * 0.8, -r * 0.1], [r * 0.65, -r * 0.65], [-r * 0.65, -r * 0.65]], '#C9A24B');
        fRect(-r * 0.18, -r * 0.2, r * 0.36, r * 0.45, '#FFD43B');
        fCircle(0, -0.02 * r, r * 0.08, '#14121F');
        fLine(-r * 0.5, -r * 0.1, -r * 0.5, r * 0.7, '#14121F', lw);
        fLine(r * 0.5, -r * 0.1, r * 0.5, r * 0.7, '#14121F', lw);
        break;
      }
      case 'heart': {
        g.beginPath();
        g.moveTo(0, r * 0.75);
        g.bezierCurveTo(-r * 0.95, 0, -r * 0.85, -r * 0.75, 0, -r * 0.35);
        g.bezierCurveTo(r * 0.85, -r * 0.75, r * 0.95, 0, 0, r * 0.75);
        g.closePath();
        g.fillStyle = sil ? silCol : '#E5484D'; g.fill();
        g.lineWidth = lw; g.strokeStyle = C.ink; g.stroke();
        fCircle(-r * 0.3, -r * 0.25, r * 0.12, '#FFFFFF');
        break;
      }
      case 'gold': {
        fCircle(0, 0, r * 0.85, '#FFD43B');
        fCircle(0, 0, r * 0.65, '#C9A24B');
        fPoly([[0, -r * 0.35], [r * 0.3, 0], [0, r * 0.35], [-r * 0.3, 0]], '#FFD43B');
        fCircle(0, 0, r * 0.1, '#14121F');
        break;
      }
      case 'xp_shard': case 'shard': {
        fPoly([[0, -r * 0.9], [r * 0.65, 0], [0, r * 0.9], [-r * 0.65, 0]], '#5FA8D3');
        fPoly([[0, -r * 0.9], [0, r * 0.9], [r * 0.65, 0]], '#7FD3F0');
        fPoly([[0, -r * 0.5], [r * 0.3, 0], [0, r * 0.5], [-r * 0.3, 0]], '#CFEFFA');
        break;
      }
      case 'magnet': {
        g.beginPath();
        g.arc(0, 0, r * 0.85, -Math.PI, 0, false);
        g.lineTo(r * 0.85, r * 0.55); g.lineTo(r * 0.45, r * 0.55);
        g.arc(0, 0, r * 0.45, 0, -Math.PI, true);
        g.lineTo(-r * 0.85, r * 0.55);
        g.closePath();
        g.fillStyle = sil ? silCol : '#5A526E'; g.fill();
        g.lineWidth = lw; g.strokeStyle = C.ink; g.stroke();
        fRect(-r * 0.85, r * 0.25, r * 0.4, r * 0.35, '#E5484D');
        fRect(r * 0.45, r * 0.25, r * 0.4, r * 0.35, '#5FA8D3');
        fRect(-r * 0.85, r * 0.55, r * 0.4, r * 0.15, '#F2EFE6');
        fRect(r * 0.45, r * 0.55, r * 0.4, r * 0.15, '#F2EFE6');
        break;
      }
      case 'nova_bomb': {
        fCircle(0, r * 0.1, r * 0.72, '#1F2822');
        fRect(-r * 0.15, -r * 0.72, r * 0.3, r * 0.25, '#8C4A3B');
        fLine(0, -r * 0.72, r * 0.4, -r * 0.9, '#8C4A3B', lw * 1.5);
        fCircle(r * 0.45, -r * 0.95, r * 0.16, '#FF7A2F');
        fCircle(r * 0.45, -r * 0.95, r * 0.08, '#FFD43B');
        fCircle(-r * 0.25, -r * 0.1, r * 0.12, '#FFFFFF');
        break;
      }
      default: {
        fCircle(0, 0, r * 0.75, col || '#FFD43B');
        break;
      }
    }
  }

  function drawWeaponIcon(g, id, x, y, r, fill, o) {
    o = o || {};
    const sil = !!o.sil, sh = sil ? 0 : (o.shadow === undefined ? Math.max(1.5, r * 0.12) : o.shadow);
    const lw = o.line === undefined ? Math.max(1.8, r * 0.1) : o.line;
    const col = fill || (NR.data && NR.data.weapons && NR.data.weapons[id] && NR.data.weapons[id].color) || '#F2EFE6';
    g.save();
    g.translate(x, y);
    if (o.rot) g.rotate(o.rot);
    if (sh > 0) {
      g.save(); g.translate(sh, sh);
      renderWeapon(g, id, r, C.ink2, true, lw);
      g.restore();
    }
    renderWeapon(g, id, r, col, sil, lw);
    g.restore();
  }

  function drawItemIcon(g, id, x, y, r, fill, o) {
    o = o || {};
    const sil = !!o.sil, sh = sil ? 0 : (o.shadow === undefined ? Math.max(1.5, r * 0.12) : o.shadow);
    const lw = o.line === undefined ? Math.max(1.8, r * 0.1) : o.line;
    const col = fill || (NR.data && NR.data.items && NR.data.items[id] && NR.data.items[id].color) || '#F2EFE6';
    g.save();
    g.translate(x, y);
    if (o.rot) g.rotate(o.rot);
    if (sh > 0) {
      g.save(); g.translate(sh, sh);
      renderItem(g, id, r, C.ink2, true, lw);
      g.restore();
    }
    renderItem(g, id, r, col, sil, lw);
    g.restore();
  }

  function drawCharacterIcon(g, id, x, y, r, fill, o) {
    o = o || {};
    const sil = !!o.sil, sh = sil ? 0 : (o.shadow === undefined ? Math.max(1.5, r * 0.12) : o.shadow);
    const lw = o.line === undefined ? Math.max(1.8, r * 0.1) : o.line;
    const col = fill || (NR.data && NR.data.characters && NR.data.characters[id] && NR.data.characters[id].color) || '#5FA8D3';
    g.save();
    g.translate(x, y);
    if (o.rot) g.rotate(o.rot);
    if (sh > 0) {
      g.save(); g.translate(sh, sh);
      renderCharacter(g, id, r, C.ink2, true, lw);
      g.restore();
    }
    renderCharacter(g, id, r, col, sil, lw);
    g.restore();
  }

  function drawPickupIcon(g, id, x, y, r, fill, o) {
    o = o || {};
    const sil = !!o.sil, sh = sil ? 0 : (o.shadow === undefined ? Math.max(1.5, r * 0.12) : o.shadow);
    const lw = o.line === undefined ? Math.max(1.8, r * 0.1) : o.line;
    g.save();
    g.translate(x, y);
    if (o.rot) g.rotate(o.rot);
    if (sh > 0) {
      g.save(); g.translate(sh, sh);
      renderPickup(g, id, r, C.ink2, true, lw);
      g.restore();
    }
    renderPickup(g, id, r, fill || '#FFD43B', sil, lw);
    g.restore();
  }

  function renderStat(g, id, r, col, sil, lw) {
    const silCol = '#1D1530';
    function fPoly(pts, fill, stroke) {
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.closePath();
      if (fill) { g.fillStyle = sil ? silCol : fill; g.fill(); }
      if (stroke !== false && lw > 0) { g.lineWidth = lw; g.strokeStyle = C.ink; g.lineJoin = 'round'; g.stroke(); }
    }
    function fRect(rx, ry, rw, rh, fill, stroke) {
      if (fill) { g.fillStyle = sil ? silCol : fill; g.fillRect(rx, ry, rw, rh); }
      if (stroke !== false && lw > 0) { g.lineWidth = lw; g.strokeStyle = C.ink; g.lineJoin = 'round'; g.strokeRect(rx, ry, rw, rh); }
    }
    function fCircle(cx, cy, cr, fill, stroke) {
      g.beginPath(); g.arc(cx, cy, cr, 0, Math.PI * 2);
      if (fill) { g.fillStyle = sil ? silCol : fill; g.fill(); }
      if (stroke !== false && lw > 0) { g.lineWidth = lw; g.strokeStyle = C.ink; g.stroke(); }
    }
    function fLine(x1, y1, x2, y2, strokeColor, customW) {
      if (sil && strokeColor !== C.ink) return;
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2);
      g.lineWidth = customW || lw; g.strokeStyle = strokeColor || C.ink; g.lineCap = 'round'; g.stroke();
      g.lineCap = 'butt';
    }

    switch (id) {
      case 'maxHp': {
        g.beginPath();
        g.moveTo(0, r * 0.85);
        g.bezierCurveTo(-r * 1.15, 0, -r * 1.05, -r * 0.95, 0, -r * 0.4);
        g.bezierCurveTo(r * 1.05, -r * 0.95, r * 1.15, 0, 0, r * 0.85);
        g.closePath();
        g.fillStyle = sil ? silCol : '#E5484D'; g.fill();
        if (lw > 0) { g.lineWidth = lw; g.strokeStyle = C.ink; g.stroke(); }
        fRect(-r * 0.12, -r * 0.35, r * 0.24, r * 0.6, '#FFFFFF', false);
        fRect(-r * 0.35, -r * 0.17, r * 0.7, r * 0.24, '#FFFFFF', false);
        fCircle(-r * 0.35, -r * 0.45, r * 0.12, '#FFFFFF', false);
        break;
      }
      case 'hpRegen': {
        g.beginPath();
        g.moveTo(0, r * 0.85);
        g.bezierCurveTo(-r * 1.15, 0, -r * 1.05, -r * 0.95, 0, -r * 0.4);
        g.bezierCurveTo(r * 1.05, -r * 0.95, r * 1.15, 0, 0, r * 0.85);
        g.closePath();
        g.fillStyle = sil ? silCol : '#8BD450'; g.fill();
        if (lw > 0) { g.lineWidth = lw; g.strokeStyle = C.ink; g.stroke(); }
        fPoly([[-r * 0.35, r * 0.25], [0, -r * 0.1], [r * 0.35, r * 0.25], [0, 0]], '#FFFFFF', false);
        fPoly([[-r * 0.28, -r * 0.05], [0, -r * 0.35], [r * 0.28, -r * 0.05], [0, -r * 0.22]], '#FFFFFF', false);
        break;
      }
      case 'armor': {
        fPoly([[-r * 0.7, -r * 0.75], [r * 0.7, -r * 0.75], [r * 0.65, r * 0.1], [0, r * 0.9], [-r * 0.65, r * 0.1]], '#7E8B9B');
        fPoly([[-r * 0.5, -r * 0.55], [r * 0.5, -r * 0.55], [r * 0.45, r * 0.05], [0, r * 0.68], [-r * 0.45, r * 0.05]], '#353945');
        fCircle(0, 0, r * 0.25, '#FFD43B');
        fCircle(0, 0, r * 0.1, '#C9A24B');
        fCircle(-r * 0.45, -r * 0.55, r * 0.08, '#C4D1DE');
        fCircle(r * 0.45, -r * 0.55, r * 0.08, '#C4D1DE');
        break;
      }
      case 'dodge': {
        fPoly([[-r * 0.6, r * 0.6], [-r * 0.2, r * 0.6], [r * 0.7, -r * 0.7], [r * 0.2, -r * 0.7], [-r * 0.1, -r * 0.2]], '#CFEFFA');
        fPoly([[-r * 0.3, r * 0.4], [0, r * 0.4], [r * 0.5, -r * 0.3], [r * 0.2, -r * 0.3]], '#7FD3F0');
        fLine(-r * 0.6, -r * 0.1, -r * 0.1, -r * 0.6, '#FFFFFF', lw * 1.5);
        fLine(-r * 0.75, r * 0.2, -r * 0.4, -r * 0.15, '#FFFFFF', lw * 1.5);
        break;
      }
      case 'moveSpeed': {
        fPoly([[-r * 0.5, -r * 0.65], [-r * 0.05, -r * 0.65], [-r * 0.05, 0], [r * 0.75, 0.2 * r], [r * 0.75, r * 0.6], [-r * 0.55, r * 0.6]], '#D8A038');
        fRect(-r * 0.6, r * 0.5, r * 1.4, r * 0.18, '#353945');
        fPoly([[-r * 0.5, -r * 0.1], [-r * 0.85, -r * 0.55], [-r * 0.35, -r * 0.35]], '#FFD43B');
        fPoly([[-r * 0.45, -r * 0.3], [-r * 0.8, -r * 0.8], [-r * 0.25, -r * 0.55]], '#FFFFFF');
        break;
      }
      case 'dashCharges': {
        fPoly([[-r * 0.6, -r * 0.7], [-r * 0.1, -r * 0.7], [r * 0.2, 0], [-r * 0.1, r * 0.7], [-r * 0.6, r * 0.7], [-r * 0.3, 0]], '#7FD3F0');
        fPoly([[-r * 0.1, -r * 0.7], [r * 0.4, -r * 0.7], [r * 0.7, 0], [r * 0.4, r * 0.7], [-r * 0.1, r * 0.7], [r * 0.2, 0]], '#FFD43B');
        break;
      }
      case 'dashCooldown': {
        fCircle(0, r * 0.08, r * 0.68, '#D8A038');
        fCircle(0, r * 0.08, r * 0.52, '#F2EFE6');
        fRect(-r * 0.1, -r * 0.85, r * 0.2, r * 0.25, '#8B6514');
        fCircle(0, -r * 0.85, r * 0.16, '#D8A038');
        fLine(0, r * 0.08, r * 0.28, -r * 0.18, C.ink, lw * 1.5);
        fLine(0, r * 0.08, 0, -r * 0.28, '#E5484D', lw * 1.2);
        fCircle(0, r * 0.08, r * 0.08, C.ink);
        break;
      }
      case 'damage': {
        fPoly([[0, -r * 0.85], [r * 0.15, -r * 0.65], [r * 0.6, r * 0.4], [r * 0.4, r * 0.6], [-r * 0.65, -r * 0.4]], '#C4D1DE');
        fPoly([[0, -r * 0.85], [-r * 0.15, -r * 0.65], [-r * 0.6, r * 0.4], [-r * 0.4, r * 0.6], [r * 0.65, -r * 0.4]], '#7E8B9B');
        fCircle(0, 0, r * 0.22, '#D8A038');
        fCircle(0, 0, r * 0.1, '#E5484D');
        break;
      }
      case 'attackSpeed': {
        fPoly([[-r * 0.6, r * 0.2], [-r * 0.2, -r * 0.6], [-r * 0.05, -r * 0.45], [-r * 0.35, r * 0.35]], '#CFEFFA');
        fPoly([[r * 0.6, -r * 0.2], [r * 0.2, r * 0.6], [r * 0.05, r * 0.45], [r * 0.35, -r * 0.35]], '#7FD3F0');
        fLine(-r * 0.6, -r * 0.4, r * 0.6, r * 0.4, '#FFD43B', lw * 1.5);
        fLine(-r * 0.3, -r * 0.6, r * 0.4, -r * 0.1, '#FFFFFF', lw * 1.2);
        break;
      }
      case 'critChance': {
        fCircle(0, 0, r * 0.72, null, true);
        fCircle(0, 0, r * 0.42, '#FF7A2F');
        fCircle(0, 0, r * 0.18, '#FFD43B');
        fLine(-r * 0.85, 0, -r * 0.45, 0, C.ink, lw * 1.5);
        fLine(r * 0.45, 0, r * 0.85, 0, C.ink, lw * 1.5);
        fLine(0, -r * 0.85, 0, -r * 0.45, C.ink, lw * 1.5);
        fLine(0, r * 0.45, 0, r * 0.85, C.ink, lw * 1.5);
        break;
      }
      case 'critDamage': {
        fCircle(0, -r * 0.15, r * 0.58, '#F2EFE6');
        fRect(-r * 0.3, r * 0.22, r * 0.6, r * 0.38, '#F2EFE6');
        fCircle(-r * 0.22, -r * 0.1, r * 0.16, C.ink);
        fCircle(r * 0.22, -r * 0.1, r * 0.18, '#FFD43B');
        fCircle(r * 0.22, -r * 0.1, r * 0.08, '#FFFFFF');
        fRect(-r * 0.15, r * 0.42, r * 0.08, r * 0.18, C.ink, false);
        fRect(0.07 * r, r * 0.42, r * 0.08, r * 0.18, C.ink, false);
        break;
      }
      case 'area': {
        fPoly([
          [0, -r * 0.85], [r * 0.3, -r * 0.4], [r * 0.85, -r * 0.3], [r * 0.4, 0],
          [r * 0.8, r * 0.5], [r * 0.2, r * 0.4], [0, r * 0.85], [-r * 0.2, r * 0.4],
          [-r * 0.8, r * 0.5], [-r * 0.4, 0], [-r * 0.85, -r * 0.3], [-r * 0.3, -r * 0.4]
        ], '#FF7A2F');
        fCircle(0, 0, r * 0.42, '#FFD43B');
        fCircle(0, 0, r * 0.2, '#FFFFFF');
        break;
      }
      case 'range': {
        fRect(-r * 0.65, -r * 0.25, r * 1.3, r * 0.5, '#D8A038');
        fRect(r * 0.45, -r * 0.35, r * 0.25, r * 0.7, '#8B6514');
        fCircle(r * 0.7, 0, r * 0.3, '#7FD3F0');
        fLine(-r * 0.15, -r * 0.25, -r * 0.15, r * 0.25, C.ink, lw);
        fLine(0.15 * r, -r * 0.25, 0.15 * r, r * 0.25, C.ink, lw);
        fCircle(-r * 0.65, 0, r * 0.18, '#353945');
        break;
      }
      case 'projectiles': {
        fRect(-r * 0.5, -r * 0.15, r * 0.6, r * 0.3, '#D8A038');
        fPoly([[r * 0.1, -r * 0.15], [r * 0.35, 0], [r * 0.1, r * 0.15]], '#D9693A');
        g.save(); g.rotate(-0.35);
        fRect(-r * 0.5, -r * 0.55, r * 0.55, r * 0.25, '#D8A038');
        fPoly([[r * 0.05, -r * 0.55], [r * 0.28, -r * 0.42], [r * 0.05, -r * 0.3]], '#D9693A');
        g.restore();
        g.save(); g.rotate(0.35);
        fRect(-r * 0.5, 0.3 * r, r * 0.55, r * 0.25, '#D8A038');
        fPoly([[r * 0.05, 0.3 * r], [r * 0.28, 0.42 * r], [r * 0.05, 0.55 * r]], '#D9693A');
        g.restore();
        break;
      }
      case 'pierce': {
        fRect(-r * 0.15, -r * 0.75, r * 0.3, r * 0.5, '#7E8B9B');
        fRect(-r * 0.15, 0.25 * r, r * 0.3, r * 0.5, '#7E8B9B');
        fPoly([[-r * 0.7, -r * 0.12], [r * 0.4, -r * 0.12], [r * 0.85, 0], [r * 0.4, r * 0.12], [-r * 0.7, r * 0.12]], '#CFEFFA');
        fPoly([[-r * 0.7, -r * 0.35], [-r * 0.4, -r * 0.12], [-r * 0.7, r * 0.35]], '#353945');
        fCircle(r * 0.2, 0, r * 0.08, '#FFD43B');
        break;
      }
      case 'pickupRange': {
        fPoly([
          [-r * 0.7, -r * 0.7], [r * 0.7, -r * 0.7], [r * 0.7, 0.2 * r],
          [r * 0.35, 0.2 * r], [r * 0.35, -r * 0.35], [-r * 0.35, -r * 0.35],
          [-r * 0.35, 0.2 * r], [-r * 0.7, 0.2 * r]
        ], '#E5484D');
        fRect(-r * 0.7, 0.2 * r, r * 0.35, r * 0.4, '#F2EFE6');
        fRect(r * 0.35, 0.2 * r, r * 0.35, r * 0.4, '#F2EFE6');
        fLine(-r * 0.5, r * 0.7, 0, r * 0.85, '#7FD3F0', lw * 1.5);
        fLine(r * 0.5, r * 0.7, 0, r * 0.85, '#7FD3F0', lw * 1.5);
        break;
      }
      case 'xpGain': {
        fPoly([[0, -r * 0.85], [r * 0.65, 0], [0, r * 0.85], [-r * 0.65, 0]], '#7FD3F0');
        fPoly([[0, -r * 0.85], [r * 0.65, 0], [0, r * 0.85]], '#CFEFFA');
        fPoly([[-r * 0.3, 0], [0, -r * 0.4], [r * 0.3, 0], [0, 0.4 * r]], '#FFFFFF');
        break;
      }
      case 'goldGain': {
        fCircle(0, 0, r * 0.75, '#FFD43B');
        fCircle(0, 0, r * 0.55, '#C9A24B');
        fPoly([[-r * 0.3, r * 0.15], [-r * 0.3, -r * 0.15], [-r * 0.15, 0], [0, -r * 0.25], [r * 0.15, 0], [r * 0.3, -r * 0.15], [r * 0.3, r * 0.15]], '#FFD43B');
        fCircle(-r * 0.25, -r * 0.28, r * 0.1, '#FFFFFF');
        break;
      }
      case 'luck': {
        fCircle(-r * 0.32, -r * 0.32, r * 0.32, '#8BD450');
        fCircle(r * 0.32, -r * 0.32, r * 0.32, '#8BD450');
        fCircle(-r * 0.32, 0.32 * r, r * 0.32, '#8BD450');
        fCircle(r * 0.32, 0.32 * r, r * 0.32, '#8BD450');
        fCircle(0, 0, r * 0.22, '#5FA8D3');
        fCircle(0, 0, r * 0.1, '#FFFFFF');
        fLine(0, 0.2 * r, r * 0.2, r * 0.8, '#3C4B40', lw * 1.5);
        break;
      }
      case 'statusPower': {
        fRect(-r * 0.15, -r * 0.65, r * 0.3, r * 0.35, '#353945');
        fRect(-r * 0.2, -r * 0.8, r * 0.4, r * 0.18, '#8A5229');
        fCircle(0, r * 0.18, r * 0.58, '#A25CE0');
        fCircle(-r * 0.18, r * 0.1, r * 0.14, '#CFEFFA');
        fCircle(r * 0.18, 0.25 * r, r * 0.1, '#FFFFFF');
        fCircle(0, 0.35 * r, r * 0.12, '#FFFFFF');
        break;
      }
      default: {
        fCircle(0, 0, r * 0.72, col || '#FFD43B');
        break;
      }
    }
  }

  function drawStatIcon(g, id, x, y, r, fill, o) {
    o = o || {};
    const sil = !!o.sil, sh = sil ? 0 : (o.shadow === undefined ? Math.max(1.5, r * 0.12) : o.shadow);
    const lw = o.line === undefined ? Math.max(1.8, r * 0.1) : o.line;
    g.save();
    g.translate(x, y);
    if (o.rot) g.rotate(o.rot);
    if (sh > 0) {
      g.save(); g.translate(sh, sh);
      renderStat(g, id, r, C.ink2, true, lw);
      g.restore();
    }
    renderStat(g, id, r, fill || '#FFD43B', sil, lw);
    g.restore();
  }

  function renderEnemy(g, id, r, col, sil, lw) {
    const silCol = '#1D1530';
    function fPoly(pts, fill, stroke) {
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.closePath();
      if (fill) { g.fillStyle = sil ? silCol : fill; g.fill(); }
      if (stroke !== false && lw > 0) { g.lineWidth = lw; g.strokeStyle = C.ink; g.lineJoin = 'round'; g.stroke(); }
    }
    function fRect(rx, ry, rw, rh, fill, stroke) {
      if (fill) { g.fillStyle = sil ? silCol : fill; g.fillRect(rx, ry, rw, rh); }
      if (stroke !== false && lw > 0) { g.lineWidth = lw; g.strokeStyle = C.ink; g.lineJoin = 'round'; g.strokeRect(rx, ry, rw, rh); }
    }
    function fCircle(cx, cy, cr, fill, stroke) {
      g.beginPath(); g.arc(cx, cy, cr, 0, Math.PI * 2);
      if (fill) { g.fillStyle = sil ? silCol : fill; g.fill(); }
      if (stroke !== false && lw > 0) { g.lineWidth = lw; g.strokeStyle = C.ink; g.stroke(); }
    }
    function fLine(x1, y1, x2, y2, strokeColor, customW) {
      if (sil && strokeColor !== C.ink) return;
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2);
      g.lineWidth = customW || lw; g.strokeStyle = strokeColor || C.ink; g.lineCap = 'round'; g.stroke();
      g.lineCap = 'butt';
    }

    switch (id) {
      case 'grunt': {
        fRect(-r * 0.7, -r * 0.6, r * 0.35, r * 0.35, '#1F2822');
        fRect(-r * 0.7, r * 0.25, r * 0.35, r * 0.35, '#1F2822');
        fPoly([[-r * 0.65, -r * 0.55], [r * 0.65, -r * 0.4], [r * 0.85, 0], [r * 0.65, r * 0.4], [-r * 0.65, r * 0.55]], col || '#D9693A');
        fLine(r * 0.5, -r * 0.4, r * 1.0, -r * 0.6, '#5A526E', lw * 1.5);
        fLine(r * 0.5, r * 0.4, r * 1.0, r * 0.6, '#5A526E', lw * 1.5);
        fRect(r * 0.25, -r * 0.12, r * 0.35, r * 0.24, '#FFD43B');
        break;
      }
      case 'swarmer': {
        for (let i = -1; i <= 1; i++) {
          fLine(-i * r * 0.2, -r * 0.3, -i * r * 0.3, -r * 0.9, '#14121F', lw);
          fLine(-i * r * 0.2, r * 0.3, -i * r * 0.3, r * 0.9, '#14121F', lw);
        }
        fPoly([[-r * 0.85, 0], [-r * 0.15, -r * 0.55], [r * 0.85, 0], [-r * 0.15, r * 0.55]], col || '#E8C547');
        fPoly([[r * 0.7, -r * 0.2], [r * 1.05, -r * 0.1], [r * 0.7, 0]], '#FF7A2F');
        fPoly([[r * 0.7, r * 0.2], [r * 1.05, r * 0.1], [r * 0.7, 0]], '#FF7A2F');
        break;
      }
      case 'spitter': {
        fLine(-r * 0.2, 0, -r * 0.85, 0, '#14121F', lw * 1.5);
        fLine(0, -r * 0.2, -r * 0.5, -r * 0.85, '#14121F', lw * 1.5);
        fLine(0, r * 0.2, -r * 0.5, r * 0.85, '#14121F', lw * 1.5);
        fCircle(-r * 0.25, 0, r * 0.55, col || '#8BD450');
        fRect(r * 0.05, -r * 0.2, r * 0.75, r * 0.4, '#3C4B40');
        fCircle(r * 0.85, 0, r * 0.18, '#FFD43B');
        break;
      }
      case 'brute': {
        fRect(-r * 0.75, -r * 0.75, r * 1.5, r * 1.5, col || '#8C4A3B');
        fCircle(r * 0.35, -r * 0.85, r * 0.28, '#5A526E');
        fCircle(r * 0.35, r * 0.85, r * 0.28, '#5A526E');
        fPoly([[-r * 0.45, -r * 0.85], [r * 0.45, 0], [-r * 0.45, r * 0.85]], '#1F2822');
        fRect(r * 0.25, -r * 0.15, r * 0.25, r * 0.3, '#FF7A2F');
        break;
      }
      case 'bomber': {
        fPoly([[0, -r * 0.8], [r * 0.7, -r * 0.4], [r * 0.7, r * 0.4], [0, r * 0.8], [-r * 0.7, r * 0.4], [-r * 0.7, -r * 0.4]], col || '#E86AA6');
        fRect(-r * 0.45, -r * 0.2, r * 0.9, r * 0.4, '#FFD43B');
        fLine(0, 0, -r * 0.5, -r * 0.75, '#8C4A3B', lw * 1.5);
        fCircle(-r * 0.55, -r * 0.85, r * 0.2, '#FF7A2F');
        fCircle(-r * 0.55, -r * 0.85, r * 0.1, '#FFD43B');
        break;
      }
      case 'lunger': {
        g.beginPath(); g.ellipse(0, 0, r * 0.9, r * 0.5, 0, 0, Math.PI * 2);
        g.fillStyle = sil ? silCol : (col || '#C95B73'); g.fill();
        g.lineWidth = lw; g.strokeStyle = C.ink; g.stroke();
        fPoly([[r * 0.4, -r * 0.25], [r * 1.1, -r * 0.5], [r * 0.9, 0]], '#CFEFFA');
        fPoly([[r * 0.4, r * 0.25], [r * 1.1, r * 0.5], [r * 0.9, 0]], '#CFEFFA');
        fLine(-r * 0.3, -r * 0.4, -r * 0.8, -r * 0.7, '#14121F', lw * 1.5);
        fLine(-r * 0.3, r * 0.4, -r * 0.8, r * 0.7, '#14121F', lw * 1.5);
        break;
      }
      case 'sniper': {
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2;
          fPoly([[0, 0], [Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95], [Math.cos(a + 0.4) * r * 0.6, Math.sin(a + 0.4) * r * 0.6]], '#3C4B40');
        }
        fCircle(0, 0, r * 0.55, col || '#8FC1E3');
        fRect(r * 0.25, -r * 0.15, r * 0.85, r * 0.3, '#14121F');
        fCircle(r * 0.35, 0, r * 0.15, '#FF7A2F');
        break;
      }
      case 'shielder': {
        fCircle(-r * 0.25, 0, r * 0.55, col || '#C9A24B');
        g.beginPath();
        g.arc(r * 0.2, 0, r * 0.85, -1.05, 1.05, false);
        g.lineTo(r * 0.55, r * 0.65);
        g.arc(r * 0.2, 0, r * 0.65, 1.05, -1.05, true);
        g.closePath();
        g.fillStyle = sil ? silCol : '#C9A24B'; g.fill();
        g.lineWidth = lw; g.strokeStyle = C.ink; g.stroke();
        fRect(r * 0.65, -r * 0.12, r * 0.25, r * 0.24, '#14121F');
        break;
      }
      case 'summoner': {
        fPoly([[-r * 0.7, -r * 0.7], [r * 0.65, 0], [-r * 0.7, r * 0.7], [-r * 0.95, 0]], '#1F2822');
        fCircle(0, 0, r * 0.55, col || '#8A5BD1');
        fCircle(r * 0.25, 0, r * 0.15, '#CFEFFA');
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2;
          fRect(Math.cos(a) * r * 0.75 - r * 0.1, Math.sin(a) * r * 0.75 - r * 0.1, r * 0.2, r * 0.2, '#A25CE0');
        }
        break;
      }
      case 'splitter': {
        fCircle(0, 0, r * 0.78, col || '#5FB49C');
        fCircle(-r * 0.3, 0, r * 0.22, '#14121F');
        fCircle(r * 0.3, 0, r * 0.22, '#14121F');
        fCircle(-r * 0.3, 0, r * 0.08, '#CFEFFA');
        fCircle(r * 0.3, 0, r * 0.08, '#CFEFFA');
        break;
      }
      case 'medic': {
        fRect(-r * 0.85, -r * 0.15, r * 1.7, r * 0.3, '#8BD450');
        fRect(-r * 0.15, -r * 0.85, r * 0.3, r * 1.7, '#8BD450');
        fCircle(0, 0, r * 0.65, '#F2EFE6');
        fRect(-r * 0.38, -r * 0.12, r * 0.76, r * 0.24, '#E5484D');
        fRect(-r * 0.12, -r * 0.38, r * 0.24, r * 0.76, '#E5484D');
        break;
      }
      case 'phantom': {
        fPoly([[-r * 0.55, -r * 0.65], [-r * 0.85, 0], [-r * 0.55, r * 0.65], [r * 0.85, 0]], col || '#A25CE0');
        fPoly([[r * 0.2, -r * 0.55], [r * 0.7, -r * 0.85], [r * 0.1, -r * 0.75]], '#CFEFFA');
        fPoly([[r * 0.2, r * 0.55], [r * 0.7, r * 0.85], [r * 0.1, r * 0.75]], '#CFEFFA');
        fCircle(r * 0.15, 0, r * 0.16, '#14121F');
        break;
      }
      default: {
        fCircle(0, 0, r * 0.75, col || '#D9693A');
        break;
      }
    }
  }

  function renderBoss(g, id, r, col, sil, lw) {
    const silCol = '#1D1530';
    function fPoly(pts, fill, stroke) {
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.closePath();
      if (fill) { g.fillStyle = sil ? silCol : fill; g.fill(); }
      if (stroke !== false && lw > 0) { g.lineWidth = lw; g.strokeStyle = C.ink; g.lineJoin = 'round'; g.stroke(); }
    }
    function fRect(rx, ry, rw, rh, fill, stroke) {
      if (fill) { g.fillStyle = sil ? silCol : fill; g.fillRect(rx, ry, rw, rh); }
      if (stroke !== false && lw > 0) { g.lineWidth = lw; g.strokeStyle = C.ink; g.lineJoin = 'round'; g.strokeRect(rx, ry, rw, rh); }
    }
    function fCircle(cx, cy, cr, fill, stroke) {
      g.beginPath(); g.arc(cx, cy, cr, 0, Math.PI * 2);
      if (fill) { g.fillStyle = sil ? silCol : fill; g.fill(); }
      if (stroke !== false && lw > 0) { g.lineWidth = lw; g.strokeStyle = C.ink; g.stroke(); }
    }

    switch (id) {
      case 'scrap_titan': {
        fRect(-r * 0.85, -r * 0.75, r * 0.35, r * 0.45, '#1F2822');
        fRect(-r * 0.85, r * 0.3, r * 0.35, r * 0.45, '#1F2822');
        fPoly([[-r * 0.7, -r * 0.65], [r * 0.7, -r * 0.65], [r * 0.9, 0], [r * 0.7, r * 0.65], [-r * 0.7, r * 0.65], [-r * 0.9, 0]], col || '#D9693A');
        fRect(-r * 0.45, -r * 0.25, r * 0.9, r * 0.5, '#FFD43B');
        fCircle(0, 0, r * 0.3, '#C9A24B');
        fCircle(0, 0, r * 0.15, '#FF7A2F');
        fRect(r * 0.55, -r * 0.7, r * 0.35, r * 0.35, '#5A526E');
        fRect(r * 0.55, r * 0.35, r * 0.35, r * 0.35, '#5A526E');
        break;
      }
      case 'frost_warden': {
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          fRect(Math.cos(a) * r * 0.85 - r * 0.12, Math.sin(a) * r * 0.85 - r * 0.12, r * 0.24, r * 0.24, '#CFEFFA');
        }
        fPoly([[0, -r * 0.85], [r * 0.85, 0], [0, r * 0.85], [-r * 0.85, 0]], col || '#8FC1E3');
        fCircle(0, 0, r * 0.45, '#CFEFFA');
        fPoly([[r * 0.3, -r * 0.2], [r * 1.15, 0], [r * 0.3, r * 0.2]], '#7FD3F0');
        break;
      }
      case 'void_maw': {
        fCircle(0, 0, r * 0.88, col || '#8A5BD1');
        fCircle(0, 0, r * 0.65, '#A25CE0');
        fCircle(0, 0, r * 0.38, '#14121F');
        fCircle(0, 0, r * 0.18, '#E86AA6');
        break;
      }
      default: {
        fCircle(0, 0, r * 0.8, col || '#D9693A');
        break;
      }
    }
  }

  function drawEnemyIcon(g, id, x, y, r, fill, o) {
    o = o || {};
    const sil = !!o.sil, sh = sil ? 0 : (o.shadow === undefined ? Math.max(1.5, r * 0.12) : o.shadow);
    const lw = o.line === undefined ? Math.max(1.8, r * 0.1) : o.line;
    const col = fill || (NR.data && NR.data.enemies && NR.data.enemies[id] && NR.data.enemies[id].color) || '#D9693A';
    g.save();
    g.translate(x, y);
    if (o.rot) g.rotate(o.rot);
    if (sh > 0) {
      g.save(); g.translate(sh, sh);
      renderEnemy(g, id, r, C.ink2, true, lw);
      g.restore();
    }
    renderEnemy(g, id, r, col, sil, lw);
    g.restore();
  }

  function drawBossIcon(g, id, x, y, r, fill, o) {
    o = o || {};
    const sil = !!o.sil, sh = sil ? 0 : (o.shadow === undefined ? Math.max(1.5, r * 0.12) : o.shadow);
    const lw = o.line === undefined ? Math.max(1.8, r * 0.1) : o.line;
    const col = fill || (NR.data && NR.data.bosses && NR.data.bosses[id] && NR.data.bosses[id].color) || '#C95B73';
    g.save();
    g.translate(x, y);
    if (o.rot) g.rotate(o.rot);
    if (sh > 0) {
      g.save(); g.translate(sh, sh);
      renderBoss(g, id, r, C.ink2, true, lw);
      g.restore();
    }
    renderBoss(g, id, r, col, sil, lw);
    g.restore();
  }

  function drawEntityIcon(g, kind, id, x, y, r, fill, o) {
    if (kind === 'weapon' || kind === 'evolution' || (NR.data && NR.data.weapons && NR.data.weapons[id])) {
      return drawWeaponIcon(g, id, x, y, r, fill, o);
    }
    if (kind === 'item' || (NR.data && NR.data.items && NR.data.items[id])) {
      return drawItemIcon(g, id, x, y, r, fill, o);
    }
    if (kind === 'character' || (NR.data && NR.data.characters && NR.data.characters[id])) {
      return drawCharacterIcon(g, id, x, y, r, fill, o);
    }
    if (kind === 'pickup' || /^(chest|heart|gold|xp_shard|magnet|nova_bomb|shard)$/.test(id)) {
      return drawPickupIcon(g, id, x, y, r, fill, o);
    }
    if (kind === 'stat' || (NR.data && NR.data.upgrades && NR.data.upgrades[id])) {
      return drawStatIcon(g, id, x, y, r, fill, o);
    }
    if (kind === 'enemy' && NR.data && NR.data.enemies && NR.data.enemies[id]) {
      return drawEnemyIcon(g, id, x, y, r, fill, o);
    }
    if (kind === 'boss' && NR.data && NR.data.bosses && NR.data.bosses[id]) {
      return drawBossIcon(g, id, x, y, r, fill, o);
    }
    return drawShape(g, id || 'circle', x, y, r, fill, o);
  }

  // ---------- state ----------
  let canvas = null, ctx = null, inited = false, orig = null, hudCalls = 0, frame = 0;
  let u = 1;
  const S = {
    hp: 1, lag: 1, lagHold: 0, boss: 1, bossLag: 1, bossHold: 0, bossId: 0,
    gold: 0, goldPop: 0, hurt: 0, banner: null, bannerT: 0, toasts: [], time: 0, evo: 0,
    combo: 0, comboT: 0, comboRank: 0, comboPop: 0
  };
  const cache = {};
  function memo(key, sig, fn) { const c = cache[key]; if (c && c.s === sig) return c.v; const v = fn(); cache[key] = { s: sig, v: v }; return v; }
  const t = function (k, p) { return NR.i18n.t(k, p); };
  const tx = function (o) { return NR.i18n.text(o); };
  function upper(s) { try { return String(s).toLocaleUpperCase(NR.i18n.getLang()); } catch (e) { return String(s).toUpperCase(); } }
  function settings() { return NR.save ? NR.save.getSettings() : {}; }
  function mmss(sec) { sec = Math.max(0, Math.ceil(sec)); const m = Math.floor(sec / 60), s = sec % 60; return m + ':' + (s < 10 ? '0' : '') + s; }

  function calcScale() {
    let s = 1;
    try {
      const r = canvas.getBoundingClientRect(), sc = Math.min(r.width / canvas.width, r.height / canvas.height);
      if (sc > 0 && isFinite(sc)) s = sc;
    } catch (e) { /* keep 1 */ }
    u = clamp(0.8 / s, 1, 1.7);
  }

  // ---------- drawing primitives (opaque, flat, hard shadows) ----------
  function box(x, y, w, h, fill, b) {
    b = b === undefined ? 3 * u : b;
    ctx.fillStyle = C.ink2; ctx.fillRect(x + 3 * u, y + 4 * u, w, h);
    ctx.fillStyle = C.ink; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = fill; ctx.fillRect(x + b, y + b, w - 2 * b, h - 2 * b);
  }
  function label(str, x, y, size, color, align) {
    ctx.font = '800 ' + Math.round(size * u) + 'px ' + FONT;
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size * u * 0.28); ctx.strokeStyle = C.ink;
    ctx.strokeText(str, x, y);
    ctx.fillStyle = color; ctx.fillText(str, x, y);
  }
  function bar(x, y, w, h, frac, fill, lag, lagColor) {
    box(x, y, w, h, C.ink);
    const b = 3 * u, iw = w - 2 * b, ih = h - 2 * b;
    if (lag > frac) { ctx.fillStyle = lagColor; ctx.fillRect(x + b, y + b, Math.round(iw * clamp(lag, 0, 1)), ih); }
    ctx.fillStyle = fill; ctx.fillRect(x + b, y + b, Math.round(iw * clamp(frac, 0, 1)), ih);
  }

  // ---------- update (real-time dt, every frame) ----------
  function update(dt) {
    if (NR.ui.screens && NR.ui.screens.tick) NR.ui.screens.tick(dt);
    S.time += dt;
    const W = NR.world.get(), p = W.player;
    if (S.bannerT > 0) S.bannerT -= dt;
    if (S.hurt > 0) S.hurt -= dt;
    if (S.goldPop > 0) S.goldPop -= dt;
    if (S.comboT > 0) {
      S.comboT -= dt;
      if (S.comboT <= 0) { S.combo = 0; S.comboRank = 0; }
    }
    if (S.comboPop > 0) S.comboPop -= dt;
    for (let i = S.toasts.length - 1; i >= 0; i--) { S.toasts[i].t -= dt; if (S.toasts[i].t <= 0) S.toasts.splice(i, 1); }
    if (p && p.maxHp > 0) {
      const f = clamp(p.hp / p.maxHp, 0, 1);
      S.hp = f;
      if (f >= S.lag) { S.lag = f; S.lagHold = 0.45; }
      else if (S.lagHold > 0) S.lagHold -= dt;
      else S.lag = Math.max(f, S.lag - 0.5 * dt);
      if (p.gold !== S.gold) { if (p.gold > S.gold) S.goldPop = 0.25; S.gold = p.gold; }
    }
    const b = W.boss;
    if (b && !b.dead && b.maxHp > 0) {
      if (S.bossId !== b.id) { S.bossId = b.id; S.boss = 1; S.bossLag = 1; S.bossHold = 0; }
      const f = clamp(b.hp / b.maxHp, 0, 1);
      if (f < S.boss - 1e-6) S.bossHold = 0.5;
      S.boss = f;
      if (f >= S.bossLag) S.bossLag = f;
      else if (S.bossHold > 0) S.bossHold -= dt;
      else S.bossLag = Math.max(f, S.bossLag - 0.4 * dt);
    }
  }

  // ---------- draw ----------
  function visible(state) { return state === 'wave' || state === 'clear' || state === 'paused' || state === 'levelup'; }
  function draw(g, W, alpha) {
    if (g) ctx = g;
    if (!ctx) return;
    hudCalls++;
    if (!W) W = NR.world.get();
    const p = W.player;
    if (!p || !visible(W.state)) return;
    if (frame++ % 20 === 0 && canvas) calcScale();
    const cw = canvas ? canvas.width : 1280, ch = canvas ? canvas.height : 720;
    ctx.save();
    if (ctx.setTransform) ctx.setTransform(1, 0, 0, 1, 0, 0);
    if ('fontStretch' in ctx) ctx.fontStretch = 'condensed';
    const calm = !!settings().reduceFlashing;
    drawFrameWarn(p, cw, ch, calm);
    drawVitals(p, W);
    drawUlt(p, W);
    drawWave(W, cw);
    drawGold(p, W, cw);
    drawCombo(cw);
    drawBoss(W, cw);
    drawDash(p, cw, ch);
    drawWeapons(p, ch);
    drawItems(p, ch);
    drawBanner(cw, ch);
    drawToasts(cw, ch);
    ctx.restore();
  }

  function drawFrameWarn(p, cw, ch, calm) {
    const low = p.maxHp > 0 && p.hp / p.maxHp <= 0.3 && !p.dead, hit = S.hurt > 0 && !calm;
    if (!low && !hit) return;
    let th = (low ? 5 : 0) * u;
    if (low && !calm) th += (Math.sin(S.time * 7) > 0 ? 4 : 0) * u;
    if (hit) th = 14 * u;
    ctx.fillStyle = hit ? C.cream : C.hpLow;
    ctx.fillRect(0, 0, cw, th); ctx.fillRect(0, ch - th, cw, th); ctx.fillRect(0, th, th, ch - 2 * th); ctx.fillRect(cw - th, th, th, ch - 2 * th);
  }

  function drawVitals(p, W) {
    const x = 16 * u, y = 14 * u, w = 236 * u;
    const low = S.hp <= 0.3;
    bar(x, y, w, 30 * u, S.hp, low ? C.hpLow : C.hp, S.lag, C.hpLag);
    const hpTxt = memo('hp', Math.ceil(p.hp) + '/' + p.maxHp, function () { return Math.ceil(p.hp) + ' / ' + p.maxHp; });
    label(hpTxt, x + w / 2, y + 15 * u + 1, 16, C.cream, 'center');
    const need = NR.stats.xpNeed(p.level), xf = need > 0 ? p.xp / need : 0;
    bar(x, y + 38 * u, w, 16 * u, xf, C.xp, 0, C.xp);
    const lv = memo('lv' + NR.i18n.getLang(), p.level + ':' + p.pending, function () { return upper(t('hud.level', { n: p.level })) + (p.pending > 0 ? '  +' + p.pending : ''); });
    label(lv, x + w + 10 * u, y + 46 * u, 17, p.pending > 0 ? C.gold : C.cream, 'left');
  }

  function drawUlt(p, W) {
    const x = 16 * u, y = 72 * u, w = 236 * u, h = 14 * u;
    const chg = clamp((p.ultCharge || 0) / 100, 0, 1);
    const ready = chg >= 1;
    const readyCol = Math.sin(S.time * 12) > 0 ? C.gold : C.cream;
    bar(x, y, w, h, chg, ready ? readyCol : '#A25CE0', 0, '#A25CE0');
    const txt = ready ? '[Q] ULTIMATE READY!' : 'ULT ' + Math.floor(chg * 100) + '%';
    label(txt, x + w / 2, y + 7 * u, 11, ready ? C.ink : C.cream, 'center');
  }

  const RANKS = [
    { r: '', name: '', col: C.mute, mult: '' },
    { r: 'D', name: 'DISMANTLE', col: '#8C86A0', mult: 'x1.05' },
    { r: 'C', name: 'CARNAGE', col: '#5FA8D3', mult: 'x1.10' },
    { r: 'B', name: 'BRUTAL', col: '#8BD450', mult: 'x1.15' },
    { r: 'A', name: 'ANARCHY', col: '#FFD43B', mult: 'x1.20' },
    { r: 'S', name: 'SAVAGE', col: '#FF7A2F', mult: 'x1.25' },
    { r: 'SSS', name: 'SUPREME', col: '#E86AA6', mult: 'x1.35' }
  ];
  function drawCombo(cw) {
    if (!S.combo || S.combo < 3 || S.comboT <= 0) return;
    const rInfo = RANKS[S.comboRank || 0] || RANKS[1];
    const w = 144 * u, h = 44 * u, x = cw - 16 * u - w, y = 60 * u;
    box(x, y, w, h, C.panel);
    const pop = S.comboPop > 0 ? 1.25 : 1.0;
    label(rInfo.r, x + 24 * u, y + 22 * u, 26 * pop, rInfo.col, 'center');
    label(S.combo + ' HITS', x + 48 * u, y + 14 * u, 14, C.cream, 'left');
    label(rInfo.name + ' ' + rInfo.mult, x + 48 * u, y + 28 * u, 10, rInfo.col, 'left');
    const f = clamp(S.comboT / 3.2, 0, 1);
    ctx.fillStyle = rInfo.col;
    ctx.fillRect(x + 4 * u, y + h - 4 * u, (w - 8 * u) * f, 2.5 * u);
  }

  function drawWave(W, cw) {
    const w = 210 * u, h = 56 * u, x = Math.round((cw - w) / 2), y = 12 * u;
    box(x, y, w, h, C.panel);
    const lang = NR.i18n.getLang(), endless = !!W.endless;
    const ws = memo('wave', lang + ':' + W.wave + ':' + endless, function () {
      return upper(endless ? t('hud.wave', { n: W.wave }) : t('hud.waveOf', { n: W.wave, max: NR.config.WAVES }));
    });
    label(ws, x + w / 2, y + 17 * u, 15, C.mute, 'center');
    let main, col = C.cream;
    const isBoss = !!(W.boss && !W.boss.dead);
    if (W.state === 'clear') { main = upper(t('hud.clear')); col = C.good; }
    else if (isBoss) { main = upper(t('hud.boss')); col = C.boss; }
    else { main = mmss(W.waveT); if (W.waveT <= 5 && W.waveT > 0 && W.state === 'wave') col = C.hpLow; }
    label(main, x + w / 2, y + 39 * u, 26, col, 'center');
  }

  function drawGold(p, W, cw) {
    const touch = NR.ui.touch && NR.ui.touch.active && NR.ui.touch.active();
    const right = cw - 16 * u - (touch ? 62 * u : 0);
    const pop = S.goldPop > 0 ? 1.18 : 1;
    const str = memo('gold', p.gold, function () { return NR.util.fmt(p.gold); });
    const size = 26 * pop;
    ctx.font = '800 ' + Math.round(size * u) + 'px ' + FONT;
    const tw = ctx.measureText ? ctx.measureText(str).width : 40;
    const w = Math.max(96 * u, tw + 62 * u), x = right - w, y = 14 * u;
    box(x, y, w, 40 * u, C.panel);
    drawShape(ctx, 'gold', x + 22 * u, y + 20 * u, 10 * u, C.gold, { line: 2.5 * u, shadow: 2 * u });
    label(str, right - 14 * u, y + 21 * u, size, C.gold, 'right');
    if (settings().showFps && NR.loop && NR.loop.fps) {
      const f = Math.round(NR.loop.fps());
      label('FPS ' + f, right, y + 58 * u, 14, f < 45 ? C.hpLow : C.mute, 'right');
    }
  }

  function drawBoss(W, cw) {
    const b = W.boss;
    if (!b || b.dead || !b.maxHp) return;
    const def = NR.data.bosses && NR.data.bosses[b.defId];
    const w = Math.min(560 * u, cw - 32 * u), h = 24 * u, x = Math.round((cw - w) / 2), y = 92 * u;
    bar(x, y, w, h, S.boss, C.boss, S.bossLag, C.hpLag);
    // phase ticks
    const phases = def && def.phases ? def.phases : [], bw = w - 6 * u;
    for (let i = 1; i < phases.length; i++) {
      const bl = phases[i] && phases[i].below;
      if (typeof bl !== 'number' || bl <= 0 || bl >= 1) continue;
      const px = Math.round(x + 3 * u + bw * bl);
      ctx.fillStyle = S.boss < bl ? C.cream : C.ink; ctx.fillRect(px - Math.round(1.5 * u), y + 3 * u, Math.max(3, Math.round(3 * u)), h - 6 * u);
    }
    const nm = def ? upper(tx(def.name)) : upper(t('hud.boss'));
    label(nm, x, y - 11 * u, 17, C.cream, 'left');
    const ph = b.phase || 1, tot = phases.length || 1;
    label(t('hud.phase', { n: ph, max: tot }), x + w, y - 11 * u, 14, C.mute, 'right');
    if (b.flags && b.flags.enraged) label(upper(t('hud.enrage')), x + w / 2, y + h + 12 * u, 15, (Math.sin(S.time * 8) > 0 || settings().reduceFlashing) ? C.hpLow : C.cream, 'center');
  }

  function drawDash(p, cw, ch) {
    const d = p.dash;
    if (!d || !d.max) return;
    const pw = 34 * u, ph = 14 * u, gap = 6 * u, n = d.max, total = n * pw + (n - 1) * gap;
    let x = Math.round((cw - total) / 2);
    const y = ch - 28 * u;
    const cdT = p.stats && p.stats.dashCooldown ? p.stats.dashCooldown : 1.2;
    for (let i = 0; i < n; i++) {
      box(x, y, pw, ph, C.ink, 2.5 * u);
      const iw = pw - 5 * u;
      let f = 0;
      if (i < d.charges) f = 1;
      else if (i === d.charges) f = clamp(1 - d.cd / cdT, 0, 1);
      if (f > 0) { ctx.fillStyle = i < d.charges ? C.dash : C.mute; ctx.fillRect(x + 2.5 * u, y + 2.5 * u, Math.round(iw * f), ph - 5 * u); }
      x += pw + gap;
    }
  }

  function weaponColor(def) { return (def && def.color) || (def && RCOL[def.rarity]) || C.cream; }
  function drawWeapons(p, ch) {
    const sz = 56 * u, gap = 8 * u, x0 = 16 * u, y = ch - 16 * u - sz;
    const slots = Math.max(p.weapons.length, Math.round(p.stats && p.stats.weaponSlots ? p.stats.weaponSlots : 4));
    for (let i = 0; i < slots; i++) {
      const x = x0 + i * (sz + gap), w = p.weapons[i];
      if (!w) { box(x, y, sz, sz, C.ink); continue; }
      const def = NR.data.weapons[w.id], col = weaponColor(def);
      let rate = 1;
      try { rate = NR.weapons.resolve(p, i).rate || 1; } catch (e) { rate = def && def.levels && def.levels[0] ? def.levels[0].rate || 1 : 1; }
      const ready = w.cd > 0 ? clamp(1 - w.cd * rate, 0, 1) : 1;
      const cool = w.cd > 0 && rate <= 5;
      box(x, y, sz, sz, C.slot);
      drawWeaponIcon(ctx, w.id, x + sz / 2, y + sz / 2 - 4 * u, 18 * u, cool ? mute(col) : col, { line: 2.5 * u, shadow: 2.5 * u, cool: cool });
      // cooldown fill strip along the bottom
      const bx = x + 3 * u, bw = sz - 6 * u, bh = 8 * u, by = y + sz - 3 * u - bh;
      ctx.fillStyle = C.ink; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = cool ? C.mute : col; ctx.fillRect(bx + u, by + u, Math.round((bw - 2 * u) * (cool ? ready : 1)), bh - 2 * u);
      // level badge
      const evolved = def && def.evolved;
      const ls = evolved ? 'EVO' : String(w.lvl);
      label(ls, x + sz - 6 * u, y + 12 * u, evolved ? 12 : 16, evolved ? C.gold : w.lvl >= NR.config.MAX_LEVEL ? C.gold : C.cream, 'right');
    }
  }
  const muteCache = {};
  function mute(hex) { return muteCache[hex] || (muteCache[hex] = NR.util.shade(hex, -0.45)); }

  function drawItems(p, ch) {
    const ids = Object.keys(p.items);
    if (!ids.length) return;
    const sz = 26 * u, gap = 6 * u, x0 = 16 * u, y = ch - 16 * u - 56 * u - 10 * u - sz;
    const per = 18;
    for (let i = 0; i < ids.length && i < per; i++) {
      const id = ids[i], def = NR.data.items[id], x = x0 + i * (sz + gap);
      const col = (def && (def.color || RCOL[def.rarity])) || C.cream;
      box(x, y, sz, sz, C.ink, 2.5 * u);
      drawItemIcon(ctx, id, x + sz / 2, y + sz / 2, 9 * u, col, { line: 1.8 * u, shadow: 1.5 * u });
      const n = p.items[id];
      if (n > 1) label(String(n), x + sz - 1 * u, y + sz - 3 * u, 11, C.cream, 'right');
    }
    if (ids.length > per) label('+' + (ids.length - per), x0 + per * (sz + gap), y + sz / 2, 14, C.mute, 'left');
  }
  function itemShape(def) { const r = def && def.rarity; return r === 'legendary' ? 'star' : r === 'epic' ? 'hex' : r === 'rare' ? 'diamond' : 'circle'; }

  function drawBanner(cw, ch) {
    const b = S.banner;
    if (!b || S.bannerT <= 0) return;
    const total = b.dur, el = total - S.bannerT, k = el < 0.22 ? el / 0.22 : S.bannerT < 0.25 ? S.bannerT / 0.25 : 1;
    const h = 84 * u, y = Math.round(ch * 0.26 - h / 2 - (1 - k) * 40 * u);
    ctx.fillStyle = C.ink2; ctx.fillRect(0, y + 5 * u, cw, h);
    ctx.fillStyle = C.ink; ctx.fillRect(0, y - 3 * u, cw, h + 6 * u);
    ctx.fillStyle = b.color; ctx.fillRect(0, y, cw, h);
    label(b.l1, cw / 2, y + h * 0.40, 38, C.cream, 'center');
    if (b.l2) label(b.l2, cw / 2, y + h * 0.78, 17, C.cream, 'center');
  }
  function drawToasts(cw, ch) {
    let y = ch - 84 * u;
    for (let i = S.toasts.length - 1; i >= 0; i--) {
      const q = S.toasts[i];
      ctx.font = '800 ' + Math.round(17 * u) + 'px ' + FONT;
      const tw = ctx.measureText ? ctx.measureText(q.text).width : q.text.length * 8, w = tw + 28 * u, h = 30 * u;
      box(Math.round((cw - w) / 2), y, w, h, C.panel, 2.5 * u);
      label(q.text, cw / 2, y + h / 2, 17, q.color || C.cream, 'center');
      y -= h + 8 * u;
    }
  }

  function toast(text, color) {
    if (!text) return;
    S.toasts.push({ text: String(text), color: color || C.cream, t: 2.4 });
    if (S.toasts.length > 4) S.toasts.shift();
  }

  function init() {
    if (inited) return;
    inited = true;
    const hasDom = typeof document !== 'undefined' && document.getElementById;
    canvas = hasDom ? document.getElementById('game') : null;
    ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    const E = NR.events;
    E.on('wave:start', function (e) {
      const z = NR.data.zones && NR.data.zones[e.zone], pal = z && z.palette ? z.palette : null;
      const endless = NR.world.get().endless;
      const l1 = e.isBoss ? upper(t('hud.bossWave', { n: e.wave })) : upper(endless ? t('hud.wave', { n: e.wave }) : t('hud.waveOf', { n: e.wave, max: NR.config.WAVES }));
      S.banner = { l1: l1, l2: z ? upper(tx(z.name)) : '', color: e.isBoss ? C.boss : (pal ? pal[4] : C.panel), dur: 1.8 };
      S.bannerT = S.banner.dur;
      S.lag = S.hp; S.lagHold = 0;
    });
    E.on('run:start', function () { S.toasts.length = 0; S.banner = null; S.bannerT = 0; S.hp = 1; S.lag = 1; S.gold = 0; S.bossId = 0; S.combo = 0; S.comboT = 0; S.comboRank = 0; });
    E.on('enemy:death', function () {
      S.combo = (S.combo || 0) + 1;
      S.comboT = 3.2;
      S.comboPop = 0.22;
      const oldRank = S.comboRank || 0;
      const newRank = S.combo >= 50 ? 6 : S.combo >= 35 ? 5 : S.combo >= 24 ? 4 : S.combo >= 15 ? 3 : S.combo >= 9 ? 2 : S.combo >= 4 ? 1 : 0;
      S.comboRank = newRank;
      if (newRank > oldRank && newRank >= 3 && NR.fx && NR.fx.audio && NR.fx.audio.sfx) {
        NR.fx.audio.sfx('confirm', { pitch: 1.1 + newRank * 0.1 });
      }
    });
    E.on('player:hurt', function (e) { if (!e.dodged && e.amount > 0) { S.hurt = 0.18; S.lagHold = 0.45; } });
    E.on('player:levelup', function (e) { toast(t('hud.toastLevel', { n: e.level }), C.xp); });
    E.on('weapon:evolve', function (e) { const d = NR.data.weapons[e.into]; toast(t('hud.toastEvolve', { name: d ? tx(d.name) : e.into }), C.gold); });
    E.on('codex:discover', function (e) {
      const m = { weapon: NR.data.weapons, item: NR.data.items, enemy: NR.data.enemies, boss: NR.data.bosses, character: NR.data.characters }[e.kind], d = m && m[e.id];
      toast(t('hud.toastCodex', { name: d ? tx(d.name) : e.id }), C.good);
    });
    E.on('boss:death', function () { toast(t('hud.toastBoss'), C.gold); });
    // draw after FX: wrap render.draw once (FX may call NR.ui.hud.draw itself, then we skip ours)
    const R = NR.fx && NR.fx.render;
    if (ctx && R && typeof R.draw === 'function' && !R.draw.__hud) {
      orig = R.draw;
      const wrapped = function (W, alpha) {
        const before = hudCalls;
        orig.call(R, W, alpha);
        if (hudCalls === before) draw(ctx, W, alpha);
      };
      wrapped.__hud = true;
      R.draw = wrapped;
    }
    if (hasDom && globalThis.addEventListener) globalThis.addEventListener('resize', calcScale);
    if (canvas) calcScale();
  }

  NR.ui.hud = {
    init: init, update: update, draw: draw, toast: toast, shape: drawShape, colors: C,
    drawWeapon: drawWeaponIcon, drawItem: drawItemIcon, drawCharacter: drawCharacterIcon,
    drawPickup: drawPickupIcon, drawStat: drawStatIcon, drawEnemy: drawEnemyIcon, drawBoss: drawBossIcon, drawEntityIcon: drawEntityIcon
  };
})();
