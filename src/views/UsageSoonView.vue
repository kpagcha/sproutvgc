<script setup lang="ts">
import UsageTabs, { type UsageList } from '@/components/UsageTabs.vue'
import ComingSoonView from '@/views/ComingSoonView.vue'

// A usage list not built yet: the tabs to the others, as the band over what it will be.
defineProps<{ list: UsageList }>()
</script>

<template>
  <ComingSoonView>
    <UsageTabs :current="list" />
  </ComingSoonView>
</template>
