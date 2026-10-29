import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./common.scss";
import { GlobalModal } from "@/components/GlobalModal";
import { Header } from "@/components/Header";
import { Suspense } from "react";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ulon",
  description: "Modern Authentication with Next.js, Auth.js & Prisma",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/golfstrimmar/ulon-design-tokens@main/colors.css"
        />
      </head>
      <Suspense
        fallback={
          <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur px-6 py-4 flex items-center justify-between">
            <span className="font-bold text-xl tracking-tight text-white">
              Ulon
            </span>
            <div className="h-8 w-28 bg-zinc-800/50 rounded-full animate-pulse" />
          </header>
        }
      >
        <Header />
      </Suspense>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <main className="flex-1 py-2 flex flex-col gap-3 w-full mx-auto">
          {children}
        </main>
        <GlobalModal />
      </body>
    </html>
  );
}
