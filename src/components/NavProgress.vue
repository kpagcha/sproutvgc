<script setup lang="ts">
import { navPending } from '@/lib/navProgress'

// A thin bar across the top of the window while a page change is slow to show (`navPending`): growing towards the end
// as it goes on, without ever reaching it, and fading once the page is in. Only `transform` and `opacity` animate, which
// the browser runs off the main thread, so it keeps moving while the page renders.
</script>

<template>
  <Transition name="nav-progress">
    <div v-if="navPending" class="nav-progress" role="progressbar" aria-hidden="true">
      <div class="bar"></div>
    </div>
  </Transition>
</template>

<style scoped>
.nav-progress {
  position: fixed;
  inset: 0 0 auto;
  z-index: 10000;
  height: 3px;
  pointer-events: none;
}
.bar {
  height: 100%;
  background: var(--accent);
  transform-origin: left;
  animation: grow 4s cubic-bezier(0.1, 0.6, 0.3, 1) forwards;
}
@keyframes grow {
  from {
    transform: scaleX(0.05);
  }
  to {
    transform: scaleX(0.92);
  }
}
.nav-progress-leave-active {
  transition: opacity 0.2s ease-out;
}
.nav-progress-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .bar {
    animation: none;
    transform: scaleX(0.4);
  }
}
</style>
