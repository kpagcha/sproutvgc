<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import type { ItemId, MoveId } from '@/data/dex'
import { MOVES } from '@/data/moves'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import type { Negatable } from '@/lib/filterGroups'
import { DETAIL_KINDS, toggledDetail, type Detail, type RefTerm, type Term } from '@/lib/searchTerms'
import ItemIcon from '@/components/ItemIcon.vue'
import TypeIcon from '@/components/TypeIcon'

// A Pokémon filter's details, on a list of teams (`FilterSearch`, `FilterGroups`): its trigger (the slot) opens a
// drop-down of the items, abilities and moves its sets run (`candidates`, the most run first), each a checkbox that
// narrows the filter to the one Pokémon having it, a build, with how many of the list that'd leave (`count`; those
// leaving none left out, but for those ticked); on a negated filter, how many that build is of, the teams it'd leave
// out. Closed by a press outside it or Escape.
const props = defineProps<{
  term: Negatable<Term>
  candidates: () => readonly Detail[]
  /** How many of the list there'd be with the filter as given. */
  count: (term: Term) => number
  /** The trigger's label, for its tooltip and screen readers. */
  label: string
}>()
const emit = defineEmits<{ change: [term: Term] }>()

const open = ref(false)
const root = useTemplateRef<HTMLElement>('root')
function onPointerDown(e: PointerEvent) {
  if (!root.value?.contains(e.target as Node)) open.value = false
}
const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (open.value = false)
// Opened, moved left by as much as it'd run past the screen's right edge (a chip near the end of its line, on a phone).
const pop = useTemplateRef<HTMLElement>('pop')
const shift = ref(0)
watch(open, async (on) => {
  if (on) {
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    shift.value = 0
    await nextTick()
    const right = pop.value?.getBoundingClientRect().right ?? 0
    shift.value = Math.max(0, right - (document.documentElement.clientWidth - 8))
  } else {
    document.removeEventListener('pointerdown', onPointerDown)
    document.removeEventListener('keydown', onKey)
  }
})
onBeforeUnmount(() => (open.value = false))

const ticked = (d: Detail) => (props.term.with ?? []).some((w) => w.kind === d.kind && w.id === d.id)
/** The build with `d` ticked, as counted: the teams with it, even on a negated filter (those it'd leave out). */
function counted(d: Detail): Term {
  const term: Negatable<Term> = { ...toggledDetail(props.term, d) }
  delete term.not
  return term
}
/** By kind, each detail with how many it'd leave once ticked, or leave out (none counted for those ticked already). */
const sections = computed(() => {
  if (!open.value) return []
  const all = props.candidates().map((d) => ({ d, on: ticked(d), n: ticked(d) ? 0 : props.count(counted(d)) }))
  return DETAIL_KINDS.map((kind) => ({ kind, rows: all.filter((x) => x.d.kind === kind && (x.on || x.n)) })).filter(
    (s) => s.rows.length,
  )
})
</script>

<template>
  <span ref="root" class="detail-menu">
    <button
      v-tip="label"
      type="button"
      class="trigger"
      :class="{ open }"
      :aria-expanded="open"
      :aria-label="label"
      @click.stop="open = !open"
    >
      <slot />
    </button>
    <div v-if="open" ref="pop" class="pop" :style="shift ? { left: `${-shift}px` } : undefined" @click.stop>
      <p class="head">
        {{ t(term.not ? 'filter.details.headNot' : 'filter.details.head', { name: refName(term as RefTerm) }) }}
      </p>
      <fieldset v-for="s in sections" :key="s.kind">
        <legend>{{ t(`filter.kind.${s.kind}`) }}</legend>
        <label v-for="{ d, on, n } in s.rows" :key="d.id">
          <input type="checkbox" :checked="on" @change="emit('change', toggledDetail(term, d))" />
          <ItemIcon v-if="d.kind === 'item'" :id="d.id as ItemId" :scale="0.67" />
          <TypeIcon v-else-if="d.kind === 'move' && MOVES[d.id as MoveId]" :type="MOVES[d.id as MoveId]!.type" />
          <span class="name">{{ refName(d) }}</span>
          <span v-if="!on" class="n">{{ n }}</span>
        </label>
      </fieldset>
      <p v-if="!sections.length" class="muted">{{ t('filter.details.none') }}</p>
    </div>
  </span>
</template>

<style scoped>
.detail-menu {
  position: relative;
  display: inline-flex;
}
.trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  font: inherit;
  color: inherit;
  text-align: left;
  background: none;
  border: none;
  border-bottom: 1px dashed var(--border-strong);
  cursor: pointer;
}
.trigger:hover,
.trigger.open {
  border-bottom-color: var(--accent);
}
/* Under the trigger, over the page, as the term options under a search box are: an ink-framed card on a hard shadow,
   its sections one under another, scrolling when long. */
.pop {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 60;
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: max-content;
  min-width: 200px;
  max-width: min(280px, calc(100vw - 32px));
  max-height: 320px;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 6px 8px;
  font-size: 0.875rem;
  font-weight: normal;
  line-height: 1.3;
  background: var(--panel);
  border: 2px solid var(--ink);
  box-shadow: var(--hard);
  cursor: default;
  /* Type badges at their desktop size on phones too, as small as the text. */
  --icon-scale: 1;
}
.head {
  margin: 0;
  font-size: 0.9em;
  color: var(--muted);
}
fieldset {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  border: 0;
}
legend {
  margin-bottom: 2px;
  padding: 0;
  font-size: 0.75em;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}
label {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 24px;
  cursor: pointer;
}
label input {
  margin: 0;
}
.name {
  min-width: 0;
}
/* How many of the list it'd leave, at the row's end. */
.n {
  margin-left: auto;
  padding-left: 12px;
  font-size: 0.85em;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
</style>
