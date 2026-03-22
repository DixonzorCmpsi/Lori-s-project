import { randomBytes, createHash } from "crypto";

/**
 * Generate a 256-bit cryptographically random, URL-safe token.
 * Returns the raw token (sent to user) — hash before storing.
 */
export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * SHA-256 hash a raw token for safe database storage.
 */
export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
