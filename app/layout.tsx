import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import NavBar from './NavBar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Dat',
  description: 'dat267\'s personal website',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <NavBar brandText="Dat" links={[{ label: "Blog", href: "/blog" }, { label: "About", href: "/about" }]} />
        {children}</body>
    </html>
  );
}
