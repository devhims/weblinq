import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Removed experimental flags - now using stable unstable_cache API
  // experimental: {
  //   useCache: true,
  // },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.weblinq.dev',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn-preview.weblinq.dev',
        pathname: '/**',
      },
    ],
    // Allow blob: scheme for local blob URLs (fallback preview)
    // Since Next.js Image optimisation doesn't handle blob, we mark images as unoptimized in component when using blob.
    // this config is mostly for remote CDN assets
  },
};

export default nextConfig;
