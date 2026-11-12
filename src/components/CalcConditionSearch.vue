<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef, watch, type Component } from 'vue'
import { createReusableTemplate, useMediaQuery } from '@vueuse/core'
import { Circle, Search, Square, X } from '@lucide/vue'
import { t } from '@/i18n'
import { MAX_SPIKES, type Battlefield, type Fighter } from '@/lib/damage'
import {
  conditionName,
  fieldEffects,
  sideEffects,
  SPIKES,
  spikesOn,
  terrains,
  weathers,
} from '@/components/calcConditions'
import ModalDialog from '@/components/ModalDialog.vue'
import OptionsMenu from '@/components/OptionsMenu.vue'

// The damage calculator's battle conditions found by name: a quiet magnifier over the unfolded conditions dropping a
// small box to type in (on phones, a dialog in the middle of the screen, its list as tall as the screen leaves), over
// every condition there is (the weather, the terrain, the field's, each side's; with no `field`, the sides given alone:
// a side's own search, in its This side box), each row saying where it applies and whether it's on, toggled by a click or Enter (the keys' one, the first until moved), the box
// staying open with its text selected, so the next one is typed over it. Spikes' row adds a layer, back to none past
// the most.
const props = defineProps<{
  /** The field, its conditions searched too; left out for a side's own search. */
  field?: Battlefield
  sides: Partial<Record<'a' | 'b', Fighter>>
}>()
const emit = defineEmits<{
  field: [f: Battlefield]
  side: [key: 'a' | 'b', f: Fighter]
}>()
const open = defineModel<boolean>('open', { default: false })
const phone = useMediaQuery('(max-width: 899px)')
// The box and its list, drawn once, in the drop-down or the dialog.
const [DefineBody, Body] = createReusableTemplate()

interface Row {
  id: string
  name: string
  icon?: Component
  /** Where it applies: its kind, or whose side. */
  scope: string
  side?: 'a' | 'b'
  /** One at a time, a radio's circle. */
  round?: boolean
  on: boolean
  /** Spikes' layers, when it's them. */
  count?: number
  toggle: () => void
}

const rows = computed<Row[]>(() => {
  const f = props.field
  const out: Row[] = []
  const keys = (['a', 'b'] as const).filter((k) => props.sides[k])
  if (f) {
    for (const kind of ['weather', 'terrain'] as const)
      for (const c of kind === 'weather' ? weathers : terrains) {
        if (!c.key) continue
        const on = f[kind] === c.key
        out.push({
          id: `${kind}:${c.key}`,
          name: conditionName(c),
          icon: c.icon,
          scope: t(`calc.${kind}`),
          round: true,
          on,
          toggle: () => emit('field', { ...f, [kind]: on ? '' : c.key }),
        })
      }
    for (const c of fieldEffects) {
      const on = f.effects.includes(c.key)
      out.push({
        id: `field:${c.key}`,
        name: conditionName(c),
        icon: c.icon,
        scope: t('calc.fieldLabel'),
        on,
        toggle: () =>
          emit('field', { ...f, effects: on ? f.effects.filter((x) => x !== c.key) : [...f.effects, c.key] }),
      })
    }
  }
  // Each side's, yours and the opponent's of one condition together.
  const whose = { a: t('calc.yours'), b: t('calc.theirs') }
  for (const c of sideEffects)
    for (const k of keys) {
      const s = props.sides[k]!
      const on = s.side.includes(c.key)
      out.push({
        id: `${k}:${c.key}`,
        name: conditionName(c),
        icon: c.icon,
        scope: whose[k],
        side: k,
        on,
        toggle: () => emit('side', k, { ...s, side: on ? s.side.filter((x) => x !== c.key) : [...s.side, c.key] }),
      })
    }
  if (spikesOn)
    for (const k of keys) {
      const s = props.sides[k]!
      out.push({
        id: `${k}:spikes`,
        name: conditionName(SPIKES),
        scope: whose[k],
        side: k,
        on: s.spikes > 0,
        count: s.spikes,
        toggle: () => emit('side', k, { ...s, spikes: s.spikes >= MAX_SPIKES ? 0 : s.spikes + 1 }),
      })
    }
  return out
})

// Those whose name has the text: at a word's start first, then anywhere in it.
const query = shallowRef('')
const found = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return rows.value
  const starts: Row[] = []
  const rest: Row[] = []
  for (const r of rows.value) {
    const name = r.name.toLowerCase()
    const at = name.indexOf(q)
    if (at < 0) continue
    if (name.split(/[\s-]+/).some((w) => w.startsWith(q)) || at === 0) starts.push(r)
    else rest.push(r)
  }
  return [...starts, ...rest]
})

const input = useTemplateRef<HTMLInputElement>('input')
const list = useTemplateRef<HTMLElement>('list')
const at = shallowRef(0)
watch(query, () => (at.value = 0))
watch(open, (on) => {
  if (!on) return
  query.value = ''
  at.value = 0
  void nextTick(() => input.value?.focus())
})
function move(by: number) {
  const n = found.value.length
  if (!n) return
  at.value = (at.value + by + n) % n
  void nextTick(() => list.value?.children[at.value]?.scrollIntoView({ block: 'nearest' }))
}
function pick(r: Row | undefined) {
  if (!r) return
  r.toggle()
  input.value?.focus()
  input.value?.select()
}
</script>

