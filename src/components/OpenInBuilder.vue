<script setup lang="ts">
import { useRouter } from 'vue-router'
import { SquarePen } from '@lucide/vue'
import type { Slot } from '@/data/tournaments'
import { t } from '@/i18n'
import { useTeams } from '@/composables/useTeams'
import { memberFromSlot } from '@/lib/team'

// A tournament team's button opening it in the team builder: saved there as a team of its own (`name`), its sets as
// the team list has them (no stat points), and opened. Beside `CopyPaste`.
const props = defineProps<{ team: readonly Slot[]; name: string }>()
const { create } = useTeams()
const router = useRouter()
function openTeam() {
  create(props.name, props.team.slice(0, 6).map(memberFromSlot))
  void router.push({ name: 'teamBuilder' })
}
</script>

<template>
  <button type="button" class="btn open-builder" @click="openTeam">
    <SquarePen :size="14" aria-hidden="true" />
    <span>{{ t('builder.openTeam') }}</span>
  </button>
</template>

<style scoped>
.open-builder {
  font-size: 0.875em;
  font-weight: bold;
}
</style>
