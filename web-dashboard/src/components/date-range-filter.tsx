'use client'

import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/field'
import { useDashboardFilters } from '@/hooks/use-dashboard-filters'

/**
 * From/to, in the URL.
 *
 * The dashboard's own `FilterBar` carries a breed facet and lives in a card;
 * the operational pages want the same date window as a bare toolbar row. Both
 * read `useDashboardFilters`, so a date range set on one page survives a click
 * through to another.
 *
 * Native `type="date"` speaks the API's `YYYY-MM-DD` exactly, so nothing has to
 * reformat between the control and the query string — which is also where the
 * UTC-midnight bug would otherwise get in.
 */
export function DateRangeFilter({ idPrefix }: { idPrefix: string }) {
  const { filters, setFilters } = useDashboardFilters()
  const isRanged = Boolean(filters.dateFrom || filters.dateTo)

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-from`}>From</Label>
        <Input
          id={`${idPrefix}-from`}
          type="date"
          className="w-auto"
          value={filters.dateFrom ?? ''}
          max={filters.dateTo}
          onChange={(event) => setFilters({ dateFrom: event.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-to`}>To</Label>
        <Input
          id={`${idPrefix}-to`}
          type="date"
          className="w-auto"
          value={filters.dateTo ?? ''}
          min={filters.dateFrom}
          onChange={(event) => setFilters({ dateTo: event.target.value })}
        />
      </div>

      {isRanged ? (
        <Button
          variant="ghost"
          size="sm"
          className="mb-0.5"
          onClick={() => setFilters({ dateFrom: '', dateTo: '' })}
        >
          <X aria-hidden />
          Clear
        </Button>
      ) : null}
    </>
  )
}
