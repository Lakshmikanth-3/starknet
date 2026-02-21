import type { Metadata } from "next";
import { Syne, Space_Mono } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "./context/WalletContext";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Toaster } from "@/components/ui/toaster";

const syne = Syne({ subsets: ["latin"], variable: '--font-display', weight: ['400', '600', '700', '800'] });
const spaceMono = Space_Mono({ subsets: ["latin"], variable: '--font-mono', weight: ['400', '700'] });

export const metadata: Metadata = {
  title: "PrivateBTC Vault | Starknet Bridge",
  description: "A privacy-preserving Bitcoin bridge on Starknet Sepolia.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${syne.variable} ${spaceMono.variable} antialiased min-h-screen flex flex-col`}>
        <div className="scanlines"></div>
        <WalletProvider>
          <Header />
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8 relative z-10">
            {children}
          </main>
          <Footer />
          <Toaster />
        </WalletProvider>
      </body>
    </html>
  );
}
