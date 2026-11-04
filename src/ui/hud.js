// Owner: UI. Canvas HUD (HP + delayed damage, XP, wave/timer, gold, weapon slots, dash charges, boss bar, items, FPS).
// Drawn in screen space after NR.fx.render.draw (hud.js wraps render.draw once; if FX already calls hud.draw, it is not drawn twice).
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  NR.ui = NR.ui || {};
  const FONT = 'Bahnschrift, "Segoe UI", system-ui, sans-serif';
  const C = {
    ink: '#14121F', ink2: '#0B0A12', panel: '#251C38', panelHi: '#3A2E55', track: '#120F1C', cream: '#F6F0DF', mute: '#B8B0CC', hp: '#FF5C8A', hpLag: '#F6F0DF', hpLow: '#FF3D4F',
    xp: '#6FD6F2', gold: '#FFC23D', boss: '#E0476B', bossPlate: '#3A1730', dash: '#6FD6F2', good: '#8BD450', slot: '#30254A', evoSlot: '#4A3410', ult: '#B57CFF',
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

  // v2 weapons reuse a sibling's silhouette in their own element colour
  const ICON_ALIAS = { smg: 'pistol', venom_bow: 'lancer', frost_seeker: 'seeker', chakram: 'saw_ring', railgun: 'lancer', thunder_hammer: 'maul', comet_staff: 'grenade' };
  // rarity aura behind the icon: rare = soft halo, epic = halo + spikes, legendary/evolved = gold halo, spikes and sparkles
  function rarityAura(g, def, r, sil) {
    if (sil || !def) return;
    const tier = def.evolved ? 3 : def.rarity === 'legendary' ? 3 : def.rarity === 'epic' ? 2 : def.rarity === 'rare' ? 1 : 0;
    if (!tier) return;
    const art = NR.fx && NR.fx.art, col = tier >= 3 ? '#FFC23D' : RCOL[def.rarity] || '#B26CF5';
    const img = art && art.lightSprite ? art.lightSprite(col) : null;
    if (img) { g.globalAlpha = 0.45 + tier * 0.15; g.drawImage(img, -r * (1.5 + tier * 0.15), -r * (1.5 + tier * 0.15), r * (3 + tier * 0.3), r * (3 + tier * 0.3)); g.globalAlpha = 1; }
    if (tier >= 2) {
      const n = tier >= 3 ? 12 : 8;
      g.fillStyle = col;
      g.beginPath();
      for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * Math.PI * 2 + 0.2, rr2 = i % 2 ? r * 1.02 : r * (tier >= 3 ? 1.38 : 1.22); if (i) g.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); else g.moveTo(Math.cos(a) * rr2, Math.sin(a) * rr2); }
      g.closePath(); g.globalAlpha = tier >= 3 ? 0.5 : 0.32; g.fill(); g.globalAlpha = 1;
    }
    if (tier >= 3) {
      g.fillStyle = '#FFF6D0';
      const sp = [[-0.95, -0.7, 0.16], [0.9, -0.85, 0.12], [0.85, 0.8, 0.1]];
      for (let i = 0; i < sp.length; i++) { const sx = sp[i][0] * r, sy = sp[i][1] * r, k = sp[i][2] * r; g.beginPath(); g.moveTo(sx, sy - k * 2); g.lineTo(sx + k * 0.5, sy); g.lineTo(sx, sy + k * 2); g.lineTo(sx - k * 0.5, sy); g.closePath(); g.fill(); g.beginPath(); g.moveTo(sx - k * 2, sy); g.lineTo(sx, sy + k * 0.5); g.lineTo(sx + k * 2, sy); g.lineTo(sx, sy - k * 0.5); g.closePath(); g.fill(); }
    }
  }
  function drawWeaponIcon(g, id, x, y, r, fill, o) {
    o = o || {};
    const sil = !!o.sil, sh = sil ? 0 : (o.shadow === undefined ? Math.max(1.5, r * 0.12) : o.shadow);
    const lw = o.line === undefined ? Math.max(1.8, r * 0.1) : o.line;
    const def = NR.data && NR.data.weapons && NR.data.weapons[id];
    const col = fill || (def && def.color) || '#F2EFE6';
    g.save();
    g.translate(x, y);
    if (!o.cool && !o.noAura) rarityAura(g, def, r, sil);
    if (ICON_ALIAS[id]) id = ICON_ALIAS[id];
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
    combo: 0, comboT: 0, comboRank: 0, comboPop: 0, bossIntro: 0, bossHint: 0
  };
  const cache = {};
  function memo(key, sig, fn) { const c = cache[key]; if (c && c.s === sig) return c.v; const v = fn(); cache[key] = { s: sig, v: v }; return v; }
  const t = function (k, p) { return NR.i18n.t(k, p); };
  const tx = function (o) { return NR.i18n.text(o); };
  function upper(s) { try { return String(s).toLocaleUpperCase(NR.i18n.getLang()); } catch (e) { return String(s).toUpperCase(); } }
  function settings() { return NR.save ? NR.save.getSettings() : {}; }
  function mmss(sec) { sec = Math.max(0, Math.ceil(sec)); const m = Math.floor(sec / 60), s = sec % 60; return m + ':' + (s < 10 ? '0' : '') + s; }

  // ---------- layout: CSS px inside the safe area, scaled up on big screens only ----------
  const FT = '"Shard Title", "Baloo 2", Bahnschrift, "Segoe UI", system-ui, sans-serif';
  const FB = '"Shard Body", "Be Vietnam Pro", Bahnschrift, "Segoe UI", system-ui, sans-serif';
  const L = { w: 1280, h: 720, dpr: 1, l: 0, t: 0, r: 0, b: 0, ver: -1, touch: false, compact: false, pad: false };
  function px(v) { const n = parseFloat(v); return isFinite(n) ? n : 0; }
  function calcScale() { L.ver = -1; }
  function layout() {
    const R = NR.fx && NR.fx.render, V = R && R.view ? R.view() : null;
    const touch = !!(NR.ui.touch && NR.ui.touch.active && NR.ui.touch.active());
    if (V && V.ver === L.ver && touch === L.touch) return;
    L.touch = touch;
    if (V) { L.w = V.cssW; L.h = V.cssH; L.dpr = V.dpr; L.ver = V.ver; }
    else if (canvas) { L.w = canvas.width; L.h = canvas.height; L.dpr = 1; }
    try {
      const cs = globalThis.getComputedStyle(globalThis.document.documentElement);
      L.l = px(cs.getPropertyValue('--sal')); L.t = px(cs.getPropertyValue('--sat')); L.r = px(cs.getPropertyValue('--sar')); L.b = px(cs.getPropertyValue('--sab'));
    } catch (e) { L.l = L.t = L.r = L.b = 0; }
    u = clamp(Math.min(L.w / 1280, L.h / 720), 1, 1.6);
    L.compact = L.h / u < 520;
  }

  // ---------- drawing primitives (opaque, flat, hard shadows, outlined text) ----------
  function rr(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
  }
  function box(x, y, w, h, fill, b, rad) {
    b = b === undefined ? 2.5 * u : b; rad = rad === undefined ? 8 * u : rad;
    ctx.fillStyle = C.ink2; rr(x + 2 * u, y + 3 * u, w, h, rad); ctx.fill();
    ctx.fillStyle = C.ink; rr(x, y, w, h, rad); ctx.fill();
    ctx.fillStyle = fill; rr(x + b, y + b, w - 2 * b, h - 2 * b, Math.max(0, rad - b)); ctx.fill();
    ctx.fillStyle = C.panelHi; ctx.fillRect(x + b + rad * 0.6, y + b, w - 2 * b - rad * 1.2, Math.max(1, 1.5 * u));
  }
  function label(str, x, y, size, color, align, title) {
    ctx.font = (title ? '800 ' : '700 ') + Math.round(size * u) + 'px ' + (title ? FT : FB);
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size * u * 0.26); ctx.strokeStyle = C.ink;
    ctx.strokeText(str, x, y);
    ctx.fillStyle = color; ctx.fillText(str, x, y);
  }
  // pill bar: ink rim, dark track, delayed "lag" fill, value fill with a lighter top band
  function bar(x, y, w, h, frac, fill, lag, lagColor, hiColor) {
    const r = h / 2, b = Math.max(2, 2 * u);
    ctx.fillStyle = C.ink2; rr(x + 2 * u, y + 2.5 * u, w, h, r); ctx.fill();
    ctx.fillStyle = C.ink; rr(x, y, w, h, r); ctx.fill();
    ctx.fillStyle = C.track; rr(x + b, y + b, w - 2 * b, h - 2 * b, r - b); ctx.fill();
    const iw = w - 2 * b, ih = h - 2 * b;
    ctx.save(); rr(x + b, y + b, iw, ih, r - b); ctx.clip();
    if (lag > frac) { ctx.fillStyle = lagColor; ctx.fillRect(x + b, y + b, Math.round(iw * clamp(lag, 0, 1)), ih); }
    const fw = Math.round(iw * clamp(frac, 0, 1));
    ctx.fillStyle = fill; ctx.fillRect(x + b, y + b, fw, ih);
    if (hiColor && fw > 0) { ctx.fillStyle = hiColor; ctx.fillRect(x + b, y + b + Math.max(1, ih * 0.14), fw, Math.max(1, ih * 0.22)); }
    ctx.restore();
  }
  const hiCache = {};
  function hi(c) { return hiCache[c] || (hiCache[c] = NR.util.shade(c, 0.45)); }

  // ---------- update (real-time dt, every frame) ----------
  function update(dt) {
    if (NR.ui.screens && NR.ui.screens.tick) NR.ui.screens.tick(dt);
    if (NR.ui.touch && NR.ui.touch.tick) NR.ui.touch.tick();
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
      if (S.bossId !== b.id) { S.bossId = b.id; S.boss = 1; S.bossLag = 1; S.bossHold = 0; S.bossIntro = 2.6; }
      const f = clamp(b.hp / b.maxHp, 0, 1);
      if (f < S.boss - 1e-6) S.bossHold = 0.5;
      S.boss = f;
      if (f >= S.bossLag) S.bossLag = f;
      else if (S.bossHold > 0) S.bossHold -= dt;
      else S.bossLag = Math.max(f, S.bossLag - 0.4 * dt);
    }
    if (S.bossIntro > 0) S.bossIntro -= dt;
    if (S.bossHint > 0) S.bossHint -= dt;
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
    layout();
    ctx.save();
    if (ctx.setTransform) ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    ctx.globalAlpha = 1;
    const calm = !!settings().reduceFlashing;
    const cw = L.w, ch = L.h;
    drawFrameWarn(p, cw, ch, calm);
    const x0 = L.l + 12 * u, y0 = L.t + 10 * u, x1 = cw - L.r - 12 * u, y1 = ch - L.b - 10 * u;
    const vitalsW = drawVitals(p, W, x0, y0);
    drawWave(W, cw, y0);
    const goldBottom = drawGold(p, W, x1 - (L.touch ? 56 * u : 0), y0);
    drawCombo(x1 - (L.touch ? 56 * u : 0), goldBottom + 8 * u);
    drawBoss(W, cw, y0 + 62 * u, vitalsW);
    drawDash(p, cw, y1);
    if (L.touch) drawWeaponsRow(p, x0 + 66 * u, y0 + 52 * u);
    else { drawWeapons(p, x0, y1); drawItems(p, x0, y1 - 58 * u); }
    drawBanner(cw, ch);
    drawAlerts(p, W, cw, ch);
    drawToasts(cw, y1 - 34 * u);
    ctx.restore();
  }

  function drawFrameWarn(p, cw, ch, calm) {
    const low = p.maxHp > 0 && p.hp / p.maxHp <= 0.3 && !p.dead, hit = S.hurt > 0 && !calm;
    if (!low && !hit) return;
    let th = (low ? 5 : 0) * u;
    if (low && !calm) th += (Math.sin(S.time * 7) > 0 ? 4 : 0) * u;
    if (hit) th = 12 * u;
    ctx.fillStyle = hit ? C.cream : C.hpLow;
    ctx.fillRect(0, 0, cw, th); ctx.fillRect(0, ch - th, cw, th); ctx.fillRect(0, th, th, ch - 2 * th); ctx.fillRect(cw - th, th, th, ch - 2 * th);
  }

  // portrait medallion (ULT ring around it) + level badge + HP pill + XP pill. Returns the cluster width.
  function drawVitals(p, W, x, y) {
    const R = 25 * u, cx = x + R, cy = y + R + 1 * u;
    const chg = clamp((p.ultCharge || 0) / 100, 0, 1), ready = chg >= 1;
    // medallion
    ctx.fillStyle = C.ink2; ctx.beginPath(); ctx.arc(cx + 2 * u, cy + 3 * u, R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.track; ctx.beginPath(); ctx.arc(cx, cy, R - 4.5 * u, 0, Math.PI * 2); ctx.fill();
    // ULT charge ring
    ctx.lineCap = 'round'; ctx.lineWidth = 4 * u;
    if (chg > 0) {
      const pulse = ready && !settings().reduceFlashing ? 0.5 + 0.5 * Math.sin(S.time * 6) : 1;
      ctx.strokeStyle = ready ? (pulse > 0.5 ? C.gold : C.ult) : C.ult;
      ctx.beginPath(); ctx.arc(cx, cy, R - 2.25 * u, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * chg); ctx.stroke();
    }
    ctx.lineCap = 'butt';
    ctx.fillStyle = C.panel; ctx.beginPath(); ctx.arc(cx, cy, R - 6.5 * u, 0, Math.PI * 2); ctx.fill();
    drawCharacterIcon(ctx, p.charId, cx, cy + 1 * u, 13 * u, p.color || C.cream, { line: 2 * u, shadow: 1.5 * u });
    // level badge
    const bx = cx + R * 0.72, by = cy + R * 0.72, br = 11 * u, pend = p.pending > 0;
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = pend ? C.gold : C.xp; ctx.beginPath(); ctx.arc(bx, by, br - 2.2 * u, 0, Math.PI * 2); ctx.fill();
    ctx.font = '800 ' + Math.round(13 * u) + 'px ' + FT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.ink;
    ctx.fillText(String(p.level), bx, by + 1 * u);
    // HP + XP pills
    const bxL = x + 2 * R + 8 * u, w = clamp(Math.round((L.w - L.l - L.r) * 0.2), 150 * u, 250 * u), low = S.hp <= 0.3;
    bar(bxL, y + 2 * u, w, 24 * u, S.hp, low ? C.hpLow : C.hp, S.lag, C.hpLag, hi(low ? C.hpLow : C.hp));
    const hpTxt = memo('hp', Math.ceil(p.hp) + '/' + p.maxHp, function () { return NR.util.fmt(Math.ceil(p.hp)) + ' / ' + NR.util.fmt(p.maxHp); });
    label(hpTxt, bxL + w / 2, y + 14.5 * u, 14, C.cream, 'center', true);
    const need = NR.stats.xpNeed(p.level), xf = need > 0 ? p.xp / need : 0;
    bar(bxL, y + 30 * u, w, 11 * u, xf, C.xp, 0, C.xp, null);
    if (pend) label('+' + p.pending, bxL + w + 6 * u, y + 35 * u, 13, C.gold, 'left', true);
    if (ready && !L.touch) {
      const key = NR.input && NR.world.get() && L.pad ? 'Y' : 'Q';
      const s = memo('ult' + NR.i18n.getLang(), key, function () { return t('hud.ultReady', { key: key }); });
      label(s, bxL, y + 52 * u, 12, C.gold, 'left');
    }
    return 2 * R + 8 * u + w + 24 * u;
  }

  const RANK_COL = ['', '#B8B0CC', '#4FA8F0', '#8BD450', '#FFC23D', '#FF7A2F', '#FF5C8A'];
  const RANK_L = ['', 'D', 'C', 'B', 'A', 'S', 'SSS'];
  const RANK_K = ['', 'hud.combo1', 'hud.combo2', 'hud.combo3', 'hud.combo4', 'hud.combo5', 'hud.combo6'];
  function drawCombo(right, y) {
    if (!S.combo || S.combo < 3 || S.comboT <= 0) return;
    const rk = S.comboRank || 1, col = RANK_COL[rk] || C.mute, lang = NR.i18n.getLang();
    const name = memo('cn' + lang, rk, function () { return upper(t(RANK_K[rk])); });
    const hits = memo('ch' + lang, S.combo, function () { return t('hud.hits', { n: S.combo }); });
    ctx.font = '700 ' + Math.round(12 * u) + 'px ' + FB;
    const tw = Math.max(ctx.measureText(name).width, ctx.measureText(hits).width);
    const w = tw + 54 * u, h = 40 * u, x = right - w;
    box(x, y, w, h, C.panel);
    const pop = S.comboPop > 0 ? 1.18 : 1.0;
    label(RANK_L[rk], x + 22 * u, y + h / 2 + 1 * u, (rk === 6 ? 15 : 22) * pop, col, 'center', true);
    label(hits, x + 42 * u, y + 13 * u, 12, C.cream, 'left');
    label(name, x + 42 * u, y + 27 * u, 12, col, 'left');
    const f = clamp(S.comboT / 3.2, 0, 1);
    ctx.fillStyle = col; ctx.fillRect(x + 8 * u, y + h - 5 * u, (w - 16 * u) * f, 2 * u);
  }

  function drawWave(W, cw, y) {
    const w = 132 * u, h = 50 * u, x = Math.round((cw - w) / 2);
    box(x, y, w, h, C.panel, 2.5 * u, 12 * u);
    const lang = NR.i18n.getLang(), endless = !!W.endless;
    const ws = memo('wave', lang + ':' + W.wave + ':' + endless, function () {
      return upper(endless ? t('hud.wave', { n: W.wave }) : t('hud.waveOf', { n: W.wave, max: NR.config.WAVES }));
    });
    label(ws, x + w / 2, y + 14 * u, 12, C.mute, 'center');
    let main, col = C.cream;
    const isBoss = !!(W.boss && !W.boss.dead);
    if (W.state === 'clear') { main = upper(t('hud.clear')); col = C.good; }
    else if (isBoss) { main = upper(t('hud.boss')); col = C.boss; }
    else { main = mmss(W.waveT); if (W.waveT <= 5 && W.waveT > 0 && W.state === 'wave') col = C.hpLow; }
    label(main, x + w / 2, y + 33 * u, 24, col, 'center', true);
  }

  function drawGold(p, W, right, y) {
    const pop = S.goldPop > 0 ? 1.12 : 1;
    const str = memo('gold', p.gold, function () { return NR.util.fmt(p.gold); });
    ctx.font = '800 ' + Math.round(22 * u) + 'px ' + FT;
    const tw = ctx.measureText ? ctx.measureText(str).width : 40;
    const h = 40 * u, w = Math.max(84 * u, tw + 52 * u), x = right - w;
    box(x, y, w, h, C.panel, 2.5 * u, 20 * u);
    drawShape(ctx, 'gold', x + 20 * u, y + h / 2, 9.5 * u * pop, C.gold, { line: 2 * u, shadow: 1.5 * u });
    label(str, right - 14 * u, y + h / 2 + 1 * u, 22 * pop, C.gold, 'right', true);
    let bottom = y + h;
    if (settings().showFps && NR.loop && NR.loop.fps) {
      const f = Math.round(NR.loop.fps());
      label('FPS ' + f, right - 4 * u, bottom + 12 * u, 12, f < 45 ? C.hpLow : C.mute, 'right');
      bottom += 20 * u;
    }
    return bottom;
  }

  function drawBoss(W, cw, y, side) {
    const b = W.boss;
    if (!b || b.dead || !b.maxHp) return;
    const def = NR.data.bosses && NR.data.bosses[b.defId];
    const w = Math.min(560 * u, cw - 2 * Math.max(side, 150 * u) - L.l - L.r), h = 18 * u, x = Math.round((cw - w) / 2), by = y + 22 * u;
    const nm = def ? upper(tx(def.name)) : upper(t('hud.boss'));
    const phases = def && def.phases ? def.phases : [];
    label(nm, x + 4 * u, y + 9 * u, 15, C.cream, 'left', true);
    const ph = b.phase || 1, tot = phases.length || 1;
    label(t('hud.phase', { n: ph, max: tot }), x + w - 4 * u, y + 9 * u, 12, C.mute, 'right');
    bar(x, by, w, h, S.boss, C.boss, S.bossLag, C.hpLag, hi(C.boss));
    const bw = w - 4 * u;
    for (let i = 1; i < phases.length; i++) {
      const bl = phases[i] && phases[i].below;
      if (typeof bl !== 'number' || bl <= 0 || bl >= 1) continue;
      const pxl = Math.round(x + 2 * u + bw * bl);
      ctx.fillStyle = S.boss < bl ? C.cream : C.ink; ctx.fillRect(pxl - Math.round(1.5 * u), by + 2 * u, Math.max(2, Math.round(3 * u)), h - 4 * u);
    }
    if (b.flags && b.flags.enraged) label(upper(t('hud.enrage')), x + w / 2, by + h + 12 * u, 13, (Math.sin(S.time * 8) > 0 || settings().reduceFlashing) ? C.hpLow : C.cream, 'center', true);
    // boss intro card: name plate slides in under the bar for the first seconds
    if (S.bossIntro > 0 && def) {
      const k = clamp(Math.min((2.6 - S.bossIntro) / 0.3, S.bossIntro / 0.4), 0, 1);
      const pw = Math.min(cw - 32 * u, 420 * u), ph2 = 64 * u, pxx = (cw - pw) / 2, pyy = L.h * 0.3 - (1 - k) * 24 * u;
      ctx.globalAlpha = k;
      box(pxx, pyy, pw, ph2, C.bossPlate, 3 * u, 10 * u);
      label(nm, cw / 2, pyy + ph2 * 0.42, 28, C.cream, 'center', true);
      label(upper(t('hud.boss')), cw / 2, pyy + ph2 * 0.8, 12, C.gold, 'center');
      ctx.globalAlpha = 1;
    }
  }

  function drawDash(p, cw, y1) {
    const d = p.dash;
    if (!d || !d.max) return;
    const pw = 26 * u, ph = 10 * u, gap = 6 * u, n = d.max, total = n * pw + (n - 1) * gap;
    let x = Math.round((cw - total) / 2);
    const y = y1 - ph;
    const cdT = p.stats && p.stats.dashCooldown ? p.stats.dashCooldown : 1.2;
    for (let i = 0; i < n; i++) {
      let f = 0;
      if (i < d.charges) f = 1;
      else if (i === d.charges) f = clamp(1 - d.cd / cdT, 0, 1);
      bar(x, y, pw, ph, f, i < d.charges ? C.dash : C.mute, 0, C.mute, null);
      x += pw + gap;
    }
  }

  function weaponColor(def) { return (def && def.color) || (def && RCOL[def.rarity]) || C.cream; }
  function weaponReady(p, i, w, def) {
    let rate = 1;
    try { rate = NR.weapons.resolve(p, i).rate || 1; } catch (e) { rate = def && def.levels && def.levels[0] ? def.levels[0].rate || 1 : 1; }
    return { ready: w.cd > 0 ? clamp(1 - w.cd * rate, 0, 1) : 1, cool: w.cd > 0 && rate <= 5 };
  }
  function drawWeapons(p, x0, y1) {
    const sz = 50 * u, gap = 7 * u, y = y1 - sz;
    const slots = Math.max(p.weapons.length, Math.round(p.stats && p.stats.weaponSlots ? p.stats.weaponSlots : 4));
    for (let i = 0; i < slots; i++) {
      const x = x0 + i * (sz + gap), w = p.weapons[i];
      if (!w) { box(x, y, sz, sz, C.track, 2.5 * u, 9 * u); continue; }
      const def = NR.data.weapons[w.id], col = weaponColor(def), r = weaponReady(p, i, w, def);
      const evolved = def && def.evolved;
      box(x, y, sz, sz, evolved ? C.evoSlot : C.slot, 2.5 * u, 9 * u);
      drawWeaponIcon(ctx, w.id, x + sz / 2, y + sz / 2 - 3 * u, 16 * u, r.cool ? mute(col) : col, { line: 2.2 * u, shadow: 2 * u, cool: r.cool });
      const bx = x + 6 * u, bw = sz - 12 * u, by = y + sz - 10 * u;
      ctx.fillStyle = C.ink; ctx.fillRect(bx, by, bw, 4 * u);
      ctx.fillStyle = r.cool ? C.mute : col; ctx.fillRect(bx, by, Math.round(bw * (r.cool ? r.ready : 1)), 4 * u);
      const ls = evolved ? '★' : String(w.lvl);
      label(ls, x + sz - 7 * u, y + 11 * u, 13, evolved || w.lvl >= NR.config.MAX_LEVEL ? C.gold : C.cream, 'right', true);
    }
  }
  // touch: compact row under the vitals, away from both thumbs
  function drawWeaponsRow(p, x0, y) {
    const sz = 30 * u, gap = 5 * u;
    for (let i = 0; i < p.weapons.length; i++) {
      const w = p.weapons[i], x = x0 + i * (sz + gap), def = NR.data.weapons[w.id], col = weaponColor(def), r = weaponReady(p, i, w, def);
      box(x, y, sz, sz, def && def.evolved ? C.evoSlot : C.slot, 2 * u, 7 * u);
      drawWeaponIcon(ctx, w.id, x + sz / 2, y + sz / 2, 10 * u, r.cool ? mute(col) : col, { line: 1.6 * u, shadow: 1.2 * u, cool: r.cool });
      if (r.cool) { ctx.fillStyle = col; ctx.fillRect(x + 4 * u, y + sz - 6 * u, (sz - 8 * u) * r.ready, 2.5 * u); }
      label(def && def.evolved ? '★' : String(w.lvl), x + sz - 3 * u, y + 5 * u, 12, C.cream, 'right', true);
    }
  }
  const muteCache = {};
  function mute(hex) { return muteCache[hex] || (muteCache[hex] = NR.util.shade(hex, -0.45)); }

  function drawItems(p, x0, y1) {
    const ids = Object.keys(p.items);
    if (!ids.length) return;
    const sz = 26 * u, gap = 5 * u, y = y1 - sz;
    const per = 14;
    for (let i = 0; i < ids.length && i < per; i++) {
      const id = ids[i], def = NR.data.items[id], x = x0 + i * (sz + gap);
      const col = (def && (def.color || RCOL[def.rarity])) || C.cream;
      box(x, y, sz, sz, C.track, 2 * u, 6 * u);
      drawItemIcon(ctx, id, x + sz / 2, y + sz / 2, 8.5 * u, col, { line: 1.6 * u, shadow: 1.2 * u });
      const n = p.items[id];
      if (n > 1) label(String(n), x + sz - 1 * u, y + sz - 4 * u, 12, C.cream, 'right', true);
    }
    if (ids.length > per) label('+' + (ids.length - per), x0 + per * (sz + gap), y + sz / 2, 13, C.mute, 'left', true);
  }
  function itemShape(def) { const r = def && def.rarity; return r === 'legendary' ? 'star' : r === 'epic' ? 'hex' : r === 'rare' ? 'diamond' : 'circle'; }

  function drawBanner(cw, ch) {
    const b = S.banner;
    if (!b || S.bannerT <= 0) return;
    const total = b.dur, el = total - S.bannerT, k = el < 0.22 ? el / 0.22 : S.bannerT < 0.25 ? S.bannerT / 0.25 : 1;
    const h = 72 * u, y = Math.round(ch * 0.3 - h / 2), slide = (1 - k) * cw * 0.12;
    ctx.globalAlpha = clamp(k * 1.4, 0, 1);
    ctx.fillStyle = C.ink2; ctx.fillRect(0, y + 5 * u, cw, h);
    ctx.fillStyle = C.ink; ctx.fillRect(0, y - 3 * u, cw, h + 6 * u);
    ctx.fillStyle = b.color; ctx.fillRect(0, y, cw, h);
    ctx.fillStyle = C.ink; ctx.fillRect(0, y + h - 6 * u, cw, 2 * u);
    label(b.l1, cw / 2 - slide, y + h * 0.42, 32, C.cream, 'center', true);
    if (b.l2) label(b.l2, cw / 2 + slide, y + h * 0.8, 13, C.cream, 'center');
    ctx.globalAlpha = 1;
  }
  // situational callouts: grabbed by a Snatcher, boss weak point / barrier tips
  function drawAlerts(p, W, cw, ch) {
    let msg = '', col = C.cream;
    const b = W.boss;
    if (p.grabbedBy) { msg = t('hud.breakFree'); col = C.hpLow; }
    else if (b && !b.dead && b.flags && b.flags.barrier) { msg = t('hud.barrier'); col = '#6FD6F2'; }
    else if (S.bossHint > 0 && b && !b.dead) { msg = t('hud.bossHint'); col = C.gold; }
    if (!msg) return;
    const pulse = settings().reduceFlashing ? 1 : 0.85 + 0.15 * Math.sin(S.time * 10);
    ctx.font = '800 ' + Math.round(16 * u) + 'px ' + FT;
    const w = (ctx.measureText ? ctx.measureText(msg).width : msg.length * 9) + 30 * u, h = 34 * u, x = (cw - w) / 2, y = ch * 0.68;
    box(x, y, w, h, C.panel, 2.5 * u, 17 * u);
    ctx.globalAlpha = pulse; label(msg, cw / 2, y + h / 2 + 1 * u, 16, col, 'center', true); ctx.globalAlpha = 1;
  }
  function drawToasts(cw, yb) {
    let y = yb - 30 * u;
    for (let i = S.toasts.length - 1; i >= 0; i--) {
      const q = S.toasts[i];
      ctx.font = '700 ' + Math.round(14 * u) + 'px ' + FB;
      const tw = ctx.measureText ? ctx.measureText(q.text).width : q.text.length * 8, w = tw + 28 * u, h = 28 * u;
      box(Math.round((cw - w) / 2), y, w, h, C.panel, 2 * u, 14 * u);
      label(q.text, cw / 2, y + h / 2, 14, q.color || C.cream, 'center');
      y -= h + 6 * u;
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
    E.on('input:device', function (e) { L.pad = e.device === 'pad'; });
    E.on('player:hurt', function (e) { if (!e.dodged && e.amount > 0) { S.hurt = 0.18; S.lagHold = 0.45; } });
    E.on('player:levelup', function (e) { toast(t('hud.toastLevel', { n: e.level }), C.xp); });
    E.on('weapon:evolve', function (e) { const d = NR.data.weapons[e.into]; toast(t('hud.toastEvolve', { name: d ? tx(d.name) : e.into }), C.gold); });
    E.on('codex:discover', function (e) {
      const m = { weapon: NR.data.weapons, item: NR.data.items, enemy: NR.data.enemies, boss: NR.data.bosses, character: NR.data.characters }[e.kind], d = m && m[e.id];
      toast(t('hud.toastCodex', { name: d ? tx(d.name) : e.id }), C.good);
    });
    E.on('boss:death', function () { toast(t('hud.toastBoss'), C.gold); });
    E.on('enemy:spawn', function (e) {
      const en = e.enemy;
      if (en && en.flags && en.flags.special && !en.flags.structure) { const d = NR.data.enemies[en.defId]; toast(t('hud.special', { name: d ? tx(d.name) : en.defId }), C.hpLow); }
    });
    E.on('boss:phase', function (e) { if (e.phase === 0) S.bossHint = 7; });
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
