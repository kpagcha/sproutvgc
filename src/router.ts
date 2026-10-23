import { nextTick } from 'vue'
import { createRouter, createWebHistory, type LocationQuery, type RouteLocationNormalized } from 'vue-router'
import { afterPageExit } from '@/lib/pageExit'
import { TYPES } from '@/data/types'
import type { MessageKey } from '@/i18n'
import type { AreaId } from '@/lib/areas'
import { loadDexNames } from '@/i18n/refName'
import { hasFavorites } from '@/composables/useFavorites'
import { hasRecent, visitPage } from '@/composables/useRecent'
import { endVisit, recordSetup } from '@/composables/usePageHistory'
import { loadDescriptions, type DescribedKind } from '@/i18n/descriptions'

declare module 'vue-router' {
  interface RouteMeta {
    titleKey?: MessageKey
    /** The page's meta description, for search results and link previews. */
    descKey?: MessageKey
    /** The document's title, when it's to say more than the page's own (`titleKey`), with what it's searched for. */
    headKey?: MessageKey
    /** The page's meta keywords, comma-separated. */
    keywordsKey?: MessageKey
    /** The page shows dex entries (`DexRef`), or will when this says so: navigation waits for the current locale's names. */
    dexNames?: boolean | (() => boolean)
    /** The categories whose descriptions the page shows: navigation waits for the current locale's. */
    descriptions?: DescribedKind[]
    /** Moving between the route's own URLs keeps the scroll: the page brings what changed into view itself. */
    keepScroll?: boolean
    /** The area the page belongs to (`src/lib/areas.ts`), and its section there: the header highlights them. */
    area?: AreaId
    section?: string
    /** Recorded among the home page's recently viewed, as it's left, a page whose view is in its URL: what counts as
     * the same visit (one per page, or a comparison per pair), or nothing while there's nothing to record. */
    recent?: (to: RouteLocationNormalized) => string | null
    /** A page whose setup can be starred: what of its query is the setup (the rest only a moment of it, as what's
     * found), or nothing while there's none to star. */
    setup?: (query: LocationQuery) => Record<string, string> | null
    /** A page whose setup can be starred, in its own recently viewed (`usePageHistory`): what counts as one visit (the
     * Pokémon it's of) and what of its query is kept, or nothing while there's none worth keeping. */
    history?: (query: LocationQuery) => { visit: string; query: Record<string, string> } | null
    /** The data the page loads first, started as navigation does (beside its code and the names it waits for) rather
     * than once the page is set up. */
    prefetch?: (to: RouteLocationNormalized) => void
  }
}

/** A query's plain values, but those named in `omit`. */
export const stringQuery = (query: LocationQuery, omit: readonly string[] = []) =>
  Object.fromEntries(
    Object.entries(query).filter((e): e is [string, string] => typeof e[1] === 'string' && !omit.includes(e[0])),
  )

/** A tournament's data, for its pages to find on its way: its standings and rounds, and on its Pokémon tab its Pokémon's
 * usage at the events before and the ladder's ranks its standouts go by. A failed load is the page's to show. */
function prefetchEvent(to: RouteLocationNormalized) {
  const id = String(to.params.id)
  const pokemonTab = to.params.tab === 'pokemon'
  void import('@/data/tournaments').then(async (t) => {
    const event = t.eventOf(id)
    if (!event) return
    const quiet = (p: Promise<unknown>) => void p.catch(() => {})
    quiet(t.loadStandings(id))
    quiet(t.loadRounds(id))
    if (!pokemonTab) return
    quiet(t.loadEventUsage())
    const m = await import('@/data/meta')
    const ladder = m.regulationSnapshot(event.regulation)
    if (ladder) quiet(m.loadRanks(ladder))
  })
}

// The page's one visit among the recently viewed, whatever its view.
const once = (page: string) => () => page

// The comparison's visit: yours against the opponents, one per matchup (the two teams, up to six each), once each team
// has one; the speed order, one whatever its list, once there's one in it.
const TEAM_KEYS = ['a', 'b'].flatMap((s) => [s, ...[2, 3, 4, 5, 6].map((n) => `${s}${n}`)])
function compareVisit(query: LocationQuery) {
  const { a, b, mode, list } = query
  if (mode === 'order') return typeof list === 'string' && list ? 'speedCompare:order' : null
  return typeof a === 'string' && typeof b === 'string'
    ? `speedCompare:${TEAM_KEYS.map((k) => query[k])
        .filter((x) => typeof x === 'string')
        .join(':')}`
    : null
}

