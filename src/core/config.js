(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  const C = {
    STEP: 1 / 60,
    ARENA: { w: 2400, h: 1600 },
    VIEW: { w: 1280, h: 720 },
    CAPS: { enemies: 400, proj: 600, particles: 1500, decals: 300, texts: 60 },
    SHADOW: { x: 3, y: 4 },
    INK: '#14121F',
    ELEMENT_COLORS: {
      physical: '#F2EFE6', fire: '#FF7A2F', ice: '#7FD3F0',
      shock: '#FFD43B', poison: '#8BD450', void: '#A25CE0'
    },
    HURT_IFRAMES: 0.6,
    MAX_LEVEL: 5, // weapon level cap
    WAVES: 15,
    BOSS_WAVES: [5, 10, 15],
    SAVE_KEY: 'shardfall.save'
  };
  (function freeze(o) {
    Object.freeze(o);
    for (const k in o) if (o[k] && typeof o[k] === 'object') freeze(o[k]);
  })(C);
  NR.config = C;
})();
