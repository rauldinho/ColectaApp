import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"] });

export const metadata: Metadata = {
  title: "Colecta — Organiza pagos grupales",
  description:
    "Divide gastos, comparte el enlace y cobra de forma simple entre amigos, familia o compañeros.",
  keywords: ["pagos grupales", "dividir gastos", "cobros", "QR", "transferencias"],
  openGraph: {
    title: "Colecta",
    description: "Organiza pagos grupales de forma simple y sin fricción.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={outfit.className}>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
