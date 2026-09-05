import { describe, expect, it } from "vitest";
import { progress, scale } from "./foodmath";

const est = {
  items: [{ name: "白飯", grams: 200, kcal: 280, protein: 5, carbs: 62, fat: 0.5 }],
  totals: { kcal: 280, protein: 5, carbs: 62, fat: 0.5 },
  note: "x",
};

describe("scale", () => {
  it("scales items and totals, rounding kcal to whole and grams to one decimal", () => {
    const less = scale(est, 0.75);
    expect(less.totals).toEqual({ kcal: 210, protein: 3.8, carbs: 46.5, fat: 0.4 });
    expect(less.items[0].grams).toBe(150);
    expect(less.note).toBe("x");
    expect(scale(est, 1.5).totals.kcal).toBe(420);
  });

  it("copes with an empty estimate", () => {
    expect(scale({ items: [], totals: {} }, 2).totals).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });
});

describe("progress", () => {
  it("caps the bar at full and reports what is left or over", () => {
    expect(progress(1250, 2500)).toEqual({ pct: 0.5, remaining: 1250 });
    expect(progress(2600, 2500)).toEqual({ pct: 1, remaining: -100 });
    expect(progress(100, 0)).toEqual({ pct: 0, remaining: -100 });
  });
});
