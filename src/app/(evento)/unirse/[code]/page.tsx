"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
      <div className="flex min-h-screen items-center justify-center px-4 bg-gray-50">
        <div className="text-center">
          <p className="mb-3 text-5xl">😕</p>
          <h2 className="text-xl font-bold text-gray-900">Código no válido</h2>
          <p className="mt-2 text-sm text-gray-500">
            El código <span className="font-mono font-bold text-indigo-700">{code}</span> no corresponde a ninguna colecta activa.
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-4 text-sm text-indigo-600 hover:underline"
          >
            ← Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mb-3 text-4xl animate-bounce">🪣</div>
        <p className="text-gray-600">Buscando colecta <span className="font-mono font-bold text-indigo-700">{code}</span>...</p>
      </div>
    </div>
  );
}
