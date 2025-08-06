import { env } from 'cloudflare:workers';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';

// Hono app with typed variables
const app = new Hono<{
	Variables: {
		apiKey: string;
	};
	Bindings: CloudflareBindings;
}>();

// Auth middleware
const requireApiKey = async (c: any, next: () => Promise<void>) => {
	const raw =
		(c.req.header('authorization') ?? '')
			// remove “Bearer” followed by 0 or more spaces
			.replace(/^Bearer\s*/i, '') || c.req.query('apiKey');

	if (!raw) {
		return c.json({ error: 'Missing API key' }, 401);
	}

	// Store the API key for use in tools
	c.set('apiKey', raw);
	await next();
};

// Enable CORS for all routes
app.use('*', cors());

// Base URL for the WebLinq API - configurable via environment
const API_BASE = env.NODE_ENV === 'development' ? 'http://localhost:8787' : 'https://api.weblinq.dev';

// Helper function to make authenticated requests to the WebLinq API
async function makeApiRequest(endpoint: string, options: RequestInit & { apiKey: string }) {
	const { apiKey, ...requestOptions } = options;

	const response = await fetch(`${API_BASE}${endpoint}`, {
		...requestOptions,
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
			...requestOptions.headers,
		},
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`API request failed: ${response.status} ${errorText}`);
	}

	return response.json();
}

// Special API request handler for binary endpoints that may return binary or JSON
async function makeApiRequestWithBinarySupport(endpoint: string, options: RequestInit & { apiKey: string }) {
	const { apiKey, ...requestOptions } = options;

	const response = await fetch(`${API_BASE}${endpoint}`, {
		...requestOptions,
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
			...requestOptions.headers,
		},
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`API request failed: ${response.status} ${errorText}`);
	}

	// Check content type to determine how to handle the response
	const contentType = response.headers.get('content-type') || '';

	if (contentType.includes('application/json')) {
		// JSON response (when base64=true or error occurred)
		return response.json();
	} else if (contentType.startsWith('image/') || contentType === 'application/pdf') {
		// Binary response - convert to base64 for MCP transmission
		const arrayBuffer = await response.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		const base64Data = buffer.toString('base64');

		// Extract metadata from headers
		const metadata = {
			format: contentType.split('/')[1] || 'png',
			size: parseInt(response.headers.get('content-length') || '0'),
			timestamp: new Date().toISOString(),
		};

		// Determine if this is a PDF or image based on content type
		const isPdf = contentType === 'application/pdf';

		return {
			success: true,
			data: isPdf
				? {
						pdf: base64Data,
						metadata,
						permanentUrl: response.headers.get('x-permanent-url') || undefined,
						fileId: response.headers.get('x-file-id') || undefined,
				  }
				: {
						image: base64Data,
						metadata,
						permanentUrl: response.headers.get('x-permanent-url') || undefined,
						fileId: response.headers.get('x-file-id') || undefined,
				  },
			creditsCost: parseInt(response.headers.get('x-credits-cost') || '1'),
		};
	} else {
		// Fallback to JSON
		return response.json();
	}
}

