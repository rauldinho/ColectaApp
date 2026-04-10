import { Suspense } from "react";

export default function EventoLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-3 text-4xl animate-bounce">🪣</div>
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    </div>
  }>{children}</Suspense>;
}
