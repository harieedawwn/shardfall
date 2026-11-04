'use strict';
// Sim hash gate. Runs the baseline matrix: 4 characters x seeds 1,2,3 x danger 0,5, `--sim 120`, with and without `--fx`.
//   node tools/hash-check.js            -> compare against tools/baseline-hashes.json (exit 1 on any mismatch)
//   node tools/hash-check.js --write    -> (re)write the baseline (only do this on the pre-revamp commit)
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const root = path.join(__dirname, '..');
const file = path.join(__dirname, 'baseline-hashes.json');
const chars = ['ranger', 'dasher', 'bulwark', 'tinker'];
const out = {};
for (const ch of chars) for (const seed of [1, 2, 3]) for (const d of [0, 5]) for (const fx of [false, true]) {
  const args = ['tests/run.js', '--sim', '120', '--seed', String(seed), '--char', ch, '--danger', String(d)];
  if (fx) args.push('--fx');
  const r = cp.spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) { console.error('sim failed: ' + args.join(' ') + '\n' + r.stderr); process.exit(1); }
  const s = JSON.parse(r.stdout.trim().split('\n').pop());
  out[ch + '/s' + seed + '/d' + d + (fx ? '/fx' : '')] = { hash: s.hash, wave: s.wave, kills: s.kills, state: s.state };
}
if (process.argv.indexOf('--write') >= 0) {
  fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
  console.log('wrote ' + Object.keys(out).length + ' hashes to tools/baseline-hashes.json');
  process.exit(0);
}
const base = JSON.parse(fs.readFileSync(file, 'utf8'));
let bad = 0, n = 0;
for (const k in base) {
  n++;
  const a = base[k], b = out[k];
  if (!b || a.hash !== b.hash) { bad++; console.log('MISMATCH ' + k + ' baseline ' + a.hash + ' now ' + (b && b.hash)); }
}
console.log('hash gate: ' + (n - bad) + '/' + n + ' match' + (bad ? '' : ' (100%)'));
process.exit(bad ? 1 : 0);
