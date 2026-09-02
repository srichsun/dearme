import { useEffect, useRef, useState } from "react";
import { authFetch } from "../api";
import {
  EMPTY,
  OPTIONS,
  RATINGS,
  clampStep,
  firstMissing,
  fromMeal,
  isAnswered,
  isLast,
  keyToChoice,
  keyToRating,
  toPayload,
  visibleSteps,
} from "./flow";

// One question at a time, like a form that talks. Enter moves on, Esc
// closes, a number key picks an option. The same dialog edits: it opens
// filled in, and the dots up top jump straight to the question to change.
export default function QuickAdd({ meal, onClose, onSaved }) {
  const isNew = meal === "new";
  const [answers, setAnswers] = useState(() => (isNew ? EMPTY : fromMeal(meal)));
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  const steps = visibleSteps(answers);
  const at = clampStep(index, answers);
  const step = steps[at];

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
      setError("這題還沒填。");
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
      let detail = "存不進去，再試一次。";
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
      setError("先回答這題。");
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
                aria-label={s.ask}
              />
            ))}
          </div>
          <button type="button" className="signout" onClick={onClose}>
            關閉
          </button>
        </div>

        <p className="qnum">
          {at + 1} / {steps.length}
        </p>
        <h2 className="display">{step.ask}</h2>
        {step.hint && <p className="note">{step.hint}</p>}

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
                {label}
              </button>
            ))}
          </div>
        )}
        {step.type === "stars" && (
          <div className="stars" role="radiogroup" aria-label="幾顆星">
            {RATINGS.map((n) => (
              <button
                type="button"
                key={n}
                className={"star" + (answers.rating != null && n <= answers.rating ? " on" : "")}
                onClick={() => choose(n)}
                aria-label={`${n} 星`}
                ref={n === 1 ? inputRef : null}
              >
                ★
              </button>
            ))}
            <span className="starnum">{answers.rating ? `${answers.rating} / 10` : "未評"}</span>
            {answers.rating != null && (
              <button type="button" className="clear" onClick={() => set("rating", null)}>
                清除
              </button>
            )}
          </div>
        )}
        {step.type === "text" && (
          <input
            ref={inputRef}
            value={answers[step.key]}
            onChange={(e) => set(step.key, e.target.value)}
            placeholder="例如：氣炸鍋雞胸"
          />
        )}
        {step.type === "long" && (
          <textarea
            ref={inputRef}
            rows={4}
            value={answers[step.key]}
            onChange={(e) => set(step.key, e.target.value)}
            placeholder={step.key === "recipe" ? "雞胸抹鹽\n氣炸 180 度 15 分" : ""}
          />
        )}

        {error && <p className="qerror">{error}</p>}

        <div className="qafoot">
          <button type="button" className="ghost" onClick={() => go(at - 1)} disabled={at === 0}>
            上一題
          </button>
          <button type="button" className="primary" onClick={next} disabled={saving}>
            {isLast(at, answers) ? (saving ? "存檔中…" : isNew ? "新增" : "存檔") : "下一題"}
          </button>
          <span className="qhint">Enter 下一題 · Esc 關閉</span>
        </div>
      </div>
    </div>
  );
}
