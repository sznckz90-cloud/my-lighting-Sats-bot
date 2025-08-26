import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useUserData } from "@/hooks/use-user-data";
import { useState, useEffect } from "react";

export default function Home() {
  const {
    user,
    watchAdMutation,
    claimEarningsMutation,
    canWatchAd,
    getCooldownRemaining,
    getDailyProgress,
    canClaimEarnings,
  } = useUserData();

  const [cooldown, setCooldown] = useState(0);
  const [isWatchingAd, setIsWatchingAd] = useState(false);

  const dailyProgress = getDailyProgress();

  // Monetag SDK Integration
  useEffect(() => {
    const existingScript = document.querySelector("script[src*='libtl.com/sdk.js']");
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = '//libtl.com/sdk.js';
      script.setAttribute('data-zone', '9368336');
      script.setAttribute('data-sdk', 'show_9368336');
      script.setAttribute('data-cfasync', 'false');
      document.body.appendChild(script);
      console.log('Monetag SDK injected.');
    } else {
      console.log('Monetag SDK already present.');
    }
  }, []);

  useEffect(() => {
    let retries = 0;
    const maxRetries = 5; // Reduce max retries
    let timeoutId: NodeJS.Timeout;

    const checkAdReady = () => {
      if (typeof (window as any).show_9368336 === 'function') {
        console.log('Monetag ads ready!');
        return;
      } 
      
      if (retries < maxRetries) {
        retries++;
        timeoutId = setTimeout(checkAdReady, 1000); // Faster retry interval
      } else {
        console.warn('Monetag ads failed to initialize.');
      }
    };

    // Start checking faster
    timeoutId = setTimeout(checkAdReady, 1000);
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const initInAppInterstitial = () => {
    if (typeof (window as any).show_9368336 === 'function') {
      try {
        (window as any).show_9368336({
          type: 'inApp',
          inAppSettings: {
            frequency: 2,
            capping: 0.1,
            interval: 30,
            timeout: 5,
            everyPage: false
          }
        });
        console.log('In-app interstitial initialized.');
      } catch (error) {
        console.error('In-app interstitial failed:', error);
      }
    } else {
      console.log('Monetag SDK not ready for in-app ads');
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      initInAppInterstitial();
    }, 5000); // Wait 5 seconds for SDK to load
    
    return () => clearTimeout(timer);
  }, []);

  // Update cooldown timer
  useEffect(() => {
    const updateCooldown = () => {
      setCooldown(getCooldownRemaining());
    };

    updateCooldown();
    const interval = setInterval(updateCooldown, 1000);

    return () => clearInterval(interval);
  }, [user?.lastAdWatch, getCooldownRemaining]);

  const showRewardedInterstitial = async () => {
    if (!canWatchAd() || isWatchingAd) return;
    
    setIsWatchingAd(true);
    let adShown = false;
    
    try {
      if (typeof (window as any).show_9368336 === 'function') {
        console.log('Attempting to show Monetag ad...');
        await (window as any).show_9368336();
        console.log('Monetag ad completed successfully');
        adShown = true;
      } else {
        console.log('Monetag SDK not available, using quick fallback');
        await new Promise(resolve => setTimeout(resolve, 1500)); // Reduced from 3 to 1.5 seconds
        adShown = true;
      }
      
      // Always give reward after ad is shown or fallback timer completes
      if (adShown) {
        console.log('Processing reward for completed ad...');
        await watchAdMutation.mutateAsync();
        console.log('Reward processed successfully');
      }
    } catch (error) {
      console.error('Ad system error:', error);
      console.log('Using quick fallback and giving reward anyway...');
      // Even if ad fails, wait shorter time and give reward (better UX)
      await new Promise(resolve => setTimeout(resolve, 1500));
      try {
        await watchAdMutation.mutateAsync();
        console.log('Fallback reward processed successfully');
      } catch (rewardError) {
        console.error('Failed to process reward:', rewardError);
      }
    } finally {
      setIsWatchingAd(false);
    }
  };

  const handleWatchAd = showRewardedInterstitial;

  const showRewardedPopup = async () => {
    if (!canClaimEarnings()) return;
    
    setIsWatchingAd(true);
    try {
      if (typeof (window as any).show_9368336 === 'function') {
        await (window as any).show_9368336();
        console.log('Rewarded popup shown for claiming');
      } else {
        console.log('Monetag SDK not available for claiming');
        await new Promise(resolve => setTimeout(resolve, 1000)); // Reduced to 1 second
      }
      claimEarningsMutation.mutate();
    } catch (error) {
      console.warn('Rewarded popup failed:', error);
      claimEarningsMutation.mutate();
    } finally {
      setIsWatchingAd(false);
    }
  };

  const handleClaimEarnings = showRewardedPopup;

  if (!user) {
    return (
      <div className="space-y-6">
        <Card className="gradient-border p-6" data-testid="card-loading-home">
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="loading-pulse mb-4">
                <i className="fas fa-coins text-4xl text-primary"></i>
              </div>
              <p className="text-white mb-2">Starting your earning journey...</p>
              <p className="text-sm text-muted-foreground">Loading your profile and earnings</p>
            </div>
          </div>
        </Card>
        
        {/* Show placeholder content to prevent feeling stuck */}
        <div className="space-y-3 opacity-50">
          <Button 
            disabled
            className="w-full btn-primary-gradient text-white font-semibold py-4 px-6 gap-3"
          >
            <i className="fas fa-play"></i>
            <span>Watch Ad & Earn</span>
          </Button>
          <Button 
            disabled
            className="w-full btn-secondary text-white font-semibold py-4 px-6 gap-3"
          >
            <i className="fas fa-gift"></i>
            <span>Claim Earnings</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Balance Cards */}
      <div className="space-y-4">
        {/* Withdraw Balance Card */}
        <Card className="gradient-border p-5" data-testid="card-withdraw-balance">
          <div className="flex items-center gap-2 mb-2">
            <i className="fas fa-wallet text-primary"></i>
            <span className="text-white font-medium">Withdraw Balance</span>
          </div>
          <div className="text-3xl font-bold text-white mb-1" data-testid="text-withdraw-balance">
            ${parseFloat(user.withdrawBalance || "0").toFixed(5)}
          </div>
          <div className="text-sm text-muted-foreground">Available for withdrawal</div>
        </Card>

        {/* Today's Earnings Card */}
        <Card className="bg-card border border-border p-5" data-testid="card-daily-earnings">
          <div className="flex items-center gap-2 mb-2">
            <i className="fas fa-coins text-green-500"></i>
            <span className="text-white font-medium">Today's Earnings</span>
          </div>
          <div className="text-3xl font-bold text-green-500 mb-1" data-testid="text-daily-earnings">
            ${parseFloat(user.dailyEarnings || "0").toFixed(5)}
          </div>
          <div className="text-sm text-muted-foreground">Earned from watching ads</div>
        </Card>
      </div>

      {/* Progress Section */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-white font-medium">Daily Progress</span>
          <span className="text-muted-foreground text-sm" data-testid="text-progress">
            {dailyProgress.current}/{dailyProgress.max}
          </span>
        </div>
        <Progress 
          value={dailyProgress.percentage} 
          className="w-full h-2"
          data-testid="progress-daily"
        />
      </div>

      {/* Quick Guide */}
      {parseFloat(user.dailyEarnings || "0") === 0 && (
        <Card className="bg-blue-500/10 border-blue-500/20 p-4" data-testid="card-guide">
          <div className="flex items-start gap-3">
            <i className="fas fa-lightbulb text-blue-400 mt-1"></i>
            <div>
              <p className="text-white font-medium mb-1">Quick Start Guide:</p>
              <p className="text-sm text-blue-200">
                1. Tap "Watch to Earn" to watch ads and earn money<br/>
                2. Claim your earnings when available<br/>
                3. Go to Wallet to withdraw when you reach $1.00
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        <Button
          onClick={handleWatchAd}
          disabled={!canWatchAd() || isWatchingAd || cooldown > 0}
          className="w-full btn-primary-gradient text-white font-semibold py-4 px-6 h-auto flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
          data-testid="button-watch-ad"
        >
          {isWatchingAd ? (
            <>
              <div className="loading-pulse">
                <i className="fas fa-play"></i>
              </div>
              <span>Watching Ad...</span>
            </>
          ) : cooldown > 0 ? (
            <>
              <i className="fas fa-clock"></i>
              <span>Wait {cooldown}s</span>
            </>
          ) : (dailyProgress.current || 0) >= (dailyProgress.max || 0) ? (
            <>
              <i className="fas fa-check"></i>
              <span>Daily Limit Reached</span>
            </>
          ) : (
            <>
              <i className="fas fa-play"></i>
              <span>Watch to Earn</span>
              <div className="bg-white bg-opacity-20 px-2 py-1 rounded-full text-xs font-medium">
                +$0.00035
              </div>
            </>
          )}
        </Button>

        <Button
          onClick={handleClaimEarnings}
          disabled={!canClaimEarnings() || claimEarningsMutation.isPending || isWatchingAd}
          variant="secondary"
          className="w-full font-semibold py-4 px-6 h-auto flex items-center justify-center gap-3 disabled:opacity-50"
          data-testid="button-claim-earnings"
        >
          {claimEarningsMutation.isPending || isWatchingAd ? (
            <>
              <div className="loading-pulse">
                <i className="fas fa-spinner"></i>
              </div>
              <span>Claiming...</span>
            </>
          ) : (
            <>
              <i className="fas fa-gift"></i>
              <span>Claim Earnings</span>
            </>
          )}
        </Button>
      </div>

      {/* Loading Overlay */}
      {isWatchingAd && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" data-testid="overlay-loading">
          <Card className="p-6 text-center">
            <div className="loading-pulse mb-3">
              <i className="fas fa-play-circle text-4xl text-primary"></i>
            </div>
            <div className="text-white font-medium">Watching Ad...</div>
            <div className="text-sm text-muted-foreground mt-1">Please wait 2 seconds</div>
          </Card>
        </div>
      )}
    </div>
  );
}
