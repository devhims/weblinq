// Helper function to get the current frontend URL dynamically
function getCurrentFrontendUrl(): string {
  // Server-side: use environment variable
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
  }

  // Client-side: use current window location
  const { protocol, host } = window.location;
  return `${protocol}//${host}`;
}

export const config = {
  // Backend API URL
  // For local development, use your local Hono.js server
  // For production, replace with your Cloudflare Workers URL
  backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787',

  // Frontend URL (for callbacks, redirects, etc.)
  // Dynamically determined to support preview environments
  frontendUrl: getCurrentFrontendUrl(),

  // Auth-specific URLs
  auth: {
    // Backend auth endpoints
    baseUrl: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787',
    // Frontend callback URL for OAuth - dynamically determined
    callbackUrl: getCurrentFrontendUrl(),
  },

  // Environment detection
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
} as const;

// Helper functions
export function getBackendUrl(path: string = ''): string {
  const baseUrl = config.backendUrl.replace(/\/$/, ''); // Remove trailing slash
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

export function getFrontendUrl(path: string = ''): string {
  const baseUrl = config.frontendUrl.replace(/\/$/, ''); // Remove trailing slash
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

export function getAuthUrl(path: string = ''): string {
  const baseUrl = config.auth.baseUrl.replace(/\/$/, ''); // Remove trailing slash
  if (!path) {
    return `${baseUrl}/api/auth`;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}/api/auth${cleanPath}`;
}
