<script setup lang="ts">
// One speed quiz question: two Pokémon and a tie between them, answered by tapping one (or keys 1–3); then the
// result, with what changed in the reader's level and the two on the ladder among their neighbors. The parent decides
// what an answer means.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { pokemon } from '@/data/dex'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { FADE, PRESS } from '@/lib/motion'
import { reveal } from '@/lib/scroll'
import {
  QUICK_MS,
  answerOf,
  type Answer,
  type LadderRow,
  type Question,
  type QuizEvent,
  type Side,
  type Stage,
} from '@/lib/speedQuiz'
import EffectTag from '@/components/EffectTag'
import PokemonIcon from '@/components/PokemonIcon'

const props = defineProps<{
  question: Question
  /** Bumped for every question shown, so the same one asked twice in a row still starts fresh. */
  round: number
  /** What the answer changed, once answered. */
  event: QuizEvent | null
  /** The ladder around the pair, once answered. */
  ladder: LadderRow[]
  /** A build stage's name, for the level change. */
  stageName: (s: Stage) => string
}>()

const emit = defineEmits<{
  answered: [right: boolean, quick: boolean]
  next: []
}>()

const picked = ref<Answer | null>(null)
const answer = computed(() => answerOf(props.question))
const right = computed(() => picked.value === answer.value)
let shownAt = 0
/** Whether the page was hidden since the question was shown: the answer's time doesn't tell then. */
let hidden = false

watch(
  () => props.round,
  () => {
    picked.value = null
    shownAt = performance.now()
    hidden = document.hidden
  },
  { immediate: true },
)
const onVisibility = () => {
  if (document.hidden) hidden = true
}

// Keep what comes next on screen: the result and Next button after answering, and the new question after moving on.
// On phones (where Next comes before the result, under the question), neither scrolls down: with the question brought
// back up for the next one, every question would scroll the page down and up again.
const phoneQuery = window.matchMedia('(max-width: 760px)')
const questionEl = useTemplateRef<HTMLElement>('questionEl')
const afterEl = useTemplateRef<HTMLElement>('after')
// Only a question moved on to with Next: one the page swaps in (its settings changed, a level reset) leaves the page
// where the reader has it.
let movedOn = false
watch(
  () => props.round,
  () => {
    if (movedOn) reveal(questionEl.value, phoneQuery.matches ? questionEl.value : afterEl.value)
    movedOn = false
  },
  { flush: 'post' },
)
function next() {
  movedOn = true
  emit('next')
}

function choose(a: Answer) {
  if (picked.value) return
  picked.value = a
  emit('answered', a === answer.value, !hidden && performance.now() - shownAt < QUICK_MS)
  if (!phoneQuery.matches) nextTick(() => reveal(afterEl.value))
}

const name = (s: Side) => refName(pokemon(s.id))
const asked = (s: Side) => s.id === props.question.a.id || s.id === props.question.b.id

// Each Speed's Pokémon on one line: as many as fit, those asked always, the rest a "+n" (naming them on hover or a
// tap). Measured with them all shown, whenever the ladder changes or its width does.
const ladderEl = useTemplateRef<HTMLElement>('ladderEl')
/** How many of each row's Pokémon show, by the row's index; none measured yet, all of them. */
const fits = ref<number[]>([])
const fitOf = (i: number) => fits.value[i] ?? Infinity
const rest = (sides: Side[], i: number) => sides.slice(fitOf(i)).map(name).join(', ')

async function fit() {
  fits.value = []
  await nextTick()
  const items = ladderEl.value?.children
  if (!items) return
  fits.value = props.ladder.map((row, i) => {
    const mons = items[i]?.querySelector<HTMLElement>('.mons')
    if (row.kind !== 'speed' || !mons) return Infinity
    const gap = parseFloat(getComputedStyle(mons).columnGap) || 0
    const widths = [...mons.querySelectorAll<HTMLElement>('.mon-chip')].map((c) => c.offsetWidth)
    const more = mons.querySelector<HTMLElement>('.more')?.offsetWidth ?? 0
    const room = mons.clientWidth
    const width = (k: number) => widths.slice(0, k).reduce((sum, w) => sum + w + gap, 0)
    if (width(widths.length) - gap <= room) return widths.length
    const least = Math.max(1, row.sides.filter(asked).length)
    let k = widths.length - 1
    while (k > least && width(k) + more > room) k--
    return k
  })
}
watch([() => props.ladder, picked], () => picked.value && fit(), { flush: 'post' })
let observer: ResizeObserver | undefined
let lastWidth = 0
watch(ladderEl, (el) => {
  observer?.disconnect()
  if (!el) return
  lastWidth = el.clientWidth
  observer = new ResizeObserver(() => {
    if (el.clientWidth === lastWidth) return
    lastWidth = el.clientWidth
    fit()
  })
  observer.observe(el)
})

