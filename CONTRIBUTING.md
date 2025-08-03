# Contributing to WebLinq

Thank you for your interest in contributing to WebLinq! We welcome contributions from the community and are excited to see what you'll build.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Cloudflare account with Workers, D1, Durable Objects and Browser Rendering API enabled
- Git

### Development Setup

1. **Fork and Clone**

   ```bash
   git clone https://github.com/devhims/weblinq.git
   cd weblinq
   ```

2. **Install Dependencies**

   ```bash
   # Backend
   cd backend && pnpm install

   # Frontend
   cd ../frontend && pnpm install

   # Documentation
   cd ../docs && npm install
   ```

3. **Environment Configuration**

   ```bash
   # Backend - copy and configure
   cp backend/.env.example backend/.env

   # Frontend - copy and configure
   cp frontend/.env.example frontend/.env.local
   ```

4. **Database Setup**

   ```bash
   cd backend
   npx drizzle-kit push  # Deploy schema to D1
   ```

5. **Start Development Servers**

   ```bash
   # Backend (http://localhost:8787)
   cd backend && pnpm dev

   # Frontend (http://localhost:3000)
   cd frontend && pnpm dev

   # Documentation (http://localhost:3001)
   cd docs && npm run dev
   ```

## 🛠️ Development Workflow

### Creating a Pull Request

1. **Create a Feature Branch**

   ```bash
   git checkout -b feature/amazing-feature
   ```

2. **Make Your Changes**

   - Write clear, concise commit messages
   - Include tests for new functionality
   - Update documentation as needed

3. **Code Quality Checks**

   ```bash
   # Type checking
   pnpm typecheck

   # Linting
   pnpm lint

   # Fix linting issues
   pnpm lint:fix

   # Run tests
   pnpm test
   ```

4. **Submit Pull Request**
   - Provide a clear description of changes
   - Reference any related issues
   - Include screenshots for UI changes

### Commit Message Format

We follow conventional commits for clear history:

```
type(scope): description

feat(api): add new screenshot endpoint
fix(auth): resolve session timeout issue
docs(readme): update installation guide
refactor(browser): optimize session reuse logic
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## 📋 Code Style

### TypeScript Standards

- **Strict mode enabled** - All code must pass TypeScript strict checks
- **Explicit types** - Prefer explicit typing over `any`
- **Interface over type** - Use interfaces for object shapes
- **Proper exports** - Use named exports unless default is more appropriate

### ESLint Configuration

We use [@antfu/eslint-config](https://github.com/antfu/eslint-config) which includes:

- **Automatic formatting** - No need for Prettier
- **Import sorting** - Automatic import organization
- **Consistent style** - Enforced code patterns

### Project-Specific Guidelines

#### Backend (Hono.js)

```typescript
// ✅ Good - Proper error handling
export const handler = async (c: Context) => {
  try {
    const result = await someOperation();
    return c.json({ success: true, data: result });
  } catch (error) {
    return c.json({ error: 'Operation failed' }, 500);
  }
};

// ✅ Good - Type-safe request validation
const schema = z.object({
  url: z.string().url(),
  waitTime: z.number().optional(),
});

export const handler = async (c: Context) => {
  const body = schema.parse(await c.req.json());
  // ...
};
```

#### Frontend (Next.js)

```typescript
// ✅ Good - Proper component structure
interface ComponentProps {
  title: string;
  isLoading?: boolean;
}

export function Component({ title, isLoading = false }: ComponentProps) {
  return (
    <div className="p-4">{isLoading ? <Spinner /> : <h1>{title}</h1>}</div>
  );
}
```

## 🧪 Testing

### Test Structure

- **Unit Tests** - `/src/__tests__/` for individual functions
- **Integration Tests** - `/tests/` for API endpoints
- **E2E Tests** - Playwright for critical user flows

### Writing Tests

```typescript
// Example API test
import { describe, it, expect } from 'vitest';

describe('POST /api/web/screenshot', () => {
  it('should capture screenshot successfully', async () => {
    const response = await fetch('/api/web/screenshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});
```

### Running Tests

```bash
# Backend tests
cd backend && pnpm test

# Frontend tests
cd frontend && pnpm test

# E2E tests
cd tests && pnpm test
```

## 🎯 Areas for Contribution

### 🔧 Backend API

- **New endpoints** - Additional web scraping capabilities
- **Performance optimization** - Browser session management improvements
- **Error handling** - Better error messages and recovery
- **Documentation** - OpenAPI spec enhancements

### 🎨 Frontend Dashboard

- **UI/UX improvements** - Better user experience
- **New features** - API usage analytics, team management
- **Mobile responsiveness** - Better mobile experience
- **Accessibility** - ARIA labels and keyboard navigation

### 📚 Documentation

- **API examples** - More integration examples
- **Tutorials** - Step-by-step guides
- **Use cases** - Real-world implementation examples
- **Video content** - Screencast tutorials

### 🧪 Testing & Quality

- **Test coverage** - Increase test coverage
- **Performance tests** - Load and stress testing
- **Security audits** - Vulnerability assessments
- **CI/CD improvements** - Better deployment pipeline

### 🔌 MCP Integration

- **New tools** - Additional MCP server capabilities
- **Client libraries** - SDKs for different languages
- **Examples** - Integration with popular AI assistants
- **Documentation** - Better MCP setup guides

## 🐛 Bug Reports

### Before Reporting

1. **Search existing issues** - Check if already reported
2. **Reproduce the bug** - Verify it's reproducible
3. **Gather information** - Error messages, logs, environment

### Bug Report Template

```markdown
**Describe the Bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:

1. Go to '...'
2. Click on '....'
3. See error

**Expected Behavior**
What you expected to happen.

**Environment**

- OS: [e.g. macOS, Windows, Linux]
- Node.js version: [e.g. 18.17.0]
- Browser: [e.g. Chrome, Firefox]
- WebLinq version: [e.g. 1.0.0]

**Additional Context**
Any other context about the problem.
```

## 💡 Feature Requests

### Feature Request Template

```markdown
**Is your feature request related to a problem?**
A clear description of what the problem is.

**Describe the solution you'd like**
A clear description of what you want to happen.

**Describe alternatives you've considered**
Alternative solutions or features you've considered.

**Additional context**
Any other context or screenshots about the feature request.
```

## 🏷️ Issue Labels

- `bug` - Something isn't working
- `enhancement` - New feature or request
- `documentation` - Improvements or additions to documentation
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention is needed
- `question` - Further information is requested

## 📞 Getting Help

- **GitHub Discussions** - General questions and community support
- **GitHub Issues** - Bug reports and feature requests
- **Discord** - Real-time community chat (coming soon)

## 📜 Code of Conduct

### Our Pledge

We are committed to making participation in our project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity and expression, level of experience, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

**Positive behavior includes:**

- Using welcoming and inclusive language
- Being respectful of differing viewpoints
- Gracefully accepting constructive criticism
- Focusing on what is best for the community

**Unacceptable behavior includes:**

- Trolling, insulting comments, and personal attacks
- Public or private harassment
- Publishing others' private information without permission
- Other conduct which could reasonably be considered inappropriate

### Enforcement

Project maintainers have the right to remove, edit, or reject comments, commits, code, issues, and other contributions that are not aligned with this Code of Conduct.

## 🎉 Recognition

Contributors will be recognized in:

- **README.md** - Major contributors listed
- **GitHub Contributors** - Automatic recognition
- **Release Notes** - Feature contributors mentioned

Thank you for contributing to WebLinq! 🚀
