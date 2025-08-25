import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertWithdrawalRequestSchema } from "@shared/schema";
import { z } from "zod";


// Generate referral code
function generateReferralCode(): string {
  return 'LSATS' + Math.random().toString(36).substr(2, 6).toUpperCase();
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Admin access control middleware (must be defined first)
  const checkAdminAccess = (req: any, res: any, next: any) => {
    const adminTelegramId = '6653616672';
    const telegramId = req.body?.telegramId || req.query?.telegramId;
    
    if (telegramId !== adminTelegramId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };
  
  // Channel join validation function
  const checkChannelMembership = async (telegramId: string) => {
    try {
      // In production, you would make actual Telegram API call here
      // For now, return true to allow development
      const channelId = "-1002480439556";
      
      // TODO: Implement actual Telegram Bot API call to check membership
      // const member = await bot.telegram.getChatMember(channelId, telegramId);
      // return member.status !== 'left' && member.status !== 'kicked';
      
      console.log(`Checking channel membership for user ${telegramId} in ${channelId}`);
      return true; // Allow for development
    } catch (error) {
      console.error('Channel membership check failed:', error);
      return false;
    }
  };
  
  // Monetag Ad Callback Endpoint
  app.post('/ads/callback', async (req, res) => {
    try {
      const { userId, status, reward } = req.body;
      console.log('Monetag callback received:', { userId, status, reward });
      
      if (status === 'completed' && userId) {
        const user = await storage.getUser(userId);
        if (!user || user.banned) {
          return res.json({ success: false, error: 'User not found or banned' });
        }
        
        // Get bot stats for earnings calculation
        const stats = await storage.getBotStats();
        const earnings = parseFloat(stats.earningsPerAd || "0.00035");
        
        // Update user earnings
        await storage.updateUser(userId, {
          dailyEarnings: (parseFloat(user.dailyEarnings || "0") + earnings).toFixed(5),
          totalEarnings: (parseFloat(user.totalEarnings || "0") + earnings).toFixed(5),
          adsWatched: (user.adsWatched || 0) + 1,
          dailyAdsWatched: (user.dailyAdsWatched || 0) + 1,
          lastAdWatch: new Date(),
        });
        
        console.log(`Ad reward processed for user ${userId}: +$${earnings}`);
        return res.json({ success: true });
      }
      
      res.json({ success: false });
    } catch (error) {
      console.error('Monetag callback error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });
  
  // Get or create user
  app.post('/api/user', async (req, res) => {
    try {
      const { telegramId, username, referralCode: referrerCode } = req.body;
      
      if (!telegramId || !username) {
        return res.status(400).json({ error: 'Telegram ID and username required' });
      }

      // Check if user exists
      let user = await storage.getUserByTelegramId(telegramId);
      
      if (!user) {
        // Create new user
        const referralCode = generateReferralCode();
        let referredBy = null;
        
        // Handle referral if referrerCode provided
        if (referrerCode) {
          const referrer = await storage.getUserByReferralCode(referrerCode);
          if (referrer) {
            referredBy = referrer.id;
            console.log(`New user ${telegramId} referred by ${referrerCode}`);
          }
        }
        
        const userData = insertUserSchema.parse({
          telegramId,
          username,
          referralCode,
          referredBy,
        });
        
        user = await storage.createUser(userData);
        
        // Create referral record if referred
        if (referredBy) {
          await storage.createReferral({
            referrerId: referredBy,
            refereeId: user.id,
            commission: "0"
          });
          console.log(`Referral record created: ${referredBy} -> ${user.id}`);
        }
      }

      res.json(user);
    } catch (error) {
      console.error('Error in /api/user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Watch ad endpoint with channel membership check
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

      // Skip channel membership check in development
      if (process.env.NODE_ENV === 'production') {
        const isMember = await checkChannelMembership(user.telegramId || "");
        if (!isMember) {
          return res.status(403).json({ 
            error: 'Channel membership required',
            channelUrl: 'https://t.me/TesterMen'
          });
        }
      }

      // Check cooldown (3 seconds)
      const now = new Date();
      if (user.lastAdWatch && (now.getTime() - new Date(user.lastAdWatch).getTime()) < 3000) {
        return res.status(429).json({ error: 'Cooldown active' });
      }

      // Check daily limit
      const today = new Date().toDateString();
      const lastAdToday = user.lastAdWatch ? new Date(user.lastAdWatch).toDateString() : '';
      
      let dailyAdsWatched = user.dailyAdsWatched || 0;
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
        dailyEarnings: (parseFloat(user.dailyEarnings || "0") + earnings).toFixed(5),
        totalEarnings: (parseFloat(user.totalEarnings || "0") + earnings).toFixed(5),
        adsWatched: (user.adsWatched || 0) + 1,
        dailyAdsWatched: dailyAdsWatched + 1,
        lastAdWatch: now,
      });

      // Update bot stats
      await storage.updateBotStats({
        totalAdsWatched: (stats.totalAdsWatched || 0) + 1,
        totalEarnings: (parseFloat(stats.totalEarnings || "0") + earnings).toFixed(5),
      });

      // Process referral commission if user was referred
      if (user.referredBy) {
        const referrer = await storage.getUser(user.referredBy);
        if (referrer) {
          const commission = earnings * 0.1; // 10% commission
          await storage.updateUser(referrer.id, {
            totalEarnings: (parseFloat(referrer.totalEarnings || "0") + commission).toFixed(5),
            dailyEarnings: (parseFloat(referrer.dailyEarnings || "0") + commission).toFixed(5),
          });
          
          // Update referral record
          const referrals = await storage.getUserReferrals(referrer.id);
          const referralRecord = referrals.find(r => r.refereeId === user.id);
          if (referralRecord) {
            const newCommission = parseFloat(referralRecord.commission || "0") + commission;
            console.log(`Referral commission: +$${commission.toFixed(5)} to ${referrer.telegramId || "unknown"}`);
          }
        }
      }

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

      if (parseFloat(user.dailyEarnings || "0") <= 0) {
        return res.status(400).json({ error: 'No earnings to claim' });
      }

      const claimed = parseFloat(user.dailyEarnings || "0");
      const updatedUser = await storage.updateUser(userId, {
        withdrawBalance: (parseFloat(user.withdrawBalance || "0") + claimed).toFixed(5),
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
      const userBalance = parseFloat(user.withdrawBalance || "0");

      // Minimum withdrawal is $1.00
      const minWithdrawalUSD = 1.00;

      if (requestAmount < minWithdrawalUSD) {
        return res.status(400).json({ error: `Minimum withdrawal is $${minWithdrawalUSD.toFixed(2)}` });
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


  // Get user referrals
  app.get('/api/user/:userId/referrals', async (req, res) => {
    try {
      const { userId } = req.params;
      const referrals = await storage.getUserReferrals(userId);
      
      // Enrich with referee data  
      const enrichedReferrals = await Promise.all(
        referrals.map(async (referral) => {
          const referee = await storage.getUser(referral.refereeId);
          return {
            ...referral,
            referee: referee ? { 
              username: referee.username, 
              totalEarnings: referee.totalEarnings,
              adsWatched: referee.adsWatched 
            } : null
          };
        })
      );
      
      res.json(enrichedReferrals);
    } catch (error) {
      console.error('Error in /api/user/referrals:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Telegram Bot Webhook Handler - Add this for bot integration
  app.post('/bot/webhook', async (req, res) => {
    try {
      const { message, callback_query } = req.body;
      
      if (message) {
        const { from, text, chat } = message;
        console.log(`Bot message from ${from.id}: ${text}`);
        
        // Handle /start command
        if (text && text.startsWith('/start')) {
          const startParam = text.split(' ')[1]; // Extract referral code if present
          
          const welcomeMessage = `👋 Welcome to LightingSats!\n\n` +
            `💰 Earn money by watching ads\n` +
            `👥 Invite friends for 10% commission\n` +
            `💎 Daily earnings up to $0.0875 (250 ads)\n\n` +
            `🚀 Open the app to start earning:`;
            
          console.log(`Welcome message sent to ${from.id}`);
          console.log('Start parameter:', startParam || 'none');
          
          // Store referral info if provided
          if (startParam) {
            console.log(`User ${from.id} came via referral: ${startParam}`);
          }
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Bot webhook error:', error);
      res.status(500).json({ success: false });
    }
  });

  // Admin endpoints (for Telegram bot integration)
  app.get('/api/admin/stats', checkAdminAccess, async (req, res) => {
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

  app.get('/api/admin/pending-withdrawals', checkAdminAccess, async (req, res) => {
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

  app.post('/api/admin/process-withdrawal', checkAdminAccess, async (req, res) => {
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
          const newBalance = (parseFloat(user.withdrawBalance || "0") - parseFloat(request.amount)).toFixed(5);
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

  app.post('/api/admin/claim/approve', checkAdminAccess, async (req, res) => {
    try {
      const { userId } = req.body;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const claimed = parseFloat(user.dailyEarnings || "0");
      if (claimed <= 0) {
        return res.status(400).json({ error: 'No earnings to approve' });
      }

      const updatedUser = await storage.updateUser(userId, {
        withdrawBalance: (parseFloat(user.withdrawBalance || "0") + claimed).toFixed(5),
        dailyEarnings: "0",
      });

      res.json({ success: true, user: updatedUser });
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
      });

      res.json({ success: true, user: updatedUser });
    } catch (error) {
      console.error('Error in /api/admin/claim/reject:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}