<script setup lang="ts">
import { computed, onScopeDispose, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AnimatePresence, motion } from 'motion-v'
import { isType, type TypeId } from '@/data/types'
import { t } from '@/i18n'
import { reveal } from '@/lib/scroll'
import { FADE, PRESS } from '@/lib/motion'
import TypePicker from '@/components/TypePicker.vue'
import DefenseResults from '@/components/DefenseResults.vue'
import OffenseResults from '@/components/OffenseResults.vue'

const route = useRoute()
const router = useRouter()

function parseTypes(v: unknown, max: number): TypeId[] {
  const s = typeof v === 'string' ? v : ''
  return [...new Set(s.split(',').filter(isType))].slice(0, max)
}

// `/tools/matchups/def` and `/tools/matchups/atk` show just that side, with no tabs or columns.
const single = computed(() => {
  const s = route.params.side
  return s === 'def' || s === 'atk' ? s : null
})
const mode = computed(() => single.value ?? (route.query.mode === 'atk' ? 'atk' : 'def'))
const def = computed(() => parseTypes(route.query.def, 2))
const atk = computed(() => parseTypes(route.query.atk, 4))

// Wide screens show defense and offense side by side, so a Pokémon's types and its moves can be checked together;
// narrower ones keep the tabs.
const wideQuery = window.matchMedia('(min-width: 860px)')
const wide = ref(wideQuery.matches)
const onWide = (e: MediaQueryListEvent) => (wide.value = e.matches)
wideQuery.addEventListener('change', onWide)
onScopeDispose(() => wideQuery.removeEventListener('change', onWide))
const cols = computed(() => wide.value && !single.value)
// The column headings open their side on its own, keeping the picks.
const sideLink = (s: 'def' | 'atk') => ({ path: `/tools/matchups/${s}`, query: { ...route.query, mode: undefined } })

function setQuery(patch: Record<string, string | undefined>) {
  const q: Record<string, string> = {}
  for (const [k, v] of Object.entries({ ...route.query, ...patch })) {
    if (typeof v === 'string' && v) q[k] = v
  }
  return router.replace({ query: q })
}

// The side whose results the scrolling and the floating button follow: the open tab, or side by side, the last one
// picked from.
const lastPicked = ref<'def' | 'atk'>(mode.value)
const side = computed(() => (cols.value ? lastPicked.value : mode.value))
const defResults = useTemplateRef<HTMLElement>('defResults')
const atkResults = useTemplateRef<HTMLElement>('atkResults')
const results = computed(() => (side.value === 'def' ? defResults.value : atkResults.value))

// Picks never scroll, since you may want to pick more (past the maximum, a pick replaces the oldest); a floating
// button jumps to the results while they're below the screen.
function pick(which: 'def' | 'atk', v: TypeId[]) {
  lastPicked.value = which
  void setQuery({ [which]: v.join(',') })
}
const setDef = (v: TypeId[]) => pick('def', v)
const setAtk = (v: TypeId[]) => pick('atk', v)

// The button shows while the results start low on the screen (below 40%) and run off its bottom edge.
const resultsBelow = ref(false)
watch(results, (el, _, onCleanup) => {
  resultsBelow.value = false
  if (!el) return
  const check = () => {
    const r = el.getBoundingClientRect()
    const vh = window.innerHeight
    resultsBelow.value = r.top > vh * 0.4 && r.bottom > vh
  }
  // Scrolling, resizing, and the results changing size (more picks) can all change the answer.
  const ro = new ResizeObserver(check)
  ro.observe(el)
  window.addEventListener('scroll', check, { passive: true })
  window.addEventListener('resize', check)
  onCleanup(() => {
    ro.disconnect()
    window.removeEventListener('scroll', check)
    window.removeEventListener('resize', check)
  })
})
const toResults = () => reveal(results.value)
</script>

