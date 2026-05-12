import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/sidebar";
import { ToastProvider } from "@/components/toast-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ContentAI – Tạo bài viết Marketing bằng AI",
  description:
    "Công cụ tạo nội dung marketing tự động, hỗ trợ đa nền tảng Facebook, LinkedIn, Blog, TikTok, Instagram, Twitter.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex">
        <ToastProvider>
          <Sidebar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
