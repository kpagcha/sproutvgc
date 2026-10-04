<script setup lang="ts">
import { THEME_MODES, useTheme } from '@/composables/useTheme'
import { LOCALES, locale, setLocale, t, type Locale } from '@/i18n'

const { mode, setMode } = useTheme()
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
</style>
