import { describe, it, expect } from "vitest";
import { computeAge, deriveAgeRange } from "@/lib/auth/age-gate";

describe("Age gate", () => {
  // AUTH-26: User under 13 tries to register
  it("computes age correctly", () => {
    const today = new Date();
    const tenYearsAgo = new Date(today.getFullYear() - 10, today.getMonth(), today.getDate());
    expect(computeAge(tenYearsAgo.toISOString().split("T")[0])).toBe(10);

    const twentyYearsAgo = new Date(today.getFullYear() - 20, today.getMonth(), today.getDate());
    expect(computeAge(twentyYearsAgo.toISOString().split("T")[0])).toBe(20);
  });

  it("returns null for invalid dates", () => {
    expect(computeAge("not-a-date")).toBeNull();
  });

  it("blocks users under 13 (COPPA)", () => {
    expect(deriveAgeRange(12)).toBeNull();
    expect(deriveAgeRange(10)).toBeNull();
    expect(deriveAgeRange(0)).toBeNull();
  });

  it("returns 13-17 for minors", () => {
    expect(deriveAgeRange(13)).toBe("13-17");
    expect(deriveAgeRange(15)).toBe("13-17");
    expect(deriveAgeRange(17)).toBe("13-17");
  });

  it("returns 18+ for adults", () => {
    expect(deriveAgeRange(18)).toBe("18+");
    expect(deriveAgeRange(30)).toBe("18+");
    expect(deriveAgeRange(65)).toBe("18+");
  });
});
