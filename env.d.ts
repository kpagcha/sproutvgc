/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_REGULATION: string
  readonly VITE_META_SETS?: string
  // Only set on the dev server (.env.development).
  readonly VITE_PROFILE?: string
}
