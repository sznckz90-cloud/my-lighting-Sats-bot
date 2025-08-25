import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getTelegramUser, isTelegramEnvironment } from "@/lib/telegram";
import { apiRequest } from "@/lib/queryClient";
import type { User, BotStats, WithdrawalRequest } from '@shared/schema';

const ADMIN_TELEGRAM_ID = "6653616672";

interface UserWithPendingClaim extends User {
  hasPendingClaim: boolean;
}

interface AdminStats extends BotStats {
  pendingWithdrawals: number;
  totalPendingAmount: number;
}

interface SettingsUpdateData {
  earningsPerAd?: string;
  dailyAdLimit?: number;
}

export default function Admin() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [activeTab, setActiveTab] = useState('pending-claims');
  const [earningsPerAd, setEarningsPerAd] = useState('');
  const [dailyAdLimit, setDailyAdLimit] = useState('');
  const [showSettingsEdit, setShowSettingsEdit] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check admin access
  useEffect(() => {
    const checkAccess = async () => {
      try {
        if (isTelegramEnvironment()) {
          const telegramUser = getTelegramUser();
          setCurrentUser(telegramUser);
          
          if (telegramUser.id.toString() !== ADMIN_TELEGRAM_ID) {
            toast({
              variant: "destructive",
              title: "Access Denied",
              description: "You don't have admin privileges",
            });
            return;
          }
        } else {
          // Development mode - deny access for security
          toast({
            variant: "destructive",
            title: "Access Denied",
            description: "Admin access only available in Telegram environment",
          });
          return;
        }
      } catch (error) {
        console.error('Failed to check admin access:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to verify admin access",
        });
      }
    };

    checkAccess();
  }, []);

  // Fetch admin stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/admin/stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json() as Promise<AdminStats>;
    },
    enabled: !!currentUser,
  });

  // Get current user's telegram ID 
  const getCurrentUserTelegramId = () => {
    return currentUser?.id?.toString() || ADMIN_TELEGRAM_ID;
  };

  // Fetch users with filters
  const { data: users = [], isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ['/api/admin/users', searchTerm, filterType],
    queryFn: async () => {
      const params = new URLSearchParams({
        telegramId: getCurrentUserTelegramId(),
        ...(searchTerm && { search: searchTerm }),
        ...(filterType !== 'all' && { filter: filterType }),
      });
      
      const response = await fetch(`/api/admin/users?${params}`);
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json() as Promise<User[]>;
    },
    enabled: !!currentUser,
  });

  // Fetch pending withdrawals
  const { data: pendingWithdrawals = [] } = useQuery({
    queryKey: ['/api/admin/pending-withdrawals'],
    queryFn: async () => {
      const response = await fetch('/api/admin/pending-withdrawals');
      if (!response.ok) throw new Error('Failed to fetch pending withdrawals');
      return response.json() as Promise<WithdrawalRequest[]>;
    },
    enabled: !!currentUser,
  });

  // Ban/Unban user mutation
  const banUserMutation = useMutation({
    mutationFn: ({ userId, banned, reason }: { userId: string; banned: boolean; reason?: string }) =>
      apiRequest(`/api/admin/user/ban`, 'POST', { userId, banned, reason, telegramId: getCurrentUserTelegramId() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        variant: "success",
        title: "Success",
        description: "User status updated",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update user status",
      });
    },
  });

  // Approve/Reject claim mutations
  const approveClaimMutation = useMutation({
    mutationFn: (userId: string) =>
      apiRequest(`/api/admin/claim/approve`, 'POST', { userId, telegramId: getCurrentUserTelegramId() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      toast({
        variant: "success",
        title: "Success",
        description: "Claim approved",
      });
    },
  });

  const rejectClaimMutation = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason?: string }) =>
      apiRequest(`/api/admin/claim/reject`, 'POST', { userId, reason, telegramId: getCurrentUserTelegramId() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        variant: "success",
        title: "Success",
        description: "Claim rejected",
      });
    },
  });

  // Process withdrawal mutation
  const processWithdrawalMutation = useMutation({
    mutationFn: ({ requestId, status, adminNotes }: { requestId: string; status: string; adminNotes?: string }) =>
      apiRequest(`/api/admin/process-withdrawal`, 'POST', { requestId, status, adminNotes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/pending-withdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      toast({
        variant: "success",
        title: "Success",
        description: "Withdrawal processed",
      });
    },
  });

  // Update earnings and limits
  const updateSettingsMutation = useMutation({
    mutationFn: (data: SettingsUpdateData) =>
      apiRequest(`/api/admin/update-settings`, 'POST', { ...data, telegramId: getCurrentUserTelegramId() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      setShowSettingsEdit(false);
      toast({
        variant: "success",
        title: "Success",
        description: "Settings updated successfully",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update settings",
      });
    },
  });

  // Export CSV
  const handleExportCSV = () => {
    const params = new URLSearchParams({ telegramId: getCurrentUserTelegramId() });
    window.open(`/api/admin/export/csv?${params}`, '_blank');
  };

  // Set initial values when stats load
  useEffect(() => {
    if (stats?.earningsPerAd && !earningsPerAd) {
      setEarningsPerAd(stats.earningsPerAd);
    }
    if (stats?.dailyAdLimit && !dailyAdLimit) {
      setDailyAdLimit(stats.dailyAdLimit.toString());
    }
  }, [stats]);

  // Filter users based on tab
  const filteredUsers = users.filter(user => {
    switch (activeTab) {
      case 'pending-claims':
        return parseFloat(user.dailyEarnings) > 0;
      case 'banned':
        return user.banned;
      case 'flagged':
        return user.flagged;
      case 'leaderboard':
        return true;
      default:
        return true;
    }
  });

  // Sort users for leaderboard
  const sortedUsers = activeTab === 'leaderboard' 
    ? [...filteredUsers].sort((a, b) => parseFloat(b.totalEarnings) - parseFloat(a.totalEarnings))
    : filteredUsers;

  if (!currentUser || (currentUser.id.toString() !== ADMIN_TELEGRAM_ID && isTelegramEnvironment())) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 text-center">
          <i className="fas fa-shield-alt text-4xl text-red-500 mb-4"></i>
          <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-muted-foreground">Admin privileges required</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white" data-testid="text-admin-title">
          <i className="fas fa-shield-alt mr-2"></i>
          Admin Panel
        </h1>
        <Button 
          onClick={handleExportCSV}
          variant="outline"
          size="sm"
          data-testid="button-export-csv"
        >
          <i className="fas fa-download mr-2"></i>
          Export CSV
        </Button>
      </div>

      {/* Earnings & Limits Settings Card */}
      <Card className="p-4 bg-primary/10 border-primary/20" data-testid="card-earnings-settings">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <i className="fas fa-cog text-primary"></i>
            <span className="font-semibold text-white">Ad Settings</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowSettingsEdit(!showSettingsEdit)}
            data-testid="button-edit-settings"
          >
            <i className="fas fa-edit mr-1"></i>
            Edit
          </Button>
        </div>
        
        {showSettingsEdit ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">Earnings Per Ad ($)</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.00001"
                  value={earningsPerAd}
                  onChange={(e) => setEarningsPerAd(e.target.value)}
                  placeholder="0.00035"
                  className="flex-1"
                  data-testid="input-earnings-per-ad"
                />
                <Button
                  size="sm"
                  onClick={() => updateSettingsMutation.mutate({ earningsPerAd })}
                  disabled={updateSettingsMutation.isPending}
                  data-testid="button-save-earnings"
                >
                  Save
                </Button>
              </div>
            </div>
            
            <div>
              <label className="text-sm text-muted-foreground">Daily Ad Limit</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="1"
                  value={dailyAdLimit}
                  onChange={(e) => setDailyAdLimit(e.target.value)}
                  placeholder="250"
                  className="flex-1"
                  data-testid="input-daily-limit"
                />
                <Button
                  size="sm"
                  onClick={() => updateSettingsMutation.mutate({ dailyAdLimit: parseInt(dailyAdLimit) })}
                  disabled={updateSettingsMutation.isPending}
                  data-testid="button-save-limit"
                >
                  Save
                </Button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              CPM Rate: ${earningsPerAd ? (parseFloat(earningsPerAd) * 1000).toFixed(2) : '0.35'} per 1000 ads
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Per Ad:</span>
              <span className="text-sm font-medium text-white">${stats?.earningsPerAd || '0.00035'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Daily Limit:</span>
              <span className="text-sm font-medium text-white">{stats?.dailyAdLimit || 250} ads</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">CPM Rate:</span>
              <span className="text-sm font-medium text-white">${stats?.cpmRate || '0.35'}</span>
            </div>
          </div>
        )}
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-center">
            <i className="fas fa-users text-primary text-xl mb-2"></i>
            <div className="text-2xl font-bold text-white">{stats?.totalUsers || 0}</div>
            <div className="text-xs text-muted-foreground">Total Users</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <i className="fas fa-play-circle text-green-500 text-xl mb-2"></i>
            <div className="text-2xl font-bold text-white">{stats?.totalAdsWatched || 0}</div>
            <div className="text-xs text-muted-foreground">Ads Watched</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <i className="fas fa-dollar-sign text-yellow-500 text-xl mb-2"></i>
            <div className="text-2xl font-bold text-white">${stats?.totalEarnings || '0'}</div>
            <div className="text-xs text-muted-foreground">Total Earnings</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <i className="fas fa-clock text-blue-500 text-xl mb-2"></i>
            <div className="text-2xl font-bold text-white">{stats?.pendingWithdrawals || 0}</div>
            <div className="text-xs text-muted-foreground">Pending Withdrawals</div>
          </div>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-muted/20 p-1 rounded-lg overflow-x-auto">
        {[
          { key: 'pending-claims', label: 'Pending Claims', icon: 'fa-clock' },
          { key: 'withdrawals', label: 'Withdrawals', icon: 'fa-money-bill-wave' },
          { key: 'leaderboard', label: 'Leaderboard', icon: 'fa-trophy' },
          { key: 'banned', label: 'Banned', icon: 'fa-ban' },
          { key: 'flagged', label: 'Flagged', icon: 'fa-flag' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.key 
                ? 'bg-primary text-white' 
                : 'text-muted-foreground hover:text-white'
            }`}
            data-testid={`tab-${tab.key}`}
          >
            <i className={`fas ${tab.icon} mr-2`}></i>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      {activeTab !== 'withdrawals' && (
        <Input
          placeholder="Search by username or Telegram ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
          data-testid="input-search-users"
        />
      )}

      {/* Content based on active tab */}
      {activeTab === 'withdrawals' ? (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Pending Withdrawals</h3>
          {pendingWithdrawals.length === 0 ? (
            <Card className="p-8 text-center">
              <i className="fas fa-inbox text-4xl text-muted-foreground mb-4"></i>
              <p className="text-muted-foreground">No pending withdrawals</p>
            </Card>
          ) : (
            pendingWithdrawals.map((request: any) => (
              <Card key={request.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">
                      @{request.user?.username || 'Unknown'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Amount: ${request.amount} | Method: {request.method}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      onClick={() => processWithdrawalMutation.mutate({
                        requestId: request.id,
                        status: 'approved'
                      })}
                      disabled={processWithdrawalMutation.isPending}
                      data-testid={`button-approve-withdrawal-${request.id}`}
                    >
                      <i className="fas fa-check mr-1"></i>
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => processWithdrawalMutation.mutate({
                        requestId: request.id,
                        status: 'rejected',
                        adminNotes: 'Rejected by admin'
                      })}
                      disabled={processWithdrawalMutation.isPending}
                      data-testid={`button-reject-withdrawal-${request.id}`}
                    >
                      <i className="fas fa-times mr-1"></i>
                      Reject
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {usersLoading ? (
            <div className="text-center py-8">
              <i className="fas fa-spinner fa-spin text-2xl text-primary"></i>
              <p className="text-muted-foreground mt-2">Loading users...</p>
            </div>
          ) : sortedUsers.length === 0 ? (
            <Card className="p-8 text-center">
              <i className="fas fa-users text-4xl text-muted-foreground mb-4"></i>
              <p className="text-muted-foreground">No users found</p>
            </Card>
          ) : (
            sortedUsers.map((user, index) => (
              <Card key={user.id} className="p-4" data-testid={`card-user-${user.id}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      {activeTab === 'leaderboard' && (
                        <span className="bg-primary text-white text-xs px-2 py-1 rounded-full">
                          #{index + 1}
                        </span>
                      )}
                      <div className="font-semibold text-white">
                        @{user.username}
                      </div>
                      {user.banned && (
                        <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                          BANNED
                        </span>
                      )}
                      {user.flagged && (
                        <span className="bg-yellow-500 text-black text-xs px-2 py-1 rounded-full">
                          FLAGGED
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      ID: {user.telegramId} | 
                      Total: ${user.totalEarnings} | 
                      Ads: {user.adsWatched}
                      {parseFloat(user.dailyEarnings) > 0 && (
                        <> | Pending: ${user.dailyEarnings}</>
                      )}
                    </div>
                    {user.flagReason && (
                      <div className="text-xs text-yellow-400 mt-1">
                        Reason: {user.flagReason}
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    {activeTab === 'pending-claims' && parseFloat(user.dailyEarnings) > 0 && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => approveClaimMutation.mutate(user.id)}
                          disabled={approveClaimMutation.isPending}
                          data-testid={`button-approve-claim-${user.id}`}
                        >
                          <i className="fas fa-check mr-1"></i>
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => rejectClaimMutation.mutate({
                            userId: user.id,
                            reason: 'Claim rejected by admin'
                          })}
                          disabled={rejectClaimMutation.isPending}
                          data-testid={`button-reject-claim-${user.id}`}
                        >
                          <i className="fas fa-times mr-1"></i>
                          Reject
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant={user.banned ? "outline" : "destructive"}
                      onClick={() => banUserMutation.mutate({
                        userId: user.id,
                        banned: !user.banned,
                        reason: user.banned ? undefined : 'Banned by admin'
                      })}
                      disabled={banUserMutation.isPending}
                      data-testid={`button-ban-user-${user.id}`}
                    >
                      <i className={`fas ${user.banned ? 'fa-user-check' : 'fa-ban'} mr-1`}></i>
                      {user.banned ? 'Unban' : 'Ban'}
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
