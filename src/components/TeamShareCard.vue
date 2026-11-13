<script setup lang="ts">
import type { Slot } from '@/data/tournaments'
import type { Points } from '@/lib/team'
import TeamSets from '@/components/TeamSets.vue'
import logoUrl from '@/assets/logo.png'

// A team drawn to be shared as an image (`ShareTeamImage`): its sets as a tournament team's (`TeamSets`, `still`), under
// a title (the team's name, or the player) and a line about it (the event, the placing), the site's name and address
// at the foot. A fixed width whatever the screen, so the image is the same from a phone or a desktop: across
// (`horizontal`, three sets a row) or standing (two a row, for a phone's screen). Nothing to tap: its names plain text
// in the text's color, no buttons nor toggles. No headings nor paragraphs: Firefox, drawing it as an image, gives them
// their default margins back, shifting it all down and cutting off its foot.
defineProps<{
  team: Slot[]
  points?: readonly (Points | null)[]
  title?: string
  subtitle?: string
  layout: 'horizontal' | 'vertical'
}>()

const SITE = 'kpagcha.github.io/sproutvgc'
</script>

<template>
  <div class="share-card" :class="layout">
    <div v-if="title || subtitle" class="share-head">
      <div v-if="title" class="share-title font-display">{{ title }}</div>
      <div v-if="subtitle" class="share-sub">{{ subtitle }}</div>
    </div>
    <TeamSets :team :points still />
    <div class="share-foot">
      <span class="share-logo font-display"
        ><img :src="logoUrl" alt="" width="45" height="36" /><span class="word">sprout<span>vgc</span></span></span
      >
      <span class="share-url">{{ SITE }}</span>
    </div>
  </div>
</template>

<style scoped>
/* On the page's background, a margin all round for the sets' hard shadows. */
.share-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 24px 28px;
  /* The same size whatever the screen's text size, as its width is. */
  font-size: 14px;
  color: var(--text);
  background: var(--bg);
}
.share-card.horizontal {
  width: 1200px;
}
.share-card.vertical {
  width: 820px;
}
.share-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.share-title {
  margin: 0;
  font-size: 1.6em;
  font-weight: bold;
  line-height: 1.2;
}
.share-sub {
  margin: 0;
  color: var(--muted);
}
/* Its sets three or two a row, whatever the screen's width (`TeamSets` follows the screen's), their moves two by two;
   no room under them but the shadows'. */
.share-card.horizontal :deep(.sets.sets) {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.share-card.vertical :deep(.sets.sets) {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.share-card :deep(.sets.sets) {
  gap: 12px;
  padding: 0 4px 4px 0;
}
.share-card :deep(.set-moves.set-moves) {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
/* Its names text, not links. */
.share-card :deep(a) {
  color: inherit;
  text-decoration: none;
}
.share-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 4px;
}
.share-logo {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 20px;
  font-weight: bold;
  letter-spacing: -0.5px;
  color: var(--logo-sprout);
}
.share-logo img {
  image-rendering: pixelated;
}
.share-logo .word span {
  color: var(--logo-vgc);
}
.share-url {
  font-size: 0.9em;
  color: var(--muted);
}
</style>
