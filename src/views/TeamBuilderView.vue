<script setup lang="ts">
import { computed, nextTick, onMounted, shallowRef, useTemplateRef, watch, type ComponentPublicInstance } from 'vue'
import { createReusableTemplate, useElementSize, useEventListener, useMediaQuery } from '@vueuse/core'
import { ChevronDown, ClipboardPaste, Copy, Plus, Star, Trash2 } from '@lucide/vue'
import { ability, item, move, pokemon, type AbilityId, type ItemId, type MoveId, type PokemonId } from '@/data/dex'
import { loadLearnsets, POKEMON, splitForme } from '@/data/pokemon'
import { RULES } from '@/data/rules'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { confirmDialog } from '@/composables/useConfirm'
import { useMeta } from '@/composables/useMeta'
import { useTeams } from '@/composables/useTeams'
import { membersPaste, parsePaste, type PasteProblem } from '@/lib/pokepaste'
import { loadMetaBalance, type MetaBalance } from '@/lib/teamBalance'
import {
  emptyMember,
  pickedAs,
  battlers,
  evolvingSlot,
  setsAs,
  teamIssues,
  type Field,
  type Member,
  type Team,
  type TeamIssue,
} from '@/lib/team'
import CopyPaste from '@/components/CopyPaste.vue'
import MetaDialog from '@/components/MetaDialog.vue'
import ModalDialog from '@/components/ModalDialog.vue'
import SectionNav from '@/components/SectionNav.vue'
import SideDrawer from '@/components/SideDrawer.vue'
import PokemonIcon from '@/components/PokemonIcon'
import TeamBalance from '@/components/TeamBalance.vue'
import TeamPicker from '@/components/TeamPicker.vue'
import TeamSlot from '@/components/TeamSlot.vue'

// The team builder: a team's six slots, laid out as a tournament team's sets (`TeamSlot`), each part a button opening
// its picker (`TeamPicker`: the meta's searches, with the shares of the data shown): on wide screens a drawer from the
// side away from the slot, over a backdrop dimming the page but for the slot, which stays as it is to pick on; on
// phones a dialog over it. Picking one moves on to the next part the slot hasn't got yet. The team goes out as a
// paste (Showdown's format, `membersPaste`) and comes in from one (`parsePaste`, what it couldn't read said); under it,
// its Defense and Offense, each how it stands against the meta on the physical and special sides and its type coverage
// (`TeamBalance`, the meta's numbers worked out once the page is in, `loadMetaBalance`). What it breaks of the rules (`teamIssues`: Species and
// Item Clause, more than two Megas; a move twice, another Pokémon's Mega Stone or mask, an ability it can't have, a move not in its learnset) is listed under its name, each part that clashes marked on its slot,
// and the pickers mark what the other slots have taken already; nothing's stopped, a paste bringing in what it may.
// Every team
// is saved in this browser as it's edited (`useTeams`), listed over the open one, the starred first.
const { teams, current, open, create, touch, remove, duplicate, star } = useTeams()
const { snapshot, data } = useMeta()
const wide = useMediaQuery('(min-width: 900px)')

const defaultName = () => t('builder.defaultName', { n: teams.value.length + 1 })
onMounted(() => {
  if (!current.value) {
    const latest = teams.value[0]
    if (latest) open(latest.id)
    else create(defaultName())
  }
})
const members = computed(() => current.value?.members ?? [])

// The part being picked: its slot and field.
const picking = shallowRef<{ slot: number; field: Field } | null>(null)
watch(
  () => current.value?.id,
  () => (picking.value = null),
)
const pickerOpen = computed({
  get: () => !!picking.value,
  set: (on) => {
    if (!on) picking.value = null
  },
})
// On wide screens the picker is a drawer (`SideDrawer`), the slot being picked for left clear beside it.
const slotEls: (HTMLElement | null)[] = []
const setSlotEl = (i: number, el: Element | ComponentPublicInstance | null) =>
  (slotEls[i] = el && '$el' in el ? (el.$el as HTMLElement) : (el as HTMLElement | null))
const drawerOpen = computed(() => wide.value && !!picking.value)
const drawerAnchor = computed(() => (picking.value ? slotEls[picking.value.slot] : null))
const drawer = shallowRef<InstanceType<typeof SideDrawer> | null>(null)

