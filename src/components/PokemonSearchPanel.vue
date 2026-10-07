<script setup lang="ts">
import Marked from '@/components/Marked'
import { nextTick, onMounted, ref, useId, useTemplateRef, watch } from 'vue'
import { X } from '@lucide/vue'
import type { PokemonId } from '@/data/dex'
import { t } from '@/i18n'
import { pokemonName, usePokemonSearch } from '@/composables/usePokemonSearch'
import PokemonIcon from '@/components/PokemonIcon'
import SearchBox from '@/components/SearchBox.vue'

// A card to pick a Pokémon in: a search box on top, with a way out, and the Pokémon it finds listed under it, filling
// the rest, picked by a tap or with the arrow keys and Enter. It opens on the one picked (its name selected, so typing
// replaces it, and the list at it). Emptying the search doesn't unpick: picking or closing is up to the reader. In a
// dialog, the Pokémon pickers' on phones.
const props = defineProps<{
  placeholder: string
  /** The one picked, if any. */
  picked: PokemonId | null
  /** The Pokémon to pick from, when not every one of the regulation's. */
  ids?: readonly PokemonId[]
  /** Shows the one picked's icon at the search's start; none picked, a silhouette, asking who. */
  icon?: boolean
  /** A band on top saying what it's picking for, in its side's color: yours blue, an opponent red. */
  title?: string
  tone?: 'yours' | 'opponent'
}>()
const emit = defineEmits<{ pick: [id: PokemonId]; close: [] }>()

const text = ref(pokemonName(props.picked))
const { results, showsPicked } = usePokemonSearch(
  () => props.ids,
  text,
  () => props.picked,
)
const active = ref(0)
// Browsing every Pokémon from the one picked: it, in view, centered; else the first.
watch(
  results,
  (list) => {
    const i = showsPicked.value ? list.findIndex((r) => r.id === props.picked) : -1
    active.value = Math.max(i, 0)
    if (i > 0) void nextTick(() => showOption(i, true))
  },
  { immediate: true },
)

const box = useTemplateRef<InstanceType<typeof SearchBox>>('box')
// Once in (a dialog shows it after it's made), its search ready to type in.
onMounted(() =>
  requestAnimationFrame(() => {
    box.value?.focus({ preventScroll: true })
    box.value?.select()
  }),
)

function onKey(e: KeyboardEvent) {
  const n = results.value.length
  if (e.key === 'ArrowDown' && n) active.value = (active.value + 1) % n
  else if (e.key === 'ArrowUp' && n) active.value = (active.value - 1 + n) % n
  else if (e.key === 'Enter' && n) emit('pick', results.value[active.value]!.id)
  // The search box would take Escape to empty itself: here it closes, as the dialog's would.
  else if (e.key === 'Escape') emit('close')
  else return
  e.preventDefault()
}

/** Brings an option into view within the list (centered, or at the nearest edge), by the list's own scroll alone. */
const list = useTemplateRef<HTMLElement>('list')
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
  <div class="panel search-panel">
    <div v-if="props.title" class="title-band" :class="props.tone">{{ props.title }}</div>
    <div class="head">
      <SearchBox
        ref="box"
        v-model="text"
        :placeholder="props.placeholder"
        :aria-label="props.placeholder"
        role="combobox"
        autocomplete="off"
        aria-expanded="true"
        :aria-controls="listId"
        :aria-activedescendant="results.length ? optionId(active) : undefined"
        @keydown="onKey"
      >
        <template v-if="props.icon" #lead>
          <PokemonIcon :id="props.picked ?? 'pikachu'" :class="{ unknown: !props.picked }" />
        </template>
      </SearchBox>
      <button type="button" class="btn close" :aria-label="t('picker.close')" @click="emit('close')">
        <X :size="18" aria-hidden="true" />
      </button>
    </div>
    <ul :id="listId" ref="list" class="list" role="listbox">
      <li
        v-for="(r, i) in results"
        :id="optionId(i)"
        :key="r.id"
        role="option"
        class="option"
        :class="{ active: i === active }"
        :aria-selected="i === active"
        @click="emit('pick', r.id)"
      >
        <PokemonIcon :id="r.id" />
        <span><Marked :p="r.parts" /></span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* The search box and the way out on top, the list scrolling under them, its rows roomy for fingers. */
.search-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0;
  overflow: hidden;
}
.title-band {
  padding: 6px 12px;
  font-weight: bold;
  color: var(--text);
  background: var(--panel-alt);
  border-bottom: 2px solid var(--ink);
}
.title-band.yours {
  color: var(--accent-text);
  background: var(--accent);
}
.title-band.opponent {
  color: var(--opponent-text);
  background: var(--opponent);
}
.head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--panel);
  border-bottom: 2px solid var(--ink);
}
.head :deep(.search-box) {
  flex: 1;
  max-width: none;
  margin: 0;
}
.close {
  flex: none;
  padding: 6px;
}
.list {
  position: relative;
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 4px 8px;
  overflow-y: auto;
  overscroll-behavior: contain;
  list-style: none;
}
.option {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 44px;
  padding: 0 6px 0 2px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
}
.option.active {
  background: var(--sel);
}
.unknown {
  filter: brightness(0);
}
</style>
