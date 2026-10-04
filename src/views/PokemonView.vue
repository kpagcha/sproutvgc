<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { AnimatePresence, motion } from 'motion-v'
import { ability, availableIds, available, item, move, pokemon, type MoveId, type PokemonId } from '@/data/dex'
import { REGULATION } from '@/data/format'
import { MOVES } from '@/data/moves'
import { POKEMON, loadLearnsets, movesOf, speciesOf, spriteUrl } from '@/data/pokemon'
import { t, tSlots, type MessageKey } from '@/i18n'
import { description } from '@/i18n/descriptions'
import { refName } from '@/i18n/refName'
import { FADE } from '@/lib/motion'
import { weightPower } from '@/lib/stats'
import DefenseResults from '@/components/DefenseResults.vue'
import DexRef from '@/components/DexRef'
import DexText from '@/components/DexText'
import EntryTitle from '@/components/EntryTitle.vue'
import ItemIcon from '@/components/ItemIcon.vue'
import OffenseResults from '@/components/OffenseResults.vue'
import PokemonChips from '@/components/PokemonChips.vue'
import PokemonIcon from '@/components/PokemonIcon'
import SummaryMoves from '@/components/summary/SummaryMoves.vue'
import SummarySkills from '@/components/summary/SummarySkills.vue'
import TypeIcon from '@/components/TypeIcon'

// One Pokémon, as the games' summary screen: a card with its sprite, level, types, item and family down the side, and
// pages beside it (◀ ▶, as the games page through them): its abilities and how it comes about, its stats at level 50,
// its moves (with a moveset of four to try out) and its type matchups, the moveset's coverage among them. The page and
// the moveset are in the query (`?tab=`, `?set=`), so they can be shared, and they stay as one switches to another
// member of the family.
const route = useRoute()
const router = useRouter()
const id = computed(() => String(route.params.id) as PokemonId)
const ref_ = computed(() => pokemon(id.value))
const exists = computed(() => available(ref_.value))
const mon = computed(() => POKEMON[id.value])

const TABS = ['info', 'skills', 'moves', 'matchups'] as const
type Tab = (typeof TABS)[number]
const TAB_LABELS: Record<Tab, MessageKey> = {
  info: 'summary.info',
  skills: 'summary.skills',
  moves: 'summary.moves',
  matchups: 'summary.matchups',
}
const tab = computed<Tab>(() => {
  const q = String(route.query.tab ?? '')
  return (TABS as readonly string[]).includes(q) ? (q as Tab) : 'info'
})
function setQuery(patch: Record<string, string | undefined>) {
  const query = { ...route.query, ...patch }
  for (const k of Object.keys(patch)) if (!patch[k]) delete query[k]
  void router.replace({ query })
}
const goTo = (to: Tab) => setQuery({ tab: to === 'info' ? undefined : to })
const step = (by: number) => goTo(TABS[(TABS.indexOf(tab.value) + by + TABS.length) % TABS.length]!)

// The tabs take the arrow keys, as a tab list does (and as the games page with the D-pad).
const tabEls = ref<HTMLElement[]>([])
function onTabKey(e: KeyboardEvent) {
  const by = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
  if (!by) return
  e.preventDefault()
  step(by)
  tabEls.value[TABS.indexOf(tab.value)]?.focus()
}

const learnset = ref<MoveId[] | null>(null)
watchEffect(async () => {
  const current = id.value
  const sets = await loadLearnsets()
  if (id.value === current) learnset.value = movesOf(sets, current)
})

// The moveset, from the query: moves it learns only (once the learnset is in), each once, four at most.
const moveset = computed<MoveId[]>({
  get() {
    const ids = String(route.query.set ?? '')
      .split(',')
      .filter((m): m is MoveId => m in MOVES)
    const learns = learnset.value
    return [...new Set(ids)].filter((m) => !learns || learns.includes(m)).slice(0, 4)
  },
  set: (ids) => setQuery({ set: ids.join(',') || undefined }),
})
// What the moveset's attacks hit: the types of its damaging moves.
const attacking = computed(() => [
  ...new Set(moveset.value.filter((m) => MOVES[m].category !== 'status').map((m) => MOVES[m].type)),
])

const abilities = computed(() => mon.value.abilities.map(ability))

