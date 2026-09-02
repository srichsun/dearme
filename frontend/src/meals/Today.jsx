import { useEffect, useRef, useState } from "react";
import { authFetch, getJSON, postJSON } from "../api";
import Reward from "./Reward";
import { useLang } from "./i18n";

const rewardedKey = (day) => `meals.rewarded.${day}`;
function rewardedToday(day) {
  try {
    return localStorage.getItem(rewardedKey(day)) === "1";
  } catch {
    return false;
  }
}
function markRewarded(day) {
  try {
    localStorage.setItem(rewardedKey(day), "1");
  } catch {
    /* fine — it will just play again next time */
  }
}

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
  const [principles, setPrinciples] = useState(null);
  const [ruleDraft, setRuleDraft] = useState("");
  const [editingRule, setEditingRule] = useState(null);
  const [confirmingRule, setConfirmingRule] = useState(null);
  const [day, setDay] = useState("");
  const [videos, setVideos] = useState([]);
  const [reward, setReward] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const wasAllDone = useRef(true); // true until the list loads, so a load never fires it
  const goalRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    getJSON("/api/today").then((d) => {
      setGoal(d?.goal || "");
      setHabits(d?.habits || []);
      setPrinciples(d?.principles || []);
      setDay(d?.day || "");
      const list = d?.habits || [];
      wasAllDone.current = list.length === 0 || list.every((h) => h.done);
    });
    getJSON("/api/today/rewards").then((d) => setVideos(d?.videos || []));
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

  async function addRule() {
    const text = ruleDraft.trim();
    if (!text) return;
    const { ok, data } = await postJSON("/api/today/principles", { text });
    if (!ok) return;
    setRuleDraft("");
    setPrinciples((rows) => [...rows, data]);
  }

  async function renameRule(p, text) {
    setEditingRule(null);
    const trimmed = text.trim();
    if (!trimmed || trimmed === p.text) return;
    const saved = await send(`/api/today/principles/${p.id}`, "PATCH", { text: trimmed });
    if (saved) setPrinciples((rows) => rows.map((r) => (r.id === p.id ? saved : r)));
  }

  async function removeRule(id) {
    setConfirmingRule(null);
    const previous = principles;
    setPrinciples((rows) => rows.filter((r) => r.id !== id));
    const ok = await send(`/api/today/principles/${id}`, "DELETE");
    if (!ok) setPrinciples(previous);
  }

  const doneCount = (habits || []).filter((h) => h.done).length;
  const allDone = Boolean(habits && habits.length > 0 && doneCount === habits.length);

  // The moment the last tick lands — not on load, not on every render, and
  // only once a day — a clip plays.
  useEffect(() => {
    if (habits === null) return;
    const now = allDone;
    const before = wasAllDone.current;
    wasAllDone.current = now;
    if (now && !before && videos.length > 0 && !rewardedToday(day)) {
      markRewarded(day);
      getJSON("/api/today/rewards/pick").then((d) => d?.video && setReward(d.video));
    }
  }, [allDone, habits, videos.length, day]);

  async function watchAgain() {
    const d = await getJSON("/api/today/rewards/pick");
    if (d?.video) setReward(d.video);
  }

  async function upload(file) {
    if (!file) return;
    setUploading(true);
    setUploadError("");
    const form = new FormData();
    form.append("video", file, file.name);
    form.append("title", file.name.replace(/\.[^.]+$/, ""));
    const res = await authFetch("/api/today/rewards", { method: "POST", body: form });
    setUploading(false);
    if (!res.ok) {
      setUploadError(t("uploadFailed"));
      return;
    }
    setVideos((v) => [...v, await res.json()]);
  }

  async function removeVideo(id) {
    const previous = videos;
    setVideos((v) => v.filter((x) => x.id !== id));
    const ok = await send(`/api/today/rewards/${id}`, "DELETE");
    if (!ok) setVideos(previous);
  }

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
        {allDone && (
          <p className="hint alldone">
            {t("allDone")}
            {videos.length > 0 && (
              <button type="button" className="clear" onClick={watchAgain} style={{ marginLeft: "0.6rem" }}>
                {t("watchAgain")}
              </button>
            )}
          </p>
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

      <div className="panel rulespanel">
        <p className="qnum">{t("principles")}</p>
        {principles === null ? (
          <p className="hint">{t("loading")}</p>
        ) : principles.length === 0 ? (
          <p className="hint">{t("noPrinciples")}</p>
        ) : (
          <ol className="rules">
            {principles.map((p, i) => (
              <li key={p.id}>
                <span className="rulenum">{i + 1}</span>
                {editingRule === p.id ? (
                  <input
                    className="habitedit"
                    defaultValue={p.text}
                    autoFocus
                    onBlur={(e) => renameRule(p, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") renameRule(p, e.target.value);
                      if (e.key === "Escape") setEditingRule(null);
                    }}
                  />
                ) : (
                  <button type="button" className="habittext ruletext" onClick={() => setEditingRule(p.id)}>
                    {p.text}
                  </button>
                )}
                {confirmingRule === p.id ? (
                  <span className="habitactions">
                    <button type="button" className="danger" onClick={() => removeRule(p.id)}>{t("confirmDel")}</button>
                    <button type="button" className="ghost" onClick={() => setConfirmingRule(null)}>{t("cancel")}</button>
                  </span>
                ) : (
                  <button type="button" className="habitdel" aria-label={t("del")} onClick={() => setConfirmingRule(p.id)}>
                    ×
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
        <div className="searchrow addrow">
          <input
            value={ruleDraft}
            onChange={(e) => setRuleDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addRule()}
            placeholder={t("principlePh")}
          />
          <button type="button" className="primary" onClick={addRule} disabled={!ruleDraft.trim()}>
            {t("addHabit")}
          </button>
        </div>
      </div>

      <div className="panel rewardspanel">
        <div className="listhead">
          <p className="qnum">{t("rewards")}</p>
          <button type="button" className="ghost" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? t("uploading") : t("uploadClip")}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            hidden
            onChange={(e) => {
              upload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
        <p className="note">{t("rewardsHint")}</p>
        {uploadError && <p className="qerror">{uploadError}</p>}
        {videos.length === 0 ? (
          <p className="hint">{t("noClips")}</p>
        ) : (
          <ul className="clips">
            {videos.map((v) => (
              <li key={v.id}>
                <button type="button" className="habittext" onClick={() => setReward(v)}>▶ {v.title}</button>
                <button type="button" className="habitdel" aria-label={t("del")} onClick={() => removeVideo(v.id)}>×</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {reward && <Reward video={reward} onClose={() => setReward(null)} />}
    </section>
  );
}
