<script setup lang="ts">
import { computed } from 'vue'
import type { Multiplier, TypeId } from '@/data/types'
import { t, type MessageKey } from '@/i18n'
import { defensiveProfile, formatMult, multClass } from '@/lib/typecalc'
import { defenseInfo, hasInfo } from '@/lib/interactions'
import TypeIcon from '@/components/TypeIcon'
import SideInteractions from '@/components/SideInteractions.vue'

const props = defineProps<{ types: readonly TypeId[] }>()

const ROWS: { m: Multiplier; label: MessageKey }[] = [
  { m: 4, label: 'matchups.weak' },
  { m: 2, label: 'matchups.weak' },
  { m: 0.5, label: 'matchups.resists' },
  { m: 0.25, label: 'matchups.resists' },
  { m: 0, label: 'matchups.immune' },
]
const profile = computed(() => defensiveProfile(props.types))
const rows = computed(() => ROWS.filter((r) => profile.value[r.m].length))
const info = computed(() => defenseInfo(props.types))
</script>

<template>
  <!-- The other effects go to the right of the matchups when there's room, below them when there isn't. -->
  <div class="panel defense">
    <div class="split" :class="{ both: hasInfo(info) }">
      <table class="groups">
        <tbody>
          <tr v-for="row in rows" :key="row.m">
            <th>
              <span class="tier">
                <span class="mult-tag" :class="multClass(row.m)">{{ formatMult(row.m) }}</span>
                <span class="lbl muted">{{ t(row.label) }}</span>
              </span>
            </th>
            <td>
              <span class="icons">
                <TypeIcon v-for="t in profile[row.m]" :key="t" :type="t" />
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="hasInfo(info)" class="effects">
        <h2>{{ t('matchups.effects') }}</h2>
        <SideInteractions :info="info" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.defense {
  container-type: inline-size;
}
.split {
  display: grid;
  gap: 12px 24px;
}
.effects {
  min-width: 0;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
@container (min-width: 720px) {
  .split.both {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: start;
  }
  .effects {
    padding: 0 0 0 24px;
    border-top: none;
    border-left: 1px solid var(--border);
  }
}
.groups {
  align-self: start;
  border-collapse: collapse;
  width: 100%;
}
.groups th,
.groups td {
  border-top: 1px solid var(--border);
  padding: 6px 4px;
  vertical-align: middle;
  text-align: left;
}
.groups tr:first-child th,
.groups tr:first-child td {
  border-top: none;
}
.groups th {
  width: 1%;
  white-space: nowrap;
  font-weight: normal;
}
.tier {
  display: flex;
  align-items: center;
  gap: 6px;
}
.lbl {
  min-width: 60px;
}
.icons {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
</style>
