/**
 * "Last Bell" — pure text-adventure engine. No React, no DOM: a command in,
 * a new state + lines of output out. That makes the whole game (puzzles,
 * combat, win/lose) unit-testable, and keeps the terminal component a thin
 * renderer over this core.
 *
 * The world's *prose* lives in data.ts; this file owns the *rules*.
 */

import {
  CARETAKER_BITE,
  CUPBOARD_CODE,
  FEATURES,
  HALL_BITE,
  ITEMS,
  MENACE_LIMIT,
  ROOMS,
  START_HEALTH,
} from "./data";

export type RoomId = "classroom" | "corridor" | "staffroom" | "hall" | "outside";
export type ItemId =
  | "leaflet"
  | "dividers"
  | "torch"
  | "extinguisher"
  | "boltcutters"
  | "firstaid";

export type Tone = "narr" | "sys" | "good" | "bad" | "room" | "you" | "win" | "death";
export interface Line {
  text: string;
  tone?: Tone;
}

export interface GameState {
  room: RoomId;
  inventory: ItemId[];
  health: number;
  maxHealth: number;
  /** Puzzle/progress booleans, e.g. cupboardOpen, hasKey, chainsCut. */
  flags: Record<string, boolean>;
  /** How close the corridor caretaker is to landing a bite. */
  menace: number;
  turns: number;
  status: "playing" | "won" | "dead";
  /** Rooms whose long description has already been shown once. */
  visited: Record<string, boolean>;
}

export interface Result {
  state: GameState;
  lines: Line[];
}

/** A fresh game at the classroom desk. */
export function newGame(): GameState {
  return {
    room: "classroom",
    inventory: [],
    health: START_HEALTH,
    maxHealth: START_HEALTH,
    flags: {},
    menace: 0,
    turns: 0,
    status: "playing",
    visited: {},
  };
}

/** Opening narration shown before the first command. */
export function intro(): Line[] {
  return [
    { text: "L A S T   B E L L", tone: "sys" },
    { text: "A Crowmarsh Comprehensive escape — 1987.", tone: "sys" },
    { text: "", tone: "narr" },
    {
      text: "You wake with your cheek stuck to a desk. Detention. You must have fallen asleep... and now the school has gone very, very quiet.",
      tone: "narr",
    },
    { text: "Type HELP or /? for commands. Get out alive.", tone: "sys" },
    { text: "", tone: "narr" },
    ...describeRoom(newGame(), true),
  ];
}

const FILLER = new Set([
  "the", "a", "an", "to", "at", "with", "on", "under", "into", "in",
  "of", "my", "your", "please", "and", "go", "using", "use",
]);

/** Item the player is referring to by a loose noun. */
function matchItem(noun: string): ItemId | undefined {
  const map: Record<string, ItemId> = {
    leaflet: "leaflet", paper: "leaflet", pamphlet: "leaflet",
    dividers: "dividers", divider: "dividers", compass: "dividers", spike: "dividers",
    torch: "torch", flashlight: "torch", light: "torch",
    extinguisher: "extinguisher",
    "bolt cutters": "boltcutters", boltcutters: "boltcutters", cutters: "boltcutters",
    "first-aid kit": "firstaid", "first aid kit": "firstaid", firstaid: "firstaid",
    "first-aid": "firstaid", "first aid": "firstaid", kit: "firstaid", medkit: "firstaid",
    bandage: "firstaid",
  };
  return map[noun];
}

