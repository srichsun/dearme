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
  tabToday: { zh: "今天", en: "Today" },
  tabMeals: { zh: "餐點", en: "Eat out" },
  tabRecipes: { zh: "食譜", en: "Recipes" },
  noRecipes: { zh: "還沒有食譜，按上面新增。", en: "No recipes yet — add one above." },
  goalLabel: { zh: "我的目標", en: "My goal" },
  goalPh: { zh: "點這裡寫下你的目標…", en: "Tap to write your goal…" },
  goalHint: { zh: "Enter 存檔，Shift+Enter 換行", en: "Enter saves, Shift+Enter for a new line" },
  todayList: { zh: "今天要做的", en: "Today" },
  focus: { zh: "今天唯一的一件事", en: "The one thing today" },
  focusPh: { zh: "點這裡，寫下今天唯一要做到的事…", en: "Tap and write the one thing today is about…" },
  focusDone: { zh: "做到了", en: "Done" },
  focusUndo: { zh: "還沒", en: "Not yet" },
  focusDoneAt: { zh: "完成於", en: "Done at" },
  focusDecidedAt: { zh: "決定於", en: "Decided at" },
  principles: { zh: "黃金原則", en: "Golden rules" },
  rewards: { zh: "影片庫", en: "Clip library" },
  rewardsHint: { zh: "每天鎖一支，清單全部做到就解鎖。解鎖過的隨時重播。從相簿上傳，25MB 內。", en: "One clip locked per day; finish the list to earn it. Earned clips replay any time. Upload from your photos, under 25MB." },
  todaysClip: { zh: "今日影片", en: "Today’s clip" },
  lockedProgress: { zh: "完成 {done}/{total} 解鎖", en: "{done}/{total} done to unlock" },
  lockedNoList: { zh: "先加幾件今天要做的事。", en: "Add a few things to do first." },
  unlockedTitle: { zh: "已解鎖", en: "Unlocked" },
  unlocking: { zh: "解鎖！", en: "Unlocked!" },
  play: { zh: "播放", en: "Play" },
  locked: { zh: "鎖住", en: "Locked" },
  unlockedOn: { zh: "解鎖於", en: "Earned" },
  noClipsToday: { zh: "上傳影片後，這裡每天會鎖一支。", en: "Upload clips and one gets locked here each day." },
  uploadClip: { zh: "上傳影片", en: "Upload a clip" },
  uploading: { zh: "上傳中…", en: "Uploading…" },
  uploadFailed: { zh: "上傳失敗。要是影片檔、25MB 內。", en: "Upload failed. It needs to be a video under 25MB." },
  noClips: { zh: "還沒有影片。", en: "No clips yet." },
  watchAgain: { zh: "再看一次", en: "Watch again" },
  youDidIt: { zh: "今天全部做到了。", en: "You did it all today." },
  principlePh: { zh: "加一條原則…", en: "Add a rule…" },
  noPrinciples: { zh: "還沒有原則。", en: "No rules yet." },
  habitPh: { zh: "新增一項…", en: "Add one…" },
  addHabit: { zh: "加入", en: "Add" },
  starter: { zh: "加入預設五項", en: "Add the starter five" },
  noHabits: { zh: "清單是空的。", en: "The list is empty." },
  allDone: { zh: "今天都做到了。", en: "All done today." },
  tabNotes: { zh: "反思", en: "Reflect" },
  tabShop: { zh: "採買", en: "Shop" },
  tabFood: { zh: "飲食", en: "Food" },
  foodToday: { zh: "今日攝取", en: "Today’s intake" },
  kcal: { zh: "熱量", en: "Calories" },
  protein: { zh: "蛋白質", en: "Protein" },
  carbs: { zh: "碳水", en: "Carbs" },
  fat: { zh: "脂肪", en: "Fat" },
  left: { zh: "還剩", en: "left" },
  over: { zh: "超過", en: "over" },
  foodPh: { zh: "講一句或打一句：中午吃了什麼、大概多少…", en: "Say or type it: what you ate, roughly how much…" },
  photoMeal: { zh: "拍食物", en: "Photo" },
  photoLabel: { zh: "拍標示", en: "Label" },
  estimate: { zh: "算", en: "Count it" },
  estimating: { zh: "算算看…", en: "Counting…" },
  estimateFailed: { zh: "這次算不出來，再試一次或直接改數字。", en: "Couldn't count that one; try again or type the numbers." },
  fromTable: { zh: "衛福部", en: "TW table" },
  fromModel: { zh: "估", en: "est." },
  fromLabel: { zh: "標示", en: "label" },
  less: { zh: "少一點", en: "Less" },
  more: { zh: "多一點", en: "More" },
  saveLog: { zh: "記下來", en: "Log it" },
  discard: { zh: "算了", en: "Discard" },
  nothingToday: { zh: "今天還沒記。", en: "Nothing logged today." },
  targets: { zh: "目標", en: "Targets" },
  saveTargets: { zh: "存目標", en: "Save targets" },
  report: { zh: "報表", en: "Report" },
  back: { zh: "← 回今天", en: "← Back to today" },
  days7: { zh: "7 天", en: "7 days" },
  days30: { zh: "30 天", en: "30 days" },
  avgPerDay: { zh: "每日平均（有記的天）", en: "Daily average (logged days)" },
  onTarget: { zh: "熱量在目標 ±10% 的天數", en: "Days within ±10% of the kcal target" },
  loggedDays: { zh: "有記錄的天數", en: "Days logged" },
  noReport: { zh: "還沒有足夠的紀錄。", en: "Not enough logged yet." },
  secProtein: { zh: "蛋白質", en: "Protein" },
  secCarbs: { zh: "碳水", en: "Carbs" },
  secDrinks: { zh: "飲料", en: "Drinks" },
  secSnacks: { zh: "點心", en: "Snacks" },
  secFruit: { zh: "水果", en: "Fruit" },
  shopPh: { zh: "加一項…", en: "Add one…" },
  clearDone: { zh: "清掉已買", en: "Clear bought" },
  nothingToBuy: { zh: "沒有要買的。", en: "Nothing to buy." },
  loading: { zh: "載入中…", en: "Loading…" },
  edit: { zh: "編輯", en: "Edit" },
  del: { zh: "刪除", en: "Delete" },
  confirmDel: { zh: "確定刪除？", en: "Really delete?" },
  cancel: { zh: "取消", en: "Cancel" },
  // GO
  go: { zh: "I’M HUNGRY!", en: "I’M HUNGRY!" },
  goTitle: { zh: "現在想吃什麼外食？", en: "What do you feel like eating out?" },
  goHint: { zh: "按距離：定位後近到遠。按分類：先挑一類。", en: "By distance: locate, nearest first. By kind: pick a kind first." },
  goByDistance: { zh: "按距離", en: "By distance" },
  goByDistanceSub: { zh: "離我最近的外食，近到遠", en: "Places to eat out, nearest first" },
  goByKind: { zh: "按分類", en: "By kind" },
  goByKindSub: { zh: "火鍋、牛排、超商……先挑一類", en: "Hot pot, steak, convenience store… pick one" },
  goKindTitle: { zh: "哪一類？", en: "Which kind?" },
  goNoKinds: { zh: "外食餐點還沒填類型。新增或編輯時填「什麼類型？」那題。", en: "No eat-out meal has a kind yet. Fill in “What kind?” when adding or editing." },
  // add chooser + restaurant from link
  addWhat: { zh: "要新增什麼？", en: "Add what?" },
  addDish: { zh: "餐點", en: "A dish" },
  addDishSub: { zh: "外食的一道菜：名稱、類型、哪家店…", en: "A dish you eat out: name, kind, which shop…" },
  addShop: { zh: "餐廳", en: "A restaurant" },
  addShopSub: { zh: "貼 Google Maps 連結，資料自動抓", en: "Paste a Google Maps link; details fill in" },
  linkTitle: { zh: "貼 Google Maps 連結", en: "Paste a Google Maps link" },
  linkHint: { zh: "在 Google Maps 按「分享」複製的連結，貼這裡。", en: "The link from Google Maps’ Share button goes here." },
  linkPh: { zh: "https://maps.app.goo.gl/…", en: "https://maps.app.goo.gl/…" },
  fetch: { zh: "抓資料", en: "Fetch" },
  fetching: { zh: "抓資料中…", en: "Fetching…" },
  linkFailed: { zh: "抓不到這個連結的店家。", en: "Couldn't find a shop for that link." },
  addThis: { zh: "新增這家", en: "Add this one" },
  addedAs: { zh: "會以 外食／正餐／四季 新增，類型用 Google 的；之後都可以改。", en: "Added as eating out / main meal / any season, kind from Google; all editable later." },
  forceUpdate: { zh: "強制更新", en: "Force update" },
  newVersion: { zh: "有新版本，點這裡更新", en: "A new version is out — tap to update" },
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
  placePhOrLink: { zh: "店名，或貼 Google Maps 連結", en: "Shop name, or paste a Google Maps link" },
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
  keeping: { zh: "存檔中…", en: "Saving…" },
  kept: { zh: "✓ 存好了", en: "✓ Saved" },
  keepFailed: { zh: "沒存進去。文字還在框裡，再按一次；還是不行就跟我說。", en: "Not saved. Your words are still in the box — try again." },
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
