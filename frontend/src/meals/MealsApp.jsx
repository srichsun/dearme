import { useEffect, useState } from "react";
import "../App.css";
import "./meals.css";
import { onAuthChange, signInWithGoogle, signOutUser } from "../firebase";
import { useTheme } from "../theme";
import { LangProvider, useLangState } from "./i18n";
import AddChooser from "./AddChooser";
import GoDialog from "./GoDialog";
import ShopFromLink from "./ShopFromLink";
import MealList from "./MealList";
import Notes from "./Notes";
import Shopping from "./Shopping";
import Today from "./Today";
import QuickAdd from "./QuickAdd";

// The "what can I eat" list, at /meals. Same sign-in as the journal, its own
// screens; nothing here links back to Dear Me and nothing there links here.
export default function MealsApp() {
  useTheme(); // keeps <html> consistent with the journal's setting
  const langState = useLangState();
  const { lang, t, toggle } = langState;
  // The page ground is on <body>, outside this tree; the class paints it dark.
  useEffect(() => {
    document.body.classList.add("meals-body");
    return () => document.body.classList.remove("meals-body");
  }, []);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [screen, setScreen] = useState("today");
  const [editing, setEditing] = useState(null); // null | "new" | a meal
  const [adding, setAdding] = useState(null); // null | "choose" | "shop"
  const [going, setGoing] = useState(false);
  // What GO chose, with a counter so choosing the same kind twice still fires.
  const [goRequest, setGoRequest] = useState(null);
  // Bumped after a meal is added or edited, so the list reloads.
  const [version, setVersion] = useState(0);

  useEffect(
    () =>
      onAuthChange((u) => {
        setUser(u);
        setAuthReady(true);
      }),
    [],
  );

  if (!authReady) return null;
  if (!user) {
    return (
      <div className="app meals">
        <main className="signin">
          <button className="signout langtoggle" onClick={toggle}>
            {lang === "zh" ? "EN" : "中"}
          </button>
          <h1 className="display">{t("title")}</h1>
          <p className="note">{t("lede")}</p>
          <button className="primary" onClick={() => signInWithGoogle()}>
            {t("signin")}
          </button>
        </main>
      </div>
    );
  }

  return (
    <LangProvider value={langState}>
    <div className="app meals">
      <header className="head">
        <h1>{t("title")}</h1>
        <button className="signout" onClick={toggle} aria-label="Language">
          {lang === "zh" ? "EN" : "中"}
        </button>
        <button className="signout" onClick={() => signOutUser()}>
          {t("signout")}
        </button>
      </header>
      <nav className="switch">
        <button className={screen === "today" ? "on" : ""} onClick={() => setScreen("today")}>
          {t("tabToday")}
        </button>
        <button className={screen === "meals" ? "on" : ""} onClick={() => setScreen("meals")}>
          {t("tabMeals")}
        </button>
        <button className={screen === "notes" ? "on" : ""} onClick={() => setScreen("notes")}>
          {t("tabNotes")}
        </button>
        <button className={screen === "shop" ? "on" : ""} onClick={() => setScreen("shop")}>
          {t("tabShop")}
        </button>
      </nav>
      {/* Below the tabs, not in the header, so switching tabs never moves
          the header around. */}
      {screen === "meals" && (
        <div className="toolbar">
          <button className="go" onClick={() => setGoing(true)} disabled={going || editing !== null}>
            {t("go")}
          </button>
          <button
            className="add"
            onClick={() => setAdding("choose")}
            disabled={editing !== null || adding !== null}
          >
            {t("add")}
          </button>
        </div>
      )}
      <main>
        {screen === "today" && <Today />}
        {screen === "meals" && (
          <MealList refreshKey={version} onEdit={setEditing} goRequest={goRequest} />
        )}
        {screen === "notes" && <Notes />}
        {screen === "shop" && <Shopping />}
      </main>
      {adding === "choose" && (
        <AddChooser
          onClose={() => setAdding(null)}
          onPick={(what) => {
            setAdding(what === "shop" ? "shop" : null);
            if (what === "dish") setEditing("new");
          }}
        />
      )}
      {adding === "shop" && (
        <ShopFromLink
          onClose={() => setAdding(null)}
          onSaved={() => {
            setAdding(null);
            setScreen("meals");
            setVersion((v) => v + 1);
          }}
        />
      )}
      {going && (
        <GoDialog
          onClose={() => setGoing(false)}
          onPick={({ mode, kind }) => {
            setGoing(false);
            setScreen("meals");
            setGoRequest((g) => ({ mode, kind, seq: (g?.seq || 0) + 1 }));
          }}
        />
      )}
      {editing && (
        <QuickAdd
          meal={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setVersion((v) => v + 1);
          }}
        />
      )}
    </div>
    </LangProvider>
  );
}
