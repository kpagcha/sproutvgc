<script setup lang="ts">
import { computed } from 'vue'
import { HelpCircle } from '@lucide/vue'
import { ability, item, pokemon } from '@/data/dex'
import { natureName } from '@/data/natures'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { battlerOf, type Fighter } from '@/lib/damage'
import type { OpponentUnknowns } from '@/lib/damageReverse'
import type { Field } from '@/lib/team'
import ItemIcon from '@/components/ItemIcon.vue'
import PokemonIcon from '@/components/PokemonIcon'
import { partLabel, pointsLabel } from '@/components/solverText'

// The damage solver's two sides in short, a band each in its side's color, side by side, stuck to the top while what
// was seen and what fits are read: each one's Pokémon, then its set as chips, what's set solid (a tap opening its
// picker step) and what's worked out dashed (a tap opening what to work out), so either changes without scrolling up.
const props = defineProps<{
  a: Fighter
  b: Fighter
  work: { a: OpponentUnknowns; b: OpponentUnknowns }
  fixed: { a: boolean; b: boolean }
}>()
const emit = defineEmits<{ part: [side: 'a' | 'b', field: Field]; goal: [side: 'a' | 'b'] }>()

type Chip = { field: Field; label: string; item?: string; muted?: boolean }

function chipsOf(k: 'a' | 'b'): Chip[] {
  const f = k === 'a' ? props.a : props.b
  const w = props.work[k]
  const m = f.member
  const list: Chip[] = []
  if (!(w.item && !props.fixed[k]))
    list.push({
      field: 'item',
      label: m.item ? refName(item(m.item)) : t('calc.bands.noItem'),
      item: m.item ?? undefined,
      muted: !m.item,
    })
  if (m.ability) list.push({ field: 'ability', label: refName(ability(m.ability)) })
  if (!w.nature)
    list.push({
      field: 'nature',
      label: m.nature ? natureName(m.nature) : t('calc.bands.noNature'),
      muted: !m.nature,
    })
  if (!w.points) list.push({ field: 'points', label: pointsLabel(f), muted: f.sets })
  return list
}
/** What's worked out of a side, in one chip: "Nature · Item · Stat points". */
function workedOf(k: 'a' | 'b'): string {
  const w = props.work[k]
  return (['nature', 'item', 'points'] as const)
    .filter((p) => w[p] && !(p === 'item' && props.fixed[k]))
    .map(partLabel)
    .join(' · ')
}
const sides = computed(() =>
  (['a', 'b'] as const).flatMap((k) => {
    const f = k === 'a' ? props.a : props.b
    const id = battlerOf(f)
    return id ? [{ k, id, chips: chipsOf(k), worked: workedOf(k) }] : []
  }),
)
</script>

<template>
  <div class="bands" role="group" :aria-label="t('calc.bands.label')">
    <div v-for="s in sides" :key="s.k" class="band" :class="`band-${s.k}`">
      <button
        v-tip="t('calc.bands.pokemon')"
        type="button"
        class="mon"
        :aria-label="t('calc.bands.pokemon')"
        @click="emit('part', s.k, 'pokemon')"
      >
        <PokemonIcon :id="s.id" /><span class="name">{{ refName(pokemon(s.id)) }}</span>
      </button>
      <span class="chips">
        <button
          v-if="s.worked"
          v-tip="t('calc.bands.worked', { part: s.worked })"
          type="button"
          class="chip worked"
          @click="emit('goal', s.k)"
        >
          <HelpCircle :size="13" aria-hidden="true" />{{ s.worked }}
        </button>
        <template v-for="c in s.chips" :key="c.field">
          <button
            v-tip="
              t('calc.bands.edit', {
                part:
                  c.field === 'points'
                    ? t('builder.points').toLowerCase()
                    : t(`builder.${c.field as 'item'}`).toLowerCase(),
              })
            "
            type="button"
            class="chip"
            :class="{ muted: c.muted }"
            @click="emit('part', s.k, c.field)"
          >
            <ItemIcon v-if="c.item" :id="c.item as never" class="chip-item" />{{ c.label }}
          </button>
        </template>
      </span>
    </div>
  </div>
</template>

<style scoped>
.bands {
  display: grid;
  grid-template-columns: 1fr 1fr;
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
/* On phones, one under the other, a row each, as the sides' own bands. */
@media (max-width: 899px) {
  .bands {
    grid-template-columns: 1fr;
    gap: 0;
  }
  .band {
    box-shadow: none;
  }
  .band + .band {
    margin-top: -2px;
  }
}
.band-b {
  color: var(--opponent-text);
  background: var(--opponent);
}
.mon {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: 2px;
  padding: 0 6px 0 0;
  font: inherit;
  font-weight: bold;
  color: inherit;
  background: none;
  border: 0;
  cursor: pointer;
}
.mon:hover .name {
  text-decoration: underline;
}
.chips {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
  mask-image: linear-gradient(to right, #000 calc(100% - 16px), transparent);
  padding-right: 16px;
}
.chip {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: 3px;
  height: 24px;
  padding: 0 7px;
  font: inherit;
  font-size: 0.8125em;
  color: var(--text);
  white-space: nowrap;
  background: var(--panel);
  border: 1px solid var(--ink);
  cursor: pointer;
}
.chip:hover {
  background: var(--sel);
}
.chip.muted {
  color: var(--muted);
}
.chip-item {
  margin: -4px 0 -4px -4px;
}
/* What's worked out: no value, dashed on the band's own color, a question mark before it. */
.chip.worked {
  color: inherit;
  font-weight: bold;
  background: transparent;
  border: 1px dashed currentColor;
}
.chip.worked:hover {
  background: rgb(255 255 255 / 0.15);
}
</style>
