// Our Spanish ability descriptions, translated from our English ones (`src/i18n/en/abilities.ts`), with the same
// markers: `{type:flying}`, `{move:taunt}`, `{ability:scrappy}`, `{item:ironball}`. Entries the regulation doesn't
// have are plain text, with their official Spanish names. Only a type import: `scripts/gen-data.ts` reads this file too.

import type { Description } from '@/i18n/en/abilities'

/**
 * By ability ID. `source` is the English text each was translated from (`hashText` in `scripts/gen-data.ts` of its
 * short and long descriptions): `npm run gen-data` lists the entries whose English has changed since, to revise.
 */
export const descriptions: Record<string, Description> = {
  adaptability: {
    short: 'La bonificación por mismo tipo (STAB) de este Pokémon es 2 en lugar de 1,5.',
    long: 'Los movimientos de este Pokémon que coinciden con uno de sus tipos tienen una bonificación por mismo tipo (STAB) de 2 en lugar de 1,5.',
    source: '523df9e9',
  },
  aerilate: {
    short:
      'Los movimientos de tipo {type:normal} de este Pokémon pasan a ser de tipo {type:flying} y tienen 1,2× potencia.',
    long: 'Los movimientos de tipo {type:normal} de este Pokémon pasan a ser de tipo {type:flying} y su potencia se multiplica por 1,2. Este efecto va después de otros efectos que cambian el tipo de un movimiento, pero antes de los de Cortina Plasma y {move:electrify}.',
    source: '96c6a452',
  },
  aftermath: {
    short: 'Si un movimiento de contacto debilita a este Pokémon, su usuario pierde 1/4 de sus PS máximos.',
    long: 'Si este Pokémon se debilita por un movimiento de contacto, el usuario del movimiento pierde 1/4 de sus PS máximos, redondeado hacia abajo. No ocurre si el usuario del movimiento tiene la habilidad {ability:magicguard} o si algún Pokémon en combate tiene la habilidad {ability:damp}.',
    source: '0880b93f',
  },
  analytic: {
    short: 'Los ataques de este Pokémon tienen 1,3× potencia si es el último en moverse en el turno.',
    long: 'La potencia del movimiento de este Pokémon se multiplica por 1,3 si es el último en moverse en el turno. No afecta a Deseo Oculto ni a {move:futuresight}.',
    source: '6ec33b13',
  },
  angerpoint: {
    short: 'Si este Pokémon (no su sustituto) recibe un golpe crítico, su Ataque sube 12 niveles.',
    long: 'Si este Pokémon, pero no su sustituto, recibe un golpe crítico, su Ataque sube 12 niveles.',
    source: '72ef9935',
  },
  anticipation: {
    short: 'Al entrar en combate, este Pokémon se estremece si un rival tiene un movimiento supereficaz u OHKO.',
    long: 'Al entrar en combate, este Pokémon se pone en alerta si algún rival tiene un movimiento de ataque de un tipo supereficaz contra él, o algún movimiento que debilita de un golpe (OHKO). Para ello, Poder Oculto cuenta como el tipo que tenga, y cualquier otro movimiento como su tipo original.',
    source: '8aa95f03',
  },
  armortail: {
    short: 'Protege a este Pokémon y a sus aliados de los movimientos con prioridad de los rivales.',
    long: 'Los movimientos con prioridad que usan los rivales contra este Pokémon o sus aliados no tienen efecto.',
    source: '73942102',
  },
  aromaveil: {
    short:
      'Protege al usuario y a sus aliados de {move:attract}, {move:disable}, {move:encore}, Anticura, {move:taunt} y {move:torment}.',
    long: 'Este Pokémon y sus aliados no pueden verse afectados por {move:attract}, {move:disable}, {move:encore}, Anticura, {move:taunt} ni {move:torment}.',
    source: '899845d2',
  },
  auraguard: {
    short: 'Este Pokémon recibe la mitad del daño de los movimientos de contacto.',
    long: 'Este Pokémon recibe la mitad del daño de los movimientos de contacto.',
    source: '685b560b',
  },
  battlearmor: {
    short: 'Este Pokémon no puede recibir golpes críticos.',
    source: '9a7097d1',
  },
  battlebond: {
    short:
      'Tras debilitar a un Pokémon: sube 1 nivel el Ataque, el Ataque Especial y la Velocidad. Una vez por combate.',
    long: 'Si este Pokémon es un Greninja, su Ataque, su Ataque Especial y su Velocidad suben 1 nivel si ataca y debilita a otro Pokémon. Este efecto solo puede ocurrir una vez por combate.',
    source: 'c9d48001',
  },
  berserk: {
    short: 'El Ataque Especial de este Pokémon sube 1 nivel cuando baja a la mitad o menos de sus PS máximos.',
    long: 'Cuando este Pokémon tiene más de la mitad de sus PS máximos y un ataque le hace bajar a la mitad o menos, su Ataque Especial sube 1 nivel. Este efecto se aplica tras todos los golpes de un movimiento multigolpe. No ocurre si la habilidad {ability:sheerforce} eliminó un efecto secundario del movimiento.',
    source: '816d9604',
  },
  bigpecks: {
    short: 'Impide que otros Pokémon bajen la Defensa de este Pokémon.',
    source: 'a33df6c7',
  },
  blaze: {
    short:
      'Con 1/3 o menos de sus PS máximos, la estadística ofensiva de este Pokémon es 1,5× con ataques de tipo {type:fire}.',
    long: 'Cuando este Pokémon tiene 1/3 o menos de sus PS máximos, redondeado hacia abajo, su estadística ofensiva se multiplica por 1,5 al usar un ataque de tipo {type:fire}.',
    source: '2ee3b289',
  },
  bulletproof: {
    short: 'Este Pokémon es inmune a los movimientos de bala y bomba.',
    source: '7d46c765',
  },
  cheekpouch: {
    short: 'Si este Pokémon se come una baya, recupera 1/3 de sus PS máximos además del efecto de la baya.',
    long: 'Si este Pokémon se come la baya que lleva, recupera 1/3 de sus PS máximos, redondeado hacia abajo, además del efecto de la baya. También puede activarse tras los efectos de {move:bugbite}, {move:fling}, {move:pluck}, {move:stuffcheeks} y {move:teatime} si la baya que se come tiene efecto en este Pokémon.',
    source: '7f475c6f',
  },
  chlorophyll: {
    short: 'Si hay {condition:sun}, la Velocidad de este Pokémon se duplica.',
    long: 'Si hay {condition:sun}, la Velocidad de este Pokémon se duplica. No ocurre si este Pokémon lleva un Parasol Multiuso.',
    source: 'b69d2b60',
  },
  clearbody: {
    short: 'Impide que otros Pokémon bajen las estadísticas de este Pokémon.',
    source: 'd8c7062e',
  },
  cloudnine: {
    short: 'Mientras este Pokémon está en combate, el tiempo atmosférico no tiene efecto.',
    source: 'b4e67fc6',
  },
  competitive: {
    short: 'El Ataque Especial de este Pokémon sube 2 niveles por cada estadística suya que baje un rival.',
    long: 'El Ataque Especial de este Pokémon sube 2 niveles por cada nivel de una estadística suya que baje un rival.',
    source: '3bec86ac',
  },
  compoundeyes: {
    short: 'La precisión de los movimientos de este Pokémon se multiplica por 1,3.',
    source: 'f4766e8e',
  },
  contrary: {
    short: 'Si una estadística de este Pokémon fuera a subir, baja en su lugar, y viceversa.',
    source: '1e7f64dc',
  },
  corrosion: {
    short: 'Este Pokémon puede envenenar o envenenar gravemente a un Pokémon sea cual sea su tipo.',
    source: '8f85fbb3',
  },
  cudchew: {
    short: 'Si este Pokémon se come una baya, vuelve a comérsela al final del turno siguiente.',
    source: 'c5047150',
  },
  curiousmedicine: {
    short: 'Al entrar en combate, los cambios en las estadísticas de los aliados de este Pokémon vuelven a 0.',
    source: '7e2303d1',
  },
  cursedbody: {
    short: 'Si un ataque golpea a este Pokémon, hay un 30% de probabilidad de que ese movimiento quede anulado.',
    long: 'Si un ataque golpea a este Pokémon, hay un 30% de probabilidad de que ese movimiento quede anulado, salvo que ya haya un movimiento del atacante anulado.',
    source: '38e95e58',
  },
  cutecharm: {
    short: '30% de probabilidad de enamorar a los Pokémon del sexo contrario que establezcan contacto.',
    long: 'Hay un 30% de probabilidad de que un Pokémon que establezca contacto con este Pokémon se enamore si es del sexo contrario.',
    source: '8b6add27',
  },
  damp: {
    short:
      'Impide {move:explosion}, Cabeza Sorpresa, {move:mistyexplosion}, {move:selfdestruct} y {ability:aftermath} mientras está en combate.',
    long: 'Mientras este Pokémon está en combate, {move:explosion}, Cabeza Sorpresa, {move:mistyexplosion}, {move:selfdestruct} y la habilidad {ability:aftermath} no tienen efecto.',
    source: '3786f450',
  },
  defiant: {
    short: 'El Ataque de este Pokémon sube 2 niveles por cada estadística suya que baje un rival.',
    long: 'El Ataque de este Pokémon sube 2 niveles por cada nivel de una estadística suya que baje un rival.',
    source: '26eda63e',
  },
  disguise: {
    short: '(Solo Mimikyu) Bloquea el primer golpe que recibe, y a cambio pierde 1/8 de sus PS.',
    long: 'Si este Pokémon es un Mimikyu, el primer golpe que recibe en el combate le causa 0 de daño neutro. Su disfraz se rompe entonces, cambia a Forma Descubierta y pierde 1/8 de sus PS máximos. El daño por confusión también rompe el disfraz.',
    source: 'bd5650b7',
  },
  dragonize: {
    short:
      'Los movimientos de tipo {type:normal} de este Pokémon pasan a ser de tipo {type:dragon} y tienen 1,2× potencia.',
    long: 'Los movimientos de tipo {type:normal} de este Pokémon pasan a ser de tipo {type:dragon} y su potencia se multiplica por 1,2. Este efecto va después de otros efectos que cambian el tipo de un movimiento, pero antes de los de Cortina Plasma y {move:electrify}.',
    source: 'f787f51b',
  },
  drizzle: {
    short: 'Al entrar en combate, este Pokémon invoca {condition:rain}.',
    source: '7e1148a7',
  },
  drought: {
    short: 'Al entrar en combate, este Pokémon invoca {condition:sun}.',
    source: 'e0a8b89c',
  },
  dryskin: {
    short:
      'Recupera 1/4 con {type:water} y 1/8 con {condition:rain}; sufre 1,25× con {type:fire} y pierde 1/8 con {condition:sun}.',
    long: 'Este Pokémon es inmune a los movimientos de tipo {type:water} y recupera 1/4 de sus PS máximos, redondeado hacia abajo, cuando le golpea uno. La potencia de los movimientos de tipo {type:fire} que se usan contra él se multiplica por 1,25. Al final de cada turno, este Pokémon recupera 1/8 de sus PS máximos, redondeado hacia abajo, si hay {condition:rain}, y pierde 1/8 de sus PS máximos, redondeado hacia abajo, si hay {condition:sun}. Los efectos del tiempo atmosférico no ocurren si este Pokémon lleva un Parasol Multiuso.',
    source: 'eaf676ef',
  },
  earlybird: {
    short: 'El contador de sueño de este Pokémon baja de 2 en 2 en lugar de 1 en 1.',
    source: 'd115e072',
  },
  eartheater: {
    short:
      'Este Pokémon recupera 1/4 de sus PS máximos cuando le golpea un movimiento de tipo {type:ground}; inmune a {type:ground}.',
    long: 'Este Pokémon es inmune a los movimientos de tipo {type:ground} y recupera 1/4 de sus PS máximos, redondeado hacia abajo, cuando le golpea un movimiento de tipo {type:ground}.',
    source: '927fbd50',
  },
  eelevate: {
    short: 'Este Pokémon es inmune a {type:ground}; sube 1 nivel su mejor estadística si debilita a otro Pokémon.',
    long: 'Este Pokémon es inmune a los ataques de tipo {type:ground} y a los efectos de {condition:spikes}, {condition:toxicspikes}, {condition:stickyweb} y la habilidad Trampa Arena. Los efectos de {condition:gravity}, {move:ingrain}, {move:smackdown}, Mil Flechas y {item:ironball} anulan la inmunidad. Mil Flechas puede golpear a este Pokémon como si no tuviera esta habilidad. Si este Pokémon ataca y debilita a otro Pokémon, su estadística más alta sube 1 nivel, sin contar los cambios en las estadísticas. Si varias empatan, tienen prioridad, en este orden, el Ataque, la Defensa, el Ataque Especial, la Defensa Especial y la Velocidad.',
    source: '1e8872d5',
  },
  effectspore: {
    short: '30% de probabilidad de envenenar, paralizar o dormir a quien establezca contacto con este Pokémon.',
    long: 'Hay un 30% de probabilidad de que un Pokémon que establezca contacto con este Pokémon quede envenenado, paralizado o dormido.',
    source: '0c6181e4',
  },
  electricsurge: {
    short: 'Al entrar en combate, este Pokémon crea un {condition:electricterrain}.',
    source: 'c51b1189',
  },
  electromorphosis: {
    short: 'Este Pokémon obtiene el efecto de {move:charge} cuando le golpea un ataque.',
    source: '4bf220a5',
  },
  embodyaspectcornerstone: {
    short: 'Al entrar en combate, la Defensa de este Pokémon sube 1 nivel.',
    source: '6b02cadb',
  },
  embodyaspecthearthflame: {
    short: 'Al entrar en combate, el Ataque de este Pokémon sube 1 nivel.',
    source: 'c48df360',
  },
  embodyaspectteal: {
    short: 'Al entrar en combate, la Velocidad de este Pokémon sube 1 nivel.',
    source: 'fb7f79c0',
  },
  embodyaspectwellspring: {
    short: 'Al entrar en combate, la Defensa Especial de este Pokémon sube 1 nivel.',
    source: '1aa4c663',
  },
  emergencyexit: {
    short: 'Este Pokémon se retira cuando baja a la mitad o menos de sus PS máximos.',
    long: 'Cuando este Pokémon tiene más de la mitad de sus PS máximos y un daño le hace bajar a la mitad o menos, se cambia de inmediato por un aliado a elegir. Este efecto se aplica tras todos los golpes de un movimiento multigolpe. No ocurre si la habilidad {ability:sheerforce} eliminó un efecto secundario del movimiento. Se aplica tanto al daño directo como al indirecto, salvo el de usar {move:curse} y {move:substitute}, {move:bellydrum}, {move:painsplit} y el daño por confusión.',
    source: '40ad4fe0',
  },
  fairyaura: {
    short:
      'Mientras este Pokémon está en combate, los movimientos de tipo {type:fairy} de cualquier Pokémon tienen 1,33× potencia.',
    long: 'Mientras este Pokémon está en combate, la potencia de los movimientos de tipo {type:fairy} que usan los Pokémon en combate se multiplica por 1,33.',
    source: 'efa027e0',
  },
  filter: {
    short: 'Este Pokémon recibe 3/4 del daño de los ataques supereficaces.',
    source: '225e7d92',
  },
  firemane: {
    short: 'La estadística ofensiva de este Pokémon se multiplica por 1,5 al usar un ataque de tipo {type:fire}.',
    source: 'e49214d5',
  },
  flamebody: {
    short: '30% de probabilidad de que un Pokémon que establezca contacto con este Pokémon quede quemado.',
    source: 'e86eeb2f',
  },
  flashfire: {
    short:
      'Si le golpea un movimiento de tipo {type:fire}, sus ataques de tipo {type:fire} hacen 1,5× daño; inmune a {type:fire}.',
    long: 'Este Pokémon es inmune a los movimientos de tipo {type:fire}. La primera vez que le golpea uno, su estadística ofensiva se multiplica por 1,5 al usar un ataque de tipo {type:fire}, mientras siga en combate y tenga esta habilidad. Si este Pokémon está congelado, los ataques de tipo {type:fire} no lo descongelan.',
    source: '00c67604',
  },
  flowerveil: {
    short:
      'Otros Pokémon no pueden bajar las estadísticas ni causar problemas de estado a los de tipo {type:grass} de su lado.',
    long: 'Otros Pokémon no pueden bajar las estadísticas de los Pokémon de tipo {type:grass} del lado de este Pokémon ni causarles un problema de estado.',
    source: '3c2ed1cc',
  },
  fluffy: {
    short:
      'Este Pokémon recibe la mitad del daño de los movimientos de contacto y el doble de los de tipo {type:fire}.',
    long: 'Este Pokémon recibe la mitad del daño de los movimientos de contacto, pero el doble del daño de los movimientos de tipo {type:fire}.',
    source: '19a71c71',
  },
  forecast: {
    short: 'El tipo de Castform cambia al del tiempo atmosférico que haya, salvo con {condition:sandstorm}.',
    long: 'Si este Pokémon es un Castform, su tipo cambia al del tiempo atmosférico que haya, salvo con {condition:sandstorm}. No ocurre si este Pokémon lleva un Parasol Multiuso y hay {condition:rain} o {condition:sun}.',
    source: '21e06241',
  },
  forewarn: {
    short: 'Al entrar en combate, este Pokémon descubre el movimiento de más potencia de los rivales.',
    long: 'Al entrar en combate, este Pokémon descubre el movimiento de más potencia, al azar, que conoce un rival. Para ello, los movimientos OHKO cuentan con 150 de potencia; {move:counter}, {move:mirrorcoat} y {move:metalburst}, con 120; cualquier otro movimiento de ataque sin potencia fija, con 80, y los movimientos que no causan daño, con 1.',
    source: 'a19c20a6',
  },
  friendguard: {
    short: 'Los aliados de este Pokémon reciben 3/4 del daño de los ataques de otros Pokémon.',
    source: '3072bf2c',
  },
  frisk: {
    short: 'Al entrar en combate, este Pokémon descubre los objetos que llevan todos los rivales.',
    source: '57668fdf',
  },
  furcoat: {
    short: 'La Defensa de este Pokémon se duplica.',
    source: '6aa71b01',
  },
  galewings: {
    short: 'Si este Pokémon tiene todos sus PS, sus movimientos de tipo {type:flying} tienen 1 más de prioridad.',
    source: '202fb70c',
  },
  gluttony: {
    short: 'Este Pokémon se come las bayas con la mitad o menos de sus PS máximos, en lugar del 1/4 habitual.',
    long: 'Si este Pokémon lleva una baya que se activa normalmente con 1/4 o menos de sus PS máximos, se la come con la mitad o menos en su lugar.',
    source: '5ef07d2e',
  },
  goodasgold: {
    short: 'Este Pokémon es inmune a los movimientos de estado.',
    source: '9329b7c3',
  },
  gooey: {
    short: 'La Velocidad de los Pokémon que establecen contacto con este Pokémon baja 1 nivel.',
    source: 'b34b630f',
  },
  grasspelt: {
    short: 'Si hay {condition:grassyterrain}, la Defensa de este Pokémon se multiplica por 1,5.',
    source: 'c48966a8',
  },
  grassysurge: {
    short: 'Al entrar en combate, este Pokémon crea un {condition:grassyterrain}.',
    source: '84f27bf5',
  },
  guarddog: {
    short: 'Inmune a {ability:intimidate}, que le sube 1 nivel el Ataque. No se le puede obligar a cambiarse.',
    long: 'Este Pokémon es inmune al efecto de la habilidad {ability:intimidate} y, en su lugar, su Ataque sube 1 nivel. Los ataques y objetos de otros Pokémon no pueden obligarle a cambiarse.',
    source: 'e25ff1ae',
  },
  gulpmissile: {
    short:
      'Si le golpean tras {move:surf} o {move:dive}, el atacante pierde 1/4 de sus PS máximos y baja su Defensa o queda paralizado.',
    long: 'Si este Pokémon es un Cramorant, cambia de forma cuando golpea a un objetivo con {move:surf} o usa con éxito el primer turno de {move:dive}. Pasa a Forma Tragatodo, con un Arrokuda en la boca, si le queda más de la mitad de sus PS máximos, o a Forma Engulletodo, con un Pikachu en la boca, si le queda la mitad o menos. Si le golpean en Forma Tragatodo o Engulletodo, le escupe el Arrokuda o el Pikachu al atacante, aunque ya no le queden PS. El proyectil causa un daño igual a 1/4 de los PS máximos del objetivo, redondeado hacia abajo; la habilidad {ability:magicguard} lo bloquea, pero un sustituto no. Un Arrokuda baja además 1 nivel la Defensa del objetivo, y un Pikachu lo paraliza. Cramorant vuelve a la normalidad si escupe un proyectil, se cambia o se dinamaxiza.',
    source: '079b4df0',
  },
  guts: {
    short:
      'Con un problema de estado, el Ataque de este Pokémon es 1,5×; no le afecta la reducción del daño físico por quemadura.',
    long: 'Si este Pokémon tiene un problema de estado, su Ataque se multiplica por 1,5. Los ataques físicos de este Pokémon no sufren la reducción a la mitad del daño por quemadura.',
    source: 'ef2dff00',
  },
  harvest: {
    short:
      'Si lo último que usó fue una baya, 50% de probabilidad de recuperarla al final de cada turno; 100% con {condition:sun}.',
    long: 'Si el último objeto que usó este Pokémon fue una baya, hay un 50% de probabilidad de que la recupere al final de cada turno. Si hay {condition:sun}, la probabilidad es del 100%.',
    source: 'fedf6921',
  },
  healer: {
    short: '50% de probabilidad de curar el problema de estado del aliado de este Pokémon al final de cada turno.',
    source: 'b8d79fb2',
  },
  heatproof: {
    short:
      'El daño de tipo {type:fire} contra este Pokémon se calcula con la mitad de la estadística ofensiva; mitad de daño por quemadura.',
    long: 'Si un Pokémon usa un ataque de tipo {type:fire} contra este Pokémon, su estadística ofensiva se reduce a la mitad al calcular el daño. Este Pokémon recibe la mitad del daño habitual por quemadura, redondeado hacia abajo.',
    source: '8f55a811',
  },
  heavymetal: {
    short: 'El peso de este Pokémon se duplica.',
    long: 'El peso de este Pokémon se duplica. Se calcula después del efecto de Aligerar y antes del de la Piedra Pómez.',
    source: 'd45a63be',
  },
  hospitality: {
    short: 'Al entrar en combate, este Pokémon restaura 1/4 de los PS máximos de su aliado, redondeado hacia abajo.',
    source: 'df1e0e14',
  },
  hugepower: {
    short: 'El Ataque de este Pokémon se duplica.',
    source: 'e47748d1',
  },
  hungerswitch: {
    short: 'Si es Morpeko, alterna entre la Forma Saciada y la Forma Voraz al final de cada turno.',
    long: 'Si este Pokémon es un Morpeko, alterna entre su Forma Saciada y su Forma Voraz al final de cada turno.',
    source: '6c561e2e',
  },
  hustle: {
    short: 'El Ataque de este Pokémon es 1,5× y la precisión de sus ataques físicos, 0,8×.',
    long: 'El Ataque de este Pokémon se multiplica por 1,5 y la precisión de sus ataques físicos, por 0,8.',
    source: '6cf1aa01',
  },
  hydration: {
    short: 'Si hay {condition:rain}, este Pokémon se cura de su problema de estado al final de cada turno.',
    long: 'Si hay {condition:rain}, este Pokémon se cura de su problema de estado al final de cada turno. No ocurre si este Pokémon lleva un Parasol Multiuso.',
    source: 'a2503255',
  },
  hypercutter: {
    short: 'Impide que otros Pokémon bajen el Ataque de este Pokémon.',
    source: 'bedc5511',
  },
  icebody: {
    short: 'Si hay {condition:snow}, este Pokémon recupera 1/16 de sus PS máximos cada turno.',
    long: 'Si hay {condition:snow}, este Pokémon recupera 1/16 de sus PS máximos, redondeado hacia abajo, al final de cada turno.',
    source: '575fc0e8',
  },
  iceface: {
    short: 'Si es Eiscue, el primer golpe físico que recibe le causa 0 de daño. Se recupera con {condition:snow}.',
    long: 'Si este Pokémon es un Eiscue, el primer golpe físico que recibe en el combate le causa 0 de daño neutro. Su cara de hielo se rompe entonces y cambia a Cara Deshielo. Eiscue recupera la Cara de Hielo cuando empieza a haber {condition:snow} o cuando entra en combate mientras hay {condition:snow}. El daño por confusión también rompe la cara de hielo.',
    source: '9a72eec6',
  },
  illuminate: {
    short: 'Otros no pueden bajar la precisión de este Pokémon; ignora la evasión de los demás.',
    long: 'Impide que otros Pokémon bajen la precisión de este Pokémon. Este Pokémon ignora los cambios en la evasión del objetivo.',
    source: 'eb72e317',
  },
  illusion: {
    short: 'Este Pokémon aparece como el último Pokémon del equipo hasta que recibe daño directo.',
    long: 'Cuando este Pokémon entra en combate, aparece como el último Pokémon no debilitado de su equipo hasta que recibe daño directo de un ataque de otro Pokémon. Se muestran el nivel y los PS reales de este Pokémon en lugar de los del Pokémon imitado.',
    source: '64735958',
  },
  immunity: {
    short: 'Este Pokémon no puede ser envenenado. Obtener esta habilidad estando envenenado lo cura.',
    source: '89585697',
  },
  imposter: {
    short: 'Al entrar en combate, este Pokémon se transforma en el rival que tiene enfrente.',
    long: 'Al entrar en combate, este Pokémon se transforma en el rival que tiene enfrente. Si no hay ningún Pokémon en esa posición, este Pokémon no usa {move:transform}.',
    source: '04374748',
  },
  infiltrator: {
    short:
      'Sus movimientos ignoran los sustitutos y {move:reflect}, {move:lightscreen}, {move:safeguard}, Neblina y {move:auroraveil} rivales.',
    long: 'Los movimientos de este Pokémon ignoran los sustitutos y los efectos de {move:reflect}, {move:lightscreen}, {move:safeguard}, Neblina y {move:auroraveil} del lado rival.',
    source: 'd38ff406',
  },
  innardsout: {
    short: 'Si un movimiento debilita a este Pokémon, su usuario pierde los mismos PS.',
    long: 'Si este Pokémon se debilita por un movimiento, el usuario del movimiento pierde tantos PS como el daño que le causó.',
    source: 'edf38393',
  },
  innerfocus: {
    short: 'Este Pokémon no puede retroceder. Inmune a {ability:intimidate}.',
    long: 'Este Pokémon no puede retroceder. Es inmune al efecto de la habilidad {ability:intimidate}.',
    source: '854592bc',
  },
  insomnia: {
    short: 'Este Pokémon no puede quedarse dormido. Obtener esta habilidad estando dormido lo despierta.',
    source: 'cdbc59c8',
  },
  intimidate: {
    short: 'Al entrar en combate, este Pokémon baja 1 nivel el Ataque de los rivales.',
    long: 'Al entrar en combate, este Pokémon baja 1 nivel el Ataque de los rivales. Son inmunes los Pokémon con las habilidades {ability:innerfocus}, {ability:oblivious}, {ability:owntempo} o {ability:scrappy} y los que están tras un sustituto.',
    source: '75a6b468',
  },
  ironfist: {
    short: 'Los movimientos de puño de este Pokémon tienen 1,2× potencia. No potencia {move:suckerpunch}.',
    long: 'La potencia de los movimientos de puño de este Pokémon se multiplica por 1,2.',
    source: '2718dce0',
  },
  justified: {
    short: 'El Ataque de este Pokémon sube 1 nivel cuando le daña un movimiento de tipo {type:dark}.',
    source: 'de09319f',
  },
  keeneye: {
    short: 'Otros no pueden bajar la precisión de este Pokémon; ignora la evasión de los demás.',
    long: 'Impide que otros Pokémon bajen la precisión de este Pokémon. Este Pokémon ignora los cambios en la evasión del objetivo.',
    source: 'eb72e317',
  },
  klutz: {
    short: 'El objeto que lleva este Pokémon no tiene efecto, salvo el Brazal Firme. No puede usar {move:fling}.',
    long: 'El objeto que lleva este Pokémon no tiene efecto. Este Pokémon no puede usar {move:fling} con éxito. El Brazal Firme, la Franja Recia, la Banda Recia, el Cinto Recio, el Brazal Recio, la Lente Recia y la Pesa Recia siguen teniendo efecto.',
    source: '20059cce',
  },
  leafguard: {
    short: 'Si hay {condition:sun}, este Pokémon no puede sufrir problemas de estado y {move:rest} falla.',
    long: 'Si hay {condition:sun}, este Pokémon no puede sufrir problemas de estado ni verse afectado por {move:yawn}, y {move:rest} falla. No ocurre si este Pokémon lleva un Parasol Multiuso.',
    source: '0579ba6d',
  },
  levitate: {
    short:
      'Este Pokémon es inmune a {type:ground}; {condition:gravity}, {move:ingrain}, {move:smackdown} y {item:ironball} lo anulan.',
    long: 'Este Pokémon es inmune a los ataques de tipo {type:ground} y a los efectos de {condition:spikes}, {condition:toxicspikes}, {condition:stickyweb} y la habilidad Trampa Arena. Los efectos de {condition:gravity}, {move:ingrain}, {move:smackdown}, Mil Flechas y {item:ironball} anulan la inmunidad. Mil Flechas puede golpear a este Pokémon como si no tuviera esta habilidad.',
    source: '61b9e41a',
  },
  libero: {
    short: 'El tipo de este Pokémon cambia al del movimiento que usa. Una vez cada vez que entra en combate.',
    long: 'El tipo de este Pokémon cambia al del movimiento que va a usar. Este efecto va después de todos los efectos que cambian el tipo de un movimiento. Solo puede ocurrir una vez cada vez que entra en combate, y solo si este Pokémon no está teracristalizado.',
    source: '8959bf29',
  },
  lightmetal: {
    short: 'El peso de este Pokémon se reduce a la mitad.',
    long: 'El peso de este Pokémon se reduce a la mitad, redondeado hacia abajo a la décima de kilo. Se calcula después del efecto de Aligerar y antes del de la Piedra Pómez. El peso de un Pokémon no baja de 0,1 kg.',
    source: '0b82d268',
  },
  lightningrod: {
    short:
      'Atrae los movimientos de tipo {type:electric}, que le suben 1 nivel el Ataque Especial; inmune a {type:electric}.',
    long: 'Este Pokémon es inmune a los movimientos de tipo {type:electric} y su Ataque Especial sube 1 nivel cuando le golpea uno. Si este Pokémon no es el objetivo de un movimiento de tipo {type:electric} de un solo objetivo que usa otro Pokémon, lo atrae hacia sí si está a su alcance. Si varios Pokémon pueden atraerlo con esta habilidad, va al de más Velocidad o, si empatan, al que lleva más tiempo con la habilidad activa.',
    source: '43b2904b',
  },
  limber: {
    short: 'Este Pokémon no puede ser paralizado. Obtener esta habilidad estando paralizado lo cura.',
    source: 'cddf2f03',
  },
  liquidooze: {
    short: 'Quien absorbe PS de este Pokémon pierde los PS que iba a recuperar.',
    source: '4a9acf41',
  },
  liquidvoice: {
    short: 'Los movimientos de sonido de este Pokémon pasan a ser de tipo {type:water}.',
    long: 'Los movimientos de sonido de este Pokémon pasan a ser de tipo {type:water}. Este efecto va después de otros efectos que cambian el tipo de un movimiento, pero antes de los de Cortina Plasma y {move:electrify}.',
    source: '92b0bcd1',
  },
  longreach: {
    short: 'Los ataques de este Pokémon no establecen contacto con el objetivo.',
    source: 'd2cdbf98',
  },
  magicbounce: {
    short: 'Este Pokémon bloquea ciertos movimientos de estado y se los devuelve al usuario.',
    long: 'Este Pokémon no se ve afectado por ciertos movimientos que no causan daño dirigidos a él, y en su lugar los usa contra el usuario original. Los movimientos devueltos así no pueden volver a devolverse con esta habilidad ni con Capa Mágica. {condition:spikes}, {condition:stealthrock}, {condition:stickyweb} y {condition:toxicspikes} solo pueden devolverse una vez por lado, por el Pokémon más a la izquierda con esta habilidad o Capa Mágica. Las habilidades {ability:lightningrod} y Colector atraen sus movimientos antes de que esta habilidad tenga efecto.',
    source: '7a05ef87',
  },
  magicguard: {
    short: 'Este Pokémon solo recibe daño de los ataques directos.',
    long: 'Este Pokémon solo recibe daño de los ataques directos. Usar {move:curse} y {move:substitute}, {move:bellydrum}, {move:painsplit}, el daño de retroceso de Forcejeo y el daño por confusión cuentan como daño directo.',
    source: 'bcbb838a',
  },
  magician: {
    short: 'Si este Pokémon no lleva objeto, le roba el suyo a un Pokémon al que golpea con un ataque.',
    long: 'Si este Pokémon no lleva objeto, le roba el suyo a un Pokémon al que golpea con un ataque. No afecta a Deseo Oculto ni a {move:futuresight}. Si el ataque golpea a varios objetivos, roba el objeto del más rápido, teniendo en cuenta el efecto de {move:trickroom} y dando prioridad a los rivales sobre los aliados.',
    source: 'fdb225b9',
  },
  magmaarmor: {
    short: 'Este Pokémon no puede ser congelado. Obtener esta habilidad estando congelado lo cura.',
    source: '5440ee75',
  },
  marvelscale: {
    short: 'Si este Pokémon tiene un problema de estado, su Defensa se multiplica por 1,5.',
    source: 'ebf7505d',
  },
  megalauncher: {
    short:
      'Los movimientos de pulso de este Pokémon tienen 1,5× potencia. {move:healpulse} cura 3/4 de los PS máximos del objetivo.',
    long: 'La potencia de los movimientos de pulso de este Pokémon se multiplica por 1,5. {move:healpulse} restaura 3/4 de los PS máximos del objetivo, redondeando hacia abajo la mitad.',
    source: 'c2549dd8',
  },
  megasol: {
    short: 'Este Pokémon usa sus movimientos como si hubiera {condition:sun}.',
    source: '0f3f2a0d',
  },
  merciless: {
    short: 'Los ataques de este Pokémon son golpes críticos si el objetivo está envenenado.',
    source: '01579783',
  },
  mimicry: {
    short: 'Los tipos de este Pokémon cambian según el campo. Vuelven a los suyos cuando el campo termina.',
    long: 'Los tipos de este Pokémon cambian según el campo activo cuando obtiene esta habilidad o cuando se crea un campo: tipo {type:electric} con {condition:electricterrain}, tipo {type:grass} con {condition:grassyterrain}, tipo {type:fairy} con {condition:mistyterrain} y tipo {type:psychic} con {condition:psychicterrain}. Si obtiene esta habilidad sin ningún campo activo, o un campo termina, sus tipos vuelven a ser los originales de su especie.',
    source: 'a7d88d19',
  },
  minus: {
    short: 'Si un aliado en combate tiene esta habilidad o {ability:plus}, el Ataque Especial de este Pokémon es 1,5×.',
    long: 'Si un aliado en combate tiene esta habilidad o la habilidad {ability:plus}, el Ataque Especial de este Pokémon se multiplica por 1,5.',
    source: '2dc4aa82',
  },
  mirrorarmor: {
    short: 'Si fueran a bajar las estadísticas de este Pokémon, bajan las del atacante en su lugar.',
    long: 'Cuando otro Pokémon fuera a bajar una estadística de este Pokémon, baja la de ese Pokémon en su lugar. No ocurre si la estadística de este Pokémon ya estaba en -6. Si el otro Pokémon tiene un sustituto, no baja la de ninguno de los dos.',
    source: '8bc43f86',
  },
  moldbreaker: {
    short: 'Los movimientos de este Pokémon y sus efectos ignoran las habilidades de los demás Pokémon.',
    long: 'Los movimientos de este Pokémon y sus efectos ignoran ciertas habilidades de los demás Pokémon. Las habilidades que pueden anularse son {ability:armortail}, {ability:aromaveil}, Rompeaura, {ability:battlearmor}, {ability:bigpecks}, {ability:bulletproof}, {ability:clearbody}, {ability:contrary}, {ability:damp}, Cuerpo Vívido, {ability:disguise}, {ability:dryskin}, {ability:eartheater}, {ability:filter}, {ability:flashfire}, Don Floral, {ability:flowerveil}, {ability:fluffy}, {ability:friendguard}, {ability:furcoat}, {ability:goodasgold}, {ability:grasspelt}, {ability:guarddog}, {ability:heatproof}, {ability:heavymetal}, {ability:hypercutter}, Cara de Hielo, Escama de Hielo, {ability:illuminate}, {ability:immunity}, {ability:innerfocus}, {ability:insomnia}, {ability:keeneye}, {ability:leafguard}, {ability:levitate}, {ability:lightmetal}, {ability:lightningrod}, {ability:limber}, {ability:magicbounce}, {ability:magmaarmor}, {ability:marvelscale}, Ojo Mental, {ability:mirrorarmor}, {ability:motordrive}, {ability:multiscale}, {ability:oblivious}, {ability:overcoat}, {ability:owntempo}, Velo Pastel, {ability:punkrock}, {ability:purifyingsalt}, {ability:queenlymajesty}, {ability:sandveil}, {ability:sapsipper}, {ability:shellarmor}, {ability:shielddust}, Simple, {ability:snowcloak}, {ability:solidrock}, {ability:soundproof}, {ability:stickyhold}, Colector, {ability:sturdy}, {ability:suctioncups}, {ability:sweetveil}, {ability:tangledfeet}, {ability:telepathy}, Teracaparazón, {ability:thermalexchange}, {ability:thickfat}, {ability:unaware}, {ability:vitalspirit}, {ability:voltabsorb}, {ability:waterabsorb}, {ability:waterbubble}, Velo Agua, Cuerpo Horneado, {ability:whitesmoke}, Surcavientos, Superguarda y Piel Milagro. Afecta a todos los demás Pokémon en el campo, sean o no objetivo del movimiento de este Pokémon, y tanto si su habilidad le beneficia como si no.',
    source: '618c00f6',
  },
  moody: {
    short: 'Cada turno sube 2 niveles una estadística al azar (salvo precisión y evasión) y baja 1 nivel otra.',
    long: 'Al final de cada turno, una estadística al azar de este Pokémon, que no sea la precisión ni la evasión, sube 2 niveles y otra baja 1 nivel.',
    source: '459729d1',
  },
  motordrive: {
    short:
      'La Velocidad de este Pokémon sube 1 nivel si le golpea un movimiento de tipo {type:electric}; inmune a {type:electric}.',
    long: 'Este Pokémon es inmune a los movimientos de tipo {type:electric} y su Velocidad sube 1 nivel cuando le golpea uno.',
    source: '1b54255a',
  },
  moxie: {
    short: 'El Ataque de este Pokémon sube 1 nivel si ataca y debilita a otro Pokémon.',
    source: '9294da72',
  },
  multiscale: {
    short: 'Si este Pokémon tiene todos sus PS, el daño que recibe de los ataques se reduce a la mitad.',
    source: '57d0a946',
  },
  mummy: {
    short: 'Los Pokémon que establecen contacto con este Pokémon pasan a tener la habilidad Momia.',
    long: 'Los Pokémon que establecen contacto con este Pokémon pasan a tener la habilidad Momia. No afecta a los Pokémon con las habilidades Unidad Ecuestre, {ability:battlebond}, Letargo Perenne, {ability:disguise}, Tragamisil, Cara de Hielo, Multitipo, Momia, Agrupamiento, Sistema Alfa, Banco, Escudo Limitado, {ability:stancechange}, Teracambio, Modo Daruma o {ability:zerotohero}.',
    source: 'af148062',
  },
  naturalcure: {
    short: 'Este Pokémon se cura de su problema de estado al cambiarse.',
    source: 'e6395bad',
  },
  noguard: {
    short: 'Todos los movimientos que usa este Pokémon o que se usan contra él aciertan siempre.',
    source: 'e7294611',
  },
  oblivious: {
    short: 'Este Pokémon no puede enamorarse ni verse afectado por {move:taunt}. Inmune a {ability:intimidate}.',
    long: 'Este Pokémon no puede enamorarse ni verse afectado por {move:taunt}. Obtener esta habilidad estando enamorado o bajo los efectos de {move:taunt} lo cura. Es inmune al efecto de la habilidad {ability:intimidate}.',
    source: '29866d2b',
  },
  opportunist: {
    short: 'Cuando sube una estadística de un rival, este Pokémon copia la subida.',
    source: '6aaeb965',
  },
  overcoat: {
    short:
      'Este Pokémon es inmune a los movimientos de polvo, al daño de {condition:sandstorm} y a {ability:effectspore}.',
    long: 'Este Pokémon es inmune a los movimientos de polvo, al daño de {condition:sandstorm} y a los efectos de {move:ragepowder} y la habilidad {ability:effectspore}.',
    source: 'c3779a16',
  },
  overgrow: {
    short:
      'Con 1/3 o menos de sus PS máximos, la estadística ofensiva de este Pokémon es 1,5× con ataques de tipo {type:grass}.',
    long: 'Cuando este Pokémon tiene 1/3 o menos de sus PS máximos, redondeado hacia abajo, su estadística ofensiva se multiplica por 1,5 al usar un ataque de tipo {type:grass}.',
    source: '711aa034',
  },
  owntempo: {
    short: 'Este Pokémon no puede quedar confuso. Inmune a {ability:intimidate}.',
    long: 'Este Pokémon no puede quedar confuso. Obtener esta habilidad estando confuso lo cura. Es inmune al efecto de la habilidad {ability:intimidate}.',
    source: '5648c514',
  },
  parentalbond: {
    short: 'Los movimientos que causan daño de este Pokémon golpean dos veces. El segundo golpe hace 1/4 del daño.',
    long: 'Los movimientos que causan daño de este Pokémon pasan a ser multigolpe y golpean dos veces. El segundo golpe hace 1/4 del daño. No afecta a Deseo Oculto, {move:dragondarts}, Cañón Dinamax, {move:endeavor}, {move:explosion}, {move:finalgambit}, {move:fling}, {move:futuresight}, Bola Hielo, Rodar, {move:selfdestruct}, los movimientos multigolpe, los movimientos de varios objetivos ni los movimientos de dos turnos.',
    source: 'cde2d718',
  },
  pickpocket: {
    short: 'Si este Pokémon no lleva objeto y le golpea un movimiento de contacto, le roba el objeto al atacante.',
    long: 'Si este Pokémon no lleva objeto y le golpea un movimiento de contacto, le roba el objeto al atacante. Este efecto se aplica tras todos los golpes de un movimiento multigolpe. No ocurre si la habilidad {ability:sheerforce} eliminó un efecto secundario del movimiento.',
    source: 'd33988e6',
  },
  pickup: {
    short: 'Si este Pokémon no lleva objeto, recoge uno que haya usado un Pokémon adyacente en el turno.',
    long: 'Al final de cada turno, si este Pokémon no lleva objeto y al menos un Pokémon adyacente usó un objeto en el turno, se elige uno de ellos al azar y este Pokémon obtiene el último objeto que usó. No cuenta como último objeto usado un {item:airballoon} reventado, un objeto que recogió otro Pokémon con esta habilidad ni un objeto perdido por {move:bugbite}, {move:corrosivegas}, {move:covet}, Calcinación, {move:knockoff}, {move:pluck} o {move:thief}. Los objetos lanzados con {move:fling} pueden recogerse.',
    source: 'a20542f9',
  },
  piercingdrill: {
    short: 'Los movimientos de contacto de este Pokémon atraviesan las protecciones y hacen 1/4 del daño habitual.',
    source: 'a3aea283',
  },
  pixilate: {
    short:
      'Los movimientos de tipo {type:normal} de este Pokémon pasan a ser de tipo {type:fairy} y tienen 1,2× potencia.',
    long: 'Los movimientos de tipo {type:normal} de este Pokémon pasan a ser de tipo {type:fairy} y su potencia se multiplica por 1,2. Este efecto va después de otros efectos que cambian el tipo de un movimiento, pero antes de los de Cortina Plasma y {move:electrify}.',
    source: '5ccafb10',
  },
  plus: {
    short:
      'Si un aliado en combate tiene esta habilidad o {ability:minus}, el Ataque Especial de este Pokémon es 1,5×.',
    long: 'Si un aliado en combate tiene esta habilidad o la habilidad {ability:minus}, el Ataque Especial de este Pokémon se multiplica por 1,5.',
    source: 'cbfc4726',
  },
  poisonheal: {
    short: 'Envenenado, este Pokémon recupera 1/8 de sus PS máximos cada turno en lugar de perder PS.',
    long: 'Si este Pokémon está envenenado, recupera 1/8 de sus PS máximos, redondeado hacia abajo, al final de cada turno en lugar de perder PS.',
    source: '7589c9df',
  },
  poisonpoint: {
    short: '30% de probabilidad de que un Pokémon que establezca contacto con este Pokémon quede envenenado.',
    source: 'be43e342',
  },
  poisontouch: {
    short: 'Los movimientos de contacto de este Pokémon tienen un 30% de probabilidad de envenenar.',
    long: 'Los movimientos de contacto de este Pokémon tienen un 30% de probabilidad de envenenar. Este efecto va después de la probabilidad de efecto secundario propia del movimiento.',
    source: '4e9b274d',
  },
  prankster: {
    short:
      'Los movimientos de estado de este Pokémon tienen 1 más de prioridad, pero los de tipo {type:dark} son inmunes.',
    long: 'Los movimientos que no causan daño de este Pokémon tienen 1 más de prioridad. Los rivales de tipo {type:dark} son inmunes a estos movimientos, y a cualquier movimiento que estos invoquen, si quien acaba usando el movimiento tiene esta habilidad.',
    source: '9c5330c9',
  },
  pressure: {
    short: 'Si este Pokémon es objetivo del movimiento de un rival, ese movimiento gasta 1 PP más.',
    long: 'Si este Pokémon es objetivo del movimiento de un rival, ese movimiento gasta 1 PP más. {move:imprison}, Robo y Teraexplosión también gastan 1 PP más cuando los usa un rival, pero {condition:stickyweb} no.',
    source: 'c3b6e883',
  },
  protean: {
    short: 'El tipo de este Pokémon cambia al del movimiento que usa. Una vez cada vez que entra en combate.',
    long: 'El tipo de este Pokémon cambia al del movimiento que va a usar. Este efecto va después de todos los efectos que cambian el tipo de un movimiento. Solo puede ocurrir una vez cada vez que entra en combate, y solo si este Pokémon no está teracristalizado.',
    source: '8959bf29',
  },
  psychicsurge: {
    short: 'Al entrar en combate, este Pokémon crea un {condition:psychicterrain}.',
    source: '8bf9bf4c',
  },
  punkrock: {
    short: 'Este Pokémon recibe la mitad del daño de los movimientos de sonido. Los suyos tienen 1,3× potencia.',
    long: 'La potencia de los movimientos de sonido de este Pokémon se multiplica por 1,3. Este Pokémon recibe la mitad del daño de los movimientos de sonido.',
    source: '1931bd32',
  },
  purepower: {
    short: 'El Ataque de este Pokémon se duplica.',
    source: 'e47748d1',
  },
  purifyingsalt: {
    short:
      'El daño de tipo {type:ghost} contra este Pokémon se calcula con la mitad de la estadística ofensiva; no sufre problemas de estado.',
    long: 'Este Pokémon no puede sufrir problemas de estado ni verse afectado por {move:yawn}. Si un Pokémon usa un ataque de tipo {type:ghost} contra este Pokémon, su estadística ofensiva se reduce a la mitad al calcular el daño.',
    source: '025e1dc0',
  },
  queenlymajesty: {
    short: 'Protege a este Pokémon y a sus aliados de los movimientos con prioridad de los rivales.',
    long: 'Los movimientos con prioridad que usan los rivales contra este Pokémon o sus aliados no tienen efecto.',
    source: '73942102',
  },
  quickdraw: {
    short: 'Este Pokémon tiene un 30% de probabilidad de moverse primero en su prioridad con movimientos de ataque.',
    source: 'b6efc658',
  },
  quickfeet: {
    short:
      'Con un problema de estado, la Velocidad de este Pokémon es 1,5×; no le afecta la bajada de Velocidad por parálisis.',
    long: 'Si este Pokémon tiene un problema de estado, su Velocidad se multiplica por 1,5. No le afecta la reducción a la mitad de la Velocidad por parálisis.',
    source: '2360b5cd',
  },
  raindish: {
    short: 'Si hay {condition:rain}, este Pokémon recupera 1/16 de sus PS máximos cada turno.',
    long: 'Si hay {condition:rain}, este Pokémon recupera 1/16 de sus PS máximos, redondeado hacia abajo, al final de cada turno. No ocurre si este Pokémon lleva un Parasol Multiuso.',
    source: 'b91524e1',
  },
  rattled: {
    short:
      'La Velocidad sube 1 nivel si le golpea un ataque de tipo {type:bug}, {type:dark} o {type:ghost}, o le afecta {ability:intimidate}.',
    long: 'La Velocidad de este Pokémon sube 1 nivel si le golpea un ataque de tipo {type:bug}, {type:dark} o {type:ghost}, o si un rival le afecta con la habilidad {ability:intimidate}.',
    source: 'e697d5a8',
  },
  receiver: {
    short: 'Este Pokémon copia la habilidad de un aliado que se debilita.',
    long: 'Este Pokémon copia la habilidad de un aliado que se debilita. No pueden copiarse Unidad Ecuestre, {ability:battlebond}, Letargo Perenne, Comandar, {ability:disguise}, Evocarrecuerdos, Don Floral, {ability:forecast}, {ability:hungerswitch}, Cara de Hielo, {ability:illusion}, {ability:imposter}, Multitipo, Gas Reactivo, Títere Tóxico, Agrupamiento, Reacción Química, Paleosíntesis, Carga Cuark, Receptor, Sistema Alfa, Banco, Escudo Limitado, {ability:stancechange}, Teracaparazón, Teracambio, Teraformación 0, {ability:trace}, Superguarda, Modo Daruma ni {ability:zerotohero}.',
    source: 'a3a909c0',
  },
  reckless: {
    short: 'Los ataques de este Pokémon con daño de retroceso o por fallo tienen 1,2× potencia; no Forcejeo.',
    long: 'La potencia de los ataques de este Pokémon con daño de retroceso o daño por fallo se multiplica por 1,2. No afecta a Forcejeo.',
    source: '84ae7e94',
  },
  refrigerate: {
    short:
      'Los movimientos de tipo {type:normal} de este Pokémon pasan a ser de tipo {type:ice} y tienen 1,2× potencia.',
    long: 'Los movimientos de tipo {type:normal} de este Pokémon pasan a ser de tipo {type:ice} y su potencia se multiplica por 1,2. Este efecto va después de otros efectos que cambian el tipo de un movimiento, pero antes de los de Cortina Plasma y {move:electrify}.',
    source: '26980ca8',
  },
  regenerator: {
    short: 'Este Pokémon recupera 1/3 de sus PS máximos, redondeado hacia abajo, al cambiarse.',
    source: '01ba5b48',
  },
  ripen: {
    short: 'Cuando este Pokémon se come ciertas bayas, sus efectos se duplican.',
    long: 'Cuando este Pokémon se come ciertas bayas, sus efectos se duplican. Las bayas que restauran PS o PP restauran el doble, las que suben estadísticas las suben el doble, las que reducen el daño a la mitad lo reducen a un cuarto, y una Baya Jaboca o una Baya Magua hacen que el atacante pierda 1/4 de sus PS máximos, redondeado hacia abajo.',
    source: '2e787dfe',
  },
  rivalry: {
    short: 'Los ataques de este Pokémon hacen 1,25× contra los de su mismo sexo y 0,75× contra los del sexo contrario.',
    long: 'La potencia de los ataques de este Pokémon se multiplica por 1,25 contra objetivos de su mismo sexo y por 0,75 contra objetivos del sexo contrario. No hay modificador si este Pokémon o el objetivo no tienen sexo.',
    source: 'a7967b6f',
  },
  rockhead: {
    short: 'Este Pokémon no recibe daño de retroceso, salvo el de Forcejeo, la {item:lifeorb} y el daño por fallo.',
    long: 'Este Pokémon no recibe daño de retroceso, salvo el de Forcejeo. No afecta al daño de la {item:lifeorb} ni al daño por fallo.',
    source: 'ed524061',
  },
  roughskin: {
    short: 'Los Pokémon que establecen contacto con este Pokémon pierden 1/8 de sus PS máximos.',
    long: 'Los Pokémon que establecen contacto con este Pokémon pierden 1/8 de sus PS máximos, redondeado hacia abajo.',
    source: '4a9e1c79',
  },
  runaway: {
    short: 'Sin uso competitivo.',
    source: 'c962717b',
  },
  sandforce: {
    short:
      'Con {condition:sandstorm}, los ataques de tipo {type:ground}, {type:rock} y {type:steel} de este Pokémon hacen 1,3×; inmune a ella.',
    long: 'Si hay {condition:sandstorm}, la potencia de los ataques de tipo {type:ground}, {type:rock} y {type:steel} de este Pokémon se multiplica por 1,3. Este Pokémon no recibe daño de {condition:sandstorm}.',
    source: '7a0d6cab',
  },
  sandrush: {
    short: 'Si hay {condition:sandstorm}, la Velocidad de este Pokémon se duplica; inmune a {condition:sandstorm}.',
    long: 'Si hay {condition:sandstorm}, la Velocidad de este Pokémon se duplica. Este Pokémon no recibe daño de {condition:sandstorm}.',
    source: '9ebfe303',
  },
  sandspit: {
    short: 'Cuando un ataque golpea a este Pokémon, se desata una {condition:sandstorm}.',
    source: '1773b2a8',
  },
  sandstream: {
    short: 'Al entrar en combate, este Pokémon desata una {condition:sandstorm}.',
    source: '35a76396',
  },
  sandveil: {
    short: 'Si hay {condition:sandstorm}, la evasión de este Pokémon es 1,25×; inmune a {condition:sandstorm}.',
    long: 'Si hay {condition:sandstorm}, la precisión de los movimientos que se usan contra este Pokémon se multiplica por 0,8. Este Pokémon no recibe daño de {condition:sandstorm}.',
    source: '06e20350',
  },
  sapsipper: {
    short:
      'El Ataque de este Pokémon sube 1 nivel si le golpea un movimiento de tipo {type:grass}; inmune a {type:grass}.',
    long: 'Este Pokémon es inmune a los movimientos de tipo {type:grass} y su Ataque sube 1 nivel cuando le golpea uno.',
    source: '72f1a262',
  },
  scrappy: {
    short:
      'Los movimientos de tipo {type:fighting} y {type:normal} golpean a {type:ghost}. Inmune a {ability:intimidate}.',
    long: 'Este Pokémon puede golpear a los Pokémon de tipo {type:ghost} con movimientos de tipo {type:normal} y {type:fighting}. Es inmune al efecto de la habilidad {ability:intimidate}.',
    source: 'e8d9fb12',
  },
  screencleaner: {
    short:
      'Al entrar en combate, terminan los efectos de {move:auroraveil}, {move:lightscreen} y {move:reflect} de ambos lados.',
    source: 'd419b344',
  },
  seedsower: {
    short: 'Cuando un ataque golpea a este Pokémon, se crea un {condition:grassyterrain}.',
    source: 'b1efe590',
  },
  shadowtag: {
    short: 'Impide que los rivales elijan cambiarse, salvo que también tengan esta habilidad.',
    long: 'Impide que los rivales elijan cambiarse, salvo que lleven una {item:shedshell}, sean de tipo {type:ghost} o también tengan esta habilidad.',
    source: '75682294',
  },
  sharpness: {
    short: 'La potencia de los movimientos cortantes de este Pokémon se multiplica por 1,5.',
    source: '536aad41',
  },
  shedskin: {
    short: 'Este Pokémon tiene un 33% de probabilidad de curarse de su problema de estado al final de cada turno.',
    source: 'e1c201a4',
  },
  sheerforce: {
    short: 'Los ataques de este Pokémon con efectos secundarios tienen 1,3× potencia, pero pierden esos efectos.',
    long: 'La potencia de los ataques de este Pokémon con efectos secundarios se multiplica por 1,3, pero pierden los efectos secundarios. Si se eliminó un efecto secundario, también se eliminan el daño de retroceso de la {item:lifeorb} y la recuperación de la {item:shellbell} del usuario, y no se activan Coraza Ira, {ability:berserk}, Cambio Color, {ability:emergencyexit}, {ability:pickpocket}, Huida, la {item:redcard}, el {item:ejectbutton}, la Baya Biglia ni la Baya Maranga del objetivo.',
    source: '34582c5c',
  },
  shellarmor: {
    short: 'Este Pokémon no puede recibir golpes críticos.',
    source: '9a7097d1',
  },
  shielddust: {
    short: 'A este Pokémon no le afectan los efectos secundarios de los ataques de otros Pokémon.',
    long: 'A este Pokémon no le afectan los efectos secundarios de los ataques de otros Pokémon. Entre los ataques con efectos secundarios que se bloquean están los que tienen probabilidad (incluso del 100%) de paralizar, dormir, congelar, quemar, envenenar, confundir, hacer retroceder a este Pokémon o bajar sus estadísticas, así como Anclaje, {move:eeriespell}, {move:fling}, {move:psychicnoise}, {move:saltcure}, {move:spiritshackle}, {move:syrupbomb} y {move:throatchop}. El efecto de {move:sparklingaria} se bloquea si este Pokémon es el único objetivo. También se bloquean contra este Pokémon los efectos secundarios que añaden la {item:kingsrock}, el Colmillo Agudo y las habilidades {ability:poisontouch}, {ability:stench} y Cadena Tóxica.',
    source: 'a9babbad',
  },
  shieldsdown: {
    short:
      'Si es Minior, al entrar y al final del turno pasa a Núcleo con la mitad o menos de sus PS máximos; si no, a Meteorito.',
    long: 'Si este Pokémon es un Minior, cambia a su forma Núcleo si tiene la mitad o menos de sus PS máximos, y a Forma Meteorito si tiene más de la mitad. Lo comprueba al entrar en combate y al final de cada turno. En Forma Meteorito no puede sufrir problemas de estado ni verse afectado por {move:yawn}.',
    source: '2b74ed3d',
  },
  skilllink: {
    short: 'Los ataques multigolpe de este Pokémon golpean siempre el máximo de veces.',
    long: 'Los ataques multigolpe de este Pokémon golpean siempre el máximo de veces. Triple Patada y {move:tripleaxel} no comprueban la precisión del segundo y tercer golpe.',
    source: '9a9d973d',
  },
  slushrush: {
    short: 'Si hay {condition:snow}, la Velocidad de este Pokémon se duplica.',
    source: 'c16799f0',
  },
  sniper: {
    short: 'Si este Pokémon asesta un golpe crítico, el daño se multiplica por 1,5.',
    source: '792303bb',
  },
  snowcloak: {
    short: 'Si hay {condition:snow}, la evasión de este Pokémon es 1,25×.',
    long: 'Si hay {condition:snow}, la precisión de los movimientos que se usan contra este Pokémon se multiplica por 0,8.',
    source: 'dd397302',
  },
  snowwarning: {
    short: 'Al entrar en combate, este Pokémon invoca {condition:snow}.',
    source: '483b949b',
  },
  solarpower: {
    short:
      'Si hay {condition:sun}, el Ataque Especial de este Pokémon es 1,5×; pierde 1/8 de sus PS máximos cada turno.',
    long: 'Si hay {condition:sun}, el Ataque Especial de este Pokémon se multiplica por 1,5 y pierde 1/8 de sus PS máximos, redondeado hacia abajo, al final de cada turno. No ocurre si el Pokémon lleva un Parasol Multiuso.',
    source: 'dd0021df',
  },
  solidrock: {
    short: 'Este Pokémon recibe 3/4 del daño de los ataques supereficaces.',
    source: '225e7d92',
  },
  soundproof: {
    short: 'Este Pokémon es inmune a los movimientos de sonido, salvo los que usa él mismo.',
    source: 'b06cec19',
  },
  speedboost: {
    short: 'La Velocidad de este Pokémon sube 1 nivel al final de cada turno completo en el campo.',
    long: 'La Velocidad de este Pokémon sube 1 nivel al final de cada turno completo que ha pasado en el campo.',
    source: '55237d29',
  },
  spicyspray: {
    short: 'Si un ataque golpea a este Pokémon, el atacante queda quemado.',
    source: '7faa7db5',
  },
  stakeout: {
    short:
      'La estadística ofensiva de este Pokémon se duplica contra un objetivo que ha entrado en combate en este turno.',
    source: '749feff7',
  },
  stall: {
    short: 'Este Pokémon se mueve el último entre los Pokémon que usan movimientos de igual o más prioridad.',
    source: '0c7ce311',
  },
  stalwart: {
    short: 'Ningún efecto puede desviar los movimientos de este Pokémon a otro objetivo.',
    source: '3acbd004',
  },
  stamina: {
    short: 'La Defensa de este Pokémon sube 1 nivel cuando le daña un movimiento.',
    source: 'e3c133e2',
  },
  stancechange: {
    short: 'Si es Aegislash, pasa a Forma Filo antes de atacar y a Forma Escudo antes de usar {move:kingsshield}.',
    long: 'Si este Pokémon es un Aegislash, cambia a Forma Filo antes de usar un movimiento de ataque y a Forma Escudo antes de usar {move:kingsshield}.',
    source: '63d5e38f',
  },
  static: {
    short: '30% de probabilidad de que un Pokémon que establezca contacto con este Pokémon quede paralizado.',
    source: 'd674e477',
  },
  steadfast: {
    short: 'Si este Pokémon retrocede, su Velocidad sube 1 nivel.',
    source: '9eb30116',
  },
  steelyspirit: {
    short: 'La potencia de los movimientos de tipo {type:steel} de este Pokémon y sus aliados se multiplica por 1,5.',
    long: 'La potencia de los movimientos de tipo {type:steel} de este Pokémon y sus aliados se multiplica por 1,5. Afecta a Deseo Oculto aunque el usuario no esté en el campo.',
    source: 'b8a9bb16',
  },
  stench: {
    short: 'Los ataques de este Pokémon sin probabilidad de hacer retroceder ganan un 10% de probabilidad de hacerlo.',
    long: 'Los ataques de este Pokémon sin probabilidad de hacer retroceder al objetivo ganan un 10% de probabilidad de hacerlo retroceder.',
    source: 'e9d7f9b4',
  },
  stickyhold: {
    short: 'Este Pokémon no puede perder el objeto que lleva por la habilidad o el ataque de otro Pokémon.',
    long: 'Este Pokémon no puede perder el objeto que lleva por la habilidad o el ataque de otro Pokémon, salvo que el ataque lo debilite. Una Toxiestrella pasa a otros Pokémon a pesar de esta habilidad.',
    source: '85754567',
  },
  strongjaw: {
    short: 'Los movimientos de mordisco de este Pokémon tienen 1,5× potencia. No potencia {move:bugbite}.',
    long: 'La potencia de los movimientos de mordisco de este Pokémon se multiplica por 1,5.',
    source: '253aa603',
  },
  sturdy: {
    short: 'Si este Pokémon tiene todos sus PS, aguanta un golpe con al menos 1 PS. Inmune a los OHKO.',
    long: 'Si este Pokémon tiene todos sus PS, aguanta un golpe con al menos 1 PS. Los movimientos OHKO fallan contra este Pokémon.',
    source: '0756da0d',
  },
  suctioncups: {
    short: 'Los ataques y objetos de otros Pokémon no pueden obligar a este Pokémon a cambiarse.',
    source: '228a90b1',
  },
  superluck: {
    short: 'El índice de golpe crítico de este Pokémon sube 1 nivel.',
    source: '0f34f648',
  },
  supersweetsyrup: {
    short: 'Al entrar en combate, este Pokémon baja 1 nivel la evasión de los rivales. Una vez por combate.',
    source: '6a809e94',
  },
  supremeoverlord: {
    short: 'Los movimientos de este Pokémon tienen un 10% más de potencia por cada aliado debilitado, hasta 5.',
    long: 'La potencia de los movimientos de este Pokémon se multiplica por 1+(X × 0,1), donde X es el número de veces que se ha debilitado un Pokémon del lado del usuario cuando se activó esta habilidad, hasta un máximo de 5.',
    source: '38a26c0d',
  },
  surgesurfer: {
    short: 'Si hay {condition:electricterrain}, la Velocidad de este Pokémon se duplica.',
    source: 'b57289b9',
  },
  swarm: {
    short:
      'Con 1/3 o menos de sus PS máximos, la estadística ofensiva de este Pokémon es 1,5× con ataques de tipo {type:bug}.',
    long: 'Cuando este Pokémon tiene 1/3 o menos de sus PS máximos, redondeado hacia abajo, su estadística ofensiva se multiplica por 1,5 al usar un ataque de tipo {type:bug}.',
    source: 'b6c9d31c',
  },
  sweetveil: {
    short: 'Este Pokémon y sus aliados no pueden quedarse dormidos; los que ya lo están no se despiertan.',
    long: 'Este Pokémon y sus aliados no pueden quedarse dormidos, pero los que ya lo están no se despiertan de inmediato. Este Pokémon y sus aliados no pueden usar {move:rest} con éxito ni verse afectados por {move:yawn}, y los que ya lo estaban no se quedan dormidos.',
    source: 'a4824c3d',
  },
  swiftswim: {
    short: 'Si hay {condition:rain}, la Velocidad de este Pokémon se duplica.',
    long: 'Si hay {condition:rain}, la Velocidad de este Pokémon se duplica. No ocurre si este Pokémon lleva un Parasol Multiuso.',
    source: '3655ba50',
  },
  symbiosis: {
    short: 'Si un aliado usa su objeto, este Pokémon le da el suyo de inmediato.',
    long: 'Si un aliado usa su objeto, este Pokémon le da el suyo de inmediato. No se activa si al aliado le robaron o le quitaron el objeto, ni si usó un {item:ejectbutton} o una Mochila Escape.',
    source: '90aef448',
  },
  synchronize: {
    short: 'Si otro Pokémon quema, envenena o paraliza a este Pokémon, también sufre ese problema de estado.',
    long: 'Si otro Pokémon quema, paraliza, envenena o envenena gravemente a este Pokémon, ese Pokémon sufre el mismo problema de estado.',
    source: 'af44e4cf',
  },
  tangledfeet: {
    short: 'La evasión de este Pokémon se duplica mientras está confuso.',
    source: 'e7e32ae3',
  },
  technician: {
    short: 'Los movimientos de 60 de potencia o menos de este Pokémon tienen 1,5× potencia, Forcejeo incluido.',
    long: 'La potencia de los movimientos de 60 de potencia o menos de este Pokémon se multiplica por 1,5, Forcejeo incluido. Este efecto va después de que el efecto de un movimiento cambie su propia potencia.',
    source: '3d590a43',
  },
  telepathy: {
    short: 'Este Pokémon no recibe daño de los ataques de sus aliados.',
    source: '6f3b5726',
  },
  thermalexchange: {
    short: 'El Ataque de este Pokémon sube 1 nivel cuando le dañan movimientos de tipo {type:fire}; no puede quemarse.',
    long: 'El Ataque de este Pokémon sube 1 nivel cuando le daña un movimiento de tipo {type:fire}. Este Pokémon no puede quemarse. Obtener esta habilidad estando quemado lo cura.',
    source: 'c489fdaa',
  },
  thickfat: {
    short:
      'Los movimientos de tipo {type:fire} y {type:ice} contra este Pokémon causan daño con la mitad de la estadística ofensiva.',
    long: 'Si un Pokémon usa un ataque de tipo {type:fire} o {type:ice} contra este Pokémon, su estadística ofensiva se reduce a la mitad al calcular el daño.',
    source: 'bc3574df',
  },
  torrent: {
    short:
      'Con 1/3 o menos de sus PS máximos, la estadística ofensiva de este Pokémon es 1,5× con ataques de tipo {type:water}.',
    long: 'Cuando este Pokémon tiene 1/3 o menos de sus PS máximos, redondeado hacia abajo, su estadística ofensiva se multiplica por 1,5 al usar un ataque de tipo {type:water}.',
    source: 'c8b49708',
  },
  toughclaws: {
    short: 'La potencia de los movimientos de contacto de este Pokémon se multiplica por 1,3.',
    source: '9e282328',
  },
  toxicdebris: {
    short: 'Si un ataque físico golpea a este Pokémon, se colocan {condition:toxicspikes} en el lado rival.',
    source: '4590af83',
  },
  trace: {
    short: 'Al entrar en combate, o cuando puede, este Pokémon copia la habilidad de un rival adyacente al azar.',
    long: 'Al entrar en combate, este Pokémon copia la habilidad de un rival al azar. No pueden copiarse Unidad Ecuestre, {ability:battlebond}, Letargo Perenne, Comandar, {ability:disguise}, Evocarrecuerdos, Don Floral, {ability:forecast}, {ability:hungerswitch}, Cara de Hielo, {ability:illusion}, {ability:imposter}, Multitipo, Gas Reactivo, Títere Tóxico, Agrupamiento, Reacción Química, Paleosíntesis, Carga Cuark, {ability:receiver}, Sistema Alfa, Banco, Escudo Limitado, {ability:stancechange}, Teraformación 0, Teracaparazón, Teracambio, Calco, Modo Daruma ni {ability:zerotohero}. Si ningún rival tiene una habilidad que pueda copiarse, esta habilidad se activa en cuanto alguno la tenga.',
    source: '0a9d7697',
  },
  unaware: {
    short: 'Este Pokémon ignora los cambios en las estadísticas de los demás al recibir o causar daño.',
    long: 'Este Pokémon ignora los cambios en el Ataque, el Ataque Especial y la precisión de los demás Pokémon al recibir daño, y los cambios en su Defensa, Defensa Especial y evasión al causarlo.',
    source: '64f7b0c9',
  },
  unburden: {
    short:
      'Duplica su Velocidad al perder su objeto; deja de hacerlo si se cambia u obtiene un objeto o una habilidad nuevos.',
    long: 'Si este Pokémon pierde el objeto que lleva por cualquier motivo, su Velocidad se duplica mientras siga en combate, tenga esta habilidad y no lleve ningún objeto.',
    source: 'e2310f3f',
  },
  unnerve: {
    short: 'Mientras este Pokémon está en combate, impide que los rivales usen sus bayas.',
    long: 'Mientras este Pokémon está en combate, impide que los rivales usen sus bayas. Esta habilidad se activa antes que las trampas de entrada y otras habilidades.',
    source: 'baa51d78',
  },
  unseenfist: {
    short: 'Los movimientos de contacto de este Pokémon atraviesan las protecciones y hacen 1/4 del daño habitual.',
    source: 'a3aea283',
  },
  vitalspirit: {
    short: 'Este Pokémon no puede quedarse dormido. Obtener esta habilidad estando dormido lo despierta.',
    source: 'cdbc59c8',
  },
  voltabsorb: {
    short:
      'Este Pokémon recupera 1/4 de sus PS máximos cuando le golpea un movimiento de tipo {type:electric}; inmune a {type:electric}.',
    long: 'Este Pokémon es inmune a los movimientos de tipo {type:electric} y recupera 1/4 de sus PS máximos, redondeado hacia abajo, cuando le golpea uno.',
    source: 'cd3ef6ff',
  },
  wanderingspirit: {
    short: 'Los Pokémon que establecen contacto con este Pokémon intercambian su habilidad con la suya.',
    long: 'Los Pokémon que establecen contacto con este Pokémon intercambian su habilidad con la suya. No afecta a los Pokémon con las habilidades Unidad Ecuestre, {ability:battlebond}, Letargo Perenne, Comandar, {ability:disguise}, Evocarrecuerdos, {ability:hungerswitch}, Cara de Hielo, {ability:illusion}, Multitipo, Gas Reactivo, Títere Tóxico, Agrupamiento, Paleosíntesis, Carga Cuark, Sistema Alfa, Banco, Escudo Limitado, {ability:stancechange}, Teracaparazón, Teracambio, Teraformación 0, Superguarda, Modo Daruma o {ability:zerotohero}.',
    source: '35ec76a8',
  },
  waterabsorb: {
    short:
      'Este Pokémon recupera 1/4 de sus PS máximos cuando le golpea un movimiento de tipo {type:water}; inmune a {type:water}.',
    long: 'Este Pokémon es inmune a los movimientos de tipo {type:water} y recupera 1/4 de sus PS máximos, redondeado hacia abajo, cuando le golpea uno.',
    source: '452faca6',
  },
  waterbubble: {
    short:
      'Su potencia de tipo {type:water} es 2×; no puede quemarse; la potencia de tipo {type:fire} contra él se reduce a la mitad.',
    long: 'La estadística ofensiva de este Pokémon se duplica al usar un ataque de tipo {type:water}. Si un Pokémon usa un ataque de tipo {type:fire} contra este Pokémon, su estadística ofensiva se reduce a la mitad al calcular el daño. Este Pokémon no puede quemarse. Obtener esta habilidad estando quemado lo cura.',
    source: '69ee9a6b',
  },
  weakarmor: {
    short: 'Si un ataque físico golpea a este Pokémon, su Defensa baja 1 nivel y su Velocidad sube 2.',
    long: 'Si un ataque físico golpea a este Pokémon, su Defensa baja 1 nivel y su Velocidad sube 2 niveles.',
    source: '43b17680',
  },
  whitesmoke: {
    short: 'Impide que otros Pokémon bajen las estadísticas de este Pokémon.',
    source: 'd8c7062e',
  },
  zerotohero: {
    short: 'Si este Pokémon es un Palafin en Forma Ingenua, al cambiarse pasa a Forma Heroica.',
    source: 'ff6ae76c',
  },
}
