<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { Check, ClipboardCopy } from '@lucide/vue'
import type { Slot } from '@/data/tournaments'
import { t } from '@/i18n'
import { copy } from '@/lib/clipboard'
import { teamPaste } from '@/lib/pokepaste'

// A tournament team's button copying it as a paste (`teamPaste`: Showdown's format, which pokepast.es takes), saying
// for a moment that it did, or that it couldn't. Or a paste given whole (`text`: the team builder's).
const props = defineProps<{ team?: Slot[]; text?: string }>()
const state = ref<'idle' | 'copied' | 'failed'>('idle')
let timer: ReturnType<typeof setTimeout> | undefined
async function copyTeam() {
  state.value = (await copy(props.text ?? teamPaste(props.team ?? []))) ? 'copied' : 'failed'
  clearTimeout(timer)
  timer = setTimeout(() => (state.value = 'idle'), 1500)
}
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <button type="button" class="btn copy-paste" @click="copyTeam">
    <component :is="state === 'copied' ? Check : ClipboardCopy" :size="14" aria-hidden="true" />
    <span aria-live="polite">{{
      state === 'copied'
        ? t('tournaments.pasteCopied')
        : state === 'failed'
          ? t('tournaments.pasteFailed')
          : t('tournaments.copyPaste')
    }}</span>
  </button>
</template>

<style scoped>
.copy-paste {
  font-size: 0.875em;
  font-weight: bold;
}
</style>
