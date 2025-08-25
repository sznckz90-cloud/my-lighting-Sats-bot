import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useUserData } from "@/hooks/use-user-data";
import { shareToTelegram, copyToClipboard, isTelegramEnvironment } from "@/lib/telegram";
import { useToast } from "@/hooks/use-toast";

const BOT_USERNAME = "LightingSatsBot"; // Real bot username

function generateReferralLink(telegramId: string): string {
  return `https://t.me/${BOT_USERNAME}?start=${telegramId}`;
}

export default function Friends() {
  const { user } = useUserData();
  const { toast } = useToast();
  const isInTelegram = isTelegramEnvironment();

  const handleCopyReferralLink = async () => {
    if (!user?.telegramId) {
      console.warn('Cannot copy referral link: user.telegramId is not available');
      toast({
        variant: "destructive",
        title: "Error",
        description: "User data not ready yet",
      });
      return;
    }

    const referralLink = generateReferralLink(user.telegramId);
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
    if (!user?.telegramId) {
      console.warn('Cannot share to Telegram: user.telegramId is not available');
      toast({
        variant: "destructive",
        title: "Error",
        description: "User data not ready yet",
      });
      return;
    }

    const referralLink = generateReferralLink(user.telegramId);
    const message = `Join LightingSats and start earning money by watching ads! ${referralLink}`;
    console.log('Sharing to Telegram:', { referralLink, message });
    shareToTelegram(message);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="loading-pulse">
          <i className="fas fa-users text-4xl text-primary"></i>
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
                Using mock Telegram ID ({user?.telegramId}). Open in Telegram for real referral links.
              </p>
            </div>
          </div>
        </Card>
      )}
      
      {/* Referral Card */}
      <Card className="p-6 text-center" data-testid="card-referral">
        <h3 className="text-lg font-semibold mb-2 text-white">Referral Link</h3>
        <div className="text-sm font-bold text-primary my-4 break-all px-2" data-testid="text-referral-link">
          {user.telegramId ? generateReferralLink(user.telegramId) : 'Loading...'}
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

      {/* Friends List Placeholder */}
      <div className="space-y-3" data-testid="container-friends-list">
        <div className="text-center py-10 text-muted-foreground">
          <i className="fas fa-users text-4xl mb-4 opacity-50"></i>
          <p className="text-base mb-2">No friends invited yet</p>
          <p className="text-sm">Share your referral link to start earning!</p>
        </div>
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
