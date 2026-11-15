<script setup lang="ts">
import { computed } from 'vue'
import { Plus } from '@lucide/vue'
import { t } from '@/i18n'
import { battlerOf, type Fighter } from '@/lib/damage'
import type { OpponentUnknowns } from '@/lib/damageReverse'
import type { Field } from '@/lib/team'
import SolverChips from '@/components/SolverChips.vue'

// The two sides in short, a band each in its side's color, side by side (on phones one under the other), stuck to
// the top: each its Pokémon and its set as chips (`SolverChips`), each a tap opening its picker step. A side with no
// Pokémon yet says so, a tap picking it.
const props = defineProps<{
  a: Fighter
  b: Fighter
  work: { a: OpponentUnknowns; b: OpponentUnknowns }
  fixed: { a: boolean; b: boolean }
  /** The side whose Pokémon is being picked. */
  picking?: 'a' | 'b' | null
  /** Phones': each its icon alone, its item its icon alone. */
  compact?: boolean
}>()
const emit = defineEmits<{ part: [side: 'a' | 'b', field: Field] }>()
const sides = computed(() =>
  (['a', 'b'] as const).map((k) => ({
    k,
    f: k === 'a' ? props.a : props.b,
    has: !!battlerOf(k === 'a' ? props.a : props.b),
  })),
)
</script>

<template>
  <div class="bands" role="group" :aria-label="t('calc.bands.label')">
    <div
      v-for="s in sides"
      :key="s.k"
      class="band"
      :class="[`band-${s.k}`, { empty: !s.has, picking: picking === s.k }]"
    >
      <SolverChips
        v-if="s.has"
        :fighter="s.f"
        :work="work[s.k]"
        :fixed="fixed[s.k]"
        :compact
        @part="emit('part', s.k, $event)"
      />
      <button
        v-else
        type="button"
        class="placeholder"
        :aria-pressed="picking === s.k"
        @click="emit('part', s.k, 'pokemon')"
      >
        <Plus :size="16" aria-hidden="true" />{{ t(s.k === 'a' ? 'compare.pickYours' : 'compare.pickOpponent') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.bands {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.band {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  height: 44px;
  padding: 0 8px 0 4px;
  color: var(--accent-text);
  background: var(--accent);
  border: 2px solid var(--ink);
  box-shadow: 3px 3px 0 var(--ink);
}
.band-b {
  color: var(--opponent-text);
  background: var(--opponent);
}
/* No Pokémon yet: the band's outline alone, dashed, in its side's color; the one being picked solid. */
.band.empty {
  color: var(--muted);
  background: var(--panel);
  border-style: dashed;
  box-shadow: none;
}
.band.empty.picking {
  color: var(--text);
  border-style: solid;
  box-shadow: 3px 3px 0 var(--ink);
}
.band-a.empty.picking {
  border-color: var(--accent);
}
.band-b.empty.picking {
  border-color: var(--opponent);
}
.placeholder {
  display: flex;
  flex: 1;
  align-self: stretch;
  align-items: center;
  gap: 6px;
  padding: 0 0 0 6px;
  font: inherit;
  color: inherit;
  text-align: left;
  background: none;
  border: 0;
  cursor: pointer;
}
.band.empty:not(.picking):hover {
  color: var(--text);
  border-color: var(--ink);
}
@media (max-width: 899px) {
  .bands {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
  }
  .band {
    box-shadow: none;
  }
  .band.empty.picking {
    box-shadow: none;
  }
  .band + .band {
    margin-top: -2px;
  }
}
</style>
