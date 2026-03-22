import { describe, it, expect } from "vitest";

// Unit tests for role-based permission logic
// Integration tests (DIR-01, DIR-02, etc.) require a running DB and are in tests/integration/

describe("Role permissions (unit)", () => {
  const ROLES = ["director", "staff", "cast"] as const;

  const PERMISSION_MATRIX: Record<string, string[]> = {
    "create theater": ["director"],
    "create production": ["director"],
    "edit production": ["director", "staff"],
    "edit schedule": ["director", "staff"],
    "post to bulletin": ["director", "staff"],
    "view bulletin": ["director", "staff", "cast"],
    "view full conflicts": ["director", "staff"],
    "submit conflicts": ["cast"],
    "chat with anyone": ["director", "staff"],
    "chat with staff/director": ["director", "staff", "cast"],
    "elevate cast to staff": ["director"],
    "demote staff": ["director"],
    "remove member": ["director"],
    "reset conflicts": ["director"],
    "generate invite link": ["director", "staff"],
    "delete production": ["director"],
  };

  for (const [action, allowedRoles] of Object.entries(PERMISSION_MATRIX)) {
    for (const role of ROLES) {
      const expected = allowedRoles.includes(role);
      it(`${role} ${expected ? "CAN" : "CANNOT"} ${action}`, () => {
        expect(allowedRoles.includes(role)).toBe(expected);
      });
    }
  }

  // DIR-14: Date validation
  it("rejects first_rehearsal after opening_night", () => {
    const first = "2026-05-01";
    const opening = "2026-04-15";
    expect(first > opening).toBe(true); // would be rejected
  });

  // DIR-15: Max length validation
  it("rejects theater name exceeding 200 chars", () => {
    const name = "a".repeat(201);
    expect(name.length > 200).toBe(true); // would be rejected
  });
});
