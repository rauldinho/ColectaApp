"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4">
      <div className="mx-auto max-w-2xl text-center">
        {/* Logo / Brand */}
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="text-5xl">🪣</span>
          <h1 className="text-5xl font-bold tracking-tight text-foreground">
            Colecta
          </h1>
        </div>

        {/* Tagline */}
        <p className="mb-2 text-xl font-medium text-indigo-700">
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
            className="w-full rounded-xl bg-indigo-600 px-8 py-3 text-base font-semibold text-white shadow-md transition hover:bg-indigo-700 sm:w-auto"
          >
            Crear una colecta
          </Link>
          <JoinByCodeButton />
        </div>

        {/* Features */}
        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <FeatureCard
            icon="✂️"
            title="Divide fácil"
            description="Igual o personalizado entre todos los participantes"
          />
          <FeatureCard
            icon="📲"
            title="QR de pago"
            description="Genera un QR con los datos de transferencia al instante"
          />
          <FeatureCard
            icon="✅"
            title="Seguimiento"
            description="Lleva el registro de quién pagó y quién falta"
          />
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
        className="w-full rounded-xl border border-border bg-card px-8 py-3 text-base font-semibold text-gray-700 shadow-sm transition hover:bg-muted/50 sm:w-auto"
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
        className="w-36 rounded-xl border border-border px-4 py-3 font-mono text-lg font-bold uppercase tracking-widest text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
      <button
        type="submit"
        className="rounded-xl bg-indigo-600 px-5 py-3 text-base font-semibold text-white transition hover:bg-indigo-700"
      >
        Ir →
      </button>
    </form>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-2 text-3xl">{icon}</div>
      <h3 className="mb-1 font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
