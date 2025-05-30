# WebLinq Frontend

A modern authentication system built with Next.js 15, TypeScript, and Tailwind CSS, designed to work with a Hono.js backend deployed on Cloudflare Workers.

## Features

- 🔐 **Secure Authentication**: Email/password and GitHub OAuth
- 🎨 **Modern UI**: Beautiful, responsive design with Tailwind CSS
- ⚡ **Fast & Scalable**: Optimized for performance
- 🛡️ **Type Safety**: Full TypeScript support
- 📱 **Mobile First**: Responsive design for all devices

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: Custom auth system with session management
- **Backend Integration**: RESTful API calls to Hono.js backend

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- A running Hono.js backend (see backend setup)

### Installation

1. **Clone the repository** (if not already done):

   ```bash
   git clone <your-repo-url>
   cd frontend
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Configure environment variables**:

   Create a `.env.local` file in the frontend directory:

   ```bash
   # Backend API URL
   NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
   ```

   For production, replace with your Cloudflare Workers URL:

   ```bash
   NEXT_PUBLIC_BACKEND_URL=https://your-worker.your-subdomain.workers.dev
   ```

4. **Start the development server**:

   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:3000`

## Project Structure

```
src/
├── app/                    # Next.js app directory
│   ├── login/             # Login page
│   ├── signup/            # Sign up page
│   ├── dashboard/         # Protected dashboard page
│   ├── layout.tsx         # Root layout with AuthProvider
│   └── page.tsx           # Landing page
├── components/            # Reusable UI components
│   ├── ui/               # Basic UI components (Button, Input)
│   └── auth/             # Authentication components
├── context/              # React context providers
│   └── AuthContext.tsx   # Authentication state management
├── lib/                  # Utility libraries
│   └── auth.ts           # API client for authentication
└── config/               # Configuration files
    └── env.ts            # Environment variables config
```

## Available Routes

- `/` - Landing page
- `/login` - Sign in page
- `/signup` - Sign up page
- `/dashboard` - Protected dashboard (requires authentication)

## Authentication Flow

### Email/Password Authentication

1. User fills out login/signup form
2. Frontend sends credentials to backend API
3. Backend validates and creates session
4. Frontend stores authentication state
5. User is redirected to dashboard

### GitHub OAuth

1. User clicks "Sign in with GitHub"
2. Redirected to GitHub OAuth
3. GitHub redirects back to backend callback
4. Backend processes OAuth and creates session
5. User is redirected to frontend dashboard

## API Integration

The frontend communicates with your Hono.js backend through these endpoints:

- `POST /email/signin` - Email/password sign in
- `POST /email/signup` - Email/password sign up
- `POST /signout` - Sign out user
- `GET /session` - Get current session
- `GET /github/signin` - Initiate GitHub OAuth
- `GET /github/callback` - Handle GitHub OAuth callback

## Component Usage

### Using the Auth Context

```tsx
import { useAuth } from '@/context/AuthContext';

function MyComponent() {
  const { user, isAuthenticated, isLoading, signOut } = useAuth();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {isAuthenticated ? (
        <div>
          Welcome, {user?.email}!<button onClick={signOut}>Sign Out</button>
        </div>
      ) : (
        <div>Please sign in</div>
      )}
    </div>
  );
}
```

### Protected Routes

```tsx
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

function MyProtectedPage() {
  return (
    <ProtectedRoute>
      <div>This content is only visible to authenticated users</div>
    </ProtectedRoute>
  );
}
```

### Using UI Components

```tsx
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

function MyForm() {
  return (
    <form>
      <Input
        label='Email'
        type='email'
        placeholder='Enter your email'
        required
      />
      <Button type='submit' isLoading={false}>
        Submit
      </Button>
    </form>
  );
}
```

## Configuration

### Backend URL

Update the backend URL in `src/config/env.ts` or set the `NEXT_PUBLIC_BACKEND_URL` environment variable.

### Styling

The project uses Tailwind CSS. You can customize the design by:

- Modifying the Tailwind config in `tailwind.config.js`
- Updating component styles in `src/components/`
- Customizing global styles in `src/app/globals.css`

## Building for Production

1. **Build the application**:

   ```bash
   npm run build
   ```

2. **Start the production server**:
   ```bash
   npm start
   ```

## Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Set the `NEXT_PUBLIC_BACKEND_URL` environment variable
3. Deploy automatically with git pushes

### Other Platforms

The app can be deployed to any platform that supports Node.js:

- Netlify
- Railway
- Render
- AWS Amplify

Make sure to set the `NEXT_PUBLIC_BACKEND_URL` environment variable in your deployment platform.

## Troubleshooting

### CORS Issues

If you encounter CORS errors, make sure your backend is configured to allow requests from your frontend domain.

### Session Not Persisting

Ensure your backend is configured to set cookies properly and your frontend is sending credentials with requests (`credentials: 'include'`).

### Environment Variables Not Working

- Make sure environment variables start with `NEXT_PUBLIC_` for client-side access
- Restart the development server after changing environment variables
- Check that `.env.local` is in the correct directory (frontend root)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.
