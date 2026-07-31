import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll, vi } from 'vitest'

/**
 * Every dashboard hook reads its filters from the URL, and `useSearchParams`
 * throws outside a mounted App Router. Standing in an empty query string is
 * what a component sees on an unfiltered dashboard, which is the state under
 * test; a test that needs specific filters can override this per file.
 */
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/dashboard',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}))

/**
 * jsdom has no layout engine and no `ResizeObserver`, and Recharts'
 * `ResponsiveContainer` needs both: it subscribes to the container's size and
 * renders nothing at all until it is told one. Without this, every chart test
 * asserts against an empty `<div>` and passes for the wrong reason.
 *
 * Reporting a fixed size is what makes the *real* container run, so the tests
 * exercise the component the app ships rather than a stub standing in for it.
 */
const TEST_CHART_WIDTH = 600
const TEST_CHART_HEIGHT = 300

class FixedSizeResizeObserver implements ResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(target: Element): void {
    const contentRect = {
      width: TEST_CHART_WIDTH,
      height: TEST_CHART_HEIGHT,
      top: 0,
      left: 0,
      bottom: TEST_CHART_HEIGHT,
      right: TEST_CHART_WIDTH,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }
    this.callback(
      [
        {
          target,
          contentRect,
          borderBoxSize: [],
          contentBoxSize: [],
          devicePixelContentBoxSize: [],
        },
      ],
      this,
    )
  }

  unobserve(): void {}
  disconnect(): void {}
}

/**
 * jsdom parses `<dialog>` but implements neither `showModal()` nor `close()`,
 * so a component that drives the element imperatively throws on mount.
 *
 * Mapping them onto the `open` attribute is enough for the tests that matter
 * here — is the form on screen, and can it be submitted. The top layer, the
 * focus trap and the backdrop are the browser's job and are not asserted; those
 * are exactly the parts worth taking from the platform rather than reimplementing.
 */
function stubDialog() {
  const proto = globalThis.HTMLDialogElement?.prototype
  if (!proto || typeof proto.showModal === 'function') return

  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true
  }
  proto.show = function show(this: HTMLDialogElement) {
    this.open = true
  }
  proto.close = function close(this: HTMLDialogElement) {
    this.open = false
  }
}

beforeAll(() => {
  stubDialog()
  globalThis.ResizeObserver = FixedSizeResizeObserver

  // Recharts also measures through the DOM directly; jsdom reports zero for
  // both, which collapses the plotting area even once a size is observed.
  for (const [property, value] of [
    ['offsetWidth', TEST_CHART_WIDTH],
    ['offsetHeight', TEST_CHART_HEIGHT],
    ['clientWidth', TEST_CHART_WIDTH],
    ['clientHeight', TEST_CHART_HEIGHT],
  ] as const) {
    Object.defineProperty(HTMLElement.prototype, property, {
      configurable: true,
      value,
    })
  }
})

afterEach(cleanup)
