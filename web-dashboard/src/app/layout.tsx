import type { Metadata } from 'next'
import { Archivo } from 'next/font/google'

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
    <html lang="en" className={archivo.variable}>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  )
}
