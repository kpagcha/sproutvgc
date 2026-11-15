<script setup lang="ts">
import { ChevronsDown, ChevronsUp } from '@lucide/vue'
import { STATS } from '@/data/pokemon'
import { t } from '@/i18n'
import type { SpreadPart } from '@/components/solverText'

// A spread in Showdown's short way, its nature's effect on a stat a double chevron after its points, as the speed pages
// mark a build's nature, rather than Showdown's "+" (read as "or more"): "32 HP / 20⏶⏶ Def". Said in words to a screen
// reader.
defineProps<{ parts: readonly SpreadPart[] }>()
</script>

<template>
  <span class="spread-text"
    ><template v-for="(p, i) in parts" :key="p.stat"
      ><template v-if="i"> / </template
      ><span class="part"
        >{{ p.n
        }}<template v-if="p.effect !== 'neutral'"
          ><component
            :is="p.effect === 'up' ? ChevronsUp : ChevronsDown"
            :size="13"
            :stroke-width="2.5"
            class="eff"
            :class="p.effect"
            aria-hidden="true"
          /><span class="visually-hidden"> ({{ t(`calc.reverse.nature.${p.effect}`) }})</span></template
        >
        {{ t(`stat.${STATS[p.stat]!}`) }}</span
      ></template
    ></span
  >
</template>

<style scoped>
.part {
  white-space: nowrap;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.eff {
  vertical-align: -0.1em;
}
</style>
