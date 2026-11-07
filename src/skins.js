// SPDX-License-Identifier: Apache-2.0
// Original CorpoWars3d character skins. Pure presentation: no DOM, clock,
// randomness or simulation access. Both renderers consume the same parts, so
// the WebGL and software paths show the same people.
//
// Parts are emitted, not returned, so a frame allocates nothing per actor:
//   emit(dx, y, dz, w, h, d, color, glow)
// Local frame: +dx is the actor's right, -dz is forward, y is height above the
// feet in metres. Every standing part stays inside the 1.9 m tall hit volume,
// and heads sit in the headshot band (above 82% of height), so what you see is
// what the hitscan in fps.js tests.

export const HIT_HEIGHT = 1.9;
export const AGENT_SKINS = Object.freeze(['vex', 'null', 'echo', 'iron']);

const rgb = (r, g, b) => Object.freeze([r, g, b]);

// ---------------------------------------------------------------------------
// Colour lookup table. In the spirit of 1980s 8-bit games (Elite, 1984),
// every colour lives once in a small shared table and skins store one-byte
// indices into it. A whole outfit is eight bytes; recolouring a faction is a
// table edit. Entries are resolved to frozen RGB triples once, at load.
// ---------------------------------------------------------------------------
const NAMED = [
  // Accents and lights.
  ['teal', .35, .93, .82], ['amber', .98, .71, .29], ['sky', .59, .72, 1], ['coral', .91, .55, .4],
  ['alarm', .95, .25, .2], ['riot', 1, .22, .16], ['scope', 1, .3, .22], ['gold', .96, .74, .3],
  // Skin tones.
  ['tone0', .62, .45, .36], ['tone1', .45, .31, .24], ['tone2', .74, .58, .47], ['tone3', .36, .25, .2],
  ['tone4', .55, .38, .28], ['tone5', .8, .64, .52],
  // Hair.
  ['black', .06, .05, .05], ['umber', .1, .08, .07], ['brown', .3, .22, .14], ['tawny', .25, .18, .11],
  ['auburn', .38, .17, .1], ['silver', .55, .55, .56],
  // Agent cloth and metal.
  ['coal', .11, .14, .16], ['slate', .16, .2, .22], ['ink', .1, .11, .13], ['soot', .06, .07, .08], ['gunmetal', .2, .25, .27],
  ['khaki', .17, .16, .13], ['canvas', .24, .22, .17], ['loam', .14, .13, .11], ['peat', .07, .07, .06], ['brass', .27, .26, .22],
  ['night', .13, .15, .21], ['dusk', .18, .21, .29], ['deep', .11, .12, .16], ['shade', .06, .06, .08], ['cobalt', .22, .25, .32],
  ['rust', .2, .15, .13], ['clay', .27, .2, .17], ['mahogany', .15, .12, .11], ['char', .07, .06, .06], ['copper', .3, .24, .21],
  // Security uniforms (three issue shades) and gear.
  ['navy', .13, .17, .27], ['navyLight', .2, .25, .36], ['navyDark', .1, .12, .19],
  ['charcoal', .16, .17, .2], ['charcoalLight', .24, .25, .29], ['charcoalDark', .11, .11, .13],
  ['teal-issue', .1, .19, .21], ['teal-issueLight', .16, .27, .29], ['teal-issueDark', .07, .12, .14],
  ['badge', .62, .52, .26], ['jet', .05, .05, .06],
  // Bulwark armour, marksman field kit, witness suit.
  ['oxblood', .3, .12, .11], ['oxbloodLight', .38, .16, .14], ['oxbloodDark', .16, .08, .08], ['ember', .06, .04, .04], ['plate', .24, .19, .19],
  ['olive', .17, .2, .15], ['oliveLight', .22, .26, .19], ['oliveDark', .12, .14, .11], ['moss', .06, .06, .05], ['field', .2, .22, .18],
  ['suit', .32, .33, .36], ['shirt', .86, .86, .82], ['trouser', .26, .27, .3], ['leather', .1, .07, .05], ['case', .36, .23, .13],
];
export const LUT = Object.freeze(NAMED.map(([, r, g, b]) => rgb(r, g, b)));
const C = Object.freeze(Object.fromEntries(NAMED.map(([name], i) => [name, i])));

// Outfit slots, in byte order.
export const SLOTS = Object.freeze(['accent', 'jacket', 'shirt', 'pants', 'boots', 'skin', 'hair', 'metal']);
const outfit = (...names) => Uint8Array.from(names, (name) => {
  if (C[name] === undefined) throw new Error(`Unknown LUT colour ${name}`);
  return C[name];
});

