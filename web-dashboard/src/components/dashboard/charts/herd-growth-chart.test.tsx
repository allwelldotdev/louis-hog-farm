import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithQuery } from '@/test/render'

import { HerdGrowthChart } from './herd-growth-chart'

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }))
vi.mock('@/lib/api/client', () => ({ apiGet }))

const RESPONSE = {
  date_from: '2026-05-02',
  date_to: '2026-07-31',
  breed_filter: null,
  interval: 'week',
  points: [
    {
      bucket: '2026-05-04',
      hog_count: 60,
      avg_weight_kg: 55.37,
      median_weight_kg: 40.2,
      p10_weight_kg: 7.65,
      p90_weight_kg: 168.93,
    },
    {
      bucket: '2026-05-11',
      hog_count: 60,
      avg_weight_kg: 58.47,
      median_weight_kg: 43.66,
      p10_weight_kg: 9.19,
      p90_weight_kg: 170.49,
    },
    {
      bucket: '2026-05-18',
      hog_count: 60,
      avg_weight_kg: 61.57,
      median_weight_kg: 47.14,
      p10_weight_kg: 10.6,
      p90_weight_kg: 172.06,
    },
  ],
}

const vertices = (d: string) => (d.match(/[ML]/g) ?? []).length

describe('HerdGrowthChart', () => {
  beforeEach(() => {
    apiGet.mockResolvedValue(RESPONSE)
  })

  it('draws the percentile band and both trend lines', async () => {
    const { container } = renderWithQuery(<HerdGrowthChart />)

    await waitFor(() => expect(container.querySelector('.recharts-area-area')).not.toBeNull())

    const band = container.querySelector<SVGPathElement>('.recharts-area-area')
    const lines = container.querySelectorAll<SVGPathElement>('.recharts-line-curve')

    expect(lines).toHaveLength(2)

    /**
     * The band must be a closed shape traced out along the 90th percentile and
     * back along the 10th — roughly twice the line's vertices. Recharts only
     * does that when the dataKey yields a two-element array; the day it stops
     * treating `band` as a range, the fill silently collapses onto a baseline
     * and the chart still "works", just without the thing it exists to show.
     */
    const bandVertices = vertices(band?.getAttribute('d') ?? '')
    const lineVertices = vertices(lines[0].getAttribute('d') ?? '')

    expect(lineVertices).toBe(RESPONSE.points.length)
    expect(bandVertices).toBe(lineVertices * 2)
  })

  it('reports an empty window instead of drawing an empty chart', async () => {
    apiGet.mockResolvedValue({ ...RESPONSE, points: [] })

    renderWithQuery(<HerdGrowthChart />)

    expect(await screen.findByText(/no weigh-ins recorded/i)).toBeDefined()
  })

  it('surfaces a failed fetch with a way to retry', async () => {
    apiGet.mockRejectedValue(new Error('Could not reach the API.'))

    renderWithQuery(<HerdGrowthChart />)

    expect(await screen.findByText('Could not reach the API.')).toBeDefined()
    expect(await screen.findByRole('button', { name: /try again/i })).toBeDefined()
  })
})
