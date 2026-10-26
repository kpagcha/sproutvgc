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
const LABELS = {
  idle: 'tournaments.copyPaste',
  copied: 'tournaments.pasteCopied',
  failed: 'tournaments.pasteFailed',
} as const
const state = ref<keyof typeof LABELS>('idle')
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
    <!-- Every label in one cell, the one for now shown: the button as wide as the longest, whichever it says. -->
    <span class="labels" aria-live="polite">
      <span v-for="(label, s) in LABELS" :key="s" :class="{ shown: state === s }" :aria-hidden="state !== s">{{
        t(label)
      }}</span>
    </span>
  </button>
</template>

<style scoped>
.copy-paste {
  font-size: 0.875em;
  font-weight: bold;
}
.labels {
  display: inline-grid;
}
.labels > span {
  grid-area: 1 / 1;
  visibility: hidden;
}
.labels > .shown {
  visibility: visible;
}
</style>
