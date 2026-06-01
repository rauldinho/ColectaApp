import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { formatCurrency, WOBBLY_RADIUS_MD, WOBBLY_RADIUS_SM } from "@/lib/utils";
import type { Event } from "@/types/database";
import { LogoutButton } from "@/components/layout/logout-button";
import { ColectaLogo } from "@/components/ui/colecta-logo";

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
    <div className="min-h-screen">
      {/* Header — pencil-border style, no frosted glass */}
      <header className="sticky top-0 z-10 border-b-2 border-foreground bg-background px-4 py-3 shadow-[0px_3px_0px_0px_#2d2d2d]">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <ColectaLogo size={26} />
            <span className="font-display text-xl font-bold text-foreground">Colecta</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:block truncate max-w-[160px]">
              {user.email}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-4xl px-4 py-6 pb-28">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Mis Colectas</h1>
          <p className="text-base text-muted-foreground mt-0.5">
            {events?.length ?? 0} colecta{(events?.length ?? 0) !== 1 ? "s" : ""} creada{(events?.length ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>

        {!events || events.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {events.map((event, i) => (
              <EventCard
                key={event.id}
                event={event as Event & { participants: { count: number }[] }}
                rotate={i % 2 === 0 ? "rotate-[0.5deg]" : "-rotate-[0.5deg]"}
              />
            ))}
          </div>
        )}
      </main>

      {/* FAB sticky — pencil border */}
      <div className="fixed bottom-0 left-0 right-0 z-10 border-t-2 border-foreground bg-background px-4 py-3 shadow-[0px_-3px_0px_0px_#2d2d2d]">
        <div className="mx-auto max-w-4xl">
          <Link href="/dashboard/nuevo">
            <Button className="w-full h-12 text-base font-bold">
              ✏️ Nueva colecta
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center border-2 border-dashed border-foreground/40 bg-card px-8 py-16 text-center shadow-[4px_4px_0px_0px_rgba(45,45,45,0.08)]"
      style={{ borderRadius: "30px 8px 28px 6px / 6px 28px 8px 30px" }}
    >
      <div className="mb-5 opacity-25"><ColectaLogo size={52} /></div>
      <h3 className="mb-1.5 font-display text-2xl font-bold text-foreground">Aún no tienes colectas</h3>
      <p className="text-base text-muted-foreground leading-relaxed max-w-xs">
        Crea tu primera colecta y compártela con tus participantes.
      </p>
    </div>
  );
}

function EventCard({
  event,
  rotate,
}: {
  event: Event & { participants: { count: number }[] };
  rotate: string;
}) {
  const participantCount = event.participants?.[0]?.count ?? 0;

  return (
    <Link href={`/evento/${event.slug}`} className="block">
      <div
        className={`border-2 border-foreground bg-card overflow-hidden shadow-[4px_4px_0px_0px_#2d2d2d] transition-all duration-100 hover:shadow-[6px_6px_0px_0px_#2d2d2d] hover:-translate-y-[2px] active:shadow-[2px_2px_0px_0px_#2d2d2d] active:translate-y-[1px] ${rotate} hover:rotate-0`}
        style={{ borderRadius: WOBBLY_RADIUS_MD }}
      >
        {/* Active accent — red pencil line at top */}
        {event.is_active && (
          <div className="h-1 bg-primary" />
        )}

        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="font-display text-lg font-bold text-foreground leading-snug line-clamp-1">
              {event.name}
            </p>
            {/* Status badge */}
            <span
              className={`shrink-0 border-2 border-foreground px-2.5 py-0.5 text-xs font-bold shadow-[2px_2px_0px_0px_#2d2d2d] ${
                event.is_active
                  ? "bg-success-bg text-success-text"
                  : "bg-secondary text-muted-foreground"
              }`}
              style={{ borderRadius: WOBBLY_RADIUS_SM }}
            >
              {event.is_active ? "Activa" : "Cerrada"}
            </span>
          </div>

          {event.description && (
            <p className="text-sm text-muted-foreground line-clamp-1 mb-2">{event.description}</p>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t-2 border-dashed border-foreground/20">
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <span>{participantCount} persona{participantCount !== 1 ? "s" : ""}</span>
              <span className="text-foreground/30">·</span>
              <span className="font-mono text-xs font-bold tracking-widest bg-secondary border border-foreground/20 px-1.5 py-0.5 rounded">
                {event.code}
              </span>
            </div>
            {event.total_amount ? (
              <span className="font-display text-xl font-bold text-primary">
                {formatCurrency(event.total_amount, event.currency)}
              </span>
            ) : event.amount_per_person ? (
              <span className="font-display text-lg font-bold text-primary">
                {formatCurrency(event.amount_per_person, event.currency)}
                <span className="text-sm font-sans font-normal text-muted-foreground"> c/u</span>
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  );
}
