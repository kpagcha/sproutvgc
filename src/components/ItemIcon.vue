<script setup lang="ts">
import type { ItemId } from '@/data/dex'
import { ITEMS } from '@/data/items'
import { cellStyle } from '@/lib/sprites'

// An item's icon, from the icon sheet: decorative, as its name is always beside it.
withDefaults(defineProps<{ id: ItemId; scale?: number }>(), { scale: 1 })
</script>

<template>
  <span class="sheet-icon" :style="cellStyle('items', ITEMS[id].icon, scale)" aria-hidden="true"></span>
</template>
