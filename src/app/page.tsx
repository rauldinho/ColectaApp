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

        {/* ¿Cómo funciona? — timeline */}
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


/* ─── ¿Cómo funciona? — Timeline infographic ─── */

const steps = [
  {
    label: "Crea la colecta",
    detail: "Pon un nombre, define la cuota o el monto total, y protégela con un PIN.",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10" aria-hidden>
        {/* Document */}
        <rect x="8" y="4" width="28" height="36" rx="4" className="fill-muted" />
        <rect x="8" y="4" width="28" height="36" rx="4" className="stroke-border" strokeWidth="2" fill="none" />
        <line x1="15" y1="16" x2="29" y2="16" className="stroke-muted-foreground" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="15" y1="22" x2="29" y2="22" className="stroke-muted-foreground" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="15" y1="28" x2="23" y2="28" className="stroke-muted-foreground" strokeWidth="2.5" strokeLinecap="round" />
        {/* Pencil */}
        <rect x="28" y="26" width="6" height="16" rx="2" transform="rotate(-45 28 26)" className="fill-foreground" />
        <polygon points="36,36 40,44 32,42" className="fill-foreground" />
        <line x1="30" y1="28" x2="38" y2="36" stroke="white" strokeWidth="1.5" className="stroke-background" />
      </svg>
    ),
  },
  {
    label: "Comparte el link",
    detail: "Envía el código o link a tus amigos. Cada uno registra su pago y sube su comprobante.",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10" aria-hidden>
        {/* Phone */}
        <rect x="14" y="4" width="20" height="34" rx="4" className="fill-muted stroke-border" strokeWidth="2" />
        <rect x="18" y="8" width="12" height="22" rx="2" className="fill-background" />
        {/* Share arrow */}
        <path d="M22 19 L30 19" className="stroke-foreground" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M27 16 L31 19 L27 22" className="stroke-foreground" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {/* Dot bottom */}
        <circle cx="24" cy="34" r="1.5" className="fill-muted-foreground" />
        {/* Persons around */}
        <circle cx="6" cy="16" r="4" className="fill-foreground" />
        <path d="M1 28 Q6 22 11 28" className="stroke-foreground fill-none" strokeWidth="2" strokeLinecap="round" />
        <circle cx="42" cy="16" r="4" className="fill-foreground" />
        <path d="M37 28 Q42 22 47 28" className="stroke-foreground fill-none" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Confirma los pagos",
    detail: "Revisa los comprobantes, aprueba cada pago y lleva el control en tiempo real.",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10" aria-hidden>
        {/* Shield / check */}
        <path d="M24 4 L38 10 L38 26 Q38 36 24 44 Q10 36 10 26 L10 10 Z" className="fill-muted stroke-border" strokeWidth="2" />
        {/* Checkmark */}
        <path d="M16 24 L21 30 L32 18" className="stroke-foreground" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    ),
  },
];

function HowItWorks() {
  return (
    <div className="mt-16 w-full">
      <p className="mb-8 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        ¿Cómo funciona?
      </p>

      {/* Desktop: horizontal timeline */}
      <div className="hidden sm:flex items-start justify-center gap-0">
        {steps.map((s, i) => (
          <div key={i} className="flex items-start">
            {/* Step */}
            <div className="flex flex-col items-center gap-3 w-44">
              {/* Icon circle */}
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
                {s.icon}
              </div>
              {/* Number badge */}
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background text-xs font-bold">
                {i + 1}
              </span>
              <div className="text-center px-2">
                <p className="text-sm font-semibold text-foreground leading-snug">{s.label}</p>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{s.detail}</p>
              </div>
            </div>

            {/* Connector arrow (not after last) */}
            {i < steps.length - 1 && (
              <div className="flex items-center mt-9 mx-1">
                <svg width="48" height="16" viewBox="0 0 48 16" fill="none" className="text-border">
                  <line x1="0" y1="8" x2="36" y2="8" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
                  <path d="M33 4 L41 8 L33 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Mobile: vertical timeline */}
      <div className="flex sm:hidden flex-col gap-0 text-left">
        {steps.map((s, i) => (
          <div key={i} className="flex gap-4">
            {/* Left column: number + line */}
            <div className="flex flex-col items-center">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-background text-xs font-bold">
                {i + 1}
              </span>
              {i < steps.length - 1 && (
                <div className="mt-1 w-px flex-1 border-l border-dashed border-border mb-1" />
              )}
            </div>
            {/* Content */}
            <div className="pb-7">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-card shadow-sm">
                {s.icon}
              </div>
              <p className="text-sm font-semibold text-foreground">{s.label}</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{s.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
