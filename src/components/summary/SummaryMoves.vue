<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { move, type MoveId } from '@/data/dex'
import { MOVES, isSpread } from '@/data/moves'
import { TYPES } from '@/data/types'
import { locale, t } from '@/i18n'
import { description } from '@/i18n/descriptions'
import { refName } from '@/i18n/refName'
import { fold } from '@/lib/search'
import CategoryIcon from '@/components/CategoryIcon'
import DexRef from '@/components/DexRef'
import DexText from '@/components/DexText'
import MoveTable from '@/components/MoveTable.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import TypeIcon from '@/components/TypeIcon'

// The summary's moves page. Where the games' summary has its four moves, a moveset of up to four, picked from the
// whole learnset below it (as plates, by type, or as the moves table); whichever plate is picked shows its details
// beside them, as the games do.
const props = defineProps<{ ids: readonly MoveId[] | null }>()
const moveset = defineModel<MoveId[]>('moveset', { required: true })
const SLOTS = 4

const view = ref<'plates' | 'table'>('plates')
const query = ref('')
const picked = ref<MoveId | null>(null)
// Another Pokémon (one of the family, from the card) starts from its own moves.
watch(
  () => props.ids,
  () => (picked.value = null),
)

const typeOrder = Object.fromEntries(TYPES.map((ty, i) => [ty, i]))
const all = computed(() =>
  (props.ids ?? [])
    .map((id) => ({ id, name: refName(move(id)), data: MOVES[id] }))
    .sort((a, b) => typeOrder[a.data.type]! - typeOrder[b.data.type]! || a.name.localeCompare(b.name, locale.value)),
)
const shown = computed(() => {
  const q = fold(query.value.trim())
  return q ? all.value.filter((m) => fold(m.name).includes(q)) : all.value
})
const slots = computed(() => Array.from({ length: SLOTS }, (_, i) => moveset.value[i] ?? null))

// The move whose details show: the one last picked, else the moveset's first, else the learnset's.
const current = computed(() => picked.value ?? moveset.value[0] ?? all.value[0]?.id ?? null)
const data = computed(() => (current.value ? MOVES[current.value] : null))
const inSet = computed(() => !!current.value && moveset.value.includes(current.value))

function toggle(id: MoveId) {
  if (moveset.value.includes(id)) moveset.value = moveset.value.filter((m) => m !== id)
  else if (moveset.value.length < SLOTS) moveset.value = [...moveset.value, id]
}
// On phones the details sit above the lists, so picking a plate far down brings them into view.
const detail = ref<HTMLElement | null>(null)
function pick(id: MoveId) {
  picked.value = id
  if (!window.matchMedia('(max-width: 760px)').matches) return
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  void nextTick(() => detail.value?.scrollIntoView({ block: 'nearest', behavior: smooth ? 'smooth' : 'auto' }))
}
const priority = (p: number) => (p > 0 ? `+${p}` : String(p))
</script>

