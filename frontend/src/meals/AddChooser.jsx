import { useLang } from "./i18n";

// "+ Add": a dish (the question-by-question dialog) or a restaurant (paste
// a Google Maps link). Keys 1 / 2.
export default function AddChooser({ onPick, onClose }) {
  const { t } = useLang();

  function onKey(e) {
    if (e.key === "Escape") onClose();
    if (e.key === "1") onPick("dish");
    if (e.key === "2") onPick("shop");
  }

  return (
    <div className="dialog" onKeyDown={onKey}>
      <div className="qa go" role="dialog" aria-modal="true">
        <div className="qahead">
          <span className="qnum">+</span>
          <button type="button" className="signout" onClick={onClose}>
            {t("close")}
          </button>
        </div>
        <h2 className="display">{t("addWhat")}</h2>
        <div className="choices">
          <button type="button" className="choice" onClick={() => onPick("dish")} autoFocus>
            <span className="keycap">1</span>
            <span className="gochoice">
              <b>{t("addDish")}</b>
              <small>{t("addDishSub")}</small>
            </span>
          </button>
          <button type="button" className="choice" onClick={() => onPick("shop")}>
            <span className="keycap">2</span>
            <span className="gochoice">
              <b>{t("addShop")}</b>
              <small>{t("addShopSub")}</small>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
