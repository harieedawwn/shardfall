// Owner: Progression. Mechanic traits (level-up cards that change how you play) and wave route modifiers. Pure data; logic in src/sim/traits.js
// and src/sim/run.js. A trait has up to `max` levels; `vals` hold one number per level, referenced by {key} / {key%} in the text templates.
// `match` (elements / kinds / dash) marks a build match: the card shows the synergy hint highlighted and is offered a little more often.
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  NR.data = NR.data || {};
  const T = {};
  function tr(id, vi, en, rarity, max, color, glyph, vals, tvi, ten, hvi, hen, match) {
    T[id] = { name: { vi: vi, en: en }, rarity: rarity, max: max, color: color, glyph: glyph, vals: vals, tpl: { vi: tvi, en: ten }, synergy: { vi: hvi, en: hen }, match: match || {} };
  }
  tr('ricochet', 'Nảy đạn', 'Ricochet', 'rare', 3, '#F2EFE6', 'bounce', { a: [1, 2, 3] },
    'Đạn nảy sang thêm {a} kẻ địch gần đó.', 'Shots ricochet to {a} more nearby enemies.', 'Hợp với: súng ngắn, nỏ, drone', 'Pairs with: pistols, bows, drones', { kinds: ['projectile', 'drone'] });
  tr('ember_dash', 'Lướt lửa', 'Ember Dash', 'rare', 3, '#FF7A2F', 'flame', { a: [0.5, 0.8, 1.2], b: [1.6, 2, 2.4] },
    'Lướt để lại vệt lửa gây {a%} sát thương mỗi nhịp trong {b}s.', 'Dashing leaves a fire trail: {a%} damage per tick for {b}s.', 'Hợp với: nhân vật lướt nhiều, vũ khí lửa', 'Pairs with: frequent dashers, fire weapons', { elements: ['fire'] });
  tr('dead_eye', 'Mắt đại bàng', 'Dead Eye', 'epic', 2, '#FFD43B', 'eye', { a: [1, 0.6] },
    'Đứng yên {a}s: phát bắn kế tiếp luôn chí mạng.', 'Stand still for {a}s: your next shot always crits.', 'Hợp với: Xạ thủ, súng bắn chậm', 'Pairs with: Ranger, slow heavy guns', { kinds: ['beam'] });
  tr('dash_refund', 'Lướt hoàn', 'Dash Refund', 'rare', 2, '#6FD6F2', 'dash', { a: [0.8, 1.5] },
    'Hạ gục trong {a}s sau khi lướt: hoàn lại 1 lần lướt (mỗi cú lướt một lần).', 'A kill within {a}s of a dash refunds 1 dash charge (once per dash).', 'Hợp với: Kiếm khách, kiếm và búa', 'Pairs with: Dasher, melee weapons', { kinds: ['melee'] });
  tr('shatter_master', 'Bậc thầy vỡ băng', 'Shatter Master', 'epic', 3, '#BFE9F7', 'ice', { a: [0.5, 1, 1.5], b: [0.1, 0.2, 0.3] },
    'Phản ứng Vỡ băng mạnh hơn {a%}; kẻ đóng băng chịu thêm {b%} sát thương.', 'Shatter hits {a%} harder; frozen enemies take {b%} more damage.', 'Hợp với: vũ khí băng + vật lý/sét', 'Pairs with: ice weapons + physical/shock', { elements: ['ice'] });
  tr('split_shot', 'Chia đạn', 'Split Shot', 'rare', 2, '#E86AA6', 'multi', { a: [0.25, 0.45] },
    '+1 đạn mỗi cấp, nhưng giảm {a%} sát thương.', '+1 projectile per level, but -{a%} damage.', 'Hợp với: nhiều tay súng, hiệu ứng trạng thái', 'Pairs with: many guns, on-hit statuses', { kinds: ['spread', 'projectile'] });
  tr('adrenaline', 'Adrenaline', 'Adrenaline', 'rare', 3, '#FF5C8A', 'heart', { a: [0.3, 0.45, 0.6] },
    'Dưới 40% máu: +{a%} tốc độ bắn.', 'Below 40% HP: +{a%} attack speed.', 'Hợp với: lối chơi liều, hồi máu', 'Pairs with: risky play, healing', {});
  tr('siphon', 'Hút sinh lực', 'Siphon', 'rare', 3, '#E5484D', 'drop', { a: [1, 1, 2] },
    'Mỗi lần hạ gục hồi {a} máu.', 'Every kill heals {a} HP.', 'Hợp với: vũ khí đánh nhanh, bầy đàn', 'Pairs with: fast weapons, crowds', {});
  tr('thorns', 'Gai phản đòn', 'Thorn Burst', 'rare', 3, '#C95B73', 'spike', { a: [10, 18, 26] },
    'Khi bị đánh: sóng xung kích bán kính 110 gây {a} sát thương và đẩy lùi.', 'When hurt: a shockwave (radius 110) deals {a} and knocks back.', 'Hợp với: Hộ vệ, giáp dày', 'Pairs with: Bulwark, armor', {});
  tr('bounty', 'Thợ săn tiền thưởng', 'Bounty Hunter', 'rare', 3, '#FFC23D', 'coin', { a: [12, 22, 34] },
    'Hạ tinh anh rơi thêm {a} vàng.', 'Elite kills drop {a} extra gold.', 'Hợp với: Đợt Săn tinh anh, đền nguyền rủa', 'Pairs with: Elite Hunt, Cursed Shrine', {});
  tr('chain_kill', 'Sét lan', 'Chain Kill', 'epic', 3, '#FFE066', 'bolt', { a: [2, 3, 4] },
    'Hạ gục phóng tia sét nhảy sang {a} kẻ địch gần đó.', 'Kills arc lightning to {a} nearby enemies.', 'Hợp với: vũ khí sét, bầy đàn', 'Pairs with: shock weapons, crowds', { elements: ['shock'] });
  tr('needle', 'Kim xuyên', 'Needle', 'rare', 3, '#9AF0FF', 'pierce', { a: [1, 1, 2], b: [0.1, 0.15, 0.2] },
    '+{a} xuyên thấu, +{b%} tốc độ đạn.', '+{a} pierce, +{b%} projectile speed.', 'Hợp với: đạn bắn xuyên, tia laser', 'Pairs with: piercing shots, beams', { kinds: ['projectile', 'spread'] });
  tr('far_sight', 'Tầm nhìn xa', 'Far Sight', 'rare', 3, '#8FC1E3', 'scope', { a: [0.15, 0.3, 0.45], b: [0.04, 0.07, 0.1] },
    '+{a%} tầm bắn, +{b%} tỉ lệ chí mạng.', '+{a%} range, +{b%} crit chance.', 'Hợp với: Xạ thủ, súng trường', 'Pairs with: Ranger, long-range guns', { kinds: ['beam', 'homing'] });
  tr('second_wind', 'Hơi thở thứ hai', 'Second Wind', 'epic', 3, '#8BD450', 'wind', { a: [0.3, 0.45, 0.6] },
    'Mỗi đợt, lần đầu xuống dưới 30% máu: hồi {a%} máu tối đa.', 'Once per wave, the first time you drop below 30% HP: heal {a%} of max HP.', 'Hợp với: mọi bản dựng mong manh', 'Pairs with: any fragile build', {});
  tr('light_feet', 'Chân nhẹ', 'Light Feet', 'rare', 3, '#F2EFE6', 'boots', { a: [0.15, 0.28, 0.4], b: [0.03, 0.06, 0.09] },
    'Hồi lướt nhanh hơn {a%}, +{b%} tốc độ chạy.', 'Dash cooldown -{a%}, +{b%} move speed.', 'Hợp với: Kiếm khách, kiểu chạy né', 'Pairs with: Dasher, kiting', {});
  tr('shockstep', 'Bước chấn động', 'Shockstep', 'rare', 3, '#FFD43B', 'pulse', { a: [14, 24, 36] },
    'Lướt giải phóng sóng xung kích (bán kính 130) gây {a} sát thương và đẩy kẻ địch ra.', 'Dashing releases a shockwave (radius 130) for {a} that pushes enemies away.', 'Hợp với: nhiều lần lướt, vũ khí cận chiến', 'Pairs with: many dash charges, melee', { kinds: ['melee'] });
  tr('executioner', 'Đao phủ', 'Executioner', 'epic', 3, '#E5484D', 'skull', { a: [0.2, 0.35, 0.5] },
    '+{a%} sát thương lên kẻ địch dưới 30% máu.', '+{a%} damage to enemies below 30% HP.', 'Hợp với: sát thương độc/lửa theo thời gian', 'Pairs with: burn/poison over time', { elements: ['fire', 'poison'] });
  tr('focus_fire', 'Tập trung hỏa lực', 'Focus Fire', 'rare', 3, '#FFB703', 'target', { a: [0.04, 0.06, 0.08] },
    'Mỗi đòn liên tiếp vào cùng một kẻ địch: +{a%} sát thương (tối đa 5 lần).', 'Each consecutive hit on the same enemy: +{a%} damage (max 5 stacks).', 'Hợp với: tia laser, súng ray, boss', 'Pairs with: lasers, railguns, bosses', { kinds: ['beam'] });
  tr('momentum', 'Đà tiến', 'Momentum', 'rare', 3, '#4FA8F0', 'run', { a: [0.08, 0.14, 0.2] },
    'Khi đang di chuyển: +{a%} sát thương (không áp dụng khi đứng yên).', 'While moving: +{a%} damage (not while standing still).', 'Hợp với: lối chơi di chuyển, vòng cưa', 'Pairs with: kiting, orbiting saws', { kinds: ['orbit', 'aura'] });
  tr('crit_surge', 'Cuồng chí mạng', 'Crit Surge', 'epic', 3, '#FF9F1C', 'crit', { a: [0.15, 0.25, 0.35] },
    'Đòn chí mạng cho +{a%} tốc độ bắn trong 2,5s.', 'Crits grant +{a%} attack speed for 2.5s.', 'Hợp với: tỉ lệ chí mạng cao', 'Pairs with: high crit chance', {});
  NR.data.traits = T;

  // Wave route modifiers: pick one of 2-3 after the shop before a non-boss wave. Multipliers apply to W.scale for that wave only.
  // count/gold/xp/hp/speed multiply the matching enemyScale field, elite adds to the elite chance, event: 'none' | 'force' | ''.
  NR.data.routes = {
    swarm: { name: { vi: 'Bầy đàn', en: 'Swarm' }, color: '#E8C547', glyph: 'multi', mods: { count: 1.4, gold: 1.5 }, event: '',
      desc: { vi: '+40% kẻ địch, vàng rơi x1,5.', en: '+40% enemies, gold drops x1.5.' } },
    elite_hunt: { name: { vi: 'Săn tinh anh', en: 'Elite Hunt' }, color: '#FFC23D', glyph: 'skull', mods: { elite: 0.2, xp: 1.1 }, event: '',
      desc: { vi: 'Nhiều tinh anh hơn rõ rệt (mỗi con rơi rương), +15% kinh nghiệm.', en: 'Far more elites (each drops a chest), +15% XP.' } },
    calm: { name: { vi: 'Yên ả', en: 'Calm' }, color: '#8BD450', glyph: 'wind', mods: { count: 0.7, gold: 0.85 }, event: 'none',
      desc: { vi: '-30% kẻ địch, không có sự kiện giữa đợt.', en: '-30% enemies, no mid-wave event.' } },
    gold_rush: { name: { vi: 'Cơn sốt vàng', en: 'Gold Rush' }, color: '#FFD43B', glyph: 'coin', mods: { gold: 2, hp: 1.1, speed: 1.08 }, event: '',
      desc: { vi: 'Vàng rơi x2, nhưng kẻ địch +10% máu và nhanh hơn 8%.', en: 'Gold drops x2, but enemies have +10% HP and move 8% faster.' } },
    omen: { name: { vi: 'Điềm báo', en: 'Omen' }, color: '#A25CE0', glyph: 'eye', mods: { xp: 1.1 }, event: 'force',
      desc: { vi: 'Chắc chắn có một sự kiện giữa đợt, +10% kinh nghiệm.', en: 'A mid-wave event is guaranteed, +10% XP.' } }
  };
})();
