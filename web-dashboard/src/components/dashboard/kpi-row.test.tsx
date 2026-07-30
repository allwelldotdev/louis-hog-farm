import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { NO_VALUE } from '@/lib/format'
import { renderWithQuery } from '@/test/render'

import { KpiRow } from './kpi-row'

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }))
vi.mock('@/lib/api/client', () => ({ apiGet }))

const FARM = {
  id: 1,
  name: 'Bright Acres Farm',
  timezone: 'Africa/Lagos',
  currency_code: 'NGN',
  hog_count: 60,
  created_at: '2026-05-01T00:00:00Z',
}

/** A herd nobody has weighed twice: the API reports nulls, not zeroes. */
const UNMEASURED_KPIS = {
  date_from: '2026-05-02',
  date_to: '2026-07-31',
  breed_filter: null,
  market_weight_kg: 115,
  currency_code: 'NGN',
  hogs_with_growth_measure: 0,
  avg_daily_gain_kg: null,
  total_weight_gain_kg: 0,
  health_records_count: 0,
  feed_records_count: 0,
  total_feed_kg: 0,
  total_feed_cost: 0,
  feed_cost_per_kg_gain: null,
  fcr: null,
  market_ready_count: 0,
  active_hogs_count: 60,
  market_ready_measured_count: 0,
  market_ready_pct: null,
  mortality_count: 0,
  mortality_rate_pct: null,
  open_alerts_count: 0,
}

function mockApi(kpis: object) {
  apiGet.mockImplementation((path: string) => Promise.resolve(path === '/farms/me' ? FARM : kpis))
}

describe('KpiRow', () => {
  /**
   * The regression this file exists for. "Not measured" and "measured as zero"
   * are different claims about the herd, and collapsing the first into the
   * second reports a farm that stopped growing when the truth is that nobody
   * put an animal on the scales.
   */
  it('renders an unmeasured figure as a dash, never as zero', async () => {
    mockApi(UNMEASURED_KPIS)

    renderWithQuery(<KpiRow />)

    expect(await screen.findByText('Average daily gain')).toBeDefined()
    // Five nulls in the payload: ADG, cost per kg gain, FCR, market ready %,
    // mortality rate. Every one of them is a rate with nothing to divide by.
    expect(screen.getAllByText(NO_VALUE)).toHaveLength(5)
  })

  it('hides the unit beside a dash so it cannot imply a measurement', async () => {
    mockApi(UNMEASURED_KPIS)

    renderWithQuery(<KpiRow />)

    await screen.findByText('Average daily gain')
    expect(screen.queryByText('kg/day')).toBeNull()
  })

  it('formats money in the currency the farm reports', async () => {
    mockApi({ ...UNMEASURED_KPIS, total_feed_cost: 8921153.52, feed_cost_per_kg_gain: 3960.67 })

    renderWithQuery(<KpiRow />)

    const cost = await screen.findByText(/8[,.\s]?921[,.\s]?15[34]/)
    expect(cost).toBeDefined()
  })
})
