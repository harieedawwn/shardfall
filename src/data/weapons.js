// Arsenal - weapon and evolution data (Content Registry: 16 weapons, 6 evolutions).
// Level rows are full objects (every field present). Shared fields read by weapons.resolve:
//   dmg rate speed range count pierce area crit statusChance knock
// Kind fields: spread jitter r bounce wbounce blast blastDmg split homing pull (projectile/spread/homing),
//   w arc patch spreadFire (beam), wave stormArcs aftershock (melee), orad ospd breathe (orbit),
//   jumps jrange falloff stun (chain), tick freezeEvery plague (aura), cloudDmg cloudLife trig arm cluster dbl (thrown).
// Top-level render data for fx: shape, color, size, trail. `hit` = hit weight (0..1) fx turns into hit-stop.
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  NR.data = NR.data || {};
  const EC = NR.config.ELEMENT_COLORS;
  const DEF = { dmg: 10, rate: 2, speed: 600, range: 600, count: 1, pierce: 0, area: 1, crit: 0, statusChance: 0, knock: 30 };

  function rows(base, deltas) {
    const out = [Object.assign({}, DEF, base)];
    for (let i = 0; i < deltas.length; i++) out.push(Object.assign({}, out[i], deltas[i]));
    return out;
  }

  // Lv1-4 damage multipliers shaping the power curve (Lv5 is the balance anchor); tuned against the headless pack in tests/arsenal.test.js
  const CURVE = {
    pistol: [5.178, 3.614, 4.038, 2.478],
    ember_gun: [1.456, 1.892, 1.874, 1.491],
    scattergun: [1.494, 1.637, 1.576, 1.079],
    frost_fan: [1.267, 1.597, 1.347, 1.205],
    lancer: [1.094, 1.362, 1.378, 1.294],
    flamer: [7.093, 2.407, 5.097, 1.703],
    katana: [23.243, 32.105, 40.826, 39.928],
    maul: [3.316, 4.678, 2.96, 3.759],
    saw_ring: [4.743, 4.033, 5.324, 4.168],
    drone_pod: [3.874, 2.684, 2.307, 2.005],
    grenade: [1.643, 1.813, 1.318, 1.129],
    toxin_mine: [2.267, 2.5, 2.1, 1.7],
    arc_coil: [3.542, 4.037, 2.183, 2.067],
    frost_aura: [1.437, 2.269, 2.142, 0.85],
    toxic_cloud: [7.177, 6.642, 5.854, 4.217],
    seeker: [5.411, 3.721, 2.104, 1.753]
  };
  // id, kind, element, vi, en, descVi, descEn, shape, size, trail, hit, auto, sfx, color(optional)
  const B = [
    ['pistol', 'projectile', 'physical', 'Súng lục', 'Pistol',
      'Đạn nhanh, chính xác. Cấp 5: đạn nảy sang kẻ địch kế tiếp.', 'Fast, accurate shots. Lv5: bullets ricochet to the next enemy.', 'circle', 5, false, 0.12, false, 'shoot_light',
      rows({ dmg: 3.4, rate: 3.4, speed: 780, range: 640, crit: 0.04, knock: 70, spread: 0.1, jitter: 0.02 },
        [{ rate: 4, dmg: 3.9, pierce: 1 }, { dmg: 4.6, rate: 4.5 }, { count: 2 }, { dmg: 5.1, rate: 5, bounce: 2, crit: 0.1 }])],
    ['ember_gun', 'projectile', 'fire', 'Súng than hồng', 'Ember Gun',
      'Đạn lửa chậm gây bỏng. Cấp 5: đạn phát nổ.', 'Slow fireballs that burn. Lv5: fireballs explode.', 'circle', 7, true, 0.3, false, 'shoot_light',
      rows({ dmg: 16.99, rate: 2.2, speed: 520, range: 560, statusChance: 0.25, knock: 50, spread: 0.14, jitter: 0.02 },
        [{ rate: 2.6, statusChance: 0.35 }, { dmg: 21.29, area: 1.2 }, { count: 2 }, { dmg: 24.02, statusChance: 0.5, blast: 64, blastDmg: 0.6 }])],
    ['scattergun', 'spread', 'physical', 'Súng hoa cải', 'Scattergun',
      'Chùm đạn găm vào gần. Cấp 5: đạn xuyên.', 'Close-range pellet burst. Lv5: pellets pierce.', 'tri', 4, false, 0.4, false, 'shoot_heavy',
      rows({ dmg: 9.21, rate: 1.3, speed: 700, range: 380, count: 5, knock: 90, spread: 0.62, jitter: 0.04 },
        [{ count: 6, rate: 1.5 }, { dmg: 11.73, count: 7, range: 420 }, { rate: 1.8, pierce: 1 }, { count: 9, dmg: 13.1, spread: 0.75, pierce: 2 }])],
    ['frost_fan', 'spread', 'ice', 'Quạt băng', 'Frost Fan',
      'Quạt mảnh băng làm chậm. Cấp 5: mỗi mảnh đều gây lạnh.', 'A fan of ice shards that chill. Lv5: every shard chills.', 'tri', 5, false, 0.2, false, 'shoot_light',
      rows({ dmg: 8.29, rate: 1.4, speed: 560, range: 420, count: 4, pierce: 1, statusChance: 0.5, knock: 20, spread: 0.9, jitter: 0.03 },
        [{ count: 5 }, { dmg: 11.09, rate: 1.7 }, { count: 7, pierce: 2 }, { dmg: 13.89, statusChance: 1, count: 8 }])],
    ['lancer', 'beam', 'physical', 'Giáo laser', 'Lancer',
      'Tia laser xuyên thấu. Cấp 5: xuyên mọi thứ.', 'Piercing laser pulse. Lv5: pierces everything.', 'beam', 6, false, 0.35, false, 'shoot_heavy',
      rows({ dmg: 30.91, rate: 1.1, range: 520, w: 12, pierce: 3, knock: 120, crit: 0.1 },
        [{ rate: 1.3 }, { dmg: 41.21, w: 16, pierce: 5 }, { rate: 1.6, range: 600 }, { dmg: 53.59, pierce: 99, crit: 0.25, w: 20 }])],
    ['flamer', 'beam', 'fire', 'Súng phun lửa', 'Flamer',
      'Luồng lửa hình nón. Cấp 5: lửa lan sang kẻ địch gần.', 'A cone of flame. Lv5: burning spreads to neighbours.', 'beam', 8, true, 0.05, false, 'shoot_light',
      rows({ dmg: 17.22, rate: 9, range: 150, arc: 0.7, pierce: 99, statusChance: 0.25, knock: 15 },
        [{ range: 170, dmg: 20.64 }, { rate: 11, arc: 0.85 }, { range: 190, dmg: 25.53, statusChance: 0.4 }, { dmg: 30.74, range: 205, spreadFire: 1 }])],
    ['katana', 'melee', 'physical', 'Kiếm katana', 'Katana',
      'Nhát chém vòng cung. Cấp 5: phát ra sóng kiếm.', 'Sweeping slashes. Lv5: slashes fire a blade wave.', 'arc', 12, false, 0.55, false, 'shoot_heavy',
      rows({ dmg: 17.32, rate: 1.9, range: 105, arc: 1.7, knock: 110, crit: 0.12 },
        [{ rate: 2.2, dmg: 19.67 }, { count: 2, dmg: 20.42 }, { range: 125, arc: 2.1, rate: 2.5 }, { dmg: 23.58, crit: 0.2, wave: 0.7 }])],
    ['maul', 'melee', 'void', 'Búa hư không', 'Maul',
      'Cú đập nặng, hất văng. Cấp 5: dư chấn lần hai.', 'Heavy smash, huge knockback. Lv5: a second aftershock.', 'arc', 14, false, 0.95, false, 'shoot_heavy',
      rows({ dmg: 18.92, rate: 0.75, range: 90, r: 85, knock: 480, statusChance: 0.4, crit: 0.05 },
        [{ rate: 0.85, dmg: 22.32 }, { r: 100, dmg: 25.82 }, { rate: 1, knock: 600 }, { dmg: 30.96, aftershock: 1 }])],
    ['saw_ring', 'orbit', 'physical', 'Vòng cưa', 'Saw Ring',
      'Lưỡi cưa xoay quanh bạn. Cấp 5: vòng cưa co giãn.', 'Saws orbit you. Lv5: the ring breathes in and out.', 'ring', 12, false, 0.1, true, 'shoot_light',
      rows({ dmg: 142.22, rate: 3, count: 2, orad: 85, ospd: 3.2, knock: 60, pierce: 99 },
        [{ dmg: 168.41, ospd: 3.6 }, { count: 3 }, { count: 4, orad: 105, dmg: 206.97 }, { count: 5, dmg: 245.88, ospd: 4.4, breathe: 1 }])],
    ['drone_pod', 'drone', 'shock', 'Khoang drone', 'Drone Pod',
      'Drone tự động bắn kẻ địch. Cấp 5: đạn xuyên.', 'Drones auto-fire at enemies. Lv5: shots pierce.', 'diamond', 4, false, 0.1, true, 'shoot_light',
      rows({ dmg: 6.28, rate: 2.2, speed: 620, range: 460, statusChance: 0.2, knock: 30, jitter: 0.03 },
        [{ count: 2 }, { rate: 2.8, dmg: 7.6 }, { count: 3, range: 520 }, { count: 4, dmg: 9.03, pierce: 1, rate: 3.2 }])],
    ['grenade', 'thrown', 'fire', 'Lựu đạn', 'Grenade',
      'Ném lựu đạn nổ diện rộng. Cấp 5: nổ thành chùm bom con.', 'Lobbed explosive. Lv5: bursts into cluster bomblets.', 'hex', 8, false, 0.7, false, 'shoot_heavy',
      rows({ dmg: 20.06, rate: 0.9, range: 420, speed: 430, blast: 70, statusChance: 0.5, knock: 300, crit: 0.05 },
        [{ blast: 80, dmg: 24.05 }, { rate: 1.1, count: 2 }, { blast: 95, dmg: 29.36 }, { dmg: 34.69, cluster: 3 }])],
    ['toxin_mine', 'thrown', 'poison', 'Mìn độc', 'Toxin Mine',
      'Thả mìn, nổ ra đám mây độc. Cấp 5: nổ hai lần.', 'Drops mines that burst into poison clouds. Lv5: double detonation.', 'hex', 8, false, 0.35, true, 'shoot_light',
      rows({ dmg: 57.08, rate: 0.55, blast: 60, statusChance: 0.9, knock: 120, cloudDmg: 24.39, cloudLife: 3.5, trig: 60, arm: 0.6 },
        [{ rate: 0.65, cloudLife: 4.5 }, { count: 2 }, { blast: 75, cloudDmg: 32.72 }, { count: 3, cloudDmg: 44, cloudLife: 5, dbl: 1 }])],
    ['arc_coil', 'chain', 'shock', 'Cuộn sét', 'Arc Coil',
      'Tia sét nhảy giữa các kẻ địch. Cấp 5: sét không suy giảm.', 'Lightning that jumps between enemies. Lv5: bolts never fade.', 'star', 5, false, 0.15, true, 'shoot_light',
      rows({ dmg: 3.66, rate: 1.5, range: 300, jumps: 3, jrange: 130, falloff: 0.8, statusChance: 0.2, knock: 30 },
        [{ jumps: 4, rate: 1.7 }, { dmg: 4.6, jrange: 150, count: 2 }, { jumps: 6, rate: 2 }, { dmg: 5.95, jumps: 8, falloff: 1, statusChance: 0.5 }])],
    ['frost_aura', 'aura', 'ice', 'Hào quang băng', 'Frost Aura',
      'Vòng băng quanh bạn làm chậm kẻ địch. Cấp 5: xung đóng băng.', 'A freezing ring around you. Lv5: every third pulse freezes.', 'ring', 95, false, 0.05, true, 'shoot_light',
      rows({ dmg: 299.41, r: 95, tick: 0.5, statusChance: 0.5, knock: 0 },
        [{ r: 110 }, { dmg: 418.63, tick: 0.4 }, { r: 135, dmg: 538.59 }, { dmg: 658.5, freezeEvery: 3 }])],
    ['toxic_cloud', 'aura', 'poison', 'Mây độc', 'Toxic Cloud',
      'Đám mây độc bám theo bạn. Cấp 5: kẻ chết vì độc phát nổ độc.', 'A poison cloud that follows you. Lv5: poisoned kills burst into gas.', 'ring', 85, false, 0.05, true, 'shoot_light',
      rows({ dmg: 102.26, r: 85, tick: 0.5, statusChance: 0.8, knock: 0 },
        [{ r: 100 }, { dmg: 153.17 }, { r: 120, dmg: 204.55 }, { dmg: 430, plague: 1 }])],
    ['seeker', 'homing', 'void', 'Cầu truy đuổi', 'Seeker',
      'Cầu hư không tự đuổi theo địch. Cấp 5: tách làm đôi khi trúng.', 'Void orbs that hunt enemies. Lv5: split in two on first hit.', 'diamond', 8, true, 0.3, false, 'shoot_light',
      rows({ dmg: 4.11, rate: 1.3, speed: 300, range: 700, pierce: 1, homing: 3.5, statusChance: 0.4, knock: 60, spread: 0.5, pull: 60 },
        [{ count: 2 }, { rate: 1.6, dmg: 5.12, pierce: 2 }, { count: 3 }, { dmg: 6.65, split: 1, pierce: 3 }])]
  ];

  // base weapon, catalyst, id, element, vi, en, descVi, descEn, shape, color, size, trail, hit, sfx, level row
  const E = [
    ['pistol', 'cat_overclock', 'gatling_pistol', 'physical', 'Súng lục Gatling', 'Gatling Pistol',
      'Xả đạn liên thanh, đạn nảy và xuyên.', 'A storm of ricocheting, piercing bullets.', 'tri', '#FFB703', 6, true, 0.1, 'shoot_heavy',
      { dmg: 4.95, rate: 17, speed: 920, range: 700, pierce: 2, bounce: 2, crit: 0.1, knock: 50, jitter: 0.1, spread: 0.1 }],
    ['scattergun', 'cat_hollow_slug', 'shredder', 'physical', 'Máy xé', 'Shredder',
      'Cơn mưa mảnh đạn nảy tường, xuyên thấu.', 'A flood of wall-bouncing, piercing shards.', 'diamond', '#E36414', 5, true, 0.6, 'shoot_heavy',
      { dmg: 14.07, rate: 2.8, speed: 760, range: 460, count: 14, pierce: 3, wbounce: 2, knock: 110, spread: 1, jitter: 0.06 }],
    ['flamer', 'cat_fuel_tank', 'inferno_jet', 'fire', 'Tia địa ngục', 'Inferno Jet',
      'Tia lửa dài xuyên thấu, để lại mặt đất cháy.', 'A long piercing jet that scorches the ground.', 'beam', '#FF3D00', 12, true, 0.1, 'shoot_heavy',
      { dmg: 9.8, rate: 12, range: 330, arc: 0.42, pierce: 99, statusChance: 0.5, knock: 30, spreadFire: 1, patch: 1 }],
    ['katana', 'cat_whetstone', 'storm_blade', 'shock', 'Lưỡi bão', 'Storm Blade',
      'Chém rộng kèm sét và sóng kiếm.', 'Wide slashes with lightning and blade waves.', 'star', '#FFF3A3', 14, true, 0.75, 'shoot_heavy',
      { dmg: 25.14, rate: 3.2, range: 150, arc: 2.6, count: 2, crit: 0.2, knock: 140, statusChance: 0.3, wave: 1, stormArcs: 3 }],
    ['drone_pod', 'cat_swarm_core', 'hive_pod', 'shock', 'Tổ ong drone', 'Hive Pod',
      'Bầy drone bắn đạn tự dẫn.', 'A swarm of drones firing homing darts.', 'hex', '#FFE066', 4, true, 0.15, 'shoot_heavy',
      { dmg: 7.49, rate: 3.6, count: 7, speed: 520, range: 520, pierce: 1, homing: 6, statusChance: 0.3, knock: 40, jitter: 0.2 }],
    ['arc_coil', 'cat_tesla_gem', 'tempest_coil', 'shock', 'Cuộn bão', 'Tempest Coil',
      'Bão sét: nhiều tia, nhảy rất xa.', 'A thunderstorm: many bolts, long chains.', 'star', '#FFFFFF', 7, true, 0.3, 'shoot_heavy',
      { dmg: 6.43, rate: 2.4, range: 380, count: 4, jumps: 10, jrange: 170, falloff: 1, statusChance: 0.5, knock: 40, stun: 1 }]
  ];

  const W = {}, evolutions = [];
  // B columns: 0 id,1 kind,2 element,3 vi,4 en,5 descVi,6 descEn,7 shape,8 size,9 trail,10 hit,11 auto,12 sfx,13 level rows
  B.forEach(function (b) {
    const cv = CURVE[b[0]];
    for (let l = 0; l < 4; l++) { b[13][l].dmg *= cv[l]; if (b[13][l].cloudDmg) b[13][l].cloudDmg *= cv[l]; }
  });
  B.forEach(function (b, i) {
    W[b[0]] = {
      name: { vi: b[3], en: b[4] }, desc: { vi: b[5], en: b[6] }, kind: b[1], element: b[2], evolved: false,
      cost: 30 + 6 * i, rarity: i < 6 ? 'common' : i < 12 ? 'rare' : 'epic', levels: b[13], shape: b[7], color: EC[b[2]],
      size: b[8], trail: b[9], hit: b[10], auto: b[11], sfx: b[12]
    };
  });
  E.forEach(function (e) {
    const base = W[e[0]];
    W[e[2]] = {
      name: { vi: e[4], en: e[5] }, desc: { vi: e[6], en: e[7] }, kind: base.kind, element: e[3], evolved: true, cost: 0, rarity: 'legendary',
      levels: [Object.assign({}, DEF, base.levels[4], e[14])], shape: e[8], color: e[9], size: e[10], trail: e[11], hit: e[12], auto: base.auto, sfx: e[13], from: e[0]
    };
    evolutions.push({ weapon: e[0], catalyst: e[1], into: e[2] });
  });
  NR.data.weapons = W;
  NR.data.evolutions = evolutions;
})();
