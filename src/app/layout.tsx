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
        <Toaster
          position="top-center"
          gap={8}
          toastOptions={{
            classNames: {
              toast:
                "!border-2 !border-[#2d2d2d] !bg-white !shadow-[4px_4px_0px_0px_#2d2d2d] !text-[#2d2d2d] !font-sans",
              title: "!font-bold !text-[#2d2d2d]",
              description: "!text-sm",
              icon: "!text-[#2d2d2d]",
              error: "!border-[#ff4d4d] !bg-[#fff0f0]",
              success: "!border-[#2d2d2d]",
              warning: "!border-[#2d2d2d]",
            },
            style: {
              borderRadius: "30px 8px 28px 6px / 6px 28px 8px 30px",
            },
          }}
        />
      </body>
    </html>
  );
}
