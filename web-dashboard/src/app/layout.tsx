import type { Metadata } from 'next'
import { Archivo } from 'next/font/google'

import { THEME_SCRIPT } from '@/lib/theme/theme'

import './globals.css'

// One family, two jobs. Archivo's width axis is what lets a KPI figure be set
// wide enough to read as an instrument display while the surrounding UI stays
// at normal width — same voice, different register, no second webfont.
const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  display: 'swap',
  variable: '--font-archivo',
})

export const metadata: Metadata = {
  title: 'Bright Acres — Hog Farm',
  description: 'Herd growth, feed cost and health records for a working piggery.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `suppressHydrationWarning` because THEME_SCRIPT writes `data-theme` on
    // this element before React hydrates, and React would otherwise report an
    // attribute it did not render. It suppresses one level only — nothing
    // inside <body> is affected.
    <html lang="en" className={archivo.variable} suppressHydrationWarning>
      <head>
        {/* Inline and synchronous, so the theme is on <html> before the first
            paint. `next/script` at any strategy runs after it, and the flash is
            back. This is also why the theme has no provider: the store is this
            attribute, so it works on the sign-in page too, which sits outside
            the `(app)` providers entirely. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  )
}
