<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { THEME_MODES, useTheme } from '@/composables/useTheme'
import { LOCALES, locale, setLocale, t, type Locale } from '@/i18n'
import { confirmDialog } from '@/composables/useConfirm'

const { mode, setMode } = useTheme()
const MetaDevTools = import.meta.env.DEV ? defineAsyncComponent(() => import('@/dev/MetaDevTools.vue')) : null

// Erases everything the site has saved in this browser (every `sproutvgc.` key: favorites, recently viewed, the quiz's
// deck, settings and preferences), once confirmed, then reloads so nothing read from it lingers in memory.
async function clearAll() {
  if (
    !(await confirmDialog({
      message: t('settings.clearConfirm'),
      confirm: t('settings.clearConfirmButton'),
      danger: true,
    }))
  )
    return
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('sproutvgc.'))
    for (const k of keys) localStorage.removeItem(k)
  } catch {
    // Storage unavailable: nothing was saved to clear.
  }
  location.reload()
}
</script>

<template>
  <div class="panel">
    <h1>{{ t('title.settings') }}</h1>
    <p class="muted">{{ t('settings.intro') }}</p>
  </div>

  <div class="panel">
    <h2>{{ t('lang.label') }}</h2>
    <div class="opts">
      <label v-for="(label, code) in LOCALES" :key="code" class="opt" :class="{ on: locale === code }">
        <input type="radio" name="lang" :value="code" :checked="locale === code" @change="setLocale(code as Locale)" />
        <span class="opt-text">
          <span class="opt-name font-display" :lang="code">{{ label }}</span>
        </span>
      </label>
    </div>
  </div>

  <div class="panel">
    <h2>{{ t('theme.label') }}</h2>
    <div class="opts">
      <label v-for="m in THEME_MODES" :key="m" class="opt" :class="{ on: mode === m }">
        <input type="radio" name="theme" :value="m" :checked="mode === m" @change="setMode(m)" />
        <span class="opt-text">
          <span class="opt-name font-display">{{ t(`theme.${m}`) }}</span>
          <span v-if="m === 'auto'" class="muted small">{{ t('theme.autoDesc') }}</span>
        </span>
      </label>
    </div>
  </div>

  <component :is="MetaDevTools" v-if="MetaDevTools" />

  <div class="panel">
    <h2>{{ t('settings.clearTitle') }}</h2>
    <div class="warning">
      <p>{{ t('settings.clearWarning') }}</p>
      <p class="strong">{{ t('settings.clearUndo') }}</p>
      <button type="button" class="btn danger" @click="clearAll">{{ t('settings.clearTitle') }}</button>
    </div>
  </div>
</template>

<style scoped>
.small {
  font-size: calc(11px * var(--text-scale));
}
.opts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 4px 12px;
}
.opt {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 3px;
  cursor: pointer;
}
.opt:hover {
  background: var(--hover);
}
.opt.on {
  background: var(--sel);
}
.opt input {
  margin-top: 3px;
}
.opt-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
/* Clearing all data: the warning on a red wash with a red outline, the button the confirm dialog's destructive red. */
.warning {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 12px;
  background: color-mix(in srgb, var(--m025-bg) 12%, transparent);
  border: 2px solid var(--m025-bg);
}
.warning p {
  margin: 0;
}
.strong {
  font-weight: bold;
}
.btn.danger {
  margin-top: 4px;
  background: var(--m025-bg);
  border-color: var(--m025-bg);
  color: var(--m025-fg);
  font-weight: bold;
}
.btn.danger:hover {
  background: var(--m025-bg);
  filter: brightness(1.08);
}
</style>
