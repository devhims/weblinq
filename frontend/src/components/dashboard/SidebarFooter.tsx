'use client';

import { useState } from 'react';
import { useSession, signOut } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { ChevronUp, User, CreditCard, LogOut } from 'lucide-react';
import Link from 'next/link';

export function SidebarFooter() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  if (!session?.user) {
    return null;
  }

  const user = session.user;
  const displayName = user.name || 'User';
  const userEmail = user.email || '';

  const dropdownItems = [
    {
      icon: User,
      label: 'Account',
      href: '/dashboard/settings',
    },
    {
      icon: CreditCard,
      label: 'Billing',
      href: '/dashboard/billing',
    },
  ];

  return (
    <div className="relative">
      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-20" onClick={() => setIsDropdownOpen(false)} />

          {/* Dropdown Content */}
          <div className="absolute bottom-full left-0 right-0 mb-2 bg-sidebar border border-sidebar-border/30 rounded-lg shadow-lg z-30">
            <div className="p-3">
              {/* User Info */}
              {/* <div className="px-3 py-2 border-b border-sidebar-border mb-2">
                <p className="font-medium text-sm text-sidebar-foreground">{displayName}</p>
                <p className="text-xs text-sidebar-foreground/70 truncate">{userEmail}</p>
              </div> */}

              {/* Menu Items */}
              <div className="space-y-1">
                {dropdownItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground rounded-md transition-all duration-200 ease-in-out hover:scale-[1.02] active:scale-[0.98]"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    <item.icon className="h-4 w-4 mr-3" />
                    {item.label}
                  </Link>
                ))}

                {/* Sign Out Button */}
                <button
                  onClick={handleSignOut}
                  className="flex items-center w-full px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground rounded-md transition-all duration-200 ease-in-out hover:scale-[1.02] active:scale-[0.98]"
                >
                  <LogOut className="h-4 w-4 mr-3" />
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Footer Button */}
      <Button
        variant="ghost"
        className={`shadow-none w-full justify-between px-3 py-2 h-auto transition-all duration-200 ease-in-out hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground hover:shadow-sm hover:scale-[1.02] active:scale-[0.98] ${
          isDropdownOpen
            ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm border border-sidebar-border/30'
            : 'text-sidebar-foreground'
        }`}
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
      >
        <div className="flex items-center min-w-0">
          <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center mr-2 flex-shrink-0">
            <User className="h-4 w-4 text-sidebar-accent-foreground" />
          </div>
          <div className="text-left min-w-0 flex-1">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{displayName}</p>
            <p className="text-xs text-sidebar-foreground/70 truncate">{userEmail}</p>
          </div>
        </div>
        <ChevronUp
          className={`h-4 w-4 text-sidebar-foreground/70 transition-transform duration-200 flex-shrink-0 ${
            isDropdownOpen ? 'rotate-180' : ''
          }`}
        />
      </Button>
    </div>
  );
}
