import { useQuery } from '@tanstack/react-query';
import { getTonPrice } from '@/lib/api';

export function useTonPrice() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/ton-price'],
    queryFn: getTonPrice,
    refetchInterval: 30000, // Refetch every 30 seconds
    retry: 3,
  });

  return {
    tonPrice: data?.price || 5.42,
    tonChange: data?.change24h || 0,
    isLoading,
    error,
  };
}
