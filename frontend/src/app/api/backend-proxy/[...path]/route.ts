import { auth } from '@/lib/auth';
import { getBackendUrl } from '@/config/env';

// Handle all HTTP methods
export async function GET(
  request: Request,
  { params }: { params: { path: string[] } }
) {
  return handleProxyRequest(request, params.path, 'GET');
}

export async function POST(
  request: Request,
  { params }: { params: { path: string[] } }
) {
  return handleProxyRequest(request, params.path, 'POST');
}

export async function PUT(
  request: Request,
  { params }: { params: { path: string[] } }
) {
  return handleProxyRequest(request, params.path, 'PUT');
}

export async function DELETE(
  request: Request,
  { params }: { params: { path: string[] } }
) {
  return handleProxyRequest(request, params.path, 'DELETE');
}

export async function PATCH(
  request: Request,
  { params }: { params: { path: string[] } }
) {
  return handleProxyRequest(request, params.path, 'PATCH');
}

async function handleProxyRequest(
  request: Request,
  pathSegments: string[],
  method: string
) {
  try {
    // Get the session from the same-domain cookies
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('✅ Proxy: Session found for user:', {
      userId: session.user.id,
      email: session.user.email,
      sessionStructure: {
        hasSession: !!session.session,
        sessionId: session.session?.id,
        sessionToken: session.session?.token,
        sessionKeys: session.session ? Object.keys(session.session) : [],
      },
    });

    // Reconstruct the backend URL
    const backendPath = '/' + pathSegments.join('/');
    const backendUrl = getBackendUrl(backendPath);

    // Get the original request body if it exists
    let body: string | undefined;
    if (method !== 'GET' && method !== 'HEAD') {
      try {
        body = await request.text();
      } catch {
        // No body or error reading body
      }
    }

    // Extract relevant headers (excluding host, etc.)
    const forwardHeaders: Record<string, string> = {
      'Content-Type': request.headers.get('Content-Type') || 'application/json',
      'User-Agent': request.headers.get('User-Agent') || 'Next.js Proxy',
    };

    // Get session token to send to backend - try different approaches
    let authHeader = '';

    // Try session token first (bearer plugin)
    const sessionToken = session.session?.token;
    if (sessionToken) {
      authHeader = `Bearer ${sessionToken}`;
      console.log('✅ Proxy: Using session token for auth:', {
        tokenPreview: sessionToken.substring(0, 20) + '...',
        tokenLength: sessionToken.length,
      });
    }
    // Fallback: try session ID
    else if (session.session?.id) {
      authHeader = `Bearer ${session.session.id}`;
      console.log('✅ Proxy: Using session ID for auth:', {
        sessionId: session.session.id,
      });
    }
    // Last resort: user ID (not recommended but for debugging)
    else {
      authHeader = `Bearer user_${session.user.id}`;
      console.log('⚠️ Proxy: Using user ID for auth (fallback):', {
        userId: session.user.id,
      });
    }

    if (authHeader) {
      forwardHeaders['Authorization'] = authHeader;
    } else {
      console.warn('⚠️ Proxy: No authentication method available');
    }

    console.log('🚀 Proxy: Forwarding request to backend:', {
      url: backendUrl,
      method,
      hasBody: !!body,
      hasAuth: !!authHeader,
      headers: Object.keys(forwardHeaders),
    });

    // Forward the request to the backend
    const backendResponse = await fetch(backendUrl, {
      method,
      headers: forwardHeaders,
      body,
    });

    console.log('📊 Proxy: Backend response:', {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
      responseHeaders: Object.fromEntries(backendResponse.headers.entries()),
    });

    // Get the response data
    const responseData = await backendResponse.text();

    // Log response body for debugging
    if (backendResponse.status >= 400) {
      console.error('❌ Proxy: Backend error response:', responseData);
    }

    // Forward the backend response to the frontend
    return new Response(responseData, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
      headers: {
        'Content-Type':
          backendResponse.headers.get('Content-Type') || 'application/json',
      },
    });
  } catch (error) {
    console.error('❌ Proxy error:', error);
    return new Response(
      JSON.stringify({
        error: 'Proxy error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
