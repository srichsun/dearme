import { describe, expect, it } from "vitest";
import {
  EMPTY,
  NO_PLACE,
  appendSpoken,
  clampStep,
  dollars,
  firstMissing,
  formatDistance,
  fromMeal,
  goFilters,
  isLast,
  isVideoUrl,
  keyToChoice,
  keyToRating,
  labelOf,
  localDate,
  mapsLink,
  nearParam,
  stars,
  toPayload,
  toQuery,
  toggleIn,
  visibleSteps,
} from "./flow";

const chicken = {
  ...EMPTY,
  name: "氣炸鍋雞胸",
  kind: "自煮",
  categories: ["meal"],
  source: "home_cooked",
  season: "summer",
  method: "air_fryer",
  recipe: "抹鹽\n氣炸 15 分",
};
const egg = { ...EMPTY, name: "茶葉蛋", categories: ["snack"], source: "eat_out", season: "all" };

describe("visibleSteps", () => {
  it("asks eleven questions for a home-cooked meal", () => {
    expect(visibleSteps(chicken).map((s) => s.key)).toEqual([
      "name", "kind", "proteins", "categories", "source", "season", "method", "recipe", "rating", "video_url", "note",
    ]);
  });

  it("asks for the shop instead of method and recipe when eating out", () => {
    expect(visibleSteps(egg).map((s) => s.key)).toEqual([
      "name", "kind", "proteins", "categories", "source", "season", "place", "price", "rating", "video_url", "note",
    ]);
  });

  it("asks the short list before the source is chosen", () => {
    expect(visibleSteps(EMPTY).map((s) => s.key)).not.toContain("method");
  });
});

describe("clampStep", () => {
  it("pulls the index back when a step disappears", () => {
    // On the note step (index 10) of a home-cooked meal, then switch to eat out.
    expect(clampStep(10, egg)).toBe(10); // eating out now has eleven steps too
    expect(clampStep(12, egg)).toBe(10);
  });

  it("leaves an index that still exists alone", () => {
    expect(clampStep(10, chicken)).toBe(10);
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
    expect(firstMissing({ ...chicken, method: null })).toBe(6);
  });

  it("needs at least one category", () => {
    expect(firstMissing({ ...chicken, categories: [] })).toBe(3);
  });

  it("does not require a kind, a recipe, a rating or a note", () => {
    expect(firstMissing({ ...chicken, kind: "", recipe: "", note: "", rating: null })).toBe(-1);
  });
});

describe("toPayload", () => {
  it("sends a home-cooked meal whole, trimmed, blanks as null", () => {
    expect(toPayload({ ...chicken, name: " 雞胸 ", note: "  " })).toEqual({
      name: "雞胸",
      categories: ["meal"],
      source: "home_cooked",
      season: "summer",
      method: "air_fryer",
      recipe: "抹鹽\n氣炸 15 分",
      note: null,
      rating: null,
      kind: "自煮",
      video_url: null,
      proteins: [],
      price: null,
      ...NO_PLACE, // home-cooked always sends the shop as nothing
    });
  });

  it("sends the price as a number for eating out, never for home", () => {
    expect(toPayload({ ...egg, price: "2" }).price).toBe(2);
    expect(toPayload({ ...egg }).price).toBeNull();
    expect(toPayload({ ...chicken, price: "2" }).price).toBeNull();
  });

  it("sends the proteins picked", () => {
    expect(toPayload({ ...egg, proteins: ["beef", "seafood"] }).proteins).toEqual(["beef", "seafood"]);
  });

  it("sends the video link trimmed", () => {
    expect(toPayload({ ...egg, video_url: " https://youtu.be/x " }).video_url).toBe("https://youtu.be/x");
  });

  it("sends a blank kind as null", () => {
    expect(toPayload({ ...egg, kind: "  " }).kind).toBeNull();
  });

  it("sends the rating when there is one", () => {
    expect(toPayload({ ...chicken, rating: 9 }).rating).toBe(9);
  });

  it("never sends a method or recipe for eating out", () => {
    const stale = { ...egg, method: "air_fryer", recipe: "left over from before" };
    expect(toPayload(stale)).toMatchObject({ method: null, recipe: null });
  });

  it("sends the shop for eating out and nothing for home-cooked", () => {
    const shop = { place_id: "x", place_name: "石二鍋", address: "信義區", phone: "02",
                   lat: 25.03, lng: 121.56, maps_url: "https://maps.google.com/?cid=1" };
    expect(toPayload({ ...egg, ...shop })).toMatchObject(shop);
    expect(toPayload({ ...chicken, ...shop })).toMatchObject({
      place_name: null, lat: null, maps_url: null,
    });
  });
});

