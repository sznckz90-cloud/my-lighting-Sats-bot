import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getOrCreateUser, watchAd, claimEarnings, createWithdrawalRequest } from '@/lib/api';
import { getTelegramUser, getMockTelegramUser, isTelegramEnvironment } from '@/lib/telegram';
import { useToast } from '@/hooks/use-toast';
import { useTonPrice } from '@/hooks/use-ton-price';
import type { User } from '@shared/schema';

export function useUserData() {
  const [userId, setUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { tonPrice } = useTonPrice();

  // Initialize Telegram WebApp
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      console.log('Initializing Telegram WebApp...');
      window.Telegram.WebApp.ready();
      
      // Log Telegram environment status
      console.log('Telegram WebApp available:', !!window.Telegram?.WebApp);
      console.log('User data available:', !!window.Telegram?.WebApp?.initDataUnsafe?.user);
      
      if (window.Telegram.WebApp.initDataUnsafe?.user) {
        console.log('Real Telegram user detected:', window.Telegram.WebApp.initDataUnsafe.user.id);
      } else {
        console.log('No Telegram user data - will use mock data for development');
      }
    } else {
      console.log('Not in Telegram environment - using mock data');
    }
  }, []);

  // Initialize user
  const { data: user, isLoading: isLoadingUser, error } = useQuery({
    queryKey: ['/api/user'],
    queryFn: async () => {
      let telegramUser;
      const isInTelegram = isTelegramEnvironment();
      
      console.log('Fetching user data - In Telegram environment:', isInTelegram);
      
      try {
        telegramUser = isInTelegram ? getTelegramUser() : getMockTelegramUser();
        console.log('Using Telegram user:', { 
          id: telegramUser.id, 
          username: telegramUser.username, 
          source: isInTelegram ? 'real' : 'mock' 
        });
      } catch (error) {
        console.warn('Failed to get Telegram user, using mock:', error);
        telegramUser = getMockTelegramUser();
        console.log('Fallback to mock user:', { id: telegramUser.id });
      }
      
      if (!telegramUser) {
        throw new Error('No Telegram user data available');
      }

      const user = await getOrCreateUser(
        telegramUser.id.toString(),
        telegramUser.username || `${telegramUser.first_name} ${telegramUser.last_name || ''}`.trim()
      );
      
      console.log('Created/fetched user with telegramId:', user.telegramId);
      setUserId(user.id);
      return user;
    },
    enabled: true,
    retry: 1,
  });

  // Watch ad mutation
  const watchAdMutation = useMutation({
    mutationFn: () => {
      if (!userId) throw new Error('User not initialized');
      return watchAd(userId);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['/api/user'], data.user);
      toast({
        variant: "success",
        title: "Ad Completed!",
        description: `+$${data.earnings.toFixed(5)} earned`,
      });
    },
    onError: (error: any) => {
      let message = "Failed to watch ad";
      if (error.message.includes('429')) {
        if (error.message.includes('Cooldown')) {
          message = "Please wait 3 seconds before next ad";
        } else if (error.message.includes('Daily limit')) {
          message = "Daily limit reached (250 ads)";
        }
      }
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      });
    },
  });

  // Claim earnings mutation
  const claimEarningsMutation = useMutation({
    mutationFn: () => {
      if (!userId) throw new Error('User not initialized');
      return claimEarnings(userId);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['/api/user'], data.user);
      toast({
        variant: "success",
        title: "Earnings Claimed!",
        description: `$${data.claimed} added to balance`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to claim earnings",
      });
    },
  });

  // Withdrawal request mutation
  const withdrawalMutation = useMutation({
    mutationFn: (params: { amount: string; method: string; telegramUsername?: string; walletAddress?: string }) => {
      if (!userId) throw new Error('User not initialized');
      return createWithdrawalRequest(userId, params.amount, params.telegramUsername, params.walletAddress, params.method);
    },
    onSuccess: () => {
      toast({
        variant: "success",
        title: "Withdrawal Requested",
        description: "Your request has been sent to admin for approval",
      });
    },
    onError: (error: any) => {
      let message = "Failed to create withdrawal request";
      if (error.message.includes('Minimum')) {
        message = "Minimum withdrawal is $1.00";
      } else if (error.message.includes('Insufficient')) {
        message = "Insufficient balance";
      }
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      });
    },
  });

  // Helper functions
  const canWatchAd = () => {
    if (!user) return false;
    
    const now = Date.now();
    const lastAdWatch = user.lastAdWatch ? new Date(user.lastAdWatch).getTime() : 0;
    const cooldownExpired = now - lastAdWatch >= 3000; // 3 seconds
    
    // Check if it's a new day to reset daily count
    const today = new Date().toDateString();
    const lastAdToday = user.lastAdWatch ? new Date(user.lastAdWatch).toDateString() : '';
    const dailyCount = lastAdToday === today ? user.dailyAdsWatched : 0;
    
    return cooldownExpired && dailyCount < 250;
  };

  const getCooldownRemaining = () => {
    if (!user || !user.lastAdWatch) return 0;
    
    const now = Date.now();
    const lastAdWatch = new Date(user.lastAdWatch).getTime();
    const remaining = Math.max(0, 3000 - (now - lastAdWatch));
    
    return Math.ceil(remaining / 1000);
  };

  const getDailyProgress = () => {
    if (!user) return { current: 0, max: 250, percentage: 0 };
    
    const today = new Date().toDateString();
    const lastAdToday = user.lastAdWatch ? new Date(user.lastAdWatch).toDateString() : '';
    const current = lastAdToday === today ? user.dailyAdsWatched : 0;
    const max = 250;
    const percentage = (current / max) * 100;
    
    return { current, max, percentage: Math.min(percentage, 100) };
  };

  const canClaimEarnings = () => {
    if (!user) return false;
    
    // Get current day's ad count
    const today = new Date().toDateString();
    const lastAdToday = user.lastAdWatch ? new Date(user.lastAdWatch).toDateString() : '';
    const todayAdsWatched = lastAdToday === today ? user.dailyAdsWatched : 0;
    
    // Can claim if watched at least 10 ads and has earnings
    return parseFloat(user.dailyEarnings) > 0 && todayAdsWatched >= 10 && todayAdsWatched % 10 === 0;
  };

  const canWithdraw = (amount: number) => {
    const minWithdrawalUSD = tonPrice; // 1 TON in USD
    return user && amount >= minWithdrawalUSD && amount <= parseFloat(user.withdrawBalance);
  };

  return {
    user,
    userId,
    isLoadingUser,
    error,
    watchAdMutation,
    claimEarningsMutation,
    withdrawalMutation,
    canWatchAd,
    getCooldownRemaining,
    getDailyProgress,
    canClaimEarnings,
    canWithdraw,
  };
}
