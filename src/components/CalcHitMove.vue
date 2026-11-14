<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { X } from '@lucide/vue'
import type { MoveId, PokemonId } from '@/data/dex'
import type { MetaData } from '@/data/meta'
import { MOVES } from '@/data/moves'
import { loadLearnsets, movesOf } from '@/data/pokemon'
import { t } from '@/i18n'
import { damaging } from '@/lib/damage'
import { setsAs, type Member } from '@/lib/team'
import MoveTable from '@/components/MoveTable.vue'
import PokemonIcon from '@/components/PokemonIcon'
import StepBack from '@/components/StepBack.vue'

// The inverse damage calc's drawer, a hit's move: the attacker's damaging moves, searched and filtered as the team
// builder's moves are (`MoveTable`): its set's a group of their own, then the rest it learns (as the table sorts them,
// by share at first); the hit's own marked. A tap picks it (`pick`).
const props = defineProps<{
  attacker: Member
  defender: PokemonId
  data: MetaData | null
  current: MoveId | null
  canBack?: boolean
}>()
const emit = defineEmits<{ pick: [id: MoveId]; close: []; back: [] }>()

const MOVE_KINDS = ['type', 'category', 'flag', 'reach', 'priority'] as const
const learnset = shallowRef<MoveId[] | null>(null)
watch(
  () => props.attacker.pokemon,
  async (id) => {
    learnset.value = null
    if (!id) return
    const all = await loadLearnsets()
    if (props.attacker.pokemon === id) learnset.value = movesOf(all, id)
  },
  { immediate: true },
)
const sets = computed(() => {
  const id = setsAs(props.attacker)
  return id ? (props.data?.[id] ?? props.data?.[props.attacker.pokemon!]) : undefined
})
const shares = computed(
  () => Object.fromEntries((sets.value?.moves ?? []).map((x) => [x.id, x.share])) as Partial<Record<MoveId, number>>,
)
const usable = (x: MoveId) => !!MOVES[x] && damaging(x)
/** Its set's damaging moves, a group of their own over the rest it learns. */
const own = computed(() => props.attacker.moves.filter((x): x is MoveId => !!x && usable(x)))
const ids = computed(() => {
  const used = (sets.value?.moves ?? []).map((x) => x.id)
  return [...new Set([...own.value, ...used, ...(learnset.value ?? [])])].filter(usable)
})
const groups = computed(() =>
  own.value.length
    ? [
        { label: t('calc.hits.setMoves'), ids: own.value },
        { label: t('calc.hits.otherMoves'), ids: ids.value.filter((x) => !own.value.includes(x)) },
      ]
    : undefined,
)
</script>

<template>
  <div class="hit-move">
    <div class="head">
      <StepBack v-if="canBack" @back="emit('back')" />
      <h2>
        <PokemonIcon v-if="attacker.pokemon" :id="attacker.pokemon" />→<PokemonIcon :id="defender" />{{
          t('calc.hits.move')
        }}
      </h2>
      <button type="button" class="close" :aria-label="t('calc.hits.close')" @click="emit('close')">
        <X :size="20" aria-hidden="true" />
      </button>
    </div>
    <MoveTable
      :ids
      :shares
      :kinds="MOVE_KINDS"
      :pick="(id) => emit('pick', id)"
      :current
      :groups
      under="—"
      descriptions
      stacked
      no-pp
    />
  </div>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}
.head h2 {
  flex: 1;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  font-size: calc(13px * var(--display-scale, 1) * var(--text-scale));
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
</style>
