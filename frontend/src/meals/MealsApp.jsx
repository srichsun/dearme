import { useEffect, useState } from "react";
import "../App.css";
import "./meals.css";
import { onAuthChange, signInWithGoogle, signOutUser } from "../firebase";
import { useTheme } from "../theme";

// The "what can I eat" list, at /meals. Same sign-in as the journal, its own
// screens; nothing here links back to Dear Me and nothing there links here.
export default function MealsApp() {
  useTheme(); // stamps data-theme on <html> so the palette follows the phone
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

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
        <button className="signout" onClick={() => signOutUser()}>
          登出
        </button>
      </header>
      <main className="screen">
        <section className="panel">
          <p className="note">列表下一步做。</p>
        </section>
      </main>
    </div>
  );
}
