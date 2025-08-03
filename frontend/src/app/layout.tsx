import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import React from "react";
import FloatingChatbot from "@/components/FloatingChatbot";

const roboto = Roboto({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "eCFR Analysis Tool",
  description: "Search, analyze, and understand federal regulations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={roboto.className} suppressHydrationWarning>
        <Header />
        <div className="pb-[50px]">
          {children}
        </div>
        <FloatingChatbot />
        <Footer />
      </body>
    </html>
  );
}
