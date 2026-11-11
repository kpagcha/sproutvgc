<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { X } from '@lucide/vue'
import { move, type MoveId } from '@/data/dex'
import type { MetaData } from '@/data/meta'
import { MOVES } from '@/data/moves'
import { loadLearnsets, movesOf } from '@/data/pokemon'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { MOVE_SLOTS, setsAs, type Member } from '@/lib/team'
import MoveTable from '@/components/MoveTable.vue'
import PokemonIcon from '@/components/PokemonIcon'

// The inverse damage calc's drawer, its first step: the opponent's moves seen, picked from its movepool (its sets'
// first, by share), a tap adding one or, picked, taking it off. Those picked are chips over the list, with the way on to
// what was seen (`continue`) whenever, with none or some; the last of the set's slots filled, it goes on by itself.
const props = defineProps<{ member: Member; data: MetaData | null }>()
const emit = defineEmits<{ moves: [moves: (MoveId | null)[]]; continue: []; close: [] }>()

const MOVE_KINDS = ['type', 'category', 'flag', 'reach', 'priority'] as const
const learnset = shallowRef<MoveId[] | null>(null)
watch(
  () => props.member.pokemon,
  async (id) => {
    learnset.value = null
    if (!id) return
    const all = await loadLearnsets()
    if (props.member.pokemon === id) learnset.value = movesOf(all, id)
  },
  { immediate: true },
)
const sets = computed(() => {
  const id = setsAs(props.member)
  return id ? (props.data?.[id] ?? props.data?.[props.member.pokemon!]) : undefined
})
const shares = computed(
  () => Object.fromEntries((sets.value?.moves ?? []).map((x) => [x.id, x.share])) as Partial<Record<MoveId, number>>,
)
const ids = computed(() => {
  const used = (sets.value?.moves ?? []).map((x) => x.id).filter((x) => MOVES[x])
  const seen = new Set(used)
  return [...used, ...(learnset.value ?? []).filter((x) => !seen.has(x) && MOVES[x])]
})
const picked = computed(() => props.member.moves.filter((x): x is MoveId => !!x))
const slots = (list: MoveId[]) => Array.from({ length: MOVE_SLOTS }, (_, i) => list[i] ?? null)
function toggle(id: MoveId) {
  const now = picked.value.includes(id) ? picked.value.filter((x) => x !== id) : [...picked.value, id]
  if (now.length > MOVE_SLOTS) return
  emit('moves', slots(now))
  if (now.length === MOVE_SLOTS) emit('continue')
}
</script>

<template>
  <div class="moves-seen">
    <div class="head">
      <h2><PokemonIcon v-if="member.pokemon" :id="member.pokemon" />{{ t('calc.seen.moves') }}</h2>
      <button type="button" class="close" :aria-label="t('calc.hits.close')" @click="emit('close')">
        <X :size="20" aria-hidden="true" />
      </button>
    </div>
    <p class="muted hint">{{ t('calc.seen.movesHint', { n: MOVE_SLOTS }) }}</p>
    <!-- Those picked, each taken off by a tap, and the way on: stuck to the drawer's top as the list scrolls. -->
    <div class="bar">
      <span class="chips">
        <button
          v-for="mv in picked"
          :key="mv"
          type="button"
          class="chip"
          :aria-label="t('calc.seen.remove', { move: refName(move(mv)) })"
          @click="toggle(mv)"
        >
          {{ refName(move(mv)) }}<X :size="14" aria-hidden="true" />
        </button>
        <span class="muted count">{{ picked.length }}/{{ MOVE_SLOTS }}</span>
      </span>
      <button type="button" class="btn primary" @click="emit('continue')">{{ t('calc.seen.continue') }}</button>
    </div>
    <MoveTable :ids :shares :kinds="MOVE_KINDS" :pick="toggle" :picked under="—" descriptions stacked no-pp />
  </div>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.head h2 {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 0;
}
.close {
  display: inline-flex;
  padding: 4px;
  color: var(--muted);
  background: none;
  border: 0;
  cursor: pointer;
}
.close:hover {
  color: var(--text);
}
.hint {
  margin: 4px 0 10px;
  font-size: 0.875em;
}
/* Stuck to the top of the drawer (its scroller), over the list, across its padding. */
.bar {
  position: sticky;
  top: calc(-1 * var(--panel-pad));
  z-index: 3;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0 calc(-1 * var(--panel-pad)) 10px;
  padding: 8px var(--panel-pad);
  background: var(--panel);
  border-bottom: 1px solid var(--border);
}
.chips {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px 2px 8px;
  font: inherit;
  font-size: 0.875em;
  color: var(--text);
  background: var(--sel);
  border: 1px solid var(--ink);
  cursor: pointer;
}
.chip:hover {
  border-color: var(--bad);
}
.count {
  font-size: 0.875em;
  font-variant-numeric: tabular-nums;
}
</style>