/** Normalise raw input into a verb and a noun phrase. */
function parse(raw: string): { verb: string; noun: string; rest: string } {
  // The "/?" (and bare "?") shortcut would be stripped by the cleaner below.
  if (/^\/?\?$/.test(raw.trim())) return { verb: "help", noun: "", rest: "" };
  const cleaned = raw.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return { verb: "", noun: "", rest: "" };
  const words = cleaned.split(" ");
  let verb = words[0];

  // Bare compass directions and a lone padlock code are shorthands.
  const dirAlias: Record<string, string> = { n: "north", s: "south", e: "east", w: "west" };
  if (dirAlias[verb]) return { verb: "go", noun: dirAlias[verb], rest: dirAlias[verb] };
  if (/^\d{3}$/.test(verb) && words.length === 1) return { verb: "enter", noun: verb, rest: verb };

  // Verb synonyms collapse to a canonical verb.
  const verbAlias: Record<string, string> = {
    l: "look", x: "examine", inspect: "examine", read: "examine", check: "examine",
    i: "inventory", inv: "inventory", items: "inventory",
    get: "take", grab: "take", pick: "take", collect: "take",
    move: "go", walk: "go", run: "go", head: "go",
    type: "enter", dial: "enter", code: "enter", unlock: "use",
    poke: "push", prod: "push", knock: "push", hit: "push", tap: "push",
    slide: "put", insert: "put", feed: "put", post: "put",
    spray: "spray", blast: "spray", douse: "spray",
    cut: "cut", snip: "cut", break: "cut",
    search: "search", loot: "search", take_from: "search",
    heal: "use", bandage: "use",
    h: "help", commands: "help", "?": "help",
    status: "health", hp: "health",
  };
  if (verbAlias[verb]) verb = verbAlias[verb];

  const nounWords = words.slice(1).filter((w) => !FILLER.has(w));
  const noun = nounWords.join(" ");
  return { verb, noun, rest: words.slice(1).join(" ") };
}

function clone(s: GameState): GameState {
  return {
    ...s,
    inventory: [...s.inventory],
    flags: { ...s.flags },
    visited: { ...s.visited },
  };
}

function describeRoom(s: GameState, force = false): Line[] {
  const room = ROOMS[s.room];
  const lines: Line[] = [{ text: `— ${room.name} —`, tone: "room" }];
  const long = force || !s.visited[s.room];
  if (long) {
    for (const p of room.describe(s)) if (p) lines.push({ text: p, tone: "narr" });
  }
  return lines;
}

/** Apply damage, possibly killing the player. */
function hurt(s: GameState, amount: number, lines: Line[], reason: string): void {
  s.health = Math.max(0, s.health - amount);
  lines.push({ text: `${reason} (-${amount} health)`, tone: "bad" });
  if (s.health === 0) {
    s.status = "dead";
    lines.push({ text: "", tone: "narr" });
    lines.push({ text: "Everything goes red, then dark. The school keeps you.", tone: "death" });
    lines.push({ text: "*** YOU DIED ***  —  type RESTART to try again.", tone: "death" });
  }
}

/**
 * Each turn the player lingers near the upright caretaker, he closes in; on the
 * third tick he bites. Spraying him resets the threat.
 */
function advanceMenace(s: GameState, lines: Line[]): void {
  if (s.room !== "corridor" || s.flags.zombieDown || s.status !== "playing") return;
  s.menace += 1;
  if (s.menace < MENACE_LIMIT) {
    lines.push({
      text: s.menace === MENACE_LIMIT - 1
        ? "Mr Grimsby is almost on you — his cold hand brushes your sleeve. MOVE."
        : "Mr Grimsby shuffles a step closer, reaching.",
      tone: "bad",
    });
  } else {
    s.menace = 0;
    hurt(s, CARETAKER_BITE, lines, "The caretaker's teeth find your arm.");
  }
}

/**
 * Run one command. Returns the next state and the lines to print. Movement and
 * actions tick the world (caretaker menace) after resolving.
 */
