<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, ref, shallowRef, triggerRef, useTemplateRef, watch } from 'vue'
import { TYPES } from '@/data/types'
import { t } from '@/i18n'
import { deckStats, emptyDeck, grade, loadDeck, pickNext, rollDay, saveDeck } from '@/lib/srs'
import {
  MULTI_QUESTIONS,
  cardKind,
  cardLabel,
  getCard,
  getCurriculum,
  multiQuestion,
  newCardOrder,
  type Card,
} from '@/lib/quiz'
import { CHOICES, LIMITS, defaultSettings, loadSettings, normalize, saveSettings } from '@/lib/quizSettings'
import { loadPractice, pickPractice, practicePool, savePractice } from '@/lib/practice'
import QuizCard from '@/components/QuizCard.vue'
import TypePicker from '@/components/TypePicker.vue'
import { confirmDialog } from '@/composables/useConfirm'
import { toTop } from '@/lib/scroll'

// Dev-only controls to fast-forward the quiz; left out of production builds.
const QuizDevTools = import.meta.env.DEV ? defineAsyncComponent(() => import('@/dev/QuizDevTools.vue')) : null

const deck = shallowRef(loadDeck())
// Settings live apart from progress, so resetting progress keeps them. Decks used to hold the dual types choice.
const settings = ref(loadSettings(deck.value.duals))
if (deck.value.duals !== undefined) {
  delete deck.value.duals
  saveDeck(deck.value)
  saveSettings(settings.value)
}
rollDay(deck.value, settings.value.newPerDay)
const { basic, dual } = getCurriculum()

const graduated = computed(() => {
  void deck.value.tick
  let n = 0
  for (const c of basic) {
    const s = deck.value.cards[c.id]
    if (s && s.reps > 0) n++
  }
  return n
})
const unlockAt = computed(() => Math.ceil(basic.length * settings.value.dualUnlock))
const dualsAuto = computed(() => graduated.value >= unlockAt.value)
const dualsOn = computed(() => {
  const mode = settings.value.duals
  return mode === 'auto' ? dualsAuto.value : mode === 'on'
})

/**
 * Cards switched off in the settings (dual types, tick-all cards or some of their questions) are left out
 * of study entirely, reviews included; they resume, schedules intact, when switched back on.
 */
function skip(id: string): boolean {
  const kind = cardKind(id)
  if (kind === 'dual') return !dualsOn.value
  if (kind === 'multi') return !settings.value.multiEvery || !settings.value.questions[multiQuestion(id)]
  return false
}

/**
 * New cards in study order. Each pool has its own rate, counted over the cards seen so far:
 * one tick-all card in every `multiEvery` basic cards, and one dual in every `dualEvery` cards.
 */
function* newIds() {
  const order = newCardOrder(deck.value.seed!)
  const s = settings.value
  const seen = { single: 0, multi: 0, dual: 0 }
  for (const id of Object.keys(deck.value.cards)) seen[cardKind(id)]++
  const all = seen.single + seen.multi + seen.dual
  if (dualsOn.value && all % s.dualEvery === s.dualEvery - 1) yield* order.dual
  if (s.multiEvery && (seen.single + seen.multi) % s.multiEvery === s.multiEvery - 1) yield* order.multi
  yield* order.single
  yield* order.multi
  yield* order.dual
}

// ---- Mode: study follows the schedule; practice is endless random cards that are never recorded ----
const practicing = ref(false)
const practice = ref(loadPractice())
const pool = computed(() => {
  void deck.value.tick
  return practicePool(practice.value, deck.value, settings.value.questions)
})
const hasWeak = computed(() => {
  void deck.value.tick
  return Object.values(deck.value.cards).some((c) => c.lapses > 0)
})
let recent: string[] = []

