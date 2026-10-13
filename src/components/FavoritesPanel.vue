<script setup lang="ts">
import { computed } from 'vue'
import { Star, Trash2 } from '@lucide/vue'
import { available, type Kind } from '@/data/dex'
import { locale, t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { SECTIONS } from '@/composables/useSearch'
import { useFavorites } from '@/composables/useFavorites'
import { useOpenState } from '@/composables/useOpenState'
import { confirmDialog } from '@/composables/useConfirm'
import EntryChip from '@/components/EntryChip.vue'
import PageChip, { shownVisit } from '@/components/PageChip.vue'

// The home page's favorites: the entries starred on their pages, one row per category (in the search's order), each
// alphabetically, as chips (`EntryChip`); then the setups starred (the speed tiers', a comparison's), in the order they
// // were starred (`PageChip`). Those the regulation doesn't have are left out (and kept, for when it has them again).
// Nothing shows until something is starred. It folds away, and stays as the reader left it. It can be cleared, whole or
// a row at a time, once confirmed, as starring them again would take a while.
const { favorites, setups, clear, clearKind, countKind, count: saved } = useFavorites()

const groups = computed(() =>
  SECTIONS.flatMap((s) => {
    const refs = favorites.value
      .filter((r) => r.kind === s.kind && available(r))
      .map((r) => ({ ref: r, name: refName(r) }))
      .sort((a, b) => a.name.localeCompare(b.name, locale.value))
    return refs.length ? [{ kind: s.kind, title: s.title, refs }] : []
  }),
)
const shownSetups = computed(() => setups.value.filter(shownVisit))
const count = computed(() => groups.value.reduce((n, g) => n + g.refs.length, 0) + shownSetups.value.length)

const { open, onToggle } = useOpenState('sproutvgc.favorites.open')

async function confirmClear() {
  const ok = await confirmDialog({
    message: t('favorites.clearConfirm', { n: saved() }),
    confirm: t('favorites.clearConfirmButton'),
    danger: true,
  })
  if (ok) clear()
}

/** Clears a row: a category's favorites, or the setups. */
async function confirmClearKind(kind: Kind | 'setups', title: string) {
  const ok = await confirmDialog({
    message: t('favorites.clearKindConfirm', { n: countKind(kind), category: title }),
    confirm: t('favorites.clearConfirmButton'),
    danger: true,
  })
  if (ok) clearKind(kind)
}
</script>

<template>
  <details v-if="count" class="panel banded favorites" :open @toggle="onToggle">
    <summary>
      <h2 class="title">
        <Star :size="16" :stroke-width="2.5" aria-hidden="true" />{{ t('favorites.title') }}
        <span class="count muted">{{ count }}</span>
      </h2>
      <button type="button" class="btn on-band inverted clear" @click.prevent="confirmClear">
        <Trash2 :size="14" aria-hidden="true" />{{ t('favorites.clear') }}
      </button>
    </summary>
    <dl>
      <template v-for="g in groups" :key="g.kind">
        <dt class="muted">
          {{ t(g.title)
          }}<button
            v-tip="t('favorites.clearKind', { category: t(g.title) })"
            type="button"
            class="clear-kind"
            :aria-label="t('favorites.clearKind', { category: t(g.title) })"
            @click="confirmClearKind(g.kind, t(g.title))"
          >
            <Trash2 :size="13" aria-hidden="true" />
          </button>
        </dt>
        <dd>
          <EntryChip v-for="{ ref: r } in g.refs" :key="r.id" :to="r" />
        </dd>
      </template>
      <template v-if="shownSetups.length">
        <dt class="muted">
          {{ t('favorites.setups')
          }}<button
            v-tip="t('favorites.clearKind', { category: t('favorites.setups') })"
            type="button"
            class="clear-kind"
            :aria-label="t('favorites.clearKind', { category: t('favorites.setups') })"
            @click="confirmClearKind('setups', t('favorites.setups'))"
          >
            <Trash2 :size="13" aria-hidden="true" />
          </button>
        </dt>
        <dd>
          <PageChip v-for="(v, i) in shownSetups" :key="i" :visit="v" />
        </dd>
      </template>
    </dl>
  </details>
</template>

<style scoped>
/* Not one of the dex's sections: a panel variant (retro.css), `banded` (its heading a band of the accent color across
   the top), `tinted` or `sunken`. Not banded, the heading is only as wide as its text, and spaced from the favorites. */
.favorites > summary {
  position: relative;
  cursor: pointer;
}
/* Clearing sits at the band's end, a band button as the speed tiers' clear is, as on the recently viewed. */
.clear {
  position: absolute;
  top: 50%;
  right: 12px;
  translate: 0 -50%;
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
/* A row's own clear, small, after its name. */
dt {
  display: flex;
  align-items: center;
  gap: 4px;
}
.clear-kind {
  display: inline-flex;
  padding: 2px;
  color: var(--muted);
  background: none;
  border: 0;
  cursor: pointer;
}
.clear-kind:hover,
.clear-kind:focus-visible {
  color: var(--text);
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
