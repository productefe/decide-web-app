import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { CapacitorInit } from "@/components/capacitor-init";
import { PushInit } from "@/components/push-init";

export const metadata: Metadata = {
  title: "DECIDE · Fotoğrafla Ürün Bul",
  description: "Beğendiğin ürünün fotoğrafını yükle, Türk mağazalarından sana en uygun 3 alternatifi anında bul.",
  icons: {
    apple: "/app-icon.png",
    icon: "/app-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DECIDE",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#F7F2E8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={`h-full ${GeistSans.variable}`}>
      <body className={`min-h-full flex flex-col safe-area-padding ${GeistSans.className}`}>
        <CapacitorInit />
        <PushInit />
        {children}
      </body>
    </html>
  );
}
