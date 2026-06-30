import type { Metadata } from 'next';
import { Inter, DM_Serif_Display } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-dm-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Swell Mermaid',
  description: 'Distribuição inteligente em redes sociais.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/app"
      signUpFallbackRedirectUrl="/app"
      afterSignOutUrl="/"
    >
      <html lang="pt-BR" className={`${inter.variable} ${dmSerif.variable}`}>
        <body className="min-h-screen bg-app text-text-primary antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
