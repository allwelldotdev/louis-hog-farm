import { useQuery } from '@tanstack/react-query'

import { api } from '@/api-runtime'
import type {
  BreedingCycle,
  FeedRecord,
  HealthRecord,
  MortalityEvent,
  Page,
  Vaccination,
} from '@/lib/api/types'
import { queryKeys } from '@/lib/query/keys'

/**
 * Record streams.
 *
 * Every list is offset-paginated, but the phone never pages: a hog's card
 * shows its three most recent entries and points at the dashboard for the
 * rest. Scrolling a thousand feed records on a phone is not a farm workflow.
 */

export function useHealthRecords(params?: { hog_id?: number; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.list('health-records', params),
    queryFn: () => api.get<Page<HealthRecord>>('/health-records', { limit: 20, ...params }),
  })
}

export function useFeedRecords(params?: { hog_id?: number; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.list('feed-records', params),
    queryFn: () => api.get<Page<FeedRecord>>('/feed-records', { limit: 20, ...params }),
  })
}

export function useVaccinations(params?: { hog_id?: number; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.list('vaccinations', params),
    queryFn: () => api.get<Page<Vaccination>>('/vaccinations', { limit: 20, ...params }),
  })
}

export function useMortalityEvents() {
  return useQuery({
    queryKey: queryKeys.list('mortality-events'),
    queryFn: () => api.get<Page<MortalityEvent>>('/mortality-events', { limit: 50 }),
  })
}

export function useBreedingCycles() {
  return useQuery({
    queryKey: queryKeys.list('breeding-cycles'),
    queryFn: () => api.get<Page<BreedingCycle>>('/breeding-cycles', { limit: 50 }),
  })
}