// ---- Current card ----
const current = ref<Card | null>(null)
/** Bumped for every card shown, so QuizCard starts fresh even when a card is asked twice in a row. */
const round = ref(0)
const answered = ref(false)
const cardRef = useTemplateRef<InstanceType<typeof QuizCard>>('card')

function next(ignoreLimit = false) {
  const id = practicing.value
    ? pickPractice(pool.value, recent)
    : pickNext(deck.value, { newIds: newIds(), avoid: current.value?.id, ignoreLimit, skip })
  if (id && practicing.value) recent = [...recent.slice(-30), id]
  current.value = id ? (getCard(id) ?? null) : null
  answered.value = false
  round.value++
}

const session = ref({ seen: 0, correct: 0 })
const practiceStats = ref({ seen: 0, correct: 0, streak: 0 })

function onAnswered(correct: boolean, ms: number) {
  answered.value = true
  const c = current.value!
  if (practicing.value) {
    const p = practiceStats.value
    p.seen++
    if (correct) p.correct++
    p.streak = correct ? p.streak + 1 : 0
    return
  }
  const secs = c.kind === 'mult' ? settings.value.slowMult : settings.value.slowMulti
  const slow = secs > 0 && ms > secs * 1000
  grade(deck.value, c.id, correct ? (slow ? 3 : 5) : 1)
  saveDeck(deck.value)
  triggerRef(deck)
  session.value.seen++
  if (correct) session.value.correct++
}

// Starting practice and resetting progress start over from the top of the page. It scrolls once the new card is in,
// replacing the card's own scroll, which only goes as far as bringing the question on screen.
async function restart() {
  next()
  await nextTick()
  toTop()
}

function startPractice() {
  practicing.value = true
  practiceStats.value = { seen: 0, correct: 0, streak: 0 }
  recent = []
  void restart()
}
function stopPractice() {
  practicing.value = false
  current.value = null
  next()
}

next()

/** Dev: answer the current card as if right (quick or slow) or wrong. */
const simulate = (correct: boolean, slow?: boolean) => cardRef.value?.simulate(correct, slow)
/** Dev: the card the quiz would show next, ignoring the daily limit. */
const devPick = (avoid?: string) => pickNext(deck.value, { newIds: newIds(), avoid, ignoreLimit: true, skip })
const devBasicIds = computed(() => {
  const order = newCardOrder(deck.value.seed!)
  return [...order.single, ...order.multi]
})
function devDone() {
  saveDeck(deck.value)
  triggerRef(deck)
  next()
}

// ---- Stats & settings ----
const stats = computed(() => {
  void deck.value.tick
  return deckStats(deck.value, Date.now(), skip)
})
const total = computed(() => [...basic, ...dual].filter((c) => !skip(c.id)).length)
const percent = (n: number, of: number) => (of ? Math.round((100 * n) / of) : 0)
const weakSpots = computed(() => {
  void deck.value.tick
  return Object.entries(deck.value.cards)
    .filter(([id, s]) => s.lapses > 0 && !skip(id))
    .sort((a, b) => b[1].lapses - a[1].lapses || b[1].ease - a[1].ease)
    .slice(0, 8)
    .map(([id, s]) => ({ id, lapses: s.lapses, learning: s.step >= 0, card: getCard(id) }))
    .filter((w) => w.card)
})

function learnMore() {
  deck.value.newLimit += settings.value.learnMoreStep
  saveDeck(deck.value)
  triggerRef(deck)
  next()
}

/** Whether the unanswered card on screen is no longer allowed by the settings or practice options. */
function currentExcluded(): boolean {
  const c = current.value
  if (!c || answered.value) return false
  return practicing.value ? !pool.value.some((w) => w.id === c.id) : skip(c.id)
}