// The species' formes the regulation has (Megas, regional formes, Rotom's appliances), this one among them, and the
// ones that only look different, apart.
const family = computed(() => {
  const species = speciesOf(id.value)
  return availableIds('pokemon').filter((p) => speciesOf(p) === species)
})
const formes = computed(() => family.value.filter((p) => !POKEMON[p].cosmetic))
const looks = computed(() => family.value.filter((p) => POKEMON[p].cosmetic))
const others = (ids: PokemonId[]) => ids.some((p) => p !== id.value)

// The card's party: its evolution line from the first stage on, then its formes, as the games' party grid.
const party = computed(() => {
  let root = speciesOf(id.value)
  while (POKEMON[root].prevo) root = speciesOf(POKEMON[root].prevo!)
  const line: PokemonId[] = []
  const queue = [root]
  while (queue.length) {
    const p = queue.shift()!
    line.push(p)
    queue.push(...(POKEMON[p].evos ?? []))
  }
  return [...new Set([...line, ...formes.value])].filter((p) => available(pokemon(p)))
})

/** How it comes about, for formes a battle brings out: a Mega Evolution, or another change (Aegislash's Blade). */
const origin = computed((): { key: MessageKey; from: PokemonId } | null => {
  const from = mon.value.battleOnly
  if (!from) return null
  return { key: mon.value.mega ? 'pokemon.megaFrom' : 'pokemon.changesFrom', from }
})
</script>

