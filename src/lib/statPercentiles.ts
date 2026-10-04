// Where a base stat stands within a reference set of Pokémon, as a percentile: the share of the set's weight below it,
// half of that at it counting too, so the median is 0.5. Each Pokémon in the set has a weight: 1 each for the whole dex
// equally, its usage share for a dataset weighted by the meta.

/** A Pokémon's six base stats, with its weight in the set. */
export interface Sample {
  stats: readonly number[]
  weight: number
}

export interface Percentiles {
  /** A stat's percentile, from 0 to 1, by its index in `STATS`; `null` when the set is empty. */
  rank(stat: number, value: number): number | null
  /** The lowest value of a stat at or above the given share of the set (0.5: the median); `null` when it's empty. */
  quantile(stat: number, q: number): number | null
}

export function percentiles(samples: readonly Sample[]): Percentiles {
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
  // The first of `n` indices that `reaches`, which holds from some index on.
  const search = (n: number, reaches: (i: number) => boolean) => {
    let lo = 0
    let hi = n
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (reaches(mid)) hi = mid
      else lo = mid + 1
    }
    return lo
  }
  return {
    rank(stat, value) {
      if (!total) return null
      const { values, below, at } = columns[stat]!
      const i = search(values.length, (j) => values[j]! >= value)
      const under = i < values.length ? below[i]! : total
      return (under + (at.get(value) ?? 0) / 2) / total
    },
    quantile(stat, q) {
      if (!total) return null
      const { values, below, at } = columns[stat]!
      const i = search(values.length, (j) => below[j]! + at.get(values[j]!)! >= q * total)
      return values[Math.min(i, values.length - 1)]!
    },
  }
}
