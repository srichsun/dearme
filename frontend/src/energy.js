// How an energy rating looks, in one place.
//
// It's rated 1-10 and shown as a percentage. Ten steps, not a hundred: nobody
// can tell their own 67 from their 71, and a finer scale would only make the
// chart look precise while meaning less.
//
// The three colours are muted on purpose. A screen you open on your worst day
// shouldn't shout at you in traffic-light red — clay, honey and sage carry the
// same three readings without the alarm.
//
// Each band carries both readings of itself. These are values, not CSS, because
// the chart hands them straight to Recharts — so the dark ones can't come from
// the stylesheet and have to live here beside the light ones. They are lifted
// rather than inverted: the same hues that read as muted on paper turn to mud
// on a dark ground.

export const BANDS = [
  { max: 3, color: "#c08578", dark: "#c8988b", tint: "#f0e2dd", darkTint: "#3a2e2a", label: "Low" },
  { max: 6, color: "#c9a05c", dark: "#d3ab72", tint: "#f3ead9", darkTint: "#3b3325", label: "Steady" },
  { max: 10, color: "#7f9d80", dark: "#93b294", tint: "#e3ece2", darkTint: "#2b3730", label: "Good" },
];

export const UNRATED = { light: "#d9d3c9", dark: "#3d382f" };

export function bandFor(score) {
  return BANDS.find((b) => score <= b.max) || BANDS[BANDS.length - 1];
}

/** The band's colour in the theme being shown. */
export function colorFor(score, theme = "light") {
  if (!score) return UNRATED[theme] ?? UNRATED.light;
  const band = bandFor(score);
  return theme === "dark" ? band.dark : band.color;
}

export function percentFor(score) {
  return score ? score * 10 : null;
}

// "19 Jul" — reads as a date rather than a coordinate.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function longDay(iso) {
  const [, m, d] = iso.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
}

// "7/19" — short enough for an axis tick on a phone.
export function shortDay(iso) {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}
