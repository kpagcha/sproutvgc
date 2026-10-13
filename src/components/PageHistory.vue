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
// until there's one besides the one shown now; it folds away (folded at first), and can be cleared, a band as the home
// page's recently viewed (`RecentPanel`), in grey, the chips under it.
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
const { open, onToggle } = useOpenState(`sproutvgc.pageHistory.${page.value}.open`, false)
</script>

<template>
  <details v-if="shown" class="panel banded page-history" :open @toggle="onToggle">
    <summary>
      <h2 class="title">
        {{ t('recent.title') }} <span class="count">{{ items.length }}</span>
      </h2>
      <button type="button" class="btn on-band clear" @click.prevent="clear">
        <Trash2 :size="14" aria-hidden="true" />{{ t('recent.clear') }}
      </button>
    </summary>
    <div class="chips" @click.capture="onPick">
      <PageChip
        v-for="i in items"
        :key="JSON.stringify(i.visit.query)"
        :visit="i.visit"
        untitled
        :class="{ current: i.current }"
        :aria-current="i.current ? 'page' : undefined"
      />
    </div>
  </details>
</template>

<style scoped>
.page-history > summary {
  position: relative;
  cursor: pointer;
}
/* A band in the panel's own grey, not the accent: it needn't stand out over the page. */
:root:root .page-history.banded > summary {
  color: var(--text);
  background: color-mix(in srgb, var(--ink) 12%, var(--panel));
}
/* Inline, so the marker sits on the heading's line. */
.title {
  display: inline;
  margin: 0 0 0 2px;
}
.count {
  font-size: 0.75em;
  font-weight: normal;
  opacity: 0.8;
}
/* Clearing sits at the band's end, as the home page's does. */
.clear {
  position: absolute;
  top: 50%;
  right: 12px;
  transform: translateY(-50%);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
/* The one shown now: outlined, as what's picked is elsewhere. */
.chips > .current {
  border-color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent);
}
</style>
