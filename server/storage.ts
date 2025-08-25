import { users, withdrawalRequests, referrals, botStats, type User, type InsertUser, type WithdrawalRequest, type InsertWithdrawalRequest, type Referral, type InsertReferral, type BotStats } from "@shared/schema";
import { db } from "./db";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByTelegramId(telegramId: string): Promise<User | undefined>;
  getUserByReferralCode(referralCode: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  getAllUsers(): Promise<User[]>;
  
  // Withdrawal operations
  createWithdrawalRequest(request: InsertWithdrawalRequest): Promise<WithdrawalRequest>;
  getWithdrawalRequest(id: string): Promise<WithdrawalRequest | undefined>;
  getUserWithdrawalRequests(userId: string): Promise<WithdrawalRequest[]>;
  updateWithdrawalRequest(id: string, updates: Partial<WithdrawalRequest>): Promise<WithdrawalRequest>;
  getPendingWithdrawalRequests(): Promise<WithdrawalRequest[]>;
  
  // Referral operations
  createReferral(referral: InsertReferral): Promise<Referral>;
  getUserReferrals(userId: string): Promise<Referral[]>;
  
  // Bot stats operations
  getBotStats(): Promise<BotStats>;
  updateBotStats(updates: Partial<BotStats>): Promise<BotStats>;
}

export class DatabaseStorage implements IStorage {
  // Initialize default bot stats if they don't exist
  async ensureBotStats(): Promise<void> {
    const [existingStats] = await db.select().from(botStats).where(eq(botStats.id, "main"));
    if (!existingStats) {
      await db.insert(botStats).values({
        id: "main",
        totalUsers: 0,
        totalAdsWatched: 0,
        totalEarnings: "0",
        totalWithdrawals: "0",
        activeUsers24h: 0,
        cpmRate: "0.35",
        earningsPerAd: "0.00035",
        dailyAdLimit: 250,
      });
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByTelegramId(telegramId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.telegramId, telegramId));
    return user || undefined;
  }

  async getUserByReferralCode(referralCode: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.referralCode, referralCode));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    
    // Update bot stats
    await this.ensureBotStats();
    await db
      .update(botStats)
      .set({
        totalUsers: sql`${botStats.totalUsers} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(botStats.id, "main"));
    
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
      
    if (!updatedUser) {
      throw new Error("User not found");
    }
    
    return updatedUser;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createWithdrawalRequest(insertRequest: InsertWithdrawalRequest): Promise<WithdrawalRequest> {
    const [request] = await db
      .insert(withdrawalRequests)
      .values(insertRequest)
      .returning();
    
    return request;
  }

  async getWithdrawalRequest(id: string): Promise<WithdrawalRequest | undefined> {
    const [request] = await db.select().from(withdrawalRequests).where(eq(withdrawalRequests.id, id));
    return request || undefined;
  }

  async getUserWithdrawalRequests(userId: string): Promise<WithdrawalRequest[]> {
    return await db.select().from(withdrawalRequests).where(eq(withdrawalRequests.userId, userId));
  }

  async updateWithdrawalRequest(id: string, updates: Partial<WithdrawalRequest>): Promise<WithdrawalRequest> {
    const updateData = { ...updates };
    if (updates.status && updates.status !== "pending") {
      updateData.processedAt = new Date();
    }
    
    const [updatedRequest] = await db
      .update(withdrawalRequests)
      .set(updateData)
      .where(eq(withdrawalRequests.id, id))
      .returning();
      
    if (!updatedRequest) {
      throw new Error("Withdrawal request not found");
    }
    
    return updatedRequest;
  }

  async getPendingWithdrawalRequests(): Promise<WithdrawalRequest[]> {
    return await db.select().from(withdrawalRequests).where(eq(withdrawalRequests.status, "pending"));
  }

  async createReferral(insertReferral: InsertReferral): Promise<Referral> {
    const [referral] = await db
      .insert(referrals)
      .values(insertReferral)
      .returning();
    
    return referral;
  }

  async getUserReferrals(userId: string): Promise<Referral[]> {
    return await db.select().from(referrals).where(eq(referrals.referrerId, userId));
  }

  async getBotStats(): Promise<BotStats> {
    await this.ensureBotStats();
    const [stats] = await db.select().from(botStats).where(eq(botStats.id, "main"));
    return stats!;
  }

  async updateBotStats(updates: Partial<BotStats>): Promise<BotStats> {
    await this.ensureBotStats();
    const [updatedStats] = await db
      .update(botStats)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(botStats.id, "main"))
      .returning();
    
    return updatedStats!;
  }
}

export const storage = new DatabaseStorage();