// The meta of a page in an area's section.
const inArea = (area: AreaId, section?: string) => ({ area, section })

// A page of the area's not built yet, which says so.
const soon = (area: AreaId, section: string, path: string, titleKey: MessageKey, descKey: MessageKey) => ({
  path,
  name: section,
  component: () => import('@/views/ComingSoonView.vue'),
  meta: { titleKey, descKey, ...inArea(area, section) },
})

// The abilities' or items' rankings: one view, the list its prop.
const usageRankings = (
  list: 'abilities' | 'items',
  name: 'abilityRankings' | 'itemRankings',
  kind: 'ability' | 'item',
) => ({
  path: `/meta/${list}`,
  name,
  component: () => import('@/views/UsageRankingsView.vue'),
  props: { list },
  meta: {
    titleKey: `title.${name}` as const,
    descKey: `desc.${name}` as const,
    headKey: `head.${name}` as const,
    keywordsKey: `keywords.${name}` as const,
    dexNames: true,
    descriptions: [kind],
    recent: once(name),
    ...inArea('meta', 'rankings'),
  },
})

// An ability's, item's or move's meta page: one view, the kind its prop.
const metaEntry = (
  list: 'abilities' | 'items' | 'moves',
  name: 'metaAbility' | 'metaItem' | 'metaMove',
  kind: 'ability' | 'item' | 'move',
) => ({
  path: `/meta/${list}/:id`,
  name,
  component: () => import('@/views/MetaEntryView.vue'),
  props: { kind },
  meta: {
    titleKey: `title.${name}` as const,
    descKey: `desc.${name}` as const,
    headKey: `head.${name}` as const,
    keywordsKey: `keywords.${name}` as const,
    dexNames: true,
    descriptions: [kind],
    recent: ({ params }: RouteLocationNormalized) => `${name}:${String(params.id)}`,
    ...inArea('meta', 'rankings'),
  },
})