// frame scales shoulder width; weapon picks a silhouette; head picks headwear.
const DESIGNS = {
  vex: { name: 'VEX', frame: 1, weapon: 'carbine', head: 'hair', gear: ['coat', 'pauldron'],
    colours: outfit('teal', 'coal', 'slate', 'ink', 'soot', 'tone0', 'black', 'gunmetal') },
  null: { name: 'NULL', frame: 1.04, weapon: 'breacher', head: 'helmet', gear: ['plate', 'charges', 'kneepads'],
    colours: outfit('amber', 'khaki', 'canvas', 'loam', 'peat', 'tone1', 'black', 'brass') },
  echo: { name: 'ECHO', frame: .92, weapon: 'rifle', head: 'hood', gear: ['antenna', 'cape', 'lens'],
    colours: outfit('sky', 'night', 'dusk', 'deep', 'shade', 'tone2', 'brown', 'cobalt') },
  iron: { name: 'IRON', frame: 1.12, weapon: 'lmg', head: 'openhelm', gear: ['pauldrons', 'pack', 'beard'],
    colours: outfit('coral', 'rust', 'clay', 'mahogany', 'char', 'tone3', 'umber', 'copper') },
  guard: { name: 'Security', frame: 1, weapon: 'smg', head: 'cap', gear: ['badge', 'belt'],
    colours: outfit('alarm', 'navy', 'navyLight', 'navyDark', 'jet', 'tone0', 'black', 'badge') },
  bulwark: { name: 'Bulwark', frame: 1.15, weapon: 'breacher', head: 'riot', gear: ['plate', 'pauldrons', 'lights', 'kneepads'],
    colours: outfit('riot', 'oxblood', 'oxbloodLight', 'oxbloodDark', 'ember', 'tone1', 'black', 'plate') },
  marksman: { name: 'Marksman', frame: .95, weapon: 'rifle', head: 'beret', gear: ['cape', 'lens'],
    colours: outfit('scope', 'olive', 'oliveLight', 'oliveDark', 'moss', 'tone2', 'tawny', 'field') },
  witness: { name: 'Witness', frame: .96, weapon: 'briefcase', head: 'hair', gear: ['tie'],
    colours: outfit('gold', 'suit', 'shirt', 'trouser', 'leather', 'tone3', 'silver', 'case') },
};

function resolve(design, colours = design.colours, gear = design.gear) {
  const skin = { name: design.name, frame: design.frame, weapon: design.weapon, head: design.head, gear: Object.freeze([...gear]), colours };
  SLOTS.forEach((slot, i) => { skin[slot] = LUT[colours[i]]; });
  return Object.freeze(skin);
}
export const SKINS = Object.freeze(Object.fromEntries(Object.entries(DESIGNS).map(([key, design]) => [key, resolve(design)])));

/** Skin key for any actor: agents by squad slot, guards by type, the courier. */
export function skinKey(actor) {
  if (actor.team === 'agent') return AGENT_SKINS[actor.id] ?? 'vex';
  if (actor.team === 'courier') return 'witness';
  return SKINS[actor.enemyType] && actor.enemyType !== 'witness' ? actor.enemyType : 'guard';
}

// ---------------------------------------------------------------------------
// Seeded crowd variation, after Elite's galaxy generator: three 16-bit seed
// words are "twisted" (s0, s1, s2) -> (s1, s2, s0 + s1 + s2 mod 2^16) and the
// resulting bytes choose LUT entries. The same actor id always yields the same
// person; the squad and the witness are fixed characters and never vary.
// Silhouette, weapon and accent stay per type so threats remain readable.
// ---------------------------------------------------------------------------
export function twist(seeds) {
  const next = (seeds[0] + seeds[1] + seeds[2]) & 0xffff;
  seeds[0] = seeds[1];
  seeds[1] = seeds[2];
  seeds[2] = next;
  return seeds;
}

/** Deterministic seed triple for an actor id (16-bit words). */
export function seedsFor(id) {
  const n = Math.trunc(Number(id) || 0) >>> 0;
  const seeds = [(0x4357 ^ Math.imul(n, 0x9e37)) & 0xffff, (0x5752 + Math.imul(n, 0x0101)) & 0xffff, (0x3344 ^ (n << 5)) & 0xffff];
  for (let i = 0; i < 4; i++) twist(seeds);
  return seeds;
}

