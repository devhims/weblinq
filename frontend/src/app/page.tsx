'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useSession } from '@/lib/auth-client';

export default function HomePage() {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
  const user = session?.user;

  return (
    <div className='min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100'>
      {/* Navigation */}
      <nav className='bg-white shadow-lg'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex justify-between items-center py-4'>
            <div className='flex items-center'>
              <h1 className='text-2xl font-bold text-gray-900'>WebLinq</h1>
            </div>
            <div className='flex items-center space-x-4'>
              {isAuthenticated ? (
                <>
                  <span className='text-gray-700'>
                    Welcome, {user?.name || user?.email}!
                  </span>
                  <Link href='/dashboard'>
                    <Button variant='primary'>Dashboard</Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link href='/login'>
                    <Button variant='ghost'>Sign In</Button>
                  </Link>
                  <Link href='/signup'>
                    <Button variant='primary'>Get Started</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20'>
        <div className='text-center'>
          <h1 className='text-4xl md:text-6xl font-bold text-gray-900 mb-6'>
            Welcome to{' '}
            <span className='text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600'>
              WebLinq
            </span>
          </h1>

          <p className='text-xl text-gray-600 mb-8 max-w-3xl mx-auto'>
            A modern authentication system built with Next.js frontend and
            Hono.js backend, deployed on Cloudflare Workers for maximum
            performance and scalability.
          </p>

          {!isAuthenticated ? (
            <div className='flex flex-col sm:flex-row gap-4 justify-center'>
              <Link href='/signup'>
                <Button size='lg' className='w-full sm:w-auto'>
                  Create Account
                </Button>
              </Link>
              <Link href='/login'>
                <Button
                  variant='outline'
                  size='lg'
                  className='w-full sm:w-auto'
                >
                  Sign In
                </Button>
              </Link>
            </div>
          ) : (
            <Link href='/dashboard'>
              <Button size='lg'>Go to Dashboard</Button>
            </Link>
          )}
        </div>

        {/* Features */}
        <div className='mt-20 grid grid-cols-1 md:grid-cols-3 gap-8'>
          <div className='bg-white rounded-lg shadow-lg p-6 text-center'>
            <div className='w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4'>
              <svg
                className='w-6 h-6 text-blue-600'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
                />
              </svg>
            </div>
            <h3 className='text-lg font-semibold mb-2'>
              Secure Authentication
            </h3>
            <p className='text-gray-600'>
              Built-in email/password and GitHub OAuth authentication with
              secure session management.
            </p>
          </div>

          <div className='bg-white rounded-lg shadow-lg p-6 text-center'>
            <div className='w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4'>
              <svg
                className='w-6 h-6 text-green-600'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M13 10V3L4 14h7v7l9-11h-7z'
                />
              </svg>
            </div>
            <h3 className='text-lg font-semibold mb-2'>Fast & Scalable</h3>
            <p className='text-gray-600'>
              Powered by Cloudflare Workers for global edge computing and
              lightning-fast response times.
            </p>
          </div>

          <div className='bg-white rounded-lg shadow-lg p-6 text-center'>
            <div className='w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4'>
              <svg
                className='w-6 h-6 text-purple-600'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
                />
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
                />
              </svg>
            </div>
            <h3 className='text-lg font-semibold mb-2'>Modern Stack</h3>
            <p className='text-gray-600'>
              Built with Next.js 15, TypeScript, Tailwind CSS, and Hono.js for a
              modern development experience.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
