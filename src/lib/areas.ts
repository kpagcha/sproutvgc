// The site's areas, each a top-level link in the header with its sections as a sub-navigation: the dex (what exists
// in the regulation), Competitive (what players use and how it does: observations, labeled with their period and
// source) and Tools (what you interact with). Each route says in its meta which area and section it belongs to.

import type { MessageKey } from '@/i18n'

export type AreaId = 'dex' | 'competitive' | 'tools'

export interface Section {
  /** Matched against a route's `meta.section`. */
  key: string
  /** The route the section's link leads to, by name. */
  route: string
  /** Its name in the sub-navigation and on its area's page. */
  label: MessageKey
  /** Its page's title, when it's longer than `label` ("Damage calculator"): the search finds the page by either. */
  title?: MessageKey
  /** What it is, on its area's page (`{game}` and `{reg}` filled in). */
  desc: MessageKey
  /** Not built yet: its page says so. */
  soon?: boolean
}

export interface Area {
  id: AreaId
  /** The area's own page, listing its sections. */
  route: string
  label: MessageKey
  title: MessageKey
  sections: Section[]
}

export const AREAS: Area[] = [
  {
    id: 'dex',
    route: 'dex',
    label: 'nav.dex',
    title: 'title.dex',
    sections: [
      { key: 'pokemon', route: 'pokedex', label: 'nav.pokemon', desc: 'home.pokemonDesc' },
      { key: 'moves', route: 'moves', label: 'nav.moves', desc: 'home.movesDesc' },
      { key: 'abilities', route: 'abilities', label: 'nav.abilities', desc: 'home.abilitiesDesc' },
      { key: 'items', route: 'items', label: 'nav.items', desc: 'home.itemsDesc' },
      { key: 'conditions', route: 'conditions', label: 'nav.conditions', desc: 'home.conditionsDesc' },
      { key: 'types', route: 'types', label: 'nav.types', desc: 'home.typesDesc' },
      { key: 'chart', route: 'chart', label: 'title.chart', desc: 'desc.chart' },
    ],
  },
  {
    id: 'competitive',
    route: 'competitive',
    label: 'nav.competitive',
    title: 'title.competitive',
    sections: [
      { key: 'usage', route: 'usage', label: 'nav.usage', title: 'title.usage', desc: 'desc.usage' },
      {
        key: 'reports',
        route: 'reports',
        label: 'nav.reports',
        title: 'title.reports',
        desc: 'desc.reports',
        soon: true,
      },
      { key: 'speedTiers', route: 'speedTiers', label: 'nav.speedTiers', desc: 'desc.speedTiers' },
    ],
  },
  {
    id: 'tools',
    route: 'tools',
    label: 'nav.tools',
    title: 'title.tools',
    sections: [
      { key: 'calc', route: 'calc', label: 'nav.calc', title: 'title.calc', desc: 'desc.calc', soon: true },
      { key: 'teamBuilder', route: 'teamBuilder', label: 'nav.teamBuilder', desc: 'desc.teamBuilder', soon: true },
      { key: 'matchups', route: 'matchups', label: 'title.matchups', desc: 'desc.matchups' },
      { key: 'quiz', route: 'quiz', label: 'title.quiz', desc: 'desc.quiz' },
    ],
  },
]

export const areaOf = (id: unknown) => AREAS.find((a) => a.id === id)

/** The areas' one-line pitch, on the home page. */
export const PITCH: Record<AreaId, MessageKey> = {
  dex: 'home.dexPitch',
  competitive: 'home.competitivePitch',
  tools: 'home.toolsPitch',
}
