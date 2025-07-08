import { Suspense } from 'react';
import CallbackClient from './CallbackClient';

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<p className="text-center">Loading…</p>}>
      <CallbackClient />
    </Suspense>
  );
}
