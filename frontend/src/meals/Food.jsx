import { useEffect, useRef, useState } from "react";
import { authFetch, getJSON, postJSON } from "../api";
import { MicIcon, StopIcon } from "../icons";
import { transcribe, useRecorder } from "../speech";
import FoodReport from "./FoodReport";
import { NUTRIENTS, cleanItems, dropItem, editItem, progress, scale, shrinkImage, sumItems } from "./foodmath";
import { appendSpoken } from "./flow";
import { useLang } from "./i18n";

async function send(path, method, body) {
  const res = await authFetch(path, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return res.ok ? res.json() : null;
}

const SOURCE_KEY = { tfnd: "fromTable", model: "fromModel", label: "fromLabel", brand: "fromBrand", saved: "fromSaved" };

// The food log. Say it, type it, or shoot it; the numbers come back in a
// few seconds, get nudged if they look off, and land on the day's bars.
export default function Food() {
  const { t } = useLang();
  const [day, setDay] = useState(null); // {day, logs, totals, targets}
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState(null); // {file, kind, preview}
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const [est, setEst] = useState(null); // the preview waiting to be saved
  const [editingTargets, setEditingTargets] = useState(false);
  const [targetDraft, setTargetDraft] = useState(null);
  const [view, setView] = useState("day"); // "day" | "report"
  const [confirming, setConfirming] = useState(null);
  const [myFoods, setMyFoods] = useState(null); // null = closed
  const mealPhotoRef = useRef(null);
  const labelPhotoRef = useRef(null);

  async function load() {
    const d = await getJSON("/api/food");
    if (d) setDay(d);
  }
  useEffect(() => {
    load();
  }, []);

  const recorder = useRecorder(async (blob) => {
    setListening(true);
    try {
      const heard = await transcribe(blob);
      setText((prev) => appendSpoken(prev, heard));
    } catch {
      /* the box is still there */
    } finally {
      setListening(false);
    }
  });

  async function pickPhoto(file, kind) {
    if (!file) return;
    const small = await shrinkImage(file);
    setPhoto({ file: small, kind, preview: URL.createObjectURL(small) });
  }

  async function estimate() {
    if (busy || (!text.trim() && !photo)) return;
    setBusy(true);
    setError("");
    const form = new FormData();
    form.append("text", text.trim());
    form.append("kind", photo?.kind || "meal");
    if (photo) form.append("photo", photo.file, "photo.jpg");
    const res = await authFetch("/api/food/estimate", { method: "POST", body: form });
    setBusy(false);
    if (!res.ok) {
      setError(t("estimateFailed"));
      return;
    }
    setEst(await res.json());
  }

  async function save() {
    if (!est || busy) return;
    setBusy(true);
    const items = cleanItems(est.items);
    const { ok } = await postJSON("/api/food", {
      text: text.trim() || items.map((i) => i.name).join("、") || "—",
      ...sumItems(items),
      kind: est.kind || "meal",
      source: est.source,
      items,
      photo_url: est.photo_url || null,
    });
    setBusy(false);
    if (!ok) {
      setError(t("saveFailed"));
      return;
    }
    setEst(null);
    setText("");
    setPhoto(null);
    load();
  }

  async function remove(id) {
    setConfirming(null);
    const ok = await send(`/api/food/${id}`, "DELETE");
    if (ok) load();
  }

  async function saveTargets() {
    const saved = await send("/api/food/targets", "PUT", targetDraft);
    if (saved) {
      setDay((d) => ({ ...d, targets: saved }));
      setEditingTargets(false);
    }
  }

  async function openMyFoods() {
    const d = await getJSON("/api/food/items");
    setMyFoods(d?.items || []);
  }

  async function forgetFood(id) {
    const ok = await send(`/api/food/items/${id}`, "DELETE");
    if (ok) setMyFoods((f) => f.filter((x) => x.id !== id));
  }

  if (view === "report") return <FoodReport onBack={() => setView("day")} />;

  return (
    <section className="screen">
      {/* the day's bars */}
      <div className="panel">
        <div className="listhead">
          <p className="qnum">{t("foodToday")}</p>
          <span className="rowbtns">
            <button type="button" className="clear" onClick={() => setView("report")}>{t("report")}</button>
            <button type="button" className="clear" onClick={() => (myFoods ? setMyFoods(null) : openMyFoods())}>{t("myFoods")}</button>
            <button
              type="button"
              className="clear"
              onClick={() => {
                setTargetDraft(day?.targets || {});
                setEditingTargets((e) => !e);
              }}
            >
              {t("targets")}
            </button>
          </span>
        </div>
        {day && !editingTargets && (
          <div className="bars">
            {NUTRIENTS.map((n) => {
              const { pct, remaining } = progress(day.totals[n], day.targets[n]);
              return (
                <div className={"bar " + n} key={n}>
                  <div className="barhead">
                    <span>{t(n)}</span>
                    <b>
                      {Math.round(day.totals[n])}
                      <small> / {day.targets[n]}{n === "kcal" ? "" : " g"}</small>
                    </b>
                  </div>
                  <span className="track"><i style={{ width: `${pct * 100}%` }} /></span>
                  <small className={"remain" + (remaining < 0 ? " over" : "")}>
                    {remaining < 0 ? `${t("over")} ${-remaining}` : `${t("left")} ${remaining}`}
                  </small>
                </div>
              );
            })}
          </div>
        )}
        {editingTargets && targetDraft && (
          <div className="targets">
            {NUTRIENTS.map((n) => (
              <label key={n}>
                <span>{t(n)}{n === "kcal" ? "" : " (g)"}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={targetDraft[n] ?? ""}
                  onChange={(e) => setTargetDraft((d) => ({ ...d, [n]: Number(e.target.value) }))}
                />
              </label>
            ))}
            <button type="button" className="primary" onClick={saveTargets}>{t("saveTargets")}</button>
          </div>
        )}
      </div>

      {/* input */}
      <div className="panel">
        <div className="writer">
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("foodPh")} />
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
        <div className="photorow">
          <button type="button" className="ghost" onClick={() => mealPhotoRef.current?.click()}>📷 {t("photoMeal")}</button>
          <button type="button" className="ghost" onClick={() => labelPhotoRef.current?.click()}>🏷 {t("photoLabel")}</button>
          {/* No `capture`: with it iOS opens the camera only; without it the
              sheet offers camera, photo library, or a file. */}
          <input ref={mealPhotoRef} type="file" accept="image/*" hidden onChange={(e) => { pickPhoto(e.target.files?.[0], "meal"); e.target.value = ""; }} />
          <input ref={labelPhotoRef} type="file" accept="image/*" hidden onChange={(e) => { pickPhoto(e.target.files?.[0], "label"); e.target.value = ""; }} />
          {photo && (
            <span className="photopick">
              <img src={photo.preview} alt="" />
              <button type="button" className="habitdel" onClick={() => setPhoto(null)}>×</button>
            </span>
          )}
          <button type="button" className="primary" onClick={estimate} disabled={busy || (!text.trim() && !photo)} style={{ marginLeft: "auto" }}>
            {busy && !est ? t("estimating") : t("estimate")}
          </button>
        </div>
        <p className="hint" style={{ margin: "0.4rem 0 0" }}>{t("photoHint")}</p>
        {error && <p className="qerror">{error}</p>}

        {est && (
          <div className="estimate">
            <div className="esttotals">
              {NUTRIENTS.map((n) => (
                <div key={n} className="estnum">
                  <span>{t(n)}</span>
                  <b>{est.totals[n]}</b>
                </div>
              ))}
            </div>
            <ul className="estitems editable">
              {est.items.map((i, idx) => (
                <li key={idx}>
                  <div className="itemhead">
                    <span className="itemname">{i.name} <small>{i.grams} g</small></span>
                    <em className={"src " + i.source}>{t(SOURCE_KEY[i.source] || "fromModel")}</em>
                    <button type="button" className="habitdel" aria-label={t("del")} onClick={() => setEst((e) => dropItem(e, idx))}>×</button>
                  </div>
                  <div className="itemnums">
                    {NUTRIENTS.map((n) => (
                      <label key={n}>
                        <span>{n === "kcal" ? "kcal" : n[0].toUpperCase()}</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={i[n]}
                          onChange={(e) => setEst((est0) => editItem(est0, idx, n, e.target.value))}
                        />
                      </label>
                    ))}
                  </div>
                  {i.matched && i.source !== "tfnd" && i.source !== "saved" && <small className="matchnote">{i.matched}</small>}
                </li>
              ))}
            </ul>
            {est.note && <p className="hint">{est.note}</p>}
            <div className="qafoot">
              <button type="button" className="ghost" onClick={() => setEst((e) => scale(e, 0.75))}>{t("less")}</button>
              <button type="button" className="ghost" onClick={() => setEst((e) => scale(e, 1.5))}>{t("more")}</button>
              <button type="button" className="ghost" onClick={() => setEst(null)}>{t("discard")}</button>
              <button type="button" className="primary" onClick={save} disabled={busy} style={{ marginLeft: "auto" }}>
                {busy ? t("saving") : t("saveLog")}
              </button>
            </div>
          </div>
        )}
      </div>

      {myFoods && (
        <div className="panel">
          <p className="qnum">{t("myFoods")}</p>
          <p className="note">{t("myFoodsHint")}</p>
          {myFoods.length === 0 ? (
            <p className="hint">{t("noFoods")}</p>
          ) : (
            <ul className="clips">
              {myFoods.map((f) => (
                <li key={f.id}>
                  <span className="habittext" style={{ display: "grid" }}>
                    <span>{f.name} <em className={"src " + f.source}>{t(SOURCE_KEY[f.source] || "fromModel")}</em></span>
                    <small className="foodmacros">{t("per100")}: {Math.round(f.kcal)} kcal · P {Math.round(f.protein)} · C {Math.round(f.carbs)} · F {Math.round(f.fat)} · {f.serving_g} g</small>
                  </span>
                  <button type="button" className="habitdel" aria-label={t("del")} onClick={() => forgetFood(f.id)}>×</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* the day's entries */}
      {day && day.logs.length === 0 ? (
        <p className="hint centred">{t("nothingToday")}</p>
      ) : (
        <ul className="meallist">
          {(day?.logs || []).map((l) => (
            <li className="panel foodlog" key={l.id}>
              <div className="foodhead">
                <span className="starnum">{new Date(l.eaten_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                <b>{Math.round(l.kcal)}</b> <small>kcal</small>
                <em className={"src " + l.source}>{t(SOURCE_KEY[l.source] || "fromModel")}</em>
              </div>
              <p className="foodtext">{l.text}</p>
              <p className="foodmacros">P {Math.round(l.protein)} · C {Math.round(l.carbs)} · F {Math.round(l.fat)}</p>
              {l.photo_url && <img className="foodphoto" src={l.photo_url} alt="" loading="lazy" />}
              <div className="cardactions">
                {confirming === l.id ? (
                  <>
                    <button type="button" className="danger" onClick={() => remove(l.id)}>{t("confirmDel")}</button>
                    <button type="button" className="ghost" onClick={() => setConfirming(null)}>{t("cancel")}</button>
                  </>
                ) : (
                  <button type="button" className="ghost" onClick={() => setConfirming(l.id)}>{t("del")}</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
