import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertWithdrawalRequestSchema } from "@shared/schema";
import { z } from "zod";

// TON Price API
async function fetchTonPrice() {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd&include_24hr_change=true');
    const data = await response.json();
    return {
      price: data['the-open-network']?.usd || 5.42,
      change24h: data['the-open-network']?.usd_24h_change || 0
    };
  } catch (error) {
    console.error('Failed to fetch TON price:', error);
    return { price: 5.42, change24h: 0 };
  }
}

// Generate referral code
function generateReferralCode(): string {
  return 'LSATS' + Math.random().toString(36).substr(2, 6).toUpperCase();
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Get or create user
  app.post('/api/user', async (req, res) => {
    try {
      const { telegramId, username } = req.body;
      
      if (!telegramId || !username) {
        return res.status(400).json({ error: 'Telegram ID and username required' });
      }

      // Check if user exists
      let user = await storage.getUserByTelegramId(telegramId);
      
      if (!user) {
        // Create new user
        const referralCode = generateReferralCode();
        const userData = insertUserSchema.parse({
          telegramId,
          username,
          referralCode,
        });
        
        user = await storage.createUser(userData);
      }

      res.json(user);
    } catch (error) {
      console.error('Error in /api/user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Watch ad endpoint
  app.post('/api/watch-ad', async (req, res) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if user is banned
      if (user.banned) {
        return res.status(403).json({ error: 'Account has been banned' });
      }

      // Check cooldown (3 seconds)
      const now = new Date();
      if (user.lastAdWatch && (now.getTime() - new Date(user.lastAdWatch).getTime()) < 3000) {
        return res.status(429).json({ error: 'Cooldown active' });
      }

      // Check daily limit
      const today = new Date().toDateString();
      const lastAdToday = user.lastAdWatch ? new Date(user.lastAdWatch).toDateString() : '';
      
      let dailyAdsWatched = user.dailyAdsWatched;
      if (lastAdToday !== today) {
        dailyAdsWatched = 0; // Reset daily count
      }

      // Get current settings and calculate earnings  
      const stats = await storage.getBotStats();
      const dailyLimit = stats.dailyAdLimit || 250;
      if (dailyAdsWatched >= dailyLimit) {
        return res.status(429).json({ error: 'Daily limit reached' });
      }

      const earnings = parseFloat(stats.earningsPerAd || "0.00035");
      const updatedUser = await storage.updateUser(userId, {
        dailyEarnings: (parseFloat(user.dailyEarnings) + earnings).toFixed(5),
        totalEarnings: (parseFloat(user.totalEarnings) + earnings).toFixed(5),
        adsWatched: user.adsWatched + 1,
        dailyAdsWatched: dailyAdsWatched + 1,
        lastAdWatch: now,
      });

      // Update bot stats
      await storage.updateBotStats({
        totalAdsWatched: (stats.totalAdsWatched || 0) + 1,
        totalEarnings: (parseFloat(stats.totalEarnings || "0") + earnings).toFixed(5),
      });

      res.json({ 
        success: true, 
        earnings,
        user: updatedUser 
      });
    } catch (error) {
      console.error('Error in /api/watch-ad:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Claim daily earnings
  app.post('/api/claim-earnings', async (req, res) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if user is banned
      if (user.banned) {
        return res.status(403).json({ error: 'Account has been banned' });
      }

      if (parseFloat(user.dailyEarnings) <= 0) {
        return res.status(400).json({ error: 'No earnings to claim' });
      }

      const claimed = parseFloat(user.dailyEarnings);
      const updatedUser = await storage.updateUser(userId, {
        withdrawBalance: (parseFloat(user.withdrawBalance) + claimed).toFixed(5),
        dailyEarnings: "0",
      });

      res.json({ 
        success: true, 
        claimed: claimed.toFixed(5),
        user: updatedUser 
      });
    } catch (error) {
      console.error('Error in /api/claim-earnings:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Create withdrawal request
  app.post('/api/withdrawal-request', async (req, res) => {
    try {
      const requestData = insertWithdrawalRequestSchema.parse(req.body);
      
      const user = await storage.getUser(requestData.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const requestAmount = parseFloat(requestData.amount);
      const userBalance = parseFloat(user.withdrawBalance);

      // Get current TON price to calculate minimum withdrawal (1 TON)
      const tonData = await fetchTonPrice();
      const minWithdrawalUSD = tonData.price; // 1 TON in USD

      if (requestAmount < minWithdrawalUSD) {
        return res.status(400).json({ error: `Minimum withdrawal is 1 TON ($${minWithdrawalUSD.toFixed(2)})` });
      }

      if (requestAmount > userBalance) {
        return res.status(400).json({ error: 'Insufficient balance' });
      }

      const withdrawalRequest = await storage.createWithdrawalRequest(requestData);

      res.json({ 
        success: true, 
        request: withdrawalRequest 
      });
    } catch (error) {
      console.error('Error in /api/withdrawal-request:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get user withdrawal requests
  app.get('/api/user/:userId/withdrawals', async (req, res) => {
    try {
      const { userId } = req.params;
      const requests = await storage.getUserWithdrawalRequests(userId);
      res.json(requests);
    } catch (error) {
      console.error('Error in /api/user/withdrawals:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get TON price
  app.get('/api/ton-price', async (req, res) => {
    try {
      const tonData = await fetchTonPrice();
      res.json(tonData);
    } catch (error) {
      console.error('Error in /api/ton-price:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Admin endpoints (for Telegram bot integration)
  app.get('/api/admin/stats', async (req, res) => {
    try {
      const stats = await storage.getBotStats();
      const users = await storage.getAllUsers();
      const pendingWithdrawals = await storage.getPendingWithdrawalRequests();
      
      // Calculate active users in last 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const activeUsers24h = users.filter(user => 
        user.lastAdWatch && new Date(user.lastAdWatch) > twentyFourHoursAgo
      ).length;
      
      await storage.updateBotStats({ activeUsers24h });

      res.json({
        ...stats,
        activeUsers24h,
        pendingWithdrawals: pendingWithdrawals.length,
        totalPendingAmount: pendingWithdrawals.reduce((sum, req) => sum + parseFloat(req.amount), 0),
      });
    } catch (error) {
      console.error('Error in /api/admin/stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/admin/pending-withdrawals', async (req, res) => {
    try {
      const pendingRequests = await storage.getPendingWithdrawalRequests();
      
      // Enrich with user data
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
      console.error('Error in /api/admin/pending-withdrawals:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/admin/process-withdrawal', async (req, res) => {
    try {
      const { requestId, status, adminNotes } = req.body;
      
      if (!requestId || !status) {
        return res.status(400).json({ error: 'Request ID and status required' });
      }

      const request = await storage.getWithdrawalRequest(requestId);
      if (!request) {
        return res.status(404).json({ error: 'Withdrawal request not found' });
      }

      if (status === 'approved') {
        // Deduct from user balance
        const user = await storage.getUser(request.userId);
        if (user) {
          const newBalance = (parseFloat(user.withdrawBalance) - parseFloat(request.amount)).toFixed(5);
          await storage.updateUser(user.id, {
            withdrawBalance: newBalance >= "0" ? newBalance : "0"
          });

          // Update bot stats
          const stats = await storage.getBotStats();
          await storage.updateBotStats({
            totalWithdrawals: (parseFloat(stats.totalWithdrawals || "0") + parseFloat(request.amount)).toFixed(5),
          });
        }
      }

      const updatedRequest = await storage.updateWithdrawalRequest(requestId, {
        status,
        adminNotes: adminNotes || null,
      });

      res.json({ success: true, request: updatedRequest });
    } catch (error) {
      console.error('Error in /api/admin/process-withdrawal:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Admin access control middleware
  const checkAdminAccess = (req: any, res: any, next: any) => {
    const adminTelegramId = '6653616672';
    const { telegramId } = req.body || req.query;
    
    if (telegramId !== adminTelegramId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };

  // Admin-only user management endpoints
  app.get('/api/admin/users', checkAdminAccess, async (req, res) => {
    try {
      const { search, filter } = req.query;
      let users = await storage.getAllUsers();
      
      // Apply search filter
      if (search) {
        const searchLower = (search as string).toLowerCase();
        users = users.filter(user => 
          user.username.toLowerCase().includes(searchLower) ||
          user.telegramId?.includes(searchLower) ||
          user.id.toLowerCase().includes(searchLower)
        );
      }
      
      // Apply status filter
      if (filter === 'banned') {
        users = users.filter(user => user.banned);
      } else if (filter === 'flagged') {
        users = users.filter(user => user.flagged);
      } else if (filter === 'pending-claims') {
        users = users.filter(user => parseFloat(user.dailyEarnings) > 0);
      }
      
      // Sort by most recent activity
      users.sort((a, b) => {
        const aDate = a.lastAdWatch ? new Date(a.lastAdWatch).getTime() : 0;
        const bDate = b.lastAdWatch ? new Date(b.lastAdWatch).getTime() : 0;
        return bDate - aDate;
      });
      
      res.json(users);
    } catch (error) {
      console.error('Error in /api/admin/users:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/admin/user/ban', checkAdminAccess, async (req, res) => {
    try {
      const { userId, banned, reason } = req.body;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const updatedUser = await storage.updateUser(userId, {
        banned: banned,
        flagged: banned ? true : user.flagged,
        flagReason: banned ? reason || 'Banned by admin' : user.flagReason,
      });

      res.json({ success: true, user: updatedUser });
    } catch (error) {
      console.error('Error in /api/admin/user/ban:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/admin/user/flag', checkAdminAccess, async (req, res) => {
    try {
      const { userId, flagged, reason } = req.body;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const updatedUser = await storage.updateUser(userId, {
        flagged: flagged,
        flagReason: flagged ? reason : null,
      });

      res.json({ success: true, user: updatedUser });
    } catch (error) {
      console.error('Error in /api/admin/user/flag:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/admin/claim/approve', checkAdminAccess, async (req, res) => {
    try {
      const { userId } = req.body;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (parseFloat(user.dailyEarnings) <= 0) {
        return res.status(400).json({ error: 'No earnings to approve' });
      }

      const claimed = parseFloat(user.dailyEarnings);
      const updatedUser = await storage.updateUser(userId, {
        withdrawBalance: (parseFloat(user.withdrawBalance) + claimed).toFixed(5),
        dailyEarnings: "0",
      });

      res.json({ success: true, claimed: claimed.toFixed(5), user: updatedUser });
    } catch (error) {
      console.error('Error in /api/admin/claim/approve:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/admin/claim/reject', checkAdminAccess, async (req, res) => {
    try {
      const { userId, reason } = req.body;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const updatedUser = await storage.updateUser(userId, {
        dailyEarnings: "0",
        flagged: true,
        flagReason: reason || 'Claim rejected by admin',
      });

      res.json({ success: true, user: updatedUser });
    } catch (error) {
      console.error('Error in /api/admin/claim/reject:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/admin/export/csv', checkAdminAccess, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      
      const csvHeader = 'Username,Telegram ID,Total Earnings,Withdraw Balance,Ads Watched,Level,Banned,Flagged,Created At\n';
      const csvData = users.map(user => 
        `"${user.username}","${user.telegramId}","${user.totalEarnings}","${user.withdrawBalance}",${user.adsWatched},${user.level},${user.banned ? 'Yes' : 'No'},${user.flagged ? 'Yes' : 'No'},"${user.createdAt}"`
      ).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="lightningsats_users.csv"');
      res.send(csvHeader + csvData);
    } catch (error) {
      console.error('Error in /api/admin/export/csv:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Update earnings and limits settings
  app.post('/api/admin/update-settings', checkAdminAccess, async (req, res) => {
    try {
      const { earningsPerAd, dailyAdLimit } = req.body;
      
      const updates: any = {};
      
      if (earningsPerAd !== undefined) {
        if (isNaN(parseFloat(earningsPerAd))) {
          return res.status(400).json({ error: 'Valid earnings per ad required' });
        }
        updates.earningsPerAd = parseFloat(earningsPerAd).toFixed(5);
        updates.cpmRate = (parseFloat(earningsPerAd) * 1000).toFixed(2); // Update CPM too
      }
      
      if (dailyAdLimit !== undefined) {
        if (isNaN(parseInt(dailyAdLimit)) || parseInt(dailyAdLimit) < 1) {
          return res.status(400).json({ error: 'Valid daily ad limit required' });
        }
        updates.dailyAdLimit = parseInt(dailyAdLimit);
      }
      
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No valid updates provided' });
      }

      const updatedStats = await storage.updateBotStats(updates);

      res.json({ success: true, stats: updatedStats });
    } catch (error) {
      console.error('Error in /api/admin/update-settings:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
