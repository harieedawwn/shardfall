# SHARDFALL — SPEC.md
Contract for six parallel builders (**Core, Arsenal, Horde, Progression, FX, UI**). Names here are law: never rename, never add a cross-module name that is not listed. Units: px, seconds, radians, `#RRGGBB`. Arena origin top-left, +y down. `NR` = global namespace, `W` = live world state from `NR.world.get()`.
## 1 Vision
- Shardfall: top-down twin-stick wave roguelite, 15 waves in 3 zones (~15 min). Shoot, dash and kill within 3 s; first level-up under 25 s; no tutorial text needed.
- Pillars: (1) instantly readable action; (2) a real build decision every wave (cards, shop, evolutions); (3) heavy feel from motion and shape only, strictly flat style; (4) replay via 4 characters, danger 0-5, Shards meta, codex.
- Currencies: XP and Gold (per run), Shards (permanent). Same seed + same intents = same run (deterministic sim).
## 2 Run Structure
- States: `menu` → `wave` → `clear` → `levelup` (only if queued) → `shop` → `route` (only before a non-boss wave) → `wave`… ; after wave 15 (non-Endless) → `victory` (Endless or finish) → `end`. `paused` (Esc) remembers the previous state. The sim steps only in `wave` and `clear`.
- Zones: `scrap` waves 1-5, `frost` 6-10, `void` 11-15. Bosses on waves 5/10/15 (`scrap_titan`, `frost_warden`, `void_maw`). Wave length = clamp(25+2.5(n-1), 25, 60) s. Normal waves end at timer 0 (spawning stops 3 s early; leftovers dissolve, no drops). Boss waves end on boss death (boss `enraged` flag at 90 s).
- `clear` (1.5 s): all pickups magnet to the player, hostile bullets vanish, `wave:clear` fires, wave gold bonus 5+2·wave.
- Level-ups: XP during a wave only raises `player.pending`. At wave end `NR.progression.begin()` resolves each as 1 of 4 stat cards (rarity rolled from luck+wave). Card reroll costs Gold, rising per reroll within that level.
- Traits: every level-up offer holds at least one `trait` card while any trait can still be taken (a second with 20% chance). 20 traits (`NR.data.traits`, up to 3 levels, `p.traits={id:level}`, saved in the snapshot): `ricochet ember_dash dead_eye dash_refund shatter_master split_shot adrenaline siphon thorns bounty chain_kill needle far_sight second_wind light_feet shockstep executioner focus_fire momentum crit_surge`. Trait damage is attributed to `trait:<id>`; a card flagged `match` fits the current build.
- Route: after the shop and before a normal wave, `route` offers 2-3 of `swarm elite_hunt calm gold_rush omen` (`NR.data.routes`, multipliers on `W.scale` for that wave only; `calm` suppresses and `omen` forces the mid-wave event). `NR.run.chooseRoute(i)` starts the wave; boss waves skip it.
- Shop: 4 offers (weapon or item; never maxed weapons/items); lock persists across reroll and next wave; reroll price rises per use, resets next shop; sell any owned weapon/item for 50% of paid; buying an owned weapon = level up (max Lv5); slots 4 (+1 with `m_slot`); a new weapon with full slots needs a sale first.
- Evolution: weapon Lv5 + its catalyst item owned → evolves instantly (free, catalyst kept). Checked only by `NR.items.checkEvolutions`.
- Endless (after `victory` choice): wave 16+, zones cycle, boss every 5, scaling in §5. Run ends on `player:death` (lose), after victory finish (win) or abandon.
- End screen: time, wave, level, kills, Gold earned, damage taken, dashes, bosses killed, damage per weapon (evolved included), items, Shards earned = `floor((3·wave + kills/25 + 20·bossesKilled + (win?60:0)) · shardMult)`.
- Meta: Shards buy 10 nodes and 3 characters; danger d+1 unlocks when a run is won at danger d (danger 0 and `ranger` open at start).
## 3 Controls
| Action | Keyboard / mouse | Gamepad | Touch |
|---|---|---|---|
| Move | WASD / arrows | left stick (deadzone .2) | left virtual stick |
| Aim | mouse position | right stick | right virtual stick |
| Fire | hold left click; setting `autoFire` fires whenever an enemy is in range | RT or right stick >.5 | right stick held |
| Dash | Space / Shift / right click | A / LB / RB | dash button |
| Pause | Esc | Start | DOM pause button |
- `NR.input.read()` returns intent `{mx,my,aim,fire,dash,pause,device}` (mx,my in -1..1; aim radians already world-space; aim assist for pad/touch only: ≤12° snap to nearest enemy ≤400 px). Touch UI and the bot drive input only through `NR.input.setVirtual(partial)` / `NR.input.inject(intent)`.
- Dash: moves a fixed distance in move direction (aim if still), i-frames `char.dash.iframes`, charges recharge one at a time (`dashCooldown`).
## 4 Content Registry
- **Rarities** (tier 0-3): `common`, `rare`, `epic`, `legendary`. **Statuses**: `burn`, `chill`, `freeze`, `poison`, `pull`; `shock` = chain arc via `NR.combat.chain`.
- **Elements**: `physical` (none); `fire`→`burn`; `ice`→`chill` then `freeze`; `shock`→chain; `poison`→`poison` (stacks); `void`→`pull`.
- **Characters**: `ranger` (balanced, start `pistol`, unlocked); `dasher` (fast, 3 dash charges, low hp, start `katana`); `bulwark` (slow tank, high hp+armor, start `scattergun`); `tinker` (engineer, start `drone_pod`, +1 drone).
- **Zones** (palette order: ground, ground2, wall, prop, hazard, light; global ink `#14121F`):
  - `scrap`: ["#2E3A32","#3C4B40","#1F2822","#C9A24B","#D9693A","#EDE3C8"]
  - `frost`: ["#27384F","#35506E","#1A2638","#8FC1E3","#C95B73","#EAF4FB"]
  - `void`: ["#2A1E3F","#3B2A58","#1B1229","#8A5BD1","#E86AA6","#F1E0FF"]
