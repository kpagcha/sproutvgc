<script setup lang="ts" generic="K extends string">
import { useTemplateRef } from 'vue'
import { Info } from '@lucide/vue'
import { t } from '@/i18n'

// The inverse tools' "Work out": what of a side is worked out rather than given, a toggle each (its nature, its points,
// the opponent's item...), what's on left out of its set and answered. Its label's tooltip says what on and off mean,
// with an example of the tool's own (`example`). After the toggles, the tool's own (a preset, `slot`). Who moves
// first's sides and the inverse damage calc's opponent.
const props = defineProps<{
  options: readonly { key: K; label: string; on: boolean; disabled?: boolean; tip?: string }[]
  example: string
}>()
const emit = defineEmits<{ toggle: [key: K] }>()
const tip = useTemplateRef<HTMLElement>('tip')
</script>

<template>
  <div class="work-out">
    <span v-tip="tip" class="muted small work-label" tabindex="0"
      >{{ t('reverse.workOut') }}<Info :size="14" aria-hidden="true"
    /></span>
    <div hidden>
      <div ref="tip" class="work-tip">
        <p>
          <strong>{{ t('reverse.workTip.onLabel') }}</strong> {{ t('reverse.workTip.on') }}
        </p>
        <p>
          <strong>{{ t('reverse.workTip.offLabel') }}</strong> {{ t('reverse.workTip.off') }}
        </p>
        <p class="work-tip-eg">{{ props.example }}</p>
      </div>
    </div>
    <div class="toggles">
      <button
        v-for="o in props.options"
        :key="o.key"
        v-tip="o.tip"
        type="button"
        class="btn toggle"
        :class="{ on: o.on }"
        :aria-pressed="o.on"
        :disabled="o.disabled"
        @click="emit('toggle', o.key)"
      >
        {{ o.label }}
      </button>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.small {
  font-size: 0.875em;
}
.work-out {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}
/* Its label, its tooltip saying what it means. */
.work-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: help;
}
.work-tip {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 260px;
}
.work-tip p {
  margin: 0;
}
.work-tip-eg {
  padding-top: 4px;
  border-top: 1px solid var(--border);
  font-style: italic;
}
.toggles {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
/* As the Speed editor's modifiers. */
.toggles :deep(.btn) {
  min-height: 0;
  gap: 4px;
  padding: 3px 8px;
  font-size: 0.875em;
  line-height: inherit;
}
.toggle.on {
  background: var(--sel);
}
</style>
