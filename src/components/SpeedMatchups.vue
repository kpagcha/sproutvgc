<script setup lang="ts">
import { computed } from 'vue'
import type { PokemonId } from '@/data/dex'
import { t } from '@/i18n'
import { toMoveFirst, type SpeedBuild } from '@/lib/speedBuild'
import { movesBefore } from '@/lib/speedLineup'
import PokemonIcon from '@/components/PokemonIcon'
import SpeedAgainst from '@/components/SpeedAgainst.vue'

// Past a pair, how yours do against the opponents: a grid of every one of yours against every opponent, each cell
// saying which moves first (and by how much Speed), with how many your side wins in all; a cell tapped, the two alone
// (`pair`): which moves first, and what each takes to move before the other. Against two opponents, what each of yours
// takes to move before both: before the one that moves first of them.
interface Mon {
  key: string
  id: PokemonId
  name: string
  speed: number
  build: SpeedBuild
}
const props = defineProps<{
  yours: readonly Mon[]
  opponents: readonly Mon[]
  trickRoom: boolean
  /** The two tapped, by their keys: yours, then the opponent. */
  pair: readonly [string, string] | null
}>()
const emit = defineEmits<{ pair: [pair: [string, string] | null] }>()

// Who moves first, on a cell's hover; on touch screens a tap shows the two alone instead.
const canHover = window.matchMedia('(hover: hover)').matches
const outcome = (y: Mon, o: Mon) => movesBefore(y.speed, o.speed, props.trickRoom)
const KIND = { 1: 'first', 0: 'tie', [-1]: 'after' } as const
const cellText = (y: Mon, o: Mon) => t(`compare.cell.${KIND[outcome(y, o)]}`)
const cellTip = (y: Mon, o: Mon) => {
  const r = outcome(y, o)
  return r === 0 ? t('compare.tie') : t('compare.first', { name: r > 0 ? y.name : o.name })
}
const diff = (y: Mon, o: Mon) => {
  const d = y.speed - o.speed
  return d > 0 ? `+${d}` : d < 0 ? `−${-d}` : '±0'
}
const won = computed(() => props.yours.flatMap((y) => props.opponents.filter((o) => outcome(y, o) > 0)).length)

const picked = computed(() => {
  if (!props.pair) return null
  const y = props.yours.find((m) => m.key === props.pair![0])
  const o = props.opponents.find((m) => m.key === props.pair![1])
  return y && o ? { y, o, r: outcome(y, o) } : null
})
const isPicked = (y: Mon, o: Mon) => picked.value?.y === y && picked.value.o === o
const tap = (y: Mon, o: Mon) => emit('pair', isPicked(y, o) ? null : [y.key, o.key])

const against = (me: Mon, them: Mon) => toMoveFirst(me.id, me.build, them.speed, props.trickRoom)
/** Of the opponents, the one to beat to move before both: the one that moves first. */
const toBeat = computed(() =>
  props.opponents.length < 2
    ? null
    : props.opponents.reduce((a, b) => (movesBefore(b.speed, a.speed, props.trickRoom) > 0 ? b : a)),
)
</script>

