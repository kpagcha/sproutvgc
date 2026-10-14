<script setup lang="ts">
import Marked from '@/components/Marked'
import { computed, useTemplateRef } from 'vue'
import { item, type ItemId } from '@/data/dex'
import { percent } from '@/data/meta'
import { locale, t } from '@/i18n'
import { description } from '@/i18n/descriptions'
import { refName } from '@/i18n/refName'
import type { Marks } from '@/lib/search'
import { useRowColumns } from '@/composables/useRowColumns'
import { useSort } from '@/composables/useSort'
import AppLink from '@/components/AppLink'
import DexText from '@/components/DexText'
import ItemIcon from '@/components/ItemIcon.vue'
import SortHeader from '@/components/SortHeader.vue'

// Items as the dex lists them: each its icon and name, a link to its page (the search's matches marked, when it gives
// them), and its short description beside it (under it on phones). Given each one's share of a Pokémon's sets
// (`shares`, its usage page), a table as the moves' (`MoveTable`): a header, a row each, sortable by name or share
// (by share at first), its description under its name (unless `noDescriptions`), its share a number with its bar under
// it.
const props = defineProps<{
  items: readonly { id: ItemId; parts?: Marks | null }[]
  shares?: Partial<Record<ItemId, number>>
  noDescriptions?: boolean
}>()

const rows = computed(() =>
  props.items.map((it) => ({ ...it, name: refName(item(it.id)), text: description('item', it.id)?.short ?? '' })),
)

type Key = 'name' | 'share'
const { key, desc, toggle, sorted } = useSort({
  rows,
  value: (r, k: Key) => (k === 'name' ? r.name : (props.shares?.[r.id] ?? -1)),
  initial: 'share' as Key,
  startsDesc: (k) => k === 'share',
  locale,
})
useRowColumns(useTemplateRef('head'))
</script>

<template>
  <div v-if="shares" class="dex-table" role="table">
    <div ref="head" class="row head" role="row">
      <SortHeader :label="t('usage.item')" :active="key === 'name'" :desc="desc" @sort="toggle('name')" />
      <SortHeader :label="t('usageMon.share')" right :active="key === 'share'" :desc="desc" @sort="toggle('share')" />
    </div>
    <div v-for="it in sorted" :key="it.id" class="row" role="row">
      <div role="cell" class="grow">
        <AppLink :to="{ name: 'item', params: { id: it.id } }" class="name item-name">
          <ItemIcon :id="it.id" />{{ it.name }}
        </AppLink>
        <div v-if="!noDescriptions" class="muted below"><DexText :text="it.text" /></div>
      </div>
      <div role="cell" class="r num meter" :style="{ '--share': shares[it.id] ?? 0 }">
        {{ shares[it.id] === undefined ? '—' : percent(shares[it.id]!) }}
      </div>
    </div>
  </div>
  <dl v-else class="entries">
    <template v-for="it in rows" :key="it.id">
      <dt>
        <RouterLink :to="{ name: 'item', params: { id: it.id } }" class="name">
          <ItemIcon :id="it.id" />
          <span>
            <Marked v-if="it.parts" :p="it.parts" />
            <template v-else>{{ it.name }}</template>
          </span>
        </RouterLink>
      </dt>
      <dd class="muted"><DexText :text="it.text" /></dd>
    </template>
  </dl>
</template>

<style scoped>
/* The table: the name (its description under it) and the share. */
.dex-table {
  --num: minmax(4.5em, auto);
  --row-height: 2.6em;
  --cols: minmax(0, 1fr) var(--num);
}
.item-name {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  /* A name longer than its room breaks across lines rather than running into the share after it. */
  overflow-wrap: anywhere;
}
.below {
  font-size: 0.9em;
  white-space: normal;
}
/* A share of a Pokémon's sets: its number, its bar under it, out of all of them. */
.meter {
  position: relative;
}
.meter::before,
.meter::after {
  content: '';
  position: absolute;
  left: 6px;
  bottom: 3px;
}
.meter::before {
  right: 6px;
  height: 1px;
  background: var(--border);
}
.meter::after {
  width: calc((100% - 12px) * var(--share, 0));
  height: 3px;
  background: var(--accent);
}
/* The dex's list: name, then description. */
.entries {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 16px;
  align-items: center;
  margin: 0;
}
.entries dt {
  font-weight: bold;
}
.entries dd {
  margin: 0;
}
.name {
  display: flex;
  align-items: center;
  gap: 4px;
}
@media (max-width: 560px) {
  .entries {
    grid-template-columns: 1fr;
    gap: 2px;
  }
  .entries dd {
    margin-bottom: 8px;
  }
}
</style>
