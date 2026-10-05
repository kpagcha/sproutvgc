<script setup lang="ts">
import { metaProviders } from '@/data/meta'
import { t, tSplit, tSlots } from '@/i18n'

const icons = tSplit('credits.iconsBody', 'source')
const sprites = tSplit('credits.spritesBody', 'source')
const uiIcons = tSplit('credits.uiIconsBody', 'source')
const meta = tSplit('credits.metaBody', 'sources')
const providers = metaProviders()
</script>

<template>
  <div class="panel">
    <h1>{{ t('title.credits') }}</h1>
    <p class="muted">{{ t('credits.intro') }}</p>
  </div>

  <div class="panel">
    <h2>{{ t('credits.dataTitle') }}</h2>
    <p>
      <template v-for="(part, i) in tSlots('credits.dataBody')" :key="i">
        <template v-if="typeof part === 'string'">{{ part }}</template>
        <a v-else-if="part.slot === 'showdown'" href="https://github.com/smogon/pokemon-showdown" rel="noopener"
          >Pokémon Showdown</a
        >
        <a v-else href="https://pokeapi.co/" rel="noopener">PokéAPI</a>
      </template>
    </p>
  </div>

  <div v-if="providers.length" class="panel">
    <h2>{{ t('credits.metaTitle') }}</h2>
    <p>
      {{ meta[0]
      }}<template v-for="(p, i) in providers" :key="p.url"
        >{{ i ? ', ' : '' }}<a :href="p.url" rel="noopener">{{ p.name }}</a></template
      >{{ meta[1] }}
    </p>
  </div>

  <div class="panel">
    <h2>{{ t('credits.spritesTitle') }}</h2>
    <p>
      {{ sprites[0] }}<a href="https://play.pokemonshowdown.com/sprites/" rel="noopener">Pokémon Showdown</a
      >{{ sprites[1] }}
    </p>
  </div>

  <div class="panel">
    <h2>{{ t('credits.iconsTitle') }}</h2>
    <p>
      {{ icons[0] }}<a href="https://archives.bulbagarden.net/" rel="noopener">Bulbagarden Archives</a>{{ icons[1] }}
    </p>
  </div>

  <div class="panel">
    <h2>{{ t('credits.uiIconsTitle') }}</h2>
    <p>{{ uiIcons[0] }}<a href="https://lucide.dev/" rel="noopener">Lucide</a>{{ uiIcons[1] }}</p>
  </div>

  <div class="panel">
    <h2>Pokémon</h2>
    <p>{{ t('footer.copyright') }}</p>
    <p>{{ t('credits.trademarks') }}</p>
  </div>
</template>
