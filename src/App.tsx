import { useEffect, useMemo, useRef, useState } from "react";
import {
  handleCommand,
  intro,
  newGame,
  type GameState,
  type Line,
  type Tone,
} from "./game/engine";
import { ITEMS, suggestions } from "./game/data";

/** A printed line plus a stable id so React can key the transcript. */
interface Entry extends Line {
  id: number;
}

/** Phosphor-green palette by line tone — see terminal.css. */
const TONE_CLASS: Record<Tone, string> = {
  narr: "t-narr",
  sys: "t-sys",
  room: "t-room",
  you: "t-you",
  good: "t-good",
  bad: "t-bad",
  win: "t-win",
  death: "t-death",
};

let counter = 0;
const tag = (lines: Line[]): Entry[] => lines.map((l) => ({ ...l, id: counter++ }));

export default function App() {
  const [state, setState] = useState<GameState>(() => newGame());
  const [entries, setEntries] = useState<Entry[]>(() => tag(intro()));
  const [draft, setDraft] = useState("");
  const historyRef = useRef<string[]>([]);
  const histIdxRef = useRef(-1);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the newest output in view as the transcript grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries]);

  function submit(raw: string) {
    const cmd = raw.trim();
    if (!cmd) return;
    const echo: Entry = { id: counter++, text: `> ${cmd}`, tone: "you" };
    const { state: next, lines } = handleCommand(state, cmd);
    setState(next);
    setEntries((prev) => [...prev, echo, ...tag(lines)]);
    historyRef.current.push(cmd);
    histIdxRef.current = -1;
    setDraft("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const h = historyRef.current;
    if (e.key === "Enter") {
      submit(draft);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!h.length) return;
      const idx = histIdxRef.current < 0 ? h.length - 1 : Math.max(0, histIdxRef.current - 1);
      histIdxRef.current = idx;
      setDraft(h[idx]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdxRef.current < 0) return;
      const idx = histIdxRef.current + 1;
      if (idx >= h.length) {
        histIdxRef.current = -1;
        setDraft("");
      } else {
        histIdxRef.current = idx;
        setDraft(h[idx]);
      }
    }
  }

  const chips = useMemo(() => suggestions(state), [state]);
  const barCells = 20;
  const filled = Math.round((state.health / state.maxHealth) * barCells);
  const healthClass = state.health > 50 ? "ok" : state.health > 25 ? "warn" : "crit";

  return (
    <div className="shell">
      <p className="title-strap">Last Bell · escape the school · 1987</p>
      <div className="terminal" onClick={() => inputRef.current?.focus()}>
        {/* Status bar: HEALTH + inventory, classic HUD across the top. */}
        <div className="hud">
          <div className="hud-group">
            <span className="hud-label">HEALTH</span>
            <span className={`bar ${healthClass}`}>
              {"█".repeat(filled)}
              <span className="empty">{"░".repeat(barCells - filled)}</span>
            </span>
            <span className={healthClass}>{state.health}</span>
          </div>
          <div className="hud-group">
            <span className="hud-label">INV</span>
            <span className="inv">
              {state.inventory.length
                ? state.inventory.map((i) => ITEMS[i].name).join(" · ")
                : "— empty —"}
            </span>
            <span className="moves">[moves {state.turns}]</span>
          </div>
        </div>

        {/* Transcript */}
        <div className="transcript" ref={scrollRef}>
          {entries.map((e) => (
            <p key={e.id} className={TONE_CLASS[e.tone ?? "narr"]}>
              {e.text || " "}
            </p>
          ))}
        </div>

        {/* Tappable command suggestions — playable without a keyboard. */}
        <div className="chips">
          {chips.map((c) => (
            <button key={c} type="button" className="chip" onClick={() => submit(c)}>
              {c}
            </button>
          ))}
        </div>

        {/* Prompt */}
        <div className="prompt">
          <span className="caret">{">"}</span>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            autoComplete="off"
            aria-label="Type a command"
            placeholder="type a command, or /? for help"
          />
        </div>
      </div>
    </div>
  );
}
