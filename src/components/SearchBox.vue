<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { Search } from '@lucide/vue'
import { t } from '@/i18n'

// A search field with a button that clears it, in every browser: phones' own clear button only shows on some, and
// desktop browsers show it on hover at best, so the native one is hidden in favour of this. Attributes go to the field.
// `wide` fills the width it's given (the home page's search); `icon` puts a magnifying glass at the start.
defineOptions({ inheritAttrs: false })
defineProps<{ wide?: boolean; icon?: boolean }>()
const query = defineModel<string>({ default: '' })

const input = useTemplateRef('input')
function clear() {
  query.value = ''
  input.value?.focus()
}
defineExpose({ focus: (options?: FocusOptions) => input.value?.focus(options) })
</script>

<template>
  <span class="search-box" :class="{ wide, icon }">
    <Search v-if="icon" class="glass" :size="16" :stroke-width="2.5" aria-hidden="true" />
    <input ref="input" v-model="query" type="search" class="search" v-bind="$attrs" />
    <button v-if="query" type="button" class="clear" :aria-label="t('search.clear')" @click="clear">×</button>
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
</style>
