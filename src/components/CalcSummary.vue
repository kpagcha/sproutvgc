<script setup lang="ts">
import { computed } from 'vue'
import { pokemon } from '@/data/dex'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { BOOSTED, battlerOf, bestHit, hit, koKind, type Battlefield, type Fighter } from '@/lib/damage'
import ItemIcon from '@/components/ItemIcon.vue'
import PokemonIcon from '@/components/PokemonIcon'

// A damage calculator's side in short, on one line, for its tab on phones: the Pokémon's icon (its name read out, not
// shown: it'd be cut), its item's icon, what the battle has changed of it (HP left, status, stat stages; nothing while
// as it came in), and, at the end, its hardest hit's verdict against the other side ("OHKO", "62% 2HKO"), colored as
// the damage rows' are: yours knocking out good news, theirs bad (`theirs`).
const props = defineProps<{ fighter: Fighter; other: Fighter; field: Battlefield; theirs?: boolean }>()

const id = computed(() => battlerOf(props.fighter))
const best = computed(() => {
  if (!id.value || !battlerOf(props.other)) return null
  const moves = props.fighter.member.moves.filter((m) => !!m)
  return bestHit(moves.map((m) => hit(props.fighter, props.other, m!, props.field)))
})
const verdict = computed(() => {
  const h = best.value
  if (!h) return ''
  if (!h.koHits) return `${h.maxPct.toFixed(0)}%`
  const n = h.koHits === 1 ? 'OHKO' : `${h.koHits}HKO`
  return h.koChance >= 1 ? n : `${Math.round(h.koChance * 100)}% ${n}`
})
const kind = computed(() => koKind(best.value))
const stages = computed(() =>
  BOOSTED.flatMap((s, i) => {
    const n = props.fighter.boosts[i]!
    return n ? [`${n > 0 ? '+' : '−'}${Math.abs(n)} ${t(`stat.${s}`)}`] : []
  }),
)
</script>

<template>
  <span v-if="id" class="summary" :class="[kind, { theirs }]">
    <PokemonIcon :id class="mon" />
    <span class="sr-only">{{ refName(pokemon(id)) }}</span>
    <ItemIcon v-if="fighter.member.item" :id="fighter.member.item" class="item" />
    <span class="extras">
      <span v-if="fighter.hp < 100" class="tag">{{ fighter.hp }}%</span>
      <span v-if="fighter.status" class="tag">{{ t(`status.${fighter.status}`) }}</span>
      <span v-for="s in stages" :key="s" class="tag">{{ s }}</span>
    </span>
    <span v-if="verdict" class="ko">{{ verdict }}</span>
  </span>
</template>

<style scoped>
.summary {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
}
.mon,
.item,
.ko {
  flex: none;
}
/* What the battle changed, cut before the verdict is. */
.extras {
  display: flex;
  flex: 1;
  gap: 4px;
  min-width: 0;
  overflow: hidden;
}
.tag {
  flex: none;
  padding: 0 4px;
  font-size: 0.75em;
  font-weight: normal;
  white-space: nowrap;
  border: 1px solid var(--border);
}
.ko {
  font-size: 0.9em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.none .ko,
.more .ko {
  font-weight: normal;
  color: var(--muted);
}
.ohko:not(.theirs) .ko {
  color: var(--good);
}
.two:not(.theirs) .ko {
  color: color-mix(in srgb, var(--good) 70%, var(--text));
}
.ohko.theirs .ko {
  color: var(--bad);
}
.two.theirs .ko {
  color: color-mix(in srgb, var(--bad) 70%, var(--text));
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
