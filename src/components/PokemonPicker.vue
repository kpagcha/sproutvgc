<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, useTemplateRef, watch } from 'vue'
import type { PokemonId } from '@/data/dex'
import { pokemonName as nameOf, usePokemonSearch } from '@/composables/usePokemonSearch'
import ModalDialog from '@/components/ModalDialog.vue'
import PokemonIcon from '@/components/PokemonIcon'
import PokemonSearchPanel from '@/components/PokemonSearchPanel.vue'
import SearchBox from '@/components/SearchBox.vue'

// Picks one of the regulation's Pokémon by name: the site's search box, with the Pokémon its text finds listed under
// it (their icons, the match marked; every one while it's empty), in a list that scrolls, picked by clicking or with
// the arrow keys and Enter. Shows the one picked once it's picked, and opening the list again brings it into view,
// ready; emptying the field unpicks it. The list is drawn on the page's body, placed under the field, so no container
// it's in (a <details>, which clips its content to animate it; a scrolling one) can cut it off. On phones, the field
// opens a screen of its own instead: a search box on top and the list under it, filling the rest, the page under it
// left where it was.
const props = defineProps<{
  placeholder: string
  /** The Pokémon to pick from, when not every one of the regulation's. */
  ids?: readonly PokemonId[]
  /** The element around the field (a selector, for its closest ancestor) whose width the list takes (inside its
   * padding), rather than the field's, so it keeps one width as what's beside the field comes and goes. */
  listWidthOf?: string
  /** Shows the one picked's icon at the field's start; none picked, a silhouette, asking who. */
  icon?: boolean
  /** On phones, the band on top of the dialog's card saying what it's picking for, in its side's color. */
  title?: string
  tone?: 'yours' | 'opponent'
}>()
const model = defineModel<PokemonId | null>({ required: true })

const text = ref(nameOf(model.value))
watch(model, (id) => (text.value = nameOf(id)))
watch(text, (v) => {
  if (!v.trim() && model.value) model.value = null
})
const open = ref(false)
const active = ref(0)

const { results, showsPicked } = usePokemonSearch(
  () => props.ids,
  text,
  () => model.value,
  () => open.value,
)
// Browsing every Pokémon from the one picked: it, in view; else the first.
watch(results, (list) => {
  const i = showsPicked.value ? list.findIndex((r) => r.id === model.value) : -1
  active.value = Math.max(i, 0)
  if (i > 0) void nextTick(() => showOption(i, true))
})

// Phones (as wide as 720px) pick in a dialog over the page (`sheet`), its card the search panel.
const phoneQuery = window.matchMedia('(max-width: 720px)')
const phone = ref(phoneQuery.matches)
const onPhone = (e: MediaQueryListEvent) => (phone.value = e.matches)
phoneQuery.addEventListener('change', onPhone)
onBeforeUnmount(() => phoneQuery.removeEventListener('change', onPhone))
const sheet = ref(false)
const openSheet = () => (sheet.value = true)

// On touch screens, picking one leaves the field, so the keyboard goes away and the page it was covering shows; with a
// mouse or keys, the focus stays for picking another. On phones, it closes the screen it was picked on.
const touch = window.matchMedia('(pointer: coarse)')
function pick(id: PokemonId) {
  keepTop = field.value?.getBoundingClientRect().top ?? null
  model.value = id
  text.value = nameOf(id)
  open.value = false
  sheet.value = false
  if (touch.matches) field.value?.querySelector('input')?.blur()
}
// Whatever the pick changes above the field once the page has it (a panel appearing), the field stays where it was on
// the screen.
let keepTop: number | null = null
watch(
  model,
  () => {
    if (keepTop === null) return
    const top = keepTop
    keepTop = null
    requestAnimationFrame(() => {
      const now = field.value?.getBoundingClientRect().top
      if (now !== undefined && Math.abs(now - top) > 1) window.scrollBy({ top: now - top, behavior: 'instant' })
    })
  },
  { flush: 'post' },
)
// Focusing the field opens the list, leaving the page where it is (on touch screens, the browser keeps the field in
// view of the keyboard on its own).
function onFocus() {
  if (!phone.value) open.value = true
}
// On touch screens, a tap on the field focuses it here, without the browser scrolling the page to it as it does on its
// own (the keyboard coming up may still move it, to keep the field in view): the list opens where it is, in the
// direction that has room. A swipe starting on the field scrolls the page as usual.
let touchAt: { x: number; y: number } | null = null
function onTouchStart(e: TouchEvent) {
  const p = e.touches[0]
  touchAt = p ? { x: p.clientX, y: p.clientY } : null
}
function onTouchEnd(e: TouchEvent) {
  const input = e.currentTarget as HTMLInputElement
  const p = e.changedTouches[0]
  if (phone.value || !touchAt || !p || document.activeElement === input) return
  if (Math.hypot(p.clientX - touchAt.x, p.clientY - touchAt.y) > 10) return
  e.preventDefault()
  input.focus({ preventScroll: true })
}
// On touch screens, tapping the field again while it's in use puts it away: the list closes and the keyboard goes.
let wasFocused = false
const onPointerDown = (e: PointerEvent) => (wasFocused = document.activeElement === e.currentTarget)
function onTap(e: MouseEvent) {
  if (phone.value) void openSheet()
  else if (touch.matches && wasFocused) (e.currentTarget as HTMLInputElement).blur()
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
const place = ref({ top: 0, left: 0, width: 0, up: false })
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
  // Under the field, unless the list's height doesn't fit under it and there's more room over it: then over it. On
  // touch screens, under it means above the keyboard coming up, which takes about the screen's lower half. Which one is
  // settled as it opens, so the list doesn't hop from one to the other as the keyboard comes.
  const [dx, dy] = fixed.value ? [0, 0] : [window.scrollX, window.scrollY]
  const floor = window.innerHeight * (touch.matches ? 0.55 : 1)
  const up = opening ? floor - r.bottom < LIST_HEIGHT() && r.top > floor - r.bottom : place.value.up
  opening = false
  place.value = {
    top: (up ? r.top - 4 : r.bottom + 4) + dy,
    left: along.left + dx,
    width: along.width,
    up,
  }
}
/**
 * The list's height, whatever the screen: a few rows on touch screens, where a keyboard takes half of it, more with a
 * mouse. Fewer results, a shorter list.
 */
