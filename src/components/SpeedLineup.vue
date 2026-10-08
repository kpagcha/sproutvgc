<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { ChevronDown } from '@lucide/vue'
import type { PokemonId } from '@/data/dex'
import { t } from '@/i18n'
import type { SpeedBuild } from '@/lib/speedBuild'
import type { Place } from '@/lib/speedLineup'
import BuildSummary from '@/components/BuildSummary.vue'

// The comparison's Pokémon one under the other, past a pair: each a band of its team's color (none in speed order)
// with its place in the move order, numbered (one tied with another sharing its number, marked `=`), and its Pokémon
// in short. Tapping one opens what changes it under it (the `editor` slot), tapping it again folds it. While one is
// open the bands keep their order, so what's being changed stays put; once none is, they move to the order they move
// in, sliding there. The bands stick to the top, piling up as the page scrolls, so every one stays in view; a list too
// long for that keeps the open one alone in view. Under them, what the page adds (the `after` slot: rows adding one).
export interface LineupEntry {
  key: string
  team: 'yours' | 'opponent' | null
  id: PokemonId | null
  build: SpeedBuild
  speed: number | null
  /** Its place in the move order, once picked. */
  place: Place | null
}
const props = defineProps<{
  /** In the order they move, any not picked yet last. */
  entries: readonly LineupEntry[]
  openKey: string | null
}>()
const emit = defineEmits<{ toggle: [key: string] }>()

/** The most bands that pile up at the top; with more, only the open one stays. */
const PILE_MAX = 5
const pile = computed(() => props.entries.length <= PILE_MAX)

// The order the bands had when one opened, kept until none is; any added meanwhile after them.
const frozen = ref<string[] | null>(null)
watch(
  () => props.openKey,
  (key, was) => {
    if (!key) frozen.value = null
    else if (!was) frozen.value = props.entries.map((e) => e.key)
  },
  { immediate: true },
)
const shown = computed(() => {
  const keep = frozen.value
  if (!keep) return props.entries
  const byKey = new Map(props.entries.map((e) => [e.key, e]))
  const kept = keep.flatMap((k) => byKey.get(k) ?? [])
  return [...kept, ...props.entries.filter((e) => !keep.includes(e.key))]
})

// Moving to their new places, the bands slide there from where they were (by `transform` alone, off the main thread),
// unless motion is reduced.
const root = useTemplateRef<HTMLElement>('root')
// The list's top, for the page to bring into view (its bands stick, so their own place isn't where the list starts).
defineExpose({ root })
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
watch(
  () => shown.value.map((e) => e.key).join(),
  (now, was) => {
    const el = root.value
    if (!el || !was || reduced.matches) return
    const bands = () => [...el.querySelectorAll<HTMLElement>(':scope > .row')]
    const before = new Map(bands().map((b) => [b.id, b.getBoundingClientRect().top]))
    void nextTick(() => {
      for (const b of bands()) {
        const top = before.get(b.id)
        const dy = top === undefined ? 0 : top - b.getBoundingClientRect().top
        if (Math.abs(dy) > 1)
          b.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], {
            duration: 350,
            easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
          })
      }
    })
  },
  { flush: 'pre' },
)

// Its place in words on hover; on touch screens a tap opens the band, and the badge is read out anyway.
const canHover = window.matchMedia('(hover: hover)').matches
const placeLabel = (p: Place) => t(p.tie ? 'compare.placeTie' : 'compare.place', { n: p.rank })
/** What an empty one picks: whose it is, as nothing else in the list says. */
const pickLabel = (e: LineupEntry) =>
  t(e.team === 'yours' ? 'compare.pickYours' : e.team === 'opponent' ? 'compare.pickOpponent' : 'compare.pick')
const teamLabel = (e: LineupEntry) =>
  e.team === 'yours' ? t('speed.yours') : e.team === 'opponent' ? t('compare.opponent') : null
</script>

