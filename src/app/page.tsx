"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ColectaLogo } from "@/components/ui/colecta-logo";

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16">
      {/* Toggle arriba a la derecha */}
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="mx-auto max-w-2xl text-center">
        {/* Logo / Brand */}
        <div className="mb-6 flex items-center justify-center gap-3">
          <ColectaLogo size={52} />
          <h1 className="text-5xl font-bold tracking-tight text-foreground">
            Colecta
          </h1>
        </div>

        {/* Tagline */}
        <p className="mb-2 text-xl font-medium text-primary">
          Organiza pagos grupales sin complicaciones
        </p>
        <p className="mb-10 text-base text-muted-foreground">
          Divide gastos, comparte el link y cobra en segundos. Perfecto para
          asados, viajes y eventos con amigos.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard/nuevo"
            className="block w-full rounded-xl bg-primary px-8 py-3 text-center text-base font-semibold text-primary-foreground shadow-md transition hover:bg-primary/90 sm:w-auto"
          >
            Crear una colecta
          </Link>
          <JoinByCodeButton />
        </div>

        {/* ¿Cómo funciona? — infograma */}
        <div className="mt-14">
          <p className="mb-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            ¿Cómo funciona?
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StepCard
              step={1}
              icon="✏️"
              title="El organizador crea"
              description="Define el nombre, la cuota o monto total, y un PIN para gestionar la colecta."
            />
            <StepCard
              step={2}
              icon="👥"
              title="Los participantes se unen"
              description="Entran con el código, ven su parte y adjuntan su comprobante de pago."
            />
            <StepCard
              step={3}
              icon="✅"
              title="El organizador confirma"
              description="Revisa los comprobantes y marca quién pagó. El resumen se actualiza en tiempo real."
            />
          </div>
        </div>

      </div>
    </main>
  );
}

function JoinByCodeButton() {
  const [code, setCode] = useState("");
  const [show, setShow] = useState(false);
  const router = useRouter();

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (code.trim()) router.push(`/unirse/${code.trim().toUpperCase()}`);
  }

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="w-full rounded-xl border border-border bg-card px-8 py-3 text-base font-semibold text-foreground shadow-sm transition hover:bg-muted/50 sm:w-auto"
      >
        Ingresar con código
      </button>
    );
  }

  return (
    <form onSubmit={handleJoin} className="flex gap-2 w-full sm:w-auto">
      <input
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="Ej: ABX72K"
        maxLength={8}
        className="min-w-0 flex-1 rounded-xl border border-border bg-card px-4 py-3 text-lg font-bold uppercase tracking-wider text-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:w-36 sm:flex-none"
      />
      <button
        type="submit"
        className="shrink-0 rounded-xl bg-primary px-5 py-3 text-base font-semibold text-primary-foreground transition hover:bg-primary/90"
      >
        Ir →
      </button>
    </form>
  );
}


function StepCard({
  step,
  icon,
  title,
  description,
}: {
  step: number;
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="relative flex flex-col items-center rounded-2xl border border-border bg-card p-5 shadow-sm text-center">
      {/* Número de paso */}
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
        {step}
      </div>
      <div className="mb-2 text-2xl">{icon}</div>
      <h3 className="mb-1.5 font-semibold text-foreground text-sm">{title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
