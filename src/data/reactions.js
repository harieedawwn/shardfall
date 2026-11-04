// Owner: Arsenal. Element reactions and element set bonuses. Pure data; the logic lives in src/sim/reactions.js.
// A reaction fires when an element hits an enemy that already carries another status (first matching row wins):
//   pairs: [incomingElement, statusOnTarget]   status in { frozen, chill, burn, poison, void }
//   cd: per-enemy cooldown (s), r: blast/cloud radius, mult: x the triggering hit, hpPct: floor as % of target max HP (bosses 25%).
// Damage is attributed to the id 'reaction:<id>' (end screen, balance tool).
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  NR.data = NR.data || {};
  NR.data.reactions = {
    shatter: {
      name: { vi: 'Vỡ băng', en: 'Shatter' }, color: '#BFE9F7', element: 'ice', cd: 1.4,
      pairs: [['physical', 'frozen'], ['shock', 'frozen']], r: 88, mult: 2.4, hpPct: 0.1, knock: 240,
      desc: { vi: 'Đòn vật lý hoặc sét trúng kẻ đang đóng băng: băng vỡ nổ, gây sát thương diện rộng.', en: 'A physical or shock hit on a frozen enemy shatters the ice into an area blast.' }
    },
    toxic_blast: {
      name: { vi: 'Nổ độc', en: 'Toxic Blast' }, color: '#8BD450', element: 'poison', cd: 2,
      pairs: [['poison', 'burn'], ['fire', 'poison']], r: 100, mult: 1.2, hpPct: 0.05, knock: 120,
      desc: { vi: 'Lửa gặp độc (hoặc ngược lại): vụ nổ khí độc lan độc sang kẻ xung quanh.', en: 'Fire meets poison (or the reverse): a gas burst that spreads poison to nearby enemies.' }
    },
    superconduct: {
      name: { vi: 'Siêu dẫn', en: 'Superconduct' }, color: '#FFE066', element: 'shock', cd: 1.6,
      pairs: [['shock', 'chill']], jumps: 6, range: 190, mult: 1.1, hpPct: 0.04,
      desc: { vi: 'Sét trúng kẻ đang bị làm lạnh: tia sét nhảy xa hơn và nhiều hơn.', en: 'Shock on a chilled enemy: the lightning jumps further and hits more targets.' }
    },
    implosion: {
      name: { vi: 'Nội phá', en: 'Implosion' }, color: '#C58CF0', element: 'void', cd: 3,
      pairs: [['void', 'burn'], ['fire', 'void']], r: 150, core: 72, pull: 520, mult: 2, hpPct: 0.1,
      desc: { vi: 'Lửa gặp hư không: kéo kẻ địch vào tâm rồi nổ.', en: 'Fire meets void: enemies are dragged to the centre, then it blows.' }
    },
    steam: {
      name: { vi: 'Hơi nước', en: 'Steam' }, color: '#DCE8F2', element: 'ice', cd: 3,
      pairs: [['fire', 'chill'], ['ice', 'burn']], r: 92, life: 3, mult: 0.35, hpPct: 0.02,
      desc: { vi: 'Lửa gặp băng: đám hơi nước làm chậm mọi kẻ trong vùng.', en: 'Fire meets ice: a steam cloud that slows everything inside.' }
    }
  };
  // 3+ weapons of one element (counting evolved weapons) switch the bonus on. Effects are coded in src/sim/{reactions,combat,weapons}.js
  NR.data.setMin = 3;
  NR.data.sets = {
    physical: { name: { vi: 'Bộ Vật lý', en: 'Physical Set' }, desc: { vi: 'Đạn xuyên thêm 1 mục tiêu.', en: 'Shots pierce 1 more target.' } },
    fire: { name: { vi: 'Bộ Lửa', en: 'Fire Set' }, desc: { vi: 'Kẻ đang cháy chết sẽ lan lửa sang xung quanh.', en: 'Burning enemies spread fire when they die.' } },
    ice: { name: { vi: 'Bộ Băng', en: 'Ice Set' }, desc: { vi: '+25% sát thương lên kẻ đóng băng.', en: '+25% damage to frozen enemies.' } },
    shock: { name: { vi: 'Bộ Sét', en: 'Shock Set' }, desc: { vi: 'Tia sét nhảy thêm 1 mục tiêu.', en: 'Lightning chains to 1 more target.' } },
    poison: { name: { vi: 'Bộ Độc', en: 'Poison Set' }, desc: { vi: 'Độc cộng dồn tối đa thêm 1 tầng.', en: 'Poison stacks 1 higher.' } },
    void: { name: { vi: 'Bộ Hư không', en: 'Void Set' }, desc: { vi: 'Lực hút mạnh hơn 50%.', en: 'Pull is 50% stronger.' } }
  };
})();
