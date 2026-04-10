import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import type { Event } from "@/types/database";
import { LogoutButton } from "@/components/layout/logout-button";
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
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl">🪣</span>
            <span className="text-lg font-bold text-foreground">Colecta</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground/70 sm:block truncate max-w-[160px]">
              {user.email}
            </span>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-4xl px-4 py-5 pb-24">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-foreground">Mis Colectas</h1>
          <p className="text-sm text-muted-foreground/70 mt-0.5">
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
      <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-border bg-card/95 backdrop-blur px-4 py-3">
        <div className="mx-auto max-w-4xl">
          <Link href="/dashboard/nuevo">
            <Button className="w-full h-12 text-base font-semibold">+ Nueva colecta</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card px-8 py-16 text-center">
      <span className="mb-4 text-5xl">🪣</span>
      <h3 className="mb-1 text-lg font-bold text-foreground">Aún no tienes colectas</h3>
      <p className="text-sm text-muted-foreground">Crea tu primera colecta y compártela con tus participantes.</p>
    </div>
  );
}

function EventCard({ event }: { event: Event & { participants: { count: number }[] } }) {
  const participantCount = event.participants?.[0]?.count ?? 0;

  return (
    <Link href={`/evento/${event.slug}`}>
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden transition hover:shadow-md active:scale-[0.99]">
        {event.is_active && <div className="h-1 bg-indigo-500" />}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="font-bold text-foreground text-base leading-snug line-clamp-1">{event.name}</p>
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              event.is_active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
            }`}>
              {event.is_active ? "Activa" : "Cerrada"}
            </span>
          </div>
          {event.description && (
            <p className="text-sm text-muted-foreground/70 line-clamp-1 mb-2">{event.description}</p>
          )}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-3 text-sm text-muted-foreground/70">
              <span>👥 {participantCount} persona{participantCount !== 1 ? "s" : ""}</span>
              <span className="text-gray-200">·</span>
              <span className="font-mono text-xs">{event.code}</span>
            </div>
            {event.total_amount ? (
              <span className="text-base font-extrabold text-indigo-600 tracking-tight">
                {formatCurrency(event.total_amount, event.currency)}
              </span>
            ) : event.amount_per_person ? (
              <span className="text-sm font-semibold text-indigo-600">
                {formatCurrency(event.amount_per_person, event.currency)}
                <span className="text-xs font-normal text-muted-foreground/70"> c/u</span>
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  );
}