const TONES = Object.freeze([C.tone0, C.tone1, C.tone2, C.tone3, C.tone4, C.tone5]);
const HAIRS = Object.freeze([C.black, C.umber, C.brown, C.tawny, C.auburn, C.silver]);
// [jacket, shirt, pants] issue shades per variable type.
const ISSUE = Object.freeze({
  guard: Object.freeze([[C.navy, C.navyLight, C.navyDark], [C.charcoal, C.charcoalLight, C.charcoalDark], [C['teal-issue'], C['teal-issueLight'], C['teal-issueDark']]]),
  bulwark: Object.freeze([[C.oxblood, C.oxbloodLight, C.oxbloodDark], [C.charcoal, C.charcoalLight, C.charcoalDark]]),
  marksman: Object.freeze([[C.olive, C.oliveLight, C.oliveDark], [C.charcoal, C.charcoalLight, C.charcoalDark]]),
});
export const VARIABLE_SKINS = Object.freeze(Object.keys(ISSUE));

/** Variant code (a small integer) for an actor, or -1 for fixed characters. */
export function variantCode(key, id) {
  const issue = ISSUE[key];
  if (!issue) return -1;
  const [a, b, c] = seedsFor(id);
  const tone = (a >> 8) % TONES.length, hair = (b & 0xff) % HAIRS.length;
  const shade = (c >> 4) % issue.length, facial = (a ^ c) & 3; // 0..3: none, moustache, beard, none
  return ((tone * HAIRS.length + hair) * issue.length + shade) * 4 + facial;
}

// Codes per (type, id) are memoised so steady frames do no seed arithmetic.
// The table is cleared if it ever exceeds a generous bound.
const codes = new Map();
/** Memoised variantCode for an actor (actors keep their ids for a mission). */
export function actorVariant(key, id) {
  const index = VARIABLE_SKINS.indexOf(key);
  if (index < 0) return -1;
  const cacheKey = index * 0x100000000 + (Math.trunc(Number(id) || 0) >>> 0);
  let code = codes.get(cacheKey);
  if (code === undefined) {
    if (codes.size >= 4096) codes.clear();
    code = variantCode(key, id);
    codes.set(cacheKey, code);
  }
  return code;
}

// Every possible variant is bounded (at most 6 * 6 * 3 * 4 per type), so this
// cache can never grow without limit and steady-state frames do not allocate.
const variants = new Map();
/** Resolved skin for a type and variant code; fixed characters ignore the code. */
export function variantSkin(key, code) {
  const base = SKINS[key] ?? SKINS.guard;
  const issue = ISSUE[key];
  if (!issue || !(code >= 0)) return base;
  const cacheKey = VARIABLE_SKINS.indexOf(key) * 1024 + code;
  let skin = variants.get(cacheKey);
  if (skin) return skin;
  let rest = code;
  const facial = rest % 4; rest = (rest - facial) / 4;
  const shade = rest % issue.length; rest = (rest - shade) / issue.length;
  const hair = rest % HAIRS.length; rest = (rest - hair) / HAIRS.length;
  const tone = rest % TONES.length;
  const colours = Uint8Array.from(base.colours);
  [colours[1], colours[2], colours[3]] = issue[shade];
  colours[5] = TONES[tone];
  colours[6] = HAIRS[hair];
  const gear = facial === 1 ? [...base.gear, 'moustache'] : facial === 2 ? [...base.gear, 'stubble'] : base.gear;
  skin = resolve(DESIGNS[key], colours, gear);
  variants.set(cacheKey, skin);
  return skin;
}

const DEAD = rgb(.1, .11, .12);
const SMG_STEEL = rgb(.12, .13, .15);
const BELT = LUT[C.jet];
const SIDES = Object.freeze([-1, 1]);

/**
 * Emit one character. pose: {gait (-1..1 stride), dead, lod ('high'|'low'),
 * flash (bool), variant (code from variantCode, optional)}. Returns the part count.
 */
/**
 * Instance rotation for a character whose simulation heading is `yaw`.
 * Both renderers rotate a box's local (x, z) by angle t to
 * (x cos t + z sin t, -x sin t + z cos t), so local forward (-Z) lands on
 * (-sin t, -cos t). The simulation and FPS camera head along (sin yaw, -cos yaw),
 * therefore characters are placed with t = -yaw. Using yaw directly mirrored
 * every east/west heading, so guards walking towards the player faced away.
 */
export const actorAngle = (yaw) => (yaw ? -yaw : 0);

