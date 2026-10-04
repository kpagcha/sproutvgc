<script setup lang="ts">
import { CONDITIONS, type ConditionInfo } from '@/data/conditions'
import { refKey, type Ref } from '@/data/dex'
import { t, type MessageKey } from '@/i18n'
import { refName } from '@/i18n/refName'
import { effectText, type InfoRow } from '@/lib/interactions'
import { follow, refHref } from '@/lib/links'
import { formatMult, multClass } from '@/lib/typecalc'
import DexRef from '@/components/DexRef'
import TypeIcon from '@/components/TypeIcon'

defineProps<{ rows: InfoRow[] }>()

/** In rows mixing several move types, each run of one type's entries starts with its badge. */
const startsRun = (list: { of?: unknown }[], i: number) => !!list[i]!.of && list[i]!.of !== list[i - 1]?.of

/** A status's abbreviation (PAR), which it goes by in these rows (the type pages'), as in the games. */
const statusAbbr = (ref: Ref) =>
  ref.kind === 'condition' && (CONDITIONS[ref.id] as ConditionInfo).sub === 'status'
    ? t(`status.${ref.id}` as MessageKey)
    : undefined
</script>

<template>
  <dl class="info">
    <template v-for="row in rows" :key="row.label">
      <dt class="muted">{{ row.label }}</dt>
      <dd>
        <template v-for="(e, i) in row.entries" :key="`${e.of ?? ''}/${refKey(e.ref)}/${e.cond?.id ?? ''}`">
          <TypeIcon v-if="startsRun(row.entries!, i)" :type="e.of!" class="of" />
          <!-- A status is a badge of its own, the whole of it a link, with its full name on hover. -->
          <a v-if="statusAbbr(e.ref)" v-tip="refName(e.ref)" class="term status" :href="refHref(e.ref)" @click="follow">
            {{ statusAbbr(e.ref) }}
          </a>
          <span v-else class="term">
            <DexRef :to="e.ref" />
            <span v-if="e.cond" class="effect">(<DexRef :to="e.cond" />)</span>
            <span v-if="e.mult !== undefined" class="mult-tag" :class="multClass(e.mult)">
              {{ formatMult(e.mult) }}
            </span>
            <TypeIcon v-if="e.vs" :type="e.vs" />
            <span v-if="effectText(e)" class="effect num">{{ effectText(e) }}</span>
          </span>
        </template>
        <template v-for="(n, i) in row.notes" :key="`${n.of ?? ''}/${n.text}`">
          <TypeIcon v-if="startsRun(row.notes!, i)" :type="n.of!" class="of" />
          <span class="term">{{ n.text }}</span>
        </template>
      </dd>
    </template>
  </dl>
</template>

<style scoped>
.info {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 6px 10px;
  align-items: baseline;
  margin: 0;
}
.info dd {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 0;
}
.term {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 5px;
  background: var(--panel-alt);
  border: 1px solid var(--border);
  border-radius: 3px;
}
.status {
  color: var(--text);
  font-weight: 600;
  font-family: var(--font-num, inherit);
  letter-spacing: 0.04em;
  text-decoration: none;
  cursor: pointer;
}
.status:hover {
  background: var(--hover);
  border-color: var(--muted);
}
.term .mult-tag {
  min-width: 0;
  padding: 0 0.3em;
}
.effect {
  color: var(--muted);
}
/* A move type's badge leads its entries, a little apart from the previous type's. */
.of:not(:first-child) {
  margin-left: 6px;
}
.of {
  align-self: center;
}
</style>
