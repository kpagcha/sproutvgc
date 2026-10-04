<script setup lang="ts">
import { computed } from 'vue'
import type { Ref } from '@/data/dex'
import { refName } from '@/i18n/refName'
import { follow, refHref } from '@/lib/links'

// A dex entry by name: a link to its page once its category has one (see `PAGES`), plain text until then. `tip`, if
// given, shows on hovering the link. A plain link the router follows (`follow`), as there can be hundreds on a page.
const props = defineProps<{ to: Ref; tip?: string }>()
const href = computed(() => refHref(props.to))
</script>

<template>
  <a v-if="href" v-tip="tip" :href @click="follow">{{ refName(to) }}</a>
  <template v-else>{{ refName(to) }}</template>
</template>
