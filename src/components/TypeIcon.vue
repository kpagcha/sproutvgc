<script lang="ts">
import { TYPES, type TypeId } from '@/data/types'
import { TYPE_GLYPHS } from '@/data/typeGlyphs'

// Each type's glyph as the badge's style, made once for every badge.
const GLYPHS = {} as Record<TypeId, Record<string, string>>
for (const t of TYPES) GLYPHS[t] = { '--glyph': `url(${TYPE_GLYPHS[t]})` }
</script>

<script setup lang="ts">
import { iconUrl } from '@/data/types'
import { typeName } from '@/i18n'
import { useStyle } from '@/composables/useStyle'

withDefaults(defineProps<{ type: TypeId; scale?: 1 | 2; lazy?: boolean }>(), {
  scale: 1,
  lazy: false,
})

// The retro style swaps the sprites for fixed-width CSS badges (styled in `src/styles/retro.css`): the type glyph,
// then the name on large badges; small ones are just the glyph. Kept light (no computeds, the glyphs' styles made once)
// as there can be hundreds on a page.
const { style } = useStyle()
</script>

<template>
  <span
    v-if="style === 'retro'"
    class="type-icon type-badge"
    :class="scale === 1 ? 's1' : 's2'"
    :data-type="type"
    role="img"
    :aria-label="typeName(type)"
  >
    <span class="glyph" :style="GLYPHS[type]" aria-hidden="true"></span>
    <span v-if="scale === 2" class="label" aria-hidden="true">{{ typeName(type) }}</span>
  </span>
  <img
    v-else
    class="pixel type-icon"
    :class="{ s1: scale === 1 }"
    :src="iconUrl(type)"
    :alt="typeName(type)"
    :width="32 * scale"
    :height="14 * scale"
    :loading="lazy ? 'lazy' : undefined"
    decoding="async"
    draggable="false"
  />
</template>

<style scoped>
.type-icon {
  display: inline-block;
  vertical-align: middle;
}
.type-icon.s1 {
  width: calc(32px * var(--icon-scale, 1));
  height: calc(14px * var(--icon-scale, 1));
}
</style>
