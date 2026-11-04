// Owner: Progression. The 30 items of the registry. Every number lives here once; descriptions are generated from it.
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  NR.data = NR.data || {};
  const I = {};

  // Hook value spec: a number is constant; S(base, perExtraStack, limit) grows (or shrinks) per stack and is clamped to limit.
  function S(base, per, limit) { return [base, per, limit]; }
  function val(spec, n) {
    if (!Array.isArray(spec)) return spec;
    const v = spec[0] + spec[1] * Math.max(0, (n || 1) - 1);
    return spec[1] >= 0 ? Math.min(v, spec[2]) : Math.max(v, spec[2]);
  }

  // stat labels: [vi, en, kind] kind 'pct' = fraction shown as %, 'num' = plain number
  const LBL = {
    maxHp: ['Máu tối đa', 'Max HP', 'num'], hpRegen: ['Hồi máu/s', 'HP Regen/s', 'num'], armor: ['Giáp', 'Armor', 'num'], dodge: ['Né tránh', 'Dodge', 'pct'],
    moveSpeed: ['Tốc độ chạy', 'Move Speed', 'pct'], dashCharges: ['Lần lướt', 'Dash Charges', 'num'], dashCooldown: ['Hồi lướt', 'Dash Cooldown', 'pct'],
    damage: ['Sát thương', 'Damage', 'pct'], attackSpeed: ['Tốc độ bắn', 'Attack Speed', 'pct'], critChance: ['Tỉ lệ chí mạng', 'Crit Chance', 'pct'],
    critDamage: ['Sát thương chí mạng', 'Crit Damage', 'pct'], area: ['Vùng đánh', 'Area', 'pct'], range: ['Tầm', 'Range', 'pct'], projectiles: ['Đạn', 'Projectiles', 'num'],
    pierce: ['Xuyên', 'Pierce', 'num'], pickupRange: ['Tầm hút', 'Pickup Range', 'pct'], xpGain: ['Kinh nghiệm', 'XP Gain', 'pct'], goldGain: ['Vàng', 'Gold Gain', 'pct'],
    luck: ['May mắn', 'Luck', 'pct'], statusPower: ['Sức hiệu ứng', 'Status Power', 'pct'], revives: ['Hồi sinh', 'Revives', 'num'], weaponSlots: ['Ô vũ khí', 'Weapon Slots', 'num'],
    shopDiscount: ['Giảm giá cửa hàng', 'Shop Discount', 'pct'], startGold: ['Vàng khởi đầu', 'Starting Gold', 'num']
  };
  function num(v) { return String(Math.round(v * 100) / 100); }
  function pc(v) { return num(v * 100) + '%'; }
  function sign(v) { return v < 0 ? '-' : '+'; }
  // "+10% Move Speed, -6% Max HP"
  function modText(mods, lang) {
    const out = [];
    for (let i = 0; i < mods.length; i++) {
      const m = mods[i], l = LBL[m.stat] || [m.stat, m.stat, 'num'], name = lang === 'vi' ? l[0] : l[1];
      const v = m.pct !== undefined && m.pct !== 0 ? m.pct : (m.add || 0);
      const isPct = (m.pct !== undefined && m.pct !== 0) || l[2] === 'pct';
      out.push(sign(v) + (isPct ? pc(Math.abs(v)) : num(Math.abs(v))) + ' ' + name);
    }
    return out.join(', ');
  }
  // {k} value, {k%} as percent, {k+} per-extra-stack delta, {k+%} delta as percent
  function render(tpl, P) {
    return tpl.replace(/\{(\w+)(\+)?(%)?\}/g, function (m, k, plus, pct) {
      const s = P[k];
      if (s === undefined) return m;
      const v = plus ? (Array.isArray(s) ? Math.abs(s[1]) : 0) : val(s, 1);
      return pct ? pc(v) : num(v);
    });
  }
  function flat(hooks) {
    const P = {};
    for (let i = 0; i < hooks.length; i++) for (const k in hooks[i].p) P[k] = hooks[i].p[k];
    return P;
  }
  function isCatalyst(id) {
    const ev = NR.data.evolutions || [];
    for (let i = 0; i < ev.length; i++) if (ev[i].catalyst === id) return true;
    return false;
  }
  function evolvesText(id, lang) {
    const ev = NR.data.evolutions || [], W = NR.data.weapons || {};
    for (let i = 0; i < ev.length; i++) {
      if (ev[i].catalyst !== id) continue;
      const w = W[ev[i].weapon], t = W[ev[i].into];
      const a = w ? w.name[lang] : ev[i].weapon, b = t ? t.name[lang] : ev[i].into;
      return lang === 'vi' ? 'Chất xúc tác: ' + a + ' cấp tối đa tiến hóa thành ' + b + '.' : 'Catalyst: a max-level ' + a + ' evolves into ' + b + '.';
    }
    return '';
  }

  // it(id, rarity, vi, en, cost, def{mods,hooks,tpl{vi,en},cat,maxStack})
  const STACK = { common: 5, rare: 3, epic: 1, legendary: 1 };
  function it(id, rarity, vi, en, cost, d) {
    d = d || {};
    const o = {
      name: { vi: vi, en: en }, rarity: rarity, cost: cost, catalyst: !!d.cat || isCatalyst(id), maxStack: d.maxStack || STACK[rarity],
      mods: d.mods || [], hooks: d.hooks || [], tradeoff: !(d.hooks && d.hooks.length), tpl: d.tpl || null
    };
    const P = flat(o.hooks), desc = {};
    ['vi', 'en'].forEach(function (lang) {
      const parts = [];
      if (o.mods.length) parts.push(modText(o.mods, lang) + (o.tpl ? '.' : ''));
      if (o.tpl) parts.push(render(o.tpl[lang], P));
      if (o.catalyst) { const e = evolvesText(id, lang); if (e) parts.push(e); }
      desc[lang] = parts.join(' ');
    });
    o.desc = desc;
    I[id] = o;
  }
  function H(on, fx, p) { return { on: on, fx: fx, p: p || {} }; }

  // ---- common (10): stat trade-offs, a plus with a minus ----
  it('rubber_boots', 'common', 'Ủng cao su', 'Rubber Boots', 20, { mods: [{ stat: 'moveSpeed', pct: 0.1 }, { stat: 'maxHp', pct: -0.06 }] });
  it('lucky_coin', 'common', 'Đồng xu may mắn', 'Lucky Coin', 20, { mods: [{ stat: 'goldGain', pct: 0.15 }, { stat: 'xpGain', pct: -0.05 }] });
  it('thick_hide', 'common', 'Da dày', 'Thick Hide', 20, { mods: [{ stat: 'maxHp', add: 20 }, { stat: 'moveSpeed', pct: -0.04 }] });
  it('sharp_edge', 'common', 'Lưỡi sắc', 'Sharp Edge', 22, { mods: [{ stat: 'damage', pct: 0.1 }, { stat: 'attackSpeed', pct: -0.05 }] });
  it('quick_fingers', 'common', 'Ngón tay nhanh', 'Quick Fingers', 22, { mods: [{ stat: 'attackSpeed', pct: 0.1 }, { stat: 'maxHp', pct: -0.05 }] });
  it('magnet_ring', 'common', 'Nhẫn nam châm', 'Magnet Ring', 18, { mods: [{ stat: 'pickupRange', pct: 0.3 }, { stat: 'area', pct: -0.04 }] });
  it('iron_plating', 'common', 'Giáp sắt', 'Iron Plating', 20, { mods: [{ stat: 'armor', add: 2 }, { stat: 'moveSpeed', pct: -0.05 }] });
  it('scope_lens', 'common', 'Kính ngắm', 'Scope Lens', 20, { mods: [{ stat: 'critChance', add: 0.05 }, { stat: 'attackSpeed', pct: -0.05 }] });
  it('heart_locket', 'common', 'Mề đay trái tim', 'Heart Locket', 20, { mods: [{ stat: 'hpRegen', add: 0.6 }, { stat: 'maxHp', pct: -0.08 }] });
  it('spring_heel', 'common', 'Gót lò xo', 'Spring Heel', 20, { mods: [{ stat: 'dashCooldown', pct: -0.1 }, { stat: 'damage', pct: -0.03 }] });

  // ---- rare (7 behaviours) ----
  it('vampire_fang', 'rare', 'Răng ma cà rồng', 'Vampire Fang', 45, {
    hooks: [H('kill', 'heal', { chance: S(0.08, 0.04, 0.3), heal: S(2, 1, 6) })],
    tpl: { vi: 'Khi hạ gục: {chance%} cơ hội hồi {heal} máu. Mỗi cộng dồn: +{chance+%} cơ hội, +{heal+} máu.', en: 'On kill: {chance%} chance to heal {heal} HP. Each extra stack: +{chance+%} chance, +{heal+} HP.' }
  });
  it('ember_charm', 'rare', 'Bùa lửa', 'Ember Charm', 45, {
    hooks: [H('hit', 'burst', { chance: S(0.1, 0.05, 0.3), r: 70, dmgPct: 0.5, element: 'fire', status: 'burn' })],
    tpl: { vi: 'Khi gây sát thương: {chance%} cơ hội nổ lửa bán kính {r} gây {dmgPct%} sát thương và thiêu đốt. Mỗi cộng dồn: +{chance+%} cơ hội.', en: 'On hit: {chance%} chance of a fire burst (radius {r}) dealing {dmgPct%} of the hit and igniting. Each extra stack: +{chance+%} chance.' }
  });
  it('frost_charm', 'rare', 'Bùa băng', 'Frost Charm', 45, {
    hooks: [H('dash', 'nova', { r: S(110, 25, 210), dmg: S(18, 10, 48), element: 'ice', status: 'freeze' })],
    tpl: { vi: 'Khi lướt: sóng băng bán kính {r} gây {dmg} sát thương và làm đóng băng. Mỗi cộng dồn: +{r+} bán kính, +{dmg+} sát thương.', en: 'On dash: frost nova (radius {r}) dealing {dmg} damage and freezing. Each extra stack: +{r+} radius, +{dmg+} damage.' }
  });
  it('static_charm', 'rare', 'Bùa tĩnh điện', 'Static Charm', 45, {
    hooks: [H('shot', 'zap', { cd: S(1.6, -0.25, 0.8), dmg: S(26, 10, 56) })],
    tpl: { vi: 'Khi đang bắn: cứ {cd}s một tia sét đánh kẻ gần nhất gây {dmg} sát thương (không phụ thuộc số súng hay tốc độ bắn). Mỗi cộng dồn: hồi nhanh hơn {cd+}s, +{dmg+} sát thương.', en: 'While firing: every {cd}s a bolt strikes the nearest enemy for {dmg} (independent of weapon count and fire rate). Each extra stack: {cd+}s faster, +{dmg+} damage.' }
  });
  it('venom_vial', 'rare', 'Lọ độc', 'Venom Vial', 45, {
    hooks: [H('kill', 'cloud', { chance: S(0.15, 0.07, 0.4), r: 70, dps: 8, life: 3, element: 'poison' })],
    tpl: { vi: 'Khi hạ gục: {chance%} cơ hội tạo đám mây độc ({r} bán kính, {life}s). Mỗi cộng dồn: +{chance+%} cơ hội.', en: 'On kill: {chance%} chance to leave a poison cloud (radius {r}, {life}s). Each extra stack: +{chance+%} chance.' }
  });
  it('void_shard', 'rare', 'Mảnh hư không', 'Void Shard', 45, {
    hooks: [H('hurt', 'burst', { chance: S(0.5, 0.25, 1), r: S(140, 20, 200), dmg: S(45, 15, 90), element: 'void' })],
    tpl: { vi: 'Khi bị đánh: {chance%} cơ hội nổ hư không bán kính {r} gây {dmg} sát thương. Mỗi cộng dồn: +{chance+%} cơ hội, +{dmg+} sát thương.', en: 'When hurt: {chance%} chance of a void burst (radius {r}) dealing {dmg}. Each extra stack: +{chance+%} chance, +{dmg+} damage.' }
  });
  it('bounty_badge', 'rare', 'Huy hiệu truy nã', 'Bounty Badge', 45, {
    hooks: [H('kill', 'bounty', { gold: S(8, 6, 26), chest: S(0.12, 0.08, 0.36) })],
    tpl: { vi: 'Hạ tinh anh hoặc trùm: +{gold} vàng và {chest%} cơ hội rơi rương. Mỗi cộng dồn: +{gold+} vàng, +{chest+%} cơ hội.', en: 'Killing an elite or boss: +{gold} gold and {chest%} chance to drop a chest. Each extra stack: +{gold+} gold, +{chest+%} chance.' }
  });

  // ---- rare catalysts (3): a stat plus a behaviour ----
  it('cat_overclock', 'rare', 'Siêu xung', 'Overclock', 50, {
    cat: true, mods: [{ stat: 'attackSpeed', pct: 0.1 }],
    hooks: [H('dash', 'buff', { key: 'overclock', stat: 'attackSpeed', amount: S(0.2, 0.1, 0.4), dur: 2.5 })],
    tpl: { vi: 'Khi lướt: +{amount%} tốc độ bắn trong {dur}s. Mỗi cộng dồn: +{amount+%}.', en: 'On dash: +{amount%} attack speed for {dur}s. Each extra stack: +{amount+%}.' }
  });
  it('cat_hollow_slug', 'rare', 'Đạn rỗng', 'Hollow Slug', 50, {
    cat: true, mods: [{ stat: 'damage', pct: 0.1 }],
    hooks: [H('hit', 'opener', { above: 0.9, bonus: S(0.4, 0.2, 1) })],
    tpl: { vi: 'Đòn đánh vào kẻ địch trên {above%} máu gây thêm {bonus%} sát thương. Mỗi cộng dồn: +{bonus+%}.', en: 'Hits on enemies above {above%} HP deal {bonus%} extra damage. Each extra stack: +{bonus+%}.' }
  });
  it('cat_fuel_tank', 'rare', 'Bình nhiên liệu', 'Fuel Tank', 50, {
    cat: true, mods: [{ stat: 'area', pct: 0.1 }],
    hooks: [H('kill', 'fireBurst', { chance: S(0.35, 0.15, 0.8), r: 80, hpPct: 0.3 })],
    tpl: { vi: 'Kẻ địch chết vì lửa: {chance%} cơ hội nổ bán kính {r}, gây {hpPct%} máu tối đa của nó. Mỗi cộng dồn: +{chance+%} cơ hội.', en: 'Enemies killed by fire: {chance%} chance to explode (radius {r}) for {hpPct%} of their max HP. Each extra stack: +{chance+%} chance.' }
  });

  // ---- epic ----
  it('phoenix_feather', 'epic', 'Lông phượng hoàng', 'Phoenix Feather', 90, {
    mods: [{ stat: 'revives', add: 1 }],
    hooks: [H('revive', 'nova', { r: 420, dmg: 200, element: 'fire', status: 'burn' }), H('revive', 'buff', { key: 'phoenix', stat: 'damage', amount: 0.25, dur: 10 })],
    tpl: { vi: 'Khi hồi sinh: bùng nổ bán kính {r} gây {dmg} sát thương và +{amount%} sát thương trong {dur}s.', en: 'On revive: a blast (radius {r}) dealing {dmg} and +{amount%} damage for {dur}s.' }
  });
  it('ghost_cloak', 'epic', 'Áo choàng ma', 'Ghost Cloak', 90, {
    mods: [{ stat: 'dodge', add: 0.08 }],
    hooks: [H('dodge', 'refund', { charges: 1 })],
    tpl: { vi: 'Khi né đòn: hoàn lại {charges} lần lướt.', en: 'On dodge: refund {charges} dash charge.' }
  });
  it('blast_core', 'epic', 'Lõi nổ', 'Blast Core', 90, {
    hooks: [H('kill', 'everyKill', { every: 10, r: 120, dmg: 45, element: 'fire' })],
    tpl: { vi: 'Mỗi {every} lần hạ gục: vụ nổ bán kính {r} gây {dmg} sát thương.', en: 'Every {every} kills: an explosion (radius {r}) dealing {dmg}.' }
  });
  it('cat_whetstone', 'epic', 'Đá mài', 'Whetstone', 80, {
    cat: true, mods: [{ stat: 'critDamage', add: 0.2 }],
    hooks: [H('hit', 'critSplash', { r: 60, mult: 0.5 })],
    tpl: { vi: 'Đòn chí mạng nổ bán kính {r}, gây {mult%} sát thương của đòn đó.', en: 'Critical hits burst (radius {r}) for {mult%} of the hit.' }
  });
  it('cat_swarm_core', 'epic', 'Lõi bầy đàn', 'Swarm Core', 80, {
    cat: true, mods: [{ stat: 'projectiles', add: 1 }],
    hooks: [H('kill', 'ramp', { key: 'swarm', stat: 'attackSpeed', step: 0.01, cap: 0.2 })],
    tpl: { vi: 'Mỗi lần hạ gục: +{step%} tốc độ bắn đến tối đa {cap%} (đặt lại mỗi đợt).', en: 'Each kill: +{step%} attack speed up to {cap%} (resets every wave).' }
  });
  it('cat_tesla_gem', 'epic', 'Ngọc Tesla', 'Tesla Gem', 80, {
    cat: true, mods: [{ stat: 'statusPower', pct: 0.2 }],
    hooks: [H('hit', 'shockArc', { chance: 0.25, mult: 0.6 })],
    tpl: { vi: 'Sát thương sét: {chance%} cơ hội phóng tia điện gây {mult%} sát thương.', en: 'Shock damage: {chance%} chance to arc for {mult%} damage.' }
  });

  // ---- catalysts added with the full evolution roster (rare 4, epic 2): each a stat plus a behaviour ----
  it('cat_detonator', 'rare', 'Kíp nổ', 'Detonator', 50, {
    cat: true, mods: [{ stat: 'area', pct: 0.12 }],
    hooks: [H('kill', 'burst', { chance: S(0.2, 0.1, 0.5), r: 85, dmg: S(16, 7, 37), element: 'physical' })],
    tpl: { vi: 'Khi hạ gục: {chance%} cơ hội phát nổ bán kính {r} gây {dmg} sát thương. Mỗi cộng dồn: +{chance+%} cơ hội, +{dmg+} sát thương.', en: 'On kill: {chance%} chance to detonate (radius {r}) for {dmg}. Each extra stack: +{chance+%} chance, +{dmg+} damage.' }
  });
  it('cat_spore_sac', 'rare', 'Túi bào tử', 'Spore Sac', 50, {
    cat: true, mods: [{ stat: 'hpRegen', add: 0.4 }],
    hooks: [H('hit', 'cloud', { chance: S(0.06, 0.03, 0.18), r: 62, dps: 7, life: 2.5, element: 'poison' })],
    tpl: { vi: 'Khi gây sát thương: {chance%} cơ hội để lại đám mây bào tử độc ({r} bán kính, {life}s). Mỗi cộng dồn: +{chance+%} cơ hội.', en: 'On hit: {chance%} chance to leave a poison spore cloud (radius {r}, {life}s). Each extra stack: +{chance+%} chance.' }
  });
  it('cat_cold_snap', 'rare', 'Cú sốc lạnh', 'Cold Snap', 50, {
    cat: true, mods: [{ stat: 'critChance', add: 0.04 }],
    hooks: [H('wave', 'buff', { key: 'coldsnap', stat: 'moveSpeed', amount: S(0.15, 0.07, 0.3), dur: 8 })],
    tpl: { vi: 'Đầu mỗi đợt: +{amount%} tốc độ chạy trong {dur}s. Mỗi cộng dồn: +{amount+%}.', en: 'At wave start: +{amount%} move speed for {dur}s. Each extra stack: +{amount+%}.' }
  });
  it('cat_capacitor', 'rare', 'Tụ điện', 'Capacitor', 50, {
    cat: true, mods: [{ stat: 'critDamage', add: 0.15 }],
    hooks: [H('dash', 'nova', { r: S(100, 20, 160), dmg: S(16, 9, 34), element: 'shock', status: 'shock' })],
    tpl: { vi: 'Khi lướt: xung điện bán kính {r} gây {dmg} sát thương và choáng. Mỗi cộng dồn: +{r+} bán kính, +{dmg+} sát thương.', en: 'On dash: a shock pulse (radius {r}) dealing {dmg} and stunning. Each extra stack: +{r+} radius, +{dmg+} damage.' }
  });
  it('cat_rime_core', 'epic', 'Lõi sương giá', 'Rime Core', 80, {
    cat: true, mods: [{ stat: 'statusPower', pct: 0.15 }],
    hooks: [H('hurt', 'nova', { r: 170, dmg: 26, element: 'ice', status: 'freeze' })],
    tpl: { vi: 'Khi bị đánh: sóng băng bán kính {r} gây {dmg} sát thương và đóng băng.', en: 'When hurt: a frost wave (radius {r}) dealing {dmg} and freezing.' }
  });
  it('cat_storm_rod', 'epic', 'Cột thu lôi', 'Storm Rod', 80, {
    cat: true, mods: [{ stat: 'area', pct: 0.15 }],
    hooks: [H('kill', 'everyKill', { every: 7, r: 110, dmg: 40, element: 'shock' })],
    tpl: { vi: 'Mỗi {every} lần hạ gục: sét nổ bán kính {r} gây {dmg} sát thương.', en: 'Every {every} kills: a lightning burst (radius {r}) dealing {dmg}.' }
  });

  // ---- legendary ----
  it('glass_cannon', 'legendary', 'Pháo thủy tinh', 'Glass Cannon', 140, { mods: [{ stat: 'damage', pct: 0.6 }, { stat: 'maxHp', pct: -0.3 }] });
  it('time_dial', 'legendary', 'Đồng hồ thời gian', 'Time Dial', 140, {
    hooks: [H('dash', 'freeCharge', { chance: 0.35 }), H('wave', 'dashFill', {})],
    tpl: { vi: 'Khi lướt: {chance%} cơ hội không tốn lần lướt. Đầu mỗi đợt: đầy lần lướt.', en: 'On dash: {chance%} chance it costs no charge. Each wave start: dash charges refill.' }
  });
  it('golden_skull', 'legendary', 'Sọ vàng', 'Golden Skull', 140, {
    mods: [{ stat: 'goldGain', pct: 0.3 }, { stat: 'luck', add: 0.2 }],
    hooks: [H('clear', 'interest', { rate: 0.1, cap: 25 })],
    tpl: { vi: 'Hết đợt: nhận lãi {rate%} số vàng đang có (tối đa {cap}).', en: 'Wave clear: earn {rate%} interest on held gold (max {cap}).' }
  });
  it('echo_stone', 'legendary', 'Đá vang vọng', 'Echo Stone', 140, {
    hooks: [H('hit', 'echo', { chance: 0.2, delay: 0.3, mult: 0.6 })],
    tpl: { vi: 'Khi gây sát thương: {chance%} cơ hội lặp lại đòn sau {delay}s với {mult%} sát thương.', en: 'On hit: {chance%} chance to repeat the hit after {delay}s for {mult%} damage.' }
  });

  NR.data.items = I;
  NR.data.itemUtil = { val: val, modText: modText, render: render };
})();