<template>
  <div ref="root" class="lineup" :class="{ pile }">
    <template v-for="(e, i) in shown" :key="e.key">
      <button
        :id="`band-${e.key}`"
        type="button"
        class="row"
        :class="[e.team ?? 'neutral', { open: openKey === e.key, stuck: pile || openKey === e.key }]"
        :style="{ '--i': pile ? i : 0 }"
        :aria-expanded="e.id ? openKey === e.key : undefined"
        :aria-controls="`editor-${e.key}`"
        @click="emit('toggle', e.key)"
      >
        <span
          v-tip="canHover && e.place && placeLabel(e.place)"
          class="place"
          :class="{ tie: e.place?.tie, unset: !e.place }"
          :aria-label="e.place ? placeLabel(e.place) : undefined"
          >{{ e.place ? `${e.place.tie ? '=' : ''}${e.place.rank}` : '' }}</span
        >
        <span v-if="teamLabel(e)" class="visually-hidden">{{ teamLabel(e) }}</span>
        <BuildSummary v-if="e.id" :id="e.id" :speed="e.speed!" :build="e.build" class="summary" />
        <span v-else class="empty">{{ pickLabel(e) }}</span>
        <ChevronDown :size="16" class="chevron" :class="{ unset: !e.id }" aria-hidden="true" />
      </button>
      <div v-if="openKey === e.key" :id="`editor-${e.key}`" class="editor" :class="e.team ?? 'neutral'">
        <slot name="editor" :entry="e" />
      </div>
    </template>
    <slot name="after" />
  </div>
</template>

<style scoped>
/* One card of bands, each band's top line shared with the one above. */
.lineup {
  --band-h: 44px;
  display: flex;
  flex-direction: column;
  margin-bottom: 12px;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  height: var(--band-h);
  min-width: 0;
  padding: 0 10px 0 6px;
  font: inherit;
  font-weight: bold;
  text-align: left;
  color: var(--text);
  background: var(--panel);
  border: 2px solid var(--ink);
  cursor: pointer;
  touch-action: manipulation;
}
.row + .row,
.editor + .row {
  margin-top: -2px;
}
.row.yours {
  color: var(--accent-text);
  background: var(--accent);
}
.row.opponent {
  color: var(--opponent-text);
  background: var(--opponent);
}
/* Stuck to the top, piled up: each under the ones before it (their shared lines overlapping), and over the ones
   after, which scroll in under it. */
.row.stuck {
  position: sticky;
  top: calc(var(--i) * (var(--band-h) - 2px));
  z-index: calc(40 - var(--i));
}
/* Its place: a badge in ink on the band; one tied with another hatched, its number after `=`. */
.place {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  height: 26px;
  padding: 0 4px;
  font-variant-numeric: tabular-nums;
  color: var(--text);
  background: var(--panel);
  border: 2px solid var(--ink);
}
.place.tie {
  background: repeating-linear-gradient(
    -45deg,
    var(--panel),
    var(--panel) 4px,
    color-mix(in srgb, var(--muted) 35%, var(--panel)) 4px,
    color-mix(in srgb, var(--muted) 35%, var(--panel)) 8px
  );
}
.place.unset {
  border-style: dashed;
  background: transparent;
  border-color: currentColor;
}
.summary {
  overflow: hidden;
}
.empty {
  flex: 1;
  font-weight: normal;
  opacity: 0.85;
}
.chevron {
  flex: none;
  margin-left: auto;
  transition: transform 0.15s;
}
.row.open .chevron {
  transform: rotate(180deg);
}
/* With none picked there's nothing to fold: the band picks one. */
.chevron.unset {
  visibility: hidden;
}
/* What changes it, under its band, in a card lined up with it, its team's color a stripe inside its left edge (a
   shadow, not a wider border, so its edges line up with the band's and its corners stay square). */
.editor {
  position: relative;
  z-index: 0;
  margin-top: -2px;
  padding: var(--panel-pad, 12px) var(--panel-pad, 12px) var(--panel-pad, 12px) calc(var(--panel-pad, 12px) + 4px);
  background: var(--panel);
  border: 2px solid var(--ink);
}
.editor.yours {
  box-shadow: inset 6px 0 var(--accent);
}
.editor.opponent {
  box-shadow: inset 6px 0 var(--opponent);
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
