<script setup lang="ts">
import { ArrowRight, ChevronsDown, ChevronsUp, Columns2, X } from '@lucide/vue'
import type { PokemonId } from '@/data/dex'
import { t, tSlots } from '@/i18n'
import type { NamedLocation } from '@/lib/links'
import type { pointsToMoveFirst } from '@/lib/speed'
import { pointsText } from '@/lib/speedBuild'
import type { NatureEffect } from '@/lib/stats'
import AppLink from '@/components/AppLink'
import PokemonIcon from '@/components/PokemonIcon'

// What it takes for yours to move before a Pokémon on the speed tiers' ladder (the chip tapped): its name (a link to
// its page) and Speed on top, then for each nature effect the points that do it, and the way to the comparison of the
// two. A panel of its own under yours beside the ladder; narrower, a card floating at the foot of the screen.
const props = defineProps<{
  /** Yours, by name. */
  mineName: string
  /** The Pokémon it's against, its name as the ladder shows it, and its Speed there. */
  id: PokemonId
  name: string
  speed: number
  rows: readonly { effect: NatureEffect; result: ReturnType<typeof pointsToMoveFirst> }[]
  /** The comparison of yours and it, side by side. */
  compareTo: NamedLocation
}>()
const emit = defineEmits<{ close: [] }>()

/** The nature effects as the nature's choice shows them: arrows beside "Spe", neutral as a word. */
const EFFECT_ICONS = { up: ChevronsUp, neutral: undefined, down: ChevronsDown }
const canHover = window.matchMedia('(hover: hover)').matches
const title = tSlots('speed.vs')
/** Whether a row's yours moves first, only ties, or can't. */
const kind = (r: ReturnType<typeof pointsToMoveFirst>) => (!r ? 'no' : 'ties' in r ? 'tie' : 'yes')
</script>

<template>
  <!-- A band of the opponents' red: the Pokémon it's against (a link to its page) at its Speed, and Close. -->
  <section class="panel banded versus-card small" role="status">
    <div class="band">
      <strong
        ><template v-for="(part, i) in title" :key="i"
          ><template v-if="typeof part === 'string'">{{ part }}</template
          ><AppLink v-else-if="part.slot === 'name'" :to="{ name: 'pokemon', params: { id: props.id } }" class="mon"
            ><PokemonIcon :id="props.id" />{{ props.name }}</AppLink
          ><template v-else>{{ props.speed }}</template></template
        ></strong
      >
      <button type="button" class="btn on-band inverted close" @click="emit('close')">
        <X :size="14" aria-hidden="true" />{{ t('speed.vsClose') }}
      </button>
    </div>
    <!-- Whose points they are: yours'. Then a row per nature effect: the effect as the nature's choice shows it, and
         the points, red when there are none that do it. -->
    <p class="needs">{{ t('speed.vsNeeds', { name: props.mineName }) }}</p>
    <dl>
      <template v-for="v in props.rows" :key="v.effect">
        <dt v-tip="canHover && !!EFFECT_ICONS[v.effect] && t(`speed.effect.${v.effect}`)" class="effect">
          <template v-if="EFFECT_ICONS[v.effect]"
            ><component :is="EFFECT_ICONS[v.effect]" :size="14" aria-hidden="true" /><span aria-hidden="true">{{
              t('stat.spe')
            }}</span
            ><span class="visually-hidden">{{ t(`speed.effect.${v.effect}`) }}</span></template
          >
          <template v-else>{{ t(`speed.effect.${v.effect}`) }}</template>
        </dt>
        <dd :class="kind(v.result)">{{ pointsText(v.result) }}</dd>
      </template>
    </dl>
    <!-- To the comparison's own page: a button that stands out, its arrow saying it goes there. -->
    <AppLink :to="props.compareTo" class="btn primary compare-link"
      ><Columns2 :size="16" aria-hidden="true" />{{ t('compare.open') }}<ArrowRight :size="16" aria-hidden="true"
    /></AppLink>
  </section>
</template>

<style scoped>
.versus-card {
  margin: 0;
}
.small {
  font-size: 0.875em;
}
/* Its band in the opponents' red, as the ladder's is with yours picked. */
:root:root .versus-card.banded > .band {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 10px;
  color: var(--opponent-text);
  background: var(--opponent);
}
.band a {
  color: inherit;
}
.close {
  flex: none;
  gap: 4px;
}
/* The Pokémon it's against, in its title: its name on the text's line, its icon centered on it. */
.mon {
  white-space: nowrap;
}
.mon :deep(.sheet-icon) {
  margin-block: -6px;
}
.needs {
  margin: 0;
  font-weight: bold;
}
/* The rows: the effect in a small outlined label, the points in bold, red when yours can't move first. */
dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  align-items: center;
  gap: 4px 10px;
  margin: 8px 0 0;
}
.effect {
  display: inline-flex;
  align-items: center;
  justify-self: start;
  gap: 2px;
  padding: 1px 6px;
  font-size: 0.875em;
  background: var(--panel-alt);
  border: 1px solid var(--border-strong);
}
dd {
  margin: 0;
  font-weight: bold;
}
dd.tie {
  color: var(--muted);
}
dd.no {
  color: var(--opponent);
}
.compare-link {
  gap: 6px;
  width: 100%;
  margin-top: 10px;
  font-weight: bold;
}
.compare-link:hover {
  text-decoration: none;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
