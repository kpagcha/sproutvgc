<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue'
import { useRoute, type RouteLocationNormalizedLoaded, type RouteLocationRaw } from 'vue-router'
import { AnimatePresence, MotionConfig, motion } from 'motion-v'
import { FADE, PAGE } from '@/lib/motion'
import { pageEntered, pageEntering, pageExited, pageKey, setPageWaits } from '@/lib/pageExit'
import { t, typeName, type MessageKey } from '@/i18n'
import { isType } from '@/data/types'
import { generatedName, refName } from '@/i18n/refName'
import type { GeneratedKind } from '@/i18n'
import type { Ref } from '@/data/dex'
import { GAME_NAME, REGULATION } from '@/data/format'
import { Search, Settings } from '@lucide/vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import NavPill from '@/components/NavPill.vue'
import { KeptPage, Page } from '@/components/PageFrame'
import SectionMenu from '@/components/SectionMenu.vue'
import logoUrl from '@/assets/logo.png'
import { searchFocus } from '@/composables/useSearch'

const route = useRoute()

function setMeta(selector: string, content: string) {
  document.head.querySelector(selector)?.setAttribute('content', content)
}

/** The entry pages of generated categories, by route name, and the meta description of each. */
const ENTRY_PAGES: Partial<Record<string, { kind: GeneratedKind; desc: MessageKey }>> = {
  ability: { kind: 'ability', desc: 'desc.ability' },
  pokemon: { kind: 'pokemon', desc: 'desc.pokemon' },
  move: { kind: 'move', desc: 'desc.move' },
  item: { kind: 'item', desc: 'desc.item' },
}

watchEffect(() => {
  // A type's own page (/types/fire) and a dex entry's (/abilities/levitate) are titled and described as that type or
  // entry; pages without a description use the home page's.
  const type = typeof route.params.type === 'string' && isType(route.params.type) ? route.params.type : null
  const page = typeof route.name === 'string' ? ENTRY_PAGES[route.name] : undefined
  const id = String(route.params.id)
  // Conditions are curated, not generated: named by the locale, or after their move.
  const entry = page
    ? generatedName(page.kind, id)
    : route.name === 'condition'
      ? refName({ kind: 'condition', id } as Ref)
      : undefined
  const key = route.meta.titleKey
  const name = key ? t(key) : null
  const lead = type ? typeName(type) : entry
  const title = name ? `${lead ? `${lead} · ` : ''}${name} · ${GAME_NAME} · sproutvgc` : `sproutvgc · ${GAME_NAME} dex`
  const params = { game: GAME_NAME, reg: REGULATION }
  const desc = type
    ? t('desc.type', { ...params, type: typeName(type) })
    : entry
      ? t(page?.desc ?? 'desc.condition', { ...params, ability: entry, name: entry })
      : t(route.meta.descKey ?? 'desc.home', params)
  document.title = title
  setMeta('meta[name="description"]', desc)
  setMeta('meta[property="og:title"]', title)
  setMeta('meta[property="og:description"]', desc)
})

/** Entry pages lead back to their category's list. */
const LISTS: Partial<Record<string, { to: string; label: MessageKey }>> = {
  ability: { to: '/abilities', label: 'title.abilities' },
  pokemon: { to: '/pokemon', label: 'title.pokemon' },
  move: { to: '/moves', label: 'title.moves' },
  item: { to: '/items', label: 'title.items' },
  condition: { to: '/conditions', label: 'title.conditions' },
}

// Pages under Types get a back link to it, named after it. One side of the matchups page leads back to the whole
// page instead, keeping the picks (and, with tabs, that side's tab).
function backLink(r: RouteLocationNormalizedLoaded): { to: RouteLocationRaw; label: MessageKey } | null {
  if (r.name === 'matchupsSide') {
    const query = { ...r.query, mode: r.params.side === 'atk' ? 'atk' : undefined }
    return { to: { path: '/types/matchups', query }, label: 'nav.matchups' }
  }
  const list = typeof r.name === 'string' ? LISTS[r.name] : undefined
  if (list) return list
  const tool = r.name === 'chart' || r.name === 'matchups' || r.name === 'quiz'
  return tool ? { to: '/types', label: 'nav.types' } : null
}

// The header link to highlight: the dex section the current page belongs to.
const SECTIONS: Partial<Record<string, string>> = {
  home: 'search',
  types: 'types',
  chart: 'types',
  matchups: 'types',
  matchupsSide: 'types',
  quiz: 'types',
  settings: 'settings',
  pokedex: 'pokemon',
  pokemon: 'pokemon',
  moves: 'moves',
  move: 'moves',
  abilities: 'abilities',
  ability: 'abilities',
  items: 'items',
  item: 'items',
  conditions: 'conditions',
  condition: 'conditions',
}
const section = computed(() => (typeof route.name === 'string' ? (SECTIONS[route.name] ?? null) : null))

