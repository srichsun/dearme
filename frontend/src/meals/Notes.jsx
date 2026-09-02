import { useEffect, useState } from "react";
import { authFetch, getJSON, postJSON } from "../api";
import { MicIcon, StopIcon } from "../icons";
import { transcribe, useRecorder } from "../speech";

// What you noticed about how you eat, in your own words. Spoken or typed,
// the words land in the box first — transcription mis-hears, and these lines
// are the raw material for patterns later, so they get a look before saving.
export default function Notes() {
  const [notes, setNotes] = useState(null);
  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);
  const [confirming, setConfirming] = useState(null);

  useEffect(() => {
    getJSON("/meals/notes").then((d) => setNotes(d?.notes || []));
  }, []);

  const recorder = useRecorder(async (blob) => {
    setListening(true);
    try {
      const text = await transcribe(blob);
      if (text) setDraft((prev) => (prev ? `${prev} ${text}` : text));
    } catch {
      /* nothing came back — the box is still there to type into */
    } finally {
      setListening(false);
    }
  });

  async function keep() {
    const text = draft.trim();
    if (!text) return;
    const { ok, data } = await postJSON("/meals/notes", { text });
    if (!ok) return;
    setDraft("");
    setNotes((prev) => [data, ...(prev || [])]);
  }

  async function remove(id) {
    setConfirming(null);
    const previous = notes;
    setNotes((rows) => rows.filter((n) => n.id !== id));
    const res = await authFetch(`/meals/notes/${id}`, { method: "DELETE" });
    if (!res.ok) setNotes(previous);
  }

  return (
    <section className="screen">
      <div className="panel">
        <h2 className="display">吃過才知道的事</h2>
        <p className="note">講一句或打一句：什麼不想吃、為什麼、什麼吃了很撐。之後整理成你的 pattern。</p>
        <div className="writer">
          <textarea
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="例如：早上不想吃燕麥高蛋白，因為不香不油"
          />
          <button
            type="button"
            className={"mic" + (recorder.recording ? " on" : "")}
            onClick={recorder.toggle}
            aria-label={recorder.recording ? "停止" : "用講的"}
          >
            {recorder.recording ? <StopIcon /> : <MicIcon />}
          </button>
        </div>
        {listening && <p className="hint">聽寫中…</p>}
        <button type="button" className="primary wide" onClick={keep} disabled={!draft.trim()}>
          記下來
        </button>
      </div>

      {notes === null ? (
        <p className="hint centred">載入中…</p>
      ) : notes.length === 0 ? (
        <p className="hint centred">還沒有心得。</p>
      ) : (
        <ul className="meallist">
          {notes.map((n) => (
            <li className="panel notecard" key={n.id}>
              <p className="notetext">{n.text}</p>
              <div className="cardactions">
                <span className="notedate">{n.created_at.slice(0, 10)}</span>
                {confirming === n.id ? (
                  <>
                    <button type="button" className="danger" onClick={() => remove(n.id)}>
                      確定刪除？
                    </button>
                    <button type="button" className="ghost" onClick={() => setConfirming(null)}>
                      取消
                    </button>
                  </>
                ) : (
                  <button type="button" className="ghost" onClick={() => setConfirming(n.id)}>
                    刪除
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
