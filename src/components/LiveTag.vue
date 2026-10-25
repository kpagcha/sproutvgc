<script setup lang="ts">
import { computed } from 'vue'
import type { LiveState } from '@/data/tournaments'
import { locale, t } from '@/i18n'
import { ago } from '@/lib/live'

// A tournament under way, marked so (`LIVE_EVENTS`): "Live" with a pulsing dot, the round it's at of all of them and,
// unless `short`, how long ago its standings last changed; one over but not generated for good yet, "Just finished".
// One over has a tooltip saying it's left out of what adds events up until its team lists are in.
const props = defineProps<{ live: LiveState; short?: boolean }>()
const over = computed(() => !!props.live.completed)
const updated = computed(() => ago(props.live.updated, locale.value))
</script>

<template>
  <span v-tip="over ? t('tournaments.liveOverTip') : undefined" class="live-tag" :class="{ over, tipped: over }">
    <template v-if="over">{{ t('tournaments.liveOver') }}</template>
    <template v-else>
      <span class="live-mark"><span class="dot" aria-hidden="true" />{{ t('tournaments.live') }}</span>
      <span>{{ t('tournaments.liveRound', { n: live.round, of: live.rounds }) }}</span>
      <span v-if="!short" class="muted">{{ t('tournaments.liveUpdated', { when: updated }) }}</span>
    </template>
  </span>
</template>

<style scoped>
.live-tag {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 0.5em;
}
.live-tag > span + span::before {
  content: '·';
  margin-right: 0.5em;
  color: var(--muted);
}
.live-mark {
  display: inline-flex;
  align-items: center;
  gap: 0.35em;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--bad);
}
.dot {
  width: 0.55em;
  height: 0.55em;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 1.6s ease-in-out infinite;
}
.over {
  font-weight: bold;
  color: var(--muted);
}
@keyframes pulse {
  50% {
    opacity: 0.25;
  }
}
@media (prefers-reduced-motion: reduce) {
  .dot {
    animation: none;
  }
}
</style>