// Settings apply from the next card; an unanswered card that was just switched off is replaced now.
let newPerDay = settings.value.newPerDay
watch(
  settings,
  (s) => {
    // A cleared or out-of-range number goes back to its default.
    const clean = normalize(s)
    if (JSON.stringify(clean) !== JSON.stringify(s)) {
      settings.value = clean
      return
    }
    // Today's allowance follows the new daily number, keeping anything "Learn more" added.
    if (s.newPerDay !== newPerDay) {
      deck.value.newLimit = Math.max(0, deck.value.newLimit + s.newPerDay - newPerDay)
      newPerDay = s.newPerDay
      saveDeck(deck.value)
      triggerRef(deck)
    }
    saveSettings(s)
    if (!current.value || currentExcluded()) next()
  },
  { deep: true },
)

watch(
  practice,
  (o) => {
    savePractice(o)
    if (practicing.value && (!current.value || currentExcluded())) next()
  },
  { deep: true },
)

function restoreDefaults() {
  settings.value = defaultSettings()
}

const QUESTION_LABELS = {
  weak: 'settings.q.weak',
  resist: 'settings.q.resist',
  immune: 'settings.q.immune',
  se: 'settings.q.se',
  nve: 'settings.q.nve',
  noeff: 'settings.q.noeff',
} as const

async function reset() {
  if (!(await confirmDialog({ message: t('quiz.resetConfirm'), confirm: t('quiz.reset'), danger: true }))) return
  deck.value = emptyDeck(settings.value.newPerDay)
  saveDeck(deck.value)
  session.value = { seen: 0, correct: 0 }
  current.value = null
  await restart()
}
</script>

