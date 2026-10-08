import { nextTick } from 'vue'
import { createRouter, createWebHistory, type LocationQuery, type RouteLocationNormalized } from 'vue-router'
import { afterPageExit } from '@/lib/pageExit'
import { TYPES } from '@/data/types'
import type { MessageKey } from '@/i18n'
import type { AreaId } from '@/lib/areas'
import { loadDexNames } from '@/i18n/refName'
import { hasFavorites } from '@/composables/useFavorites'
import { hasRecent, visitPage } from '@/composables/useRecent'
import { loadDescriptions, type DescribedKind } from '@/i18n/descriptions'

declare module 'vue-router' {
  interface RouteMeta {
    titleKey?: MessageKey
    /** The page's meta description, for search results and link previews. */
    descKey?: MessageKey
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
  }
}

/** A query's plain values, but those named in `omit`. */
export const stringQuery = (query: LocationQuery, omit: readonly string[] = []) =>
  Object.fromEntries(
    Object.entries(query).filter((e): e is [string, string] => typeof e[1] === 'string' && !omit.includes(e[0])),
  )

// The page's one visit among the recently viewed, whatever its view.
const once = (page: string) => () => page

// The meta of a page in an area's section.
const inArea = (area: AreaId, section?: string) => ({ area, section })

// A page of the area's not built yet, which says so.
const soon = (area: AreaId, section: string, path: string, titleKey: MessageKey, descKey: MessageKey) => ({
  path,
  name: section,
  component: () => import('@/views/ComingSoonView.vue'),
  meta: { titleKey, descKey, ...inArea(area, section) },
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
      meta: { descKey: 'desc.home', dexNames: () => hasFavorites() || hasRecent() },
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
      meta: { titleKey: 'title.chart', descKey: 'desc.chart', ...inArea('dex', 'chart') },
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
      meta: { titleKey: 'title.pokemon', descKey: 'desc.pokedex', dexNames: true, ...inArea('dex', 'pokemon') },
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

    // Competitive: what players use, and how it does.
    area('competitive', 'title.competitive', 'desc.competitive'),
    {
      path: '/competitive/usage',
      name: 'usage',
      component: () => import('@/views/UsageView.vue'),
      meta: {
        titleKey: 'title.usage',
        descKey: 'desc.usage',
        dexNames: true,
        recent: once('usage'),
        ...inArea('competitive', 'usage'),
      },
    },
    soon('competitive', 'reports', '/competitive/reports', 'title.reports', 'desc.reports'),
    {
      path: '/competitive/speed-tiers',
      name: 'speedTiers',
      component: () => import('@/views/SpeedTiersView.vue'),
      meta: {
        titleKey: 'title.speedTiers',
        descKey: 'desc.speedTiers',
        dexNames: true,
        keepScroll: true,
        recent: once('speedTiers'),
        // Everything but what's found, the chip tapped, the Pokémon kept and the Speed picked.
        setup: (query) => stringQuery(query, ['find', 'findmode', 'keep', 'vs', 'at']),
        ...inArea('competitive', 'speedTiers'),
      },
    },
    {
      // Pokémon's Speeds compared, yours against opponents or in speed order, linked to and from the speed tiers.
      path: '/competitive/speed-tiers/compare',
      name: 'speedCompare',
      component: () => import('@/views/SpeedCompareView.vue'),
      meta: {
        titleKey: 'title.speedCompare',
        descKey: 'desc.speedCompare',
        dexNames: true,
        // Yours against the opponents: one per matchup (the two, or the four), once each team has one. The speed order:
        // one, whatever its list, once there's one in it.
        recent: ({ query: { a, b, a2, b2, mode, list } }) =>
          mode === 'order'
            ? typeof list === 'string' && list
              ? 'speedCompare:order'
              : null
            : typeof a === 'string' && typeof b === 'string'
              ? `speedCompare:${[a, a2, b, b2].filter((x) => typeof x === 'string').join(':')}`
              : null,
        // The Pokémon and their builds, once each team has one (in speed order, once there's one), but for the two
        // tapped among the matchups.
        setup: (query) =>
          (
            query.mode === 'order'
              ? typeof query.list === 'string' && query.list
              : typeof query.a === 'string' && typeof query.b === 'string'
          )
            ? stringQuery(query, ['pair'])
            : null,
        ...inArea('competitive', 'speedCompare'),
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
        dexNames: true,
        recent: once('matchups'),
        ...inArea('tools', 'matchups'),
      },
    },
    {
      path: '/tools/quiz',
      name: 'quiz',
      component: () => import('@/views/TypeQuizView.vue'),
      meta: { titleKey: 'title.quiz', descKey: 'desc.quiz', ...inArea('tools', 'quiz') },
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
    // On first load (a reload restoring its position) there's no page leaving.
    if (!samePage && from.matched.length) {
      await afterPageExit()
      await nextTick()
    }
    return savedPosition ?? { top: 0 }
  },
})

// Pages whose view is in their URL go among the recently viewed as they're opened, each change to the view (a
// `router.replace`) keeping the visit where it's left.
router.afterEach((to, _from, failure) => {
  const page = !failure && to.meta.recent?.(to)
  if (!page) return
  visitPage({ page, path: to.path, query: stringQuery(to.query) })
})

// Pages showing dex entries render with their names (and descriptions) in place, rather than filling them in once
// they load.
router.beforeResolve(async (to) => {
  await Promise.all([
    (typeof to.meta.dexNames === 'function' ? to.meta.dexNames() : to.meta.dexNames) && loadDexNames(),
    to.meta.descriptions && loadDescriptions(to.meta.descriptions),
  ])
})
