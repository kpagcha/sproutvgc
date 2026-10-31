<script setup lang="ts">
import { onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Menu, Moon, Settings, Sun, X } from '@lucide/vue'
import { t } from '@/i18n'
import { AREAS } from '@/lib/areas'
import { useTheme } from '@/composables/useTheme'

// Narrow screens' header: the areas, their sections, then the theme and Settings folded into a drawer from the right,
// its toggle at the bar's end. Meta's and Tools' sections are listed under them, the ones reached for most; the quizzes
// and the dex lead to their own pages. Each link is marked only on its own page: an area's not on its sections'.
// Going anywhere closes it, as do the backdrop and Escape.

const EXPANDED = new Set(['meta', 'tools'])

const route = useRoute()
const open = ref(false)
const toggle = useTemplateRef('toggle')
watch(
  () => route.fullPath,
  () => (open.value = false),
)

function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !open.value) return
  open.value = false
  toggle.value?.focus()
}
watch(open, (on) => (on ? window.addEventListener('keydown', onKey) : window.removeEventListener('keydown', onKey)))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const { theme, setMode } = useTheme()
const toggleTheme = () => setMode(theme.value === 'dark' ? 'light' : 'dark')
</script>

<template>
  <button
    ref="toggle"
    type="button"
    class="drawer-toggle"
    :aria-label="t('nav.menu')"
    aria-haspopup="true"
    :aria-expanded="open"
    @click="open = !open"
  >
    <Menu :size="20" :stroke-width="2.5" aria-hidden="true" />
  </button>
  <!-- In the body, out of the header's stacking, so over the whole page. -->
  <Teleport to="body">
    <Transition name="nav-fade">
      <div v-if="open" class="nav-backdrop" aria-hidden="true" @click="open = false"></div>
    </Transition>
    <Transition name="nav-drawer">
      <aside v-if="open" class="panel nav-drawer font-display" :aria-label="t('nav.areas')">
        <button type="button" class="icon close" :aria-label="t('nav.close')" @click="open = false">
          <X :size="20" :stroke-width="2.5" aria-hidden="true" />
        </button>
        <nav>
          <div v-for="a in AREAS" :key="a.id" class="area">
            <RouterLink :to="`/${a.id}`" class="area-link" :class="{ active: route.name === a.route }">
              {{ t(a.label) }}
            </RouterLink>
            <template v-if="EXPANDED.has(a.id)">
              <RouterLink
                v-for="s in a.sections"
                :key="s.key"
                :to="{ name: s.route }"
                class="section-link"
                :class="{ active: route.meta.section === s.key, soon: s.soon }"
              >
                {{ t(s.label) }}
              </RouterLink>
            </template>
          </div>
          <button type="button" class="area-link theme" @click="toggleTheme">
            <component :is="theme === 'dark' ? Moon : Sun" :size="16" :stroke-width="2.5" aria-hidden="true" />
            {{ t('theme.label') }}
          </button>
          <RouterLink to="/settings" class="area-link" :class="{ active: route.name === 'settings' }">
            <Settings :size="16" :stroke-width="2.5" aria-hidden="true" />
            {{ t('nav.settings') }}
          </RouterLink>
        </nav>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-toggle,
.icon {
  display: flex;
  align-items: center;
  flex: none;
  padding: 4px 8px;
  font: inherit;
  color: var(--text);
  background: none;
  border: none;
  border-radius: 3px;
  cursor: pointer;
}
.drawer-toggle {
  margin-left: auto;
}

.nav-backdrop {
  position: fixed;
  inset: 0;
  z-index: 90;
  background: color-mix(in srgb, #000 45%, transparent);
}
.nav-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 91;
  display: flex;
  flex-direction: column;
  width: min(300px, 82vw);
  margin: 0;
  padding: 8px 12px 16px;
  border-right: 0;
  overflow: auto;
  overscroll-behavior: contain;
  will-change: transform;
}
/* In the drawer's top corner, over the first area's row rather than a row of its own. */
.close {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1;
}
nav {
  display: flex;
  flex-direction: column;
}
.area {
  display: flex;
  flex-direction: column;
  padding: 4px 0;
  border-bottom: 1px solid var(--border);
}
nav a {
  display: flex;
  align-items: center;
  gap: 6px;
  border-radius: 3px;
  color: var(--text);
}
nav a:hover {
  text-decoration: none;
}
nav a.active {
  background: var(--sel);
}
.area-link {
  padding: 8px 10px;
  font-size: 1.1em;
  font-weight: bold;
}
.section-link {
  padding: 7px 10px 7px 22px;
  color: var(--muted);
}
.section-link.active {
  color: var(--text);
}
.section-link.soon:not(.active) {
  opacity: 0.7;
}
/* The theme's switch, a row as Settings' link is, over it. */
.theme {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font: inherit;
  font-size: 1.1em;
  font-weight: bold;
  color: var(--text);
  text-align: left;
  background: none;
  border: none;
  border-radius: 3px;
  cursor: pointer;
}
@media (hover: hover) {
  .theme:hover {
    background: var(--hover);
  }
}

.nav-fade-enter-active,
.nav-fade-leave-active {
  transition: opacity 0.18s ease;
}
.nav-fade-enter-from,
.nav-fade-leave-to {
  opacity: 0;
}
.nav-drawer-enter-active,
.nav-drawer-leave-active {
  transition: transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.nav-drawer-enter-from,
.nav-drawer-leave-to {
  transform: translateX(100%);
}
@media (prefers-reduced-motion: reduce) {
  .nav-drawer-enter-active,
  .nav-drawer-leave-active,
  .nav-fade-enter-active,
  .nav-fade-leave-active {
    transition: none;
  }
}
</style>
