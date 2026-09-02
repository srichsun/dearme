import { useEffect, useRef, useState } from "react";
import { authFetch, getJSON, postJSON } from "../api";
import {
  FILTER_FIELDS,
  OPTIONS,
  dollars,
  formatDistance,
  goFilters,
  labelOf,
  mapsLink,
  nearParam,
  stars,
  toQuery,
} from "./flow";
import { useLang } from "./i18n";

const NO_FILTERS = { category: null, source: null, season: null, method: null, protein: null, price: null, kind: null };

// The first screen: a search box, four rows of filter tags, the meals that
// match. Typing searches as you go; "用問的" sends the sentence to the model,
// which hands back filters that land on the same tags — so what it understood
// is visible, and one tap fixes it.
// `source` fixes the tab: eating out or cooking. Methods only matter for
// cooking; GO and "nearest" only for eating out.
export default function MealList({ refreshKey, onEdit, goRequest, source, showMethods, showNearest }) {
  const { lang, t } = useLang();
  const fields = FILTER_FIELDS.filter((f) => f !== "source" && (showMethods || f !== "method"));
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

  function locate(force = false) {
    if (pos && !force) {
      setPos(null);
      setPosNote("");
      return;
    }
    if (!navigator.geolocation) {
      setPosNote(t("noGeo"));
      return;
    }
    setPosNote(t("locating"));
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setPosNote("");
      },
      () => setPosNote(t("geoDenied")),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  // GO lands on the ordinary controls, so every tag and the "nearest" toggle
  // show what was asked and can be undone. By distance: eating out, locate.
  // By kind: eating out, that kind; distance only if they press nearest.
  useEffect(() => {
    if (!goRequest) return;
    setView("all");
    setAsking(false);
    setQ("");
    setFallback(false);
    setFilters(goFilters(goRequest.kind));
    if (goRequest.mode === "distance") locate(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goRequest?.seq]);

  useEffect(() => {
    if (view !== "kinds") return;
    getJSON("/api/meals/kinds").then((d) => setKinds(d?.kinds || []));
  }, [view, refreshKey]);

  // Reload whenever the question changes. The counter drops a slow reply
  // that arrives after a newer one, so the list never shows a stale answer.
  useEffect(() => {
    const id = ++latest.current;
    const timer = setTimeout(async () => {
      const data = await getJSON(`/api/meals${toQuery({ q, ...filters, source, near: nearParam(pos) })}`);
      if (id === latest.current) setMeals(data?.meals || []);
    }, q ? 250 : 0);
    return () => clearTimeout(timer);
  }, [q, filters, refreshKey, pos, source]);

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
      source: null,
      season: got.season || null,
      method: got.method || null,
      protein: got.protein || null,
      price: got.price ? String(got.price) : null,
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
          <button type="button" onClick={() => setView("all")}>{t("viewAll")}</button>
          <button type="button" className="on">{t("viewKinds")}</button>
        </div>
        {kinds === null ? (
          <p className="hint centred">{t("loading")}</p>
        ) : kinds.length === 0 ? (
          <p className="hint centred">{t("noKinds")}</p>
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
      {source === "eat_out" && (
        <div className="viewswitch">
          <button type="button" className={filters.kind ? "" : "on"} onClick={() => setFilters((f) => ({ ...f, kind: null }))}>
            {t("viewAll")}
          </button>
          <button type="button" className={filters.kind ? "on" : ""} onClick={backToKinds}>
            {t("viewKinds")}
          </button>
        </div>
      )}
      {filters.kind && (
        <button type="button" className="kindback" onClick={backToKinds}>
          {t("allKinds")} · <b>{filters.kind}</b>
        </button>
      )}
      <div className="panel searchpanel">
        <div className="searchrow">
          {asking ? (
            <input
              value={sentence}
              onChange={(e) => setSentence(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask()}
              placeholder={t("askPh")}
              autoFocus
            />
          ) : (
            <input
              value={q}
              onChange={(e) => {
                setFallback(false);
                setQ(e.target.value);
              }}
              placeholder={t("searchPh")}
            />
          )}
          <button
            type="button"
            className={"ghost askmode" + (asking ? " on" : "")}
            onClick={() => setAsking((a) => !a)}
          >
            {asking ? t("typeMode") : t("askMode")}
          </button>
          {asking && (
            <button type="button" className="primary" onClick={ask} disabled={busy}>
              {busy ? "…" : t("ask")}
            </button>
          )}
        </div>
        {fallback && <p className="fallback">{t("fallback")}</p>}
        {showNearest && (
          <div className="nearrow">
            <button type="button" className={"chip near" + (pos ? " on" : "")} onClick={() => locate()}>
              {pos ? t("nearOn") : t("nearOff")}
            </button>
            {posNote && <span className="hint">{posNote}</span>}
          </div>
        )}

        {fields.map((field) => (
          <div className="chips" key={field}>
            {OPTIONS[field].map(([code, label]) => (
              <button
                type="button"
                key={code}
                className={"chip" + (filters[field] === code ? " on" : "")}
                onClick={() => toggle(field, code)}
              >
                {label[lang] ?? label.zh}
              </button>
            ))}
          </div>
        ))}
        {anything && (
          <button type="button" className="clear" onClick={clearAll}>
            {t("clear")}
          </button>
        )}
      </div>

      {meals === null ? (
        <p className="hint centred">{t("loading")}</p>
      ) : meals.length === 0 ? (
        <p className="hint centred">{anything ? t("noMatch") : source === "home_cooked" ? t("noRecipes") : t("empty")}</p>
      ) : (
        <ul className="meallist">
          {meals.map((m) => (
            <li className="panel mealcard" key={m.id}>
              <div className="mealhead">
                <h3>
                  {m.name}
                  {source === "eat_out" && m.price && <span className="pricebig">{dollars(m.price)}</span>}
                </h3>
                <div className="tags">
                  {(m.categories || []).map((c) => (
                    <span className="tag" key={c}>{labelOf("category", c, lang)}</span>
                  ))}
                  <span className="tag">{labelOf("season", m.season, lang)}</span>
                  {showMethods && m.method && <span className="tag">{labelOf("method", m.method, lang)}</span>}
                  {source !== "eat_out" && m.price && <span className="tag price">{dollars(m.price)}</span>}
                  {(m.proteins || []).map((p) => (
                    <span className="tag protein" key={p}>{labelOf("protein", p, lang)}</span>
                  ))}
                  {source === "eat_out" && m.kind && <span className="tag kind">{m.kind}</span>}
                </div>
              </div>
              {m.place && (
                <div className="shop">
                  {m.place.place_name !== m.name && <b>{m.place.place_name}</b>}
                  {m.place.phone && (
                    <a href={`tel:${m.place.phone.replace(/\s/g, "")}`}>{m.place.phone}</a>
                  )}
                  <span className="shopgo">
                    {m.distance_m != null && <em>{formatDistance(m.distance_m)}</em>}
                    {mapsLink(m.place) && (
                      <a href={mapsLink(m.place)} target="_blank" rel="noreferrer">{t("navigate")}</a>
                    )}
                  </span>
                </div>
              )}
              {source !== "eat_out" && m.rating != null && (
                <p className="rating" aria-label={`${m.rating} ${t("star")}`}>
                  <span className="starrow">{stars(m.rating)}</span>
                  <span className="starnum">{m.rating}/10</span>
                </p>
              )}
              {m.recipe && <p className="recipe">{m.recipe}</p>}
              {m.video_url && (
                <a className="watch" href={m.video_url} target="_blank" rel="noreferrer">
                  {t("watch")}
                </a>
              )}
              {m.note && <p className="mealnote">{m.note}</p>}
              <div className="cardactions">
                {confirming === m.id ? (
                  <>
                    <button type="button" className="danger" onClick={() => remove(m.id)}>
                      {t("confirmDel")}
                    </button>
                    <button type="button" className="ghost" onClick={() => setConfirming(null)}>
                      {t("cancel")}
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="ghost" onClick={() => onEdit(m)}>
                      {t("edit")}
                    </button>
                    <button type="button" className="ghost" onClick={() => setConfirming(m.id)}>
                      {t("del")}
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
