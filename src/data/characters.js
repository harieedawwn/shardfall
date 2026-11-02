// Owner: Progression. Four characters: different stats, starting weapon and one passive trait each.
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  NR.data = NR.data || {};
  function pc(v) { return Math.round(v * 1000) / 10 + '%'; }
  // passive: { fx, p:{values}, tpl:{vi,en} } - text is generated from p so numbers never drift
  function ch(vi, en, dvi, den, shape, color, base, dash, weapon, unlock, startItems, passive) {
    const P = passive.p, d = {};
    ['vi', 'en'].forEach(function (l) {
      d[l] = passive.tpl[l].replace(/\{(\w+)(%)?\}/g, function (m, k, p) { return P[k] === undefined ? m : (p ? pc(P[k]) : String(P[k])); });
    });
    return {
      name: { vi: vi, en: en }, desc: { vi: dvi, en: den }, shape: shape, color: color, base: base, dash: dash, startWeapon: weapon,
      startItems: startItems || [], passive: d, passiveFx: { fx: passive.fx, p: P, mods: passive.mods || [] }, unlock: unlock
    };
  }
  NR.data.characters = {
    ranger: ch('Xạ thủ', 'Ranger', 'Cân bằng, thiên về đứng bắn chính xác.', 'Balanced; rewards steady, precise fire.', 'circle', '#5FA8D3',
      { maxHp: 100, critChance: 0.08 }, { charges: 2, cd: 1.2, dist: 150, iframes: 0.25 }, 'pistol', { type: 'start', cost: 0 }, [],
      { fx: 'still', p: { dmg: 0.2, wait: 0.3 }, tpl: { vi: 'Ngắm vững: +{dmg%} sát thương khi đứng yên {wait}s.', en: 'Steady Aim: +{dmg%} damage after standing still for {wait}s.' } }),
    dasher: ch('Kiếm khách', 'Dasher', 'Mong manh nhưng nhanh; lướt liên tục để tăng sát thương.', 'Fragile but fast; chain dashes to stay empowered.', 'tri', '#E8C547',
      { maxHp: 70, moveSpeed: 1.15 }, { charges: 3, cd: 1, dist: 160, iframes: 0.3 }, 'katana', { type: 'shards', cost: 150 }, [],
      { fx: 'dashBuff', p: { dmg: 0.3, dur: 2.5 }, tpl: { vi: 'Vũ điệu kiếm: mỗi lần lướt +{dmg%} sát thương trong {dur}s.', en: 'Blade Dance: each dash grants +{dmg%} damage for {dur}s.' } }),
    bulwark: ch('Hộ vệ', 'Bulwark', 'Chậm và trâu; bị đánh sẽ phản đòn.', 'Slow tank; punishes anything that hits it.', 'square', '#8C4A3B',
      { maxHp: 160, armor: 4, moveSpeed: 0.85 }, { charges: 2, cd: 1.4, dist: 130, iframes: 0.2 }, 'scattergun', { type: 'shards', cost: 250 }, [],
      { fx: 'retaliate', p: { r: 130, dmg: 30 }, tpl: { vi: 'Phản đòn: khi bị đánh, sóng xung kích bán kính {r} gây {dmg} sát thương.', en: 'Retaliate: when hit, a shockwave (radius {r}) deals {dmg} damage.' } }),
    tinker: ch('Thợ máy', 'Tinker', 'Xây dựng theo bộ: khởi đầu với chất xúc tác, mua rẻ hơn.', 'Build-around engineer: starts with a catalyst and shops cheaper.', 'hex', '#5FB49C',
      { maxHp: 90, damage: 0.9, shopDiscount: 0.1 }, { charges: 2, cd: 1.2, dist: 150, iframes: 0.25 }, 'drone_pod', { type: 'shards', cost: 400 }, ['cat_swarm_core'],
      { fx: 'mods', p: { status: 0.3, discount: 0.1 }, mods: [{ stat: 'statusPower', pct: 0.3 }], tpl: { vi: 'Kỹ sư: +{status%} sức hiệu ứng, giảm giá cửa hàng {discount%}, khởi đầu với Lõi bầy đàn.', en: 'Engineer: +{status%} status power, {discount%} shop discount, starts with Swarm Core.' } })
  };
})();
