import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Recomp Coach — Body Composition AI',
  description:
    'An AI coach that moves gym beginners off the bathroom scale and onto body composition.',
  icons: {
    icon: '/favicon.ico',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#020617',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-50 min-h-screen antialiased flex flex-col selection:bg-emerald-500/30 selection:text-emerald-300">
        <main className="flex-1 flex flex-col w-full max-w-md mx-auto px-4 pb-12 pt-2">
          {children}
        </main>
      </body>
    </html>
  );
}
