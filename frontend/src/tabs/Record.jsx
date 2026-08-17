import { useEffect, useRef, useState } from "react";
import EnergyChart from "../EnergyChart";
import { bandFor, colorFor, longDay, percentFor } from "../energy";
import { useCurrentTheme } from "../theme";
import { getJSON, postJSON } from "../api";
import { useRecorder, transcribe } from "../speech";
import { ChevronIcon, MicIcon, StopIcon } from "../icons";

// The record: your energy over time, today's entry, and the days behind it.
//
// The chart's range also chooses which days are listed below it, so one control
// runs the whole screen — there is no second rule to learn about how far back
// the list goes.
export default function Record({ today }) {
  const [days, setDays] = useState(7);
  const [entries, setEntries] = useState([]);
  const [draft, setDraft] = useState("");
  const [energy, setEnergy] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState(false);
  // Nothing is saved until the person has actually changed something. Without
  // this, loading today's entry would immediately write it straight back.
  const touched = useRef(false);

  // Speaking the day out loud is how most days get written at all — typing a
  // paragraph on a phone at 11pm is a good way to write nothing.
  const recorder = useRecorder(async (blob) => {
    setNotice("Writing that down…");
    try {
      const said = await transcribe(blob);
      setNotice("");
      if (said) setDraft((prev) => (prev ? `${prev}\n\n${said}` : said));
    } catch {
      setNotice("Couldn't hear that.");
    }
  });

  const todays = entries.find((e) => e.date === today) || null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await getJSON(`/entries?days=${days}`);
      if (cancelled || !data) return;
      setEntries(data.entries || []);
      const mine = (data.entries || []).find((e) => e.date === today);
      if (mine) {
        setDraft(mine.content);
        setEnergy(mine.energy);
      }
      touched.current = false;
    })();
    return () => {
      cancelled = true;
    };
  }, [days, today]);

  // Put one updated day back into the list without refetching the range.
  function merge(entry) {
    setEntries((prev) => {
      const rest = prev.filter((e) => e.date !== entry.date);
      return [...rest, entry].sort((a, b) => a.date.localeCompare(b.date));
    });
  }

  async function run(request, failure) {
    if (busy) return;
    setBusy(true);
    setNotice("");
    const res = await request();
    setBusy(false);
    if (res.status === 409) return setNotice("No readings left today.");
    if (!res.ok) return setNotice(failure);
    merge(res.data);
    return res.data;
  }

  // Saving is not a decision, so it is not a button. A pause in the typing is
  // the signal — long enough not to write on every keystroke, short enough that
  // putting the phone down mid-sentence still keeps the sentence.
  useEffect(() => {
    if (!touched.current || !draft.trim()) return;
    setSaved(false);
    const pause = setTimeout(async () => {
      const res = await postJSON("/entries", { content: draft, energy });
      if (!res.ok) return setNotice("Couldn't save that.");
      setNotice("");
      merge(res.data);
      setSaved(true);
    }, 1200);
    return () => clearTimeout(pause);
    // merge is stable enough for this: it only ever calls setEntries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, energy]);

  const analyse = () =>
    todays &&
    run(
      () => postJSON(`/entries/${todays.id}/analyze`),
      "Couldn't read the day.",
    );

  const past = [...entries].reverse().filter((e) => e.date !== today);

  return (
    <main className="screen">
      <section className="panel chartpanel">
        <div className="range">
          {[7, 30].map((n) => (
            <button
              key={n}
              className={days === n ? "on" : ""}
              onClick={() => setDays(n)}
            >
              {n} days
            </button>
          ))}
        </div>
        <EnergyChart entries={entries} days={days} />
      </section>

      <section className="panel">
        <h2 className="display">Today</h2>
        <div className="writer">
          <textarea
            value={draft}
            onChange={(e) => {
              touched.current = true;
              setDraft(e.target.value);
            }}
            placeholder="How did today really go?"
            rows={7}
          />
          <button
            type="button"
            className={"mic" + (recorder.recording ? " on" : "")}
            onClick={recorder.toggle}
            aria-label={recorder.recording ? "Stop recording" : "Say it instead"}
          >
            {recorder.recording ? <StopIcon /> : <MicIcon />}
          </button>
        </div>

        <EnergyPicker
          value={energy}
          onChange={(v) => {
            touched.current = true;
            setEnergy(v);
          }}
        />

        <p className="hint savedline">
          {notice || (saved ? "Saved" : "Saves itself as you write")}
        </p>
      </section>

      {todays && <Analysis entry={todays} onRun={analyse} busy={busy} />}

      {past.length > 0 && <h3 className="rule">Before today</h3>}
      {past.map((e) => (
        <DayCard key={e.date} entry={e} />
      ))}
    </main>
  );
}

// Analysing is its own step, in its own panel, because it is a different kind
// of act from writing: writing is free and happens all day, this spends a model
// call and is meant for the end of it. Sitting them side by side as two buttons
// made them look like variations on "done".
function Analysis({ entry, onRun, busy }) {
  const left = entry.analyses_left;
  return (
    <section className="panel">
      <h2 className="display">Analyse</h2>
      <p className="note">
        Breaks the day into what actually happened in it, and keeps those where
        later answers can find them. Worth doing once the day is done.
      </p>

      <button className="primary wide" onClick={onRun} disabled={busy || !left}>
        {busy ? "Analysing…" : entry.analyzed ? "Analyse again" : "Analyse"}
      </button>

      <p className="hint">
        {left
          ? `${left} of today's ${left === 1 ? "analysis" : "analyses"} left`
          : "Today has been analysed as many times as it can be."}
      </p>

      <Facts entry={entry} />
    </section>
  );
}

// The energy slider. Ten steps, shown as a percentage and a word — the word is
// what you actually mean; the number is only there to make the chart readable.
function EnergyPicker({ value, onChange }) {
  const theme = useCurrentTheme();
  const band = value ? bandFor(value) : null;
  return (
    <div className="energy">
      <div className="energyhead">
        <span className="label">Energy</span>
        {value ? (
          <span className="reading" style={{ color: colorFor(value, theme) }}>
            {percentFor(value)}% <em>{band.label}</em>
          </span>
        ) : (
          <span className="reading unset">not yet rated</span>
        )}
      </div>
      <input
        type="range"
        min="1"
        max="10"
        step="1"
        value={value || 5}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ "--track": colorFor(value, theme) }}
      />
    </div>
  );
}

