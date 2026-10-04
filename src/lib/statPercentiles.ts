// Where a base stat stands within a reference set of Pokémon, as a percentile: the share of the set's weight below it,
// half of that at it counting too, so the median is 0.5. Each Pokémon in the set has a weight: 1 each for the whole dex
// equally, its usage share for a dataset weighted by the meta.

/** A Pokémon's six base stats, with its weight in the set. */
export interface Sample {
  stats: readonly number[]
  weight: number
}

/** A stat's percentile, from 0 to 1, by its index in `STATS`; `null` when the set is empty. */
export type Percentile = (stat: number, value: number) => number | null

export function percentiles(samples: readonly Sample[]): Percentile {
  const total = samples.reduce((a, s) => a + s.weight, 0)
  // Per stat, its distinct values in order, and the weight below each and at it.
  const columns = Array.from({ length: 6 }, (_, i) => {
    const at = new Map<number, number>()
    for (const s of samples) if (s.weight > 0) at.set(s.stats[i]!, (at.get(s.stats[i]!) ?? 0) + s.weight)
    const values = [...at.keys()].sort((a, b) => a - b)
    let sum = 0
    const below = values.map((v) => {
      const b = sum
      sum += at.get(v)!
      return b
    })
    return { values, below, at }
  })
  return (stat, value) => {
    if (!total) return null
    const { values, below, at } = columns[stat]!
    // The first value at or above it.
    let lo = 0
    let hi = values.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (values[mid]! < value) lo = mid + 1
      else hi = mid
    }
    const under = lo < values.length ? below[lo]! : total
    return (under + (at.get(value) ?? 0) / 2) / total
  }
}
