<script setup lang="ts">
import { useId } from 'vue'
import { TYPES, type TypeId } from '@/data/types'
import { typeName } from '@/i18n'
import TypeIcon from '@/components/TypeIcon'
import { motion } from 'motion-v'
import { PRESS } from '@/lib/motion'

const props = withDefaults(
  defineProps<{
    modelValue: TypeId[]
    /** Maximum selected types; picking past it drops the oldest pick. */
    max?: number
    disabled?: boolean
    /** Per-type marks shown after answering (quiz feedback). */
    marks?: Partial<Record<TypeId, 'ok' | 'missed' | 'wrong'>>
    /** Small glyph-only badges (as in the type chart), in two rows of nine, with the names in tooltips. */
    compact?: boolean
  }>(),
  { max: 18, disabled: false, marks: undefined, compact: false },
)

// Each picker's tooltips glide among its own badges only, not over to another picker on the page.
const tipGroup = `picker-${useId()}`

const emit = defineEmits<{ 'update:modelValue': [TypeId[]] }>()

function toggle(t: TypeId) {
  if (props.disabled) return
  const cur = props.modelValue
  if (cur.includes(t)) {
    emit(
      'update:modelValue',
      cur.filter((x) => x !== t),
    )
  } else {
    const next = [...cur, t]
    emit('update:modelValue', next.length > props.max ? next.slice(next.length - props.max) : next)
  }
}
</script>

<template>
  <div class="picker" :class="{ compact }" role="group">
    <motion.button
      v-for="t in TYPES"
      :key="t"
      type="button"
      class="opt"
      :class="[{ on: modelValue.includes(t) }, marks?.[t]]"
      :aria-pressed="modelValue.includes(t)"
      :disabled="disabled"
      :while-press="disabled ? undefined : PRESS"
      v-tip:[tipGroup]="compact && typeName(t)"
      @click="toggle(t)"
    >
      <TypeIcon :type="t" :scale="compact ? 1 : 2" />
    </motion.button>
  </div>
</template>

<style scoped>
.picker {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
  gap: 4px;
}

.picker.compact {
  grid-template-columns: repeat(9, auto);
  justify-content: start;
}

.opt {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  background: var(--panel-alt);
  border: 1px solid var(--border);
  border-radius: 3px;
  cursor: pointer;
  opacity: 0.6;
}
.opt:hover:not(:disabled) {
  background: var(--hover);
  opacity: 1;
}
.opt.on {
  background: var(--sel);
  border-color: var(--accent);
  opacity: 1;
}
.opt:disabled {
  cursor: default;
}
.opt.ok {
  border-color: var(--good);
  box-shadow: inset 0 0 0 1px var(--good);
  opacity: 1;
}
.opt.missed {
  border-color: var(--bad);
  border-style: dashed;
  box-shadow: inset 0 0 0 1px var(--bad);
  opacity: 1;
}
.opt.wrong {
  border-color: var(--bad);
  box-shadow: inset 0 0 0 1px var(--bad);
  opacity: 1;
  background: var(--m05-bg);
}
</style>
