// What the damage calculator adds by hand to Smogon's calc (`src/lib/damage.ts`), by Showdown ID, so `npm run gen-data`
// can list what the regulation has whose code changes it and isn't here, as it does Speed's (`src/lib/speed.ts`). No
// imports: the generator reads it.

/** What changes a move's priority (`onModifyPriority`), worked out by `priorityOf`. */
export const PRIORITY_HANDLED: readonly string[] = ['grassyglide', 'galewings', 'prankster', 'triage']
/** What moves its user first or last within its priority, by chance or always (`onFractionalPriority`), which the
 * calc's order leaves out. */
export const PRIORITY_UNMODELLED: readonly string[] = [
  'quickdraw',
  'stall',
  'myceliummight',
  'quickclaw',
  'custapberry',
  'laggingtail',
  'fullincense',
]
/** What changes a move's target (`move.target =`): Expanding Force in Psychic Terrain, the calc's own; Tera
 * Starstorm's as Terapagos-Stellar; Curse's, a status move's. */
export const TARGET_HANDLED: readonly string[] = ['expandingforce', 'terastarstorm', 'curse']
/** The damaging moves whose power or type hangs on the battle (`basePowerCallback`, `onBasePower`, `onModifyType`)
 * and that the calc doesn't work out: ours, by `patchOf`. Those it does are found in its own code by the generator. */
export const POWER_HANDLED: readonly string[] = [
  'lastrespects',
  'ragefist',
  'stompingtantrum',
  'temperflare',
  'avalanche',
  'round',
  'ficklebeam',
  'spitup',
  'beatup',
]
/** The moves whose power hangs on what the regulation doesn't have, so the calc's is theirs: Water Shuriken's on
 * Greninja-Ash. */
export const POWER_UNAFFECTED: readonly string[] = ['watershuriken']
