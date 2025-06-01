import { createAuthClient } from 'better-auth/react';

console.log('🔧 Auth client setup (local Next.js auth):', {
  environment: process.env.NODE_ENV,
  frontendUrl: process.env.NEXT_PUBLIC_FRONTEND_URL,
});

// Add minimal fetch debugging to see what's happening
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
    console.log('🌐 Auth request:', { url, method: init?.method || 'GET' });

    const response = await originalFetch(input, init);

    console.log('🌐 Auth response:', {
      url,
      status: response.status,
      setCookie: response.headers.get('set-cookie'),
      hasBody: response.headers.get('content-length') !== '0',
    });

    // Log response body for get-session requests
    if (url.includes('get-session')) {
      const cloned = response.clone();
      try {
        const text = await cloned.text();
        console.log('🌐 Session response body:', text);
      } catch {
        console.log('🌐 Could not read session response body');
      }
    }

    return response;
  }

  return originalFetch(input, init);
};

export const authClient = createAuthClient({
  // Use local Next.js auth endpoints (same domain - no CORS issues!)
  baseURL: process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000',
  fetchOptions: {
    credentials: 'include', // Include cookies for session management
  },
});

// Export the hooks and methods from Better Auth
export const { useSession, signIn, signUp, signOut, getSession, $Infer } =
  authClient;

// Export types for TypeScript support
export type Session = typeof authClient.$Infer.Session;
export type User = typeof authClient.$Infer.Session.user;
