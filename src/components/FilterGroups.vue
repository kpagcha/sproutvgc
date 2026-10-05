<script setup lang="ts">
import { FunnelX } from '@lucide/vue'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import type { MessageKey } from '@/i18n'
import DexRef from '@/components/DexRef'
import FilterAdder from '@/components/FilterAdder.vue'
import TypeIcon from '@/components/TypeIcon'
import { confirmDialog } from '@/composables/useConfirm'
import {
  NO_FILTERS,
  type FilterGroup,
  type FilterTerm,
  type Filters,
  type Join,
  type PokemonFilter,
} from '@/lib/pokemonFilters'

// The Pokémon list's filters (`pokemonFilters.ts`), in groups: each its filters joined by "or" or "and", and the
// groups joined the same way. The word between two of them switches it; "not" on a filter negates it.
const model = defineModel<Filters>({ required: true })

const flip = (join: Join): Join => (join === 'any' ? 'all' : 'any')
const joinWord = (join: Join): MessageKey => (join === 'any' ? 'filter.or' : 'filter.and')

function setGroup(i: number, group: FilterGroup | null) {
  const groups = model.value.groups.slice()
  // A group with no filters left goes too.
  if (group?.terms.length) groups[i] = group
  else groups.splice(i, 1)
  model.value = { ...model.value, groups }
}
const setTerm = (g: FilterGroup, i: number, j: number, term: FilterTerm | null) =>
  setGroup(i, { ...g, terms: g.terms.flatMap((x, k) => (k !== j ? [x] : term ? [term] : [])) })
const addTo = (g: FilterGroup, i: number, filter: PokemonFilter) =>
  g.terms.some((x) => x.kind === filter.kind && x.id === filter.id) ||
  setGroup(i, { ...g, terms: [...g.terms, filter] })

function addGroup(filter: PokemonFilter) {
  model.value = { ...model.value, groups: [...model.value.groups, { join: 'any', terms: [filter] }] }
}

async function clearAll() {
  if (await confirmDialog({ message: t('filter.clearConfirm'), confirm: t('filter.clear'), danger: true }))
    model.value = NO_FILTERS
}
</script>

<template>
  <div class="filter-groups">
    <template v-for="(g, i) in model.groups" :key="i">
      <button
        v-if="i > 0"
        v-tip="t('filter.switch')"
        type="button"
        class="join"
        @click="model = { ...model, join: flip(model.join) }"
      >
        {{ t(joinWord(model.join)) }}
      </button>
      <div class="group" :class="{ single: model.groups.length === 1 }">
        <template v-for="(f, j) in g.terms" :key="`${f.kind}:${f.id}`">
          <button
            v-if="j > 0"
            v-tip="t('filter.switch')"
            type="button"
            class="join"
            @click="setGroup(i, { ...g, join: flip(g.join) })"
          >
            {{ t(joinWord(g.join)) }}
          </button>
          <span class="filter" :class="{ not: f.not }">
            <button
              v-tip="t(f.not ? 'filter.include' : 'filter.exclude')"
              type="button"
              class="not-toggle"
              :aria-pressed="!!f.not"
              @click="setTerm(g, i, j, { ...f, not: !f.not || undefined })"
            >
              {{ t('filter.not') }}
            </button>
            <span class="muted">{{ t(`filter.kind.${f.kind}`) }}:</span>
            <TypeIcon v-if="f.kind === 'type'" :type="f.id" />
            <DexRef :to="f" />
            <button
              type="button"
              class="remove"
              :aria-label="t('filter.remove', { name: refName(f) })"
              @click="setTerm(g, i, j, null)"
            >
              ×
            </button>
          </span>
        </template>
        <FilterAdder @add="addTo(g, i, $event)" />
      </div>
    </template>
    <FilterAdder :label="t(model.groups.length ? 'filter.addGroup' : 'filter.add')" @add="addGroup" />
    <button
      v-if="model.groups.length"
      v-tip="t('filter.clearAll')"
      type="button"
      class="btn chip clear"
      :aria-label="t('filter.clearAll')"
      @click="clearAll"
    >
      <FunnelX :size="14" :stroke-width="2.5" />
    </button>
  </div>
</template>

<style scoped>
.filter-groups {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px;
}
/* A group: its filters on a faint tint, unless it's the only one. */
.group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 4px;
  background: color-mix(in srgb, var(--border) 35%, transparent);
  border-radius: 3px;
}
.group.single {
  padding: 0;
  background: none;
}
.filter {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 2px 2px 4px;
  background: var(--panel-alt);
  border: 1px solid var(--border);
  border-radius: 3px;
}
.filter.not {
  border-color: var(--bad);
}
/* The word between two filters, or groups, that switches how they join. */
.join,
.not-toggle {
  padding: 0 4px;
  font: inherit;
  font-size: 0.75em;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--muted);
  background: none;
  border: 1px solid transparent;
  border-radius: 3px;
  cursor: pointer;
}
.join:hover,
.not-toggle:hover {
  color: var(--text);
  border-color: var(--border-strong);
}
.not-toggle {
  opacity: 0.45;
}
.not .not-toggle {
  opacity: 1;
  color: var(--bad);
}
.clear {
  min-height: 22px;
  padding: 0 4px;
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
