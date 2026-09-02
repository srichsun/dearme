import { describe, expect, it } from "vitest";
import { OPTIONS, STEPS, labelOf, stepText } from "./flow";
import { LANGS, STRINGS, t } from "./i18n";

describe("strings", () => {
  it("has every key in both languages, non-empty", () => {
    for (const [key, pair] of Object.entries(STRINGS)) {
      for (const lang of LANGS) {
        expect(pair[lang], `${key}.${lang}`).toBeTruthy();
      }
    }
  });

  it("answers in the asked language and never with a blank", () => {
    expect(t("zh", "add")).toBe("＋ 新增");
    expect(t("en", "add")).toBe("+ Add");
    expect(t("en", "no-such-key")).toBe("no-such-key");
    expect(t("fr", "add")).toBe("＋ 新增"); // unknown language → Chinese
  });
});

describe("options and steps", () => {
  it("label every code in both languages", () => {
    for (const [field, options] of Object.entries(OPTIONS)) {
      for (const [code, label] of options) {
        for (const lang of LANGS) {
          expect(label[lang], `${field}.${code}.${lang}`).toBeTruthy();
          expect(labelOf(field, code, lang)).toBe(label[lang]);
        }
      }
    }
  });

  it("ask every question in both languages", () => {
    for (const step of STEPS) {
      for (const lang of LANGS) {
        expect(stepText(step, lang).ask, `${step.key}.${lang}`).toBeTruthy();
        if (step.hint) expect(stepText(step, lang).hint).toBeTruthy();
      }
    }
    expect(stepText(STEPS[0], "en").ask).toBe("What's it called?");
  });
});