/**
 * The header's links: Search (the home page, with its search box focused), one per dex section, and Settings. Types
 * covers its tools too (chart, matchups, quiz).
 */
const NAV: { to: string; section: string; label: MessageKey }[] = [
  { to: '/pokemon', section: 'pokemon', label: 'nav.pokemon' },
  { to: '/moves', section: 'moves', label: 'nav.moves' },
  { to: '/abilities', section: 'abilities', label: 'nav.abilities' },
  { to: '/items', section: 'items', label: 'nav.items' },
  { to: '/conditions', section: 'conditions', label: 'nav.conditions' },
  { to: '/types', section: 'types', label: 'nav.types' },
]

// Narrow screens fold the sections into a dropdown, and show Settings as just its icon.
const compactQuery = window.matchMedia('(max-width: 760px)')
const compact = ref(compactQuery.matches)
compactQuery.addEventListener('change', (e) => (compact.value = e.matches))

// Phones (touch, narrow): pages slide instead of fading.
const phoneQuery = window.matchMedia('(max-width: 720px) and (hover: none) and (pointer: coarse)')
const isPhone = ref(phoneQuery.matches)
phoneQuery.addEventListener('change', (e) => (isPhone.value = e.matches))
// Only desktop's fade has the next page wait for the leaving one, and so its scroll too.
watchEffect(() => setPageWaits(!isPhone.value))

// On phones, pages push each other sideways: going deeper, the new page comes in from the right as
// the old one leaves to the left; going back, the reverse. Both travel a full screen width in lockstep.
const depth = (path: string) => path.split('/').filter(Boolean).length
const direction = ref(1)
watch(
  () => route.path,
  (to, from) => (direction.value = depth(to) >= depth(from) ? 1 : -1),
)
// Pages are keyed by route (see the template): a new key is a new page coming in, in place once its animation to
// `center` completes.
watch(() => pageKey(route), pageEntering)
// The pages kept when left, by route name (see the template).
const KEPT = new Set<unknown>(['pokedex', 'moves'])
const onPageAnimated = (definition: unknown) => definition === 'center' && pageEntered()
// Both animate `transform` (and `opacity`) rather than motion's `x` and `y`, which it animates on the main thread: the
// browser animates these on its own, so the next page rendering can't stall them.
const pageVariants = {
  enter: (dir: number) => ({ transform: `translateX(${dir > 0 ? 100 : -100}vw)` }),
  center: { transform: 'translateX(0vw)' },
  exit: (dir: number) => ({ transform: `translateX(${dir > 0 ? -100 : 100}vw)` }),
}
// On desktop, the old page fades out, then the new one fades in from slightly below.
const fadeVariants = {
  enter: { opacity: 0, transform: 'translateY(6px)' },
  center: { opacity: 1, transform: 'translateY(0px)' },
  exit: { opacity: 0, transform: 'translateY(-4px)' },
}
</script>

