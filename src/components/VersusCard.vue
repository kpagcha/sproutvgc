<script setup lang="ts">
import { computed } from 'vue'
import { ArrowRight, Columns2, X } from '@lucide/vue'
import type { PokemonId } from '@/data/dex'
import { t, tSlots } from '@/i18n'
import type { NamedLocation } from '@/lib/links'
import type { pointsToMoveFirst } from '@/lib/speed'
import { pointsText } from '@/lib/speedBuild'
import AppLink from '@/components/AppLink'
import PokemonIcon from '@/components/PokemonIcon'

// Yours against a Pokémon on the speed tiers' ladder (the chip tapped): its name (a link to its page) on top; then
// whether yours moves first as it's built, at what Speeds (its own finding its chip), and for its nature the points that
// do it (what's left to spare, or, when none do, what another nature would need); and the way to the comparison of the
// two, where every nature's shown. A panel of its own under yours beside the ladder; narrower, a card floating at the foot of the
// screen.
type Result = ReturnType<typeof pointsToMoveFirst>
const props = defineProps<{
  /** The Pokémon it's against, its name as the ladder shows it, and its Speed there. */
  id: PokemonId
  name: string
  speed: number
  /** Yours: its name, Speed, and Speed points. */
  mineName: string
  mineSpeed: number
  points: number
  trickRoom: boolean
  /** The points that move yours first with its nature, and with the one that would when it can't. */
  result: Result
  other: { effect: 'up' | 'down'; result: Result } | null
  /** The comparison of yours and it, side by side. */
  compareTo: NamedLocation
}>()
const emit = defineEmits<{ close: []; locate: [] }>()

const title = tSlots('speed.vs')
/** Whether yours moves first as it is: the faster, or under Trick Room the slower. */
const verdict = computed(() =>
  props.mineSpeed === props.speed ? 'tie' : props.mineSpeed > props.speed !== props.trickRoom ? 'first' : 'after',
)
/** What yours' nature takes: the points, and what's to spare of yours (more than it needs, outside Trick Room). */
const plan = computed(() => {
  const r = props.result
  if (!r) return t('speed.planNever')
  if ('ties' in r) return t('speed.planTies', { points: r.ties })
  const amount = pointsText(r)
  const spare = 'from' in r && props.points > r.from ? t('speed.planSpare', { n: props.points - r.from }) : ''
  return `${t('speed.planWith', { amount })}${spare ? ` ${spare}` : ''}`
})
</script>

<template>
  <!-- A band of the opponents' red: the Pokémon it's against (a link to its page), and a way to close it, as yours'
       band clears it. -->
  <section class="panel banded versus-card small" role="status">
    <div class="band">
      <strong
        ><template v-for="(part, i) in title" :key="i"
          ><template v-if="typeof part === 'string'">{{ part }}</template
          ><AppLink v-else-if="part.slot === 'name'" :to="{ name: 'pokemon', params: { id: props.id } }" class="mon"
            ><PokemonIcon :id="props.id" />{{ props.name }}</AppLink
          ></template
        ></strong
      >
      <button type="button" class="btn on-band inverted close" @click="emit('close')">
        <X :size="14" aria-hidden="true" />{{ t('speed.vsClose') }}
      </button>
    </div>
    <!-- Yours as it's built: moves first, ties or moves after, at what Speeds (its, finding its chip on the ladder). -->
    <p class="verdict" :class="verdict">
      {{ t(`speed.vsNow.${verdict}`, { name: props.mineName }) }}
      <span class="speeds"
        >{{ props.mineSpeed }} <span class="vs">vs</span>{{ ' '
        }}<button type="button" class="speed" :aria-label="t('speed.vsLocate')" @click="emit('locate')">
          {{ props.speed }}
        </button></span
      >
    </p>
    <!-- Its nature: the points that do it; when none do, another nature's. -->
    <p class="plan">{{ plan }}</p>
    <p v-if="props.other" class="plan">
      {{ t(`speed.planOther.${props.other.effect}`, { amount: pointsText(props.other.result) }) }}
    </p>
    <!-- To the comparison's own page: a button that stands out, its arrow saying it goes there. -->
    <AppLink :to="props.compareTo" class="btn primary compare-link"
      ><Columns2 :size="16" aria-hidden="true" />{{ t('compare.open') }}<ArrowRight :size="16" aria-hidden="true"
    /></AppLink>
  </section>
</template>

<style scoped>
.versus-card {
  margin: 0;
}
.small {
  font-size: 0.875em;
}
/* Its band in the opponents' red, as the ladder's is with yours picked: on one line, Close at its end. */
:root:root .versus-card.banded > .band {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--opponent-text);
  background: var(--opponent);
}
.band > strong {
  flex: 1;
  min-width: 0;
}
.band a {
  color: inherit;
}
/* The Pokémon it's against, in its title: its name on the text's line, its icon centered on it. */
.mon {
  white-space: nowrap;
}
.mon :deep(.sheet-icon) {
  margin-block: -6px;
}
/* Its Speed, which finds its chip on the ladder: underlined as a link is, dotted as what shows rather than goes. */
.speed {
  padding: 0;
  font: inherit;
  color: inherit;
  background: none;
  border: none;
  text-decoration: underline dotted;
  text-underline-offset: 3px;
  cursor: pointer;
}
.speed:hover {
  text-decoration-style: solid;
}
/* Close, as yours' band's Clear is: filled with the band's text color, in the opponents' red. */
:root:root .versus-card .btn.on-band.inverted {
  flex: none;
  margin-block: -2px;
  color: var(--opponent);
  background: var(--opponent-text);
  border-color: var(--opponent-text);
}
:root:root .versus-card .btn.on-band.inverted:hover:not(:disabled) {
  background: color-mix(in srgb, var(--opponent-text) 85%, var(--opponent));
}
:root:root .versus-card .btn.on-band.inverted:active:not(:disabled) {
  background: color-mix(in srgb, var(--opponent-text) 70%, var(--opponent));
}
/* The verdict: bold, in the color of how it goes for yours; the Speeds beside it. */
.verdict {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 2px 10px;
  margin: 0;
  font-weight: bold;
}
.verdict.after {
  color: var(--opponent);
}
.verdict.tie {
  color: var(--muted);
}
.speeds {
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
.vs {
  font-weight: normal;
  color: var(--muted);
}
.plan {
  margin: 6px 0 0;
}
.compare-link {
  gap: 6px;
  width: 100%;
  margin-top: 10px;
  font-weight: bold;
}
.compare-link:hover {
  text-decoration: none;
}
</style>
