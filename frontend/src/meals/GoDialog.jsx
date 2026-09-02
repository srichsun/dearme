import { useEffect, useState } from "react";
import { getJSON } from "../api";
import { useLang } from "./i18n";

// GO: first "by distance or by kind?" (keys 1 / 2), then — for kind — which
// one. The pick goes back to the list as {mode, kind}.
export default function GoDialog({ onPick, onClose }) {
  const { t } = useLang();
  const [mode, setMode] = useState(null); // null | "kind"
  const [kinds, setKinds] = useState(null);

  useEffect(() => {
    if (mode !== "kind" || kinds !== null) return;
    getJSON("/api/meals/kinds?source=eat_out").then((d) => setKinds(d?.kinds || []));
  }, [mode, kinds]);

  function onKey(e) {
    if (e.key === "Escape") return mode ? setMode(null) : onClose();
    if (mode === null && e.key === "1") onPick({ mode: "distance", kind: null });
    if (mode === null && e.key === "2") setMode("kind");
  }

  return (
    <div className="dialog" onKeyDown={onKey}>
      <div className="qa go" role="dialog" aria-modal="true">
        <div className="qahead">
          <span className="qnum">GO</span>
          <button type="button" className="signout" onClick={onClose}>
            {t("close")}
          </button>
        </div>

        {mode === null ? (
          <>
            <h2 className="display">{t("goTitle")}</h2>
            <p className="note">{t("goHint")}</p>
            <div className="choices">
              <button
                type="button"
                className="choice nearest"
                onClick={() => onPick({ mode: "distance", kind: null })}
                autoFocus
              >
                <span className="keycap">1</span>
                <span className="gochoice">
                  <b>{t("goByDistance")}</b>
                  <small>{t("goByDistanceSub")}</small>
                </span>
              </button>
              <button type="button" className="choice" onClick={() => setMode("kind")}>
                <span className="keycap">2</span>
                <span className="gochoice">
                  <b>{t("goByKind")}</b>
                  <small>{t("goByKindSub")}</small>
                </span>
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="display">{t("goKindTitle")}</h2>
            {kinds === null ? (
              <p className="hint">{t("loading")}</p>
            ) : kinds.length === 0 ? (
              <p className="note">{t("goNoKinds")}</p>
            ) : (
              <div className="choices">
                {kinds.map((k, i) => (
                  <button
                    type="button"
                    className="choice"
                    key={k.kind}
                    onClick={() => onPick({ mode: "kind", kind: k.kind })}
                    autoFocus={i === 0}
                  >
                    {k.kind}
                    <span className="kindcount">{k.count}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="qafoot">
              <button type="button" className="ghost" onClick={() => setMode(null)}>
                {t("prev")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
