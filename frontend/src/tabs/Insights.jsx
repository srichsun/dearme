import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { getJSON, postJSON } from "../api";

// The rolling read, in the order it answers: who you are, the two halves of
// your energy, then what to do about them. Rebuilt only when you ask — so a
// page you're reading never changes underneath you, and you always know when a
// model call was spent on you.
const SECTIONS = [
  { key: "who_you_are", title: "Who you are", note: "drawn from what you've actually done" },
  { key: "what_helps", title: "What lifts you", note: "read against the days you rated" },
  { key: "what_costs", title: "What drains you", note: "read against the days you rated" },
  { key: "suggestions", title: "Worth trying", note: "small enough to start today" },
];

export default function Insights() {
  const [sections, setSections] = useState(null);
  const [behind, setBehind] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await getJSON("/profile");
      if (cancelled || !data) return;
      setSections(data.sections || {});
      setBehind(data.entries_behind || 0);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function refresh() {
    if (busy) return;
    setBusy(true);
    const res = await postJSON("/profile/refresh");
    setBusy(false);
    if (!res.ok) return;
    setSections(res.data.sections || {});
    setBehind(0);
  }

  const written = sections && SECTIONS.some((s) => sections[s.key]);

  return (
    <main className="screen">
      <section className="panel">
        <h2 className="display">A reading of you</h2>
        <p className="hint">
          {behind > 0
            ? `${behind} ${behind === 1 ? "day" : "days"} written since this was last read`
            : written
              ? "Up to date with everything you've written"
              : "Write a few days, then ask for a reading"}
        </p>
        <button className="primary wide" onClick={refresh} disabled={busy}>
          {busy ? "Reading you…" : written ? "Read again" : "Read me"}
        </button>
      </section>

      {written &&
        SECTIONS.filter((s) => sections[s.key]).map((s) => (
          <section key={s.key} className="panel">
            <h3 className="display small">{s.title}</h3>
            <p className="note">{s.note}</p>
            <div className="prose">
              <ReactMarkdown>{sections[s.key]}</ReactMarkdown>
            </div>
          </section>
        ))}
    </main>
  );
}
