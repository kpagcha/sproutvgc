<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  ability,
  available,
  condition,
  item,
  move,
  type AbilityId,
  type ItemId,
  type MoveId,
  type Ref,
} from '@/data/dex'
import { CONDITIONS, showdownId, type ConditionId } from '@/data/conditions'
import SOURCES from '@/data/generated/conditions.json'
import { REGULATION } from '@/data/format'
import { t } from '@/i18n'
import { description } from '@/i18n/descriptions'
import { refName } from '@/i18n/refName'
import DexRef from '@/components/DexRef.vue'
import DexText from '@/components/DexText.vue'
import ItemIcon from '@/components/ItemIcon.vue'
import RefInteractions from '@/components/RefInteractions.vue'

// One condition: what it does, what it does to types beyond the chart (who's immune), and the moves, abilities and
// items that cause it.
const route = useRoute()
const id = computed(() => String(route.params.id) as ConditionId)
const ref_ = computed(() => condition(id.value))
const exists = computed(() => available(ref_.value))
const text = computed(() => description('condition', id.value))

type Found = { sources: { move: string[]; ability: string[]; item: string[] } }
const sources = computed(() => {
  const found = (SOURCES as Record<string, Found>)[showdownId(id.value)]?.sources
  if (!found) return []
  const groups: { label: 'conditions.moves' | 'conditions.abilities' | 'conditions.items'; refs: Ref[] }[] = [
    { label: 'conditions.moves', refs: found.move.map((m) => move(m as MoveId)) },
    { label: 'conditions.abilities', refs: found.ability.map((a) => ability(a as AbilityId)) },
    { label: 'conditions.items', refs: found.item.map((i) => item(i as ItemId)) },
  ]
  return groups
    .map((g) => ({ ...g, refs: g.refs.sort((a, b) => refName(a).localeCompare(refName(b))) }))
    .filter((g) => g.refs.length)
})
</script>

<template>
  <div class="panel">
    <template v-if="exists">
      <h1>{{ refName(ref_) }}</h1>
      <p class="muted kind">{{ t(`conditions.sub1.${CONDITIONS[id].sub}`) }}</p>
      <p v-if="text"><DexText :text="text.long ?? text.short" /></p>

      <RefInteractions :to="ref_" />

      <section v-if="sources.length">
        <h2>{{ t('conditions.causedBy') }}</h2>
        <dl class="sources">
          <template v-for="g in sources" :key="g.label">
            <dt class="muted">{{ t(g.label) }}</dt>
            <dd>
              <span v-for="r in g.refs" :key="r.id" class="chip">
                <ItemIcon v-if="r.kind === 'item'" :id="r.id" />
                <DexRef :to="r" />
              </span>
            </dd>
          </template>
        </dl>
      </section>
    </template>
    <p v-else>{{ t('conditions.notFound', { id, reg: REGULATION }) }}</p>
  </div>
</template>

<style scoped>
.kind {
  margin-top: -4px;
}
section {
  margin-top: 16px;
}
.sources {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 6px 10px;
  align-items: baseline;
  margin: 0;
}
.sources dd {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 0;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 6px;
  background: var(--panel-alt);
  border: 1px solid var(--border);
  border-radius: 3px;
}
@media (max-width: 560px) {
  .sources {
    grid-template-columns: 1fr;
  }
}
</style>