// An area's own page, listing its sections.
const area = (id: AreaId, titleKey: MessageKey, descKey: MessageKey) => ({
  path: `/${id}`,
  name: id,
  component: () => import('@/views/AreaView.vue'),
  meta: { titleKey, descKey, ...inArea(id) },
})

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
      // Its favorites and recently viewed show dex entries.
      meta: { descKey: 'desc.home', keywordsKey: 'keywords.home', dexNames: () => hasFavorites() || hasRecent() },
    },

    // The dex: what exists in the regulation.
    area('dex', 'title.dex', 'desc.dex'),
    {
      // `/dex/types` lists every type; `/dex/types/fire` also shows that type's matchups.
      path: `/dex/types/:type(${TYPES.join('|')})?`,
      name: 'types',
      component: () => import('@/views/TypesView.vue'),
      meta: {
        titleKey: 'title.types',
        descKey: 'desc.types',
        dexNames: true,
        keepScroll: true,
        ...inArea('dex', 'types'),
      },
    },
    {
      path: '/dex/types/chart',
      name: 'chart',
      component: () => import('@/views/TypeChartView.vue'),
      meta: {
        titleKey: 'title.chart',
        descKey: 'desc.chart',
        headKey: 'head.chart',
        keywordsKey: 'keywords.chart',
        ...inArea('dex', 'chart'),
      },
    },
    {
      path: '/dex/abilities',
      name: 'abilities',
      component: () => import('@/views/AbilitiesView.vue'),
      meta: {
        titleKey: 'title.abilities',
        descKey: 'desc.abilities',
        dexNames: true,
        descriptions: ['ability'],
        ...inArea('dex', 'abilities'),
      },
    },
    {
      path: '/dex/abilities/:id',
      name: 'ability',
      component: () => import('@/views/AbilityView.vue'),
      // The layout describes an ability's own page; the list's description is for an ID the regulation lacks.
      meta: {
        titleKey: 'title.abilities',
        descKey: 'desc.abilities',
        dexNames: true,
        descriptions: ['ability'],
        ...inArea('dex', 'abilities'),
      },
    },
    {
      path: '/dex/pokemon',
      name: 'pokedex',
      component: () => import('@/views/PokedexView.vue'),
      meta: {
        titleKey: 'title.pokemon',
        descKey: 'desc.pokedex',
        headKey: 'head.pokedex',
        keywordsKey: 'keywords.pokedex',
        dexNames: true,
        ...inArea('dex', 'pokemon'),
      },
    },
    {
      path: '/dex/pokemon/:id',
      name: 'pokemon',
      component: () => import('@/views/PokemonView.vue'),
      meta: {
        titleKey: 'title.pokemon',
        descKey: 'desc.pokedex',
        dexNames: true,
        descriptions: ['ability', 'move'],
        ...inArea('dex', 'pokemon'),
      },
    },
    {
      path: '/dex/moves',
      name: 'moves',
      component: () => import('@/views/MovesView.vue'),
      meta: {
        titleKey: 'title.moves',
        descKey: 'desc.moves',
        dexNames: true,
        descriptions: ['move'],
        ...inArea('dex', 'moves'),
      },
    },
    {
      path: '/dex/moves/:id',
      name: 'move',
      component: () => import('@/views/MoveView.vue'),
      meta: {
        titleKey: 'title.moves',
        descKey: 'desc.moves',
        dexNames: true,
        descriptions: ['move'],
        ...inArea('dex', 'moves'),
      },
    },
    {
      path: '/dex/items',
      name: 'items',
      component: () => import('@/views/ItemsView.vue'),
      meta: {
        titleKey: 'title.items',
        descKey: 'desc.items',
        dexNames: true,
        descriptions: ['item'],
        ...inArea('dex', 'items'),
      },
    },
    {
      path: '/dex/items/:id',
      name: 'item',
      component: () => import('@/views/ItemView.vue'),
      meta: {
        titleKey: 'title.items',
        descKey: 'desc.items',
        dexNames: true,
        descriptions: ['item'],
        ...inArea('dex', 'items'),
      },
    },
    {
      path: '/dex/conditions',
      name: 'conditions',
      component: () => import('@/views/ConditionsView.vue'),
      meta: {
        titleKey: 'title.conditions',
        descKey: 'desc.conditions',
        dexNames: true,
        descriptions: ['condition'],
        ...inArea('dex', 'conditions'),
      },
    },
    {
      path: '/dex/conditions/:id',
      name: 'condition',
      component: () => import('@/views/ConditionView.vue'),
      meta: {
        titleKey: 'title.conditions',
        descKey: 'desc.conditions',
        dexNames: true,
        descriptions: ['condition'],
        ...inArea('dex', 'conditions'),
      },
    },

    // Meta: what players use, and how it does.
    // Its rankings are what most come for, so the area opens on them: the sections are in the bar under the header.
    { path: '/meta', name: 'meta', redirect: { name: 'rankings' } },
    {
      path: '/meta/pokemon',
      name: 'rankings',
      component: () => import('@/views/RankingsView.vue'),
      meta: {
        titleKey: 'title.pokemonRankings',
        descKey: 'desc.pokemonRankings',
        headKey: 'head.pokemonRankings',
        keywordsKey: 'keywords.pokemonRankings',
        dexNames: true,
        recent: once('rankings'),
        ...inArea('meta', 'rankings'),
      },
    },
    {
      path: '/meta/pokemon/:id',
      name: 'metaPokemon',
      component: () => import('@/views/MetaPokemonView.vue'),
      meta: {
        titleKey: 'title.metaPokemon',
        descKey: 'desc.metaPokemon',
        headKey: 'head.metaPokemon',
        keywordsKey: 'keywords.metaPokemon',
        dexNames: true,
        descriptions: ['ability', 'move', 'item'],
        recent: ({ params }) => `metaPokemon:${String(params.id)}`,
        ...inArea('meta', 'rankings'),
      },
    },
    {
      path: '/meta/moves',
      name: 'moveRankings',
      component: () => import('@/views/MoveRankingsView.vue'),
      meta: {
        titleKey: 'title.moveRankings',
        descKey: 'desc.moveRankings',
        headKey: 'head.moveRankings',
        keywordsKey: 'keywords.moveRankings',
        dexNames: true,
        descriptions: ['move'],
        recent: once('moveRankings'),
        ...inArea('meta', 'rankings'),
      },
    },
    metaEntry('moves', 'metaMove', 'move'),
    usageRankings('items', 'itemRankings', 'item'),
    usageRankings('abilities', 'abilityRankings', 'ability'),
    metaEntry('abilities', 'metaAbility', 'ability'),
    metaEntry('items', 'metaItem', 'item'),
    // The official tournaments, and each one's standings and Pokémon, a page each (`/pokemon` the second), and each of
    // its players'.
    {
      path: '/meta/tournaments',
      name: 'tournaments',
      component: () => import('@/views/TournamentsView.vue'),
      meta: {
        titleKey: 'title.tournaments',
        descKey: 'desc.tournaments',
        headKey: 'head.tournaments',
        keywordsKey: 'keywords.tournaments',
        recent: once('tournaments'),
        ...inArea('meta', 'tournaments'),
      },
    },
    // The events still to come.
    {
      path: '/meta/tournaments/upcoming',
      name: 'upcomingTournaments',
      component: () => import('@/views/TournamentsView.vue'),
      props: { upcoming: true },
      meta: {
        titleKey: 'title.upcomingTournaments',
        descKey: 'desc.upcomingTournaments',
        headKey: 'head.upcomingTournaments',
        keywordsKey: 'keywords.upcomingTournaments',
        recent: once('upcomingTournaments'),
        ...inArea('meta', 'tournaments'),
      },
    },
    {
      path: '/meta/tournaments/:id/:tab(pokemon|rounds)?',
      name: 'tournament',
      component: () => import('@/views/TournamentView.vue'),
      meta: {
        titleKey: 'title.tournament',
        descKey: 'desc.tournament',
        keywordsKey: 'keywords.tournament',
        dexNames: true,
        descriptions: ['ability', 'move', 'item'],
        prefetch: prefetchEvent,
        recent: ({ params }) => `tournament:${String(params.id)}`,
        ...inArea('meta', 'tournaments'),
      },
    },
    // A player of a tournament, by placing: their team and their matches round by round.
    {
      path: '/meta/tournaments/:id/players/:placing(\\d+)',
      name: 'tournamentPlayer',
      component: () => import('@/views/TournamentPlayerView.vue'),
      meta: {
        titleKey: 'title.tournamentPlayer',
        dexNames: true,
        descriptions: ['ability', 'move', 'item'],
        prefetch: prefetchEvent,
        ...inArea('meta', 'tournaments'),
      },
    },
    // Its address while it was coming soon.
    { path: '/meta/reports', redirect: { name: 'tournaments' } },
    {
      path: '/meta/speed-tiers',
      name: 'speedTiers',
      component: () => import('@/views/SpeedTiersView.vue'),
      meta: {
        titleKey: 'title.speedTiers',
        descKey: 'desc.speedTiers',
        headKey: 'head.speedTiers',
        keywordsKey: 'keywords.speedTiers',
        dexNames: true,
        keepScroll: true,
        recent: once('speedTiers'),
        // Everything but what's found, the chips tapped, the Pokémon kept (from before) and the Speed picked, and the data shown (the
        // reader's choice on every page, not the setup's).
        setup: (query) => stringQuery(query, ['find', 'findmode', 'keep', 'vs', 'at', 'meta']),
        // Its own recently viewed: a visit per Pokémon of yours (or, without one, per first Pokémon found), what's
        // found kept too.
        history: (query) => {
          const find = typeof query.find === 'string' ? query.find.split(',')[0] : undefined
          const of = typeof query.mine === 'string' && query.mine ? `mine:${query.mine}` : find && `find:${find}`
          return typeof of === 'string' ? { visit: of, query: stringQuery(query, ['vs', 'at', 'meta']) } : null
        },
        ...inArea('meta', 'speedTiers'),
      },
    },
    {
      // Pokémon's Speeds compared, yours against opponents or in speed order, linked to and from the speed tiers.
      path: '/meta/speed-tiers/compare',
      name: 'speedCompare',
      component: () => import('@/views/SpeedCompareView.vue'),
      meta: {
        titleKey: 'title.speedCompare',
        descKey: 'desc.speedCompare',
        headKey: 'head.speedCompare',
        keywordsKey: 'keywords.speedCompare',
        dexNames: true,
        // Yours against the opponents: one per matchup (the two, or the four), once each team has one. The speed order:
        // one, whatever its list, once there's one in it.
        recent: ({ query }) => compareVisit(query),
        // The Pokémon and their builds, once each team has one (in speed order, once there's one), but for the two
        // tapped among the matchups and the data shown.
        setup: (query) => (compareVisit(query) ? stringQuery(query, ['pair', 'meta']) : null),
        // Its own recently viewed: a visit per matchup, as the home page's.
        history: (query) => {
          const visit = compareVisit(query)
          return visit ? { visit, query: stringQuery(query, ['pair', 'meta']) } : null
        },
        ...inArea('meta', 'speedCompare'),
      },
    },

    // Tools: what you interact with.
    area('tools', 'title.tools', 'desc.tools'),
    soon('tools', 'calc', '/tools/calc', 'title.calc', 'desc.calc'),
    soon('tools', 'teamBuilder', '/tools/team-builder', 'title.teamBuilder', 'desc.teamBuilder'),
    {
      path: '/tools/matchups',
      name: 'matchups',
      component: () => import('@/views/TypeMatchupsView.vue'),
      meta: {
        titleKey: 'title.matchups',
        descKey: 'desc.matchups',
        headKey: 'head.matchups',
        keywordsKey: 'keywords.matchups',
        dexNames: true,
        recent: once('matchups'),
        ...inArea('tools', 'matchups'),
      },
    },
    {
      // One side of the matchups page on its own, linked from the side-by-side headings.
      path: '/tools/matchups/:side(def|atk)',
      name: 'matchupsSide',
      component: () => import('@/views/TypeMatchupsView.vue'),
      meta: {
        titleKey: 'title.matchups',
        descKey: 'desc.matchups',
        headKey: 'head.matchups',
        keywordsKey: 'keywords.matchups',
        dexNames: true,
        recent: once('matchups'),
        ...inArea('tools', 'matchups'),
      },
    },
    area('quizzes', 'title.quizzes', 'desc.quizzes'),
    {
      path: '/quizzes/types',
      name: 'quiz',
      component: () => import('@/views/TypeQuizView.vue'),
      meta: {
        titleKey: 'title.quiz',
        descKey: 'desc.quiz',
        headKey: 'head.quiz',
        keywordsKey: 'keywords.quiz',
        ...inArea('quizzes', 'typeQuiz'),
      },
    },
    {
      path: '/quizzes/speed',
      name: 'speedQuiz',
      component: () => import('@/views/SpeedQuizView.vue'),
      meta: {
        titleKey: 'title.speedQuiz',
        descKey: 'desc.speedQuiz',
        headKey: 'head.speedQuiz',
        keywordsKey: 'keywords.speedQuiz',
        dexNames: true,
        ...inArea('quizzes', 'speedQuiz'),
      },
    },

    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { titleKey: 'title.settings' },
    },
    {
      path: '/credits',
      name: 'credits',
      component: () => import('@/views/CreditsView.vue'),
      meta: { titleKey: 'title.credits', descKey: 'desc.credits' },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  // A new page opens at the top, and going back or forward returns to where it was left. Query changes (matchup
  // picks, filters, the search) stay put.
  async scrollBehavior(to, from, savedPosition) {
    // Between entries of one kind (one Pokémon to another) the page stays, with no transition to wait for.
    const samePage = (to.matched[0]?.path ?? to.path) === (from.matched[0]?.path ?? from.path)
    if (!savedPosition && (to.path === from.path || (samePage && to.meta.keepScroll))) return false
    // A match led to (`?match=`, the Rounds tab's) is scrolled to by its page, once drawn.
    const toMatch = !savedPosition && to.query.match !== undefined
    // On first load (a reload restoring its position) there's no page leaving.
    if (!samePage && from.matched.length) {
      await afterPageExit()
      await nextTick()
    }
    return toMatch ? false : (savedPosition ?? { top: 0 })
  },
})

