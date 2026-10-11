# Regulation change checklist

Written 2026-10-11. Run through this every time a regulation starts (or a patch changes
one). Most of the dex follows the data; what's below is what doesn't, or what needs a human eye.

## 1. Repin and regenerate

- [ ] `.env`: `VITE_REGULATION` to the new one; update the dates in its comment.
- [ ] `npm run gen-data -- --update` (Showdown, PokéAPI, client, sprites, Smogon month).
- [ ] Stops on "no VGC format for Regulation X": Showdown hasn't added it yet. Wait, or repin later.
- [ ] Stops on "Names missing": add them to `scripts/overrides.ts` (official names; Bulbapedia only to check).
- [ ] Warns "sources agree with overrides": delete those overrides.
- [ ] Read every other warning; each one is a task below.

## 2. Speed (hand-kept, `src/lib/speed.ts` + `speedBuild.ts` + `SpeedTiersView.vue`)

The speed warning: gen-data prints "What changes Speed in the regulation, missing from src/lib/speed.ts: …" for any
item or ability the regulation has whose Showdown code changes Speed (`onModifySpe`) and `speed.ts` lacks. For each:

- [ ] `SPEED_ITEMS` / `SPEED_ABILITIES`: factor, `when`, `mod`.
- [ ] New condition (weather, terrain, other)? Add to `SpeedWhen`, and to `FIELDS` in `SpeedTiersView.vue`.
- [ ] New multiplier kind? Add a `mod` to `SpeedEffect`, a flag to `SpeedMods`, its factor in `inBattle()`.
- [ ] Order of operations still Showdown's? Check `inBattle()` against Showdown's `getActionSpeed`/`modifySpe`.
- [ ] Can't stack with something? `withEffect()` and `CLASHES` (`speedBuild.ts`).
- [ ] Should the reader toggle it? `BUILD_TOGGLES`, `MY_TOGGLES`, `TOGGLES`, `modButtons`, `modsOf`, `MOD_ITEMS`.
- [ ] Labels: `speed.mod.*`, `speed.modTip.*`, `speed.when.*` in `en.ts` and `es.ts`.
- [ ] A Pokémon with 3+ doubling abilities? `doubled`/`doubled2` assume at most two.

**Blind spots** (gen-data does not warn; check the regulation's new entries by hand):

- [ ] Effects that live in a condition, not the ability/item (Protosynthesis, Quark Drive, Slow Start).
- [ ] Stage changers (Speed Boost, Steam Engine, Weak Armor, Icy Wind…): not modeled, just the stage control.
- [ ] Turn order without Speed (priority: Prankster, Gale Wings, Quick Claw, Quash, Room Service): not modeled.
- [ ] New field moves like Tailwind / Trick Room.

## 3. Mechanics (`src/lib/stats.ts`, `speed.ts`)

- [ ] Stat formula still base + points + 20 (HP + 75)? `MAX_POINTS` still 32?
- [ ] Natures: `FAST` / `SLOW` unchanged?
- [ ] Type chart changed? `src/data/types.ts`.

## 4. Hand-curated dex content

- [ ] Descriptions: gen-data lists new, changed (source hash) and gone entries per category. Write/revise in
      `src/i18n/en/<category>.ts`, then translations in `src/i18n/es/…`.
- [ ] Conditions: a new weather/terrain/side/field effect? Add to `CONDITIONS` (`src/data/conditions.ts`), its
      `names` in every locale, a description; `scripts/conditions.ts` patterns if Showdown sets it a new way.
- [ ] Type interactions: new abilities/items/moves that touch types, weather, immunities → `src/data/typeinfo.ts`
      (and `MAJOR` if common). Removed ones hide themselves.
- [ ] Groups (`GROUPS` in `dex.ts`: powder, trapping, terrains): new members?
- [ ] New item kind (beyond held / berry / mega)? `ITEM_KINDS` in `src/data/items.ts`.
- [ ] `npm run check-text`: markers naming entries the regulation dropped. Rewrite or unlink them.

## 5. Sprites

- [ ] gen-data warns "No gen5 sprite yet": nothing to do, the page shows the icon. Recheck next repin.

## 6. Usage stats

- [ ] Nothing to add: `gen-data` adds the new regulation to `smogon` in `scripts/sources.json` on its own, with
      every month Smogon has of it (none at first: the site then shows the previous regulation's latest, labeled).
      `usage-stats.yml` adds each new month once published.
- [ ] Past regulations stay in `sources.json` and keep being generated (every month, every cutoff), as their
      history; the reader picks regulation → month → players. Removing one from `sources.json` drops it.
- [ ] Their stats aren't held to the dex: what the dex no longer has is left out, with a warning. A past
      regulation's roster (`meta/rosters.json`, for "every Pokémon" on the speed tiers) is its Showdown format's,
      or, once Showdown drops the format, the Pokémon its stats name.
- [ ] `VITE_META_SETS` uses patterns (`smogon-*-1760`…): nothing to change.

## 7. Text and pages

- [ ] Regulation-specific copy is `{reg}`-parametrized; grep `en.ts`/`es.ts` for anything hard-coded ("M-C").
- [ ] SEO pages, sitemap, availability, learnsets, pickers: automatic from the data.

## 8. Verify

- [ ] `npm run build`, `npm run lint`.
- [ ] Browser: a new Pokémon's page, a removed one 404s, speed tiers with boosts on, the comparison, usage.
- [ ] Update `CLAUDE.md` / notes if anything structural moved.
