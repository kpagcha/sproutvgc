<script setup lang="ts">
import { t, type MessageKey } from '@/i18n'

// Links to the type chart (in the dex) and the type tools (in Tools), as a row of cards.
const LINKS: { to: string; label: MessageKey }[] = [
  { to: '/dex/types/chart', label: 'nav.chart' },
  { to: '/tools/matchups', label: 'nav.matchups' },
  { to: '/tools/quiz', label: 'nav.quiz' },
]
</script>

<template>
  <div class="quick-links">
    <RouterLink v-for="l in LINKS" :key="l.to" :to="l.to" class="quick">
      <span class="quick-title font-display">{{ t(l.label) }} <span class="arrow" aria-hidden="true">›</span></span>
    </RouterLink>
  </div>
</template>

<style scoped>
.quick-links {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
/* Phones: in one row. Columns are sized to their titles, so a long one ("Enfrentamientos") gets more room
   than a short one. */
@media (max-width: 560px) {
  .quick-links {
    grid-template-columns: repeat(3, auto);
    gap: 6px;
  }
  .quick-title {
    white-space: nowrap;
  }
  .quick {
    padding: 8px 6px;
    align-items: center;
    justify-content: center;
    text-align: center;
  }
}
.quick {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  min-height: 44px;
  padding: 10px 12px;
  background: var(--panel-alt);
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--text);
}
.quick:hover {
  text-decoration: none;
  border-color: var(--accent);
}
.quick-title {
  font-weight: bold;
  font-size: calc(14px * var(--text-scale));
}
.arrow {
  color: var(--accent);
}
</style>
