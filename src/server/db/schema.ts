import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  date,
  time,
  integer,
  unique,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ============================================================
// SPEC-002: Auth tables
// ============================================================

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),
  googleId: text("google_id").unique(),
  emailVerified: boolean("email_verified").default(false),
  avatarUrl: text("avatar_url"),
  ageRange: text("age_range"), // NULL = Google OAuth user who hasn't completed age gate
  tokenVersion: integer("token_version").notNull().default(0), // Incremented on password reset / logout-all
  failedLoginAttempts: integer("failed_login_attempts").default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  check("users_email_length", sql`char_length(${table.email}) <= 320`),
  check("users_name_length", sql`char_length(${table.name}) <= 200`),
  check("users_age_range_check", sql`${table.ageRange} IS NULL OR ${table.ageRange} IN ('13-17', '18+')`),
]);

// NOTE: No sessions table. NextAuth uses JWT strategy.
// Session invalidation handled via users.token_version.

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").unique().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").unique().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull().default(sql`NOW() + INTERVAL '24 hours'`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ============================================================
// SPEC-003: Director tables
// ============================================================

export const theaters = pgTable("theaters", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  check("theaters_name_length", sql`char_length(${table.name}) <= 200`),
  check("theaters_city_length", sql`char_length(${table.city}) <= 100`),
  check("theaters_state_length", sql`char_length(${table.state}) <= 100`),
]);

export const productions = pgTable("productions", {
  id: uuid("id").primaryKey().defaultRandom(),
  theaterId: uuid("theater_id").notNull().references(() => theaters.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  estimatedCastSize: integer("estimated_cast_size"),
  firstRehearsal: date("first_rehearsal").notNull(),
  openingNight: date("opening_night").notNull(),
  closingNight: date("closing_night").notNull(),
  isArchived: boolean("is_archived").default(false),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  check("productions_name_length", sql`char_length(${table.name}) <= 200`),
  check("productions_date_order_1", sql`${table.firstRehearsal} <= ${table.openingNight}`),
  check("productions_date_order_2", sql`${table.openingNight} <= ${table.closingNight}`),
]);

export const rehearsalDates = pgTable("rehearsal_dates", {
  id: uuid("id").primaryKey().defaultRandom(),
  productionId: uuid("production_id").notNull().references(() => productions.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  type: text("type").notNull(),
  note: text("note"),
  isCancelled: boolean("is_cancelled").default(false),
  isDeleted: boolean("is_deleted").default(false),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  check("rehearsal_dates_type_check", sql`${table.type} IN ('regular', 'tech', 'dress', 'performance')`),
  check("rehearsal_dates_note_length", sql`${table.note} IS NULL OR char_length(${table.note}) <= 1000`),
  check("rehearsal_dates_time_order", sql`${table.startTime} < ${table.endTime}`),
]);

export const bulletinPosts = pgTable("bulletin_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  productionId: uuid("production_id").notNull().references(() => productions.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  isPinned: boolean("is_pinned").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  check("bulletin_posts_title_length", sql`char_length(${table.title}) <= 200`),
  check("bulletin_posts_body_length", sql`char_length(${table.body}) <= 10000`),
]);

// ============================================================
// SPEC-002: Membership & Invites
// ============================================================

export const productionMembers = pgTable("production_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  productionId: uuid("production_id").notNull().references(() => productions.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("cast"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  unique("production_members_unique").on(table.productionId, table.userId),
  check("production_members_role_check", sql`${table.role} IN ('director', 'staff', 'cast')`),
]);

export const inviteTokens = pgTable("invite_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  productionId: uuid("production_id").notNull().references(() => productions.id, { onDelete: "cascade" }),
  token: text("token").unique().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull().default(sql`NOW() + INTERVAL '30 days'`),
  maxUses: integer("max_uses").notNull().default(100),
  useCount: integer("use_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ============================================================
// SPEC-004: Cast tables
// ============================================================

export const castProfiles = pgTable("cast_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  productionId: uuid("production_id").notNull().references(() => productions.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  phone: text("phone"),
  roleCharacter: text("role_character"),
  headshotUrl: text("headshot_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  unique("cast_profiles_unique").on(table.productionId, table.userId),
  check("cast_profiles_name_length", sql`char_length(${table.displayName}) <= 200`),
  check("cast_profiles_phone_length", sql`${table.phone} IS NULL OR char_length(${table.phone}) <= 20`),
  check("cast_profiles_role_length", sql`${table.roleCharacter} IS NULL OR char_length(${table.roleCharacter}) <= 200`),
]);

export const castConflicts = pgTable("cast_conflicts", {
  id: uuid("id").primaryKey().defaultRandom(),
  productionId: uuid("production_id").notNull().references(() => productions.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  rehearsalDateId: uuid("rehearsal_date_id").notNull().references(() => rehearsalDates.id, { onDelete: "cascade" }),
  reason: text("reason"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  unique("cast_conflicts_unique").on(table.userId, table.rehearsalDateId),
  check("cast_conflicts_reason_length", sql`${table.reason} IS NULL OR char_length(${table.reason}) <= 500`),
]);

export const conflictSubmissions = pgTable("conflict_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  productionId: uuid("production_id").notNull().references(() => productions.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("conflict_submissions_unique").on(table.productionId, table.userId),
]);

// ============================================================
// SPEC-005: Chat tables
// ============================================================

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  productionId: uuid("production_id").notNull().references(() => productions.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const conversationParticipants = pgTable("conversation_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (table) => [
  unique("conversation_participants_unique").on(table.conversationId, table.userId),
]);

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  senderId: uuid("sender_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  isRead: boolean("is_read").default(false),
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  check("messages_body_length", sql`char_length(${table.body}) <= 2000`),
  index("idx_messages_conversation").on(table.conversationId, table.createdAt),
  index("idx_messages_unread").on(table.conversationId, table.isRead).where(sql`is_read = FALSE`),
]);

export const chatRateLimits = pgTable("chat_rate_limits", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  messageCount: integer("message_count").notNull().default(1),
}, (table) => [
  unique("chat_rate_limits_unique").on(table.userId, table.windowStart),
]);
