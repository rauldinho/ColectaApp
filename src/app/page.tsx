"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16">
      {/* Theme toggle — top right */}
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="mx-auto w-full max-w-lg text-center">

        {/* Eyebrow */}
        <div className="mb-8 inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Para grupos · Sin registro
        </div>

        {/* Headline */}
        <h1 className="mb-5 text-[40px] font-bold leading-[1.08] tracking-[-1px] text-foreground sm:text-5xl">
          Organiza tu colecta.<br />
          <span className="text-primary">Sin complicaciones.</span>
        </h1>

        {/* Subheadline */}
        <p className="mb-10 text-base leading-relaxed text-muted-foreground sm:text-lg">
          Un código. Todos pagan. Vos controlás.
          <br className="hidden sm:block" />
          Asados, viajes, regalos — así de simple.
        </p>

        {/* CTAs */}
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard/nuevo"
            className="inline-flex h-[50px] w-full items-center justify-center rounded-full bg-primary px-8 text-[15px] font-semibold leading-none text-white shadow-sm transition-all hover:bg-primary/90 active:scale-[0.97] sm:w-auto"
          >
            Crear una colecta
          </Link>
          <JoinByCodeButton />
        </div>

        {/* How it works */}
        <HowItWorks />
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
        className="inline-flex h-[50px] w-full items-center justify-center rounded-full border border-border bg-background px-8 text-[15px] font-semibold leading-none text-foreground transition-all hover:bg-secondary active:scale-[0.97] sm:w-auto"
      >
        Ingresar con código
      </button>
    );
  }

  return (
    <form onSubmit={handleJoin} className="flex items-center gap-2 w-full sm:w-auto">
      <input
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="Ej: ABX72K"
        maxLength={8}
        className="min-w-0 flex-1 h-[50px] rounded-full border border-border bg-secondary px-5 text-base font-bold uppercase tracking-widest text-foreground placeholder:text-muted-foreground placeholder:font-normal placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-ring sm:w-40 sm:flex-none"
      />
      <button
        type="submit"
        className="shrink-0 h-[50px] rounded-full bg-primary px-7 text-[15px] font-semibold leading-none text-white transition hover:bg-primary/90 active:scale-[0.97]"
      >
        Ir →
      </button>
    </form>
  );
}

/* ─── ¿Cómo funciona? ─── */

const steps = [
  {
    label: "Crea la colecta",
    detail: "Un nombre, la cuota o el monto total, y un PIN tuyo.",
    num: "01",
  },
  {
    label: "Comparte el código",
    detail: "Cada participante registra su pago y sube el comprobante.",
    num: "02",
  },
  {
    label: "Confirma los pagos",
    detail: "Revisás los comprobantes y llevás el control en tiempo real.",
    num: "03",
  },
];

function HowItWorks() {
  return (
    <div className="mt-20 w-full">
      <p className="mb-10 text-[11px] font-semibold uppercase tracking-[2px] text-muted-foreground">
        Cómo funciona
      </p>

      {/* Desktop: horizontal */}
      <div className="hidden sm:flex items-start justify-center gap-0">
        {steps.map((s, i) => (
          <div key={i} className="flex items-start">
            <div className="flex flex-col items-center gap-4 w-44 px-3">
              {/* Number */}
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
                <span className="text-sm font-bold text-primary">{s.num}</span>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground leading-snug">{s.label}</p>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{s.detail}</p>
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className="flex items-center mt-5 mx-1">
                <div className="w-10 h-px border-t border-dashed border-border" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Mobile: vertical */}
      <div className="flex sm:hidden flex-col gap-0 text-left">
        {steps.map((s, i) => (
          <div key={i} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <span className="text-xs font-bold text-primary">{s.num}</span>
              </div>
              {i < steps.length - 1 && (
                <div className="mt-1 w-px flex-1 border-l border-dashed border-border mb-1" />
              )}
            </div>
            <div className="pb-8 pt-1.5">
              <p className="text-sm font-semibold text-foreground">{s.label}</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{s.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
