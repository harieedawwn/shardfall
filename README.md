# Shardfall

Top-down twin-stick wave roguelite in plain JavaScript (no build step, no modules). `SPEC.md` is the contract.

## Run
Double-click `index.html` (works from `file://`) or serve the folder (GitHub Pages ready, `.nojekyll` included).

## Test
```
node tests/run.js                                        # all seven suites (core arsenal horde progression reactions fx ui) (exit 1 on any failure)
node tests/run.js --only core                            # one suite
node tests/run.js --strict-events                        # also fail when a SPEC 8 event is never emitted
node tests/run.js --sim 300 --seed 7 --char ranger --danger 0 [--fx] [--endless]   # headless bot run, prints one JSON line
```
`--sim` prints `{state,result,wave,kills,damageTaken,ticks,msPerTick,worstMs,peak,damageByWeapon,seed,char,danger,hash}`
and exits 1 on any exception or NaN. Same seed gives the same `hash` (with or without `--fx`).

Test files: `module.exports = function (H) { H.test('name', () => { const NR = H.load(); ... }); }`.
`H.load({fx,ui,storage,navigator})` returns a fresh `NR` in a Node `vm` (script order read from `index.html`; fake DOM only
when `fx`/`ui` is requested). `H.runSim`, `H.hashWorld`, `H.findNaN`, `H.audit` (events seen + payload problems), `NR.fakeCanvas`, `NR.bot`.

## Ownership
Every file starts with its owner; stubs begin with `// STUB - owned by <Owner>` and are replaced in place. See SPEC section 6.

## Core conventions (for module owners)
- `NR.world.get()` returns the live `W`; **`W` is a new object on every `run.start`/`continueRun`**, so never cache it across runs.
- Pooled entities are reused after `world.cleanup()`: keep entity `id`s, not references, across ticks. Always emit via `NR.events.emit(...)` (the harness audits it).
- `NR.input.read()` is idempotent per tick (shared intent object) and may be called by `weapons`. `consumePause()` is the only consuming call.
- Use `NR.rng` only in sim code; fx must use their own cosmetic PRNG so the sim hash never depends on fx.
- Stats: `NR.stats.defaults` (e.g. `pickupRange` is flat px, base 70; `dashCooldown` is seconds; `weaponSlots` base 4). `p.baseStats` = defaults + character base.
- Run flow: `run.start` seeds rng, creates world, resets modules, creates the player, calls `meta.applyToRun(p)`, adds `startWeapon`/`startItems`, then `director.startWave(1)`.
  `wave:clear` is handled by `run` (state `clear`, gold bonus, `projectiles.clearHostile`, `enemies.dissolveAll`); after 1.5 s `progression.pending()>0` -> `levelup` else shop/victory.
- Snapshot restore re-applies `meta.applyToRun`, `items.grant` for each owned item and upgrades via `NR.data.upgrades[stat].rarities[rarity]` as mod source `upgrade:<index>`; `progression.pick` must use the same source names.
- `i18n`, `camera` have an `init()` like other modules; `boot()` calls every module's `init` once.
- `MAX_LEVEL` in config = weapon level cap (5).