<template>
  <div class="layout">
    <section class="panel card">
      <div v-if="practicing" class="practice-bar small">
        <span class="muted">{{ t('practice.bar') }}</span>
        <button type="button" class="link" @click="stopPractice">{{ t('practice.back') }}</button>
      </div>

      <QuizCard
        v-if="current"
        ref="card"
        :card="current"
        :round="round"
        v-model:hints="settings.hints"
        @answered="onAnswered"
        @next="next()"
      />
      <div v-else-if="practicing" class="done">
        <p class="muted">{{ t('practice.empty') }}</p>
      </div>
      <div v-else class="done">
        <h2>{{ t('quiz.caughtUp') }}</h2>
        <p class="muted">{{ t('quiz.caughtUpText', { n: deck.newLimit }) }}</p>
        <div class="buttons">
          <button type="button" class="btn primary" @click="learnMore">
            {{ t('quiz.learnMore', { n: settings.learnMoreStep }) }}
          </button>
          <button type="button" class="btn" @click="startPractice">{{ t('practice.start') }}</button>
        </div>
      </div>
    </section>

    <aside>
      <component
        :is="QuizDevTools"
        v-if="QuizDevTools && !practicing"
        :deck="deck"
        :can-answer="!!current && !answered"
        :simulate="simulate"
        :pick="devPick"
        :basic-ids="devBasicIds"
        :graduated="graduated"
        :unlock-at="unlockAt"
        :done="devDone"
      />

      <div v-if="practicing" class="panel practice small">
        <h2>{{ t('practice.title') }}</h2>
        <dl class="stats">
          <dt>{{ t('practice.answered') }}</dt>
          <dd class="num">
            {{ practiceStats.correct }}/{{ practiceStats.seen }}
            <span class="muted">({{ percent(practiceStats.correct, practiceStats.seen) }}%)</span>
          </dd>
          <dt>{{ t('practice.streak') }}</dt>
          <dd class="num">{{ practiceStats.streak }}</dd>
        </dl>

        <h3>{{ t('practice.cards') }}</h3>
        <label class="check"><input v-model="practice.single" type="checkbox" /> {{ t('practice.single') }}</label>
        <label class="check"><input v-model="practice.multi" type="checkbox" /> {{ t('practice.multi') }}</label>
        <label class="check"><input v-model="practice.dual" type="checkbox" /> {{ t('practice.dual') }}</label>
        <label class="check">
          <input v-model="practice.weakOnly" type="checkbox" :disabled="!hasWeak && !practice.weakOnly" />
          {{ t('practice.weakOnly') }}
        </label>

        <h3>{{ t('practice.focus') }}</h3>
        <TypePicker v-model="practice.focus" />
        <p class="muted note">{{ t('practice.focusNote') }}</p>
      </div>

      <div v-else class="panel">
        <h2>{{ t('quiz.progress') }}</h2>
        <dl class="stats">
          <dt>{{ t('quiz.session') }}</dt>
          <dd class="num">
            {{ session.correct }}/{{ session.seen }}
            <span class="muted">({{ percent(session.correct, session.seen) }}%)</span>
          </dd>
          <dt>{{ t('quiz.newToday') }}</dt>
          <dd class="num">{{ Math.min(deck.newToday, deck.newLimit) }}/{{ deck.newLimit }}</dd>
          <dt>{{ t('quiz.learning') }}</dt>
          <dd class="num">{{ stats.learning }}</dd>
          <dt>{{ t('quiz.due') }}</dt>
          <dd class="num">{{ stats.due }}</dd>
          <dt>{{ t('quiz.seen') }}</dt>
          <dd class="num">{{ stats.seen }}/{{ total }}</dd>
          <dt>{{ t('quiz.mature') }}</dt>
          <dd class="num">{{ stats.mature }}</dd>
        </dl>
        <button type="button" class="btn" @click="startPractice">{{ t('practice.start') }}</button>
        <p class="muted small side-note">{{ t('practice.note') }}</p>
      </div>

      <details class="panel settings small">
        <summary>{{ t('settings.title') }}</summary>
        <label class="row">
          <span>{{ t('settings.newPerDay') }}</span>
          <input
            v-model.lazy.number="settings.newPerDay"
            type="number"
            :min="LIMITS.newPerDay[0]"
            :max="LIMITS.newPerDay[1]"
            required
          />
        </label>
        <label class="row">
          <span>{{ t('settings.learnMoreStep') }}</span>
          <input
            v-model.lazy.number="settings.learnMoreStep"
            type="number"
            :min="LIMITS.learnMoreStep[0]"
            :max="LIMITS.learnMoreStep[1]"
            required
          />
        </label>

        <label class="row">
          <span>{{ t('settings.multiEvery') }}</span>
          <select v-model.number="settings.multiEvery">
            <option v-for="n in CHOICES.multiEvery" :key="n" :value="n">
              {{ n ? t('settings.everyN', { n }) : t('quiz.off') }}
            </option>
          </select>
        </label>
        <fieldset :disabled="!settings.multiEvery">
          <legend>{{ t('settings.questions') }}</legend>
          <label v-for="q in MULTI_QUESTIONS" :key="q" class="check">
            <input v-model="settings.questions[q]" type="checkbox" />
            {{ t(QUESTION_LABELS[q]) }}
          </label>
        </fieldset>

        <label class="row">
          <span>{{ t('quiz.dualTypes') }}</span>
          <select v-model="settings.duals">
            <option value="auto">
              {{ t('quiz.auto', { s: dualsAuto ? t('quiz.unlocked') : `${graduated}/${unlockAt}` }) }}
            </option>
            <option value="on">{{ t('quiz.on') }}</option>
            <option value="off">{{ t('quiz.off') }}</option>
          </select>
        </label>
        <label class="row">
          <span>{{ t('settings.dualUnlock') }}</span>
          <select v-model.number="settings.dualUnlock" :disabled="settings.duals !== 'auto'">
            <option v-for="n in CHOICES.dualUnlock" :key="n" :value="n">
              {{ t('settings.percent', { n: n * 100 }) }}
            </option>
          </select>
        </label>
        <label class="row">
          <span>{{ t('settings.dualEvery') }}</span>
          <select v-model.number="settings.dualEvery" :disabled="settings.duals === 'off'">
            <option v-for="n in CHOICES.dualEvery" :key="n" :value="n">{{ t('settings.everyN', { n }) }}</option>
          </select>
        </label>

        <label class="row">
          <span>{{ t('settings.slowMult') }}</span>
          <input
            v-model.lazy.number="settings.slowMult"
            type="number"
            :min="LIMITS.slow[0]"
            :max="LIMITS.slow[1]"
            required
          />
        </label>
        <label class="row">
          <span>{{ t('settings.slowMulti') }}</span>
          <input
            v-model.lazy.number="settings.slowMulti"
            type="number"
            :min="LIMITS.slow[0]"
            :max="LIMITS.slow[1]"
            required
          />
        </label>
        <p class="muted">{{ t('settings.slowNote') }}</p>

        <button type="button" class="btn" @click="restoreDefaults">{{ t('settings.restore') }}</button>
      </details>

      <div class="panel">
        <h2>{{ t('quiz.weakSpots') }}</h2>
        <p v-if="!weakSpots.length" class="muted small">{{ t('quiz.weakEmpty') }}</p>
        <ol class="weak">
          <li v-for="w in weakSpots" :key="w.id">
            <span>{{ cardLabel(w.card!) }}</span>
            <span class="muted">×{{ w.lapses }}</span>
          </li>
        </ol>
      </div>

      <div class="panel about small muted">
        <p>{{ t('quiz.about1') }}</p>
        <p>{{ t('quiz.about2', { n: TYPES.length }) }}</p>
        <button type="button" class="btn" @click="reset">{{ t('quiz.reset') }}</button>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 12px;
  align-items: start;
}
@media (max-width: 760px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }
}

