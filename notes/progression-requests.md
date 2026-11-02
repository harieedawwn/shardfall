# Progression: contract requests and assumptions

SPEC.md was not in core-a.zip or core-b.zip. I worked from README.md, the code and the tests. Please check these points against the real SPEC.

1. **Level-up card shape (UI).** Stat cards are `{kind:'stat', stat, rarity, add, pct}`. Weapon cards are `{kind:'weapon', stat:'weapon', id, rarity, add:0, pct:0, isNew, level}`. `NR.data.upgrades.weapon` is a name-only pseudo entry, so UIs that read `NR.data.upgrades[c.stat].name` don't crash. The UI should show weapon cards from `NR.data.weapons[c.id]`. Weapon cards are never stored in `p.upgrades`.
2. **Chest reveal event.** SPEC 8 has no chest event, so I reuse `pickup:collect` for it. For `type:'chest'` the payload also carries `kind` ('item' | 'weapon' | 'gold'), `id` and `value` (stack count, weapon level or gold). `item:gain` (source 'chest') or `weapon:gain` fires just before it. Please add these optional fields to SPEC 8, or name a dedicated event.
3. **Arsenal API used by item hooks.** Hooks call `NR.combat.explode(x,y,r,dmg,{team,element,weaponId})`, `hitEnemy(e,dmg,{weaponId,element})`, `chain(e,dmg,o)`, `createArea({...})` and `applyStatus(e,status,power,dmg)`. They use the status ids `'burn'` and `'freeze'`. Please confirm these ids and signatures.
4. **Item damage attribution.** Item effects use `weaponId:'item:<itemId>'`. That key shows up in `damageByWeapon` and in `damage:dealt`/`enemy:death` payloads, so fx and ui must tolerate ids that are not in `NR.data.weapons`.
5. **Tinker "+1 drone".** I can't change the drone count. Tinker starts with `cat_swarm_core` (+1 projectiles, which should add a drone through the `count + projectiles` resolve) and a catalyst route to Hive Pod. Please confirm drones use `projectiles`.
6. **Sell prices after Continue.** Item sell prices live only in `NR.shop` at runtime, because the snapshot has no field for them. After a restore, items sell for half their list cost. Weapons keep `paid`. Core could add `player.itemPaid` to the snapshot if exact prices matter.
7. **Danger unlock.** Winning at danger `d == maxDanger` unlocks `d+1` (max 5). Winning at any other danger unlocks nothing.
8. **Item sale and last weapon.** `shop.sell('weapon', slot)` refuses to sell the last weapon.
