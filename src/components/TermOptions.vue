<script setup lang="ts">
import type { ItemId, PokemonId } from '@/data/dex'
import type { TypeId } from '@/data/types'
import { t, type MessageKey } from '@/i18n'
import type { TermGroup, TermOption } from '@/composables/useTermPicker'
import type { TermKind } from '@/lib/searchTerms'
import ItemIcon from '@/components/ItemIcon.vue'
import Marked from '@/components/Marked'
import PokemonIcon from '@/components/PokemonIcon'
import TypeIcon from '@/components/TypeIcon'

// The terms a filter search's text finds (`useTermPicker`), under its box: by kind, each with how many of the list it'd
// leave, after the `lead` options (a search by name). Picking one, by clicking it, is the box's to do. A panel in the
// page's flow, pushing the list down rather than covering it, so the list it previews stays in sight; `floating`, a
// card over what's under the box.
defineProps<{
  floating?: boolean
  id: string
  groups: TermGroup[]
  active: number
  indexOf: (o: TermOption) => number
  lead?: { label: string; n: number }[]
}>()
const emit = defineEmits<{ pick: [option: TermOption | number]; hover: [index: number] }>()
const optionId = (id: string, i: number) => `${id}-${i}`

const KIND_LABEL: Record<TermKind, MessageKey> = {
  type: 'filter.kind.type',
  ability: 'filter.kind.ability',
  move: 'filter.kind.move',
  item: 'filter.kind.item',
  pokemon: 'filter.kind.pokemon',
  category: 'filter.kind.category',
  flag: 'filter.kind.flag',
  reach: 'filter.kind.reach',
  priority: 'filter.kind.priority',
  itemCategory: 'filter.kind.itemCategory',
  subkind: 'filter.kind.subkind',
}
</script>

<template>
  <ul :id class="term-options" :class="{ floating }" role="listbox">
    <li
      v-for="(l, i) in lead"
      :id="optionId(id, i)"
      :key="`lead-${i}`"
      role="option"
      class="option"
      :class="{ active: active === i }"
      :aria-selected="active === i"
      @mousedown.prevent="emit('pick', i)"
      @mouseenter="emit('hover', i)"
    >
      <span class="option-name">{{ l.label }}</span>
      <span class="option-count">{{ l.n }}</span>
    </li>
    <template v-for="g in groups" :key="g.kind">
      <li role="presentation" class="group">{{ t(KIND_LABEL[g.kind]) }}</li>
      <li
        v-for="o in g.options"
        :id="optionId(id, indexOf(o))"
        :key="o.term.id"
        role="option"
        class="option"
        :class="{ active: indexOf(o) === active }"
        :aria-selected="indexOf(o) === active"
        @mousedown.prevent="emit('pick', o)"
        @mouseenter="emit('hover', indexOf(o))"
      >
        <TypeIcon v-if="o.term.kind === 'type'" :type="o.term.id as TypeId" />
        <ItemIcon v-else-if="o.term.kind === 'item'" :id="o.term.id as ItemId" :scale="0.67" />
        <PokemonIcon v-else-if="o.term.kind === 'pokemon'" :id="o.term.id as PokemonId" />
        <span v-if="o.term.kind !== 'type'" class="option-name"><Marked :p="o.parts" /></span>
        <span class="option-count">{{ o.n }}</span>
      </li>
    </template>
  </ul>
</template>

<style scoped>
/* A panel under the box, as wide, short enough to leave the list it previews in sight. */
.term-options {
  max-width: 480px;
  max-height: 200px;
  overflow-y: auto;
  overscroll-behavior: contain;
  margin: 4px 0 0;
  padding: 2px;
  list-style: none;
  background: var(--panel);
  border: 2px solid var(--ink);
}
/* A card over what's under the box, as the Pokémon pickers' lists are. */
.term-options.floating {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 20;
  min-width: 220px;
  max-width: none;
  max-height: 320px;
  margin: 0;
  box-shadow: var(--hard);
}
.group {
  padding: 6px 6px 2px;
  font-size: 0.75em;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}
.option {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 0 6px;
  cursor: pointer;
}
.option.active {
  background: var(--sel);
}
.option-name {
  min-width: 0;
}
/* How many of the list it'd leave, at the row's end. */
.option-count {
  margin-left: auto;
  padding-left: 8px;
  font-size: 0.85em;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
</style>