<template>
  <div v-if="exists" class="summary panel" :data-type="mon.types[0]">
    <div class="bar">
      <div class="tabs" role="tablist" :aria-label="refName(ref_)" @keydown="onTabKey">
        <button
          v-for="tb in TABS"
          :id="`summary-tab-${tb}`"
          :key="tb"
          ref="tabEls"
          type="button"
          role="tab"
          class="tab"
          :class="{ on: tab === tb }"
          :aria-selected="tab === tb"
          aria-controls="summary-page"
          :tabindex="tab === tb ? 0 : -1"
          @click="goTo(tb)"
        >
          {{ t(TAB_LABELS[tb]) }}
        </button>
      </div>
      <div class="pager">
        <button type="button" class="arrow" :aria-label="t('summary.prev')" @click="step(-1)">◀</button>
        <span class="dots" aria-hidden="true">
          <span v-for="tb in TABS" :key="tb" class="dot" :class="{ on: tab === tb }"></span>
        </span>
        <button type="button" class="arrow" :aria-label="t('summary.next')" @click="step(1)">▶</button>
      </div>
    </div>

    <div class="body">
      <aside class="card">
        <div class="card-head">
          <span class="lv num">{{ t('summary.level') }}</span>
          <EntryTitle :to="ref_" />
        </div>
        <div class="screen">
          <img
            v-if="!mon.noSprite"
            class="pixel sprite"
            :src="spriteUrl(id)"
            :alt="refName(ref_)"
            width="96"
            height="96"
            draggable="false"
          />
          <span v-else class="sprite icon-sprite"><PokemonIcon :id="id" :scale="2" /></span>
        </div>
        <div class="types">
          <RouterLink v-for="ty in mon.types" :key="ty" :to="{ name: 'types', params: { type: ty } }">
            <TypeIcon :type="ty" :scale="2" />
          </RouterLink>
        </div>
        <div v-if="mon.item" class="held">
          <span class="tag">{{ t('summary.item') }}</span>
          <span class="with-icon"><ItemIcon :id="mon.item" /><DexRef :to="item(mon.item)" /></span>
        </div>
        <nav v-if="party.length > 1" class="party" :aria-label="t('summary.family')">
          <component
            :is="p === id ? 'span' : RouterLink"
            v-for="p in party"
            :key="p"
            v-tip="refName(pokemon(p))"
            class="member"
            :class="{ cur: p === id }"
            :to="p === id ? undefined : { name: 'pokemon', params: { id: p }, query: route.query }"
            :aria-label="refName(pokemon(p))"
            :aria-current="p === id ? 'page' : undefined"
          >
            <PokemonIcon :id="p" />
          </component>
        </nav>
      </aside>

      <div id="summary-page" class="page" role="tabpanel" :aria-labelledby="`summary-tab-${tab}`">
        <AnimatePresence mode="wait" :initial="false">
          <motion.div
            :key="tab"
            :initial="{ opacity: 0, x: 10 }"
            :animate="{ opacity: 1, x: 0 }"
            :exit="{ opacity: 0, x: -10 }"
            :transition="FADE"
          >
            <template v-if="tab === 'info'">
              <section v-for="a in abilities" :key="a.id" class="ability">
                <h3>
                  <span class="tag">{{ t('summary.ability') }}</span> <DexRef :to="a" />
                </h3>
                <p><DexText :text="description('ability', a.id)?.short ?? ''" /></p>
              </section>

              <section class="summary-memo">
                <h3>{{ t('summary.memo') }}</h3>
                <ul>
                  <li v-if="origin">
                    <template v-for="(part, i) in tSlots(origin.key)" :key="i">
                      <template v-if="typeof part === 'string'">{{ part }}</template>
                      <DexRef v-else-if="part.slot === 'pokemon'" :to="pokemon(origin.from)" />
                      <span v-else-if="part.slot === 'item' && mon.item" class="with-icon"
                        ><ItemIcon :id="mon.item" /><DexRef :to="item(mon.item)"
                      /></span>
                    </template>
                  </li>
                  <li v-else-if="mon.item">
                    <template v-for="(part, i) in tSlots('pokemon.holds')" :key="i">
                      <template v-if="typeof part === 'string'">{{ part }}</template>
                      <span v-else class="with-icon"><ItemIcon :id="mon.item" /><DexRef :to="item(mon.item)" /></span>
                    </template>
                  </li>
                  <li>
                    <template v-for="(part, i) in tSlots('summary.weightMemo')" :key="i">
                      <template v-if="typeof part === 'string'">{{ part }}</template>
                      <span v-else-if="part.slot === 'kg'" class="num">{{ mon.weight }}</span>
                      <span v-else-if="part.slot === 'power'" class="num">{{ weightPower(mon.weight) }}</span>
                      <DexRef v-else-if="part.slot === 'lowkick'" :to="move('lowkick')" />
                      <DexRef v-else-if="part.slot === 'grassknot'" :to="move('grassknot')" />
                    </template>
                  </li>
                </ul>
              </section>

              <dl v-if="others(formes) || mon.prevo || mon.evos" class="relations">
                <template v-if="mon.prevo">
                  <dt>
                    <span class="tag">{{ t('pokemon.evolvesFrom') }}</span>
                  </dt>
                  <dd><PokemonChips :ids="[mon.prevo]" /></dd>
                </template>
                <template v-if="mon.evos">
                  <dt>
                    <span class="tag">{{ t('pokemon.evolvesInto') }}</span>
                  </dt>
                  <dd><PokemonChips :ids="mon.evos" /></dd>
                </template>
                <template v-if="others(formes)">
                  <dt>
                    <span class="tag">{{ t('pokemon.formes') }}</span>
                  </dt>
                  <dd><PokemonChips :ids="formes" :current="id" /></dd>
                </template>
              </dl>
              <details v-if="others(looks)">
                <summary class="muted">{{ t('pokemon.looks', { n: looks.length }) }}</summary>
                <PokemonChips :ids="looks" :current="id" />
              </details>
            </template>

            <SummarySkills v-else-if="tab === 'skills'" :id />

            <SummaryMoves v-else-if="tab === 'moves'" v-model:moveset="moveset" :ids="learnset" />

            <template v-else>
              <h3 class="page-head">{{ t('pokemon.defense') }}</h3>
              <DefenseResults :types="mon.types" />
              <h3 class="page-head">{{ t('summary.coverage') }}</h3>
              <OffenseResults v-if="attacking.length" :types="attacking" />
              <p v-else class="hint">
                {{ t('summary.noCoverage') }}
                <button type="button" class="btn" @click="goTo('moves')">{{ t('summary.toMoves') }}</button>
              </p>
            </template>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  </div>
  <div v-else class="panel">
    <p>{{ t('pokemon.notFound', { id, reg: REGULATION }) }}</p>
  </div>
</template>

<style scoped>
/* The frame takes its first type's color (`--tc`, from `data-type`): the bar along the top in full, the labels'
   pills (`--summary-tint`, also used by the pages' components) as a wash of it. */
