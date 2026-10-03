<script setup lang="ts">
import { computed } from 'vue'
import type { Ref } from '@/data/dex'
import { t, tSplit, type MessageKey } from '@/i18n'
import { effectText, interactionsOf } from '@/lib/interactions'
import { formatMult, multClass } from '@/lib/typecalc'
import DexRef from '@/components/DexRef.vue'
import TypeIcon from '@/components/TypeIcon.vue'

// What an entry (an ability, move, item, condition) does to types beyond the chart, read from the type data rather
// than written twice: Levitate makes Ground moves miss, Iron Ball grounds Flying types.
const props = defineProps<{ to: Ref }>()
const interactions = computed(() => interactionsOf(props.to))

/** An interaction's row from the entry's side ("{type} moves against it"), split around its type badge. */
const rowText = (row: string) => tSplit(`entry.row.${row}` as MessageKey, 'type')
</script>

<template>
  <section v-if="interactions.length">
    <h2>{{ t('entry.interactions') }}</h2>
    <ul class="interactions">
      <li v-for="(x, i) in interactions" :key="i">
        <span class="row">
          {{ rowText(x.row)[0] }}
          <RouterLink :to="{ name: 'types', params: { type: x.type } }"
            ><TypeIcon :type="x.type" :scale="2"
          /></RouterLink>
          {{ rowText(x.row)[1] }}
        </span>
        <span v-if="x.entry.mult !== undefined" class="mult-tag" :class="multClass(x.entry.mult)">
          {{ formatMult(x.entry.mult) }}
        </span>
        <span v-if="x.entry.cond" class="muted">(<DexRef :to="x.entry.cond" />)</span>
        <span v-if="effectText(x.entry)" class="muted num">{{ effectText(x.entry) }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
section {
  margin-top: 16px;
}
.interactions {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.interactions li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.row {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
</style>
