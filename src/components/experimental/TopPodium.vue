<script setup lang="ts">
// EXPERIMENT (Champions palette): the meta's top three as a podium over the rankings, each its sprite on a platform
// tinted by its first type, its usage large, its climb since the dataset before.
import { computed } from 'vue'
import { pokemon, type PokemonId } from '@/data/dex'
import { POKEMON, spriteUrl } from '@/data/pokemon'
import { percent } from '@/data/meta'
import { refName } from '@/i18n/refName'
import AppLink from '@/components/AppLink'
import TypeIcon from '@/components/TypeIcon'

const props = defineProps<{
  rows: { id: PokemonId; rank: number; usage?: number; climb?: number; brought?: number }[]
}>()

// Second, first, third: the winner in the middle, raised.
const podium = computed(() => {
  const top = [...props.rows].sort((a, b) => a.rank - b.rank).slice(0, 3)
  return [top[1], top[0], top[2]].filter((r) => r !== undefined)
})
</script>

<template>
  <div v-if="podium.length === 3" class="podium">
    <AppLink
      v-for="r in podium"
      :key="r.id"
      class="step"
      :class="`p${r.rank}`"
      :to="{ name: 'metaPokemon', params: { id: r.id } }"
      :data-type="POKEMON[r.id].types[0]"
    >
      <span class="place">{{ r.rank }}</span>
      <span class="stage">
        <img
          v-if="!POKEMON[r.id].noSprite"
          class="pixel sprite"
          :src="spriteUrl(r.id)"
          :alt="refName(pokemon(r.id))"
          width="96"
          height="96"
          draggable="false"
        />
      </span>
      <span class="name">{{ refName(pokemon(r.id)) }}</span>
      <span class="types">
        <TypeIcon v-for="ty in POKEMON[r.id].types" :key="ty" :type="ty" />
      </span>
      <span class="usage num">{{ r.usage !== undefined ? percent(r.usage) : '—' }}</span>
      <span class="sub">
        usage
        <span v-if="r.climb" class="climb" :class="r.climb > 0 ? 'up' : 'down'"
          >{{ r.climb > 0 ? '▲' : '▼' }}{{ Math.abs(r.climb) }}</span
        >
      </span>
    </AppLink>
  </div>
</template>

<style scoped>
.podium {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: end;
  gap: 14px;
  margin: 4px 0 16px;
}
.step {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 18px 12px 16px;
  color: var(--text);
  text-decoration: none;
  overflow: hidden;
  background:
    radial-gradient(120% 70% at 50% 0%, color-mix(in oklch, var(--tc) 30%, transparent), transparent 70%),
    repeating-linear-gradient(-55deg, transparent 0 14px, color-mix(in oklch, var(--tc) 7%, transparent) 14px 28px),
    var(--panel);
  border: 1px solid color-mix(in oklch, var(--tc) 30%, var(--border));
  border-radius: 20px;
  box-shadow: var(--elev-2);
  transition:
    transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1),
    box-shadow 0.18s ease-out;
}
.step:hover {
  text-decoration: none;
  transform: translateY(-3px);
  box-shadow: var(--elev-3);
}
.step.p1 {
  padding-top: 30px;
  border-color: color-mix(in oklch, var(--brand) 70%, transparent);
  box-shadow:
    0 0 0 3px color-mix(in oklch, var(--brand) 35%, transparent),
    var(--elev-3);
}
.place {
  position: absolute;
  top: 10px;
  left: 12px;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  font: italic 700 18px var(--font-display);
  color: var(--accent-text);
  background: var(--accent);
  border-radius: 999px;
}
.p1 .place {
  color: var(--brand-text);
  background: var(--brand);
}
.stage {
  position: relative;
  display: grid;
  place-items: center;
  width: 120px;
  height: 104px;
}
/* The platform it stands on: an ellipse in its type's color. */
.stage::before {
  content: '';
  position: absolute;
  bottom: 4px;
  width: 104px;
  height: 22px;
  border-radius: 50%;
  background: radial-gradient(closest-side, color-mix(in oklch, var(--tc) 55%, transparent), transparent);
}
.sprite {
  position: relative;
  width: 96px;
  height: 96px;
}
.p1 .sprite {
  width: 120px;
  height: 120px;
}
.p1 .stage {
  height: 124px;
}
.name {
  font: italic 700 1.25em var(--font-display);
  color: var(--heading);
}
.types {
  display: flex;
  gap: 4px;
}
.usage {
  margin-top: 6px;
  font: italic 700 2em/1 var(--font-display);
  color: var(--heading);
  font-variant-numeric: tabular-nums;
}
.p1 .usage {
  font-size: 2.5em;
}
.sub {
  font-size: 0.85em;
  color: var(--muted);
}
.climb {
  margin-left: 4px;
  font-weight: bold;
}
.up {
  color: var(--good);
}
.down {
  color: var(--bad);
}
@media (max-width: 720px) {
  .podium {
    gap: 8px;
  }
  .step {
    padding: 14px 6px 12px;
    border-radius: 16px;
  }
  .stage,
  .p1 .stage {
    width: 80px;
    height: 76px;
  }
  .sprite,
  .p1 .sprite {
    width: 72px;
    height: 72px;
  }
  .stage::before {
    width: 72px;
  }
  .place {
    width: 24px;
    height: 24px;
    font-size: 14px;
  }
  .usage {
    font-size: 1.5em;
  }
  .p1 .usage {
    font-size: 1.8em;
  }
  .name {
    font-size: 1em;
    text-align: center;
  }
}
</style>
