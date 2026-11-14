<script setup lang="ts">
import { computed } from 'vue'
import { HelpCircle, Pencil, X } from '@lucide/vue'
import { ability, item, pokemon } from '@/data/dex'
import { natureName } from '@/data/natures'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { battlerOf, type Fighter } from '@/lib/damage'
import type { OpponentUnknowns } from '@/lib/damageReverse'
import type { Field } from '@/lib/team'
import ItemIcon from '@/components/ItemIcon.vue'
import PokemonIcon from '@/components/PokemonIcon'
import StepBack from '@/components/StepBack.vue'
import { partLabel, pointsLabel } from '@/components/solverText'

// The damage solver's setup, its fourth step: what's set of each side, a card each in its side's color, a row per part
// (item, ability, nature, stat points), each opening its picker step (`edit`), what's worked out left blank, dashed,
// leading back to what to work out (`goal`). Filled in, as it opens, from each one's most common set.
const props = defineProps<{
  a: Fighter
  b: Fighter
  work: { a: OpponentUnknowns; b: OpponentUnknowns }
  fixed: { a: boolean; b: boolean }
  /** Whether there's a meta it was filled in from. */
  filled: boolean
}>()
const emit = defineEmits<{ edit: [side: 'a' | 'b', field: Field]; goal: []; next: []; back: []; close: [] }>()

type Row =
  | { field: Field; label: string; value: string; item?: string; muted?: boolean }
  | { worked: true; field: Field; label: string }

function rowsOf(k: 'a' | 'b'): Row[] {
  const f = k === 'a' ? props.a : props.b
  const w = props.work[k]
  const m = f.member
  const none = t('calc.known.none')
  const rows: Row[] = []
  if (w.item && !props.fixed[k]) rows.push({ worked: true, field: 'item', label: partLabel('item') })
  else
    rows.push({
      field: 'item',
      label: partLabel('item'),
      value: m.item ? refName(item(m.item)) : none,
      item: m.item ?? undefined,
      muted: !m.item,
    })
  rows.push({
    field: 'ability',
    label: t('builder.ability'),
    value: m.ability ? refName(ability(m.ability)) : none,
    muted: !m.ability,
  })
  if (w.nature) rows.push({ worked: true, field: 'nature', label: partLabel('nature') })
  else
    rows.push({
      field: 'nature',
      label: partLabel('nature'),
      value: m.nature ? natureName(m.nature) : none,
      muted: !m.nature,
    })
  if (w.points) rows.push({ worked: true, field: 'points', label: partLabel('points') })
  else rows.push({ field: 'points', label: partLabel('points'), value: pointsLabel(f), muted: f.sets })
  return rows
}
const sides = computed(() =>
  (['a', 'b'] as const).flatMap((k) => {
    const id = battlerOf(k === 'a' ? props.a : props.b)
    return id ? [{ k, id, rows: rowsOf(k) }] : []
  }),
)
</script>

<template>
  <div class="known">
    <div class="head">
      <StepBack @back="emit('back')" />
      <h2>{{ t('calc.known.title') }}</h2>
      <button type="button" class="close" :aria-label="t('calc.hits.close')" @click="emit('close')">
        <X :size="20" aria-hidden="true" />
      </button>
    </div>
    <p class="muted intro">{{ t(filled ? 'calc.known.intro' : 'calc.known.noMeta') }}</p>

    <section v-for="s in sides" :key="s.k" class="side" :class="`side-${s.k}`">
      <button type="button" class="side-head" @click="emit('edit', s.k, 'pokemon')">
        <span class="whose">{{ t(s.k === 'a' ? 'calc.yours' : 'calc.theirs') }}</span>
        <PokemonIcon :id="s.id" /><span class="name">{{ refName(pokemon(s.id)) }}</span
        ><Pencil :size="14" class="pen" aria-hidden="true" />
      </button>
      <ul class="rows">
        <li v-for="r in s.rows" :key="String(r.field)">
          <button v-if="'worked' in r" type="button" class="row worked" @click="emit('goal')">
            <span class="label muted">{{ r.label }}</span>
            <span class="value"><HelpCircle :size="14" aria-hidden="true" />{{ t('calc.known.worked') }}</span>
          </button>
          <button v-else type="button" class="row" @click="emit('edit', s.k, r.field)">
            <span class="label muted">{{ r.label }}</span>
            <span class="value" :class="{ muted: r.muted }"
              ><ItemIcon v-if="r.item" :id="r.item as never" class="item" />{{ r.value }}</span
            >
            <Pencil :size="14" class="pen" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </section>

    <div class="foot">
      <button type="button" class="btn primary" @click="emit('next')">
        {{ t('calc.flow.next', { step: t('calc.flow.hits') }) }} →
      </button>
    </div>
  </div>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.head h2 {
  flex: 1;
  margin: 0;
  font-size: calc(15px * var(--display-scale, 1) * var(--text-scale));
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
.intro {
  margin: 6px 0 12px;
  font-size: 0.875em;
}
.side {
  --side: var(--accent);
  --side-text: var(--accent-text);
  margin-bottom: 12px;
  border: 2px solid var(--ink);
  box-shadow: 3px 3px 0 var(--ink);
}
.side-b {
  --side: var(--opponent);
  --side-text: var(--opponent-text);
}
.side-head {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 2px 10px 2px 8px;
  font: inherit;
  font-weight: bold;
  text-align: left;
  color: var(--side-text);
  background: var(--side);
  border: 0;
  border-bottom: 2px solid var(--ink);
  cursor: pointer;
}
.whose {
  margin-right: 6px;
  font-size: 0.75em;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.85;
}
.side-head .name {
  flex: 1;
}
.side-head:hover .name {
  text-decoration: underline;
}
.side-head .pen {
  color: inherit;
  opacity: 0.8;
}
.rows {
  margin: 0;
  padding: 0;
  list-style: none;
  background: var(--panel);
}
.rows li + li {
  border-top: 1px solid var(--border);
}
.row {
  display: grid;
  grid-template-columns: 6.5em 1fr auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 36px;
  padding: 4px 10px;
  font: inherit;
  text-align: left;
  color: var(--text);
  background: none;
  border: 0;
  cursor: pointer;
}
.row:hover {
  background: var(--sel);
}
.label {
  font-size: 0.8125em;
}
.value {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  font-weight: bold;
}
.value .item {
  margin: -4px 0 -4px -4px;
}
.pen {
  color: var(--muted);
}
.row:hover .pen {
  color: var(--text);
}
/* What's worked out: no value of its own, dashed, leading back to what to work out. */
.row.worked .value {
  justify-self: start;
  padding: 1px 7px;
  font-size: 0.875em;
  color: var(--side);
  border: 1px dashed var(--side);
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
