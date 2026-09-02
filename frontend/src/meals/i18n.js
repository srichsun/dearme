// Every word the meals screens show, in both languages, in one place.
// Components ask for a key; the language comes from a context that MealsApp
// owns (see useLang). A key with no English falls back to Chinese rather
// than to a blank, and a test checks nothing is missing.
import { createContext, useContext, useEffect, useState } from "react";

export const LANGS = ["zh", "en"];
const KEY = "meals.lang";

export const STRINGS = {
  // shell
  title: { zh: "吃什麼", en: "What to eat" },
  lede: { zh: "減脂期可以吃的東西，都記在這裡。", en: "Everything that's fine to eat while cutting, in one list." },
  signin: { zh: "用 Google 登入", en: "Continue with Google" },
  signout: { zh: "登出", en: "Sign out" },
  add: { zh: "＋ 新增", en: "+ Add" },
  tabMeals: { zh: "餐點", en: "Meals" },
  tabNotes: { zh: "反思", en: "Reflect" },
  loading: { zh: "載入中…", en: "Loading…" },
  edit: { zh: "編輯", en: "Edit" },
  del: { zh: "刪除", en: "Delete" },
  confirmDel: { zh: "確定刪除？", en: "Really delete?" },
  cancel: { zh: "取消", en: "Cancel" },
  // list
  searchPh: { zh: "找名字、食材、備註…", en: "Search names, ingredients, notes…" },
  askPh: { zh: "例如：夏天自己煮的點心，用氣炸鍋", en: "e.g. a summer snack I cook in the air fryer" },
  askMode: { zh: "用問的", en: "Ask" },
  typeMode: { zh: "打字找", en: "Type" },
  ask: { zh: "問", en: "Go" },
  fallback: { zh: "沒問到 AI，先用關鍵字搜。", en: "The AI didn't answer; searched by keyword instead." },
  clear: { zh: "清除條件", en: "Clear" },
  noMatch: { zh: "沒有符合的。", en: "Nothing matches." },
  empty: { zh: "還沒有餐點，按右上角新增。", en: "No meals yet — add one, top right." },
  viewAll: { zh: "全部", en: "All" },
  viewKinds: { zh: "依類型", en: "By kind" },
  allKinds: { zh: "← 全部類型", en: "← All kinds" },
  noKinds: { zh: "還沒有餐點填類型。新增或編輯時填「什麼類型？」那題。", en: "No meal has a kind yet. Fill in “What kind?” when adding or editing." },
  nearOn: { zh: "◉ 離我最近（關）", en: "◉ Nearest (off)" },
  nearOff: { zh: "◎ 離我最近", en: "◎ Nearest to me" },
  noGeo: { zh: "這個瀏覽器沒有定位。", en: "This browser has no location." },
  locating: { zh: "定位中…", en: "Locating…" },
  geoDenied: { zh: "拿不到位置，檢查瀏覽器的定位權限。", en: "Couldn't get a location; check the browser's permission." },
  navigate: { zh: "導航 ↗", en: "Directions ↗" },
  // dialog
  close: { zh: "關閉", en: "Close" },
  missing: { zh: "這題還沒填。", en: "This one's still empty." },
  answerFirst: { zh: "先回答這題。", en: "Answer this one first." },
  saveFailed: { zh: "存不進去，再試一次。", en: "Couldn't save; try again." },
  prev: { zh: "上一題", en: "Back" },
  next: { zh: "下一題", en: "Next" },
  create: { zh: "新增", en: "Add" },
  save: { zh: "存檔", en: "Save" },
  saving: { zh: "存檔中…", en: "Saving…" },
  keys: { zh: "Enter 下一題 · Esc 關閉", en: "Enter next · Esc close" },
  namePh: { zh: "例如：氣炸鍋雞胸", en: "e.g. air-fryer chicken breast" },
  kindPh: { zh: "例如：火鍋", en: "e.g. hot pot" },
  placePh: { zh: "例如：石二鍋 後山埤", en: "e.g. Shi Er Guo, Houshanpi" },
  noPlacesKey: { zh: "沒有設定 Google 金鑰", en: "No Google key configured" },
  placeBusy: { zh: "查店家資料…", en: "Fetching the shop…" },
  placeFailed: { zh: "拿不到這家店的資料，再點一次或跳過。", en: "Couldn't fetch that shop; pick again or skip." },
  recipePh: { zh: "雞胸抹鹽\n氣炸 180 度 15 分", en: "Salt the chicken\nAir-fry 180°C, 15 min" },
  notePh: { zh: "例如：週日備餐，一次做三份", en: "e.g. Sunday meal prep, three portions" },
  unrated: { zh: "未評", en: "unrated" },
  videoPh: { zh: "https://www.instagram.com/reel/…", en: "https://www.instagram.com/reel/…" },
  badUrl: { zh: "要是 http:// 或 https:// 開頭的網址。", en: "It needs to be a web address starting with http:// or https://." },
  watch: { zh: "▶ 看影片", en: "▶ Watch" },
  clearOne: { zh: "清除", en: "Clear" },
  listening: { zh: "聽寫中…", en: "Transcribing…" },
  stop: { zh: "停止", en: "Stop" },
  speak: { zh: "用講的", en: "Say it" },
  starsLabel: { zh: "幾顆星", en: "How many stars" },
  star: { zh: "星", en: "stars" },
  // reflections
  reflectTitle: { zh: "反思", en: "Reflect" },
  reflectLede: { zh: "飲食、訓練、睡眠、情緒——任何跟能量有關的發現，講一句或打一句。之後整理成你的 pattern。", en: "Food, training, sleep, mood — anything you noticed about your energy, said or typed. Later it becomes your patterns." },
  reflectPh: { zh: "例如：早上不想吃燕麥高蛋白，因為不香不油／練腿隔天睡得特別沉", en: "e.g. I don't want oats in the morning — not fragrant, not oily / slept deep the day after leg day" },
  keep: { zh: "記下來", en: "Keep it" },
  noReflect: { zh: "還沒有反思。", en: "Nothing yet." },
};

export function t(lang, key) {
  const pair = STRINGS[key];
  if (!pair) return key;
  return pair[lang] ?? pair.zh;
}

// Any Chinese locale starts in Chinese; everyone else in English.
export function browserLang() {
  const langs = navigator.languages || [navigator.language || "en"];
  return langs.some((l) => l.toLowerCase().startsWith("zh")) ? "zh" : "en";
}

function storedLang() {
  try {
    const saved = localStorage.getItem(KEY);
    return LANGS.includes(saved) ? saved : browserLang();
  } catch {
    return browserLang();
  }
}

const LangContext = createContext({ lang: "zh", t: (k) => t("zh", k), toggle: () => {} });
export const LangProvider = LangContext.Provider;

// For MealsApp, which owns the choice.
export function useLangState() {
  const [lang, setLang] = useState(storedLang);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, lang);
    } catch {
      /* forgetting it is survivable */
    }
    document.documentElement.lang = lang === "zh" ? "zh-TW" : "en";
  }, [lang]);
  return { lang, t: (k) => t(lang, k), toggle: () => setLang(lang === "zh" ? "en" : "zh") };
}

// For every screen underneath.
export function useLang() {
  return useContext(LangContext);
}
