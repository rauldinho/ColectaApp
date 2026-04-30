import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import type { Event } from "@/types/database";
import { LogoutButton } from "@/components/layout/logout-button";
import { ColectaLogo } from "@/components/ui/colecta-logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: events } = await supabase
    .from("events")
    .select("*, participants(count)")
    .eq("organizer_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-secondary">
      {/* Sticky header — frosted glass */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <ColectaLogo size={26} />
            <span className="text-base font-bold tracking-tight text-foreground">Colecta</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:block truncate max-w-[160px]">
              {user.email}
            </span>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-4xl px-4 py-6 pb-28">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Mis Colectas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {events?.length ?? 0} colecta{(events?.length ?? 0) !== 1 ? "s" : ""} creada{(events?.length ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>

        {!events || events.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {events.map((event) => (
              <EventCard key={event.id} event={event as Event & { participants: { count: number }[] }} />
            ))}
          </div>
        )}
      </main>

      {/* FAB sticky */}
      <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-border bg-background/90 backdrop-blur-xl px-4 py-3">
        <div className="mx-auto max-w-4xl">
          <Link href="/dashboard/nuevo">
            <Button className="w-full h-12 text-sm font-semibold">+ Nueva colecta</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-8 py-16 text-center">
      <div className="mb-5 opacity-20"><ColectaLogo size={52} /></div>
      <h3 className="mb-1.5 text-lg font-semibold tracking-tight text-foreground">Aún no tenés colectas</h3>
      <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
        Creá tu primera colecta y compartila con tus participantes.
      </p>
    </div>
  );
}

function EventCard({ event }: { event: Event & { participants: { count: number }[] } }) {
  const participantCount = event.participants?.[0]?.count ?? 0;

  return (
    <Link href={`/evento/${event.slug}`}>
      <div className="rounded-2xl border border-border bg-card overflow-hidden transition-all hover:shadow-md active:scale-[0.99]">
        {/* Active accent strip */}
        {event.is_active && <div className="h-0.5 bg-primary" />}

        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="font-semibold text-foreground text-base leading-snug tracking-tight line-clamp-1">
              {event.name}
            </p>
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              event.is_active
                ? "bg-success-bg text-success-text"
                : "bg-secondary text-muted-foreground"
            }`}>
              {event.is_active ? "Activa" : "Cerrada"}
            </span>
          </div>

          {event.description && (
            <p className="text-sm text-muted-foreground line-clamp-1 mb-2">{event.description}</p>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
              <span>{participantCount} persona{participantCount !== 1 ? "s" : ""}</span>
              <span className="text-border">·</span>
              <span className="font-mono tracking-wider">{event.code}</span>
            </div>
            {event.total_amount ? (
              <span className="text-base font-bold text-primary tracking-tight">
                {formatCurrency(event.total_amount, event.currency)}
              </span>
            ) : event.amount_per_person ? (
              <span className="text-sm font-semibold text-primary">
                {formatCurrency(event.amount_per_person, event.currency)}
                <span className="text-xs font-normal text-muted-foreground"> c/u</span>
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  );
}
