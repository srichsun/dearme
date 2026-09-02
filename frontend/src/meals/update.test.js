import { describe, expect, it } from "vitest";
import { buildStamp, bundleOf, newerBuildExists } from "./update";

const fakeDoc = (src) => ({
  querySelector: () => (src ? { getAttribute: () => src } : null),
});
const fakeFetch = (html, ok = true) => async () => ({ ok, text: async () => html });

describe("bundleOf", () => {
  it("finds the hashed bundle in a page or a src", () => {
    expect(bundleOf('<script type="module" src="/assets/index-BtTzYq6Q.js">')).toBe("assets/index-BtTzYq6Q.js");
    expect(bundleOf("/assets/index-abc.js")).toBe("assets/index-abc.js");
    expect(bundleOf("<html>no script</html>")).toBeNull();
  });
});

describe("buildStamp", () => {
  it("is the hash from the running bundle, or dev", () => {
    expect(buildStamp(fakeDoc("/assets/index-q-kIlrxq.js"))).toBe("q-kIlrxq");
    expect(buildStamp(fakeDoc(null))).toBe("dev");
  });
});

describe("newerBuildExists", () => {
  it("is true only when the server's bundle differs from the running one", async () => {
    const doc = fakeDoc("/assets/index-old.js");
    expect(await newerBuildExists(fakeFetch('src="/assets/index-new.js"'), doc)).toBe(true);
    expect(await newerBuildExists(fakeFetch('src="/assets/index-old.js"'), doc)).toBe(false);
  });

  it("stays quiet when it cannot tell", async () => {
    const doc = fakeDoc("/assets/index-old.js");
    expect(await newerBuildExists(fakeFetch("<html></html>"), doc)).toBe(false);
    expect(await newerBuildExists(fakeFetch("x", false), doc)).toBe(false);
    expect(await newerBuildExists(async () => { throw new Error("offline"); }, doc)).toBe(false);
    expect(await newerBuildExists(fakeFetch('src="/assets/index-new.js"'), fakeDoc(null))).toBe(false);
  });
});
