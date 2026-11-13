<script setup lang="ts">
import { computed, nextTick, shallowRef, watch } from 'vue'
import { createReusableTemplate, useMediaQuery } from '@vueuse/core'
import { Users, X } from '@lucide/vue'
import { pokemon, type PokemonId } from '@/data/dex'
import { speciesOf } from '@/data/pokemon'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { natureEffect } from '@/lib/speed'
import { togglesFor, type BuildToggle, type SpeedBuild } from '@/lib/speedBuild'
import { emptyMember, setsAs, type Member } from '@/lib/team'
import { useMeta } from '@/composables/useMeta'
import { useTeams } from '@/composables/useTeams'
import ModalDialog from '@/components/ModalDialog.vue'
import OptionsMenu from '@/components/OptionsMenu.vue'
import PokemonIcon from '@/components/PokemonIcon'
import SideDrawer from '@/components/SideDrawer.vue'
import StepBack from '@/components/StepBack.vue'
import TeamPicker from '@/components/TeamPicker.vue'

// The speed pages' picking, as the damage calculator's: a drawer beside what it's for on wide screens (`anchor`), a
// dialog on phones. First the Pokémon, from the calc's picker (`TeamPicker`: by usage, searched and filtered, the
// Pokémon picked lately and the favorites over them), or one of the reader's teams' Pokémon at its Speed build there
// (its nature's effect, its Speed points, a Choice Scarf or Iron Ball it holds; its Mega for one holding its stone);
// then, where the page gives one (the `speed` slot), its Speed: the meta's builds of it, its nature and points, or what
// of them is worked out, closed by Done. The step shown is the model: `pokemon`, `speed`, or closed.
const props = defineProps<{
  /** The one picked, if any: the picker's row marked, and the Speed step's subject. */
  id: PokemonId | null
  /** Pokémon on its team, which it can't be (nor one of their species): shown as clashing, not picked. */
  taken?: readonly PokemonId[]
  anchor?: HTMLElement | null
  /** The Speed step's heading. */
  speedTitle?: string
}>()
const emit = defineEmits<{
  pick: [id: PokemonId]
  /** One of the reader's teams' Pokémon, at its build there. */
  team: [id: PokemonId, build: SpeedBuild]
}>()
const step = defineModel<'pokemon' | 'speed' | null>('step', { required: true })
const slots = defineSlots<{ speed?: () => unknown }>()

const { snapshot, data } = useMeta()
const { teams } = useTeams()
const wide = useMediaQuery('(min-width: 900px)')
const [DefineStep, ReuseStep] = createReusableTemplate()

const member = computed((): Member => ({ ...emptyMember(), pokemon: props.id }))
const others = computed((): Member[] => (props.taken ?? []).map((id) => ({ ...emptyMember(), pokemon: id })))
const takenSpecies = computed(() => new Set((props.taken ?? []).map(speciesOf)))
const isTaken = (id: PokemonId) => takenSpecies.value.has(speciesOf(id))

/** On to the Speed step, where there's one (shown once the page has the Pokémon); else closed. Straight on, never
 * closed in between: a dialog closed fires its close event a moment later, which would close it again. */
function then() {
  step.value = slots.speed ? 'speed' : null
}
function pick(value: string) {
  const id = value as PokemonId
  if (isTaken(id)) return
  emit('pick', id)
  then()
}

// The reader's teams with a Pokémon, each one's to load at its build there.
const savedTeams = computed(() => teams.value.filter((tm) => tm.members.some((m) => m.pokemon)))
const SPEED_ITEMS: Partial<Record<string, BuildToggle>> = { choicescarf: 'scarf', ironball: 'ironball' }
function fromTeam(m: Member, close: () => void) {
  const id = setsAs(m)
  close()
  if (!id || isTaken(id)) return
  const toggle = m.item ? SPEED_ITEMS[m.item] : undefined
  emit('team', id, {
    effect: m.nature ? natureEffect(m.nature) : 'neutral',
    points: m.points[5] ?? 0,
    toggles: toggle ? togglesFor(id, [toggle]) : [],
    stage: 0,
  })
  then()
}

const open = computed({
  get: () => !!step.value,
  set: (on) => {
    if (!on) step.value = null
  },
})
// Each step from its top.
const drawer = shallowRef<InstanceType<typeof SideDrawer> | null>(null)
const box = shallowRef<HTMLElement | null>(null)
watch(step, async () => {
  await nextTick()
  ;(drawer.value?.el ?? box.value)?.scrollTo({ top: 0 })
})
const label = computed(() =>
  step.value === 'speed' ? (props.speedTitle ?? t('speedPick.speed')) : t('builder.picker'),
)
</script>

