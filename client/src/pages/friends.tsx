import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useUserData } from "@/hooks/use-user-data";
import { shareToTelegram, copyToClipboard, isTelegramEnvironment } from "@/lib/telegram";
import { useToast } from "@/hooks/use-toast";

const BOT_USERNAME = "LightingSatsBot"; // Real bot username

function generateReferralLink(referralCode: string): string {
  return `https://t.me/${BOT_USERNAME}?start=${referralCode}`;
}

export default function Friends() {
  const { user: displayUser, isLoading, error } = useUserData();
  const { toast } = useToast();
  const isInTelegram = isTelegramEnvironment();

  const handleCopyReferralLink = async () => {
    if (!displayUser?.referralCode) {
      console.warn('Cannot copy referral link: user.referralCode is not available');
      toast({
        variant: "destructive",
        title: "Error",
        description: "User data not ready yet",
      });
      return;
    }

    const referralLink = generateReferralLink(displayUser.referralCode);
    console.log('Copying referral link:', referralLink);

    try {
      await copyToClipboard(referralLink);
      toast({
        variant: "success",
        title: "Copied!",
        description: "Referral link copied to clipboard",
      });
    } catch (error) {
      console.error('Failed to copy referral link:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to copy referral link",
      });
    }
  };

  const handleShareToTelegram = () => {
    if (!displayUser?.referralCode) {
      console.warn('Cannot share to Telegram: user.referralCode is not available');
      toast({
        variant: "destructive",
        title: "Error",
        description: "User data not ready yet",
      });
      return;
    }

    const referralLink = generateReferralLink(displayUser.referralCode);
    const message = `Join LightingSats and start earning money by watching ads! ${referralLink}`;
    console.log('Sharing to Telegram:', { referralLink, message });
    shareToTelegram(message);
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="text-4xl mb-4 text-destructive">⚠️</div>
          <p className="text-muted-foreground">Failed to load friends data</p>
        </div>
      </div>
    );
  }

  if (isLoading || !displayUser) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="loading-pulse text-4xl mb-4">👥</div>
          <p className="text-muted-foreground">Loading friends data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white" data-testid="text-friends-title">Invite Friends</h2>

      {/* Development Notice */}
      {!isInTelegram && (
        <Card className="p-4 bg-yellow-500/10 border-yellow-500/20" data-testid="card-dev-notice">
          <div className="flex items-center gap-2">
            <i className="fas fa-exclamation-triangle text-yellow-500"></i>
            <div>
              <p className="text-sm text-yellow-200 font-medium">Development Mode</p>
              <p className="text-xs text-yellow-300/80">
                Using mock Telegram ID ({displayUser?.telegramId}). Open in Telegram for real referral links.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Referral Card */}
      <Card className="p-6 text-center" data-testid="card-referral">
        <h3 className="text-lg font-semibold mb-2 text-white">Referral Link</h3>
        <div className="text-sm font-bold text-primary my-4 break-all px-2" data-testid="text-referral-link">
          {displayUser.referralCode ? generateReferralLink(displayUser.referralCode) : 'Loading...'}
        </div>
        <Button 
          onClick={handleCopyReferralLink}
          className="btn-primary-gradient text-white font-semibold py-3 px-6 gap-2 active:scale-95"
          data-testid="button-copy-referral"
        >
          <i className="fas fa-copy"></i>
          Copy Link
        </Button>
      </Card>

      {/* Friends List */}
      <div className="space-y-3" data-testid="container-friends-list">
        <h3 className="text-lg font-semibold text-white">Your Referrals</h3>
        {displayUser.referralCount > 0 ? (
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-semibold">
                  {displayUser.referralCount || 0} Friends Joined
                </div>
                <div className="text-sm text-muted-foreground">
                  Total Commission: ${displayUser.referralEarnings || "0.00000"}
                </div>
              </div>
              <i className="fas fa-users text-primary text-2xl"></i>
            </div>
          </Card>
        ) : (
          <div className="text-center py-10 text-muted-foreground">
            <i className="fas fa-users text-4xl mb-4 opacity-50"></i>
            <p className="text-base mb-2">No friends invited yet</p>
            <p className="text-sm">Share your referral link to start earning!</p>
          </div>
        )}
      </div>

      {/* Telegram Share Button */}
      <div className="mt-6">
        <Button 
          onClick={handleShareToTelegram}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-4 px-6 gap-3 active:scale-95"
          data-testid="button-share-telegram"
        >
          <i className="fab fa-telegram text-xl"></i>
          Share on Telegram
        </Button>
      </div>

      {/* Referral Benefits Info */}
      <Card className="p-4 bg-muted/20" data-testid="card-referral-info">
        <div className="flex items-start gap-3">
          <i className="fas fa-info-circle text-primary mt-1"></i>
          <div>
            <h4 className="font-semibold text-white mb-1">Referral Benefits</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Earn 10% of your friend's ad earnings</li>
              <li>• No limit on referrals</li>
              <li>• Passive income opportunity</li>
              <li>• Help friends discover LightingSats</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}