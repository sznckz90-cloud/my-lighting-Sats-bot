import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserData } from "@/hooks/use-user-data";
import { useState } from "react";

export default function Wallet() {
  const { user, withdrawalMutation, canWithdraw } = useUserData();
  const minimumWithdrawUSD = 1.00; // $1 minimum withdrawal
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleWithdrawRequest = () => {
    const amount = parseFloat(withdrawalAmount);
    
    if (!canWithdraw(amount)) {
      return;
    }

    withdrawalMutation.mutate({
      amount: withdrawalAmount,
      method: 'telegram',
      telegramUsername,
    });

    setIsDialogOpen(false);
    setWithdrawalAmount("");
    setTelegramUsername("");
  };

  if (!user) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-white" data-testid="text-wallet-title">Wallet</h2>
        
        <Card className="gradient-border p-6" data-testid="card-loading-wallet">
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="loading-pulse mb-4">
                <i className="fas fa-wallet text-4xl text-primary"></i>
              </div>
              <p className="text-white mb-2">Loading your wallet...</p>
              <p className="text-sm text-muted-foreground">This usually takes just a few seconds</p>
            </div>
          </div>
        </Card>
        
        {/* Show placeholder content so users don't feel stuck */}
        <div className="space-y-3 opacity-50">
          <Button 
            disabled
            className="w-full btn-primary-gradient text-white font-semibold py-4 px-6 gap-3"
            data-testid="button-withdraw-disabled"
          >
            <i className="fas fa-money-bill-wave"></i>
            <span>Withdraw Funds</span>
          </Button>
        </div>
      </div>
    );
  }

  const userBalance = parseFloat(user.withdrawBalance || "0");

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white" data-testid="text-wallet-title">Wallet</h2>
      
      {/* Total Balance Card */}
      <Card className="gradient-border p-6" data-testid="card-total-balance">
        <div className="flex items-center gap-2 mb-2">
          <i className="fas fa-wallet text-primary"></i>
          <span className="text-white font-medium">Total Balance</span>
        </div>
        <div className="text-3xl font-bold text-white mb-1" data-testid="text-total-balance">
          ${userBalance.toFixed(5)}
        </div>
        <div className="text-sm text-muted-foreground">Available for withdrawal</div>
      </Card>


      {/* Help Guide for new users */}
      {userBalance < minimumWithdrawUSD && (
        <Card className="bg-yellow-500/10 border-yellow-500/20 p-4" data-testid="card-withdrawal-guide">
          <div className="flex items-start gap-3">
            <i className="fas fa-info-circle text-yellow-400 mt-1"></i>
            <div>
              <p className="text-white font-medium mb-1">Withdrawal Requirements:</p>
              <p className="text-sm text-yellow-200">
                • Minimum withdrawal: $1.00<br/>
                • Keep earning by watching ads on the Home page<br/>
                • Claim your earnings to move them to withdraw balance
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Withdrawal Actions */}
      <div className="space-y-3">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="w-full btn-primary-gradient text-white font-semibold py-4 px-6 gap-3 active:scale-95"
              disabled={userBalance < minimumWithdrawUSD}
              data-testid="button-withdraw-funds"
            >
              <i className="fas fa-money-bill-wave"></i>
              <span>Withdraw Funds</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border" data-testid="dialog-withdrawal">
            <DialogHeader>
              <DialogTitle className="text-white">Withdraw Funds</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="amount" className="text-white">Amount (USD)</Label>
                <Input
                  id="amount"
                  type="number"
                  value={withdrawalAmount}
                  onChange={(e) => setWithdrawalAmount(e.target.value)}
                  min={minimumWithdrawUSD.toFixed(2)}
                  max={userBalance}
                  step="0.01"
                  placeholder="Minimum $1.00"
                  className="bg-muted border-border text-white"
                  data-testid="input-withdrawal-amount"
                />
              </div>
              <div>
                <Label htmlFor="telegram" className="text-white">Telegram Username</Label>
                <Input
                  id="telegram"
                  type="text"
                  value={telegramUsername}
                  onChange={(e) => setTelegramUsername(e.target.value)}
                  placeholder="@yourusername"
                  className="bg-muted border-border text-white"
                  data-testid="input-telegram-username"
                />
              </div>
              <div className="text-sm text-muted-foreground">
                <p>• Minimum withdrawal: $1.00</p>
                <p>• Processing time: 1-3 business days</p>
                <p>• Admin will contact you via Telegram</p>
              </div>
              <Button 
                onClick={handleWithdrawRequest}
                disabled={
                  !withdrawalAmount || 
                  !telegramUsername || 
                  !canWithdraw(parseFloat(withdrawalAmount)) ||
                  withdrawalMutation.isPending
                }
                className="w-full btn-primary-gradient text-white"
                data-testid="button-confirm-withdrawal"
              >
                {withdrawalMutation.isPending ? (
                  <>
                    <div className="loading-pulse">
                      <i className="fas fa-spinner"></i>
                    </div>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <i className="fas fa-check"></i>
                    <span>Confirm Withdrawal</span>
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        
        <div className="text-center text-muted-foreground text-sm mt-4" data-testid="text-minimum-withdrawal">
          Minimum withdrawal: $1.00
        </div>
      </div>

      {/* Withdrawal History Placeholder */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4 text-white">Recent Withdrawals</h3>
        <div className="text-center py-6 text-muted-foreground" data-testid="container-withdrawal-history">
          <i className="fas fa-history text-3xl mb-3 opacity-50"></i>
          <p>No withdrawal history</p>
        </div>
      </div>
    </div>
  );
}
