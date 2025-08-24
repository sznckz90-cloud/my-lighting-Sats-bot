import { type User, type InsertUser, type WithdrawalRequest, type InsertWithdrawalRequest, type Referral, type InsertReferral, type BotStats } from "@shared/schema";
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

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private withdrawalRequests: Map<string, WithdrawalRequest>;
  private referrals: Map<string, Referral>;
  private botStats: BotStats;

  constructor() {
    this.users = new Map();
    this.withdrawalRequests = new Map();
    this.referrals = new Map();
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
      updatedAt: new Date(),
    };
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByTelegramId(telegramId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.telegramId === telegramId);
  }

  async getUserByReferralCode(referralCode: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.referralCode === referralCode);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      withdrawBalance: (insertUser.withdrawBalance as any) || "0",
      dailyEarnings: (insertUser.dailyEarnings as any) || "0",
      totalEarnings: (insertUser.totalEarnings as any) || "0",
      adsWatched: (insertUser.adsWatched as any) || 0,
      dailyAdsWatched: (insertUser.dailyAdsWatched as any) || 0,
      level: (insertUser.level as any) || 1,
      lastAdWatch: (insertUser.lastAdWatch as any) || null,
      referredBy: (insertUser.referredBy as any) || null,
      banned: (insertUser.banned as any) || false,
      flagged: (insertUser.flagged as any) || false,
      flagReason: (insertUser.flagReason as any) || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(id, user);
    
    // Update bot stats
    if (this.botStats.totalUsers !== null) {
      this.botStats.totalUsers += 1;
    }
    this.botStats.updatedAt = new Date();
    
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const user = this.users.get(id);
    if (!user) {
      throw new Error("User not found");
    }
    
    const updatedUser = { ...user, ...updates, updatedAt: new Date() };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async createWithdrawalRequest(insertRequest: InsertWithdrawalRequest): Promise<WithdrawalRequest> {
    const id = randomUUID();
    const request: WithdrawalRequest = {
      ...insertRequest,
      id,
      status: "pending",
      createdAt: new Date(),
      processedAt: null,
      adminNotes: null,
      telegramUsername: insertRequest.telegramUsername || null,
      walletAddress: insertRequest.walletAddress || null,
      method: insertRequest.method || null,
    };
    this.withdrawalRequests.set(id, request);
    return request;
  }

  async getWithdrawalRequest(id: string): Promise<WithdrawalRequest | undefined> {
    return this.withdrawalRequests.get(id);
  }

  async getUserWithdrawalRequests(userId: string): Promise<WithdrawalRequest[]> {
    return Array.from(this.withdrawalRequests.values()).filter(req => req.userId === userId);
  }

  async updateWithdrawalRequest(id: string, updates: Partial<WithdrawalRequest>): Promise<WithdrawalRequest> {
    const request = this.withdrawalRequests.get(id);
    if (!request) {
      throw new Error("Withdrawal request not found");
    }
    
    const updatedRequest = { ...request, ...updates };
    if (updates.status && updates.status !== "pending") {
      updatedRequest.processedAt = new Date();
    }
    
    this.withdrawalRequests.set(id, updatedRequest);
    return updatedRequest;
  }

  async getPendingWithdrawalRequests(): Promise<WithdrawalRequest[]> {
    return Array.from(this.withdrawalRequests.values()).filter(req => req.status === "pending");
  }

  async createReferral(insertReferral: InsertReferral): Promise<Referral> {
    const id = randomUUID();
    const referral: Referral = {
      ...insertReferral,
      id,
      commission: insertReferral.commission || "0",
      createdAt: new Date(),
    };
    this.referrals.set(id, referral);
    return referral;
  }

  async getUserReferrals(userId: string): Promise<Referral[]> {
    return Array.from(this.referrals.values()).filter(ref => ref.referrerId === userId);
  }

  async getBotStats(): Promise<BotStats> {
    return this.botStats;
  }

  async updateBotStats(updates: Partial<BotStats>): Promise<BotStats> {
    this.botStats = { ...this.botStats, ...updates, updatedAt: new Date() };
    return this.botStats;
  }
}

export const storage = new MemStorage();
