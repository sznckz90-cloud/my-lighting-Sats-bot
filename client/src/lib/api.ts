import { apiRequest } from "./queryClient";
import type { User, WithdrawalRequest } from "@shared/schema";

export interface TonPriceData {
  price: number;
  change24h: number;
}

export interface WatchAdResponse {
  success: boolean;
  earnings: number;
  user: User;
}

export interface ClaimEarningsResponse {
  success: boolean;
  claimed: string;
  user: User;
}

export interface WithdrawalRequestResponse {
  success: boolean;
  request: WithdrawalRequest;
}

// User API
export async function getOrCreateUser(telegramId: string, username: string): Promise<User> {
  const response = await apiRequest('POST', '/api/user', { telegramId, username });
  return response.json();
}

// Ad watching API
export async function watchAd(userId: string): Promise<WatchAdResponse> {
  console.log(`Calling watch-ad API for user: ${userId}`);
  const response = await apiRequest('POST', '/api/watch-ad', { userId });
  const result = await response.json();
  console.log('Watch-ad API response:', result);
  return result;
}

// Earnings API
export async function claimEarnings(userId: string): Promise<ClaimEarningsResponse> {
  const response = await apiRequest('POST', '/api/claim-earnings', { userId });
  return response.json();
}

// Withdrawal API
export async function createWithdrawalRequest(
  userId: string, 
  amount: string, 
  telegramUsername?: string,
  walletAddress?: string,
  method: string = 'telegram'
): Promise<WithdrawalRequestResponse> {
  const response = await apiRequest('POST', '/api/withdrawal-request', {
    userId,
    amount,
    telegramUsername,
    walletAddress,
    method
  });
  return response.json();
}

export async function getUserWithdrawals(userId: string): Promise<WithdrawalRequest[]> {
  const response = await apiRequest('GET', `/api/user/${userId}/withdrawals`);
  return response.json();
}

// TON Price API
export async function getTonPrice(): Promise<TonPriceData> {
  const response = await apiRequest('GET', '/api/ton-price');
  return response.json();
}
