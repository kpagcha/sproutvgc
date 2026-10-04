// Our English moves descriptions, written from Showdown's (in `src/data/generated/moves.json`), with markers for references to
// other dex entries, as in `abilities.ts`. No imports: `scripts/gen-data.ts` reads this file too.

export interface Description {
  short: string
  /** Only when there's more to say than `short`. */
  long?: string
  /** The Showdown text this was written from (`hashText` in `scripts/gen-data.ts`). */
  source: string
}

/** By ID. */
export const descriptions: Record<string, Description> = {
  accelerock: {
    short: 'Usually goes first.',
    source: 'a92f0fe3',
  },
  acidarmor: {
    short: "Raises the user's Defense by 2.",
    long: "Raises the user's Defense by 2 stages.",
    source: '9af9e562',
  },
  acidspray: {
    short: "100% chance to lower the target's Sp. Def by 2.",
    long: "Has a 100% chance to lower the target's Special Defense by 2 stages.",
    source: '9b749800',
  },
  acrobatics: {
    short: 'Power doubles if the user has no held item.',
    source: 'c6c2a153',
  },
  acupressure: {
    short: 'Raises a random stat of the user or an ally by 2.',
    long: 'Raises a random stat by 2 stages as long as the stat is not already at stage 6. The user can choose to use this move on itself or an adjacent ally. Fails if no stat stage can be raised or if used on an ally with a substitute.',
    source: '01a6cc1a',
  },
  aerialace: {
    short: 'This move does not check accuracy.',
    source: '9ffadd27',
  },
  afteryou: {
    short: 'The target makes its move right after the user.',
    long: 'The target makes its move immediately after the user this turn, no matter the priority of its selected move. Fails if the target would have moved next anyway, or if the target already moved this turn.',
    source: '5912acfb',
  },
  agility: {
    short: "Raises the user's Speed by 2.",
    long: "Raises the user's Speed by 2 stages.",
    source: '7cd16dc0',
  },
  aircutter: {
    short: 'High critical hit ratio. Hits adjacent foes.',
    long: 'Has a higher chance for a critical hit.',
    source: 'f47e3ef8',
  },
  airslash: {
    short: '30% chance to make the target flinch.',
    long: 'Has a 30% chance to make the target flinch.',
    source: 'a0cdf44a',
  },
  alluringvoice: {
    short: '100% confuse target that had a stat rise this turn.',
    long: 'Has a 100% chance to confuse the target if it had a stat stage raised this turn.',
    source: 'b9c9d25e',
  },
  allyswitch: {
    short: 'User and ally swap positions; using again can fail.',
    long: "The user swaps positions with its ally. Fails if the user is the only Pokémon on its side. This move has a 1/X chance of being successful, where X starts at 1 and triples each time this move is successfully used. X resets to 1 if this move fails or if the user's last move used is not Ally Switch.",
    source: 'cff56209',
  },
  amnesia: {
    short: "Raises the user's Sp. Def by 2.",
    long: "Raises the user's Special Defense by 2 stages.",
    source: 'a19434ad',
  },
  ancientpower: {
    short: '10% chance to raise all stats by 1 (not acc/eva).',
    long: "Has a 10% chance to raise the user's Attack, Defense, Special Attack, Special Defense, and Speed by 1 stage.",
    source: 'be41c8ff',
  },
  appleacid: {
    short: "100% chance to lower the target's Sp. Def by 1.",
    long: "Has a 100% chance to lower the target's Special Defense by 1 stage.",
    source: '65677565',
  },
  aquacutter: {
    short: 'High critical hit ratio.',
    long: 'Has a higher chance for a critical hit.',
    source: 'f11e0024',
  },
  aquajet: {
    short: 'Usually goes first.',
    source: 'a92f0fe3',
  },
  aquaring: {
    short: 'User recovers 1/16 max HP per turn.',
    long: 'The user has 1/16 of its maximum HP, rounded down, restored at the end of each turn while it remains active. If {item:bigroot} is held by the user, the HP recovered is 1.3× normal, rounded half down. If the user uses {move:batonpass}, the replacement will receive the healing effect.',
    source: 'c5f8e833',
  },
  aquastep: {
    short: "100% chance to raise the user's Speed by 1.",
    long: "Has a 100% chance to raise the user's Speed by 1 stage.",
    source: 'b5915159',
  },
  aquatail: {
    short: 'No additional effect.',
    source: 'db89be13',
  },
  armorcannon: {
    short: "Lowers the user's Defense and Sp. Def by 1.",
    long: "Lowers the user's Defense and Special Defense by 1 stage.",
    source: 'b3e45c3d',
  },
  aromaticmist: {
    short: "Raises an ally's Sp. Def by 1.",
    long: "Raises the target's Special Defense by 1 stage. Fails if there is no ally adjacent to the user.",
    source: '616ecfb9',
  },
  assurance: {
    short: 'Power doubles if target was damaged this turn.',
    long: 'Power doubles if the target has already taken damage this turn, other than direct damage from {move:bellydrum}, confusion, {move:curse}, or {move:painsplit}.',
    source: '7da9bbb4',
  },
  attract: {
    short: 'A target of the opposite gender gets infatuated.',
    long: 'Causes the target to become infatuated, making it unable to attack 50% of the time. Fails if both the user and the target are the same gender, if either is genderless, or if the target is already infatuated. The effect ends when either the user or the target is no longer active. Pokémon with the {ability:oblivious} Ability or protected by the {ability:aromaveil} Ability are immune.',
    source: '0ecc2fe5',
  },
  aurasphere: {
    short: 'This move does not check accuracy.',
    source: '9ffadd27',
  },
  aurawheel: {
    short: '{pokemon:morpeko}: {type:electric}; Hangry: {type:dark}; 100% +1 Spe.',
    long: "Has a 100% chance to raise the user's Speed by 1 stage. If the user is a {pokemon:morpeko} in Full Belly Mode, this move is {type:electric} type. If the user is a {pokemon:morpeko} in Hangry Mode, this move is {type:dark} type. This move cannot be used successfully unless the user's current form, while considering {move:transform}, is Full Belly or Hangry Mode {pokemon:morpeko}.",
    source: '4e3e591b',
  },
  auroraveil: {
    short: 'For 5 turns, damage to allies halved. {condition:snow} only.',
    long: "For 5 turns, the user and its party members take 0.5× damage from physical and special attacks, or 0.66× damage if in a Double Battle; does not reduce damage further with {move:reflect} or {move:lightscreen}. Critical hits ignore this protection. It is removed from the user's side if the user or an ally is successfully hit by {move:brickbreak}, {move:psychicfangs}, or {move:defog}. {move:brickbreak} and {move:psychicfangs} remove the effect before damage is calculated. Lasts for 8 turns if the user is holding {item:lightclay}. Fails unless the weather is {condition:snow}.",
    source: 'ef99595e',
  },
  avalanche: {
    short: 'Power doubles if user is damaged by the target.',
    long: 'Power doubles if the user was hit by the target this turn.',
    source: 'da4ded89',
  },
  axekick: {
    short: '30% confusion. User loses 50% max HP if miss.',
    long: 'Has a 30% chance to confuse the target. If this attack is not successful, the user loses half of its maximum HP, rounded down, as crash damage. Pokémon with the {ability:magicguard} Ability are unaffected by crash damage.',
    source: 'f11f6249',
  },
  babydolleyes: {
    short: "Lowers the target's Attack by 1.",
    long: "Lowers the target's Attack by 1 stage.",
    source: '1fe03679',
  },
  banefulbunker: {
    short: 'Protects from moves. Contact: poison.',
    long: "The user is protected from most attacks made by other Pokémon during this turn, and Pokémon making contact with the user become poisoned. This move has a 1/X chance of being successful, where X starts at 1 and triples each time this move is successfully used. X resets to 1 if this move fails, if the user's last move used is not Baneful Bunker, {move:detect}, {move:endure}, {move:kingsshield}, {move:protect}, {move:quickguard}, {move:spikyshield}, or {move:wideguard}, or if it was one of those moves and the user's protection was broken. Fails if the user moves last this turn.",
    source: '217345da',
  },
  barbbarrage: {
    short: '50% psn. 2× power if target already poisoned.',
    long: 'Has a 50% chance to poison the target. Power doubles if the target is already poisoned.',
    source: 'cd2675a6',
  },
  batonpass: {
    short: 'User switches, passing stat changes and more.',
    long: "The user is replaced with another Pokémon in its party. The selected Pokémon has the user's stat stage changes transferred to it, as well as the effects of confusion, {move:aquaring}, {move:curse}, {move:dragoncheer}, Embargo, {move:focusenergy}, {move:gastroacid}, Heal Block, {move:ingrain}, {move:leechseed}, {move:lockon} (Mind Reader), {move:magnetrise}, {move:perishsong}, {move:powertrick}, Telekinesis, and a substitute with its remaining HP. The effect of {move:gastroacid} is not transferred if the recipient has an Ability that cannot be affected.",
    source: '1d3c5e56',
  },
  beakblast: {
    short: 'Burns on contact with the user before it moves.',
    long: 'If the user is hit by a contact move this turn before it can execute this move, the attacker is burned.',
    source: '664a5b4d',
  },
  beatup: {
    short: 'All healthy allies aid in damaging the target.',
    long: "Hits one time for the user and one time for each unfainted Pokémon without a non-volatile status condition in the user's party. The power of each hit is equal to 5+(X/10), where X is each participating Pokémon's base Attack; each hit is considered to come from the user.",
    source: 'ac4e8bc8',
  },
  belch: {
    short: 'No additional effect.',
    long: "Unlike in the main games, it doesn't need the user to have eaten a Berry first.",
    source: 'ef5002da',
  },
  bellydrum: {
    short: 'User loses 50% max HP. Maximizes Attack.',
    long: "Raises the user's Attack by 12 stages in exchange for the user losing 1/2 of its maximum HP, rounded down. Fails if the user would faint or if its Attack stat stage is 6.",
    source: 'c75c0c07',
  },
  bind: {
    short: 'Traps and damages the target for 4-5 turns.',
    long: 'Prevents the target from switching for four or five turns. Causes damage to the target equal to 1/8 of its maximum HP (1/6 if the user is holding {item:bindingband}), rounded down, at the end of each turn during effect. The target can still switch out if it is holding {item:shedshell} or uses {move:batonpass}, {move:flipturn}, {move:partingshot}, {move:shedtail}, {move:uturn}, or {move:voltswitch}. The effect ends if either the user or the target leaves the field, or if the target uses {move:mortalspin}, {move:rapidspin}, or {move:substitute} successfully. This effect is not stackable or reset by using this or another binding move.',
    source: '83b9c7de',
  },
  bite: {
    short: '30% chance to make the target flinch.',
    long: 'Has a 30% chance to make the target flinch.',
    source: 'a0cdf44a',
  },
  bitterblade: {
    short: 'User recovers 50% of the damage dealt.',
    long: 'The user recovers 1/2 the HP lost by the target, rounded half up. If {item:bigroot} is held by the user, the HP recovered is 1.3× normal, rounded half down.',
    source: 'a9587920',
  },
  bittermalice: {
    short: "100% chance to lower the target's Attack by 1.",
    long: "Has a 100% chance to lower the target's Attack by 1 stage.",
    source: '4f51a815',
  },
  blastburn: {
    short: 'User cannot move next turn.',
    long: 'If this move is successful, the user must recharge on the following turn and cannot select a move.',
    source: 'bbbba096',
  },
  blazekick: {
    short: 'High critical hit ratio. 10% chance to burn.',
    long: 'Has a 10% chance to burn the target and a higher chance for a critical hit.',
    source: 'a5821d7d',
  },
  blizzard: {
    short: "10% chance to freeze foe(s). Can't miss in {condition:snow}.",
    long: 'Has a 10% chance to freeze the target. If the weather is {condition:snow}, this move does not check accuracy.',
    source: '18d6c734',
  },
  block: {
    short: 'Prevents the target from switching out.',
    long: 'Prevents the target from switching out. The target can still switch out if it is holding {item:shedshell} or uses {move:batonpass}, {move:flipturn}, {move:partingshot}, {move:uturn}, or {move:voltswitch}. The effect ends if either the user or the target leaves the field.',
    source: '373e0280',
  },
  bodypress: {
    short: "Uses user's Def stat as Atk in damage calculation.",
    long: "Damage is calculated using the user's Defense stat as its Attack, including stat stage changes. Other effects that modify the Attack stat are used as normal.",
    source: '0038c339',
  },
  bodyslam: {
    short: '30% chance to paralyze the target.',
    long: 'Has a 30% chance to paralyze the target. Damage doubles and no accuracy check is done if the target has used {move:minimize} while active.',
    source: 'a6f6b94e',
  },
  bonerush: {
    short: 'Hits 2-5 times in one turn.',
    long: "Hits two to five times. Has a 35% chance to hit two or three times and a 15% chance to hit four or five times. If one of the hits breaks the target's substitute, it will take damage for the remaining hits. If the user has the {ability:skilllink} Ability, this move will always hit five times.",
    source: '1487e33a',
  },
  boomburst: {
    short: 'No additional effect. Hits adjacent Pokémon.',
    source: 'a0d17afa',
  },
  bounce: {
    short: 'Bounces turn 1. Hits turn 2. 30% paralyze.',
    long: 'Has a 30% chance to paralyze the target. This attack charges on the first turn and executes on the second. On the first turn, the user avoids all attacks other than {move:hurricane}, {move:smackdown}, and {move:thunder}, and Gust and Twister have doubled power when used against it.',
    source: 'af45dc97',
  },
  bravebird: {
    short: 'Has 33% recoil.',
    long: 'If the target lost HP, the user takes recoil damage equal to 33% the HP lost by the target, rounded half up, but not less than 1 HP.',
    source: '8774d4f8',
  },
  breakingswipe: {
    short: '100% chance to lower the foe(s) Attack by 1.',
    long: "Has a 100% chance to lower the target's Attack by 1 stage.",
    source: 'd4846d89',
  },
  brickbreak: {
    short: 'Destroys screens, unless the target is immune.',
    long: "If this attack does not miss, the effects of {move:reflect}, {move:lightscreen}, and {move:auroraveil} end for the target's side of the field before damage is calculated.",
    source: 'e387ccca',
  },
  brutalswing: {
    short: 'No additional effect. Hits adjacent Pokémon.',
    source: 'a0d17afa',
  },
  bugbite: {
    short: "User steals and eats the target's Berry.",
    long: "If this move is successful and the user has not fainted, it steals the target's held Berry if it is holding one and eats it immediately, gaining its effects even if the user's item is being ignored. Items lost to this move cannot be regained with {move:recycle} or the {ability:harvest} Ability.",
    source: '5664a57a',
  },
  bugbuzz: {
    short: "10% chance to lower the target's Sp. Def by 1.",
    long: "Has a 10% chance to lower the target's Special Defense by 1 stage.",
    source: '13b4828c',
  },
  bulkup: {
    short: "Raises the user's Attack and Defense by 1.",
    long: "Raises the user's Attack and Defense by 1 stage.",
    source: 'c42dfa55',
  },
  bulldoze: {
    short: '100% chance lower adjacent Pkmn Speed by 1.',
    long: "Has a 100% chance to lower the target's Speed by 1 stage.",
    source: '4f9f5518',
  },
  bulletpunch: {
    short: 'Usually goes first.',
    source: 'a92f0fe3',
  },
  bulletseed: {
    short: 'Hits 2-5 times in one turn.',
    long: "Hits two to five times. Has a 35% chance to hit two or three times and a 15% chance to hit four or five times. If one of the hits breaks the target's substitute, it will take damage for the remaining hits. If the user has the {ability:skilllink} Ability, this move will always hit five times.",
    source: '1487e33a',
  },
  burningjealousy: {
    short: '100% burns a target that had a stat rise this turn.',
    long: 'Has a 100% chance to burn the target if it had a stat stage raised this turn.',
    source: '0a0d1592',
  },
  burnup: {
    short: "User's {type:fire} type becomes typeless; must be {type:fire}.",
    long: "Fails unless the user is a {type:fire} type. If this move is successful, the user's {type:fire} type becomes typeless as long as it remains active.",
    source: '0201e6a8',
  },
  calmmind: {
    short: "Raises the user's Sp. Atk and Sp. Def by 1.",
    long: "Raises the user's Special Attack and Special Defense by 1 stage.",
    source: 'edcf5b7e',
  },
  ceaselessedge: {
    short: 'Sets a layer of {condition:spikes} on the opposing side.',
    long: 'If this move is successful, it sets up a hazard on the opposing side of the field, damaging each opposing Pokémon that switches in, unless it is a {type:flying}-type Pokémon or has the {ability:levitate} Ability. A maximum of three layers may be set, and opponents lose 1/8 of their maximum HP with one layer, 1/6 of their maximum HP with two layers, and 1/4 of their maximum HP with three layers, all rounded down. Can be removed from the opposing side if any Pokémon uses {move:tidyup}, or if any opposing Pokémon uses {move:mortalspin}, {move:rapidspin}, or {move:defog} successfully, or is hit by {move:defog}.',
    source: '02139551',
  },
  charge: {
    short: "+1 SpD, user's next {type:electric} move 2× power.",
    long: "Raises the user's Special Defense by 1 stage. The user's next {type:electric}-type attack will have its power doubled; the effect ends when the user is no longer active, or after the user attempts to use any {type:electric}-type move besides Charge, even if it is not successful.",
    source: '54f0b996',
  },
  chargebeam: {
    short: "70% chance to raise the user's Sp. Atk by 1.",
    long: "Has a 70% chance to raise the user's Special Attack by 1 stage.",
    source: 'c5da44d9',
  },
  charm: {
    short: "Lowers the target's Attack by 2.",
    long: "Lowers the target's Attack by 2 stages.",
    source: '25d2cf06',
  },
  chillingwater: {
    short: "100% chance to lower the target's Attack by 1.",
    long: "Has a 100% chance to lower the target's Attack by 1 stage.",
    source: '4f51a815',
  },
  chillyreception: {
    short: 'Starts {condition:snow}. User switches out.',
    long: 'For 5 turns, the weather becomes {condition:snow}. The user switches out even if it is trapped and is replaced immediately by a selected party member. The user does not switch out if there are no unfainted party members.',
    source: '931a67aa',
  },
  circlethrow: {
    short: 'Forces the target to switch to a random ally.',
    long: 'If both the user and the target have not fainted, the target is forced to switch out and be replaced with a random unfainted ally. This effect fails if the target is under the effect of {move:ingrain}, has the {ability:suctioncups} Ability, or this move hit a substitute.',
    source: '356089e9',
  },
  clangingscales: {
    short: "Lowers the user's Defense by 1.",
    long: "Lowers the user's Defense by 1 stage.",
    source: '175402a0',
  },
  clangoroussoul: {
    short: 'User loses 33% of its max HP. +1 to all stats.',
    long: "Raises the user's Attack, Defense, Special Attack, Special Defense, and Speed by 1 stage in exchange for the user losing 33% of its maximum HP, rounded down. Fails if the user would faint or if its Attack, Defense, Special Attack, Special Defense, and Speed stat stages would not change.",
    source: '419942a0',
  },
  clearsmog: {
    short: "Resets all of the target's stat stages to 0.",
    source: '3dc2205a',
  },
  closecombat: {
    short: "Lowers the user's Defense and Sp. Def by 1.",
    long: "Lowers the user's Defense and Special Defense by 1 stage.",
    source: 'b3e45c3d',
  },
  coaching: {
    short: "Raises an ally's Attack and Defense by 1.",
    long: "Raises the target's Attack and Defense by 1 stage. Fails if there is no ally adjacent to the user.",
    source: 'cfe7ef62',
  },
  coil: {
    short: "Raises user's Attack, Defense, accuracy by 1.",
    long: "Raises the user's Attack, Defense, and accuracy by 1 stage.",
    source: 'f4e09ac0',
  },
  comeuppance: {
    short: 'If hit by an attack, returns 1.5× damage.',
    long: "Deals damage to the last opposing Pokémon to hit the user with a physical or special attack this turn equal to 1.5 times the HP lost by the user from that attack, rounded down. If the user did not lose HP from that attack, this move deals 1 HP of damage instead. If that opposing Pokémon's position is no longer in use and there is another opposing Pokémon on the field, the damage is done to it instead. Only the last hit of a multi-hit attack is counted. Fails if the user was not hit by an opposing Pokémon's physical or special attack this turn.",
    source: 'f38c2c7a',
  },
  confuseray: {
    short: 'Confuses the target.',
    long: 'Causes the target to become confused.',
    source: '3ae14425',
  },
  copycat: {
    short: 'Uses the last move used in the battle.',
    long: 'The user uses the last move used by any Pokémon, including itself. Fails if no move has been used, or if the last move used was {move:banefulbunker}, {move:beakblast}, {move:belch}, {move:circlethrow}, Copycat, {move:counter}, {move:covet}, {move:destinybond}, {move:detect}, {move:dragontail}, {move:endure}, {move:feint}, {move:focuspunch}, {move:followme}, {move:helpinghand}, {move:kingsshield}, Metronome, {move:protect}, {move:ragepowder}, {move:roar}, {move:sleeptalk}, {move:spikyshield}, {move:switcheroo}, {move:thief}, {move:transform}, {move:trick}, or {move:whirlwind}.',
    source: 'e0ed4617',
  },
  corrosivegas: {
    short: "Removes adjacent Pokémon's held items.",
    long: 'The target loses its held item. Pokémon with the {ability:stickyhold} Ability keep theirs, and so do Pokémon holding the Mega Stone or mask they use. Items lost to this move cannot be regained with {move:recycle} or the {ability:harvest} Ability.',
    source: 'a05077d8',
  },
  cosmicpower: {
    short: "Raises the user's Defense and Sp. Def by 1.",
    long: "Raises the user's Defense and Special Defense by 1 stage.",
    source: 'e2c38efd',
  },
  cottonguard: {
    short: "Raises the user's Defense by 3.",
    long: "Raises the user's Defense by 3 stages.",
    source: '090b69ab',
  },
  cottonspore: {
    short: "Lowers the target's Speed by 2.",
    long: "Lowers the target's Speed by 2 stages.",
    source: '99113284',
  },
  counter: {
    short: 'If hit by physical attack, returns double damage.',
    long: "Deals damage to the last opposing Pokémon to hit the user with a physical attack this turn equal to twice the HP lost by the user from that attack. If the user did not lose HP from the attack, this move deals 1 HP of damage instead. If that opposing Pokémon's position is no longer in use and there is another opposing Pokémon on the field, the damage is done to it instead. Only the last hit of a multi-hit attack is counted. Fails if the user was not hit by an opposing Pokémon's physical attack this turn.",
    source: '943882e7',
  },
  courtchange: {
    short: "Swaps user's field effects with the opposing side.",
    long: "Switches the effects of {move:lightscreen}, {move:reflect}, {move:auroraveil}, {move:safeguard}, {move:tailwind}, {condition:spikes}, {condition:toxicspikes}, {condition:stealthrock} and {condition:stickyweb} from the user's side to the opposing side and vice versa.",
    source: 'a0b66492',
  },
  covet: {
    short: "If the user has no item, it steals the target's.",
    long: "If this attack was successful and the user is not holding an item, it steals the target's held item. A target with the {ability:stickyhold} Ability does not lose its held item if it has not fainted. The target's item is not stolen if it is a Mega Stone and either the user or the target is the species that can Mega Evolve with it. Items lost to this move cannot be regained with {move:recycle} or the {ability:harvest} Ability.",
    source: '0c04545f',
  },
  crabhammer: {
    short: 'High critical hit ratio.',
    long: 'Has a higher chance for a critical hit.',
    source: 'f11e0024',
  },
  crosschop: {
    short: 'High critical hit ratio.',
    long: 'Has a higher chance for a critical hit.',
    source: 'f11e0024',
  },
  crosspoison: {
    short: 'High critical hit ratio. 10% chance to poison.',
    long: 'Has a 10% chance to poison the target and a higher chance for a critical hit.',
    source: '3acec1b0',
  },
  crunch: {
    short: "20% chance to lower the target's Defense by 1.",
    long: "Has a 20% chance to lower the target's Defense by 1 stage.",
    source: '40e1ee2a',
  },
  crushclaw: {
    short: "50% chance to lower the target's Defense by 1.",
    long: "Has a 50% chance to lower the target's Defense by 1 stage.",
    source: '6eaa7666',
  },
  curse: {
    short: 'Curses if {type:ghost}, else -1 Spe, +1 Atk, +1 Def.',
    long: "If the user is not a {type:ghost} type, lowers the user's Speed by 1 stage and raises the user's Attack and Defense by 1 stage. If the user is a {type:ghost} type, the user loses 1/2 of its maximum HP, rounded down and even if it would cause fainting, in exchange for the target losing 1/4 of its maximum HP, rounded down, at the end of each turn while it is active. If the target uses {move:batonpass}, the replacement will continue to be affected. Fails if there is no target or if the target is already affected.",
    source: '2d3dee6e',
  },
  darkestlariat: {
    short: "Ignores the target's stat stage changes.",
    long: "Ignores the target's stat stage changes, including evasiveness.",
    source: 'd9c49ecd',
  },
  darkpulse: {
    short: '20% chance to make the target flinch.',
    long: 'Has a 20% chance to make the target flinch.',
    source: 'a9ffb1d9',
  },
  dazzlinggleam: {
    short: 'No additional effect. Hits adjacent foes.',
    source: '9f238512',
  },
  decorate: {
    short: "Raises the target's Attack and Sp. Atk by 2.",
    long: "Raises the target's Attack and Special Attack by 2 stages.",
    source: 'e2ac8cbd',
  },
  defog: {
    short: '-1 evasion; ends user and target hazards/terrain.',
    long: "Lowers the target's evasiveness by 1 stage. If this move is successful and whether or not the target's evasiveness was affected, the effects of {move:reflect}, {move:lightscreen}, {move:auroraveil}, {move:safeguard}, {condition:spikes}, {condition:toxicspikes}, {condition:stealthrock}, and {condition:stickyweb} end for the target's side, and the effects of {condition:spikes}, {condition:toxicspikes}, {condition:stealthrock}, and {condition:stickyweb} end for the user's side. Ignores a target's substitute, although a substitute will still block the lowering of evasiveness. If there is a terrain active and this move is successful, the terrain will be cleared.",
    source: 'e58aafbf',
  },
  destinybond: {
    short: 'If an opponent knocks out the user, it also faints.',
    long: "Until the user's next move, if an opposing Pokémon's attack knocks the user out, that Pokémon faints as well, unless the attack was Doom Desire or {move:futuresight}. Fails if the user used this move successfully as its last move, disregarding moves used through the Dancer Ability.",
    source: '0633961b',
  },
  detect: {
    short: 'Prevents moves from affecting the user this turn.',
    long: "The user is protected from most attacks made by other Pokémon during this turn. This move has a 1/X chance of being successful, where X starts at 1 and triples each time this move is successfully used. X resets to 1 if this move fails, if the user's last move used is not {move:banefulbunker}, Detect, {move:endure}, {move:kingsshield}, {move:protect}, {move:quickguard}, {move:spikyshield}, or {move:wideguard}, or if it was one of those moves and the user's protection was broken. Fails if the user moves last this turn.",
    source: 'd5abbc51',
  },
  dig: {
    short: 'Digs underground turn 1, strikes turn 2.',
    long: 'This attack charges on the first turn and executes on the second. On the first turn, the user avoids all attacks other than {move:earthquake} and Magnitude but takes double damage from them, and is also unaffected by weather.',
    source: 'd675d1ab',
  },
  direclaw: {
    short: '30% chance to sleep, poison, or paralyze target.',
    long: 'Has a 30% chance to cause the target to either fall asleep, become poisoned, or become paralyzed.',
    source: 'c27ce9ab',
  },
  disable: {
    short: "For 4 turns, disables the target's last move used.",
    long: "For 4 turns, the target's last move used becomes disabled. Fails if one of the target's moves is already disabled, if the target has not made a move, if the target no longer knows the move.",
    source: 'd21db12f',
  },
  discharge: {
    short: '30% chance to paralyze adjacent Pokémon.',
    long: 'Has a 30% chance to paralyze the target.',
    source: '49ed7477',
  },
  dive: {
    short: 'Dives underwater turn 1, strikes turn 2.',
    long: 'This attack charges on the first turn and executes on the second. On the first turn, the user avoids all attacks other than {move:surf} and {move:whirlpool} but takes double damage from them, and is also unaffected by weather.',
    source: '6fdbc75f',
  },
  doubleedge: {
    short: 'Has 33% recoil.',
    long: 'If the target lost HP, the user takes recoil damage equal to 33% the HP lost by the target, rounded half up, but not less than 1 HP.',
    source: '8774d4f8',
  },
  doublehit: {
    short: 'Hits 2 times in one turn.',
    long: "Hits twice. If the first hit breaks the target's substitute, it will take damage for the second hit.",
    source: 'e025d196',
  },
  doubleshock: {
    short: "User's {type:electric} type: typeless; must be {type:electric}.",
    long: "Fails unless the user is an {type:electric} type. If this move is successful, the user's {type:electric} type becomes typeless as long as it remains active.",
    source: '8a62380c',
  },
  doubleteam: {
    short: "Raises the user's evasiveness by 1.",
    long: "Raises the user's evasiveness by 1 stage.",
    source: '5400cde3',
  },
  dracometeor: {
    short: "Lowers the user's Sp. Atk by 2.",
    long: "Lowers the user's Special Attack by 2 stages.",
    source: '450ae9f3',
  },
  dragoncheer: {
    short: 'Ally: Crit ratio +1, or +2 if ally is {type:dragon} type.',
    long: "Raises the target's chance for a critical hit by 1 stage, or by 2 stages if the target is {type:dragon} type. Fails if there is no ally adjacent to the user, or if the target already has this effect or the {move:focusenergy} effect. {move:batonpass} can be used to transfer this effect to an ally.",
    source: 'd14ad000',
  },
  dragonclaw: {
    short: 'No additional effect.',
    source: 'db89be13',
  },
  dragondance: {
    short: "Raises the user's Attack and Speed by 1.",
    long: "Raises the user's Attack and Speed by 1 stage.",
    source: 'f443813a',
  },
  dragondarts: {
    short: 'Hits twice. Doubles: Tries to hit each foe once.',
    long: "Hits twice. If the first hit breaks the target's substitute, it will take damage for the second hit. In Double Battles, this move attempts to hit the targeted Pokémon and its ally once each. If hitting one of these Pokémon would be prevented by immunity, protection, semi-invulnerability, an Ability, or accuracy, it attempts to hit the other Pokémon twice instead. If this move is redirected, it hits that target twice.",
    source: 'f4565973',
  },
  dragonpulse: {
    short: 'No additional effect.',
    source: 'db89be13',
  },
  dragonrush: {
    short: '20% chance to make the target flinch.',
    long: 'Has a 20% chance to make the target flinch. Damage doubles and no accuracy check is done if the target has used {move:minimize} while active.',
    source: 'd30d0d7e',
  },
  dragontail: {
    short: 'Forces the target to switch to a random ally.',
    long: 'If both the user and the target have not fainted, the target is forced to switch out and be replaced with a random unfainted ally. This effect fails if the target used {move:ingrain} previously, has the {ability:suctioncups} Ability, or this move hit a substitute.',
    source: '14d8bb59',
  },
  drainingkiss: {
    short: 'User recovers 75% of the damage dealt.',
    long: 'The user recovers 3/4 the HP lost by the target, rounded half up. If {item:bigroot} is held by the user, the HP recovered is 1.3× normal, rounded half down.',
    source: '5c3979ab',
  },
  drainpunch: {
    short: 'User recovers 50% of the damage dealt.',
    long: 'The user recovers 1/2 the HP lost by the target, rounded half up. If {item:bigroot} is held by the user, the HP recovered is 1.3× normal, rounded half down.',
    source: 'a9587920',
  },
  drillpeck: {
    short: 'No additional effect.',
    source: 'db89be13',
  },
  drillrun: {
    short: 'High critical hit ratio.',
    long: 'Has a higher chance for a critical hit.',
    source: 'f11e0024',
  },
  drumbeating: {
    short: "100% chance to lower the target's Speed by 1.",
    long: "Has a 100% chance to lower the target's Speed by 1 stage.",
    source: '03f12365',
  },
  dualwingbeat: {
    short: 'Hits 2 times in one turn.',
    long: "Hits twice. If the first hit breaks the target's substitute, it will take damage for the second hit.",
    source: 'e025d196',
  },
  dynamicpunch: {
    short: '100% chance to confuse the target.',
    long: 'Has a 100% chance to confuse the target.',
    source: '935b08de',
  },
  earthpower: {
    short: "10% chance to lower the target's Sp. Def by 1.",
    long: "Has a 10% chance to lower the target's Special Defense by 1 stage.",
    source: '13b4828c',
  },
  earthquake: {
    short: 'Hits adjacent Pokémon. Double damage on {move:dig}.',
    long: 'Damage doubles if the target is using {move:dig}.',
    source: '8e06590a',
  },
  eerieimpulse: {
    short: "Lowers the target's Sp. Atk by 2.",
    long: "Lowers the target's Special Attack by 2 stages.",
    source: '3850e899',
  },
  eeriespell: {
    short: "Removes 3 PP from the target's last move.",
    long: 'If this move is successful and the user has not fainted, the target loses 3 PP from its last move.',
    source: 'd3ede9aa',
  },
  electricterrain: {
    short: "5 turns. Grounded: +{type:electric} power, can't sleep.",
    long: 'For 5 turns, the terrain becomes Electric Terrain. During the effect, the power of {type:electric}-type attacks made by grounded Pokémon is multiplied by 1.3 and grounded Pokémon cannot fall asleep; Pokémon already asleep do not wake up. Grounded Pokémon cannot become affected by {move:yawn} or fall asleep from its effect. Fails if the current terrain is Electric Terrain.',
    source: '23cc9f68',
  },
  electrify: {
    short: "Changes the target's move to {type:electric} this turn.",
    long: "Causes the target's move to become {type:electric} type this turn. Among effects that can change a move's type, this effect happens last. Fails if the target already moved this turn.",
    source: 'e9d8ec34',
  },
  electroball: {
    short: 'More power the faster the user is than the target.',
    long: "The power of this move depends on (user's current Speed / target's current Speed), rounded down. Power is equal to 150 if the result is 4 or more, 120 if 3, 80 if 2, 60 if 1, 40 if less than 1. If the target's current Speed is 0, this move's power is 40.",
    source: '36027f1f',
  },
  electroshot: {
    short: 'Raises Sp. Atk by 1, hits turn 2. {condition:rain}: no charge.',
    long: "This attack charges on the first turn and executes on the second. Raises the user's Special Attack by 1 stage on the first turn. If the weather is {condition:rain}, the move completes in one turn.",
    source: '90fba87c',
  },
  electroweb: {
    short: '100% chance to lower the foe(s) Speed by 1.',
    long: "Has a 100% chance to lower the target's Speed by 1 stage.",
    source: 'c780d57c',
  },
  encore: {
    short: 'Target repeats its last move for its next 3 turns.',
    long: 'For its next 3 turns, the target is forced to repeat its last move used. If the affected move runs out of PP, the effect ends. Fails if the target is already under this effect, if it has not made a move, if the move has 0 PP, or if the move is {move:copycat}, Encore, Metronome, {move:sleeptalk}, or {move:transform}.',
    source: '81503d98',
  },
  endeavor: {
    short: "Lowers the target's HP to the user's HP.",
    long: "Deals damage to the target equal to (target's current HP - user's current HP). The target is unaffected if its current HP is less than or equal to the user's current HP.",
    source: '98b52398',
  },
  endure: {
    short: 'User survives attacks this turn with at least 1 HP.',
    long: "The user will survive attacks made by other Pokémon during this turn with at least 1 HP. This move has a 1/X chance of being successful, where X starts at 1 and triples each time this move is successfully used. X resets to 1 if this move fails, if the user's last move used is not {move:banefulbunker}, {move:detect}, Endure, {move:kingsshield}, {move:protect}, {move:quickguard}, {move:spikyshield}, or {move:wideguard}, or if it was one of those moves and the user's protection was broken. Fails if the user moves last this turn.",
    source: '3a3915a0',
  },
  energyball: {
    short: "10% chance to lower the target's Sp. Def by 1.",
    long: "Has a 10% chance to lower the target's Special Defense by 1 stage.",
    source: '13b4828c',
  },
  entrainment: {
    short: "The target's Ability changes to match the user's.",
    long: "Causes the target's Ability to become the same as the user's. Fails if the target's Ability is As One, {ability:battlebond}, {ability:disguise}, Gulp Missile, Ice Face, Shields Down, {ability:stancechange}, or {ability:zerotohero}, or the same Ability as the user, or if the user's Ability is As One, {ability:battlebond}, Comatose, Commander, {ability:disguise}, Embody Aspect, Flower Gift, {ability:forecast}, {ability:hungerswitch}, Ice Face, {ability:illusion}, {ability:imposter}, Multitype, Neutralizing Gas, Poison Puppeteer, Power Construct, Power of Alchemy, {ability:receiver}, Shields Down, {ability:stancechange}, {ability:trace}, or {ability:zerotohero}.",
    source: 'f980255f',
  },
  eruption: {
    short: "Less power as user's HP decreases. Hits foe(s).",
    long: "Power is equal to (user's current HP × 150 / user's maximum HP), rounded down, but not less than 1.",
    source: 'c7990bd0',
  },
  expandingforce: {
    short: 'User on {condition:psychicterrain}: 1.5× power, hits foes.',
    long: 'If the current terrain is {condition:psychicterrain} and the user is grounded, this move hits all opposing Pokémon and has its power multiplied by 1.5.',
    source: 'a45df80a',
  },
  explosion: {
    short: 'Hits adjacent Pokémon. The user faints.',
    long: 'The user faints after using this move, even if this move fails for having no target. This move is prevented from executing if any active Pokémon has the {ability:damp} Ability.',
    source: 'dc681c44',
  },
  extrasensory: {
    short: '10% chance to make the target flinch.',
    long: 'Has a 10% chance to make the target flinch.',
    source: 'ed164c2d',
  },
  extremespeed: {
    short: 'Nearly always goes first.',
    source: '0283836d',
  },
  facade: {
    short: 'Power doubles if user is burn/poison/paralyzed.',
    long: "Power doubles if the user is burned, paralyzed, or poisoned. The physical damage halving effect from the user's burn is ignored.",
    source: '6f8d6064',
  },
  fairylock: {
    short: 'Prevents all Pokémon from switching next turn.',
    long: 'Prevents all active Pokémon from switching next turn. A Pokémon can still switch out if it is holding {item:shedshell} or uses {move:batonpass}, {move:flipturn}, {move:partingshot}, {move:uturn}, or {move:voltswitch}. Fails if the effect is already active.',
    source: '7415e4b7',
  },
  fakeout: {
    short: 'Hits first. First turn out only. 100% flinch chance.',
    long: "Has a 100% chance to make the target flinch. This move cannot be selected unless it is the user's first turn on the field.",
    source: '78ea2b63',
  },
  faketears: {
    short: "Lowers the target's Sp. Def by 2.",
    long: "Lowers the target's Special Defense by 2 stages.",
    source: 'ed145cd9',
  },
  featherdance: {
    short: "Lowers the target's Attack by 2.",
    long: "Lowers the target's Attack by 2 stages.",
    source: '25d2cf06',
  },
  feint: {
    short: 'Nullifies {move:detect}, {move:protect}, and Quick/{move:wideguard}.',
    long: "If this move is successful, it breaks through the target's {move:banefulbunker}, {move:detect}, {move:kingsshield}, {move:protect}, or {move:spikyshield} for this turn, allowing other Pokémon to attack the target normally. If the target's side is protected by {move:quickguard} or {move:wideguard}, that protection is also broken for this turn and other Pokémon may attack the target's side normally.",
    source: '142e7880',
  },
  fellstinger: {
    short: "Raises user's Attack by 3 if this KOes the target.",
    long: "Raises the user's Attack by 3 stages if this move knocks out the target.",
    source: '2a6ffb7b',
  },
  ficklebeam: {
    short: "Has a 30% chance this move's power is doubled.",
    source: 'aa805b18',
  },
  fierydance: {
    short: "50% chance to raise the user's Sp. Atk by 1.",
    long: "Has a 50% chance to raise the user's Special Attack by 1 stage.",
    source: 'c5261a28',
  },
  finalgambit: {
    short: "Does damage equal to the user's HP. User faints.",
    long: "Deals damage to the target equal to the user's current HP. If this move is successful, the user faints.",
    source: 'cbebfdaa',
  },
  fireblast: {
    short: '10% chance to burn the target.',
    long: 'Has a 10% chance to burn the target.',
    source: '48c9d058',
  },
  firefang: {
    short: '10% chance to burn. 10% chance to flinch.',
    long: 'Has a 10% chance to burn the target and a 10% chance to make it flinch.',
    source: 'f5b615c4',
  },
  firelash: {
    short: "100% chance to lower the target's Defense by 1.",
    long: "Has a 100% chance to lower the target's Defense by 1 stage.",
    source: 'e797fab6',
  },
  firepunch: {
    short: '10% chance to burn the target.',
    long: 'Has a 10% chance to burn the target.',
    source: '48c9d058',
  },
  firespin: {
    short: 'Traps and damages the target for 4-5 turns.',
    long: 'Prevents the target from switching for four or five turns. Causes damage to the target equal to 1/8 of its maximum HP (1/6 if the user is holding {item:bindingband}), rounded down, at the end of each turn during effect. The target can still switch out if it is holding {item:shedshell} or uses {move:batonpass}, {move:flipturn}, {move:partingshot}, {move:shedtail}, {move:uturn}, or {move:voltswitch}. The effect ends if either the user or the target leaves the field, or if the target uses {move:mortalspin}, {move:rapidspin}, or {move:substitute} successfully. This effect is not stackable or reset by using this or another binding move.',
    source: '83b9c7de',
  },
  firstimpression: {
    short: 'Nearly always goes first. First turn out only.',
    long: "This move cannot be selected unless it is the user's first turn on the field.",
    source: 'd88b40e8',
  },
  fissure: {
    short: 'OHKOs the target. 30% accuracy.',
    long: "Deals damage to the target equal to the target's maximum HP. Ignores accuracy and evasiveness modifiers: its accuracy is always 30%, as every Pokémon is level 50. Pokémon with the {ability:sturdy} Ability are immune.",
    source: '70a1f5c5',
  },
  flail: {
    short: 'More power the less HP the user has left.',
    long: "The power of this move is 20 if X is 33 to 48, 40 if X is 17 to 32, 80 if X is 10 to 16, 100 if X is 5 to 9, 150 if X is 2 to 4, and 200 if X is 0 or 1, where X is equal to (user's current HP × 48 / user's maximum HP), rounded down.",
    source: 'abb9eead',
  },
  flamecharge: {
    short: "100% chance to raise the user's Speed by 1.",
    long: "Has a 100% chance to raise the user's Speed by 1 stage.",
    source: 'b5915159',
  },
  flamethrower: {
    short: '10% chance to burn the target.',
    long: 'Has a 10% chance to burn the target.',
    source: '48c9d058',
  },
  flareblitz: {
    short: 'Has 33% recoil. 10% chance to burn. Thaws user.',
    long: 'Has a 10% chance to burn the target. If the target lost HP, the user takes recoil damage equal to 33% the HP lost by the target, rounded half up, but not less than 1 HP.',
    source: '82972ed9',
  },
  flashcannon: {
    short: "10% chance to lower the target's Sp. Def by 1.",
    long: "Has a 10% chance to lower the target's Special Defense by 1 stage.",
    source: '13b4828c',
  },
  flatter: {
    short: "Raises the target's Sp. Atk by 1 and confuses it.",
    long: "Raises the target's Special Attack by 1 stage and confuses it.",
    source: '30a1bf1d',
  },
  fling: {
    short: "Flings the user's item at the target. Power varies.",
    long: "The power of this move is based on the user's held item. The held item is lost and it activates for the target if applicable. If there is no target or the target avoids this move by protecting itself, the user's held item is still lost. The user can regain a thrown item with {move:recycle} or the {ability:harvest} Ability. Fails if the user has no held item, if the held item cannot be thrown, if the user is under the effect of {move:magicroom}, or if the user has the {ability:klutz} Ability.",
    source: '318f064c',
  },
  flipturn: {
    short: 'User switches out after damaging the target.',
    long: 'If this move is successful and the user has not fainted, the user switches out even if it is trapped and is replaced immediately by a selected party member. The user does not switch out if there are no unfainted party members, or if the target switched out using an {item:ejectbutton} or through the effect of the {ability:emergencyexit} Ability.',
    source: '8091320d',
  },
  flowertrick: {
    short: 'Always results in a critical hit; no accuracy check.',
    long: 'This move is always a critical hit unless the target has the {ability:battlearmor} or {ability:shellarmor} Abilities. This move does not check accuracy.',
    source: '32c2550a',
  },
  fly: {
    short: 'Flies up on first turn, then strikes the next turn.',
    long: 'This attack charges on the first turn and executes on the second. On the first turn, the user avoids all attacks other than {move:hurricane}, {move:smackdown}, and {move:thunder}, and Gust and Twister have doubled power when used against it.',
    source: 'acd08e3f',
  },
  flyingpress: {
    short: 'Combines {type:flying} in its type effectiveness.',
    long: 'This move combines {type:flying} in its type effectiveness against the target. Damage doubles and no accuracy check is done if the target has used {move:minimize} while active.',
    source: 'f309f78e',
  },
  focusblast: {
    short: "10% chance to lower the target's Sp. Def by 1.",
    long: "Has a 10% chance to lower the target's Special Defense by 1 stage.",
    source: '13b4828c',
  },
  focusenergy: {
    short: "Raises the user's critical hit ratio by 2.",
    long: "Raises the user's chance for a critical hit by 2 stages. Fails if the user already has the effect. {move:batonpass} can be used to transfer this effect to an ally.",
    source: '5890c637',
  },
  focuspunch: {
    short: 'Fails if the user takes damage before it hits.',
    long: 'The user loses its focus and does nothing if it is hit by a damaging attack this turn before it can execute the move.',
    source: '11c7ac7b',
  },
  followme: {
    short: "The foes' moves target the user on the turn used.",
    long: 'Until the end of the turn, all single-target attacks from the opposing side are redirected to the user. Such attacks are redirected to the user before they can be reflected by the {ability:magicbounce} Ability, or drawn in by the {ability:lightningrod} Ability.',
    source: '2055d1a0',
  },
  forestscurse: {
    short: "Adds {type:grass} to the target's type(s).",
    long: 'Causes the {type:grass} type to be added to the target, effectively making it have two or three types. Fails if the target is already a {type:grass} type. If {move:trickortreat} adds a type to the target, it replaces the type added by this move and vice versa.',
    source: '4f48142e',
  },
  foulplay: {
    short: "Uses target's Attack stat in damage calculation.",
    long: "Damage is calculated using the target's Attack stat, including stat stage changes. The user's Ability, item, and burn are used as normal.",
    source: '366a8dfe',
  },
  freezedry: {
    short: 'Super effective on {type:water}.',
    long: "This move's type effectiveness against {type:water} is changed to be super effective no matter what this move's type is.",
    source: '95c09a23',
  },
  frenzyplant: {
    short: 'User cannot move next turn.',
    long: 'If this move is successful, the user must recharge on the following turn and cannot select a move.',
    source: 'bbbba096',
  },
  frostbreath: {
    short: 'Always results in a critical hit.',
    long: 'This move is always a critical hit unless the target has the {ability:battlearmor} or {ability:shellarmor} Abilities.',
    source: '6a49d7ec',
  },
  futuresight: {
    short: 'Hits two turns after being used.',
    long: "Deals damage two turns after this move is used. At the end of that turn, the damage is calculated at that time and dealt to the Pokémon at the position the target had when the move was used. If the user is no longer active at the time, damage is calculated based on the user's natural Special Attack stat, types, and level, with no boosts from its held item or Ability. Fails if this move or Doom Desire is already in effect for the target's position.",
    source: 'f9204b47',
  },
  gastroacid: {
    short: "Nullifies the target's Ability.",
    long: "Causes the target's Ability to be rendered ineffective as long as it remains active. If the target uses {move:batonpass}, the replacement will remain under this effect. If the target's Ability is As One, {ability:battlebond}, {ability:disguise}, Gulp Missile, Ice Face, Shields Down, {ability:stancechange}, or {ability:zerotohero}, this move fails, and receiving the effect through {move:batonpass} ends the effect immediately.",
    source: '0e6c3057',
  },
  gigadrain: {
    short: 'User recovers 50% of the damage dealt.',
    long: 'The user recovers 1/2 the HP lost by the target, rounded half up. If {item:bigroot} is held by the user, the HP recovered is 1.3× normal, rounded half down.',
    source: 'a9587920',
  },
  gigaimpact: {
    short: 'User cannot move next turn.',
    long: 'If this move is successful, the user must recharge on the following turn and cannot select a move.',
    source: 'bbbba096',
  },
  gigatonhammer: {
    short: "Cannot be selected the turn after it's used.",
    source: '09fa1eb0',
  },
  glaiverush: {
    short: 'User takes sure-hit 2× damage until its next turn.',
    long: "If this move is successful, moves targeted at the user deal double damage and do not check accuracy until the user's next turn.",
    source: 'eda4eff1',
  },
  glare: {
    short: 'Paralyzes the target.',
    source: 'b7961c34',
  },
  grassknot: {
    short: 'More power the heavier the target.',
    long: "This move's power is 20 if the target weighs less than 10 kg, 40 if less than 25 kg, 60 if less than 50 kg, 80 if less than 100 kg, 100 if less than 200 kg, and 120 if greater than or equal to 200 kg.",
    source: '3f10de1d',
  },
  grassyglide: {
    short: 'User on {condition:grassyterrain}: +1 priority.',
    long: 'If the current terrain is {condition:grassyterrain} and the user is grounded, this move has its priority increased by 1.',
    source: 'a7ab3309',
  },
  grassyterrain: {
    short: '5 turns. Grounded: +{type:grass} power, +1/16 max HP.',
    long: 'For 5 turns, the terrain becomes Grassy Terrain. During the effect, the power of {type:grass}-type attacks used by grounded Pokémon is multiplied by 1.3, the power of {move:bulldoze} and {move:earthquake} used against grounded Pokémon is multiplied by 0.5, and grounded Pokémon have 1/16 of their maximum HP, rounded down, restored at the end of each turn, including the last turn. Fails if the current terrain is Grassy Terrain.',
    source: '1917a1d8',
  },
  gravapple: {
    short: 'Target: 100% -1 Def. During {condition:gravity}: 1.5× power.',
    long: "Has a 100% chance to lower the target's Defense by 1 stage. Power is multiplied by 1.5 during {condition:gravity}'s effect.",
    source: '91d17bfc',
  },
  gravity: {
    short: '5 turns: no {type:ground} immunities, 1.67× accuracy.',
    long: 'For 5 turns, the evasiveness of all active Pokémon is multiplied by 0.6. At the time of use, {move:bounce}, {move:fly}, and {move:magnetrise} end immediately for all active Pokémon. During the effect, {move:bounce}, {move:fly}, {move:flyingpress}, {move:highjumpkick}, and {move:magnetrise} are prevented from being used by all active Pokémon. {type:ground}-type attacks, {condition:spikes}, {condition:toxicspikes}, {condition:stickyweb} can affect {type:flying} types or Pokémon with the {ability:levitate} Ability. Fails if this move is already in effect.',
    source: '5f0f9a67',
  },
  growth: {
    short: "Raises user's Attack and Sp. Atk by 1; 2 in {condition:sun}.",
    long: "Raises the user's Attack and Special Attack by 1 stage. If the weather is {condition:sun}, this move raises the user's Attack and Special Attack by 2 stages.",
    source: '26038f8a',
  },
  guardsplit: {
    short: 'Averages Defense and Sp. Def stats with target.',
    long: "The user and the target have their Defense and Special Defense stats set to be equal to the average of the user and the target's Defense and Special Defense stats, respectively, rounded down. Stat stage changes are unaffected.",
    source: '6242688b',
  },
  guardswap: {
    short: 'Swaps Defense and Sp. Def changes with target.',
    long: 'The user swaps its Defense and Special Defense stat stage changes with the target.',
    source: 'b53adc12',
  },
  guillotine: {
    short: 'OHKOs the target. 30% accuracy.',
    long: "Deals damage to the target equal to the target's maximum HP. Ignores accuracy and evasiveness modifiers: its accuracy is always 30%, as every Pokémon is level 50. Pokémon with the {ability:sturdy} Ability are immune.",
    source: '70a1f5c5',
  },
  gunkshot: {
    short: '30% chance to poison the target.',
    long: 'Has a 30% chance to poison the target.',
    source: 'd438bda9',
  },
  gyroball: {
    short: 'More power the slower the user than the target.',
    long: "Power is equal to (25 * target's current Speed / user's current Speed) + 1, rounded down, but not more than 150. If the user's current Speed is 0, this move's power is 1.",
    source: 'dafc85cd',
  },
  hammerarm: {
    short: "Lowers the user's Speed by 1.",
    long: "Lowers the user's Speed by 1 stage.",
    source: 'd125e256',
  },
  hardpress: {
    short: 'More power the more HP the target has left.',
    long: "Power is equal to 100 × (target's current HP / target's maximum HP), rounded half down, but not less than 1.",
    source: '33f89293',
  },
  haze: {
    short: 'Eliminates all stat changes.',
    long: 'Resets the stat stages of all active Pokémon to 0.',
    source: '6aa3c6b1',
  },
  headlongrush: {
    short: "Lowers the user's Defense and Sp. Def by 1.",
    long: "Lowers the user's Defense and Special Defense by 1 stage.",
    source: 'b3e45c3d',
  },
  headsmash: {
    short: 'Has 1/2 recoil.',
    long: 'If the target lost HP, the user takes recoil damage equal to 1/2 the HP lost by the target, rounded half up, but not less than 1 HP.',
    source: '9b3ba475',
  },
  healbell: {
    short: "Cures the user's party of all status conditions.",
    long: "Every Pokémon in the user's party is cured of its non-volatile status condition. Active Pokémon with the {ability:soundproof} Ability are not cured, unless they are the user.",
    source: 'e376a655',
  },
  healingwish: {
    short: 'User faints. Next hurt Pokémon is fully healed.',
    long: "The user faints, and if the Pokémon brought out to replace it does not have full HP or has a non-volatile status condition, its HP is fully restored along with having any non-volatile status condition cured. The replacement is sent out at the end of the turn, and the healing happens before hazards take effect. This effect continues until a Pokémon that meets either of these conditions switches in at the user's position or gets swapped into the position with {move:allyswitch}. Fails if the user is the last unfainted Pokémon in its party.",
    source: 'fa93311d',
  },
  healpulse: {
    short: 'Heals the target by 50% of its max HP.',
    long: 'The target restores 1/2 of its maximum HP, rounded half up. If the user has the {ability:megalauncher} Ability, the target instead restores 3/4 of its maximum HP, rounded half down.',
    source: 'ccb56441',
  },
  heatcrash: {
    short: 'More power the heavier the user than the target.',
    long: "The power of this move depends on (user's weight / target's weight), rounded down. Power is equal to 120 if the result is 5 or more, 100 if 4, 80 if 3, 60 if 2, and 40 if 1 or less. Damage doubles and no accuracy check is done if the target has used {move:minimize} while active.",
    source: 'c87fa7c5',
  },
  heatwave: {
    short: '10% chance to burn the foe(s).',
    long: 'Has a 10% chance to burn the target.',
    source: '53c1a5cd',
  },
  heavyslam: {
    short: 'More power the heavier the user than the target.',
    long: "The power of this move depends on (user's weight / target's weight), rounded down. Power is equal to 120 if the result is 5 or more, 100 if 4, 80 if 3, 60 if 2, and 40 if 1 or less. Damage doubles and no accuracy check is done if the target has used {move:minimize} while active.",
    source: 'c87fa7c5',
  },
  helpinghand: {
    short: "One adjacent ally's move power is 1.5× this turn.",
    long: "The power of the target's attack this turn is multiplied by 1.5 (this effect is stackable). Fails if there is no ally adjacent to the user or if the ally already moved this turn, but does not fail if the ally is using a two-turn move.",
    source: '16ec78a5',
  },
  hex: {
    short: 'Power doubles if the target has a status ailment.',
    long: 'Power doubles if the target has a non-volatile status condition.',
    source: '5062073c',
  },
  highhorsepower: {
    short: 'No additional effect.',
    source: 'db89be13',
  },
  highjumpkick: {
    short: 'User is hurt by 50% of its max HP if it misses.',
    long: 'If this attack is not successful, the user loses half of its maximum HP, rounded down, as crash damage. Pokémon with the {ability:magicguard} Ability are unaffected by crash damage.',
    source: 'b4447b55',
  },
  horndrill: {
    short: 'OHKOs the target. 30% accuracy.',
    long: "Deals damage to the target equal to the target's maximum HP. Ignores accuracy and evasiveness modifiers: its accuracy is always 30%, as every Pokémon is level 50. Pokémon with the {ability:sturdy} Ability are immune.",
    source: '70a1f5c5',
  },
  hornleech: {
    short: 'User recovers 50% of the damage dealt.',
    long: 'The user recovers 1/2 the HP lost by the target, rounded half up. If {item:bigroot} is held by the user, the HP recovered is 1.3× normal, rounded half down.',
    source: 'a9587920',
  },
  howl: {
    short: "Raises the user's and ally's Attack by 1.",
    long: 'Raises the Attack of the user and all allies 1 stage.',
    source: '9baf4d08',
  },
  hurricane: {
    short: "30% chance to confuse target. Can't miss in rain.",
    long: "Has a 30% chance to confuse the target. This move can hit a target using {move:bounce} or {move:fly}. If the weather is {condition:rain}, this move does not check accuracy. If the weather is {condition:sun}, this move's accuracy is 50%.",
    source: '4704aded',
  },
  hydrocannon: {
    short: 'User cannot move next turn.',
    long: 'If this move is successful, the user must recharge on the following turn and cannot select a move.',
    source: 'bbbba096',
  },
  hydropump: {
    short: 'No additional effect.',
    source: 'db89be13',
  },
  hyperbeam: {
    short: 'User cannot move next turn.',
    long: 'If this move is successful, the user must recharge on the following turn and cannot select a move.',
    source: 'bbbba096',
  },
  hypervoice: {
    short: 'No additional effect. Hits adjacent foes.',
    source: '9f238512',
  },
  hypnosis: {
    short: 'Causes the target to fall asleep.',
    source: 'f6fea4d7',
  },
  icebeam: {
    short: '10% chance to freeze the target.',
    long: 'Has a 10% chance to freeze the target.',
    source: 'e9d5164a',
  },
  icefang: {
    short: '10% chance to freeze. 10% chance to flinch.',
    long: 'Has a 10% chance to freeze the target and a 10% chance to make it flinch.',
    source: '1a2dd342',
  },
  icehammer: {
    short: "Lowers the user's Speed by 1.",
    long: "Lowers the user's Speed by 1 stage.",
    source: 'd125e256',
  },
  icepunch: {
    short: '10% chance to freeze the target.',
    long: 'Has a 10% chance to freeze the target.',
    source: 'e9d5164a',
  },
  iceshard: {
    short: 'Usually goes first.',
    source: 'a92f0fe3',
  },
  icespinner: {
    short: 'Ends the effects of terrain.',
    long: 'Ends the effects of {condition:electricterrain}, {condition:grassyterrain}, {condition:mistyterrain}, and {condition:psychicterrain}.',
    source: 'abd1ab91',
  },
  iciclecrash: {
    short: '30% chance to make the target flinch.',
    long: 'Has a 30% chance to make the target flinch.',
    source: 'a0cdf44a',
  },
  iciclespear: {
    short: 'Hits 2-5 times in one turn.',
    long: "Hits two to five times. Has a 35% chance to hit two or three times and a 15% chance to hit four or five times. If one of the hits breaks the target's substitute, it will take damage for the remaining hits. If the user has the {ability:skilllink} Ability, this move will always hit five times.",
    source: '1487e33a',
  },
  icywind: {
    short: '100% chance to lower the foe(s) Speed by 1.',
    long: "Has a 100% chance to lower the target's Speed by 1 stage.",
    source: 'c780d57c',
  },
  imprison: {
    short: 'No foe can use any move known by the user.',
    long: 'The user prevents all opposing Pokémon from using any moves that the user also knows as long as the user remains active.',
    source: 'beb3a66a',
  },
  infernalparade: {
    short: '30% burn. 2× power if target is already statused.',
    long: 'Has a 30% chance to burn the target. Power doubles if the target has a non-volatile status condition.',
    source: '2a980d90',
  },
  inferno: {
    short: '100% chance to burn the target.',
    long: 'Has a 100% chance to burn the target.',
    source: '3201de53',
  },
  infestation: {
    short: 'Traps and damages the target for 4-5 turns.',
    long: 'Prevents the target from switching for four or five turns. Causes damage to the target equal to 1/8 of its maximum HP (1/6 if the user is holding {item:bindingband}), rounded down, at the end of each turn during effect. The target can still switch out if it is holding {item:shedshell} or uses {move:batonpass}, {move:flipturn}, {move:partingshot}, {move:shedtail}, {move:uturn}, or {move:voltswitch}. The effect ends if either the user or the target leaves the field, or if the target uses {move:mortalspin}, {move:rapidspin}, or {move:substitute} successfully. This effect is not stackable or reset by using this or another binding move.',
    source: '83b9c7de',
  },
  ingrain: {
    short: 'Traps/grounds user; heals 1/16 max HP per turn.',
    long: 'The user has 1/16 of its maximum HP restored at the end of each turn, but it is prevented from switching out and other Pokémon cannot force the user to switch out. The user can still switch out if it uses {move:batonpass}, {move:flipturn}, {move:partingshot}, {move:uturn}, or {move:voltswitch}. If the user leaves the field using {move:batonpass}, the replacement will remain trapped and still receive the healing effect. During the effect, the user can be hit normally by {type:ground}-type attacks and be affected by {condition:spikes}, {condition:toxicspikes}, and {condition:stickyweb}, even if the user is a {type:flying} type or has the {ability:levitate} Ability.',
    source: '52f217f6',
  },
  instruct: {
    short: 'The target immediately uses its last used move.',
    long: 'The target immediately uses its last used move. Fails if the target has not made a move, if the move has 0 PP, if the target is preparing to use {move:beakblast} or {move:focuspunch}, or if the move is {move:beakblast}, {move:belch}, {move:copycat}, {move:focuspunch}, Instruct, {move:kingsshield}, {move:outrage}, {move:petaldance}, {move:sleeptalk}, {move:thrash}, {move:transform}, {move:uproar}, a two-turn move or a recharge move.',
    source: 'd423901f',
  },
  irondefense: {
    short: "Raises the user's Defense by 2.",
    long: "Raises the user's Defense by 2 stages.",
    source: '9af9e562',
  },
  ironhead: {
    short: '20% chance to make the target flinch.',
    long: 'Has a 20% chance to make the target flinch.',
    source: 'a9ffb1d9',
  },
  irontail: {
    short: "30% chance to lower the target's Defense by 1.",
    long: "Has a 30% chance to lower the target's Defense by 1 stage.",
    source: '8d025d09',
  },
  jawlock: {
    short: 'Prevents both user and target from switching out.',
    long: 'Prevents the user and the target from switching out. The user and the target can still switch out if either of them is holding {item:shedshell} or uses {move:batonpass}, {move:flipturn}, {move:partingshot}, {move:uturn}, or {move:voltswitch}. The effect ends if either the user or the target leaves the field.',
    source: '33dec4e1',
  },
  jetpunch: {
    short: 'Usually goes first.',
    source: 'a92f0fe3',
  },
  kingsshield: {
    short: 'Protects from damaging attacks. Contact: -1 Atk.',
    long: "The user is protected from most attacks made by other Pokémon during this turn, and Pokémon trying to make contact with the user have their Attack lowered by 1 stage. Non-damaging moves go through this protection. This move has a 1/X chance of being successful, where X starts at 1 and triples each time this move is successfully used. X resets to 1 if this move fails, if the user's last move used is not {move:banefulbunker}, {move:detect}, {move:endure}, King's Shield, {move:protect}, {move:quickguard}, {move:spikyshield}, or {move:wideguard}, or if it was one of those moves and the user's protection was broken. Fails if the user moves last this turn.",
    source: 'cb2116a4',
  },
  knockoff: {
    short: '1.5× damage if foe holds an item. Removes item.',
    long: "This move's power is multiplied by 1.5 if the target is holding an item, and the target loses its held item. A target with the {ability:stickyhold} Ability does not lose its held item if it has not fainted. This move does not increase in power or remove the target's item if it is a Mega Stone held by the species that can Mega Evolve with it. Items lost to this move cannot be regained with {move:recycle} or the {ability:harvest} Ability.",
    source: '355c47bb',
  },
  kowtowcleave: {
    short: 'This move does not check accuracy.',
    source: '9ffadd27',
  },
  lashout: {
    short: '2× power if the user had a stat lowered this turn.',
    long: 'Power doubles if the user had a stat stage lowered this turn.',
    source: 'f13d2e76',
  },
  lastresort: {
    short: 'Fails unless each known move has been used.',
    long: 'This move fails unless the user knows this move and at least one other move, and has used all the other moves it knows at least once each since it became active or Transformed.',
    source: '3398b030',
  },
  lastrespects: {
    short: '+50 power for each time a party member fainted.',
    long: "Power is equal to 50+(X × 50), where X is the total number of times any Pokémon has fainted on the user's side, and X cannot be greater than 100.",
    source: '3791c8b4',
  },
  lavaplume: {
    short: '30% chance to burn adjacent Pokémon.',
    long: 'Has a 30% chance to burn the target.',
    source: 'a9520d51',
  },
  leafblade: {
    short: 'High critical hit ratio.',
    long: 'Has a higher chance for a critical hit.',
    source: 'f11e0024',
  },
  leafstorm: {
    short: "Lowers the user's Sp. Atk by 2.",
    long: "Lowers the user's Special Attack by 2 stages.",
    source: '450ae9f3',
  },
  leechlife: {
    short: 'User recovers 50% of the damage dealt.',
    long: 'The user recovers 1/2 the HP lost by the target, rounded half up. If {item:bigroot} is held by the user, the HP recovered is 1.3× normal, rounded half down.',
    source: 'a9587920',
  },
  leechseed: {
    short: "1/8 of target's HP is restored to user every turn.",
    long: "The Pokémon at the user's position steals 1/8 of the target's maximum HP, rounded down, at the end of each turn. If {item:bigroot} is held by the recipient, the HP recovered is 1.3× normal, rounded half down. If the target uses {move:batonpass}, the replacement will continue being leeched. If the target switches out or uses {move:mortalspin} or {move:rapidspin} successfully, the effect ends. {type:grass}-type Pokémon are immune to this move on use, but not its effect.",
    source: '923ade59',
  },
  lifedew: {
    short: 'Heals the user and its allies by 1/4 their max HP.',
    long: "Each Pokémon on the user's side restores 1/4 of its maximum HP, rounded half up.",
    source: 'a6cec80d',
  },
  lightofruin: {
    short: 'Has 1/2 recoil.',
    long: 'If the target lost HP, the user takes recoil damage equal to 1/2 the HP lost by the target, rounded half up, but not less than 1 HP.',
    source: '9b3ba475',
  },
  lightscreen: {
    short: 'For 5 turns, special damage to allies is halved.',
    long: "For 5 turns, the user and its party members take 0.5× damage from special attacks, or 0.66× damage if in a Double Battle. Damage is not reduced further with {move:auroraveil}. Critical hits ignore this effect. It is removed from the user's side if the user or an ally is successfully hit by {move:brickbreak}, {move:psychicfangs}, or {move:defog}. Lasts for 8 turns if the user is holding {item:lightclay}. Fails if the effect is already active on the user's side.",
    source: '17e33b53',
  },
  liquidation: {
    short: "20% chance to lower the target's Defense by 1.",
    long: "Has a 20% chance to lower the target's Defense by 1 stage.",
    source: '40e1ee2a',
  },
  lockon: {
    short: "User's next move will not miss the target.",
    long: "Until the end of the next turn, the target cannot avoid the user's moves, even if the target is in the middle of a two-turn move. The effect ends if either the user or the target leaves the field. Fails if this effect is active for the user.",
    source: '575366c1',
  },
  lowkick: {
    short: 'More power the heavier the target.',
    long: "This move's power is 20 if the target weighs less than 10 kg, 40 if less than 25 kg, 60 if less than 50 kg, 80 if less than 100 kg, 100 if less than 200 kg, and 120 if greater than or equal to 200 kg.",
    source: '3f10de1d',
  },
  lowsweep: {
    short: "100% chance to lower the target's Speed by 1.",
    long: "Has a 100% chance to lower the target's Speed by 1 stage.",
    source: '03f12365',
  },
  luminacrash: {
    short: "100% chance to lower the target's Sp. Def by 2.",
    long: "Has a 100% chance to lower the target's Special Defense by 2 stages.",
    source: '9b749800',
  },
  lunge: {
    short: "100% chance to lower the target's Attack by 1.",
    long: "Has a 100% chance to lower the target's Attack by 1 stage.",
    source: '4f51a815',
  },
  machpunch: {
    short: 'Usually goes first.',
    source: 'a92f0fe3',
  },
  magicpowder: {
    short: "Changes the target's type to {type:psychic}.",
    long: 'Causes the target to become a {type:psychic} type. Fails if the target is already purely {type:psychic} type.',
    source: '9abaea51',
  },
  magicroom: {
    short: 'For 5 turns, all held items have no effect.',
    long: "For 5 turns, the held items of all active Pokémon have no effect. An item's effect of causing forme changes is unaffected, but any other effects from such items are negated. During the effect, {move:fling} is prevented from being used by all active Pokémon. If this move is used during the effect, the effect ends.",
    source: 'ecd43f59',
  },
  magneticflux: {
    short: 'Raises Def, Sp. Def of allies with {ability:plus}/{ability:minus} by 1.',
    long: "Raises the Defense and Special Defense of Pokémon on the user's side with the {ability:plus} or {ability:minus} Abilities by 1 stage.",
    source: 'f58cbe2f',
  },
  magnetrise: {
    short: 'For 5 turns, the user has immunity to {type:ground}.',
    long: 'For 5 turns, the user is immune to {type:ground}-type attacks and the effects of {condition:spikes}, {condition:toxicspikes}, {condition:stickyweb} as long as it remains active. If the user uses {move:batonpass}, the replacement will gain the effect. {move:ingrain}, {move:smackdown}, and {item:ironball} override this move if the user is under any of their effects. Fails if the user is already under this effect or the effects of {move:ingrain} or {move:smackdown}.',
    source: '8b2ce5c1',
  },
  makeitrain: {
    short: "Lowers the user's Sp. Atk by 2. Hits foe(s).",
    long: "Lowers the user's Special Attack by 2 stages.",
    source: 'ff532613',
  },
  matchagotcha: {
    short: '20% burn. Recovers 50% dmg dealt. Thaws foe(s).',
    long: 'Has a 20% chance to burn the target. The user recovers 1/2 the HP lost by the target, rounded half up. If {item:bigroot} is held by the user, the HP recovered is 1.3× normal, rounded half down. The target thaws out if it is frozen.',
    source: 'c047c06e',
  },
  meanlook: {
    short: 'Prevents the target from switching out.',
    long: 'Prevents the target from switching out. The target can still switch out if it is holding {item:shedshell} or uses {move:batonpass}, {move:flipturn}, {move:partingshot}, {move:uturn}, or {move:voltswitch}. The effect ends if either the user or the target leaves the field.',
    source: '373e0280',
  },
  megahorn: {
    short: 'No additional effect.',
    source: 'db89be13',
  },
  megakick: {
    short: 'No additional effect.',
    source: 'db89be13',
  },
  memento: {
    short: "Lowers target's Attack, Sp. Atk by 2. User faints.",
    long: "Lowers the target's Attack and Special Attack by 2 stages. The user faints unless this move misses or there is no target. Fails entirely if this move hits a substitute, but does not fail if the target's stats cannot be changed.",
    source: 'd1519459',
  },
  metalburst: {
    short: 'If hit by an attack, returns 1.5× damage.',
    long: "Deals damage to the last opposing Pokémon to hit the user with a physical or special attack this turn equal to 1.5 times the HP lost by the user from that attack, rounded down. If the user did not lose HP from that attack, this move deals 1 HP of damage instead. If that opposing Pokémon's position is no longer in use and there is another opposing Pokémon on the field, the damage is done to it instead. Only the last hit of a multi-hit attack is counted. Fails if the user was not hit by an opposing Pokémon's physical or special attack this turn.",
    source: 'f38c2c7a',
  },
  metalsound: {
    short: "Lowers the target's Sp. Def by 2.",
    long: "Lowers the target's Special Defense by 2 stages.",
    source: 'ed145cd9',
  },
  meteorassault: {
    short: 'User cannot move next turn.',
    long: 'If this move is successful, the user must recharge on the following turn and cannot select a move.',
    source: 'bbbba096',
  },
  meteorbeam: {
    short: "Raises user's Sp. Atk by 1 on turn 1. Hits turn 2.",
    long: "This attack charges on the first turn and executes on the second. Raises the user's Special Attack by 1 stage on the first turn.",
    source: 'c52e1219',
  },
  meteormash: {
    short: "20% chance to raise the user's Attack by 1.",
    long: "Has a 20% chance to raise the user's Attack by 1 stage.",
    source: '32624b3e',
  },
  milkdrink: {
    short: 'Heals the user or its ally by 50% of its max HP.',
    long: 'The user or an adjacent ally restores 1/2 of its maximum HP, rounded half up.',
    source: 'dc667b6e',
  },
  minimize: {
    short: "Raises the user's evasiveness by 2.",
    long: "Raises the user's evasiveness by 2 stages. Whether or not the user's evasiveness was changed, {move:bodyslam}, {move:dragonrush}, {move:flyingpress}, {move:heatcrash}, {move:heavyslam}, and {move:supercellslam} will not check accuracy and have their damage doubled if used against the user while it is active.",
    source: '6dbf1fef',
  },
  mirrorcoat: {
    short: 'If hit by special attack, returns double damage.',
    long: "Deals damage to the last opposing Pokémon to hit the user with a special attack this turn equal to twice the HP lost by the user from that attack. If the user did not lose HP from the attack, this move deals 1 HP of damage instead. If that opposing Pokémon's position is no longer in use and there is another opposing Pokémon on the field, the damage is done to it instead. Only the last hit of a multi-hit attack is counted. Fails if the user was not hit by an opposing Pokémon's special attack this turn.",
    source: 'bb2bc30e',
  },
  mistyexplosion: {
    short: 'User faints. User on {condition:mistyterrain}: 1.5× power.',
    long: "If the current terrain is {condition:mistyterrain} and the user is grounded, this move's power is multiplied by 1.5. The user faints after using this move, even if this move fails for having no target. This move is prevented from executing if any active Pokémon has the {ability:damp} Ability.",
    source: '5da6859a',
  },
  mistyterrain: {
    short: "5 turns. Can't status,-{type:dragon} power vs grounded.",
    long: 'For 5 turns, the terrain becomes Misty Terrain. During the effect, the power of {type:dragon}-type attacks used against grounded Pokémon is multiplied by 0.5 and grounded Pokémon cannot be inflicted with a non-volatile status condition nor confusion. Grounded Pokémon can become affected by {move:yawn} but cannot fall asleep from its effect. Fails if the current terrain is Misty Terrain.',
    source: '69b513e7',
  },
  moonblast: {
    short: "10% chance to lower the target's Sp. Atk by 1.",
    long: "Has a 10% chance to lower the target's Special Attack by 1 stage.",
    source: '7b31b9f3',
  },
  moonlight: {
    short: 'Heals the user by a weather-dependent amount.',
    long: 'The user restores 1/2 of its maximum HP if no weather is in effect, 2/3 of its maximum HP if the weather is {condition:sun}, and 1/4 of its maximum HP if the weather is {condition:rain}, {condition:sandstorm}, or {condition:snow}, all rounded half down.',
    source: '97c7b43c',
  },
  morningsun: {
    short: 'Heals the user by a weather-dependent amount.',
    long: 'The user restores 1/2 of its maximum HP if no weather is in effect, 2/3 of its maximum HP if the weather is {condition:sun}, and 1/4 of its maximum HP if the weather is {condition:rain}, {condition:sandstorm}, or {condition:snow}, all rounded half down.',
    source: '97c7b43c',
  },
  mortalspin: {
    short: 'Poisons foes, frees user from hazards/bind/leech.',
    long: "If this move is successful and the user has not fainted, the effects of {move:leechseed} and binding moves end for the user, and all hazards are removed from the user's side of the field. Has a 100% chance to poison the target.",
    source: '515db514',
  },
  mountaingale: {
    short: '30% chance to make the target flinch.',
    long: 'Has a 30% chance to make the target flinch.',
    source: 'a0cdf44a',
  },
  muddywater: {
    short: '30% chance to lower the foe(s) accuracy by 1.',
    long: "Has a 30% chance to lower the target's accuracy by 1 stage.",
    source: '92e7367a',
  },
  mudshot: {
    short: "100% chance to lower the target's Speed by 1.",
    long: "Has a 100% chance to lower the target's Speed by 1 stage.",
    source: '03f12365',
  },
  mudslap: {
    short: "100% chance to lower the target's accuracy by 1.",
    long: "Has a 100% chance to lower the target's accuracy by 1 stage.",
    source: 'd97e6c1f',
  },
  mysticalfire: {
    short: "100% chance to lower the target's Sp. Atk by 1.",
    long: "Has a 100% chance to lower the target's Special Attack by 1 stage.",
    source: '54fa4ecb',
  },
  nastyplot: {
    short: "Raises the user's Sp. Atk by 2.",
    long: "Raises the user's Special Attack by 2 stages.",
    source: 'cc047f8b',
  },
  nightdaze: {
    short: "40% chance to lower the target's accuracy by 1.",
    long: "Has a 40% chance to lower the target's accuracy by 1 stage.",
    source: 'cc256874',
  },
  nightshade: {
    short: "Deals 50 damage: the user's level.",
    long: "Deals damage to the target equal to the user's level, which is always 50.",
    source: '411bf202',
  },
  nightslash: {
    short: 'High critical hit ratio.',
    long: 'Has a higher chance for a critical hit.',
    source: 'f11e0024',
  },
  nobleroar: {
    short: "Lowers the target's Attack and Sp. Atk by 1.",
    long: "Lowers the target's Attack and Special Attack by 1 stage.",
    source: '4efc003d',
  },
  noretreat: {
    short: 'Raises all stats by 1 (not acc/eva). Traps user.',
    long: "Raises the user's Attack, Defense, Special Attack, Special Defense, and Speed by 1 stage, but it becomes prevented from switching out. The user can still switch out if it uses {move:batonpass}, {move:flipturn}, {move:partingshot}, {move:uturn}, or {move:voltswitch}. Fails if the user has already been prevented from switching by this effect.",
    source: '2587f645',
  },
  nuzzle: {
    short: '100% chance to paralyze the target.',
    long: 'Has a 100% chance to paralyze the target.',
    source: 'bf5e33c9',
  },
  octolock: {
    short: 'Traps target, lowers Def and SpD by 1 each turn.',
    long: "Prevents the target from switching out. At the end of each turn during effect, the target's Defense and Special Defense are lowered by 1 stage. The target can still switch out if it is holding {item:shedshell} or uses {move:batonpass}, {move:flipturn}, {move:partingshot}, {move:uturn}, or {move:voltswitch}. The effect ends if either the user or the target leaves the field.",
    source: '892fa709',
  },
  outrage: {
    short: 'Lasts 2-3 turns. Confuses the user afterwards.',
    long: 'The user spends two or three turns locked into this move and becomes confused immediately after its move on the last turn of the effect if it is not already. This move targets an opposing Pokémon at random on each turn. If the user is prevented from moving, is asleep at the beginning of a turn, or the attack is not successful against the target on the first turn of the effect or the second turn of a three-turn effect, the effect ends without causing confusion. If this move is called by {move:sleeptalk} and the user is asleep, the move is used for one turn and does not confuse the user.',
    source: '02b19c9b',
  },
  overdrive: {
    short: 'No additional effect. Hits foe(s).',
    source: '8ee1fab0',
  },
  overheat: {
    short: "Lowers the user's Sp. Atk by 2.",
    long: "Lowers the user's Special Attack by 2 stages.",
    source: '450ae9f3',
  },
  painsplit: {
    short: 'Shares HP of user and target equally.',
    long: "The user and the target's HP become the average of their current HP, rounded down, but not more than the maximum HP of either one.",
    source: '2d72af9f',
  },
  paraboliccharge: {
    short: 'User recovers 50% of the damage dealt.',
    long: 'The user recovers 1/2 the HP lost by the target, rounded half up. If {item:bigroot} is held by the user, the HP recovered is 1.3× normal, rounded half down.',
    source: 'a9587920',
  },
  partingshot: {
    short: "Lowers target's Atk, Sp. Atk by 1. User switches.",
    long: "Lowers the target's Attack and Special Attack by 1 stage. If this move is successful, the user switches out even if it is trapped and is replaced immediately by a selected party member. The user does not switch out if the target's Attack and Special Attack stat stages were both unchanged, or if there are no unfainted party members.",
    source: 'd1367bd7',
  },
  payback: {
    short: 'Power doubles if the user moves after the target.',
    long: 'Power doubles if the user moves after the target this turn, including actions taken through {move:instruct}. Switching in does not count as an action.',
    source: '866614b1',
  },
  perishsong: {
    short: 'All active Pokémon will faint in 3 turns.',
    long: "Each active Pokémon receives a perish count of 4 if it doesn't already have a perish count. At the end of each turn including the turn used, the perish count of all active Pokémon lowers by 1 and Pokémon faint if the number reaches 0. The perish count is removed from Pokémon that switch out. If a Pokémon uses {move:batonpass} while it has a perish count, the replacement will gain the perish count and continue to count down.",
    source: '9c3488cf',
  },
  petalblizzard: {
    short: 'No additional effect. Hits adjacent Pokémon.',
    source: 'a0d17afa',
  },
  petaldance: {
    short: 'Lasts 2-3 turns. Confuses the user afterwards.',
    long: 'The user spends two or three turns locked into this move and becomes confused immediately after its move on the last turn of the effect if it is not already. This move targets an opposing Pokémon at random on each turn. If the user is prevented from moving, is asleep at the beginning of a turn, or the attack is not successful against the target on the first turn of the effect or the second turn of a three-turn effect, the effect ends without causing confusion. If this move is called by {move:sleeptalk} and the user is asleep, the move is used for one turn and does not confuse the user.',
    source: '02b19c9b',
  },
  phantomforce: {
    short: 'Disappears turn 1. Hits turn 2. Breaks protection.',
    long: "If this move is successful, it breaks through the target's {move:banefulbunker}, {move:detect}, {move:kingsshield}, {move:protect}, or {move:spikyshield} for this turn, allowing other Pokémon to attack the target normally. If the target's side is protected by {move:quickguard} or {move:wideguard}, that protection is also broken for this turn and other Pokémon may attack the target's side normally. This attack charges on the first turn and executes on the second. On the first turn, the user avoids all attacks.",
    source: '5053b6b1',
  },
  pinmissile: {
    short: 'Hits 2-5 times in one turn.',
    long: "Hits two to five times. Has a 35% chance to hit two or three times and a 15% chance to hit four or five times. If one of the hits breaks the target's substitute, it will take damage for the remaining hits. If the user has the {ability:skilllink} Ability, this move will always hit five times.",
    source: '1487e33a',
  },
  playrough: {
    short: "10% chance to lower the target's Attack by 1.",
    long: "Has a 10% chance to lower the target's Attack by 1 stage.",
    source: 'df68f72f',
  },
  pluck: {
    short: "User steals and eats the target's Berry.",
    long: "If this move is successful and the user has not fainted, it steals the target's held Berry if it is holding one and eats it immediately, gaining its effects even if the user's item is being ignored. Items lost to this move cannot be regained with {move:recycle} or the {ability:harvest} Ability.",
    source: '5664a57a',
  },
  poisonfang: {
    short: '50% chance to badly poison the target.',
    long: 'Has a 50% chance to badly poison the target.',
    source: '1e9c59ad',
  },
  poisonjab: {
    short: '30% chance to poison the target.',
    long: 'Has a 30% chance to poison the target.',
    source: 'd438bda9',
  },
  poisonpowder: {
    short: 'Poisons the target.',
    source: '1fc4b509',
  },
  pollenpuff: {
    short: 'If the target is an ally, heals 50% of its max HP.',
    long: 'If the target is an ally, this move restores 1/2 of its maximum HP, rounded down, instead of dealing damage.',
    source: 'c7deceda',
  },
  poltergeist: {
    short: 'Fails if the target has no held item.',
    source: 'ab2a6597',
  },
  populationbomb: {
    short: 'Hits 10 times. Each hit can miss.',
    long: "Hits ten times. This move checks accuracy for each hit, and the attack ends if the target avoids a hit. If one of the hits breaks the target's substitute, it will take damage for the remaining hits. If the user has the {ability:skilllink} Ability, this move will always hit ten times.",
    source: 'ea7af201',
  },
  pounce: {
    short: "100% chance to lower the target's Speed by 1.",
    long: "Has a 100% chance to lower the target's Speed by 1 stage.",
    source: '03f12365',
  },
  powergem: {
    short: 'No additional effect.',
    source: 'db89be13',
  },
  powersplit: {
    short: 'Averages Attack and Sp. Atk stats with target.',
    long: "The user and the target have their Attack and Special Attack stats set to be equal to the average of the user and the target's Attack and Special Attack stats, respectively, rounded down. Stat stage changes are unaffected.",
    source: 'b752e45e',
  },
  powerswap: {
    short: 'Swaps Attack and Sp. Atk stat stages with target.',
    long: 'The user swaps its Attack and Special Attack stat stage changes with the target.',
    source: '2b8d841b',
  },
  powertrick: {
    short: "Switches user's Attack and Defense stats.",
    long: 'The user swaps its Attack and Defense stats, and stat stage changes remain on their respective stats. This move can be used again to swap the stats back. If the user uses {move:batonpass}, the replacement will have its Attack and Defense stats swapped if the effect is active. If the user has its stats recalculated by changing forme while its stats are swapped, this effect is ignored but is still active for the purposes of {move:batonpass}.',
    source: '4d43ab15',
  },
  powertrip: {
    short: " + 20 power for each of the user's stat boosts.",
    long: "Power is equal to 20+(X × 20), where X is the user's total stat stage changes that are greater than 0.",
    source: '4ad4ad49',
  },
  powerwhip: {
    short: 'No additional effect.',
    source: 'db89be13',
  },
  protect: {
    short: 'Prevents moves from affecting the user this turn.',
    long: "The user is protected from most attacks made by other Pokémon during this turn. This move has a 1/X chance of being successful, where X starts at 1 and triples each time this move is successfully used. X resets to 1 if this move fails, if the user's last move used is not {move:banefulbunker}, {move:detect}, {move:endure}, {move:kingsshield}, Protect, {move:quickguard}, {move:spikyshield}, or {move:wideguard}, or if it was one of those moves and the user's protection was broken. Fails if the user moves last this turn.",
    source: 'd5abbc51',
  },
  psychic: {
    short: "10% chance to lower the target's Sp. Def by 1.",
    long: "Has a 10% chance to lower the target's Special Defense by 1 stage.",
    source: '13b4828c',
  },
  psychicfangs: {
    short: 'Destroys screens, unless the target is immune.',
    long: "If this attack does not miss, the effects of {move:reflect}, {move:lightscreen}, and {move:auroraveil} end for the target's side of the field before damage is calculated.",
    source: 'e387ccca',
  },
  psychicnoise: {
    short: 'For 2 turns, the target is prevented from healing.',
    long: 'For 2 turns, the target is prevented from restoring any HP as long as it remains active. During the effect, healing and draining moves are unusable, and Abilities and items that grant healing will not heal the user. If an affected Pokémon uses {move:batonpass}, the replacement will remain unable to restore its HP. {move:painsplit} and the {ability:regenerator} Ability are unaffected.',
    source: '8d41da48',
  },
  psychicterrain: {
    short: '5 turns. Grounded: +{type:psychic} power, priority-safe.',
    long: 'For 5 turns, the terrain becomes Psychic Terrain. During the effect, the power of {type:psychic}-type attacks made by grounded Pokémon is multiplied by 1.3 and grounded Pokémon cannot be hit by moves with priority greater than 0, unless the target is an ally. Fails if the current terrain is Psychic Terrain.',
    source: 'b0f9b7f8',
  },
  psychocut: {
    short: 'High critical hit ratio.',
    long: 'Has a higher chance for a critical hit.',
    source: 'f11e0024',
  },
  psychup: {
    short: "Copies the target's current stat stages.",
    long: "The user copies all of the target's current stat stage changes.",
    source: 'f12f2148',
  },
  psyshieldbash: {
    short: "100% chance to raise the user's Defense by 1.",
    long: "Has a 100% chance to raise the user's Defense by 1 stage.",
    source: '1c0987be',
  },
  psyshock: {
    short: 'Damages target based on Defense, not Sp. Def.',
    long: 'Deals damage to the target based on its Defense instead of Special Defense.',
    source: 'cafb1984',
  },
  pyroball: {
    short: '10% chance to burn the target. Thaws user.',
    long: 'Has a 10% chance to burn the target.',
    source: 'd2e2a06e',
  },
  quash: {
    short: 'Forces the target to move last this turn.',
    long: 'Causes the target to take its turn after all other Pokémon this turn, no matter the priority of its selected move. Fails if the target already moved this turn.',
    source: '6360533d',
  },
  quickattack: {
    short: 'Usually goes first.',
    source: 'a92f0fe3',
  },
  quickguard: {
    short: 'Protects allies from priority attacks this turn.',
    long: "The user and its party members are protected from attacks with original or altered priority greater than 0 made by other Pokémon, including allies, during this turn. This move modifies the same 1/X chance of being successful used by other protection moves, where X starts at 1 and triples each time this move is successfully used, but does not use the chance to check for failure. X resets to 1 if this move fails, if the user's last move used is not {move:banefulbunker}, {move:detect}, {move:endure}, {move:kingsshield}, {move:protect}, Quick Guard, {move:spikyshield}, or {move:wideguard}, or if it was one of those moves and the user's protection was broken. Fails if the user moves last this turn or if this move is already in effect for the user's side.",
    source: '52fc0c1a',
  },
  quiverdance: {
    short: "Raises the user's Sp. Atk, Sp. Def, Speed by 1.",
    long: "Raises the user's Special Attack, Special Defense, and Speed by 1 stage.",
    source: '5a78816a',
  },
  ragefist: {
    short: '+50 BP/hit on user. Max 6 hits. Resets on switch-out.',
    long: 'Power is equal to 50+(X × 50), where X is the total number of times the user has been hit by a damaging attack during the battle, even if the user did not lose HP from the attack. X cannot be greater than 6 and resets to 0 when the user leaves the field. Each hit of a multi-hit attack is counted, but confusion damage is not counted.',
    source: 'da7a718b',
  },
  ragepowder: {
    short: "The foes' moves target the user on the turn used.",
    long: 'Until the end of the turn, all single-target attacks from the opposing side are redirected to the user. Such attacks are redirected to the user before they can be reflected by the {ability:magicbounce} Ability, or drawn in by the {ability:lightningrod} Ability.',
    source: '2055d1a0',
  },
  ragingbull: {
    short: "Destroys screens. Type depends on user's form.",
    long: "If this attack does not miss, the effects of {move:reflect}, {move:lightscreen}, and {move:auroraveil} end for the target's side of the field before damage is calculated. If the user's current form is a Paldean {pokemon:tauros}, this move's type changes to match. {type:fighting} type for Combat Breed, {type:fire} type for Blaze Breed, and {type:water} type for Aqua Breed.",
    source: '484aba00',
  },
  ragingfury: {
    short: 'Lasts 2-3 turns. Confuses the user afterwards.',
    long: 'The user spends two or three turns locked into this move and becomes confused immediately after its move on the last turn of the effect if it is not already. This move targets an opposing Pokémon at random on each turn. If the user is prevented from moving, is asleep at the beginning of a turn, or the attack is not successful against the target on the first turn of the effect or the second turn of a three-turn effect, the effect ends without causing confusion. If this move is called by {move:sleeptalk} and the user is asleep, the move is used for one turn and does not confuse the user.',
    source: '02b19c9b',
  },
  raindance: {
    short: 'For 5 turns, heavy rain powers {type:water} moves.',
    long: 'For 5 turns, the weather becomes {condition:rain}. The damage of {type:water}-type attacks is multiplied by 1.5 and the damage of {type:fire}-type attacks is multiplied by 0.5 during the effect. Lasts for 8 turns if the user is holding {item:damprock}. Fails if the current weather is {condition:rain}.',
    source: '00e49a84',
  },
  rapidspin: {
    short: 'Free user from hazards/bind/{move:leechseed}; +1 Spe.',
    long: "If this move is successful and the user has not fainted, the effects of {move:leechseed} and binding moves end for the user, and all hazards are removed from the user's side of the field. Has a 100% chance to raise the user's Speed by 1 stage.",
    source: 'ea6367be',
  },
  razorshell: {
    short: "50% chance to lower the target's Defense by 1.",
    long: "Has a 50% chance to lower the target's Defense by 1 stage.",
    source: '6eaa7666',
  },
  recover: {
    short: 'Heals the user by 50% of its max HP.',
    long: 'The user restores 1/2 of its maximum HP, rounded half up.',
    source: 'dc667b6e',
  },
  recycle: {
    short: 'Restores the item the user last used.',
    long: 'The user regains the item it last used. Fails if the user is holding an item, if the user has not held an item, if the item was a popped {item:airballoon}, if the item was picked up by a Pokémon with the {ability:pickup} Ability, or if the item was lost to {move:bugbite}, {move:corrosivegas}, {move:covet}, {move:knockoff}, {move:pluck}, or {move:thief}. Items thrown with {move:fling} can be regained.',
    source: 'eb58b5a6',
  },
  reflect: {
    short: 'For 5 turns, physical damage to allies is halved.',
    long: "For 5 turns, the user and its party members take 0.5× damage from physical attacks, or 0.66× damage if in a Double Battle. Damage is not reduced further with {move:auroraveil}. Critical hits ignore this effect. It is removed from the user's side if the user or an ally is successfully hit by {move:brickbreak}, {move:psychicfangs}, or {move:defog}. Lasts for 8 turns if the user is holding {item:lightclay}. Fails if the effect is already active on the user's side.",
    source: 'd4e1e053',
  },
  reflecttype: {
    short: 'User becomes the same type as the target.',
    long: "Causes the user's types to become the same as the current types of the target. If the target's current types include typeless and a non-added type, typeless is ignored. If the target's current types include typeless and an added type from {move:forestscurse} or {move:trickortreat}, typeless is copied as the {type:normal} type instead. Fails if the target's current type is typeless alone.",
    source: 'ab140f98',
  },
  rest: {
    short: 'User sleeps 2 turns and restores HP and status.',
    long: 'The user falls asleep for the next two turns and restores all of its HP, curing itself of any non-volatile status condition in the process. Fails if the user has full HP, is already asleep, or if another effect is preventing sleep.',
    source: 'a415dcfa',
  },
  reversal: {
    short: 'More power the less HP the user has left.',
    long: "The power of this move is 20 if X is 33 to 48, 40 if X is 17 to 32, 80 if X is 10 to 16, 100 if X is 5 to 9, 150 if X is 2 to 4, and 200 if X is 0 or 1, where X is equal to (user's current HP × 48 / user's maximum HP), rounded down.",
    source: 'abb9eead',
  },
  revivalblessing: {
    short: 'Revives a fainted Pokémon to 50% HP.',
    long: 'A fainted party member is selected and revived with 1/2 its max HP, rounded down. Fails if there are no fainted party members.',
    source: '630ff070',
  },
  risingvoltage: {
    short: '2× power if target is grounded in {condition:electricterrain}.',
    long: "If the current terrain is {condition:electricterrain} and the target is grounded, this move's power is doubled.",
    source: 'c0830d0c',
  },
  roar: {
    short: 'Forces the target to switch to a random ally.',
    long: 'The target is forced to switch out and be replaced with a random unfainted ally. Fails if the target is the last unfainted Pokémon in its party, or if the target used {move:ingrain} previously or has the {ability:suctioncups} Ability.',
    source: '6271fec1',
  },
  rockblast: {
    short: 'Hits 2-5 times in one turn.',
    long: "Hits two to five times. Has a 35% chance to hit two or three times and a 15% chance to hit four or five times. If one of the hits breaks the target's substitute, it will take damage for the remaining hits. If the user has the {ability:skilllink} Ability, this move will always hit five times.",
    source: '1487e33a',
  },
  rockpolish: {
    short: "Raises the user's Speed by 2.",
    long: "Raises the user's Speed by 2 stages.",
    source: '7cd16dc0',
  },
  rockslide: {
    short: '30% chance to make the foe(s) flinch.',
    long: 'Has a 30% chance to make the target flinch.',
    source: '25bc1c88',
  },
  rocktomb: {
    short: "100% chance to lower the target's Speed by 1.",
    long: "Has a 100% chance to lower the target's Speed by 1 stage.",
    source: '03f12365',
  },
  rockwrecker: {
    short: 'User cannot move next turn.',
    long: 'If this move is successful, the user must recharge on the following turn and cannot select a move.',
    source: 'bbbba096',
  },
  roleplay: {
    short: "User replaces its Ability with the target's.",
    long: "The user's Ability changes to match the target's Ability. Fails if the user's Ability is As One, {ability:battlebond}, Comatose, {ability:disguise}, Gulp Missile, Ice Face, Multitype, Power Construct, RKS System, Schooling, Shields Down, {ability:stancechange}, Tera Shift, Zen Mode, {ability:zerotohero}, or already matches the target, or if the target's Ability is As One, {ability:battlebond}, Comatose, Commander, {ability:disguise}, Embody Aspect, Flower Gift, {ability:forecast}, {ability:hungerswitch}, Ice Face, {ability:illusion}, {ability:imposter}, Multitype, Neutralizing Gas, Poison Puppeteer, Power Construct, Power of Alchemy, {ability:receiver}, Shields Down, {ability:stancechange}, {ability:trace}, or {ability:zerotohero}.",
    source: '3934586c',
  },
  roost: {
    short: "Heals 50% HP. {type:flying}-type removed 'til turn ends.",
    long: "The user restores 1/2 of its maximum HP, rounded half up. Until the end of the turn {type:flying}-type users lose their {type:flying} type and pure {type:flying}-type users become {type:normal} type. Does nothing if the user's HP is full.",
    source: '482ab0ec',
  },
  round: {
    short: 'Power doubles if others used Round this turn.',
    long: "If there are other active Pokémon that chose this move for use this turn, those Pokémon take their turn immediately after the user, in Speed order, and this move's power is 120 for each other user.",
    source: '5531ebd4',
  },
  sacredsword: {
    short: "Ignores the target's stat stage changes.",
    long: "Ignores the target's stat stage changes, including evasiveness.",
    source: 'd9c49ecd',
  },
  safeguard: {
    short: "For 5 turns, protects user's party from status.",
    long: "For 5 turns, the user and its party members cannot have non-volatile status conditions or confusion inflicted on them by other Pokémon. Pokémon on the user's side cannot become affected by {move:yawn} but can fall asleep from its effect. It is removed from the user's side if the user or an ally is successfully hit by {move:defog}. Fails if the effect is already active on the user's side.",
    source: '6d376d42',
  },
  saltcure: {
    short: 'Deals 1/16 max HP each turn; 1/8 on {type:steel}, {type:water}.',
    long: 'Causes damage to the target equal to 1/16 of its maximum HP (1/8 if the target is {type:steel} or {type:water} type), rounded down, at the end of each turn during effect. This effect ends when the target is no longer active.',
    source: '8d38c5b7',
  },
  sandstorm: {
    short: 'For 5 turns, a sandstorm rages. {type:rock}: 1.5× SpD.',
    long: 'For 5 turns, the weather becomes Sandstorm. At the end of each turn except the last, all active Pokémon lose 1/16 of their maximum HP, rounded down, unless they are a {type:ground}, {type:rock}, or {type:steel} type, or have the {ability:magicguard}, {ability:overcoat}, {ability:sandforce}, {ability:sandrush}, or {ability:sandveil} Abilities. During the effect, the Special Defense of {type:rock}-type Pokémon is multiplied by 1.5 when taking damage from a special attack. Lasts for 8 turns if the user is holding {item:smoothrock}. Fails if the current weather is Sandstorm.',
    source: '9b6ae42a',
  },
  sandtomb: {
    short: 'Traps and damages the target for 4-5 turns.',
    long: 'Prevents the target from switching for four or five turns. Causes damage to the target equal to 1/8 of its maximum HP (1/6 if the user is holding {item:bindingband}), rounded down, at the end of each turn during effect. The target can still switch out if it is holding {item:shedshell} or uses {move:batonpass}, {move:flipturn}, {move:partingshot}, {move:shedtail}, {move:uturn}, or {move:voltswitch}. The effect ends if either the user or the target leaves the field, or if the target uses {move:mortalspin}, {move:rapidspin}, or {move:substitute} successfully. This effect is not stackable or reset by using this or another binding move.',
    source: '83b9c7de',
  },
  scald: {
    short: '30% chance to burn the target. Thaws target.',
    long: 'Has a 30% chance to burn the target. The target thaws out if it is frozen.',
    source: '29f59adb',
  },
  scaleshot: {
    short: 'Hits 2-5 times. User: -1 Def, +1 Spe after last hit.',
    long: "Hits two to five times. Lowers the user's Defense by 1 stage and raises the user's Speed by 1 stage after the last hit. Has a 35% chance to hit two or three times and a 15% chance to hit four or five times. If one of the hits breaks the target's substitute, it will take damage for the remaining hits. If the user has the {ability:skilllink} Ability, this move will always hit five times.",
    source: 'd3934ace',
  },
  scaryface: {
    short: "Lowers the target's Speed by 2.",
    long: "Lowers the target's Speed by 2 stages.",
    source: '99113284',
  },
  scorchingsands: {
    short: '30% chance to burn the target. Thaws target.',
    long: 'Has a 30% chance to burn the target. The target thaws out if it is frozen.',
    source: '29f59adb',
  },
  screech: {
    short: "Lowers the target's Defense by 2.",
    long: "Lowers the target's Defense by 2 stages.",
    source: '7435ca4b',
  },
  seedbomb: {
    short: 'No additional effect.',
    source: 'db89be13',
  },
  seismictoss: {
    short: "Deals 50 damage: the user's level.",
    long: "Deals damage to the target equal to the user's level, which is always 50.",
    source: '411bf202',
  },
  selfdestruct: {
    short: 'Hits adjacent Pokémon. The user faints.',
    long: 'The user faints after using this move, even if this move fails for having no target. This move is prevented from executing if any active Pokémon has the {ability:damp} Ability.',
    source: 'dc681c44',
  },
  shadowball: {
    short: "20% chance to lower the target's Sp. Def by 1.",
    long: "Has a 20% chance to lower the target's Special Defense by 1 stage.",
    source: 'acc7a763',
  },
  shadowclaw: {
    short: 'High critical hit ratio.',
    long: 'Has a higher chance for a critical hit.',
    source: 'f11e0024',
  },
  shadowpunch: {
    short: 'This move does not check accuracy.',
    source: '9ffadd27',
  },
  shadowsneak: {
    short: 'Usually goes first.',
    source: 'a92f0fe3',
  },
  shedtail: {
    short: 'User takes 1/2 its max HP to pass a substitute.',
    long: "The user takes 1/2 of its maximum HP, rounded up, and creates a substitute that has 1/4 of the user's maximum HP, rounded down. The user is replaced with another Pokémon in its party and the selected Pokémon has the substitute transferred to it. Fails if the user would faint, or if there are no unfainted party members.",
    source: 'e5ab5a00',
  },
  sheercold: {
    short: 'OHKOs non-{type:ice} targets. 30% accuracy ({type:ice} users), else 20%.',
    long: "Deals damage to the target equal to the target's maximum HP. Ignores accuracy and evasiveness modifiers: its accuracy is 30% if the user is an {type:ice} type and 20% otherwise, as every Pokémon is level 50. {type:ice}-type Pokémon and Pokémon with the {ability:sturdy} Ability are immune.",
    source: '30a84429',
  },
  shellsidearm: {
    short: '20% psn. Physical+contact if it would be stronger.',
    long: "Has a 20% chance to poison the target. This move becomes a physical attack that makes contact if the value of ((((2 × the user's level / 5 + 2) × 90 × X) / Y) / 50), where X is the user's Attack stat and Y is the target's Defense stat, is greater than the same value where X is the user's Special Attack stat and Y is the target's Special Defense stat. No stat modifiers other than stat stage changes are considered for this purpose. If the two values are equal, this move chooses a damage category at random.",
    source: '522f1276',
  },
  shellsmash: {
    short: 'Lowers Def, SpD by 1; raises Atk, SpA, Spe by 2.',
    long: "Lowers the user's Defense and Special Defense by 1 stage. Raises the user's Attack, Special Attack, and Speed by 2 stages.",
    source: 'be6d0518',
  },
  shelter: {
    short: "Raises the user's Defense by 2.",
    long: "Raises the user's Defense by 2 stages.",
    source: '9af9e562',
  },
  shiftgear: {
    short: "Raises the user's Speed by 2 and Attack by 1.",
    long: "Raises the user's Speed by 2 stages and its Attack by 1 stage.",
    source: 'eba5f32d',
  },
  simplebeam: {
    short: "The target's Ability becomes Simple.",
    long: "Causes the target's Ability to become Simple. Fails if the target's Ability is As One, {ability:battlebond}, {ability:disguise}, Gulp Missile, Ice Face, Shields Down, {ability:stancechange}, or {ability:zerotohero}.",
    source: '4e1802c3',
  },
  sing: {
    short: 'Causes the target to fall asleep.',
    source: 'f6fea4d7',
  },
  skillswap: {
    short: 'The user and the target trade Abilities.',
    long: "The user swaps its Ability with the target's Ability. Fails if either the user or the target's Ability is As One, {ability:battlebond}, {ability:disguise}, Embody Aspect, {ability:hungerswitch}, Ice Face, {ability:illusion}, Shields Down, {ability:stancechange}, or {ability:zerotohero}.",
    source: 'f754c4c1',
  },
  skittersmack: {
    short: "100% chance to lower target's Sp. Atk by 1.",
    long: "Has a 100% chance to lower the target's Special Attack by 1 stage.",
    source: '0cb0ff2d',
  },
  skyattack: {
    short: 'Charges, then hits turn 2. 30% flinch. High crit.',
    long: 'Has a 30% chance to make the target flinch and a higher chance for a critical hit. This attack charges on the first turn and executes on the second.',
    source: '10ea0d54',
  },
  slackoff: {
    short: 'Heals the user by 50% of its max HP.',
    long: 'The user restores 1/2 of its maximum HP, rounded half up.',
    source: 'dc667b6e',
  },
  slash: {
    short: 'High critical hit ratio.',
    long: 'Has a higher chance for a critical hit.',
    source: 'f11e0024',
  },
  sleeppowder: {
    short: 'Causes the target to fall asleep.',
    source: 'f6fea4d7',
  },
  sleeptalk: {
    short: 'User must be asleep. Uses another known move.',
    long: "One of the user's known moves, besides this move, is selected for use at random. Fails if the user is not asleep. The selected move does not have PP deducted from it, and can currently have 0 PP. This move cannot select {move:beakblast}, {move:belch}, {move:copycat}, {move:focuspunch}, {move:uproar} or a two-turn move.",
    source: '46c71d64',
  },
  sludgebomb: {
    short: '30% chance to poison the target.',
    long: 'Has a 30% chance to poison the target.',
    source: 'd438bda9',
  },
  sludgewave: {
    short: '10% chance to poison adjacent Pokémon.',
    long: 'Has a 10% chance to poison the target.',
    source: 'ba4c3b28',
  },
  smackdown: {
    short: "Removes the target's {type:ground} immunity.",
    long: 'This move can hit a target using {move:bounce} or {move:fly}. If this move hits a target under the effect of {move:bounce}, {move:fly}, or {move:magnetrise}, the effect ends. If the target is a {type:flying} type that has not used {move:roost} this turn or a Pokémon with the {ability:levitate} Ability, it loses its immunity to {type:ground}-type attacks as long as it remains active. During the effect, {move:magnetrise} fails for the target and Telekinesis fails against the target.',
    source: 'cd944bd9',
  },
  smartstrike: {
    short: 'This move does not check accuracy.',
    source: '9ffadd27',
  },
  snaptrap: {
    short: 'Traps and damages the target for 4-5 turns.',
    long: 'Prevents the target from switching for four or five turns. Causes damage to the target equal to 1/8 of its maximum HP (1/6 if the user is holding {item:bindingband}), rounded down, at the end of each turn during effect. The target can still switch out if it is holding {item:shedshell} or uses {move:batonpass}, {move:flipturn}, {move:partingshot}, {move:shedtail}, {move:uturn}, or {move:voltswitch}. The effect ends if either the user or the target leaves the field, or if the target uses {move:mortalspin}, {move:rapidspin}, or {move:substitute} successfully. This effect is not stackable or reset by using this or another binding move.',
    source: '83b9c7de',
  },
  snarl: {
    short: '100% chance to lower the foe(s) Sp. Atk by 1.',
    long: "Has a 100% chance to lower the target's Special Attack by 1 stage.",
    source: '41e11271',
  },
  snipeshot: {
    short: 'High critical hit ratio. Cannot be redirected.',
    long: 'Has a higher chance for a critical hit. This move cannot be redirected to a different target by any effect.',
    source: '035ee399',
  },
  snore: {
    short: 'User must be asleep. 30% chance to flinch target.',
    long: 'Has a 30% chance to make the target flinch. Fails if the user is not asleep.',
    source: '3c5b1390',
  },
  snowscape: {
    short: 'For 5 turns, snow falls. {type:ice}: 1.5× Def.',
    long: 'For 5 turns, the weather becomes {condition:snow}. During the effect, the Defense of {type:ice}-type Pokémon is multiplied by 1.5 when taking damage from a physical attack. Lasts for 8 turns if the user is holding {item:icyrock}. Fails if the current weather is {condition:snow}.',
    source: '4899c587',
  },
  soak: {
    short: "Changes the target's type to {type:water}.",
    long: 'Causes the target to become a {type:water} type. Fails if the target is already purely {type:water} type.',
    source: 'ecf21d62',
  },
  solarbeam: {
    short: 'Charges turn 1. Hits turn 2. No charge in sunlight.',
    long: 'This attack charges on the first turn and executes on the second. Power is halved if the weather is {condition:rain}, {condition:sandstorm}, or {condition:snow}. If the weather is {condition:sun}, the move completes in one turn.',
    source: 'c13f77f8',
  },
  solarblade: {
    short: 'Charges turn 1. Hits turn 2. No charge in sunlight.',
    long: 'This attack charges on the first turn and executes on the second. Power is halved if the weather is {condition:rain}, {condition:sandstorm}, or {condition:snow}. If the weather is {condition:sun}, the move completes in one turn.',
    source: 'c13f77f8',
  },
  sparklingaria: {
    short: 'The target is cured of its burn.',
    long: 'If the user has not fainted, the target is cured of its burn.',
    source: 'f73e4a3c',
  },
  speedswap: {
    short: 'Swaps Speed stat with target.',
    long: 'The user swaps its Speed stat with the target. Stat stage changes are unaffected.',
    source: '2787a6e6',
  },
  spicyextract: {
    short: "Raises target's Atk by 2 and lowers its Def by 2.",
    long: "Raises the target's Attack by 2 stages and lowers its Defense by 2 stages.",
    source: '411eb610',
  },
  spikes: {
    short: 'Hurts grounded foes on switch-in. Max 3 layers.',
    long: 'Sets up a hazard on the opposing side of the field, damaging each opposing Pokémon that switches in, unless it is a {type:flying}-type Pokémon or has the {ability:levitate} Ability. Can be used up to three times before failing. Opponents lose 1/8 of their maximum HP with one layer, 1/6 of their maximum HP with two layers, and 1/4 of their maximum HP with three layers, all rounded down. Can be removed from the opposing side if any Pokémon uses {move:tidyup}, or if any opposing Pokémon uses {move:mortalspin}, {move:rapidspin}, or {move:defog} successfully, or is hit by {move:defog}.',
    source: '065f02c9',
  },
  spikyshield: {
    short: 'Protects from moves. Contact: loses 1/8 max HP.',
    long: "The user is protected from most attacks made by other Pokémon during this turn, and Pokémon making contact with the user lose 1/8 of their maximum HP, rounded down. This move has a 1/X chance of being successful, where X starts at 1 and triples each time this move is successfully used. X resets to 1 if this move fails, if the user's last move used is not {move:banefulbunker}, {move:detect}, {move:endure}, {move:kingsshield}, {move:protect}, {move:quickguard}, Spiky Shield, or {move:wideguard}, or if it was one of those moves and the user's protection was broken. Fails if the user moves last this turn.",
    source: 'e794c6f5',
  },
  spiritbreak: {
    short: "100% chance to lower the target's Sp. Atk by 1.",
    long: "Has a 100% chance to lower the target's Special Attack by 1 stage.",
    source: '54fa4ecb',
  },
  spiritshackle: {
    short: 'Prevents the target from switching out.',
    long: 'Prevents the target from switching out. The target can still switch out if it is holding {item:shedshell} or uses {move:batonpass}, {move:flipturn}, {move:partingshot}, {move:uturn}, or {move:voltswitch}. The effect ends if either the user or the target leaves the field.',
    source: '373e0280',
  },
  spite: {
    short: "Lowers the PP of the target's last move by 4.",
    long: "Causes the target's last move used to lose 4 PP. Fails if the target has not made a move, if the move has 0 PP, or if it no longer knows the move.",
    source: '0c5046d6',
  },
  spitup: {
    short: 'More power with more uses of {move:stockpile}.',
    long: "Power is equal to 100 times the user's {move:stockpile} count. Fails if the user's {move:stockpile} count is 0. Whether or not this move is successful, the user's Defense and Special Defense decrease by as many stages as {move:stockpile} had increased them, and the user's {move:stockpile} count resets to 0.",
    source: '8f0c5b12',
  },
  stealthrock: {
    short: 'Hurts foes on switch-in. Factors {type:rock} weakness.',
    long: 'Sets up a hazard on the opposing side of the field, damaging each opposing Pokémon that switches in. Fails if the effect is already active on the opposing side. Foes lose 1/32, 1/16, 1/8, 1/4, or 1/2 of their maximum HP, rounded down, based on their weakness to the {type:rock} type; 0.25×, 0.5×, neutral, 2×, or 4×, respectively. Can be removed from the opposing side if any Pokémon uses {move:tidyup}, or if any opposing Pokémon uses {move:mortalspin}, {move:rapidspin}, or {move:defog} successfully, or is hit by {move:defog}.',
    source: '163d9b87',
  },
  steelbeam: {
    short: 'User loses 50% max HP.',
    long: 'Whether or not this move is successful and even if it would cause fainting, the user loses 1/2 of its maximum HP, rounded up, unless the user has the {ability:magicguard} Ability.',
    source: 'f844f7b7',
  },
  steelroller: {
    short: 'Fails if there is no terrain active. Ends the terrain.',
    long: 'Fails if there is no terrain active. Ends the effects of {condition:electricterrain}, {condition:grassyterrain}, {condition:mistyterrain}, and {condition:psychicterrain}.',
    source: '86f77c7a',
  },
  steelwing: {
    short: "10% chance to raise the user's Defense by 1.",
    long: "Has a 10% chance to raise the user's Defense by 1 stage.",
    source: '29148bb8',
  },
  stickyweb: {
    short: 'Lowers Speed of grounded foes by 1 on switch-in.',
    long: 'Sets up a hazard on the opposing side of the field, lowering the Speed by 1 stage of each opposing Pokémon that switches in, unless it is a {type:flying}-type Pokémon or has the {ability:levitate} Ability. Fails if the effect is already active on the opposing side. Can be removed from the opposing side if any Pokémon uses {move:tidyup}, or if any opposing Pokémon uses {move:mortalspin}, {move:rapidspin}, or {move:defog} successfully, or is hit by {move:defog}.',
    source: '7f0a36cf',
  },
  stockpile: {
    short: "Raises user's Defense, Sp. Def by 1. Max 3 uses.",
    long: "Raises the user's Defense and Special Defense by 1 stage. The user's Stockpile count increases by 1. Fails if the user's Stockpile count is 3. The user's Stockpile count is reset to 0 when it is no longer active.",
    source: '0bcba376',
  },
  stompingtantrum: {
    short: "Power doubles if the user's last move failed.",
    long: "Power doubles if the user's last move on the previous turn, including moves called by other moves or those used through {move:instruct} or the {ability:magicbounce} Ability, failed to do any of its normal effects, not including damage from an unsuccessful {move:highjumpkick}, or if the user was prevented from moving by any effect other than recharging. A move that was blocked by {move:banefulbunker}, {move:detect}, {move:kingsshield}, {move:protect}, {move:spikyshield}, {move:quickguard}, or {move:wideguard} will not double this move's power, nor will {move:bounce} or {move:fly} ending early due to the effect of {condition:gravity} or {move:smackdown}.",
    source: '7ee8b393',
  },
  stoneaxe: {
    short: "Sets {condition:stealthrock} on the target's side.",
    long: 'If this move is successful, it sets up a hazard on the opposing side of the field, damaging each opposing Pokémon that switches in. Foes lose 1/32, 1/16, 1/8, 1/4, or 1/2 of their maximum HP, rounded down, based on their weakness to the {type:rock} type; 0.25×, 0.5×, neutral, 2×, or 4×, respectively. Can be removed from the opposing side if any Pokémon uses {move:tidyup}, or if any opposing Pokémon uses {move:mortalspin}, {move:rapidspin}, or {move:defog} successfully, or is hit by {move:defog}.',
    source: 'a11bcb50',
  },
  stoneedge: {
    short: 'High critical hit ratio.',
    long: 'Has a higher chance for a critical hit.',
    source: 'f11e0024',
  },
  storedpower: {
    short: " + 20 power for each of the user's stat boosts.",
    long: "Power is equal to 20+(X × 20), where X is the user's total stat stage changes that are greater than 0.",
    source: '4ad4ad49',
  },
  stormthrow: {
    short: 'Always results in a critical hit.',
    long: 'This move is always a critical hit unless the target has the {ability:battlearmor} or {ability:shellarmor} Abilities.',
    source: '6a49d7ec',
  },
  strengthsap: {
    short: "User heals HP=target's Atk stat. Lowers Atk by 1.",
    long: "Lowers the target's Attack by 1 stage. The user restores its HP equal to the target's Attack stat calculated with its stat stage before this move was used. If {item:bigroot} is held by the user, the HP recovered is 1.3× normal, rounded half down. Fails if the target's Attack stat stage is -6.",
    source: '981882fc',
  },
  stringshot: {
    short: 'Lowers the foe(s) Speed by 2.',
    long: "Lowers the target's Speed by 2 stages.",
    source: 'a11fbea5',
  },
  strugglebug: {
    short: '100% chance to lower the foe(s) Sp. Atk by 1.',
    long: "Has a 100% chance to lower the target's Special Attack by 1 stage.",
    source: '41e11271',
  },
  stuffcheeks: {
    short: 'Fails unless a Berry is held. User eats Berry, Def +2.',
    long: 'Fails if the user is not holding a Berry. The user eats its Berry and raises its Defense by 2 stages. This effect is not prevented by the {ability:klutz} or {ability:unnerve} Abilities, or the effect of {move:magicroom}.',
    source: '704ae9d9',
  },
  stunspore: {
    short: 'Paralyzes the target.',
    source: 'b7961c34',
  },
  substitute: {
    short: 'User takes 1/4 its max HP to put in a substitute.',
    long: 'The user takes 1/4 of its maximum HP, rounded down, and puts it into a substitute to take its place in battle. The substitute is removed once enough damage is inflicted on it, if the user switches out or faints, or if any Pokémon uses {move:tidyup}. {move:batonpass} can be used to transfer the substitute to an ally, and the substitute will keep its remaining HP. Until the substitute is broken, it receives damage from all attacks made by other Pokémon and shields the user from status effects and stat stage changes caused by other Pokémon. Sound-based moves and Pokémon with the {ability:infiltrator} Ability ignore substitutes. The user still takes normal damage from weather and status effects while behind its substitute. If the substitute breaks during a multi-hit attack, the user will take damage from any remaining hits. If a substitute is created while the user is trapped by a binding move, the binding effect ends immediately. Fails if the user does not have enough HP remaining to create a substitute without fainting, or if it already has a substitute.',
    source: 'f120928b',
  },
  suckerpunch: {
    short: 'Usually goes first. Fails if target is not attacking.',
    long: 'Fails if the target did not select a physical attack, special attack, or Me First for use this turn, or if the target moves before the user.',
    source: '2a95424c',
  },
  sunnyday: {
    short: 'For 5 turns, intense sunlight powers {type:fire} moves.',
    long: 'For 5 turns, the weather becomes {condition:sun}. The damage of {type:fire}-type attacks is multiplied by 1.5 and the damage of {type:water}-type attacks is multiplied by 0.5 during the effect. Lasts for 8 turns if the user is holding {item:heatrock}. Fails if the current weather is {condition:sun}.',
    source: 'a8787618',
  },
  supercellslam: {
    short: 'User is hurt by 50% of its max HP if it misses.',
    long: 'If this attack is not successful, the user loses half of its maximum HP, rounded down, as crash damage. Pokémon with the {ability:magicguard} Ability are unaffected by crash damage. Damage doubles and no accuracy check is done if the target has used {move:minimize} while active.',
    source: 'ac62eff0',
  },
  superfang: {
    short: "Does damage equal to 1/2 target's current HP.",
    long: 'Deals damage to the target equal to half of its current HP, rounded down, but not less than 1 HP.',
    source: '46c66610',
  },
  superpower: {
    short: "Lowers the user's Attack and Defense by 1.",
    long: "Lowers the user's Attack and Defense by 1 stage.",
    source: 'a46bf500',
  },
  surf: {
    short: 'Hits adjacent Pokémon. Double damage on {move:dive}.',
    long: 'Damage doubles if the target is using {move:dive}.',
    source: '675ea0ae',
  },
  swagger: {
    short: "Raises the target's Attack by 2 and confuses it.",
    long: "Raises the target's Attack by 2 stages and confuses it.",
    source: 'cea9b778',
  },
  swallow: {
    short: 'Heals the user based on uses of {move:stockpile}.',
    long: "The user restores its HP based on its {move:stockpile} count. Restores 1/4 of its maximum HP if it's 1, 1/2 of its maximum HP if it's 2, both rounded half down, and all of its HP if it's 3. Fails if the user's {move:stockpile} count is 0. The user's Defense and Special Defense decrease by as many stages as {move:stockpile} had increased them, and the user's {move:stockpile} count resets to 0.",
    source: '3a69fa75',
  },
  sweetkiss: {
    short: 'Causes the target to become confused.',
    source: 'cf021926',
  },
  sweetscent: {
    short: 'Lowers the foe(s) evasiveness by 2.',
    long: "Lowers the target's evasiveness by 2 stages.",
    source: 'b2e0800d',
  },
  switcheroo: {
    short: "User switches its held item with the target's.",
    long: "The user swaps its held item with the target's held item. Fails if both the user and the target have no held item, or if the user is trying to give or take a Mega Stone to or from the species that can Mega Evolve with it. The target is immune to this move if it has the {ability:stickyhold} Ability.",
    source: '90d60498',
  },
  swordsdance: {
    short: "Raises the user's Attack by 2.",
    long: "Raises the user's Attack by 2 stages.",
    source: 'c97b6afb',
  },
  synthesis: {
    short: 'Heals the user by a weather-dependent amount.',
    long: 'The user restores 1/2 of its maximum HP if no weather is in effect, 2/3 of its maximum HP if the weather is {condition:sun}, and 1/4 of its maximum HP if the weather is {condition:rain}, {condition:sandstorm}, or {condition:snow}, all rounded half down.',
    source: '97c7b43c',
  },
  syrupbomb: {
    short: "Target's Speed is lowered by 1 stage for 3 turns.",
    long: "If this move is successful, it causes the target's Speed to be lowered by 1 stage at the end of each turn for 3 turns.",
    source: '395ef3bf',
  },
  tailslap: {
    short: 'Hits 2-5 times in one turn.',
    long: "Hits two to five times. Has a 35% chance to hit two or three times and a 15% chance to hit four or five times. If one of the hits breaks the target's substitute, it will take damage for the remaining hits. If the user has the {ability:skilllink} Ability, this move will always hit five times.",
    source: '1487e33a',
  },
  tailwind: {
    short: "For 4 turns, allies' Speed is doubled.",
    long: "For 4 turns, the user and its party members have their Speed doubled. Fails if this move is already in effect for the user's side.",
    source: '0ff5f2da',
  },
  taunt: {
    short: "Target can't use status moves its next 3 turns.",
    long: 'Prevents the target from using non-damaging moves for its next three turns. Pokémon with the {ability:oblivious} Ability or protected by the {ability:aromaveil} Ability are immune.',
    source: '84a64f20',
  },
  tearfullook: {
    short: "Lowers the target's Attack and Sp. Atk by 1.",
    long: "Lowers the target's Attack and Special Attack by 1 stage.",
    source: '4efc003d',
  },
  teatime: {
    short: 'All active Pokémon consume held Berries.',
    long: 'All active Pokémon consume their held Berries. This effect is not prevented by substitutes, the {ability:klutz} or {ability:unnerve} Abilities, or the effect of {move:magicroom}. Fails if no active Pokémon is holding a Berry.',
    source: 'f07ef4c1',
  },
  teeterdance: {
    short: 'Confuses adjacent Pokémon.',
    long: 'Causes the target to become confused.',
    source: 'c3ebf6af',
  },
  temperflare: {
    short: "Power doubles if the user's last move failed.",
    long: "Power doubles if the user's last move on the previous turn, including moves called by other moves or those used through {move:instruct} or the {ability:magicbounce} Ability, failed to do any of its normal effects, not including damage from an unsuccessful {move:highjumpkick}, or if the user was prevented from moving by any effect other than recharging. A move that was blocked by {move:banefulbunker}, {move:detect}, {move:kingsshield}, {move:protect}, {move:spikyshield}, {move:quickguard}, or {move:wideguard} will not double this move's power, nor will {move:bounce} or {move:fly} ending early due to the effect of {condition:gravity} or {move:smackdown}.",
    source: '7ee8b393',
  },
  terrainpulse: {
    short: 'User on terrain: power doubles, type varies.',
    long: "Power doubles if the user is grounded and a terrain is active, and this move's type changes to match. {type:electric} type during {condition:electricterrain}, {type:grass} type during {condition:grassyterrain}, {type:fairy} type during {condition:mistyterrain}, and {type:psychic} type during {condition:psychicterrain}.",
    source: '4106629b',
  },
  thief: {
    short: "If the user has no item, it steals the target's.",
    long: "If this attack was successful and the user is not holding an item, it steals the target's held item. A target with the {ability:stickyhold} Ability does not lose its held item if it has not fainted. The target's item is not stolen if it is a Mega Stone and either the user or the target is the species that can Mega Evolve with it. Items lost to this move cannot be regained with {move:recycle} or the {ability:harvest} Ability.",
    source: '0c04545f',
  },
  thrash: {
    short: 'Lasts 2-3 turns. Confuses the user afterwards.',
    long: 'The user spends two or three turns locked into this move and becomes confused immediately after its move on the last turn of the effect if it is not already. This move targets an opposing Pokémon at random on each turn. If the user is prevented from moving, is asleep at the beginning of a turn, or the attack is not successful against the target on the first turn of the effect or the second turn of a three-turn effect, the effect ends without causing confusion. If this move is called by {move:sleeptalk} and the user is asleep, the move is used for one turn and does not confuse the user.',
    source: '02b19c9b',
  },
  throatchop: {
    short: 'For 2 turns, the target cannot use sound moves.',
    long: 'For 2 turns, the target cannot use sound-based moves.',
    source: '2472de12',
  },
  thunder: {
    short: "30% chance to paralyze. Can't miss in rain.",
    long: "Has a 30% chance to paralyze the target. This move can hit a target using {move:bounce} or {move:fly}. If the weather is {condition:rain}, this move does not check accuracy. If the weather is {condition:sun}, this move's accuracy is 50%.",
    source: '775c0299',
  },
  thunderbolt: {
    short: '10% chance to paralyze the target.',
    long: 'Has a 10% chance to paralyze the target.',
    source: '3762f758',
  },
  thunderfang: {
    short: '10% chance to paralyze. 10% chance to flinch.',
    long: 'Has a 10% chance to paralyze the target and a 10% chance to make it flinch.',
    source: '5519c9d6',
  },
  thunderpunch: {
    short: '10% chance to paralyze the target.',
    long: 'Has a 10% chance to paralyze the target.',
    source: '3762f758',
  },
  thunderwave: {
    short: 'Paralyzes the target.',
    long: 'Paralyzes the target. This move does not ignore type immunity.',
    source: '27e63c77',
  },
  tickle: {
    short: "Lowers the target's Attack and Defense by 1.",
    long: "Lowers the target's Attack and Defense by 1 stage.",
    source: 'c14fec67',
  },
  tidyup: {
    short: 'User +1 Atk, Spe. Clears all substitutes/hazards.',
    long: "Raises the user's Attack and Speed by 1 stage. Removes substitutes from all active Pokémon and ends the effects of {condition:spikes}, {condition:stealthrock}, {condition:stickyweb}, and {condition:toxicspikes} for both sides.",
    source: 'aa33fc30',
  },
  topsyturvy: {
    short: "Inverts the target's stat stages.",
    long: "The target's positive stat stages become negative and vice versa. Fails if all of the target's stat stages are 0.",
    source: 'e50f2b76',
  },
  torchsong: {
    short: "100% chance to raise the user's Sp. Atk by 1.",
    long: "Has a 100% chance to raise the user's Special Attack by 1 stage.",
    source: 'afa98db2',
  },
  torment: {
    short: "Target can't select the same move twice in a row.",
    long: 'Prevents the target from selecting the same move for use two turns in a row. This effect ends when the target is no longer active.',
    source: 'cf7aa599',
  },
  toxic: {
    short: "Badly poisons the target. {type:poison} types can't miss.",
    long: 'Badly poisons the target. If a {type:poison}-type Pokémon uses this move, the target cannot avoid the attack, even if the target is in the middle of a two-turn move.',
    source: '949d2d7a',
  },
  toxicspikes: {
    short: 'Poisons grounded foes on switch-in. Max 2 layers.',
    long: 'Sets up a hazard on the opposing side of the field, poisoning each opposing Pokémon that switches in, unless it is a {type:flying}-type Pokémon or has the {ability:levitate} Ability. Can be used up to two times before failing. Opposing Pokémon become poisoned with one layer and badly poisoned with two layers. Can be removed from the opposing side if any Pokémon uses {move:tidyup}, or if any opposing Pokémon uses {move:mortalspin}, {move:rapidspin}, or {move:defog} successfully, is hit by {move:defog}, or a grounded {type:poison}-type Pokémon switches in. {move:safeguard} prevents the opposing party from being poisoned on switch-in, but a substitute does not.',
    source: '7f7a7497',
  },
  toxicthread: {
    short: "Lowers the target's Speed by 2 and poisons it.",
    long: "Lowers the target's Speed by 2 stages and poisons it.",
    source: '78ba9213',
  },
  trailblaze: {
    short: "100% chance to raise the user's Speed by 1.",
    long: "Has a 100% chance to raise the user's Speed by 1 stage.",
    source: 'b5915159',
  },
  transform: {
    short: "Copies target's stats, moves, types, and Ability.",
    long: "The user transforms into the target. The target's current stats, stat stages, types, moves, Ability, weight, gender and appearance are copied. The user's level and HP remain the same and each copied move receives only 5 PP, with a maximum of 5 PP each. The user can no longer change formes if it would have the ability to do so. This move fails if it hits a substitute, if either the user or the target is already transformed, or if either is behind an {ability:illusion}.",
    source: '00330c8a',
  },
  triattack: {
    short: '20% chance to paralyze or burn or freeze target.',
    long: 'Has a 20% chance to either burn, freeze, or paralyze the target.',
    source: '5dac38fd',
  },
  trick: {
    short: "User switches its held item with the target's.",
    long: "The user swaps its held item with the target's held item. Fails if both the user and the target have no held item, or if the user is trying to give or take a Mega Stone to or from the species that can Mega Evolve with it. The target is immune to this move if it has the {ability:stickyhold} Ability.",
    source: '90d60498',
  },
  trickortreat: {
    short: "Adds {type:ghost} to the target's type(s).",
    long: 'Causes the {type:ghost} type to be added to the target, effectively making it have two or three types. Fails if the target is already a {type:ghost} type. If {move:forestscurse} adds a type to the target, it replaces the type added by this move and vice versa.',
    source: 'f91e8cf3',
  },
  trickroom: {
    short: 'Goes last. For 5 turns, turn order is reversed.',
    long: "For 5 turns, slower Pokémon move first within each priority bracket: each Pokémon's Speed is considered to be (10000 - its normal Speed) for the purposes of turn order. If this move is used during the effect, the effect ends.",
    source: 'aec56a23',
  },
  triplearrows: {
    short: 'High crit. Target: 50% -1 Defense, 30% flinch.',
    long: "Has a 50% chance to lower the target's Defense by 1 stage, a 30% chance to make it flinch, and a higher chance for a critical hit.",
    source: '95ae0705',
  },
  tripleaxel: {
    short: 'Hits 3 times. Each hit can miss, but power rises.',
    long: "Hits three times. Power increases to 40 for the second hit and 60 for the third. This move checks accuracy for each hit, and the attack ends if the target avoids a hit. If one of the hits breaks the target's substitute, it will take damage for the remaining hits. If the user has the {ability:skilllink} Ability, this move will always hit three times.",
    source: '7723a2fb',
  },
  tropkick: {
    short: "100% chance to lower the target's Attack by 1.",
    long: "Has a 100% chance to lower the target's Attack by 1 stage.",
    source: '4f51a815',
  },
  twinbeam: {
    short: 'Hits 2 times in one turn.',
    long: "Hits twice. If the first hit breaks the target's substitute, it will take damage for the second hit.",
    source: 'e025d196',
  },
  upperhand: {
    short: '100% flinch. Fails unless target using priority attack.',
    long: 'Has a 100% chance to make the target flinch. Fails if the target did not select a physical or special attack for use this turn with altered priority greater than 0, or if the target moves before the user.',
    source: 'e6f6c4a8',
  },
  uproar: {
    short: 'Lasts 3 turns. Active Pokémon cannot fall asleep.',
    long: 'The user spends three turns locked into this move. This move targets an opponent at random on each turn. On the first of the three turns, all sleeping active Pokémon wake up. During the three turns, no active Pokémon can fall asleep by any means, and Pokémon switched in during the effect do not wake up. If the user is prevented from moving or the attack is not successful against the target during one of the turns, the effect ends.',
    source: 'cba39eae',
  },
  uturn: {
    short: 'User switches out after damaging the target.',
    long: 'If this move is successful and the user has not fainted, the user switches out even if it is trapped and is replaced immediately by a selected party member. The user does not switch out if there are no unfainted party members, or if the target switched out using an {item:ejectbutton} or through the effect of the {ability:emergencyexit} Ability.',
    source: '8091320d',
  },
  vacuumwave: {
    short: 'Usually goes first.',
    source: 'a92f0fe3',
  },
  venoshock: {
    short: 'Power doubles if the target is poisoned.',
    source: 'ae8dd3f1',
  },
  voltswitch: {
    short: 'User switches out after damaging the target.',
    long: 'If this move is successful and the user has not fainted, the user switches out even if it is trapped and is replaced immediately by a selected party member. The user does not switch out if there are no unfainted party members, or if the target switched out using an {item:ejectbutton} or through the effect of the {ability:emergencyexit} Ability.',
    source: '8091320d',
  },
  volttackle: {
    short: 'Has 33% recoil. 10% chance to paralyze target.',
    long: 'Has a 10% chance to paralyze the target. If the target lost HP, the user takes recoil damage equal to 33% the HP lost by the target, rounded half up, but not less than 1 HP.',
    source: '3e43d945',
  },
  waterfall: {
    short: '20% chance to make the target flinch.',
    long: 'Has a 20% chance to make the target flinch.',
    source: 'a9ffb1d9',
  },
  waterpulse: {
    short: '20% chance to confuse the target.',
    long: 'Has a 20% chance to confuse the target.',
    source: '27833a5f',
  },
  watershuriken: {
    short: 'Usually goes first. Hits 2-5 times in one turn.',
    long: "Hits two to five times. Has a 35% chance to hit two or three times and a 15% chance to hit four or five times. If one of the hits breaks the target's substitute, it will take damage for the remaining hits. If the user has the {ability:skilllink} Ability, this move will always hit five times.",
    source: '24d2d2ef',
  },
  waterspout: {
    short: "Less power as user's HP decreases. Hits foe(s).",
    long: "Power is equal to (user's current HP × 150 / user's maximum HP), rounded down, but not less than 1.",
    source: 'c7990bd0',
  },
  wavecrash: {
    short: 'Has 33% recoil.',
    long: 'If the target lost HP, the user takes recoil damage equal to 33% the HP lost by the target, rounded half up, but not less than 1 HP.',
    source: '8774d4f8',
  },
  weatherball: {
    short: 'Power doubles and type varies in each weather.',
    long: "Power doubles if a weather condition is active, and this move's type changes to match. {type:ice} type during {condition:snow}, {type:water} type during {condition:rain}, {type:rock} type during {condition:sandstorm}, and {type:fire} type during {condition:sun}.",
    source: '128088d2',
  },
  whirlpool: {
    short: 'Traps and damages the target for 4-5 turns.',
    long: 'Prevents the target from switching for four or five turns. Causes damage to the target equal to 1/8 of its maximum HP (1/6 if the user is holding {item:bindingband}), rounded down, at the end of each turn during effect. The target can still switch out if it is holding {item:shedshell} or uses {move:batonpass}, {move:flipturn}, {move:partingshot}, {move:shedtail}, {move:uturn}, or {move:voltswitch}. The effect ends if either the user or the target leaves the field, or if the target uses {move:mortalspin}, {move:rapidspin}, or {move:substitute} successfully. This effect is not stackable or reset by using this or another binding move.',
    source: '83b9c7de',
  },
  whirlwind: {
    short: 'Forces the target to switch to a random ally.',
    long: 'The target is forced to switch out and be replaced with a random unfainted ally. Fails if the target is the last unfainted Pokémon in its party, or if the target used {move:ingrain} previously or has the {ability:suctioncups} Ability.',
    source: '6271fec1',
  },
  wideguard: {
    short: 'Protects allies from multi-target moves this turn.',
    long: "The user and its party members are protected from moves made by other Pokémon, including allies, during this turn that target all adjacent foes or all adjacent Pokémon. This move modifies the same 1/X chance of being successful used by other protection moves, where X starts at 1 and triples each time this move is successfully used, but does not use the chance to check for failure. X resets to 1 if this move fails, if the user's last move used is not {move:banefulbunker}, {move:detect}, {move:endure}, {move:kingsshield}, {move:protect}, {move:quickguard}, {move:spikyshield}, or Wide Guard, or if it was one of those moves and the user's protection was broken. Fails if the user moves last this turn or if this move is already in effect for the user's side.",
    source: 'ffd46a10',
  },
  wildcharge: {
    short: 'Has 1/4 recoil.',
    long: 'If the target lost HP, the user takes recoil damage equal to 1/4 the HP lost by the target, rounded half up, but not less than 1 HP.',
    source: 'c4edb33b',
  },
  willowisp: {
    short: 'Burns the target.',
    source: '6949fae0',
  },
  wish: {
    short: "Next turn, 50% of the user's max HP is restored.",
    long: "At the end of the next turn, the Pokémon at the user's position has 1/2 of the user's maximum HP restored to it, rounded down. Fails if this move is already in effect for the user's position.",
    source: '8ab450db',
  },
  wonderroom: {
    short: 'For 5 turns, all Defense and Sp. Def stats switch.',
    long: 'For 5 turns, all active Pokémon have their Defense and Special Defense stats swapped. Stat stage changes are unaffected. If this move is used during the effect, the effect ends.',
    source: '166f60c6',
  },
  woodhammer: {
    short: 'Has 33% recoil.',
    long: 'If the target lost HP, the user takes recoil damage equal to 33% the HP lost by the target, rounded half up, but not less than 1 HP.',
    source: '8774d4f8',
  },
  worryseed: {
    short: "The target's Ability becomes {ability:insomnia}.",
    long: "Causes the target's Ability to become {ability:insomnia}. Fails if the target's Ability is As One, {ability:battlebond}, {ability:disguise}, Gulp Missile, Ice Face, {ability:insomnia}, Shields Down, {ability:stancechange}, or {ability:zerotohero}.",
    source: 'c6a2a773',
  },
  wrap: {
    short: 'Traps and damages the target for 4-5 turns.',
    long: 'Prevents the target from switching for four or five turns. Causes damage to the target equal to 1/8 of its maximum HP (1/6 if the user is holding {item:bindingband}), rounded down, at the end of each turn during effect. The target can still switch out if it is holding {item:shedshell} or uses {move:batonpass}, {move:flipturn}, {move:partingshot}, {move:shedtail}, {move:uturn}, or {move:voltswitch}. The effect ends if either the user or the target leaves the field, or if the target uses {move:mortalspin}, {move:rapidspin}, or {move:substitute} successfully. This effect is not stackable or reset by using this or another binding move.',
    source: '83b9c7de',
  },
  xscissor: {
    short: 'No additional effect.',
    source: 'db89be13',
  },
  yawn: {
    short: 'Puts the target to sleep after 1 turn.',
    long: 'Causes the target to fall asleep at the end of the next turn. Fails when used if the target cannot fall asleep or if it already has a non-volatile status condition. At the end of the next turn, if the target is still active, does not have a non-volatile status condition, and can fall asleep, it falls asleep. If the target becomes affected, this effect cannot be prevented by {move:safeguard} or a substitute, or by falling asleep and waking up during the effect.',
    source: '8352b7e4',
  },
  zapcannon: {
    short: '100% chance to paralyze the target.',
    long: 'Has a 100% chance to paralyze the target.',
    source: 'bf5e33c9',
  },
  zenheadbutt: {
    short: '20% chance to make the target flinch.',
    long: 'Has a 20% chance to make the target flinch.',
    source: 'a9ffb1d9',
  },
  zingzap: {
    short: '30% chance to make the target flinch.',
    long: 'Has a 30% chance to make the target flinch.',
    source: 'a0cdf44a',
  },
}
