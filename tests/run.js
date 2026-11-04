'use strict';
// node tests/run.js                      -> run all suites
// node tests/run.js --sim 300 --seed 7 --char ranger --danger 0 [--fx] [--endless]  -> headless bot run
const fs = require('fs');
const path = require('path');
const H = require('./harness');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i < 0) return def;
  const v = process.argv[i + 1];
  return v === undefined || v.indexOf('--') === 0 ? true : v;
}

function sim() {
  const opts = {
    seconds: Number(arg('sim', 60)), seed: Number(arg('seed', 1)), char: String(arg('char', 'ranger')),
    danger: Number(arg('danger', 0)), fx: arg('fx', false) === true, endless: arg('endless', false) === true
  };
  try {
    const NR = H.load({ fx: opts.fx });
    NR.main.boot();
    const s = NR.bot.play(opts);
    console.log(JSON.stringify(s));
    process.exit(0);
  } catch (e) {
    console.error('SIM FAILED: ' + (e && e.stack || e));
    process.exit(1);
  }
}

function suites() {
  const order = ['core', 'arsenal', 'horde', 'progression', 'reactions', 'events', 'fx', 'ui'];
  let pass = 0, fail = 0;
  const only = arg('only', null);
  for (const name of order) {
    if (only && only !== name) continue;
    const file = path.join(__dirname, name + '.test.js');
    if (!fs.existsSync(file)) { console.log('FAIL suite ' + name + ': missing ' + name + '.test.js'); fail++; continue; }
    H.tests = [];
    let t;
    try { t = require(file); if (typeof t === 'function') t(H); } catch (e) { console.log('FAIL suite ' + name + ': load error ' + (e && e.stack || e)); fail++; continue; }
    let sp = 0, sf = 0;
    for (const tc of H.tests) {
      try { tc.fn(); sp++; console.log('  ok   ' + name + ': ' + tc.name); }
      catch (e) { sf++; console.log('  FAIL ' + name + ': ' + tc.name + '\n       ' + (e && e.message || e)); }
    }
    pass += sp; fail += sf;
    console.log('suite ' + name + ': ' + sp + ' passed, ' + sf + ' failed');
  }
  console.log('\nTOTAL: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}

if (arg('sim', null) !== null) sim(); else suites();
