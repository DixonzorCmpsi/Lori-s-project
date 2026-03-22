import { z } from "zod/v4";

export const registerSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name must be 200 characters or fewer"),
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
});

export const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.email("Invalid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const theaterSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name must be 200 characters or fewer"),
  city: z.string().min(1, "City is required").max(100, "City must be 100 characters or fewer"),
  state: z.string().min(1, "State is required").max(100, "State must be 100 characters or fewer"),
});

export const productionSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name must be 200 characters or fewer"),
  estimatedCastSize: z.number().int().min(1).max(200),
  firstRehearsal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  openingNight: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  closingNight: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
});

export const bulletinPostSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title must be 200 characters or fewer"),
  body: z.string().min(1, "Body is required").max(10000, "Body must be 10,000 characters or fewer"),
});

export const castProfileSchema = z.object({
  displayName: z.string().min(1, "Name is required").max(200, "Name must be 200 characters or fewer"),
  phone: z.string().max(20, "Phone must be 20 characters or fewer").optional().or(z.literal("")),
  roleCharacter: z.string().max(200, "Role must be 200 characters or fewer").optional().or(z.literal("")),
});

export const messageSchema = z.object({
  body: z.string().min(1, "Message cannot be empty").max(2000, "Message must be 2,000 characters or fewer"),
});

export const conflictSubmissionSchema = z.object({
  dates: z.array(z.object({
    rehearsalDateId: z.string().uuid(),
    reason: z.string().max(500, "Reason must be 500 characters or fewer").optional().or(z.literal("")),
  })),
});
