import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithQuery } from '@/test/render'

import { HogGrowthChart } from './hog-growth-chart'

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }))
vi.mock('@/lib/api/client', () => ({ apiGet }))

const GROWTH = {
  hog_id: 60,
  date_from: null,
  date_to: null,
  actual: [
    { date: '2026-06-13', weight_kg: 112.4 },
    { date: '2026-06-20', weight_kg: 114.7 },
    { date: '2026-06-27', weight_kg: 111.9 },
  ],
  forecast: [],
}

/** Deliberately not in date order, and one weigh-in has no temperature: the
 *  merge is by date, not by position, and a gap must not shift the series. */
const HEALTH = {
  items: [
    { id: 3, hog_id: 60, record_date: '2026-06-27', weight: '111.9', temperature: '40.4' },
    { id: 1, hog_id: 60, record_date: '2026-06-13', weight: '112.4', temperature: null },
    { id: 2, hog_id: 60, record_date: '2026-06-20', weight: '114.7', temperature: '40.9' },
  ],
  total: 3,
  limit: 200,
  offset: 0,
}

function mockApi(health: typeof HEALTH) {
  apiGet.mockImplementation((path: string) =>
    Promise.resolve(path.includes('/growth') ? GROWTH : health),
  )
}

describe('HogGrowthChart', () => {
  beforeEach(() => {
    mockApi(HEALTH)
  })

  it('draws weight and temperature as two series on separate axes', async () => {
    const { container } = renderWithQuery(<HogGrowthChart hogId={60} />)

    await waitFor(() => expect(container.querySelectorAll('.recharts-line-curve')).toHaveLength(2))

    // Two y-axes is the assertion that matters: a pig's normal range is
    // 38.0–39.5 °C, so plotting temperature against the weight axis would flatten
    // a two-degree fever into a line indistinguishable from a healthy animal.
    expect(container.querySelectorAll('.recharts-yAxis')).toHaveLength(2)
    expect(screen.getByText('Temperature')).toBeDefined()
  })

  it('drops the temperature axis entirely when nothing was taken', async () => {
    mockApi({ ...HEALTH, items: HEALTH.items.map((row) => ({ ...row, temperature: null })) })

    const { container } = renderWithQuery(<HogGrowthChart hogId={60} />)

    await waitFor(() => expect(container.querySelectorAll('.recharts-line-curve')).toHaveLength(1))
    expect(container.querySelectorAll('.recharts-yAxis')).toHaveLength(1)
    expect(screen.queryByText('Temperature')).toBeNull()
  })

  it('says the animal was never weighed rather than drawing an empty chart', async () => {
    apiGet.mockImplementation((path: string) =>
      Promise.resolve(path.includes('/growth') ? { ...GROWTH, actual: [] } : HEALTH),
    )

    renderWithQuery(<HogGrowthChart hogId={60} />)

    expect(await screen.findByText(/never been weighed/i)).toBeDefined()
  })
})
