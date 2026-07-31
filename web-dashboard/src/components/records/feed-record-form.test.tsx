import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithQuery } from '@/test/render'

import { FeedRecordForm } from './feed-record-form'

const { apiGet, apiSend } = vi.hoisted(() => ({ apiGet: vi.fn(), apiSend: vi.fn() }))
vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client')
  return { ...actual, apiGet, apiSend }
})
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const FARM = { id: 1, name: 'Bright Acres Farm', currency_code: 'NGN', timezone: 'Africa/Lagos' }
const HOGS = {
  items: [
    { id: 7, tag_number: 'H1-1007', breed: 'Pietrain', production_class: 'sow', status: 'active' },
  ],
  total: 1,
  limit: 200,
  offset: 0,
}

describe('FeedRecordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiGet.mockImplementation((path: string) =>
      Promise.resolve(path.startsWith('/farms') ? FARM : HOGS),
    )
    apiSend.mockResolvedValue({ id: 1 })
  })

  it('never sends currency_code', async () => {
    const user = userEvent.setup()
    renderWithQuery(<FeedRecordForm open onClose={() => {}} />)

    await screen.findByRole('option', { name: /H1-1007/ })
    await user.selectOptions(screen.getByLabelText('Hog'), '7')
    await user.type(screen.getByLabelText('Amount (kg)'), '2.5')
    await user.type(screen.getByLabelText(/^Cost/), '900')
    await user.click(screen.getByRole('button', { name: 'Save feed record' }))

    await waitFor(() => expect(apiSend).toHaveBeenCalledTimes(1))

    const [method, path, body] = apiSend.mock.calls[0]
    expect([method, path]).toEqual(['POST', '/feed-records'])

    /**
     * The API fills the currency from the farm and `FeedRecordCreate` does not
     * carry the field at all. Client-supplied currency is what let one farm
     * accumulate mixed currencies and blank out every cost KPI (audit i), so a
     * form that starts sending it again must fail here rather than in a report.
     */
    expect(body).not.toHaveProperty('currency_code')
    expect(body).toEqual({
      hog_id: 7,
      record_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      feed_amount: 2.5,
      feed_cost: 900,
    })
  })

  it('refuses to submit an empty form', async () => {
    const user = userEvent.setup()
    renderWithQuery(<FeedRecordForm open onClose={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Save feed record' }))

    expect(await screen.findByText('Choose an animal')).toBeDefined()
    expect(apiSend).not.toHaveBeenCalled()
  })
})
