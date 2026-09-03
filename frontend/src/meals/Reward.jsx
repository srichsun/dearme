import { useLang } from "./i18n";

// The clip that plays when the whole list is ticked. Full screen, its own
// controls, one tap to close. Sound needs a tap on iOS, so controls stay.
export default function Reward({ video, onClose, justUnlocked }) {
  const { t } = useLang();
  return (
    <div className="dialog reward" onClick={onClose}>
      <div className={"rewardbox" + (justUnlocked ? " burst" : "")} onClick={(e) => e.stopPropagation()}>
        {justUnlocked && <p className="unlockword">{t("unlocking")}</p>}
        <p className="rewardline">{t("youDidIt")}</p>
        <video src={video.url} autoPlay playsInline controls preload="auto" />
        <div className="qafoot">
          <span className="hint">{video.title}</span>
          <button type="button" className="primary" onClick={onClose} style={{ marginLeft: "auto" }}>
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}
