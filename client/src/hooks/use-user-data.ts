import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback, useEffect } from "react";
import { getOrCreateUser, watchAd, claimEarnings, type WatchAdResponse, type ClaimEarningsResponse } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@shared/schema";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initDataUnsafe?: {
          user?: {
            id: string;
            username?: string;
          };
        };
        ready?: () => void;
      };
    };
  }
}

export function useUserData() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [telegramUser, setTelegramUser] = useState<{ id: string; username: string } | null>(null);

  // Initialize Telegram user data
  useEffect(() => {
    const initTelegramUser = () => {
      if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initDataUnsafe?.user) {
        const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
        setTelegramUser({
          id: tgUser.id,
          username: tgUser.username || `user_${tgUser.id}`,
        });
      } else {
        // Fallback for development
        setTelegramUser({
          id: "dev_user_123",
          username: "dev_user",
        });
      }
    };

    // Try immediately
    initTelegramUser();

    // Also try after a short delay in case Telegram WebApp isn't ready yet
    const timeout = setTimeout(initTelegramUser, 100);

    return () => clearTimeout(timeout);
  }, []);

  // Fetch or create user
  const { data: user, isLoading: userLoading, error: userError } = useQuery({
    queryKey: ["user", telegramUser?.id],
    queryFn: async () => {
      if (!telegramUser) throw new Error("No Telegram user data");
      return await getOrCreateUser(telegramUser.id, telegramUser.username);
    },
    enabled: !!telegramUser,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: 1000,
  });

  // Watch ad mutation
  const watchAdMutation = useMutation({
    mutationFn: (userId: string) => watchAd(userId),
    onSuccess: (data: WatchAdResponse) => {
      if (data.success) {
        queryClient.setQueryData(["user", telegramUser?.id], data.user);
        toast({
          title: "Ad watched successfully!",
          description: `You earned ${data.earnings} sats!`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error watching ad",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Claim earnings mutation
  const claimEarningsMutation = useMutation({
    mutationFn: (userId: string) => claimEarnings(userId),
    onSuccess: (data: ClaimEarningsResponse) => {
      if (data.success) {
        queryClient.setQueryData(["user", telegramUser?.id], data.user);
        toast({
          title: "Earnings claimed!",
          description: `You claimed ${data.claimed} sats!`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error claiming earnings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Helper functions
  const canWatchAd = useCallback(() => {
    if (!user) return false;

    const now = new Date();
    const lastAdWatch = user.lastAdWatch ? new Date(user.lastAdWatch) : null;

    if (!lastAdWatch) return true;

    const cooldownMs = 30 * 1000; // 30 seconds
    const timeSinceLastAd = now.getTime() - lastAdWatch.getTime();

    return timeSinceLastAd >= cooldownMs;
  }, [user]);

  const getCooldownRemaining = useCallback(() => {
    if (!user?.lastAdWatch) return 0;

    const now = new Date();
    const lastAdWatch = new Date(user.lastAdWatch);
    const cooldownMs = 30 * 1000; // 30 seconds
    const timeSinceLastAd = now.getTime() - lastAdWatch.getTime();
    const remaining = Math.max(0, cooldownMs - timeSinceLastAd);

    return Math.ceil(remaining / 1000);
  }, [user]);

  const getDailyProgress = useCallback(() => {
    if (!user) return { current: 0, max: 10, percentage: 0 };

    const today = new Date().toISOString().split('T')[0];
    const todayAds = user.dailyAdCount || 0;
    const maxDaily = 10;

    return {
      current: todayAds,
      max: maxDaily,
      percentage: Math.min((todayAds / maxDaily) * 100, 100),
    };
  }, [user]);

  const canClaimEarnings = useCallback(() => {
    if (!user) return false;
    return parseFloat(user.pendingEarnings || "0") > 0;
  }, [user]);

  return {
    user,
    isLoading: userLoading,
    error: userError,
    watchAdMutation,
    claimEarningsMutation,
    canWatchAd,
    getCooldownRemaining,
    getDailyProgress,
    canClaimEarnings,
  };
}