export function emitCharacter(emit, key, pose) {
  const s = pose.variant >= 0 ? variantSkin(key, pose.variant) : SKINS[key] ?? SKINS.guard;
  const glowAll = pose.flash ? 1 : 0;
  let parts = 0;
  const part = (dx, y, dz, w, h, d, color, glow = 0) => {
    emit(dx, y, dz, w, h, d, color, Math.max(glow, glowAll));
    parts++;
  };
  if (pose.dead) {
    // Fallen body in the wearer's colours, lying along the facing axis.
    part(0, .1, .05, .5 * s.frame, .18, .62, s.jacket);
    part(0, .08, .62, .42, .14, .56, s.pants);
    part(0, .12, -.42, .24, .2, .26, s.head === 'helmet' || s.head === 'riot' ? s.metal : s.skin);
    part(.34, .06, .02, .14, .1, .42, DEAD);
    return parts;
  }
  const f = s.frame, gait = (pose.gait || 0) * .16, low = pose.lod === 'low';
  const half = .25 * f, armX = half + .08;

  // Legs and boots stride against each other.
  for (const side of SIDES) {
    const swing = side * gait;
    part(side * .13, .46, swing, .18, .62, .22, s.pants);
    part(side * .13, .08, swing - .05, .2, .16, .34, s.boots);
  }
  // Hips, torso and shoulders.
  part(0, .82, 0, .46 * f, .16, .3, s.pants);
  part(0, 1.14, 0, .5 * f, .52, .32, s.jacket);
  if (!low) part(0, 1.2, -.165, .2 * f, .3, .02, s.shirt);

  // Head: neck, face, eyes or visor, then headwear.
  if (!low) part(0, 1.47, 0, .13, .1, .13, s.skin);
  part(0, 1.66, 0, .25, .3, .27, s.skin);
  if (s.head === 'helmet' || s.head === 'riot') {
    part(0, 1.72, .01, .32, .32, .33, s.metal);
    part(0, 1.68, -.165, .27, s.head === 'riot' ? .05 : .11, .02, s.accent, 1);
  } else {
    part(0, 1.69, -.14, .2, .045, .02, key === 'witness' ? s.hair : s.accent, key === 'witness' ? 0 : .9);
  }
  if (!low) {
    if (s.head === 'hair') part(0, 1.82, .02, .27, .07, .29, s.hair);
    if (s.head === 'hood') {
      part(0, 1.75, .04, .33, .28, .31, s.jacket);
      part(-.16, 1.62, .02, .04, .3, .28, s.jacket);
      part(.16, 1.62, .02, .04, .3, .28, s.jacket);
    }
    if (s.head === 'openhelm') {
      part(0, 1.83, .02, .32, .1, .33, s.metal);
      part(-.155, 1.7, .03, .04, .18, .26, s.metal);
      part(.155, 1.7, .03, .04, .18, .26, s.metal);
    }
    if (s.head === 'cap') {
      part(0, 1.83, .01, .29, .08, .3, s.jacket);
      part(0, 1.8, -.19, .26, .025, .12, s.jacket);
      part(0, 1.835, -.155, .06, .04, .01, s.metal, .4);
    }
    if (s.head === 'beret') part(-.03, 1.83, .01, .3, .07, .3, s.jacket);
  }

  // Arms: weapon-bearers brace forward; the witness swings a briefcase.
  if (s.weapon === 'briefcase') {
    part(-armX, 1.1, -gait * .7, .13, .56, .15, s.jacket);
    part(armX, 1.1, gait * .7, .13, .56, .15, s.jacket);
    part(-armX, .8, -gait * .7, .1, .1, .11, s.skin);
    part(armX, .64, gait * .7, .1, .3, .38, s.metal);
  } else {
    part(armX, 1.22, -.05, .13, .3, .15, s.jacket);
    part(-armX, 1.22, -.05, .13, .3, .15, s.jacket);
    part(armX - .04, 1.06, -.26, .11, .11, .3, s.jacket);
    part(-.08, 1.06, -.36, .1, .1, .34, s.jacket);
    if (!low) {
      part(.12, 1.05, -.5, .09, .08, .09, s.skin);
      part(-.02, 1.05, -.56, .08, .08, .08, s.skin);
    }
    emitWeapon(part, s, low);
  }

  if (low) return parts;
  for (const gear of s.gear) emitGear(part, gear, s, f, half, armX, gait);
  return parts;
}

