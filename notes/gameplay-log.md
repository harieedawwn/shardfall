# Gameplay log (autonomous revamp)

Working log for the 7-step gameplay pass. Newest step at the bottom. If the session is cut, read the **Next** line of the last step.
Decisions are logged here instead of asking. Baseline before this pass: 108 tests green, hash gate 48/48.

## Step 1 - Balance tooling + fixes  (DONE)
- `tools/balance.js`: `node tools/balance.js [--seeds 20] [--sim 1200] [--chars a,b] [--danger 0,3] [--top 30] [--json f]`.
  Runs `tests/run.js --sim` in parallel child processes, prints win/lose/timeout %, avg wave per char/danger, damage share per id
  (`item:<id>` = item procs, `reaction:<id>` = reactions), flags any id >35% share and lists stuck (timeout) runs. ~90 s on 4 cores.
- (a) `static_charm` counted shots on every weapon hand, so it scaled with hands x fire rate. Now a cooldown-gated bolt
  (`zap` effect, `cd` 1.6s -0.25/stack min 0.8, dmg 26 +10/stack): at most one bolt per cooldown whatever the weapon count.
- (b) dasher never killed boss 1: **root cause = `tests/bot.js`** (always kited to ~300 px, katana reaches ~105+boss radius; trace showed the bot never closed under 250 px).
  Boss armour (guard armour 10 = half damage unless the core is exposed) and the burst barrier were measured and do *not* stall melee:
  after the bot fix, dasher boss-1 time-to-kill is 1-60 s (ranger: 18-69 s). So no boss change; the bot now has a melee mode
  (build reach < 300 px: close in, orbit, dash through bullets). Regression test in `tests/horde.test.js`.
- Before (160 runs, 1200 s): win 33.8% (d0 62.5%, d3 5.0%), avg wave 9.86, dasher 2.5% win with 30% timeouts at boss 1 (12 of 40 stuck at w5),
  static_charm 16.8% of all damage (top source), katana 10.6%.
- After: win 35.0% (d0 66.3%, d3 3.8%), avg wave 10.59, **0 timeouts**, dasher 22.5% (d0 40%), static_charm 3.4%, katana 19.8% (now actually reaches targets;
  watch it in step 7: 54% in-run share where owned).
- Next: step 2 (element reactions + set bonuses).