- **Weapons (23, kind/element; the 7 v2 variants `smg venom_bow frost_seeker chakram railgun thunder_hammer comet_staff` reuse kinds of these 16)**: `pistol` (projectile/physical, starter single shot); `ember_gun` (projectile/fire, slow burning shots); `scattergun` (spread/physical, close cone, knockback); `frost_fan` (spread/ice, wide shard fan); `lancer` (beam/physical, piercing line, long cooldown); `flamer` (beam/fire, short cone stream); `katana` (melee/physical, fast auto-aimed arc); `maul` (melee/void, slow slam that pulls); `saw_ring` (orbit/physical, circling blades); `drone_pod` (drone/shock, auto-firing drones); `grenade` (thrown/fire, arcing blast); `toxin_mine` (thrown/poison, mine + lingering cloud); `arc_coil` (chain/shock, hopping lightning); `frost_aura` (aura/ice, pulsing chill ring); `toxic_cloud` (aura/poison, DoT cloud); `seeker` (homing/void, homing orbs that pull).
- **Evolutions (23, one per base weapon; weapon + catalyst → evolved; evolved defs keep `kind`, are not shop-sold, and change behaviour, not just numbers)**: the original six `pistol`+`cat_overclock`→`gatling_pistol`; `scattergun`+`cat_hollow_slug`→`shredder`; `flamer`+`cat_fuel_tank`→`inferno_jet`; `katana`+`cat_whetstone`→`storm_blade`; `drone_pod`+`cat_swarm_core`→`hive_pod`; `arc_coil`+`cat_tesla_gem`→`tempest_coil`; and `ember_gun`+`ember_charm`→`dragonfire` (fire trail); `frost_fan`+`frost_charm`→`blizzard_fan` (360° ring every 3rd volley); `lancer`+`scope_lens`→`prism_lance` (3 beams + lingering laser wall); `maul`+`void_shard`→`singularity_maul` (black hole + detonation); `saw_ring`+`vampire_fang`→`bloodsaw` (counter-rotating rings, leech); `grenade`+`blast_core`→`carpet_bomb` (row of grenades); `toxin_mine`+`cat_detonator`→`plague_mine` (chain-reaction mines); `frost_aura`+`cat_rime_core`→`absolute_zero` (ice spike bursts); `toxic_cloud`+`cat_spore_sac`→`miasma` (poison trail); `seeker`+`ghost_cloak`→`wraith_seeker` (persistent piercing orbs); `smg`+`quick_fingers`→`bullet_hose` (spin-up fire rate); `venom_bow`+`venom_vial`→`hydra_bow` (bolts burst into clouds); `frost_seeker`+`cat_cold_snap`→`glacial_seeker` (flash-freeze); `chakram`+`static_charm`→`thunder_ring` (discs hurl lightning); `railgun`+`cat_capacitor`→`rail_reflector` (wall rebound); `thunder_hammer`+`cat_storm_rod`→`skyhammer` (sky bolts); `comet_staff`+`phoenix_feather`→`phoenix_staff` (meteor shower). Any item can be a catalyst (`d.catalyst` is derived from the table); every catalyst is unique to one evolution.
- **Items common (10)**: `rubber_boots` moveSpeed; `lucky_coin` goldGain; `thick_hide` maxHp; `sharp_edge` damage; `quick_fingers` attackSpeed; `magnet_ring` pickupRange; `iron_plating` armor; `scope_lens` critChance; `heart_locket` hpRegen; `spring_heel` dashCooldown.
- **Items rare (7 + 3 catalysts + 4 added catalysts `cat_detonator cat_spore_sac cat_cold_snap cat_capacitor`)**: `vampire_fang` heal on kill; `ember_charm` hit→burn; `frost_charm` hit→chill; `static_charm` hit→chain; `venom_vial` hit→poison; `void_shard` crit→pull; `bounty_badge` kill→Gold; catalysts `cat_overclock` (+attackSpeed), `cat_hollow_slug` (+damage), `cat_fuel_tank` (+area).
- **Items epic (3 + 3 catalysts + 2 added `cat_rime_core cat_storm_rod`)**: `phoenix_feather` +1 revive; `ghost_cloak` dash grants extra i-frames; `blast_core` kills explode; catalysts `cat_whetstone` (+critDamage), `cat_swarm_core` (+projectiles), `cat_tesla_gem` (+statusPower).
- **Items legendary (4)**: `glass_cannon` big damage, less maxHp; `time_dial` dash slows enemies briefly; `golden_skull` goldGain+luck; `echo_stone` kills release a free shockwave.
- **Upgrade stat keys (20 cards × 4 rarities)**: `maxHp hpRegen armor dodge moveSpeed dashCharges dashCooldown damage attackSpeed critChance critDamage area range projectiles pierce pickupRange xpGain goldGain luck statusPower`.
- **Mid-wave events (3, `NR.data.waveEvents`, logic `NR.waveEvents`, state `W.event`)**: from wave 2 a normal (non-boss) wave rolls one event with 50% chance, starting at 20-50% of the wave. `treasure_runner` (kill the fleeing `treasure_runner` enemy in 12 s: gold + heart; escapes otherwise), `cursed_shrine` (stand 3 s in the ring within 30 s: elite pack + escorts; clearing the elites drops a rare+ chest), `shard_storm` (14 s of telegraphed meteors, each leaves XP shards). A wave clear or player death ends the active event as failed.
- **Enemies (12 + event-only `treasure_runner`)**: `grunt` walker, baseline; `swarmer` tiny fast packs; `spitter` keeps range, slow shots; `brute` slow, tanky; `bomber` runs in, fuse blast; `lunger` telegraphed line dash; `sniper` far, long telegraph, fast shot; `shielder` frontal shield blocks bullets; `summoner` stays back, spawns `swarmer`; `splitter` splits in two on death; `medic` heals allies; `phantom` blinks untargetable then strikes.
- **Element reactions (5, `NR.data.reactions`)**: a non-DoT hit of one element on an enemy already carrying another status triggers one reaction (first matching row; per-enemy cooldown `cd`; max 5 per tick; reaction hits never react or proc items). `shatter` (physical/shock on frozen: area blast, consumes freeze); `toxic_blast` (fire+poison: gas burst spreading poison); `superconduct` (shock on chill: 6 jumps, 190 px); `implosion` (void+fire: pulls then blasts); `steam` (fire on chill / ice on burn: 3 s slowing cloud). Damage is attributed to `reaction:<id>`.
- **Element sets (`NR.data.sets`, `NR.data.setMin = 3`)**: 3+ weapons of one element (evolved count) activate: physical +1 pierce; fire burning kills spread burn; ice +25% damage vs frozen; shock +1 chain jump; poison +1 max stack; void pull ×1.5.
- **Affixes (7, `NR.data.affixes`)**: `shielded` (barrier = 60% max HP soaks damage first), `splitter` (3 small copies on death), `toxic` (poison trail pools), `hasty` (+35% speed), `vampiric` (heals 25% max HP when it hits you), `volatile` (telegraphed death blast), `magnetic` (drags the player in within 380 px). Elites carry 1 (2 at danger >= 3 or wave >= 11), are outlined in the affix colour with a glyph badge, and always drop a `chest`.
- **Bosses (3)**: `scrap_titan` (scrap, 2 phases: stomp rings, bolt volleys, summons grunts); `frost_warden` (frost, 3: spike fans, freeze nova, charge); `void_maw` (void, 3: pull vortex, orb spirals, enraged + phantoms).
- **Pickups (6)**: `xp_shard` XP; `gold` Gold; `heart` heal; `magnet` pulls all pickups; `nova_bomb` screen-wide blast; `chest` item or Gold burst.
- **Achievements (15, `NR.data.achievements`) + 4 character challenges (`NR.data.challenges`)**: `first_win boss_nohit triple_evo reaction_50 elites_20 win_ranger win_dasher win_bulwark win_tinker win_d3 events_10 trait_collector rich slayer endless_20`; challenges `ch_ranger ch_dasher ch_bulwark ch_tinker` (win with a condition). Types: win / run / total (cumulative across runs) / bossNoHit / traits / endless. Earned ids are saved in `meta.ach`, cumulative counters (`reactions elites eventsWon kills`) in `meta.progress`; each unlock emits `achievement:unlock` and is listed in `W.stats.newAch` for the end screen.
- **Locked content (`NR.data.locked`, 7)**: weapons `railgun`(boss_nohit) `comet_staff`(reaction_50) `chakram`(elites_20); items `time_dial`(win_dasher) `golden_skull`(rich); traits `chain_kill`(slayer) `shatter_master`(triple_evo). They never appear in shop, chest or level-up pools until earned (`NR.achievements.isUnlocked(kind,id)`); starting weapons/items are never locked.
- **Daily run (`NR.daily`)**: seed, character and danger (0-3) derive from the UTC date; one scored attempt per day (starting it spends the attempt, abandoning counts); score = 100 x wave + kills + 150 x bosses + 1000 if won; results of the last 30 days in `meta.daily.days`; "Copy result" share text. Snapshots carry `daily`.
- **Meta nodes (10, Shards)**: `m_hp` maxHp; `m_damage` damage; `m_slot` +1 weapon slot; `m_gold` startGold; `m_reroll` shopDiscount; `m_xp` xpGain; `m_luck` luck; `m_dash` +1 dash charge; `m_revive` +1 revive per run; `m_magnet` pickupRange. **Unlock keys**: `char:dasher`, `char:bulwark`, `char:tinker` (Shards); danger via wins. **Codex kinds**: `weapon item enemy boss evolution character`.
## 5 Stats & Formulas
- **Stat keys** (`NR.stats.defaults`; characters override): the 20 upgrade keys + `knockback lifesteal projSpeed weaponSlots shopDiscount revives startGold`.
- **Mods** `{src,stat,add,pct,mult}`: `value = clamp((base + Σadd) · (1 + Σpct) · Πmult, limits)`. Multiplier-style stats (`damage attackSpeed area range projSpeed moveSpeed xpGain goldGain statusPower knockback`) have base 1 and mostly use `pct`; count/flat stats (`maxHp armor projectiles pierce dashCharges weaponSlots revives`) use `add`; `dashCooldown` uses negative `pct`. Limits: `dodge` ≤.5, `critChance` ≤1, `dashCooldown` ≥.3 s, `attackSpeed` ≤4. Card value = def value × rarity mult (common 1, rare 1.6, epic 2.5, legendary 4).
- **Damage**: `dealt = max(1, weapon.dmg[lvl] · stats.damage · (crit ? stats.critDamage : 1) · armorMult(enemy.armor) · (frozen ? 1.25 : 1))`. Fire rate = `levels.rate · attackSpeed`; shots = `levels.count + projectiles`; pierce = `levels.pierce + pierce`; `area` scales radius/arc; `range` scales reach; `projSpeed` scales speed.
- **Crit**: `chance = clamp(stats.critChance + weapon.crit, 0, 1)` via `NR.rng`; `critDamage` base 1.5.
- **Armor**: `armorMult(a) = 10 / (10 + max(0,a))`, floor 0.25 (75% max reduction). Player hit: `taken = max(1, dmg · scale.dmg · armorMult(stats.armor))`.
- **Dodge**: rolled first, `rng.chance(stats.dodge)` → no damage, no i-frames. A real hit grants `HURT_IFRAMES` (0.6 s). `lifesteal` heals `dealt · lifesteal`.
- **Status**: `p = min(1, weapon.statusChance · statusPower)`. `burn` 0.35·hit dps, 3 s, refresh (no stack). `chill` +1 stack (max 5), speed ×(1−0.08·stacks), 3 s; at 5 stacks → `freeze` 1.2 s (boss 0.6), stacks reset, 3 s immunity. Shock: chain to ≤3 enemies within 120 px at 50% dmg, no re-chain. `poison` ≤10 stacks, 0.12·hit dps each, 4 s refresh. `pull`: 260 px/s toward point decaying over 0.4 s (boss ×0.2). Durations and dps scale with `statusPower`.
- **XP**: `xpNeed(L) = round(6 + 5L + 1.3L²)`; shard xp = `def.xp · scale.xp · xpGain`. **Gold** per drop = `round(def.gold · scale.gold · goldGain)` (fraction rolled by rng).
- **Prices**: item/weapon = `round(def.cost · (1 + 0.08(wave−1)) · (1 − shopDiscount))`; shop reroll = `ceil((3 + wave) · (1 + 0.4·rerollsThisShop) · (1 − shopDiscount))`; card reroll = `5 + 5·rerollsThisLevel`; sell = `floor(0.5 · paid)`.
- **Rarity weights** `w[r] = base[r] · (1 + luck · tier[r])`; base common 100, rare 25+2·wave, epic 4+1.5·wave, legendary 0 before wave 6 else 1+0.4(wave−6).
- **Wave+danger scale** `NR.stats.enemyScale(wave, danger)`: hp `(1 + .18(w−1) + .012(w−1)²)(1 + .25d)`; dmg `(1 + .06(w−1))(1 + .15d)`; speed `min(1.4, 1 + .005w + .02d)`; count `(1 + .04(w−1))(1 + .1d)`; elite chance `clamp(.03(w−3), 0, .3) + .03d`; gold `1 + .03(w−1)`; xp `1 + .05(w−1)`; shardMult `1 + .3d`.
- **Endless** (w>15, n=w−15): hp ×1.07ⁿ, dmg ×1.04ⁿ, count ×1.03ⁿ (capped by `CAPS.enemies`); zone = cycle by (w−1)/5; boss every 5 waves with hp ×(1 + .6·cycle); wave length 60 s.
## 6 Architecture
- **Script load order** (index.html, classic `<script>`, no modules): 1 `src/core/{config,util,rng,events,stats,spatial,pool}` → 2 `src/lang/{vi,en}` → 3 `src/core/{i18n,save,input,camera,loop}` → 4 `src/data/*` → 5 `src/sim/{world,player,weapons,projectiles,combat,enemies,bosses,director,items,progression,shop,pickups,meta,run}` → 6 `src/fx/{shapes,render,particles,floor,juice,audio}` → 7 `src/ui/{hud,screens,touch}` → 8 `src/main.js`. Each file is an IIFE on `globalThis.NR = globalThis.NR || {}`; at load it only registers itself (no cross-module calls). Node harness loads steps 1-5 (+6/7 on request).
- **Lifecycle**: `NR.main.boot()` calls every module's `init()` once (listeners subscribe there); `NR.run.start` calls `reset()` on stateful sim modules (world, player, weapons, projectiles, combat, enemies, bosses, director, items, progression, shop, pickups). fx/ui reset themselves on `run:start`.
- **Sim step order** (`NR.run.step(dt)`, dt = `NR.config.STEP` = 1/60): 1 `NR.input.read()` → 2 `director.update` → 3 `player.update` → 4 `enemies.update`, `bosses.update` → 5 `spatial.rebuild` → 6 `weapons.update` → 7 `projectiles.update` → 8 `combat.update` → 9 `pickups.update` → 10 `items.update` → 11 `run` bookkeeping (wave end, state changes, `W.time`) → 12 `world.cleanup`. Entities die by `dead=true`; removal only in step 12. Events are synchronous.
- **Render/loop**: `NR.loop` runs an accumulator: 0..n `step` calls, then `frame(realDt)` (fx/ui updates), then `draw(alpha)`; entities keep `px,py` for interpolation. `hitStop`/`slowMo` change only how many steps run; fx requests them via `NR.loop`, shake via `NR.camera.addTrauma`; sim never reads them.
- **Single-writer table**:

