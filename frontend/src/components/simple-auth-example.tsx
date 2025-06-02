// Simple auth example without complex auth guard
import { useSession, signIn, signOut } from '@/lib/auth-client';

export default function SimpleAuthExample() {
  const { data: session, isPending } = useSession();

  // Show loading state
  if (isPending) {
    return <div>Loading...</div>;
  }

  // User is authenticated
  if (session?.user) {
    return (
      <div>
        <h1>Welcome, {session.user.name || session.user.email}!</h1>
        <button onClick={() => signOut()}>Sign Out</button>
        {/* Your authenticated content here */}
      </div>
    );
  }

  // User is not authenticated
  return (
    <div>
      <h1>Please sign in</h1>
      <button
        onClick={() =>
          signIn.email({ email: 'test@example.com', password: 'password' })
        }
      >
        Sign In with Email
      </button>
      <button onClick={() => signIn.social({ provider: 'github' })}>
        Sign In with GitHub
      </button>
    </div>
  );
}
