/**
 * Where the NestJS API runs, e.g. https://gamefeatures-api.onrender.com (no trailing slash,
 * no /api/v1). Read when the config loads, so on Vercel it must be set before the build.
 */
const apiOrigin = process.env.API_ORIGIN?.replace(/\/+$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'media.rawg.io',
      },
    ],
  },
  transpilePackages: ['@game-review/shared'],

  // Same-origin API: the browser calls /api/v1/* on the web app's own origin and Next.js
  // proxies it to the API. The refresh token is a SameSite=Lax, host-only cookie, so it only
  // works when the API looks like the same site as the web app (a cross-site vercel.app ->
  // onrender.com cookie would be dropped). Local dev uses the same path, so dev matches prod.
  async rewrites() {
    if (!apiOrigin) return [];
    return [{ source: '/api/v1/:path*', destination: `${apiOrigin}/api/v1/:path*` }];
  },
};

module.exports = nextConfig;
