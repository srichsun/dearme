import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { authFetch, getJSON } from "../api";

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

  // The reading arrives as text with "### section" headings in it. Splitting on
  // those as it streams is what lets each part appear the moment it is written,
  // instead of the page sitting blank for a minute and then filling all at once.
  function splitSections(text) {
    const found = {};
    const parts = text.split(/^[#\s]*(\w+)\s*:?\s*$/m);
    for (let i = 1; i < parts.length; i += 2) {
      const key = parts[i];
      if (SECTIONS.some((s) => s.key === key)) found[key] = parts[i + 1].trim();
    }
    return found;
  }

  async function refresh() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await authFetch("/profile/refresh/stream", { method: "POST" });
      if (!res.ok || !res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let written = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        written += decoder.decode(value, { stream: true });
        // Written sections replace their old text; ones not reached yet keep
        // theirs, so the page never blanks out mid-rewrite.
        setSections((prev) => ({ ...(prev || {}), ...splitSections(written) }));
      }
      setBehind(0);
    } finally {
      setBusy(false);
    }
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
          {busy ? "Analysing…" : "Analyse"}
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
