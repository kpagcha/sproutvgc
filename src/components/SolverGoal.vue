<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { Check, X } from '@lucide/vue'
import { pokemon, type PokemonId } from '@/data/dex'
import { locale, t } from '@/i18n'
import { refName } from '@/i18n/refName'
import type { OpponentUnknowns } from '@/lib/damageReverse'
import PokemonIcon from '@/components/PokemonIcon'
import StepBack from '@/components/StepBack.vue'

// The damage solver's setup, its third step: what it works out of each side, and so what's left to set. A choice of
// the usual goals (its spread, its build, what yours needs), each saying what it's for, or, part by part, a grid of
// the two sides; under them what you'll set and what you'll get, in plain words naming the two.
const props = defineProps<{
  yours: PokemonId
  theirs: PokemonId
  /** Whether a side's item is fixed (a Mega's stone, Ogerpon's mask), never worked out. */
  fixed: { a: boolean; b: boolean }
  canBack?: boolean
}>()
const work = defineModel<OpponentUnknowns>('work', { required: true })
const workYours = defineModel<OpponentUnknowns>('workYours', { required: true })
const emit = defineEmits<{ next: []; back: []; close: [] }>()

type Part = keyof OpponentUnknowns
type Side = 'a' | 'b'
const PARTS: readonly Part[] = ['nature', 'item', 'points']
const NONE: OpponentUnknowns = { nature: false, item: false, points: false }
const ALL: OpponentUnknowns = { nature: true, item: true, points: true }

const GOALS = {
  spread: { a: NONE, b: { nature: false, item: false, points: true } },
  build: { a: NONE, b: ALL },
  need: { a: { nature: true, item: false, points: true }, b: ALL },
} as const
type Goal = keyof typeof GOALS | 'custom'

// A side's work as it'll be read: its item not, where it can't be anything else.
const norm = (w: OpponentUnknowns, s: Side): OpponentUnknowns => ({ ...w, item: w.item && !props.fixed[s] })
const same = (x: OpponentUnknowns, y: OpponentUnknowns) => PARTS.every((p) => x[p] === y[p])
const matches = (g: keyof typeof GOALS) =>
  same(norm(workYours.value, 'a'), norm(GOALS[g].a, 'a')) && same(norm(work.value, 'b'), norm(GOALS[g].b, 'b'))
/** The custom grid kept open once picked, even when what's set there is one of the goals. */
const customPicked = shallowRef(false)
const goal = computed<Goal>(() => {
  if (customPicked.value) return 'custom'
  return (['spread', 'build', 'need'] as const).find(matches) ?? 'custom'
})
function choose(g: Goal) {
  customPicked.value = g === 'custom'
  if (g === 'custom') return
  workYours.value = { ...GOALS[g].a }
  work.value = { ...GOALS[g].b }
}
function toggle(s: Side, p: Part, on: boolean) {
  if (s === 'a') workYours.value = { ...workYours.value, [p]: on }
  else work.value = { ...work.value, [p]: on }
}
const workOf = (s: Side) => norm(s === 'a' ? workYours.value : work.value, s)

const CARDS = [
  { value: 'spread', title: 'calc.goal.spread', about: 'calc.goal.spreadAbout' },
  { value: 'build', title: 'calc.goal.build', about: 'calc.goal.buildAbout' },
  { value: 'need', title: 'calc.goal.need', about: 'calc.goal.needAbout' },
  { value: 'custom', title: 'calc.goal.custom', about: 'calc.goal.customAbout' },
] as const
/** What a goal works out, as the icons and parts on its card. */
const worksOut = (g: Goal) => {
  if (g === 'custom') return []
  return (['a', 'b'] as const).flatMap((s) => {
    const w = norm(GOALS[g][s], s)
    const parts = PARTS.filter((p) => w[p])
    return parts.length ? [{ side: s, id: s === 'a' ? props.yours : props.theirs, parts }] : []
  })
}

const partName = (p: Part) => t(p === 'nature' ? 'builder.nature' : p === 'item' ? 'builder.item' : 'builder.points')
const list = (xs: string[]) => new Intl.ListFormat(locale.value).format(xs)
const nameOf = (s: Side) => refName(pokemon(s === 'a' ? props.yours : props.theirs))

