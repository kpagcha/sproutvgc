import { createRouter, createWebHistory } from 'vue-router'
import { TYPES } from '@/data/types'
import type { MessageKey } from '@/i18n'
import { loadDexNames } from '@/i18n/refName'
import { loadDescriptions, type DescribedKind } from '@/i18n/descriptions'

declare module 'vue-router' {
  interface RouteMeta {
    titleKey?: MessageKey
    /** The page's meta description, for search results and link previews. */
    descKey?: MessageKey
    /** The page shows dex entries (`DexRef`): navigation waits for the current locale's names. */
    dexNames?: boolean
    /** The categories whose descriptions the page shows: navigation waits for the current locale's. */
    descriptions?: DescribedKind[]
  }
}

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: () => import('@/views/HomeView.vue'), meta: { descKey: 'desc.home' } },
    {
      // `/types` lists every type; `/types/fire` also shows that type's matchups.
      path: `/types/:type(${TYPES.join('|')})?`,
      name: 'types',
      component: () => import('@/views/TypesView.vue'),
      meta: { titleKey: 'title.types', descKey: 'desc.types', dexNames: true },
      // The chart used to live at `/types`: keep its shared cell links (?atk=…&def=…) working.
      beforeEnter: (to) => (!to.params.type && to.query.atk ? { path: '/types/chart', query: to.query } : undefined),
    },
    {
      path: '/types/chart',
      name: 'chart',
      component: () => import('@/views/TypeChartView.vue'),
      meta: { titleKey: 'title.chart', descKey: 'desc.chart' },
    },
    {
      path: '/types/matchups',
      name: 'matchups',
      component: () => import('@/views/TypeMatchupsView.vue'),
      meta: { titleKey: 'title.matchups', descKey: 'desc.matchups', dexNames: true },
    },
    {
      // One side of the matchups page on its own, linked from the side-by-side headings.
      path: '/types/matchups/:side(def|atk)',
      name: 'matchupsSide',
      component: () => import('@/views/TypeMatchupsView.vue'),
      meta: { titleKey: 'title.matchups', descKey: 'desc.matchups', dexNames: true },
    },
    {
      // The matchups page used to be the calculator: keep its shared links working.
      path: '/types/calc/:side(def|atk)?',
      redirect: (to) => ({
        path: to.params.side ? `/types/matchups/${to.params.side}` : '/types/matchups',
        query: to.query,
      }),
    },
    {
      path: '/types/quiz',
      name: 'quiz',
      component: () => import('@/views/TypeQuizView.vue'),
      meta: { titleKey: 'title.quiz', descKey: 'desc.quiz' },
    },
    {
      path: '/abilities',
      name: 'abilities',
      component: () => import('@/views/AbilitiesView.vue'),
      meta: { titleKey: 'title.abilities', descKey: 'desc.abilities', dexNames: true, descriptions: ['ability'] },
    },
    {
      path: '/abilities/:id',
      name: 'ability',
      component: () => import('@/views/AbilityView.vue'),
      // The layout describes an ability's own page; the list's description is for an ID the regulation lacks.
      meta: { titleKey: 'title.abilities', descKey: 'desc.abilities', dexNames: true, descriptions: ['ability'] },
    },
    {
      path: '/pokemon',
      name: 'pokedex',
      component: () => import('@/views/PokedexView.vue'),
      meta: { titleKey: 'title.pokemon', descKey: 'desc.pokedex', dexNames: true },
    },
    {
      path: '/pokemon/:id',
      name: 'pokemon',
      component: () => import('@/views/PokemonView.vue'),
      meta: {
        titleKey: 'title.pokemon',
        descKey: 'desc.pokedex',
        dexNames: true,
        descriptions: ['ability', 'move'],
      },
    },
    {
      path: '/moves',
      name: 'moves',
      component: () => import('@/views/MovesView.vue'),
      meta: { titleKey: 'title.moves', descKey: 'desc.moves', dexNames: true, descriptions: ['move'] },
    },
    {
      path: '/moves/:id',
      name: 'move',
      component: () => import('@/views/MoveView.vue'),
      meta: { titleKey: 'title.moves', descKey: 'desc.moves', dexNames: true, descriptions: ['move'] },
    },
    {
      path: '/items',
      name: 'items',
      component: () => import('@/views/ItemsView.vue'),
      meta: { titleKey: 'title.items', descKey: 'desc.items', dexNames: true, descriptions: ['item'] },
    },
    {
      path: '/items/:id',
      name: 'item',
      component: () => import('@/views/ItemView.vue'),
      meta: { titleKey: 'title.items', descKey: 'desc.items', dexNames: true, descriptions: ['item'] },
    },
    {
      path: '/conditions',
      name: 'conditions',
      component: () => import('@/views/ConditionsView.vue'),
      meta: { titleKey: 'title.conditions', descKey: 'desc.conditions', dexNames: true, descriptions: ['condition'] },
    },
    {
      path: '/conditions/:id',
      name: 'condition',
      component: () => import('@/views/ConditionView.vue'),
      meta: { titleKey: 'title.conditions', descKey: 'desc.conditions', dexNames: true, descriptions: ['condition'] },
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
})

// Pages showing dex entries render with their names (and descriptions) in place, rather than filling them in once
// they load.
router.beforeResolve(async (to) => {
  await Promise.all([
    to.meta.dexNames && loadDexNames(),
    to.meta.descriptions && loadDescriptions(to.meta.descriptions),
  ])
})