// Each slot's points editor, folded at first.
const editing = shallowRef<boolean[]>([])
const setEditing = (i: number, on: boolean) => {
  const next = [...editing.value]
  next[i] = on
  editing.value = next
}

/** The next part a slot hasn't got, in the order a set is put together; null once it has them all. */
function nextField(m: Member, after: Field): Field | null {
  const order: Field[] = ['pokemon', 'item', 'ability', 'nature', 0, 1, 2, 3]
  for (const f of order.slice(order.indexOf(after) + 1)) {
    if (typeof f === 'number' ? !m.moves[f] : !m[f]) return f
  }
  return null
}

function update(slot: number, patch: Partial<Member>) {
  const team = current.value
  if (!team) return
  team.members[slot] = { ...team.members[slot]!, ...patch }
  touch()
}

function pick(value: string) {
  const p = picking.value
  const team = current.value
  if (!p || !team) return
  const m = team.members[p.slot]!
  if (p.field === 'pokemon') {
    const { pokemon, item } = pickedAs(value as PokemonId)
    if (pokemon !== m.pokemon) {
      // Another Pokémon: a set of its own. One with a single ability has it already.
      const abilities = POKEMON[pokemon].abilities
      update(p.slot, {
        ...emptyMember(),
        pokemon,
        item: item ?? null,
        ability: abilities.length === 1 ? abilities[0]! : null,
      })
    } else if (item) update(p.slot, { item })
  } else if (p.field === 'item') update(p.slot, { item: (value || null) as ItemId | null })
  else if (p.field === 'ability') update(p.slot, { ability: value as AbilityId })
  else if (p.field === 'nature') update(p.slot, { nature: value })
  else {
    // A move it has in another place trades places with the one it replaces.
    const moves = [...m.moves]
    const was = moves.indexOf(value as MoveId)
    if (was >= 0) moves[was] = moves[p.field]!
    moves[p.field] = value as MoveId
    update(p.slot, { moves })
  }
  const next = nextField(team.members[p.slot]!, p.field)
  picking.value = next === null ? null : { slot: p.slot, field: next }
}

// The drawer or dialog the picker scrolls in, back at its top for each part picked.
const pickerBox = shallowRef<HTMLElement | null>(null)
watch(picking, async () => {
  await nextTick()
  const box = drawer.value?.el ?? pickerBox.value
  box?.scrollTo({ top: 0 })
})

const clearSlot = (i: number) => {
  update(i, emptyMember())
  if (picking.value?.slot === i) picking.value = null
}

// The team's name, edited in place.
const name = computed({
  get: () => current.value?.name ?? '',
  set: (v: string) => {
    if (!current.value) return
    current.value.name = v
    touch()
  },
})

async function removeTeam(id: string, label: string) {
  const ok = await confirmDialog({
    message: t('builder.deleteConfirm', { name: label || t('builder.untitled') }),
    confirm: t('builder.delete'),
    danger: true,
  })
  if (!ok) return
  remove(id)
  if (!current.value) {
    const latest = teams.value[0]
    if (latest) open(latest.id)
    else create(defaultName())
  }
}

// Importing a paste: into the open team when it's empty, else as a new team.
const importing = shallowRef(false)
const pasted = shallowRef('')
const problems = shallowRef<PasteProblem[]>([])
function importPaste() {
  const { members: read, problems: found } = parsePaste(pasted.value)
  problems.value = found
  if (!read.length) return
  const team = current.value
  if (team && team.members.every((m) => !m.pokemon)) {
    read.forEach((m, i) => (team.members[i] = m))
    touch()
  } else create(t('builder.imported'), read)
  pasted.value = ''
  if (!found.length) importing.value = false
}
const problemText = (p: PasteProblem) =>
  p.kind === 'tooMany' ? t('builder.problem.tooMany', { n: p.n }) : t(`builder.problem.${p.kind}`, { name: p.name })
watch(importing, (on) => {
  if (on) problems.value = []
})

