<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { t } from '@/i18n'
import { areaOf } from '@/lib/areas'

// The header's second row: the current area's sections, the one the page is in underlined. It scrolls sideways when
// they don't fit (phones).
const route = useRoute()
const area = computed(() => areaOf(route.meta.area))
</script>

<template>
  <nav v-if="area" class="area-nav font-display" :aria-label="t('nav.sections')">
    <RouterLink
      v-for="s in area.sections"
      :key="s.key"
      :to="{ name: s.route }"
      :class="{ active: route.meta.section === s.key, soon: s.soon }"
    >
      {{ t(s.label) }}
    </RouterLink>
  </nav>
</template>

<style scoped>
.area-nav {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
  font-size: 0.9em;
}
.area-nav a {
  flex: none;
  padding: 6px 8px 4px;
  color: var(--muted);
  white-space: nowrap;
  border-bottom: 3px solid transparent;
}
.area-nav a:hover {
  color: var(--text);
  text-decoration: none;
}
.area-nav a.active {
  color: var(--text);
  border-bottom-color: var(--accent);
}
/* Not built yet: fainter. */
.area-nav a.soon:not(.active) {
  opacity: 0.7;
}
</style>
