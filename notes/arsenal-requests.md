# Arsenal requests / assumptions

SPEC.md was not in core-a.zip or core-b.zip. I built to the stub APIs, the harness event schemas and src/core/stats.js.
Please check these against SPEC.md:

1. **Status names and tuning** (my reading of "Stats & Formulas"): burn (40% of the lighting hit per second for 3 s, ignores armor), poison (14% per stack per second, 5 stacks, 4 s), chill (11% slow per stack, 5 stacks = frozen 1.4 s, then 2 s immunity), frozen (+25% damage taken), shock (0.45 s stun + 2 arcs at 50%), void (+20% damage taken, 4 s). `status:apply` sends `chill`, `frozen`, `burn`, `poison`, `shock`, `void`. Constants are in `NR.combat.STATUS`.
2. **Horde**: slows and stuns are applied inside `combat.update` by undoing part of the enemy's own move this tick (needs `e.px/e.py` set at the start of `enemies.update`). Cleaner: read `e.status.frozen.t`, `e.status.stun.t`, `e.status.chill.stacks` (or `e.flags.frozen/stunned/chilled/burning/poisoned/marked`) and scale movement yourself. Enemy `e.dodge` (0..1) is honored if set.
3. **FX**: `damage:dealt` carries `weight` (0..1, hit-stop strength; 0 for DoT) and `dot`. Weapon data has `shape`, `color`, `size`, `trail`, `hit`, `sfx` (only the stub names `shoot_light` / `shoot_heavy` are used). Projectiles carry `shape color size trail rot sx sy`; areas carry `areaKind shape color len arc w r` (beam and cone visuals are areas with `dmg = 0`, life ~0.1 s; aura areas have `aura = true`). Drones are in `W.drones` with `shape color r rot`. Orbit/aura weapons emit no `weapon:fire` (they are always on).
4. **Progression**: evolution uses the existing `items.checkEvolutions` -> `weapons.evolve`. Evolved weapons have one level row; `w.lvl` stays 1. `weapons.init()` now exists (tracks `w.dealt`, Toxic Cloud Lv5 plague).
5. **Shop/UI**: `weapons.remove` also removes that weapon's drones, saws and aura. `weapons.resolve(p, slot)` returns every per-level field including kind extras.
