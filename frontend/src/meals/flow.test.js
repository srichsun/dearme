import { describe, expect, it } from "vitest";
import {
  EMPTY,
  clampStep,
  firstMissing,
  fromMeal,
  isLast,
  keyToChoice,
  keyToRating,
  labelOf,
  localDate,
  stars,
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
  it("asks eight questions for a home-cooked meal", () => {
    expect(visibleSteps(chicken).map((s) => s.key)).toEqual([
      "name", "category", "source", "season", "method", "recipe", "rating", "note",
    ]);
  });

  it("skips method and recipe when eating out", () => {
    expect(visibleSteps(egg).map((s) => s.key)).toEqual([
      "name", "category", "source", "season", "rating", "note",
    ]);
  });

  it("asks the short list before the source is chosen", () => {
    expect(visibleSteps(EMPTY).map((s) => s.key)).not.toContain("method");
  });
});

describe("clampStep", () => {
  it("pulls the index back when a step disappears", () => {
    // On the note step (index 7) of a home-cooked meal, then switch to eat out.
    expect(clampStep(7, egg)).toBe(5);
  });

  it("leaves an index that still exists alone", () => {
    expect(clampStep(7, chicken)).toBe(7);
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

  it("does not require a recipe, a rating or a note", () => {
    expect(firstMissing({ ...chicken, recipe: "", note: "", rating: null })).toBe(-1);
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
      rating: null,
    });
  });

  it("sends the rating when there is one", () => {
    expect(toPayload({ ...chicken, rating: 9 }).rating).toBe(9);
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
    expect(answers).toEqual({ ...egg, method: null, rating: null });
    expect(fromMeal({ ...egg, rating: 4 }).rating).toBe(4);
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

describe("isLast", () => {
  it("is the note step, wherever that falls", () => {
    expect(isLast(7, chicken)).toBe(true);
    expect(isLast(6, chicken)).toBe(false);
    expect(isLast(5, egg)).toBe(true); // eating out has six steps
  });
});

describe("keyToChoice", () => {
  it("maps 1..n onto the options in order", () => {
    expect(keyToChoice("1", "source")).toBe("eat_out");
    expect(keyToChoice("2", "source")).toBe("home_cooked");
    expect(keyToChoice("4", "method")).toBe("microwave");
  });

  it("ignores keys that are not an option", () => {
    expect(keyToChoice("3", "source")).toBeNull();
    expect(keyToChoice("0", "season")).toBeNull();
    expect(keyToChoice("a", "season")).toBeNull();
    expect(keyToChoice("Enter", "season")).toBeNull();
  });
});

describe("localDate", () => {
  it("shows the day where the person is, not the UTC day", () => {
    // 23:30 UTC is already the 3rd in Taipei.
    expect(localDate("2026-09-02T23:30:00+00:00", "Asia/Taipei")).toBe("2026-09-03");
    expect(localDate("2026-09-02T23:30:00+00:00", "UTC")).toBe("2026-09-02");
  });

  it("is blank for something that is not a date", () => {
    expect(localDate("nope", "UTC")).toBe("");
  });
});

describe("keyToRating", () => {
  it("maps 1-9 to themselves and 0 to ten", () => {
    expect(keyToRating("1")).toBe(1);
    expect(keyToRating("9")).toBe(9);
    expect(keyToRating("0")).toBe(10);
  });

  it("ignores anything else", () => {
    expect(keyToRating("a")).toBeNull();
    expect(keyToRating("10")).toBeNull();
    expect(keyToRating("Enter")).toBeNull();
  });
});

describe("stars", () => {
  it("fills as many as the rating", () => {
    expect(stars(7)).toBe("★★★★★★★☆☆☆");
    expect(stars(10)).toBe("★★★★★★★★★★");
    expect(stars(1)).toBe("★☆☆☆☆☆☆☆☆☆");
  });

  it("is empty when unrated or nonsense", () => {
    expect(stars(null)).toBe("");
    expect(stars(0)).toBe("");
    expect(stars(11)).toBe("");
  });
});
