# Weblinq API Documentation

This is the official documentation site for the Weblinq API, built with [Mintlify](https://mintlify.com).

## Development

### Prerequisites

- Node.js (version 19 or higher)
- Mintlify CLI installed globally: `npm i -g mintlify`

### Local Development

To avoid port conflicts with the Next.js frontend (which runs on port 3000), the documentation server runs on **port 3001**.

#### Option 1: Using npm scripts

```bash
cd docs
npm run dev
```

#### Option 2: Direct CLI command

```bash
cd docs
mintlify dev --port 3001
```

The documentation site will be available at: **http://localhost:3001**

### Available Scripts

- `npm run dev` - Start development server on port 3001
- `npm run dev:open` - Start development server and open in browser
- `npm run dev:no-open` - Start development server without opening browser

## Project Ports

- **Frontend (Next.js)**: http://localhost:3000
- **Documentation (Mintlify)**: http://localhost:3001
- **Backend (Cloudflare Workers)**: Configured via Wrangler

## Documentation Structure

```
docs/
├── docs.json           # Mintlify configuration
├── index.mdx          # Homepage
├── quickstart.mdx     # Getting started guide
├── authentication.mdx # API authentication guide
├── development.mdx    # Development setup
├── api-reference/     # API endpoint documentation
├── images/           # Documentation images
└── logo/             # Brand assets
```

## Publishing

Documentation is automatically deployed via Mintlify's GitHub integration when changes are pushed to the main branch.

## Customization

- **Branding**: Update `docs.json` for colors, logo, and navigation
- **Content**: Edit `.mdx` files using Markdown with React components
- **API Reference**: Add OpenAPI specs in the `api-reference/` directory

## Troubleshooting

- **Port conflicts**: Use `--port 3001` flag to avoid conflicts with other services
- **CLI issues**: Run `mintlify install` to reinstall dependencies
- **404 errors**: Ensure you're running from the directory containing `docs.json`
- **Updates**: Run `npm i -g mintlify@latest` to update the CLI
