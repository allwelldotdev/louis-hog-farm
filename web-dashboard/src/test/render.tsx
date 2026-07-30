import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'

/**
 * Render a component that fetches.
 *
 * A fresh QueryClient per call, with retries off: a component under test that
 * throws should fail the assertion immediately rather than after three
 * exponential backoffs.
 */
export function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })

  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}
