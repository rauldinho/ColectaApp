"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import QRCode from "react-qr-code";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ColectaLogo } from "@/components/ui/colecta-logo";
import { WOBBLY_RADIUS_MD, WOBBLY_RADIUS_SM } from "@/lib/utils";
import type { EventWithDetails, Participant, Payment } from "@/types/database";
import { CHILE_BANKS, CHILE_ACCOUNT_TYPES } from "@/lib/chile-constants";

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
  const [activeTab, setActiveTab] = useState<"participantes" | "info" | "facturas">("participantes");
  const [shareTab, setShareTab] = useState<"codigo" | "qr" | "email">("codigo");
  const [showShare, setShowShare] = useState(false);

  // Refs para scroll automático
  const tabsCardRef = useRef<HTMLDivElement>(null);
  const joinFormRef = useRef<HTMLDivElement>(null);

  /** Cambia de tab Y hace scroll para que sea visible */
  function goToTab(tab: "participantes" | "info" | "facturas") {
    setActiveTab(tab);
    setTimeout(() => {
      tabsCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }

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

  // Edit event modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editPerPerson, setEditPerPerson] = useState("");
  const [editTotal, setEditTotal] = useState("");

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

  // Auto-scroll al formulario de registro para participantes nuevos
  useEffect(() => {
    if (!loading && !isOrganizer && !myParticipantId) {
      setTimeout(() => {
        joinFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 350);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

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

  // ── Registrar pago (nuevo flujo: participant + payment en un solo paso) ──
  async function registerPayment(
    name: string,
    email: string,
    amount: number,
    file: File | null,
    message: string
  ) {
    if (!event) return;
    const supabase = createClient();

    // Deduplicación por email
    const emailLower = email.trim().toLowerCase();
    const duplicate = event.participants.find(
      (p) => p.email && p.email.trim().toLowerCase() === emailLower
    );
    if (duplicate) {
      toast.error("Ya existe un pago registrado con este correo en esta colecta.");
      return;
    }

    // Crear participante
    const { data: newParticipant, error: partError } = await supabase
      .from("participants")
      .insert({
        event_id: event.id,
        name: name.trim(),
        email: email.trim(),
        amount_owed: amount,
      })
      .select()
      .single();

    if (partError || !newParticipant) {
      toast.error("Error al registrar: " + partError?.message);
      return;
    }

    // Subir comprobante si lo hay
    let receiptUrl: string | null = null;
    if (file) {
      const ext = file.name.split(".").pop();
      const path = `${event.id}/${newParticipant.id}/receipt.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(path, file, { upsert: true });
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(path);
        receiptUrl = urlData.publicUrl;
      }
    }

    // Crear pago
    const { error: payError } = await supabase.from("payments").insert({
      participant_id: newParticipant.id,
      amount,
      status: "pending",
      receipt_url: receiptUrl,
      message: message.trim() || null,
    });

    if (payError) {
      toast.error("Error al registrar el pago: " + payError.message);
      return;
    }

    // Actualizar total del evento si hay cuota fija
    if (event.amount_per_person) {
      const newCount = event.participants.length + 1;
      await supabase.from("events").update({ total_amount: event.amount_per_person * newCount }).eq("id", event.id);
    }

    localStorage.setItem(`colecta_participant_${slug}`, newParticipant.id);
    setMyParticipantId(newParticipant.id);
    toast.success("¡Pago registrado! El organizador lo revisará pronto.");
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

  async function saveEvent(
    name: string, description: string, date: string, perPerson: string, total: string
  ) {
    if (!isOrganizer || !event) return;
    if (!name.trim()) { toast.error("El nombre es requerido"); return; }
    const parsedPerPerson = perPerson ? (Math.round(parseFloat(perPerson)) || null) : null;
    const parsedTotal = total ? (Math.round(parseFloat(total)) || null) : null;
    const supabase = createClient();
    const { error } = await supabase
      .from("events")
      .update({
        name: name.trim(),
        description: description.trim() || null,
        event_date: date || null,
        total_amount: parsedTotal,
        amount_per_person: parsedPerPerson,
        updated_at: new Date().toISOString(),
      })
      .eq("id", event.id);
    if (error) { toast.error("Error al guardar los cambios"); return; }
    // Cascade amount_owed to unconfirmed participants if cuota changed
    if (parsedPerPerson && parsedPerPerson !== event.amount_per_person) {
      const unconfirmed = event.participants.filter(
        (p) => !p.payments?.some((pay) => pay.status === "confirmed")
      );
      await Promise.all(
        unconfirmed.map((p) =>
          supabase.from("participants").update({ amount_owed: parsedPerPerson }).eq("id", p.id)
        )
      );
    }
    toast.success("¡Cambios guardados!");
    setShowEditModal(false);
    await loadEvent();
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
    // Usamos .select() para detectar fallos silenciosos de RLS (Supabase no lanza error si RLS bloquea)
    const { data: deleted, error } = await supabase
      .from("payments")
      .delete()
      .eq("id", confirmedPayment.id)
      .select();
    if (error) { toast.error("Error al deshacer el pago: " + error.message); return; }
    if (!deleted || deleted.length === 0) {
      toast.error("No se pudo deshacer el pago. Verifica los permisos en la base de datos.");
      return;
    }
    toast.success("Pago deshecho");
    await loadEvent();
  }

  async function submitPayment(participantId: string, amount: number, file: File | null, message: string) {
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
      participant_id: participantId,
      amount,
      status: "pending",
      receipt_url: receiptUrl,
      message: message.trim() || null,
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

  const pct = event.total_amount ? Math.round((totalConfirmed / event.total_amount) * 100) : 0;

  // Expected participant count (derived from total_amount / amount_per_person when both set)
  const expectedParticipants = event.total_amount && event.amount_per_person
    ? Math.round(event.total_amount / event.amount_per_person)
    : null;
  const totalParticipants = event.participants.length;
  const participantPct = expectedParticipants && expectedParticipants > 0
    ? Math.min(100, Math.round((confirmedCount / expectedParticipants) * 100))
    : totalParticipants > 0
    ? Math.round((confirmedCount / totalParticipants) * 100)
    : 0;
  const pendingParticipantPct = expectedParticipants && expectedParticipants > 0
    ? Math.min(100 - participantPct, Math.round((pendingCount / expectedParticipants) * 100))
    : totalParticipants > 0
    ? Math.round((pendingCount / totalParticipants) * 100)
    : 0;
  const pendingAmountPct = event.total_amount
    ? Math.min(100 - pct, Math.round(((totalConfirmed + event.participants.reduce((s, p) => {
        const pending = p.payments?.find((pay: Payment) => pay.status === "pending");
        return s + (pending ? p.amount_owed : 0);
      }, 0)) / event.total_amount) * 100) - pct)
    : 0;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b-2 border-foreground bg-background px-4 py-3 shadow-[0px_3px_0px_0px_#2d2d2d]">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <ColectaLogo size={26} />
            <span className="font-display font-bold text-foreground">Colecta</span>
          </Link>
          <div className="flex items-center gap-2">
            {isOrganizer ? (
              <>
                <span
                  className="border-2 border-foreground bg-primary/10 px-3 py-1 text-xs font-bold text-primary shadow-[2px_2px_0px_0px_#2d2d2d]"
                  style={{ borderRadius: WOBBLY_RADIUS_SM }}
                >
                  👑 Organizador
                </span>
                <button
                  onClick={() => {
                    localStorage.removeItem(`colecta_organizer_${slug}`);
                    setIsOrganizer(false);
                    toast.success("Saliste del modo organizador");
                  }}
                  className="border-2 border-foreground bg-primary px-3 py-1.5 text-sm font-bold text-white shadow-[2px_2px_0px_0px_#2d2d2d] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                  style={{ borderRadius: WOBBLY_RADIUS_SM }}
                >
                  Salir
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowPinModal(true)}
                className="border-2 border-foreground bg-background px-3 py-1 text-xs font-bold text-foreground shadow-[2px_2px_0px_0px_#2d2d2d] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                style={{ borderRadius: WOBBLY_RADIUS_SM }}
              >
                🔐 Soy el organizador
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4 space-y-3">

        {/* ── Compact Hero Card ── */}
        <div className="border-2 border-foreground bg-card overflow-hidden shadow-[4px_4px_0px_0px_#2d2d2d]" style={{ borderRadius: WOBBLY_RADIUS_MD }}>

          {/* Row 1: Name + edit */}
          <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
            <div className="min-w-0">
              <h1 className="font-display text-3xl font-bold text-foreground leading-tight truncate">{event.name}</h1>
              <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
                {event.description && <span>{event.description} · </span>}
                📅{" "}
                {event.event_date
                  ? new Date(event.event_date + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })
                  : new Date(event.created_at).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
            {isOrganizer && (
              <button
                onClick={() => {
                  setEditName(event.name);
                  setEditDescription(event.description ?? "");
                  setEditDate(event.event_date ?? "");
                  setEditPerPerson(String(event.amount_per_person ?? ""));
                  setEditTotal(String(event.total_amount ?? ""));
                  setShowEditModal(true);
                }}
                className="shrink-0 border-2 border-foreground bg-background px-2.5 py-1 text-xs font-bold text-muted-foreground shadow-[2px_2px_0px_0px_#2d2d2d] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                style={{ borderRadius: WOBBLY_RADIUS_SM }}
              >
                ✏ Editar
              </button>
            )}
          </div>

          {/* Row 2: Key numbers */}
          <div className="grid grid-cols-3 gap-0 border-t-2 border-foreground">
            {/* Total colecta */}
            <div className="px-4 py-3 border-r-2 border-foreground text-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-primary mb-0.5">Total colecta</p>
              <p className="text-base font-bold text-primary leading-tight">{formatCurrency(event.total_amount ?? 0, event.currency)}</p>
            </div>
            {/* Acumulado */}
            <div className="px-4 py-3 border-r-2 border-foreground text-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-success mb-0.5">Recaudado</p>
              <p className="text-base font-bold text-success leading-tight">{formatCurrency(totalConfirmed, event.currency)}</p>
            </div>
            {/* Por persona */}
            <div className="px-4 py-3 text-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Cuota x persona</p>
              <p className="text-base font-bold text-foreground leading-tight">
                {event.amount_per_person ? formatCurrency(event.amount_per_person, event.currency) : "—"}
              </p>
            </div>
          </div>

          {/* Row 3: Progress + participant count */}
          <div className="px-4 py-3 border-t-2 border-foreground space-y-2">

            {/* Amount progress */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {pendingAmountPct > 0
                    ? <><span className="text-success">{pct}% confirmado</span><span className="text-muted-foreground"> · </span><span className="text-warning">{pendingAmountPct}% pendiente</span></>
                    : <span className={pct > 0 ? "text-success" : "text-muted-foreground"}>{pct}% recaudado</span>
                  }
                </span>
              </div>
              <div className="h-4 w-full border-2 border-foreground bg-white overflow-hidden" style={{ borderRadius: WOBBLY_RADIUS_SM }}>
                <div className="flex h-full">
                  <div className="h-full bg-success transition-all duration-500" style={{ width: `${pct}%` }} />
                  {pendingAmountPct > 0 && (
                    <div className="h-full bg-warning/60 transition-all duration-500" style={{ width: `${pendingAmountPct}%` }} />
                  )}
                </div>
              </div>
            </div>

            {/* Participant count / empty state */}
            {confirmedCount === 0 && pendingCount === 0 ? (
              <div className="flex flex-col items-center justify-center py-3 gap-1.5 text-center">
                <span className="text-3xl">🫙</span>
                <p className="font-display font-bold text-base text-foreground leading-tight">Aún nadie pagó la colecta</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Comparte el código{" "}
                  <span className="font-bold font-mono text-primary">{event.code}</span>{" "}
                  para que los participantes registren sus pagos
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between pt-0.5">
                <div className="flex items-center gap-2">
                  {(() => {
                    const total = expectedParticipants ?? (totalParticipants > 0 ? totalParticipants : null);
                    const dots = total ? Math.min(total, 12) : Math.min(totalParticipants, 12);
                    return (
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: dots }).map((_, i) => {
                          const confirmed = i < confirmedCount;
                          const pending = !confirmed && i < confirmedCount + pendingCount;
                          return (
                            <span
                              key={i}
                              className={`inline-block h-3 w-3 border border-foreground/60 transition-colors ${
                                confirmed ? "bg-success" : pending ? "bg-warning/60" : "bg-secondary"
                              }`}
                              style={{ borderRadius: "3px" }}
                            />
                          );
                        })}
                        {total && total > 12 && <span className="ml-1 text-[10px] text-muted-foreground">+{total - 12}</span>}
                      </div>
                    );
                  })()}
                </div>
                <span className="text-xs font-bold text-foreground">
                  {expectedParticipants
                    ? <>{confirmedCount}{pendingCount > 0 && <span className="text-warning"> +{pendingCount}</span>} <span className="font-normal text-muted-foreground">de</span> {expectedParticipants} pagaron</>
                    : <>{confirmedCount}{pendingCount > 0 && <span className="text-warning"> +{pendingCount}</span>} <span className="font-normal text-muted-foreground">{confirmedCount === 1 ? "pagó" : "pagaron"}</span></>
                  }
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Alerta datos bancarios — solo organizador sin payment_info */}
        {isOrganizer && !event.payment_info && (
          <button
            onClick={() => goToTab("info")}
            className="w-full flex items-start gap-3 border-2 border-foreground bg-warning-bg px-4 py-3.5 text-left shadow-[3px_3px_0px_0px_#2d2d2d] transition-all hover:shadow-[1px_1px_0px_0px_#2d2d2d] hover:translate-x-[2px] hover:translate-y-[2px]"
            style={{ borderRadius: WOBBLY_RADIUS_SM }}
          >
            <span className="text-xl shrink-0">⚠️</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-warning">Agrega tus datos de transferencia</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Los participantes no podrán ver cómo pagarte. Toca aquí para agregar tu cuenta bancaria.
              </p>
            </div>
            <span className="shrink-0 text-warning self-center font-bold">→</span>
          </button>
        )}

        {/* Formulario de registro de pago (solo participantes que aún no registraron) */}
        {!isOrganizer && !hasJoined && (
          <div ref={joinFormRef}>
            <JoinSection
              currency={event.currency}
              amountPerPerson={event.amount_per_person ?? null}
              onRegister={registerPayment}
            />
          </div>
        )}

        {/* Confirmación después de registrar */}
        {!isOrganizer && hasJoined && myParticipantId && (() => {
          const me = event.participants.find((p) => p.id === myParticipantId);
          if (!me) return null;
          const myPayment = me.payments?.[0];
          const isConfirmed = myPayment?.status === "confirmed";
          return (
            <div className={`border-2 border-foreground p-4 shadow-[3px_3px_0px_0px_#2d2d2d] ${isConfirmed ? "bg-success-bg" : "bg-card"}`} style={{ borderRadius: WOBBLY_RADIUS_SM }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Tu pago</p>
                  <p className="font-semibold text-foreground">{me.name}</p>
                  <p className="text-lg font-bold text-foreground mt-0.5">
                    {formatCurrency(myPayment?.amount ?? me.amount_owed, event.currency)}
                  </p>
                  {myPayment?.message && (
                    <p className="mt-1 text-xs text-muted-foreground italic">"{myPayment.message}"</p>
                  )}
                </div>
                <span
                  className={`shrink-0 border-2 border-foreground px-2.5 py-0.5 text-[11px] font-bold shadow-[2px_2px_0px_0px_#2d2d2d] ${
                    isConfirmed ? "bg-success-bg text-success-text" : "bg-warning-bg text-warning-text"
                  }`}
                  style={{ borderRadius: WOBBLY_RADIUS_SM }}
                >
                  {isConfirmed ? "✓ Confirmado" : "⏳ Pendiente"}
                </span>
              </div>
              {!isConfirmed && (
                <p className="mt-3 text-xs text-muted-foreground">
                  El organizador revisará tu pago y lo confirmará en breve.
                </p>
              )}
            </div>
          );
        })()}

        {/* Compartir colecta — tabbed + collapsible */}
        <div className="border-2 border-foreground bg-card overflow-hidden shadow-[4px_4px_0px_0px_#2d2d2d]" style={{ borderRadius: WOBBLY_RADIUS_MD }}>

          {/* Toggle header */}
          <button
            type="button"
            onClick={() => setShowShare((v) => !v)}
            className="w-full flex items-center justify-between px-5 pt-4 pb-4 transition-colors hover:bg-secondary/40"
          >
            <span className="text-sm font-display font-bold text-foreground">📤 Comparte la colecta</span>
            <span
              className={`flex h-6 w-6 items-center justify-center border-2 border-foreground bg-background text-foreground shadow-[2px_2px_0px_0px_#2d2d2d] transition-transform duration-200 ${showShare ? "rotate-180" : ""}`}
              style={{ borderRadius: WOBBLY_RADIUS_SM }}
            >
              <svg width="10" height="7" viewBox="0 0 10 7" fill="none" aria-hidden>
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
          </button>

          {/* Collapsible body */}
          {showShare && (
            <div className="border-t-2 border-foreground pt-4">
          {/* Sub-tabs */}
          <div className="flex gap-1 mx-5 mb-4 border-2 border-foreground bg-secondary p-1" style={{ borderRadius: WOBBLY_RADIUS_SM }}>
            {(["codigo", "qr", "email"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setShareTab(t)}
                className={`flex-1 py-1.5 text-xs font-bold transition-all ${
                  shareTab === t
                    ? "border-2 border-foreground bg-card text-foreground shadow-[2px_2px_0px_0px_#2d2d2d]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                style={shareTab === t ? { borderRadius: WOBBLY_RADIUS_SM } : undefined}
              >
                {t === "codigo" ? "🔑 Código" : t === "qr" ? "📲 QR" : "✉️ Email"}
              </button>
            ))}
          </div>

          <div className="px-5 pb-5">
            {/* Tab: Código */}
            {shareTab === "codigo" && (
              <div className="space-y-3">
                {/* Code tile — light, Cupertino style */}
                <div
                  className="flex items-center justify-between border-2 border-foreground bg-secondary px-5 py-4 cursor-pointer shadow-[3px_3px_0px_0px_#2d2d2d] transition-all hover:shadow-[1px_1px_0px_0px_#2d2d2d] hover:translate-x-[2px] hover:translate-y-[2px]"
                  style={{ borderRadius: WOBBLY_RADIUS_SM }}
                  onClick={copyCode}
                >
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                      Código de acceso · toca para copiar
                    </p>
                    <p className="text-3xl font-bold tracking-[6px] text-foreground font-mono leading-none">
                      {event.code}
                    </p>
                  </div>
                  <Button
                    onClick={(e) => { e.stopPropagation(); copyLink(); }}
                    className="shrink-0 z-10"
                  >
                    {copied ? "✓ Copiado" : "Copiar link"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Comparte el código o el link directo para que los participantes se unan.
                </p>
              </div>
            )}

            {/* Tab: QR */}
            {shareTab === "qr" && (
              <div className="flex flex-col items-center gap-3">
                <div className="border-2 border-foreground bg-white p-4 shadow-[3px_3px_0px_0px_#2d2d2d]" style={{ borderRadius: WOBBLY_RADIUS_SM }}>
                  <QRCode value={joinUrl} size={180} />
                </div>
                <p className="text-sm font-bold tracking-wider text-primary">{event.code}</p>
                <p className="text-xs text-muted-foreground text-center break-all max-w-xs">{joinUrl}</p>
              </div>
            )}

            {/* Tab: Email */}
            {shareTab === "email" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Escribe el email del participante y se abrirá tu app de correo con el mensaje listo para enviar.
                </p>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="flex-1 h-10 text-sm"
                  />
                  <a
                    href={inviteEmail.trim() ? `mailto:${inviteEmail}?subject=${inviteSubject}&body=${inviteBody}` : "#"}
                    onClick={(e) => { if (!inviteEmail.trim()) e.preventDefault(); }}
                    className={`inline-flex items-center border-2 border-foreground px-4 py-2 text-sm font-bold shadow-[2px_2px_0px_0px_#2d2d2d] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] ${
                      inviteEmail.trim()
                        ? "bg-primary text-white"
                        : "bg-secondary text-muted-foreground/70 cursor-not-allowed"
                    }`}
                    style={{ borderRadius: WOBBLY_RADIUS_SM }}
                  >
                    Enviar
                  </a>
                </div>
                <button
                  onClick={copyInviteText}
                  className="w-full border-2 border-foreground bg-primary py-2.5 text-sm font-bold text-white shadow-[3px_3px_0px_0px_#2d2d2d] transition-all hover:shadow-[1px_1px_0px_0px_#2d2d2d] hover:translate-x-[2px] hover:translate-y-[2px]"
                  style={{ borderRadius: WOBBLY_RADIUS_SM }}
                >
                  📋 Copiar texto de invitación
                </button>
              </div>
            )}
          </div>
            </div>
          )}
        </div>

        {/* Tabs + contenido — una sola card */}
        <div ref={tabsCardRef} className="border-2 border-foreground bg-card overflow-hidden shadow-[4px_4px_0px_0px_#2d2d2d]" style={{ borderRadius: WOBBLY_RADIUS_MD }}>

          {/* Barra de tabs */}
          <div className="flex border-2 border-foreground bg-secondary p-1 gap-1 m-3" style={{ borderRadius: WOBBLY_RADIUS_SM }}>
            {(["participantes", "info", "facturas"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-xs font-bold transition-all ${
                  activeTab === tab
                    ? "border-2 border-foreground bg-card text-foreground shadow-[2px_2px_0px_0px_#2d2d2d]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                style={activeTab === tab ? { borderRadius: WOBBLY_RADIUS_SM } : undefined}
              >
                {tab === "participantes"
                  ? `👥 Participantes${pendingCount > 0 && isOrganizer ? ` (${pendingCount})` : ""}`
                  : tab === "info" ? "💳 Pago"
                  : "📄 Facturas"}
              </button>
            ))}
          </div>

          {/* Tab: Participantes */}
          {activeTab === "participantes" && (
            <div className="p-3 space-y-2">
              {/* Organizer: summary button */}
              {isOrganizer && event.participants.length > 0 && (
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowSummary(true)}
                    className="flex items-center gap-1.5 border-2 border-foreground bg-card px-3 py-1.5 text-xs font-bold text-muted-foreground shadow-[2px_2px_0px_0px_#2d2d2d] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                    style={{ borderRadius: WOBBLY_RADIUS_SM }}
                  >
                    📊 Generar resumen
                  </button>
                </div>
              )}
              {event.participants.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-4xl mb-3">👥</p>
                  <p className="font-medium text-foreground">Aún no hay participantes</p>
                  <p className="mt-1 text-sm text-muted-foreground/70">
                    Comparte el código <span className="font-mono font-bold text-primary">{event.code}</span> para que se unan
                  </p>
                  {event.amount_per_person ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Cada participante pagará{" "}
                      <span className="font-semibold text-primary">{formatCurrency(event.amount_per_person, event.currency)}</span>
                    </p>
                  ) : event.total_amount ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {formatCurrency(event.total_amount, event.currency)} se dividirá automáticamente entre todos
                    </p>
                  ) : null}
                  {isOrganizer && (
                    <button
                      onClick={copyLink}
                      className="mt-4 inline-flex items-center gap-2 border-2 border-foreground px-5 py-2.5 text-sm font-bold text-white bg-primary shadow-[3px_3px_0px_0px_#2d2d2d] transition-all hover:shadow-[1px_1px_0px_0px_#2d2d2d] hover:translate-x-[2px] hover:translate-y-[2px]"
                    style={{ borderRadius: WOBBLY_RADIUS_SM }}
                    >
                      Comparte ahora →
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {event.participants.length > 1 && (
                    <div className="border-2 border-foreground bg-secondary px-4 py-2.5 flex justify-between items-center" style={{ borderRadius: WOBBLY_RADIUS_SM }}>
                      <span className="text-sm text-primary">
                        {event.participants.length} participante{event.participants.length !== 1 ? "s" : ""}
                      </span>
                      <span className="text-sm font-bold text-primary">
                        {formatCurrency(perPerson, event.currency)} c/u
                      </span>
                    </div>
                  )}
                  {event.participants.map((participant) =>
                    isOrganizer ? (
                      <ParticipantCard
                        key={participant.id}
                        participant={participant}
                        currency={event.currency}
                        isOrganizer={true}
                        isMe={false}
                        onConfirmDirect={confirmDirect}
                        onUndo={undoPayment}
                        onReject={rejectPayment}
                        onSubmitPayment={submitPayment}
                      />
                    ) : (
                      <PaymentRow
                        key={participant.id}
                        participant={participant}
                        currency={event.currency}
                        isMe={participant.id === myParticipantId}
                      />
                    )
                  )}
                </>
              )}
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
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-foreground">Facturas y comprobantes</p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">Documentos del evento subidos por el organizador</p>
              </div>
              {isOrganizer && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => orgDocRef.current?.click()}
                    disabled={uploadingDoc}
                    className="rounded-full"
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
              <div className="py-6 text-center text-sm text-muted-foreground/70">Cargando...</div>
            ) : orgDocs.length === 0 ? (
              <div className="border-2 border-dashed border-foreground/40 bg-secondary p-8 text-center" style={{ borderRadius: WOBBLY_RADIUS_SM }}>
                <p className="text-3xl mb-2">📄</p>
                <p className="text-sm text-muted-foreground">
                  {isOrganizer
                    ? "Sube las facturas o comprobantes del evento para que todos los participantes puedan verlos."
                    : "El organizador aún no subió facturas del evento."}
                </p>
                {isOrganizer && (
                  <button
                    onClick={() => orgDocRef.current?.click()}
                    className="mt-3 text-sm text-primary font-medium hover:underline"
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
                    <div key={doc.name} className="border-2 border-foreground bg-secondary overflow-hidden shadow-[2px_2px_0px_0px_#2d2d2d]" style={{ borderRadius: WOBBLY_RADIUS_SM }}>
                      {isImage && (
                        <a href={doc.url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={doc.url}
                            alt="Factura"
                            className="w-full max-h-64 object-contain bg-card border-b border-border"
                          />
                        </a>
                      )}
                      <div className="flex items-center justify-between px-3 py-2.5">
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-foreground hover:text-primary truncate"
                        >
                          <span>{isPdf ? "📄" : isImage ? "🖼️" : "📎"}</span>
                          <span className="truncate max-w-xs">{doc.originalName}</span>
                        </a>
                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center border-2 border-foreground bg-secondary px-3 py-1.5 text-xs font-bold text-primary shadow-[2px_2px_0px_0px_#2d2d2d] transition-all hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]"
                            style={{ borderRadius: WOBBLY_RADIUS_SM }}
                          >
                            Ver
                          </a>
                          {isOrganizer && (
                            <button
                              onClick={() => deleteOrgDoc(doc.name)}
                              className="inline-flex items-center border-2 border-foreground bg-red-50 px-3 py-1.5 text-xs font-bold text-red-500 shadow-[2px_2px_0px_0px_#2d2d2d] transition-all hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]"
                            style={{ borderRadius: WOBBLY_RADIUS_SM }}
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

        </div>{/* /tabs wrapper card */}
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

      {showEditModal && (
        <EditModal
          initialName={editName}
          initialDescription={editDescription}
          initialDate={editDate}
          initialPerPerson={editPerPerson}
          initialTotal={editTotal}
          onSave={saveEvent}
          onClose={() => setShowEditModal(false)}
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4">
      <div className="w-full sm:max-w-lg border-2 border-foreground bg-card shadow-[6px_6px_0px_0px_#2d2d2d]" style={{ borderRadius: WOBBLY_RADIUS_MD }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-foreground px-5 py-4">
          <div>
            <h3 className="font-display font-bold text-foreground">📊 Resumen de pagos</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Listo para copiar y pegar en WhatsApp</p>
          </div>
          <button onClick={onClose} className="border-2 border-foreground p-1.5 text-foreground shadow-[2px_2px_0px_0px_#2d2d2d] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]" style={{ borderRadius: WOBBLY_RADIUS_SM }}>
            ✕
          </button>
        </div>

        {/* Preview */}
        <div className="px-5 py-4">
          <div className="border-2 border-foreground bg-secondary p-4 max-h-72 overflow-y-auto" style={{ borderRadius: WOBBLY_RADIUS_SM }}>
            <pre className="whitespace-pre-wrap text-sm text-foreground font-sans leading-relaxed">
              {summaryText}
            </pre>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 border-t-2 border-foreground px-5 py-4">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cerrar
          </Button>
          <Button
            className={`flex-1 transition ${copied ? "bg-success" : ""}`}
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
// Payment Row — Vista simplificada para participantes
// ──────────────────────────────────────────────
function PaymentRow({
  participant,
  currency,
  isMe,
}: {
  participant: Participant & { payments: Payment[] };
  currency: string;
  isMe: boolean;
}) {
  const payment = participant.payments?.[0];
  const isConfirmed = payment?.status === "confirmed";
  const isPending = payment?.status === "pending";

  return (
    <div className={`flex items-center gap-3 px-4 py-3 border-b-2 border-dashed border-foreground/20 last:border-0 ${
      isMe ? "bg-primary/5" : "bg-card"
    }`}>
      {/* Avatar inicial */}
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-foreground text-sm font-bold ${
        isConfirmed ? "bg-primary/10 text-primary"
        : isPending  ? "bg-warning-bg text-warning"
        : "bg-secondary text-muted-foreground"
      }`}>
        {participant.name.charAt(0).toUpperCase()}
      </div>
      {/* Nombre */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground truncate">
          {participant.name}
          {isMe && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(tú)</span>}
        </p>
        {payment && (
          <p className="text-xs text-muted-foreground">
            {formatCurrency(payment.amount, currency)}
          </p>
        )}
      </div>
      {/* Status badge */}
      <span
        className={`shrink-0 border-2 border-foreground px-2.5 py-0.5 text-[11px] font-bold shadow-[2px_2px_0px_0px_#2d2d2d] ${
          isConfirmed ? "bg-success-bg text-success-text"
          : isPending  ? "bg-warning-bg text-warning-text"
          : "bg-secondary text-muted-foreground"
        }`}
        style={{ borderRadius: WOBBLY_RADIUS_SM }}
      >
        {isConfirmed ? "✓ Confirmado" : isPending ? "⏳ Pendiente" : "Sin pago"}
      </span>
    </div>
  );
}

// ──────────────────────────────────────────────
// Join Section — Registro de pago en un solo paso
// ──────────────────────────────────────────────
function JoinSection({
  currency,
  amountPerPerson,
  onRegister,
}: {
  currency: string;
  amountPerPerson: number | null;
  onRegister: (name: string, email: string, amount: number, file: File | null, message: string) => Promise<void>;
}) {
  const defaultAmount = amountPerPerson ?? 0;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState(defaultAmount > 0 ? String(defaultAmount) : "");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const parsedAmount = parseFloat(amount) || 0;
  const canSubmit = name.trim() && email.trim() && parsedAmount > 0 && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    // Validar email básico
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Ingresa un email válido");
      return;
    }
    setSubmitting(true);
    await onRegister(name, email, Math.round(parsedAmount), file, message);
    setSubmitting(false);
  }

  return (
    <div className="border-2 border-foreground bg-card overflow-hidden shadow-[4px_4px_0px_0px_#2d2d2d]" style={{ borderRadius: WOBBLY_RADIUS_MD }}>
      {/* Header con cuota */}
      {defaultAmount > 0 && (
        <div className="border-b-2 border-foreground bg-secondary px-5 py-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
            Cuota por persona
          </p>
          <p className="text-3xl font-bold text-foreground tracking-tight">
            {formatCurrency(defaultAmount, currency)}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <p className="text-sm font-semibold text-foreground">Registra tu pago</p>

        {/* Nombre */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tu nombre *
          </label>
          <Input
            placeholder="Ej: María González"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Email *
          </label>
          <Input
            type="email"
            placeholder="tu@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground/70">
            Solo para evitar duplicados, no se muestra públicamente.
          </p>
        </div>

        {/* Monto */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Monto que transferiste *
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
              $
            </span>
            <Input
              type="number"
              min="1"
              placeholder={defaultAmount > 0 ? String(defaultAmount) : "0"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="pl-7 font-bold"
            />
          </div>
        </div>

        {/* Comprobante */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Comprobante de pago
          </label>
          {file ? (
            <div className="flex items-center justify-between border-2 border-foreground bg-secondary px-3 py-2.5" style={{ borderRadius: WOBBLY_RADIUS_SM }}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base">{file.type.startsWith("image/") ? "🖼" : "📄"}</span>
                <span className="truncate text-xs font-medium text-foreground">{file.name}</span>
              </div>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="ml-2 shrink-0 text-muted-foreground hover:text-foreground transition text-xs"
              >
                ✕ Quitar
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center gap-2 border-2 border-dashed border-foreground/40 bg-secondary px-4 py-4 text-center hover:bg-secondary/70 transition" style={{ borderRadius: WOBBLY_RADIUS_SM }}>
              <span className="text-xl">📎</span>
              <span className="text-xs font-medium text-muted-foreground">
                Adjuntar imagen o PDF <span className="text-muted-foreground/50">(opcional)</span>
              </span>
              <input
                type="file"
                accept="image/*,.pdf"
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          )}
        </div>

        {/* Mensaje */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Mensaje <span className="font-normal normal-case text-muted-foreground/60">(opcional)</span>
          </label>
          <textarea
            placeholder="Ej: Pagué ayer a las 3pm..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            className="w-full resize-none border-2 border-foreground bg-white px-3 py-2 text-sm text-foreground placeholder:text-foreground/35 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors duration-100"
            style={{ borderRadius: WOBBLY_RADIUS_SM }}
          />
        </div>

        <Button
          type="submit"
          className="w-full text-sm font-bold"
          disabled={!canSubmit}
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Registrando...
            </span>
          ) : (
            `Registrar pago · ${parsedAmount > 0 ? formatCurrency(Math.round(parsedAmount), currency) : currency}`
          )}
        </Button>
      </form>
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
  onSubmitPayment: (id: string, amount: number, file: File | null, message: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [useCustomAmount, setUseCustomAmount] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const expandedFormRef = useRef<HTMLDivElement>(null);

  // Scroll al formulario cuando se expande
  useEffect(() => {
    if (expanded && expandedFormRef.current) {
      setTimeout(() => {
        expandedFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
  }, [expanded]);

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
    setPaymentMessage("");
    setUseCustomAmount(false);
    setCustomAmount("");
  }, [isPaid, isPending]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit() {
    const finalAmount = useCustomAmount && customAmount
      ? parseFloat(customAmount)
      : participant.amount_owed;
    if (!finalAmount || finalAmount <= 0) return;
    setSubmitting(true);
    await onSubmitPayment(participant.id, finalAmount, selectedFile, paymentMessage);
    setSubmitting(false);
    setExpanded(false);
    setSelectedFile(null);
    setPreview(null);
    setPaymentMessage("");
    setUseCustomAmount(false);
    setCustomAmount("");
  }

  // Iniciales del nombre
  const initials = participant.name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();

  return (
    <div
      className={`border-2 border-foreground shadow-[3px_3px_0px_0px_#2d2d2d] ${
        isPaid ? "bg-success-bg/40"
        : isPending ? "bg-warning-bg/40"
        : isMe ? "bg-secondary"
        : "bg-card"
      }`}
      style={{ borderRadius: WOBBLY_RADIUS_SM }}
    >
      {/* Fila principal del participante */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        {/* Avatar con iniciales */}
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-foreground text-sm font-bold ${
          isPaid ? "bg-primary/10 text-primary"
          : isPending ? "bg-warning-bg text-warning"
          : isMe ? "bg-primary/10 text-primary"
          : "bg-secondary text-muted-foreground"
        }`}>
          {isPaid ? "✓" : isPending ? "⏳" : initials}
        </div>

        {/* Nombre + monto */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate font-semibold text-foreground text-sm">{participant.name}</p>
            {isMe && !isOrganizer && (
              <span className="shrink-0 border-2 border-foreground bg-secondary px-2 py-0.5 text-xs font-bold text-primary shadow-[1px_1px_0px_0px_#2d2d2d]" style={{ borderRadius: WOBBLY_RADIUS_SM }}>
                Tú
              </span>
            )}
          </div>
          {/* Monto: muestra lo que pagó realmente si difiere de la cuota asignada */}
          {(() => {
            const activePayment = confirmedPayment ?? pendingPayment ?? null;
            const displayAmount = activePayment ? activePayment.amount : participant.amount_owed;
            const differsFromOwed = activePayment && activePayment.amount !== participant.amount_owed;
            return (
              <div>
                <p className={`text-sm font-bold ${
                  isPaid ? "text-success"
                  : isPending ? "text-warning"
                  : "text-muted-foreground"
                }`}>
                  {formatCurrency(displayAmount, currency)}
                </p>
                {differsFromOwed && (
                  <p className="text-[11px] text-muted-foreground/60 leading-tight">
                    cuota: {formatCurrency(participant.amount_owed, currency)}
                  </p>
                )}
              </div>
            );
          })()}
        </div>

        {/* Acciones */}
        <div className="flex shrink-0 items-center gap-1.5">
          {isOrganizer ? (
            <>
              {isPaid ? (
                <button
                  onClick={() => onUndo(participant.id)}
                  className="border-2 border-foreground bg-card px-3 py-1.5 text-xs font-bold text-muted-foreground shadow-[2px_2px_0px_0px_#2d2d2d] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                  style={{ borderRadius: WOBBLY_RADIUS_SM }}
                >
                  Deshacer
                </button>
              ) : isPending ? (
                <>
                  <button
                    onClick={() => onConfirmDirect(participant.id, participant.amount_owed)}
                    className="border-2 border-foreground bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-[2px_2px_0px_0px_#2d2d2d] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                    style={{ borderRadius: WOBBLY_RADIUS_SM }}
                  >
                    Aprobar ✓
                  </button>
                  <button
                    onClick={() => onReject(pendingPayment!.id)}
                    className="border-2 border-foreground bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 shadow-[2px_2px_0px_0px_#2d2d2d] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                    style={{ borderRadius: WOBBLY_RADIUS_SM }}
                  >
                    Rechazar
                  </button>
                </>
              ) : (
                <button
                  onClick={() => onConfirmDirect(participant.id, participant.amount_owed)}
                  className="border-2 border-foreground bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-[2px_2px_0px_0px_#2d2d2d] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                  style={{ borderRadius: WOBBLY_RADIUS_SM }}
                >
                  Confirmar ✓
                </button>
              )}
            </>
          ) : (
            <>
              {isPaid ? (
                <span className="border-2 border-foreground bg-success-bg px-3 py-1 text-xs font-bold text-success-text shadow-[2px_2px_0px_0px_#2d2d2d]" style={{ borderRadius: WOBBLY_RADIUS_SM }}>
                  Pagado ✓
                </span>
              ) : isPending ? (
                <span className="border-2 border-foreground bg-warning-bg px-3 py-1 text-xs font-bold text-warning-text shadow-[2px_2px_0px_0px_#2d2d2d]" style={{ borderRadius: WOBBLY_RADIUS_SM }}>
                  ⏳ Esperando
                </span>
              ) : isMe ? (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="border-2 border-foreground bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-[2px_2px_0px_0px_#2d2d2d] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                  style={{ borderRadius: WOBBLY_RADIUS_SM }}
                >
                  Ya pagué
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Organizer: mensaje del participante en pago pendiente */}
      {isOrganizer && isPending && (pendingPayment as Payment & { message?: string | null })?.message && (
        <div className="border-t-2 border-dashed border-warning/30 px-4 pb-3 pt-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-warning mb-1">
            💬 Mensaje del participante
          </p>
          <p className="text-sm text-foreground bg-warning-bg border-2 border-foreground/20 px-3 py-2" style={{ borderRadius: WOBBLY_RADIUS_SM }}>
            {(pendingPayment as Payment & { message?: string | null })?.message}
          </p>
        </div>
      )}

      {/* Organizer: comprobante en pago pendiente */}
      {isOrganizer && isPending && pendingPayment?.receipt_url && (
        <div className="border-t-2 border-dashed border-warning/30 px-4 pb-4 pt-3">
          <p className="mb-2 text-xs font-medium text-warning">📎 Comprobante del participante:</p>
          <a href={pendingPayment.receipt_url} target="_blank" rel="noopener noreferrer">
            <img
              src={pendingPayment.receipt_url}
              alt="Comprobante"
              className="max-h-48 w-full object-contain border-2 border-foreground/20 bg-card"
            />
          </a>
        </div>
      )}
      {isOrganizer && isPending && !pendingPayment?.receipt_url && !(pendingPayment as Payment & { message?: string | null })?.message && (
        <div className="border-t-2 border-dashed border-warning/30 px-4 pb-3 pt-2">
          <p className="text-xs text-warning">
            El participante declaró que pagó (sin comprobante adjunto)
          </p>
        </div>
      )}

      {/* Organizer: recibo en pago confirmado */}
      {isOrganizer && isPaid && confirmedPayment?.receipt_url && (
        <div className="border-t-2 border-dashed border-foreground/20 px-4 pb-3 pt-2">
          <button
            onClick={() => setShowReceipt(!showReceipt)}
            className="text-xs text-primary hover:underline"
          >
            {showReceipt ? "▲ Ocultar recibo" : "▼ Ver recibo de pago"}
          </button>
          {showReceipt && (
            <div className="mt-2">
              <a href={confirmedPayment.receipt_url} target="_blank" rel="noopener noreferrer">
                <img
                  src={confirmedPayment.receipt_url}
                  alt="Comprobante confirmado"
                  className="max-h-48 w-full object-contain border-2 border-foreground/20 bg-card"
                />
              </a>
            </div>
          )}
        </div>
      )}

      {/* Participant: formulario "Ya pagué" */}
      {isMe && !isOrganizer && !isPaid && !isPending && expanded && (
        <div ref={expandedFormRef} className="border-t-2 border-foreground bg-secondary px-4 pb-4 pt-3 space-y-3">
          {/* Comprobante */}
          <div>
            <p className="text-sm font-bold text-foreground mb-2">Adjunta tu comprobante (opcional)</p>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center border-2 border-dashed border-foreground/40 bg-card p-4 hover:bg-secondary transition"
              style={{ borderRadius: WOBBLY_RADIUS_SM }}
            >
              {preview ? (
                <img src={preview} alt="Preview" className="max-h-40 rounded-lg object-contain" />
              ) : (
                <>
                  <span className="text-2xl mb-1">📸</span>
                  <p className="text-sm text-muted-foreground">Toca para subir foto</p>
                  <p className="text-xs text-muted-foreground/70">JPG, PNG o PDF</p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
            {selectedFile && (
              <p className="mt-1 text-xs text-muted-foreground truncate">📎 {selectedFile.name}</p>
            )}
          </div>

          {/* Toggle: pagué otro monto */}
          <div className="border-2 border-foreground bg-card overflow-hidden shadow-[2px_2px_0px_0px_#2d2d2d]" style={{ borderRadius: WOBBLY_RADIUS_SM }}>
            <label className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-secondary transition">
              <div>
                <p className="text-sm font-medium text-foreground">Pagué un monto diferente</p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">
                  {useCustomAmount
                    ? "Ingresa el monto exacto que transferiste"
                    : `Tu cuota asignada: ${formatCurrency(participant.amount_owed, currency)}`}
                </p>
              </div>
              <div className="relative shrink-0 ml-3">
                <input
                  type="checkbox"
                  checked={useCustomAmount}
                  onChange={(e) => {
                    setUseCustomAmount(e.target.checked);
                    if (!e.target.checked) setCustomAmount("");
                  }}
                  className="sr-only"
                />
                <div className={`h-6 w-11 rounded-full transition-colors ${useCustomAmount ? "bg-primary" : "bg-muted-foreground/30"}`} />
                <div className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${useCustomAmount ? "translate-x-6" : "translate-x-1"}`} />
              </div>
            </label>
            {useCustomAmount && (
              <div className="border-t-2 border-dashed border-foreground/20 px-4 pb-3 pt-2.5">
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Monto que pagaste
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder={`Ej: ${participant.amount_owed}`}
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  autoFocus
                  className="w-full border-2 border-foreground bg-white px-3 py-2.5 text-base font-bold text-foreground placeholder:text-foreground/35 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors"
                  style={{ borderRadius: WOBBLY_RADIUS_SM }}
                />
                {customAmount && parseFloat(customAmount) > 0 && (
                  <p className="mt-1.5 text-xs text-primary font-medium">
                    💡 El organizador verá que pagaste {formatCurrency(parseFloat(customAmount), currency)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Mensaje opcional */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Mensaje para el organizador{" "}
              <span className="text-muted-foreground/60 font-normal">(opcional)</span>
            </label>
            <textarea
              value={paymentMessage}
              onChange={(e) => setPaymentMessage(e.target.value)}
              placeholder="Ej: Transferí el jueves a las 14:00 desde Banco Estado"
              rows={2}
              maxLength={300}
              className="w-full resize-none border-2 border-foreground bg-white px-3 py-2 text-sm text-foreground placeholder:text-foreground/35 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors"
              style={{ borderRadius: WOBBLY_RADIUS_SM }}
            />
          </div>

          {/* Botones */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                setExpanded(false);
                setSelectedFile(null);
                setPreview(null);
                setPaymentMessage("");
                setUseCustomAmount(false);
                setCustomAmount("");
              }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={handleSubmit}
              disabled={submitting || (useCustomAmount && (!customAmount || parseFloat(customAmount) <= 0))}
            >
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div
        className="w-full max-w-sm border-2 border-foreground bg-card overflow-hidden shadow-[6px_6px_0px_0px_#2d2d2d]"
        style={{ borderRadius: WOBBLY_RADIUS_MD }}
      >
        {/* Header stripe */}
        <div className="flex items-center justify-between border-b-2 border-foreground bg-secondary px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center bg-primary text-base shadow-[2px_2px_0px_0px_#2d2d2d]"
              style={{ borderRadius: "50% 40% 60% 30% / 40% 50% 30% 60%" }}
            >
              🔐
            </span>
            <div>
              <h3 className="font-display text-base font-bold text-foreground leading-tight">Acceso de organizador</h3>
              <p className="text-xs text-muted-foreground leading-snug">Ingresa el PIN que creaste</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="border-2 border-foreground bg-background p-1.5 text-sm font-bold text-foreground shadow-[2px_2px_0px_0px_#2d2d2d] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
            style={{ borderRadius: WOBBLY_RADIUS_SM }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleVerify} className="space-y-4 p-5" autoComplete="off">
          <div className="relative">
            <Input
              type="text"
              inputMode="numeric"
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
              autoFocus
              autoComplete="off"
              name="colecta-pin-verify"
              style={showPin ? {} : { WebkitTextSecurity: "disc" } as React.CSSProperties}
              className={`text-center text-2xl tracking-widest font-bold ${error ? "border-primary ring-2 ring-primary/20" : ""}`}
            />
            <button type="button" onClick={() => setShowPin(!showPin)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground/70 hover:text-muted-foreground">
              {showPin ? "Ocultar" : "Ver"}
            </button>
          </div>
          {error && (
            <p className="flex items-center gap-1.5 justify-center text-sm font-bold text-primary">
              <span>⚠</span> PIN incorrecto
            </p>
          )}
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
// Edit Event Modal
// ──────────────────────────────────────────────
function EditModal({
  initialName, initialDescription, initialDate, initialPerPerson, initialTotal,
  onSave, onClose,
}: {
  initialName: string; initialDescription: string; initialDate: string;
  initialPerPerson: string; initialTotal: string;
  onSave: (name: string, description: string, date: string, perPerson: string, total: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [date, setDate] = useState(initialDate);
  const [perPerson, setPerPerson] = useState(initialPerPerson);
  const [total, setTotal] = useState(initialTotal);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave(name, description, date, perPerson, total);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div
        className="w-full max-w-sm border-2 border-foreground bg-card overflow-hidden shadow-[6px_6px_0px_0px_#2d2d2d]"
        style={{ borderRadius: WOBBLY_RADIUS_MD }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-foreground bg-secondary px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center bg-primary text-base shadow-[2px_2px_0px_0px_#2d2d2d]"
              style={{ borderRadius: "50% 40% 60% 30% / 40% 50% 30% 60%" }}
            >
              ✏️
            </span>
            <h3 className="font-display text-base font-bold text-foreground">Editar colecta</h3>
          </div>
          <button
            onClick={onClose}
            className="border-2 border-foreground bg-background p-1.5 text-sm font-bold text-foreground shadow-[2px_2px_0px_0px_#2d2d2d] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
            style={{ borderRadius: WOBBLY_RADIUS_SM }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
          <div className="space-y-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Nombre *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Descripción</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Fecha del evento</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Cuota x persona</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">$</span>
                <Input
                  type="text" inputMode="numeric"
                  value={perPerson}
                  onChange={(e) => setPerPerson(e.target.value.replace(/\D/g, ""))}
                  className="pl-7 font-bold" placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Total colecta</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">$</span>
                <Input
                  type="text" inputMode="numeric"
                  value={total}
                  onChange={(e) => setTotal(e.target.value.replace(/\D/g, ""))}
                  className="pl-7 font-bold" placeholder="0"
                />
              </div>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Chilean banks & account types (imported from shared lib)
// ──────────────────────────────────────────────
export { CHILE_BANKS, CHILE_ACCOUNT_TYPES } from "@/lib/chile-constants";

const selectCls = `flex h-10 w-full border-2 border-foreground bg-white px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 transition-colors`;

// ──────────────────────────────────────────────
// Payment Info Tab
// ──────────────────────────────────────────────
function PaymentInfoTab({ eventId, isOrganizer, existingInfo, onSaved }: {
  eventId: string; isOrganizer: boolean;
  existingInfo: EventWithDetails["payment_info"]; onSaved: () => void;
}) {
  const [editing, setEditing] = useState(!existingInfo);
  const [saving, setSaving] = useState(false);
  const [copiedInfo, setCopiedInfo] = useState(false);

  // Detect if saved value is a custom (not in list) bank or type
  const savedBank = existingInfo?.bank_name ?? "";
  const savedType = existingInfo?.account_type ?? "";
  const initBankSel = CHILE_BANKS.includes(savedBank as typeof CHILE_BANKS[number]) ? savedBank : savedBank ? "otro" : "";
  const initTypeSel = CHILE_ACCOUNT_TYPES.includes(savedType as typeof CHILE_ACCOUNT_TYPES[number]) ? savedType : savedType ? "otro" : "";

  const [bankSel, setBankSel] = useState(initBankSel);
  const [bankCustom, setBankCustom] = useState(initBankSel === "otro" ? savedBank : "");
  const [typeSel, setTypeSel] = useState(initTypeSel);
  const [typeCustom, setTypeCustom] = useState(initTypeSel === "otro" ? savedType : "");

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
      <div className="p-8 text-center">
        <p className="text-4xl mb-3">💳</p>
        <p className="text-muted-foreground text-sm">El organizador aún no cargó los datos de transferencia.</p>
      </div>
    );
  }

  function copyTransferData() {
    if (!existingInfo) return;
    const lines: string[] = [];
    if (existingInfo.rut) lines.push(existingInfo.rut.replace(/\./g, ""));
    if (existingInfo.account_holder) lines.push(existingInfo.account_holder);
    if (existingInfo.bank_name) lines.push(existingInfo.bank_name);
    if (existingInfo.account_type) lines.push(existingInfo.account_type);
    if (existingInfo.account_number) lines.push(existingInfo.account_number);
    if (existingInfo.email) lines.push(existingInfo.email);
    if (existingInfo.notes) lines.push(existingInfo.notes);
    navigator.clipboard.writeText(lines.join("\n"));
    setCopiedInfo(true);
    setTimeout(() => setCopiedInfo(false), 2500);
  }

  if (!editing && existingInfo) {
    return (
      <div className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-foreground">Datos de transferencia</p>
          <div className="flex items-center gap-2">
            <button
              onClick={copyTransferData}
              className={`border-2 border-foreground px-3 py-1.5 text-xs font-bold shadow-[2px_2px_0px_0px_#2d2d2d] transition-all hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] ${
                copiedInfo ? "bg-success-bg text-success-text" : "bg-secondary text-primary"
              }`}
              style={{ borderRadius: WOBBLY_RADIUS_SM }}
            >
              {copiedInfo ? "✓ Copiado" : "📋 Copiar datos"}
            </button>
            {isOrganizer && (
              <button onClick={() => setEditing(true)} className="text-sm font-bold text-accent hover:underline underline-offset-4">
                Editar
              </button>
            )}
          </div>
        </div>
        {existingInfo.account_holder && <InfoRow label="Titular" value={existingInfo.account_holder} />}
        {existingInfo.bank_name && <InfoRow label="Banco" value={existingInfo.bank_name} />}
        {existingInfo.account_type && <InfoRow label="Tipo de cuenta" value={existingInfo.account_type} />}
        {existingInfo.account_number && <InfoRow label="N° de cuenta" value={existingInfo.account_number} />}
        {existingInfo.rut && <InfoRow label="RUT / DNI" value={existingInfo.rut} />}
        {existingInfo.email && <InfoRow label="Email" value={existingInfo.email} />}
        {existingInfo.notes && (
          <div className="border-2 border-foreground bg-secondary p-3 text-sm text-muted-foreground" style={{ borderRadius: WOBBLY_RADIUS_SM }}>{existingInfo.notes}</div>
        )}
      </div>
    );
  }

  if (!isOrganizer) return null;

  return (
    <div className="p-5 space-y-4">
      <p className="font-semibold text-foreground">Datos de transferencia</p>

      {/* Titular */}
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nombre del titular</label>
        <input value={form.account_holder} onChange={(e) => setForm({ ...form, account_holder: e.target.value })}
          placeholder="Ej: Juan Pérez" className={selectCls} style={{ borderRadius: WOBBLY_RADIUS_SM }} />
      </div>

      {/* Banco */}
      <div className="space-y-2">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Banco</label>
        <select
          value={bankSel}
          onChange={(e) => {
            setBankSel(e.target.value);
            if (e.target.value !== "otro") {
              setBankCustom("");
              setForm({ ...form, bank_name: e.target.value });
            } else {
              setForm({ ...form, bank_name: bankCustom });
            }
          }}
          className={selectCls} style={{ borderRadius: WOBBLY_RADIUS_SM }}
        >
          <option value="">Selecciona un banco...</option>
          {CHILE_BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
          <option value="otro">Otro (escribir)</option>
        </select>
        {bankSel === "otro" && (
          <input
            autoFocus
            value={bankCustom}
            onChange={(e) => { setBankCustom(e.target.value); setForm({ ...form, bank_name: e.target.value }); }}
            placeholder="Escribe el nombre del banco..."
            className={selectCls} style={{ borderRadius: WOBBLY_RADIUS_SM }}
          />
        )}
      </div>

      {/* Tipo de cuenta */}
      <div className="space-y-2">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tipo de cuenta</label>
        <select
          value={typeSel}
          onChange={(e) => {
            setTypeSel(e.target.value);
            if (e.target.value !== "otro") {
              setTypeCustom("");
              setForm({ ...form, account_type: e.target.value });
            } else {
              setForm({ ...form, account_type: typeCustom });
            }
          }}
          className={selectCls} style={{ borderRadius: WOBBLY_RADIUS_SM }}
        >
          <option value="">Selecciona un tipo...</option>
          {CHILE_ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          <option value="otro">Otro (escribir)</option>
        </select>
        {typeSel === "otro" && (
          <input
            value={typeCustom}
            onChange={(e) => { setTypeCustom(e.target.value); setForm({ ...form, account_type: e.target.value }); }}
            placeholder="Escribe el tipo de cuenta..."
            className={selectCls} style={{ borderRadius: WOBBLY_RADIUS_SM }}
          />
        )}
      </div>

      {/* N° de cuenta */}
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">N° de cuenta</label>
        <input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })}
          placeholder="Ej: 00123456789" className={selectCls} style={{ borderRadius: WOBBLY_RADIUS_SM }} />
      </div>

      {/* RUT */}
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">RUT</label>
        <input value={form.rut} onChange={(e) => setForm({ ...form, rut: e.target.value })}
          placeholder="Ej: 12.345.678-9" className={selectCls} style={{ borderRadius: WOBBLY_RADIUS_SM }} />
      </div>

      {/* Email */}
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email de transferencia</label>
        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="correo@ejemplo.com" className={selectCls} style={{ borderRadius: WOBBLY_RADIUS_SM }} />
      </div>

      {/* Notas */}
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notas adicionales</label>
        <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Ej: Transferir hasta el viernes" className={selectCls} style={{ borderRadius: WOBBLY_RADIUS_SM }} />
      </div>

      <Button onClick={saveInfo} disabled={saving} className="w-full">{saving ? "Guardando..." : "Guardar datos"}</Button>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b-2 border-dashed border-foreground/20 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-bold text-foreground">{value}</span>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: "violet" | "green" | "orange" }) {
  const colors = { violet: "bg-secondary text-primary", green: "bg-success-bg text-success-text", orange: "bg-warning-bg text-warning-text" };
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
      <div className="flex flex-col items-center gap-3">
        <div className="animate-bounce"><ColectaLogo size={40} /></div>
        <p className="text-sm text-muted-foreground">Cargando colecta...</p>
      </div>
    </div>
  );
}

function NotFoundScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center border-2 border-foreground bg-card px-8 py-10 max-w-sm w-full shadow-[4px_4px_0px_0px_#2d2d2d]" style={{ borderRadius: WOBBLY_RADIUS_MD }}>
        <p className="mb-2 text-5xl">😕</p>
        <h2 className="font-display text-xl font-bold text-foreground">Colecta no encontrada</h2>
        <p className="mt-1 text-muted-foreground text-sm">El link puede haber expirado o ser incorrecto.</p>
        <Link href="/" className="mt-4 inline-block font-bold text-accent hover:underline underline-offset-4 text-sm">← Volver al inicio</Link>
      </div>
    </div>
  );
}
