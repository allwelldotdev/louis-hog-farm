'use client'

import { useQuery } from '@tanstack/react-query'

import { useFarmMutation } from '@/hooks/use-farm-mutation'
import { apiGet, apiSend } from '@/lib/api/client'
import type { Page, Vaccination, VaccinationCreate } from '@/lib/api/types'
import { queryKeys } from '@/lib/query/keys'

const LIMIT = 200

/** Vaccinations are `GET` and `POST` only — append-only by design, so there is
 *  no update hook here and no edit affordance on the page. */
export function useVaccinations(hogId?: number) {
  const params = { hog_id: hogId, limit: LIMIT }

  return useQuery({
    queryKey: queryKeys.list('vaccinations', params),
    queryFn: () => apiGet<Page<Vaccination>>('/vaccinations', params),
  })
}

export function useCreateVaccination() {
  return useFarmMutation((body: VaccinationCreate) =>
    apiSend<Vaccination>('POST', '/vaccinations', body),
  )
}