// The build's pages for search engines are folders (`scripts/seoPages.ts`), which GitHub Pages opens with a trailing
// slash: the app's own URLs have none.
router.beforeEach((to) =>
  to.path.length > 1 && to.path.endsWith('/')
    ? { path: to.path.replace(/\/+$/, ''), query: to.query, hash: to.hash, replace: true }
    : undefined,
)

// What a page loads first, started as navigation does.
router.beforeEach((to) => {
  to.meta.prefetch?.(to)
})

// Pages whose view is in their URL go among the recently viewed as they're opened, each change to the view (a
// `router.replace`) keeping the visit where it's left.
router.afterEach((to, _from, failure) => {
  const page = !failure && to.meta.recent?.(to)
  if (!page) return
  visitPage({ page, path: to.path, query: stringQuery(to.query) })
})

// Pages whose setup can be starred keep the setups they're at lately (`usePageHistory`), a visit at a time: arriving at
// the page starts one, leaving it ends it.
router.afterEach((to, from, failure) => {
  if (failure) return
  if (from.name !== to.name && from.meta.history) endVisit(String(from.name))
  const kept = to.meta.history?.(to.query)
  if (!to.meta.history) return
  const page = String(to.name)
  if (from.name !== to.name) endVisit(page)
  recordSetup({ page, path: to.path, query: kept?.query ?? {} }, kept?.visit ?? null)
})

// Pages showing dex entries render with their names (and descriptions) in place, rather than filling them in once
// they load.
router.beforeResolve(async (to) => {
  await Promise.all([
    (typeof to.meta.dexNames === 'function' ? to.meta.dexNames() : to.meta.dexNames) && loadDexNames(),
    to.meta.descriptions && loadDescriptions(to.meta.descriptions),
  ])
})
