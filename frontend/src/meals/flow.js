// The pure logic behind the meals screens: which questions the dialog asks,
// how filters become a query string, and what each code is called on screen.
// No React in here, so all of it can be tested without rendering anything.

// Code → label, in the order the buttons appear. Codes are what the API
// speaks; labels are what the person sees.
export const OPTIONS = {
  category: [
    ["breakfast", "早餐"],
    ["meal", "正餐"],
    ["snack", "點心"],
  ],
  source: [
    ["eat_out", "外食"],
    ["home_cooked", "自己煮"],
  ],
  season: [
    ["summer", "夏天"],
    ["winter", "冬天"],
    ["all", "四季"],
  ],
  method: [
    ["stir_fry", "炒"],
    ["air_fryer", "氣炸鍋"],
    ["rice_cooker", "電鍋"],
    ["microwave", "微波爐"],
  ],
};

export const FILTER_FIELDS = ["category", "source", "season", "method"];

const homeCooked = (answers) => answers.source === "home_cooked";

// One question per step. `when` hides a step for some answers: eating out has
// no cooking method and no recipe, so those two never come up.
export const STEPS = [
  { key: "name", ask: "這道叫什麼？", type: "text" },
  { key: "category", ask: "哪一餐？", type: "choice" },
  { key: "source", ask: "外食還是自己煮？", type: "choice" },
  { key: "season", ask: "適合什麼季節？", type: "choice" },
  { key: "method", ask: "怎麼煮？", type: "choice", when: homeCooked },
  {
    key: "recipe",
    ask: "食譜？",
    hint: "食材和步驟，換行寫。沒有就直接下一步。",
    type: "long",
    optional: true,
    when: homeCooked,
  },
  {
    key: "note",
    ask: "備註？",
    hint: "想寫熱量、哪裡買都可以。沒有就直接送出。",
    type: "long",
    optional: true,
  },
];

export const EMPTY = {
  name: "",
  category: null,
  source: null,
  season: null,
  method: null,
  recipe: "",
  note: "",
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
  };
  if (homeCooked(answers)) {
    out.method = answers.method;
    out.recipe = answers.recipe.trim() || null;
  }
  return out;
}

// A stored meal, back into dialog answers (nulls become empty strings so the
// inputs are controlled from the first render).
export function fromMeal(meal) {
  return {
    name: meal.name || "",
    category: meal.category,
    source: meal.source,
    season: meal.season,
    method: meal.method,
    recipe: meal.recipe || "",
    note: meal.note || "",
  };
}

// {q, category, ...} → "?q=..&category=..", leaving out anything empty.
export function toQuery(filters) {
  const params = new URLSearchParams();
  for (const key of ["q", ...FILTER_FIELDS]) {
    const value = filters?.[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) params.set(key, text);
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

// The label for a code, or the code itself if it isn't one we know — better
// to show "oven" than a blank tag.
export function labelOf(field, code) {
  const pair = (OPTIONS[field] || []).find(([c]) => c === code);
  return pair ? pair[1] : code;
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