function mark(a: Answer) {
  if (!picked.value) return undefined
  if (a === answer.value) return 'right'
  return a === picked.value ? 'miss' : undefined
}

const verdict = computed(() => {
  const { a, b } = props.question
  if (answer.value === 'tie') return t('speedQuiz.tied', { n: a.speed })
  const [fast, slow] = a.speed > b.speed ? [a, b] : [b, a]
  return t('speedQuiz.faster', { name: name(fast), a: fast.speed, b: slow.speed })
})

const eventText = computed(() => {
  const e = props.event
  if (!e) return ''
  if (e.kind === 'unlock') return t('speedQuiz.unlocked', { stage: props.stageName(e.stage), n: e.level })
  return t(e.kind === 'up' ? 'speedQuiz.levelUp' : 'speedQuiz.levelDown', { n: e.level })
})

// ---- Keyboard: 1 the first, 2 a tie, 3 the second (or the arrows), Enter continues ----
function onKey(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey) return
  const tag = (e.target as HTMLElement | null)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
  if (picked.value) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      next()
    }
    return
  }
  const key: Record<string, Answer> = { 1: 'a', 2: 'tie', 3: 'b', ArrowLeft: 'a', ArrowDown: 'tie', ArrowRight: 'b' }
  const a = key[e.key]
  if (a) {
    e.preventDefault()
    choose(a)
  }
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  document.addEventListener('visibilitychange', onVisibility)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.removeEventListener('visibilitychange', onVisibility)
  observer?.disconnect()
})
</script>

<template>
  <div ref="questionEl">
    <AnimatePresence mode="wait" :initial="false">
      <motion.div
        :key="round"
        :initial="{ opacity: 0, x: 12 }"
        :animate="{ opacity: 1, x: 0 }"
        :exit="{ opacity: 0, x: -12 }"
        :transition="FADE"
      >
        <p class="q">
          <span class="prompt">{{
            t(question.stage === 'base' ? 'speedQuiz.prompt.base' : 'speedQuiz.prompt.sets')
          }}</span>
          <span v-if="question.review" class="tag">{{ t('speedQuiz.review') }}</span>
          <span v-else-if="!question.counts" class="tag">{{ t('speedQuiz.easier') }}</span>
        </p>
        <div class="answers">
          <template v-for="(side, i) in [question.a, question.b]" :key="side.id">
            <motion.button
              type="button"
              class="btn mon"
              :class="[i ? 'second' : 'first', mark(i ? 'b' : 'a')]"
              :disabled="!!picked"
              :while-press="picked ? undefined : PRESS"
              @click="choose(i ? 'b' : 'a')"
            >
              <kbd>{{ i ? 3 : 1 }}</kbd>
              <PokemonIcon :id="side.id" :scale="2" />
              <span class="name">{{ name(side) }}</span>
              <span v-if="side.build" class="build">
                <EffectTag :effect="side.build.effect" />
                <span>{{ t('speed.points', { n: side.build.points }) }}</span>
              </span>
              <span class="speed num" :class="{ shown: picked }">{{ picked ? side.speed : '·' }}</span>
            </motion.button>
            <motion.button
              v-if="!i"
              type="button"
              class="btn tie"
              :class="mark('tie')"
              :disabled="!!picked"
              :while-press="picked ? undefined : PRESS"
              @click="choose('tie')"
            >
              <kbd>2</kbd>{{ t('speedQuiz.tie') }}
            </motion.button>
          </template>
        </div>
      </motion.div>
    </AnimatePresence>
  </div>

  <div ref="after" class="after">
    <motion.div
      v-if="picked"
      class="feedback"
      :class="right ? 'ok' : 'bad'"
      :initial="{ opacity: 0, y: 6 }"
      :animate="{ opacity: 1, y: 0 }"
      :transition="FADE"
    >
      <div class="verdict">
        <b>{{ t(right ? 'quiz.correct' : 'quiz.wrong') }}</b>
        <span>{{ verdict }}</span>
      </div>
      <p v-if="eventText" class="event" :class="event?.kind">{{ eventText }}</p>
      <!-- The two among their neighbors, fastest first. -->
      <ol ref="ladderEl" class="ladder">
        <li v-for="(row, i) in ladder" :key="i" :class="{ gap: row.kind === 'gap' }">
          <template v-if="row.kind === 'speed'">
            <span class="num at">{{ row.speed }}</span>
            <span class="mons">
              <span
                v-for="(s, j) in row.sides"
                v-show="j < fitOf(i)"
                :key="s.id"
                class="mon-chip"
                :class="{ asked: asked(s) }"
              >
                <PokemonIcon :id="s.id" />
                <span>{{ name(s) }}</span>
                <span v-if="asked(s) && s.build" class="build">
                  <EffectTag :effect="s.build.effect" />
                  <span>{{ t('speed.points', { n: s.build.points }) }}</span>
                </span>
              </span>
              <!-- Shown while measuring, at the most it could say, so whatever it says then fits. -->
              <span
                v-if="row.sides.length > 1"
                v-show="!fits.length || fitOf(i) < row.sides.length"
                v-tip="rest(row.sides, i)"
                class="muted more"
                >{{ t('speedQuiz.more', { n: row.sides.length - (fits.length ? fitOf(i) : 0) }) }}</span
              >
            </span>
          </template>
          <template v-else>
            <span class="num at dots" aria-hidden="true">⋮</span>
            <span class="muted between">{{ t('speedQuiz.between', { n: row.speeds }) }}</span>
          </template>
        </li>
      </ol>
    </motion.div>
    <div class="actions">
      <button type="button" class="btn primary" :class="{ placeholder: !picked }" @click="next">
        {{ t('quiz.next') }} <kbd>Enter</kbd>
      </button>
    </div>
  </div>
