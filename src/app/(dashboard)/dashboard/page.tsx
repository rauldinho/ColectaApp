import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { Event } from "@/types/database";
import { LogoutButton } from "@/components/layout/logout-button";

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white px-4 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🪣</span>
            <span className="text-xl font-bold text-gray-900">Colecta</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-gray-500 sm:block">
              {user.email}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mis Colectas</h1>
            <p className="text-sm text-gray-500">
              {events?.length ?? 0} colecta{events?.length !== 1 ? "s" : ""} creada{events?.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Link href="/dashboard/nuevo">
            <Button>+ Nueva colecta</Button>
          </Link>
        </div>

        {/* Lista de eventos */}
        {!events || events.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {events.map((event) => (
              <EventCard key={event.id} event={event as Event & { participants: { count: number }[] }} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white px-8 py-16 text-center">
      <span className="mb-4 text-5xl">🪣</span>
      <h3 className="mb-2 text-lg font-semibold text-gray-900">
        Aún no tienes colectas
      </h3>
      <p className="mb-6 text-sm text-gray-500">
        Crea tu primera colecta y compártela con tus participantes.
      </p>
      <Link href="/dashboard/nuevo">
        <Button>Crear primera colecta</Button>
      </Link>
    </div>
  );
}

function EventCard({ event }: { event: Event & { participants: { count: number }[] } }) {
  const participantCount = event.participants?.[0]?.count ?? 0;

  return (
    <Link href={`/evento/${event.slug}`}>
      <Card className="cursor-pointer transition hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <CardTitle className="text-base">{event.name}</CardTitle>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                event.is_active
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {event.is_active ? "Activa" : "Cerrada"}
            </span>
          </div>
          {event.description && (
            <CardDescription className="line-clamp-1">
              {event.description}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              👥 {participantCount} participante{participantCount !== 1 ? "s" : ""}
            </span>
            {event.total_amount && (
              <span className="font-semibold text-violet-600">
                {formatCurrency(event.total_amount, event.currency)}
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Código: <span className="font-mono font-medium">{event.code}</span>
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
