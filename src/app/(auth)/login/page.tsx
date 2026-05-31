"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ColectaLogo } from "@/components/ui/colecta-logo";
import { WOBBLY_RADIUS_MD, WOBBLY_RADIUS_SM } from "@/lib/utils";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?redirectTo=${redirectTo}`,
      },
    });

    setLoading(false);

    if (error) {
      toast.error("Error al enviar el link: " + error.message);
    } else {
      setSent(true);
    }
  }

  async function handleGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirectTo=${redirectTo}`,
      },
    });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex flex-col items-center gap-3">
            <ColectaLogo size={44} />
            <span className="font-display text-3xl font-bold text-foreground">Colecta</span>
          </Link>
          <p className="mt-2 text-base text-muted-foreground">Iniciá sesión para continuar</p>
        </div>

        {/* Card — hand-drawn style via wobbly border-radius + pencil border */}
        <div
          className="border-2 border-foreground bg-card p-7 shadow-[4px_4px_0px_0px_#2d2d2d]"
          style={{ borderRadius: WOBBLY_RADIUS_MD }}
        >
          {sent ? (
            /* Estado: email enviado */
            <div className="text-center py-2">
              <div
                className="mb-5 flex h-16 w-16 items-center justify-center border-2 border-foreground bg-primary/10 mx-auto shadow-[3px_3px_0px_0px_#2d2d2d]"
                style={{ borderRadius: "50% 40% 60% 30% / 40% 50% 30% 60%" }}
              >
                <span className="text-3xl">📬</span>
              </div>
              <h2 className="mb-2 font-display text-2xl font-bold text-foreground">
                ¡Revisá tu correo!
              </h2>
              <p className="text-base text-muted-foreground leading-relaxed">
                Enviamos un link mágico a{" "}
                <span className="font-bold text-foreground">{email}</span>.
                <br />
                Hacé clic en el link para ingresar.
              </p>
              <button
                onClick={() => setSent(false)}
                className="mt-5 text-base font-bold text-accent hover:underline underline-offset-4"
              >
                ¿No llegó? Reenviar
              </button>
            </div>
          ) : (
            <>
              {/* Magic Link Form */}
              <form onSubmit={handleMagicLink} className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    Correo electrónico
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@correo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Enviando..." : "Enviar link mágico ✉️"}
                </Button>
              </form>

              {/* Dashed divider */}
              <div className="my-5 flex items-center gap-3">
                <div className="h-0 flex-1 border-t-2 border-dashed border-foreground/20" />
                <span className="text-sm text-muted-foreground font-bold">o continuá con</span>
                <div className="h-0 flex-1 border-t-2 border-dashed border-foreground/20" />
              </div>

              {/* Google */}
              <Button
                variant="outline"
                className="w-full"
                onClick={handleGoogle}
                type="button"
              >
                <GoogleIcon />
                Google
              </Button>
            </>
          )}
        </div>

        <p className="mt-5 text-center text-base text-muted-foreground">
          ¿No tenés cuenta?{" "}
          <Link
            href="/signup"
            className="font-bold text-accent hover:underline underline-offset-4"
          >
            Registrate gratis
          </Link>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
