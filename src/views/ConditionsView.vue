<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { availableIds, condition } from '@/data/dex'
import { CONDITIONS, SUBKINDS } from '@/data/conditions'
import { REGULATION } from '@/data/format'
import { t } from '@/i18n'
import { description } from '@/i18n/descriptions'
import { refName } from '@/i18n/refName'
import { fold, split } from '@/lib/search'
import DexText from '@/components/DexText'
import SearchBox from '@/components/SearchBox.vue'

// Every condition with an entry of its own, by kind (statuses, volatile effects, side and field effects, weather,
// terrains), with its short description. In the order `conditions.ts` lists them: related ones together.
const conditions = computed(() =>
  availableIds('condition').map((id) => ({
    id,
    name: refName(condition(id)),
    sub: CONDITIONS[id].sub,
    text: description('condition', id)?.short ?? '',
  })),
)

// The home page's search links here with its query (`?q=`).
const initial = useRoute().query.q
const query = ref(typeof initial === 'string' ? initial : '')
const groups = computed(() => {
  const q = fold(query.value.trim())
  const shown = conditions.value.flatMap((c) => {
    const parts = q ? split(c.name, q) : null
    return !q || parts ? [{ ...c, parts }] : []
  })
  return SUBKINDS.map((sub) => ({ sub, items: shown.filter((c) => c.sub === sub) })).filter((g) => g.items.length)
})
</script>

<template>
  <!-- The heading and the search, and the list, in panels of their own on phones, one panel on wider screens. -->
  <div class="panels">
    <div class="panel">
      <h1>{{ t('title.conditions') }}</h1>
      <p class="muted">{{ t('conditions.intro', { reg: REGULATION }) }}</p>
      <SearchBox v-model="query" :placeholder="t('conditions.search')" :aria-label="t('conditions.search')" />
    </div>
    <div class="panel">
      <section v-for="g in groups" :key="g.sub">
        <h2>{{ t(`conditions.sub.${g.sub}`) }}</h2>
        <dl class="entries">
          <template v-for="c in g.items" :key="c.id">
            <dt>
              <RouterLink :to="{ name: 'condition', params: { id: c.id } }">
                <template v-if="c.parts"
                  >{{ c.parts[0] }}<mark>{{ c.parts[1] }}</mark
                  >{{ c.parts[2] }}</template
                >
                <template v-else>{{ c.name }}</template>
              </RouterLink>
            </dt>
            <dd class="muted"><DexText :text="c.text" /></dd>
          </template>
        </dl>
      </section>
      <p v-if="!groups.length" class="muted">{{ t('conditions.none') }}</p>
    </div>
  </div>
</template>

<style scoped>
section + section {
  margin-top: 16px;
}
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
