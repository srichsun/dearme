import { useEffect, useState } from "react";
import { getJSON } from "../api";
import { useLang } from "./i18n";

// GO: "what do you feel like eating out?" One tap on a kind (or on
// "anything") and the list turns into that, nearest first.
export default function GoDialog({ onPick, onClose }) {
  const { t } = useLang();
  const [kinds, setKinds] = useState(null);

  useEffect(() => {
    getJSON("/api/meals/kinds?source=eat_out").then((d) => setKinds(d?.kinds || []));
  }, []);

  function onKey(e) {
    if (e.key === "Escape") onClose();
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
        <h2 className="display">{t("goTitle")}</h2>
        <p className="note">{kinds && kinds.length === 0 ? t("goNoKinds") : t("goHint")}</p>
        {kinds === null ? (
          <p className="hint">{t("loading")}</p>
        ) : (
          <div className="choices">
            <button type="button" className="choice nearest" onClick={() => onPick(null)} autoFocus>
              {t("goNearest")}
            </button>
            {kinds.map((k) => (
              <button type="button" className="choice" key={k.kind} onClick={() => onPick(k.kind)}>
                {k.kind}
                <span className="kindcount">{k.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
