# sproutvgc

A competitive Pokémon dex in the spirit of the [Smogon dex](https://www.smogon.com/dex/) and the
[Showdown dex](https://dex.pokemonshowdown.com/): classic, pixel-style, clean and fast.

Currently implemented:

- **Type chart** (`/dex/types/chart`): the Gen 6+ 18×18 matchup chart.
- **Type matchups** (`/tools/matchups`): defensive matchups for 1–2 types, and offensive coverage for up to 4 attacking types.
- **Type quiz** (`/tools/quiz`): a matchup quiz that schedules questions with SM-2 spaced repetition, so the matchups you miss come back more often.

Available in English and Spanish, with the official type names in each language. Add a language
by creating `src/i18n/<code>.ts` (the compiler flags missing keys) and listing it in `src/i18n/index.ts`.

## Scripts

```sh
npm install        # also installs the git pre-commit hook
npm run dev        # dev server
npm run build      # type-check + production build
npm run preview    # serve the production build
npm run lint       # ESLint
npm run lint:fix   # ESLint with autofix
```

With [just](https://github.com/casey/just), `just` lists shortcuts: `just dev`, `just dev-profile` (dev server with Vue's per-component timings for the browser profiler), `just build`, and `just preview` (build, then serve the production site at http://localhost:4173/sproutvgc/, the place to measure performance).

A pre-commit hook lints the staged `.ts` and `.vue` files and blocks the commit on any problem.