export function handleCommand(prev: GameState, raw: string): Result {
  const lines: Line[] = [];
  const { verb, noun } = parse(raw);
  const s = clone(prev);

  if (!verb) return { state: s, lines: [{ text: "Say what?", tone: "sys" }] };

  // Out-of-game commands work in any status.
  if (verb === "restart") return { state: newGame(), lines: intro() };
  if (verb === "help") return { state: s, lines: helpLines() };
  if (verb === "health") {
    lines.push({ text: `Health: ${s.health}/${s.maxHealth}.`, tone: "sys" });
    return { state: s, lines };
  }
  if (verb === "inventory") {
    lines.push(
      s.inventory.length
        ? { text: "You are carrying: " + s.inventory.map((i) => ITEMS[i].name).join(", ") + ".", tone: "sys" }
        : { text: "Your pockets are empty.", tone: "sys" },
    );
    return { state: s, lines };
  }

  if (s.status !== "playing") {
    return {
      state: s,
      lines: [{ text: "The game is over. Type RESTART to play again.", tone: "sys" }],
    };
  }

  s.turns += 1;
  let ticksWorld = true;

  switch (verb) {
    case "look":
      lines.push(...describeRoom(s, true));
      break;

    case "examine":
      lines.push(...examine(s, noun));
      ticksWorld = false; // looking closely doesn't let the caretaker reach you mid-glance
      break;

    case "take":
      lines.push(...take(s, noun));
      break;

    case "go":
      ({ ticksWorld } = move(s, noun, lines));
      break;

    case "enter":
      lines.push(...enterCode(s, noun));
      break;

    case "put":
      lines.push(...slideLeaflet(s, noun));
      break;

    case "push":
      lines.push(...pokeKey(s, noun));
      break;

    case "pull":
      lines.push(...pullLeaflet(s, noun));
      break;

    case "use":
      lines.push(...applyItem(s, noun));
      break;

    case "spray":
      lines.push(...spray(s, noun));
      break;

    case "search":
      lines.push(...search(s, noun));
      break;

    case "cut":
      lines.push(...cut(s, noun));
      break;

    case "open":
      lines.push(...open(s, noun));
      break;

    case "drop": {
      const id = matchItem(noun);
      if (id && s.inventory.includes(id)) {
        s.inventory = s.inventory.filter((i) => i !== id);
        lines.push({ text: `You drop the ${ITEMS[id].name}.`, tone: "narr" });
      } else lines.push({ text: "You're not carrying that.", tone: "sys" });
      break;
    }

    case "map":
      lines.push({ text: "Classroom → Corridor ↔ Staff Room → Assembly Hall → OUT", tone: "sys" });
      ticksWorld = false;
      break;

    default:
      lines.push({ text: `You can't "${verb}" here. Type /? for commands.`, tone: "sys" });
      ticksWorld = false;
  }

  if (ticksWorld) advanceMenace(s, lines);
  return { state: s, lines };
}

function examine(s: GameState, noun: string): Line[] {
  if (!noun || noun === "room" || noun === "around") return describeRoom(s, true);
  const item = matchItem(noun);
  if (item && (s.inventory.includes(item) || carriedOrHere(s, item))) {
    return [{ text: ITEMS[item].look, tone: "narr" }];
  }
  const feats = FEATURES[s.room];
  if (feats) {
    const key = Object.keys(feats).find((k) => noun === k || noun.includes(k) || k.includes(noun));
    if (key) return [{ text: feats[key](s), tone: "narr" }];
  }
  return [{ text: `You see nothing special about the ${noun}.`, tone: "sys" }];
}

/** Whether a not-yet-collected item is visible in the current room. */
function carriedOrHere(s: GameState, item: ItemId): boolean {
  if (item === "extinguisher" && s.room === "corridor") return true;
  return false;
}

function take(s: GameState, noun: string): Line[] {
  const id = matchItem(noun);
  if (!id) return [{ text: "Take what?", tone: "sys" }];
  if (s.inventory.includes(id)) return [{ text: "You already have that.", tone: "sys" }];

  // Each takeable item is gated to where (and when) it can be picked up.
  if (id === "leaflet" && s.room === "classroom") {
    s.inventory.push("leaflet");
    s.flags.tookLeaflet = true;
    return [{ text: "You unpin the PROTECT AND SURVIVE leaflet and pocket it.", tone: "good" }];
  }
  if ((id === "dividers" || id === "torch") && s.room === "classroom") {
    if (!s.flags.cupboardOpen)
      return [{ text: "That's locked in the supply cupboard. You'll need the code first.", tone: "sys" }];
    s.inventory.push(id);
    return [{ text: `You take the ${ITEMS[id].name}.`, tone: "good" }];
  }
  if (id === "extinguisher" && s.room === "corridor") {
    s.inventory.push("extinguisher");
    return [{ text: "You lift the extinguisher from its bracket and yank the pin. Heavy, but ready.", tone: "good" }];
  }
  if (id === "firstaid" && s.room === "staffroom") {
    if (s.flags.tookFirstAid) return [{ text: "The cabinet is empty.", tone: "sys" }];
    s.inventory.push("firstaid");
    s.flags.tookFirstAid = true;
    return [{ text: "You grab the first-aid kit.", tone: "good" }];
  }
  return [{ text: "You can't take that here.", tone: "sys" }];
}