<template>
  <div class="panel">
    <!-- One side on its own is titled by that side: the back link already names the matchups page. -->
    <h1>{{ t(single ? (single === 'def' ? 'matchups.tabDef' : 'matchups.tabAtk') : 'title.matchups') }}</h1>
    <div v-if="cols" class="cols">
      <section>
        <h2>
          <RouterLink :to="sideLink('def')" class="side-link">
            {{ t('matchups.tabDef') }} <span class="arrow" aria-hidden="true">›</span>
          </RouterLink>
        </h2>
        <p class="muted">{{ t('matchups.pickDef') }}</p>
        <TypePicker :model-value="def" :max="2" compact @update:model-value="setDef" />
      </section>
      <section>
        <h2>
          <RouterLink :to="sideLink('atk')" class="side-link">
            {{ t('matchups.tabAtk') }} <span class="arrow" aria-hidden="true">›</span>
          </RouterLink>
        </h2>
        <p class="muted">{{ t('matchups.pickAtk') }}</p>
        <TypePicker :model-value="atk" :max="4" compact @update:model-value="setAtk" />
      </section>
    </div>
    <template v-else>
      <nav v-if="!single" class="tabs">
        <RouterLink :to="{ query: { ...route.query, mode: undefined } }" :class="{ active: mode === 'def' }">
          {{ t('matchups.tabDef') }}
        </RouterLink>
        <RouterLink :to="{ query: { ...route.query, mode: 'atk' } }" :class="{ active: mode === 'atk' }">
          {{ t('matchups.tabAtk') }}
        </RouterLink>
      </nav>
      <template v-if="mode === 'def'">
        <p class="muted">{{ t('matchups.pickDef') }}</p>
        <TypePicker :model-value="def" :max="2" @update:model-value="setDef" />
      </template>
      <template v-else>
        <p class="muted">{{ t('matchups.pickAtk') }}</p>
        <TypePicker :model-value="atk" :max="4" @update:model-value="setAtk" />
      </template>
    </template>
  </div>

  <div v-if="cols" class="cols">
    <div>
      <div v-if="def.length" ref="defResults"><DefenseResults :types="def" /></div>
      <p v-else class="muted hint">{{ t('matchups.selectHint') }}</p>
    </div>
    <div>
      <div v-if="atk.length" ref="atkResults"><OffenseResults :types="atk" /></div>
      <p v-else class="muted hint">{{ t('matchups.selectHint') }}</p>
    </div>
  </div>
  <template v-else>
    <div v-if="mode === 'def' && def.length" ref="defResults"><DefenseResults :types="def" /></div>
    <div v-else-if="mode === 'atk' && atk.length" ref="atkResults"><OffenseResults :types="atk" /></div>
    <p v-else class="muted hint">{{ t('matchups.selectHint') }}</p>
  </template>

  <!-- Outside the page so the page transition's transform can't move it. -->
  <Teleport to="body">
    <AnimatePresence>
      <motion.button
        v-if="resultsBelow"
        type="button"
        class="btn primary to-results"
        :initial="{ opacity: 0, y: 8 }"
        :animate="{ opacity: 1, y: 0 }"
        :exit="{ opacity: 0, y: 8 }"
        :transition="FADE"
        :while-press="PRESS"
        @click="toResults"
      >
        {{ t('matchups.toResults') }} ↓
      </motion.button>
    </AnimatePresence>
  </Teleport>
</template>

<style scoped>
.cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  align-items: start;
}
/* Lets each column shrink to its half, so the pickers and results wrap instead of widening it. */
.cols > * {
  min-width: 0;
}

.side-link {
  color: var(--text);
}
.side-link:hover {
  text-decoration: none;
  color: var(--accent);
}
.arrow {
  color: var(--accent);
}

.hint {
  text-align: center;
}

.to-results {
  position: fixed;
  left: 50%;
  bottom: calc(16px + env(safe-area-inset-bottom));
  z-index: 10;
  translate: -50% 0;
  min-height: 40px;
  padding: 6px 16px;
  font-weight: bold;
}
</style>
