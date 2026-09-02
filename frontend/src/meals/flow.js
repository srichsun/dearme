// The pure logic behind the meals screens: which questions the dialog asks,
// how filters become a query string, and what each code is called on screen.
// No React in here, so all of it can be tested without rendering anything.

// Code → label, in the order the buttons appear. Codes are what the API
// speaks; labels are what the person sees.
export const OPTIONS = {
  category: [
    ["breakfast", { zh: "早餐", en: "Breakfast" }],
    ["meal", { zh: "正餐", en: "Main meal" }],
    ["snack", { zh: "點心", en: "Snack" }],
  ],
  source: [
    ["eat_out", { zh: "外食", en: "Eating out" }],
    ["home_cooked", { zh: "自己煮", en: "Home-cooked" }],
  ],
  season: [
    ["summer", { zh: "夏天", en: "Summer" }],
    ["winter", { zh: "冬天", en: "Winter" }],
    ["all", { zh: "四季", en: "Any season" }],
  ],
  method: [
    ["stir_fry", { zh: "炒", en: "Stir-fry" }],
    ["air_fryer", { zh: "氣炸鍋", en: "Air fryer" }],
    ["rice_cooker", { zh: "電鍋", en: "Rice cooker" }],
    ["microwave", { zh: "微波爐", en: "Microwave" }],
  ],
};

export const FILTER_FIELDS = ["category", "source", "season", "method"];

const homeCooked = (answers) => answers.source === "home_cooked";
const eatOut = (answers) => answers.source === "eat_out";

export const PLACE_FIELDS = ["place_id", "place_name", "address", "phone", "lat", "lng", "maps_url"];
export const NO_PLACE = Object.fromEntries(PLACE_FIELDS.map((f) => [f, null]));

// One question per step. `when` hides a step for some answers: eating out has
// no cooking method and no recipe, so those two never come up.
export const STEPS = [
  { key: "name", ask: { zh: "這道叫什麼？", en: "What's it called?" }, type: "text" },
  {
    key: "kind",
    ask: { zh: "什麼類型？", en: "What kind?" },
    hint: {
      zh: "火鍋、牛排、海鮮、超商……自己取，之後可以依類型看。沒有就直接下一步。",
      en: "Hot pot, steak, seafood, convenience store… your own words; you can browse by kind later. Skip if none.",
    },
    type: "kind",
    optional: true,
  },
  { key: "category", ask: { zh: "哪一餐？", en: "Which meal?" }, type: "choice" },
  { key: "source", ask: { zh: "外食還是自己煮？", en: "Eating out or cooking?" }, type: "choice" },
  { key: "season", ask: { zh: "適合什麼季節？", en: "Which season?" }, type: "choice" },
  {
    key: "place",
    ask: { zh: "哪家店？", en: "Which shop?" },
    hint: {
      zh: "打店名，從 Google 的建議裡點一家；沒有就直接下一步。",
      en: "Type the name and pick one of Google's suggestions; skip if none.",
    },
    type: "place",
    optional: true,
    when: eatOut,
  },
  { key: "method", ask: { zh: "怎麼煮？", en: "How is it cooked?" }, type: "choice", when: homeCooked },
  {
    key: "recipe",
    ask: { zh: "食譜？", en: "Recipe?" },
    hint: {
      zh: "食材和步驟，換行寫。沒有就直接下一步。",
      en: "Ingredients and steps, one per line. Skip if none.",
    },
    type: "long",
    optional: true,
    when: homeCooked,
  },
  {
    key: "rating",
    ask: { zh: "幾顆星？", en: "How many stars?" },
    hint: {
      zh: "吃過再評。數字鍵 1–9，0 是 10 顆；沒有就直接下一步。",
      en: "Rate it once eaten. Keys 1–9, 0 for ten; skip if not yet.",
    },
    type: "stars",
    optional: true,
  },
  {
    key: "video_url",
    ask: { zh: "影片連結？", en: "Video link?" },
    hint: {
      zh: "IG、YouTube 都可以，貼上就好。沒有就直接下一步。",
      en: "Instagram, YouTube, anything — just paste it. Skip if none.",
    },
    type: "url",
    optional: true,
  },
  {
    key: "note",
    ask: { zh: "備註？", en: "Notes?" },
    hint: {
      zh: "想寫熱量、哪裡買都可以。沒有就直接送出。",
      en: "Calories, where to buy, anything. Send as is if none.",
    },
    type: "long",
    optional: true,
  },
];

// A step's question and hint in one language.
export function stepText(step, lang = "zh") {
  const pick = (pair) => (pair ? (pair[lang] ?? pair.zh) : undefined);
  return { ask: pick(step.ask), hint: pick(step.hint) };
}

export const EMPTY = {
  name: "",
  kind: "",
  category: null,
  source: null,
  season: null,
  method: null,
  recipe: "",
  note: "",
  rating: null,
  video_url: "",
  ...NO_PLACE,
};

// The steps that apply to these answers, in order.
export function visibleSteps(answers) {
  return STEPS.filter((s) => !s.when || s.when(answers));
}

