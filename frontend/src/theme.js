// Light or dark, and who decided.
//
// The phone's own setting is the default, because someone writing in bed has
// usually already told their phone it is night. A person can override it, and
// that choice is remembered — but "follow the phone" stays an option rather
// than something they can only get back by guessing at the OS.
//
// The resolved theme is stamped on <html> as data-theme so the stylesheet can
// answer it, and returned so the few colours that live in JS (the energy
// bands, which Recharts needs as real values) can answer it too.
import { createContext, useContext, useEffect, useState } from "react";

const KEY = "dearme.theme";
const CHOICES = ["system", "light", "dark"];

function storedChoice() {
  try {
    const saved = localStorage.getItem(KEY);
    return CHOICES.includes(saved) ? saved : "system";
  } catch {
    // Private browsing can refuse storage; following the phone is a fine
    // default to fall back to.
    return "system";
  }
}

function systemTheme() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function useTheme() {
  const [choice, setStoredChoice] = useState(storedChoice);
  const [system, setSystem] = useState(systemTheme);

  // Follow the phone while the app is open, not only at load — the setting can
  // flip under us at sunset.
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return;
    const onChange = () => setSystem(systemTheme());
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const theme = choice === "system" ? system : choice;

  useEffect(() => {
    // "system" leaves the attribute off, so the stylesheet's media query is
    // what answers — one source of truth rather than two that can disagree.
    const root = document.documentElement;
    if (choice === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", choice);
    root.style.colorScheme = theme;
  }, [choice, theme]);

  function setChoice(next) {
    setStoredChoice(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Not being able to remember it is survivable; refusing to change it
      // would not be.
    }
  }

  return { theme, choice, setChoice };
}

// One owner of the setting — App — and everything else reads it from here.
// Calling useTheme in two places would give each its own copy, and toggling in
// one would leave the other showing the old theme's colours.
const ThemeContext = createContext("light");

export const ThemeProvider = ThemeContext.Provider;

/** The theme currently on screen, for the colours that can't come from CSS. */
export function useCurrentTheme() {
  return useContext(ThemeContext);
}

/** The next setting in the round: follow the phone, then light, then dark. */
export function nextChoice(choice) {
  return CHOICES[(CHOICES.indexOf(choice) + 1) % CHOICES.length];
}
