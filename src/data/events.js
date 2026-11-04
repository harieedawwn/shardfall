// Owner: Horde. Mid-wave events (data only). From wave 2, a normal wave rolls one event with probability `chance` (never on boss waves).
// Logic lives in src/sim/waveevents.js; HUD/fx read W.event. `dur` = seconds the objective lasts (shrine: seconds to find it).
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  NR.data = NR.data || {};
  NR.data.waveEventRules = { firstWave: 2, chance: 0.5, startFrom: 0.2, startTo: 0.5 };
  NR.data.waveEvents = {
    treasure_runner: {
      name: { vi: 'Kẻ mang vàng', en: 'Treasure Runner' }, color: '#FFD43B', dur: 12,
      obj: { vi: 'Hạ kẻ mang vàng trước khi hắn trốn thoát!', en: 'Kill the gold carrier before he escapes!' },
      desc: { vi: 'Hạ kẻ mang vàng đang bỏ chạy trong 12 giây để nhận một đống vàng.', en: 'Kill the fleeing gold carrier within 12 s for a pile of gold.' }
    },
    cursed_shrine: {
      name: { vi: 'Đền nguyền rủa', en: 'Cursed Shrine' }, color: '#A25CE0', dur: 30, hold: 3, r: 95,
      obj: { vi: 'Đứng trong đền 3 giây để gọi tinh anh. Thắng sẽ nhận rương hiếm.', en: 'Stand in the shrine for 3 s to call an elite pack. Win a rare+ chest.' },
      desc: { vi: 'Đứng trong đền 3 giây để triệu hồi nhóm tinh anh; hạ hết sẽ rơi rương hiếm trở lên.', en: 'Stand in the shrine for 3 s to summon an elite pack; clear it for a rare or better chest.' }
    },
    shard_storm: {
      name: { vi: 'Mưa mảnh vỡ', en: 'Shard Storm' }, color: '#7FD3F0', dur: 14,
      obj: { vi: 'Thiên thạch rơi! Né vùng báo, nhặt kinh nghiệm sau khi nổ.', en: 'Meteors incoming! Dodge the marks, grab the XP they leave.' },
      desc: { vi: 'Thiên thạch báo trước rơi xuống và để lại mảnh kinh nghiệm.', en: 'Telegraphed meteors fall and leave XP shards behind.' }
    }
  };
})();
