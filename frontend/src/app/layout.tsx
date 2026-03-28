import type { Metadata } from 'next';
import Link from 'next/link';
import { GlobalSearch } from '@/components/ui/GlobalSearch';
import { NavLink } from '@/components/ui/NavLink';
import { ToastProvider } from '@/components/ui/Toast';
import { WorkerSessionProvider, WorkerBadge } from '@/components/ui/WorkerSession';
import { SannaChat } from '@/components/ui/SannaChat';
import ThemeRegistry from '@/components/ThemeRegistry';
import './globals.css';

export const metadata: Metadata = {
  title: 'Stremet Storage',
  description: 'Warehouse storage management system for Stremet',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&family=Roboto+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body>
        <ThemeRegistry>
          <WorkerSessionProvider>
          <ToastProvider>
            <div style={{ minHeight: '100vh', backgroundColor: 'var(--mui-palette-background-default)' }}>
              <header style={{ background: '#263238', color: '#fff', borderBottom: '2px solid #1565C0' }}>
                <div className="page-shell" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, paddingBlock: 6 }}>
                  <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 2, background: '#1565C0', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
                      ST
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase' }}>Stremet Storage</div>
                      <div style={{ fontSize: 10, opacity: 0.5, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Warehouse management</div>
                    </div>
                  </Link>
                  <WorkerBadge />
                  <GlobalSearch />
                  <nav style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                    <NavLink href="/" label="Storage grid" />
                    <NavLink href="/items" label="Items" />
                    <NavLink href="/check-in" label="Check in" />
                    <NavLink href="/machines" label="Machines" />
                    <NavLink href="/scan" label="Scan" />
                    <NavLink href="/activity" label="Activity" />
                  </nav>
                </div>
              </header>
              <main className="page-shell" style={{ paddingBlock: 20 }}>
                {children}
              </main>
              <SannaChat />
            </div>
          </ToastProvider>
          </WorkerSessionProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
