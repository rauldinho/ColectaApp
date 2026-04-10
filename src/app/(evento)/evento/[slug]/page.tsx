"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import QRCode from "react-qr-code";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, splitEqually } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import type { EventWithDetails, Participant, Payment } from "@/types/database";

type OrgDoc = { name: string; url: string; originalName: string };

export default function EventoPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [event, setEvent] = useState<EventWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"participantes" | "qr" | "info" | "facturas">("participantes");

  // Organizer docs (facturas del evento)
  const [orgDocs, setOrgDocs] = useState<OrgDoc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const orgDocRef = useRef<HTMLInputElement>(null);

  // Invite state
  const [inviteEmail, setInviteEmail] = useState("");
  const [showInvite, setShowInvite] = useState(false);

  // Summary modal
  const [showSummary, setShowSummary] = useState(false);

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

    if (error || !data) { setLoading(false); return; }
    setEvent(data as unknown as EventWithDetails);
    const isOrg = localStorage.getItem(`colecta_organizer_${slug}`);
    if (isOrg === "true") setIsOrganizer(true);
    const participantId = localStorage.getItem(`colecta_participant_${slug}`);
    if (participantId) setMyParticipantId(participantId);
    setLoading(false);
  }, [slug]);

  useEffect(() => { loadEvent(); }, [loadEvent]);

  // ── Supabase Realtime — one WebSocket connection, zero polling ──
  useEffect(() => {
    if (!event?.id) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`colecta-${event.id}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "participants",
        filter: `event_id=eq.${event.id}`,
      }, () => loadEvent())
      .on("postgres_changes", {
        event: "*", schema: "public", table: "payments",
      }, () => loadEvent())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [event?.id, loadEvent]);

  // ── Organizer docs ──
  const loadOrgDocs = useCallback(async () => {
    if (!event?.id) return;
    setLoadingDocs(true);
    const supabase = createClient();
    const { data: files } = await supabase.storage
      .from("receipts")
      .list(`${event.id}/organizer`);
    if (files) {
      const docs: OrgDoc[] = files
        .filter((f) => f.name !== ".emptyFolderPlaceholder")
        .map((f) => {
          const { data } = supabase.storage
            .from("receipts")
            .getPublicUrl(`${event.id}/organizer/${f.name}`);
          // name stored as timestamp.ext — use original if available in metadata
          return { name: f.name, url: data.publicUrl, originalName: f.name };
        });
      setOrgDocs(docs);
    }
    setLoadingDocs(false);
  }, [event?.id]);

  useEffect(() => {
    if (activeTab === "facturas" && event?.id) loadOrgDocs();
  }, [activeTab, event?.id, loadOrgDocs]);

  async function uploadOrgDoc(file: File) {
    if (!event || !isOrganizer) return;
    setUploadingDoc(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `${event.id}/organizer/${Date.now()}_${file.name.replace(/[^a-z0-9._-]/gi, "_")}`;
    const { error } = await supabase.storage
      .from("receipts")
      .upload(path, file, { upsert: false });
    setUploadingDoc(false);
    if (error) { toast.error("Error al subir el archivo: " + error.message); return; }
    toast.success("Archivo subido correctamente");
    loadOrgDocs();
  }

  async function deleteOrgDoc(name: string) {
    if (!event || !isOrganizer) return;
    const supabase = createClient();
    await supabase.storage.from("receipts").remove([`${event.id}/organizer/${name}`]);
    toast.success("Archivo eliminado");
    loadOrgDocs();
  }

  // ── Join colecta ──
  async function joinColecta(name: string, email: string) {
    if (!event) return;
    const supabase = createClient();
    const currentCount = event.participants.length;
    const newCount = currentCount + 1;
    let myAmount: number;

    if (event.amount_per_person) {
      myAmount = event.amount_per_person;
      const { data: newParticipant, error } = await supabase
        .from("participants")
        .insert({ event_id: event.id, name: name.trim(), email: email.trim() || null, amount_owed: myAmount })
        .select().single();
      if (error || !newParticipant) { toast.error("Error al unirte a la colecta"); return; }
      await supabase.from("events").update({ total_amount: event.amount_per_person * newCount }).eq("id", event.id);
      localStorage.setItem(`colecta_participant_${slug}`, newParticipant.id);
      setMyParticipantId(newParticipant.id);
      toast.success(`¡Te uniste! Tu parte: ${formatCurrency(myAmount, event.currency)}`);
    } else {
      const amounts = splitEqually(Math.round(event.total_amount ?? 0), newCount);
      myAmount = amounts[newCount - 1];
      const { data: newParticipant, error } = await supabase
        .from("participants")
        .insert({ event_id: event.id, name: name.trim(), email: email.trim() || null, amount_owed: myAmount })
        .select().single();
      if (error || !newParticipant) { toast.error("Error al unirte a la colecta"); return; }
      for (let i = 0; i < currentCount; i++) {
        await supabase.from("participants").update({ amount_owed: amounts[i] }).eq("id", event.participants[i].id);
      }
      localStorage.setItem(`colecta_participant_${slug}`, newParticipant.id);
      setMyParticipantId(newParticipant.id);
      toast.success(`¡Te uniste! Tu parte: ${formatCurrency(myAmount, event.currency)}`);
    }
    loadEvent();
  }

  // ── Payment actions ──
  async function confirmDirect(participantId: string, amount: number) {
    if (!isOrganizer || !event) return;
    const supabase = createClient();
    const participant = event.participants.find((p) => p.id === participantId);
    const pendingPayment = participant?.payments?.find((pay) => pay.status === "pending");
    if (pendingPayment) {
      const { error } = await supabase.from("payments").update({
        status: "confirmed", confirmed_at: new Date().toISOString(), confirmed_by: event.admin_token,
      }).eq("id", pendingPayment.id);
      if (error) { toast.error("Error al confirmar"); return; }
    } else {
      const { error } = await supabase.from("payments").insert({
        participant_id: participantId, amount, status: "confirmed",
        confirmed_at: new Date().toISOString(), confirmed_by: event.admin_token,
      });
      if (error) { toast.error("Error al confirmar pago"); return; }
    }
    toast.success("¡Pago confirmado!");
    loadEvent();
  }

  async function rejectPayment(paymentId: string) {
    if (!isOrganizer) return;
    const supabase = createClient();
    const { error } = await supabase.from("payments").delete().eq("id", paymentId);
    if (error) { toast.error("Error al rechazar"); return; }
    toast.success("Pago rechazado");
    loadEvent();
  }

  async function undoPayment(participantId: string) {
    if (!isOrganizer || !event) return;
    const supabase = createClient();
    const participant = event.participants.find((p) => p.id === participantId);
    const confirmedPayment = participant?.payments?.find((p) => p.status === "confirmed");
    if (!confirmedPayment) return;
    const { error } = await supabase.from("payments").delete().eq("id", confirmedPayment.id);
    if (error) { toast.error("Error al deshacer"); return; }
    toast.success("Pago deshecho");
    loadEvent();
  }

  async function submitPayment(participantId: string, amount: number, file: File | null) {
    if (!event) return;
    const supabase = createClient();
    let receiptUrl: string | null = null;
    if (file) {
      const ext = file.name.split(".").pop();
      const path = `${event.id}/${participantId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("receipts").upload(path, file, { upsert: true });
      if (uploadError) { toast.error("Error al subir el comprobante: " + uploadError.message); return; }
      const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(path);
      receiptUrl = urlData.publicUrl;
    }
    const { error } = await supabase.from("payments").insert({
      participant_id: participantId, amount, status: "pending", receipt_url: receiptUrl,
    });
    if (error) { toast.error("Error al registrar pago"); return; }
    toast.success("¡Pago enviado! El organizador lo confirmará pronto.");
    loadEvent();
  }

  // ── Share helpers ──
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

  function copyInviteText() {
    if (!event) return;
    const text =
      `¡Hola! Te invito a unirte a la colecta "${event.name}".\n\n` +
      `🔑 Código de acceso: ${event.code}\n` +
      `🔗 Accede directamente: ${joinUrl}\n\n` +
      `Ingresa tu nombre y verás cuánto te toca pagar.`;
    navigator.clipboard.writeText(text);
    toast.success("Texto de invitación copiado");
  }

  // ── Summary generator (WhatsApp-ready text) ──
  function buildSummaryText() {
    if (!event) return "";
    const paid: string[] = [];
    const awaitingConfirm: string[] = [];
    const pending: string[] = [];

    event.participants.forEach((p) => {
      const isConfirmed = p.payments?.some((pay: Payment) => pay.status === "confirmed");
      const isPending = !isConfirmed && p.payments?.some((pay: Payment) => pay.status === "pending");
      if (isConfirmed) paid.push(p.name);
      else if (isPending) awaitingConfirm.push(p.name);
      else pending.push(p.name);
    });

    const total = event.total_amount
      ? formatCurrency(event.total_amount, event.currency)
      : event.amount_per_person
        ? `${formatCurrency(event.amount_per_person, event.currency)} c/u`
        : "—";

    const perPerson = event.amount_per_person
      ?? (event.participants.length > 0
        ? (event.total_amount ?? 0) / event.participants.length
        : null);

    const dateStr = event.event_date
      ? new Date(event.event_date + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })
      : new Date(event.created_at).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });

    let text = `📊 *${event.name}*\n`;
    text += `📅 ${dateStr} · 💰 ${total}\n`;
    if (perPerson) text += `👤 Cuota por persona: *${formatCurrency(Math.ceil(perPerson), event.currency)}*\n`;
    text += "\n";

    if (paid.length > 0) {
      text += `✅ *Pagaron (${paid.length}):*\n`;
      paid.forEach((n) => (text += `• ${n} ✓\n`));
      text += "\n";
    }
    if (awaitingConfirm.length > 0) {
      text += `⏳ *Por confirmar (${awaitingConfirm.length}):*\n`;
      awaitingConfirm.forEach((n) => (text += `• ${n} (envió comprobante)\n`));
      text += "\n";
    }
    if (pending.length > 0) {
      text += `❌ *Deben pagar (${pending.length}):*\n`;
      pending.forEach((n) => (text += `• ${n}\n`));
      text += "\n";
    }

    text += `_Generado con Colecta 🪣 · Código: ${event.code}_`;
    return text;
  }

  // ── Guards ──
  if (loading) return <LoadingScreen />;
  if (!event) return <NotFoundScreen />;

  // ── Computed values ──
  const totalConfirmed = event.participants.reduce((sum, p) => {
    const confirmed = p.payments?.find((pay: Payment) => pay.status === "confirmed");
    return sum + (confirmed ? p.amount_owed : 0);
  }, 0);
  const totalPending = (event.total_amount ?? 0) - totalConfirmed;
  const confirmedCount = event.participants.filter((p) =>
    p.payments?.some((pay: Payment) => pay.status === "confirmed")
  ).length;
  const pendingCount = event.participants.filter((p) =>
    p.payments?.some((pay: Payment) => pay.status === "pending") &&
    !p.payments?.some((pay: Payment) => pay.status === "confirmed")
  ).length;
  const hasJoined = !!myParticipantId;
  const perPerson = event.amount_per_person
    ?? (event.participants.length > 0
      ? (event.total_amount ?? 0) / event.participants.length
      : event.total_amount ?? 0);

  // ── Mailto invite link ──
  const inviteSubject = encodeURIComponent(`Te invitan a la colecta "${event.name}"`);
  const inviteBody = encodeURIComponent(
    `¡Hola!\n\nTe invito a unirte a la colecta "${event.name}".\n\n` +
    `🔑 Código de acceso: ${event.code}\n` +
    `🔗 Accede aquí: ${joinUrl}\n\n` +
    `Ingresa tu nombre y verás cuánto te toca pagar.`
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl">🪣</span>
            <span className="font-bold text-gray-900">Colecta</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isOrganizer ? (
              <>
                <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700">
                  👑 Organizador
                </span>
                <button
                  onClick={() => {
                    localStorage.removeItem(`colecta_organizer_${slug}`);
                    setIsOrganizer(false);
                    toast.success("Saliste del modo organizador");
                  }}
                  className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-400 hover:border-red-200 hover:text-red-500 transition"
                >
                  Salir
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowPinModal(true)}
                className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
              >
                🔐 Soy el organizador
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4 space-y-3">
        {/* Hero card — monto prominente + progress */}
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          {/* Nombre + fecha */}
          <div className="px-5 pt-5 pb-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-0.5">Colecta</p>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">{event.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {event.description && <p className="text-sm text-gray-500">{event.description}</p>}
              <span className="text-xs text-gray-400">
                📅{" "}
                {event.event_date
                  ? new Date(event.event_date + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })
                  : new Date(event.created_at).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })}
              </span>
            </div>
          </div>

          {/* Big number — cuota o total */}
          <div className="px-5 pb-3 border-b border-gray-100">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-0.5">
              {event.amount_per_person ? "Cuota por persona" : "Total a recaudar"}
            </p>
            <span className="text-4xl font-extrabold text-gray-900 tracking-tight">
              {formatCurrency(event.amount_per_person ?? event.total_amount ?? 0, event.currency)}
            </span>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 divide-x divide-gray-100">
            <div className="px-4 py-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500 mb-0.5">Total</p>
              <p className="text-sm font-bold text-gray-900">{formatCurrency(event.total_amount ?? 0, event.currency)}</p>
            </div>
            <div className="px-4 py-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500 mb-0.5">Cobrado</p>
              <p className="text-sm font-bold text-emerald-600">{formatCurrency(totalConfirmed, event.currency)}</p>
            </div>
            <div className="px-4 py-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-400 mb-0.5">Falta</p>
              <p className="text-sm font-bold text-rose-500">{formatCurrency(totalPending, event.currency)}</p>
            </div>
          </div>

          {/* Progress bar */}
          {event.participants.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-50">
              <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                <span>
                  {confirmedCount} de {event.participants.length} pagaron
                  {pendingCount > 0 && <span className="ml-1 text-amber-500">· {pendingCount} por confirmar</span>}
                </span>
                <span className="font-semibold text-indigo-600">
                  {event.total_amount ? Math.round((totalConfirmed / event.total_amount) * 100) : 0}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                  style={{ width: `${event.total_amount ? (totalConfirmed / event.total_amount) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Join section */}
        {!isOrganizer && !hasJoined && (
          <JoinSection
            currency={event.currency}
            totalAmount={event.total_amount ?? 0}
            amountPerPerson={event.amount_per_person ?? null}
            participantCount={event.participants.length}
            onJoin={joinColecta}
          />
        )}

        {/* Mi card (si ya me uní) */}
        {!isOrganizer && hasJoined && myParticipantId && (() => {
          const me = event.participants.find((p) => p.id === myParticipantId);
          if (!me) return null;
          return (
            <div className="rounded-2xl border-2 border-indigo-300 bg-indigo-50 p-4 shadow-sm">
              <p className="mb-2 text-xs font-semibold text-indigo-600 uppercase tracking-wide">Tu participación</p>
              <ParticipantCard
                participant={me}
                currency={event.currency}
                isOrganizer={false}
                isMe={true}
                onConfirmDirect={confirmDirect}
                onUndo={undoPayment}
                onReject={rejectPayment}
                onSubmitPayment={submitPayment}
              />
              <p className="mt-2 text-xs text-indigo-500 text-center">
                El monto se actualiza a medida que más personas se unan
              </p>
            </div>
          );
        })()}

        {/* Compartir + Invitar */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
          <p className="text-sm font-semibold text-gray-700">📤 Compartir colecta</p>

          {/* Código + link */}
          <div className="flex gap-2">
            <button
              onClick={copyCode}
              className="flex flex-1 items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 font-mono text-lg font-bold tracking-widest text-indigo-700 hover:bg-gray-100"
            >
              {event.code}
              <span className="text-xs font-normal text-gray-400">código</span>
            </button>
            <Button onClick={copyLink} variant="outline" className="shrink-0">
              {copied ? "✓ Copiado" : "📋 Link"}
            </Button>
          </div>

          {/* Invitar (organizer only) */}
          {isOrganizer && (
            <div className="border-t border-gray-100 pt-3">
              <button
                onClick={() => setShowInvite(!showInvite)}
                className="flex w-full items-center justify-between text-sm font-medium text-indigo-700 hover:text-indigo-900"
              >
                <span>✉️ Invitar participante</span>
                <span className="text-gray-400 text-xs">{showInvite ? "▲ Cerrar" : "▼ Abrir"}</span>
              </button>

              {showInvite && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-gray-500">
                    Ingresa el email de la persona y se abrirá tu app de correo con el mensaje listo.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="correo@ejemplo.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="flex-1 h-9 text-sm"
                    />
                    <a
                      href={inviteEmail.trim() ? `mailto:${inviteEmail}?subject=${inviteSubject}&body=${inviteBody}` : "#"}
                      onClick={(e) => { if (!inviteEmail.trim()) e.preventDefault(); }}
                      className={`inline-flex items-center rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                        inviteEmail.trim()
                          ? "bg-indigo-600 text-white hover:bg-indigo-700"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      Enviar
                    </a>
                  </div>
                  <button
                    onClick={copyInviteText}
                    className="w-full rounded-xl border border-gray-200 py-2 text-xs text-gray-600 hover:bg-gray-50 transition"
                  >
                    📋 Copiar texto de invitación
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tabs — segmented control */}
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
          {(["participantes", "qr", "info", "facturas"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 whitespace-nowrap rounded-lg py-2.5 px-1 text-xs font-semibold transition ${
                activeTab === tab ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "participantes"
                ? `👥${pendingCount > 0 && isOrganizer ? ` (${pendingCount})` : ""}`
                : tab === "qr" ? "📲 QR"
                : tab === "info" ? "💳 Pago"
                : "📄 Facturas"}
            </button>
          ))}
        </div>

        {/* Tab: Participantes */}
        {activeTab === "participantes" && (
          <div className="space-y-2">
            {/* Organizer: summary + refresh buttons */}
            {isOrganizer && (
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => loadEvent()}
                  className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-500 shadow-sm hover:bg-gray-50 transition"
                >
                  🔄 Actualizar
                </button>
                {event.participants.length > 0 && (
                  <button
                    onClick={() => setShowSummary(true)}
                    className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm hover:bg-gray-50 hover:text-indigo-700 transition"
                  >
                    📊 Generar resumen
                  </button>
                )}
              </div>
            )}
            {event.participants.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center">
                <p className="text-4xl mb-3">👥</p>
                <p className="font-medium text-gray-700">Aún no hay participantes</p>
                <p className="mt-1 text-sm text-gray-400">
                  Comparte el código <span className="font-mono font-bold text-indigo-600">{event.code}</span> para que se unan
                </p>
                {event.amount_per_person ? (
                  <p className="mt-3 text-sm text-gray-500">
                    Cada participante pagará{" "}
                    <span className="font-semibold text-indigo-700">{formatCurrency(event.amount_per_person, event.currency)}</span>
                  </p>
                ) : event.total_amount ? (
                  <p className="mt-3 text-sm text-gray-500">
                    {formatCurrency(event.total_amount, event.currency)} se dividirá automáticamente entre todos
                  </p>
                ) : null}
              </div>
            ) : (
              <>
                {event.participants.length > 1 && (
                  <div className="rounded-xl bg-indigo-50 px-4 py-2.5 flex justify-between items-center">
                    <span className="text-sm text-indigo-700">
                      {event.participants.length} participante{event.participants.length !== 1 ? "s" : ""}
                    </span>
                    <span className="text-sm font-bold text-indigo-800">
                      {formatCurrency(perPerson, event.currency)} c/u
                    </span>
                  </div>
                )}
                {event.participants.map((participant) => (
                  <ParticipantCard
                    key={participant.id}
                    participant={participant}
                    currency={event.currency}
                    isOrganizer={isOrganizer}
                    isMe={participant.id === myParticipantId}
                    onConfirmDirect={confirmDirect}
                    onUndo={undoPayment}
                    onReject={rejectPayment}
                    onSubmitPayment={submitPayment}
                  />
                ))}
              </>
            )}
          </div>
        )}

        {/* Tab: QR */}
        {activeTab === "qr" && (
          <div className="flex flex-col items-center rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
            <p className="mb-4 text-sm text-gray-500 text-center">Escanea para acceder a la colecta</p>
            <div className="rounded-2xl bg-white p-4 shadow-md border">
              <QRCode value={joinUrl} size={200} />
            </div>
            <p className="mt-4 font-mono text-xl font-bold tracking-widest text-indigo-700">{event.code}</p>
            <p className="mt-1 text-xs text-gray-400 text-center break-all max-w-xs">{joinUrl}</p>
          </div>
        )}

        {/* Tab: Info de pago */}
        {activeTab === "info" && (
          <PaymentInfoTab
            eventId={event.id}
            isOrganizer={isOrganizer}
            existingInfo={event.payment_info}
            onSaved={loadEvent}
          />
        )}

        {/* Tab: Facturas del evento */}
        {activeTab === "facturas" && (
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">Facturas y comprobantes</p>
                <p className="text-xs text-gray-400 mt-0.5">Documentos del evento subidos por el organizador</p>
              </div>
              {isOrganizer && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => orgDocRef.current?.click()}
                    disabled={uploadingDoc}
                  >
                    {uploadingDoc ? "Subiendo..." : "📎 Subir"}
                  </Button>
                  <input
                    ref={orgDocRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) { uploadOrgDoc(file); e.target.value = ""; }
                    }}
                  />
                </>
              )}
            </div>

            {loadingDocs ? (
              <div className="py-6 text-center text-sm text-gray-400">Cargando...</div>
            ) : orgDocs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                <p className="text-3xl mb-2">📄</p>
                <p className="text-sm text-gray-500">
                  {isOrganizer
                    ? "Sube las facturas o comprobantes del evento para que todos los participantes puedan verlos."
                    : "El organizador aún no subió facturas del evento."}
                </p>
                {isOrganizer && (
                  <button
                    onClick={() => orgDocRef.current?.click()}
                    className="mt-3 text-sm text-indigo-600 font-medium hover:underline"
                  >
                    + Subir primer archivo
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {orgDocs.map((doc) => {
                  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.name);
                  const isPdf = /\.pdf$/i.test(doc.name);
                  return (
                    <div key={doc.name} className="rounded-xl border border-gray-100 bg-gray-50 overflow-hidden">
                      {isImage && (
                        <a href={doc.url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={doc.url}
                            alt="Factura"
                            className="w-full max-h-64 object-contain bg-white border-b border-gray-100"
                          />
                        </a>
                      )}
                      <div className="flex items-center justify-between px-3 py-2.5">
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-gray-700 hover:text-indigo-700 truncate"
                        >
                          <span>{isPdf ? "📄" : isImage ? "🖼️" : "📎"}</span>
                          <span className="truncate max-w-xs">{doc.originalName}</span>
                        </a>
                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-indigo-600 hover:underline"
                          >
                            Ver
                          </a>
                          {isOrganizer && (
                            <button
                              onClick={() => deleteOrgDoc(doc.name)}
                              className="text-xs text-red-400 hover:text-red-600"
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {showPinModal && (
        <PinModal
          slug={slug}
          eventAdminPin={event.admin_pin}
          onSuccess={() => {
            setIsOrganizer(true);
            setShowPinModal(false);
            toast.success("¡Acceso como organizador!");
          }}
          onClose={() => setShowPinModal(false)}
        />
      )}

      {showSummary && (
        <SummaryModal
          summaryText={buildSummaryText()}
          onClose={() => setShowSummary(false)}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Summary Modal — resumen para WhatsApp
// ──────────────────────────────────────────────
function SummaryModal({ summaryText, onClose }: { summaryText: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4 backdrop-blur-sm">
      <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="font-bold text-gray-900">📊 Resumen de pagos</h3>
            <p className="text-xs text-gray-400 mt-0.5">Listo para copiar y pegar en WhatsApp</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            ✕
          </button>
        </div>

        {/* Preview */}
        <div className="px-5 py-4">
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 max-h-72 overflow-y-auto">
            <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">
              {summaryText}
            </pre>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 border-t border-gray-100 px-5 py-4">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cerrar
          </Button>
          <Button
            className={`flex-1 transition ${copied ? "bg-green-600 hover:bg-green-700" : ""}`}
            onClick={handleCopy}
          >
            {copied ? "✓ ¡Copiado!" : "📋 Copiar para WhatsApp"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Join Section
// ──────────────────────────────────────────────
function JoinSection({
  currency, totalAmount, amountPerPerson, participantCount, onJoin,
}: {
  currency: string;
  totalAmount: number;
  amountPerPerson: number | null;
  participantCount: number;
  onJoin: (name: string, email: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [joining, setJoining] = useState(false);

  const isFixed = !!amountPerPerson;
  const estimatedShare = isFixed
    ? amountPerPerson
    : participantCount > 0 ? totalAmount / (participantCount + 1) : totalAmount;

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setJoining(true);
    await onJoin(name, email);
    setJoining(false);
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      {/* Monto hero */}
      {estimatedShare > 0 && (
        <div className="bg-indigo-50 border-b border-indigo-100 px-5 py-4 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-400 mb-1">
            {isFixed ? "Tu cuota es" : "Tu parte estimada"}
          </p>
          <p className="text-4xl font-extrabold text-indigo-700 tracking-tight">
            {formatCurrency(Math.ceil(estimatedShare), currency)}
          </p>
          {!isFixed && participantCount > 0 && (
            <p className="text-xs text-indigo-400 mt-1">{formatCurrency(totalAmount, currency)} ÷ {participantCount + 1} personas</p>
          )}
          {isFixed && <p className="text-xs text-indigo-400 mt-1">Cuota fija definida por el organizador</p>}
        </div>
      )}
      {/* Formulario */}
      <div className="p-5">
        <p className="text-sm font-semibold text-gray-800 mb-4">Ingresa tus datos para unirte</p>
        <form onSubmit={handleJoin} className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Tu nombre <span className="text-red-400">*</span>
            </label>
            <Input placeholder="Ej: María González" value={name} onChange={(e) => setName(e.target.value)} required autoFocus className="h-12 text-base" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Email <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <Input type="email" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 text-base" />
          </div>
          <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={joining || !name.trim()}>
            {joining ? "Uniéndome..." : "Unirme a la colecta 🚀"}
          </Button>
        </form>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Participant Card
// ──────────────────────────────────────────────
function ParticipantCard({
  participant, currency, isOrganizer, isMe, onConfirmDirect, onUndo, onReject, onSubmitPayment,
}: {
  participant: Participant & { payments: Payment[] };
  currency: string;
  isOrganizer: boolean;
  isMe: boolean;
  onConfirmDirect: (id: string, amount: number) => void;
  onUndo: (id: string) => void;
  onReject: (paymentId: string) => void;
  onSubmitPayment: (id: string, amount: number, file: File | null) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const confirmedPayment = participant.payments?.find((p) => p.status === "confirmed");
  const pendingPayment = participant.payments?.find((p) => p.status === "pending");
  const isPaid = !!confirmedPayment;
  const isPending = !isPaid && !!pendingPayment;

  // Reset local visual state when payment status changes (fixes "Deshacer" visual bug)
  useEffect(() => {
    setExpanded(false);
    setSelectedFile(null);
    setPreview(null);
    setShowReceipt(false);
  }, [isPaid, isPending]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit() {
    setSubmitting(true);
    await onSubmitPayment(participant.id, participant.amount_owed, selectedFile);
    setSubmitting(false);
    setExpanded(false);
    setSelectedFile(null);
    setPreview(null);
  }

  // Iniciales del nombre
  const initials = participant.name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();

  return (
    <div className={`rounded-xl border transition ${
      isPaid ? "border-emerald-200 bg-emerald-50/40"
      : isPending ? "border-amber-200 bg-amber-50/40"
      : isMe ? "border-indigo-200 bg-white"
      : "border-gray-100 bg-white"
    }`}>
      <div className="flex items-center justify-between px-4 py-3.5">
        <div className="flex items-center gap-3">
          {/* Avatar con iniciales */}
          <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold flex-shrink-0 ${
            isPaid ? "bg-emerald-500 text-white"
            : isPending ? "bg-amber-400 text-white"
            : isMe ? "bg-indigo-600 text-white"
            : "bg-gray-200 text-gray-600"
          }`}>
            {isPaid ? "✓" : isPending ? "⏳" : initials}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="font-semibold text-gray-900 text-sm">{participant.name}</p>
              {isMe && !isOrganizer && (
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-600">Tú</span>
              )}
            </div>
            <p className={`text-sm font-bold ${
              isPaid ? "text-emerald-600" : isPending ? "text-amber-600" : "text-gray-500"
            }`}>
              {formatCurrency(participant.amount_owed, currency)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isOrganizer ? (
            <>
              {isPaid ? (
                <button onClick={() => onUndo(participant.id)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50">
                  Deshacer
                </button>
              ) : isPending ? (
                <>
                  <button onClick={() => onConfirmDirect(participant.id, participant.amount_owed)}
                    className="rounded-lg bg-green-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600">
                    Aprobar ✓
                  </button>
                  <button onClick={() => onReject(pendingPayment!.id)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50">
                    Rechazar
                  </button>
                </>
              ) : (
                <button onClick={() => onConfirmDirect(participant.id, participant.amount_owed)}
                  className="rounded-lg bg-green-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600">
                  Confirmar ✓
                </button>
              )}
            </>
          ) : (
            <>
              {isPaid ? (
                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">Pagado ✓</span>
              ) : isPending ? (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">⏳ Esperando</span>
              ) : isMe ? (
                <button onClick={() => setExpanded(!expanded)}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
                  Ya pagué
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Organizer: receipt on pending payment */}
      {isOrganizer && isPending && pendingPayment?.receipt_url && (
        <div className="border-t border-amber-200 px-4 pb-4 pt-3">
          <p className="mb-2 text-xs font-medium text-amber-700">📎 Comprobante del participante:</p>
          <a href={pendingPayment.receipt_url} target="_blank" rel="noopener noreferrer">
            <img src={pendingPayment.receipt_url} alt="Comprobante"
              className="max-h-48 w-full rounded-xl object-contain border border-amber-200 bg-white" />
          </a>
        </div>
      )}
      {isOrganizer && isPending && !pendingPayment?.receipt_url && (
        <div className="border-t border-amber-200 px-4 pb-3 pt-2">
          <p className="text-xs text-amber-600">El participante declaró que pagó (sin comprobante adjunto)</p>
        </div>
      )}

      {/* Organizer: receipt toggle on confirmed payment */}
      {isOrganizer && isPaid && confirmedPayment?.receipt_url && (
        <div className="border-t border-green-100 px-4 pb-3 pt-2">
          <button
            onClick={() => setShowReceipt(!showReceipt)}
            className="text-xs text-green-600 hover:text-green-800 hover:underline"
          >
            {showReceipt ? "▲ Ocultar recibo" : "▼ Ver recibo de pago"}
          </button>
          {showReceipt && (
            <div className="mt-2">
              <a href={confirmedPayment.receipt_url} target="_blank" rel="noopener noreferrer">
                <img
                  src={confirmedPayment.receipt_url}
                  alt="Comprobante confirmado"
                  className="max-h-48 w-full rounded-xl object-contain border border-green-200 bg-white"
                />
              </a>
            </div>
          )}
        </div>
      )}

      {/* Participant: "Ya pagué" form */}
      {isMe && !isOrganizer && !isPaid && !isPending && expanded && (
        <div className="border-t border-indigo-100 px-4 pb-4 pt-3 space-y-3">
          <p className="text-sm font-medium text-gray-700">Adjunta tu comprobante (opcional)</p>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-4 hover:border-indigo-400 hover:bg-indigo-50 transition"
          >
            {preview ? (
              <img src={preview} alt="Preview" className="max-h-40 rounded-lg object-contain" />
            ) : (
              <>
                <span className="text-2xl mb-1">📸</span>
                <p className="text-sm text-gray-500">Toca para subir foto</p>
                <p className="text-xs text-gray-400">JPG, PNG o PDF</p>
              </>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />
          {selectedFile && <p className="text-xs text-gray-500 truncate">📎 {selectedFile.name}</p>}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1"
              onClick={() => { setExpanded(false); setSelectedFile(null); setPreview(null); }}>
              Cancelar
            </Button>
            <Button size="sm" className="flex-1" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Enviando..." : "Confirmar pago"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// PIN Modal
// ──────────────────────────────────────────────
function PinModal({ slug, eventAdminPin, onSuccess, onClose }: {
  slug: string; eventAdminPin: string; onSuccess: () => void; onClose: () => void;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [showPin, setShowPin] = useState(false);

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (pin === eventAdminPin) {
      localStorage.setItem(`colecta_organizer_${slug}`, "true");
      onSuccess();
    } else {
      setError(true);
      setPin("");
      setTimeout(() => setError(false), 2000);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 text-center">
          <p className="mb-1 text-3xl">🔐</p>
          <h3 className="text-lg font-bold text-gray-900">Acceso de organizador</h3>
          <p className="text-sm text-gray-500">Ingresa el PIN que definiste al crear la colecta</p>
        </div>
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="relative">
            <Input
              type={showPin ? "text" : "password"}
              inputMode="numeric"
              placeholder="Ingresa tu PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
              autoFocus
              className={`text-center text-2xl tracking-widest font-bold ${error ? "border-red-400 focus-visible:ring-red-400" : ""}`}
            />
            <button type="button" onClick={() => setShowPin(!showPin)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">
              {showPin ? "Ocultar" : "Ver"}
            </button>
          </div>
          {error && <p className="text-center text-sm font-medium text-red-500">PIN incorrecto</p>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={pin.length < 4}>Ingresar</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Payment Info Tab
// ──────────────────────────────────────────────
function PaymentInfoTab({ eventId, isOrganizer, existingInfo, onSaved }: {
  eventId: string; isOrganizer: boolean;
  existingInfo: EventWithDetails["payment_info"]; onSaved: () => void;
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
    setSaving(false); setEditing(false);
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
          {isOrganizer && <button onClick={() => setEditing(true)} className="text-sm text-indigo-600 hover:underline">Editar</button>}
        </div>
        {existingInfo.account_holder && <InfoRow label="Titular" value={existingInfo.account_holder} />}
        {existingInfo.bank_name && <InfoRow label="Banco" value={existingInfo.bank_name} />}
        {existingInfo.account_type && <InfoRow label="Tipo de cuenta" value={existingInfo.account_type} />}
        {existingInfo.account_number && <InfoRow label="N° de cuenta" value={existingInfo.account_number} />}
        {existingInfo.rut && <InfoRow label="RUT / DNI" value={existingInfo.rut} />}
        {existingInfo.email && <InfoRow label="Email" value={existingInfo.email} />}
        {existingInfo.notes && <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">{existingInfo.notes}</div>}
      </div>
    );
  }

  if (!isOrganizer) return null;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
      <p className="font-semibold text-gray-900">Datos de transferencia</p>
      {[
        { key: "account_holder", label: "Nombre del titular" },
        { key: "bank_name", label: "Banco" },
        { key: "account_type", label: "Tipo de cuenta" },
        { key: "account_number", label: "N° de cuenta" },
        { key: "rut", label: "RUT / DNI / CUIT" },
        { key: "email", label: "Email de transferencia" },
        { key: "notes", label: "Notas adicionales" },
      ].map(({ key, label }) => (
        <div key={key}>
          <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
          <input value={form[key as keyof typeof form]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
      ))}
      <Button onClick={saveInfo} disabled={saving} className="w-full">{saving ? "Guardando..." : "Guardar datos"}</Button>
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
  const colors = { violet: "bg-indigo-50 text-indigo-700", green: "bg-green-50 text-green-700", orange: "bg-amber-50 text-amber-700" };
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
      <div className="text-center"><div className="mb-3 text-4xl animate-bounce">🪣</div><p className="text-gray-500">Cargando colecta...</p></div>
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
        <Link href="/" className="mt-4 inline-block text-indigo-600 hover:underline">← Volver al inicio</Link>
      </div>
    </div>
  );
}
