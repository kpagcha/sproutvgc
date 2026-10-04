<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { AnimatePresence, motion } from 'motion-v'
import { TYPES, isType, type Multiplier } from '@/data/types'
import { t, typeName } from '@/i18n'
import { attackInfo, defenseInfo, hasInfo } from '@/lib/interactions'
import { attackProfile, defensiveProfile, formatMult, multClass, type Profile } from '@/lib/typecalc'
import { FADE, PRESS, SPRING } from '@/lib/motion'
import { reveal } from '@/lib/scroll'
import TypeIcon from '@/components/TypeIcon'
import QuickLinks from '@/components/QuickLinks.vue'
import SideInteractions from '@/components/SideInteractions.vue'

// The selected type is the route param (`/types/fire`), validated by the route itself.
const route = useRoute()
const type = computed(() => {
  const p = route.params.type
  return typeof p === 'string' && isType(p) ? p : null
})

const MULTS: Multiplier[] = [2, 0.5, 0]

const sections = computed(() => {
  const ty = type.value
  if (!ty) return []
  // Only the multipliers this type actually has.
  const rows = (p: Profile) => MULTS.filter((m) => p[m].length).map((m) => ({ m, types: p[m] }))
  return [
    // Interactions go on the side they help: protecting the type's Pokémon, or its attacks (its moves, and its
    // Pokémon on the offense).
    {
      title: 'types.defending' as const,
      rows: rows(defensiveProfile([ty])),
      info: defenseInfo([ty]),
    },
    {
      title: 'types.attacking' as const,
      rows: rows(attackProfile(ty)),
      info: attackInfo([ty]),
    },
  ]
})

// Picking a type brings its panel into view (on phones it starts below the list); a panel taller than the screen
// is scrolled to its top.
const detail = useTemplateRef<HTMLElement>('detail')
watch(
  type,
  (ty) => {
    if (ty) reveal(detail.value)
  },
  { flush: 'post' },
)

// The panel fades in the first time it shows on a visit to the page; once it has, moving between types (or closing
// and reopening it) swaps it at once.
const revealed = ref(false)
</script>

<template>
  <QuickLinks class="tools" />
  <div class="panel">
    <h1 class="intro">{{ t('title.types') }}</h1>
    <p class="intro muted">{{ t('types.intro') }}</p>
    <nav class="list">
      <!-- Picking the selected type again closes it. -->
      <RouterLink
        v-for="ty in TYPES"
        :key="ty"
        v-slot="{ href, navigate }"
        :to="ty === type ? '/types' : `/types/${ty}`"
        custom
      >
        <motion.a
          :href="href"
          class="opt"
          :class="{ on: ty === type }"
          :aria-current="ty === type ? 'page' : undefined"
          :while-press="PRESS"
          @click="navigate"
        >
          <!-- The highlight is one element that slides between types. -->
          <motion.span v-if="ty === type" layout-id="type-pill" class="pill" :transition="SPRING" />
          <TypeIcon :type="ty" :scale="2" class="icon" />
        </motion.a>
      </RouterLink>
    </nav>
  </div>

  <div ref="detail">
    <AnimatePresence mode="wait">
      <motion.div
        v-if="type"
        :key="type"
        :initial="revealed ? false : { opacity: 0, y: 6 }"
        :animate="{ opacity: 1, y: 0 }"
        :exit="revealed ? undefined : { opacity: 0, y: -4 }"
        :transition="FADE"
        :on-animation-complete="() => (revealed = true)"
      >
        <!-- The type's name, then its two sides in panels of their own, side by side where there's room. -->
        <div class="panel">
          <h2 class="name">
            <TypeIcon :type="type" :scale="2" />
            {{ typeName(type) }}
          </h2>
        </div>
        <div class="sides">
          <section v-for="s in sections" :key="s.title" class="panel">
            <h3>{{ t(s.title) }}</h3>
            <table class="groups">
              <tbody>
                <tr v-for="row in s.rows" :key="row.m">
                  <th>
                    <span class="mult-tag" :class="multClass(row.m)">{{ formatMult(row.m) }}</span>
                  </th>
                  <td>
                    <span class="icons">
                      <RouterLink v-for="x in row.types" :key="x" :to="`/types/${x}`">
                        <TypeIcon :type="x" />
                      </RouterLink>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="hasInfo(s.info)" class="info"><SideInteractions :info="s.info" /></div>
          </section>
        </div>
      </motion.div>
    </AnimatePresence>
  </div>

  <p v-if="!type" class="muted hint">{{ t('types.selectHint') }}</p>
</template>

<style scoped>
.tools {
  margin-bottom: 12px;
}
/* Phones go straight to the type list. The title stays for screen readers. */
@media (max-width: 560px) {
  h1.intro {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  p.intro {
    display: none;
  }
}
.list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
  gap: 4px;
}
.opt {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  background: var(--panel-alt);
  border: 1px solid var(--border);
  border-radius: 3px;
}
.opt:hover {
  background: var(--hover);
}
.opt.on {
  border-color: var(--accent);
}
.opt .pill {
  position: absolute;
  inset: 0;
  background: var(--sel);
  border-radius: 2px;
}
.opt .icon {
  position: relative;
}

.name {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}

.sides {
  display: grid;
  gap: 12px;
  margin-bottom: 12px;
}
.sides > .panel {
  margin: 0;
}
/* Side by side where there's room, at the same width as the matchups page's two columns, and the same height. */
@media (min-width: 860px) {
  .sides {
    grid-template-columns: 1fr 1fr;
  }
  .sides > * {
    min-width: 0;
  }
}

.groups {
  border-collapse: collapse;
  width: 100%;
}
.groups th,
.groups td {
  border-top: 1px solid var(--border);
  padding: 6px 4px;
  vertical-align: middle;
  text-align: left;
}
.groups tr:first-child th,
.groups tr:first-child td {
  border-top: none;
}
.groups th {
  width: 1%;
  white-space: nowrap;
  font-weight: normal;
}
.icons {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.icons a {
  display: flex;
}

.info {
  padding: 8px 4px 0;
  border-top: 1px solid var(--border);
}

.hint {
  text-align: center;
}
</style>
