'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Key, CreditCard, Activity, Menu, X, Settings2, Monitor } from 'lucide-react';
import { Logo } from '@/components/logo';
import { SidebarFooter } from './SidebarFooter';

interface DashboardLayoutClientProps {
  children: React.ReactNode;
}

export function DashboardLayoutClient({ children }: DashboardLayoutClientProps) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navItems = [
    { href: '/dashboard/studio', icon: Monitor, label: 'Studio' },
    { href: '/dashboard/activity', icon: Activity, label: 'Activity' },
    { href: '/dashboard/api-keys', icon: Key, label: 'API Keys' },
    { href: '/dashboard/billing', icon: CreditCard, label: 'Billing' },
    { href: '/dashboard/settings', icon: Settings2, label: 'Settings' },
  ];

  return (
    <div className="flex flex-col min-h-[calc(100vh-68px)] w-full">
      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-between bg-background border-b border-border p-4">
        <div className="flex items-center">
          <Button className="mr-3 -ml-2" variant="ghost" size="sm" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            <Menu className="h-6 w-6" />
            <span className="sr-only">Toggle sidebar</span>
          </Button>
        </div>
      </div>

      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <div className="flex flex-1 h-full min-h-[calc(100vh-68px)] lg:min-h-0">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-52 bg-sidebar flex-shrink-0 border-r z-40">
          <nav className="flex-1 overflow-y-auto p-3 flex flex-col">
            {/* Logo at the top of sidebar */}
            <Link
              href="/"
              className="flex items-center mb-6 px-3 py-3 hover:bg-sidebar-accent/30 rounded-lg transition-colors duration-200"
            >
              <Logo />
            </Link>

            {navItems.map((item) => (
              <Link key={item.href} href={item.href} passHref>
                <Button
                  variant={pathname === item.href ? 'secondary' : 'ghost'}
                  className={`shadow-none my-1 w-full justify-start text-md transition-all duration-200 ease-in-out hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground hover:shadow-sm hover:scale-[1.02] active:scale-[0.98] ${
                    pathname === item.href
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm border border-sidebar-border/30'
                      : 'text-sidebar-foreground'
                  }`}
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <item.icon className="h-5 w-5 mr-2" />
                  {item.label}
                </Button>
              </Link>
            ))}
          </nav>

          {/* Sticky Footer */}
          <div className="p-3 border-sidebar-border">
            <SidebarFooter />
          </div>
        </aside>

        {/* Mobile Sidebar */}
        <aside
          className={`lg:hidden fixed left-0 top-0 h-screen w-64 bg-sidebar flex-shrink-0 border-r z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <nav className="flex-1 overflow-y-auto p-3 flex flex-col">
            {/* Mobile header with close button */}
            <Button variant="ghost" size="sm" onClick={() => setIsSidebarOpen(false)} className="h-8 w-8 p-0 self-end">
              <X className="h-4 w-4" />
              <span className="sr-only">Close sidebar</span>
            </Button>
            <div className="flex items-center justify-between mb-4 px-3 pb-3">
              <Logo />
            </div>

            {navItems.map((item) => (
              <Link key={item.href} href={item.href} passHref>
                <Button
                  variant={pathname === item.href ? 'secondary' : 'ghost'}
                  className={`shadow-none my-1 w-full justify-start text-lg transition-all duration-200 ease-in-out hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground hover:shadow-sm hover:scale-[1.02] active:scale-[0.98] ${
                    pathname === item.href
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm border border-sidebar-border/30'
                      : 'text-sidebar-foreground'
                  }`}
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <item.icon className="h-5 w-5 mr-2" />
                  {item.label}
                </Button>
              </Link>
            ))}
          </nav>

          {/* Sticky Footer */}
          <div className="p-3 border-sidebar-border">
            <SidebarFooter />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-0 lg:p-6 lg:ml-52 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
