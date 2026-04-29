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
      <div className="flex min-h-screen items-center justify-center px-4 bg-background">
        <div className="text-center">
          <p className="mb-3 text-5xl">😕</p>
          <h2 className="text-xl font-bold text-foreground">Código no válido</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            El código <span className="font-mono font-bold text-indigo-500">{code}</span> no corresponde a ninguna colecta activa.
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-4 text-sm text-indigo-500 hover:underline"
          >
            ← Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-bounce"><ColectaLogo size={40} /></div>
        <p className="text-sm text-muted-foreground">Buscando colecta <span className="font-mono font-bold text-primary">{code}</span>...</p>
      </div>
    </div>
  );
}
