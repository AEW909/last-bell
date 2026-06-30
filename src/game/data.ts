/**
 * The world of "Last Bell" — a 1980s zombie-school text adventure.
 *
 * This file is the *content* layer: room descriptions, item names, and the
 * examine-text for every feature. It holds no game logic. All state changes
 * (puzzles, combat, movement) live in engine.ts, which reads from here. That
 * split keeps the prose editable without touching the rules, and lets the
 * engine be unit-tested as pure functions.
 */

import type { GameState, ItemId, RoomId } from "./engine";

/** The 3-digit cupboard padlock: atomic numbers of Carbon(6), Oxygen(8), Boron(5). */
export const CUPBOARD_CODE = "685";

/** Bite damage and healing constants, kept here so balance is easy to tweak. */
export const CARETAKER_BITE = 25;
export const HALL_BITE = 20;
export const START_HEALTH = 100;
/** Corridor menace ticks before the caretaker lands a bite. */
export const MENACE_LIMIT = 3;

export interface ItemDef {
  name: string;
  /** Shown by `examine <item>` whether it is carried or still in the room. */
  look: string;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  leaflet: {
    name: "leaflet",
    look: "A yellowing government leaflet: PROTECT AND SURVIVE. Thin, stiff paper — about the size of the gap under the door.",
  },
  dividers: {
    name: "brass dividers",
    look: "A pair of heavy brass dividers from the maths set. Two sharp metal points — long and thin enough to poke through a keyhole.",
  },
  torch: {
    name: "torch",
    look: "A rubber-cased school torch. You click it on; the beam is weak but steady.",
  },
  extinguisher: {
    name: "fire extinguisher",
    look: "A red CO2 fire extinguisher, heavier than it looks. The pin is still in.",
  },
  boltcutters: {
    name: "bolt cutters",
    look: "Long-handled bolt cutters. The jaws could bite through a padlock chain.",
  },
  firstaid: {
    name: "first-aid kit",
    look: "A green first-aid box: plasters, bandages, antiseptic. Enough to patch yourself up once.",
  },
};

export interface RoomDef {
  name: string;
  /** Long description printed on first entry and on `look`. */
  describe: (s: GameState) => string[];
  /** Exits: spoken direction/name -> destination. Engine guards locked ones. */
  exits: Partial<Record<string, RoomId>>;
}

export const ROOMS: Record<RoomId, RoomDef> = {
  classroom: {
    name: "Biology Classroom",
    describe: (s) => [
      "You're slumped at a desk in Biology Lab 2. The strip lights are dead; grey afternoon light leaks through barred windows.",
      "Somewhere below, in the rest of Crowmarsh Comprehensive, something is dragging itself along a corridor.",
      "A heavy DOOR is shut. A supply CUPBOARD stands against the wall, held by a small combination PADLOCK. There's a WHITEBOARD, a periodic-table POSTER, a teacher's DESK, and a cork NOTICEBOARD.",
      s.flags.doorOpen ? "The door now stands unlocked." : "",
    ],
    exits: { corridor: "corridor", out: "corridor", north: "corridor", door: "corridor" },
  },
  corridor: {
    name: "Corridor",
    describe: (s) => [
      "A long corridor of scuffed lino and dented lockers. Trophy cabinets glint in the gloom.",
      s.flags.zombieDown
        ? "MR GRIMSBY the caretaker lies face-down, wheezing and clawing weakly at the floor."
        : "MR GRIMSBY the caretaker lurches toward you — grey-faced, jaw slack, a ring of KEYS and BOLT CUTTERS swinging from his belt.",
      "A red fire EXTINGUISHER hangs in a bracket on the wall. The corridor runs on toward the ASSEMBLY HALL; a side door opens into the STAFF ROOM.",
    ],
    exits: {
      hall: "hall",
      staffroom: "staffroom",
      staff: "staffroom",
      classroom: "classroom",
      back: "classroom",
    },
  },
  staffroom: {
    name: "Staff Room",
    describe: () => [
      "The staff room: sagging armchairs, a cold kettle, mugs growing their own ecosystems.",
      "A white CABINET with a green cross is screwed to the wall. The only WINDOW is barred like the rest. The door leads back to the CORRIDOR.",
    ],
    exits: { corridor: "corridor", out: "corridor", back: "corridor" },
  },
  hall: {
    name: "Assembly Hall",
    describe: (s) => [
      "The assembly hall, stacked chairs and a dusty stage. Ahead, the main DOORS to the world outside — and freedom.",
      s.flags.chainsCut
        ? "The heavy chain lies cut on the floor; the doors are free."
        : "The doors are lashed shut with a thick CHAIN and padlock. Beyond the wired glass, dark shapes press and moan.",
      "The corridor lies back the way you came.",
    ],
    exits: { corridor: "corridor", back: "corridor", outside: "outside", out: "outside", doors: "outside" },
  },
  outside: {
    name: "Outside",
    describe: () => ["Cold air. Open sky. The car park. You run, and you do not look back."],
    exits: {},
  },
};

/**
 * Examine-text for fixed scenery in each room. Returned by `examine <noun>`.
 * Functions receive state so descriptions can react to puzzle progress.
 */
