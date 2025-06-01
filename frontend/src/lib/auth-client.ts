import { createAuthClient } from 'better-auth/react';
import { config } from '@/config/env';

// Debug: Log the auth URL being used
const authUrl = config.backendUrl; // Use backend URL directly, not getAuthUrl()
console.log('🔧 Auth client base URL:', authUrl);
console.log('🔧 Environment variables:', {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
  NEXT_PUBLIC_FRONTEND_URL: process.env.NEXT_PUBLIC_FRONTEND_URL,
});

// Enhanced fetch debugging based on official Hono client approach
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
      ? input.href
      : input.url;

  // Only log auth-related requests
  if (url.includes('/api/auth/')) {
    console.log('🌐 Auth fetch request (Hono-style):', {
      url,
      method: init?.method || 'GET',
      credentials: init?.credentials,
      headers: init?.headers,
      // Check if credentials are being passed correctly
      hasCredentials: init?.credentials === 'include',
      // Check origin for CORS debugging
      origin: typeof window !== 'undefined' ? window.location.origin : 'SSR',
    });

    const response = await originalFetch(input, init);
    const clonedResponse = response.clone();

    console.log('🌐 Auth fetch response (Hono-style):', {
      url,
      status: response.status,
      statusText: response.statusText,
      headers: [...response.headers.entries()],
      // Check for CORS-related headers
      corsHeaders: {
        'access-control-allow-origin': response.headers.get(
          'access-control-allow-origin'
        ),
        'access-control-allow-credentials': response.headers.get(
          'access-control-allow-credentials'
        ),
        'set-cookie': response.headers.get('set-cookie'),
      },
    });

    // Try to log response body for auth requests
    try {
      const text = await clonedResponse.text();
      console.log('🌐 Auth response body:', text.substring(0, 500)); // First 500 chars

      // If it's JSON, parse it for better debugging
      try {
        const json = JSON.parse(text);
        if (json.error) {
          console.error('❌ Auth API Error:', json);
        }
      } catch {
        // Not JSON, that's fine
      }
    } catch {
      console.log('🌐 Could not read response body');
    }

    return response;
  }

  return originalFetch(input, init);
};

export const authClient = createAuthClient({
  baseURL: authUrl, // Better Auth client will automatically append /api/auth/* endpoints
  fetchOptions: {
    credentials: 'include', // Required for sending cookies cross-origin (per official docs)
  },
});

// Export the hooks and methods from Better Auth
export const { useSession, signIn, signUp, signOut, getSession, $Infer } =
  authClient;

// Export types for TypeScript support
export type Session = typeof authClient.$Infer.Session;
export type User = typeof authClient.$Infer.Session.user;
