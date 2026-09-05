// Pure helpers for the food screens.

export const NUTRIENTS = ["kcal", "protein", "carbs", "fat"];

// Scale a whole estimate (items and totals) by a factor: "less" is ×0.75,
// "more" ×1.5. Rounded the way the API rounds.
export function scale(est, factor) {
  const r = (n, v) => (n === "kcal" ? Math.round(v) : Math.round(v * 10) / 10);
  const items = (est.items || []).map((i) => {
    const out = { ...i, grams: Math.round((i.grams || 0) * factor) };
    for (const n of NUTRIENTS) out[n] = r(n, (i[n] || 0) * factor);
    return out;
  });
  const totals = {};
  for (const n of NUTRIENTS) totals[n] = r(n, (est.totals?.[n] || 0) * factor);
  return { ...est, items, totals };
}

// 0..1 of the target, capped at 1 for the bar; and the signed remainder.
export function progress(eaten, target) {
  const t = target || 0;
  const pct = t > 0 ? Math.min(1, (eaten || 0) / t) : 0;
  return { pct, remaining: Math.round(t - (eaten || 0)) };
}

// Shrink a photo in the browser before upload: longest side ≤ 1280 px,
// JPEG ~0.8. Returns a Blob; falls back to the original if anything fails.
export async function shrinkImage(file, maxSide = 1280) {
  try {
    const bitmap = await createImageBitmap(file);
    const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (ratio === 1 && file.size < 1_000_000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.8));
    return blob || file;
  } catch {
    return file;
  }
}
