// A page of its own in the build for every page meant to be found: `dist/<path>/index.html`, the app's index.html
// with the page's English title, description and keywords (as `App.vue` titles it), its canonical URL and structured
// data. GitHub Pages serves it at that path with a 200, where any other deep link gets 404.html (the app all the same,
// but a 404 to crawlers), and crawlers and link previews read its head without running the app, which then retitles it
// in the reader's language. Also `sitemap.xml`, listing them, and 404.html, the app's index.html as it was.
//
// The pages are the areas, the dex's lists and every entry the regulation has, the types, the usage stats and the usage
// page of every Pokémon the default dataset has, and the working tools; not the settings, nor what's still coming soon. The app's own data and text load through jiti, as the generator's do.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createJiti } from 'jiti'
import type { Plugin, ResolvedConfig } from 'vite'

const ORIGIN = 'https://kpagcha.github.io'
const GAME = 'Pokémon Champions' // `GAME_NAME` (src/data/format.ts), which reads Vite's env and so can't load here

/** A page: its path under the base, and its messages (`App.vue` titles it with `head` if any, else `title`, after the
 * entry's name if it's one; `desc` takes `{name}`, `{ability}` and `{type}` as the entry's name). */
interface Page {
  path: string
  title?: string
  head?: string
  desc: string
  keywords?: string
  /** An entry's or a type's name. */
  lead?: string
  schema: 'WebSite' | 'CollectionPage' | 'WebPage' | 'WebApplication'
}

type Kind = 'ability' | 'move' | 'item' | 'pokemon' | 'condition'
interface Dex {
  availableIds(kind: Exclude<Kind, 'condition'>): string[]
  available(ref: { kind: Kind; id: string }): boolean
}

/** The dex's categories with entry pages: their path, their messages, and their names' file. */
const CATEGORIES = [
  { kind: 'pokemon', path: 'dex/pokemon', title: 'title.pokemon', list: 'desc.pokedex', entry: 'desc.pokemon' },
  { kind: 'move', path: 'dex/moves', title: 'title.moves', list: 'desc.moves', entry: 'desc.move' },
  { kind: 'ability', path: 'dex/abilities', title: 'title.abilities', list: 'desc.abilities', entry: 'desc.ability' },
  { kind: 'item', path: 'dex/items', title: 'title.items', list: 'desc.items', entry: 'desc.item' },
  {
    kind: 'condition',
    path: 'dex/conditions',
    title: 'title.conditions',
    list: 'desc.conditions',
    entry: 'desc.condition',
  },
] as const

const NAME_FILES = { pokemon: 'pokemon', move: 'moves', ability: 'abilities', item: 'items' } as const