<template>
  <div class="moves">
    <div class="lists">
      <section>
        <h3 class="slot-head">{{ t('summary.moveset') }}</h3>
        <ol class="moveset">
          <li v-for="(id, i) in slots" :key="id ?? `empty-${i}`">
            <button
              v-if="id"
              type="button"
              class="plate"
              :class="{ cur: id === current }"
              :data-type="MOVES[id].type"
              @click="pick(id)"
            >
              <TypeIcon :type="MOVES[id].type" />
              <span class="name">{{ refName(move(id)) }}</span>
              <span class="pp num">{{ t('move.pp') }} {{ MOVES[id].pp }}/{{ MOVES[id].pp }}</span>
            </button>
            <span v-else class="plate empty">
              <span class="name">—</span>
              <span class="pp num">{{ t('move.pp') }} --</span>
            </span>
          </li>
        </ol>
      </section>

      <section class="learnset">
        <div class="learn-head">
          <h3 class="slot-head">{{ t('summary.learnset', { n: all.length }) }}</h3>
          <SegmentedControl
            v-model="view"
            :label="t('summary.view')"
            :options="[
              { value: 'plates', label: t('summary.plates') },
              { value: 'table', label: t('summary.table') },
            ]"
          />
        </div>
        <template v-if="view === 'plates'">
          <input
            v-model="query"
            class="search"
            type="search"
            :placeholder="t('pokemon.searchMoves')"
            :aria-label="t('pokemon.searchMoves')"
          />
          <ul class="plates">
            <li v-for="m in shown" :key="m.id">
              <button
                type="button"
                class="plate"
                :class="{ cur: m.id === current, set: moveset.includes(m.id) }"
                :data-type="m.data.type"
                :aria-pressed="m.id === current"
                @click="pick(m.id)"
                @dblclick="toggle(m.id)"
              >
                <TypeIcon :type="m.data.type" />
                <span class="name">{{ m.name }}</span>
                <CategoryIcon :category="m.data.category" :tip="false" />
              </button>
            </li>
          </ul>
          <p v-if="ids && !shown.length" class="muted">{{ t('moves.none') }}</p>
        </template>
        <MoveTable v-else-if="ids" :ids="ids" descriptions :placeholder="t('pokemon.searchMoves')" />
      </section>
    </div>

    <!-- The details, as in the games' move description screen. -->
    <aside v-if="current && data" ref="detail" class="detail" :data-type="data.type">
      <div class="detail-head">
        <TypeIcon :type="data.type" :scale="2" />
        <CategoryIcon :category="data.category" :scale="2" />
      </div>
      <h3 class="detail-name"><DexRef :to="move(current)" /></h3>
      <dl class="facts">
        <dt>{{ t('move.power') }}</dt>
        <dd class="num">{{ data.power || '—' }}</dd>
        <dt>{{ t('move.accuracy') }}</dt>
        <dd class="num">{{ data.accuracy === true ? '—' : `${data.accuracy}%` }}</dd>
        <dt>{{ t('move.pp') }}</dt>
        <dd class="num">{{ data.pp }}</dd>
        <template v-if="data.priority">
          <dt>{{ t('move.priority') }}</dt>
          <dd class="num">{{ priority(data.priority) }}</dd>
        </template>
        <dt>{{ t('move.target') }}</dt>
        <dd>
          {{ t(`move.target.${data.target}`)
          }}<span v-if="isSpread(data)" v-tip="t('move.spread')" class="spread"> 0.75×</span>
        </dd>
      </dl>
      <p class="desc"><DexText :text="description('move', current)?.short ?? ''" /></p>
      <button
        type="button"
        class="btn"
        :class="{ primary: !inSet }"
        :disabled="!inSet && moveset.length >= SLOTS"
        @click="toggle(current)"
      >
        {{ inSet ? t('summary.remove') : moveset.length >= SLOTS ? t('summary.full') : t('summary.add') }}
      </button>
    </aside>
  </div>
</template>

<style scoped>
.moves {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(220px, 280px);
  gap: 16px;
  align-items: start;
}
.lists {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}
.slot-head {
  margin: 0 0 6px;
  font-size: 0.8em;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.moveset,
.plates {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.moveset {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.plates {
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  max-height: 420px;
  overflow-y: auto;
  padding: 3px 6px 6px 3px;
}
/* A move as the games' battle-move plates: its type's color down the side, the name, its PP or category. */
.plate {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 34px;
  padding: 4px 8px 4px 4px;
  border: 2px solid var(--ink);
  border-left: 6px solid var(--tc, var(--border));
  background: color-mix(in srgb, var(--tc, var(--border)) 14%, var(--panel));
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.plate:hover {
  background: color-mix(in srgb, var(--tc, var(--border)) 26%, var(--panel));
}
.plate .name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: bold;
}
.plate .pp {
  font-size: 0.8em;
  color: var(--muted);
}
/* The games' red cursor. */
.plate.cur {
  outline: 3px solid var(--bad);
  outline-offset: 1px;
}
.plate.set {
  box-shadow: inset 0 -3px 0 var(--tc);
}
.plate.set .name::after {
  content: ' ●';
  color: var(--tc);
}
.plate.empty {
  border-style: dashed;
  border-left-width: 2px;
  background: none;
  color: var(--muted);
  cursor: default;
  justify-content: space-between;
}
.plate.empty .name {
  flex: none;
}
.learn-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.search {
  width: 100%;
  margin-bottom: 8px;
}
.detail {
  position: sticky;
  top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border: 2px solid var(--ink);
  border-top: 8px solid var(--tc);
  background: var(--panel-alt);
}
.detail-head {
  display: flex;
  gap: 6px;
  align-items: center;
}
.detail-name {
  margin: 0;
  font-size: 1.15em;
}
.facts {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 3px 10px;
  margin: 0;
}
.facts dt {
  padding: 0 6px;
  background: var(--summary-tint);
  color: var(--summary-on-tint);
  font-size: 0.8em;
  font-weight: bold;
  text-transform: uppercase;
  align-self: center;
}
.facts dd {
  margin: 0;
}
.spread {
  margin-left: 4px;
  color: var(--muted);
}
/* The description on ruled lines, as the games print it. */
.desc {
  margin: 0;
  line-height: 1.6;
  background: repeating-linear-gradient(
    to bottom,
    transparent 0,
    transparent calc(1.6em - 1px),
    var(--border) calc(1.6em - 1px),
    var(--border) 1.6em
  );
}
@media (max-width: 760px) {
  .moves {
    grid-template-columns: minmax(0, 1fr);
  }
  /* On phones the details come first. */
  .detail {
    position: static;
    order: -1;
  }
}
@media (max-width: 420px) {
  .moveset {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
