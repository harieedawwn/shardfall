// Owned by Horde. Pure data. A phase is {below (hp ratio), speedMult, patterns[]}; extra phase keys: keep (px), cd (s between patterns), enraged.
// Pattern ids: stomp, volley, fan, nova, spiral, summon, charge, vortex. Every pattern keeps an angular safe gap (checked by tests/horde.test.js).
(function () {
  const NR = globalThis.NR = globalThis.NR || {};
  NR.data = NR.data || {};
  NR.data.bosses = {
    scrap_titan: {
      name: { vi: 'Titan Phế Liệu', en: 'Scrap Titan' }, zone: 'scrap', shape: 'hex', color: '#D9693A', r: 56, hp: 600,
      phases: [
        { below: 1, speedMult: 1, keep: 260, cd: 1.6, patterns: [
          { id: 'stomp', tele: 0.9, rings: 1, n: 26, gapN: 3, speed: 175, bulletR: 6 },
          { id: 'volley', tele: 0.7, count: 5, spread: 1.0, bursts: 2, speed: 210, bulletR: 6 },
          { id: 'summon', tele: 1.0, enemy: 'grunt', count: 3, maxKids: 8 }
        ] },
        { below: 0.5, speedMult: 1.25, keep: 220, cd: 1.2, patterns: [
          { id: 'stomp', tele: 0.8, rings: 2, ringDelay: 0.45, n: 30, gapN: 4, speed: 185, bulletR: 6 },
          { id: 'volley', tele: 0.6, count: 7, spread: 1.3, bursts: 3, speed: 220, bulletR: 6 },
          { id: 'summon', tele: 0.9, enemy: 'grunt', count: 4, maxKids: 10 }
        ] }
      ],
      reward: { gold: 40, shards: 0 }
    },
    frost_warden: {
      name: { vi: 'Người Gác Băng', en: 'Frost Warden' }, zone: 'frost', shape: 'diamond', color: '#8FC1E3', r: 56, hp: 900,
      phases: [
        { below: 1, speedMult: 1, keep: 300, cd: 1.5, patterns: [
          { id: 'fan', tele: 0.8, count: 7, spread: 1.4, waves: 2, speed: 200, bulletR: 6 },
          { id: 'nova', tele: 0.9, rings: 1, n: 28, gapN: 3, speed: 150, bulletR: 7 }
        ] },
        { below: 0.65, speedMult: 1.15, keep: 260, cd: 1.3, patterns: [
          { id: 'fan', tele: 0.7, count: 9, spread: 1.7, waves: 3, speed: 210, bulletR: 6 },
          { id: 'nova', tele: 0.8, rings: 2, ringDelay: 0.5, n: 30, gapN: 4, speed: 155, bulletR: 7 },
          { id: 'charge', tele: 0.9, speed: 560, dur: 0.75, width: 112, recover: 1.0 }
        ] },
        { below: 0.3, speedMult: 1.3, keep: 240, cd: 1.0, patterns: [
          { id: 'fan', tele: 0.6, count: 9, spread: 1.7, waves: 3, speed: 220, bulletR: 6 },
          { id: 'nova', tele: 0.7, rings: 3, ringDelay: 0.4, n: 32, gapN: 4, speed: 160, bulletR: 7 },
          { id: 'charge', tele: 0.7, speed: 620, dur: 0.75, width: 112, recover: 0.8 }
        ] }
      ],
      reward: { gold: 60, shards: 0 }
    },
    void_maw: {
      name: { vi: 'Hàm Hư Không', en: 'Void Maw' }, zone: 'void', shape: 'star', color: '#E86AA6', r: 56, hp: 1300,
      phases: [
        { below: 1, speedMult: 1, keep: 320, cd: 1.5, patterns: [
          { id: 'spiral', tele: 0.8, arms: 3, rate: 0.2, dur: 4, spin: 0.55, speed: 150, bulletR: 6 },
          { id: 'vortex', tele: 0.9, dur: 2.6, pull: 1100, arms: 3, rate: 0.28, spin: 0.9, speed: 120, bulletR: 6 }
        ] },
        { below: 0.65, speedMult: 1.15, keep: 280, cd: 1.3, patterns: [
          { id: 'spiral', tele: 0.7, arms: 4, rate: 0.22, dur: 4, spin: -0.6, speed: 155, bulletR: 6 },
          { id: 'vortex', tele: 0.8, dur: 2.8, pull: 1250, arms: 3, rate: 0.26, spin: -0.9, speed: 125, bulletR: 6 },
          { id: 'summon', tele: 1.0, enemy: 'phantom', count: 2, maxKids: 4 }
        ] },
        { below: 0.3, speedMult: 1.3, keep: 260, cd: 1.0, enraged: true, patterns: [
          { id: 'spiral', tele: 0.6, arms: 4, rate: 0.18, dur: 4.5, spin: 0.75, speed: 165, bulletR: 6 },
          { id: 'vortex', tele: 0.7, dur: 3.0, pull: 1350, arms: 4, rate: 0.24, spin: 1.0, speed: 130, bulletR: 6 },
          { id: 'summon', tele: 0.9, enemy: 'phantom', count: 3, maxKids: 6 }
        ] }
      ],
      reward: { gold: 80, shards: 0 }
    }
  };
})();
