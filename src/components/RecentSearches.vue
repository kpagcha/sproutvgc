<script setup lang="ts">
import { History, X } from '@lucide/vue'
import { t } from '@/i18n'
import { useRecentSearches } from '@/composables/useRecentSearches'

// Under the site's search box while it's focused and empty, a card over the page of the last searches
// (`useRecentSearches`), each searched again in a tap, or taken off the list; the one picked with the arrow keys
// marked (`active`, kept by the box's page, which reads its keys). Pressing on it doesn't take the focus from the box.
defineProps<{ active: number }>()
const emit = defineEmits<{ pick: [q: string] }>()
const { searches, remove, clear } = useRecentSearches()
</script>

<template>
  <div v-if="searches.length" class="recent-searches panel" @mousedown.prevent>
    <div class="head muted small">
      <span>{{ t('search.recent') }}</span>
      <button type="button" class="link-button" @click="clear">{{ t('search.recentClear') }}</button>
    </div>
    <ul role="listbox" :aria-label="t('search.recent')">
      <li
        v-for="(q, i) in searches"
        :key="q"
        role="option"
        :aria-selected="i === active"
        :class="{ active: i === active }"
      >
        <button type="button" class="pick" @click="emit('pick', q)">
          <History :size="14" aria-hidden="true" class="muted" /><span class="text">{{ q }}</span>
        </button>
        <button type="button" class="remove muted" :aria-label="t('search.recentRemove', { q })" @click="remove(q)">
          <X :size="14" aria-hidden="true" />
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* Under the box, its width, over the page. */
.recent-searches {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  left: 0;
  z-index: 60;
  padding: 8px 0 6px;
  text-align: left;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px 4px;
}
.link-button {
  padding: 0;
  font: inherit;
  color: var(--accent);
  background: none;
  border: none;
  cursor: pointer;
}
.link-button:hover {
  text-decoration: underline;
}
ul {
  margin: 0;
  padding: 0;
  list-style: none;
}
li {
  display: flex;
  align-items: center;
}
li:hover,
li.active {
  background: var(--sel);
}
.pick {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 6px 12px;
  font: inherit;
  color: var(--text);
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
}
.text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.remove {
  display: flex;
  padding: 6px 12px;
  background: none;
  border: none;
  cursor: pointer;
}
.remove:hover {
  color: var(--text);
}
</style>
