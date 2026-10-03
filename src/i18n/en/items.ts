// Our English items descriptions, written from Showdown's (in `src/data/generated/items.json`), with markers for references to
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
  abomasite: {
    short: 'Lets {pokemon:abomasnow} Mega Evolve into {pokemon:abomasnowmega}.',
    source: '2dd692e9',
  },
  absolite: {
    short: 'Lets {pokemon:absol} Mega Evolve into {pokemon:absolmega}.',
    source: '3281c67b',
  },
  absolitez: {
    short: 'Lets {pokemon:absol} Mega Evolve into {pokemon:absolmegaz}.',
    source: '24492895',
  },
  aerodactylite: {
    short: 'Lets {pokemon:aerodactyl} Mega Evolve into {pokemon:aerodactylmega}.',
    source: '80fb3ed3',
  },
  aggronite: {
    short: 'Lets {pokemon:aggron} Mega Evolve into {pokemon:aggronmega}.',
    source: 'f5f07558',
  },
  airballoon: {
    short: 'Holder is immune to {type:ground}-type attacks. Pops when holder is hit.',
    source: '1d5061b2',
  },
  alakazite: {
    short: 'Lets {pokemon:alakazam} Mega Evolve into {pokemon:alakazammega}.',
    source: '7c5bcab3',
  },
  altarianite: {
    short: 'Lets {pokemon:altaria} Mega Evolve into {pokemon:altariamega}.',
    source: 'dea43c42',
  },
  ampharosite: {
    short: 'Lets {pokemon:ampharos} Mega Evolve into {pokemon:ampharosmega}.',
    source: '54c38bc8',
  },
  aspearberry: {
    short: 'Holder is cured if it is frozen. Single use.',
    source: '3788f1b9',
  },
  audinite: {
    short: 'Lets {pokemon:audino} Mega Evolve into {pokemon:audinomega}.',
    source: 'a06a21cf',
  },
  babiriberry: {
    short: 'Halves damage taken from a super effective {type:steel}-type attack. Single use.',
    source: '8b8c7275',
  },
  banettite: {
    short: 'Lets {pokemon:banette} Mega Evolve into {pokemon:banettemega}.',
    source: '3bc6c3ee',
  },
  barbaracite: {
    short: 'Lets {pokemon:barbaracle} Mega Evolve into {pokemon:barbaraclemega}.',
    source: '79fea81a',
  },
  baxcalibrite: {
    short: 'Lets {pokemon:baxcalibur} Mega Evolve into {pokemon:baxcaliburmega}.',
    source: '49911032',
  },
  beedrillite: {
    short: 'Lets {pokemon:beedrill} Mega Evolve into {pokemon:beedrillmega}.',
    source: 'ac5ad8a2',
  },
  bigroot: {
    short: 'Holder gains 1.3× HP from draining/{move:aquaring}/{move:ingrain}/{move:leechseed}/{move:strengthsap}.',
    source: 'cac4525e',
  },
  bindingband: {
    short: "Holder's partial-trapping moves deal 1/6 max HP per turn instead of 1/8.",
    source: 'bbafb80e',
  },
  blackbelt: {
    short: "Holder's {type:fighting}-type attacks have 1.2× power.",
    source: 'd6f29364',
  },
  blackglasses: {
    short: "Holder's {type:dark}-type attacks have 1.2× power.",
    source: 'b0f2b62d',
  },
  blastoisinite: {
    short: 'Lets {pokemon:blastoise} Mega Evolve into {pokemon:blastoisemega}.',
    source: '204f767b',
  },
  blazikenite: {
    short: 'Lets {pokemon:blaziken} Mega Evolve into {pokemon:blazikenmega}.',
    source: '18794d80',
  },
  brightpowder: {
    short: 'The accuracy of attacks against the holder is 0.9×.',
    source: '79e8e6bf',
  },
  cameruptite: {
    short: 'Lets {pokemon:camerupt} Mega Evolve into {pokemon:cameruptmega}.',
    source: '6009b72f',
  },
  chandelurite: {
    short: 'Lets {pokemon:chandelure} Mega Evolve into {pokemon:chandeluremega}.',
    source: '1abd1873',
  },
  charcoal: {
    short: "Holder's {type:fire}-type attacks have 1.2× power.",
    source: '8aaa94d7',
  },
  charizarditex: {
    short: 'Lets {pokemon:charizard} Mega Evolve into {pokemon:charizardmegax}.',
    source: 'ab8e1b1c',
  },
  charizarditey: {
    short: 'Lets {pokemon:charizard} Mega Evolve into {pokemon:charizardmegay}.',
    source: '07a8ab59',
  },
  chartiberry: {
    short: 'Halves damage taken from a super effective {type:rock}-type attack. Single use.',
    source: '188c0a84',
  },
  cheriberry: {
    short: 'Holder cures itself if it is paralyzed. Single use.',
    source: '785e238d',
  },
  chesnaughtite: {
    short: 'Lets {pokemon:chesnaught} Mega Evolve into {pokemon:chesnaughtmega}.',
    source: '18439f78',
  },
  chestoberry: {
    short: 'Holder wakes up if it is asleep. Single use.',
    source: 'b6e1741a',
  },
  chilanberry: {
    short: 'Halves damage taken from a {type:normal}-type attack. Single use.',
    source: 'f40bf4f5',
  },
  chimechite: {
    short: 'Lets {pokemon:chimecho} Mega Evolve into {pokemon:chimechomega}.',
    source: '13281012',
  },
  choicescarf: {
    short: "Holder's Speed is 1.5×, but it can only select the first move it executes.",
    source: 'ea7a8d46',
  },
  chopleberry: {
    short: 'Halves damage taken from a super effective {type:fighting}-type attack. Single use.',
    source: '6b9c0c9e',
  },
  clefablite: {
    short: 'Lets {pokemon:clefable} Mega Evolve into {pokemon:clefablemega}.',
    source: 'd359fad1',
  },
  cobaberry: {
    short: 'Halves damage taken from a super effective {type:flying}-type attack. Single use.',
    source: 'e8cff25e',
  },
  colburberry: {
    short: 'Halves damage taken from a super effective {type:dark}-type attack. Single use.',
    source: 'ae55720c',
  },
  crabominite: {
    short: 'Lets {pokemon:crabominable} Mega Evolve into {pokemon:crabominablemega}.',
    source: '50fa51ee',
  },
  damprock: {
    short: "Holder's use of {move:raindance} lasts 8 turns instead of 5.",
    source: 'aea256a3',
  },
  delphoxite: {
    short: 'Lets {pokemon:delphox} Mega Evolve into {pokemon:delphoxmega}.',
    source: 'ed4caf70',
  },
  dragalgite: {
    short: 'Lets {pokemon:dragalge} Mega Evolve into {pokemon:dragalgemega}.',
    source: 'ca6b353d',
  },
  dragonfang: {
    short: "Holder's {type:dragon}-type attacks have 1.2× power.",
    source: 'e2acb336',
  },
  dragoninite: {
    short: 'Lets {pokemon:dragonite} Mega Evolve into {pokemon:dragonitemega}.',
    source: '8f36f3dd',
  },
  drampanite: {
    short: 'Lets {pokemon:drampa} Mega Evolve into {pokemon:drampamega}.',
    source: '348af7a7',
  },
  eelektrossite: {
    short: 'Lets {pokemon:eelektross} Mega Evolve into {pokemon:eelektrossmega}.',
    source: 'ec3383bb',
  },
  ejectbutton: {
    short: 'If holder survives a hit, it immediately switches out to a chosen ally. Single use.',
    long: 'If the holder survives a damaging move, it immediately switches out to a chosen ally, and the item is used up. Unlike in the main games, an attacker that switches out with its move ({move:uturn}, {move:voltswitch}, {move:flipturn}) still does: both sides switch.',
    source: 'c57c3e84',
  },
  electricseed: {
    short: "If the terrain is {condition:electricterrain}, raises holder's Defense by 1 stage. Single use.",
    source: '94a1eb47',
  },
  emboarite: {
    short: 'Lets {pokemon:emboar} Mega Evolve into {pokemon:emboarmega}.',
    source: 'd17cbf34',
  },
  excadrite: {
    short: 'Lets {pokemon:excadrill} Mega Evolve into {pokemon:excadrillmega}.',
    source: '11b20fa4',
  },
  expertbelt: {
    short: "Holder's attacks that are super effective against the target do 1.2× damage.",
    source: 'ab34a9da',
  },
  fairyfeather: {
    short: "Holder's {type:fairy}-type attacks have 1.2× power.",
    source: 'e5779906',
  },
  falinksite: {
    short: 'Lets {pokemon:falinks} Mega Evolve into {pokemon:falinksmega}.',
    source: 'd2d89d85',
  },
  feraligite: {
    short: 'Lets {pokemon:feraligatr} Mega Evolve into {pokemon:feraligatrmega}.',
    source: 'e861b6f1',
  },
  floettite: {
    short: 'Lets {pokemon:floetteeternal} Mega Evolve into {pokemon:floettemega}.',
    source: '35b16fd3',
  },
  focusband: {
    short: 'Holder has a 10% chance to survive an attack that would KO it with 1 HP.',
    source: 'a4469b1e',
  },
  focussash: {
    short: "If holder's HP is full, will survive an attack that would KO it with 1 HP. Single use.",
    source: '40bed450',
  },
  froslassite: {
    short: 'Lets {pokemon:froslass} Mega Evolve into {pokemon:froslassmega}.',
    source: '08bfac86',
  },
  galladite: {
    short: 'Lets {pokemon:gallade} Mega Evolve into {pokemon:gallademega}.',
    source: 'b4ed2fbd',
  },
  garchompite: {
    short: 'Lets {pokemon:garchomp} Mega Evolve into {pokemon:garchompmega}.',
    source: 'a5ca3dd0',
  },
  garchompitez: {
    short: 'Lets {pokemon:garchomp} Mega Evolve into {pokemon:garchompmegaz}.',
    source: '54d2a4d9',
  },
  gardevoirite: {
    short: 'Lets {pokemon:gardevoir} Mega Evolve into {pokemon:gardevoirmega}.',
    source: 'aee66b1c',
  },
  gengarite: {
    short: 'Lets {pokemon:gengar} Mega Evolve into {pokemon:gengarmega}.',
    source: '8321ea67',
  },
  glalitite: {
    short: 'Lets {pokemon:glalie} Mega Evolve into {pokemon:glaliemega}.',
    source: 'b3400b9b',
  },
  glimmoranite: {
    short: 'Lets {pokemon:glimmora} Mega Evolve into {pokemon:glimmoramega}.',
    source: 'd47a5767',
  },
  golisopite: {
    short: 'Lets {pokemon:golisopod} Mega Evolve into {pokemon:golisopodmega}.',
    source: 'f09b4a39',
  },
  golurkite: {
    short: 'Lets {pokemon:golurk} Mega Evolve into {pokemon:golurkmega}.',
    source: '797814cb',
  },
  grassyseed: {
    short: "If the terrain is {condition:grassyterrain}, raises holder's Defense by 1 stage. Single use.",
    source: '86f9e39f',
  },
  greninjite: {
    short: 'Lets {pokemon:greninja} Mega Evolve into {pokemon:greninjamega}.',
    source: '67f4a789',
  },
  gyaradosite: {
    short: 'Lets {pokemon:gyarados} Mega Evolve into {pokemon:gyaradosmega}.',
    source: 'd1127e15',
  },
  habanberry: {
    short: 'Halves damage taken from a super effective {type:dragon}-type attack. Single use.',
    source: 'eaf157ff',
  },
  hardstone: {
    short: "Holder's {type:rock}-type attacks have 1.2× power.",
    source: 'c04cfdc3',
  },
  hawluchanite: {
    short: 'Lets {pokemon:hawlucha} Mega Evolve into {pokemon:hawluchamega}.',
    source: '280e93ce',
  },
  heatrock: {
    short: "Holder's use of {move:sunnyday} lasts 8 turns instead of 5.",
    source: '4220b2d9',
  },
  heracronite: {
    short: 'Lets {pokemon:heracross} Mega Evolve into {pokemon:heracrossmega}.',
    source: '22b4e62b',
  },
  houndoominite: {
    short: 'Lets {pokemon:houndoom} Mega Evolve into {pokemon:houndoommega}.',
    source: '2bc7e4d1',
  },
  icyrock: {
    short: "Holder's use of {move:snowscape} lasts 8 turns instead of 5.",
    source: 'f110ad8a',
  },
  ironball: {
    short: 'Holder is grounded, Speed halved. If {type:flying} type, takes neutral {type:ground} damage.',
    source: 'da158eb7',
  },
  kangaskhanite: {
    short: 'Lets {pokemon:kangaskhan} Mega Evolve into {pokemon:kangaskhanmega}.',
    source: '5b9653b1',
  },
  kasibberry: {
    short: 'Halves damage taken from a super effective {type:ghost}-type attack. Single use.',
    source: '326f1c5a',
  },
  kebiaberry: {
    short: 'Halves damage taken from a super effective {type:poison}-type attack. Single use.',
    source: '879f8af3',
  },
  kingsrock: {
    short: "Holder's attacks without a chance to flinch gain a 10% chance to flinch.",
    long: "Holder's attacks without a chance to make the target flinch gain a 10% chance to make the target flinch.",
    source: 'b5fa12ef',
  },
  leek: {
    short: 'If held by a {pokemon:farfetchd} or {pokemon:sirfetchd}, its critical hit ratio is raised by 2 stages.',
    source: '3b264ee2',
  },
  leftovers: {
    short: 'At the end of every turn, holder restores 1/16 of its max HP.',
    source: 'cf145085',
  },
  leppaberry: {
    short: "Restores 10 PP to the first of the holder's moves to reach 0 PP. Single use.",
    source: 'b2d161df',
  },
  lifeorb: {
    short: "Holder's attacks do 1.3× damage, and it loses 1/10 its max HP after the attack.",
    source: '36f298a9',
  },
  lightball: {
    short: 'If held by a {pokemon:pikachu}, its Attack and Sp. Atk are doubled.',
    source: 'e7699346',
  },
  lightclay: {
    short: "Holder's use of {move:auroraveil}, {move:lightscreen}, or {move:reflect} lasts 8 turns instead of 5.",
    source: '73e9bcf2',
  },
  lopunnite: {
    short: 'Lets {pokemon:lopunny} Mega Evolve into {pokemon:lopunnymega}.',
    source: '532e1518',
  },
  lucarionite: {
    short: 'Lets {pokemon:lucario} Mega Evolve into {pokemon:lucariomega}.',
    source: '6cc0a0d7',
  },
  lucarionitez: {
    short: 'Lets {pokemon:lucario} Mega Evolve into {pokemon:lucariomegaz}.',
    source: '85006e89',
  },
  lumberry: {
    short: 'Holder cures itself if it has a non-volatile status or is confused. Single use.',
    source: '4bb06d25',
  },
  magnet: {
    short: "Holder's {type:electric}-type attacks have 1.2× power.",
    source: '710272af',
  },
  malamarite: {
    short: 'Lets {pokemon:malamar} Mega Evolve into {pokemon:malamarmega}.',
    source: 'bbcb29e5',
  },
  manectite: {
    short: 'Lets {pokemon:manectric} Mega Evolve into {pokemon:manectricmega}.',
    source: '1880bdd6',
  },
  mawilite: {
    short: 'Lets {pokemon:mawile} Mega Evolve into {pokemon:mawilemega}.',
    source: '9e41ecbf',
  },
  medichamite: {
    short: 'Lets {pokemon:medicham} Mega Evolve into {pokemon:medichammega}.',
    source: 'fdc39ac8',
  },
  meganiumite: {
    short: 'Lets {pokemon:meganium} Mega Evolve into {pokemon:meganiummega}.',
    source: '524da54a',
  },
  mentalherb: {
    short:
      'Cures holder of {move:attract}, {move:disable}, {move:encore}, Heal Block, {move:taunt}, {move:torment}. Single use.',
    source: '4b3a0003',
  },
  meowsticite: {
    short:
      'Lets {pokemon:meowstic} Mega Evolve into {pokemon:meowsticmmega}. Lets {pokemon:meowsticf} Mega Evolve into {pokemon:meowsticfmega}.',
    source: '41560920',
  },
  metagrossite: {
    short: 'Lets {pokemon:metagross} Mega Evolve into {pokemon:metagrossmega}.',
    source: '5b741651',
  },
  metalcoat: {
    short: "Holder's {type:steel}-type attacks have 1.2× power.",
    source: '1cf48fd5',
  },
  metronome: {
    short: 'Damage of moves used on consecutive turns is increased. Max 2× after 5 turns.',
    source: '223c88a0',
  },
  miracleseed: {
    short: "Holder's {type:grass}-type attacks have 1.2× power.",
    source: 'daaa7fb1',
  },
  mistyseed: {
    short: "If the terrain is {condition:mistyterrain}, raises holder's Sp. Def by 1 stage. Single use.",
    source: 'b8d9a095',
  },
  muscleband: {
    short: "Holder's physical attacks have 1.1× power.",
    source: 'f2b48bc3',
  },
  mysticwater: {
    short: "Holder's {type:water}-type attacks have 1.2× power.",
    source: 'a934460d',
  },
  nevermeltice: {
    short: "Holder's {type:ice}-type attacks have 1.2× power.",
    source: 'be6fe492',
  },
  normalgem: {
    short: "Holder's first successful {type:normal}-type attack will have 1.3× power. Single use.",
    source: '0a28c6a1',
  },
  occaberry: {
    short: 'Halves damage taken from a super effective {type:fire}-type attack. Single use.',
    source: 'a78e6302',
  },
  oranberry: {
    short: 'Restores 10 HP when at 1/2 max HP or less. Single use.',
    source: 'a667cf84',
  },
  passhoberry: {
    short: 'Halves damage taken from a super effective {type:water}-type attack. Single use.',
    source: '3a8d99de',
  },
  payapaberry: {
    short: 'Halves damage taken from a super effective {type:psychic}-type attack. Single use.',
    source: 'bb6ca1d8',
  },
  pechaberry: {
    short: 'Holder is cured if it is poisoned. Single use.',
    source: '313a625f',
  },
  persimberry: {
    short: 'Holder is cured if it is confused. Single use.',
    source: '129f9514',
  },
  pidgeotite: {
    short: 'Lets {pokemon:pidgeot} Mega Evolve into {pokemon:pidgeotmega}.',
    source: '05280fff',
  },
  pinsirite: {
    short: 'Lets {pokemon:pinsir} Mega Evolve into {pokemon:pinsirmega}.',
    source: 'd371c4fe',
  },
  poisonbarb: {
    short: "Holder's {type:poison}-type attacks have 1.2× power.",
    source: '45e53df3',
  },
  psychicseed: {
    short: "If the terrain is {condition:psychicterrain}, raises holder's Sp. Def by 1 stage. Single use.",
    source: '87c79ee1',
  },
  pyroarite: {
    short: 'Lets {pokemon:pyroar} Mega Evolve into {pokemon:pyroarmega}.',
    source: 'f5f20971',
  },
  quickclaw: {
    short: 'Each turn, holder has a 20% chance to move first in its priority bracket.',
    source: '8c6d5fd6',
  },
  raichunitex: {
    short: 'Lets {pokemon:raichu} Mega Evolve into {pokemon:raichumegax}.',
    source: '2e483d83',
  },
  raichunitey: {
    short: 'Lets {pokemon:raichu} Mega Evolve into {pokemon:raichumegay}.',
    source: '1be43d09',
  },
  rawstberry: {
    short: 'Holder is cured if it is burned. Single use.',
    source: '490c380f',
  },
  redcard: {
    short: 'If holder survives a hit, attacker is forced to switch to a random ally. Single use.',
    source: '9db9d143',
  },
  rindoberry: {
    short: 'Halves damage taken from a super effective {type:grass}-type attack. Single use.',
    source: '287e5f59',
  },
  rockyhelmet: {
    short: 'If holder is hit by a contact move, the attacker loses 1/6 of its max HP.',
    source: 'd3cbba7b',
  },
  roseliberry: {
    short: 'Halves damage taken from a super effective {type:fairy}-type attack. Single use.',
    source: 'a890cd71',
  },
  sablenite: {
    short: 'Lets {pokemon:sableye} Mega Evolve into {pokemon:sableyemega}.',
    source: '3b22b7f5',
  },
  salamencite: {
    short: 'Lets {pokemon:salamence} Mega Evolve into {pokemon:salamencemega}.',
    source: 'f6460fa5',
  },
  sceptilite: {
    short: 'Lets {pokemon:sceptile} Mega Evolve into {pokemon:sceptilemega}.',
    source: '09f099ba',
  },
  scizorite: {
    short: 'Lets {pokemon:scizor} Mega Evolve into {pokemon:scizormega}.',
    source: '77248565',
  },
  scolipite: {
    short: 'Lets {pokemon:scolipede} Mega Evolve into {pokemon:scolipedemega}.',
    source: '089ba413',
  },
  scopelens: {
    short: "Holder's critical hit ratio is raised by 1 stage.",
    source: '4d37228e',
  },
  scovillainite: {
    short: 'Lets {pokemon:scovillain} Mega Evolve into {pokemon:scovillainmega}.',
    source: '83d029d9',
  },
  scraftinite: {
    short: 'Lets {pokemon:scrafty} Mega Evolve into {pokemon:scraftymega}.',
    source: '3cec7446',
  },
  sharpbeak: {
    short: "Holder's {type:flying}-type attacks have 1.2× power.",
    source: '2d67fdba',
  },
  sharpedonite: {
    short: 'Lets {pokemon:sharpedo} Mega Evolve into {pokemon:sharpedomega}.',
    source: 'e1749db2',
  },
  shedshell: {
    short: 'Holder cannot be prevented from choosing to switch out by any effect.',
    source: '67c7a0b3',
  },
  shellbell: {
    short: 'After an attack, holder gains 1/8 of the damage in HP dealt to other Pokémon.',
    source: '51809202',
  },
  shucaberry: {
    short: 'Halves damage taken from a super effective {type:ground}-type attack. Single use.',
    source: 'cdee65b9',
  },
  silkscarf: {
    short: "Holder's {type:normal}-type attacks have 1.2× power.",
    source: '89623edb',
  },
  silverpowder: {
    short: "Holder's {type:bug}-type attacks have 1.2× power.",
    source: 'a4e94013',
  },
  sitrusberry: {
    short: 'Restores 1/4 max HP when at 1/2 max HP or less. Single use.',
    source: 'd8f4c664',
  },
  skarmorite: {
    short: 'Lets {pokemon:skarmory} Mega Evolve into {pokemon:skarmorymega}.',
    source: '87740aae',
  },
  slowbronite: {
    short: 'Lets {pokemon:slowbro} Mega Evolve into {pokemon:slowbromega}.',
    source: 'cd2fc985',
  },
  smoothrock: {
    short: "Holder's use of {move:sandstorm} lasts 8 turns instead of 5.",
    source: 'a94aa657',
  },
  softsand: {
    short: "Holder's {type:ground}-type attacks have 1.2× power.",
    source: '1f79d9ed',
  },
  spelltag: {
    short: "Holder's {type:ghost}-type attacks have 1.2× power.",
    source: 'a9670777',
  },
  staraptite: {
    short: 'Lets {pokemon:staraptor} Mega Evolve into {pokemon:staraptormega}.',
    source: '9a9dc55e',
  },
  starminite: {
    short: 'Lets {pokemon:starmie} Mega Evolve into {pokemon:starmiemega}.',
    source: '7e3de01f',
  },
  steelixite: {
    short: 'Lets {pokemon:steelix} Mega Evolve into {pokemon:steelixmega}.',
    source: '56f361e8',
  },
  swampertite: {
    short: 'Lets {pokemon:swampert} Mega Evolve into {pokemon:swampertmega}.',
    source: '2227c8c4',
  },
  tangaberry: {
    short: 'Halves damage taken from a super effective {type:bug}-type attack. Single use.',
    source: '14ee21b3',
  },
  terrainextender: {
    short: "Holder's terrains last 8 turns instead of 5.",
    long: 'When the holder sets {condition:electricterrain}, {condition:grassyterrain}, {condition:mistyterrain} or {condition:psychicterrain}, with a move or an Ability, it lasts 8 turns instead of 5.',
    source: '40d2a318',
  },
  twistedspoon: {
    short: "Holder's {type:psychic}-type attacks have 1.2× power.",
    source: '197f6ca8',
  },
  tyranitarite: {
    short: 'Lets {pokemon:tyranitar} Mega Evolve into {pokemon:tyranitarmega}.',
    source: '0761a73e',
  },
  venusaurite: {
    short: 'Lets {pokemon:venusaur} Mega Evolve into {pokemon:venusaurmega}.',
    source: 'e9b083d3',
  },
  victreebelite: {
    short: 'Lets {pokemon:victreebel} Mega Evolve into {pokemon:victreebelmega}.',
    source: '5a38549a',
  },
  wacanberry: {
    short: 'Halves damage taken from a super effective {type:electric}-type attack. Single use.',
    source: '3fb6d8ad',
  },
  whiteherb: {
    short: 'Restores all lowered stat stages to 0 when one is less than 0. Single use.',
    source: '00dc7de9',
  },
  widelens: {
    short: 'The accuracy of attacks by the holder is 1.1×.',
    source: 'd699a550',
  },
  wiseglasses: {
    short: "Holder's special attacks have 1.1× power.",
    source: 'b78d8da4',
  },
  yacheberry: {
    short: 'Halves damage taken from a super effective {type:ice}-type attack. Single use.',
    source: 'f80a553b',
  },
  zoomlens: {
    short: 'The accuracy of attacks by the holder is 1.2× if it moves after its target.',
    source: '9ce8f1b5',
  },
}