<template>
  <!-- One step's content, in the drawer or the dialog. -->
  <DefineStep>
    <TeamPicker
      v-if="step === 'pokemon'"
      :member
      :others
      field="pokemon"
      :data
      :snapshot
      @pick="pick"
      @close="step = null"
    >
      <div v-if="savedTeams.length" class="quick">
        <div class="quick-load">
          <OptionsMenu :title="t('calc.fromTeams')" :label="t('calc.fromTeams')" :icon="Users" align="left">
            <template #default="{ close }">
              <div class="load">
                <div v-for="tm in savedTeams" :key="tm.id" class="load-team">
                  <span class="load-team-name">{{ tm.name || t('builder.untitled') }}</span>
                  <span class="load-team-mons">
                    <template v-for="(m, i) in tm.members" :key="i">
                      <button
                        v-if="m.pokemon"
                        v-tip="refName(pokemon(m.pokemon))"
                        type="button"
                        class="load-mon"
                        :class="{ clash: isTaken(setsAs(m)!) }"
                        :aria-label="refName(pokemon(m.pokemon))"
                        @click="fromTeam(m, close)"
                      >
                        <PokemonIcon :id="m.pokemon" />
                      </button>
                    </template>
                  </span>
                </div>
              </div>
            </template>
          </OptionsMenu>
        </div>
        <p class="or muted">{{ t('calc.orPick') }}</p>
      </div>
    </TeamPicker>
    <div v-else-if="step === 'speed' && props.id" class="speed-step">
      <div class="picker-head">
        <StepBack @back="step = 'pokemon'" />
        <h2>{{ label }}</h2>
        <button type="button" class="close" :aria-label="t('builder.closePicker')" @click="step = null">
          <X :size="18" aria-hidden="true" />
        </button>
      </div>
      <p class="subject"><PokemonIcon :id="props.id" />{{ refName(pokemon(props.id)) }}</p>
      <slot name="speed" />
      <div class="done-row">
        <button type="button" class="btn primary" @click="step = null">{{ t('speedPick.done') }}</button>
      </div>
    </div>
  </DefineStep>

  <SideDrawer v-if="wide" ref="drawer" :open :anchor="props.anchor" :label defer @close="step = null">
    <ReuseStep />
  </SideDrawer>
  <ModalDialog v-else v-model:open="open" :label fill>
    <div v-if="step" ref="box" class="panel picker-dialog"><ReuseStep /></div>
  </ModalDialog>
</template>

<style scoped>
.picker-dialog {
  width: min(560px, 100vw - 24px);
  max-height: 100%;
  overflow: auto;
}
/* The reader's teams' way over the list, as the calc's picker has it. */
.quick {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.quick-load {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.quick-load :deep(.options-menu) {
  position: static;
}
.quick-load :deep(.pop) {
  max-width: 100%;
}
.load {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 220px;
}
.load-team {
  display: flex;
  flex-direction: column;
  padding: 2px 6px;
}
.load-team-name {
  overflow: hidden;
  font-size: 0.875em;
  font-weight: bold;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.load-team-mons {
  display: flex;
  flex-wrap: wrap;
}
.load-mon {
  display: flex;
  padding: 0;
  line-height: 0;
  background: none;
  border: 1px solid transparent;
  cursor: pointer;
}
.load-mon:hover {
  background: var(--hover);
  border-color: var(--border);
}
/* On its team already: faded, not picked. */
.load-mon.clash {
  opacity: 0.35;
  cursor: not-allowed;
}
.or {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: 0.875em;
}
.or::before,
.or::after {
  content: '';
  flex: 1;
  border-top: 1px solid var(--border);
}
/* Its Speed: the page's controls for it under a heading as the picker's, Done at its foot. */
.speed-step {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.picker-head h2 {
  flex: 1;
  margin: 0;
  font-size: calc(13px * var(--display-scale, 1) * var(--text-scale));
}
.close {
  padding: 2px;
  color: inherit;
  background: none;
  border: 0;
  cursor: pointer;
}
.subject {
  --icon-scale: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-weight: bold;
}
.done-row {
  display: flex;
  justify-content: flex-end;
}
</style>
