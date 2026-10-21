<script setup lang="ts">
import { computed } from 'vue'
import { percent } from '@/data/meta'
import { t } from '@/i18n'

// A Pokémon's usage against what it was before, as a bar on a faint band, `max` its full length (so bars set side by
// side compare), in soft tones so the numbers on it read in the text's color: grey to what it kept (its usage now when
// it rose, before when it fell), then what it gained, a wash of the good color, or lost, faintly hatched in the bad.
// Its numbers on it, from its start: "4.1% → 6.3%", one at none before "New". With nothing before (`before` null), its
// usage alone, grey.
const props = defineProps<{ before: number | null; usage: number; max: number }>()

const dir = computed(() =>
  props.before === null || props.before === props.usage ? '' : props.usage > props.before ? 'rise' : 'fall',
)
const style = computed(() => {
  const before = props.before ?? props.usage
  return {
    '--lo': Math.min(before, props.usage) / props.max,
    '--hi': Math.max(before, props.usage) / props.max,
  }
})
</script>

<template>
  <span class="track" :class="dir" :style="style">
    <span class="kept"></span><span class="delta"></span>
    <span class="num shift-label"
      ><template v-if="before !== null"
        ><span v-if="!before && usage" v-tip="t('tournaments.newTip')" class="fresh">{{ t('usage.new') }}</span
        ><template v-else>{{ percent(before) }}</template> → </template
      >{{ percent(usage) }}</span
    >
  </span>
</template>

<style scoped>
.track {
  position: relative;
  display: block;
  min-width: 3rem;
  height: 18px;
  background: color-mix(in srgb, var(--border) 30%, transparent);
}
.kept,
.delta {
  position: absolute;
  top: 0;
  bottom: 0;
}
.kept {
  left: 0;
  width: calc(var(--lo) * 100%);
  background: color-mix(in srgb, var(--text) 16%, transparent);
}
.delta {
  left: calc(var(--lo) * 100%);
  width: calc((var(--hi) - var(--lo)) * 100%);
}
.rise .delta {
  background: color-mix(in srgb, var(--good) 38%, transparent);
}
.fall .delta {
  background: repeating-linear-gradient(
    -45deg,
    color-mix(in srgb, var(--bad) 30%, transparent) 0 2px,
    transparent 2px 5px
  );
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--bad) 55%, transparent);
}
/* The numbers across the bar, in the text's color. */
.shift-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  padding: 0 6px;
  font-size: 0.8em;
  line-height: 1;
  white-space: nowrap;
}
.fresh {
  color: var(--accent);
  font-weight: bold;
}
</style>
