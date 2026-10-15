<script setup lang="ts">
import RankingsTabs, { type RankingList } from '@/components/RankingsTabs.vue'
import ComingSoonView from '@/views/ComingSoonView.vue'

// A usage list not built yet: the tabs to the others, as the band over what it will be.
defineProps<{ list: RankingList }>()
</script>

<template>
  <ComingSoonView>
    <RankingsTabs :current="list" />
  </ComingSoonView>
</template>
