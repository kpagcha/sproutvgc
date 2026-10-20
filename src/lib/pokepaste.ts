// A tournament team as a paste, in the format Showdown imports and pokepast.es shows (pokepast.es/syntax.html): each
// Pokémon its species and item, its ability, its nature and its moves, a blank line between them. Tournament team lists
// have no stat points, so no EVs line; nor a level, Champions having none to set. Its species as Showdown writes it
// ("Basculegion-F", a forme after a hyphen), a Mega as the Pokémon it changes from (it holds the stone); everything by
// its name in the site's language, English, the only one for now: Showdown reads English names alone, so a paste
// should stay in English once there are others.

import { ability, item, move, pokemon } from '@/data/dex'
import { natureName } from '@/data/natures'
import { POKEMON, splitForme } from '@/data/pokemon'
import { listed, type Slot } from '@/data/tournaments'
import { refName } from '@/i18n/refName'

/** A Pokémon's name as Showdown writes it: a battle-only forme (a Mega) as the one it changes from, a forme after its
 * species' name and a hyphen. The species from the forme's own name, "Floette (Eternal)": the dex names only what the
 * regulation has, which needn't be the species itself. */
function species(id: Slot[0]): string {
  const p = POKEMON[id]
  if (p?.battleOnly) return species(p.battleOnly)
  const { species: name, forme } = splitForme(id, refName(pokemon(id)))
  return forme ? `${name}-${forme}` : name
}

/** One Pokémon as a paste's block: its name alone without a team list. */
function slotPaste(slot: Slot): string {
  const [id, it, ab, nature, moves] = slot
  if (!listed(slot)) return species(id)
  return [
    it ? `${species(id)} @ ${refName(item(it))}` : species(id),
    ...(ab ? [`Ability: ${refName(ability(ab))}`] : []),
    ...(nature ? [`${natureName(nature)} Nature`] : []),
    ...moves.map((m) => `- ${refName(move(m))}`),
  ].join('\n')
}

/** A team as a paste. */
export const teamPaste = (team: readonly Slot[]) => team.map(slotPaste).join('\n\n') + '\n'
