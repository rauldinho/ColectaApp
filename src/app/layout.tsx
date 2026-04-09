import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

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
      <body className={inter.className}>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
