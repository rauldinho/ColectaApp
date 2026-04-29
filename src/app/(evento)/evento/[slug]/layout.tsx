import { Suspense } from "react";
import { ColectaLogo } from "@/components/ui/colecta-logo";

export default function EventoLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-bounce"><ColectaLogo size={40} /></div>
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    </div>
  }>{children}</Suspense>;
}
