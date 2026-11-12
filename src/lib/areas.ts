// The site's areas, each a top-level link in the header with its sections as a sub-navigation, Meta first (what sets
// the site apart): Meta (what players use and how it does: observations, labeled with their period and source), Tools
// (what you interact with), Quizzes (what you learn with) and the dex (what exists in the regulation), last. Each route says in its meta which area and section it belongs to.

import type { MessageKey } from '@/i18n'

export type AreaId = 'dex' | 'meta' | 'tools' | 'quizzes'

export interface Section {
  /** Matched against a route's `meta.section`. */
  key: string
  /** The route the section's link leads to, by name, and its params where it's one view of it (the speed solver). */
  route: string
  params?: Record<string, string>
  /** Its name in the sub-navigation and on its area's page. */
  label: MessageKey
  /** Its page's title, when it's longer than `label` ("Damage calculator"): the search finds the page by either. */
  title?: MessageKey
  /** What it is, on its area's page (`{game}` and `{reg}` filled in). */
  desc: MessageKey
  /** Not built yet: its page says so. */
  soon?: boolean
  /** Its page's other tabs, each a page of its own, found by the search by name too. */
  tabs?: { key: string; route: string; label: MessageKey }[]
}

export interface Area {
  id: AreaId
  /** The area's own page, listing its sections. */
  route: string
  label: MessageKey
  title: MessageKey
  sections: Section[]
}

/** A route's section: its `meta.section`, or for a route whose views are sections apart, the one of its params. */
export function sectionOf(r: {
  meta: { section?: string | ((params: Record<string, unknown>) => string) }
  params: Record<string, unknown>
}) {
  const s = r.meta.section
  return typeof s === 'function' ? s(r.params) : s
}

export const AREAS: Area[] = [
  {
    id: 'meta',
    route: 'meta',
    label: 'nav.meta',
    title: 'title.meta',
    sections: [
      { key: 'rankings', route: 'rankings', label: 'nav.rankings', title: 'title.rankings', desc: 'desc.rankings' },
      { key: 'tournaments', route: 'tournaments', label: 'nav.tournaments', desc: 'desc.tournaments' },
      { key: 'speedTiers', route: 'speedTiers', label: 'nav.speedTiers', desc: 'desc.speedTiers' },
      { key: 'bulkTiers', route: 'bulkTiers', label: 'nav.bulkTiers', desc: 'desc.bulkTiers' },
      { key: 'powerTiers', route: 'powerTiers', label: 'nav.powerTiers', desc: 'desc.powerTiers' },
    ],
  },
  {
    id: 'tools',
    route: 'tools',
    label: 'nav.tools',
    title: 'title.tools',
    sections: [
      { key: 'calc', route: 'calc', label: 'nav.calc', title: 'title.calc', desc: 'desc.calc' },
      // The damage calculator and the speed comparison read backwards: tabs of theirs (sharing their Pokémon), each a
      // section of its own too, after its tool.
      { key: 'damageSolver', route: 'calcInverse', label: 'nav.damageSolver', desc: 'desc.calcInverse' },
      {
        key: 'speedCompare',
        route: 'speedCompare',
        label: 'nav.speedCompare',
        title: 'title.speedCompare',
        desc: 'desc.speedCompare',
      },
      {
        key: 'speedSolver',
        route: 'speedCompare',
        params: { view: 'solver' },
        label: 'nav.speedSolver',
        desc: 'desc.speedMovedFirst',
      },
      { key: 'teamBuilder', route: 'teamBuilder', label: 'nav.teamBuilder', desc: 'desc.teamBuilder' },
      {
        key: 'matchups',
        route: 'matchups',
        label: 'title.matchups',
        desc: 'desc.matchups',
        tabs: [{ key: 'chart', route: 'chart', label: 'title.chart' }],
      },
    ],
  },
  {
    id: 'quizzes',
    route: 'quizzes',
    label: 'nav.quizzes',
    title: 'title.quizzes',
    sections: [
      { key: 'speedQuiz', route: 'speedQuiz', label: 'title.speedQuiz', desc: 'desc.speedQuiz' },
      { key: 'typeQuiz', route: 'quiz', label: 'title.quiz', desc: 'desc.quiz' },
    ],
  },
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
      { key: 'natures', route: 'natures', label: 'nav.natures', desc: 'home.naturesDesc' },
    ],
  },
]

export const areaOf = (id: unknown) => AREAS.find((a) => a.id === id)
