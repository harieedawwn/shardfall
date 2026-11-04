'use strict';
// Balance report. Runs headless bot sims in parallel child processes and prints win rate, average wave and damage share.
//   node tools/balance.js                       # seeds 1..20 x 4 chars x danger 0,3, --sim 1200
//   node tools/balance.js --seeds 8 --sim 600   # quicker
//   node tools/balance.js --chars dasher --danger 0,3 --json out.json
//   node tools/balance.js --top 25              # rows shown in the damage-share table (default 30)
// Damage share = total damage of an id / total damage of all runs ("item:<id>" = item procs, "reaction:<id>" = element reactions).
// "in runs" = how many runs the id dealt any damage in; "avg/run" = mean damage of the runs it appeared in.
const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const root = path.join(__dirname, '..');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i < 0) return def;
  const v = process.argv[i + 1];
  return v === undefined || v.indexOf('--') === 0 ? true : v;
}
const seeds = Number(arg('seeds', 20));
const secs = Number(arg('sim', 1200));
const chars = String(arg('chars', 'ranger,dasher,bulwark,tinker')).split(',');
const dangers = String(arg('danger', '0,3')).split(',').map(Number);
const jobs = Number(arg('jobs', Math.max(1, os.cpus().length)));
const top = Number(arg('top', 30));
const jsonOut = arg('json', null);

const queue = [];
for (const ch of chars) for (const d of dangers) for (let s = 1; s <= seeds; s++) queue.push({ char: ch, danger: d, seed: s });
const results = [];
let next = 0, running = 0, done = 0;

function launch(job, cb) {
  const args = ['tests/run.js', '--sim', String(secs), '--seed', String(job.seed), '--char', job.char, '--danger', String(job.danger)];
  const c = cp.spawn(process.execPath, args, { cwd: root });
  let out = '', err = '';
  c.stdout.on('data', function (d) { out += d; });
  c.stderr.on('data', function (d) { err += d; });
  c.on('close', function (code) {
    let r = null;
    try { r = JSON.parse(out.trim().split('\n').pop()); } catch (e) { /* failed run */ }
    cb(r || { failed: true, error: (err || out).slice(0, 300), char: job.char, danger: job.danger, seed: job.seed });
  });
}
function pump() {
  while (running < jobs && next < queue.length) {
    const job = queue[next++];
    running++;
    launch(job, function (r) {
      running--; done++;
      results.push(r);
      if (process.stderr.isTTY) process.stderr.write('\r' + done + '/' + queue.length);
      if (done === queue.length) report(); else pump();
    });
  }
}

function pct(n, d) { return d ? (100 * n / d).toFixed(1) + '%' : '-'; }
function pad(s, n) { s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length); }
function rpad(s, n) { s = String(s); return s.length >= n ? s : ' '.repeat(n - s.length) + s; }

function report() {
  if (process.stderr.isTTY) process.stderr.write('\r');
  const failed = results.filter(function (r) { return r.failed; });
  const ok = results.filter(function (r) { return !r.failed; });
  console.log('Shardfall balance: ' + ok.length + ' runs (' + chars.join(',') + ' x danger ' + dangers.join(',') + ' x seeds 1..' + seeds + ', ' + secs + ' s each)');
  if (failed.length) { console.log('FAILED RUNS: ' + failed.length); failed.slice(0, 5).forEach(function (f) { console.log('  ' + f.char + ' d' + f.danger + ' s' + f.seed + ': ' + f.error); }); }

  function agg(list) {
    let win = 0, wave = 0, lose = 0, tout = 0, bossStuck = 0;
    for (const r of list) { if (r.result === 'win') win++; else if (r.result === 'lose') lose++; else tout++; wave += r.wave; }
    return { n: list.length, win: win, lose: lose, timeout: tout, wave: list.length ? wave / list.length : 0 };
  }
  console.log('\n' + pad('group', 16) + rpad('runs', 5) + rpad('win%', 8) + rpad('lose%', 8) + rpad('timeout%', 10) + rpad('avg wave', 10));
  function row(name, list) {
    const a = agg(list);
    console.log(pad(name, 16) + rpad(a.n, 5) + rpad(pct(a.win, a.n), 8) + rpad(pct(a.lose, a.n), 8) + rpad(pct(a.timeout, a.n), 10) + rpad(a.wave.toFixed(2), 10));
  }
  row('ALL', ok);
  for (const d of dangers) row('danger ' + d, ok.filter(function (r) { return r.danger === d; }));
  for (const ch of chars) {
    row(ch, ok.filter(function (r) { return r.char === ch; }));
    for (const d of dangers) row('  ' + ch + ' d' + d, ok.filter(function (r) { return r.char === ch && r.danger === d; }));
  }

  // damage share per id
  const tot = {}, runsWith = {};
  let all = 0;
  for (const r of ok) {
    const m = r.damageByWeapon || {};
    for (const k in m) { tot[k] = (tot[k] || 0) + m[k]; runsWith[k] = (runsWith[k] || 0) + 1; all += m[k]; }
  }
  const ids = Object.keys(tot).sort(function (a, b) { return tot[b] - tot[a]; });
  console.log('\n' + pad('damage source', 28) + rpad('share', 8) + rpad('in runs', 9) + rpad('avg/run', 10));
  for (const k of ids.slice(0, top)) console.log(pad(k, 28) + rpad(pct(tot[k], all), 8) + rpad(runsWith[k], 9) + rpad(Math.round(tot[k] / runsWith[k]), 10));
  if (ids.length > top) console.log('... ' + (ids.length - top) + ' more');
  const over = ids.filter(function (k) { return tot[k] / all > 0.35; });
  console.log(over.length ? '\nOVER 35% share: ' + over.map(function (k) { return k + ' ' + pct(tot[k], all); }).join(', ') : '\nNo id above 35% share.');

  // per-run share too: an id that dominates a run when owned (avg of its share within runs where it appeared)
  const per = {};
  for (const r of ok) {
    const m = r.damageByWeapon || {};
    let s = 0; for (const k in m) s += m[k];
    if (!(s > 0)) continue;
    for (const k in m) { (per[k] = per[k] || []).push(m[k] / s); }
  }
  const dom = Object.keys(per).filter(function (k) { return per[k].length >= 5; }).map(function (k) {
    return { k: k, avg: per[k].reduce(function (a, b) { return a + b; }, 0) / per[k].length, n: per[k].length };
  }).sort(function (a, b) { return b.avg - a.avg; }).slice(0, 8);
  console.log('\nMean in-run share where owned (>=5 runs): ' + dom.map(function (d) { return d.k + ' ' + (d.avg * 100).toFixed(0) + '%'; }).join(', '));

  // boss stalls: runs that timed out
  const stalls = ok.filter(function (r) { return r.result === 'timeout'; });
  if (stalls.length) {
    const by = {};
    for (const r of stalls) { const k = r.char + ' w' + r.wave; by[k] = (by[k] || 0) + 1; }
    console.log('Timeouts (stuck): ' + Object.keys(by).map(function (k) { return k + ' x' + by[k]; }).join(', '));
  }
  if (jsonOut) {
    fs.writeFileSync(typeof jsonOut === 'string' ? jsonOut : 'balance.json', JSON.stringify({ runs: ok.map(function (r) { return { char: r.char, danger: r.danger, seed: r.seed, result: r.result, wave: r.wave, kills: r.kills, hash: r.hash, damageByWeapon: r.damageByWeapon }; }) }, null, 1));
  }
  process.exit(failed.length ? 1 : 0);
}
pump();