function move(s: GameState, noun: string, lines: Line[]): { ticksWorld: boolean } {
  const exits = ROOMS[s.room].exits;
  const dest = exits[noun];
  if (!dest) {
    lines.push({ text: noun ? `You can't go "${noun}" from here.` : "Go where?", tone: "sys" });
    return { ticksWorld: false };
  }

  // Leaving the classroom requires the door to be open.
  if (s.room === "classroom" && dest === "corridor" && !s.flags.doorOpen) {
    lines.push({ text: "The door is locked. You need to get it open first.", tone: "bad" });
    return { ticksWorld: false };
  }
  // Reaching freedom requires the chained doors to be cut.
  if (s.room === "hall" && dest === "outside" && !s.flags.chainsCut) {
    lines.push({ text: "The chain holds the doors fast. You can't get through.", tone: "bad" });
    return { ticksWorld: false };
  }

  s.visited[s.room] = true;
  s.room = dest;
  s.menace = 0; // moving rooms breaks the caretaker's lunge

  if (dest === "outside") {
    s.status = "won";
    lines.push({ text: "You shoulder the doors apart and burst out into the night.", tone: "win" });
    lines.push({ text: "", tone: "narr" });
    lines.push({ text: "*** YOU ESCAPED ***", tone: "win" });
    lines.push({ text: `Out in ${s.turns} moves, with ${s.health} health to spare. Survivor.`, tone: "win" });
    return { ticksWorld: false };
  }

  lines.push(...describeRoom(s));

  // First step into the corridor: warn that lingering is dangerous.
  if (dest === "corridor" && !s.visited.corridor && !s.flags.zombieDown) {
    lines.push({ text: "Grimsby turns toward you. Don't dawdle — find a way past him.", tone: "bad" });
  }
  s.visited[dest] = true;
  return { ticksWorld: false }; // the move itself already accounted for menace via reset
}

function enterCode(s: GameState, noun: string): Line[] {
  if (s.room !== "classroom")
    return [{ text: "There's no combination lock here.", tone: "sys" }];
  if (s.flags.cupboardOpen) return [{ text: "The cupboard is already open.", tone: "sys" }];
  const digits = (noun.match(/\d/g) || []).join("");
  if (!digits) return [{ text: "Enter what? Try ENTER followed by a 3-digit code.", tone: "sys" }];
  if (digits === CUPBOARD_CODE) {
    s.flags.cupboardOpen = true;
    return [
      { text: "Click. The padlock springs open!", tone: "good" },
      { text: "Inside the cupboard: a pair of brass DIVIDERS and a TORCH. (TAKE them.)", tone: "narr" },
    ];
  }
  return [{ text: `${digits}... the padlock holds firm. Wrong code.`, tone: "bad" }];
}

function slideLeaflet(s: GameState, noun: string): Line[] {
  if (s.room !== "classroom") return [{ text: "There's nothing to slide here.", tone: "sys" }];
  if (!noun.includes("leaflet") && !noun.includes("paper") && matchItem(noun) !== "leaflet")
    return [{ text: "Put what, where?", tone: "sys" }];
  if (!s.inventory.includes("leaflet"))
    return [{ text: "You don't have the leaflet.", tone: "sys" }];
  if (s.flags.doorOpen) return [{ text: "No need — the door's already open.", tone: "sys" }];
  if (s.flags.paperPlaced) return [{ text: "The leaflet is already under the door.", tone: "sys" }];
  s.flags.paperPlaced = true;
  return [
    { text: "You slide the leaflet flat through the gap under the door, leaving half on your side.", tone: "good" },
    { text: "Now — if the key dropped out of the lock, it would land on the paper.", tone: "narr" },
  ];
}

