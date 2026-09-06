import type { Metadata } from 'next';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'CivicPulse AI — Public Problem Intelligence Layer',
  description: 'Citizen Signals → Government Intelligence → Public Action. AI-powered public-problem intelligence layer for Digital Public Infrastructure.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-gray-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
