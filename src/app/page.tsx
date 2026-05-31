"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { WOBBLY_RADIUS, WOBBLY_RADIUS_SM } from "@/lib/utils";

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-4 py-16 overflow-hidden">

      {/* Floating decorative circles — desktop only */}
      <div
        className="hidden md:block absolute top-16 left-10 h-16 w-16 border-2 border-dashed border-foreground/20 animate-float"
        style={{ borderRadius: "50% 40% 60% 30% / 40% 50% 30% 60%" }}
        aria-hidden
      />
      <div
        className="hidden md:block absolute bottom-24 right-12 h-10 w-10 bg-primary/15 border-2 border-foreground/20 animate-float"
        style={{ borderRadius: "60% 30% 50% 40% / 30% 60% 40% 50%", animationDelay: "1.5s" }}
        aria-hidden
      />
      <div
        className="hidden md:block absolute top-1/3 right-16 h-6 w-6 bg-accent/20 border border-foreground/20 animate-float"
        style={{ borderRadius: "40% 60% 30% 70% / 60% 40% 70% 30%", animationDelay: "0.8s" }}
        aria-hidden
      />

      <div className="mx-auto w-full max-w-lg text-center">

        {/* Eyebrow sticker */}
        <div
          className="mb-8 inline-flex items-center gap-1.5 border-2 border-foreground bg-white px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-foreground shadow-[3px_3px_0px_0px_#2d2d2d] rotate-[-1deg]"
          style={{ borderRadius: WOBBLY_RADIUS_SM }}
        >
          ✏️ Para grupos · Sin registro
        </div>

        {/* Headline — Kalam via h1 (globals.css auto-applies font) */}
        <h1 className="mb-5 text-[42px] leading-[1.1] tracking-tight text-foreground sm:text-5xl">
          Organiza tu colecta.{" "}
          <br />
          <span
            className="inline-block text-primary -rotate-1"
            style={{ textShadow: "3px 3px 0px rgba(255,77,77,0.2)" }}
          >
            Sin complicaciones
          </span>
          <span className="inline-block rotate-6 ml-1">!</span>
        </h1>

        {/* Subheadline */}
        <p className="mb-10 text-lg leading-relaxed text-muted-foreground sm:text-xl">
          Un código. Todos pagan. Vos controlás.
          <br className="hidden sm:block" />
          Asados, viajes, regalos — así de simple.
        </p>

        {/* CTAs */}
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          {/* Primary CTA — uses Button (already hand-drawn) */}
          <Button asChild size="lg" className="w-full sm:w-auto text-lg">
            <Link href="/dashboard/nuevo">
              Crear una colecta →
            </Link>
          </Button>

          {/* Hand-drawn arrow pointing at secondary CTA — desktop */}
          <div className="hidden md:block relative">
            <svg
              className="absolute -top-8 -left-10 text-foreground/40"
              width="40"
              height="32"
              viewBox="0 0 40 32"
              fill="none"
              aria-hidden
            >
              <path
                d="M4 4 C10 2, 20 1, 30 14 C34 20, 36 26, 34 28"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="4 3"
                fill="none"
              />
              <path d="M30 30 L34 28 L32 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <JoinByCodeButton />
        </div>

        {/* How it works */}
        <HowItWorks />
      </div>
    </main>
  );
}

/* ─── Join by code ─── */

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
      <Button
        variant="outline"
        size="lg"
        className="w-full sm:w-auto text-lg"
        onClick={() => setShow(true)}
      >
        Ingresar con código
      </Button>
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
        className="min-w-0 flex-1 h-12 border-[3px] border-foreground bg-white px-4 text-base font-bold uppercase tracking-widest text-foreground placeholder:text-foreground/30 placeholder:font-normal placeholder:tracking-normal focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 sm:w-40 sm:flex-none"
        style={{ borderRadius: WOBBLY_RADIUS_SM }}
      />
      <button
        type="submit"
        className="shrink-0 h-12 border-[3px] border-foreground bg-background px-5 text-base font-bold text-foreground shadow-[4px_4px_0px_0px_#2d2d2d] transition-all duration-100 hover:bg-primary hover:text-white hover:shadow-[2px_2px_0px_0px_#2d2d2d] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px]"
        style={{ borderRadius: WOBBLY_RADIUS }}
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
    emoji: "📋",
    rotate: "-rotate-1",
  },
  {
    label: "Comparte el código",
    detail: "Cada participante registra su pago y sube el comprobante.",
    num: "02",
    emoji: "📱",
    rotate: "rotate-1",
  },
  {
    label: "Confirmá los pagos",
    detail: "Revisás los comprobantes y llevás el control en tiempo real.",
    num: "03",
    emoji: "✅",
    rotate: "-rotate-1",
  },
];

function HowItWorks() {
  return (
    <div className="mt-20 w-full">
      {/* Section label — post-it style */}
      <div className="mb-10 flex items-center justify-center">
        <span
          className="inline-block bg-[#fff9c4] border-2 border-foreground px-4 py-1.5 text-xs font-bold uppercase tracking-[2px] text-foreground shadow-[3px_3px_0px_0px_#2d2d2d] rotate-[-0.5deg]"
          style={{ borderRadius: "4px 2px 4px 2px / 2px 4px 2px 4px" }}
        >
          ¿Cómo funciona?
        </span>
      </div>

      {/* Desktop: horizontal with squiggly connector */}
      <div className="hidden sm:flex items-start justify-center gap-0 relative">

        {/* Squiggly connecting path — purely decorative */}
        <svg
          className="absolute top-5 left-[17%] right-[17%] w-[66%] text-foreground/20 pointer-events-none"
          height="12"
          viewBox="0 0 200 12"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden
        >
          <path
            d="M0 6 Q10 2, 20 6 Q30 10, 40 6 Q50 2, 60 6 Q70 10, 80 6 Q90 2, 100 6 Q110 10, 120 6 Q130 2, 140 6 Q150 10, 160 6 Q170 2, 180 6 Q190 10, 200 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="0"
          />
        </svg>

        {steps.map((s, i) => (
          <div key={i} className="flex items-start">
            <div className={`flex flex-col items-center gap-3 w-44 px-3 ${s.rotate}`}>
              {/* Step number circle */}
              <div
                className="relative flex h-12 w-12 items-center justify-center border-2 border-foreground bg-white shadow-[3px_3px_0px_0px_#2d2d2d] z-10"
                style={{ borderRadius: "50% 40% 60% 30% / 40% 50% 30% 60%" }}
              >
                <span className="font-display text-sm font-bold text-foreground">{s.num}</span>
              </div>
              {/* Emoji */}
              <span className="text-2xl">{s.emoji}</span>
              <div className="text-center">
                <p className="font-display text-base font-bold text-foreground leading-snug">{s.label}</p>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{s.detail}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mobile: vertical */}
      <div className="flex sm:hidden flex-col gap-0 text-left">
        {steps.map((s, i) => (
          <div key={i} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-foreground bg-white shadow-[2px_2px_0px_0px_#2d2d2d]"
                style={{ borderRadius: "50% 40% 60% 30% / 40% 50% 30% 60%" }}
              >
                <span className="font-display text-xs font-bold text-foreground">{s.num}</span>
              </div>
              {i < steps.length - 1 && (
                <div className="mt-1 w-0.5 flex-1 border-l-2 border-dashed border-foreground/30 mb-1" />
              )}
            </div>
            <div className="pb-8 pt-1.5">
              <p className="font-display text-base font-bold text-foreground">{s.label}</p>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{s.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
