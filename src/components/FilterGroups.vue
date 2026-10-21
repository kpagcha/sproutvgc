<script setup lang="ts">
import { FunnelX } from '@lucide/vue'
import { t } from '@/i18n'
import type { MessageKey } from '@/i18n'
import type { PokemonId, Ref } from '@/data/dex'
import type { TypeId } from '@/data/types'
import DetailMenu from '@/components/DetailMenu.vue'
import DexRef from '@/components/DexRef'
import FilterAdder from '@/components/FilterAdder.vue'
import TypeIcon from '@/components/TypeIcon'
import { confirmDialog } from '@/composables/useConfirm'
import {
  filterKey,
  noFilters,
  replaced,
  withFilterIn,
  withGroup,
  type FilterGroup,
  type Join,
  type Negatable,
} from '@/lib/filterGroups'
import { refName } from '@/i18n/refName'
import {
  isExtraKind,
  termName,
  type Detail,
  type RefTerm,
  type Term,
  type TermFilters,
  type TermKind,
} from '@/lib/searchTerms'

// A list's filters in the advanced mode (`FilterSearch`): groups, each its filters joined by "and" or "or", and the
// groups joined the same way. The word between two of them switches it; "not" on a filter negates it. A filter of a
// dex entry is its name, a link (to its meta page with `meta`); one that isn't (a move's tag) its name. Each group adds
// filters of `kinds` from the explicit choices of what to filter by and then the entry (`FilterAdder`), as does the
// button for a new group; with none yet, those choices are shown from the start. On a list of teams (`details`), a
// Pokémon's filter names its build's details after it, and "with…" narrows it to one (`DetailMenu`).
const model = defineModel<TermFilters>({ required: true })
const props = defineProps<{
  kinds: readonly TermKind[]
  meta?: boolean
  /** How many of the list there'd be with some filters, for a Pokémon's details. */
  count?: (filters: TermFilters) => number
  /** On a list of teams, what a Pokémon's sets run, the most first, to narrow its filter to a build by. */
  details?: (id: PokemonId) => readonly Detail[]
}>()
const countWith = (old: Term) => (term: Term) => props.count?.(replaced(model.value, old, term)) ?? 0

const flip = (join: Join): Join => (join === 'any' ? 'all' : 'any')
const joinWord = (join: Join): MessageKey => (join === 'any' ? 'filter.or' : 'filter.and')

function setGroup(i: number, group: FilterGroup<Term> | null) {
  const groups = model.value.groups.slice()
  // A group with no filters left goes too.
  if (group?.terms.length) groups[i] = group
  else groups.splice(i, 1)
  model.value = { ...model.value, groups }
}
const setTerm = (g: FilterGroup<Term>, i: number, j: number, term: Negatable<Term> | null) =>
  setGroup(i, { ...g, terms: g.terms.flatMap((x, k) => (k !== j ? [x] : term ? [term] : [])) })

async function clearAll() {
  if (await confirmDialog({ message: t('filter.clearConfirm'), confirm: t('filter.clear'), danger: true }))
    model.value = noFilters()
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
        <template v-for="(f, j) in g.terms" :key="`${f.kind}:${f.id}:${j}`">
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
            <span class="muted">{{ t(`filter.kind.${f.kind}` as MessageKey) }}:</span>
            <TypeIcon v-if="f.kind === 'type'" :type="f.id as TypeId" />
            <span v-if="isExtraKind(f.kind)">{{ termName(f) }}</span>
            <DexRef v-else :to="f as Ref" :meta />
            <template v-for="w in f.with ?? []" :key="filterKey(w)">
              <span class="muted" aria-hidden="true">·</span>
              <DexRef :to="w" :meta />
            </template>
            <DetailMenu
              v-if="details && count && f.kind === 'pokemon'"
              :term="f"
              :candidates="() => details!(f.id as PokemonId)"
              :count="countWith(f)"
              :label="t('filter.details.edit', { name: refName(f as RefTerm) })"
              class="with"
              @change="setTerm(g, i, j, f.not ? { ...$event, not: true } : $event)"
              >{{ t('filter.details.add') }}</DetailMenu
            >
            <button
              type="button"
              class="remove"
              :aria-label="t('filter.remove', { name: termName(f) })"
              @click="setTerm(g, i, j, null)"
            >
              ×
            </button>
          </span>
        </template>
        <FilterAdder :kinds :taken="g.terms" @add="model = withFilterIn(model, i, $event)" />
      </div>
    </template>
    <FilterAdder
      :label="t('filter.addGroup')"
      :shown="!model.groups.length"
      :kinds
      :taken="[]"
      @add="model = withGroup(model, $event)"
    />
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
.with {
  font-size: 0.85em;
  color: var(--muted);
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
