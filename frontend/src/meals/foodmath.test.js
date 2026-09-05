import { describe, expect, it } from "vitest";
import { cleanItems, dropItem, editItem, progress, scale, sumItems } from "./foodmath";

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

describe("editing items", () => {
  const two = {
    items: [
      { name: "黑咖啡", grams: 300, kcal: 117, protein: 2.7, carbs: 24.6, fat: 1.2, source: "tfnd", matched: "咖啡" },
      { name: "糖包", grams: 5, kcal: 20, protein: 0, carbs: 5, fat: 0, source: "model", matched: null },
    ],
    totals: { kcal: 137, protein: 2.7, carbs: 29.6, fat: 1.2 },
    source: "mixed",
  };

  it("lets a field go to zero — or blank while typing — and re-sums", () => {
    const zero = editItem(two, 0, "kcal", "0");
    expect(zero.totals.kcal).toBe(20);
    expect(zero.items[0].source).toBe("model");
    const blank = editItem(two, 0, "carbs", "");
    expect(blank.totals.carbs).toBe(5);
    expect(blank.items[0].carbs).toBe("");
  });

  it("drops an item and re-sums", () => {
    const one = dropItem(two, 0);
    expect(one.items).toHaveLength(1);
    expect(one.totals).toEqual({ kcal: 20, protein: 0, carbs: 5, fat: 0 });
  });

  it("cleans typed strings into numbers for saving", () => {
    const cleaned = cleanItems([{ name: "x", grams: "", kcal: "12.5", protein: "abc", carbs: 1, fat: "0" }]);
    expect(cleaned[0]).toMatchObject({ grams: 0, kcal: 12.5, protein: 0, carbs: 1, fat: 0 });
    expect(sumItems(cleaned).kcal).toBe(13);
  });
});
