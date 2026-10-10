import { describe, expect, it } from "vitest";
import { repository, snapshot } from "@/test/builders";
import { scopeSnapshots } from "./scope";

const a = snapshot({ repository: repository({ name: "a", fullName: "sample-org/a" }) });
const b = snapshot({ repository: repository({ name: "b", fullName: "sample-org/b" }) });

describe("scopeSnapshots", () => {
  it("returns everything when no repo is requested", () => {
    expect(scopeSnapshots([a, b], undefined)).toEqual({ selected: [a, b], repo: undefined });
  });

  it("narrows to a single known repository", () => {
    expect(scopeSnapshots([a, b], "sample-org/b")).toEqual({ selected: [b], repo: "sample-org/b" });
  });

  it("falls back to all repositories for unknown or malformed values", () => {
    expect(scopeSnapshots([a, b], "someone/else").selected).toHaveLength(2);
    expect(scopeSnapshots([a, b], "../../etc/passwd").selected).toHaveLength(2);
  });

  it("uses the first value when the parameter is repeated", () => {
    expect(scopeSnapshots([a, b], ["sample-org/a", "sample-org/b"]).repo).toBe("sample-org/a");
  });

  it("handles no repositories", () => {
    expect(scopeSnapshots([], "sample-org/a")).toEqual({ selected: [], repo: undefined });
  });
});
