export const config = {
  // Backend API URL
  // For local development, use your local Hono.js server
  // For production, replace with your Cloudflare Workers URL
  backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787',

  // Frontend URL (for callbacks, redirects, etc.)
  frontendUrl: process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000',

  // Auth-specific URLs
  auth: {
    // Backend auth endpoints
    baseUrl: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787',
    // Frontend callback URL for OAuth
    callbackUrl:
      process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000',
  },

  // Environment detection
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
} as const;

// Helper functions
export function getBackendUrl(path: string = ''): string {
  return `${config.backendUrl}${path}`;
}

export function getFrontendUrl(path: string = ''): string {
  return `${config.frontendUrl}${path}`;
}

export function getAuthUrl(path: string = ''): string {
  return `${config.auth.baseUrl}/api/auth${path}`;
}