| Owner | Files | Sole writer of |
|---|---|---|
| Core | index.html, .nojekyll, .gitignore, LICENSE, README.md, src/main.js, src/core/*, src/sim/{world,player,run}.js, tests/{harness,run,bot,fake-canvas}.js | `W` top level (state, wave, time, tick, stats), player move/hp/gold/dash, settings/save |
| Arsenal | src/data/weapons.js, src/sim/{weapons,projectiles,combat}.js | `player.weapons`, `W.projectiles/areas/drones`, enemy hp/status/knockback |
| Horde | src/data/{enemies,bosses,waves}.js, src/sim/{enemies,bosses,director}.js | `W.enemies`, `W.boss`, enemy AI, wave timer (`W.waveT,W.waveDur`) |
| Progression | src/data/{characters,items,upgrades,meta}.js, src/sim/{items,progression,shop,pickups,meta}.js | `player.items/upgrades/mods/xp/level/pending`, `W.pickups/shop/levelup`, meta+codex data |
| FX | src/fx/{shapes,render,particles,floor,juice,audio}.js | entity visual fields `flash sx sy`, particles/decals/audio |
| UI | src/ui/{hud,screens,touch}.js, src/lang/{vi,en}.js, css/ui.css | DOM only; user clicks call public APIs |
- Each owner also owns `tests/<owner>.test.js` (lowercase: core, arsenal, horde, progression, fx, ui).
## 7 Entity Schemas
- **Common** (all entities): `id, kind, x, y, px, py, vx, vy, r, dead, age`. **Render data** fx reads: `shape` (`circle square tri diamond hex star cross capsule ring arc beam`), `color`, `r` (size), `rot`, `sx`, `sy` (squash/stretch, 1 = none), `flash` (0-1 white), `flags{elite,boss,frozen,burning,poisoned,shielded,telegraph,invuln,hurt,enraged}`.
- **player** (`kind:'player'`): `charId, hp, maxHp, gold, xp, level, pending, weapons[{id,lvl,slot,cd,paid,dealt}], items{id:n}, upgrades[{stat,rarity}], mods[], stats{}, dash{charges,max,cd,t,dx,dy,iframes}, iframes, aim, revives, status, kbx, kby`.
- **enemy** (`kind:'enemy'`, bosses too): `defId, hp, maxHp, speed, dmg, armor, xp, gold, isBoss, phase, affixes[], ai{state,t,…}, status{burn{t,dps},chill,freeze,poison{n,t,dps},pull{t,x,y}}, kbx, kby`.
- **projectile** (`kind:'proj'`): `team('player'/'enemy'), weaponId, dmg, crit, element, pierce, hits[], life, knock, statusChance, homing{turn}, orbit{cx,cy,ang,rad,spd}, fuse, onEnd('explode'/'cloud'/null), blastR`.
- **area** (`kind:'area'`): `areaKind('circle'/'arc'/'beam'/'cloud'/'ring'), team, weaponId, angle, len, arc, w, dmg, tick, tickT, life, follow, element, statusChance`.
- **pickup** (`kind:'pickup'`): `type (pickup id), value, life, magnet, bob`. **drone** (`kind:'drone'`): `weaponId, ang, cd`.
- **W**: `{seed, tick, time, state, prevState, wave, zone, danger, endless, waveT, waveDur, player, enemies[], projectiles[], areas[], pickups[], drones[], boss, shop{offers[{kind,id,price,locked,sold}],rerolls}, levelup{cards[],level,rerolls}, scale, stats{kills,goldEarned,damageTaken,dashes,bossesKilled,shardsEarned,damageByWeapon{}}}`.
## 8 Events
`NR.events.emit(name,payload)`; payload objects are reused per name: listeners copy what they keep and never mutate. Short names = `NR.<name>`.
| Event | Payload | Emitter | Listeners |
|---|---|---|---|
| `state:change` | from,to | run | ui.screens, ui.hud, ui.touch, fx.audio |
| `run:start` | seed,charId,danger,endless | run | ui.screens, ui.hud, fx.render, fx.floor, fx.particles, fx.audio, meta |
| `run:end` | result(win/lose/abandon),stats | run | meta, ui.screens, fx.audio |
| `wave:start` | wave,zone,isBoss,duration | director | ui.hud, fx.render, fx.floor, fx.audio |
| `wave:clear` | wave,isBoss | director | run, pickups, ui.hud, fx.audio, fx.juice |
| `weapon:fire` | weaponId,slot,kind,x,y,angle | weapons | fx.audio, fx.juice, fx.particles |
| `weapon:gain` | weaponId,slot,level,isNew | weapons | items, ui.hud, fx.audio, meta |
| `weapon:evolve` | slot,from,into | weapons | ui.hud, fx.juice, fx.particles, fx.audio, meta |
| `projectile:impact` | x,y,r,element,team,surface(wall/enemy/player/expire) | projectiles | fx.particles, fx.floor, fx.audio |
| `damage:dealt` | weaponId,target,isBoss,amount,crit,element,x,y,killed | combat | run, items, fx.juice, fx.particles, fx.audio |
| `status:apply` | target,status,stacks,x,y | combat | fx.particles, fx.audio |
| `event:start` | id,x,y,duration,wave | waveEvents | ui.hud, fx.particles, fx.audio |
| `event:end` | id,success,x,y,reason | waveEvents | ui.hud, fx.particles, fx.audio |
| `achievement:unlock` | id,kind('achievement'/'challenge'),content[{kind,id}] | achievements | ui.hud, ui.screens, fx.audio |
| `status:react` | reaction,target,x,y,element,r | reactions | run, fx.particles, fx.audio, fx.juice |
| `chain:arc` | points[{x,y}],element | combat | fx.particles, fx.audio |
| `area:explode` | x,y,r,element,team,weaponId | combat | fx.particles, fx.floor, fx.juice, fx.audio |
| `player:hurt` | amount,hp,srcId,dodged,revived,x,y | player | items, run, fx.juice, fx.particles, fx.audio, ui.hud |
| `player:dash` | x,y,dx,dy,charges | player | items, run, fx.particles, fx.juice, fx.audio |
| `player:death` | x,y | player | run, fx.juice, fx.audio |
| `player:levelup` | level,pending | progression | ui.hud, fx.particles, fx.audio |
| `levelup:open` | level,cards,rerollPrice,pending | progression | ui.screens, fx.audio |
| `shop:change` | reason(open/buy/reroll/lock/sell),offers,rerollPrice,gold | shop | ui.screens, fx.audio |
| `item:gain` | itemId,count,source | items | items, ui.hud, fx.particles, fx.audio, meta |
| `enemy:spawn` | enemy | enemies | fx.particles, meta |
| `enemy:death` | enemy,weaponId,x,y,elite,isBoss | enemies | run, pickups, items, fx.particles, fx.juice, fx.audio |
| `enemy:attack` | enemy,kind(melee/shoot/dash/blast/summon),time,x,y,r | enemies, bosses | fx.floor, fx.audio |
| `boss:phase` | boss,phase (0 = spawn) | bosses | ui.hud, fx.juice, fx.particles, fx.audio, meta |
| `boss:death` | boss,x,y | bosses | run, ui.hud, fx.juice, fx.particles, fx.audio |
| `pickup:collect` | type,value,x,y | pickups | run, ui.hud, fx.particles, fx.audio |
| `meta:change` | kind(node/char/danger/shards),id | meta | ui.screens, fx.audio |
| `codex:discover` | kind,id | meta | ui.hud, ui.screens |
| `settings:change` | key,value | save | i18n, camera, input, fx.audio, fx.particles, ui.hud, ui.screens |
| `input:device` | device(kbm/pad/touch) | input | ui.hud, ui.touch |
- Run stats (kills, damageByWeapon, damageTaken, dashes, bossesKilled, goldEarned) are written only by `run` from these events. Slow-mo on boss kill = `fx.juice` reacting to `boss:death`.
## 9 Data Schemas
Each data file sets `NR.data.<name> = {id: def}` (insertion order = display order); pure data only; text is `{vi,en}`.
| File | Def fields |
|---|---|
| weapons.js (`NR.data.weapons`, `NR.data.evolutions=[{weapon,catalyst,into}]`) | `name,desc,kind,element,evolved,cost,rarity,levels[5]` each `{dmg,rate,speed,range,count,pierce,area,crit,statusChance,knock}` + kind keys (`arc,orbitR,orbitN,droneN,fuse,tick,turn,…`), `shape,color,sfx`; evolved: `evolved:true,levels[1]` |
| enemies.js | `name,shape,color,r,hp,speed,dmg,armor,xp,gold,ai,aiParams{},contact,tags[]` |
| bosses.js | `name,zone,shape,color,r,hp,phases[{below,speedMult,patterns[]}],reward` |
| waves.js | `NR.data.zones{id:{name,waves:[a,b],palette[6],boss}}`; `NR.data.waves[1..15]{zone,duration,budget,pool[{enemy,weight}],boss,eliteChance}`; `NR.data.endless{}` |
| characters.js | `name,desc,shape,color,base{stat:value},dash{charges,cd,dist,iframes},startWeapon,startItems[],passive,unlock{type,cost}` |
| items.js | `name,desc,rarity,cost,catalyst,maxStack,mods[{stat,add,pct,mult}],hooks[{on,fx,chance,args}]`; `fx` ∈ `heal gold status explode slowEnemies iframes` (implemented in `NR.items.effects`) |
| upgrades.js | `{statKey:{name,rarities:{common,rare,epic,legendary}→{add,pct}}}` (20 keys) |
| meta.js | `NR.data.metaNodes{id:{name,desc,max,costs[],mods[]}}`, `NR.data.unlocks{chars{id:cost}}` |
## 10 Module APIs
`NR.<mod>` public functions only: `fn(args)→return`: purpose. Everything else is private. Data files and `NR.lang.vi/en` (flat key→string) export no functions.
| Module | Functions |
|---|---|
| `NR.config` | constants only: `STEP, ARENA{w,h}, VIEW{w,h}, CAPS{enemies,proj,particles,decals,texts}, SHADOW{x,y}, INK, ELEMENT_COLORS, HURT_IFRAMES, MAX_LEVEL, WAVES, BOSS_WAVES, SAVE_KEY` |
| `NR.util` | `clamp(v,a,b)`; `lerp(a,b,t)`; `dist2(ax,ay,bx,by)`; `angleTo(ax,ay,bx,by)`; `shade(hex,amt)→hex` darker/lighter copy; `hash(v)→int`; `clone(o)`; `ease(name,t)`; `fmt(n)→str` short number |
| `NR.rng` | `seed(n)`; `next()→[0,1)`; `int(a,b)` inclusive; `range(a,b)`; `chance(p)→bool`; `pick(arr)`; `weighted(arr,fn)`; `shuffle(arr)`; `getState()→int`; `setState(s)` |
| `NR.events` | `on(name,fn)→offFn`; `off(name,fn)`; `emit(name,payload)`; `clearAll()` |
| `NR.stats` | `recalc(p)`: rebuild `p.stats`; `addMod(p,src,mod)`; `removeMods(p,src)`; `get(p,key)→n`; `xpNeed(level)→n`; `armorMult(a)→n`; `enemyScale(wave,danger)→{hp,dmg,speed,count,elite,gold,xp,shardMult}`; `rarityWeights(luck,wave)→{common,rare,epic,legendary}`; fields `defaults, limits` |
| `NR.spatial` | `rebuild(W)`: grid 64 px of enemies; `circle(x,y,r,out)→n`; `line(x1,y1,x2,y2,w,out)→n`; `nearest(x,y,r,filterFn?)→enemy/null` |
| `NR.pool` | `make(factory,resetFn,cap)→{get()→obj/null, free(o), live}` |
| `NR.i18n` | `t(key,params?)→str`; `text({vi,en})→str`; `setLang(l)`; `getLang()→l` |
| `NR.save` | `load()→data`; `flush()`; `getMeta()`; `getCodex()`; `getSettings()`; `setSetting(k,v)`: emits `settings:change`; `writeRun(snap)`; `readRun()→snap/null`; `clearRun()`; `resetAll()` |
| `NR.input` | `init(canvas)`; `read()→intent`; `consumePause()→bool`; `setVirtual(partial)`; `clearVirtual()`; `inject(intent/null)`: headless override |
| `NR.camera` | `update(dt)`: follow `W.player`, decay trauma; `addTrauma(t)`; `apply(ctx)`; `toWorld(sx,sy,out)`; `toScreen(wx,wy,out)`; `resize(w,h)` |
| `NR.loop` | `setCallbacks({step,frame,draw})`; `start()`; `stop()`; `hitStop(sec)`; `slowMo(scale,sec)`; `fps()→n` |
| `NR.world` | `create(opts{seed,charId,danger,endless})→W`; `get()→W`; `add(list,props)→entity/null` pooled, honors CAPS; `remove(e)`; `cleanup()`; `reset()` |
| `NR.player` | `create(charId)→player`; `update(dt,intent)`; `hurt(amount,srcId,opts{dodged})→bool`: i-frames, revive, death; `heal(n,src)`; `addGold(n)`; `spendGold(n)→bool`; `reset()` |
| `NR.run` | `init()`; `start(opts{charId,danger,seed})`; `continueRun()→bool`; `step(dt)`; `setState(s)`; `getState()→s`; `togglePause()`; `abandon()`; `endRun(result)`; `enterEndless()`; `leaveShop()`: route screen (or the next wave before a boss); `chooseRoute(i)→bool`: start the wave with that modifier; `onLevelUpsDone()`: shop or victory; `snapshot()→obj`; `restore(snap)` |
| `NR.main` | `boot()`: init modules, wire loop callbacks (`step=run.step`, `frame` calls `fx.*.update`, `ui.hud.update`, `NR.input.consumePause`→`run.togglePause`), show menu; `?stress=1` spawns the 400/600/1500 scenario |
| `NR.weapons` | `reset()`; `update(dt)`: cooldowns, orbits, drones, auras; `add(p,weaponId)→{ok,slot,level,reason}`; `canAdd(p,weaponId)→bool`; `remove(p,slot)→weaponId`; `evolve(p,slot,intoId)`; `def(id)→def`; `resolve(p,slot)→numbers` final stats for tooltips |
| `NR.projectiles` | `reset()`; `spawn(opts)→proj/null`: any team; `update(dt)`; `clearHostile()` |
| `NR.achievements` | `init()`; `evaluate(result)`: check every unearned achievement; `earned(id)`; `isUnlocked(kind,id)`; `progress(id)→{cur,goal,done}`; `all()`; `def(id)`; `contentOf(id)` |
| `NR.daily` | `todayKey()`; `config(key)→{seed,charId,danger}`; `entry(key)`; `attempted(key)`; `begin(key)`; `finish(key,stats,result)`; `recent(today)`; `best(today)`; `score(stats,result)`; `shareText(key,lang)` |
| `NR.traits` | `init()`; `reset()`; `grant(p,id,level?)→bool`; `lv(p,id)`; `count(p)`; `available(p)`; `rollCard(p,used,wave)→card/null`; `text(id,level,lang)`; `update(dt)`; `critForced()`; `hitMult(e,wid,dot)`; `shatterBonus()`; `frozenBonus()` |
| `NR.waveEvents` | `init()`; `reset()`; `start(wave)`: roll the wave's event (run.startWave); `update(dt)`; `begin(id)`; `finish(success,reason)`; `pending()`; `current()` |
| `NR.reactions` | `init()`; `reset()`; `check(e,element,hit,weaponId)→id/''`: called by `combat.hitEnemy`; `setCount(p,element)→n`; `setActive(p,element)→bool`; `sets(p)→[{element,count,active}]` |
| `NR.combat` | `reset()`; `hitEnemy(e,dmg,opts{weaponId,element,crit,kx,ky,statusChance,noChain})→dealt`; `damagePlayer(amount,srcId,opts)→bool`: dodge, armor, i-frames; `critRoll(p,bonus)→{crit,mult}`; `applyStatus(e,status,power,srcDmg)`; `explode(x,y,r,dmg,opts{team,element,weaponId,knock})→n`; `createArea(opts)→area`; `chain(e,dmg,opts)→n`; `pull(e,x,y,strength)`; `update(dt)`: areas, DoTs, knockback |
| `NR.enemies` | `reset()`; `spawn(defId,x,y,opts{hpMult,dmgMult,speedMult,affixes})→enemy/null`; `update(dt)`; `kill(e,weaponId)`: emits death, routes bosses; `applyAffix(e,id)`; `dissolveAll()`; `def(id)→def`; `alive()→n` |
| `NR.bosses` | `reset()`; `spawn(bossId,opts)→boss`; `update(dt)`: phases, patterns; `kill(b)`; `def(id)→def` |
| `NR.director` | `reset()`; `startWave(n)`; `update(dt)`: spawn budget, timer, emits `wave:clear`; `waveInfo(n)→{zone,isBoss,duration,budget}`; `zoneOf(wave)→zoneId` |
| `NR.items` | `init()`: subscribe hook events; `reset()`; `grant(p,itemId,source)→bool`: the only way items enter inventory (checks maxStack, `p.items`, mods via `NR.stats.addMod(p,'item:'+id,mod)`, emits `item:gain`); `remove(p,itemId)→bool`: sell; `count(p,itemId)→n`; `roll(n,luck,wave,filterFn)→ids`; `checkEvolutions(p)`: Lv5 weapon + catalyst → `NR.weapons.evolve`; run by items' own listeners on `weapon:gain` and `item:gain`; `update(dt)`: timed effects; `effects{}` |
| `NR.progression` | `reset()`; `addXp(n)`: levels up, raises `pending`, emits `player:levelup`; `begin()→bool`: open first card pick if pending; `pick(index)→remaining`: apply card, reopen or `NR.run.onLevelUpsDone()`; `reroll()→bool`; `rollCards(n,luck,wave)→cards`; `pending()→n` |
| `NR.shop` | `reset()`; `open(wave)`: roll 4 offers; `buy(index)→{ok,reason}`: uses `NR.weapons.add`/`NR.items.grant`; `reroll()→bool`; `toggleLock(index)`; `sell(kind,idOrSlot)→bool`; `price(offer)→n`; `rerollPrice()→n`; `sellPrice(kind,idOrSlot)→n` |
| `NR.pickups` | `reset()`; `spawn(type,x,y,value)→pickup/null`; `update(dt)`: magnet, collect (xp→`NR.progression.addXp`, heal→`NR.player.heal`, gold→`NR.player.addGold`, nova→`NR.combat.explode`); `collectAll()`; `openChest(pk)`: `NR.items.roll`+`NR.items.grant` or Gold |
| `NR.meta` | `init()`; `node(id)→level`; `buyNode(id)→bool`; `nodeCost(id)→n`; `shards()→n`; `charUnlocked(id)→bool`; `unlockChar(id)→bool`; `maxDanger()→n`; `applyToRun(p)`: meta mods, slots, startGold; `discover(kind,id)`; `shardsFor(result,stats)→n` |
| `NR.fx.shapes` | `draw(ctx,shape,x,y,r,rot,sx,sy,fill,outlineW)`: hard shadow + body + outline; `shadow(ctx,…)`; `ids[]` |
| `NR.fx.render` | `init(canvas)`; `resize(w,h)`; `draw(W,alpha)`: §12 order; `setZone(id)`; `palette()→hex[]` |
| `NR.fx.particles` | `init()`; `update(dt)`; `draw(ctx)`; `burst(kind,x,y,color,n,opts)`; `ring(x,y,r,color,life)`; `debris(x,y,color,n)`; `text(x,y,str,color,size)`; `clear()` |
| `NR.fx.floor` | `init()`; `update(dt)`; `draw(ctx)`: cached floor canvas + decals + telegraphs; `decal(kind,x,y,r,color)`; `telegraph(opts)`; `clear()` |
| `NR.fx.juice` | `init()`; `update(dt)`: decay flash, spring squash; `flash(e,amt)`; `squash(e,sx,sy)`; `hitStop(sec)`→`NR.loop.hitStop`; `shake(t)`→`NR.camera.addTrauma`; `slowMo(scale,sec)`→`NR.loop.slowMo` |
| `NR.fx.audio` | `init()`; `unlock()`: resume on first gesture; `sfx(id,opts)`; `music(trackId/null)`; `update(dt)`; `applySettings()` |
| `NR.ui.hud` | `init(root)`; `update(dt)`: poll W, write DOM only on change; `toast(text,kind)` |
| `NR.ui.screens` | `init(root)`; `show(name,data)`; `hide(name)`: names `menu settings codex meta pause levelup shop victory end` |
| `NR.ui.touch` | `init(root)`; `show()`; `hide()`; `active()→bool` |
| `NR.harness` | `load(opts{fx,ui})→NR`; `test(name,fn)`; `eq(a,b)`; `hashWorld(W)→int`; `runSim(opts{seconds,seed,char,danger})→summary` |
| `NR.bot` | `create(opts)→bot`; `bot.think(W)→intent`; `bot.act(W)`: picks cards, buys, leaves shop; `play(opts)→summary` |
| `NR.fakeCanvas` | `create(w,h)→ctx`: records calls, `ctx.banned[]`; `fakeDom()→{document,root}` for ui tests |
## 11 Save & Settings
- `localStorage['shardfall.save']` JSON `{v:1, meta:{shards,nodes{id:lvl},chars[],maxDanger,runs,wins,bestWave,ach{},progress{},daily{days{}}}, codex{weapon{},item{},enemy{},boss{},evolution{},character{}}, settings{language:'vi',master:.8,music:.6,sfx:.8,shake:100,reduceFlashing:false,damageNumbers:true,autoFire:false,aimAssist:true,showFps:false,fullscreen:false}, run:null|snapshot}`.
- Snapshot (written by `NR.run` when entering `shop`): `{v,seed,rng,charId,danger,wave,endless,player{hp,gold,xp,level,weapons,items,upgrades,traits},shop{offers,rerolls},stats}`; mods are rebuilt from items/upgrades/meta on restore. `NR.save.clearRun()` on run end.
- Load: parse → `migrate(v)` stepwise → merge defaults. Corrupt or newer version → keep raw copy under `shardfall.backup`, start fresh. Storage unavailable → in-memory fallback, no exception. UTF-8 only; Vietnamese diacritics round-trip.
## 12 Visual & Audio Direction
- **Flat style**: solid fills; crisp `INK` (#14121F) outlines (3 px world, round joins); hard drop shadow = same path offset by `SHADOW` (3,4) filled with `shade(fill,-0.45)`; 5-6 solid colors per zone from §4; bold silhouettes, one distinct shape+color per enemy; elites get a thicker accent outline, bosses are 3-5× size.
- **Element colors**: physical `#F2EFE6`, fire `#FF7A2F`, ice `#7FD3F0`, shock `#FFD43B`, poison `#8BD450`, void `#A25CE0`.
- **Juice by motion/shape**: hit-stop (3-6 frames, longer on crit/kill), trauma shake, white flash 80 ms, squash/stretch springs, knockback, damage numbers (crit bigger), solid-shape debris, expanding solid shockwave rings (thick stroke thins out), floor scorch decals, boss-kill slow-mo (0.3× for ~1.2 s), dash afterimages as solid copies. `reduceFlashing` removes full-screen flashes and flash frames.
- **Draw order**: 1 floor + decals + telegraphs → 2 shadows pass → 3 pickups → 4 enemies/boss → 5 areas (arc, beam, cloud, rings) → 6 drones, orbit blades → 7 enemy projectiles → 8 player projectiles → 9 player (+afterimages) → 10 particles/debris/rings → 11 damage numbers. HUD/menus are DOM above the canvas.
- `globalAlpha` stays 1 except the final fade of particles/decals; never stack translucent shapes to fake glow. UI: solid panels, 3 px ink borders, `box-shadow: Npx Npx 0 <color>` only (blur 0), `text-shadow: Npx Npx 0` only, system bold font stack with Vietnamese support.
- **Banned** (canvas and CSS, in src and css): `createLinearGradient`, `createRadialGradient`, `createConicGradient`, `shadowBlur`, `shadowColor`, `ctx.filter`, `globalCompositeOperation` of `lighter/screen/plus-lighter/color-dodge`, CSS `linear/radial/conic/repeating-*-gradient`, `blur()`, `filter`, `backdrop-filter`, `mix-blend-mode`, any box-shadow/text-shadow with blur radius >0.
- **Audio** (WebAudio only, no samples): oscillator (square/saw/tri) + noise-buffer voices with ADSR, ≤32 voices; buses master/music/sfx from settings. SFX ids: `event_start event_win event_fail react_shatter react_toxic react_shock react_void react_steam shoot_light shoot_heavy shoot_beam swing hit crit kill kill_big hurt dodge dash pickup_xp pickup_gold pickup_heart pickup_special explode chain freeze burn levelup evolve buy deny boss_roar wave_start wave_clear ui_click ui_open victory defeat`. Music (step-sequenced loops): `menu zone_scrap zone_frost zone_void boss shop victory`.
## 13 Performance
- Target 60 FPS on an integrated GPU with 400 enemies, 600 projectiles, 1500 particles (`CAPS`). Budget per frame: sim ≤6 ms, render ≤8 ms.
- Pool all entities and particles (`NR.pool`); no per-tick allocation of objects/arrays/closures in sim loops; spatial grid for all proximity queries; reusable `out` arrays.
- Render: floor and decals on a cached offscreen canvas; cull off-screen; batch particles by color (one path per color); no per-frame `shade()` (precompute shadow colors); HUD DOM writes only on value change; `showFps` overlay.
## 14 Testing
- `node tests/run.js`: runs `tests/{core,arsenal,horde,progression,fx,ui}.test.js`, prints pass/fail, exit 1 on any failure.
- `node tests/run.js --sim <seconds> --seed <n> --char <id> --danger <n>`: headless bot run, prints JSON `{state,wave,kills,ticks,msPerTick,damageByWeapon,hash}`; exit 1 on exception.
- `tests/harness.js` loads files in §6 order via `vm` with no DOM; fx tests use `NR.fakeCanvas`, ui tests use `fakeDom()`. `tests/bot.js` kites, aims at nearest, dashes when hit, takes first card, buys best affordable.
- `tests/reactions.test.js` covers reactions and sets. Each owner tests own modules: formulas, schema validation of own data (ids vs §4, `{vi,en}` present), event payloads vs §8, API signatures vs §10. Core adds the determinism, banned-feature scan and perf tests.
## 15 Acceptance
1. Double-click `index.html` (file://): boots to menu, no console errors, no network requests, no `type="module"`, all paths relative; `.nojekyll` present (GitHub Pages ready).
2. `node tests/run.js` exits 0 with all six suites.
3. Determinism: `--sim 120 --seed 7` run twice gives identical `hash`; grep finds no `document|window|Date|Math.random|AudioContext` in `src/sim` and `src/data`.
4. Fx independence: sim hash with fx loaded equals hash without; `NR.loop.hitStop|slowMo` and `NR.camera.addTrauma` are referenced only under `src/fx` and `src/core`.
5. Bot completes (win or death, no exception) for every character at danger 0 and 5, seeds 1-3; a danger-0 bot reaches wave 15 with at least one character.
6. Content counts and ids equal §4 exactly: 4 chars, 23 base weapons, 23 evolutions (+23 evolved defs), 36 items (10/14/8/4 by rarity, 23 catalysts incl. reused items), 20 upgrades × 4 rarities, 12 enemies, 4 affixes, 3 bosses, 6 pickups, 10 meta nodes, 3 zones × 6 hex.
7. Run rules: exactly 15 waves; one boss each on waves 5/10/15; wave length within 25-60 s; level-ups queue during a wave and resolve after `clear`; shop shows 4 offers; reroll price strictly rises, lock survives reroll; weapon Lv5 max; Lv5 + catalyst evolves once.
8. Formulas in §5 match `NR.stats` outputs (unit tests for xpNeed, armorMult, enemyScale, mod combination, status stacks).
9. i18n: every `NR.lang.vi` key exists in `en` and vice versa; every data `name`/`desc` has non-empty `vi` and `en`; language switch updates open screens without reload.
10. Save: round-trip meta/codex/settings; Continue at the shop restores gold, weapons, items, offers and rng state; corrupt JSON loads defaults without exception.
11. Input: keyboard+mouse, gamepad and virtual (touch) intents all move, aim, fire, dash, pause (tested by `inject`/`setVirtual`; manual check on a real device).
12. No banned visual feature (§12 list) appears in `src` or `css` (grep test); `NR.fakeCanvas` records zero banned calls over a 30 s bot render.
13. Events: every emitted name is in §8 with the listed payload fields; across a 3-run bot sweep every §8 event except `input:device`, `settings:change`, `codex:discover`, `meta:change`, `achievement:unlock` is emitted at least once.
14. Perf: stress test (400 enemies, 600 projectiles) averages ≤4 ms/tick in Node; `index.html?stress=1` holds ≥55 FPS with 1500 particles on target hardware (manual).