/** What's left to set: each side's parts not worked out, and its ability. */
const youSet = computed(() =>
  (['a', 'b'] as const).map((s) => {
    const w = workOf(s)
    const parts = PARTS.filter((p) => !w[p] && !(p === 'item' && props.fixed[s])).map((p) => partName(p).toLowerCase())
    parts.push(t('calc.goal.abilityMoves'))
    return { side: s, text: list(parts) }
  }),
)
/** What comes out: the opponent's parts with how likely each is; yours, the fewest points that do it. */
const youGet = computed(() =>
  (['b', 'a'] as const).flatMap((s) => {
    const w = workOf(s)
    const parts = PARTS.filter((p) => w[p]).map((p) => partName(p).toLowerCase())
    if (!parts.length) return []
    const how = s === 'b' ? 'calc.goal.getLikely' : w.points ? 'calc.goal.getNeed' : 'calc.goal.getNeedItem'
    return [{ side: s, text: list(parts), how: t(how) }]
  }),
)
const nothing = computed(() => !youGet.value.length)

const STEPS = ['calc.flow.yours', 'calc.flow.theirs', 'calc.flow.goal', 'calc.flow.known', 'calc.flow.hits'] as const
const AT = 2
</script>

<template>
  <div class="goal">
    <div class="head">
      <StepBack v-if="canBack" @back="emit('back')" />
      <!-- Where the setup's at: the steps done ticked, this one marked. -->
      <ol class="steps" :aria-label="t('calc.flow.steps')">
        <li v-for="(s, i) in STEPS" :key="s" :class="{ done: i < AT, at: i === AT }">
          <span class="dot"
            ><Check v-if="i < AT" :size="12" aria-hidden="true" /><template v-else>{{ i + 1 }}</template></span
          ><span class="label">{{ t(s) }}</span>
        </li>
      </ol>
      <button type="button" class="close" :aria-label="t('calc.hits.close')" @click="emit('close')">
        <X :size="20" aria-hidden="true" />
      </button>
    </div>

    <h2 class="title">
      <PokemonIcon :id="yours" /><span class="vs muted">vs</span><PokemonIcon :id="theirs" />{{ t('calc.goal.title') }}
    </h2>
    <p class="muted intro">{{ t('calc.goal.intro') }}</p>

    <div class="cards" role="radiogroup" :aria-label="t('calc.goal.title')">
      <label v-for="c in CARDS" :key="c.value" class="card" :class="{ on: goal === c.value }">
        <input
          type="radio"
          name="solver-goal"
          :value="c.value"
          :checked="goal === c.value"
          class="radio"
          @change="choose(c.value)"
        />
        <span class="card-title">{{ t(c.title) }}</span>
        <span class="card-about muted">{{ t(c.about) }}</span>
        <span v-if="worksOut(c.value).length" class="card-parts">
          <span v-for="w in worksOut(c.value)" :key="w.side" class="part-group" :class="`side-${w.side}`">
            <PokemonIcon :id="w.id" :scale="0.75" />
            <span v-for="p in w.parts" :key="p" class="worked">{{ partName(p) }}</span>
          </span>
        </span>
      </label>
    </div>

    <!-- Part by part: a row per part, a column per side, each cell worked out or set. -->
    <table v-if="goal === 'custom'" class="grid">
      <thead>
        <tr>
          <th />
          <th v-for="s in ['a', 'b'] as const" :key="s" :class="`side-${s}`">
            <PokemonIcon :id="s === 'a' ? yours : theirs" :scale="0.75" />{{
              t(s === 'a' ? 'calc.yours' : 'calc.theirs')
            }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in PARTS" :key="p">
          <th scope="row">{{ partName(p) }}</th>
          <td v-for="s in ['a', 'b'] as const" :key="s">
            <span class="seg" :class="{ fixed: p === 'item' && fixed[s] }">
              <button
                type="button"
                :class="{ on: workOf(s)[p] }"
                :disabled="p === 'item' && fixed[s]"
                @click="toggle(s, p, true)"
              >
                {{ t('calc.goal.workOut') }}</button
              ><button type="button" :class="{ on: !workOf(s)[p] }" @click="toggle(s, p, false)">
                {{ t('calc.goal.set') }}
              </button>
            </span>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- What it comes to, in plain words. -->
    <div class="sum">
      <div class="sum-col">
        <h3>{{ t('calc.goal.youSet') }}</h3>
        <ul>
          <li v-for="x in youSet" :key="x.side">
            <PokemonIcon :id="x.side === 'a' ? yours : theirs" :scale="0.75" /><span
              ><b>{{ nameOf(x.side) }}</b
              >: {{ x.text }}</span
            >
          </li>
          <li class="then muted">{{ t('calc.goal.then') }}</li>
        </ul>
      </div>
      <div class="sum-col get">
        <h3>{{ t('calc.goal.youGet') }}</h3>
        <p v-if="nothing" class="warn">{{ t('calc.goal.nothing') }}</p>
        <ul v-else>
          <li v-for="x in youGet" :key="x.side">
            <PokemonIcon :id="x.side === 'a' ? yours : theirs" :scale="0.75" /><span
              ><b>{{ nameOf(x.side) }}</b
              >: {{ x.text }}, <span class="muted">{{ x.how }}</span></span
            >
          </li>
        </ul>
      </div>
    </div>

    <div class="foot">
      <button type="button" class="btn primary" :disabled="nothing" @click="emit('next')">
        {{ t('calc.flow.next', { step: t('calc.flow.known') }) }} →
      </button>
    </div>
  </div>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.steps {
  flex: 1;
  display: flex;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
  min-width: 0;
}
.steps li {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75em;
  color: var(--muted);
  white-space: nowrap;
}
.steps li + li::before {
  content: '';
  width: 10px;
  height: 1px;
  background: var(--border);
}
.steps .dot {
  display: inline-grid;
  place-items: center;
  width: 18px;
  height: 18px;
  font-size: 0.875em;
  font-weight: bold;
  border: 1px solid var(--border);
}
.steps .done .dot {
  color: var(--accent-text);
  background: var(--accent);
  border-color: var(--ink);
}
.steps .at {
  color: var(--text);
  font-weight: bold;
}
.steps .at .dot {
  border: 2px solid var(--ink);
  background: var(--sel);
}
/* Only the step being read named where they don't fit. */
@media (max-width: 520px) {
  .steps li:not(.at) .label {
    display: none;
  }
}
.close {
  display: inline-flex;
  padding: 4px;
  color: var(--muted);
  background: none;
  border: 0;
  cursor: pointer;
}
.title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
  margin: 0;
  font-size: calc(15px * var(--display-scale, 1) * var(--text-scale));
}
.title .vs {
  font-size: 0.75em;
  margin: 0 2px;
}
.title :deep(.pokemon-icon:last-of-type) {
  margin-right: 6px;
}
.intro {
  margin: 6px 0 12px;
  font-size: 0.875em;
}
.cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
@media (max-width: 420px) {
  .cards {
    grid-template-columns: 1fr;
  }
}
.card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
  background: var(--panel);
  border: 1px solid var(--border);
  cursor: pointer;
}
.radio {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.card:hover {
  border-color: var(--ink);
}
.card.on {
  background: var(--sel);
  border: 2px solid var(--ink);
  padding: 9px;
  box-shadow: 3px 3px 0 var(--ink);
}
.card:focus-within {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.card-title {
  font-weight: bold;
}
.card-about {
  font-size: 0.8125em;
  line-height: 1.35;
}
.card-parts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: auto;
  padding-top: 4px;
}
.part-group {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 3px;
}
.worked {
  padding: 0 5px;
  font-size: 0.75em;
  border: 1px dashed var(--ink);
  background: var(--panel);
}
.side-a .worked {
  border-color: var(--accent);
}
.side-b .worked {
  border-color: var(--opponent);
}
.grid {
  width: 100%;
  margin-top: 10px;
  border-collapse: collapse;
  font-size: 0.875em;
}
.grid th,
.grid td {
  padding: 4px 6px;
  text-align: left;
}
.grid thead th {
  font-size: 0.875em;
  border-bottom: 2px solid var(--ink);
}
.grid thead th.side-a {
  color: var(--accent);
}
.grid thead th.side-b {
  color: var(--opponent);
}
.grid tbody tr + tr {
  border-top: 1px solid var(--border);
}
.seg {
  display: inline-flex;
  border: 1px solid var(--ink);
}
.seg button {
  padding: 2px 8px;
  font: inherit;
  font-size: 0.875em;
  color: var(--muted);
  background: var(--panel);
  border: 0;
  cursor: pointer;
}
.seg button + button {
  border-left: 1px solid var(--ink);
}
.seg button.on {
  color: var(--text);
  font-weight: bold;
  background: var(--sel);
}
.seg button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.sum {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 14px;
  padding: 10px 12px;
  background: var(--panel-alt, var(--bg));
  border: 1px solid var(--border);
}
@media (max-width: 420px) {
  .sum {
    grid-template-columns: 1fr;
  }
}
.sum h3 {
  margin: 0 0 6px;
  font-size: 0.75em;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}
.sum ul {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.875em;
}
.sum li {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  line-height: 1.35;
}
.sum .then {
  font-size: 0.9em;
  padding-left: 2px;
}
.warn {
  margin: 0;
  font-size: 0.875em;
  color: var(--bad);
}
.foot {
  position: sticky;
  bottom: calc(-1 * var(--panel-pad));
  display: flex;
  justify-content: flex-end;
  margin: 14px calc(-1 * var(--panel-pad)) calc(-1 * var(--panel-pad));
  padding: 10px var(--panel-pad);
  background: var(--panel);
  border-top: 1px solid var(--border);
}
</style>