<template>
  <DefineBody>
    <input
      ref="input"
      v-model="query"
      type="search"
      class="box"
      :placeholder="t('calc.searchConditions.placeholder')"
      :aria-label="t('calc.searchConditions')"
      autocomplete="off"
      spellcheck="false"
      @keydown.down.prevent="move(1)"
      @keydown.up.prevent="move(-1)"
      @keydown.enter.prevent="pick(found[at])"
    />
    <div v-if="found.length" ref="list" class="list">
      <!-- The pointer's press kept from taking the focus off the box. -->
      <button
        v-for="(r, i) in found"
        :key="r.id"
        type="button"
        class="row no-lift"
        :class="{ on: r.on, at: i === at }"
        :aria-pressed="r.on"
        tabindex="-1"
        @mousedown.prevent
        @mousemove="at = i"
        @click="pick(r)"
      >
        <span class="mark" :class="{ round: r.round }" aria-hidden="true">
          <component :is="r.round ? Circle : Square" :size="14" />
        </span>
        <component :is="r.icon" v-if="r.icon" :size="14" aria-hidden="true" />
        <span class="name">{{ r.name }}</span>
        <span v-if="r.count !== undefined" class="count">{{ r.count }}/{{ MAX_SPIKES }}</span>
        <!-- Where it applies at the row's end: a side's a square of its color alone, as its band's (none on a side's
             own search, whose side is known). -->
        <template v-if="field">
          <span v-if="r.side" v-tip="r.scope" class="side-mark" :class="`side-${r.side}`" :aria-label="r.scope"></span>
          <span v-else class="scope">{{ r.scope }}</span>
        </template>
      </button>
    </div>
    <p v-else class="muted none">{{ t('calc.searchConditions.none') }}</p>
  </DefineBody>
  <template v-if="phone">
    <button type="button" class="btn quiet small" :aria-expanded="open" @click="open = !open">
      <Search :size="14" aria-hidden="true" />{{ t('calc.searchConditions.short') }}
    </button>
    <ModalDialog v-model:open="open" :label="t('calc.searchConditions')" fill>
      <div class="panel banded search-card">
        <div class="band">
          <span>{{ t('calc.searchConditions') }}</span>
          <button type="button" class="btn on-band close" :aria-label="t('picker.close')" @click="open = false">
            <X :size="16" aria-hidden="true" />
          </button>
        </div>
        <div class="card-body"><Body /></div>
      </div>
    </ModalDialog>
  </template>
  <OptionsMenu
    v-else
    v-model:open="open"
    :title="t('calc.searchConditions')"
    :icon="Search"
    :label="t('calc.searchConditions.short')"
    align="left"
  >
    <Body />
  </OptionsMenu>
</template>

<style scoped>
/* On phones, the dialog's card: its band, then the box and the list scrolling under it, as tall as the screen leaves. */
.search-card {
  display: flex;
  flex-direction: column;
  margin: 0;
}
:root:root .search-card.banded > .band {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 0;
  font-weight: bold;
}
.close {
  min-height: 0;
  padding: 2px 4px;
}
.card-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  padding-top: 10px;
}
.card-body .box {
  width: 100%;
  padding: 6px 8px;
  font-size: 1em;
}
.card-body .list {
  flex: 1;
  max-height: none;
  min-height: 0;
}
.card-body .row {
  padding: 8px 6px;
  font-size: 1em;
}
.box {
  width: 15em;
  max-width: 100%;
  padding: 3px 6px;
  font: inherit;
  font-size: 0.9em;
}
.list {
  display: flex;
  flex-direction: column;
  max-height: min(300px, 50dvh);
  margin: 0 -4px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.row {
  display: flex;
  flex: none;
  align-items: center;
  gap: 6px;
  padding: 3px 4px;
  font: inherit;
  font-size: 0.9em;
  color: var(--text);
  text-align: left;
  white-space: nowrap;
  background: none;
  border: 0;
  cursor: pointer;
}
.row.at {
  background: var(--hover);
}
.row.on .name {
  font-weight: bold;
}
/* On, filled inside its outline, as the conditions' own chips. */
.mark {
  position: relative;
  display: inline-flex;
  flex: none;
  color: var(--muted);
}
.on .mark {
  color: var(--text);
}
.on .mark::after {
  content: '';
  position: absolute;
  inset: 4px;
  background: currentColor;
}
.on .mark.round::after {
  border-radius: 50%;
}
.count {
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
/* Where it applies, at the row's end: the field's its kind, a side's a small square of its color, as its band's. */
.scope {
  flex: none;
  margin-left: auto;
  padding-left: 12px;
  font-size: 0.85em;
  color: var(--muted);
}
.side-mark {
  flex: none;
  width: 8px;
  height: 8px;
  margin-left: auto;
  background: var(--accent);
}
.side-mark.side-b {
  background: var(--opponent);
}
.side-mark,
.scope {
  margin-right: 2px;
}
.none {
  margin: 0;
  font-size: 0.9em;
}
</style>
