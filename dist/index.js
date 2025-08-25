// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// server/storage.ts
import { randomUUID } from "crypto";
var MemStorage = class {
  users;
  withdrawalRequests;
  referrals;
  botStats;
  constructor() {
    this.users = /* @__PURE__ */ new Map();
    this.withdrawalRequests = /* @__PURE__ */ new Map();
    this.referrals = /* @__PURE__ */ new Map();
    this.botStats = {
      id: "main",
      totalUsers: 0,
      totalAdsWatched: 0,
      totalEarnings: "0",
      totalWithdrawals: "0",
      activeUsers24h: 0,
      cpmRate: "0.35",
      earningsPerAd: "0.00035",
      dailyAdLimit: 250,
      updatedAt: /* @__PURE__ */ new Date()
    };
  }
  async getUser(id) {
    return this.users.get(id);
  }
  async getUserByTelegramId(telegramId) {
    return Array.from(this.users.values()).find((user) => user.telegramId === telegramId);
  }
  async getUserByReferralCode(referralCode) {
    return Array.from(this.users.values()).find((user) => user.referralCode === referralCode);
  }
  async createUser(insertUser) {
    const id = randomUUID();
    const user = {
      ...insertUser,
      id,
      withdrawBalance: insertUser.withdrawBalance || "0",
      dailyEarnings: insertUser.dailyEarnings || "0",
      totalEarnings: insertUser.totalEarnings || "0",
      adsWatched: insertUser.adsWatched || 0,
      dailyAdsWatched: insertUser.dailyAdsWatched || 0,
      level: insertUser.level || 1,
      lastAdWatch: insertUser.lastAdWatch || null,
      referredBy: insertUser.referredBy || null,
      banned: insertUser.banned || false,
      flagged: insertUser.flagged || false,
      flagReason: insertUser.flagReason || null,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.users.set(id, user);
    if (this.botStats.totalUsers !== null) {
      this.botStats.totalUsers += 1;
    }
    this.botStats.updatedAt = /* @__PURE__ */ new Date();
    return user;
  }
  async updateUser(id, updates) {
    const user = this.users.get(id);
    if (!user) {
      throw new Error("User not found");
    }
    const updatedUser = { ...user, ...updates, updatedAt: /* @__PURE__ */ new Date() };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  async getAllUsers() {
    return Array.from(this.users.values());
  }
  async createWithdrawalRequest(insertRequest) {
    const id = randomUUID();
    const request = {
      ...insertRequest,
      id,
      status: "pending",
      createdAt: /* @__PURE__ */ new Date(),
      processedAt: null,
      adminNotes: null,
      telegramUsername: insertRequest.telegramUsername || null,
      walletAddress: insertRequest.walletAddress || null,
      method: insertRequest.method || null
    };
    this.withdrawalRequests.set(id, request);
    return request;
  }
  async getWithdrawalRequest(id) {
    return this.withdrawalRequests.get(id);
  }
  async getUserWithdrawalRequests(userId) {
    return Array.from(this.withdrawalRequests.values()).filter((req) => req.userId === userId);
  }
  async updateWithdrawalRequest(id, updates) {
    const request = this.withdrawalRequests.get(id);
    if (!request) {
      throw new Error("Withdrawal request not found");
    }
    const updatedRequest = { ...request, ...updates };
    if (updates.status && updates.status !== "pending") {
      updatedRequest.processedAt = /* @__PURE__ */ new Date();
    }
    this.withdrawalRequests.set(id, updatedRequest);
    return updatedRequest;
  }
  async getPendingWithdrawalRequests() {
    return Array.from(this.withdrawalRequests.values()).filter((req) => req.status === "pending");
  }
  async createReferral(insertReferral) {
    const id = randomUUID();
    const referral = {
      ...insertReferral,
      id,
      commission: insertReferral.commission || "0",
      createdAt: /* @__PURE__ */ new Date()
    };
    this.referrals.set(id, referral);
    return referral;
  }
  async getUserReferrals(userId) {
    return Array.from(this.referrals.values()).filter((ref) => ref.referrerId === userId);
  }
  async getBotStats() {
    return this.botStats;
  }
  async updateBotStats(updates) {
    this.botStats = { ...this.botStats, ...updates, updatedAt: /* @__PURE__ */ new Date() };
    return this.botStats;
  }
};
var storage = new MemStorage();

// shared/schema.ts
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var users = pgTable("users", {
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
  updatedAt: timestamp("updated_at").default(sql`now()`)
});
var withdrawalRequests = pgTable("withdrawal_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 5 }).notNull(),
  status: text("status").default("pending"),
  // pending, approved, rejected
  telegramUsername: text("telegram_username"),
  walletAddress: text("wallet_address"),
  method: text("method").default("telegram"),
  // telegram, wallet
  createdAt: timestamp("created_at").default(sql`now()`),
  processedAt: timestamp("processed_at"),
  adminNotes: text("admin_notes")
});
var referrals = pgTable("referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referrerId: varchar("referrer_id").references(() => users.id).notNull(),
  refereeId: varchar("referee_id").references(() => users.id).notNull(),
  commission: decimal("commission", { precision: 10, scale: 5 }).default("0"),
  createdAt: timestamp("created_at").default(sql`now()`)
});
var botStats = pgTable("bot_stats", {
  id: varchar("id").primaryKey().default("main"),
  totalUsers: integer("total_users").default(0),
  totalAdsWatched: integer("total_ads_watched").default(0),
  totalEarnings: decimal("total_earnings", { precision: 10, scale: 5 }).default("0"),
  totalWithdrawals: decimal("total_withdrawals", { precision: 10, scale: 5 }).default("0"),
  activeUsers24h: integer("active_users_24h").default(0),
  cpmRate: decimal("cpm_rate", { precision: 10, scale: 5 }).default("0.35"),
  // $0.35 per 1000 ads
  earningsPerAd: decimal("earnings_per_ad", { precision: 10, scale: 5 }).default("0.00035"),
  // $0.00035 per ad
  dailyAdLimit: integer("daily_ad_limit").default(250),
  // Max ads per day
  updatedAt: timestamp("updated_at").default(sql`now()`)
});
var insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertWithdrawalRequestSchema = createInsertSchema(withdrawalRequests).omit({
  id: true,
  createdAt: true,
  processedAt: true
});
var insertReferralSchema = createInsertSchema(referrals).omit({
  id: true,
  createdAt: true
});

