"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ColectaLogo } from "@/components/ui/colecta-logo";

export default function UnirsePage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();
  const [status, setStatus] = useState<"loading" | "error">("loading");

  useEffect(() => {
    async function findEvent() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("events")
        .select("slug")
        .eq("code", code)
        .eq("is_active", true)
        .single();

      if (error || !data) {
        setStatus("error");
        return;
      }

      router.replace(`/evento/${data.slug}`);
    }

    findEvent();
  }, [code, router]);

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 bg-secondary">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mx-auto">
            <span className="text-2xl">😕</span>
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Código no válido</h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            El código{" "}
            <span className="font-mono font-bold text-foreground">{code}</span>{" "}
            no corresponde a ninguna colecta activa.
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-6 inline-flex h-10 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-white transition hover:bg-primary/90"
          >
            ← Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-bounce"><ColectaLogo size={44} /></div>
        <p className="text-sm text-muted-foreground">
          Buscando colecta{" "}
          <span className="font-mono font-bold text-foreground">{code}</span>...
        </p>
      </div>
    </div>
  );
}
