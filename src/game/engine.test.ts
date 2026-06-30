import { describe, it, expect } from "vitest";
import { handleCommand, newGame, type GameState } from "./engine";
import { CARETAKER_BITE, MENACE_LIMIT, START_HEALTH } from "./data";

/** Run a sequence of commands from a fresh game and return the final state. */
function run(commands: string[], from: GameState = newGame()): GameState {
  return commands.reduce((s, cmd) => handleCommand(s, cmd).state, from);
}

/** Convenience: the printed text of a single command. */
function say(s: GameState, cmd: string): string {
  return handleCommand(s, cmd).lines.map((l) => l.text).join("\n");
}

const SOLVE_CLASSROOM = [
  "enter 685",
  "take dividers",
  "take leaflet",
  "slide leaflet under door",
  "poke key",
  "pull leaflet",
  "unlock door",
];

describe("classroom puzzles", () => {
  it("cupboard opens only on the chemistry code 685", () => {
    expect(say(newGame(), "enter 123")).toMatch(/holds firm/i);
    const ok = run(["enter 685"]);
    expect(ok.flags.cupboardOpen).toBe(true);
  });

  it("dividers cannot be taken until the cupboard is open", () => {
    const blocked = run(["take dividers"]);
    expect(blocked.inventory).not.toContain("dividers");
    const open = run(["enter 685", "take dividers"]);
    expect(open.inventory).toContain("dividers");
  });

  it("poking the key with no paper underneath loses it", () => {
    const s = run(["enter 685", "take dividers", "poke key"]);
    expect(s.flags.keyDropped).toBeFalsy();
    expect(say(s, "poke key")).toMatch(/clatters away|slide something/i);
  });

  it("the full paper-and-pencil trick yields the key and opens the door", () => {
    const s = run(SOLVE_CLASSROOM);
    expect(s.flags.hasKey).toBe(true);
    expect(s.flags.doorOpen).toBe(true);
  });

  it("you cannot leave the classroom until the door is open", () => {
    const stuck = run(["go corridor"]);
    expect(stuck.room).toBe("classroom");
    const free = run([...SOLVE_CLASSROOM, "go corridor"]);
    expect(free.room).toBe("corridor");
  });
});

describe("corridor caretaker", () => {
  const inCorridor = () => run([...SOLVE_CLASSROOM, "go corridor"]);

  it("lingering near the upright caretaker eventually costs health", () => {
    let s = inCorridor();
    for (let i = 0; i < MENACE_LIMIT; i++) s = handleCommand(s, "look").state;
    expect(s.health).toBe(START_HEALTH - CARETAKER_BITE);
  });

  it("you cannot loot the caretaker until he is sprayed down", () => {
    const s = run([...SOLVE_CLASSROOM, "go corridor", "search caretaker"]);
    expect(s.flags.hasCutters).toBeFalsy();
  });

  it("extinguisher then search yields the bolt cutters", () => {
    const s = run([
      ...SOLVE_CLASSROOM, "go corridor",
      "take extinguisher", "spray zombie", "search caretaker",
    ]);
    expect(s.inventory).toContain("boltcutters");
  });
});

describe("escape and end states", () => {
  const ESCAPE = [
    ...SOLVE_CLASSROOM, "go corridor",
    "take extinguisher", "spray zombie", "search caretaker",
    "go hall", "cut chain", "open doors",
  ];

  it("cutting the chain needs the bolt cutters", () => {
    const s = run([...SOLVE_CLASSROOM, "go corridor", "go hall", "cut chain"]);
    expect(s.flags.chainsCut).toBeFalsy();
    expect(s.room).toBe("hall");
  });

  it("a clean run reaches OUTSIDE and wins", () => {
    const s = run(ESCAPE);
    expect(s.status).toBe("won");
    expect(s.room).toBe("outside");
  });

  it("the staff-room first-aid kit restores health and is consumed", () => {
    let s = run([...SOLVE_CLASSROOM, "go corridor"]);
    s = { ...s, health: 40 };
    s = run(["go staffroom", "take first-aid kit", "use first-aid kit"], s);
    expect(s.health).toBe(START_HEALTH);
    expect(s.inventory).not.toContain("firstaid");
  });

  it("restart returns a fresh game from any state", () => {
    const won = run(ESCAPE);
    const fresh = handleCommand(won, "restart").state;
    expect(fresh.status).toBe("playing");
    expect(fresh.room).toBe("classroom");
    expect(fresh.inventory).toHaveLength(0);
  });

  it("help works without consuming a turn", () => {
    const before = newGame();
    const { state, lines } = handleCommand(before, "/?");
    expect(state.turns).toBe(0);
    expect(lines.some((l) => /COMMANDS/.test(l.text))).toBe(true);
  });
});