describe("fromMeal", () => {
  it("turns stored nulls into empty strings for the inputs", () => {
    const answers = fromMeal({ name: "茶葉蛋", categories: ["snack"], source: "eat_out",
                               season: "all", method: null, recipe: null, note: null });
    expect(answers).toEqual({ ...egg, method: null, rating: null, kind: "" });
    expect(fromMeal({ ...egg, categories: undefined, category: "meal" }).categories).toEqual(["meal"]);
    expect(fromMeal({ ...egg, kind: "超商" }).kind).toBe("超商");
    expect(fromMeal({ ...egg, video_url: "https://youtu.be/x" }).video_url).toBe("https://youtu.be/x");
    expect(fromMeal({ ...egg }).video_url).toBe("");
    expect(fromMeal({ ...egg, proteins: ["chicken"] }).proteins).toEqual(["chicken"]);
    expect(fromMeal({ ...egg }).proteins).toEqual([]);
    expect(fromMeal({ ...egg, price: 3 }).price).toBe("3");
    expect(fromMeal({ ...egg }).price).toBeNull();
    expect(fromMeal({ ...egg, place: { place_name: "石二鍋", lat: 25.03 } })).toMatchObject({
      place_name: "石二鍋", lat: 25.03, phone: null,
    });
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

  it("carries the kind", () => {
    expect(toQuery({ kind: "火鍋" })).toBe(`?kind=${encodeURIComponent("火鍋")}`);
  });
});

describe("labelOf", () => {
  it("names a known code in either language, Chinese by default", () => {
    expect(labelOf("method", "air_fryer")).toBe("氣炸鍋");
    expect(labelOf("season", "all")).toBe("四季");
    expect(labelOf("method", "air_fryer", "en")).toBe("Air fryer");
  });

  it("hands back an unknown code as-is rather than a blank", () => {
    expect(labelOf("method", "oven")).toBe("oven");
    expect(labelOf("nonsense", "x")).toBe("x");
  });
});

describe("isLast", () => {
  it("is the note step, wherever that falls", () => {
    expect(isLast(10, chicken)).toBe(true);
    expect(isLast(9, chicken)).toBe(false);
    expect(isLast(10, egg)).toBe(true); // eating out has eleven steps
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

describe("appendSpoken", () => {
  it("fills an empty box and joins a full one with a space", () => {
    expect(appendSpoken("", "很飽")).toBe("很飽");
    expect(appendSpoken("週日備餐", "很飽")).toBe("週日備餐 很飽");
  });

  it("leaves the box alone when nothing was heard", () => {
    expect(appendSpoken("週日備餐", "   ")).toBe("週日備餐");
    expect(appendSpoken("", undefined)).toBe("");
  });
});

describe("formatDistance", () => {
  it("says metres under a kilometre and kilometres after", () => {
    expect(formatDistance(350)).toBe("350 m");
    expect(formatDistance(999)).toBe("999 m");
    expect(formatDistance(1234)).toBe("1.2 km");
    expect(formatDistance(12_345)).toBe("12 km");
  });

  it("is blank for nothing", () => {
    expect(formatDistance(null)).toBe("");
    expect(formatDistance(-1)).toBe("");
  });
});

describe("mapsLink", () => {
  it("prefers Google's own link, falls back to directions, else nothing", () => {
    expect(mapsLink({ maps_url: "https://maps.google.com/?cid=1", lat: 1, lng: 2 })).toBe(
      "https://maps.google.com/?cid=1",
    );
    expect(mapsLink({ lat: 25.03, lng: 121.56 })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=25.03,121.56",
    );
    expect(mapsLink({ place_name: "無座標" })).toBeNull();
    expect(mapsLink(null)).toBeNull();
  });
});

describe("nearParam", () => {
  it("rounds to five decimals, which is about a metre", () => {
    expect(nearParam({ lat: 25.033964, lng: 121.564468 })).toBe("25.03396,121.56447");
    expect(nearParam(null)).toBeNull();
  });
});

describe("isVideoUrl", () => {
  it("accepts a web address or nothing", () => {
    expect(isVideoUrl("https://www.instagram.com/reel/abc/")).toBe(true);
    expect(isVideoUrl("HTTP://youtu.be/x")).toBe(true);
    expect(isVideoUrl("")).toBe(true);
    expect(isVideoUrl("   ")).toBe(true);
  });

  it("refuses anything else", () => {
    expect(isVideoUrl("instagram.com/reel/abc")).toBe(false);
    expect(isVideoUrl("javascript:alert(1)")).toBe(false);
    expect(isVideoUrl("https://a b")).toBe(false);
  });
});

describe("goFilters", () => {
  it("is eating out plus the chosen kind, or any kind", () => {
    expect(goFilters("火鍋")).toEqual({ category: null, source: "eat_out", season: null, method: null, protein: null, price: null, kind: "火鍋" });
    expect(goFilters("")).toMatchObject({ source: "eat_out", kind: null });
    expect(goFilters(null)).toMatchObject({ source: "eat_out", kind: null });
  });
});

describe("toggleIn", () => {
  it("adds, removes, and keeps the buttons' order", () => {
    expect(toggleIn([], "chicken")).toEqual(["chicken"]);
    expect(toggleIn(["chicken"], "beef")).toEqual(["beef", "chicken"]);
    expect(toggleIn(["beef", "chicken"], "chicken")).toEqual(["beef"]);
    expect(toggleIn(null, "pork")).toEqual(["pork"]);
    expect(toggleIn(["snack"], "breakfast", "category")).toEqual(["breakfast", "snack"]);
  });
});

describe("dollars", () => {
  it("is one to three signs, or nothing", () => {
    expect(dollars(1)).toBe("$");
    expect(dollars(3)).toBe("$$$");
    expect(dollars(null)).toBe("");
    expect(dollars(0)).toBe("");
  });
});
