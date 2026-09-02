import { useState } from "react";
import { postJSON } from "../api";
import { useLang } from "./i18n";

// A restaurant from a Google Maps share link: paste, fetch, look, add.
// It becomes an eat-out meal named after the shop; everything is editable
// afterwards in the ordinary dialog.
export default function ShopFromLink({ onSaved, onClose }) {
  const { t } = useLang();
  const [url, setUrl] = useState("");
  const [shop, setShop] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function fetchShop() {
    const link = url.trim();
    if (!link || busy) return;
    setBusy(true);
    setError("");
    setShop(null);
    const { ok, data } = await postJSON("/api/meals/resolve-link", { url: link });
    setBusy(false);
    if (!ok) {
      setError(t("linkFailed"));
      return;
    }
    setShop(data);
  }

  async function add() {
    if (!shop || busy) return;
    setBusy(true);
    const { kind_hint: kind, price_hint: price, ...place } = shop;
    const { ok, data } = await postJSON("/api/meals", {
      name: shop.place_name,
      category: "meal",
      source: "eat_out",
      season: "all",
      kind: kind || null,
      price: price || null,
      ...place,
    });
    setBusy(false);
    if (!ok) {
      setError(t("saveFailed"));
      return;
    }
    onSaved(data);
  }

  function onKey(e) {
    if (e.key === "Escape") onClose();
    if (e.key === "Enter") {
      e.preventDefault();
      if (shop) add();
      else fetchShop();
    }
  }

  return (
    <div className="dialog" onKeyDown={onKey}>
      <div className="qa" role="dialog" aria-modal="true">
        <div className="qahead">
          <span className="qnum">{t("addShop")}</span>
          <button type="button" className="signout" onClick={onClose}>
            {t("close")}
          </button>
        </div>
        <h2 className="display">{t("linkTitle")}</h2>
        <p className="note">{t("linkHint")}</p>
        <div className="searchrow">
          <input
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t("linkPh")}
            autoFocus
          />
          <button type="button" className="primary" onClick={fetchShop} disabled={busy || !url.trim()}>
            {busy && !shop ? t("fetching") : t("fetch")}
          </button>
        </div>
        {error && <p className="qerror">{error}</p>}
        {shop && (
          <div className="picked">
            <b>{shop.place_name}</b>
            {shop.kind_hint && <span className="tag kind">{shop.kind_hint}</span>}
            {shop.price_hint && <span className="tag price">{"$".repeat(shop.price_hint)}</span>}
            {shop.address && <span>{shop.address}</span>}
            {shop.phone && <span>{shop.phone}</span>}
            {shop.lat != null && <small className="hint">{shop.lat.toFixed(4)}, {shop.lng.toFixed(4)}</small>}
          </div>
        )}
        {shop && (
          <>
            <p className="hint">{t("addedAs")}</p>
            <div className="qafoot">
              <button type="button" className="primary" onClick={add} disabled={busy}>
                {busy ? t("saving") : t("addThis")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
