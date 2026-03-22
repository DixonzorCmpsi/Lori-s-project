import bcrypt from "bcryptjs";
import { readFileSync } from "fs";
import { join } from "path";

const BCRYPT_COST = 12;

let breachedPasswordSet: Set<string> | null = null;

function getBreachedPasswords(): Set<string> {
  if (breachedPasswordSet) return breachedPasswordSet;

  try {
    const filePath = join(process.cwd(), "src/server/data/breached-passwords.txt");
    const content = readFileSync(filePath, "utf-8");
    breachedPasswordSet = new Set(
      content
        .split("\n")
        .map((line) => line.trim().toLowerCase())
        .filter(Boolean)
    );
  } catch {
    breachedPasswordSet = new Set();
  }

  return breachedPasswordSet;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function isBreachedPassword(plain: string): boolean {
  return getBreachedPasswords().has(plain.toLowerCase());
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters";
  }
  if (isBreachedPassword(password)) {
    return "This password is too common. Choose a different one.";
  }
  return null;
}
