<script setup lang="ts">
// One quiz card: the question, answering it, and the result with its hints. Used by study and practice;
// the parent decides what an answer means (grading it, or only counting it).
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import type { Multiplier, TypeId } from '@/data/types'
import { t, typeName } from '@/i18n'
import { MULTIPLIERS, formatMult, multClass } from '@/lib/typecalc'
import { FADE, PRESS } from '@/lib/motion'
import { checkMulti, explain, matchups, multiPrompt, type Card } from '@/lib/quiz'
import { hintFor } from '@/lib/hints'
import { reveal } from '@/lib/scroll'
import TypeIcon from '@/components/TypeIcon'
import TypePicker from '@/components/TypePicker.vue'

const props = defineProps<{
  card: Card
  /** Bumped for every card shown, so the same card asked twice in a row still starts fresh. */
  round: number
  /** Show the memory hooks for the card's matchups after answering. */
  hints: boolean
}>()

const emit = defineEmits<{
  /** `ms` is how long the answer took. */
  answered: [correct: boolean, ms: number]
  next: []
}>()

// A single type can't take 4× or ¼×, so those are only offered against dual types.
const SINGLE_MULTIPLIERS = MULTIPLIERS.filter((m) => m !== 0.25 && m !== 4)
const options = computed(() =>
  props.card.kind === 'mult' && props.card.def.length === 1 ? SINGLE_MULTIPLIERS : MULTIPLIERS,
)
const KEYS = ['1', '2', '3', '4', '5', '6']

const picked = ref<TypeId[]>([])
const result = ref<{ correct: boolean; choice?: Multiplier; missed: TypeId[]; wrong: TypeId[] } | null>(null)
let shownAt = 0

watch(
  () => props.round,
  () => {
    picked.value = []
    result.value = null
    shownAt = performance.now()
  },
  { immediate: true },
)

// Keep what comes next on screen (phones have little room): the result and Next button after answering, and the
// new question after moving on.
const questionEl = useTemplateRef<HTMLElement>('question')
const afterEl = useTemplateRef<HTMLElement>('after')
watch(
  () => props.round,
  () => reveal(questionEl.value, afterEl.value),
  { flush: 'post' },
)

function finish(correct: boolean, ms = performance.now() - shownAt) {
  emit('answered', correct, ms)
  nextTick(() => reveal(afterEl.value))
}

function answerMult(m: Multiplier) {
  const c = props.card
  if (c.kind !== 'mult' || result.value) return
  const correct = m === c.answer
  result.value = { correct, choice: m, missed: [], wrong: [] }
  finish(correct)
}

function submitMulti() {
  const c = props.card
  if (c.kind !== 'multi' || result.value) return
  result.value = checkMulti(c, picked.value)
  finish(result.value.correct)
}

/** Dev: answer as if right (quick or slow) or wrong, without picking. */
function simulate(correct: boolean, slow = false) {
  const c = props.card
  if (result.value) return
  if (c.kind === 'mult') {
    const choice = correct ? c.answer : options.value.find((m) => m !== c.answer)!
    result.value = { correct, choice, missed: [], wrong: [] }
  } else {
    picked.value = correct ? [...c.answer] : c.answer.slice(1)
    result.value = checkMulti(c, picked.value)
  }
  finish(correct, slow ? Infinity : 0)
}
defineExpose({ simulate })

/** After answering: the memory hook for each matchup the card is about. */
const hintLines = computed(() => {
  if (!result.value || !props.hints) return []
  return matchups(props.card).flatMap(([atk, def]) => {
    const text = hintFor(atk, def)
    return text ? [{ atk, def, text }] : []
  })
})

const marks = computed(() => {
  const c = props.card
  if (!result.value || c.kind !== 'multi') return undefined
  const m: Partial<Record<TypeId, 'ok' | 'missed' | 'wrong'>> = {}
  for (const t of c.answer) m[t] = picked.value.includes(t) ? 'ok' : 'missed'
  for (const t of result.value.wrong) m[t] = 'wrong'
  return m
})

