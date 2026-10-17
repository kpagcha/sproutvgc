<script setup lang="ts">
import { computed } from 'vue'
import { Trash2 } from '@lucide/vue'
import { available } from '@/data/dex'
import { t } from '@/i18n'
import { useRecent } from '@/composables/useRecent'
import { useOpenState } from '@/composables/useOpenState'
import EntryChip from '@/components/EntryChip.vue'
import PageChip, { shownVisit } from '@/components/PageChip.vue'

// The home page's recently viewed: the entries whose pages the reader opened lately, and the pages with a view of
// their own (the speed tiers, a comparison, the type matchups) as they were left, most recent first, as chips
// (`EntryChip`, `PageChip`), beside the favorites and in the same panel. Those the regulation doesn't have are left
// out. Nothing shows until a page has been opened; it starts folded, then stays as the reader last left it, and can be cleared.
const { recent, clear } = useRecent()
const { open, onToggle } = useOpenState('sproutvgc.recent.open', false)
const items = computed(() => recent.value.filter((r) => (r.kind === 'entry' ? available(r.ref) : shownVisit(r))))
const keyOf = (r: (typeof items.value)[number]) => (r.kind === 'entry' ? `${r.ref.kind}:${r.ref.id}` : `page:${r.page}`)
</script>

<template>
  <details v-if="items.length" :open class="panel banded grey recent" @toggle="onToggle">
    <summary>
      <h2 class="title">{{ t('recent.title') }}</h2>
      <button
        v-tip="t('recent.clear')"
        type="button"
        class="btn on-band clear"
        :aria-label="t('recent.clear')"
        @click.prevent="clear"
      >
        <Trash2 :size="14" aria-hidden="true" />
      </button>
    </summary>
    <div class="chips">
      <template v-for="r in items" :key="keyOf(r)">
        <EntryChip v-if="r.kind === 'entry'" :to="r.ref" dex />
        <PageChip v-else :visit="r" />
      </template>
    </div>
  </details>
</template>

<style scoped>
.recent > summary {
  position: relative;
  cursor: pointer;
}
/* Inline, so the marker sits on the heading's line. */
.title {
  display: inline;
  margin: 0 0 0 2px;
}
/* Clearing sits at the band's end, a band button as the speed tiers' clear is. */
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
/* The icon alone, unoutlined until pointed at: clearing needn't stand out. */
:root:root .clear.btn.on-band {
  padding: 2px 4px;
  border-color: transparent;
}
</style>
