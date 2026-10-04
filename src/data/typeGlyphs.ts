// Type glyphs for the type badges, keyed by type. White-on-transparent 64×64 PNGs from the
// Bulbagarden Archives (`<Type>_icon.png`, as used on Bulbapedia's Type page), bundled because the archive blocks
// cross-site image requests. The badges use them as CSS masks so each glyph takes the badge's text color.
import type { TypeId } from '@/data/types'

function load(): Record<TypeId, string> {
  const files = import.meta.glob<string>('../assets/type-icons/*.png', { eager: true, import: 'default' })
  // Keyed by file name: '../assets/type-icons/fire.png' → 'fire'.
  return Object.fromEntries(
    Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -'.png'.length), url]),
  ) as Record<TypeId, string>
}

export const TYPE_GLYPHS = load()
