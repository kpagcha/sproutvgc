<script setup lang="ts">
import { ChevronsDown, ChevronsUp } from '@lucide/vue'
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
</script>

<template>
  <section class="panel versus-card small" role="status">
    <p class="head">
      <strong
        ><template v-for="(part, i) in title" :key="i"
          ><template v-if="typeof part === 'string'">{{ part }}</template
          ><AppLink v-else-if="part.slot === 'name'" :to="{ name: 'pokemon', params: { id: props.id } }" class="mon"
            ><PokemonIcon :id="props.id" />{{ props.name }}</AppLink
          ><template v-else>{{ props.speed }}</template></template
        ></strong
      >
      <button type="button" class="link-button" @click="emit('close')">{{ t('speed.vsClose') }}</button>
    </p>
    <!-- Whose points they are: yours'. -->
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
        <dd>{{ pointsText(v.result) }}</dd>
      </template>
    </dl>
    <AppLink :to="props.compareTo" class="compare-link">{{ t('compare.open') }}</AppLink>
  </section>
</template>

<style scoped>
.versus-card {
  margin: 0;
}
.small {
  font-size: 0.875em;
}
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 10px;
  margin: 0;
}
/* The Pokémon it's against, in its title: its name on the text's line, its icon centered on it. */
.mon {
  white-space: nowrap;
}
.mon :deep(.sheet-icon) {
  margin-block: -6px;
}
.needs {
  margin: 6px 0 0;
}
dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 2px 10px;
  margin: 6px 0 0;
}
dd {
  margin: 0;
}
/* A nature effect: its arrows and "Spe" together, the effect's name read out in their place. */
.effect {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.compare-link {
  display: inline-block;
  margin-top: 6px;
  font-weight: bold;
}
.link-button {
  padding: 0;
  font: inherit;
  color: var(--link);
  background: none;
  border: none;
  cursor: pointer;
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