.card {
  min-height: 260px;
}
.small {
  font-size: calc(11px * var(--text-scale));
}

.done {
  text-align: center;
  padding: 40px 0;
}
.done .buttons {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
}

/* Practice: a slim bar above the card, and its options in the sidebar. */
.practice-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin: -12px -12px 12px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--border);
  border-radius: 4px 4px 0 0;
  background: var(--panel-alt);
}
.link {
  padding: 0;
  border: none;
  background: none;
  color: var(--link);
  cursor: pointer;
}
.link:hover {
  text-decoration: underline;
}
.practice h3 {
  margin: 10px 0 6px;
  font-size: inherit;
  color: var(--muted);
}
.practice .check,
.settings .check {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.practice .note {
  margin: 6px 0 0;
}
.side-note {
  margin: 6px 0 0;
}

.stats {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 2px 12px;
  margin: 0 0 10px;
}
.stats dt {
  color: var(--muted);
}
.stats dd {
  margin: 0;
  text-align: right;
  font-weight: bold;
}

.settings summary {
  cursor: pointer;
  font-family: var(--font-display, inherit);
  font-weight: bold;
}
.settings[open] summary {
  margin-bottom: 10px;
}
.settings .row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}
.settings input[type='number'] {
  width: 4.5em;
  font: inherit;
  color: inherit;
  background: var(--panel-alt);
  border: 1px solid var(--border-strong);
  border-radius: 3px;
  padding: 2px 4px;
}
.settings fieldset {
  margin: 4px 0 10px;
  padding: 6px 8px 0;
  border: 1px solid var(--border);
  border-radius: 3px;
}
.settings fieldset:disabled {
  opacity: 0.5;
}
.settings legend {
  padding: 0 4px;
  color: var(--muted);
}
.settings p {
  margin: 0 0 10px;
}

select {
  font: inherit;
  color: inherit;
  background: var(--panel-alt);
  border: 1px solid var(--border-strong);
  border-radius: 3px;
  padding: 2px 4px;
}
select:disabled {
  opacity: 0.5;
}

.weak {
  margin: 0;
  padding-left: 20px;
}
.weak li::marker {
  color: var(--muted);
}
.weak li span:last-child {
  float: right;
}

.about p {
  margin-bottom: 8px;
}
</style>
