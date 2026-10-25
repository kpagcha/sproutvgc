<script setup lang="ts">
import { computed, inject } from 'vue'
import { useRoute } from 'vue-router'
import { useMediaQuery } from '@vueuse/core'
import { ability, item, move, type PokemonId } from '@/data/dex'
import { percent, type Build } from '@/data/meta'
import { MOVES } from '@/data/moves'
import { natureName } from '@/data/natures'
import { buildParam } from '@/data/tournaments'
import { locale, t } from '@/i18n'
import { META_LINKS } from '@/lib/links'
import { useUnfolded } from '@/composables/useUnfolded'
import AppLink from '@/components/AppLink'
import DexRef from '@/components/DexRef'
import ItemIcon from '@/components/ItemIcon.vue'
import MoreToggle from '@/components/MoreToggle.vue'
import TypeIcon from '@/components/TypeIcon'
import { natureTip } from '@/components/natureTip'

// A Pokémon's most common builds (the same item, ability, nature and moves), a card each: its rank and share of the
// sets, its item, ability and nature (what it does on hover), its moves in the order given, each with its type's badge,
// and the way to its page (`MetaBuildView`: every team that ran it at `regulation`'s official tournaments), how many
// teams it was. Its first `TOP` (on phones `TOP_PHONE`) until unfolded (`MoreToggle`), remembered for the visit under
// `remember` (`useUnfolded`). On a Pokémon's meta page, and on a tournament's standings filtered by one.
const props = defineProps<{
  pokemon: PokemonId
  builds: readonly (Build & { teams: number })[]
  regulation?: string
  remember: string
}>()

const TOP = 5
const TOP_PHONE = 2
const phone = useMediaQuery('(max-width: 720px)')
const top = computed(() => (phone.value ? TOP_PHONE : TOP))
const all = useUnfolded(() => props.remember)
const shown = computed(() => (all.value ? props.builds : props.builds.slice(0, top.value)))

// Its pages open on the data the page's links do (a tournament's regulation's), else the page's own.
const route = useRoute()
const metaLinks = inject(META_LINKS, null)
const meta = computed(() => metaLinks?.() ?? route.query.meta)
</script>

<template>
  <ol class="builds">
    <li v-for="(b, i) in shown" :key="i" class="build" :class="{ main: i === 0 }">
      <span class="build-head meter" :style="{ '--share': b.share }"
        ><strong>#{{ i + 1 }}</strong> · {{ percent(b.share) }}</span
      >
      <span class="build-item">
        <template v-if="b.item"><ItemIcon :id="b.item" /><DexRef :to="item(b.item)" meta /></template>
        <span v-else class="muted">{{ t('usageMon.noItem') }}</span>
      </span>
      <span class="build-traits">
        <DexRef v-if="b.ability" :to="ability(b.ability)" meta />
        <span v-if="b.nature" v-tip:group="natureTip(b.nature)" class="build-nature">{{ natureName(b.nature) }}</span>
      </span>
      <ul class="build-moves">
        <li v-for="mv in b.moves" :key="mv">
          <TypeIcon v-if="MOVES[mv]" :type="MOVES[mv].type" /><DexRef :to="move(mv)" meta />
        </li>
      </ul>
      <!-- The way to the teams that ran it. -->
      <AppLink
        v-if="regulation"
        :to="{ name: 'metaBuild', params: { id: pokemon }, query: { b: buildParam(b), reg: regulation, meta } }"
        class="build-teams"
        >{{
          b.teams === 1 ? t('usageMon.buildTeam') : t('usageMon.buildTeams', { n: b.teams.toLocaleString(locale) })
        }}
        ›</AppLink
      >
    </li>
  </ol>
  <MoreToggle v-model:all="all" :n="builds.length" :top />
</template>

<style scoped>
.meter {
  position: relative;
  padding-bottom: 5px;
}
.meter::before,
.meter::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
}
.meter::before {
  right: 0;
  height: 1px;
  background: var(--border);
}
.meter::after {
  width: calc(100% * var(--share, 0));
  height: 3px;
  background: var(--accent);
}
/* A card each, as many to a row as fit: five on wide screens. */
.builds {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(165px, 1fr));
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.build {
  /* Its width, for its moves to go two to a row when it's wide (`@container`). */
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  background: var(--panel-alt);
  border: 1px solid var(--border);
}
.build.main {
  border-color: var(--accent);
}
.build-head {
  font-size: 0.85em;
}
.build-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: bold;
}
.build-traits {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 10px;
}
.build-nature {
  font-weight: bold;
}
.build-moves {
  /* Type badges at their desktop size on phones too, as small as the text. */
  --icon-scale: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.build-moves li {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
/* A card as wide as the panel (on phones, one to a row): its moves two to a row, so it isn't as tall. */
@container (min-width: 280px) {
  .build-moves {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 2px 10px;
  }
}
/* The way to its teams, at the card's foot. */
.build-teams {
  margin-top: auto;
  font-size: 0.85em;
  font-weight: bold;
}
</style>
