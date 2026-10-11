<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { Search } from '@lucide/vue'
import { t } from '@/i18n'

// A search field with a button that clears it, in every browser: phones' own clear button only shows on some, and
// desktop browsers show it on hover at best, so the native one is hidden in favour of this. Attributes go to the field.
// `wide` fills the width it's given (the home page's search); `icon` puts a magnifying glass at the start, and the
// `lead` slot anything else there (a Pokémon's icon). `hotkey` is the key the page focuses it with, shown where the
// clear button goes while there's nothing to clear (where there's a keyboard to press it on). `noClear` leaves the
// clear button out, for where something else around the field does it.
defineOptions({ inheritAttrs: false })
defineProps<{ wide?: boolean; icon?: boolean; hotkey?: string; noClear?: boolean }>()
const query = defineModel<string>({ default: '' })

const input = useTemplateRef('input')
function clear() {
  query.value = ''
  input.value?.focus({ preventScroll: true })
}
defineExpose({ focus: (options?: FocusOptions) => input.value?.focus(options), select: () => input.value?.select() })
</script>

<template>
  <span class="search-box" :class="{ wide, icon, led: $slots.lead }">
    <Search v-if="icon" class="glass" :size="16" :stroke-width="2.5" aria-hidden="true" />
    <span v-if="$slots.lead" class="lead"><slot name="lead" /></span>
    <input ref="input" v-model="query" type="search" class="search" :aria-keyshortcuts="hotkey" v-bind="$attrs" />
    <button v-if="query && !noClear" type="button" class="clear" :aria-label="t('search.clear')" @click="clear">
      ×
    </button>
    <kbd v-else-if="hotkey" class="hotkey" aria-hidden="true">{{ hotkey }}</kbd>
  </span>
</template>

<style scoped>
/* The box lays out as a lone `.search` would; the field fills it, leaving room for the button. */
.search-box {
  position: relative;
  display: block;
  width: 100%;
  max-width: 320px;
  margin-bottom: 12px;
}
.search {
  display: block;
  max-width: none;
  margin: 0;
  padding-right: 32px;
}
.wide {
  max-width: none;
}
.icon .search {
  padding-left: 32px;
}
.led .search {
  padding-left: 44px;
}
.lead {
  position: absolute;
  top: 50%;
  left: 4px;
  display: flex;
  transform: translateY(-50%);
  pointer-events: none;
}
.glass {
  position: absolute;
  top: 50%;
  left: 10px;
  transform: translateY(-50%);
  color: var(--muted);
  pointer-events: none;
}
.search::-webkit-search-cancel-button {
  display: none;
}
.clear {
  position: absolute;
  top: 50%;
  right: 4px;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  padding: 0;
  font: inherit;
  font-size: 1.25em;
  line-height: 1;
  color: var(--muted);
  background: none;
  border: none;
  cursor: pointer;
}
.clear:hover {
  color: inherit;
}
.hotkey {
  position: absolute;
  top: 50%;
  right: 8px;
  transform: translateY(-50%);
  min-width: 18px;
  padding: 2px 4px;
  font:
    11px/1 Verdana,
    sans-serif;
  text-align: center;
  color: var(--muted);
  border: 1px solid var(--border);
  border-radius: 2px;
  pointer-events: none;
}
/* Touch-first devices (phones, tablets) usually have no keyboard to press it on. */
@media (hover: none) and (pointer: coarse) {
  .hotkey {
    display: none;
  }
}
</style>
