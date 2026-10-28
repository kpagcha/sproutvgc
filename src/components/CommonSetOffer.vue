<script setup lang="ts">
import { Sparkles } from '@lucide/vue'
import { ability, item, move, type PokemonId } from '@/data/dex'
import { natureName } from '@/data/natures'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import type { Member } from '@/lib/team'
import PokemonIcon from '@/components/PokemonIcon'

// Right after a Pokémon's picked, in the picker over what's next: the choice between loading its most common set
// (`set`, of the meta's entry `id`) and putting the set together a part at a time, as the picker goes on to.
defineProps<{ id: PokemonId; set: Member }>()
const emit = defineEmits<{ load: [] }>()
</script>

<template>
  <div class="offer">
    <button type="button" class="common-set" @click="emit('load')">
      <PokemonIcon :id />
      <span class="common-text">
        <span class="common-title"><Sparkles :size="14" aria-hidden="true" />{{ t('builder.loadCommon') }}</span>
        <span class="muted">{{
          [
            set.item && refName(item(set.item)),
            set.ability && refName(ability(set.ability)),
            set.nature && natureName(set.nature),
          ]
            .filter(Boolean)
            .join(' · ')
        }}</span>
        <span class="muted">{{
          set.moves
            .filter((x) => x)
            .map((x) => refName(move(x!)))
            .join(' · ')
        }}</span>
      </span>
    </button>
    <p class="or muted">{{ t('builder.orPickYourself') }}</p>
  </div>
</template>

<style scoped>
.offer {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.common-set {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  font: inherit;
  color: inherit;
  text-align: left;
  background: var(--panel-alt);
  border: 1px solid var(--accent);
  cursor: pointer;
}
.common-set:hover {
  background: var(--sel);
}
.common-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  font-size: 0.875em;
}
.common-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 1.1em;
  font-weight: bold;
}
/* A rule either side of it, between the two ways. */
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
</style>