// Tool definitions based on the OpenAPI spec
const tools = [
	// User tools
	{
		name: 'get_user_info',
		description: 'Get current user information and authentication status',
		inputSchema: {
			type: 'object',
			properties: {},
		},
	},
	{
		name: 'get_user_credits',
		description: 'Get user credit balance and plan information',
		inputSchema: {
			type: 'object',
			properties: {},
		},
	},

	// API Key tools
	{
		name: 'create_api_key',
		description: 'Create a new API key for the authenticated user',
		inputSchema: {
			type: 'object',
			properties: {
				name: {
					type: 'string',
					description: 'Name for the API key',
				},
			},
			required: ['name'],
		},
	},
	{
		name: 'list_api_keys',
		description: 'List all API keys for the authenticated user',
		inputSchema: {
			type: 'object',
			properties: {},
		},
	},
	{
		name: 'delete_api_key',
		description: 'Delete an API key',
		inputSchema: {
			type: 'object',
			properties: {
				id: {
					type: 'string',
					description: 'API key ID to delete',
				},
			},
			required: ['id'],
		},
	},

	// Web scraping tools
	{
		name: 'screenshot',
		description: 'Capture a screenshot of a web page',
		inputSchema: {
			type: 'object',
			properties: {
				url: {
					type: 'string',
					format: 'uri',
					description: 'URL of the web page to screenshot',
				},
				waitTime: {
					type: 'integer',
					minimum: 0,
					maximum: 5000,
					default: 0,
					description: 'Wait time in milliseconds before taking screenshot',
				},
				base64: {
					type: 'boolean',
					default: false,
					description: 'Return base64 string instead of binary data',
				},
				viewport: {
					type: 'object',
					properties: {
						width: { type: 'integer', minimum: 100, maximum: 3840, default: 1920 },
						height: { type: 'integer', minimum: 100, maximum: 2160, default: 1080 },
					},
					description: 'Viewport configuration',
				},
			},
			required: ['url'],
		},
	},
	{
		name: 'extract_markdown',
		description: 'Extract markdown content from a web page',
		inputSchema: {
			type: 'object',
			properties: {
				url: {
					type: 'string',
					format: 'uri',
					description: 'URL of the web page to convert to markdown',
				},
				waitTime: {
					type: 'integer',
					minimum: 0,
					maximum: 5000,
					default: 0,
					description: 'Wait time in milliseconds before extracting content',
				},
			},
			required: ['url'],
		},
	},
	{
		name: 'ai_extract',
		description: 'Extract structured data from a web page using AI',
		inputSchema: {
			type: 'object',
			properties: {
				url: {
					type: 'string',
					format: 'uri',
					description: 'URL of the web page to extract data from',
				},
				prompt: {
					type: 'string',
					description: 'Natural language prompt for extraction (required for text responses, optional for JSON with schema)',
				},
				responseType: {
					type: 'string',
					enum: ['json', 'text'],
					default: 'text',
					description: 'Type of response to return (default: text string)',
				},
				response_format: {
					type: 'object',
					properties: {
						type: {
							type: 'string',
							enum: ['json_schema'],
							description: 'Format type - must be json_schema',
						},
						json_schema: {
							type: 'object',
							description: 'JSON schema object defining the structure of expected response',
						},
					},
					required: ['type', 'json_schema'],
					description: 'AI extract schema for extraction (only valid when responseType is json)',
				},
				instructions: {
					type: 'string',
					description: 'Additional instructions for the AI (max 500 characters)',
				},
				waitTime: {
					type: 'integer',
					minimum: 0,
					maximum: 5000,
					default: 0,
					description: 'Wait time in milliseconds before extracting content',
				},
			},
			required: ['url'],
		},
	},
	{
		name: 'get_html_content',
		description: 'Get raw HTML content from a web page',
		inputSchema: {
			type: 'object',
			properties: {
				url: {
					type: 'string',
					format: 'uri',
					description: 'URL of the web page to get HTML from',
				},
				waitTime: {
					type: 'integer',
					minimum: 0,
					maximum: 5000,
					default: 0,
					description: 'Wait time in milliseconds before extracting content',
				},
			},
			required: ['url'],
		},
	},
	{
		name: 'scrape_elements',
		description: 'Scrape specific elements from a web page using CSS selectors',
		inputSchema: {
			type: 'object',
			properties: {
				url: {
					type: 'string',
					format: 'uri',
					description: 'URL of the web page to scrape',
				},
				elements: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							selector: {
								type: 'string',
								description: 'CSS selector for the element',
							},
							attributes: {
								type: 'array',
								items: { type: 'string' },
								description: 'Optional list of attributes to extract',
							},
						},
						required: ['selector'],
					},
					description: 'Elements to scrape with their selectors and optional attributes',
				},
				waitTime: {
					type: 'integer',
					minimum: 0,
					maximum: 5000,
					default: 0,
					description: 'Wait time in milliseconds before scraping',
				},
				headers: {
					type: 'object',
					additionalProperties: { type: 'string' },
					description: 'Optional HTTP headers to send with the request',
				},
			},
			required: ['url', 'elements'],
		},
	},
	{
		name: 'extract_links',
		description: 'Extract all links from a web page',
		inputSchema: {
			type: 'object',
			properties: {
				url: {
					type: 'string',
					format: 'uri',
					description: 'URL of the web page to extract links from',
				},
				includeExternal: {
					type: 'boolean',
					description: 'Include external links in the results',
					default: true,
				},
				waitTime: {
					type: 'integer',
					description: 'Wait time in milliseconds before extracting content',
					default: 0,
					minimum: 0,
					maximum: 5000,
				},
			},
			required: ['url'],
		},
	},
	{
		name: 'web_search',
		description: 'Perform a web search using Google',
		inputSchema: {
			type: 'object',
			properties: {
				query: {
					type: 'string',
					description: 'Search query',
				},
				limit: {
					type: 'integer',
					minimum: 1,
					maximum: 20,
					default: 10,
					description: 'Number of results to return',
				},
			},
			required: ['query'],
		},
	},
	{
		name: 'generate_pdf',
		description: 'Generate a PDF from a web page',
		inputSchema: {
			type: 'object',
			properties: {
				url: {
					type: 'string',
					format: 'uri',
					description: 'URL of the web page to convert to PDF',
				},
				waitTime: {
					type: 'integer',
					minimum: 0,
					maximum: 5000,
					default: 0,
					description: 'Wait time in milliseconds before generating PDF',
				},
				format: {
					type: 'string',
					enum: ['A4', 'letter'],
					default: 'A4',
					description: 'PDF page format',
				},
			},
			required: ['url'],
		},
	},

	// File management tools
	{
		name: 'list_files',
		description: 'List files uploaded by the user',
		inputSchema: {
			type: 'object',
			properties: {
				type: {
					type: 'string',
					description: 'Filter by file type',
				},
				limit: {
					type: 'integer',
					minimum: 1,
					maximum: 100,
					default: 20,
					description: 'Number of files to return',
				},
				offset: {
					type: 'integer',
					minimum: 0,
					default: 0,
					description: 'Number of files to skip',
				},
			},
		},
	},
	{
		name: 'delete_file',
		description: 'Delete a file by ID',
		inputSchema: {
			type: 'object',
			properties: {
				id: {
					type: 'string',
					description: 'File ID to delete',
				},
			},
			required: ['id'],
		},
	},
];