const paste = computed(() => membersPaste(members.value))
const hasAny = computed(() => members.value.some((m) => m.pokemon))
// Which slot Mega Evolves in the insights (one at most, as in a battle), and the slots as they battle for them;
// toggling a slot's Mega makes it the one, or none when it was.
const evolving = computed(() => (current.value ? evolvingSlot(current.value) : null))
const battling = computed(() => battlers(members.value, evolving.value))
function toggleMega(slot: number) {
  const team = current.value
  if (!team) return
  team.mega = evolving.value === slot ? null : slot
  touch()
}
const spreadsOf = (m: Member) => {
  const id = setsAs(m)
  return (id && data.value?.[id]?.spreads) || []
}
// Its sections, as the row of links at its top lists them: the coverage once there's a Pokémon to cover.
const sections = computed(() => [
  { id: 'sec-teams', label: t('builder.section.teams') },
  { id: 'sec-team', label: t('builder.section.team') },
  ...(hasAny.value
    ? [
        { id: 'sec-defense', label: t('builder.section.defense') },
        { id: 'sec-offense', label: t('builder.section.offense') },
      ]
    : []),
])
// What the team breaks of the rules, under its name, and each slot's parts that clash, saying why.
// The learnsets, to tell a move its Pokémon can't learn: loaded once, the moves unchecked until they're in.
const learnsets = shallowRef<Record<PokemonId, MoveId[]> | null>(null)
onMounted(async () => (learnsets.value = await loadLearnsets()))
const issues = computed(() => teamIssues(members.value, learnsets.value))
const speciesName = (id: PokemonId) => splitForme(id, refName(pokemon(id))).species
function issueText(i: TeamIssue): string {
  switch (i.kind) {
    case 'species':
      return t('builder.issue.species', { n: i.slots.length, name: speciesName(i.pokemon) })
    case 'item':
      return t('builder.issue.item', { n: i.slots.length, item: refName(item(i.item)), max: RULES.itemClause ?? 0 })
    case 'megas':
      return t('builder.issue.megas', { n: i.slots.length, max: RULES.megas })
    case 'move':
      return t('builder.issue.move', { name: refName(pokemon(i.pokemon)), move: refName(move(i.move)) })
    case 'ability':
      return t('builder.issue.ability', { name: refName(pokemon(i.pokemon)), ability: refName(ability(i.ability)) })
    case 'learn':
      return t('builder.issue.learn', { name: refName(pokemon(i.pokemon)), move: refName(move(i.move)) })
    case 'holder':
      return t('builder.issue.holder', { name: refName(pokemon(i.pokemon)), item: refName(item(i.item)) })
  }
}
const clashes = computed(() =>
  members.value.map((_, s) => {
    const of = issues.value.filter((i) => i.slots.includes(s))
    const tip = (part: TeamIssue['part']) =>
      of
        .filter((i) => i.part === part)
        .map(issueText)
        .join(' · ') || undefined
    return {
      pokemon: tip('pokemon'),
      item: tip('item'),
      ability: tip('ability'),
      moves: Object.fromEntries(
        [...new Set(of.flatMap((i) => ('move' in i ? [i.move] : [])))].map((mv) => [
          mv,
          of
            .filter((i) => 'move' in i && i.move === mv)
            .map(issueText)
            .join(' · '),
        ]),
      ) as Partial<Record<MoveId, string>>,
    }
  }),
)
const othersOf = (slot: number) => members.value.filter((_, i) => i !== slot)
// The meta's side of the team's Defense and Offense, worked out once per dataset when the browser is idle, so the page
// isn't held up: undefined until then, null with no meta.
const balance = shallowRef<MetaBalance | null | undefined>(undefined)
watch(
  [snapshot, data],
  ([s, d]) => {
    balance.value = s ? undefined : null
    if (d) loadMetaBalance(d).then((b) => data.value === d && (balance.value = b))
  },
  { immediate: true },
)
// The saved teams on one row while they fit; past it, a drop-down showing the open one, every team in it. The row is
// kept laid out (hidden) while folded, measured to know when it fits again; a team's chip drawn once for both.
const [DefineTeam, ReuseTeam] = createReusableTemplate<{ team: Team }>()
const savedBox = useTemplateRef<HTMLElement>('savedBox')
const savedRow = useTemplateRef<HTMLElement>('savedRow')
const { width: boxWidth } = useElementSize(savedBox)
const { width: rowWidth } = useElementSize(savedRow)
const folded = computed(() => rowWidth.value > boxWidth.value + 0.5)
const menuOpen = shallowRef(false)
watch(
  () => current.value?.id,
  () => (menuOpen.value = false),
)
useEventListener(document, 'pointerdown', (e: PointerEvent) => {
  if (menuOpen.value && !savedBox.value?.contains(e.target as Node)) menuOpen.value = false
})
useEventListener(document, 'keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') menuOpen.value = false
})
const icons = (members: readonly Member[]) => members.flatMap((m) => (m.pokemon ? [m.pokemon] : []))
</script>