<template>
  <section class="panel matchups">
    <h2 class="heading">
      {{ t('compare.matchups') }}
      <span class="muted won">{{ t('compare.won', { n: won, total: yours.length * opponents.length }) }}</span>
    </h2>
    <div class="grid" :style="{ '--cols': opponents.length }" role="grid">
      <span class="corner" aria-hidden="true" />
      <span v-for="o in opponents" :key="o.key" class="head opponent" role="columnheader"
        ><PokemonIcon :id="o.id" /><span class="visually-hidden">{{ o.name }}</span
        >{{ o.speed }}</span
      >
      <template v-for="y in yours" :key="y.key">
        <span class="head yours" role="rowheader"
          ><PokemonIcon :id="y.id" /><span class="visually-hidden">{{ y.name }}</span
          >{{ y.speed }}</span
        >
        <button
          v-for="o in opponents"
          :key="o.key"
          v-tip="canHover && cellTip(y, o)"
          type="button"
          class="cell"
          :class="[KIND[outcome(y, o)], { on: isPicked(y, o) }]"
          :aria-pressed="isPicked(y, o)"
          :aria-label="`${y.name} vs ${o.name}: ${cellTip(y, o)}`"
          @click="tap(y, o)"
        >
          {{ cellText(y, o) }}<span class="diff">{{ diff(y, o) }}</span>
        </button>
      </template>
    </div>

    <!-- The two tapped, alone. -->
    <div v-if="picked" class="pair">
      <p class="verdict" :class="KIND[picked.r]">
        <PokemonIcon v-if="picked.r" :id="picked.r > 0 ? picked.y.id : picked.o.id" />
        <span class="verdict-text">{{
          picked.r === 0 ? t('compare.tie') : t('compare.first', { name: picked.r > 0 ? picked.y.name : picked.o.name })
        }}</span>
        <span class="verdict-speeds">{{ picked.y.speed }} <span class="muted">vs</span> {{ picked.o.speed }}</span>
      </p>
      <div class="cards">
        <section class="card yours">
          <SpeedAgainst
            :title="t('compare.against', { name: picked.o.name, speed: picked.o.speed })"
            :rows="against(picked.y, picked.o)"
            :current="picked.y.build.effect"
            banded
          />
        </section>
        <section class="card opponent">
          <SpeedAgainst
            :title="t('compare.against', { name: picked.y.name, speed: picked.y.speed })"
            :rows="against(picked.o, picked.y)"
            :current="picked.o.build.effect"
            banded
          />
        </section>
      </div>
    </div>
    <p v-else class="muted small hint">{{ t('compare.pairHint') }}</p>
  </section>

  <!-- Against two opponents, what each of yours takes to move before both. -->
  <section v-if="toBeat" class="panel both">
    <h2 class="heading">{{ t('compare.both') }}</h2>
    <div class="cards">
      <section v-for="y in yours" :key="y.key" class="card yours">
        <SpeedAgainst
          :title="t('compare.bothOf', { name: y.name, other: toBeat.name, speed: toBeat.speed })"
          :rows="against(y, toBeat)"
          :current="y.build.effect"
          banded
        />
      </section>
    </div>
  </section>
</template>

<style scoped>
.panel {
  margin-bottom: 12px;
}
.heading {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
  margin: 0 0 10px;
  font-size: 1.1em;
}
.won {
  font-size: 0.8em;
  font-weight: normal;
}
/* Yours down its side, the opponents across its top, each cell one against the other. */
.grid {
  display: grid;
  grid-template-columns: max-content repeat(var(--cols), minmax(0, 1fr));
  gap: 4px;
  max-width: 520px;
}
/* Each one's icon whole inside its header. */
.head {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 40px;
  padding: 2px 8px;
  font-weight: bold;
  font-variant-numeric: tabular-nums;
  border: 2px solid var(--ink);
}
.head.yours {
  color: var(--accent-text);
  background: var(--accent);
}
.head.opponent {
  color: var(--opponent-text);
  background: var(--opponent);
}
.cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 2px 4px;
  font: inherit;
  font-weight: bold;
  border: 2px solid var(--ink);
  box-shadow: var(--hard-sm);
  cursor: pointer;
  touch-action: manipulation;
}
.cell.first {
  color: var(--m2-fg);
  background: var(--m2-bg);
}
.cell.after {
  color: var(--m0-fg);
  background: var(--m0-bg);
}
.cell.tie {
  color: var(--m05-fg);
  background: var(--m05-bg);
}
.cell.on {
  outline: 3px solid var(--ink);
  outline-offset: 1px;
  box-shadow: none;
  transform: translate(2px, 2px);
}
.diff {
  font-size: 0.8em;
  font-weight: normal;
  font-variant-numeric: tabular-nums;
}
.pair {
  margin-top: 14px;
}
.verdict {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 10px;
  padding: 6px 10px;
  font-weight: bold;
  border: 2px solid var(--ink);
}
.verdict-text {
  flex: 1;
  min-width: 0;
}
.verdict-speeds {
  flex: none;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.verdict.first {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}
.verdict.after {
  outline: 3px solid var(--opponent);
  outline-offset: 2px;
}
.verdict.tie {
  outline: 3px solid var(--muted);
  outline-offset: 2px;
}
/* What each takes, side by side, under a band of its team's color. */
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 150px), 1fr));
  gap: 8px;
}
@media (min-width: 721px) {
  .cards {
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    max-width: 720px;
  }
  .verdict {
    max-width: 720px;
  }
}
.card {
  --side: var(--accent);
  --side-text: var(--accent-text);
  display: flex;
  flex-direction: column;
  border: 2px solid var(--ink);
  box-shadow: var(--hard-sm);
}
.card.opponent {
  --side: var(--opponent);
  --side-text: var(--opponent-text);
}
.hint {
  margin: 10px 0 0;
}
.small {
  font-size: 0.875em;
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
