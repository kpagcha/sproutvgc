<script setup lang="ts">
import { ArrowRight, ChevronDown, ChevronUp } from '@lucide/vue'
import type { PokemonId } from '@/data/dex'
import { t } from '@/i18n'
import type { NamedLocation } from '@/lib/links'
import type { pointsToMoveFirst } from '@/lib/speed'
import AppLink from '@/components/AppLink'
import PokemonIcon from '@/components/PokemonIcon'
import VersusLine from '@/components/VersusLine.vue'

// Yours against the Pokémon measured against on the speed tiers' ladder (the chips tapped), a line each: the opponent
// (finding its row), its Speed, whether yours moves first, and what it takes (`VersusLine`). Folded, a bar of their
// icons each with its verdict, which unfolds it; then the way to the comparison of them, side by side. Beside the
// ladder under yours; narrower, each line is under its row instead.
type Result = ReturnType<typeof pointsToMoveFirst>
export interface VersusItem {
  /** The chip's key; the Pokémon, its name as the ladder shows it, and its Speed there. */
  key: string
  id: PokemonId
  name: string
  speed: number
  /** The points that move yours first with its nature, and with the one that would when it can't. */
  result: Result
  other: { effect: 'up' | 'down'; result: Result } | null
}
const props = defineProps<{
  items: VersusItem[]
  /** Yours: its Speed and Speed points. */
  mineSpeed: number
  points: number
  trickRoom: boolean
  /** The comparison of yours and them, side by side. */
  compareTo: NamedLocation | null
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ close: [key: string]; locate: [key: string] }>()

type Verdict = 'first' | 'tie' | 'after'
/** Whether yours moves first as it is: the faster, or under Trick Room the slower. */
const verdictOf = (v: VersusItem): Verdict =>
  props.mineSpeed === v.speed ? 'tie' : props.mineSpeed > v.speed !== props.trickRoom ? 'first' : 'after'
const GLYPHS: Record<Verdict, string> = { first: '▲', tie: '=', after: '▼' }
</script>

<template>
  <section class="panel versus-panel small" :class="{ open }" role="status">
    <!-- Folded: its icons, each with its verdict, the whole bar unfolding it. -->
    <button
      v-if="!open"
      type="button"
      class="fold-bar"
      :aria-label="t('speed.vsOpen')"
      :aria-expanded="false"
      @click="open = true"
    >
      <span class="title">{{ t('speed.vsShort', { speed: mineSpeed }) }}</span>
      <span class="verdicts">
        <span v-for="v in items" :key="v.key" class="verdict-chip">
          <PokemonIcon :id="v.id" /><span class="glyph" :class="verdictOf(v)" aria-hidden="true">{{
            GLYPHS[verdictOf(v)]
          }}</span
          ><span class="visually-hidden">{{ v.name }}: {{ t(`speed.vsVerdict.${verdictOf(v)}`) }}</span>
        </span>
      </span>
      <ChevronDown :size="16" class="chevron" aria-hidden="true" />
    </button>
    <template v-else>
      <div class="head">
        <span class="title">{{ t('speed.vsHead', { speed: mineSpeed }) }}</span>
        <AppLink v-if="compareTo" :to="compareTo" class="btn small primary compare-link"
          >{{ t('speed.vsCompare') }}<ArrowRight :size="14" aria-hidden="true"
        /></AppLink>
        <button type="button" class="fold" :aria-label="t('speed.vsFold')" :aria-expanded="true" @click="open = false">
          <ChevronUp :size="16" aria-hidden="true" />
        </button>
      </div>
      <!-- A line each: the opponent and its Speed (finding its row), the verdict, what it takes, and a cross. -->
      <ul class="lines">
        <li v-for="v in items" :key="v.key">
          <VersusLine class="line" :item="v" :mine-speed :points :trick-room @close="emit('close', v.key)">
            <button
              type="button"
              class="who"
              :aria-label="`${v.name}: ${t('speed.vsLocate')}`"
              @click="emit('locate', v.key)"
            >
              <PokemonIcon :id="v.id" /><span class="num speed">{{ v.speed }}</span>
            </button>
          </VersusLine>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.versus-panel {
  margin: 0;
  padding: 0;
}
.small {
  font-size: 0.875em;
}
.title {
  font-weight: bold;
}
/* Folded: one line, its icons after the title, the chevron at its end. */
.fold-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 40px;
  padding: 4px 10px;
  font: inherit;
  color: inherit;
  text-align: start;
  background: none;
  border: none;
  cursor: pointer;
}
/* The icons overlapping, so a team's six fit beside the title on a phone; where they still don't, they wrap to another
   row (their margins over and under small enough that the rows don't overlap), never past the bar. */
.verdicts {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  row-gap: 2px;
  min-width: 0;
}
/* Each its icon, its verdict a badge on its corner; the icons' transparent edges overlapping, so a team fits. */
.verdict-chip {
  position: relative;
  display: inline-flex;
  flex: none;
  align-items: center;
}
.verdict-chip:not(:first-child) {
  margin-left: -10px;
}
.verdict-chip :deep(.sheet-icon) {
  margin-block: -1px;
}
.glyph {
  position: absolute;
  z-index: 1;
  right: 2px;
  bottom: 0;
  font-size: 0.9em;
  line-height: 1;
}
.chevron {
  flex: none;
  color: var(--muted);
}
/* Unfolded: the title, Compare and the fold on a line, then a line per opponent. */
.head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 6px 4px 10px;
}
.head .title {
  flex: 1;
}
.compare-link {
  gap: 4px;
  font-weight: bold;
}
.compare-link:hover {
  text-decoration: none;
}
.fold {
  display: inline-flex;
  flex: none;
  padding: 4px;
  color: var(--muted);
  background: none;
  border: none;
  cursor: pointer;
}
.fold:hover {
  color: var(--text);
}
.lines {
  margin: 0;
  padding: 0 6px 6px 4px;
  list-style: none;
}
/* A line each: the opponent and its Speed, the verdict and the cross; what it takes under the verdict, where the
   column beside the ladder has room for it. */
.line {
  padding: 4px 0;
  border-top: 1px solid var(--border);
}
.who {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 0 4px 0 0;
  font: inherit;
  font-weight: bold;
  color: inherit;
  background: none;
  border: none;
  cursor: pointer;
}
.who :deep(.sheet-icon) {
  margin-block: -4px;
}
.speed {
  min-width: 3ch;
  text-align: end;
  text-decoration: underline dotted;
  text-underline-offset: 3px;
}
.who:hover .speed {
  text-decoration-style: solid;
}
.num {
  font-variant-numeric: tabular-nums;
}
/* The verdicts, in the color of how it goes for yours: the ladder's. */
.glyph.first {
  color: var(--accent);
}
.glyph.after {
  color: var(--opponent);
}
.glyph.tie {
  color: var(--muted);
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
