// The series' signature moves: those only one evolutionary family can learn, in any game. The games never name them;
// it's how players and the fan wikis speak of them, and the rule they go by. Derived from Showdown's learnsets, every
// generation's (its base dex's, not a mod's: a signature move is the series', not one game's), leaving out what's
// learned only at events (Victini's Bolt Strike) and Smeargle, which can Sketch any move. A move first one family's and
// later another's (Water Shuriken, now Accelgor's too) isn't one any more. A few are set by hand, below.

interface Species {
  id: string
  num: number
  exists: boolean
  baseSpecies: string
  prevo: string
}
interface Dex {
  species: { get(name: string): Species }
}
type Learnsets = Record<string, { learnset?: Record<string, string[]> }>

/**
 * Signature moves another family learns too, for being the same Pokémon in a way the rule can't see: a Paradox
 * Pokémon, the ancient or future form of the first, and a fusion, of both. Each with the families that learn it, by
 * their first stage: still one if another learns it some day.
 */
const SHARED: Record<string, string[]> = {
  fierydance: ['larvesta', 'ironmoth'],
  spiritbreak: ['impidimp', 'ironvaliant'],
  fusionflare: ['reshiram', 'kyurem'],
  fusionbolt: ['zekrom', 'kyurem'],
  sunsteelstrike: ['cosmog', 'necrozma'],
  moongeistbeam: ['cosmog', 'necrozma'],
}
/** Moves the rule finds that aren't one: Celebrate, every Pokémon's at events but kept in a single learnset as such. */
const NOT_SIGNATURE = new Set(['celebrate'])

/** The IDs of the series' signature moves. */
export function signatureMoves(dex: Dex, learnsets: Learnsets): Set<string> {
  const familyOf = (s: Species) => {
    let first = dex.species.get(s.baseSpecies)
    while (first.prevo) first = dex.species.get(dex.species.get(first.prevo).baseSpecies)
    return first.id
  }
  const families = new Map<string, Set<string>>()
  for (const [id, entry] of Object.entries(learnsets)) {
    const s = dex.species.get(id)
    if (!s.exists || s.num <= 0 || s.id === 'smeargle' || !entry.learnset) continue
    const family = familyOf(s)
    for (const [move, how] of Object.entries(entry.learnset)) {
      if (how.every((h) => /^\d+S/.test(h))) continue
      const set = families.get(move) ?? new Set()
      families.set(move, set)
      set.add(family)
    }
  }
  return new Set(
    [...families]
      .filter(([m, f]) => !NOT_SIGNATURE.has(m) && (f.size === 1 || [...f].every((x) => SHARED[m]?.includes(x))))
      .map(([m]) => m),
  )
}
