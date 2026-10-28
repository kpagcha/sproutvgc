<script setup lang="ts">
import { computed } from 'vue'
import { move, pokemon } from '@/data/dex'
import { natureEffectOn } from '@/data/natures'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { battlerOf, leadOf, oneOnOne, speedOf, type Battlefield, type Fighter, type Hit, type Lead } from '@/lib/damage'
import { buildQuery, type BuildToggle, type SpeedBuild } from '@/lib/speedBuild'
import AppLink from '@/components/AppLink'
import PokemonIcon from '@/components/PokemonIcon'

// Over the damage calculator's two sides, who moves first, as the speed comparison's verdict: each one's Speed as it
// battles (the calc's: stages, item, ability, Tailwind, paralysis), turned over under Trick Room, outlined in the
// color of the one ahead; then the two trading their hardest hits, one on one: each one's move and how many of it
// knock the other out, who moves first in the trade (a priority move first), and so who wins it. Under them, the ways
// to the speed tiers (yours there, the opponent found) and the speed comparison, at their builds.
const props = defineProps<{ a: Fighter; b: Fighter; field: Battlefield }>()

const ids = computed(() => ({ a: battlerOf(props.a), b: battlerOf(props.b) }))
const speeds = computed(() => ({ a: speedOf(props.a, props.field), b: speedOf(props.b, props.field) }))
const trickRoom = computed(() => props.field.effects.includes('trickRoom'))
const lead = computed<Lead | null>(() =>
  speeds.value.a === null || speeds.value.b === null ? null : leadOf(speeds.value.a, speeds.value.b, props.field),
)
const duel = computed(() => oneOnOne(props.a, props.b, props.field))
const name = (k: 'a' | 'b') => (ids.value[k] ? refName(pokemon(ids.value[k]!)) : '')

/** A knockout in short: "OHKO", "62% 2HKO"; none in the calc's reach, said so. */
const koText = (h: Hit | null) =>
  !h || !h.koHits
    ? t('calc.oneOnOne.noKo')
    : `${h.koChance < 1 ? `${Math.round(h.koChance * 100)}% ` : ''}${h.koHits === 1 ? 'OHKO' : `${h.koHits}HKO`}`
const verdict = computed(() => {
  const d = duel.value
  if (!d) return ''
  if (!d.winner) return t('calc.oneOnOne.neither')
  if (d.winner === 'tie') return t('calc.oneOnOne.tie')
  return t(d.sure ? 'calc.oneOnOne.wins' : 'calc.oneOnOne.likely', { name: name(d.winner) })
})
const rows = computed(() =>
  (['a', 'b'] as const).map((k) => {
    const h = duel.value?.[k] ?? null
    // Its priority in the battle (Grassy Glide's in Grassy Terrain).
    const p = h?.priority ?? 0
    return {
      k,
      id: ids.value[k]!,
      move: h ? refName(move(h.move)) : null,
      prio: p > 0 ? `+${p}` : p < 0 ? `−${-p}` : null,
      ko: koText(h),
    }
  }),
)

// The speed pages, at the two's builds (Speed's nature effect and points, its stage, and what of the speed pages'
// modifiers it has: Tailwind, a Choice Scarf or Iron Ball, paralysis), under Trick Room when it's up.
function buildOf(f: Fighter): SpeedBuild {
  const m = f.member
  const toggles: BuildToggle[] = []
  if (f.side.includes('tailwind')) toggles.push('tailwind')
  if (m.item === 'choicescarf') toggles.push('scarf')
  if (m.item === 'ironball') toggles.push('ironball')
  if (f.status === 'par') toggles.push('paralysis')
  return {
    effect: m.nature ? natureEffectOn(m.nature, 'spe') : 'neutral',
    points: m.points[5],
    toggles,
    stage: f.boosts[4],
  }
}
const tr = computed(() => (trickRoom.value ? '1' : undefined))
const tiersQuery = computed(() => ({
  mine: ids.value.a ?? undefined,
  ...buildQuery(buildOf(props.a), 'my'),
  find: ids.value.b ?? undefined,
  trickroom: tr.value,
}))
const compareQuery = computed(() => ({
  a: ids.value.a ?? undefined,
  ...buildQuery(buildOf(props.a), 'a'),
  b: ids.value.b ?? undefined,
  ...buildQuery(buildOf(props.b), 'b'),
  trickroom: tr.value,
}))
</script>

<template>
  <section
    v-if="lead && ids.a && ids.b"
    class="verdict panel"
    :class="{ yours: lead === 'a', theirs: lead === 'b' }"
    :aria-label="t('calc.verdict')"
  >
    <!-- Who moves first, the two Speeds, and the speed pages. -->
    <p class="line">
      <PokemonIcon v-if="lead !== 'tie'" :id="ids[lead]!" />
      <strong>{{ lead === 'tie' ? t('calc.speedTie') : t('calc.movesFirst', { name: name(lead) }) }}</strong>
      <span class="speeds">
        <span v-if="trickRoom" class="tr-tag" :aria-label="t('speed.mod.trickroom')">{{ t('speed.trShort') }}</span>
        <b>{{ speeds.a }}</b> <span class="muted">{{ t('calc.vs') }}</span> <b>{{ speeds.b }}</b>
      </span>
      <span class="links">
        <AppLink v-tip="t('calc.tiersTip')" :to="{ name: 'speedTiers', query: tiersQuery }"
          >{{ t('title.speedTiers') }} ›</AppLink
        >
        <AppLink v-tip="t('calc.compareTip')" :to="{ name: 'speedCompare', query: compareQuery }"
          >{{ t('title.speedCompare') }} ›</AppLink
        >
      </span>
    </p>
    <!-- The one-on-one: who wins, and each one's hardest hit, in its side's color. -->
    <p v-if="duel" class="line duel">
      <span class="muted">{{ t('calc.oneOnOne.label') }}</span>
      <strong>{{ verdict }}</strong>
      <span v-for="r in rows" :key="r.k" class="trade" :class="{ theirs: r.k === 'b' }">
        <PokemonIcon :id="r.id" />
        <b>{{ r.ko }}</b>
        <span v-if="r.move" class="muted">{{ t('calc.oneOnOne.with', { move: r.move }) }}</span>
        <span v-if="r.prio" class="prio">{{ t('calc.priority', { n: r.prio }) }}</span>
      </span>
    </p>
  </section>
</template>

<style scoped>
/* Outlined in the color of the one ahead, as the speed comparison's verdict; two lines, each wrapping as it must. */
.verdict {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding-block: 10px;
}
.verdict.yours {
  outline: 3px solid var(--accent);
  outline-offset: -1px;
}
.verdict.theirs {
  outline: 3px solid var(--opponent);
  outline-offset: -1px;
}
.line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  margin: 0;
}
.speeds {
  font-variant-numeric: tabular-nums;
}
.tr-tag {
  margin-right: 6px;
  padding: 1px 6px;
  font-size: 0.8em;
  font-weight: bold;
  color: var(--panel);
  background: var(--text);
}
.links {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin-left: auto;
  font-size: 0.9em;
  font-weight: bold;
}
.duel {
  font-size: 0.9em;
}
/* On phones, the links on a line of their own, from its start. */
@media (max-width: 899px) {
  .links {
    flex-basis: 100%;
    margin-left: 0;
  }
}
/* Each side's hardest hit, its color down its edge. */
.trade {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 6px;
  padding-left: 8px;
  border-left: 4px solid var(--accent);
}
.trade.theirs {
  border-left-color: var(--opponent);
}
.prio {
  padding: 0 4px;
  font-size: 0.85em;
  border: 1px solid var(--border);
}
</style>
