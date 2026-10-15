<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Trash2 } from '@lucide/vue'
import { t } from '@/i18n'
import type { PageVisit } from '@/composables/useRecent'
import { pickVisit, usePageHistory } from '@/composables/usePageHistory'
import PageChip, { shownVisit } from '@/components/PageChip.vue'

// At the top of a page whose setup can be starred (the speed tiers, the comparison), the setups it was at lately
// (`usePageHistory`), most recent first, as the home page's recently viewed shows pages (`PageChip`), each reopening it
// so, the one shown now marked (rather than left out, so the row keeps still as the page changes). Picking one visits
// it where it is, rather than moving it to the front. Those the regulation can't show are left out. It shows once
// there's one, folded each time the page is opened, and can be cleared, a band as the home page's recently viewed
// (`RecentPanel`), in grey, the chips under it.
const route = useRoute()
const page = computed(() => String(route.name))
const current = computed((): PageVisit | null => {
  const query = route.meta.history?.(route.query)?.query
  return query ? { page: page.value, path: route.path, query } : null
})
const { items: all, clear } = usePageHistory(page, current)
/** The most shown. */
const MAX = 8
const items = computed(() => all.value.filter((i) => shownVisit(i.visit)).slice(0, MAX))
/** A setup picked is visited in its place, but for the one shown now. */
function onPick(e: MouseEvent) {
  const chip = (e.target as Element).closest('a')
  if (chip && !chip.matches('.current') && !(e.ctrlKey || e.metaKey || e.shiftKey)) pickVisit(page.value)
}
</script>

<template>
  <details v-if="items.length" class="panel banded grey page-history">
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
  translate: 0 -50%;
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