// Zod schemas for tool argument validation and coercion
// Benefits over manual coercion:
// - Type-safe validation with automatic TypeScript inference
// - Built-in type coercion (strings to numbers, booleans, etc.)
// - Automatic default value application
// - Constraint enforcement (min/max values, URL validation)
// - Better error handling with detailed validation messages
// - Maintainable schema definitions that stay in sync with tool definitions
const ToolSchemas = {
	// User tools
	get_user_info: z.object({}),
	get_user_credits: z.object({}),

	// API Key tools
	create_api_key: z.object({
		name: z.string(),
	}),
	list_api_keys: z.object({}),
	delete_api_key: z.object({
		id: z.string(),
	}),

	// Web scraping tools
	screenshot: z.object({
		url: z.string().url(),
		waitTime: z.coerce.number().int().min(0).max(5000).default(0),
		base64: z.coerce.boolean().default(false),
		viewport: z
			.union([
				z.string().transform((str) => {
					try {
						return JSON.parse(str);
					} catch {
						return { width: 1920, height: 1080 };
					}
				}),
				z.object({
					width: z.coerce.number().int().min(100).max(3840).default(1920),
					height: z.coerce.number().int().min(100).max(2160).default(1080),
				}),
			])
			.optional()
			.transform((val) => val || { width: 1920, height: 1080 }),
	}),
	extract_markdown: z.object({
		url: z.string().url(),
		waitTime: z.coerce.number().int().min(0).max(5000).default(0),
	}),
	ai_extract: z
		.object({
			url: z.string().url(),
			prompt: z.string().min(1).max(1000).optional(),
			responseType: z.enum(['json', 'text']).default('text'),
			response_format: z
				.object({
					type: z.literal('json_schema'),
					json_schema: z.record(z.any()),
				})
				.optional(),
			instructions: z.string().max(500).optional(),
			waitTime: z.coerce.number().int().min(0).max(5000).default(0),
		})
		.refine((data) => data.responseType !== 'text' || data.prompt, {
			message: "Text responses require a 'prompt'",
			path: ['prompt'],
		})
		.refine((data) => data.responseType !== 'json' || data.prompt || data.response_format, {
			message: "JSON responses require either 'prompt' or 'response_format' (or both)",
			path: ['responseType'],
		})
		.refine((data) => data.responseType !== 'text' || !data.response_format, {
			message: "Schema-based 'response_format' is only valid for JSON responses",
			path: ['response_format'],
		}),
	get_html_content: z.object({
		url: z.string().url(),
		waitTime: z.coerce.number().int().min(0).max(5000).default(0),
	}),
	scrape_elements: z.object({
		url: z.string().url(),
		elements: z.array(
			z.object({
				selector: z.string(),
				attributes: z.array(z.string()).optional(),
			})
		),
		waitTime: z.coerce.number().int().min(0).max(5000).default(0),
		headers: z.record(z.string()).optional(),
	}),
	extract_links: z.object({
		url: z.string().url(),
		includeExternal: z.coerce.boolean().default(true),
		waitTime: z.coerce.number().int().min(0).max(5000).default(0),
	}),
	web_search: z.object({
		query: z.string(),
		limit: z.coerce.number().int().min(1).max(20).default(10),
	}),
	generate_pdf: z.object({
		url: z.string().url(),
		waitTime: z.coerce.number().int().min(0).max(5000).default(0),
		format: z.enum(['A4', 'letter']).default('A4'),
	}),

	// File management tools
	list_files: z.object({
		type: z.string().optional(),
		limit: z.coerce.number().int().min(1).max(100).default(20),
		offset: z.coerce.number().int().min(0).default(0),
	}),
	delete_file: z.object({
		id: z.string(),
	}),
} as const;

