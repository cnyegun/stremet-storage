'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

type NavLinkProps = {
  href: string;
  label: string;
};

export function NavLink({ href, label }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));

  return (
    <Link
      href={href}
      className={cn(
        'inline-flex min-h-10 items-center border-b-2 px-4 text-xs font-medium uppercase tracking-wider',
        isActive
          ? 'border-app-primary bg-white/5 text-app-navActive'
          : 'border-transparent text-app-navText hover:bg-white/5 hover:text-app-navActive',
      )}
    >
      {label}
    </Link>
  );
}
