import { NextRequest, NextResponse } from "next/server";

// In-memory IP rate limit store. Resets on cold start in serverless.
// Acceptable for dev/MVP. Production should use a durable store.
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

const LOGIN_RATE_LIMIT = 5;
const LOGIN_WINDOW_MS = 60 * 1000;

// Explicit allowlist of custom auth routes that need CSRF origin validation.
// NextAuth's own routes (/api/auth/callback/*, /api/auth/signin, etc.) are NOT
// on this list — NextAuth handles its own CSRF. Google OAuth callbacks come from
// accounts.google.com and would be blocked if we checked origin on those.
const CSRF_PROTECTED_ROUTES = [
  "/api/auth/register",
  "/api/auth/verify-email",
  "/api/auth/resend-verification",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
];

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }

  if (entry.count >= LOGIN_RATE_LIMIT) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count++;
  return { allowed: true, retryAfter: 0 };
}

function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const appOrigin = new URL(appUrl).origin;

  if (origin && origin === appOrigin) return true;
  if (referer && referer.startsWith(appOrigin)) return true;
  // Allow no-origin requests (same-origin navigation, server-side calls)
  if (!origin && !referer) return true;

  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Per-IP rate limiting on credentials login (SPEC-002: 5/min/IP)
  if (pathname === "/api/auth/callback/credentials" && method === "POST") {
    const ip = getClientIp(request);
    const { allowed, retryAfter } = checkLoginRateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        { error: "RATE_LIMITED", message: "Too many login attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }
  }

  // CSRF origin validation — explicit route allowlist only
  if (method === "POST" && CSRF_PROTECTED_ROUTES.includes(pathname)) {
    if (!validateOrigin(request)) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Invalid request origin" },
        { status: 403 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/auth/:path*"],
};