</template>

<style scoped>
.q {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 10px;
  margin-bottom: 12px;
}
.prompt {
  font-size: calc(15px * var(--text-scale));
  font-weight: bold;
}
.tag {
  padding: 1px 6px;
  border: 1px solid var(--border);
  border-radius: 3px;
  font-size: calc(10px * var(--text-scale));
  color: var(--muted);
}
.small {
  font-size: calc(11px * var(--text-scale));
}

/* The two Pokémon, the tie between them; on phones, under them. */
.answers {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  grid-template-areas: 'first tie second';
  gap: 8px;
  align-items: stretch;
}
.first {
  grid-area: first;
}
.second {
  grid-area: second;
}
.tie {
  grid-area: tie;
}
.mon {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-height: 140px;
  padding: 12px 6px 8px;
  white-space: normal;
}
.name {
  font-weight: bold;
  font-size: calc(14px * var(--text-scale));
  text-align: center;
}
.build {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--muted);
}
.speed {
  margin-top: auto;
  font-size: calc(18px * var(--text-scale));
  font-weight: bold;
  color: var(--muted);
}
.speed:not(.shown) {
  visibility: hidden;
}
.tie {
  align-self: center;
  gap: 6px;
  min-height: 44px;
  font-weight: bold;
}
.mon kbd {
  position: absolute;
  top: 6px;
  left: 6px;
}
.btn:disabled {
  opacity: 0.55;
}
.btn.right {
  opacity: 1;
  border-color: var(--good);
  box-shadow: inset 0 0 0 2px var(--good);
}
.btn.miss {
  opacity: 1;
  border-color: var(--bad);
  box-shadow: inset 0 0 0 2px var(--bad);
}
.btn.right .speed,
.btn.miss .speed {
  color: var(--text);
}
@media (max-width: 480px) {
  .answers {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-areas: 'first second' 'tie tie';
  }
  .mon {
    min-height: 124px;
  }
  .tie {
    align-self: stretch;
  }
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
/* On phones, Next before the result, right under the answers: in reach without scrolling down to it. */
.after {
  display: flex;
  flex-direction: column;
}
@media (max-width: 760px) {
  .actions {
    order: -1;
  }
  .actions .btn.primary {
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
.event {
  margin: 6px 0 0;
  font-weight: bold;
}
.event.up,
.event.unlock {
  color: var(--good);
}
.event.down {
  color: var(--bad);
}

/* The ladder: a row per Speed, the Pokémon at it beside it. */
.ladder {
  display: grid;
  gap: 2px;
  margin: 8px 0 0;
  padding: 8px 0 0;
  border-top: 1px solid var(--border);
  list-style: none;
}
.ladder li {
  display: grid;
  grid-template-columns: 3em minmax(0, 1fr);
  gap: 8px;
  /* The Speed on its row's first line, when its Pokémon wrap onto more: as tall as a line of them (their icon's). */
  align-items: start;
}
.ladder .at {
  line-height: 30px;
  text-align: right;
  font-weight: bold;
}
/* The Speeds left out: a vertical ellipsis down the Speeds' column, how many beside it, quieter than the rows. */
.ladder .dots {
  line-height: inherit;
  padding-right: 0.5ch;
  font-weight: normal;
  color: var(--muted);
}
.ladder .between {
  font-size: 0.85em;
}
.mons {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 10px;
}
.mon-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--muted);
}
.mon-chip.asked {
  color: var(--text);
  font-weight: bold;
}
.mon-chip .build {
  font-weight: normal;
}
</style>