// Keep a step index inside the visible range. Switching to "eat out" while
// on the recipe step removes that step; the dialog then lands on the last
// step that still exists rather than on nothing.
export function clampStep(index, answers) {
  const last = visibleSteps(answers).length - 1;
  return Math.max(0, Math.min(index, last));
}

// Is this step answered well enough to move on?
export function isAnswered(step, answers) {
  if (step.optional) return true;
  const value = answers[step.key];
  return typeof value === "string" ? value.trim() !== "" : value != null;
}

// The first unanswered required step, or -1 if the whole thing is complete.
export function firstMissing(answers) {
  return visibleSteps(answers).findIndex((s) => !isAnswered(s, answers));
}

// What the API is sent. Eating out never sends a method or a recipe — the
// backend would drop them anyway, but not sending them keeps the two in step.
export function toPayload(answers) {
  const out = {
    name: answers.name.trim(),
    category: answers.category,
    source: answers.source,
    season: answers.season,
    method: null,
    recipe: null,
    note: answers.note.trim() || null,
    rating: answers.rating ?? null,
    kind: answers.kind.trim() || null,
    video_url: answers.video_url.trim() || null,
    ...NO_PLACE,
  };
  if (homeCooked(answers)) {
    out.method = answers.method;
    out.recipe = answers.recipe.trim() || null;
  } else {
    for (const f of PLACE_FIELDS) out[f] = answers[f] ?? null;
  }
  return out;
}

// A stored meal, back into dialog answers (nulls become empty strings so the
// inputs are controlled from the first render).
export function fromMeal(meal) {
  return {
    name: meal.name || "",
    kind: meal.kind || "",
    category: meal.category,
    source: meal.source,
    season: meal.season,
    method: meal.method,
    recipe: meal.recipe || "",
    note: meal.note || "",
    rating: meal.rating ?? null,
    video_url: meal.video_url || "",
    ...NO_PLACE,
    ...(meal.place || {}),
  };
}

// Only a web address goes out as a video link; the backend refuses the rest,
// but saying so on the step is kinder than a 422 at the end.
export function isVideoUrl(text) {
  const t = (text || "").trim();
  return t === "" || /^https?:\/\/\S+$/i.test(t);
}

// The stars 1-10, as buttons and as a row on the card.
export const RATINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// A number key on the rating step: "1".."9" are those stars, "0" is ten.
export function keyToRating(key) {
  if (key === "0") return 10;
  const n = Number(key);
  return Number.isInteger(n) && n >= 1 && n <= 9 && key.length === 1 ? n : null;
}

// "★★★★★★★☆☆☆" for 7; empty when unrated, so the card shows nothing.
export function stars(rating) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 10) return "";
  return "★".repeat(rating) + "☆".repeat(10 - rating);
}

// {q, category, ...} → "?q=..&category=..", leaving out anything empty.
export function toQuery(filters) {
  const params = new URLSearchParams();
  for (const key of ["q", ...FILTER_FIELDS, "kind", "near"]) {
    const value = filters?.[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) params.set(key, text);
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

// The label for a code in one language, or the code itself if it isn't one
// we know — better to show "oven" than a blank tag.
export function labelOf(field, code, lang = "zh") {
  const pair = (OPTIONS[field] || []).find(([c]) => c === code);
  return pair ? (pair[1][lang] ?? pair[1].zh) : code;
}

// Is this the last question for these answers? (Enter there means "send".)
export function isLast(index, answers) {
  return index >= visibleSteps(answers).length - 1;
}

// A number key on a choice step picks that option: "1" is the first button.
// Anything else — a letter, "0", a number past the end — picks nothing.
export function keyToChoice(key, field) {
  const options = OPTIONS[field] || [];
  const n = Number(key);
  if (!Number.isInteger(n) || n < 1 || n > options.length) return null;
  return options[n - 1][0];
}

// An ISO timestamp as a local calendar date, "2026-09-03". The server stamps
// UTC; a note kept at 07:00 in Taipei is still "today" here, not yesterday.
// timeZone is for tests; leave it out to follow the device.
export function localDate(iso, timeZone) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// Spoken words join what is already in the box, with a space between. Nothing
// heard leaves the box alone — the person may already have typed something.
export function appendSpoken(existing, heard) {
  const text = (heard || "").trim();
  if (!text) return existing;
  const before = (existing || "").trim();
  return before ? `${before} ${text}` : text;
}

// Metres as people say them: "350 m" up to a kilometre, then "1.2 km".
export function formatDistance(m) {
  if (!Number.isFinite(m) || m < 0) return "";
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`;
}

// Where "導航" goes: Google's own link for the place if we have it, else
// directions to the coordinates. Null when there is nowhere to go.
export function mapsLink(place) {
  if (!place) return null;
  if (place.maps_url) return place.maps_url;
  if (place.lat != null && place.lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;
  }
  return null;
}

// "lat,lng" for the API, from the browser's position.
export function nearParam(pos) {
  return pos ? `${pos.lat.toFixed(5)},${pos.lng.toFixed(5)}` : null;
}

// What GO asks the list for: eating out, one kind or any, nearest first is
// the list's own doing once it has a position.
export function goFilters(kind) {
  const k = (kind || "").trim();
  return { category: null, source: "eat_out", season: null, method: null, kind: k || null };
}
