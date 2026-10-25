<script setup lang="ts">
import { LIVE_EVENTS } from '@/data/tournaments'
import AppLink from '@/components/AppLink'
import LiveTag from '@/components/LiveTag.vue'

// The home page's tournaments under way (`LIVE_EVENTS`): a slim line each, live and the round it's at, then its name,
// the way to its standings. Nothing when none is.
</script>

<template>
  <ul v-if="LIVE_EVENTS.length" class="live-now">
    <li v-for="e in LIVE_EVENTS" :key="e.id">
      <AppLink :to="{ name: 'tournament', params: { id: e.id } }" class="live-line">
        <LiveTag :live="e.live" short />
        <span class="name">{{ e.name }} <span class="arrow">›</span></span>
      </AppLink>
    </li>
  </ul>
</template>

<style scoped>
.live-now {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px 20px;
  margin: -12px 0 20px;
  padding: 0;
  list-style: none;
  font-size: 0.875em;
}
.live-line {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 0.6em;
  color: var(--text);
}
.live-line:hover {
  text-decoration: none;
}
.live-line:hover .name {
  text-decoration: underline;
}
.name {
  font-weight: bold;
}
.arrow {
  color: var(--accent);
}
</style>
