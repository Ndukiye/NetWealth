'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { NAV_LINKS } from '@/lib/nav-links';

export function BottomNav() {
  const { user } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur-md dark:border-white/5 dark:bg-slate-950/95 md:hidden">
      <div className="flex items-stretch justify-between px-1 pb-[env(safe-area-inset-bottom)]">
        {NAV_LINKS.map((link) => {
          const Icon = link.icon;
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition ${
                active
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-500 dark:text-slate-500'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              {link.shortLabel}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