<template>
  <div class="builder">
    <!-- Its sections, a row of links stuck to the top, the one being read marked. -->
    <SectionNav :sections />
    <section id="sec-teams" class="panel">
      <div class="head">
        <h1>{{ t('title.teamBuilder') }}</h1>
        <!-- Starting a team, or bringing one in, on the heading's line. -->
        <span class="head-actions">
          <button type="button" class="btn" @click="create(defaultName())">
            <Plus :size="14" aria-hidden="true" />{{ t('builder.new') }}
          </button>
          <button type="button" class="btn" @click="importing = true">
            <ClipboardPaste :size="14" aria-hidden="true" />{{ t('builder.import') }}
          </button>
        </span>
        <MetaDialog v-if="snapshot" class="head-meta" />
      </div>
      <!-- A saved team's chip: its star, its name and Pokémon opening it, duplicating and deleting it. -->
      <DefineTeam v-slot="{ team }">
        <li class="saved-team" :class="{ on: team.id === current?.id }">
          <button
            v-tip="t(team.starred ? 'builder.unstar' : 'builder.star')"
            type="button"
            class="icon-btn star"
            :class="{ starred: team.starred }"
            :aria-pressed="!!team.starred"
            :aria-label="t(team.starred ? 'builder.unstar' : 'builder.star')"
            @click="star(team.id)"
          >
            <Star :size="14" aria-hidden="true" />
          </button>
          <button type="button" class="saved-open" @click="open(team.id)">
            <span class="saved-name">{{ team.name || t('builder.untitled') }}</span>
            <span class="saved-icons"><PokemonIcon v-for="(p, i) in icons(team.members)" :id="p" :key="i" /></span>
          </button>
          <button
            v-tip="t('builder.duplicate')"
            type="button"
            class="icon-btn"
            :aria-label="t('builder.duplicate')"
            @click="duplicate(team.id, t('builder.copyOf', { name: team.name || t('builder.untitled') }))"
          >
            <Copy :size="14" aria-hidden="true" />
          </button>
          <button
            v-tip="t('builder.delete')"
            type="button"
            class="icon-btn"
            :aria-label="t('builder.delete')"
            @click="removeTeam(team.id, team.name)"
          >
            <Trash2 :size="14" aria-hidden="true" />
          </button>
        </li>
      </DefineTeam>
      <!-- The saved teams, the starred first, the open one marked: a row while they fit, else a drop-down. -->
      <div ref="savedBox" class="saved-box" :class="{ folded }">
        <ul ref="savedRow" class="saved" :aria-label="t('builder.saved')" :inert="folded">
          <ReuseTeam v-for="team in teams" :key="team.id" :team />
        </ul>
        <div v-if="folded" class="saved-menu">
          <button type="button" class="saved-toggle" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">
            <span class="saved-name">{{ current?.name || t('builder.untitled') }}</span>
            <span class="saved-icons"><PokemonIcon v-for="(p, i) in icons(members)" :id="p" :key="i" /></span>
            <span class="muted saved-count">{{ t('builder.teamsCount', { n: teams.length }) }}</span>
            <ChevronDown :size="16" aria-hidden="true" />
          </button>
          <ul v-if="menuOpen" class="saved-list panel" :aria-label="t('builder.saved')">
            <ReuseTeam v-for="team in teams" :key="team.id" :team />
          </ul>
        </div>
      </div>
    </section>

    <div v-if="current" class="work">
      <section id="sec-team" class="panel team-panel">
        <div class="team-head">
          <input
            v-model="name"
            class="team-name"
            :placeholder="t('builder.untitled')"
            :aria-label="t('builder.name')"
          />
          <CopyPaste v-if="hasAny" :text="paste" />
        </div>
        <ul v-if="issues.length" class="issues" aria-live="polite">
          <li v-for="(i, n) in issues" :key="n">{{ issueText(i) }}</li>
        </ul>
        <ul class="sets">
          <TeamSlot
            v-for="(m, i) in members"
            :key="i"
            :ref="(el) => setSlotEl(i, el)"
            :member="m"
            :active="picking?.slot === i ? picking.field : null"
            :spreads="spreadsOf(m)"
            :clashes="clashes[i]"
            :evolved="evolving === i"
            @mega="toggleMega(i)"
            :open="!!editing[i]"
            @update:open="setEditing(i, $event)"
            @field="picking = { slot: i, field: $event }"
            @change="update(i, $event)"
            @clear="clearSlot(i)"
          />
        </ul>
      </section>
      <template v-if="hasAny">
        <TeamBalance id="sec-defense" side="defense" :members="battling" :meta="balance" />
        <TeamBalance id="sec-offense" side="offense" :members="battling" :meta="balance" />
      </template>
    </div>

    <!-- On wide screens, the picker as a drawer over the page, the slot left clear. -->
    <SideDrawer
      ref="drawer"
      :open="drawerOpen && !!picking && !!current"
      :anchor="drawerAnchor"
      :label="t('builder.picker')"
      defer
      @close="picking = null"
    >
      <TeamPicker
        v-if="picking"
        :member="members[picking.slot]!"
        :others="othersOf(picking.slot)"
        :field="picking.field"
        :data
        :snapshot
        @pick="pick"
        @close="picking = null"
      />
    </SideDrawer>

    <!-- On phones, the picker over the page. -->
    <ModalDialog v-if="!wide" v-model:open="pickerOpen" :label="t('builder.picker')" fill>
      <div v-if="picking && current" ref="pickerBox" class="panel picker-dialog">
        <TeamPicker
          :member="members[picking.slot]!"
          :others="othersOf(picking.slot)"
          :field="picking.field"
          :data
          :snapshot
          @pick="pick"
          @close="picking = null"
        />
      </div>
    </ModalDialog>

    <ModalDialog v-model:open="importing" :label="t('builder.import')">
      <div class="panel import">
        <h2>{{ t('builder.import') }}</h2>
        <p class="muted">{{ t('builder.importHint') }}</p>
        <textarea v-model="pasted" rows="12" spellcheck="false" :aria-label="t('builder.import')"></textarea>
        <ul v-if="problems.length" class="problems">
          <li v-for="(p, i) in problems" :key="i">{{ problemText(p) }}</li>
        </ul>
        <div class="actions">
          <button type="button" class="btn" @click="importing = false">{{ t('builder.cancel') }}</button>
          <button type="button" class="btn primary" :disabled="!pasted.trim()" @click="importPaste">
            {{ t('builder.importGo') }}
          </button>
        </div>
      </div>
    </ModalDialog>
  </div>