function pokeKey(s: GameState, noun: string): Line[] {
  if (s.room !== "classroom") return [{ text: "Nothing to poke here.", tone: "sys" }];
  if (noun && !noun.includes("key") && !noun.includes("lock") && !noun.includes("door"))
    return [{ text: "Poke what?", tone: "sys" }];
  if (s.flags.doorOpen) return [{ text: "The door is already open.", tone: "sys" }];
  if (!s.inventory.includes("dividers"))
    return [{ text: "Your fingers won't reach the key. You need something long and thin.", tone: "sys" }];
  if (!s.flags.paperPlaced)
    return [{ text: "You knock the key out — and it clatters away on the far side, lost. (Slide something under the door FIRST to catch it.)", tone: "bad" }];
  if (s.flags.keyDropped) return [{ text: "The key's already out — pull the leaflet back.", tone: "sys" }];
  s.flags.keyDropped = true;
  return [
    { text: "You push the dividers into the keyhole and shove. The key pops out of the far side...", tone: "good" },
    { text: "...and lands with a soft tap — on the leaflet. Got it. PULL the leaflet to you.", tone: "good" },
  ];
}

function pullLeaflet(s: GameState, noun: string): Line[] {
  if (s.room !== "classroom") return [{ text: "Nothing to pull here.", tone: "sys" }];
  if (noun && !noun.includes("leaflet") && !noun.includes("paper"))
    return [{ text: "Pull what?", tone: "sys" }];
  if (!s.flags.paperPlaced) return [{ text: "There's nothing under the door to pull.", tone: "sys" }];
  if (!s.flags.keyDropped)
    return [{ text: "You pull the leaflet back — empty. The key is still in the lock.", tone: "sys" }];
  if (s.flags.hasKey) return [{ text: "You already have the key.", tone: "sys" }];
  s.flags.hasKey = true;
  s.flags.paperPlaced = false;
  return [{ text: "You draw the leaflet carefully back under the door. The KEY slides into reach. You snatch it up!", tone: "good" }];
}

function applyItem(s: GameState, noun: string): Line[] {
  const id = matchItem(noun);
  // "unlock door" / "use key" both route here.
  if (noun.includes("door") || id === undefined) {
    if (s.room === "classroom" && noun.includes("door")) {
      if (s.flags.doorOpen) return [{ text: "Already unlocked.", tone: "sys" }];
      if (!s.flags.hasKey) return [{ text: "It's locked, and you have no key.", tone: "bad" }];
      s.flags.doorOpen = true;
      return [{ text: "You turn the key. The lock thunks back. The door swings open onto the corridor. GO CORRIDOR.", tone: "good" }];
    }
  }
  if (id === "firstaid") {
    if (!s.inventory.includes("firstaid")) return [{ text: "You don't have a first-aid kit.", tone: "sys" }];
    if (s.health >= s.maxHealth) return [{ text: "You're already in fine shape.", tone: "sys" }];
    s.health = s.maxHealth;
    s.inventory = s.inventory.filter((i) => i !== "firstaid");
    return [{ text: `You patch yourself up. Health restored to ${s.maxHealth}.`, tone: "good" }];
  }
  if (id === "torch")
    return [{ text: "You click the torch on. Its beam pushes back the worst of the dark.", tone: "narr" }];
  if (id === "boltcutters") return cut(s, "chain");
  if (id === "extinguisher") return spray(s, "zombie");
  return [{ text: "Nothing happens.", tone: "sys" }];
}

