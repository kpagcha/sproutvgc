<script setup lang="ts">
import { onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { ChevronDown, Trash2, X } from '@lucide/vue'
import { pokemon, type PokemonId } from '@/data/dex'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import PokemonIcon from '@/components/PokemonIcon'

// The Pokémon kept on the speed tiers' ladder (found beyond its top, and kept there), in a drop-down from a button
// saying how many: each its name, which finds it (marked while it's the one found), and a cross taking it off; then a
// way to take them all off. Closed by a press outside it or Escape. On phones it drops across the row it's in, which
// places it.
defineProps<{ ids: readonly PokemonId[]; found: PokemonId | null }>()
const emit = defineEmits<{ find: [id: PokemonId]; remove: [id: PokemonId]; clear: [] }>()

const open = ref(false)
const root = useTemplateRef<HTMLElement>('root')
function onPointerDown(e: PointerEvent) {
  if (!root.value?.contains(e.target as Node)) open.value = false
}
const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (open.value = false)
watch(open, (on) => {
  if (on) {
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
  } else {
    document.removeEventListener('pointerdown', onPointerDown)
    document.removeEventListener('keydown', onKey)
  }
})
onBeforeUnmount(() => (open.value = false))
function clear() {
  open.value = false
  emit('clear')
}
</script>

<template>
  <div ref="root" class="kept-menu">
    <button type="button" class="btn toggle" :aria-expanded="open" @click="open = !open">
      {{ t('speed.kept') }}<span class="count">{{ ids.length }}</span
      ><ChevronDown :size="14" class="chevron" :class="{ open }" aria-hidden="true" />
    </button>
    <div v-if="open" class="pop panel">
      <ul class="list">
        <li v-for="id in ids" :key="id" class="row" :class="{ found: id === found }">
          <button type="button" class="find" :aria-pressed="id === found" @click="emit('find', id)">
            <PokemonIcon :id />{{ refName(pokemon(id)) }}
          </button>
          <button
            type="button"
            class="remove"
            :aria-label="t('speed.unkeep', { name: refName(pokemon(id)) })"
            @click="emit('remove', id)"
          >
            <X :size="14" aria-hidden="true" />
          </button>
        </li>
      </ul>
      <button type="button" class="btn inverted all" @click="clear">
        <Trash2 :size="14" aria-hidden="true" />{{ t('speed.unkeepAll') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.kept-menu {
  position: relative;
  display: flex;
}
.toggle {
  gap: 6px;
}
.count {
  font-variant-numeric: tabular-nums;
  color: var(--muted);
}
.chevron {
  transition: transform 0.15s;
}
.chevron.open {
  transform: rotate(180deg);
}
/* Under the button, over the page, from its right edge (it's at the end of its row). */
.pop {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 60;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: max-content;
  min-width: 14em;
  max-width: min(360px, calc(100vw - 32px));
  max-height: 60vh;
  margin: 0;
  overflow-y: auto;
}
.list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}
.row {
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid var(--border);
}
.row.found {
  background: var(--sel);
}
.row > button {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  font: inherit;
  color: var(--text);
  background: none;
  border: none;
  cursor: pointer;
}
.row > button:hover {
  background: var(--hover);
}
.find {
  flex: 1;
  gap: 6px;
  padding: 0 8px 0 2px;
  text-align: left;
}
.find :deep(.sheet-icon) {
  margin-block: -8px;
}
.remove {
  padding: 0 8px;
  color: var(--muted) !important;
}
.remove:hover {
  color: var(--text) !important;
}
.all {
  align-self: flex-start;
  gap: 4px;
}
/* On phones, across the row it's in (which places it), rather than from the button, so it stays on the screen. */
@media (max-width: 720px) {
  .kept-menu {
    position: static;
  }
  .pop {
    left: 0;
    width: auto;
    max-width: none;
  }
}
</style>
