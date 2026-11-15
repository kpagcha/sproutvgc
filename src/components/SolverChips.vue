<script setup lang="ts">
import { computed } from 'vue'
import { ability, item, pokemon } from '@/data/dex'
import { natureName } from '@/data/natures'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { battlerOf, type Fighter } from '@/lib/damage'
import type { OpponentUnknowns } from '@/lib/damageReverse'
import type { Field } from '@/lib/team'
import ItemIcon from '@/components/ItemIcon.vue'
import PokemonIcon from '@/components/PokemonIcon'
import ScrollRow from '@/components/ScrollRow.vue'
import { partLabel, pointsLabel } from '@/components/solverText'

// A damage solver side in short, on a band of its side's color: its Pokémon, then its set as chips in the order it's
// set (item, ability, nature, stat points) on a row sliding sideways where they don't fit (`ScrollRow`), what's set
// solid and what's worked out dashed with a question mark, each a tap opening its picker step. `compact` (phones'): its
// icon alone, a tap on it bringing its panel into view (its page's to do), its item its icon alone, named on hover.
const props = defineProps<{
  fighter: Fighter
  work: OpponentUnknowns
  /** Its item can't be anything else (a Mega's stone, Ogerpon's mask): never worked out. */
  fixed: boolean
  compact?: boolean
}>()
const emit = defineEmits<{ part: [field: Field] }>()

type Chip = { field: Field; label: string; item?: string; muted?: boolean; worked?: boolean }

const id = computed(() => battlerOf(props.fighter))
const chips = computed((): Chip[] => {
  const f = props.fighter
  const w = props.work
  const m = f.member
  const list: Chip[] = []
  if (w.item && !props.fixed) list.push({ field: 'item', label: partLabel('item'), worked: true })
  else
    list.push({
      field: 'item',
      label: m.item ? refName(item(m.item)) : t('calc.bands.noItem'),
      item: m.item ?? undefined,
      muted: !m.item,
    })
  if (m.ability) list.push({ field: 'ability', label: refName(ability(m.ability)) })
  if (w.nature) list.push({ field: 'nature', label: partLabel('nature'), worked: true })
  else
    list.push({
      field: 'nature',
      label: m.nature ? natureName(m.nature) : t('calc.bands.noNature'),
      muted: !m.nature,
    })
  if (w.points) list.push({ field: 'points', label: partLabel('points'), worked: true })
  else list.push({ field: 'points', label: pointsLabel(f), muted: f.sets })
  return list
})
const partName = (f: Field) =>
  f === 'points' ? t('builder.points').toLowerCase() : t(`builder.${f as 'item'}`).toLowerCase()
/** A chip's tooltip: what tapping it does; an item shown as its icon alone, named first. */
const tipOf = (c: Chip) => {
  const does = c.worked ? t('calc.bands.worked') : t('calc.bands.edit', { part: partName(c.field) })
  return compactItem(c) ? `${c.label}. ${does}` : does
}
const compactItem = (c: Chip) => props.compact && !!c.item
/** Its Pokémon tapped: compact (on phones), its panel brought into view; else another picked. */
const monTip = computed(() => t(props.compact ? 'calc.bands.toPanel' : 'calc.bands.pokemon'))
</script>

<template>
  <span v-if="id" class="solver-chips">
    <button
      v-tip="monTip"
      type="button"
      class="mon"
      :aria-label="`${refName(pokemon(id))}. ${monTip}`"
      @click="emit('part', 'pokemon')"
    >
      <PokemonIcon :id /><span v-if="!compact" class="name">{{ refName(pokemon(id)) }}</span>
    </button>
    <ScrollRow class="chips">
      <button
        v-for="c in chips"
        :key="c.field"
        v-tip="tipOf(c)"
        type="button"
        class="chip"
        :class="{ muted: c.muted, worked: c.worked, icon: compactItem(c) }"
        :aria-label="compactItem(c) ? c.label : undefined"
        @click="emit('part', c.field)"
      >
        <span v-if="c.worked" class="q" aria-hidden="true">?</span
        ><ItemIcon v-else-if="c.item" :id="c.item as never" class="chip-item" /><template v-if="!compactItem(c)">{{
          c.label
        }}</template>
      </button>
    </ScrollRow>
  </span>
</template>

<style scoped>
.solver-chips {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.mon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
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
  --gap: 4px;
  flex: 1;
  min-width: 0;
}
/* Chips alone in it, no shadows to keep room for. */
.chips :deep(.track) {
  padding: 0;
}
.chip {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 3px;
  height: 24px;
  padding: 0 7px;
  font: inherit;
  font-size: 0.8125em;
  font-weight: normal;
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
.chip.icon {
  padding: 0 2px;
}
.chip-item {
  margin: -4px 0 -4px -4px;
}
.chip.icon .chip-item {
  margin: -4px;
}
/* Worked out: no value, dashed on the band's own color, a question mark before it. */
.chip.worked {
  color: inherit;
  background: transparent;
  border: 1px dashed currentColor;
}
.chip.worked:hover {
  background: rgb(255 255 255 / 0.15);
}
.q {
  margin-right: 1px;
}
</style>
