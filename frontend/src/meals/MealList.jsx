import { useEffect, useRef, useState } from "react";
import { authFetch, getJSON, postJSON } from "../api";
import {
  FILTER_FIELDS,
  OPTIONS,
  formatDistance,
  labelOf,
  mapsLink,
  nearParam,
  stars,
  toQuery,
} from "./flow";

const NO_FILTERS = { category: null, source: null, season: null, method: null, kind: null };

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
  // "all": the list. "kinds": the kinds with counts; picking one narrows the
  // list to it and shows the way back.
  const [view, setView] = useState("all");
  const [kinds, setKinds] = useState(null);
  // Where the person is, once they asked for "nearest"; null until then.
  const [pos, setPos] = useState(null);
  const [posNote, setPosNote] = useState("");
  const latest = useRef(0);

  function locate() {
    if (pos) {
      setPos(null);
      setPosNote("");
      return;
    }
    if (!navigator.geolocation) {
      setPosNote("這個瀏覽器沒有定位。");
      return;
    }
    setPosNote("定位中…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setPosNote("");
      },
      () => setPosNote("拿不到位置，檢查瀏覽器的定位權限。"),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  useEffect(() => {
    if (view !== "kinds") return;
    getJSON("/api/meals/kinds").then((d) => setKinds(d?.kinds || []));
  }, [view, refreshKey]);

  // Reload whenever the question changes. The counter drops a slow reply
  // that arrives after a newer one, so the list never shows a stale answer.
  useEffect(() => {
    const id = ++latest.current;
    const timer = setTimeout(async () => {
      const data = await getJSON(`/api/meals${toQuery({ q, ...filters, near: nearParam(pos) })}`);
      if (id === latest.current) setMeals(data?.meals || []);
    }, q ? 250 : 0);
    return () => clearTimeout(timer);
  }, [q, filters, refreshKey, pos]);

  async function ask() {
    const text = sentence.trim();
    if (!text || busy) return;
    setBusy(true);
    const { ok, data } = await postJSON("/api/meals/search", { text, near: nearParam(pos) });
    setBusy(false);
    if (!ok) return;
    // Land the model's reading on the ordinary controls. The list itself is
    // reloaded by the effect above, from the same filters it would use.
    const got = data.filters || {};
    setFallback(Boolean(data.fallback));
    setQ(got.q || "");
    setFilters((f) => ({
      category: got.category || null,
      source: got.source || null,
      season: got.season || null,
      method: got.method || null,
      kind: f.kind,
    }));
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

  function pickKind(kind) {
    setFilters((f) => ({ ...f, kind }));
    setView("all");
  }

  function backToKinds() {
    setFilters((f) => ({ ...f, kind: null }));
    setView("kinds");
  }

  if (view === "kinds") {
    return (
      <section className="screen">
        <div className="viewswitch">
          <button type="button" onClick={() => setView("all")}>全部</button>
          <button type="button" className="on">依類型</button>
        </div>
        {kinds === null ? (
          <p className="hint centred">載入中…</p>
        ) : kinds.length === 0 ? (
          <p className="hint centred">還沒有餐點填類型。新增或編輯時填「什麼類型？」那題。</p>
        ) : (
          <ul className="kindgrid">
            {kinds.map((k) => (
              <li key={k.kind}>
                <button type="button" className="kindtile" onClick={() => pickKind(k.kind)}>
                  <span className="kindname">{k.kind}</span>
                  <span className="kindcount">{k.count}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  return (
    <section className="screen">
      <div className="viewswitch">
        <button type="button" className={filters.kind ? "" : "on"} onClick={() => setFilters((f) => ({ ...f, kind: null }))}>
          全部
        </button>
        <button type="button" className={filters.kind ? "on" : ""} onClick={backToKinds}>
          依類型
        </button>
      </div>
      {filters.kind && (
        <button type="button" className="kindback" onClick={backToKinds}>
          ← 全部類型 · <b>{filters.kind}</b>
        </button>
      )}
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
        <div className="nearrow">
          <button type="button" className={"chip near" + (pos ? " on" : "")} onClick={locate}>
            {pos ? "◉ 離我最近（關）" : "◎ 離我最近"}
          </button>
          {posNote && <span className="hint">{posNote}</span>}
        </div>

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
                  {m.kind && <span className="tag kind">{m.kind}</span>}
                </div>
              </div>
              {m.place && (
                <div className="shop">
                  <b>{m.place.place_name}</b>
                  {m.place.address && <span>{m.place.address}</span>}
                  {m.place.phone && (
                    <a href={`tel:${m.place.phone.replace(/\s/g, "")}`}>{m.place.phone}</a>
                  )}
                  <span className="shopgo">
                    {m.distance_m != null && <em>{formatDistance(m.distance_m)}</em>}
                    {mapsLink(m.place) && (
                      <a href={mapsLink(m.place)} target="_blank" rel="noreferrer">導航 ↗</a>
                    )}
                  </span>
                </div>
              )}
              {m.rating != null && (
                <p className="rating" aria-label={`${m.rating} 星`}>
                  <span className="starrow">{stars(m.rating)}</span>
                  <span className="starnum">{m.rating}/10</span>
                </p>
              )}
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
