import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig(({ command, isPreview }) => ({
  // Production is served from GitHub Pages at https://kpagcha.github.io/sproutvgc/; `vite preview` serves that build
  // locally, so it needs the same base or its asset URLs fall through to index.html.
  base: command === 'build' || isPreview ? '/sproutvgc/' : '/',
  // Listen on the network too, so the dev server can be opened from a phone on the same Wi-Fi.
  server: { host: true },
  plugins: [vue()],
  // JSON modules as one `JSON.parse` with a default export, instead of a named export per key: the generated data is
  // only ever imported whole, and this halves its chunks. `namedExports: false` is what does it; `stringify` alone
  // doesn't.
  json: { stringify: true, namedExports: false },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
}))