/** A meta snapshot, as `src/data/generated/meta/index.json` lists it (`MetaSnapshot`, `src/data/meta.ts`). */
interface Snapshot {
  id: string
  regulation: string
  provider: { url: string }
  kind: string
  season?: string
  period: string
  from: string
  to: string
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const attr = (text: string) => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')

export function seoPages(): Plugin {
  let config: ResolvedConfig
  return {
    name: 'sproutvgc-seo-pages',
    apply: 'build',
    configResolved(resolved) {
      config = resolved
    },
    async closeBundle() {
      const root = config.root
      const outDir = join(root, config.build.outDir)
      const reg = String(config.env.VITE_REGULATION)
      const site = `${ORIGIN}${config.base}`
      const jiti = createJiti(import.meta.url, { alias: { '@': join(root, 'src') } })
      const load = <T>(file: string) => jiti.import(join(root, 'src', file)) as Promise<T>
      const en = await load<{
        messages: Record<string, string>
        types: Record<string, string>
        names: { condition: Record<string, string> }
      }>('i18n/en.ts')
      const dex = await load<Dex>('data/dex.ts')
      const { CONDITIONS } = await load<{ CONDITIONS: Record<string, { named?: 'move' }> }>('data/conditions.ts')
      const { TYPES } = await load<{ TYPES: readonly string[] }>('data/types.ts')
      const names = Object.fromEntries(
        await Promise.all(
          Object.entries(NAME_FILES).map(async ([kind, file]) => [
            kind,
            JSON.parse(await readFile(join(root, `src/data/generated/${file}.names.en.json`), 'utf8')),
          ]),
        ),
      ) as Record<Exclude<Kind, 'condition'>, Record<string, string>>

      // The Pokémon with a usage page: those in the dataset shown by default, the current regulation's latest of those
      // `VITE_META_SETS` picks (any regulation's, while the current one has none), as `latestSnapshots` picks it.
      const metaDir = join(root, 'src/data/generated/meta')
      const index = JSON.parse(await readFile(join(metaDir, 'index.json'), 'utf8')) as Record<string, Snapshot>
      const patterns = String(config.env.VITE_META_SETS ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
        .map((p) => new RegExp(`^${p.split('*').map(escape).join('.*')}$`))
      const shown = Object.values(index).filter((s) => patterns.some((re) => re.test(s.id)))
      const pool = shown.some((s) => s.regulation === reg) ? shown.filter((s) => s.regulation === reg) : shown
      const latest = pool.reduce<Snapshot | undefined>((a, s) => (!a || s.to > a.to ? s : a), undefined)
      const datasetKey = (s: Snapshot) =>
        [s.regulation, s.provider.url, s.kind, s.season ?? '', s.period, s.from, s.to].join('|')
      // And the abilities, items and moves with a meta page: those some set there runs.
      const inMeta = new Set<string>()
      const abilitiesRun = new Set<string>()
      const itemsHeld = new Set<string>()
      const movesRun = new Set<string>()
      for (const s of latest ? pool.filter((s) => datasetKey(s) === datasetKey(latest)) : []) {
        const data = JSON.parse(await readFile(join(metaDir, `${s.id}.json`), 'utf8')) as Record<
          string,
          {
            abilities?: { id: string; share?: number }[]
            items?: { id: string; share?: number }[]
            moves?: { id: string; share?: number }[]
          }
        >
        for (const [id, m] of Object.entries(data)) {
          inMeta.add(id)
          for (const a of m.abilities ?? []) if (a.share) abilitiesRun.add(a.id)
          for (const it of m.items ?? []) if (it.share) itemsHeld.add(it.id)
          for (const mv of m.moves ?? []) if (mv.share) movesRun.add(mv.id)
        }
      }
      const usageIds = dex.availableIds('pokemon').filter((id) => inMeta.has(id))
      const abilityIds = dex.availableIds('ability').filter((id) => abilitiesRun.has(id))
      const itemIds = dex.availableIds('item').filter((id) => itemsHeld.has(id))
      const moveIds = dex.availableIds('move').filter((id) => movesRun.has(id))

      const msg = (key: string, name = '') =>
        en.messages[key]!.replaceAll('{game}', GAME)
          .replaceAll('{reg}', reg)
          .replace(/\{(name|ability|type)\}/g, name)

      // A page with a title and keywords of its own for search, from its `title.`, `head.`, `desc.` and `keywords.`
      // messages.
      const searched = (path: string, name: string, schema: Page['schema'] = 'WebApplication'): Page => ({
        path,
        title: `title.${name}`,
        head: `head.${name}`,
        desc: `desc.${name}`,
        keywords: `keywords.${name}`,
        schema,
      })

      const pages: Page[] = [
        { path: '', desc: 'desc.home', keywords: 'keywords.home', schema: 'WebSite' },
        { path: 'dex', title: 'title.dex', desc: 'desc.dex', schema: 'CollectionPage' },
        { path: 'dex/types', title: 'title.types', desc: 'desc.types', schema: 'CollectionPage' },
        ...TYPES.map((type): Page => {
          const lead = en.types[type]!
          return { path: `dex/types/${type}`, title: 'title.types', desc: 'desc.type', lead, schema: 'WebPage' }
        }),
        searched('dex/types/chart', 'chart', 'WebPage'),
        ...CATEGORIES.flatMap(({ kind, path, title, list, entry }): Page[] => {
          const ids =
            kind === 'condition'
              ? Object.keys(CONDITIONS).filter((id) => dex.available({ kind, id }))
              : dex.availableIds(kind)
          const name = (id: string) =>
            kind === 'condition'
              ? CONDITIONS[id]!.named === 'move'
                ? names.move[id]!
                : en.names.condition[id]!
              : names[kind][id]!
          const pokedex = kind === 'pokemon' ? { head: 'head.pokedex', keywords: 'keywords.pokedex' } : {}
          return [
            { path, title, desc: list, ...pokedex, schema: 'CollectionPage' },
            ...ids.map((id): Page => ({
              path: `${path}/${id}`,
              title,
              desc: entry,
              lead: name(id),
              schema: 'WebPage',
            })),
          ]
        }),
        searched('meta/pokemon', 'pokemonRankings', 'WebPage'),
        ...usageIds.map((id): Page => ({
          path: `meta/pokemon/${id}`,
          title: 'title.metaPokemon',
          head: 'head.metaPokemon',
          desc: 'desc.metaPokemon',
          keywords: 'keywords.metaPokemon',
          lead: names.pokemon[id]!,
          schema: 'WebPage',
        })),
        searched('meta/items', 'itemRankings', 'WebPage'),
        searched('meta/moves', 'moveRankings', 'WebPage'),
        ...moveIds.map((id): Page => ({
          path: `meta/moves/${id}`,
          title: 'title.metaMove',
          head: 'head.metaMove',
          desc: 'desc.metaMove',
          keywords: 'keywords.metaMove',
          lead: names.move[id]!,
          schema: 'WebPage',
        })),
        ...itemIds.map((id): Page => ({
          path: `meta/items/${id}`,
          title: 'title.metaItem',
          head: 'head.metaItem',
          desc: 'desc.metaItem',
          keywords: 'keywords.metaItem',
          lead: names.item[id]!,
          schema: 'WebPage',
        })),
        searched('meta/abilities', 'abilityRankings', 'WebPage'),
        ...abilityIds.map((id): Page => ({
          path: `meta/abilities/${id}`,
          title: 'title.metaAbility',
          head: 'head.metaAbility',
          desc: 'desc.metaAbility',
          keywords: 'keywords.metaAbility',
          lead: names.ability[id]!,
          schema: 'WebPage',
        })),
        searched('meta/speed-tiers', 'speedTiers'),
        searched('meta/speed-tiers/compare', 'speedCompare'),
        { path: 'tools', title: 'title.tools', desc: 'desc.tools', schema: 'CollectionPage' },
        searched('tools/matchups', 'matchups'),
        { path: 'quizzes', title: 'title.quizzes', desc: 'desc.quizzes', schema: 'CollectionPage' },
        searched('quizzes/types', 'quiz'),
        searched('quizzes/speed', 'speedQuiz'),
        { path: 'credits', title: 'title.credits', desc: 'desc.credits', schema: 'WebPage' },
      ]

      // GitHub Pages redirects a path to its folder, so that's the address each is at.
      const url = (path: string) => `${site}${path ? `${path}/` : ''}`
      const byPath = new Map(pages.map((page) => [page.path, page]))
      const shortName = (page: Page) => page.lead ?? (page.title ? msg(page.title) : 'sproutvgc')

      const html = await readFile(join(outDir, 'index.html'), 'utf8')
      await writeFile(join(outDir, '404.html'), html)
      for (const page of pages) {
        const name = page.head ?? page.title
        const title = name
          ? `${page.lead ? `${page.lead} · ` : ''}${msg(name)} · ${GAME} · sproutvgc`
          : `sproutvgc · ${GAME} dex`
        const desc = msg(page.desc, page.lead)
        // The way down to it: each of its path's prefixes that's a page, from the home page.
        const segments = page.path ? page.path.split('/') : []
        const crumbs = ['', ...segments.map((_, i) => segments.slice(0, i + 1).join('/'))].flatMap((path) => {
          const at = byPath.get(path)
          return at ? [at] : []
        })
        const data = [
          {
            '@context': 'https://schema.org',
            '@type': page.schema,
            name: page.path ? `${shortName(page)} · sproutvgc` : 'sproutvgc',
            ...(page.head && { alternateName: msg(page.head) }),
            description: desc,
            url: url(page.path),
            inLanguage: ['en', 'es'],
            ...(page.schema === 'WebApplication' && {
              applicationCategory: 'GameApplication',
              operatingSystem: 'Any',
              isAccessibleForFree: true,
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            }),
            ...(page.path && { isPartOf: { '@type': 'WebSite', name: 'sproutvgc', url: site } }),
          },
          ...(crumbs.length > 1
            ? [
                {
                  '@context': 'https://schema.org',
                  '@type': 'BreadcrumbList',
                  itemListElement: crumbs.map((crumb, i) => ({
                    '@type': 'ListItem',
                    position: i + 1,
                    name: shortName(crumb),
                    item: url(crumb.path),
                  })),
                },
              ]
            : []),
        ]
        const head = [
          ...(page.keywords ? [`<meta name="keywords" content="${attr(msg(page.keywords, page.lead))}" />`] : []),
          `<link rel="canonical" href="${url(page.path)}" />`,
          `<meta property="og:url" content="${url(page.path)}" />`,
          `<script type="application/ld+json">${JSON.stringify(data).replaceAll('<', '\\u003c')}</script>`,
        ].join('\n    ')
        const out = html
          .replace(/<title>.*?<\/title>/s, `<title>${attr(title)}</title>`)
          .replace(/(<meta\s+name="description"\s+content=")[^"]*/, `$1${attr(desc)}`)
          .replace(/(<meta\s+property="og:title"\s+content=")[^"]*/, `$1${attr(title)}`)
          .replace(/(<meta\s+property="og:description"\s+content=")[^"]*/, `$1${attr(desc)}`)
          .replace('</head>', `  ${head}\n  </head>`)
        await mkdir(join(outDir, page.path), { recursive: true })
        await writeFile(join(outDir, page.path, 'index.html'), out)
      }

      const sitemap = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...pages.map((page) => `  <url><loc>${url(page.path)}</loc></url>`),
        '</urlset>',
        '',
      ].join('\n')
      await writeFile(join(outDir, 'sitemap.xml'), sitemap)
    },
  }
}
