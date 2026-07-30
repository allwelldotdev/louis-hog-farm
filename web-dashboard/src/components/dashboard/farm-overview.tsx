'use client'

import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { useDataVersion, useFarm } from '@/hooks/use-farm'
import { formatBusinessDate, formatInteger } from '@/lib/format'

/**
 * What the dashboard shows before the charts land in P8.
 *
 * Not a placeholder: it reads live values through the full path this phase
 * exists to build — httpOnly cookie, Next passthrough route, FastAPI, ETag
 * revalidation, TanStack cache — so if any link in that chain is broken it
 * shows here rather than in a chart three phases later.
 */
export function FarmOverview() {
  const { data: farm, isPending, isError } = useFarm()
  const { data: version } = useDataVersion()

  if (isError) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-alert">
            Could not reach the farm record. Check that the API is running, then reload.
          </p>
        </CardBody>
      </Card>
    )
  }

  const rows: { label: string; value: string }[] = [
    { label: 'Active hogs', value: farm ? formatInteger(farm.hog_count) : '—' },
    { label: 'Timezone', value: farm?.timezone ?? '—' },
    {
      label: 'Farm created',
      value: farm ? formatBusinessDate(farm.created_at.slice(0, 10), { dateStyle: 'medium' }) : '—',
    },
    { label: 'Data version', value: version ? formatInteger(version.version) : '—' },
  ]

  return (
    <Card className="max-w-xl">
      {/* The topbar already names the farm; repeating it here would say the
          same thing twice and leave the card without a title of its own. */}
      <CardHeader>
        <p className="text-sm font-medium text-ink">Farm record</p>
        {isPending ? (
          <span className="h-4 w-16 animate-pulse rounded bg-raised" />
        ) : (
          <span className="eyebrow">{farm?.currency_code}</span>
        )}
      </CardHeader>

      <CardBody className="p-0">
        <dl>
          {rows.map((row, index) => (
            <div
              key={row.label}
              className={`flex items-center justify-between px-5 py-3 ${
                index > 0 ? 'border-t border-rule' : ''
              }`}
            >
              <dt className="text-sm text-muted">{row.label}</dt>
              <dd className="figure text-sm text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
      </CardBody>
    </Card>
  )
}
