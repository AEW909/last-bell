# Last Bell

A 1980s **choose-your-own text adventure**. You wake at your desk in a locked
biology classroom after detention — and the school has gone very quiet. Solve a
couple of puzzles to get out, then escape the building while a zombie caretaker
and a chained front door stand between you and the night.

Green-on-black terminal, a health bar and an inventory, just like the old
microcomputer adventures. Aimed at **ages 10–14** — simple, forgiving, and
restartable. Type commands, or tap the suggested ones (so it works on a
whiteboard or a tablet).

```
HEALTH ████████████████░░░░ 80      INV  brass dividers · torch      [moves 14]
```

## Play

```bash
npm install
npm run dev        # open the printed http://localhost:5173
```

Type `HELP` or `/?` in-game for the command list.

### Commands

| Group  | Commands |
| ------ | -------- |
| Move   | `go <place>` (or `n`/`s`/`e`/`w`), `look` / `l` |
| Look   | `examine <thing>` (`x`), `inventory` (`i`), `health`, `map` |
| Do     | `take`, `drop`, `use`, `open` |
| Hands  | `push`, `pull`, `put` (slide), `enter <code>` |
| Escape | `spray`, `search`, `cut` |
| Meta   | `restart`, `/?` |

## The adventure

1. **The locked classroom.** Crack the supply-cupboard code (a little chemistry
   hides the answer), then pull off the classic *slide-paper-under-the-door*
   trick to get the key.
2. **The school.** Deal with the caretaker, find a way through the chained main
   doors, and get out — without letting your health hit zero.

## Project layout

```
src/
  App.tsx            # the terminal UI (React)
  terminal.css       # green-on-black CRT styling
  main.tsx           # entry point
  game/
    engine.ts        # pure, framework-free game engine (state + parser)
    data.ts          # the world: rooms, items, prose, hint chips
    engine.test.ts   # unit tests for the engine
```

The game logic in `engine.ts` is pure TypeScript with **no React or DOM**, so
the whole adventure is unit-tested without rendering anything:

```bash
npm test
```

## Stack

Vite · React 19 · TypeScript · Vitest. No other runtime dependencies.

## Licence

All rights reserved.
