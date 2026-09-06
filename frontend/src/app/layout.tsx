import type { Metadata } from 'next';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'CivicPulse AI — Public Problem Intelligence Layer',
  description: 'Citizen Signals → Government Intelligence → Public Action. Digital Public Infrastructure for modern governance.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-canvas text-ink-primary antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
