import * as HttpStatusCodes from 'stoker/http-status-codes';

import type { AppRouteHandler } from '@/lib/types';

import type { ApiKeyDemoRoute, AuthDemoRoute } from './demo.routes';

export const authDemo: AppRouteHandler<AuthDemoRoute> = async (c) => {
  const baseUrl = c.env.BETTER_AUTH_URL || 'http://localhost:3000';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Authentication Demo</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            border-bottom: 2px solid #007acc;
            padding-bottom: 10px;
        }
        .section {
            margin: 30px 0;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 6px;
            background: #fafafa;
        }
        .section h2 {
            margin-top: 0;
            color: #555;
        }
        button {
            background: #007acc;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            margin: 5px;
            font-size: 14px;
        }
        button:hover {
            background: #005a9e;
        }
        button.secondary {
            background: #6c757d;
        }
        button.secondary:hover {
            background: #545b62;
        }
        input, textarea {
            width: 100%;
            padding: 8px;
            margin: 5px 0;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-sizing: border-box;
        }
        .form-group {
            margin: 15px 0;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
        }
        .response {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            padding: 15px;
            margin: 10px 0;
            white-space: pre-wrap;
            font-family: monospace;
            font-size: 12px;
            max-height: 200px;
            overflow-y: auto;
        }
        .status {
            padding: 10px;
            margin: 10px 0;
            border-radius: 4px;
            font-weight: 500;
        }
        .status.authenticated {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .status.unauthenticated {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔐 Authentication Demo</h1>
        
        <div id="sessionStatus" class="status">
            <span id="statusText">Checking session...</span>
        </div>

        <div class="section">
            <h2>🔍 Session Status</h2>
            <button onclick="checkSession()">Check Current Session</button>
            <div id="sessionResponse" class="response" style="display: none;"></div>
        </div>

        <div class="section">
            <h2>🐙 GitHub OAuth</h2>
            <p>Test GitHub OAuth authentication flow</p>
            <button onclick="githubSignIn()">Sign In with GitHub</button>
        </div>

        <div class="section">
            <h2>📧 Email Authentication</h2>
            
            <h3>Sign Up</h3>
            <div class="form-group">
                <label>Email:</label>
                <input type="email" id="signupEmail" placeholder="user@example.com" value="test@example.com">
            </div>
            <div class="form-group">
                <label>Password:</label>
                <input type="password" id="signupPassword" placeholder="Password" value="password123">
            </div>
            <div class="form-group">
                <label>Name (optional):</label>
                <input type="text" id="signupName" placeholder="Your Name" value="Test User">
            </div>
            <button onclick="emailSignUp()">Sign Up</button>
            <div id="signupResponse" class="response" style="display: none;"></div>

            <h3>Sign In</h3>
            <div class="form-group">
                <label>Email:</label>
                <input type="email" id="signinEmail" placeholder="user@example.com" value="test@example.com">
            </div>
            <div class="form-group">
                <label>Password:</label>
                <input type="password" id="signinPassword" placeholder="Password" value="password123">
            </div>
            <button onclick="emailSignIn()">Sign In</button>
            <div id="signinResponse" class="response" style="display: none;"></div>
        </div>

        <div class="section">
            <h2>🚪 Sign Out</h2>
            <button onclick="signOut()" class="secondary">Sign Out</button>
            <div id="signoutResponse" class="response" style="display: none;"></div>
        </div>

        <div class="section">
            <h2>🔧 Better Auth Core Endpoints</h2>
            <p>These are handled by Better Auth directly:</p>
            <ul>
                <li><a href="${baseUrl}/api/auth/session" target="_blank">GET /api/auth/session</a></li>
                <li><a href="${baseUrl}/api/auth/sign-in/social?provider=github" target="_blank">GitHub OAuth (Direct)</a></li>
                <li><a href="${baseUrl}/api/auth/sign-out" target="_blank">POST /api/auth/sign-out</a></li>
            </ul>
        </div>

        <div class="section">
            <h2>🔑 API Key Management</h2>
            <p>Test API key creation, management, and operations:</p>
            <a href="${baseUrl}/demo/api-keys" style="display: inline-block; background: #007acc; color: white; text-decoration: none; padding: 10px 20px; border-radius: 4px; margin: 10px 0;">
                Go to API Key Demo →
            </a>
        </div>
    </div>

    <script>
        const baseUrl = '${baseUrl}';
        
        // Check session status on page load
        window.onload = function() {
            checkSession();
        };

        async function makeRequest(url, options = {}) {
            try {
                const response = await fetch(url, {
                    credentials: 'include',
                    ...options
                });
                
                const contentType = response.headers.get('content-type');
                let data;
                
                if (contentType && contentType.includes('application/json')) {
                    data = await response.json();
                } else {
                    data = await response.text();
                }
                
                return {
                    status: response.status,
                    statusText: response.statusText,
                    data: data
                };
            } catch (error) {
                return {
                    status: 0,
                    statusText: 'Network Error',
                    data: error.message
                };
            }
        }

        function displayResponse(elementId, response) {
            const element = document.getElementById(elementId);
            element.style.display = 'block';
            element.textContent = JSON.stringify(response, null, 2);
        }

        function updateSessionStatus(isAuthenticated, user = null) {
            const statusElement = document.getElementById('sessionStatus');
            const statusText = document.getElementById('statusText');
            
            if (isAuthenticated) {
                statusElement.className = 'status authenticated';
                statusText.textContent = \`✅ Authenticated as: \${user?.email || user?.name || 'Unknown User'}\`;
            } else {
                statusElement.className = 'status unauthenticated';
                statusText.textContent = '❌ Not authenticated';
            }
        }

        async function checkSession() {
            const response = await makeRequest(\`\${baseUrl}/auth/session\`);
            displayResponse('sessionResponse', response);
            
            if (response.data && typeof response.data === 'object') {
                updateSessionStatus(response.data.isAuthenticated, response.data.user);
            }
        }

        function githubSignIn() {
            // Redirect to our custom GitHub OAuth endpoint
            window.location.href = \`\${baseUrl}/auth/github/signin?callbackURL=\${encodeURIComponent(window.location.href)}\`;
        }

        async function emailSignUp() {
            const email = document.getElementById('signupEmail').value;
            const password = document.getElementById('signupPassword').value;
            const name = document.getElementById('signupName').value;

            const response = await makeRequest(\`\${baseUrl}/auth/email/signup\`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    password,
                    name: name || undefined,
                    callbackURL: window.location.href
                })
            });

            displayResponse('signupResponse', response);
            
            if (response.status === 201) {
                setTimeout(checkSession, 1000);
            }
        }

        async function emailSignIn() {
            const email = document.getElementById('signinEmail').value;
            const password = document.getElementById('signinPassword').value;

            const response = await makeRequest(\`\${baseUrl}/auth/email/signin\`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    password,
                    callbackURL: window.location.href
                })
            });

            displayResponse('signinResponse', response);
            
            if (response.status === 200) {
                setTimeout(checkSession, 1000);
            }
        }

        async function signOut() {
            const response = await makeRequest(\`\${baseUrl}/auth/signout\`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    callbackURL: window.location.href
                })
            });

            displayResponse('signoutResponse', response);
            
            if (response.status === 200) {
                setTimeout(checkSession, 1000);
            }
        }
    </script>
</body>
</html>`;

  return c.html(html);
};

export const apiKeyDemo: AppRouteHandler<ApiKeyDemoRoute> = async (c) => {
  const baseUrl = c.env.BETTER_AUTH_URL || 'http://localhost:3000';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Key Management Demo</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            border-bottom: 2px solid #007acc;
            padding-bottom: 10px;
        }
        .nav-links {
            margin: 20px 0;
            padding: 15px;
            background: #e9ecef;
            border-radius: 6px;
        }
        .nav-links a {
            color: #007acc;
            text-decoration: none;
            margin-right: 20px;
            font-weight: 500;
        }
        .nav-links a:hover {
            text-decoration: underline;
        }
        .section {
            margin: 30px 0;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 6px;
            background: #fafafa;
        }
        .section h2 {
            margin-top: 0;
            color: #555;
        }
        button {
            background: #007acc;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            margin: 5px;
            font-size: 14px;
        }
        button:hover {
            background: #005a9e;
        }
        button.secondary {
            background: #6c757d;
        }
        button.secondary:hover {
            background: #545b62;
        }
        button.danger {
            background: #dc3545;
        }
        button.danger:hover {
            background: #c82333;
        }
        input, textarea, select {
            width: 100%;
            padding: 8px;
            margin: 5px 0;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-sizing: border-box;
        }
        .form-group {
            margin: 15px 0;
        }
        .form-row {
            display: flex;
            gap: 15px;
        }
        .form-row .form-group {
            flex: 1;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
        }
        .response {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            padding: 15px;
            margin: 10px 0;
            white-space: pre-wrap;
            font-family: monospace;
            font-size: 12px;
            max-height: 300px;
            overflow-y: auto;
        }
        .status {
            padding: 10px;
            margin: 10px 0;
            border-radius: 4px;
            font-weight: 500;
        }
        .status.authenticated {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .status.unauthenticated {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .api-key-item {
            border: 1px solid #ddd;
            border-radius: 6px;
            padding: 15px;
            margin: 10px 0;
            background: white;
        }
        .api-key-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .api-key-name {
            font-weight: bold;
            color: #333;
        }
        .api-key-id {
            font-family: monospace;
            color: #666;
            font-size: 12px;
        }
        .api-key-details {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 10px;
            margin: 10px 0;
            font-size: 14px;
        }
        .detail-item {
            background: #f8f9fa;
            padding: 8px;
            border-radius: 4px;
        }
        .detail-label {
            font-weight: 500;
            color: #666;
        }
        .detail-value {
            color: #333;
        }
        .checkbox-group {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .checkbox-group input[type="checkbox"] {
            width: auto;
            margin: 0;
        }
        .hidden {
            display: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔑 API Key Management Demo</h1>
        
        <div class="nav-links">
            <a href="${baseUrl}/demo">← Back to Auth Demo</a>
            <a href="${baseUrl}/api/reference" target="_blank">API Documentation</a>
        </div>
        
        <div id="sessionStatus" class="status">
            <span id="statusText">Checking session...</span>
        </div>

        <div class="section">
            <h2>🔍 Session Check</h2>
            <p>API key operations require authentication. Check your current session status.</p>
            <button onclick="checkSession()">Check Current Session</button>
            <div id="sessionResponse" class="response" style="display: none;"></div>
        </div>

        <div class="section">
            <h2>➕ Create API Key</h2>
            <p><strong>System Defaults:</strong> wq_ prefix, 1000 requests per 24 hours rate limit, never expires, free plan metadata</p>
            
            <div class="form-group">
                <label>Name:</label>
                <input type="text" id="createName" placeholder="My API Key" value="Test API Key">
                <small style="color: #666; font-size: 12px;">Give your API key a descriptive name</small>
            </div>

            <button onclick="createApiKey()">Create API Key</button>
            <div id="createResponse" class="response" style="display: none;"></div>
        </div>

        <div class="section">
            <h2>📋 List API Keys</h2>
            <button onclick="listApiKeys()">Refresh API Keys</button>
            <div id="listResponse" class="response" style="display: none;"></div>
            <div id="apiKeysList"></div>
        </div>

        <div class="section">
            <h2>🔍 Get Specific API Key</h2>
            <div class="form-group">
                <label>API Key ID:</label>
                <input type="text" id="getKeyId" placeholder="Enter API key ID">
            </div>
            <button onclick="getApiKey()">Get API Key Details</button>
            <div id="getResponse" class="response" style="display: none;"></div>
        </div>

        <div class="section">
            <h2>🗑️ Delete API Key</h2>
            <p><strong>Note:</strong> API keys cannot be updated. Create a new key if you need different settings.</p>
            <div class="form-group">
                <label>API Key ID:</label>
                <input type="text" id="deleteKeyId" placeholder="Enter API key ID">
            </div>
            <button onclick="deleteApiKey()" class="danger">Delete API Key</button>
            <div id="deleteResponse" class="response" style="display: none;"></div>
        </div>
    </div>

    <script>
        const baseUrl = '${baseUrl}';
        
        // Check session status on page load
        window.onload = function() {
            checkSession();
        };

        async function makeRequest(url, options = {}) {
            try {
                const response = await fetch(url, {
                    credentials: 'include',
                    ...options
                });
                
                const contentType = response.headers.get('content-type');
                let data;
                
                if (contentType && contentType.includes('application/json')) {
                    data = await response.json();
                } else {
                    data = await response.text();
                }
                
                return {
                    status: response.status,
                    statusText: response.statusText,
                    data: data
                };
            } catch (error) {
                return {
                    status: 0,
                    statusText: 'Network Error',
                    data: error.message
                };
            }
        }

        function displayResponse(elementId, response) {
            const element = document.getElementById(elementId);
            element.style.display = 'block';
            element.textContent = JSON.stringify(response, null, 2);
        }

        function updateSessionStatus(isAuthenticated, user = null) {
            const statusElement = document.getElementById('sessionStatus');
            const statusText = document.getElementById('statusText');
            
            if (isAuthenticated) {
                statusElement.className = 'status authenticated';
                statusText.textContent = \`✅ Authenticated as: \${user?.email || user?.name || 'Unknown User'}\`;
            } else {
                statusElement.className = 'status unauthenticated';
                statusText.textContent = '❌ Not authenticated - API key operations require authentication';
            }
        }

        async function checkSession() {
            const response = await makeRequest(\`\${baseUrl}/auth/session\`);
            displayResponse('sessionResponse', response);
            
            if (response.data && typeof response.data === 'object') {
                updateSessionStatus(response.data.isAuthenticated, response.data.user);
            }
        }

        function parseJsonField(value) {
            if (!value.trim()) return undefined;
            try {
                return JSON.parse(value);
            } catch (e) {
                alert('Invalid JSON format');
                return null;
            }
        }

        async function createApiKey() {
            const name = document.getElementById('createName').value;

            if (!name) {
                alert('Name is required');
                return;
            }

            const body = {
                name,
            };

            const response = await makeRequest(\`\${baseUrl}/api-keys/create\`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body)
            });

            displayResponse('createResponse', response);
            
            if (response.status === 201) {
                // Clear form and refresh list
                document.getElementById('createName').value = 'Test API Key';
                setTimeout(listApiKeys, 1000);
            }
        }

        async function listApiKeys() {
            const response = await makeRequest(\`\${baseUrl}/api-keys/list\`);
            displayResponse('listResponse', response);
            
            if (response.status === 200 && response.data.apiKeys) {
                displayApiKeysList(response.data.apiKeys);
            }
        }

        function displayApiKeysList(apiKeys) {
            const container = document.getElementById('apiKeysList');
            
            if (!apiKeys || apiKeys.length === 0) {
                container.innerHTML = '<p>No API keys found.</p>';
                return;
            }

            container.innerHTML = apiKeys.map(key => \`
                <div class="api-key-item">
                    <div class="api-key-header">
                        <div>
                            <div class="api-key-name">\${key.name || 'Unnamed API Key'}</div>
                            <div class="api-key-id">ID: \${key.id}</div>
                        </div>
                        <div>
                            <button onclick="fillGetForm('\${key.id}')" class="secondary">Get Details</button>
                            <button onclick="fillDeleteForm('\${key.id}')" class="danger">Delete</button>
                        </div>
                    </div>
                    <div class="api-key-details">
                        <div class="detail-item">
                            <div class="detail-label">Status:</div>
                            <div class="detail-value">\${key.enabled ? '✅ Enabled' : '❌ Disabled'}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Requests:</div>
                            <div class="detail-value">\${key.requestCount || 0}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Remaining:</div>
                            <div class="detail-value">\${key.remaining !== null ? key.remaining : 'Unlimited'}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Created:</div>
                            <div class="detail-value">\${new Date(key.createdAt).toLocaleString()}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Expires:</div>
                            <div class="detail-value">\${key.expiresAt ? new Date(key.expiresAt).toLocaleString() : 'Never'}</div>
                        </div>
                    </div>
                </div>
            \`).join('');
        }

        function fillGetForm(keyId) {
            document.getElementById('getKeyId').value = keyId;
            document.getElementById('getKeyId').scrollIntoView({ behavior: 'smooth' });
        }

        function fillDeleteForm(keyId) {
            document.getElementById('deleteKeyId').value = keyId;
            document.getElementById('deleteKeyId').scrollIntoView({ behavior: 'smooth' });
        }

        async function getApiKey() {
            const keyId = document.getElementById('getKeyId').value;
            
            if (!keyId) {
                alert('Please enter an API key ID');
                return;
            }

            const response = await makeRequest(\`\${baseUrl}/api-keys/\${keyId}\`);
            displayResponse('getResponse', response);
        }

        async function deleteApiKey() {
            const keyId = document.getElementById('deleteKeyId').value;
            
            if (!keyId) {
                alert('Please enter an API key ID');
                return;
            }

            if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
                return;
            }

            const response = await makeRequest(\`\${baseUrl}/api-keys/\${keyId}\`, {
                method: 'DELETE'
            });

            displayResponse('deleteResponse', response);
            
            if (response.status === 200) {
                document.getElementById('deleteKeyId').value = '';
                setTimeout(listApiKeys, 1000);
            }
        }

        // Auto-load API keys list on page load
        setTimeout(listApiKeys, 1500);
    </script>
</body>
</html>`;

  return c.html(html);
};
