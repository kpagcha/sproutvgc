<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronDown, Star } from '@lucide/vue'
import { available, pokemon, type Kind, type PokemonId } from '@/data/dex'
import { locale, t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { useFavorites } from '@/composables/useFavorites'
import EntryChip from '@/components/EntryChip.vue'
import PageChip, { shownVisit } from '@/components/PageChip.vue'

// Beside a page's way back, the reader's favorites of its kind, in a drop-down: an entry page's, the entries of its
// category starred (alphabetically, those the regulation has), as the home page's chips (a meta entry's, the meta
// entries starred); the speed pages', their
// setups starred (in the order they were starred). On pages with nothing to star, nothing. On phones, the star alone.
// Closed by a press outside it, Escape, or going anywhere.
const props = defineProps<{ page: string }>()

/** The entry pages, by their route's name, and the category each shows. */
const KINDS: Partial<Record<string, Kind>> = {
  pokemon: 'pokemon',
  move: 'move',
  ability: 'ability',
  item: 'item',
  condition: 'condition',
}
/** The pages whose setups can be starred. */
const SETUP_PAGES = ['speedTiers', 'speedCompare']

const { favorites, metaEntries, setups } = useFavorites()
const kind = computed(() => KINDS[props.page])
/** A Pokémon's meta entry: the meta entries starred. */
const meta = computed(() => props.page === 'metaPokemon')
const shown = computed(() => !!kind.value || meta.value || SETUP_PAGES.includes(props.page))
const metaRefs = computed(() =>
  !meta.value
    ? []
    : metaEntries.value
        .map((id) => pokemon(id as PokemonId))
        .filter((r) => available(r))
        .map((r) => ({ ref: r, name: refName(r) }))
        .sort((a, b) => a.name.localeCompare(b.name, locale.value)),
)
const refs = computed(() =>
  kind.value
    ? favorites.value
        .filter((r) => r.kind === kind.value && available(r))
        .map((r) => ({ ref: r, name: refName(r) }))
        .sort((a, b) => a.name.localeCompare(b.name, locale.value))
    : [],
)
const pageSetups = computed(() => setups.value.filter((v) => v.page === props.page && shownVisit(v)))
const count = computed(() => refs.value.length + metaRefs.value.length + pageSetups.value.length)

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
const route = useRoute()
watch(
  () => route.fullPath,
  () => (open.value = false),
)
onBeforeUnmount(() => (open.value = false))
</script>

<template>
  <div v-if="shown" ref="root" class="favorites-menu">
    <button
      type="button"
      class="btn toggle"
      :aria-expanded="open"
      :aria-label="t('favorites.title')"
      @click="open = !open"
    >
      <span class="label">{{ t('favorites.title') }}</span
      ><Star :size="16" :stroke-width="2.5" class="star" :class="{ filled: count }" aria-hidden="true" /><span
        v-if="count"
        class="count"
        >{{ count }}</span
      ><ChevronDown :size="14" class="chevron" :class="{ open }" aria-hidden="true" />
    </button>
    <div v-if="open" class="pop panel">
      <div v-if="count" class="chips">
        <EntryChip v-for="{ ref: r } in refs" :key="r.id" :to="r" />
        <EntryChip v-for="{ ref: r } in metaRefs" :key="r.id" :to="r" meta />
        <PageChip v-for="(v, i) in pageSetups" :key="i" :visit="v" />
      </div>
      <p v-else class="muted empty">{{ t('favorites.menuEmpty') }}</p>
    </div>
  </div>
</template>

<style scoped>
/* A flex box, so its button fills the row's height as the rest of the back row does. */
.favorites-menu {
  position: relative;
  display: flex;
}
.toggle {
  gap: 4px;
  min-height: 0;
  padding: 3px 8px;
}
.star {
  color: var(--accent);
}
.star.filled {
  fill: currentColor;
}
.count {
  font-size: 0.85em;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.chevron {
  transition: transform 0.15s;
}
.chevron.open {
  transform: rotate(180deg);
}
/* Under the button, over the page: as many chips as fit across, scrolling past a screenful. */
.pop {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 60;
  width: max-content;
  max-width: min(480px, calc(100vw - 32px));
  max-height: 60vh;
  overflow-y: auto;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.empty {
  max-width: 260px;
  margin: 0;
  font-size: 0.875em;
}
/* A chip too wide for it cut, not the drop-down widened. */
.chips > * {
  max-width: 100%;
  overflow: hidden;
}
/* On phones, the star alone (the name still read out), the drop-down across the row it's in (the back row, which
   places it) rather than from the star, so it stays on the screen. */
@media (max-width: 720px) {
  .favorites-menu {
    position: static;
  }
  .pop {
    right: 0;
    width: auto;
    max-width: none;
  }
  .label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}
</style>
