// Our English condition descriptions, written for mondex (Showdown has no text for conditions: it explains them on
// the moves that cause them), with markers for references to other dex entries, as in `abilities.ts`. Numbers are
// Champions' where it changes them (paralysis, sleep, freeze: its mod's `conditions.ts`). No imports.

export interface Description {
  short: string
  /** Only when there's more to say than `short`. */
  long?: string
}

/** By condition ID. */
export const descriptions: Record<string, Description> = {
  brn: {
    short: 'Loses 1/16 of its max HP each turn; its physical attacks deal half damage.',
    long: "A burned Pokémon loses 1/16 of its maximum HP at the end of each turn, and its physical attacks deal half damage (not {move:facade}'s, nor those of a Pokémon with {ability:guts}). {type:fire} types can't be burned, nor can Pokémon with {ability:thermalexchange} or {ability:waterbubble}. {item:rawstberry} and {item:lumberry} cure it.",
  },
  par: {
    short: "Speed halved; a 1-in-8 chance each turn that it can't move.",
    long: "A paralyzed Pokémon has its Speed halved (unless it has {ability:quickfeet}), and each time it tries to move it has a 1-in-8 chance of being unable to: half the main games' 1 in 4. {type:electric} types can't be paralyzed, nor can Pokémon with {ability:limber}. {item:cheriberry} and {item:lumberry} cure it.",
  },
  psn: {
    short: 'Loses 1/8 of its max HP each turn.',
    long: "A poisoned Pokémon loses 1/8 of its maximum HP at the end of each turn; with {ability:poisonheal} it heals that much instead. {type:poison} and {type:steel} types can't be poisoned, except by a Pokémon with {ability:corrosion}, nor can Pokémon with {ability:immunity}. {item:pechaberry} and {item:lumberry} cure it.",
  },
  tox: {
    short: 'Loses 1/16 of its max HP after its first turn, 2/16 after the next, and so on.',
    long: "A badly poisoned Pokémon loses 1/16 of its maximum HP at the end of its first turn, 2/16 at the end of the next, and 1/16 more each turn after that. Switching out resets the count, but not the poison. It's poison all the same: the same types and Abilities are immune, and the same items cure it. {move:toxic}, {move:poisonfang} and a second layer of {condition:toxicspikes} cause it.",
  },
  slp: {
    short: "Can't move for 1 or 2 turns, then wakes up.",
    long: "A sleeping Pokémon can't move. In Champions it misses 1 turn (a 1-in-3 chance) or 2 (2 in 3), and wakes up as it tries to move after that: shorter than the main games' 1 to 3. {move:sleeptalk} and {move:snore} can be used while asleep, and {ability:earlybird} halves the time. {ability:insomnia} and {ability:vitalspirit} prevent it, and so do {condition:electricterrain} and {condition:mistyterrain} for grounded Pokémon. {item:chestoberry} and {item:lumberry} cure it.",
  },
  frz: {
    short: "Can't move; thaws with a 1-in-4 chance each turn, and by its third turn at the latest.",
    long: "A frozen Pokémon can't move. Each time it tries, it has a 1-in-4 chance of thawing out and moving, and in Champions it always thaws on its third try: it's never frozen for more than 2 turns. Moves that thaw the user ({move:flareblitz}, {move:pyroball}, {move:scald}, {move:scorchingsands}, {move:matchagotcha}) thaw it and are used as normal, and a {type:fire}-type move that hits it, or {move:scald}, thaws it too. {type:ice} types can't be frozen, nor can Pokémon with {ability:magmaarmor}, nor any Pokémon in {condition:sun}. {item:aspearberry} and {item:lumberry} cure it.",
  },
  confusion: {
    short: 'For 2 to 5 turns, a 1-in-3 chance each turn of hitting itself instead of moving.',
    long: 'A confused Pokémon has a 1-in-3 chance, each time it tries to move, of hurting itself instead, with a typeless physical attack of 40 power. It lasts 2 to 5 turns, or until it switches out. {ability:owntempo} prevents it, and so do {move:safeguard} and, for grounded Pokémon, {condition:mistyterrain}. {item:persimberry} and {item:lumberry} cure it.',
  },
  flinch: {
    short: "Can't move this turn: hit by a flinching move before it moved.",
    long: "A Pokémon that flinches can't move this turn. Only a move that hits it before it moves can make it flinch, so it's the faster Pokémon's tool: {move:fakeout} on the first turn, or moves like {move:rockslide} and {move:icywind}... and {item:kingsrock} gives any attack the chance. {ability:innerfocus} prevents it; {ability:steadfast} raises Speed by 1 when it happens.",
  },
  attract: {
    short: "Infatuated: a 1-in-2 chance each turn that it can't move.",
    long: 'An infatuated Pokémon has a 1-in-2 chance, each time it tries to move, of being unable to. Only a Pokémon of the opposite gender can cause it, with {move:attract} or {ability:cutecharm}, and it ends when either leaves the field. {ability:oblivious} prevents it, and {ability:aromaveil} protects the user and its allies. {item:mentalherb} cures it.',
  },
  partiallytrapped: {
    short: "Can't switch out, and loses 1/8 of its max HP each turn, for 4 or 5 turns.",
    long: "A Pokémon caught by a binding move ({move:bind}, {move:firespin}, {move:whirlpool}, {move:sandtomb}, {move:infestation}, {move:snaptrap}) can't switch out and loses 1/8 of its maximum HP (1/6 if the user holds {item:bindingband}) at the end of each turn, for 4 or 5 turns, or until the user leaves the field. {type:ghost} types can still switch out, as can a Pokémon holding {item:shedshell} or using a move that switches it out ({move:uturn}, {move:voltswitch}, {move:flipturn}, {move:partingshot}, {move:batonpass}). {move:rapidspin} and {move:mortalspin} free the user.",
  },
  trapped: {
    short: "Can't switch out while the Pokémon that trapped it is on the field.",
    long: "A Pokémon trapped by {move:meanlook}, {move:block}, {move:spiritshackle} or {move:jawlock} (which traps both) can't switch out while the Pokémon that trapped it is on the field. {ability:shadowtag} traps opposing Pokémon the same way. {type:ghost} types can't be trapped, and a Pokémon holding {item:shedshell} or using a move that switches it out ({move:uturn}, {move:voltswitch}, {move:flipturn}, {move:partingshot}, {move:batonpass}) still gets out.",
  },
  healblock: {
    short: "For 2 turns, it can't restore HP.",
    long: "For 2 turns after {move:psychicnoise} hits it, a Pokémon can't restore HP: healing and draining moves can't be used, and Abilities, items and field effects that would heal it don't. {ability:regenerator} still works when it switches out.",
  },
  lockedmove: {
    short: 'Repeats its move for 2 or 3 turns, then is confused.',
    long: "After {move:outrage}, {move:petaldance}, {move:thrash} or {move:ragingfury}, a Pokémon is locked into the move for 2 or 3 turns, hitting a random foe each turn, and becomes confused at the end. It ends early, without the confusion, if the move fails or the Pokémon can't move.",
  },
  mustrecharge: {
    short: "Can't move the turn after using a recharge move.",
    long: "After a move like {move:hyperbeam}, {move:gigaimpact} or {move:meteorassault} hits, the user must recharge: it can't do anything on its next turn. In doubles its ally keeps acting, so that turn is still the partner's.",
  },
  taunt: {
    short: "Can't use status moves for 3 turns.",
    long: "A taunted Pokémon can't use non-damaging moves for its next 3 turns: no {move:protect}, setup, {move:trickroom} or {move:tailwind}. {ability:oblivious} prevents it, and {ability:aromaveil} protects the user and its allies. {item:mentalherb} cures it.",
  },
  encore: {
    short: 'Must repeat its last move for 3 turns.',
    long: "An encored Pokémon must repeat the last move it used for its next 3 turns (or until the move runs out of PP). If it hasn't moved yet this turn, its action changes to that move at once. {ability:aromaveil} protects the user and its allies; {item:mentalherb} cures it.",
  },
  disable: {
    short: "Its last move can't be used for 4 turns.",
    long: "A disabled Pokémon can't use the last move it used for 4 turns. {move:disable} causes it, and so does {ability:cursedbody}: a 3-in-10 chance when the Pokémon is hit by a move, disabling that move. {ability:aromaveil} protects the user and its allies; {item:mentalherb} cures it.",
  },
  torment: {
    short: "Can't use the same move twice in a row.",
    long: "A tormented Pokémon can't use the same move two turns in a row, until it switches out. {ability:aromaveil} protects the user and its allies; {item:mentalherb} cures it.",
  },
  leechseed: {
    short: 'Loses 1/8 of its max HP each turn, which heals the Pokémon in the seeder’s slot.',
    long: "A seeded Pokémon loses 1/8 of its maximum HP at the end of each turn, and whichever Pokémon is in the seeder's position on the field restores that much (1.3× with {item:bigroot}). It lasts until the seeded Pokémon switches out, or uses {move:rapidspin} or {move:mortalspin}. {type:grass} types can't be seeded.",
  },
  yawn: {
    short: 'Falls asleep at the end of the next turn.',
    long: "A drowsy Pokémon falls asleep at the end of the next turn, unless it has switched out, has another status, or can't fall asleep then ({ability:insomnia}, {ability:vitalspirit}, {condition:electricterrain} or {condition:mistyterrain} for grounded Pokémon). It forces a switch or a sleep, a useful threat in doubles.",
  },
  substitute: {
    short: 'A decoy made of 1/4 of its max HP takes hits and blocks status in its place.',
    long: 'The user puts 1/4 of its maximum HP into a substitute, which takes the damage of attacks aimed at it until it breaks and blocks most status moves and stat drops from other Pokémon. Sound moves and Pokémon with {ability:infiltrator} go through it. {move:shedtail} makes one for the Pokémon switching in. It lasts until it breaks or the user switches out.',
  },
  protect: {
    short: 'Protected from most moves this turn; using it again in a row can fail.',
    long: "A Pokémon that uses {move:protect} or {move:detect} is protected from most moves this turn, its allies' included. Each consecutive use has a 1-in-3 chance of working, then 1 in 9, and so on; other protection moves ({move:kingsshield}, {move:spikyshield}, {move:banefulbunker}, {move:endure}, {move:wideguard}, {move:quickguard}) share the count. {move:feint} and {move:phantomforce} break it. In Champions, {ability:unseenfist} lets contact moves through, but they deal only a quarter of their damage.",
  },
  followme: {
    short: "This turn, the foes' single-target moves go to this Pokémon.",
    long: "For the rest of the turn, the opposing side's single-target moves are redirected to the Pokémon that used {move:followme}, protecting its ally. It has +2 priority. Moves that can't be redirected ({move:snipeshot}, and any move from a Pokémon with {ability:stalwart}) ignore it.",
  },
  ragepowder: {
    short: 'Like Follow Me, but Grass types and Overcoat ignore it.',
    long: "For the rest of the turn, the opposing side's single-target moves are redirected to the Pokémon that used {move:ragepowder}, as with {move:followme}. As a powder move, it doesn't affect {type:grass} types or Pokémon with {ability:overcoat}, whose moves go where they were aimed. {move:snipeshot} and {ability:stalwart} ignore it too.",
  },
  helpinghand: {
    short: "Its ally's move has 1.5× power this turn.",
    long: "With +5 priority, the user helps its ally: the ally's move this turn has 1.5× power. Several uses on the same Pokémon stack.",
  },
  charge: {
    short: 'Its next {type:electric}-type move has 2× power.',
    long: "The Pokémon's next {type:electric}-type attack has its power doubled. {move:charge} also raises Special Defense by 1; {ability:electromorphosis} charges the Pokémon when it's hit.",
  },
  tailwind: {
    short: "For 4 turns, its side's Speed is doubled.",
    long: "For 4 turns, counting the turn it's used, the Speed of every Pokémon on the user's side is doubled. The basic speed control of doubles, along with {condition:trickroom}.",
  },
  reflect: {
    short: 'For 5 turns, physical damage to its side is reduced.',
    long: "For 5 turns (8 with {item:lightclay}), Pokémon on the user's side take less damage from physical attacks: 0.5× in singles, 0.66× in doubles. Critical hits and Pokémon with {ability:infiltrator} ignore it, and {move:brickbreak}, {move:psychicfangs}, {move:ragingbull} and {move:defog} remove it. {ability:screencleaner} removes all screens on switch-in.",
  },
  lightscreen: {
    short: 'For 5 turns, special damage to its side is reduced.',
    long: "For 5 turns (8 with {item:lightclay}), Pokémon on the user's side take less damage from special attacks: 0.5× in singles, 0.66× in doubles. Critical hits and Pokémon with {ability:infiltrator} ignore it, and {move:brickbreak}, {move:psychicfangs}, {move:ragingbull} and {move:defog} remove it. {ability:screencleaner} removes all screens on switch-in.",
  },
  auroraveil: {
    short: 'For 5 turns, all damage to its side is reduced. Needs snow.',
    long: "For 5 turns (8 with {item:lightclay}), Pokémon on the user's side take less damage from physical and special attacks: 0.5× in singles, 0.66× in doubles; it doesn't stack with {condition:reflect} or {condition:lightscreen}. It can only be set up in {condition:snow}. Critical hits and Pokémon with {ability:infiltrator} ignore it, and the moves that remove screens remove it too.",
  },
  safeguard: {
    short: "For 5 turns, its side can't be given a status or confused.",
    long: "For 5 turns, Pokémon on the user's side can't be given a status condition or {condition:confusion} by other Pokémon. Pokémon with {ability:infiltrator} ignore it, and {move:defog} removes it.",
  },
  wideguard: {
    short: 'This turn, its side is protected from moves that hit more than one Pokémon.',
    long: "For the rest of the turn, Pokémon on the user's side are protected from moves that hit more than one Pokémon, like {move:earthquake}, {move:rockslide} or {move:heatwave}, allies' included. It has +3 priority and shares {condition:protect}'s count of consecutive uses, but doesn't fail on its own.",
  },
  quickguard: {
    short: 'This turn, its side is protected from priority moves.',
    long: "For the rest of the turn, Pokémon on the user's side are protected from moves with raised priority, like {move:fakeout}, {move:extremespeed} or status moves boosted by {ability:prankster}. It has +3 priority and shares {condition:protect}'s count of consecutive uses, but doesn't fail on its own.",
  },
  spikes: {
    short: 'Grounded foes switching in lose 1/8 of their max HP (up to 1/4 with 3 layers).',
    long: "Up to 3 layers on the opposing side: each grounded Pokémon switching in loses 1/8 of its maximum HP with one layer, 1/6 with two and 1/4 with three. {type:flying} types and Pokémon with {ability:levitate} or an {item:airballoon} aren't grounded. {move:rapidspin}, {move:mortalspin}, {move:defog} and {move:tidyup} remove it.",
  },
  toxicspikes: {
    short: 'Grounded foes switching in are poisoned (badly with 2 layers).',
    long: 'Up to 2 layers on the opposing side: each grounded Pokémon switching in is poisoned with one layer, badly poisoned with two. A grounded {type:poison} type switching in absorbs them. {move:rapidspin}, {move:mortalspin}, {move:defog} and {move:tidyup} remove them, and {ability:toxicdebris} lays them when its holder is hit by a physical move.',
  },
  stickyweb: {
    short: 'Grounded foes switching in have their Speed lowered by 1.',
    long: 'On the opposing side: each grounded Pokémon switching in has its Speed lowered by 1 stage. {move:rapidspin}, {move:mortalspin}, {move:defog} and {move:tidyup} remove it.',
  },
  stealthrock: {
    short: 'Foes switching in lose HP by their weakness to {type:rock}: 1/8 at neutral.',
    long: "On the opposing side: each Pokémon switching in loses 1/8 of its maximum HP times its weakness to {type:rock}: 1/32 for 0.25×, 1/16 for 0.5×, 1/8 for neutral, 1/4 for 2× and 1/2 for 4×. Flying doesn't avoid it. {move:rapidspin}, {move:mortalspin}, {move:defog} and {move:tidyup} remove it.",
  },
  trickroom: {
    short: 'For 5 turns, slower Pokémon move first.',
    long: "For 5 turns, counting the turn it's used, slower Pokémon move before faster ones within each priority bracket; priority still comes first. Using {move:trickroom} again ends it. Champions has no speed underflow: the slowest Pokémon always moves first.",
  },
  gravity: {
    short: 'For 5 turns, everything is grounded and moves are more accurate.',
    long: "For 5 turns, every Pokémon is grounded: {type:ground}-type moves and the hazards hit {type:flying} types and Pokémon with {ability:levitate}, an {item:airballoon} or {move:magnetrise}. Accuracy is 5/3×, and moves that leave the ground ({move:fly}, {move:bounce}, {move:highjumpkick}, {move:flyingpress}, {move:magnetrise}) can't be used.",
  },
  magicroom: {
    short: 'For 5 turns, held items have no effect.',
    long: "For 5 turns, no held item has an effect, Mega Stones aside, and {move:fling} can't be used. Using {move:magicroom} again ends it.",
  },
  wonderroom: {
    short: 'For 5 turns, every Pokémon swaps its Defense and Special Defense.',
    long: 'For 5 turns, every Pokémon has its Defense and Special Defense stats swapped (stat changes stay where they are). Using {move:wonderroom} again ends it.',
  },
  sun: {
    short: '{type:fire} moves 1.5×, {type:water} moves 0.5×, no freezing.',
    long: 'For 5 turns (8 with {item:heatrock}), {type:fire}-type moves deal 1.5× damage and {type:water}-type moves 0.5×, and nothing can be frozen. {move:solarbeam} and {move:solarblade} need no charging turn; {move:thunder} and {move:hurricane} drop to 50% accuracy; {move:synthesis}, {move:morningsun} and {move:moonlight} heal 2/3. {ability:chlorophyll} doubles Speed and {ability:solarpower} boosts Special Attack. Set by {move:sunnyday} and {ability:drought}.',
  },
  rain: {
    short: '{type:water} moves 1.5×, {type:fire} moves 0.5×.',
    long: 'For 5 turns (8 with {item:damprock}), {type:water}-type moves deal 1.5× damage and {type:fire}-type moves 0.5×. {move:thunder} and {move:hurricane} never miss, {move:electroshot} needs no charging turn, and {move:solarbeam} and {move:solarblade} have half power. {ability:swiftswim} doubles Speed; {ability:raindish}, {ability:dryskin} and {ability:hydration} heal or cure. Set by {move:raindance} and {ability:drizzle}.',
  },
  sandstorm: {
    short: 'Hurts all but {type:rock}, {type:ground} and {type:steel} types; {type:rock} types get 1.5× Sp. Def.',
    long: 'For 5 turns (8 with {item:smoothrock}), every Pokémon loses 1/16 of its maximum HP at the end of each turn, except {type:rock}, {type:ground} and {type:steel} types and Pokémon with {ability:sandforce}, {ability:sandrush}, {ability:sandveil}, {ability:overcoat} or {ability:magicguard}. {type:rock} types have 1.5× Special Defense. {ability:sandrush} doubles Speed and {ability:sandforce} boosts {type:rock}, {type:ground} and {type:steel} moves. Set by {move:sandstorm}, {ability:sandstream} and {ability:sandspit}.',
  },
  snow: {
    short: '{type:ice} types get 1.5× Defense; {move:blizzard} never misses.',
    long: 'For 5 turns (8 with {item:icyrock}), {type:ice} types have 1.5× Defense, {move:blizzard} never misses and {move:auroraveil} can be set up. {ability:slushrush} doubles Speed, and {ability:icebody} heals. It deals no damage. Set by {move:snowscape}, {move:chillyreception} and {ability:snowwarning}.',
  },
  electricterrain: {
    short: "5 turns. Grounded Pokémon: {type:electric} moves 1.3×, can't fall asleep.",
    long: "For 5 turns (8 with {item:terrainextender}), grounded Pokémon's {type:electric}-type moves have 1.3× power, and grounded Pokémon can't fall asleep. {move:risingvoltage} doubles its power against grounded targets, and {item:electricseed} raises its holder's Defense. Set by {move:electricterrain} and {ability:electricsurge}.",
  },
  grassyterrain: {
    short: '5 turns. Grounded Pokémon: {type:grass} moves 1.3×, heal 1/16 each turn.',
    long: "For 5 turns (8 with {item:terrainextender}), grounded Pokémon's {type:grass}-type moves have 1.3× power, and grounded Pokémon restore 1/16 of their maximum HP at the end of each turn. {move:earthquake} and {move:bulldoze} deal half damage to grounded targets, {move:grassyglide} gets +1 priority, and {item:grassyseed} raises its holder's Defense. Set by {move:grassyterrain}, {ability:grassysurge} and {ability:seedsower}.",
  },
  psychicterrain: {
    short: '5 turns. Grounded Pokémon: {type:psychic} moves 1.3×, safe from priority moves.',
    long: "For 5 turns (8 with {item:terrainextender}), grounded Pokémon's {type:psychic}-type moves have 1.3× power, and grounded Pokémon can't be hit by the opposing side's moves with raised priority, {move:fakeout} and {ability:prankster} moves included. {move:expandingforce} hits both foes with 1.5× power, and {item:psychicseed} raises its holder's Special Defense. Set by {move:psychicterrain} and {ability:psychicsurge}.",
  },
  mistyterrain: {
    short: '5 turns. Grounded Pokémon: no status or confusion; {type:dragon} moves at them 0.5×.',
    long: "For 5 turns (8 with {item:terrainextender}), grounded Pokémon can't be given a status condition or {condition:confusion}, and {type:dragon}-type moves against them deal half damage. {move:mistyexplosion} has 1.5× power, and {item:mistyseed} raises its holder's Special Defense. Set by {move:mistyterrain}.",
  },
}
