// Owner: Progression. Achievements (15), per-character challenges (4) and the content that starts locked (7). Pure data; logic in src/sim/achievements.js.
// type: win {char?, minDanger?, maxDamageTaken?, minDashes?, minEvolutions?} (checked when a run is won) | run {stat, goal} (this run's W.stats)
//       | total {stat, goal} (all runs: saved progress + this run) | bossNoHit | traits {goal} | endless {wave}
// `locked`: weapons/items/traits that stay out of every shop, chest and card pool until the achievement is earned.
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  NR.data = NR.data || {};
  const A = {};
  function a(id, type, vi, en, dvi, den, color, glyph, spec) { A[id] = Object.assign({ type: type, name: { vi: vi, en: en }, desc: { vi: dvi, en: den }, color: color, glyph: glyph }, spec || {}); }
  a('first_win', 'win', 'Chiến thắng đầu tiên', 'First Victory', 'Thắng một ván (qua đợt 15).', 'Win a run (clear wave 15).', '#FFD43B', 'crit');
  a('boss_nohit', 'bossNoHit', 'Không một vết xước', 'Untouched', 'Hạ một trùm mà không bị trúng đòn nào trong trận đánh trùm.', 'Kill a boss without taking a single hit during the fight.', '#6FD6F2', 'wind');
  a('triple_evo', 'run', 'Tiến hóa ba lần', 'Triple Evolution', 'Tiến hóa 3 vũ khí trong một ván.', 'Evolve 3 weapons in one run.', '#FF9F1C', 'flame', { stat: 'evolutions', goal: 3 });
  a('reaction_50', 'total', 'Nhà hóa học', 'Alchemist', 'Gây 50 phản ứng nguyên tố (cộng dồn mọi ván).', 'Trigger 50 element reactions (all runs combined).', '#BFE9F7', 'ice', { stat: 'reactions', goal: 50 });
  a('elites_20', 'total', 'Thợ săn tinh anh', 'Elite Hunter', 'Hạ 20 tinh anh (cộng dồn mọi ván).', 'Kill 20 elites (all runs combined).', '#E5484D', 'skull', { stat: 'elites', goal: 20 });
  a('win_ranger', 'win', 'Xạ thủ bách phát', 'Ranger Victory', 'Thắng một ván với Xạ thủ.', 'Win a run with the Ranger.', '#5FA8D3', 'target', { char: 'ranger' });
  a('win_dasher', 'win', 'Kiếm khách bất bại', 'Dasher Victory', 'Thắng một ván với Kiếm khách.', 'Win a run with the Dasher.', '#E8C547', 'dash', { char: 'dasher' });
  a('win_bulwark', 'win', 'Bức tường thép', 'Bulwark Victory', 'Thắng một ván với Hộ vệ.', 'Win a run with the Bulwark.', '#8C4A3B', 'spike', { char: 'bulwark' });
  a('win_tinker', 'win', 'Kỹ sư thiên tài', 'Tinker Victory', 'Thắng một ván với Thợ máy.', 'Win a run with the Tinker.', '#5FB49C', 'multi', { char: 'tinker' });
  a('win_d3', 'win', 'Liều lĩnh', 'Daredevil', 'Thắng một ván ở độ khó 3 trở lên.', 'Win a run on danger 3 or higher.', '#FF5C8A', 'heart', { minDanger: 3 });
  a('events_10', 'total', 'Người săn sự kiện', 'Event Chaser', 'Hoàn thành 10 sự kiện giữa đợt (cộng dồn).', 'Complete 10 mid-wave events (all runs combined).', '#A25CE0', 'eye', { stat: 'eventsWon', goal: 10 });
  a('trait_collector', 'traits', 'Người sưu tầm đặc tính', 'Trait Collector', 'Sở hữu 6 đặc tính khác nhau trong một ván.', 'Own 6 different traits in one run.', '#9AF0FF', 'pierce', { goal: 6 });
  a('rich', 'run', 'Nhà giàu mới nổi', 'Gold Baron', 'Kiếm 1.500 vàng trong một ván.', 'Earn 1,500 gold in a single run.', '#FFC23D', 'coin', { stat: 'goldEarned', goal: 1500 });
  a('slayer', 'total', 'Đồ tể', 'Slayer', 'Hạ 3.000 kẻ địch (cộng dồn mọi ván).', 'Kill 3,000 enemies (all runs combined).', '#C95B73', 'bolt', { stat: 'kills', goal: 3000 });
  a('endless_20', 'endless', 'Không điểm dừng', 'No Finish Line', 'Đạt đợt 20 ở chế độ Vô tận.', 'Reach wave 20 in Endless.', '#4FA8F0', 'run', { wave: 20 });
  NR.data.achievements = A;

  const C = {};
  function c(id, ch, vi, en, dvi, den, spec) { C[id] = Object.assign({ type: 'win', char: ch, name: { vi: vi, en: en }, desc: { vi: dvi, en: den } }, spec); }
  c('ch_ranger', 'ranger', 'Tay súng điềm tĩnh', 'Steady Hand', 'Thắng bằng Xạ thủ và chịu tối đa 150 sát thương cả ván.', 'Win with the Ranger taking at most 150 damage all run.', { maxDamageTaken: 150 });
  c('ch_dasher', 'dasher', 'Vũ điệu lưỡi kiếm', 'Blade Dance', 'Thắng bằng Kiếm khách và lướt ít nhất 150 lần.', 'Win with the Dasher and dash at least 150 times.', { minDashes: 150 });
  c('ch_bulwark', 'bulwark', 'Bất khuất', 'Unbreakable', 'Thắng bằng Hộ vệ ở độ khó 2 trở lên.', 'Win with the Bulwark on danger 2 or higher.', { minDanger: 2 });
  c('ch_tinker', 'tinker', 'Nhà phát minh', 'Inventor', 'Thắng bằng Thợ máy với ít nhất 2 lần tiến hóa.', 'Win with the Tinker with at least 2 evolutions.', { minEvolutions: 2 });
  NR.data.challenges = C;

  NR.data.locked = [
    { kind: 'weapon', id: 'railgun', ach: 'boss_nohit' },
    { kind: 'weapon', id: 'comet_staff', ach: 'reaction_50' },
    { kind: 'weapon', id: 'chakram', ach: 'elites_20' },
    { kind: 'item', id: 'time_dial', ach: 'win_dasher' },
    { kind: 'item', id: 'golden_skull', ach: 'rich' },
    { kind: 'trait', id: 'chain_kill', ach: 'slayer' },
    { kind: 'trait', id: 'shatter_master', ach: 'triple_evo' }
  ];
})();