function spray(s: GameState, noun: string): Line[] {
  if (!s.inventory.includes("extinguisher"))
    return [{ text: "You've nothing to spray with.", tone: "sys" }];
  if (s.room !== "corridor")
    return [{ text: "You give the air a blast of CO2. Cold, but pointless.", tone: "sys" }];
  if (s.flags.zombieDown) return [{ text: "Grimsby's already down. No need.", tone: "sys" }];
  void noun;
  s.flags.zombieDown = true;
  s.menace = 0;
  return [
    { text: "You squeeze the lever. A roaring white cloud of CO2 hits Grimsby full in the face.", tone: "good" },
    { text: "He reels, frost-bitten and blind, and crashes to the lino. The BOLT CUTTERS on his belt are yours for the taking — SEARCH him.", tone: "good" },
  ];
}

function search(s: GameState, noun: string): Line[] {
  if (s.room !== "corridor" || (noun && !/zombie|caretaker|grimsby|belt|body/.test(noun)))
    return [{ text: "Nothing to search here.", tone: "sys" }];
  if (!s.flags.zombieDown)
    return [{ text: "Reach for his belt now and those teeth will have you. Put him down FIRST.", tone: "bad" }];
  if (s.flags.hasCutters) return [{ text: "You've already taken his bolt cutters.", tone: "sys" }];
  s.flags.hasCutters = true;
  s.inventory.push("boltcutters");
  return [{ text: "You wrestle the BOLT CUTTERS free of his belt. Now — to the hall, before he stirs.", tone: "good" }];
}

function cut(s: GameState, noun: string): Line[] {
  if (s.room !== "hall")
    return [{ text: "There's nothing here that needs cutting.", tone: "sys" }];
  if (noun && !/chain|door|padlock|lock/.test(noun)) return [{ text: "Cut what?", tone: "sys" }];
  if (s.flags.chainsCut) return [{ text: "The chain's already cut.", tone: "sys" }];
  if (!s.inventory.includes("boltcutters"))
    return [{ text: "Your bare hands can't shift that chain. You need cutters.", tone: "bad" }];
  s.flags.chainsCut = true;
  return [{ text: "You fit the bolt-cutter jaws to a link and heave. CRACK — the chain whips loose. OPEN the doors!", tone: "good" }];
}

function open(s: GameState, noun: string): Line[] {
  if (s.room === "hall" && /door/.test(noun || "doors")) {
    if (!s.flags.chainsCut) {
      // Rattling the chained doors draws the horde at the glass — it costs you.
      const lines: Line[] = [
        { text: "You shove the doors — the chain stops them dead. The shapes outside lunge, an arm bursts through the wired glass and rakes you before you wrench free.", tone: "bad" },
      ];
      hurt(s, HALL_BITE, lines, "Cold fingers tear your shoulder.");
      if (s.status === "playing")
        lines.push({ text: "You can't force these doors. CUT the chain first — you'll need bolt cutters.", tone: "sys" });
      return lines;
    }
    return endOpen(s);
  }
  if (s.room === "classroom" && /door/.test(noun || "door")) return applyItem(s, "door");
  if (s.room === "classroom" && /cupboard/.test(noun))
    return s.flags.cupboardOpen
      ? [{ text: "Already open.", tone: "sys" }]
      : [{ text: "The padlock holds it shut. Crack the code first.", tone: "sys" }];
  return [{ text: "It won't open.", tone: "sys" }];
}

/** Resolve walking through the now-open hall doors (the winning move). */
function endOpen(s: GameState): Line[] {
  const lines: Line[] = [];
  move(s, "outside", lines);
  return lines;
}

function helpLines(): Line[] {
  return [
    { text: "—— COMMANDS ——", tone: "sys" },
    { text: "MOVE:   go <place>  (or a direction)   ·   look / l", tone: "sys" },
    { text: "SEE:    examine <thing> (x)   ·   inventory (i)   ·   health   ·   map", tone: "sys" },
    { text: "DO:     take <item>   ·   drop <item>   ·   use <item>   ·   open <thing>", tone: "sys" },
    { text: "HANDS:  push / pull / put (slide) / enter <code>", tone: "sys" },
    { text: "FIGHT:  spray <thing>   ·   search <thing>   ·   cut <thing>", tone: "sys" },
    { text: "        restart   ·   /?  shows this list again.", tone: "sys" },
    { text: "Tip: read the room, EXAMINE things, and pick up what you can carry.", tone: "narr" },
  ];
}