</template>

<style scoped>
.builder {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
/* Room above a section scrolled to for the row of links stuck to the top. */
section {
  scroll-margin-top: 48px;
}
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}
.head h1 {
  margin: 0;
}
.head-meta {
  margin-left: auto;
}
/* The saved teams: one row, as wide as they are (measured against the box to fold them away). The row kept laid out
   while folded clipped to the box, so it doesn't widen the page (on phones, the page laid out as wide as it, which
   unsticks what sticks to the top); the drop-down's shadow let through. */
.saved-box {
  position: relative;
  margin-top: 12px;
  overflow-x: clip;
  overflow-clip-margin: 8px;
}
.saved {
  display: flex;
  gap: 6px;
  width: max-content;
  margin: 0;
  padding: 0;
  list-style: none;
}
/* Folded: the row kept laid out but unseen, for measuring; the drop-down in its place. */
.saved-box.folded > .saved {
  position: absolute;
  top: 0;
  left: 0;
  visibility: hidden;
  pointer-events: none;
}
.saved-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  padding: 2px 8px;
  font: inherit;
  color: inherit;
  background: var(--panel-alt);
  border: 1px solid var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
  cursor: pointer;
}
.saved-count {
  font-size: 0.85em;
  white-space: nowrap;
}
/* On phones, the open one's name and how many teams over its Pokémon, so the button keeps to the screen. */
@media (max-width: 720px) {
  .saved-toggle {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    grid-template-areas: 'name count chevron' 'icons icons icons';
    align-items: center;
    width: 100%;
    text-align: left;
  }
  .saved-toggle > .saved-name {
    grid-area: name;
  }
  .saved-toggle > .saved-icons {
    grid-area: icons;
  }
  .saved-toggle > .saved-count {
    grid-area: count;
  }
  .saved-toggle > :last-child {
    grid-area: chevron;
  }
  /* In the drop-down, a team's duplicate and delete one over the other, leaving its Pokémon the room. */
  .saved-list .saved-team {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-rows: auto auto;
  }
  .saved-list .saved-team > * {
    grid-row: span 2;
  }
  .saved-list .saved-team > .icon-btn:not(.star) {
    grid-row: auto;
    grid-column: 3;
  }
  /* Its Pokémon closer together, into their icons' empty edges, so the six fit a phone. */
  .saved-list .saved-icons > :deep(.sheet-icon + .sheet-icon) {
    margin-left: -6px;
  }
}
.saved-list {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 60;
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: max-content;
  /* No wider than the box it drops from: each team's Pokémon go under its name where they don't fit beside it. */
  max-width: 100%;
  max-height: 60vh;
  margin: 0;
  padding: 8px;
  overflow: auto;
  list-style: none;
}
.saved-team {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 4px;
  background: var(--panel-alt);
  border: 1px solid var(--border);
}
.saved-team.on {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}
.saved-list .saved-team {
  min-width: 0;
}
.saved-list .saved-open {
  flex: 1;
  flex-wrap: wrap;
  min-width: 0;
  text-align: left;
}
.saved-open {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 4px;
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  cursor: pointer;
}
.saved-name {
  min-width: 0;
  overflow: hidden;
  font-weight: bold;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.saved-icons {
  display: inline-flex;
  min-height: 30px;
  align-items: center;
}
/* Its icon centered in it, not on a line of text's baseline, so it sits level with the name and the Pokémon. */
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
  padding: 3px;
  color: var(--muted);
  background: none;
  border: 0;
  cursor: pointer;
}
.icon-btn:hover {
  color: inherit;
}
.star.starred {
  color: var(--accent);
}
.star.starred :deep(svg) {
  fill: currentColor;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.head-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.head-actions .btn,
.actions .btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.work {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}
.team-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.team-name {
  flex: 1;
  min-width: 0;
  padding: 4px 6px;
  font: inherit;
  font-size: 1.15em;
  font-weight: bold;
}
/* On phones the name the row's width, the way to copy the team under it. */
@media (max-width: 720px) {
  .team-head {
    flex-wrap: wrap;
  }
  .team-name {
    flex-basis: 100%;
  }
}
.issues {
  margin: -4px 0 10px;
  padding: 0;
  list-style: none;
  font-weight: bold;
  color: var(--bad);
}
.sets {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  /* A card's editor unfolded leaves the others in its row as they were. */
  align-items: start;
  gap: 8px;
  margin: 0;
  padding: 4px 4px 12px;
  list-style: none;
}
@media (max-width: 900px) {
  .sets {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 520px) {
  .sets {
    grid-template-columns: minmax(0, 1fr);
  }
}
.picker-dialog {
  width: min(560px, 100vw - 24px);
  max-height: 100%;
  overflow: auto;
}
.import {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(520px, 100vw - 24px);
}
.import h2,
.import p {
  margin: 0;
}
.import textarea {
  width: 100%;
  font-family: ui-monospace, monospace;
  font-size: 0.9em;
}
.problems {
  margin: 0;
  padding-left: 1.2em;
  color: var(--bad);
  font-size: 0.9em;
}
.import .actions {
  justify-content: flex-end;
  margin-top: 0;
}
</style>
