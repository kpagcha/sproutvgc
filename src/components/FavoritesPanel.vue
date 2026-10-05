<script setup lang="ts">
import { computed } from 'vue'
import { Star } from '@lucide/vue'
import { available } from '@/data/dex'
import { locale, t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { SECTIONS } from '@/composables/useSearch'
import { useFavorites } from '@/composables/useFavorites'
import { useOpenState } from '@/composables/useOpenState'
import EntryChip from '@/components/EntryChip.vue'

// The home page's favorites: the entries starred on their pages, one row per category (in the search's order), each
// alphabetically, as chips (`EntryChip`). Those the regulation doesn't have are
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

const { open, onToggle } = useOpenState('sproutvgc.favorites.open')
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
          <EntryChip v-for="{ ref: r } in g.refs" :key="r.id" :to="r" />
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
