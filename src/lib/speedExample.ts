import type { PokemonId } from '@/data/dex'
import type { MetaData } from '@/data/meta'
import { POKEMON } from '@/data/pokemon'
import { speedBuilds } from '@/lib/speed'
import { buildSpeed } from '@/lib/speedBuild'
import { MAX_POINTS, type NatureEffect } from '@/lib/stats'

// The speed pages' tours' example (the speed tiers', the comparison's and the speed solver's): two of the meta's most
// used, each at its most common Speed build, where the order says something: the opponent moves first at its build,
// not at any points, and yours could move first with more points. So yours' row and the opponent's sit close on the
// ladder, the comparison has points to tell, and the solver's order binds the opponent's points.

export interface SpeedExampleSide {
  id: PokemonId
  effect: NatureEffect
  points: number
  /** Its Speed at that build, no modifiers. */
  speed: number
}
export interface SpeedExample {
  a: SpeedExampleSide
  b: SpeedExampleSide
}

/** How many of the most used it's picked from. */
const TOP = 15

export function speedExample(d: MetaData | null | undefined): SpeedExample | null {
  if (!d) return null
  const top = (Object.keys(d) as PokemonId[])
    .filter((id) => POKEMON[id] && d[id]?.usage && d[id]?.speeds?.length)
    .sort((x, y) => d[y]!.usage! - d[x]!.usage!)
    .slice(0, TOP)
  const at = (id: PokemonId, effect: NatureEffect, points: number) =>
    buildSpeed(id, { effect, points, toggles: [], stage: 0 })
  for (const them of top) {
    const tb = speedBuilds(d[them]!.speeds!)[0]!
    const st = at(them, tb.effect, tb.points)
    for (const you of top) {
      if (you === them) continue
      const yb = speedBuilds(d[you]!.speeds!)[0]!
      const sy = at(you, yb.effect, yb.points)
      // It moves first, but not at any points: the order binds them. And yours could move first with more.
      if (
        yb.effect !== 'down' &&
        st > sy &&
        at(them, tb.effect, 0) < sy &&
        at(you, yb.effect, MAX_POINTS) > st &&
        yb.points < MAX_POINTS
      )
        return {
          a: { id: you, effect: yb.effect, points: yb.points, speed: sy },
          b: { id: them, effect: tb.effect, points: tb.points, speed: st },
        }
    }
  }
  return null
}