export const FEATURES: Partial<Record<RoomId, Record<string, (s: GameState) => string>>> = {
  classroom: {
    door: (s) =>
      s.flags.doorOpen
        ? "The door is unlocked. Beyond it: the corridor."
        : s.flags.keyDropped
          ? "Unlocked from the wrong side — the key is now on the floor on YOUR side, sitting on the leaflet. Try pulling the leaflet back."
          : "A solid fire door, locked. Peering at the lock you realise the KEY is still in it — on the OTHER side. There's a finger-width GAP underneath the door.",
    cupboard: (s) =>
      s.flags.cupboardOpen
        ? "The cupboard hangs open. Inside you found the dividers and torch."
        : "A metal supply cupboard, shut with a 3-digit combination PADLOCK.",
    padlock: (s) =>
      s.flags.cupboardOpen
        ? "Hanging open now."
        : "A 3-digit combination padlock. You'll need the right code. (Try: ENTER 123)",
    whiteboard: () =>
      'Half-wiped lesson notes. In the corner, in a teacher\'s rushed hand: "CUPBOARD CODE = atomic numbers of the THREE ringed elements, left to right."',
    poster: () =>
      "A periodic table poster. Three elements are ringed in red biro, left to right: CARBON, then OXYGEN, then BORON.",
    desk: () => "The teacher's desk. A cold mug, a register, and a half-eaten sandwich. Nothing useful — but the WHITEBOARD and POSTER might be worth a closer look.",
    noticeboard: (s) =>
      s.flags.tookLeaflet
        ? "Drawing pins and faded timetables. The leaflet is gone — you have it."
        : "Pinned among the timetables is an old civil-defence LEAFLET: PROTECT AND SURVIVE. (You could TAKE it.)",
    window: () => "Tall windows, all fitted with security bars. No way out here.",
    me: () => "You're a Year 9 pupil who fell asleep in detention. Your head throbs. You are, for now, uninfected.",
    self: () => "You're a Year 9 pupil who fell asleep in detention. Your head throbs. You are, for now, uninfected.",
    gap: () => "The gap under the door is just wide enough to slide a sheet of paper through.",
    key: (s) =>
      s.flags.hasKey
        ? "The door key, safely in your hand."
        : s.flags.keyDropped
          ? "The key lies on the leaflet, on your side of the door now. PULL the leaflet to bring it to you."
          : "The key is in the lock, sticking out the FAR side of the door. If you could knock it out, it would drop... onto the floor, out of reach. Unless something were under there to catch it.",
  },
  corridor: {
    zombie: (s) =>
      s.flags.zombieDown
        ? "Mr Grimsby, sprayed and floored, clawing weakly. The BOLT CUTTERS on his belt are within reach — SEARCH him."
        : "Mr Grimsby the caretaker, or what's left of him. Bolt cutters and keys hang from his belt, but those teeth... you daren't get close. He needs slowing down first.",
    caretaker: (s) => FEATURES.corridor!.zombie(s),
    grimsby: (s) => FEATURES.corridor!.zombie(s),
    extinguisher: (s) =>
      s.inventory.includes("extinguisher")
        ? "In your hands, pin pulled, ready."
        : "A red fire extinguisher in a wall bracket. (You could TAKE it.)",
    lockers: () => "Rows of dented lockers, all hanging open and empty.",
    cabinet: () => "Trophy cabinets — football, chess, a 1979 spelling bee. Nothing you can use.",
  },
  staffroom: {
    cabinet: (s) =>
      s.flags.tookFirstAid
        ? "The first-aid cabinet, empty now."
        : "A wall-mounted first-aid cabinet. (You could TAKE the first-aid kit.)",
    window: () => "Barred, like every window in this place.",
    kettle: () => "Stone cold. This is no time for tea.",
  },
  hall: {
    doors: (s) =>
      s.flags.chainsCut
        ? "The main doors, chain cut, ready to be pushed OPEN."
        : "Tall double doors, the only way out. A thick CHAIN and padlock hold them shut.",
    chain: (s) =>
      s.flags.chainsCut
        ? "Cut through and useless on the floor."
        : "A thick steel chain through both door handles. You'd need to cut it — bolt cutters, maybe.",
    glass: () => "Wired glass in the doors. On the far side, pale faces and reaching hands. Better hurry.",
    stage: () => "A dusty assembly stage. Nothing on it but a lectern and bad memories.",
  },
};

/**
 * Suggested tappable commands per room, so the game is playable on a board or a
 * tablet without typing. The engine filters these by what currently applies.
 */
export function suggestions(s: GameState): string[] {
  if (s.status !== "playing") return ["restart"];
  switch (s.room) {
    case "classroom": {
      const out: string[] = ["look", "examine whiteboard", "examine poster"];
      if (!s.flags.cupboardOpen) out.push("enter 123");
      if (!s.flags.tookLeaflet) out.push("take leaflet");
      if (!s.flags.doorOpen) {
        if (s.flags.tookLeaflet && !s.flags.paperPlaced) out.push("slide leaflet under door");
        if (s.flags.paperPlaced && !s.flags.keyDropped) out.push("poke key");
        if (s.flags.keyDropped && !s.flags.hasKey) out.push("pull leaflet");
        if (s.flags.hasKey) out.push("unlock door");
      } else out.push("go corridor");
      return out;
    }
    case "corridor": {
      const out: string[] = ["look", "examine zombie"];
      if (!s.inventory.includes("extinguisher")) out.push("take extinguisher");
      else if (!s.flags.zombieDown) out.push("spray zombie");
      if (s.flags.zombieDown && !s.flags.hasCutters) out.push("search caretaker");
      out.push("go staffroom", "go hall");
      return out;
    }
    case "staffroom": {
      const out = ["look"];
      if (!s.flags.tookFirstAid) out.push("take first-aid kit");
      else if (s.health < s.maxHealth) out.push("use first-aid kit");
      out.push("go corridor");
      return out;
    }
    case "hall": {
      const out = ["look"];
      if (!s.flags.chainsCut) out.push("cut chain");
      else out.push("open doors");
      out.push("go corridor");
      return out;
    }
    default:
      return ["restart"];
  }
}
