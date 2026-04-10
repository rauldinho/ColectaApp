import { Suspense } from "react";
import { ColectaLogo } from "@/components/ui/colecta-logo";

export default function EventoLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-3 animate-bounce"><ColectaLogo size={40} /></div>
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    </div>
  }>{children}</Suspense>;
}
