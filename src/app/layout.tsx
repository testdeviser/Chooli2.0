import type { Metadata, Viewport } from 'next';
import { Inter, Montserrat } from 'next/font/google';
import 'lenis/dist/lenis.css';
import './globals.css';

const montserrat = Montserrat({ subsets: ['latin'], weight: ['500', '600', '700', '800'], variable: '--font-montserrat', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'Chooli Digital Marketing | 3D introduction prototype',
  description:
    'Chooli Digital Marketing helps businesses grow through SEO, Local SEO, paid advertising, web development and e-commerce management.',
};

export const viewport: Viewport = { themeColor: '#041A35' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${montserrat.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
