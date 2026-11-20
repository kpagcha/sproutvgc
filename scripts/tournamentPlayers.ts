// The official tournaments' players across every event (`tournaments/players.json`), for the Players tab and each
// player's page without loading every event's standings: each player by a slug of their name (their country's code
// added when two players share it), with their name and country as their latest event has them, and their events, the
// latest first, each `[event number, placing, wins, losses, how far they made it (0 Day 1, 1 Day 2, 2 the top cut), their
// six's Pokémon]`. A player is their name, its case and spacing aside, and their country.

interface Placed {
  player: string
  country: string
  wins: number
  losses: number
  day2?: true
  topCut?: true
  team: [string, ...unknown[]][]
}

export type PlayerRow = [name: string, country: string, events: [number, number, number, number, number, string[]][]]

/** A name as a slug: lowercased, accents dropped, anything but letters and digits a dash (any script's letters kept). */
const slugOf = (name: string) =>
  name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '') || 'player'

/** Every player of the events given (each its number, date and standings by placing), by slug. */
export function playersOf(
  events: readonly { n: number; date: string; standings: Record<string, Placed> }[],
): Record<string, PlayerRow> {
  const byKey = new Map<string, { name: string; country: string; date: string; events: PlayerRow[2] }>()
  const latestFirst = [...events].sort((a, b) => b.date.localeCompare(a.date) || b.n - a.n)
  for (const e of latestFirst)
    for (const [placing, s] of Object.entries(e.standings)) {
      const name = s.player.trim().replace(/\s+/g, ' ')
      const key = `${name.toLowerCase()}\u0000${s.country}`
      let p = byKey.get(key)
      if (!p) byKey.set(key, (p = { name, country: s.country, date: e.date, events: [] }))
      const stage = s.topCut ? 2 : s.day2 ? 1 : 0
      p.events.push([e.n, Number(placing), s.wins, s.losses, stage, s.team.map(([mon]) => mon)])
    }
  // Slugs: by name, the country added where two share one, a number past that.
  const bySlug = new Map<string, { name: string; country: string; events: PlayerRow[2] }[]>()
  for (const p of byKey.values()) {
    const slug = slugOf(p.name)
    bySlug.set(slug, [...(bySlug.get(slug) ?? []), p])
  }
  const out: [string, PlayerRow][] = []
  const taken = new Set<string>()
  for (const [slug, ps] of bySlug) {
    for (const p of ps) {
      let s = ps.length > 1 ? `${slug}-${p.country.toLowerCase() || 'xx'}` : slug
      for (let i = 2; taken.has(s); i++) s = `${slug}-${p.country.toLowerCase() || 'xx'}-${i}`
      taken.add(s)
      out.push([s, [p.name, p.country, p.events]])
    }
  }
  return Object.fromEntries(out.sort((a, b) => a[0].localeCompare(b[0])))
}
