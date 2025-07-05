'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function SuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  const checkoutId = searchParams.get('checkout_id');
  const provider = searchParams.get('provider') || 'polar';

  useEffect(() => {
    // Simulate processing time to show success state
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gray-50'>
        <div className='text-center'>
          <Loader2 className='h-12 w-12 animate-spin text-orange-500 mx-auto mb-4' />
          <h2 className='text-xl font-semibold text-gray-900 mb-2'>
            Processing your subscription...
          </h2>
          <p className='text-gray-600'>
            Please wait while we confirm your payment
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50'>
      <div className='max-w-md w-full mx-auto text-center'>
        <div className='bg-white rounded-lg shadow-lg p-8'>
          <CheckCircle className='h-16 w-16 text-green-500 mx-auto mb-6' />

          <h1 className='text-2xl font-bold text-gray-900 mb-4'>
            Welcome to Pro! 🎉
          </h1>

          <p className='text-gray-600 mb-6'>
            Your subscription has been activated successfully. You now have
            access to all Pro features.
          </p>

          {checkoutId && (
            <div className='bg-gray-50 rounded-lg p-4 mb-6'>
              <p className='text-sm text-gray-500 mb-1'>Checkout ID</p>
              <p className='text-sm font-mono text-gray-800 break-all'>
                {checkoutId}
              </p>
            </div>
          )}

          <div className='space-y-3'>
            <Link
              href='/dashboard'
              className='w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center'
            >
              Go to Dashboard
              <ArrowRight className='ml-2 h-4 w-4' />
            </Link>

            <Link
              href='/pricing'
              className='w-full text-orange-500 hover:text-orange-600 font-medium py-2 px-4 rounded-lg transition-colors'
            >
              View Plans
            </Link>
          </div>

          <div className='mt-8 pt-6 border-t border-gray-200'>
            <p className='text-xs text-gray-500'>
              Powered by {provider === 'polar' ? 'Polar' : 'Stripe'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
