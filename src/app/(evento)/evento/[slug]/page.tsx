"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import QRCode from "react-qr-code";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { EventWithDetails, Participant, Payment } from "@/types/database";

export default function EventoPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const tokenFromUrl = searchParams.get("token");

  const [event, setEvent] = useState<EventWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"participantes" | "qr" | "info">("participantes");

  const joinUrl = typeof window !== "undefined"
    ? `${window.location.origin}/unirse/${event?.code}`
    : "";

  const loadEvent = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("events")
      .select(`*, participants(*, payments(*)), event_items(*), payment_info(*)`)
      .eq("slug", slug)
      .single();

    if (error || !data) {
      setLoading(false);
      return;
    }

    setEvent(data as unknown as EventWithDetails);

    // Verificar si es el organizador
    const storedToken = localStorage.getItem(`colecta_admin_${slug}`);
    const token = tokenFromUrl ?? storedToken;
    if (token && token === data.admin_token) {
      setIsOrganizer(true);
      if (tokenFromUrl) localStorage.setItem(`colecta_admin_${slug}`, tokenFromUrl);
    }

    setLoading(false);
  }, [slug, tokenFromUrl]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  async function confirmPayment(participantId: string, amount: number) {
    if (!isOrganizer || !event) return;
    const supabase = createClient();

    const { error } = await supabase.from("payments").insert({
      participant_id: participantId,
      amount,
      confirmed_at: new Date().toISOString(),
      confirmed_by: event.admin_token,
    });

    if (error) { toast.error("Error al confirmar pago"); return; }
    toast.success("¡Pago confirmado!");
    loadEvent();
  }

  async function undoPayment(participantId: string) {
    if (!isOrganizer || !event) return;
    const supabase = createClient();

    const participant = event.participants.find((p) => p.id === participantId);
    if (!participant?.payments?.length) return;

    const lastPayment = participant.payments[participant.payments.length - 1];
    const { error } = await supabase.from("payments").delete().eq("id", lastPayment.id);

    if (error) { toast.error("Error al deshacer"); return; }
    toast.success("Pago deshecho");
    loadEvent();
  }

  function copyLink() {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    toast.success("¡Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  }

  function copyCode() {
    if (!event) return;
    navigator.clipboard.writeText(event.code);
    toast.success(`Código ${event.code} copiado`);
  }

  if (loading) return <LoadingScreen />;
  if (!event) return <NotFoundScreen />;

  const totalConfirmed = event.participants.reduce((sum, p) => {
    const paid = p.payments?.some((pay: Payment) => pay.confirmed_at);
    return sum + (paid ? p.amount_owed : 0);
  }, 0);
  const totalPending = (event.total_amount ?? 0) - totalConfirmed;
  const confirmedCount = event.participants.filter((p) =>
    p.payments?.some((pay: Payment) => pay.confirmed_at)
  ).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl">🪣</span>
            <span className="font-bold text-gray-900">Colecta</span>
          </Link>
          {isOrganizer && (
            <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700">
              👑 Organizador
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        {/* Título y resumen */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
          {event.description && <p className="mt-1 text-sm text-gray-500">{event.description}</p>}

          <div className="mt-4 grid grid-cols-3 gap-3">
            <StatCard
              label="Total"
              value={formatCurrency(event.total_amount ?? 0, event.currency)}
              color="violet"
            />
            <StatCard
              label="Cobrado"
              value={formatCurrency(totalConfirmed, event.currency)}
              color="green"
            />
            <StatCard
              label="Pendiente"
              value={formatCurrency(totalPending, event.currency)}
              color="orange"
            />
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-gray-500">
              <span>{confirmedCount}/{event.participants.length} pagaron</span>
              <span>{event.total_amount ? Math.round((totalConfirmed / event.total_amount) * 100) : 0}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-green-500 transition-all"
                style={{ width: `${event.total_amount ? (totalConfirmed / event.total_amount) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Compartir */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-gray-700">📤 Compartir colecta</p>
          <div className="flex gap-2">
            <button
              onClick={copyCode}
              className="flex flex-1 items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 font-mono text-lg font-bold tracking-widest text-violet-700 hover:bg-gray-100"
            >
              {event.code}
              <span className="text-xs font-normal text-gray-400">código</span>
            </button>
            <Button onClick={copyLink} variant="outline" className="shrink-0">
              {copied ? "✓ Copiado" : "📋 Link"}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
          {(["participantes", "qr", "info"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium capitalize transition ${
                activeTab === tab ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "participantes" ? "👥 Participantes" : tab === "qr" ? "📲 QR" : "💳 Info pago"}
            </button>
          ))}
        </div>

        {/* Tab: Participantes */}
        {activeTab === "participantes" && (
          <div className="space-y-2">
            {event.participants.map((participant) => (
              <ParticipantCard
                key={participant.id}
                participant={participant}
                currency={event.currency}
                isOrganizer={isOrganizer}
                onConfirm={confirmPayment}
                onUndo={undoPayment}
              />
            ))}
          </div>
        )}

        {/* Tab: QR */}
        {activeTab === "qr" && (
          <div className="flex flex-col items-center rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
            <p className="mb-4 text-sm text-gray-500 text-center">
              Escanea para acceder a la colecta
            </p>
            <div className="rounded-2xl bg-white p-4 shadow-md border">
              <QRCode value={joinUrl} size={200} />
            </div>
            <p className="mt-4 font-mono text-xl font-bold tracking-widest text-violet-700">{event.code}</p>
            <p className="mt-1 text-xs text-gray-400 text-center break-all max-w-xs">{joinUrl}</p>
          </div>
        )}

        {/* Tab: Info de pago */}
        {activeTab === "info" && (
          <PaymentInfoTab eventId={event.id} isOrganizer={isOrganizer} existingInfo={event.payment_info} onSaved={loadEvent} />
        )}
      </main>
    </div>
  );
}

function ParticipantCard({
  participant,
  currency,
  isOrganizer,
  onConfirm,
  onUndo,
}: {
  participant: Participant & { payments: Payment[] };
  currency: string;
  isOrganizer: boolean;
  onConfirm: (id: string, amount: number) => void;
  onUndo: (id: string) => void;
}) {
  const paid = participant.payments?.some((p) => p.confirmed_at);

  return (
    <div className={`flex items-center justify-between rounded-xl border p-4 transition ${
      paid ? "border-green-200 bg-green-50" : "border-gray-100 bg-white"
    }`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
          paid ? "bg-green-500 text-white" : "bg-gray-100 text-gray-600"
        }`}>
          {paid ? "✓" : participant.name[0].toUpperCase()}
        </div>
        <div>
          <p className="font-medium text-gray-900">{participant.name}</p>
          <p className={`text-sm font-semibold ${paid ? "text-green-600" : "text-violet-600"}`}>
            {formatCurrency(participant.amount_owed, currency)}
          </p>
        </div>
      </div>

      {isOrganizer && (
        <div className="flex gap-2">
          {paid ? (
            <button
              onClick={() => onUndo(participant.id)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
            >
              Deshacer
            </button>
          ) : (
            <button
              onClick={() => onConfirm(participant.id, participant.amount_owed)}
              className="rounded-lg bg-green-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600"
            >
              Confirmar pago ✓
            </button>
          )}
        </div>
      )}

      {!isOrganizer && (
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${
          paid ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
        }`}>
          {paid ? "Pagado ✓" : "Pendiente"}
        </span>
      )}
    </div>
  );
}

function PaymentInfoTab({
  eventId,
  isOrganizer,
  existingInfo,
  onSaved,
}: {
  eventId: string;
  isOrganizer: boolean;
  existingInfo: EventWithDetails["payment_info"];
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(!existingInfo);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    account_holder: existingInfo?.account_holder ?? "",
    bank_name: existingInfo?.bank_name ?? "",
    account_type: existingInfo?.account_type ?? "",
    account_number: existingInfo?.account_number ?? "",
    rut: existingInfo?.rut ?? "",
    email: existingInfo?.email ?? "",
    notes: existingInfo?.notes ?? "",
  });

  async function saveInfo() {
    setSaving(true);
    const supabase = createClient();

    if (existingInfo) {
      await supabase.from("payment_info").update({ ...form, updated_at: new Date().toISOString() }).eq("event_id", eventId);
    } else {
      await supabase.from("payment_info").insert({ event_id: eventId, ...form });
    }

    setSaving(false);
    setEditing(false);
    toast.success("Datos de pago guardados");
    onSaved();
  }

  if (!existingInfo && !isOrganizer) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
        <p className="text-4xl mb-3">💳</p>
        <p className="text-gray-500 text-sm">El organizador aún no cargó los datos de transferencia.</p>
      </div>
    );
  }

  if (!editing && existingInfo) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-gray-900">Datos de transferencia</p>
          {isOrganizer && (
            <button onClick={() => setEditing(true)} className="text-sm text-violet-600 hover:underline">Editar</button>
          )}
        </div>
        {existingInfo.account_holder && <InfoRow label="Titular" value={existingInfo.account_holder} />}
        {existingInfo.bank_name && <InfoRow label="Banco" value={existingInfo.bank_name} />}
        {existingInfo.account_type && <InfoRow label="Tipo de cuenta" value={existingInfo.account_type} />}
        {existingInfo.account_number && <InfoRow label="N° de cuenta" value={existingInfo.account_number} />}
        {existingInfo.rut && <InfoRow label="RUT / DNI" value={existingInfo.rut} />}
        {existingInfo.email && <InfoRow label="Email" value={existingInfo.email} />}
        {existingInfo.notes && (
          <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">{existingInfo.notes}</div>
        )}
      </div>
    );
  }

  if (!isOrganizer) return null;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
      <p className="font-semibold text-gray-900">Datos de transferencia</p>
      <p className="text-xs text-gray-500">Estos datos se mostrarán a los participantes para que sepan a dónde transferir.</p>
      {[
        { key: "account_holder", label: "Nombre del titular" },
        { key: "bank_name", label: "Banco" },
        { key: "account_type", label: "Tipo de cuenta (corriente, vista, etc.)" },
        { key: "account_number", label: "N° de cuenta" },
        { key: "rut", label: "RUT / DNI / CUIT" },
        { key: "email", label: "Email de transferencia" },
        { key: "notes", label: "Notas adicionales" },
      ].map(({ key, label }) => (
        <div key={key}>
          <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
          <input
            value={form[key as keyof typeof form]}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      ))}
      <Button onClick={saveInfo} disabled={saving} className="w-full">
        {saving ? "Guardando..." : "Guardar datos"}
      </Button>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: "violet" | "green" | "orange" }) {
  const colors = {
    violet: "bg-violet-50 text-violet-700",
    green: "bg-green-50 text-green-700",
    orange: "bg-amber-50 text-amber-700",
  };
  return (
    <div className={`rounded-xl p-3 ${colors[color]}`}>
      <p className="text-xs opacity-70">{label}</p>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-3 text-4xl animate-bounce">🪣</div>
        <p className="text-gray-500">Cargando colecta...</p>
      </div>
    </div>
  );
}

function NotFoundScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <p className="mb-2 text-5xl">😕</p>
        <h2 className="text-xl font-bold text-gray-900">Colecta no encontrada</h2>
        <p className="mt-1 text-gray-500">El link puede haber expirado o ser incorrecto.</p>
        <Link href="/" className="mt-4 inline-block text-violet-600 hover:underline">← Volver al inicio</Link>
      </div>
    </div>
  );
}
