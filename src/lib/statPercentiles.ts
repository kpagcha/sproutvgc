// Where a value stands within a weighted set of them, as a percentile: the share of the set's weight below it, half of
// that at it counting too, so the median is 0.5. For base stats, each Pokémon in the set has a weight: 1 each for the
// whole dex equally, its usage share for a dataset weighted by the meta.

export interface Distribution {
  /** A value's percentile, from 0 to 1; `null` when the set is empty. */
  rank(value: number): number | null
  /** The lowest value at or above the given share of the set (0.5: the median); `null` when it's empty. */
  quantile(q: number): number | null
}

/** A weighted set of values (`[value, weight]`), those weighing nothing left out. */
export function distribution(points: Iterable<readonly [number, number]>): Distribution {
  // Its distinct values in order, and the weight below each and at it.
  const at = new Map<number, number>()
  for (const [v, w] of points) if (w > 0) at.set(v, (at.get(v) ?? 0) + w)
  const values = [...at.keys()].sort((a, b) => a - b)
  let total = 0
  const below = values.map((v) => {
    const b = total
    total += at.get(v)!
    return b
  })
  // The first index that `reaches`, which holds from some index on.
  const search = (reaches: (i: number) => boolean) => {
    let lo = 0
    let hi = values.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (reaches(mid)) hi = mid
      else lo = mid + 1
    }
    return lo
  }
  return {
    rank(value) {
      if (!total) return null
      const i = search((j) => values[j]! >= value)
      const under = i < values.length ? below[i]! : total
      return (under + (at.get(value) ?? 0) / 2) / total
    },
    quantile(q) {
      if (!total) return null
      const i = search((j) => below[j]! + at.get(values[j]!)! >= q * total)
      return values[Math.min(i, values.length - 1)]!
    },
  }
}

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
  const columns = Array.from({ length: 6 }, (_, i) => distribution(samples.map((s) => [s.stats[i]!, s.weight])))
  return {
    rank: (stat, value) => columns[stat]!.rank(value),
    quantile: (stat, q) => columns[stat]!.quantile(q),
  }
}
