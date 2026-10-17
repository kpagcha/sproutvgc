<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { availableIds } from '@/data/dex'
import { TYPES } from '@/data/types'
import { locale, t, typeName, type MessageKey } from '@/i18n'
import { refName } from '@/i18n/refName'
import type { FilterLike } from '@/lib/filterGroups'
import { FILTER_KINDS, type PokemonFilter } from '@/lib/pokemonFilters'

// Adds a filter to a group of a list's (the Pokémon list's, unless given its own `kinds` and `options`): a button that
// opens a pick of its kind, then of the entry, by name. Picking one adds it and closes again. `label` names the button
// (the first filter, when there are none).
const props = defineProps<{
  label?: string
  kinds?: readonly string[]
  /** A kind's choices, by name; the Pokémon list's by default (types, and the regulation's abilities and moves). */
  options?: (kind: string) => { id: string; name: string }[]
}>()
const emit = defineEmits<{ add: [filter: FilterLike] }>()

const kinds = computed(() => props.kinds ?? FILTER_KINDS)
const open = ref(false)
const kind = ref(kinds.value[0]!)
const kindSelect = useTemplateRef('kindSelect')

async function start() {
  open.value = true
  await nextTick()
  kindSelect.value?.focus()
}

const options = computed(() => {
  if (props.options) return props.options(kind.value)
  if (kind.value === 'type') return TYPES.map((id) => ({ id: id as string, name: typeName(id) }))
  const k = kind.value as 'ability' | 'move'
  return availableIds(k)
    .map((id) => ({ id: id as string, name: refName({ kind: k, id } as PokemonFilter) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale.value))
})

function pick(e: Event) {
  const select = e.target as HTMLSelectElement
  if (!select.value) return
  emit('add', { kind: kind.value, id: select.value })
  open.value = false
}
</script>

<template>
  <span v-if="open" class="adder" @keydown.escape="open = false">
    <select ref="kindSelect" v-model="kind" class="search" :aria-label="t('filter.kind')">
      <option v-for="k in kinds" :key="k" :value="k">{{ t(`filter.kind.${k}` as MessageKey) }}</option>
    </select>
    <select :key="kind" class="search" :aria-label="t(`filter.kind.${kind}` as MessageKey)" @change="pick">
      <option value="">{{ t('filter.choose') }}</option>
      <option v-for="o in options" :key="o.id" :value="o.id">{{ o.name }}</option>
    </select>
    <button type="button" class="remove" :aria-label="t('filter.cancel')" @click="open = false">×</button>
  </span>
  <button
    v-else
    v-tip="label ? undefined : t('filter.addTo')"
    type="button"
    class="btn chip"
    :aria-label="label ? undefined : t('filter.addTo')"
    @click="start"
  >
    + {{ label }}
  </button>
</template>

<style scoped>
.adder {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.adder .search {
  width: auto;
  max-width: 12em;
  margin: 0;
  padding: 1px 4px;
}
.btn.chip {
  min-height: 22px;
}
.remove {
  padding: 0 6px;
  font: inherit;
  font-size: 1.15em;
  line-height: 1;
  color: var(--muted);
  background: none;
  border: none;
  cursor: pointer;
}
.remove:hover {
  color: inherit;
}
</style>
