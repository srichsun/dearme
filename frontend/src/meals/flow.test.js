import { describe, expect, it } from "vitest";
import {
  EMPTY,
  clampStep,
  firstMissing,
  fromMeal,
  labelOf,
  toPayload,
  toQuery,
  visibleSteps,
} from "./flow";

const chicken = {
  ...EMPTY,
  name: "氣炸鍋雞胸",
  category: "meal",
  source: "home_cooked",
  season: "summer",
  method: "air_fryer",
  recipe: "抹鹽\n氣炸 15 分",
};
const egg = { ...EMPTY, name: "茶葉蛋", category: "snack", source: "eat_out", season: "all" };

describe("visibleSteps", () => {
  it("asks seven questions for a home-cooked meal", () => {
    expect(visibleSteps(chicken).map((s) => s.key)).toEqual([
      "name", "category", "source", "season", "method", "recipe", "note",
    ]);
  });

  it("skips method and recipe when eating out", () => {
    expect(visibleSteps(egg).map((s) => s.key)).toEqual([
      "name", "category", "source", "season", "note",
    ]);
  });

  it("asks the short list before the source is chosen", () => {
    expect(visibleSteps(EMPTY).map((s) => s.key)).not.toContain("method");
  });
});

describe("clampStep", () => {
  it("pulls the index back when a step disappears", () => {
    // On the recipe step (index 5) of a home-cooked meal, then switch to eat out.
    expect(clampStep(5, egg)).toBe(4);
  });

  it("leaves an index that still exists alone", () => {
    expect(clampStep(5, chicken)).toBe(5);
    expect(clampStep(0, egg)).toBe(0);
  });

  it("never goes below zero", () => {
    expect(clampStep(-3, egg)).toBe(0);
  });
});

describe("firstMissing", () => {
  it("is -1 when every required answer is in", () => {
    expect(firstMissing(chicken)).toBe(-1);
    expect(firstMissing(egg)).toBe(-1);
  });

  it("points at the name when it is only spaces", () => {
    expect(firstMissing({ ...chicken, name: "   " })).toBe(0);
  });

  it("points at the method for a home-cooked meal without one", () => {
    expect(firstMissing({ ...chicken, method: null })).toBe(4);
  });

  it("does not require a recipe or a note", () => {
    expect(firstMissing({ ...chicken, recipe: "", note: "" })).toBe(-1);
  });
});

describe("toPayload", () => {
  it("sends a home-cooked meal whole, trimmed, blanks as null", () => {
    expect(toPayload({ ...chicken, name: " 雞胸 ", note: "  " })).toEqual({
      name: "雞胸",
      category: "meal",
      source: "home_cooked",
      season: "summer",
      method: "air_fryer",
      recipe: "抹鹽\n氣炸 15 分",
      note: null,
    });
  });

  it("never sends a method or recipe for eating out", () => {
    const stale = { ...egg, method: "air_fryer", recipe: "left over from before" };
    expect(toPayload(stale)).toMatchObject({ method: null, recipe: null });
  });
});

describe("fromMeal", () => {
  it("turns stored nulls into empty strings for the inputs", () => {
    const answers = fromMeal({ name: "茶葉蛋", category: "snack", source: "eat_out",
                               season: "all", method: null, recipe: null, note: null });
    expect(answers).toEqual({ ...egg, method: null });
  });
});

describe("toQuery", () => {
  it("is empty when nothing is set", () => {
    expect(toQuery({})).toBe("");
    expect(toQuery({ q: "  ", category: null, season: undefined })).toBe("");
  });

  it("encodes what is set and leaves out the rest", () => {
    expect(toQuery({ q: "雞", season: "summer", method: null })).toBe(
      `?q=${encodeURIComponent("雞")}&season=summer`,
    );
  });

  it("trims the keyword", () => {
    expect(toQuery({ q: " 7-11 " })).toBe("?q=7-11");
  });
});

describe("labelOf", () => {
  it("names a known code in Chinese", () => {
    expect(labelOf("method", "air_fryer")).toBe("氣炸鍋");
    expect(labelOf("season", "all")).toBe("四季");
  });

  it("hands back an unknown code as-is rather than a blank", () => {
    expect(labelOf("method", "oven")).toBe("oven");
    expect(labelOf("nonsense", "x")).toBe("x");
  });
});
