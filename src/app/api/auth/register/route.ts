import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, emailVerificationTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { registerSchema } from "@/lib/validators";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { computeAge, deriveAgeRange } from "@/lib/auth/age-gate";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { sendVerificationEmail } from "@/lib/email";
import { apiError, validationError } from "@/lib/api-error";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "VALIDATION_ERROR", "Invalid JSON body");
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => ({
      field: String(issue.path[0] ?? "unknown"),
      message: issue.message,
    }));
    return validationError(fields);
  }

  const { name, email, password, dateOfBirth } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  // Age gate (COPPA)
  const age = computeAge(dateOfBirth);
  if (age === null) {
    return validationError([{ field: "dateOfBirth", message: "Invalid date of birth" }]);
  }
  const ageRange = deriveAgeRange(age);
  if (ageRange === null) {
    return validationError([{ field: "dateOfBirth", message: "You must be 13 or older to create an account" }]);
  }

  // Password strength
  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    return validationError([{ field: "password", message: passwordError }]);
  }

  // Anti-enumeration: always return the same success message
  // regardless of whether the email exists
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existing) {
    // Email already exists — return same message (anti-enumeration)
    return NextResponse.json(
      { message: "Check your email for a verification link" },
      { status: 200 }
    );
  }

  // Hash password, create user (raw DOB is never stored)
  const passwordHash = await hashPassword(password);

  const [newUser] = await db.insert(users).values({
    email: normalizedEmail,
    name,
    passwordHash,
    ageRange,
    emailVerified: false,
  }).returning({ id: users.id });

  // Generate and store verification token
  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);

  await db.insert(emailVerificationTokens).values({
    userId: newUser.id,
    tokenHash,
  });

  // Send verification email (non-blocking — failure doesn't block registration)
  sendVerificationEmail(normalizedEmail, rawToken);

  return NextResponse.json(
    { message: "Check your email for a verification link" },
    { status: 200 }
  );
}
