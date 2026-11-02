# FX requests (contract gaps; all worked around in fx code)

SPEC.md was not in core-a.zip or core-b.zip, so these assumptions come from the stubs, README and tests/harness.js.

1. `enemy:attack` payload: add `angle` (radians), `shape` ('zone' | 'line' | 'cone') and `w` (line width) / `arc` (cone width).
   Now: fx guesses the type from the `kind` text (line|lunge|dash|snipe|beam... -> line, cone|sweep|slash... -> cone, else zone),
   aims lines at the player, uses `r` as line length / zone radius, and follows the enemy while it winds up.
2. `pickup:collect` payload: add `color` (and ideally `shape`). Now: fx maps the six known pickup types to colors and uses white for new types.
3. Entity fields written by fx on enemies/player (sim must not reuse them): `flash` (seconds left of the white hit flash),
   `sx`/`sy` (squash spring), plus `fvx`, `fvy`, `kox`, `koy`, `_tr`. Pooled entities clear them on reuse (world.add deletes non-COMMON keys).
4. Status keys: fx matches status names by text (burn/fire, chill/freeze/ice, shock/stun, poison/toxin, anything else = void flecks).
   Keep `e.status[name].t > 0` while active and `e.flags.frozen` for a frozen enemy. A one-line list of final status ids would let fx drop the matching.
5. Generic render flags read from entities: `flags.elite`, `flags.enraged`, `flags.frozen`, `flags.telegraph|charging|windup` (or `ai.state` = windup|telegraph|charge|aim),
   `flags.phased|invisible|cloaked` or `e.alpha`. Evolved projectile look comes from `NR.data.weapons[weaponId].evolved`.
6. `main.js` calls `fx.render.draw` only; low-HP frame, flashes and enemy bullets are drawn inside it, so no change needed.
