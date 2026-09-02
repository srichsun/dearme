import { useEffect, useState } from "react";
import { authFetch, getJSON, postJSON } from "../api";
import { useLang } from "./i18n";

const SECTIONS = [
  ["protein", "secProtein"],
  ["carbs", "secCarbs"],
  ["drinks", "secDrinks"],
  ["snacks", "secSnacks"],
  ["fruit", "secFruit"],
];

async function send(path, method, body) {
  const res = await authFetch(path, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return res.ok ? res.json() : null;
}

// What to buy, in five sections. A tick stays ticked — bought is bought —
// and "clear bought" sweeps the ticked ones away before the next trip.
export default function Shopping() {
  const { t } = useLang();
  const [items, setItems] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    getJSON("/api/shopping").then((d) => setItems(d?.items || []));
  }, []);

  async function add(section) {
    const text = (drafts[section] || "").trim();
    if (!text) return;
    const { ok, data } = await postJSON("/api/shopping", { section, text });
    if (!ok) return;
    setDrafts((d) => ({ ...d, [section]: "" }));
    setItems((rows) => [...rows, data]);
  }

  async function toggle(item) {
    setItems((rows) => rows.map((r) => (r.id === item.id ? { ...r, done: !item.done } : r)));
    const saved = await send(`/api/shopping/${item.id}`, "PATCH", { done: !item.done });
    if (!saved) setItems((rows) => rows.map((r) => (r.id === item.id ? { ...r, done: item.done } : r)));
  }

  async function rename(item, text) {
    setEditing(null);
    const trimmed = text.trim();
    if (!trimmed || trimmed === item.text) return;
    const saved = await send(`/api/shopping/${item.id}`, "PATCH", { text: trimmed });
    if (saved) setItems((rows) => rows.map((r) => (r.id === item.id ? { ...r, text: saved.text } : r)));
  }

  async function remove(id) {
    const previous = items;
    setItems((rows) => rows.filter((r) => r.id !== id));
    const ok = await send(`/api/shopping/${id}`, "DELETE");
    if (!ok) setItems(previous);
  }

  async function clearDone() {
    const previous = items;
    setItems((rows) => rows.filter((r) => !r.done));
    const ok = await send("/api/shopping/clear-done", "POST");
    if (!ok) setItems(previous);
  }

  const anyDone = (items || []).some((i) => i.done);

  return (
    <section className="screen">
      {items === null && <p className="hint centred">{t("loading")}</p>}
      {items && anyDone && (
        <button type="button" className="ghost clearbought" onClick={clearDone}>
          {t("clearDone")}
        </button>
      )}
      {items &&
        SECTIONS.map(([code, label]) => {
          const rows = items.filter((i) => i.section === code);
          return (
            <div className="panel shopsection" key={code}>
              <div className="listhead">
                <p className="qnum">{t(label)}</p>
                {rows.length > 0 && (
                  <span className="starnum">
                    {rows.filter((r) => r.done).length} / {rows.length}
                  </span>
                )}
              </div>
              {rows.length > 0 && (
                <ul className="habits">
                  {rows.map((item) => (
                    <li key={item.id} className={item.done ? "done" : ""}>
                      <button
                        type="button"
                        className="tick"
                        role="checkbox"
                        aria-checked={item.done}
                        aria-label={item.text}
                        onClick={() => toggle(item)}
                      >
                        {item.done ? "✓" : ""}
                      </button>
                      {editing === item.id ? (
                        <input
                          className="habitedit"
                          defaultValue={item.text}
                          autoFocus
                          onBlur={(e) => rename(item, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") rename(item, e.target.value);
                            if (e.key === "Escape") setEditing(null);
                          }}
                        />
                      ) : (
                        <button type="button" className="habittext" onClick={() => setEditing(item.id)}>
                          {item.text}
                        </button>
                      )}
                      <button type="button" className="habitdel" aria-label={t("del")} onClick={() => remove(item.id)}>
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="searchrow addrow">
                <input
                  value={drafts[code] || ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [code]: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && add(code)}
                  placeholder={t("shopPh")}
                />
                <button type="button" className="primary" onClick={() => add(code)} disabled={!(drafts[code] || "").trim()}>
                  {t("addHabit")}
                </button>
              </div>
            </div>
          );
        })}
    </section>
  );
}
