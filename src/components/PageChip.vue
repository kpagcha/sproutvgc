<script lang="ts">
import type { PageVisit } from '@/composables/useRecent'
import { router } from '@/router'
import { POKEMON } from '@/data/pokemon'
import { available, type ItemId, type PokemonId, type Ref } from '@/data/dex'
import { isType, type TypeId } from '@/data/types'
import { readBuild } from '@/lib/speedBuild'
import { readList } from '@/lib/speedLineup'
import { eventOf } from '@/data/tournaments'

/** The Pokémon a query names, if the regulation has it. */
const mon = (id: string | undefined) => (id && id in POKEMON ? (id as PokemonId) : null)
/** The entry whose meta page a route is, if it's an ability's, item's or move's. */
const META_ENTRIES: Partial<Record<string, 'ability' | 'item' | 'move'>> = {
  metaAbility: 'ability',
  metaItem: 'item',
  metaMove: 'move',
}
const typesOf = (v: string | undefined, max: number): TypeId[] =>
  [...new Set((v ?? '').split(',').filter(isType)).values()].slice(0, max)

function metaEntry(kind: 'ability' | 'item' | 'move', id: string) {
  const ref = { kind, id } as Ref
  return available(ref) ? ref : null
}

/** What a page visited shows of itself: its route, and the Pokémon or types that tell it apart. */
function view(visit: PageVisit) {
  const to = router.resolve({ path: visit.path, query: visit.query })
  const q = visit.query
  const name = String(to.name ?? '')
  const compare = name === 'speedCompare'
  const team = (keys: string[]) => keys.flatMap((k) => mon(q[k]) ?? [])
  // A comparison's icons: each team's, or the speed order's list.
  const groups = !compare
    ? null
    : q.mode === 'order'
      ? [readList(q.list).map((e) => e.id)]
      : ['a', 'b'].map((s) => team([s, ...[2, 3, 4, 5, 6].map((n) => `${s}${n}`)]))
  return {
    to,
    titleKey: to.meta.titleKey,
    groups,
    /** Yours' build on the speed tiers, as the page reads it. */
    build: readBuild(q, 'my', name === 'speedTiers' ? mon(q.mine) : null),
    mine: name === 'speedTiers' ? mon(q.mine) : null,
    /** The Pokémon found on the speed tiers, but yours. */
    found: name === 'speedTiers' ? (q.find ?? '').split(',').flatMap((id) => (id !== q.mine && mon(id)) || []) : [],
    /** The Pokémon whose usage page it is. */
    usage: name === 'metaPokemon' ? mon(String(to.params.id)) : null,
    /** The ability, item or move whose meta page it is, if the regulation has it. */
    entry: META_ENTRIES[name] ? metaEntry(META_ENTRIES[name], String(to.params.id)) : null,
    /** The tournament whose standings it is. */
    event: name === 'tournament' ? (eventOf(String(to.params.id)) ?? null) : null,
    trickRoom: name.startsWith('speed') && q.trickroom === '1',
    // The type matchups' types, or the type the speed tiers are filtered by.
    types: name.startsWith('matchups')
      ? typesOf(q.def, 2).length
        ? typesOf(q.def, 2)
        : typesOf(q.atk, 4)
      : name === 'speedTiers'
        ? typesOf(q.type, 1)
        : [],
  }
}

/**
 * Whether a page visited can still be shown: a page that still exists, a comparison or a meta page of ones the
 * regulation has.
 */
