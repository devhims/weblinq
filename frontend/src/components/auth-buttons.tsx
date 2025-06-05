'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LogIn, LayoutDashboard } from 'lucide-react';
import { useSession } from '@/lib/auth-client';

export function AuthButtons() {
  const { data: session } = useSession();
  const user = session?.user;

  if (user) {
    return (
      <div className='flex items-center space-x-4'>
        <Link href='/dashboard'>
          <Button size='sm' className='flex items-center space-x-2'>
            <LayoutDashboard className='h-4 w-4' />
            <span>Dashboard</span>
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className='flex items-center space-x-3'>
      <Link href='/sign-in'>
        <Button size='sm' className='flex items-center space-x-1'>
          <LogIn className='h-4 w-4' />
          <span>Sign In</span>
        </Button>
      </Link>
    </div>
  );
}
