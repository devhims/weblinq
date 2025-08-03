# WebLinq

> High-performance web scraping and browser automation platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange)](https://workers.cloudflare.com/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)
[![Hono](https://img.shields.io/badge/Hono-4.7-orange)](https://hono.dev/)

## 🚀 Overview

WebLinq is a modern web scraping and browser automation platform that revolutionizes performance through **intelligent browser session reuse**. Built on Cloudflare's edge infrastructure, it provides lightning-fast web operations while maintaining reliability and scalability.

**🎯 Perfect for:** Realtime web access in chat apps, Browser automation, Data aggregation, Competitor analysis, and Market research.

### Key Features

- **🔄 Browser Session Reuse**: Intelligent architecture that reduces operation latency from ~2-3s to ~200-500ms
- **⚡ High Performance**: Built on Cloudflare Workers for global edge deployment
- **🎯 Comprehensive API**: Search, Screenshot capture, Markdown / HTML extraction, PDF generation, AI data extraction
- **🔧 MCP Integration**: Model Context Protocol server for AI assistant integration
- **🛡️ Enterprise Ready**: Authentication, rate limiting, and secure API key management
- **📱 Modern Dashboard**: Full-featured web interface for API management

## 🌐 Live Demo

Try WebLinq instantly with our interactive API:

```bash
# Extract markdown from any webpage
curl -X POST "https://api.weblinq.dev/v1/web/markdown" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# Take a screenshot
curl -X POST "https://api.weblinq.dev/v1/web/screenshot" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

**🔗 [Get your free API key](https://weblinq.dev/dashboard/api-keys)** • **📖 [View live documentation](https://docs.weblinq.dev)**

## 🏗️ Directory Structure

```
weblinq/
├── backend/                    # Core API server (Cloudflare Worker)
│   ├── src/
│   │   ├── durable-objects/   # Browser session management
│   │   ├── routes/            # API endpoints
│   │   ├── lib/               # Core utilities and operations
│   │   └── middlewares/       # Authentication and CORS
│   └── scripts/               # Build and deployment scripts
├── frontend/                   # Next.js 15 dashboard application
│   ├── src/
│   │   ├── app/               # App router pages
│   │   ├── components/        # Reusable UI components
│   │   └── lib/               # Client utilities
├── weblinq-mcp/              # Model Context Protocol server
│   └── src/                   # MCP implementation
├── docs/                      # Mintlify documentation site
│   ├── api-reference/         # API documentation
│   └── guides/                # User guides and examples
└── tests/                     # Integration testing suite
```

## 🔄 Browser Session Reuse Innovation

WebLinq's core innovation lies in its **intelligent browser session reuse architecture** powered by Cloudflare Durable Objects:

### Architecture Overview

- **BrowserManagerDO**: Orchestrates up to 10 concurrent browser sessions
- **BrowserDO**: Manages individual Playwright/Puppeteer browser instances
- **Session Pooling**: Maintains warm sessions across requests
- **Blue-Green Refresh**: Zero-downtime session rotation every 8.5 minutes

### Performance Benefits

| Metric                    | Traditional                   | WebLinq                    |
| ------------------------- | ----------------------------- | -------------------------- |
| **Cold Start Latency**    | 2-3 seconds                   | 200-500ms                  |
| **Resource Efficiency**   | ❌ New browser per request    | ✅ Persistent sessions     |
| **Concurrent Operations** | Limited by startup time       | Up to 10 parallel sessions |
| **Cost Optimization**     | High browser startup overhead | Reduced slot usage         |

### How It Works

1. **Session Management**: Durable Objects maintain persistent browser sessions
2. **Intelligent Allocation**: Available sessions are reused; new ones created on-demand
3. **Proactive Refresh**: Sessions are refreshed before Cloudflare's 10-minute limit
4. **Fault Tolerance**: Automatic recovery from crashes and network issues

## 🛠️ Core Technologies

### Backend Stack

Built with modern, high-performance technologies:

- **[Hono.js](https://hono.dev/)** `^4.7.10` - Ultra-fast web framework
- **[Drizzle ORM](https://orm.drizzle.team/)** `^0.43.1` - Type-safe database operations
- **[Zod](https://zod.dev/)** `^3.25.28` - Runtime type validation
- **[Better Auth](https://better-auth.com/)** `^1.2.8` - Modern authentication
- **[@cloudflare/puppeteer](https://github.com/cloudflare/puppeteer)** - Browser automation

## 🔌 MCP Server Integration

The **`weblinq-mcp/`** directory contains a complete [Model Context Protocol](https://modelcontextprotocol.io/) server implementation, enabling seamless integration with AI assistants like Claude Desktop and other MCP-compatible clients.

### Features

- **🔗 Direct API Integration**: Connect AI assistants to WebLinq's full API
- **🔄 Real-time Operations**: Screenshot capture, data extraction, web search
- **🛡️ Secure Authentication**: API key-based access control
- **📊 Structured Responses**: Type-safe data exchange with AI models

### Usage

```bash
cd weblinq-mcp
npm install
npm run dev  # Development server
npm run deploy  # Deploy to Cloudflare Workers
```

The MCP server provides AI assistants with tools for web scraping, screenshot capture, and data extraction, making WebLinq's capabilities directly accessible within AI workflows.

## 🚀 Quick Start

### For Developers

```bash
# Clone and setup
git clone https://github.com/devhims/weblinq.git
cd weblinq

# Install dependencies
cd backend && pnpm install
cd ../frontend && pnpm install

# Setup environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# Start development
cd backend && pnpm dev    # Backend: http://localhost:8787
cd frontend && pnpm dev   # Frontend: http://localhost:3000
```

**Requirements:** Node.js 18+, Cloudflare account with Workers/D1/Durable Objects enabled

📖 **[Full setup guide in CONTRIBUTING.md](CONTRIBUTING.md)**

## 📚 Documentation

- **📖 [API Documentation](./docs/)** - Complete API reference and guides
- **🚀 [Quick Start Guide](./docs/getting-started/quickstart.mdx)** - Get started in 5 minutes
- **🔧 [Developer Guide](./docs/guides/examples.mdx)** - Integration examples
- **🔒 [Authentication](./docs/getting-started/authentication.mdx)** - API key setup
- **🛡️ [Security Policy](./SECURITY.md)** - Vulnerability reporting and best practices

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for detailed information on:

- 🛠️ Development setup and workflow
- 📋 Code style and standards
- 🧪 Testing requirements
- 🐛 Bug reporting process
- 💡 Feature request guidelines

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- **Cloudflare** - For Workers, Durable Objects, and Browser Rendering API
- **Hono.js** - For the clean, lightning-fast web framework
- **Better Auth** - The most complete authentication framework

---

<div align="center">

**[Documentation](./docs/) • [API Reference](./docs/api-reference/) • [Examples](./docs/guides/examples.mdx) • [Contributing](CONTRIBUTING.md)**

Made with ❤️ by the WebLinq team

</div>
