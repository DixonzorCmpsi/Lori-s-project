import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, isBreachedPassword, validatePasswordStrength } from "@/server/auth/password";

describe("Password utilities", () => {
  // AUTH-01 related: password hashing
  it("hashes and verifies a password correctly", async () => {
    const plain = "securePassword123!";
    const hash = await hashPassword(plain);

    expect(hash).not.toBe(plain);
    expect(await verifyPassword(plain, hash)).toBe(true);
    expect(await verifyPassword("wrongPassword", hash)).toBe(false);
  });

  it("uses bcrypt cost factor 12 (hash starts with $2a$12$ or $2b$12$)", async () => {
    const hash = await hashPassword("testPassword");
    expect(hash).toMatch(/^\$2[ab]\$12\$/);
  });

  // AUTH-20: breached password check
  it("detects common breached passwords", () => {
    expect(isBreachedPassword("password")).toBe(true);
    expect(isBreachedPassword("123456")).toBe(true);
    expect(isBreachedPassword("PASSWORD")).toBe(true); // case-insensitive
    expect(isBreachedPassword("xK9$mP2vL!nQ")).toBe(false);
  });

  it("validates password strength", () => {
    expect(validatePasswordStrength("short")).toBe("Password must be at least 8 characters");
    expect(validatePasswordStrength("password")).toBe("This password is too common. Choose a different one.");
    expect(validatePasswordStrength("validP@ssw0rd123")).toBeNull();
  });
});