function names(ts: TypeId[]) {
  return ts.map(typeName).join(', ')
}

// After answering: the right answer pops, a wrong pick gives a small shake.
function ansAnimate(m: Multiplier) {
  if (!result.value || props.card.kind !== 'mult') return {}
  if (m === props.card.answer) return { scale: [1, 1.06, 1] }
  if (m === result.value.choice) return { x: [0, -4, 4, -2, 0] }
  return {}
}

// ---- Keyboard: 1–6 answer, Enter submits / continues (dev: C correct, X wrong) ----
function onKey(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey) return
  const tag = (e.target as HTMLElement | null)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
  if (result.value) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      emit('next')
    }
    return
  }
  if (import.meta.env.DEV && (e.key === 'c' || e.key === 'x')) {
    simulate(e.key === 'c')
    return
  }
  if (props.card.kind === 'mult') {
    const i = Number(e.key) - 1
    if (i >= 0 && i < options.value.length) answerMult(options.value[i]!)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    submitMulti()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <!-- Each question slides in as the previous one slides out. -->
  <div ref="question">
    <AnimatePresence mode="wait" :initial="false">
      <motion.div
        :key="round"
        :initial="{ opacity: 0, x: 12 }"
        :animate="{ opacity: 1, x: 0 }"
        :exit="{ opacity: 0, x: -12 }"
        :transition="FADE"
      >
        <template v-if="card.kind === 'mult'">
          <p class="muted q">{{ t('quiz.howEffective') }}</p>
          <div class="matchup">
            <TypeIcon :type="card.atk" :scale="2" />
            <span class="arrow">→</span>
            <span class="defs">
              <TypeIcon v-for="d in card.def" :key="d" :type="d" :scale="2" />
            </span>
          </div>
          <!-- One row of buttons, or two rows on phones. -->
          <div class="answers" :style="{ '--cols': options.length, '--cols-narrow': options.length / 2 }">
            <motion.button
              v-for="(m, i) in options"
              :key="m"
              type="button"
              class="btn ans num"
              :class="{
                right: result && m === card.answer,
                miss: result && m === result.choice && !result.correct,
              }"
              :disabled="!!result"
              :while-press="result ? undefined : PRESS"
              :animate="ansAnimate(m)"
              :transition="{ duration: 0.3 }"
              @click="answerMult(m)"
            >
              <kbd>{{ KEYS[i] }}</kbd
              >{{ formatMult(m) }}
            </motion.button>
          </div>
        </template>

        <template v-else>
          <p class="q prompt">
            <span v-if="multiPrompt(card)[0]">{{ multiPrompt(card)[0] }}</span>
            <TypeIcon :type="card.type" :scale="2" />
            <span>{{ multiPrompt(card)[1] }}</span>
          </p>
          <p class="muted small">{{ t('quiz.tickAll') }}</p>
          <TypePicker v-model="picked" :disabled="!!result" :marks="marks" />
        </template>
      </motion.div>
    </AnimatePresence>
  </div>

  <div ref="after">
    <!-- Result message, then the Submit/Next button. -->
    <motion.div
      v-if="result"
      class="feedback"
      :class="result.correct ? 'ok' : 'bad'"
      :initial="{ opacity: 0, y: 6 }"
      :animate="{ opacity: 1, y: 0 }"
      :transition="FADE"
    >
      <div class="verdict">
        <b>{{ t(result.correct ? 'quiz.correct' : 'quiz.wrong') }}</b>
        <template v-if="card.kind === 'mult'">
          <span class="mult-tag" :class="multClass(card.answer)">{{ formatMult(card.answer) }}</span>
          <span class="muted">{{ explain(card) }}</span>
        </template>
        <template v-else-if="!result.correct">
          <span v-if="result.missed.length">{{ t('quiz.missed', { list: names(result.missed) }) }}</span>
          <span v-if="result.wrong.length">{{ t('quiz.extra', { list: names(result.wrong) }) }}</span>
        </template>
      </div>
      <!-- Memory hooks to reinforce the answer (Advanced settings > Show hints). -->
      <ul v-if="hintLines.length" class="hints">
        <li v-for="h in hintLines" :key="h.atk + h.def">
          <span class="pair">
            <TypeIcon :type="h.atk" />
            <span class="muted">→</span>
            <TypeIcon :type="h.def" />
          </span>
          <span>{{ h.text }}</span>
        </li>
      </ul>
    </motion.div>
    <div class="actions">
      <button v-if="result" type="button" class="btn primary" @click="emit('next')">
        {{ t('quiz.next') }} <kbd>Enter</kbd>
      </button>
      <button v-else-if="card.kind === 'multi'" type="button" class="btn primary" @click="submitMulti">
        {{ t('quiz.submit') }} <kbd>Enter</kbd>
      </button>
      <!-- Multiplier cards are answered by their buttons; this keeps the row's height. -->
      <button v-else type="button" class="btn primary placeholder" tabindex="-1" aria-hidden="true">
        {{ t('quiz.next') }} <kbd>Enter</kbd>
      </button>
    </div>
  </div>
