import type { Metadata } from 'next';
import { NavLink } from '@/components/ui/NavLink';
import { ToastProvider } from '@/components/ui/Toast';
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
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <ToastProvider>
          <div className="min-h-screen bg-app-background">
            <header className="bg-app-headerBg">
              <div className="page-shell flex items-center justify-between gap-4 py-0">
                <div className="flex min-h-12 items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center bg-app-primary text-xs font-bold text-white">ST</div>
                  <span className="text-sm font-semibold tracking-wide text-app-headerText">Stremet Storage</span>
                </div>
                <div className="text-xs text-slate-400">Warehouse management system</div>
              </div>
            </header>
            <nav className="border-b border-app-border bg-app-navBg">
              <div className="page-shell flex items-center gap-0 overflow-x-auto py-0">
                <NavLink href="/" label="Warehouse map" />
                <NavLink href="/items" label="Items" />
                <NavLink href="/check-in" label="Check in" />
                <NavLink href="/activity" label="Activity log" />
              </div>
            </nav>
            <main className="page-shell">{children}</main>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
