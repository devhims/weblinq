'use client';

import { signOut } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/icons';

export default function SignOutButton() {
  const router = useRouter();
  const handleClick = async () => {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push('/sign-in'); // redirect to login page
        },
      },
    });
  };

  return (
    <div
      onClick={handleClick}
      className='flex items-center justify-between w-18 cursor-pointer'
    >
      <Icons.logOut />
      Log out
    </div>
  );
}
