import type { Metadata } from "next";
import { Sora } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const sora = Sora({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700", "800"] });

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
      {/* Script anti-flash: aplica el tema ANTES del primer render */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('colecta-theme');if(t==='dark'){document.documentElement.classList.add('dark')}}catch(e){}})();`,
          }}
        />
      </head>
      <body className={sora.className}>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
