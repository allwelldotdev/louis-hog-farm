import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // No `rewrites` to the API and no NEXT_PUBLIC_* base URL. Every backend call
  // goes through a route handler under /api, which reads API_INTERNAL_URL
  // server-side and attaches the access token from an httpOnly cookie. The
  // browser never learns the API's address, which is what makes CORS a
  // non-issue here rather than merely configured.
  reactStrictMode: true,
}

export default nextConfig
