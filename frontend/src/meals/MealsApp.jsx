import { useEffect, useState } from "react";
import "../App.css";
import "./meals.css";
import { onAuthChange, signInWithGoogle, signOutUser } from "../firebase";
import { useTheme } from "../theme";
import MealList from "./MealList";
import QuickAdd from "./QuickAdd";

// The "what can I eat" list, at /meals. Same sign-in as the journal, its own
// screens; nothing here links back to Dear Me and nothing there links here.
export default function MealsApp() {
  useTheme(); // stamps data-theme on <html> so the palette follows the phone
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [screen, setScreen] = useState("meals");
  const [editing, setEditing] = useState(null); // null | "new" | a meal
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
          <h1 className="display">吃什麼</h1>
          <p className="note">減脂期可以吃的東西，都記在這裡。</p>
          <button className="primary" onClick={() => signInWithGoogle()}>
            用 Google 登入
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="app meals">
      <header className="head">
        <h1>吃什麼</h1>
        {screen === "meals" && (
          <button
            className="add"
            onClick={() => setEditing("new")}
            disabled={editing !== null}
          >
            ＋ 新增
          </button>
        )}
        <button className="signout" onClick={() => signOutUser()}>
          登出
        </button>
      </header>
      <nav className="switch">
        <button className={screen === "meals" ? "on" : ""} onClick={() => setScreen("meals")}>
          餐點
        </button>
        <button className={screen === "notes" ? "on" : ""} onClick={() => setScreen("notes")}>
          心得
        </button>
      </nav>
      <main>
        {screen === "meals" ? (
          <MealList refreshKey={version} onEdit={setEditing} />
        ) : (
          <p className="hint centred">心得下一步做。</p>
        )}
      </main>
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
  );
}
