<script setup lang="ts">
import { computed, ref, shallowRef, watchEffect } from 'vue'
import { Star } from '@lucide/vue'
import { available, type ItemId, type MoveId, type PokemonId } from '@/data/dex'
import type { Move } from '@/data/moves'
import { locale, t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { SECTIONS } from '@/composables/useSearch'
import { useFavorites } from '@/composables/useFavorites'
import { follow, refHref } from '@/lib/links'
import ItemIcon from '@/components/ItemIcon.vue'
import PokemonIcon from '@/components/PokemonIcon'
import TypeIcon from '@/components/TypeIcon'

// The home page's favorites: the entries starred on their pages, a panel above the dex's sections, one row per category
// (in the sections' order), each alphabetically, with its icon (a move its type). Those the regulation doesn't have are
// left out (and kept, for when it has them again). Nothing shows until something is starred. It folds away, and stays
// as the reader left it.
const { favorites } = useFavorites()

const groups = computed(() =>
  SECTIONS.flatMap((s) => {
    const refs = favorites.value
      .filter((r) => r.kind === s.kind && available(r))
      .map((r) => ({ ref: r, name: refName(r) }))
      .sort((a, b) => a.name.localeCompare(b.name, locale.value))
    return refs.length ? [{ kind: s.kind, title: s.title, refs }] : []
  }),
)
const count = computed(() => groups.value.reduce((n, g) => n + g.refs.length, 0))

// The moves' data, for their types, loads only once a move is starred: the home page doesn't need it otherwise.
const moves = shallowRef<Record<MoveId, Move> | null>(null)
watchEffect(async () => {
  if (!moves.value && favorites.value.some((r) => r.kind === 'move')) moves.value = (await import('@/data/moves')).MOVES
})
const moveType = (id: string) => moves.value?.[id as MoveId]?.type

const OPEN_KEY = 'sproutvgc.favorites.open'
function readOpen() {
  try {
    return localStorage.getItem(OPEN_KEY) !== '0'
  } catch {
    return true
  }
}
const open = ref(readOpen())
function onToggle(e: Event) {
  open.value = (e.target as HTMLDetailsElement).open
  try {
    localStorage.setItem(OPEN_KEY, open.value ? '1' : '0')
  } catch {
    // Storage unavailable: the choice lasts for this page load.
  }
}
</script>

<template>
  <details v-if="count" class="panel banded favorites" :open @toggle="onToggle">
    <summary>
      <h2 class="title">
        <Star :size="16" :stroke-width="2.5" aria-hidden="true" />{{ t('favorites.title') }}
        <span class="count muted">{{ count }}</span>
      </h2>
    </summary>
    <dl>
      <template v-for="g in groups" :key="g.kind">
        <dt class="muted">{{ t(g.title) }}</dt>
        <dd>
          <a v-for="{ ref: r, name } in g.refs" :key="r.id" :href="refHref(r)" class="fav" @click="follow">
            <PokemonIcon v-if="r.kind === 'pokemon'" :id="r.id as PokemonId" />
            <ItemIcon v-else-if="r.kind === 'item'" :id="r.id as ItemId" />
            <TypeIcon v-else-if="r.kind === 'move' && moveType(r.id)" :type="moveType(r.id)!" />
            {{ name }}
          </a>
        </dd>
      </template>
    </dl>
  </details>
</template>

<style scoped>
/* Not one of the dex's sections: a panel variant (retro.css), `banded` (its heading a band of the accent color across
   the top), `tinted` or `sunken`. Not banded, the heading is only as wide as its text, and spaced from the favorites. */
.favorites > summary {
  cursor: pointer;
}
.favorites:not(.banded) > summary {
  width: fit-content;
}
.favorites:not(.banded)[open] > summary {
  margin-bottom: 10px;
}
/* Inline, so the marker sits on the heading's line, the star centered on its text. */
.title {
  display: inline;
  margin: 0;
}
.title .lucide {
  margin: 0 6px 0 2px;
  vertical-align: -0.125em;
  color: var(--accent);
  fill: currentColor;
}
.count {
  margin-left: 4px;
  font-size: 0.8em;
}
/* On the band, the star and the count in the band's color. */
.banded .title .lucide {
  color: inherit;
}
.banded .count {
  color: inherit;
  opacity: 0.75;
}
/* A row per category: its name, then its favorites. */
dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px 16px;
  align-items: baseline;
  margin: 0;
}
dt {
  font-size: 0.75em;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
dd {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
}
/* Flat chips, like the filters', all the same height whether or not they have an icon. */
.fav {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 0 10px;
  color: var(--text);
  background: var(--panel-alt);
  border: 1px solid var(--border);
  border-radius: 3px;
}
.fav:hover {
  text-decoration: none;
  background: var(--hover);
  border-color: var(--border-strong);
}
.fav :deep(.sheet-icon) {
  margin: -4px 0;
}
/* Phones: each category's name above its favorites. */
@media (max-width: 560px) {
  dl {
    grid-template-columns: 1fr;
    gap: 4px;
  }
  dd + dt {
    margin-top: 6px;
  }
}
</style>
