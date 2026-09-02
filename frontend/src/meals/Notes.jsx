import { useEffect, useState } from "react";
import { authFetch, getJSON, postJSON } from "../api";
import { MicIcon, StopIcon } from "../icons";
import { transcribe, useRecorder } from "../speech";
import { localDate } from "./flow";
import { useLang } from "./i18n";

// Reflections: what you noticed about your energy — food, training, sleep,
// mood — in your own words. Spoken or typed, the words land in the box first:
// transcription mis-hears, and these lines are the raw material for patterns
// later, so they get a look before saving.
export default function Notes() {
  const { t } = useLang();
  const [notes, setNotes] = useState(null);
  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);
  const [confirming, setConfirming] = useState(null);

  useEffect(() => {
    getJSON("/api/meals/notes").then((d) => setNotes(d?.notes || []));
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
    const { ok, data } = await postJSON("/api/meals/notes", { text });
    if (!ok) return;
    setDraft("");
    setNotes((prev) => [data, ...(prev || [])]);
  }

  async function remove(id) {
    setConfirming(null);
    const previous = notes;
    setNotes((rows) => rows.filter((n) => n.id !== id));
    const res = await authFetch(`/api/meals/notes/${id}`, { method: "DELETE" });
    if (!res.ok) setNotes(previous);
  }

  return (
    <section className="screen">
      <div className="panel">
        <h2 className="display">{t("reflectTitle")}</h2>
        <p className="note">{t("reflectLede")}</p>
        <div className="writer">
          <textarea
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("reflectPh")}
          />
          <button
            type="button"
            className={"mic" + (recorder.recording ? " on" : "")}
            onClick={recorder.toggle}
            aria-label={recorder.recording ? t("stop") : t("speak")}
          >
            {recorder.recording ? <StopIcon /> : <MicIcon />}
          </button>
        </div>
        {listening && <p className="hint">{t("listening")}</p>}
        <button type="button" className="primary wide" onClick={keep} disabled={!draft.trim()}>
          {t("keep")}
        </button>
      </div>

      {notes === null ? (
        <p className="hint centred">{t("loading")}</p>
      ) : notes.length === 0 ? (
        <p className="hint centred">{t("noReflect")}</p>
      ) : (
        <ul className="meallist">
          {notes.map((n) => (
            <li className="panel notecard" key={n.id}>
              <p className="notetext">{n.text}</p>
              <div className="cardactions">
                <span className="notedate">{localDate(n.created_at)}</span>
                {confirming === n.id ? (
                  <>
                    <button type="button" className="danger" onClick={() => remove(n.id)}>
                      {t("confirmDel")}
                    </button>
                    <button type="button" className="ghost" onClick={() => setConfirming(null)}>
                      {t("cancel")}
                    </button>
                  </>
                ) : (
                  <button type="button" className="ghost" onClick={() => setConfirming(n.id)}>
                    {t("del")}
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
