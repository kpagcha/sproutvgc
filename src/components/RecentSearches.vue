<script setup lang="ts">
import { History, X } from '@lucide/vue'
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
    <ul role="listbox" :aria-label="t('search.recent')">
      <li
        v-for="(r, i) in searches"
        :key="r.to"
        role="option"
        :aria-selected="i === active"
        :class="{ active: i === active }"
      >
        <RouterLink :to="r.to" class="pick" @click="emit('open', r)">
          <span class="icon">
            <PokemonIcon v-if="r.icon?.kind === 'pokemon'" :id="r.icon.id" />
            <ItemIcon v-else-if="r.icon?.kind === 'item'" :id="r.icon.id" />
            <TypeIcon v-else-if="r.icon?.kind === 'type'" :type="r.icon.id" />
            <History v-else :size="14" aria-hidden="true" class="muted" />
          </span>
          <span class="text">{{ r.name }}</span>
          <span class="sub muted small">{{ r.sub }}</span>
        </RouterLink>
        <button
          type="button"
          class="remove muted"
          :aria-label="t('search.recentRemove', { q: r.name })"
          @click="remove(r.to)"
        >
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
  min-height: 36px;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 6px 12px;
  color: var(--text);
  text-decoration: none;
}
.pick:hover {
  text-decoration: none;
}
.icon {
  display: inline-flex;
  flex: none;
  justify-content: center;
  /* A Pokémon's icon's width, so every name starts level. */
  width: 40px;
}
.text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sub {
  flex: none;
  margin-left: auto;
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