// One past day, folded down: the date, its energy, and the first thing of each
// kind. The rest opens on a tap — thirty full days would be a wall.
//
// The whole card is the button, not a control tucked inside it. On a phone,
// anything smaller than the card is something you have to aim at.
function DayCard({ entry }) {
  const theme = useCurrentTheme();
  const [open, setOpen] = useState(false);
  const extra = Math.max(0, (entry.facts?.length || 0) - 2);

  return (
    <button
      className={"panel day" + (open ? " open" : "")}
      onClick={() => setOpen(!open)}
      aria-expanded={open}
    >
      <span className="dayhead">
        <span className="dot" style={{ background: colorFor(entry.energy, theme) }} />
        <span className="date">{longDay(entry.date)}</span>
        {entry.energy ? (
          <span className="pct">{percentFor(entry.energy)}%</span>
        ) : (
          <span className="pct unset">—</span>
        )}
        <span className="chevron">
          {!open && extra > 0 && <span className="more">+{extra}</span>}
          <ChevronIcon />
        </span>
      </span>

      {open ? (
        <>
          <Facts entry={entry} />
          <p className="daytext">{entry.content}</p>
        </>
      ) : (
        <Facts entry={entry} limit={2} />
      )}
    </button>
  );
}

// What the day was broken into, as quiet typographic entries rather than emoji
// rows. Wins and gratitude lead, because they are the two a person actually
// comes back for; the rest follow in the order they were found.
const LEADS = ["wins", "gratitude"];
const LABEL = { wins: "Won", gratitude: "Grateful" };

function label(category) {
  return LABEL[category] || category[0].toUpperCase() + category.slice(1);
}

function ordered(facts) {
  const lead = LEADS.flatMap((c) => facts.filter((f) => f.category === c));
  return [...lead, ...facts.filter((f) => !LEADS.includes(f.category))];
}

function Facts({ entry, limit }) {
  const all = ordered(entry.facts || []);
  const shown = limit ? all.slice(0, limit) : all;
  if (!shown.length) {
    return limit ? <p className="hint">Not yet analysed.</p> : null;
  }
  return (
    <dl className="facts">
      {shown.map((f, i) => (
        <div key={i} className={"fact " + f.category.replace(/[^a-z]+/g, "-")}>
          <dt>{label(f.category)}</dt>
          <dd>{f.text}</dd>
        </div>
      ))}
    </dl>
  );
}