<template>
  <!-- Motion respects the OS "reduce motion" setting everywhere below. -->
  <MotionConfig reduced-motion="user">
    <header class="site-header">
      <div class="wrap bar">
        <RouterLink to="/" class="logo font-display"
          ><img :src="logoUrl" alt="" width="45" height="36" /><span class="word"
            >sprout<span>vgc</span></span
          ></RouterLink
        >
        <nav class="nav font-display" :class="{ compact }">
          <!-- The active highlight is one element that slides between links. -->
          <NavPill :section :compact />
          <RouterLink to="/" :class="{ active: section === 'search' }" @click="searchFocus = true">
            <Search class="label" :size="16" :stroke-width="2.5" aria-hidden="true" />
            <span class="label">{{ t('nav.search') }}</span>
          </RouterLink>
          <SectionMenu v-if="compact" :items="NAV" :section />
          <template v-else>
            <RouterLink v-for="n in NAV" :key="n.to" :to="n.to" :class="{ active: section === n.section }">
              <span class="label">{{ t(n.label) }}</span>
            </RouterLink>
          </template>
          <RouterLink
            to="/settings"
            class="end"
            :class="{ active: section === 'settings' }"
            :aria-label="compact ? t('nav.settings') : undefined"
          >
            <Settings class="label" :size="16" :stroke-width="2.5" aria-hidden="true" />
            <span v-if="!compact" class="label">{{ t('nav.settings') }}</span>
          </RouterLink>
        </nav>
      </div>
    </header>
    <main class="wrap">
      <RouterView v-slot="{ Component, route: r }">
        <!-- Keyed by route rather than URL so query and param changes (matchup picks, the selected type) don't replay it.
             On phones, popLayout lifts the leaving page out of the flow so both pages slide side by side. -->
        <AnimatePresence
          :mode="isPhone ? 'popLayout' : 'wait'"
          :initial="false"
          :custom="direction"
          :on-exit-complete="pageExited"
        >
          <!-- On desktop the dex tables' pages are kept when left (`KeptPage`), so coming back doesn't render them again.
               Not on phones, whose sliding pages (a TransitionGroup) can't hold a KeepAlive. -->
          <KeepAlive v-if="!isPhone" include="KeptPage">
            <component
              :is="KEPT.has(r.name) ? KeptPage : Page"
              :key="pageKey(r)"
              :variants="fadeVariants"
              initial="enter"
              animate="center"
              exit="exit"
              :transition="FADE"
              :on-animation-complete="onPageAnimated"
            >
              <RouterLink v-if="backLink(r)" :to="backLink(r)!.to" class="back font-display">
                <span class="chevron" aria-hidden="true">‹</span> {{ t(backLink(r)!.label) }}
              </RouterLink>
              <component :is="Component" />
            </component>
          </KeepAlive>
          <motion.div
            v-else
            :key="pageKey(r)"
            :custom="direction"
            :variants="pageVariants"
            initial="enter"
            animate="center"
            exit="exit"
            :transition="PAGE"
            :on-animation-complete="onPageAnimated"
          >
            <RouterLink v-if="backLink(r)" :to="backLink(r)!.to" class="back font-display">
              <span class="chevron" aria-hidden="true">‹</span> {{ t(backLink(r)!.label) }}
            </RouterLink>
            <component :is="Component" />
          </motion.div>
        </AnimatePresence>
      </RouterView>
    </main>
    <footer class="wrap footer muted">
      <div class="credits">
        <span>{{ t('footer.copyright') }}</span>
        <RouterLink to="/">{{ t('footer.home') }}</RouterLink>
        <RouterLink to="/credits">{{ t('title.credits') }}</RouterLink>
      </div>
    </footer>
    <ConfirmDialog />
  </MotionConfig>
</template>

<style scoped>
.wrap {
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  padding: 0 16px;
}

.site-header {
  background: var(--panel);
  border-bottom: 1px solid var(--border);
  box-shadow: var(--shadow);
  margin-bottom: 16px;
}

.bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 16px;
  min-height: 44px;
  padding-top: 4px;
  padding-bottom: 4px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: calc(20px * var(--display-scale, 1));
  font-weight: bold;
  letter-spacing: -0.5px;
  color: var(--logo-sprout);
}
.logo img {
  /* Pixel art, drawn at its own size: scaled to anything but a whole multiple, it loses pixels. */
  image-rendering: pixelated;
}
.logo .word span {
  color: var(--logo-vgc);
}
.logo:hover {
  text-decoration: none;
}
.nav {
  position: relative;
  display: flex;
  gap: 4px;
  /* Sits beside the logo when it fits, else drops to its own row (scrolling sideways as a last resort). */
  flex: 1 0 auto;
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
}
.nav a {
  display: flex;
  align-items: center;
  gap: 5px;
  flex: none;
  white-space: nowrap;
  position: relative;
  padding: 4px 8px;
  border-radius: 3px;
  color: var(--text);
}
.nav a:hover {
  text-decoration: none;
}
/* Touch screens fire :hover on tap (and keep it), which would flash under the pill as it slides over. */
@media (hover: hover) {
  .nav a:hover:not(.active) {
    background: var(--hover);
  }
}
.nav .end {
  margin-left: auto;
}
/* The dropdown's menu hangs below the bar, so nothing may clip it (and the three links never need scrolling). */
.nav.compact {
  overflow: visible;
}
.nav .label {
  position: relative;
}

.back {
  display: flex;
  align-items: center;
  gap: 5px;
  width: fit-content;
  margin-bottom: 12px;
  padding: 3px 10px 3px 7px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--panel);
  box-shadow: var(--shadow);
  color: var(--muted);
}
.back .chevron {
  font-weight: bold;
  font-size: 1.25em;
  line-height: 1;
}
.back:hover {
  background: var(--panel-alt);
  color: var(--text);
  text-decoration: none;
}

/* Narrow screens: one row, the logo's picture alone (its name kept for screen readers) and the links together at the
   end. */
@media (max-width: 560px) {
  .bar {
    flex-wrap: nowrap;
  }
  .logo .word {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .nav {
    flex: 0 1 auto;
    margin-left: auto;
  }
  .nav .end {
    margin-left: 0;
  }
}

main {
  flex: 1 0 auto;
  /* Anchors the leaving page, and cuts it off where the new page ends instead of over the footer. */
  position: relative;
  overflow-y: clip;
}

.footer {
  padding-top: 8px;
  padding-bottom: 24px;
  font-size: calc(11px * var(--text-scale));
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.credits {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
