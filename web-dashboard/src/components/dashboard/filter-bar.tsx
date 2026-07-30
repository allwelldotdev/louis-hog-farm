'use client'

import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { Label, Select } from '@/components/ui/field'
import { Input } from '@/components/ui/field'
import { useBreedDistribution } from '@/hooks/use-dashboard'
import { useDashboardFilters } from '@/hooks/use-dashboard-filters'

/**
 * The window every figure on this page is computed over.
 *
 * The breed list is `GET /dashboard/breed-distribution`, which is why that
 * endpoint doubles as the facet: a hardcoded array would drift the first time a
 * farm records a breed nobody thought of, and a dedicated `/facets` route would
 * be a second source of truth for the same answer.
 *
 * The date inputs are native `type="date"`. They already speak the API's
 * `YYYY-MM-DD` wire format exactly, so nothing has to parse or reformat between
 * the control and the query string — which is also where the UTC-midnight bug
 * would otherwise get in.
 */
export function FilterBar() {
  const { filters, setFilters, isFiltered } = useDashboardFilters()
  const { data: breeds } = useBreedDistribution()

  return (
    <Card>
      <CardBody className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label htmlFor="date-from">From</Label>
          <Input
            id="date-from"
            type="date"
            className="w-auto"
            value={filters.dateFrom ?? ''}
            max={filters.dateTo}
            onChange={(event) => setFilters({ dateFrom: event.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="date-to">To</Label>
          <Input
            id="date-to"
            type="date"
            className="w-auto"
            value={filters.dateTo ?? ''}
            min={filters.dateFrom}
            onChange={(event) => setFilters({ dateTo: event.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="breed">Breed</Label>
          <Select
            id="breed"
            className="h-10"
            value={filters.breed ?? ''}
            onChange={(event) => setFilters({ breed: event.target.value })}
          >
            <option value="">All breeds</option>
            {breeds?.rows.map((row) => (
              <option key={row.key} value={row.key}>
                {row.key}
              </option>
            ))}
          </Select>
        </div>

        {isFiltered ? (
          <Button
            variant="ghost"
            size="md"
            onClick={() => setFilters({ dateFrom: '', dateTo: '', breed: '' })}
          >
            <X aria-hidden />
            Clear
          </Button>
        ) : (
          // Without a default window stated somewhere, an unfiltered dashboard
          // looks like it is showing everything ever recorded.
          <p className="pb-2.5 text-xs text-muted">Showing the last 90 days</p>
        )}
      </CardBody>
    </Card>
  )
}
