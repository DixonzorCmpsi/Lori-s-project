import { describe, it, expect } from "vitest";
import { generateToken, hashToken } from "@/server/auth/tokens";

describe("Token utilities", () => {
  it("generates a 256-bit (64 hex char) token", () => {
    const token = generateToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates unique tokens each time", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
  });

  it("hashes a token with SHA-256 (64 hex chars)", () => {
    const token = generateToken();
    const hash = hashToken(token);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces consistent hashes for the same input", () => {
    const token = "abc123";
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it("produces different hashes for different inputs", () => {
    expect(hashToken("token1")).not.toBe(hashToken("token2"));
  });
});
