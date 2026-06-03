import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "配車システム モック",
  description: "貨物・トラック運送業向け配車システムのモック",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-white px-4">
              <SidebarTrigger />
              <Separator orientation="vertical" className="mx-1 h-6" />
              <span className="text-sm font-medium text-slate-700">
                配車システム モック
              </span>
              <span className="ml-auto text-xs text-slate-400">
                顧客提案用・社外秘
              </span>
            </header>
            <main className="flex-1 p-6 bg-slate-50">{children}</main>
          </SidebarInset>
        </SidebarProvider>
      </body>
    </html>
  );
}
