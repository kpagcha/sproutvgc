<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, useTemplateRef, watch } from 'vue'
import { availableIds, pokemon, type PokemonId } from '@/data/dex'
import { POKEMON } from '@/data/pokemon'
import { locale } from '@/i18n'
import { refName } from '@/i18n/refName'
import { toTopOf } from '@/lib/scroll'
import { fold, split } from '@/lib/search'
import PokemonIcon from '@/components/PokemonIcon'
import SearchBox from '@/components/SearchBox.vue'

// Picks one of the regulation's Pokémon by name: the site's search box, with the Pokémon its text finds listed under
// it (their icons, the match marked; every one while it's empty), in a list that scrolls, picked by clicking or with
// the arrow keys and Enter. Shows the one picked once it's picked, and opening the list again brings it into view,
// ready; emptying the field unpicks it. The list is drawn on the page's body, placed under the field, so no container
// it's in (a <details>, which clips its content to animate it; a scrolling one) can cut it off.
const props = defineProps<{
  placeholder: string
  /** The Pokémon to pick from, when not every one of the regulation's. */
  ids?: readonly PokemonId[]
  /** The element around the field (a selector, for its closest ancestor) whose width the list takes (inside its
   * padding), rather than the field's, so it keeps one width as what's beside the field comes and goes. */
  listWidthOf?: string
}>()
const model = defineModel<PokemonId | null>({ required: true })

const ALL = computed(() =>
  (props.ids ?? availableIds('pokemon'))
    .filter((id) => !POKEMON[id].cosmetic)
    .map((id) => ({ id, name: refName(pokemon(id)) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale.value)),
)
const nameOf = (id: PokemonId | null) => (id ? refName(pokemon(id)) : '')

const text = ref(nameOf(model.value))
watch(model, (id) => (text.value = nameOf(id)))
watch(text, (v) => {
  if (!v.trim() && model.value) model.value = null
})
const open = ref(false)
const active = ref(0)

const results = computed(() => {
  if (!open.value) return []
  const q = fold(text.value.trim())
  // The field showing the one picked, or empty: every Pokémon, to browse.
  if (!q || text.value === nameOf(model.value))
    return ALL.value.map((m) => ({ ...m, parts: ['', '', m.name] as const }))
  return ALL.value.flatMap((m) => {
    const parts = split(m.name, q)
    return parts ? [{ ...m, parts }] : []
  })
})
// The field shows the one picked as it is, not a search being typed.
const showsPicked = computed(() => !!model.value && text.value === nameOf(model.value))
// Browsing every Pokémon from the one picked: it, in view; else the first.
watch(results, (list) => {
  const i = showsPicked.value ? list.findIndex((r) => r.id === model.value) : -1
  active.value = Math.max(i, 0)
  if (i > 0) void nextTick(() => document.getElementById(optionId(i))?.scrollIntoView({ block: 'center' }))
})

// On touch screens, picking one leaves the field, so the keyboard goes away and the page it was covering shows; with a
// mouse or keys, the focus stays for picking another.
const touch = window.matchMedia('(pointer: coarse)')
function pick(id: PokemonId) {
  model.value = id
  text.value = nameOf(id)
  open.value = false
  if (touch.matches) field.value?.querySelector('input')?.blur()
}
// On touch screens, focusing the field brings the panel it's in to the top of the screen (its heading showing where it
// is), so the list has all the room between it and the keyboard coming up; not in something stuck to the screen, which
// the page scrolls under.
const anchor = () => field.value?.closest('.panel') ?? field.value
function onFocus() {
  open.value = true
  if (touch.matches && !stuck(field.value)) toTopOf(anchor())
}
// On touch screens, tapping the field again while it's in use puts it away: the list closes and the keyboard goes.
let wasFocused = false
const onPointerDown = (e: PointerEvent) => (wasFocused = document.activeElement === e.currentTarget)
function onTap(e: MouseEvent) {
  if (touch.matches && wasFocused) (e.currentTarget as HTMLInputElement).blur()
}
function onKey(e: KeyboardEvent) {
  const n = results.value.length
  if (e.key === 'ArrowDown' && n) active.value = (active.value + 1) % n
  else if (e.key === 'ArrowUp' && n) active.value = (active.value - 1 + n) % n
  else if (e.key === 'ArrowDown' && !open.value) open.value = true
  else if (e.key === 'Enter' && n) pick(results.value[active.value]!.id)
  else if (e.key === 'Escape') {
    open.value = false
    text.value = nameOf(model.value)
  } else return
  e.preventDefault()
}
// Leaving the field closes the list and puts back the name of the one picked (a click on an option keeps the focus,
// so it picks first).
function onBlur() {
  open.value = false
  text.value = nameOf(model.value)
}

// Where the list goes: under the field, as wide (or as `listWidthOf`). Placed on the page, so it scrolls with it as
// the field does, with nothing to follow (phones' keyboards move what's fixed to the screen about, and following the
// page by its scroll events lags behind it); fixed to the screen only when the field is in something stuck to it (a
// sticky bar), following it as the page scrolls then.
const field = useTemplateRef<HTMLElement>('field')
const place = ref({ top: 0, left: 0, width: 0, height: 0 })
const fixed = ref(false)
function stuck(el: Element | null): boolean {
  for (; el && el !== document.body; el = el.parentElement) {
    const { position } = getComputedStyle(el)
    if (position === 'sticky' || position === 'fixed') return true
  }
  return false
}
function measure() {
  const r = field.value?.getBoundingClientRect()
  if (!r) return
  // `listWidthOf`'s content: inside its padding, where the field is.
  const el = props.listWidthOf ? field.value?.closest(props.listWidthOf) : null
  let along = { left: r.left, width: r.width }
  if (el) {
    const box = el.getBoundingClientRect()
    const style = getComputedStyle(el)
    const [pl, pr] = [parseFloat(style.paddingLeft), parseFloat(style.paddingRight)]
    along = { left: box.left + pl, width: box.width - pl - pr }
  }
  // As tall as the room left under the field, a dozen rows at most: down to what shows of the page, above the keyboard.
  // On touch screens, from where focusing it brings the field: its panel at the top of the screen.
  const vv = window.visualViewport
  const [shownTop, shownBottom] = vv ? [vv.offsetTop, vv.offsetTop + vv.height] : [0, window.innerHeight]
  const below = r.bottom - (anchor()?.getBoundingClientRect().top ?? r.top)
  const fieldBottom = touch.matches && !fixed.value ? shownTop + 12 + below : r.bottom
  const [dx, dy] = fixed.value ? [0, 0] : [window.scrollX, window.scrollY]
  place.value = {
    top: r.bottom + 4 + dy,
    left: along.left + dx,
    width: along.width,
    height: shownBottom - fieldBottom - 16,
  }
}
// Only what's stuck to the screen follows the page's scrolling, and anything scrolling the field within the page.
const onScroll = (e: Event) => (fixed.value || e.target !== document) && measure()
watch(
  () => results.value.length > 0,
  (shown) => {
    if (shown) {
      fixed.value = stuck(field.value)
      measure()
      window.addEventListener('scroll', onScroll, { passive: true, capture: true })
      window.addEventListener('resize', measure)
      window.visualViewport?.addEventListener('resize', measure)
    } else {
      window.removeEventListener('scroll', onScroll, { capture: true })
      window.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('resize', measure)
    }
  },
)
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll, { capture: true })
  window.removeEventListener('resize', measure)
  window.visualViewport?.removeEventListener('resize', measure)
})

