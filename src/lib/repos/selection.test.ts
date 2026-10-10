import { describe, expect, it } from "vitest";
import { MAX_SELECTED_REPOSITORIES, parseSelection } from "./selection";

const ok = (raw: unknown) => {
  const result = parseSelection(raw);
  if (!result.ok) throw new Error(result.error);
  return result.repos;
};

describe("parseSelection", () => {
  it("parses owner/name pairs", () => {
    expect(ok(["octo/hello", " org/repo.js "])).toEqual([
      { owner: "octo", name: "hello" },
      { owner: "org", name: "repo.js" },
    ]);
  });

  it("de-duplicates case-insensitively, keeping the first spelling", () => {
    expect(ok(["Octo/Hello", "octo/hello", "OCTO/HELLO"])).toEqual([
      { owner: "Octo", name: "Hello" },
    ]);
  });

  it("requires at least one repository", () => {
    expect(parseSelection([])).toMatchObject({ ok: false });
    expect(parseSelection(undefined)).toMatchObject({ ok: false });
    expect(parseSelection("octo/hello")).toMatchObject({ ok: false });
  });

  it("caps the selection and says why", () => {
    const many = Array.from({ length: MAX_SELECTED_REPOSITORIES + 1 }, (_, i) => `o/r${i}`);
    const result = parseSelection(many);
    expect(result).toMatchObject({ ok: false });
    expect(!result.ok && result.error).toMatch(/up to 12/);
    expect(parseSelection(many.slice(0, MAX_SELECTED_REPOSITORIES))).toMatchObject({ ok: true });
  });

  it("counts the cap after de-duplication", () => {
    const dupes = Array.from({ length: 30 }, () => "o/same");
    expect(parseSelection(dupes)).toMatchObject({ ok: true });
  });

  describe("rejects anything that is not a plain GitHub owner/name", () => {
    it.each([
      "no-slash",
      "a/b/c",
      "/name",
      "owner/",
      "owner/..",
      "../etc",
      "owner/.",
      "own er/repo",
      "owner/repo?x=1",
      "owner/repo#frag",
      "owner/repo%2F..",
      "owner/<script>",
      "https://github.com/o/r",
      "o/" + "x".repeat(101),
      "",
    ])("%j", (value) => {
      expect(parseSelection([value])).toMatchObject({ ok: false });
    });
  });

  it("rejects non-string entries", () => {
    expect(parseSelection([42, { owner: "o", name: "r" }])).toMatchObject({ ok: false });
  });

  it("rejects the whole submission if any entry is invalid (no partial saves)", () => {
    expect(parseSelection(["o/good", "bad"])).toMatchObject({ ok: false });
  });
});