.summary {
  --summary-tint: color-mix(in srgb, var(--tc) 32%, var(--panel));
  --summary-on-tint: var(--text);
  padding: 0;
  overflow: hidden;
}
.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 4px 12px;
  padding: 8px 10px 0;
  background: var(--tc);
  border-bottom: 2px solid var(--ink);
}
.tabs {
  display: flex;
  gap: 4px;
  min-width: 0;
  overflow-x: auto;
}
/* Folder tabs: the open one joins the page below it. */
.tab {
  margin-bottom: -2px;
  padding: 5px 12px 4px;
  border: 2px solid var(--ink);
  background: color-mix(in srgb, var(--tc) 55%, var(--panel));
  color: var(--text);
  font: inherit;
  font-size: 0.85em;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
  cursor: pointer;
}
.tab:hover {
  background: color-mix(in srgb, var(--tc) 25%, var(--panel));
}
.tab.on {
  background: var(--panel);
  border-bottom-color: var(--panel);
}
.pager {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 6px;
  color: #fff;
  text-shadow: 1px 1px 0 rgb(0 0 0 / 0.45);
}
.arrow {
  padding: 0 4px;
  border: none;
  background: none;
  color: inherit;
  font-size: 0.9em;
  cursor: pointer;
}
.dots {
  display: flex;
  gap: 5px;
}
.dot {
  width: 9px;
  height: 9px;
  border: 2px solid var(--ink);
  background: color-mix(in srgb, var(--tc) 50%, #000);
}
.dot.on {
  background: #fff;
}
.body {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
}
/* The card down the side: the games' left panel. */
.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border-right: 2px solid var(--ink);
  background: var(--summary-tint);
}
.card-head {
  align-self: stretch;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.card-head :deep(.entry-title) {
  margin: 0;
}
.card-head :deep(.entry-title h1) {
  font-size: 1.3em;
  overflow-wrap: anywhere;
}
.lv {
  align-self: flex-start;
  padding: 0 6px;
  background: var(--ink);
  color: #fff;
  font-size: 0.8em;
  font-weight: bold;
}
/* The sprite on a striped screen, as the GBA games frame it. */
.screen {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 196px;
  max-width: 100%;
  aspect-ratio: 1;
  border: 2px solid var(--ink);
  background: repeating-linear-gradient(
    to bottom,
    var(--panel) 0,
    var(--panel) 4px,
    color-mix(in srgb, var(--tc) 10%, var(--panel)) 4px,
    color-mix(in srgb, var(--tc) 10%, var(--panel)) 8px
  );
}
.sprite {
  width: 192px;
  height: 192px;
  max-width: 100%;
}
.icon-sprite {
  display: flex;
  align-items: center;
  justify-content: center;
}
.types {
  display: flex;
  gap: 4px;
}
.held {
  display: flex;
  align-items: center;
  gap: 6px;
  align-self: stretch;
}
.with-icon {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  vertical-align: middle;
}
/* Its family, as the party grid on HeartGold's summary: the one shown framed in red. */
.party {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  align-self: stretch;
}
.member {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  border: 2px solid var(--ink);
  background: var(--panel);
  box-shadow: var(--hard-sm);
}
.member:hover {
  background: var(--hover);
}
.member.cur {
  outline: 3px solid var(--bad);
  outline-offset: 1px;
  box-shadow: none;
}
.page {
  min-width: 0;
  padding: 14px 16px 16px;
}
.tag {
  display: inline-block;
  padding: 0 8px;
  background: var(--summary-tint);
  color: var(--summary-on-tint);
  font-size: 0.75em;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  vertical-align: middle;
  white-space: nowrap;
}
.ability {
  margin-bottom: 12px;
}
.ability h3 {
  margin: 0 0 2px;
  font-size: 1.05em;
}
.ability p {
  margin: 0;
}
.relations {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 8px 10px;
  align-items: baseline;
  margin: 14px 0 0;
}
.relations dd {
  margin: 0;
}
details {
  margin-top: 8px;
}
.page-head {
  margin: 0 0 8px;
}
.page-head:not(:first-child) {
  margin-top: 16px;
}
.hint {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
@media (max-width: 640px) {
  .body {
    grid-template-columns: minmax(0, 1fr);
  }
  /* On phones the card turns on its side: sprite to the left, the rest beside it. */
  .card {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-areas: 'screen head' 'screen types' 'screen held' 'party party';
    align-items: start;
    gap: 6px 12px;
    border-right: none;
    border-bottom: 2px solid var(--ink);
  }
  .card-head {
    grid-area: head;
  }
  .screen {
    grid-area: screen;
    width: 100px;
  }
  .sprite {
    width: 96px;
    height: 96px;
  }
  .icon-sprite :deep(.sheet-icon) {
    zoom: 0.5;
  }
  .types {
    grid-area: types;
  }
  .held {
    grid-area: held;
  }
  .party {
    grid-area: party;
    grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
  }
  .relations {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
