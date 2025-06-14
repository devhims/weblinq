'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Users,
  Settings,
  Shield,
  Activity,
  Menu,
  Code,
  CircleIcon,
} from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navItems = [
    { href: '/dashboard', icon: Users, label: 'Team' },
    { href: '/dashboard/general', icon: Settings, label: 'General' },
    { href: '/dashboard/activity', icon: Activity, label: 'Activity' },
    { href: '/dashboard/security', icon: Shield, label: 'Security' },
    { href: '/dashboard/studio', icon: Code, label: 'Studio' },
  ];

  return (
    <div className='flex flex-col min-h-[calc(100vh-68px)] w-full'>
      {/* Mobile header */}
      <div className='lg:hidden flex items-center justify-between bg-background border-b border-border p-4'>
        <div className='flex items-center'>
          <span className='font-medium text-xl'>Settings</span>
        </div>
        <Button
          className='-mr-3'
          variant='ghost'
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          <Menu className='h-6 w-6' />
          <span className='sr-only'>Toggle sidebar</span>
        </Button>
      </div>

      <div className='flex flex-1 h-full min-h-[calc(100vh-68px)] lg:min-h-0'>
        {/* Sidebar */}
        <aside
          className='hidden lg:flex flex-col fixed left-0 top-0 h-screen w-52 bg-sidebar flex-shrink-0 border-r border-sidebar-border z-40'
          style={{ boxShadow: '0px 0 0 1px var(--color-sidebar-border)' }}
        >
          <nav className='h-full overflow-y-auto p-3 flex flex-col'>
            {/* Logo at the top of sidebar */}
            <Link href='/' className='flex items-center mb-6 px-2 py-3'>
              <CircleIcon className='h-6 w-6 text-primary' />
              <span className='ml-2 text-xl font-semibold text-sidebar-foreground'>
                HIMA
              </span>
            </Link>

            {navItems.map((item) => (
              <Link key={item.href} href={item.href} passHref>
                <Button
                  variant={pathname === item.href ? 'secondary' : 'ghost'}
                  className={`shadow-none my-2 w-full justify-start text-lg ${
                    pathname === item.href
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                  }`}
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <item.icon className='h-6 w-6 mr-3' />
                  {item.label}
                </Button>
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className='flex-1 p-0 lg:p-6 lg:ml-52 overflow-auto'>
          {children}
        </main>
      </div>
    </div>
  );
}