// TypeScript types derived from Zod schemas
type ToolInputs = {
	[K in keyof typeof ToolSchemas]: z.infer<(typeof ToolSchemas)[K]>;
};

// Helper function to validate and coerce tool arguments using Zod
function coerceToolArguments(toolName: string, args: any): any {
	if (!args || typeof args !== 'object') return args;

	const schema = ToolSchemas[toolName as keyof typeof ToolSchemas];
	if (!schema) {
		console.warn(`No schema found for tool: ${toolName}`);
		return args;
	}

	try {
		return schema.parse(args);
	} catch (error) {
		console.warn(`Validation error for tool ${toolName}:`, error);
		// Return original args if validation fails to maintain backward compatibility
		return args;
	}
}

// Helper function to execute tools
async function executeTool(name: string, args: any, apiKey: string) {
	try {
		// Coerce string arguments to proper types
		const coercedArgs = coerceToolArguments(name, args);

		switch (name) {
			// User tools
			case 'get_user_info':
				return await makeApiRequest('/v1/user/me', {
					method: 'GET',
					apiKey,
				});

			case 'get_user_credits':
				return await makeApiRequest('/v1/user/credits', {
					method: 'GET',
					apiKey,
				});

			// API Key tools
			case 'create_api_key':
				return await makeApiRequest('/v1/api-keys/create', {
					method: 'POST',
					body: JSON.stringify(coercedArgs),
					apiKey,
				});

			case 'list_api_keys':
				return await makeApiRequest('/v1/api-keys/list', {
					method: 'GET',
					apiKey,
				});

			case 'delete_api_key':
				const { id } = coercedArgs;
				return await makeApiRequest(`/v1/api-keys/${id}`, {
					method: 'DELETE',
					apiKey,
				});

			// Web scraping tools
			case 'screenshot':
				return await makeApiRequestWithBinarySupport('/v1/web/screenshot', {
					method: 'POST',
					body: JSON.stringify(coercedArgs),
					apiKey,
				});

			case 'extract_markdown':
				return await makeApiRequest('/v1/web/markdown', {
					method: 'POST',
					body: JSON.stringify(coercedArgs),
					apiKey,
				});

			case 'ai_extract':
				return await makeApiRequest('/v1/web/ai-extract', {
					method: 'POST',
					body: JSON.stringify(coercedArgs),
					apiKey,
				});

			case 'get_html_content':
				return await makeApiRequest('/v1/web/content', {
					method: 'POST',
					body: JSON.stringify(coercedArgs),
					apiKey,
				});

			case 'scrape_elements':
				return await makeApiRequest('/v1/web/scrape', {
					method: 'POST',
					body: JSON.stringify(coercedArgs),
					apiKey,
				});

			case 'extract_links':
				return await makeApiRequest('/v1/web/links', {
					method: 'POST',
					body: JSON.stringify(coercedArgs),
					apiKey,
				});

			case 'web_search':
				return await makeApiRequest('/v1/web/search', {
					method: 'POST',
					body: JSON.stringify(coercedArgs),
					apiKey,
				});

			case 'generate_pdf':
				return await makeApiRequestWithBinarySupport('/v1/web/pdf', {
					method: 'POST',
					body: JSON.stringify(coercedArgs),
					apiKey,
				});

			// File management tools
			case 'list_files':
				const queryParams = new URLSearchParams();
				if (coercedArgs.type) queryParams.append('type', coercedArgs.type);
				if (coercedArgs.limit) queryParams.append('limit', coercedArgs.limit.toString());
				if (coercedArgs.offset) queryParams.append('offset', coercedArgs.offset.toString());

				return await makeApiRequest(`/v1/files/list?${queryParams}`, {
					method: 'GET',
					apiKey,
				});

			case 'delete_file':
				return await makeApiRequest('/v1/files/delete', {
					method: 'POST',
					body: JSON.stringify({ fileId: coercedArgs.id }),
					apiKey,
				});

			default:
				throw new Error(`Unknown tool: ${name}`);
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		throw new Error(`Tool execution failed: ${errorMessage}`);
	}
}

// MCP Protocol Implementation
function createMCPResponse(id: string | number | null, result?: any, error?: { code: number; message: string }) {
	const response: any = {
		jsonrpc: '2.0',
		id,
	};

	if (error) {
		response.error = error;
	} else {
		response.result = result;
	}

	return response;
}

function handleMCPRequest(request: any, apiKey: string) {
	const { method, params, id } = request;

	switch (method) {
		case 'initialize':
			return createMCPResponse(id, {
				protocolVersion: '2024-11-05',
				capabilities: {
					tools: {},
				},
				serverInfo: {
					name: 'weblinq-mcp',
					version: '1.0.0',
				},
			});

		case 'tools/list':
			return createMCPResponse(id, { tools });

		case 'tools/call':
			const { name, arguments: args } = params;

			// Check if API key is provided for tool execution
			if (!apiKey) {
				return createMCPResponse(id, undefined, {
					code: -32602,
					message: 'API key required for tool execution. Please provide WEBLINQ_API_KEY environment variable or pass api_key in arguments.',
				});
			}

			// Check if API key is passed in tool arguments (fallback)
			const effectiveApiKey = apiKey || (args && args.api_key);
			if (!effectiveApiKey) {
				return createMCPResponse(id, undefined, {
					code: -32602,
					message: 'API key required for tool execution. Please provide WEBLINQ_API_KEY environment variable or pass api_key in arguments.',
				});
			}

			return executeTool(name, args || {}, effectiveApiKey)
				.then((result: any) => {
					// Special handling for screenshot and PDF responses to provide structured MCP content
					if (name === 'screenshot' && result?.success && result.data?.image) {
						const format = result.data.metadata?.format || 'png';
						return createMCPResponse(id, {
							content: [
								{
									type: 'image',
									data: result.data.image,
									mimeType: `image/${format}`,
								},
								{
									type: 'text',
									text: `Screenshot captured successfully:\n- Format: ${format}\n- Size: ${
										result.data.metadata?.size || 'unknown'
									} bytes\n- Credits used: ${result.creditsCost || 1}${
										result.data.permanentUrl ? `\n- Permanent URL: ${result.data.permanentUrl}` : ''
									}`,
								},
							],
						});
					} else if (name === 'generate_pdf' && result?.success && result.data?.pdf) {
						return createMCPResponse(id, {
							content: [
								{
									type: 'text',
									text: `PDF generated successfully:\n- Size: ${result.data.metadata?.size || 'unknown'} bytes\n- Credits used: ${
										result.creditsCost || 1
									}${
										result.data.permanentUrl ? `\n- Permanent URL: ${result.data.permanentUrl}` : ''
									}\n\nBase64 PDF data: ${result.data.pdf.substring(0, 100)}...`,
								},
							],
						});
					} else {
						// Default JSON response for other tools
						return createMCPResponse(id, {
							content: [
								{
									type: 'text',
									text: JSON.stringify(result, null, 2),
								},
							],
						});
					}
				})
				.catch((error) =>
					createMCPResponse(id, undefined, {
						code: -1,
						message: error.message,
					})
				);

		default:
			return createMCPResponse(id, undefined, {
				code: -32601,
				message: `Method not found: ${method}`,
			});
	}
}

// Health check endpoint
app.get('/', (c) => {
	return c.json({
		status: 'ok',
		message: 'WebLinq MCP Server',
		version: '1.0.0',
		endpoints: {
			tools: '/tools',
			call: '/call',
			mcp_http: '/mcp',
			mcp_sse: '/sse',
		},
	});
});

/* ---------------------------------------------------------
   SSE for Cursor / mcp-remote
   --------------------------------------------------------- */

/* 1.  Server-→-client stream (GET /sse) */
app.get('/sse', (c) => {
	const enc = new TextEncoder();
	const toolNames = JSON.stringify(tools.map((t) => t.name));

	const { readable, writable } = new TransformStream();
	const writer = writable.getWriter();

	// Flush handshake immediately so CF watchdog is happy
	writer.write(enc.encode(`event: tools\n` + `data: ${toolNames}\n\n`)).catch((err) => console.error('handshake write', err));

	// Keep-alive comment every 25 s
	const ping = setInterval(() => {
		writer.write(enc.encode(': keep-alive\n\n')).catch((err) => console.error('ping', err));
	}, 25_000);

	// When CF kills the worker the interval disappears automatically
	return new Response(readable, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Headers': 'Authorization',
		},
	});
});

