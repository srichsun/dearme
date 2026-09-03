import { useEffect, useRef, useState } from "react";
import { authFetch, getJSON, postJSON } from "../api";
import Reward from "./Reward";
import { useLang } from "./i18n";

async function send(path, method, body) {
  const res = await authFetch(path, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return res.ok ? res.json() : null;
}

export default function Today() {
  const { t } = useLang();
  const [goal, setGoal] = useState("");
  const [editingGoal, setEditingGoal] = useState(false);
  const [focus, setFocus] = useState(null); // {text, done, done_at, created_at} | null
  const [focusDraft, setFocusDraft] = useState("");
  const [editingFocus, setEditingFocus] = useState(false);
  const focusRef = useRef(null);
  const [habits, setHabits] = useState(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(null); // habit id whose text is open
  const [confirming, setConfirming] = useState(null);
  const [principles, setPrinciples] = useState(null);
  const [ruleDraft, setRuleDraft] = useState("");
  const [editingRule, setEditingRule] = useState(null);
  const [confirmingRule, setConfirmingRule] = useState(null);
  const [videos, setVideos] = useState([]);
  const [todays, setTodays] = useState(null); // {video, unlocked, done, total}
  const [reward, setReward] = useState(null);
  const [justUnlocked, setJustUnlocked] = useState(false);
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
      setFocus(d?.focus || null);
      setFocusDraft(d?.focus?.text || "");
      const list = d?.habits || [];
      wasAllDone.current = list.length === 0 || list.every((h) => h.done);
    });
    getJSON("/api/today/rewards").then((d) => setVideos(d?.videos || []));
    getJSON("/api/today/rewards/today").then((d) => d && setTodays(d));
  }, []);

  useEffect(() => {
    if (editingGoal) goalRef.current?.focus();
  }, [editingGoal]);
  useEffect(() => {
    if (editingFocus) focusRef.current?.focus();
  }, [editingFocus]);

  async function saveFocus() {
    setEditingFocus(false);
    if (focusDraft.trim() === (focus?.text || "")) return;
    const saved = await send("/api/today/focus", "PUT", { text: focusDraft });
    if (saved) {
      setFocus(saved.focus);
      setFocusDraft(saved.focus?.text || "");
    }
  }

  async function toggleFocus() {
    if (!focus) return;
    const saved = await send("/api/today/focus/done", focus.done ? "DELETE" : "POST");
    if (saved) setFocus(saved.focus);
  }

  const clock = (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "");

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

  // The moment the last tick lands, today's clip is earned: the server
  // checks the list itself and hands the URL back. Not on load, and never
  // twice — once earned, the card just says so.
  useEffect(() => {
    if (habits === null) return;
    const now = allDone;
    const before = wasAllDone.current;
    wasAllDone.current = now;
    if (now && !before && todays?.video && !todays.unlocked) unlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone, habits]);

  // Keep the card's counter in step with the ticks.
  useEffect(() => {
    if (habits === null) return;
    setTodays((s) => (s ? { ...s, done: doneCount, total: habits.length } : s));
  }, [doneCount, habits]);

  async function unlock() {
    const earned = await send("/api/today/rewards/unlock", "POST");
    if (!earned) return;
    setTodays((s) => ({ ...(s || {}), video: earned, unlocked: true }));
    setVideos((v) => v.map((x) => (x.id === earned.id ? { ...x, url: earned.url, unlocked_on: x.unlocked_on || "today" } : x)));
    setJustUnlocked(true);
    setReward(earned);
  }

  function play(video) {
    setJustUnlocked(false);
    setReward(video);
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
    const made = await res.json();
    setVideos((v) => [...v, made]);
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

      <div className={"panel focuspanel" + (focus?.done ? " done" : focus ? " set" : "")}>
        <p className="qnum">{t("focus")}</p>
        {editingFocus ? (
          <textarea
            ref={focusRef}
            className="focusedit"
            rows={2}
            value={focusDraft}
            onChange={(e) => setFocusDraft(e.target.value)}
            onBlur={saveFocus}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                saveFocus();
              }
              if (e.key === "Escape") {
                setFocusDraft(focus?.text || "");
                setEditingFocus(false);
              }
            }}
            placeholder={t("focusPh")}
          />
        ) : (
          <button type="button" className={"focustext" + (focus ? "" : " empty")} onClick={() => setEditingFocus(true)}>
            {focus?.text || t("focusPh")}
          </button>
        )}
        {focus && !editingFocus && (
          <div className="focusfoot">
            <button type="button" className={"focustick" + (focus.done ? " on" : "")} onClick={toggleFocus}>
              {focus.done ? "✓ " + t("focusDone") : t("focusDone") + "？"}
            </button>
            <span className="hint">
              {focus.done
                ? `${t("focusDoneAt")} ${clock(focus.done_at)}`
                : `${t("focusDecidedAt")} ${clock(focus.created_at)}`}
            </span>
          </div>
        )}
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
        {allDone && <p className="hint alldone">{t("allDone")}</p>}
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

      <div className={"panel todaysclip" + (todays?.unlocked ? " open" : "")}>
        <div className="listhead">
          <p className="qnum">{t("todaysClip")}</p>
          {todays?.video && !todays.unlocked && todays.total > 0 && (
            <span className="starnum">
              {t("lockedProgress").replace("{done}", todays.done).replace("{total}", todays.total)}
            </span>
          )}
        </div>
        {!todays || !todays.video ? (
          <p className="hint">{t("noClipsToday")}</p>
        ) : todays.unlocked ? (
          <button type="button" className="clipcard open" onClick={() => play(todays.video)}>
            <span className="clipicon">▶</span>
            <span className="cliptext">
              <b>{todays.video.title}</b>
              <small>{t("unlockedTitle")}</small>
            </span>
          </button>
        ) : (
          <div className="clipcard locked" aria-label={t("locked")}>
            <span className="clipicon">🔒</span>
            <span className="cliptext">
              <b>? ? ?</b>
              <small>{todays.total === 0 ? t("lockedNoList") : t("lockedProgress").replace("{done}", todays.done).replace("{total}", todays.total)}</small>
            </span>
            <span className="clipbar"><i style={{ width: `${todays.total ? (100 * todays.done) / todays.total : 0}%` }} /></span>
          </div>
        )}
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
              <li key={v.id} className={v.url ? "" : "locked"}>
                {v.url ? (
                  <button type="button" className="habittext" onClick={() => play(v)}>
                    ▶ {v.title}
                    {v.unlocked_on && v.unlocked_on !== "today" && (
                      <small className="clipdate"> · {t("unlockedOn")} {v.unlocked_on.slice(5)}</small>
                    )}
                  </button>
                ) : (
                  <span className="habittext lockedtext">🔒 {v.title}</span>
                )}
                <button type="button" className="habitdel" aria-label={t("del")} onClick={() => removeVideo(v.id)}>×</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {reward && <Reward video={reward} justUnlocked={justUnlocked} onClose={() => setReward(null)} />}
    </section>
  );
}
