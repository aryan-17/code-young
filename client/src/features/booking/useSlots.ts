import { useQuery } from '@tanstack/react-query';
import { fetchSlots } from '../../api/client';

export function useSlots(timezone: string) {
  return useQuery({
    queryKey: ['slots', timezone],
    queryFn: () => fetchSlots(timezone),
    enabled: !!timezone,
    staleTime: 30_000,
  });
}