/* 2.  Client-→-server RPC (POST /sse)  – no auth required for initialize/tools.list */
app.post('/sse', async (c) => {
	try {
		// JSON-RPC envelope from Cursor / mcp-remote
		const req = await c.req.json();

		// Bearer header may be blank on the first call
		const apiKey = (c.req.header('authorization') ?? '').replace(/^Bearer\s*/i, '');

		const res = await handleMCPRequest(req, apiKey);
		return c.json(res); // always 200
	} catch (err) {
		console.error('POST /sse', err);
		return c.json({ error: 'Internal error' }, 500);
	}
});

// HTTP MCP endpoint
app.post('/mcp', requireApiKey, async (c) => {
	try {
		const request = await c.req.json();
		const apiKey = c.get('apiKey') as string;

		const response = await handleMCPRequest(request, apiKey);
		return c.json(response);
	} catch (error) {
		console.error('MCP HTTP error:', error);
		return c.json(
			createMCPResponse(null, undefined, {
				code: -32603,
				message: 'Internal error',
			}),
			500
		);
	}
});

// List available tools (backward compatibility)
app.get('/tools', requireApiKey, (c) => {
	return c.json({
		tools: tools.map((tool) => ({
			name: tool.name,
			description: tool.description,
			inputSchema: tool.inputSchema,
		})),
	});
});

// Execute a tool (backward compatibility)
app.post('/call', requireApiKey, async (c) => {
	try {
		const { tool, arguments: args } = await c.req.json();
		const apiKey = c.get('apiKey') as string;

		if (!tool) {
			return c.json({ error: 'Missing tool name' }, 400);
		}

		const toolDefinition = tools.find((t) => t.name === tool);
		if (!toolDefinition) {
			return c.json({ error: `Unknown tool: ${tool}` }, 400);
		}

		const result = await executeTool(tool, args || {}, apiKey);

		return c.json({
			tool,
			result,
			success: true,
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Tool execution error:', errorMessage);

		return c.json(
			{
				error: errorMessage,
				success: false,
			},
			500
		);
	}
});

// Error handling
app.notFound((c) => {
	return c.json({ error: 'Not found' }, 404);
});

app.onError((err, c) => {
	console.error('Server error:', err);
	return c.json({ error: 'Internal server error' }, 500);
});

export default app;