/** An option's height, as the styles set it. */
const ROW = 30
const ROWS = () => (touch.matches ? 6 : 8)
const LIST_HEIGHT = () => ROWS() * ROW + 8
let opening = false
// Only what's stuck to the screen follows the page's scrolling, and anything scrolling the field within the page.
const onScroll = (e: Event) => (fixed.value || e.target !== document) && measure()
const list = useTemplateRef<HTMLElement>('list')
watch(
  () => results.value.length > 0,
  (shown) => {
    if (shown) {
      fixed.value = stuck(field.value)
      opening = true
      measure()
      window.addEventListener('scroll', onScroll, { passive: true, capture: true })
      window.addEventListener('resize', measure)
    } else {
      window.removeEventListener('scroll', onScroll, { capture: true })
      window.removeEventListener('resize', measure)
    }
  },
)
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll, { capture: true })
  window.removeEventListener('resize', measure)
})

/**
 * Brings an option into view within the list, centered or at the nearest edge: by the list's own scroll, as
 * `scrollIntoView` scrolls everything around it too, the page with it.
 */
function showOption(i: number, center = false) {
  const el = list.value
  const opt = document.getElementById(optionId(i))
  if (!el || !opt) return
  const top = opt.offsetTop
  const bottom = top + opt.offsetHeight
  if (center) el.scrollTop = top - (el.clientHeight - opt.offsetHeight) / 2
  else if (top < el.scrollTop) el.scrollTop = top
  else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight
}
watch(active, (i) => queueMicrotask(() => showOption(i)))

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
      :readonly="phone"
      :aria-haspopup="phone ? 'dialog' : undefined"
      :aria-expanded="phone ? sheet : results.length > 0"
      :aria-controls="phone ? undefined : listId"
      :aria-activedescendant="results.length ? optionId(active) : undefined"
      @input="open = true"
      @focus="onFocus"
      @pointerdown="onPointerDown"
      @touchstart.passive="onTouchStart"
      @touchend="onTouchEnd"
      @click="onTap"
      @blur="onBlur"
      @keydown="onKey"
    >
      <template v-if="props.icon" #lead>
        <PokemonIcon :id="model ?? 'pikachu'" :class="{ unknown: !model }" />
      </template>
    </SearchBox>
    <Teleport to="body">
      <ul
        v-if="results.length"
        :id="listId"
        ref="list"
        class="options"
        :class="{ fixed, up: place.up }"
        role="listbox"
        :style="{
          top: `${place.top}px`,
          left: `${place.left}px`,
          width: `${place.width}px`,
          maxHeight: `${LIST_HEIGHT()}px`,
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
    <!-- On phones: a dialog over the page, its card the search panel (made anew each time it opens). -->
    <ModalDialog v-if="phone" v-model:open="sheet" :label="props.placeholder" fill>
      <PokemonSearchPanel
        v-if="sheet"
        :placeholder="props.placeholder"
        :picked="model"
        :ids="props.ids"
        :icon="props.icon"
        :title="props.title"
        :tone="props.tone"
        @pick="pick"
        @close="sheet = false"
      />
    </ModalDialog>
  </div>
</template>

<style scoped>
.picker {
  position: relative;
}
.picker :deep(.search-box) {
  margin: 0;
}
.unknown {
  filter: brightness(0);
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
}
.options.fixed {
  position: fixed;
}
/* Over the field: placed by its bottom edge, at the field's top. */
.options.up {
  transform: translateY(-100%);
}
.option {
  display: flex;
  align-items: center;
  height: 30px;
  gap: 4px;
  padding: 0 6px 0 2px;
  cursor: pointer;
}
.option.active {
  background: var(--sel);
}
/* On phones, the field opens the dialog: no caret, no keyboard. */
.picker :deep(input[readonly]) {
  cursor: pointer;
}
</style>
