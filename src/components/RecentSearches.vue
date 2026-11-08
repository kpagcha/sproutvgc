<script setup lang="ts">
import { X } from '@lucide/vue'
import { t } from '@/i18n'
import { useRecentSearches, type RecentResult } from '@/composables/useRecentSearches'
import ItemIcon from '@/components/ItemIcon.vue'
import PokemonIcon from '@/components/PokemonIcon'
import TypeIcon from '@/components/TypeIcon'

// Under the site's search box while it's focused and empty, a card over the page of the results opened from it lately
// (`useRecentSearches`), each opening again in a tap, or taken off the list; the one picked with the arrow keys
// marked (`active`, kept by the box's page, which reads its keys). Pressing on it doesn't take the focus from the box.
defineProps<{ active: number }>()
const emit = defineEmits<{ open: [r: RecentResult] }>()
const { searches, remove, clear } = useRecentSearches()
</script>

<template>
  <div v-if="searches.length" class="recent-searches" @mousedown.prevent>
    <div class="head muted small">
      <span>{{ t('search.recent') }}</span>
      <button type="button" class="link-button" @click="clear">{{ t('search.recentClear') }}</button>
    </div>
    <!-- Chips, wrapping: each its icon, its name, "Dex" for the dex's entry, and its removal. -->
    <ul role="listbox" :aria-label="t('search.recent')">
      <li
        v-for="(r, i) in searches"
        :key="r.to"
        role="option"
        :aria-selected="i === active"
        :class="{ active: i === active }"
      >
        <RouterLink :to="r.to" class="pick" @click="emit('open', r)">
          <PokemonIcon v-if="r.icon?.kind === 'pokemon'" :id="r.icon.id" />
          <ItemIcon v-else-if="r.icon?.kind === 'item'" :id="r.icon.id" />
          <TypeIcon v-else-if="r.icon?.kind === 'type'" :type="r.icon.id" />
          <span class="text">{{ r.name }}</span>
          <span v-if="r.dex" class="dex-tag">{{ t('search.dexTag') }}</span>
        </RouterLink>
        <button
          type="button"
          class="remove muted"
          :aria-label="t('search.recentRemove', { q: r.name })"
          @click="remove(r.to)"
        >
          <X :size="12" aria-hidden="true" />
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
  padding: 8px 12px 12px;
  text-align: left;
  /* Soft, not the panels' hard shadow: it lies over panels that have theirs. */
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 4px;
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.18);
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 8px;
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
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
li {
  display: flex;
  align-items: center;
  min-width: 0;
  max-width: 100%;
  border: 1px solid var(--border);
  border-radius: 999px;
}
li:hover,
li.active {
  background: var(--sel);
}
li.active {
  border-color: var(--accent);
}
.pick {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  min-height: 28px;
  padding: 0 2px 0 10px;
  color: var(--text);
  font-weight: bold;
  text-decoration: none;
}
.pick:hover {
  text-decoration: none;
}
.text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* The dex's entry, told from the meta's. */
.dex-tag {
  padding: 0 4px;
  font-size: 0.7em;
  font-weight: normal;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
  border: 1px solid var(--border);
  border-radius: 2px;
}
.remove {
  display: flex;
  padding: 4px 8px 4px 4px;
  background: none;
  border: none;
  cursor: pointer;
}
.remove:hover {
  color: var(--text);
}
</style>
