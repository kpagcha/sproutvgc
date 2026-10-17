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

// Yours against a Pokémon on the speed tiers' ladder (the chip tapped), in a sentence, the two as their icons: whether
// yours moves first as it's built, at what Speeds (its own finding its chip), and for its nature the points that do it
// (what's left to spare, or, when none do, what another nature would need); and the way to the comparison of the two,
// where every nature's shown. A panel of its own under yours beside the ladder; narrower, a card floating at the
// foot of the screen.
type Result = ReturnType<typeof pointsToMoveFirst>
const props = defineProps<{
  /** The Pokémon it's against, its name as the ladder shows it, and its Speed there. */
  id: PokemonId
  name: string
  speed: number
  /** Yours: which, its name, its Speed, and Speed points. */
  mine: PokemonId
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

/** Whether yours moves first as it is: the faster, or under Trick Room the slower. */
const verdict = computed(() =>
  props.mineSpeed === props.speed ? 'tie' : props.mineSpeed > props.speed !== props.trickRoom ? 'first' : 'after',
)
/** What it takes: yours' nature's points (with what's to spare of yours, outside Trick Room); when they can't, the
 * nature that would. */
const plan = computed(() => {
  const r = props.result
  if (props.other) return t(`speed.planOther.${props.other.effect}`, { amount: pointsText(props.other.result) })
  if (!r) return t('speed.planNever')
  if ('ties' in r) return t('speed.planTies', { points: r.ties })
  const amount = pointsText(r)
  const spare = 'from' in r && props.points > r.from ? t('speed.planSpare', { n: props.points - r.from }) : ''
  return `${t('speed.planWith', { amount })}${spare ? ` ${spare}` : ''}`
})
const canHover = window.matchMedia('(hover: hover)').matches
</script>

<template>
  <!-- One sentence, the two Pokémon in it as their icons (the opponent's a link to its usage page): yours and its Speed,
       whether it moves first, the opponent and its Speed (finding its chip on the ladder), and what it takes. Then the
       ways on, and a way to close it in the corner. -->
  <section class="panel versus-card small" role="status">
    <div class="head">
      <p class="line">
        <template v-for="(part, i) in tSlots('speed.vsLine')" :key="i">
          <template v-if="typeof part === 'string'">{{ part }}</template>
          <span v-else-if="part.slot === 'mine'" v-tip="canHover && props.mineName" class="mon"
            ><PokemonIcon :id="props.mine" /><span class="visually-hidden">{{ props.mineName }}</span></span
          >
          <strong v-else-if="part.slot === 'a'" class="num">{{ props.mineSpeed }}</strong>
          <strong v-else-if="part.slot === 'verb'" class="verb" :class="verdict">{{
            t(`speed.vsVerb.${verdict}`)
          }}</strong>
          <AppLink
            v-else-if="part.slot === 'them'"
            v-tip="canHover && props.name"
            :to="{ name: 'metaPokemon', params: { id: props.id } }"
            class="mon"
            ><PokemonIcon :id="props.id" /><span class="visually-hidden">{{ props.name }}</span></AppLink
          >
          <button
            v-else-if="part.slot === 'b'"
            type="button"
            class="speed num"
            :aria-label="t('speed.vsLocate')"
            @click="emit('locate')"
          >
            {{ props.speed }}
          </button>
          <template v-else-if="part.slot === 'plan'">{{ plan }}</template>
        </template>
      </p>
      <button type="button" class="btn close" :aria-label="t('speed.vsClose')" @click="emit('close')">
        <X :size="18" aria-hidden="true" />
      </button>
    </div>
    <!-- Its chip on the ladder, found; and to the comparison's own page, a button that stands out, its arrow saying it
         goes there: on one line, one under the other when they don't fit. -->
    <div class="actions">
      <button type="button" class="btn show-link" :aria-label="t('speed.vsLocate')" @click="emit('locate')">
        <span class="long">{{ t('speed.vsShowLong') }}</span
        ><span class="short">{{ t('speed.vsShow') }}</span>
      </button>
      <AppLink :to="props.compareTo" class="btn primary compare-link"
        ><Columns2 :size="16" aria-hidden="true" />{{ t('speed.vsCompare') }}<ArrowRight :size="16" aria-hidden="true"
      /></AppLink>
    </div>
  </section>
</template>

<style scoped>
.versus-card {
  margin: 0;
}
.small {
  font-size: 0.875em;
}
.head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.line {
  flex: 1;
  min-width: 0;
  margin: 0;
  line-height: 1.9;
}
/* A Pokémon, as its icon: on the line, centered on its text. */
.mon {
  display: inline-block;
  vertical-align: middle;
  line-height: 0;
}
.mon :deep(.sheet-icon) {
  margin-block: -6px;
}
.num {
  font-variant-numeric: tabular-nums;
}
/* Whether yours moves first, in the color of how it goes for it. */
.verb.after {
  color: var(--opponent);
}
.verb.tie {
  color: var(--muted);
}
/* Its Speed, which finds its chip on the ladder: underlined as a link is, dotted as what shows rather than goes. */
.speed {
  padding: 0;
  font: inherit;
  font-weight: bold;
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
/* Close: the icon alone, with no fill or outline. */
:root:root .versus-card .btn.close {
  flex: none;
  margin: -4px -4px 0 0;
  padding: 4px;
  color: var(--muted);
  background: none;
  border-color: transparent;
  box-shadow: none;
}
:root:root .versus-card .btn.close:hover {
  color: var(--text);
}
/* The two on a line, halves alike, Show's long label where its half has room for it (a phone's width but the narrowest);
   one under the other when they don't fit (a longer language's). */
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
  container-type: inline-size;
}
.actions > .btn {
  flex: 1 1 0;
  min-width: max-content;
  justify-content: center;
}
.show-link .long {
  display: none;
}
@container (min-width: 320px) {
  .show-link .long {
    display: inline;
  }
  .show-link .short {
    display: none;
  }
}
.compare-link {
  gap: 6px;
  font-weight: bold;
}
.compare-link:hover {
  text-decoration: none;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
