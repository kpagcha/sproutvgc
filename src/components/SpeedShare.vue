<script setup lang="ts">
import { percent } from '@/data/meta'
import { t } from '@/i18n'
import type { Odds } from '@/lib/speedLineup'

// How one of the comparison's Pokémon does against another when either is at its sets: a bar split by who moves first,
// in the share of their matchups, each part in its side's color (a tie plain), and under it the shares in words.
defineProps<{
  odds: Odds
  /** The two, the first's share being `odds.first`, and their colors. */
  name: string
  other: string
  tone: 'yours' | 'opponent'
}>()
</script>

<template>
  <div class="share" :class="tone">
    <div class="split" aria-hidden="true">
      <span v-if="odds.first" class="first" :style="{ flexGrow: odds.first }"></span>
      <span v-if="odds.tie" class="tie" :style="{ flexGrow: odds.tie }"></span>
      <span v-if="odds.after" class="after" :style="{ flexGrow: odds.after }"></span>
    </div>
    <p class="legend small">
      <span class="first-text">{{ t('compare.shareFirst', { name, pct: percent(odds.first) }) }}</span>
      <span v-if="odds.tie" class="muted">{{ t('compare.shareTie', { pct: percent(odds.tie) }) }}</span>
      <span class="after-text">{{ t('compare.shareFirst', { name: other, pct: percent(odds.after) }) }}</span>
    </p>
  </div>
</template>

<style scoped>
.share {
  --first: var(--accent);
  --after: var(--opponent);
}
.share.opponent {
  --first: var(--opponent);
  --after: var(--accent);
}
.small {
  font-size: 0.875em;
}
.split {
  display: flex;
  height: 12px;
  overflow: hidden;
  border: 1px solid var(--ink);
}
.split > span {
  flex-basis: 0;
}
.split .first {
  background: var(--first);
}
.split .after {
  background: var(--after);
}
.split .tie {
  background: repeating-linear-gradient(-45deg, var(--panel), var(--panel) 3px, var(--muted) 3px, var(--muted) 4px);
}
/* The shares, each under its part: the first's at the start, the other's at the end. */
.legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 2px 12px;
  margin: 4px 0 0;
  font-variant-numeric: tabular-nums;
}
.first-text,
.after-text {
  font-weight: bold;
}
</style>
