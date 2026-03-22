import { NextResponse } from "next/server";

type FieldError = { field: string; message: string };

export function apiError(
  status: number,
  code: string,
  message: string,
  fields?: FieldError[]
) {
  const body: Record<string, unknown> = { error: code, message };
  if (fields) body.fields = fields;
  return NextResponse.json(body, { status });
}

export function unauthorized(message = "Invalid email or password") {
  return apiError(401, "UNAUTHORIZED", message);
}

export function forbidden(message = "You do not have permission to perform this action") {
  return apiError(403, "FORBIDDEN", message);
}

export function notFound(message = "Resource not found") {
  return apiError(404, "NOT_FOUND", message);
}

export function conflict(message: string) {
  return apiError(409, "CONFLICT", message);
}

export function rateLimited(message = "Too many requests", retryAfter?: number) {
  const res = apiError(429, "RATE_LIMITED", message);
  if (retryAfter) {
    res.headers.set("Retry-After", String(retryAfter));
  }
  return res;
}

export function validationError(fields: FieldError[]) {
  return apiError(400, "VALIDATION_ERROR", "Invalid input", fields);
}

export function internalError() {
  return apiError(500, "INTERNAL_ERROR", "An unexpected error occurred");
}