watch(active, (i) => queueMicrotask(() => document.getElementById(optionId(i))?.scrollIntoView({ block: 'nearest' })))

const listId = useId()
const optionId = (i: number) => `${listId}-${i}`
</script>

<template>
  <div ref="field" class="picker">
    <SearchBox
      v-model="text"
      :placeholder="props.placeholder"
      :aria-label="props.placeholder"
      role="combobox"
      autocomplete="off"
      :aria-expanded="results.length > 0"
      :aria-controls="listId"
      :aria-activedescendant="results.length ? optionId(active) : undefined"
      @input="open = true"
      @focus="onFocus"
      @pointerdown="onPointerDown"
      @click="onTap"
      @blur="onBlur"
      @keydown="onKey"
    />
    <Teleport to="body">
      <ul
        v-if="results.length"
        :id="listId"
        class="options"
        :class="{ fixed }"
        role="listbox"
        :style="{
          top: `${place.top}px`,
          left: `${place.left}px`,
          width: `${place.width}px`,
          maxHeight: `min(${Math.max(place.height, 120)}px, 24em)`,
        }"
      >
        <li
          v-for="(r, i) in results"
          :id="optionId(i)"
          :key="r.id"
          role="option"
          class="option"
          :class="{ active: i === active }"
          :aria-selected="i === active"
          @mousedown.prevent="pick(r.id)"
          @mouseenter="active = i"
        >
          <PokemonIcon :id="r.id" />
          <span
            >{{ r.parts[0] }}<mark>{{ r.parts[1] }}</mark
            >{{ r.parts[2] }}</span
          >
        </li>
      </ul>
    </Teleport>
  </div>
</template>

<style scoped>
.picker {
  position: relative;
}
.picker :deep(.search-box) {
  margin: 0;
}
/* The options: a card under the field, as the site's surfaces are. */
.options {
  position: absolute;
  z-index: 20;
  overflow-y: auto;
  overscroll-behavior: contain;
  margin: 0;
  padding: 2px;
  list-style: none;
  background: var(--panel);
  border: 2px solid var(--ink);
  box-shadow: var(--hard);
  /* Following the room left as the keyboard comes and goes, rather than jumping to it. */
  transition: max-height 0.2s ease-out;
}
.options.fixed {
  position: fixed;
}
@media (prefers-reduced-motion: reduce) {
  .options {
    transition: none;
  }
}
.option {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 6px 0 2px;
  cursor: pointer;
}
.option.active {
  background: var(--sel);
}
</style>
