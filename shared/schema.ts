import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  telegramId: text("telegram_id").unique(),
  username: text("username").notNull(),
  referralCode: text("referral_code").notNull().unique(),
  withdrawBalance: decimal("withdraw_balance", { precision: 10, scale: 5 }).default("0"),
  dailyEarnings: decimal("daily_earnings", { precision: 10, scale: 5 }).default("0"),
  totalEarnings: decimal("total_earnings", { precision: 10, scale: 5 }).default("0"),
  adsWatched: integer("ads_watched").default(0),
  dailyAdsWatched: integer("daily_ads_watched").default(0),
  lastAdWatch: timestamp("last_ad_watch"),
  level: integer("level").default(1),
  referredBy: varchar("referred_by"),
  banned: boolean("banned").default(false),
  flagged: boolean("flagged").default(false),
  flagReason: text("flag_reason"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const withdrawalRequests = pgTable("withdrawal_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 5 }).notNull(),
  status: text("status").default("pending"), // pending, approved, rejected
  telegramUsername: text("telegram_username"),
  walletAddress: text("wallet_address"),
  method: text("method").default("telegram"), // telegram, wallet
  createdAt: timestamp("created_at").default(sql`now()`),
  processedAt: timestamp("processed_at"),
  adminNotes: text("admin_notes"),
});

export const referrals = pgTable("referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referrerId: varchar("referrer_id").references(() => users.id).notNull(),
  refereeId: varchar("referee_id").references(() => users.id).notNull(),
  commission: decimal("commission", { precision: 10, scale: 5 }).default("0"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const botStats = pgTable("bot_stats", {
  id: varchar("id").primaryKey().default("main"),
  totalUsers: integer("total_users").default(0),
  totalAdsWatched: integer("total_ads_watched").default(0),
  totalEarnings: decimal("total_earnings", { precision: 10, scale: 5 }).default("0"),
  totalWithdrawals: decimal("total_withdrawals", { precision: 10, scale: 5 }).default("0"),
  activeUsers24h: integer("active_users_24h").default(0),
  cpmRate: decimal("cpm_rate", { precision: 10, scale: 5 }).default("0.35"), // $0.35 per 1000 ads
  earningsPerAd: decimal("earnings_per_ad", { precision: 10, scale: 5 }).default("0.00035"), // $0.00035 per ad
  dailyAdLimit: integer("daily_ad_limit").default(250), // Max ads per day
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWithdrawalRequestSchema = createInsertSchema(withdrawalRequests).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});

export const insertReferralSchema = createInsertSchema(referrals).omit({
  id: true,
  createdAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type WithdrawalRequest = typeof withdrawalRequests.$inferSelect;
export type InsertWithdrawalRequest = z.infer<typeof insertWithdrawalRequestSchema>;
export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type BotStats = typeof botStats.$inferSelect;
