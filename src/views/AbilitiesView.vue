<script setup lang="ts">
import Marked from '@/components/Marked'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ability, availableIds } from '@/data/dex'
import { REGULATION } from '@/data/format'
import { locale, t } from '@/i18n'
import { description } from '@/i18n/descriptions'
import { refName } from '@/i18n/refName'
import { fold, split } from '@/lib/search'
import DexText from '@/components/DexText'
import SearchBox from '@/components/SearchBox.vue'

// Every ability the regulation has, by name in the reader's language, with its short description.
const abilities = computed(() =>
  availableIds('ability')
    .map((id) => ({ id, name: refName(ability(id)), text: description('ability', id)?.short ?? '' }))
    .sort((a, b) => a.name.localeCompare(b.name, locale.value)),
)

// The home page's search links here with its query (`?q=`).
const initial = useRoute().query.q
const query = ref(typeof initial === 'string' ? initial : '')
const shown = computed(() => {
  const q = fold(query.value.trim())
  if (!q) return abilities.value.map((a) => ({ ...a, parts: null }))
  return abilities.value.flatMap((a) => {
    const parts = split(a.name, q)
    return parts ? [{ ...a, parts }] : []
  })
})
</script>

<template>
  <!-- The heading and the search, and the list, in panels of their own on phones, one panel on wider screens. -->
  <div class="panels">
    <div class="panel">
      <h1>{{ t('title.abilities') }}</h1>
      <p class="muted">{{ t('abilities.intro', { reg: REGULATION }) }}</p>
      <SearchBox v-model="query" :placeholder="t('abilities.search')" :aria-label="t('abilities.search')" />
    </div>
    <div class="panel">
      <dl v-if="shown.length" class="entries">
        <template v-for="a in shown" :key="a.id">
          <dt>
            <RouterLink :to="{ name: 'ability', params: { id: a.id } }">
              <Marked v-if="a.parts" :p="a.parts" />
              <template v-else>{{ a.name }}</template>
            </RouterLink>
          </dt>
          <dd class="muted"><DexText :text="a.text" /></dd>
        </template>
      </dl>
      <p v-else class="muted">{{ t('abilities.none') }}</p>
    </div>
  </div>
</template>

<style scoped>
.entries {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 6px 16px;
  margin: 0;
}
.entries dt {
  font-weight: bold;
}
.entries dd {
  margin: 0;
}
/* One column on phones: the name above its description. */
@media (max-width: 560px) {
  .entries {
    grid-template-columns: 1fr;
    gap: 2px;
  }
  .entries dd {
    margin-bottom: 8px;
  }
}
</style>
