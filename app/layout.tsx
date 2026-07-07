import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CapacitorInit } from "@/components/capacitor-init";

export const metadata: Metadata = {
  title: "DECIDE — Fotoğrafla Ürün Bul",
  description: "Beğendiğin ürünün fotoğrafını yükle, Türk mağazalarından en iyi 3 alternatifi anında bul.",
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
  themeColor: "#F5F0E6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className="h-full">
      <body className="min-h-full flex flex-col safe-area-padding">
        <CapacitorInit />
        {children}
      </body>
    </html>
  );
}
