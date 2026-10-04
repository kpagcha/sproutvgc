// Our English ability descriptions, written from Showdown's (in `src/data/generated/abilities.json`) with references
// to other dex entries embedded as markers: `{type:flying}`, `{move:taunt}`, `{ability:scrappy}`, `{item:ironball}`.
// A marker shows the entry's name in the reader's language, linked once its category has pages. Entries the
// regulation doesn't have are plain text. No imports: `scripts/gen-data.ts` reads this file too.

export interface Description {
  short: string
  /** Only when there's more to say than `short`. */
  long?: string
  /**
   * The Showdown text this was written from (`hashText` in `scripts/gen-data.ts` of its short and long descriptions).
   * `npm run gen-data` lists the entries whose source has changed since, to revise.
   */
  source: string
}

/** By ability ID. */
export const descriptions: Record<string, Description> = {
  adaptability: {
    short: "This Pokémon's same-type attack bonus (STAB) is 2 instead of 1.5.",
    long: "This Pokémon's moves that match one of its types have a same-type attack bonus (STAB) of 2 instead of 1.5.",
    source: '8ac8e5c0',
  },
  aerilate: {
    short: "This Pokémon's {type:normal}-type moves become {type:flying} type and have 1.2× power.",
    long: "This Pokémon's {type:normal}-type moves become {type:flying}-type moves and have their power multiplied by 1.2. This effect comes after other effects that change a move's type, but before Ion Deluge and {move:electrify}'s effects.",
    source: '6a09f7ed',
  },
  aftermath: {
    short: "If this Pokémon is KOed with a contact move, that move's user loses 1/4 its max HP.",
    long: "If this Pokémon is knocked out with a contact move, that move's user loses 1/4 of its maximum HP, rounded down. This effect is prevented if the move's user has the {ability:magicguard} Ability or if any active Pokémon has the {ability:damp} Ability.",
    source: 'fde47fa9',
  },
  analytic: {
    short: "This Pokémon's attacks have 1.3× power if it is the last to move in a turn.",
    long: "The power of this Pokémon's move is multiplied by 1.3 if it is the last to move in a turn. Does not affect Doom Desire and {move:futuresight}.",
    source: 'b123b5fd',
  },
  angerpoint: {
    short: 'If this Pokémon (not its substitute) takes a critical hit, its Attack is raised 12 stages.',
    long: 'If this Pokémon, but not its substitute, is struck by a critical hit, its Attack is raised by 12 stages.',
    source: 'db472df5',
  },
  anticipation: {
    short: 'On switch-in, this Pokémon shudders if any foe has a supereffective or OHKO move.',
    long: 'On switch-in, this Pokémon is alerted if any opposing Pokémon has an attacking move with a type that is super effective against this Pokémon, or any OHKO move. This effect considers Hidden Power to be its determined type, and every other move to be its original type.',
    source: 'ef8b7775',
  },
  armortail: {
    short: 'This Pokémon and its allies are protected from opposing priority moves.',
    long: 'Priority moves used by opposing Pokémon targeting this Pokémon or its allies are prevented from having an effect.',
    source: '6ef1d29c',
  },
  aromaveil: {
    short:
      'Protects user/allies from {move:attract}, {move:disable}, {move:encore}, Heal Block, {move:taunt}, and {move:torment}.',
    long: 'This Pokémon and its allies cannot become affected by {move:attract}, {move:disable}, {move:encore}, Heal Block, {move:taunt}, or {move:torment}.',
    source: '3c0f2da6',
  },
  auraguard: {
    short: 'This Pokémon takes 1/2 damage from contact moves.',
    long: 'This Pokémon receives 1/2 damage from contact moves.',
    source: 'f4a6aecc',
  },
  battlearmor: {
    short: 'This Pokémon cannot be struck by a critical hit.',
    source: 'e450823c',
  },
  battlebond: {
    short: 'After KOing a Pokémon: raises Attack, Sp. Atk, Speed by 1 stage. Once per battle.',
    long: 'If this Pokémon is a Greninja, its Attack, Special Attack, and Speed are raised by 1 stage if it attacks and knocks out another Pokémon. This effect can only happen once per battle.',
    source: '66a6fe56',
  },
  berserk: {
    short: "This Pokémon's Sp. Atk is raised by 1 when it reaches 1/2 or less of its max HP.",
    long: 'When this Pokémon has more than 1/2 its maximum HP and takes damage from an attack bringing it to 1/2 or less of its maximum HP, its Special Attack is raised by 1 stage. This effect applies after all hits from a multi-hit move. This effect is prevented if the move had a secondary effect removed by the {ability:sheerforce} Ability.',
    source: 'cd0f4a5e',
  },
  bigpecks: {
    short: "Prevents other Pokémon from lowering this Pokémon's Defense stat stage.",
    source: '730aac57',
  },
  blaze: {
    short: "At 1/3 or less of its max HP, this Pokémon's offensive stat is 1.5× with {type:fire} attacks.",
    long: 'When this Pokémon has 1/3 or less of its maximum HP, rounded down, its offensive stat is multiplied by 1.5 while using a {type:fire}-type attack.',
    source: 'aeba103e',
  },
  bulletproof: {
    short: 'This Pokémon is immune to bullet moves.',
    source: '8d3645ed',
  },
  cheekpouch: {
    short: "If this Pokémon eats a Berry, it restores 1/3 of its max HP after the Berry's effect.",
    long: "If this Pokémon eats a held Berry, it restores 1/3 of its maximum HP, rounded down, in addition to the Berry's effect. This effect can also activate after the effects of {move:bugbite}, {move:fling}, {move:pluck}, {move:stuffcheeks}, and {move:teatime} if the eaten Berry had an effect on this Pokémon.",
    source: '4d76028f',
  },
  chlorophyll: {
    short: "If {condition:sun} is active, this Pokémon's Speed is doubled.",
    long: "If {condition:sun} is active, this Pokémon's Speed is doubled. This effect is prevented if this Pokémon is holding a Utility Umbrella.",
    source: '7285502d',
  },
  clearbody: {
    short: "Prevents other Pokémon from lowering this Pokémon's stat stages.",
    source: '39daef73',
  },
  cloudnine: {
    short: 'While this Pokémon is active, the effects of weather conditions are disabled.',
    source: '41050bd4',
  },
  competitive: {
    short: "This Pokémon's Sp. Atk is raised by 2 for each of its stats that is lowered by a foe.",
    long: "This Pokémon's Special Attack is raised by 2 stages for each of its stat stages that is lowered by an opposing Pokémon.",
    source: 'cc8d9951',
  },
  compoundeyes: {
    short: "This Pokémon's moves have their accuracy multiplied by 1.3.",
    source: '61bdc96b',
  },
  contrary: {
    short: 'If this Pokémon has a stat stage raised it is lowered instead, and vice versa.',
    source: 'a24ef8e5',
  },
  corrosion: {
    short: 'This Pokémon can poison or badly poison a Pokémon regardless of its typing.',
    source: 'ea9e310e',
  },
  cudchew: {
    short: 'If this Pokémon eats a Berry, it will eat that Berry again at the end of the next turn.',
    source: '5604bec8',
  },
  curiousmedicine: {
    short: "On switch-in, this Pokémon's allies have their stat stages reset to 0.",
    source: '5872bc99',
  },
  cursedbody: {
    short: 'If this Pokémon is hit by an attack, there is a 30% chance that move gets disabled.',
    long: "If this Pokémon is hit by an attack, there is a 30% chance that move gets disabled unless one of the attacker's moves is already disabled.",
    source: '9e07ad79',
  },
  cutecharm: {
    short: '30% chance of infatuating Pokémon of the opposite gender if they make contact.',
    long: 'There is a 30% chance a Pokémon making contact with this Pokémon will become infatuated if it is of the opposite gender.',
    source: '976b60ef',
  },
  damp: {
    short:
      'Prevents {move:explosion}/Mind Blown/{move:mistyexplosion}/{move:selfdestruct}/{ability:aftermath} while active.',
    long: 'While this Pokémon is active, {move:explosion}, Mind Blown, {move:mistyexplosion}, {move:selfdestruct}, and the {ability:aftermath} Ability are prevented from having an effect.',
    source: '95b3d0d2',
  },
  defiant: {
    short: "This Pokémon's Attack is raised by 2 for each of its stats that is lowered by a foe.",
    long: "This Pokémon's Attack is raised by 2 stages for each of its stat stages that is lowered by an opposing Pokémon.",
    source: 'b355b4e2',
  },
  disguise: {
    short: '(Mimikyu only) The first hit it takes is blocked, and it takes 1/8 HP damage instead.',
    long: 'If this Pokémon is a Mimikyu, the first hit it takes in battle deals 0 neutral damage. Its disguise is then broken, it changes to Busted Form, and it loses 1/8 of its max HP. Confusion damage also breaks the disguise.',
    source: '36947bef',
  },
  dragonize: {
    short: "This Pokémon's {type:normal}-type moves become {type:dragon} type and have 1.2× power.",
    long: "This Pokémon's {type:normal}-type moves become {type:dragon}-type moves and have their power multiplied by 1.2. This effect comes after other effects that change a move's type, but before Ion Deluge and {move:electrify}'s effects.",
    source: '334a3fd0',
  },
  drizzle: {
    short: 'On switch-in, this Pokémon summons {condition:rain}.',
    source: 'c2cfffae',
  },
  drought: {
    short: 'On switch-in, this Pokémon summons {condition:sun}.',
    source: '93415575',
  },
  dryskin: {
    short:
      'This Pokémon is healed 1/4 by {type:water}, 1/8 by {condition:rain}; is hurt 1.25× by {type:fire}, 1/8 by {condition:sun}.',
    long: 'This Pokémon is immune to {type:water}-type moves and restores 1/4 of its maximum HP, rounded down, when hit by a {type:water}-type move. The power of {type:fire}-type moves is multiplied by 1.25 when used on this Pokémon. At the end of each turn, this Pokémon restores 1/8 of its maximum HP, rounded down, if the weather is {condition:rain}, and loses 1/8 of its maximum HP, rounded down, if the weather is {condition:sun}. The weather effects are prevented if this Pokémon is holding a Utility Umbrella.',
    source: '7d121180',
  },
  earlybird: {
    short: "This Pokémon's sleep counter drops by 2 instead of 1.",
    source: '5b27a0d2',
  },
  eartheater: {
    short: 'This Pokémon heals 1/4 of its max HP when hit by {type:ground} moves; {type:ground} immunity.',
    long: 'This Pokémon is immune to {type:ground}-type moves and restores 1/4 of its maximum HP, rounded down, when hit by a {type:ground}-type move.',
    source: '6c288b6e',
  },
  eelevate: {
    short: 'This Pokémon is immune to {type:ground}; +1 to highest stat if it KOes another Pokémon.',
    long: "This Pokémon is immune to {type:ground}-type attacks and the effects of {condition:spikes}, {condition:toxicspikes}, {condition:stickyweb}, and the Arena Trap Ability. The effects of {condition:gravity}, {move:ingrain}, {move:smackdown}, Thousand Arrows, and {item:ironball} nullify the immunity. Thousand Arrows can hit this Pokémon as if it did not have this Ability. This Pokémon's highest stat is raised by 1 stage if it attacks and knocks out another Pokémon. Stat stage changes are not considered. If multiple stats are tied, Attack, Defense, Special Attack, Special Defense, and Speed are prioritized in that order.",
    source: 'fdeb54de',
  },
  effectspore: {
    short: '30% chance of poison/paralysis/sleep on others making contact with this Pokémon.',
    long: '30% chance a Pokémon making contact with this Pokémon will be poisoned, paralyzed, or fall asleep.',
    source: 'ce382f2a',
  },
  electricsurge: {
    short: 'On switch-in, this Pokémon summons {condition:electricterrain}.',
    source: 'aabde13f',
  },
  electromorphosis: {
    short: 'This Pokémon gains the {move:charge} effect when it takes a hit from an attack.',
    source: '0153077f',
  },
  embodyaspectcornerstone: {
    short: "On switch-in, this Pokémon's Defense is raised by 1 stage.",
    source: '545ed22f',
  },
  embodyaspecthearthflame: {
    short: "On switch-in, this Pokémon's Attack is raised by 1 stage.",
    source: '75c84c69',
  },
  embodyaspectteal: {
    short: "On switch-in, this Pokémon's Speed is raised by 1 stage.",
    source: '7c5d9e46',
  },
  embodyaspectwellspring: {
    short: "On switch-in, this Pokémon's Special Defense is raised by 1 stage.",
    source: '161517db',
  },
  emergencyexit: {
    short: 'This Pokémon switches out when it reaches 1/2 or less of its maximum HP.',
    long: 'When this Pokémon has more than 1/2 its maximum HP and takes damage bringing it to 1/2 or less of its maximum HP, it immediately switches out to a chosen ally. This effect applies after all hits from a multi-hit move. This effect is prevented if the move had a secondary effect removed by the {ability:sheerforce} Ability. This effect applies to both direct and indirect damage, except {move:curse} and {move:substitute} on use, {move:bellydrum}, {move:painsplit}, and confusion damage.',
    source: '09a76e05',
  },
  fairyaura: {
    short: 'While this Pokémon is active, a {type:fairy} move used by any Pokémon has 1.33× power.',
    long: 'While this Pokémon is active, the power of {type:fairy}-type moves used by active Pokémon is multiplied by 1.33.',
    source: '33072715',
  },
  filter: {
    short: 'This Pokémon receives 3/4 damage from supereffective attacks.',
    source: '43e3176a',
  },
  firemane: {
    short: "This Pokémon's offensive stat is multiplied by 1.5 while using a {type:fire}-type attack.",
    source: '19f7c106',
  },
  flamebody: {
    short: '30% chance a Pokémon making contact with this Pokémon will be burned.',
    source: 'd122ee4f',
  },
  flashfire: {
    short: "This Pokémon's {type:fire} attacks do 1.5× damage if hit by one {type:fire} move; {type:fire} immunity.",
    long: 'This Pokémon is immune to {type:fire}-type moves. The first time it is hit by a {type:fire}-type move, its offensive stat is multiplied by 1.5 while using a {type:fire}-type attack as long as it remains active and has this Ability. If this Pokémon is frozen, it cannot be defrosted by {type:fire}-type attacks.',
    source: '25d46c19',
  },
  flowerveil: {
    short: "This side's {type:grass} types can't have stats lowered or status inflicted by other Pokémon.",
    long: "{type:grass}-type Pokémon on this Pokémon's side cannot have their stat stages lowered by other Pokémon or have a non-volatile status condition inflicted on them by other Pokémon.",
    source: '0303d5df',
  },
  fluffy: {
    short: 'This Pokémon takes 1/2 damage from contact moves, 2× damage from {type:fire} moves.',
    long: 'This Pokémon receives 1/2 damage from contact moves, but double damage from {type:fire} moves.',
    source: '0d7d77b3',
  },
  forecast: {
    short: "Castform's type changes to the current weather condition's type, except {condition:sandstorm}.",
    long: "If this Pokémon is a Castform, its type changes to the current weather condition's type, except {condition:sandstorm}. This effect is prevented if this Pokémon is holding a Utility Umbrella and the weather is {condition:rain} or {condition:sun}.",
    source: 'c13329e8',
  },
  forewarn: {
    short: "On switch-in, this Pokémon is alerted to the foes' move with the highest power.",
    long: 'On switch-in, this Pokémon is alerted to the move with the highest power, at random, known by an opposing Pokémon. This effect considers OHKO moves to have 150 power, {move:counter}, {move:mirrorcoat}, and {move:metalburst} to have 120 power, every other attacking move with an unspecified power to have 80 power, and non-damaging moves to have 1 power.',
    source: 'e5538ee9',
  },
  friendguard: {
    short: "This Pokémon's allies receive 3/4 damage from other Pokémon's attacks.",
    source: '5fc796a5',
  },
  frisk: {
    short: 'On switch-in, this Pokémon identifies the held items of all opposing Pokémon.',
    source: 'c359b9ab',
  },
  furcoat: {
    short: "This Pokémon's Defense is doubled.",
    source: 'e56a405b',
  },
  galewings: {
    short: 'If this Pokémon is at full HP, its {type:flying}-type moves have their priority increased by 1.',
    source: '7767d344',
  },
  gluttony: {
    short: 'This Pokémon eats Berries at 1/2 max HP or less instead of their usual 1/4 max HP.',
    long: 'When this Pokémon is holding a Berry that usually activates with 1/4 or less of its maximum HP, it is eaten at 1/2 or less of its maximum HP instead.',
    source: 'ac1c0adf',
  },
  goodasgold: {
    short: 'This Pokémon is immune to Status moves.',
    source: '3992115c',
  },
  gooey: {
    short: 'Pokémon making contact with this Pokémon have their Speed lowered by 1 stage.',
    source: '7dc93ae2',
  },
  grasspelt: {
    short: "If {condition:grassyterrain} is active, this Pokémon's Defense is multiplied by 1.5.",
    source: 'a3338244',
  },
  grassysurge: {
    short: 'On switch-in, this Pokémon summons {condition:grassyterrain}.',
    source: '1aba1a29',
  },
  guarddog: {
    short: 'Immune to {ability:intimidate}. Intimidated: +1 Attack. Cannot be forced to switch out.',
    long: "This Pokémon is immune to the effect of the {ability:intimidate} Ability and raises its Attack by 1 stage instead. This Pokémon cannot be forced to switch out by another Pokémon's attack or item.",
    source: 'f66840d1',
  },
  gulpmissile: {
    short: 'When hit after {move:surf}/{move:dive}, attacker takes 1/4 max HP and -1 Defense or paralysis.',
    long: "If this Pokémon is a Cramorant, it changes forme when it hits a target with {move:surf} or uses the first turn of {move:dive} successfully. It becomes Gulping Form with an Arrokuda in its mouth if it has more than 1/2 of its maximum HP remaining, or Gorging Form with a Pikachu in its mouth if it has 1/2 or less of its maximum HP remaining. If Cramorant gets hit in Gulping or Gorging Form, it spits the Arrokuda or Pikachu at its attacker, even if it has no HP remaining. The projectile deals damage equal to 1/4 of the target's maximum HP, rounded down; this damage is blocked by the {ability:magicguard} Ability but not by a substitute. An Arrokuda also lowers the target's Defense by 1 stage, and a Pikachu paralyzes the target. Cramorant will return to normal if it spits out a projectile, switches out, or Dynamaxes.",
    source: '7c354619',
  },
  guts: {
    short: 'If this Pokémon is statused, its Attack is 1.5×; ignores burn halving physical damage.',
    long: "If this Pokémon has a non-volatile status condition, its Attack is multiplied by 1.5. This Pokémon's physical attacks ignore the burn effect of halving damage.",
    source: '5d616a6b',
  },
  harvest: {
    short: 'If last item used is a Berry, 50% chance to restore it each end of turn. 100% in {condition:sun}.',
    long: 'If the last item this Pokémon used is a Berry, there is a 50% chance it gets restored at the end of each turn. If {condition:sun} is active, this chance is 100%.',
    source: 'a8a5ae12',
  },
  healer: {
    short: "50% chance this Pokémon's ally has its status cured at the end of each turn.",
    long: "50% chance this Pokémon's ally has its non-volatile status condition cured at the end of each turn.",
    source: '69109850',
  },
  heatproof: {
    short: '{type:fire} damage against this Pokémon is dealt with 1/2 offensive stat; 1/2 burn damage.',
    long: "If a Pokémon uses a {type:fire}-type attack against this Pokémon, that Pokémon's offensive stat is halved when calculating the damage to this Pokémon. This Pokémon takes half of the usual burn damage, rounded down.",
    source: '1de49dc7',
  },
  heavymetal: {
    short: "This Pokémon's weight is doubled.",
    long: "This Pokémon's weight is doubled. This effect is calculated after the effect of Autotomize, and before the effect of Float Stone.",
    source: '5e845ef1',
  },
  hospitality: {
    short: "On switch-in, this Pokémon restores 1/4 of its ally's maximum HP, rounded down.",
    source: '3e2bb269',
  },
  hugepower: {
    short: "This Pokémon's Attack is doubled.",
    source: '32a82a96',
  },
  hungerswitch: {
    short: 'If Morpeko, it changes between Full Belly and Hangry Mode at the end of each turn.',
    long: 'If this Pokémon is a Morpeko, it changes formes between its Full Belly Mode and Hangry Mode at the end of each turn.',
    source: 'd416de2b',
  },
  hustle: {
    short: "This Pokémon's Attack is 1.5× and accuracy of its physical attacks is 0.8×.",
    long: "This Pokémon's Attack is multiplied by 1.5 and the accuracy of its physical attacks is multiplied by 0.8.",
    source: 'f06463c9',
  },
  hydration: {
    short: 'This Pokémon has its status cured at the end of each turn if {condition:rain} is active.',
    long: 'This Pokémon has its non-volatile status condition cured at the end of each turn if {condition:rain} is active. This effect is prevented if this Pokémon is holding a Utility Umbrella.',
    source: '8ad41ac0',
  },
  hypercutter: {
    short: "Prevents other Pokémon from lowering this Pokémon's Attack stat stage.",
    source: '5e7cb7cc',
  },
  icebody: {
    short: 'If {condition:snow} is active, this Pokémon heals 1/16 of its max HP each turn.',
    long: 'If {condition:snow} is active, this Pokémon restores 1/16 of its maximum HP, rounded down, at the end of each turn.',
    source: '8714dfae',
  },
  iceface: {
    short: 'If Eiscue, the first physical hit it takes deals 0 damage. Effect is restored in {condition:snow}.',
    long: 'If this Pokémon is an Eiscue, the first physical hit it takes in battle deals 0 neutral damage. Its ice face is then broken and it changes forme to Noice Face. Eiscue regains its Ice Face forme when {condition:snow} begins or when Eiscue switches in while {condition:snow} is active. Confusion damage also breaks the ice face.',
    source: '8d7af483',
  },
  illuminate: {
    short: "This Pokémon's accuracy can't be lowered by others; ignores their evasiveness stat.",
    long: "Prevents other Pokémon from lowering this Pokémon's accuracy stat stage. This Pokémon ignores a target's evasiveness stat stage.",
    source: '556d9bb5',
  },
  illusion: {
    short: 'This Pokémon appears as the last Pokémon in the party until it takes direct damage.',
    long: "When this Pokémon switches in, it appears as the last unfainted Pokémon in its party until it takes direct damage from another Pokémon's attack. This Pokémon's actual level and HP are displayed instead of those of the mimicked Pokémon.",
    source: '8c17fc3d',
  },
  immunity: {
    short: 'This Pokémon cannot be poisoned. Gaining this Ability while poisoned cures it.',
    source: '33f4485f',
  },
  imposter: {
    short: 'On switch-in, this Pokémon Transforms into the opposing Pokémon that is facing it.',
    long: 'On switch-in, this Pokémon Transforms into the opposing Pokémon that is facing it. If there is no Pokémon at that position, this Pokémon does not {move:transform}.',
    source: 'fba979f2',
  },
  infiltrator: {
    short:
      "Moves ignore substitutes and foe's {move:reflect}/{move:lightscreen}/{move:safeguard}/Mist/{move:auroraveil}.",
    long: "This Pokémon's moves ignore substitutes and the opposing side's {move:reflect}, {move:lightscreen}, {move:safeguard}, Mist, and {move:auroraveil}.",
    source: '6db00ee0',
  },
  innardsout: {
    short: "If this Pokémon is KOed with a move, that move's user loses an equal amount of HP.",
    long: "If this Pokémon is knocked out with a move, that move's user loses HP equal to the amount of damage inflicted on this Pokémon.",
    source: '84578508',
  },
  innerfocus: {
    short: 'This Pokémon cannot be made to flinch. Immune to {ability:intimidate}.',
    long: 'This Pokémon cannot be made to flinch. This Pokémon is immune to the effect of the {ability:intimidate} Ability.',
    source: 'dcad3e6e',
  },
  insomnia: {
    short: 'This Pokémon cannot fall asleep. Gaining this Ability while asleep cures it.',
    source: 'f2308e22',
  },
  intimidate: {
    short: 'On switch-in, this Pokémon lowers the Attack of opponents by 1 stage.',
    long: 'On switch-in, this Pokémon lowers the Attack of opposing Pokémon by 1 stage. Pokémon with the {ability:innerfocus}, {ability:oblivious}, {ability:owntempo}, or {ability:scrappy} Abilities and Pokémon behind a substitute are immune.',
    source: '2cdf906e',
  },
  ironfist: {
    short: "This Pokémon's punch-based attacks have 1.2× power. {move:suckerpunch} is not boosted.",
    long: "This Pokémon's punch-based attacks have their power multiplied by 1.2.",
    source: '36169c89',
  },
  justified: {
    short: "This Pokémon's Attack is raised by 1 stage after it is damaged by a {type:dark}-type move.",
    source: '5b7aa289',
  },
  keeneye: {
    short: "This Pokémon's accuracy can't be lowered by others; ignores their evasiveness stat.",
    long: "Prevents other Pokémon from lowering this Pokémon's accuracy stat stage. This Pokémon ignores a target's evasiveness stat stage.",
    source: '556d9bb5',
  },
  klutz: {
    short: "This Pokémon's held item has no effect, except Macho Brace. {move:fling} cannot be used.",
    long: "This Pokémon's held item has no effect. This Pokémon cannot use {move:fling} successfully. Macho Brace, Power Anklet, Power Band, Power Belt, Power Bracer, Power Lens, and Power Weight still have their effects.",
    source: '2dc75868',
  },
  leafguard: {
    short: 'If {condition:sun} is active, this Pokémon cannot be statused and {move:rest} will fail for it.',
    long: 'If {condition:sun} is active, this Pokémon cannot become affected by a non-volatile status condition or {move:yawn}, and {move:rest} will fail for it. This effect is prevented if this Pokémon is holding a Utility Umbrella.',
    source: '5764cb64',
  },
  levitate: {
    short:
      'This Pokémon is immune to {type:ground}; {condition:gravity}/{move:ingrain}/{move:smackdown}/{item:ironball} nullify it.',
    long: 'This Pokémon is immune to {type:ground}-type attacks and the effects of {condition:spikes}, {condition:toxicspikes}, {condition:stickyweb}, and the Arena Trap Ability. The effects of {condition:gravity}, {move:ingrain}, {move:smackdown}, Thousand Arrows, and {item:ironball} nullify the immunity. Thousand Arrows can hit this Pokémon as if it did not have this Ability.',
    source: 'a27f6b93',
  },
  libero: {
    short: "This Pokémon's type changes to the type of the move it is using. Once per switch-in.",
    long: "This Pokémon's type changes to match the type of the move it is about to use. This effect comes after all effects that change a move's type. This effect can only happen once per switch-in, and only if this Pokémon is not Terastallized.",
    source: '480d7e63',
  },
  lightmetal: {
    short: "This Pokémon's weight is halved.",
    long: "This Pokémon's weight is halved, rounded down to a tenth of a kilogram. This effect is calculated after the effect of Autotomize, and before the effect of Float Stone. A Pokémon's weight will not drop below 0.1 kg.",
    source: '40ff5d1b',
  },
  lightningrod: {
    short: 'This Pokémon draws {type:electric} moves to itself to raise Sp. Atk by 1; {type:electric} immunity.',
    long: 'This Pokémon is immune to {type:electric}-type moves and raises its Special Attack by 1 stage when hit by an {type:electric}-type move. If this Pokémon is not the target of a single-target {type:electric}-type move used by another Pokémon, this Pokémon redirects that move to itself if it is within the range of that move. If multiple Pokémon could redirect with this Ability, it goes to the one with the highest Speed, or in the case of a tie to the one that has had this Ability active longer.',
    source: '93d2d7a0',
  },
  limber: {
    short: 'This Pokémon cannot be paralyzed. Gaining this Ability while paralyzed cures it.',
    source: 'd3c9335e',
  },
  liquidooze: {
    short: 'This Pokémon damages those draining HP from it for as much as they would heal.',
    source: 'f2f5d17c',
  },
  liquidvoice: {
    short: "This Pokémon's sound-based moves become {type:water} type.",
    long: "This Pokémon's sound-based moves become {type:water}-type moves. This effect comes after other effects that change a move's type, but before Ion Deluge and {move:electrify}'s effects.",
    source: '1e986f5b',
  },
  longreach: {
    short: "This Pokémon's attacks do not make contact with the target.",
    source: 'd9d505f9',
  },
  magicbounce: {
    short: 'This Pokémon blocks certain Status moves and bounces them back to the user.',
    long: "This Pokémon is unaffected by certain non-damaging moves directed at it and will instead use such moves against the original user. Moves reflected in this way are unable to be reflected again by this or Magic Coat's effect. {condition:spikes}, {condition:stealthrock}, {condition:stickyweb}, and {condition:toxicspikes} can only be reflected once per side, by the leftmost Pokémon under this or Magic Coat's effect. The {ability:lightningrod} and Storm Drain Abilities redirect their respective moves before this Ability takes effect.",
    source: '27a399dd',
  },
  magicguard: {
    short: 'This Pokémon can only be damaged by direct attacks.',
    long: 'This Pokémon can only be damaged by direct attacks. {move:curse} and {move:substitute} on use, {move:bellydrum}, {move:painsplit}, Struggle recoil, and confusion damage are considered direct damage.',
    source: '784d1d87',
  },
  magician: {
    short: 'If this Pokémon has no item, it steals the item off a Pokémon it hits with an attack.',
    long: 'If this Pokémon has no item, it steals the item off a Pokémon it hits with an attack. Does not affect Doom Desire and {move:futuresight}. If multiple targets are hit by an attack the item is stolen from the fastest Pokémon, while considering the effect of {move:trickroom} and prioritizing opposing Pokémon before allies.',
    source: '30d5801c',
  },
  magmaarmor: {
    short: 'This Pokémon cannot be frozen. Gaining this Ability while frozen cures it.',
    source: '91b44f36',
  },
  marvelscale: {
    short: 'If this Pokémon has a non-volatile status condition, its Defense is multiplied by 1.5.',
    source: '437b4258',
  },
  megalauncher: {
    short: "This Pokémon's pulse moves have 1.5× power. {move:healpulse} heals 3/4 target's max HP.",
    long: "This Pokémon's pulse moves have their power multiplied by 1.5. {move:healpulse} restores 3/4 of a target's maximum HP, rounded half down.",
    source: '7419bd76',
  },
  megasol: {
    short: "This Pokémon's moves are used as if the effects of {condition:sun} were active.",
    source: '4e7b9677',
  },
  merciless: {
    short: "This Pokémon's attacks are critical hits if the target is poisoned.",
    source: '434f1a65',
  },
  mimicry: {
    short: "This Pokémon's types change to match the Terrain. Type reverts when Terrain ends.",
    long: "This Pokémon's types change to match the active Terrain when this Pokémon acquires this Ability, or whenever a Terrain begins. {type:electric} type during {condition:electricterrain}, {type:grass} type during {condition:grassyterrain}, {type:fairy} type during {condition:mistyterrain}, and {type:psychic} type during {condition:psychicterrain}. If this Ability is acquired without an active Terrain, or a Terrain ends, this Pokémon's types become the original types for its species.",
    source: '34eb066d',
  },
  minus: {
    short: "If an active ally has this Ability or the {ability:plus} Ability, this Pokémon's Sp. Atk is 1.5×.",
    long: "If an active ally has this Ability or the {ability:plus} Ability, this Pokémon's Special Attack is multiplied by 1.5.",
    source: 'a07e762f',
  },
  mirrorarmor: {
    short: "If this Pokémon's stat stages would be lowered, the attacker's are lowered instead.",
    long: "When one of this Pokémon's stat stages would be lowered by another Pokémon, that Pokémon's stat stage is lowered instead. This effect does not happen if this Pokémon's stat stage was already -6. If the other Pokémon has a substitute, neither Pokémon has its stat stage lowered.",
    source: '1b2c44e8',
  },
  moldbreaker: {
    short: "This Pokémon's moves and their effects ignore the Abilities of other Pokémon.",
    long: "This Pokémon's moves and their effects ignore certain Abilities of other Pokémon. The Abilities that can be negated are {ability:armortail}, {ability:aromaveil}, Aura Break, {ability:battlearmor}, {ability:bigpecks}, {ability:bulletproof}, {ability:clearbody}, {ability:contrary}, {ability:damp}, Dazzling, {ability:disguise}, {ability:dryskin}, {ability:eartheater}, {ability:filter}, {ability:flashfire}, Flower Gift, {ability:flowerveil}, {ability:fluffy}, {ability:friendguard}, {ability:furcoat}, {ability:goodasgold}, {ability:grasspelt}, {ability:guarddog}, {ability:heatproof}, {ability:heavymetal}, {ability:hypercutter}, Ice Face, Ice Scales, {ability:illuminate}, {ability:immunity}, {ability:innerfocus}, {ability:insomnia}, {ability:keeneye}, {ability:leafguard}, {ability:levitate}, {ability:lightmetal}, {ability:lightningrod}, {ability:limber}, {ability:magicbounce}, {ability:magmaarmor}, {ability:marvelscale}, Mind's Eye, {ability:mirrorarmor}, {ability:motordrive}, {ability:multiscale}, {ability:oblivious}, {ability:overcoat}, {ability:owntempo}, Pastel Veil, {ability:punkrock}, {ability:purifyingsalt}, {ability:queenlymajesty}, {ability:sandveil}, {ability:sapsipper}, {ability:shellarmor}, {ability:shielddust}, Simple, {ability:snowcloak}, {ability:solidrock}, {ability:soundproof}, {ability:stickyhold}, Storm Drain, {ability:sturdy}, {ability:suctioncups}, {ability:sweetveil}, {ability:tangledfeet}, {ability:telepathy}, Tera Shell, {ability:thermalexchange}, {ability:thickfat}, {ability:unaware}, {ability:vitalspirit}, {ability:voltabsorb}, {ability:waterabsorb}, {ability:waterbubble}, Water Veil, Well-Baked Body, {ability:whitesmoke}, Wind Rider, Wonder Guard, and Wonder Skin. This affects every other Pokémon on the field, whether or not it is a target of this Pokémon's move, and whether or not their Ability is beneficial to this Pokémon.",
    source: '83dd4a35',
  },
  moody: {
    short: 'Boosts a random stat (except accuracy/evasion) +2 and another stat -1 every turn.',
    long: 'This Pokémon has a random stat, other than accuracy or evasiveness, raised by 2 stages and another stat lowered by 1 stage at the end of each turn.',
    source: '0895f467',
  },
  motordrive: {
    short: "This Pokémon's Speed is raised 1 stage if hit by an {type:electric} move; {type:electric} immunity.",
    long: 'This Pokémon is immune to {type:electric}-type moves and raises its Speed by 1 stage when hit by an {type:electric}-type move.',
    source: '90d4b01a',
  },
  moxie: {
    short: "This Pokémon's Attack is raised by 1 stage if it attacks and KOes another Pokémon.",
    long: "This Pokémon's Attack is raised by 1 stage if it attacks and knocks out another Pokémon.",
    source: 'b46af45b',
  },
  multiscale: {
    short: 'If this Pokémon is at full HP, damage taken from attacks is halved.',
    source: '65369a83',
  },
  mummy: {
    short: 'Pokémon making contact with this Pokémon have their Ability changed to Mummy.',
    long: 'Pokémon making contact with this Pokémon have their Ability changed to Mummy. Does not affect Pokémon with the As One, {ability:battlebond}, Comatose, {ability:disguise}, Gulp Missile, Ice Face, Multitype, Mummy, Power Construct, RKS System, Schooling, Shields Down, {ability:stancechange}, Tera Shift, Zen Mode, or {ability:zerotohero} Abilities.',
    source: 'a6ac88ef',
  },
  naturalcure: {
    short: 'This Pokémon has its non-volatile status condition cured when it switches out.',
    source: '9570dd42',
  },
  noguard: {
    short: 'Every move used by or against this Pokémon will always hit.',
    source: '9e8ad38b',
  },
  oblivious: {
    short: 'This Pokémon cannot be infatuated or taunted. Immune to {ability:intimidate}.',
    long: 'This Pokémon cannot be infatuated or taunted. Gaining this Ability while infatuated or taunted cures it. This Pokémon is immune to the effect of the {ability:intimidate} Ability.',
    source: '726584b3',
  },
  opportunist: {
    short: 'When an opposing Pokémon has a stat stage raised, this Pokémon copies the effect.',
    source: '354c74c0',
  },
  overcoat: {
    short: 'This Pokémon is immune to powder moves, {condition:sandstorm} damage, and {ability:effectspore}.',
    long: 'This Pokémon is immune to powder moves, damage from {condition:sandstorm}, and the effects of {move:ragepowder} and the {ability:effectspore} Ability.',
    source: 'dd05538d',
  },
  overgrow: {
    short: "At 1/3 or less of its max HP, this Pokémon's offensive stat is 1.5× with {type:grass} attacks.",
    long: 'When this Pokémon has 1/3 or less of its maximum HP, rounded down, its offensive stat is multiplied by 1.5 while using a {type:grass}-type attack.',
    source: 'ae727721',
  },
  owntempo: {
    short: 'This Pokémon cannot be confused. Immune to {ability:intimidate}.',
    long: 'This Pokémon cannot be confused. Gaining this Ability while confused cures it. This Pokémon is immune to the effect of the {ability:intimidate} Ability.',
    source: '75aeb360',
  },
  parentalbond: {
    short: "This Pokémon's damaging moves hit twice. The second hit has its damage quartered.",
    long: "This Pokémon's damaging moves become multi-hit moves that hit twice. The second hit has its damage quartered. Does not affect Doom Desire, {move:dragondarts}, Dynamax Cannon, {move:endeavor}, {move:explosion}, {move:finalgambit}, {move:fling}, {move:futuresight}, Ice Ball, Rollout, {move:selfdestruct}, any multi-hit move, any move that has multiple targets, or any two-turn move.",
    source: '8ee984cc',
  },
  pickpocket: {
    short: "If this Pokémon has no item and is hit by a contact move, it steals the attacker's item.",
    long: "If this Pokémon has no item and is hit by a contact move, it steals the attacker's item. This effect applies after all hits from a multi-hit move. This effect is prevented if the move had a secondary effect removed by the {ability:sheerforce} Ability.",
    source: 'c090ea72',
  },
  pickup: {
    short: 'If this Pokémon has no item, it finds one used by an adjacent Pokémon this turn.',
    long: "At the end of each turn, if this Pokémon is not holding an item and at least one adjacent Pokémon used an item during this turn, one of those Pokémon is selected at random and this Pokémon obtains that Pokémon's last used item. An item is not considered the last used if it was a popped {item:airballoon}, if the item was picked up by another Pokémon with this Ability, or if the item was lost to {move:bugbite}, {move:corrosivegas}, {move:covet}, Incinerate, {move:knockoff}, {move:pluck}, or {move:thief}. Items thrown with {move:fling} can be picked up.",
    source: 'bebd3b4b',
  },
  piercingdrill: {
    short: "This Pokémon's contact moves ignore a target's protection and deal 1/4 the usual damage.",
    source: '18737d7d',
  },
  pixilate: {
    short: "This Pokémon's {type:normal}-type moves become {type:fairy} type and have 1.2× power.",
    long: "This Pokémon's {type:normal}-type moves become {type:fairy}-type moves and have their power multiplied by 1.2. This effect comes after other effects that change a move's type, but before Ion Deluge and {move:electrify}'s effects.",
    source: 'dc687be1',
  },
  plus: {
    short: "If an active ally has this Ability or the {ability:minus} Ability, this Pokémon's Sp. Atk is 1.5×.",
    long: "If an active ally has this Ability or the {ability:minus} Ability, this Pokémon's Special Attack is multiplied by 1.5.",
    source: '1606b01d',
  },
  poisonheal: {
    short: 'This Pokémon is healed by 1/8 of its max HP each turn when poisoned; no HP loss.',
    long: 'If this Pokémon is poisoned, it restores 1/8 of its maximum HP, rounded down, at the end of each turn instead of losing HP.',
    source: 'c800a3f7',
  },
  poisonpoint: {
    short: '30% chance a Pokémon making contact with this Pokémon will be poisoned.',
    source: '537e2af5',
  },
  poisontouch: {
    short: "This Pokémon's contact moves have a 30% chance of poisoning.",
    long: "This Pokémon's contact moves have a 30% chance of poisoning. This effect comes after a move's inherent secondary effect chance.",
    source: 'e9df4fd2',
  },
  prankster: {
    short: "This Pokémon's Status moves have priority raised by 1, but {type:dark} types are immune.",
    long: "This Pokémon's non-damaging moves have their priority increased by 1. Opposing {type:dark}-type Pokémon are immune to these moves, and any move called by these moves, if the resulting user of the move has this Ability.",
    source: '74b492a9',
  },
  pressure: {
    short: "If this Pokémon is the target of a foe's move, that move loses one additional PP.",
    long: "If this Pokémon is the target of an opposing Pokémon's move, that move loses one additional PP. {move:imprison}, Snatch, and Tera Blast also lose one additional PP when used by an opposing Pokémon, but {condition:stickyweb} does not.",
    source: '0aa303af',
  },
  protean: {
    short: "This Pokémon's type changes to the type of the move it is using. Once per switch-in.",
    long: "This Pokémon's type changes to match the type of the move it is about to use. This effect comes after all effects that change a move's type. This effect can only happen once per switch-in, and only if this Pokémon is not Terastallized.",
    source: '480d7e63',
  },
  psychicsurge: {
    short: 'On switch-in, this Pokémon summons {condition:psychicterrain}.',
    source: '38b54d89',
  },
  punkrock: {
    short: 'This Pokémon receives 1/2 damage from sound moves. Its own have 1.3× power.',
    long: "This Pokémon's sound-based moves have their power multiplied by 1.3. This Pokémon takes halved damage from sound-based moves.",
    source: '3efda5b3',
  },
  purepower: {
    short: "This Pokémon's Attack is doubled.",
    source: '32a82a96',
  },
  purifyingsalt: {
    short: "{type:ghost} damage to this Pokémon dealt with a halved offensive stat; can't be statused.",
    long: "This Pokémon cannot become affected by a non-volatile status condition or {move:yawn}. If a Pokémon uses a {type:ghost}-type attack against this Pokémon, that Pokémon's offensive stat is halved when calculating the damage to this Pokémon.",
    source: 'd38bb428',
  },
  queenlymajesty: {
    short: 'This Pokémon and its allies are protected from opposing priority moves.',
    long: 'Priority moves used by opposing Pokémon targeting this Pokémon or its allies are prevented from having an effect.',
    source: '6ef1d29c',
  },
  quickdraw: {
    short: 'This Pokémon has a 30% chance to move first in its priority bracket with attacking moves.',
    source: '4060e9d0',
  },
  quickfeet: {
    short: 'If this Pokémon is statused, its Speed is 1.5×; ignores Speed drop from paralysis.',
    long: 'If this Pokémon has a non-volatile status condition, its Speed is multiplied by 1.5. This Pokémon ignores the paralysis effect of halving Speed.',
    source: 'bf7a2eb0',
  },
  raindish: {
    short: 'If {condition:rain} is active, this Pokémon heals 1/16 of its max HP each turn.',
    long: 'If {condition:rain} is active, this Pokémon restores 1/16 of its maximum HP, rounded down, at the end of each turn. This effect is prevented if this Pokémon is holding a Utility Umbrella.',
    source: 'd54ba8cd',
  },
  rattled: {
    short:
      'Speed is raised 1 stage if hit by a {type:bug}-, {type:dark}-, or {type:ghost}-type attack, or Intimidated.',
    long: "This Pokémon's Speed is raised by 1 stage if hit by a {type:bug}-, {type:dark}-, or {type:ghost}-type attack, or if an opposing Pokémon affected this Pokémon with the {ability:intimidate} Ability.",
    source: '2a0449e4',
  },
  receiver: {
    short: 'This Pokémon copies the Ability of an ally that faints.',
    long: 'This Pokémon copies the Ability of an ally that faints. Abilities that cannot be copied are As One, {ability:battlebond}, Comatose, Commander, {ability:disguise}, Embody Aspect, Flower Gift, {ability:forecast}, {ability:hungerswitch}, Ice Face, {ability:illusion}, {ability:imposter}, Multitype, Neutralizing Gas, Poison Puppeteer, Power Construct, Power of Alchemy, Protosynthesis, Quark Drive, Receiver, RKS System, Schooling, Shields Down, {ability:stancechange}, Tera Shell, Tera Shift, Teraform Zero, {ability:trace}, Wonder Guard, Zen Mode, and {ability:zerotohero}.',
    source: '10449fa8',
  },
  reckless: {
    short: "This Pokémon's attacks with recoil or crash damage have 1.2× power; not Struggle.",
    long: "This Pokémon's attacks with recoil or crash damage have their power multiplied by 1.2. Does not affect Struggle.",
    source: 'bef5b783',
  },
  refrigerate: {
    short: "This Pokémon's {type:normal}-type moves become {type:ice} type and have 1.2× power.",
    long: "This Pokémon's {type:normal}-type moves become {type:ice}-type moves and have their power multiplied by 1.2. This effect comes after other effects that change a move's type, but before Ion Deluge and {move:electrify}'s effects.",
    source: 'a31c0af7',
  },
  regenerator: {
    short: 'This Pokémon restores 1/3 of its maximum HP, rounded down, when it switches out.',
    source: '4e55c1dd',
  },
  ripen: {
    short: 'When this Pokémon eats certain Berries, the effects are doubled.',
    long: 'When this Pokémon eats certain Berries, the effects are doubled. Berries that restore HP or PP have the amount doubled, Berries that raise stat stages have the amount doubled, Berries that halve damage taken quarter it instead, and a Jaboca Berry or Rowap Berry has the attacker lose 1/4 of its maximum HP, rounded down.',
    source: 'e13b4f3e',
  },
  rivalry: {
    short: "This Pokémon's attacks do 1.25× on same gender targets; 0.75× on opposite gender.",
    long: "This Pokémon's attacks have their power multiplied by 1.25 against targets of the same gender or multiplied by 0.75 against targets of the opposite gender. There is no modifier if either this Pokémon or the target is genderless.",
    source: 'f646ad98',
  },
  rockhead: {
    short: 'This Pokémon does not take recoil damage besides Struggle/{item:lifeorb}/crash damage.',
    long: 'This Pokémon does not take recoil damage, except Struggle. Does not affect {item:lifeorb} damage or crash damage.',
    source: '270c90b2',
  },
  roughskin: {
    short: 'Pokémon making contact with this Pokémon lose 1/8 of their max HP.',
    long: 'Pokémon making contact with this Pokémon lose 1/8 of their maximum HP, rounded down.',
    source: '579dcec9',
  },
  runaway: {
    short: 'No competitive use.',
    source: 'd01a4633',
  },
  sandforce: {
    short:
      "This Pokémon's {type:ground}/{type:rock}/{type:steel} attacks do 1.3× in {condition:sandstorm}; immunity to it.",
    long: "If {condition:sandstorm} is active, this Pokémon's {type:ground}-, {type:rock}-, and {type:steel}-type attacks have their power multiplied by 1.3. This Pokémon takes no damage from {condition:sandstorm}.",
    source: '0e75ba17',
  },
  sandrush: {
    short: "If {condition:sandstorm} is active, this Pokémon's Speed is doubled; immunity to {condition:sandstorm}.",
    long: "If {condition:sandstorm} is active, this Pokémon's Speed is doubled. This Pokémon takes no damage from {condition:sandstorm}.",
    source: '5cd327a6',
  },
  sandspit: {
    short: 'When this Pokémon is hit by an attack, the effect of {condition:sandstorm} begins.',
    source: '9d12e053',
  },
  sandstream: {
    short: 'On switch-in, this Pokémon summons {condition:sandstorm}.',
    source: '71cbd010',
  },
  sandveil: {
    short:
      "If {condition:sandstorm} is active, this Pokémon's evasiveness is 1.25×; immunity to {condition:sandstorm}.",
    long: 'If {condition:sandstorm} is active, the accuracy of moves used against this Pokémon is multiplied by 0.8. This Pokémon takes no damage from {condition:sandstorm}.',
    source: 'c46e397f',
  },
  sapsipper: {
    short: "This Pokémon's Attack is raised 1 stage if hit by a {type:grass} move; {type:grass} immunity.",
    long: 'This Pokémon is immune to {type:grass}-type moves and raises its Attack by 1 stage when hit by a {type:grass}-type move.',
    source: '2209ad75',
  },
  scrappy: {
    short: '{type:fighting}, {type:normal} moves hit {type:ghost}. Immune to {ability:intimidate}.',
    long: 'This Pokémon can hit {type:ghost} types with {type:normal}- and {type:fighting}-type moves. This Pokémon is immune to the effect of the {ability:intimidate} Ability.',
    source: 'b25db18e',
  },
  screencleaner: {
    short: 'On switch-in, the effects of {move:auroraveil}, {move:lightscreen}, and {move:reflect} end for both sides.',
    source: '369a73ab',
  },
  seedsower: {
    short: 'When this Pokémon is hit by an attack, the effect of {condition:grassyterrain} begins.',
    source: '5a57b998',
  },
  shadowtag: {
    short: 'Prevents foes from choosing to switch unless they also have this Ability.',
    long: 'Prevents opposing Pokémon from choosing to switch out, unless they are holding a {item:shedshell}, are a {type:ghost} type, or also have this Ability.',
    source: '26534021',
  },
  sharpness: {
    short: "This Pokémon's slicing moves have their power multiplied by 1.5.",
    source: '180bb9ef',
  },
  shedskin: {
    short: 'This Pokémon has a 33% chance to have its status cured at the end of each turn.',
    long: 'This Pokémon has a 33% chance to have its non-volatile status condition cured at the end of each turn.',
    source: 'c0034f80',
  },
  sheerforce: {
    short: "This Pokémon's attacks with secondary effects have 1.3× power; nullifies the effects.",
    long: "This Pokémon's attacks with secondary effects have their power multiplied by 1.3, but the secondary effects are removed. If a secondary effect was removed, it also removes the user's {item:lifeorb} recoil and {item:shellbell} recovery, and prevents the target's Anger Shell, {ability:berserk}, Color Change, {ability:emergencyexit}, {ability:pickpocket}, Wimp Out, {item:redcard}, {item:ejectbutton}, Kee Berry, and Maranga Berry from activating.",
    source: '371f4077',
  },
  shellarmor: {
    short: 'This Pokémon cannot be struck by a critical hit.',
    source: 'e450823c',
  },
  shielddust: {
    short: "This Pokémon is not affected by the secondary effect of another Pokémon's attack.",
    long: "This Pokémon is not affected by the secondary effect of another Pokémon's attack. Attacks with secondary effects that are prevented include those with a chance (even 100%) to paralyze, sleep, freeze, burn, poison, confuse, cause this Pokémon to flinch, cause this Pokémon's stat stages to be lowered, as well as Anchor Shot, {move:eeriespell}, {move:fling}, {move:psychicnoise}, {move:saltcure}, {move:spiritshackle}, {move:syrupbomb}, and {move:throatchop}. The effect of {move:sparklingaria} is prevented if this Pokémon is the only target. Secondary effects added by {item:kingsrock}, Razor Fang, and the {ability:poisontouch}, {ability:stench}, and Toxic Chain Abilities are also prevented against this Pokémon.",
    source: 'c25de214',
  },
  shieldsdown: {
    short: 'If Minior, switch-in/end of turn it changes to Core at 1/2 max HP or less, else Meteor.',
    long: 'If this Pokémon is a Minior, it changes to its Core forme if it has 1/2 or less of its maximum HP, and changes to Meteor Form if it has more than 1/2 its maximum HP. This check is done on switch-in and at the end of each turn. While in its Meteor Form, it cannot become affected by a non-volatile status condition or {move:yawn}.',
    source: '5be011d9',
  },
  skilllink: {
    short: "This Pokémon's multi-hit attacks always hit the maximum number of times.",
    long: "This Pokémon's multi-hit attacks always hit the maximum number of times. Triple Kick and {move:tripleaxel} do not check accuracy for the second and third hits.",
    source: 'df3aa899',
  },
  slushrush: {
    short: "If {condition:snow} is active, this Pokémon's Speed is doubled.",
    source: 'f421c4fe',
  },
  sniper: {
    short: 'If this Pokémon strikes with a critical hit, the damage is multiplied by 1.5.',
    source: '49c1fbea',
  },
  snowcloak: {
    short: "If {condition:snow} is active, this Pokémon's evasiveness is 1.25×.",
    long: 'If {condition:snow} is active, the accuracy of moves used against this Pokémon is multiplied by 0.8.',
    source: '61243f0d',
  },
  snowwarning: {
    short: 'On switch-in, this Pokémon summons {condition:snow}.',
    source: '317dcde0',
  },
  solarpower: {
    short: "If {condition:sun} is active, this Pokémon's Sp. Atk is 1.5×; loses 1/8 max HP per turn.",
    long: "If {condition:sun} is active, this Pokémon's Special Attack is multiplied by 1.5 and it loses 1/8 of its maximum HP, rounded down, at the end of each turn. These effects are prevented if the Pokémon is holding a Utility Umbrella.",
    source: '1989f62e',
  },
  solidrock: {
    short: 'This Pokémon receives 3/4 damage from supereffective attacks.',
    source: '43e3176a',
  },
  soundproof: {
    short: 'This Pokémon is immune to sound-based moves, unless it used the move.',
    source: 'd703922f',
  },
  speedboost: {
    short: "This Pokémon's Speed is raised 1 stage at the end of each full turn on the field.",
    long: "This Pokémon's Speed is raised by 1 stage at the end of each full turn it has been on the field.",
    source: '8757667c',
  },
  spicyspray: {
    short: 'If this Pokémon is hit by an attack, the attacker becomes burned.',
    source: '974c96fa',
  },
  stakeout: {
    short: "This Pokémon's offensive stat is doubled against a target that switched in this turn.",
    source: 'ed4ce675',
  },
  stall: {
    short: 'This Pokémon moves last among Pokémon using the same or greater priority moves.',
    source: '2e3f67ce',
  },
  stalwart: {
    short: "This Pokémon's moves cannot be redirected to a different target by any effect.",
    source: 'b6259609',
  },
  stamina: {
    short: "This Pokémon's Defense is raised by 1 stage after it is damaged by a move.",
    source: 'd6bedb6a',
  },
  stancechange: {
    short: 'If Aegislash, changes Forme to Blade before attacks and Shield before {move:kingsshield}.',
    long: 'If this Pokémon is an Aegislash, it changes to Blade Forme before using an attacking move, and changes to Shield Forme before using {move:kingsshield}.',
    source: 'a4642782',
  },
  static: {
    short: '30% chance a Pokémon making contact with this Pokémon will be paralyzed.',
    source: '4d3e1fa4',
  },
  steadfast: {
    short: 'If this Pokémon flinches, its Speed is raised by 1 stage.',
    source: '3e0843c0',
  },
  steelyspirit: {
    short: "This Pokémon and its allies' {type:steel}-type moves have their power multiplied by 1.5.",
    long: "This Pokémon and its allies' {type:steel}-type moves have their power multiplied by 1.5. This affects Doom Desire even if the user is not on the field.",
    source: 'c63909d1',
  },
  stench: {
    short: "This Pokémon's attacks without a chance to flinch gain a 10% chance to flinch.",
    long: "This Pokémon's attacks without a chance to make the target flinch gain a 10% chance to make the target flinch.",
    source: 'fb7a56d8',
  },
  stickyhold: {
    short: "This Pokémon cannot lose its held item due to another Pokémon's Ability or attack.",
    long: "This Pokémon cannot lose its held item due to another Pokémon's Ability or attack, unless the attack knocks out this Pokémon. A Sticky Barb will be transferred to other Pokémon regardless of this Ability.",
    source: 'c9f8965a',
  },
  strongjaw: {
    short: "This Pokémon's bite-based attacks have 1.5× power. {move:bugbite} is not boosted.",
    long: "This Pokémon's bite-based attacks have their power multiplied by 1.5.",
    source: 'b299da6a',
  },
  sturdy: {
    short: 'If this Pokémon is at full HP, it survives one hit with at least 1 HP. Immune to OHKO.',
    long: 'If this Pokémon is at full HP, it survives one hit with at least 1 HP. OHKO moves fail when used against this Pokémon.',
    source: '577c1a16',
  },
  suctioncups: {
    short: "This Pokémon cannot be forced to switch out by another Pokémon's attack or item.",
    source: '2a11f1f4',
  },
  superluck: {
    short: "This Pokémon's critical hit ratio is raised by 1 stage.",
    source: '1b2f99b8',
  },
  supersweetsyrup: {
    short: 'On switch-in, this Pokémon lowers the evasiveness of opponents 1 stage. Once per battle.',
    source: 'e3af3de4',
  },
  supremeoverlord: {
    short: "This Pokémon's moves have 10% more power for each fainted ally, up to 5 allies.",
    long: "This Pokémon's moves have their power multiplied by 1+(X × 0.1), where X is the total number of times any Pokémon has fainted on the user's side when this Ability became active, and X cannot be greater than 5.",
    source: 'e9f66cf5',
  },
  surgesurfer: {
    short: "If {condition:electricterrain} is active, this Pokémon's Speed is doubled.",
    source: 'f5c6f512',
  },
  swarm: {
    short: "At 1/3 or less of its max HP, this Pokémon's offensive stat is 1.5× with {type:bug} attacks.",
    long: 'When this Pokémon has 1/3 or less of its maximum HP, rounded down, its offensive stat is multiplied by 1.5 while using a {type:bug}-type attack.',
    source: 'a2f2d01a',
  },
  sweetveil: {
    short: 'This Pokémon and its allies cannot fall asleep; those already asleep do not wake up.',
    long: 'This Pokémon and its allies cannot fall asleep, but those already asleep do not wake up immediately. This Pokémon and its allies cannot use {move:rest} successfully or become affected by {move:yawn}, and those previously affected will not fall asleep.',
    source: 'ebd11a76',
  },
  swiftswim: {
    short: "If {condition:rain} is active, this Pokémon's Speed is doubled.",
    long: "If {condition:rain} is active, this Pokémon's Speed is doubled. This effect is prevented if this Pokémon is holding a Utility Umbrella.",
    source: '7b036f6b',
  },
  symbiosis: {
    short: 'If an ally uses its item, this Pokémon gives its item to that ally immediately.',
    long: "If an ally uses its item, this Pokémon gives its item to that ally immediately. Does not activate if the ally's item was stolen or knocked off, or if the ally used an {item:ejectbutton} or Eject Pack.",
    source: 'c911aee1',
  },
  synchronize: {
    short: 'If another Pokémon burns/poisons/paralyzes this Pokémon, it also gets that status.',
    long: 'If another Pokémon burns, paralyzes, poisons, or badly poisons this Pokémon, that Pokémon receives the same non-volatile status condition.',
    source: 'ec84717a',
  },
  tangledfeet: {
    short: "This Pokémon's evasiveness is doubled as long as it is confused.",
    source: '75609e67',
  },
  technician: {
    short: "This Pokémon's moves of 60 power or less have 1.5× power, including Struggle.",
    long: "This Pokémon's moves of 60 power or less have their power multiplied by 1.5, including Struggle. This effect comes after a move's effect changes its own power.",
    source: 'b48c1eed',
  },
  telepathy: {
    short: 'This Pokémon does not take damage from attacks made by its allies.',
    source: '5f461dc9',
  },
  thermalexchange: {
    short: "This Pokémon's Attack is raised by 1 when damaged by {type:fire} moves; can't be burned.",
    long: "This Pokémon's Attack is raised 1 stage after it is damaged by a {type:fire}-type move. This Pokémon cannot be burned. Gaining this Ability while burned cures it.",
    source: 'e97442f7',
  },
  thickfat: {
    short: '{type:fire}-/{type:ice}-type moves against this Pokémon deal damage with a halved offensive stat.',
    long: "If a Pokémon uses a {type:fire}- or {type:ice}-type attack against this Pokémon, that Pokémon's offensive stat is halved when calculating the damage to this Pokémon.",
    source: '32d23bd9',
  },
  torrent: {
    short: "At 1/3 or less of its max HP, this Pokémon's offensive stat is 1.5× with {type:water} attacks.",
    long: 'When this Pokémon has 1/3 or less of its maximum HP, rounded down, its offensive stat is multiplied by 1.5 while using a {type:water}-type attack.',
    source: 'baa3dad1',
  },
  toughclaws: {
    short: "This Pokémon's contact moves have their power multiplied by 1.3.",
    source: '0c2e3da0',
  },
  toxicdebris: {
    short: 'If this Pokémon is hit by a physical attack, {condition:toxicspikes} are set on the opposing side.',
    source: '4d2c0618',
  },
  trace: {
    short: "On switch-in, or when it can, this Pokémon copies a random adjacent foe's Ability.",
    long: "On switch-in, this Pokémon copies a random opposing Pokémon's Ability. Abilities that cannot be copied are As One, {ability:battlebond}, Comatose, Commander, {ability:disguise}, Embody Aspect, Flower Gift, {ability:forecast}, {ability:hungerswitch}, Ice Face, {ability:illusion}, {ability:imposter}, Multitype, Neutralizing Gas, Poison Puppeteer, Power Construct, Power of Alchemy, Protosynthesis, Quark Drive, {ability:receiver}, RKS System, Schooling, Shields Down, {ability:stancechange}, Teraform Zero, Tera Shell, Tera Shift, Trace, Zen Mode, and {ability:zerotohero}. If no opposing Pokémon has an Ability that can be copied, this Ability will activate as soon as one does.",
    source: '07dde57f',
  },
  unaware: {
    short: "This Pokémon ignores other Pokémon's stat stages when taking or doing damage.",
    long: "This Pokémon ignores other Pokémon's Attack, Special Attack, and accuracy stat stages when taking damage, and ignores other Pokémon's Defense, Special Defense, and evasiveness stat stages when dealing damage.",
    source: 'c8b14ce6',
  },
  unburden: {
    short: 'Speed is doubled on held item loss; boost is lost if it switches, gets new item/Ability.',
    long: 'If this Pokémon loses its held item for any reason, its Speed is doubled as long as it remains active, has this Ability, and is not holding an item.',
    source: '16cdf97d',
  },
  unnerve: {
    short: 'While this Pokémon is active, it prevents opposing Pokémon from using their Berries.',
    long: 'While this Pokémon is active, it prevents opposing Pokémon from using their Berries. This Ability activates before hazards and other Abilities take effect.',
    source: '9634ecb6',
  },
  unseenfist: {
    short: "This Pokémon's contact moves ignore a target's protection and deal 1/4 the usual damage.",
    source: '18737d7d',
  },
  vitalspirit: {
    short: 'This Pokémon cannot fall asleep. Gaining this Ability while asleep cures it.',
    source: 'f2308e22',
  },
  voltabsorb: {
    short: 'This Pokémon heals 1/4 of its max HP when hit by {type:electric} moves; {type:electric} immunity.',
    long: 'This Pokémon is immune to {type:electric}-type moves and restores 1/4 of its maximum HP, rounded down, when hit by an {type:electric}-type move.',
    source: '067ac567',
  },
  wanderingspirit: {
    short: 'Pokémon making contact with this Pokémon have their Ability swapped with this one.',
    long: 'Pokémon making contact with this Pokémon have their Ability swapped with this one. Does not affect Pokémon with the Abilities As One, {ability:battlebond}, Comatose, Commander, {ability:disguise}, Embody Aspect, {ability:hungerswitch}, Ice Face, {ability:illusion}, Multitype, Neutralizing Gas, Poison Puppeteer, Power Construct, Protosynthesis, Quark Drive, RKS System, Schooling, Shields Down, {ability:stancechange}, Tera Shell, Tera Shift, Teraform Zero, Wonder Guard, Zen Mode, or {ability:zerotohero}.',
    source: '6844330d',
  },
  waterabsorb: {
    short: 'This Pokémon heals 1/4 of its max HP when hit by {type:water} moves; {type:water} immunity.',
    long: 'This Pokémon is immune to {type:water}-type moves and restores 1/4 of its maximum HP, rounded down, when hit by a {type:water}-type move.',
    source: 'fc49586a',
  },
  waterbubble: {
    short: "This Pokémon's {type:water} power is 2×; it can't be burned; {type:fire} power against it is halved.",
    long: "This Pokémon's offensive stat is doubled while using a {type:water}-type attack. If a Pokémon uses a {type:fire}-type attack against this Pokémon, that Pokémon's offensive stat is halved when calculating the damage to this Pokémon. This Pokémon cannot be burned. Gaining this Ability while burned cures it.",
    source: '3323c9ab',
  },
  weakarmor: {
    short: 'If a physical attack hits this Pokémon, Defense is lowered by 1, Speed is raised by 2.',
    long: 'If a physical attack hits this Pokémon, its Defense is lowered by 1 stage and its Speed is raised by 2 stages.',
    source: '4b120ce1',
  },
  whitesmoke: {
    short: "Prevents other Pokémon from lowering this Pokémon's stat stages.",
    source: '39daef73',
  },
  zerotohero: {
    short: 'If this Pokémon is a Palafin in Zero Form, switching out has it change to Hero Form.',
    source: '21b893c5',
  },
}
