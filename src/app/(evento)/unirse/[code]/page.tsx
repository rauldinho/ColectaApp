"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ColectaLogo } from "@/components/ui/colecta-logo";
import { WOBBLY_RADIUS_SM, WOBBLY_RADIUS_MD } from "@/lib/utils";

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
        <div
          className="w-full max-w-sm border-2 border-foreground bg-card p-8 text-center shadow-[4px_4px_0px_0px_#2d2d2d]"
          style={{ borderRadius: WOBBLY_RADIUS_MD }}
        >
          <div
            className="mb-5 flex h-16 w-16 items-center justify-center border-2 border-foreground bg-white mx-auto shadow-[3px_3px_0px_0px_#2d2d2d]"
            style={{ borderRadius: "50% 40% 60% 30% / 40% 50% 30% 60%" }}
          >
            <span className="text-2xl">😕</span>
          </div>
          <h2 className="font-display text-xl font-bold text-foreground">Código no válido</h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            El código{" "}
            <span className="font-mono font-bold text-foreground">{code}</span>{" "}
            no corresponde a ninguna colecta activa.
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-6 inline-flex h-11 items-center justify-center border-2 border-foreground bg-primary px-6 text-sm font-bold text-white shadow-[3px_3px_0px_0px_#2d2d2d] transition-all hover:shadow-[1px_1px_0px_0px_#2d2d2d] hover:translate-x-[2px] hover:translate-y-[2px]"
            style={{ borderRadius: WOBBLY_RADIUS_SM }}
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
