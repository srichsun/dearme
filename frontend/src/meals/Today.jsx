import { useEffect, useRef, useState } from "react";
import { authFetch, getJSON, postJSON } from "../api";
import { useLang } from "./i18n";

async function send(path, method, body) {
  const res = await authFetch(path, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return res.ok ? res.json() : null;
}

// The first screen: the goal in your own words, and the few things to do
// today. Ticks are per day — tomorrow the list is clean again.
export default function Today() {
  const { t } = useLang();
  const [goal, setGoal] = useState("");
  const [editingGoal, setEditingGoal] = useState(false);
  const [habits, setHabits] = useState(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(null); // habit id whose text is open
  const [confirming, setConfirming] = useState(null);
  const goalRef = useRef(null);

  useEffect(() => {
    getJSON("/api/today").then((d) => {
      setGoal(d?.goal || "");
      setHabits(d?.habits || []);
    });
  }, []);

  useEffect(() => {
    if (editingGoal) goalRef.current?.focus();
  }, [editingGoal]);

  async function saveGoal() {
    setEditingGoal(false);
    const saved = await send("/api/today/goal", "PUT", { text: goal });
    if (saved) setGoal(saved.goal || "");
  }

  async function add() {
    const text = draft.trim();
    if (!text) return;
    const { ok, data } = await postJSON("/api/today/habits", { text });
    if (!ok) return;
    setDraft("");
    setHabits((h) => [...h, data]);
  }

  async function starter() {
    const { ok, data } = await postJSON("/api/today/habits/starter");
    if (ok) setHabits(data.habits);
  }

  async function toggle(h) {
    // Flip on screen first; put it back if the server says no.
    setHabits((rows) => rows.map((r) => (r.id === h.id ? { ...r, done: !h.done } : r)));
    const ok = await send(`/api/today/habits/${h.id}/check`, h.done ? "DELETE" : "POST");
    if (!ok) setHabits((rows) => rows.map((r) => (r.id === h.id ? { ...r, done: h.done } : r)));
  }

  async function rename(h, text) {
    setEditing(null);
    const trimmed = text.trim();
    if (!trimmed || trimmed === h.text) return;
    const saved = await send(`/api/today/habits/${h.id}`, "PATCH", { text: trimmed });
    if (saved) setHabits((rows) => rows.map((r) => (r.id === h.id ? { ...r, text: saved.text } : r)));
  }

  async function remove(id) {
    setConfirming(null);
    const previous = habits;
    setHabits((rows) => rows.filter((r) => r.id !== id));
    const ok = await send(`/api/today/habits/${id}`, "DELETE");
    if (!ok) setHabits(previous);
  }

  const doneCount = (habits || []).filter((h) => h.done).length;

  return (
    <section className="screen">
      <div className="panel goalpanel">
        <p className="qnum">{t("goalLabel")}</p>
        {editingGoal ? (
          <textarea
            ref={goalRef}
            className="goaledit"
            rows={3}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onBlur={saveGoal}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                saveGoal();
              }
              if (e.key === "Escape") setEditingGoal(false);
            }}
            placeholder={t("goalPh")}
          />
        ) : (
          <button type="button" className={"goal" + (goal ? "" : " empty")} onClick={() => setEditingGoal(true)}>
            {goal || t("goalPh")}
          </button>
        )}
        {editingGoal && <p className="hint">{t("goalHint")}</p>}
      </div>

      <div className="panel">
        <div className="listhead">
          <p className="qnum">{t("todayList")}</p>
          {habits && habits.length > 0 && (
            <span className="starnum">{doneCount} / {habits.length}</span>
          )}
        </div>
        {habits === null ? (
          <p className="hint">{t("loading")}</p>
        ) : (
          <ul className="habits">
            {habits.map((h) => (
              <li key={h.id} className={h.done ? "done" : ""}>
                <button
                  type="button"
                  className="tick"
                  role="checkbox"
                  aria-checked={h.done}
                  aria-label={h.text}
                  onClick={() => toggle(h)}
                >
                  {h.done ? "✓" : ""}
                </button>
                {editing === h.id ? (
                  <input
                    className="habitedit"
                    defaultValue={h.text}
                    autoFocus
                    onBlur={(e) => rename(h, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") rename(h, e.target.value);
                      if (e.key === "Escape") setEditing(null);
                    }}
                  />
                ) : (
                  <button type="button" className="habittext" onClick={() => setEditing(h.id)}>
                    {h.text}
                  </button>
                )}
                {confirming === h.id ? (
                  <span className="habitactions">
                    <button type="button" className="danger" onClick={() => remove(h.id)}>{t("confirmDel")}</button>
                    <button type="button" className="ghost" onClick={() => setConfirming(null)}>{t("cancel")}</button>
                  </span>
                ) : (
                  <button type="button" className="habitdel" aria-label={t("del")} onClick={() => setConfirming(h.id)}>
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {habits && habits.length > 0 && doneCount === habits.length && (
          <p className="hint alldone">{t("allDone")}</p>
        )}
        {habits && habits.length === 0 && (
          <div className="starterrow">
            <p className="hint">{t("noHabits")}</p>
            <button type="button" className="ghost" onClick={starter}>{t("starter")}</button>
          </div>
        )}
        <div className="searchrow addrow">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder={t("habitPh")}
          />
          <button type="button" className="primary" onClick={add} disabled={!draft.trim()}>
            {t("addHabit")}
          </button>
        </div>
      </div>
    </section>
  );
}
