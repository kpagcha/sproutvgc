<script setup lang="ts">
import { computed } from 'vue'
import { metaProviders } from '@/data/meta'
import { EVENTS } from '@/data/tournaments'
import { t, tSplit } from '@/i18n'

// Where everything comes from, a line each: what it is, then its source and, in small print, its license or a note;
// the legal notices under them.
const names = tSplit('credits.namesNote', 'pokeapi')
const providers = computed(metaProviders)
/** The tournaments' source, the one every event has. */
const tournaments = EVENTS[0]?.provider
</script>

<template>
  <div class="panel credits">
    <h1>{{ t('title.credits') }}</h1>
    <p class="muted intro">{{ t('credits.intro') }}</p>

    <dl>
      <div>
        <dt>{{ t('credits.dataTitle') }}</dt>
        <dd>
          <a href="https://github.com/smogon/pokemon-showdown" rel="noopener">Pokémon Showdown</a>
          <span class="note">{{ t('credits.license', { license: 'MIT' }) }}</span>
          <span class="note">{{ names[0] }}<a href="https://pokeapi.co/" rel="noopener">PokéAPI</a>{{ names[1] }}</span>
        </dd>
      </div>
      <div v-if="providers.length">
        <dt>{{ t('credits.metaTitle') }}</dt>
        <dd>
          <template v-for="(p, i) in providers" :key="p.url"
            >{{ i ? ', ' : '' }}<a :href="p.url" rel="noopener">{{ p.name }}</a></template
          >
        </dd>
      </div>
      <div v-if="tournaments">
        <dt>{{ t('credits.tournamentsTitle') }}</dt>
        <dd>
          <a :href="tournaments.url" rel="noopener">{{ tournaments.name }}</a>
        </dd>
      </div>
      <div>
        <dt>{{ t('credits.spritesTitle') }}</dt>
        <dd><a href="https://play.pokemonshowdown.com/sprites/" rel="noopener">Pokémon Showdown</a></dd>
      </div>
      <div>
        <dt>{{ t('credits.iconsTitle') }}</dt>
        <dd><a href="https://archives.bulbagarden.net/" rel="noopener">Bulbagarden Archives</a></dd>
      </div>
      <div>
        <dt>{{ t('credits.uiIconsTitle') }}</dt>
        <dd>
          <a href="https://lucide.dev/" rel="noopener">Lucide</a>
          <span class="note">{{ t('credits.license', { license: 'ISC' }) }}</span>
        </dd>
      </div>
    </dl>

    <p class="legal muted">{{ t('credits.copyright') }}. {{ t('credits.trademarks') }}</p>
  </div>
</template>

<style scoped>
.intro {
  margin: 4px 0 16px;
}
/* A row per source: what it is at the left, a column of its own, its source beside it; on a phone, one over the other. */
dl {
  margin: 0;
}
dl > div {
  display: grid;
  grid-template-columns: 14rem minmax(0, 1fr);
  gap: 2px 16px;
  padding: 8px 0;
  border-top: 1px solid var(--border);
}
dl > div:last-child {
  border-bottom: 1px solid var(--border);
}
dt {
  color: var(--muted);
}
dd {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 12px;
  margin: 0;
}
dd a {
  font-weight: bold;
}
.note {
  font-size: 0.85em;
  color: var(--muted);
}
.note a {
  font-weight: normal;
}
.legal {
  margin: 16px 0 0;
  font-size: 0.85em;
}
@media (max-width: 560px) {
  dl > div {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
