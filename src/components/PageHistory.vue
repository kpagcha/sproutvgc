<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Trash2 } from '@lucide/vue'
import { t } from '@/i18n'
import type { PageVisit } from '@/composables/useRecent'
import { startVisit, usePageHistory } from '@/composables/usePageHistory'
import { useOpenState } from '@/composables/useOpenState'
import PageChip, { shownVisit } from '@/components/PageChip.vue'

// At the top of a page whose setup can be starred (the speed tiers, the comparison), the setups it was at lately
// (`usePageHistory`), most recent first, as the home page's recently viewed shows pages (`PageChip`), each reopening it
// so, the one shown now marked (rather than left out, so the row keeps still as the page changes). Picking one starts a
// visit of its own, the one before saved as it was left. Those the regulation can't show are left out. Nothing shows
// until there's one besides the one shown now; it folds away (folded at first), and can be cleared. On wide screens,
// all on one row.
const route = useRoute()
const page = computed(() => String(route.name))
const current = computed((): PageVisit | null => {
  const query = (route.meta.history ?? route.meta.setup)?.(route.query)
  return query ? { page: page.value, path: route.path, query } : null
})
const { items: all, clear } = usePageHistory(page, current)
/** The most shown. */
const MAX = 8
const items = computed(() => all.value.filter((i) => shownVisit(i.visit)).slice(0, MAX))
const shown = computed(() => items.value.some((i) => !i.current))
/** A setup picked starts a visit, but for the one shown now. */
const onPick = (e: MouseEvent) => (e.target as Element).closest('.current') || startVisit(page.value)
const { open, toggle } = useOpenState(`sproutvgc.pageHistory.${page.value}.open`, false)
</script>

<template>
  <!-- On one row: the toggle, the chips (on narrow screens, on a row of their own under it) and clearing. -->
  <div v-if="shown" class="panel page-history" :class="{ open }">
    <button type="button" class="toggle" :aria-expanded="open" aria-controls="page-history-chips" @click="toggle">
      <span class="marker" aria-hidden="true">{{ open ? '▾' : '▸' }}</span
      ><span class="title">{{ t('recent.title') }}</span> <span class="count muted">{{ items.length }}</span>
    </button>
    <div v-show="open" id="page-history-chips" class="chips" @click.capture="onPick">
      <PageChip
        v-for="i in items"
        :key="JSON.stringify(i.visit.query)"
        :visit="i.visit"
        untitled
        :class="{ current: i.current }"
        :aria-current="i.current ? 'page' : undefined"
      />
    </div>
    <button
      v-tip="t('recent.clear')"
      type="button"
      class="btn inverted clear"
      :aria-label="t('recent.clear')"
      @click="clear"
    >
      <Trash2 :size="14" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.page-history {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding-top: 4px;
  padding-bottom: 4px;
}
.toggle {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  padding: 0;
  color: var(--text);
  font: inherit;
  background: none;
  border: 0;
  cursor: pointer;
}
.marker {
  font-size: 0.8em;
}
.title {
  font-weight: 700;
}
.count {
  font-size: 0.85em;
}
.chips {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}
/* The one shown now: outlined, as what's picked is elsewhere. */
.chips > .current {
  border-color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent);
}
/* Clearing, its icon alone (its name in its tooltip), no taller than the heading's line. */
.clear {
  min-height: 0;
  margin-left: auto;
  padding: 3px 6px;
}
/* Narrow screens: the chips on a row of their own, under the toggle and clearing. */
@media (max-width: 720px) {
  .chips {
    flex-basis: 100%;
    order: 1;
  }
}
</style>