// server/routes.ts
async function fetchTonPrice() {
  try {
    const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd&include_24hr_change=true");
    const data = await response.json();
    return {
      price: data["the-open-network"]?.usd || 5.42,
      change24h: data["the-open-network"]?.usd_24h_change || 0
    };
  } catch (error) {
    console.error("Failed to fetch TON price:", error);
    return { price: 5.42, change24h: 0 };
  }
}
function generateReferralCode() {
  return "LSATS" + Math.random().toString(36).substr(2, 6).toUpperCase();
}
async function registerRoutes(app2) {
  app2.post("/api/user", async (req, res) => {
    try {
      const { telegramId, username } = req.body;
      if (!telegramId || !username) {
        return res.status(400).json({ error: "Telegram ID and username required" });
      }
      let user = await storage.getUserByTelegramId(telegramId);
      if (!user) {
        const referralCode = generateReferralCode();
        const userData = insertUserSchema.parse({
          telegramId,
          username,
          referralCode
        });
        user = await storage.createUser(userData);
      }
      res.json(user);
    } catch (error) {
      console.error("Error in /api/user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.post("/api/watch-ad", async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "User ID required" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      if (user.banned) {
        return res.status(403).json({ error: "Account has been banned" });
      }
      const now = /* @__PURE__ */ new Date();
      if (user.lastAdWatch && now.getTime() - new Date(user.lastAdWatch).getTime() < 3e3) {
        return res.status(429).json({ error: "Cooldown active" });
      }
      const today = (/* @__PURE__ */ new Date()).toDateString();
      const lastAdToday = user.lastAdWatch ? new Date(user.lastAdWatch).toDateString() : "";
      let dailyAdsWatched = user.dailyAdsWatched;
      if (lastAdToday !== today) {
        dailyAdsWatched = 0;
      }
      const stats = await storage.getBotStats();
      const dailyLimit = stats.dailyAdLimit || 250;
      if (dailyAdsWatched >= dailyLimit) {
        return res.status(429).json({ error: "Daily limit reached" });
      }
      const earnings = parseFloat(stats.earningsPerAd || "0.00035");
      const updatedUser = await storage.updateUser(userId, {
        dailyEarnings: (parseFloat(user.dailyEarnings) + earnings).toFixed(5),
        totalEarnings: (parseFloat(user.totalEarnings) + earnings).toFixed(5),
        adsWatched: user.adsWatched + 1,
        dailyAdsWatched: dailyAdsWatched + 1,
        lastAdWatch: now
      });
      await storage.updateBotStats({
        totalAdsWatched: (stats.totalAdsWatched || 0) + 1,
        totalEarnings: (parseFloat(stats.totalEarnings || "0") + earnings).toFixed(5)
      });
      res.json({
        success: true,
        earnings,
        user: updatedUser
      });
    } catch (error) {
      console.error("Error in /api/watch-ad:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.post("/api/claim-earnings", async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "User ID required" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      if (user.banned) {
        return res.status(403).json({ error: "Account has been banned" });
      }
      if (parseFloat(user.dailyEarnings) <= 0) {
        return res.status(400).json({ error: "No earnings to claim" });
      }
      const claimed = parseFloat(user.dailyEarnings);
      const updatedUser = await storage.updateUser(userId, {
        withdrawBalance: (parseFloat(user.withdrawBalance) + claimed).toFixed(5),
        dailyEarnings: "0"
      });
      res.json({
        success: true,
        claimed: claimed.toFixed(5),
        user: updatedUser
      });
    } catch (error) {
      console.error("Error in /api/claim-earnings:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.post("/api/withdrawal-request", async (req, res) => {
    try {
      const requestData = insertWithdrawalRequestSchema.parse(req.body);
      const user = await storage.getUser(requestData.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const requestAmount = parseFloat(requestData.amount);
      const userBalance = parseFloat(user.withdrawBalance);
      const tonData = await fetchTonPrice();
      const minWithdrawalUSD = tonData.price;
      if (requestAmount < minWithdrawalUSD) {
        return res.status(400).json({ error: `Minimum withdrawal is 1 TON ($${minWithdrawalUSD.toFixed(2)})` });
      }
      if (requestAmount > userBalance) {
        return res.status(400).json({ error: "Insufficient balance" });
      }
      const withdrawalRequest = await storage.createWithdrawalRequest(requestData);
      res.json({
        success: true,
        request: withdrawalRequest
      });
    } catch (error) {
      console.error("Error in /api/withdrawal-request:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.get("/api/user/:userId/withdrawals", async (req, res) => {
    try {
      const { userId } = req.params;
      const requests = await storage.getUserWithdrawalRequests(userId);
      res.json(requests);
    } catch (error) {
      console.error("Error in /api/user/withdrawals:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.get("/api/ton-price", async (req, res) => {
    try {
      const tonData = await fetchTonPrice();
      res.json(tonData);
    } catch (error) {
      console.error("Error in /api/ton-price:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.get("/api/admin/stats", async (req, res) => {
    try {
      const stats = await storage.getBotStats();
      const users2 = await storage.getAllUsers();
      const pendingWithdrawals = await storage.getPendingWithdrawalRequests();
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1e3);
      const activeUsers24h = users2.filter(
        (user) => user.lastAdWatch && new Date(user.lastAdWatch) > twentyFourHoursAgo
      ).length;
      await storage.updateBotStats({ activeUsers24h });
      res.json({
        ...stats,
        activeUsers24h,
        pendingWithdrawals: pendingWithdrawals.length,
        totalPendingAmount: pendingWithdrawals.reduce((sum, req2) => sum + parseFloat(req2.amount), 0)
      });
    } catch (error) {
      console.error("Error in /api/admin/stats:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.get("/api/admin/pending-withdrawals", async (req, res) => {
    try {
      const pendingRequests = await storage.getPendingWithdrawalRequests();
      const enrichedRequests = await Promise.all(
        pendingRequests.map(async (request) => {
          const user = await storage.getUser(request.userId);
          return {
            ...request,
            user: user ? { username: user.username, telegramId: user.telegramId } : null
          };
        })
      );
      res.json(enrichedRequests);
    } catch (error) {
      console.error("Error in /api/admin/pending-withdrawals:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.post("/api/admin/process-withdrawal", async (req, res) => {
    try {
      const { requestId, status, adminNotes } = req.body;
      if (!requestId || !status) {
        return res.status(400).json({ error: "Request ID and status required" });
      }
      const request = await storage.getWithdrawalRequest(requestId);
      if (!request) {
        return res.status(404).json({ error: "Withdrawal request not found" });
      }
      if (status === "approved") {
        const user = await storage.getUser(request.userId);
        if (user) {
          const newBalance = (parseFloat(user.withdrawBalance) - parseFloat(request.amount)).toFixed(5);
          await storage.updateUser(user.id, {
            withdrawBalance: newBalance >= "0" ? newBalance : "0"
          });
          const stats = await storage.getBotStats();
          await storage.updateBotStats({
            totalWithdrawals: (parseFloat(stats.totalWithdrawals || "0") + parseFloat(request.amount)).toFixed(5)
          });
        }
      }
      const updatedRequest = await storage.updateWithdrawalRequest(requestId, {
        status,
        adminNotes: adminNotes || null
      });
      res.json({ success: true, request: updatedRequest });
    } catch (error) {
      console.error("Error in /api/admin/process-withdrawal:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  const checkAdminAccess = (req, res, next) => {
    const adminTelegramId = "6653616672";
    const devMockId = "123456789";
    const { telegramId } = req.body || req.query;
    if (telegramId !== adminTelegramId && telegramId !== devMockId) {
      return res.status(403).json({ error: "Access denied" });
    }
    next();
  };
  app2.get("/api/admin/users", checkAdminAccess, async (req, res) => {
    try {
      const { search, filter } = req.query;
      let users2 = await storage.getAllUsers();
      if (search) {
        const searchLower = search.toLowerCase();
        users2 = users2.filter(
          (user) => user.username.toLowerCase().includes(searchLower) || user.telegramId?.includes(searchLower) || user.id.toLowerCase().includes(searchLower)
        );
      }
      if (filter === "banned") {
        users2 = users2.filter((user) => user.banned);
      } else if (filter === "flagged") {
        users2 = users2.filter((user) => user.flagged);
      } else if (filter === "pending-claims") {
        users2 = users2.filter((user) => parseFloat(user.dailyEarnings) > 0);
      }
      users2.sort((a, b) => {
        const aDate = a.lastAdWatch ? new Date(a.lastAdWatch).getTime() : 0;
        const bDate = b.lastAdWatch ? new Date(b.lastAdWatch).getTime() : 0;
        return bDate - aDate;
      });
      res.json(users2);
    } catch (error) {
      console.error("Error in /api/admin/users:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.post("/api/admin/user/ban", checkAdminAccess, async (req, res) => {
    try {
      const { userId, banned, reason } = req.body;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const updatedUser = await storage.updateUser(userId, {
        banned,
        flagged: banned ? true : user.flagged,
        flagReason: banned ? reason || "Banned by admin" : user.flagReason
      });
      res.json({ success: true, user: updatedUser });
    } catch (error) {
      console.error("Error in /api/admin/user/ban:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.post("/api/admin/user/flag", checkAdminAccess, async (req, res) => {
    try {
      const { userId, flagged, reason } = req.body;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const updatedUser = await storage.updateUser(userId, {
        flagged,
        flagReason: flagged ? reason : null
      });
      res.json({ success: true, user: updatedUser });
    } catch (error) {
      console.error("Error in /api/admin/user/flag:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.post("/api/admin/claim/approve", checkAdminAccess, async (req, res) => {
    try {
      const { userId } = req.body;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      if (parseFloat(user.dailyEarnings) <= 0) {
        return res.status(400).json({ error: "No earnings to approve" });
      }
      const claimed = parseFloat(user.dailyEarnings);
      const updatedUser = await storage.updateUser(userId, {
        withdrawBalance: (parseFloat(user.withdrawBalance) + claimed).toFixed(5),
        dailyEarnings: "0"
      });
      res.json({ success: true, claimed: claimed.toFixed(5), user: updatedUser });
    } catch (error) {
      console.error("Error in /api/admin/claim/approve:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.post("/api/admin/claim/reject", checkAdminAccess, async (req, res) => {
    try {
      const { userId, reason } = req.body;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const updatedUser = await storage.updateUser(userId, {
        dailyEarnings: "0",
        flagged: true,
        flagReason: reason || "Claim rejected by admin"
      });
      res.json({ success: true, user: updatedUser });
    } catch (error) {
      console.error("Error in /api/admin/claim/reject:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.get("/api/admin/export/csv", checkAdminAccess, async (req, res) => {
    try {
      const users2 = await storage.getAllUsers();
      const csvHeader = "Username,Telegram ID,Total Earnings,Withdraw Balance,Ads Watched,Level,Banned,Flagged,Created At\n";
      const csvData = users2.map(
        (user) => `"${user.username}","${user.telegramId}","${user.totalEarnings}","${user.withdrawBalance}",${user.adsWatched},${user.level},${user.banned ? "Yes" : "No"},${user.flagged ? "Yes" : "No"},"${user.createdAt}"`
      ).join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", 'attachment; filename="lightningsats_users.csv"');
      res.send(csvHeader + csvData);
    } catch (error) {
      console.error("Error in /api/admin/export/csv:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.post("/api/admin/update-settings", checkAdminAccess, async (req, res) => {
    try {
      const { earningsPerAd, dailyAdLimit } = req.body;
      const updates = {};
      if (earningsPerAd !== void 0) {
        if (isNaN(parseFloat(earningsPerAd))) {
          return res.status(400).json({ error: "Valid earnings per ad required" });
        }
        updates.earningsPerAd = parseFloat(earningsPerAd).toFixed(5);
        updates.cpmRate = (parseFloat(earningsPerAd) * 1e3).toFixed(2);
      }
      if (dailyAdLimit !== void 0) {
        if (isNaN(parseInt(dailyAdLimit)) || parseInt(dailyAdLimit) < 1) {
          return res.status(400).json({ error: "Valid daily ad limit required" });
        }
        updates.dailyAdLimit = parseInt(dailyAdLimit);
      }
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid updates provided" });
      }
      const updatedStats = await storage.updateBotStats(updates);
      res.json({ success: true, stats: updatedStats });
    } catch (error) {
      console.error("Error in /api/admin/update-settings:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();
