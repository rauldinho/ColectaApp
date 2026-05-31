import type { Metadata } from "next";
import { Kalam, Patrick_Hand } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

/* Body font: Patrick Hand — legible but distinctly handwritten */
const patrickHand = Patrick_Hand({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-patrick-hand",
  display: "swap",
});

/* Display / Heading font: Kalam — thick felt-tip marker feel */
const kalam = Kalam({
  subsets: ["latin"],
  weight: "700",
  variable: "--font-kalam",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Colecta — Organiza pagos grupales",
  description:
    "Divide gastos, comparte el enlace y cobra de forma simple entre amigos, familia o compañeros.",
  keywords: ["pagos grupales", "dividir gastos", "cobros", "QR", "transferencias"],
  icons: {
    icon: "/icon.svg",
  },
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
      <body className={`${patrickHand.variable} ${kalam.variable} ${patrickHand.className}`}>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
