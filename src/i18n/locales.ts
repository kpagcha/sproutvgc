// The app's languages, in a module of their own with no imports so `scripts/gen-data.ts` can use them too.

/** Supported languages, labelled in their own language. */
export const LOCALES = { en: 'English' } as const
export type Locale = keyof typeof LOCALES