export function shownVisit(visit: PageVisit) {
  const v = view(visit)
  return (
    !!v.titleKey &&
    (!v.groups || v.groups.every((g) => g.length > 0)) &&
    (v.to.name !== 'metaPokemon' || !!v.usage) &&
    (!META_ENTRIES[String(v.to.name)] || !!v.entry) &&
    (v.to.name !== 'tournament' || !!v.event)
  )
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import { ChevronsDown, ChevronsUp } from '@lucide/vue'
import { pokemon } from '@/data/dex'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { follow } from '@/lib/links'
import PokemonIcon from '@/components/PokemonIcon'
import TypeIcon from '@/components/TypeIcon'
import ItemIcon from '@/components/ItemIcon.vue'
import { moveType } from '@/components/EntryChip.vue'

// A page with a view of its own (in its URL) as a chip reopening it as it was: the home page's recently viewed and
// favorites (a setup starred), beside the dex entries' chips (`EntryChip`), in their style. A comparison is its
// Pokémon's icons, each team's (or the speed order's list), their names read out; any other page its name, with the
// Pokémon picked on it (a usage page's; the speed tiers' yours, with its build, the Pokémon found and the type it's
// filtered by), the entry it's of (an ability's, item's or move's meta page's, by name) or its types (the type
// matchups'); Trick Room, on, said in short. A meta page is its Pokémon or entry alone, unnamed: beside them, the dex
// entries' chips say they're the dex's. A tournament's is its name.
// `untitled` (on the page itself, which needs no naming): its name left out but when there's nothing else to show.
const props = defineProps<{ visit: PageVisit; untitled?: boolean }>()
const v = computed(() => view(props.visit))
/** Whether it's named: not a meta page, its entry or Pokémon saying which it is. */
const titled = computed(
  () =>
    !v.value.usage &&
    !v.value.entry &&
    !v.value.event &&
    (!props.untitled || (!v.value.mine && !v.value.found.length && !v.value.types.length)),
)
/** A comparison's Pokémon by name, for what reads the chip out: its icons alone say nothing. */
const label = computed(() => v.value.groups?.map((g) => g.map((id) => refName(pokemon(id))).join(', ')).join(' vs '))
/** The most icons a group shows, the rest counted. */
const GROUP_MAX = 6
</script>

<template>
  <a :href="v.to.href" class="page-chip" :aria-label="label" @click="follow">
    <template v-if="v.groups">
      <template v-for="(g, i) in v.groups" :key="i">
        <span v-if="i" class="muted">vs</span>
        <span class="group"
          ><PokemonIcon v-for="(id, j) in g.slice(0, GROUP_MAX)" :key="j" :id /><span
            v-if="g.length > GROUP_MAX"
            class="muted more"
            >+{{ g.length - GROUP_MAX }}</span
          ></span
        >
      </template>
    </template>
    <template v-else>
      <template v-if="titled">{{ t(v.titleKey!) }}</template>
      <PokemonIcon v-if="v.usage" :id="v.usage" />
      <template v-if="v.entry">
        <ItemIcon v-if="v.entry.kind === 'item'" :id="v.entry.id as ItemId" />
        <TypeIcon v-else-if="v.entry.kind === 'move' && moveType(v.entry.id)" :type="moveType(v.entry.id)!" />
        {{ refName(v.entry) }}
      </template>
      <template v-if="v.mine">
        <PokemonIcon :id="v.mine" />
        <span class="build muted"
          ><ChevronsUp v-if="v.build.effect === 'up'" :size="14" aria-hidden="true" /><ChevronsDown
            v-else-if="v.build.effect === 'down'"
            :size="14"
            aria-hidden="true"
          />{{ v.build.points }}</span
        >
      </template>
      <template v-if="v.found.length"
        ><span v-if="v.mine" class="muted">vs</span><PokemonIcon v-for="id in v.found" :id :key="id"
      /></template>
      <TypeIcon v-for="ty in v.types" :key="ty" :type="ty" />
      <template v-if="v.event">{{ v.event.name }}</template>
    </template>
    <span v-if="v.trickRoom" class="tr">{{ t('speed.trShort') }}</span>
  </a>
</template>

<style scoped>
/* As `EntryChip`'s: type badges at their desktop size on phones too, the chip's height the icons'. */
.page-chip {
  --icon-scale: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 0 10px;
  color: var(--text);
  background: var(--panel-alt);
  border: 1px solid var(--border);
  border-radius: 3px;
}
.page-chip:hover {
  text-decoration: none;
  background: var(--hover);
  border-color: var(--border-strong);
}
.page-chip :deep(.sheet-icon) {
  margin: -4px 0;
}
/* A Pokémon's build after its name: its nature's effect and its points, small. */
.build {
  display: inline-flex;
  align-items: center;
  margin-left: -2px;
  font-size: 0.85em;
  font-variant-numeric: tabular-nums;
}
/* A group's icons, close together. */
.group {
  display: inline-flex;
  align-items: center;
}
.more {
  margin-left: 4px;
  font-size: 0.85em;
}
/* Trick Room, on: as the switch shows it on. */
.tr {
  padding: 0 4px;
  font-size: 0.8em;
  font-weight: bold;
  background: var(--sel);
}
</style>
