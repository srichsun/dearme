import { useEffect, useRef, useState } from "react";
import { authFetch, getJSON, postJSON } from "../api";
import { FILTER_FIELDS, OPTIONS, labelOf, toQuery } from "./flow";

const NO_FILTERS = { category: null, source: null, season: null, method: null };

// The first screen: a search box, four rows of filter tags, the meals that
// match. Typing searches as you go; "用問的" sends the sentence to the model,
// which hands back filters that land on the same tags — so what it understood
// is visible, and one tap fixes it.
export default function MealList({ refreshKey, onEdit }) {
  const [meals, setMeals] = useState(null);
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState(NO_FILTERS);
  const [asking, setAsking] = useState(false);
  const [sentence, setSentence] = useState("");
  const [fallback, setFallback] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(null);
  const latest = useRef(0);

  // Reload whenever the question changes. The counter drops a slow reply
  // that arrives after a newer one, so the list never shows a stale answer.
  useEffect(() => {
    const id = ++latest.current;
    const timer = setTimeout(async () => {
      const data = await getJSON(`/api/meals${toQuery({ q, ...filters })}`);
      if (id === latest.current) setMeals(data?.meals || []);
    }, q ? 250 : 0);
    return () => clearTimeout(timer);
  }, [q, filters, refreshKey]);

  async function ask() {
    const text = sentence.trim();
    if (!text || busy) return;
    setBusy(true);
    const { ok, data } = await postJSON("/api/meals/search", { text });
    setBusy(false);
    if (!ok) return;
    // Land the model's reading on the ordinary controls. The list itself is
    // reloaded by the effect above, from the same filters it would use.
    const got = data.filters || {};
    setFallback(Boolean(data.fallback));
    setQ(got.q || "");
    setFilters({
      category: got.category || null,
      source: got.source || null,
      season: got.season || null,
      method: got.method || null,
    });
  }

  function toggle(field, code) {
    setFallback(false);
    setFilters((f) => ({ ...f, [field]: f[field] === code ? null : code }));
  }

  function clearAll() {
    setQ("");
    setSentence("");
    setFallback(false);
    setFilters(NO_FILTERS);
  }

  async function remove(id) {
    setConfirming(null);
    const previous = meals;
    setMeals((rows) => rows.filter((m) => m.id !== id));
    const res = await authFetch(`/api/meals/${id}`, { method: "DELETE" });
    if (!res.ok) setMeals(previous);
  }

  const anything = q || Object.values(filters).some(Boolean);

  return (
    <section className="screen">
      <div className="panel searchpanel">
        <div className="searchrow">
          {asking ? (
            <input
              value={sentence}
              onChange={(e) => setSentence(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask()}
              placeholder="例如：夏天自己煮的點心，用氣炸鍋"
              autoFocus
            />
          ) : (
            <input
              value={q}
              onChange={(e) => {
                setFallback(false);
                setQ(e.target.value);
              }}
              placeholder="找名字、食材、備註…"
            />
          )}
          <button
            type="button"
            className={"ghost askmode" + (asking ? " on" : "")}
            onClick={() => setAsking((a) => !a)}
          >
            {asking ? "打字找" : "用問的"}
          </button>
          {asking && (
            <button type="button" className="primary" onClick={ask} disabled={busy}>
              {busy ? "…" : "問"}
            </button>
          )}
        </div>
        {fallback && <p className="fallback">沒問到 AI，先用關鍵字搜。</p>}

        {FILTER_FIELDS.map((field) => (
          <div className="chips" key={field}>
            {OPTIONS[field].map(([code, label]) => (
              <button
                type="button"
                key={code}
                className={"chip" + (filters[field] === code ? " on" : "")}
                onClick={() => toggle(field, code)}
              >
                {label}
              </button>
            ))}
          </div>
        ))}
        {anything && (
          <button type="button" className="clear" onClick={clearAll}>
            清除條件
          </button>
        )}
      </div>

      {meals === null ? (
        <p className="hint centred">載入中…</p>
      ) : meals.length === 0 ? (
        <p className="hint centred">{anything ? "沒有符合的。" : "還沒有餐點，按右上角新增。"}</p>
      ) : (
        <ul className="meallist">
          {meals.map((m) => (
            <li className="panel mealcard" key={m.id}>
              <div className="mealhead">
                <h3>{m.name}</h3>
                <div className="tags">
                  <span className="tag">{labelOf("category", m.category)}</span>
                  <span className="tag">{labelOf("source", m.source)}</span>
                  <span className="tag">{labelOf("season", m.season)}</span>
                  {m.method && <span className="tag">{labelOf("method", m.method)}</span>}
                </div>
              </div>
              {m.recipe && <p className="recipe">{m.recipe}</p>}
              {m.note && <p className="mealnote">{m.note}</p>}
              <div className="cardactions">
                {confirming === m.id ? (
                  <>
                    <button type="button" className="danger" onClick={() => remove(m.id)}>
                      確定刪除？
                    </button>
                    <button type="button" className="ghost" onClick={() => setConfirming(null)}>
                      取消
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="ghost" onClick={() => onEdit(m)}>
                      編輯
                    </button>
                    <button type="button" className="ghost" onClick={() => setConfirming(m.id)}>
                      刪除
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
