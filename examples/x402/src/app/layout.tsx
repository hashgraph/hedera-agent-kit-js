import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hedera Agent Kit + x402 Payments Example',
  description:
    'x402 Micropayment integration with Hedera Agent Kit (Next.js, MCP server pattern, async agent callbacks)',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 antialiased font-sans">{children}</body>
    </html>
  );
}