function emitWeapon(part, s, low) {
  const steel = s.weapon === 'smg' ? SMG_STEEL : s.metal, x = .14, y = 1.08;
  switch (s.weapon) {
    case 'carbine':
      part(x, y, -.52, .08, .12, .5, steel);
      part(x, y + .01, -.86, .04, .04, .2, steel);
      if (!low) { part(x, y - .11, -.48, .06, .14, .08, steel); part(x, y + .085, -.5, .03, .02, .14, s.accent, 1); }
      break;
    case 'breacher':
      part(x, y, -.5, .11, .14, .46, steel);
      part(x, y + .01, -.82, .07, .07, .2, steel);
      if (!low) part(x, y - .1, -.62, .08, .07, .18, s.accent, .5);
      break;
    case 'rifle':
      part(x, y, -.55, .07, .1, .58, steel);
      part(x, y + .01, -.95, .035, .035, .26, steel);
      if (!low) { part(x, y + .1, -.52, .05, .06, .18, steel); part(x, y + .1, -.62, .04, .04, .01, s.accent, 1); }
      break;
    case 'lmg':
      part(x, y, -.52, .13, .16, .56, steel);
      part(x, y + .01, -.88, .05, .05, .2, steel);
      if (!low) { part(x - .02, y - .14, -.46, .15, .14, .16, s.metal); part(x, y + .1, -.38, .14, .025, .2, s.accent, .7); }
      break;
    default: // smg
      part(x, y, -.46, .07, .11, .34, steel);
      part(x, y + .005, -.68, .035, .035, .12, steel);
      if (!low) part(x, y - .1, -.44, .05, .12, .06, steel);
  }
}

function emitGear(part, gear, s, f, half, armX, gait) {
  switch (gear) {
    case 'coat': // Long coat: back and side skirts to the knee, accent collar.
      part(0, .64, .15, .48 * f, .48, .05, s.jacket);
      part(-half + .01, .68, 0, .05, .42, .28, s.jacket);
      part(half - .01, .68, 0, .05, .42, .28, s.jacket);
      part(0, 1.44, .02, .46 * f, .07, .34, s.accent, .25);
      break;
    case 'pauldron':
      part(-armX, 1.39, -.02, .2, .09, .27, s.metal);
      part(-armX, 1.39, -.155, .16, .03, .01, s.accent, .8);
      break;
    case 'pauldrons':
      for (const side of SIDES) {
        part(side * armX, 1.4, -.02, .22, .11, .29, s.metal);
        part(side * (armX + .06), 1.4, -.02, .03, .07, .2, s.accent, .5);
      }
      break;
    case 'plate': // Chest plate with hazard banding.
      part(0, 1.17, -.17, .46 * f, .36, .04, s.metal);
      part(0, 1.24, -.195, .4 * f, .035, .01, s.accent, .7);
      part(0, 1.12, -.195, .4 * f, .035, .01, s.accent, .7);
      break;
    case 'charges':
      for (const dx of [-.14, 0, .14]) part(dx, .86, -.17, .08, .09, .05, s.accent, .35);
      break;
    case 'kneepads':
      for (const side of SIDES) part(side * .13, .5, side * gait - .12, .16, .12, .03, s.metal);
      break;
    case 'antenna':
      part(.12, 1.62, .2, .02, .52, .02, s.metal);
      part(.12, 1.9 - .03, .2, .04, .04, .04, s.accent, 1);
      part(0, 1.15, .2, .3, .34, .1, s.shirt);
      break;
    case 'cape':
      part(0, 1.02, .19, .46 * f, .66, .03, s.jacket);
      break;
    case 'lens':
      part(.07, 1.7, -.15, .07, .07, .025, s.accent, 1);
      break;
    case 'pack': // Support pack with an ammunition feed light.
      part(0, 1.2, .25, .42, .5, .18, s.metal);
      part(0, 1.04, .345, .3, .05, .01, s.accent, .8);
      break;
    case 'beard':
      part(0, 1.56, -.12, .2, .09, .04, s.hair);
      break;
    case 'moustache':
      part(0, 1.6, -.14, .12, .03, .02, s.hair);
      break;
    case 'stubble':
      part(0, 1.555, -.138, .19, .07, .02, s.hair);
      break;
    case 'badge':
      part(-.13, 1.28, -.167, .06, .07, .01, s.metal, .6);
      break;
    case 'belt':
      part(0, .82, 0, .48 * f, .05, .31, BELT);
      break;
    case 'lights': // Bulwark shoulder beacons.
      for (const side of SIDES) part(side * armX, 1.48, .05, .05, .05, .05, s.accent, 1);
      break;
    case 'tie':
      part(0, 1.24, -.172, .05, .26, .01, s.accent, .2);
      break;
  }
}
