import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { PublicNav } from "@/components/public-nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "League Portal Starter",
  description: "Sport-agnostic league platform starter on Next.js and Supabase",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full bg-slate-100 text-slate-900">
        <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-lg font-bold tracking-tight text-slate-900">
                League Portal
              </Link>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Sports League Platform
              </p>
            </div>
            <PublicNav />
          </div>
        </header>
        <div className="mx-auto flex w-full max-w-6xl flex-1 px-6 py-8">{children}</div>
      </body>
    </html>
  );
}