</template>

<style scoped>
.q {
  margin-bottom: 12px;
}
.prompt {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: calc(15px * var(--text-scale));
  font-weight: bold;
  margin-bottom: 4px;
}
.small {
  font-size: calc(11px * var(--text-scale));
}

.matchup {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 20px 0 24px;
}
.arrow {
  font-size: calc(20px * var(--text-scale));
  color: var(--muted);
}
.defs {
  display: inline-flex;
  gap: 4px;
}

.answers {
  /* Set inline from the number of options; these are the dual-type defaults. */
  --cols: 6;
  --cols-narrow: 3;
  display: grid;
  grid-template-columns: repeat(var(--cols), 1fr);
  gap: 6px;
}
@media (max-width: 480px) {
  .answers {
    grid-template-columns: repeat(var(--cols-narrow), 1fr);
  }
}
.ans {
  gap: 8px;
  min-height: 40px;
  font-size: calc(15px * var(--text-scale));
  font-weight: bold;
}
.ans:disabled {
  opacity: 0.55;
}
.ans.right {
  opacity: 1;
  border-color: var(--good);
  box-shadow: inset 0 0 0 2px var(--good);
}
.ans.miss {
  opacity: 1;
  border-color: var(--bad);
  box-shadow: inset 0 0 0 2px var(--bad);
}

kbd {
  font:
    10px/1 Verdana,
    sans-serif;
  padding: 2px 3px;
  border: 1px solid var(--border);
  border-radius: 2px;
  color: var(--muted);
}
.btn.primary kbd {
  color: inherit;
  border-color: currentColor;
  opacity: 0.8;
}
/* Touch-first devices (phones, tablets) usually have no keyboard. */
@media (hover: none) and (pointer: coarse) {
  kbd {
    display: none;
  }
}

.actions {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
}
.actions .placeholder {
  visibility: hidden;
}
/* Phones: one full-width button at the bottom of the card. */
@media (max-width: 760px) {
  .actions .btn {
    flex: 1;
    min-height: 44px;
  }
}

.feedback {
  margin-top: 14px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-left-width: 4px;
  border-radius: 3px;
  background: var(--panel-alt);
}
.feedback.ok {
  border-left-color: var(--good);
}
.feedback.ok b {
  color: var(--good);
}
.feedback.bad {
  border-left-color: var(--bad);
}
.feedback.bad b {
  color: var(--bad);
}
.verdict {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 10px;
}

.hints {
  display: grid;
  gap: 4px;
  margin: 8px 0 0;
  padding: 8px 0 0;
  border-top: 1px solid var(--border);
  list-style: none;
}
.hints li {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.hints .pair {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  align-self: center;
}
</style>
