<script setup lang="ts">
import { onBeforeUnmount, ref, useId, useTemplateRef, watch } from 'vue'
import { ChevronDown } from '@lucide/vue'
import { BENCHMARKS, type Benchmark } from '@/lib/stats'
import { t } from '@/i18n'

// Where the speed tiers' Speeds come from, as `SegmentedControl` draws a choice: the sets players run, or the
// benchmarks. With `benchMenu` (the ladder, which has every Pokémon at one benchmark), the benchmarks' segment is also
// the benchmark's drop-down: pressed while off, it turns the benchmarks on; pressed while on, it opens the benchmarks,
// the one picked named beside it. Closed by a press outside it or Escape.
const props = defineProps<{ label: string; tip?: string; benchMenu: boolean; benchLabel: (b: Benchmark) => string }>()
const source = defineModel<'sets' | 'bench'>({ required: true })
const bench = defineModel<Benchmark>('bench', { required: true })
const id = useId()

const open = ref(false)
const root = useTemplateRef<HTMLElement>('root')
function onPointerDown(e: PointerEvent) {
  if (!root.value?.contains(e.target as Node)) open.value = false
}
const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (open.value = false)
watch(open, (on) => {
  if (on) {
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
  } else {
    document.removeEventListener('pointerdown', onPointerDown)
    document.removeEventListener('keydown', onKey)
  }
})
watch([source, () => props.benchMenu], () => (open.value = false))
onBeforeUnmount(() => (open.value = false))

function pressBench() {
  if (source.value !== 'bench') source.value = 'bench'
  else if (props.benchMenu) open.value = !open.value
}
function pick(b: Benchmark) {
  bench.value = b
  open.value = false
}
</script>

<template>
  <div ref="root" class="source" role="group" :aria-labelledby="id">
    <span :id v-tip="tip" class="muted">{{ label }}</span>
    <span class="segments">
      <button
        type="button"
        :class="{ on: source === 'sets' }"
        :aria-pressed="source === 'sets'"
        @click="source = 'sets'"
      >
        {{ t('speed.from.sets') }}
      </button>
      <button
        type="button"
        :class="{ on: source === 'bench' }"
        :aria-pressed="source === 'bench'"
        :aria-expanded="benchMenu && source === 'bench' ? open : undefined"
        @click="pressBench"
      >
        {{ t('speed.from.bench') }}
        <template v-if="benchMenu && source === 'bench'">
          <span class="picked">{{ benchLabel(bench) }}</span>
          <ChevronDown :size="14" class="chevron" :class="{ open }" aria-hidden="true" />
        </template>
      </button>
    </span>
    <div v-if="open" class="pop panel" role="listbox" :aria-label="t('speed.at')">
      <button
        v-for="b in BENCHMARKS"
        :key="b"
        type="button"
        role="option"
        :aria-selected="b === bench"
        :class="{ on: b === bench }"
        @click="pick(b)"
      >
        {{ benchLabel(b) }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.source {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
}
.segments {
  display: flex;
  border: 2px solid var(--ink);
  box-shadow: var(--hard-sm);
}
.segments button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
  font: inherit;
  color: var(--text);
  background: var(--panel-alt);
  border: none;
  cursor: pointer;
}
.segments button + button {
  border-left: 2px solid var(--ink);
}
.segments button:hover {
  background: var(--hover);
}
.segments button.on {
  background: var(--sel);
}
.segments button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -4px;
}
.picked {
  font-weight: bold;
}
.chevron {
  margin-left: -2px;
  transition: transform 0.15s;
}
.chevron.open {
  transform: rotate(180deg);
}
/* Under the benchmarks' segment, over the page. */
.pop {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 60;
  display: flex;
  flex-direction: column;
  min-width: 8em;
  margin: 0;
  padding: 4px;
}
.pop button {
  min-height: 32px;
  padding: 0 10px;
  font: inherit;
  color: var(--text);
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
}
.pop button:hover {
  background: var(--hover);
}
.pop button.on {
  font-weight: bold;
  background: var(--sel);
}
</style>
