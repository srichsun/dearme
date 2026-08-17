import { useEffect, useState } from "react";
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

  const save = () =>
    draft.trim() &&
    run(() => postJSON("/entries", { content: draft, energy }), "Couldn't save that.");

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
            onChange={(e) => setDraft(e.target.value)}
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

        <EnergyPicker value={energy} onChange={setEnergy} />

        <div className="actions">
          <button className="primary" onClick={save} disabled={busy}>
            Save
          </button>
          <span className="hint inline">
            {notice || "Add to today as many times as you like"}
          </span>
        </div>
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
      <h2 className="display">Read the day</h2>
      <p className="note">
        Pulls out what you won today and what you were grateful for, and keeps
        them where later answers can find them. Worth doing once the day is
        done.
      </p>

      <button className="primary wide" onClick={onRun} disabled={busy || !left}>
        {busy
          ? "Reading…"
          : entry.analyzed
            ? "Read it again"
            : "Read today"}
      </button>

      <p className="hint">
        {left
          ? `${left} of today's ${left === 1 ? "reading" : "readings"} left`
          : "Today has been read as many times as it can be."}
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
  const extra =
    Math.max(0, entry.wins.length - 1) + Math.max(0, entry.gratitude.length - 1);

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
        <Facts entry={entry} limit={1} />
      )}
    </button>
  );
}

// Wins and gratitude, as quiet typographic entries rather than emoji rows.
function Facts({ entry, limit }) {
  const wins = limit ? entry.wins.slice(0, limit) : entry.wins;
  const thanks = limit ? entry.gratitude.slice(0, limit) : entry.gratitude;
  if (!wins.length && !thanks.length) {
    return limit ? <p className="hint">Not yet reflected on.</p> : null;
  }
  return (
    <dl className="facts">
      {wins.map((w, i) => (
        <div key={`w${i}`} className="fact win">
          <dt>Won</dt>
          <dd>{w}</dd>
        </div>
      ))}
      {thanks.map((g, i) => (
        <div key={`g${i}`} className="fact thanks">
          <dt>Grateful</dt>
          <dd>{g}</dd>
        </div>
      ))}
    </dl>
  );
}
