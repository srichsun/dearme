import { useEffect, useRef, useState } from "react";
import { authFetch, getJSON } from "../api";
import { MicIcon, StopIcon } from "../icons";
import { transcribe, useRecorder } from "../speech";
import { placeDetails, placesEnabled, suggestPlaces } from "./places";
import { useLang } from "./i18n";
import {
  EMPTY,
  NO_PLACE,
  appendSpoken,
  OPTIONS,
  RATINGS,
  clampStep,
  firstMissing,
  fromMeal,
  isAnswered,
  isLast,
  isVideoUrl,
  keyToChoice,
  keyToRating,
  stepText,
  toPayload,
  toggleIn,
  visibleSteps,
} from "./flow";

// One question at a time, like a form that talks. Enter moves on, Esc
// closes, a number key picks an option. The same dialog edits: it opens
// filled in, and the dots up top jump straight to the question to change.
export default function QuickAdd({ meal, onClose, onSaved }) {
  const { lang, t } = useLang();
  const isNew = meal === "new";
  const [answers, setAnswers] = useState(() => (isNew ? EMPTY : fromMeal(meal)));
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);
  const [listening, setListening] = useState(false);
  // The kinds already in use, so a new meal joins an existing group with one
  // tap instead of a near-miss spelling that splits it.
  const [kinds, setKinds] = useState([]);
  useEffect(() => {
    getJSON("/api/meals/kinds").then((d) => setKinds((d?.kinds || []).map((k) => k.kind)));
  }, []);

  // The note can be spoken. What is heard lands in the box, not in the
  // meal: transcription mis-hears, and a glance fixes it before saving.
  const recorder = useRecorder(async (blob) => {
    setListening(true);
    try {
      const heard = await transcribe(blob);
      setAnswers((a) => ({ ...a, note: appendSpoken(a.note, heard) }));
    } catch {
      /* nothing heard — the box is still there to type into */
    } finally {
      setListening(false);
    }
  });

  // The shop: what they typed, what Google suggested, and whether we are
  // waiting on it. The answer itself lives in `answers` (place_* fields).
  const [placeQuery, setPlaceQuery] = useState(() => (isNew ? "" : meal.place?.place_name || ""));
  const [suggestions, setSuggestions] = useState([]);
  const [placeBusy, setPlaceBusy] = useState(false);

  const steps = visibleSteps(answers);
  const at = clampStep(index, answers);
  const step = steps[at];

  useEffect(() => {
    if (step?.type !== "place" || !placesEnabled) return;
    const text = placeQuery.trim();
    if (!text || text === answers.place_name) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSuggestions(await suggestPlaces(text, null, lang));
    }, 300);
    return () => clearTimeout(timer);
  }, [placeQuery, step?.type, answers.place_name, lang]);

  async function pickPlace(sug) {
    setPlaceBusy(true);
    setSuggestions([]);
    const fields = await placeDetails(sug.placeId, lang);
    setPlaceBusy(false);
    if (!fields) {
      setError(t("placeFailed"));
      return;
    }
    setError("");
    setAnswers((a) => ({ ...a, ...fields }));
    setPlaceQuery(fields.place_name || sug.main);
  }

  function clearPlace() {
    setAnswers((a) => ({ ...a, ...NO_PLACE }));
    setPlaceQuery("");
  }

  // Each new question starts with the cursor in its box.
  useEffect(() => {
    inputRef.current?.focus();
  }, [at]);

  function set(key, value) {
    setError("");
    setAnswers((a) => ({ ...a, [key]: value }));
  }

  function go(to) {
    setError("");
    setIndex(clampStep(to, answers));
  }

  async function save() {
    const missing = firstMissing(answers);
    if (missing !== -1) {
      setIndex(missing);
      setError(t("missing"));
      return;
    }
    setSaving(true);
    const res = await authFetch(isNew ? "/api/meals" : `/api/meals/${meal.id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toPayload(answers)),
    });
    setSaving(false);
    if (!res.ok) {
      let detail = t("saveFailed");
      try {
        detail = (await res.json()).detail || detail;
      } catch {
        /* keep the plain message */
      }
      setError(detail);
      return;
    }
    onSaved(await res.json());
  }

  function next() {
    if (!isAnswered(step, answers)) {
      setError(t("answerFirst"));
      return;
    }
    if (step.type === "url" && !isVideoUrl(answers[step.key])) {
      setError(t("badUrl"));
      return;
    }
    if (isLast(at, answers)) save();
    else go(at + 1);
  }

  function choose(code) {
    // Pick and move on in one go; the next render already knows whether
    // "eat out" just removed the method step.
    const nextAnswers = { ...answers, [step.key]: code };
    setError("");
    setAnswers(nextAnswers);
    if (isLast(at, nextAnswers)) return;
    setIndex(clampStep(at + 1, nextAnswers));
  }

  function onKey(e) {
    if (e.key === "Escape") return onClose();
    if (step.type === "stars") {
      const n = keyToRating(e.key);
      if (n) {
        e.preventDefault();
        choose(n);
      }
      if (e.key === "Enter") next();
      return;
    }
    if (step.type === "kind" || step.type === "place" || step.type === "url") {
      if (e.key === "Enter") {
        e.preventDefault();
        next();
      }
      return;
    }
    if (step.type === "multi") {
      const code = keyToChoice(e.key, step.field);
      if (code) {
        e.preventDefault();
        set(step.key, toggleIn(answers[step.key], code));
      }
      if (e.key === "Enter") next();
      return;
    }
    if (step.type === "choice") {
      const code = keyToChoice(e.key, step.key);
      if (code) {
        e.preventDefault();
        choose(code);
      }
      if (e.key === "Enter") next();
      return;
    }
    // A long answer keeps Shift+Enter for a new line; plain Enter moves on.
    if (e.key === "Enter" && !(step.type === "long" && e.shiftKey)) {
      e.preventDefault();
      next();
    }
  }

  return (
    <div className="dialog" onKeyDown={onKey}>
      <div className="qa" role="dialog" aria-modal="true">
        <div className="qahead">
          <div className="dots">
            {steps.map((s, i) => (
              <button
                type="button"
                key={s.key}
                className={"dot" + (i === at ? " on" : "") + (isAnswered(s, answers) ? " done" : "")}
                onClick={() => go(i)}
                aria-label={stepText(s, lang).ask}
              />
            ))}
          </div>
          <button type="button" className="signout" onClick={onClose}>
            {t("close")}
          </button>
        </div>

        <p className="qnum">
          {at + 1} / {steps.length}
        </p>
        <h2 className="display">{stepText(step, lang).ask}</h2>
        {step.hint && <p className="note">{stepText(step, lang).hint}</p>}

        {step.type === "choice" && (
          <div className="choices">
            {OPTIONS[step.key].map(([code, label], i) => (
              <button
                type="button"
                key={code}
                className={"choice" + (answers[step.key] === code ? " on" : "")}
                onClick={() => choose(code)}
                ref={i === 0 ? inputRef : null}
              >
                <span className="keycap">{i + 1}</span>
                {label[lang] ?? label.zh}
              </button>
            ))}
          </div>
        )}
        {step.type === "stars" && (
          <div className="stars" role="radiogroup" aria-label={t("starsLabel")}>
            {RATINGS.map((n) => (
              <button
                type="button"
                key={n}
                className={"star" + (answers.rating != null && n <= answers.rating ? " on" : "")}
                onClick={() => choose(n)}
                aria-label={`${n} ${t("star")}`}
                ref={n === 1 ? inputRef : null}
              >
                ★
              </button>
            ))}
            <span className="starnum">{answers.rating ? `${answers.rating} / 10` : t("unrated")}</span>
            {answers.rating != null && (
              <button type="button" className="clear" onClick={() => set("rating", null)}>
                {t("clearOne")}
              </button>
            )}
          </div>
        )}
        {step.type === "kind" && (
          <>
            <input
              ref={inputRef}
              value={answers.kind}
              onChange={(e) => set("kind", e.target.value)}
              placeholder={t("kindPh")}
            />
            {kinds.length > 0 && (
              <div className="chips">
                {kinds.map((k) => (
                  <button
                    type="button"
                    key={k}
                    className={"chip" + (answers.kind.trim() === k ? " on" : "")}
                    onClick={() => set("kind", answers.kind.trim() === k ? "" : k)}
                  >
                    {k}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        {step.type === "place" && (
          <div className="placepick">
            <input
              ref={inputRef}
              value={placeQuery}
              onChange={(e) => setPlaceQuery(e.target.value)}
              placeholder={placesEnabled ? t("placePh") : t("noPlacesKey")}
              disabled={!placesEnabled}
            />
            {suggestions.length > 0 && (
              <ul className="suggest">
                {suggestions.map((sug) => (
                  <li key={sug.placeId}>
                    <button type="button" onClick={() => pickPlace(sug)}>
                      <span className="sugmain">{sug.main}</span>
                      <span className="sugsub">{sug.secondary}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {placeBusy && <p className="hint">{t("placeBusy")}</p>}
            {answers.place_name && (
              <div className="picked">
                <b>{answers.place_name}</b>
                {answers.address && <span>{answers.address}</span>}
                {answers.phone && <span>{answers.phone}</span>}
                <button type="button" className="clear" onClick={clearPlace}>{t("clearOne")}</button>
              </div>
            )}
          </div>
        )}
        {step.type === "url" && (
          <input
            ref={inputRef}
            type="url"
            inputMode="url"
            value={answers[step.key]}
            onChange={(e) => set(step.key, e.target.value)}
            placeholder={t("videoPh")}
          />
        )}
        {step.type === "multi" && (
          <div className="choices">
            {OPTIONS[step.field].map(([code, label], i) => (
              <button
                type="button"
                key={code}
                className={"choice" + ((answers[step.key] || []).includes(code) ? " on" : "")}
                onClick={() => set(step.key, toggleIn(answers[step.key], code))}
                ref={i === 0 ? inputRef : null}
                aria-pressed={(answers[step.key] || []).includes(code)}
              >
                <span className="keycap">{i + 1}</span>
                {label[lang] ?? label.zh}
              </button>
            ))}
          </div>
        )}
        {step.type === "text" && (
          <input
            ref={inputRef}
            value={answers[step.key]}
            onChange={(e) => set(step.key, e.target.value)}
            placeholder={t("namePh")}
          />
        )}
        {step.type === "long" && (
          <div className={step.key === "note" ? "writer" : undefined}>
            <textarea
              ref={inputRef}
              rows={4}
              value={answers[step.key]}
              onChange={(e) => set(step.key, e.target.value)}
              placeholder={step.key === "recipe" ? t("recipePh") : t("notePh")}
            />
            {step.key === "note" && (
              <button
                type="button"
                className={"mic" + (recorder.recording ? " on" : "")}
                onClick={recorder.toggle}
                aria-label={recorder.recording ? t("stop") : t("speak")}
              >
                {recorder.recording ? <StopIcon /> : <MicIcon />}
              </button>
            )}
          </div>
        )}
        {listening && <p className="hint">{t("listening")}</p>}

        {error && <p className="qerror">{error}</p>}

        <div className="qafoot">
          <button type="button" className="ghost" onClick={() => go(at - 1)} disabled={at === 0}>
            {t("prev")}
          </button>
          <button type="button" className="primary" onClick={next} disabled={saving}>
            {isLast(at, answers) ? (saving ? t("saving") : isNew ? t("create") : t("save")) : t("next")}
          </button>
          <span className="qhint">{t("keys")}</span>
        </div>
      </div>
    </div>
  );
}
