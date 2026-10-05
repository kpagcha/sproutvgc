<script setup lang="ts">
import { computed } from 'vue'
import { available } from '@/data/dex'
import { t } from '@/i18n'
import { useRecent } from '@/composables/useRecent'
import { useOpenState } from '@/composables/useOpenState'
import EntryChip from '@/components/EntryChip.vue'

// The home page's recently viewed: the entries whose pages the reader opened lately, most recent first, as chips
// (`EntryChip`), beside the favorites and in the same panel. Those the regulation doesn't have are left out. Nothing
// shows until a page has been opened; it folds away, and can be cleared.
const { recent, clear } = useRecent()
const refs = computed(() => recent.value.filter((r) => available(r)))
const { open, onToggle } = useOpenState('sproutvgc.recent.open')
</script>

<template>
  <details v-if="refs.length" class="panel banded recent" :open @toggle="onToggle">
    <summary>
      <h2 class="title">{{ t('recent.title') }}</h2>
      <button type="button" class="clear" @click.prevent="clear">{{ t('recent.clear') }}</button>
    </summary>
    <div class="chips">
      <EntryChip v-for="r in refs" :key="`${r.kind}:${r.id}`" :to="r" />
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
/* Clearing sits at the band's end, quiet until hovered. */
.clear {
  position: absolute;
  top: 50%;
  right: 12px;
  transform: translateY(-50%);
  padding: 0 4px;
  font: inherit;
  font-size: 0.8em;
  color: inherit;
  background: none;
  border: none;
  opacity: 0.75;
  cursor: pointer;
}
.clear:hover {
  opacity: 1;
  text-decoration: underline;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
