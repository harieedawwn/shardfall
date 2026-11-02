# Horde requests (contract changes I worked around)

1. **Arsenal `combat.hitEnemy`**: skip the hit (no `damage:dealt`) when `e.flags.invuln`, and when `e.flags.shielded` and the weapon kind is `projectile|spread|homing|drone`. Today Horde gives the damage back in a `damage:dealt` listener (`enemies.init`), so damage numbers still show and a lethal hit on a shielder cannot be undone.
2. **Arsenal `status.pull`**: Horde moves enemies toward `status.pull` (260 px/s decaying over `t`=0.4 s) and decrements/expires `pull.t`. Combat must not also move or decrement it. Horde reads `status.chill.n || .stacks` (default 1) and `status.freeze.t`, and writes `flags.frozen/burning/poisoned` from the timers.
3. **Core/Arsenal: push the player.** `void_maw` vortex adds acceleration straight to `player.kbx/kby` (steady pull about 120 px/s, below run speed). Wanted: a public `NR.player.push(dx, dy)` or `NR.combat.knockPlayer(...)`.
4. **Core `run.step`**: the spatial grid is stale after `world.cleanup()` (step 12), so index lookups in the next tick's step 4 can hit missing entities. `enemies.update` calls `NR.spatial.rebuild(W)` first. Wanted: rebuild at the start of the tick, or in cleanup.
5. **FX (`enemy:attack` payload, all kinds except `melee` carry `time >= 0.5`, and `enemy.flags.telegraph` is true at emission):**
   - `shoot`: x,y = aim point, r = bullet radius.
   - `dash`: x,y = end point of the dash (or blink reappear point for `phantom`), r = half lane width.
   - `blast`: x,y = centre, r = radius (also medic heal pulse, volatile death blast, boss phase burst).
   - `summon`: x,y = spawn point/marker. 1 s director spawn markers and 0.8 s boss-summon markers also use `summon`, with a placeholder `enemy` (id 0, `defId`, `shape`, `color`, `r`, `flags.telegraph=true`) because the entity does not exist yet.
   - `melee`: `time` 0, emitted on contact hits.
   - fx also reads `e.ai.state` and `e.ai.tx/ty` (live aim point for sniper/spitter).
6. **Additive API (Horde-internal):** `NR.enemies.init()` (subscribes `damage:dealt`); `enemies.spawn` opts `marker` (s), `owner`, `gen`, `xpMult`, `scale`. Marker spawns return null.
7. **`boss:phase`**: `0` at spawn, then `2`, `3` at each transition (phase 1 is the spawn state).
8. **Data:** enemy budget price is `aiParams.cost`; boss `phases[]` carry extra keys `keep`, `cd`, `enraged`; boss `reward.shards` is unused (Shards come from `meta.shardsFor`).
