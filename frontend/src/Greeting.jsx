import { useEffect, useState } from "react";

// The line you land on. It holds the whole screen for a moment, then dissolves
// into the app — no button, no dismissal, nothing asked of you.
//
// Once per visit, not once per tab switch: a sentence you have to walk past
// forty times a day stops meaning anything. A tap anywhere hurries it along,
// so it can never be in the way of someone who came to write something down.
// Long enough to read eight words and mean them, short enough that someone who
// opened the app to write something down doesn't feel held up. The earlier
// numbers were tuned for how the line feels the first time; this is how it
// feels the fiftieth.
const HOLD_MS = 1400;
const FADE_MS = 500;

export default function Greeting({ onDone }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const hold = setTimeout(() => setLeaving(true), HOLD_MS);
    return () => clearTimeout(hold);
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const fade = setTimeout(onDone, FADE_MS);
    return () => clearTimeout(fade);
  }, [leaving, onDone]);

  return (
    <div
      className={"greeting" + (leaving ? " leaving" : "")}
      onClick={() => setLeaving(true)}
      style={{ "--fade": `${FADE_MS}ms` }}
    >
      <p className="greetingline">Today is going to be a good day.</p>
    </div>
  );
}
