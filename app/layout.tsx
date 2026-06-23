import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DECIDE — Fotoğrafla Ürün Bul",
  description: "Beğendiğin ürünün fotoğrafını yükle, Türk mağazalarından en iyi 3 alternatifi anında bul.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
