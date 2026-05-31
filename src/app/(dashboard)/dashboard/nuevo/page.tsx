"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { generateEventCode, WOBBLY_RADIUS_MD, WOBBLY_RADIUS_SM } from "@/lib/utils";
import { nanoid } from "nanoid";
import { CHILE_BANKS, CHILE_ACCOUNT_TYPES } from "@/lib/chile-constants";

/** Formatea dígitos como número chileno: "20000" → "20.000" */
function fmtCLP(raw: string): string {
  if (!raw) return "";
  const n = parseInt(raw, 10);
  return isNaN(n) ? "" : n.toLocaleString("es-CL");
}

/** Extrae solo los dígitos de un string */
function digitsOnly(val: string): string {
  return val.replace(/\D/g, "");
}

export default function NuevoEventoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Sección 1 — Datos
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");

  // Sección 2 — Monto
  const currency = "CLP";
  const [amountMode, setAmountMode] = useState<"person" | "total">("person");
  const [amountPerPerson, setAmountPerPerson] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [numPeople, setNumPeople] = useState("");

  // Facturas / documentos
  const [uploadInvoices, setUploadInvoices] = useState(false);
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);

  // Sección 3 — PIN
  const [adminPin, setAdminPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);

  // Sección 4 — Datos bancarios (opcional)
  const [showBankInfo, setShowBankInfo] = useState(false);
  const [bankSel, setBankSel] = useState("");
  const [bankCustom, setBankCustom] = useState("");
  const [typeSel, setTypeSel] = useState("");
  const [typeCustom, setTypeCustom] = useState("");
  const [bankHolder, setBankHolder] = useState("");
  const [bankNumber, setBankNumber] = useState("");
  const [bankRut, setBankRut] = useState("");
  const [bankEmail, setBankEmail] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) { toast.error("El nombre es requerido"); return; }

    const n = parseFloat(numPeople) || null;

    let parsedPerPerson: number;
    let parsedTotal: number | null;

    if (amountMode === "person") {
      parsedPerPerson = parseFloat(amountPerPerson) || 0;
      if (parsedPerPerson <= 0) { toast.error("La cuota por persona debe ser mayor a 0"); return; }
      parsedTotal = n && n > 0 ? Math.round(parsedPerPerson * n) : null;
    } else {
      parsedTotal = parseFloat(totalAmount) || 0;
      if (parsedTotal <= 0) { toast.error("El monto total debe ser mayor a 0"); return; }
      parsedPerPerson = n && n > 0 ? Math.round(parsedTotal / n) : 0;
    }
    if (adminPin.length < 4) { toast.error("El PIN debe tener al menos 4 dígitos"); return; }
    if (adminPin !== confirmPin) { toast.error("Los PINs no coinciden"); return; }

    setLoading(true);
    const supabase = createClient();

    const slug = `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${nanoid(6)}`;
    const code = generateEventCode();

    const { data: event, error: eventError } = await supabase
      .from("events")
      .insert({
        slug, code, admin_pin: adminPin,
        name: name.trim(),
        description: description.trim() || null,
        event_date: eventDate || null,
        total_amount: parsedTotal,
        amount_per_person: parsedPerPerson > 0 ? parsedPerPerson : null,
        currency,
      })
      .select()
      .single();

    if (eventError || !event) {
      toast.error("Error al crear la colecta: " + eventError?.message);
      setLoading(false);
      return;
    }

    localStorage.setItem(`colecta_organizer_${event.slug}`, "true");

    if (showBankInfo) {
      const bankName = bankSel === "otro" ? bankCustom.trim() : bankSel;
      const accountType = typeSel === "otro" ? typeCustom.trim() : typeSel;
      const hasAnyData = bankHolder || bankName || accountType || bankNumber || bankRut || bankEmail;
      if (hasAnyData) {
        await supabase.from("payment_info").insert({
          event_id: event.id,
          account_holder: bankHolder.trim() || null,
          bank_name: bankName || null,
          account_type: accountType || null,
          account_number: bankNumber.trim() || null,
          rut: bankRut.trim() || null,
          email: bankEmail.trim() || null,
          notes: null,
        });
      }
    }

    if (uploadInvoices && invoiceFiles.length > 0) {
      const uploadPromises = invoiceFiles.map(async (file) => {
        const ext = file.name.split(".").pop();
        const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const path = `${event.id}/organizer/${safeName}`;
        await supabase.storage.from("receipts").upload(path, file, { upsert: false });
      });
      await Promise.all(uploadPromises);
    }

    toast.success("¡Colecta creada! Comparte el link con los participantes.");
    router.push(`/evento/${event.slug}`);
  }

  const pinMatch = confirmPin.length > 0 && adminPin === confirmPin;
  const pinMismatch = confirmPin.length > 0 && adminPin !== confirmPin;

  return (
    <div className="min-h-screen">
      {/* Header — pencil border */}
      <header className="sticky top-0 z-10 border-b-2 border-foreground bg-background px-4 py-3 shadow-[0px_3px_0px_0px_#2d2d2d]">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-base font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Inicio
            </Link>
            <span className="text-foreground/30">·</span>
            <span className="font-display text-base font-bold text-foreground">Nueva colecta</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6 pb-32">
        {/* Page title */}
        <div className="mb-7">
          <h1 className="text-3xl font-bold text-foreground">Nueva colecta</h1>
          <p className="mt-1 text-base text-muted-foreground">
            Completa los pasos y comparte el link con tus participantes.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ════ SECCIÓN 1 — Datos ════ */}
          <StepCard step={1} title="Datos de la colecta">
            <FieldGroup label="Nombre *">
              <Input
                placeholder="Ej: Asado del sábado, Regalo de cumpleaños..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </FieldGroup>

            <FieldGroup label="Descripción">
              <Input
                placeholder="Añade un detalle opcional..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </FieldGroup>

            <FieldGroup
              label="Fecha del evento"
              hint={!eventDate ? "Puede ser pasada o futura. Si no se indica, se usará la de hoy." : undefined}
            >
              <Input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </FieldGroup>
          </StepCard>

          {/* ════ SECCIÓN 2 — Monto ════ */}
          <StepCard step={2} title="Monto a pagar">

            {/* Mode toggle — hand-drawn segmented control */}
            <div
              className="flex border-2 border-foreground bg-secondary p-1 gap-1"
              style={{ borderRadius: WOBBLY_RADIUS_MD }}
            >
              <button
                type="button"
                onClick={() => setAmountMode("person")}
                className="flex-1 px-3 py-2 text-sm font-bold transition-all"
                style={{
                  borderRadius: WOBBLY_RADIUS_SM,
                  background: amountMode === "person" ? "white" : "transparent",
                  color: amountMode === "person" ? "#2d2d2d" : undefined,
                  boxShadow: amountMode === "person" ? "2px 2px 0px 0px #2d2d2d" : "none",
                  border: amountMode === "person" ? "2px solid #2d2d2d" : "2px solid transparent",
                }}
              >
                Cuota por persona
              </button>
              <button
                type="button"
                onClick={() => setAmountMode("total")}
                className="flex-1 px-3 py-2 text-sm font-bold transition-all"
                style={{
                  borderRadius: WOBBLY_RADIUS_SM,
                  background: amountMode === "total" ? "white" : "transparent",
                  color: amountMode === "total" ? "#2d2d2d" : undefined,
                  boxShadow: amountMode === "total" ? "2px 2px 0px 0px #2d2d2d" : "none",
                  border: amountMode === "total" ? "2px solid #2d2d2d" : "2px solid transparent",
                }}
              >
                Monto total
              </button>
            </div>

            {amountMode === "person" && (
              <>
                <FieldGroup label="Cuota por persona *" hint="Cada participante pagará este monto al unirse.">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base font-bold text-muted-foreground">$</span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={fmtCLP(amountPerPerson)}
                      onChange={(e) => setAmountPerPerson(digitsOnly(e.target.value))}
                      className="pl-8 text-xl font-bold"
                    />
                  </div>
                </FieldGroup>

                <FieldGroup label="Número de personas (opcional)" hint="Si lo indicas, calcularemos el total estimado.">
                  <Input
                    type="number" min="1"
                    placeholder="Ej: 10"
                    value={numPeople}
                    onChange={(e) => setNumPeople(e.target.value)}
                  />
                </FieldGroup>

                {parseFloat(amountPerPerson) > 0 && (
                  <div
                    className="border-2 border-foreground/30 bg-primary/10 px-4 py-3 text-sm"
                    style={{ borderRadius: WOBBLY_RADIUS_SM }}
                  >
                    <p className="text-muted-foreground">
                      Cuota: <span className="font-bold text-foreground">{currency} {parseFloat(amountPerPerson).toLocaleString("es-CL")}</span> por persona
                    </p>
                    {parseFloat(numPeople) > 0 && (
                      <p className="mt-0.5 text-muted-foreground">
                        Total estimado: <span className="font-bold text-foreground">
                          {currency} {(parseFloat(amountPerPerson) * parseFloat(numPeople)).toLocaleString("es-CL")}
                        </span>
                        <span className="ml-1">para {parseFloat(numPeople)} personas</span>
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            {amountMode === "total" && (
              <>
                <FieldGroup label="Monto total de la colecta *" hint="El total general de gastos a cubrir entre todos.">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base font-bold text-muted-foreground">$</span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={fmtCLP(totalAmount)}
                      onChange={(e) => setTotalAmount(digitsOnly(e.target.value))}
                      className="pl-8 text-xl font-bold"
                    />
                  </div>
                </FieldGroup>

                <FieldGroup label="Número de personas (opcional)" hint="Si lo indicas, calcularemos la cuota individual automáticamente.">
                  <Input
                    type="number" min="1"
                    placeholder="Ej: 10"
                    value={numPeople}
                    onChange={(e) => setNumPeople(e.target.value)}
                  />
                </FieldGroup>

                {parseFloat(totalAmount) > 0 && (
                  <div
                    className="border-2 border-foreground/30 bg-primary/10 px-4 py-3 text-sm"
                    style={{ borderRadius: WOBBLY_RADIUS_SM }}
                  >
                    <p className="text-muted-foreground">
                      Total: <span className="font-bold text-foreground">{currency} {parseFloat(totalAmount).toLocaleString("es-CL")}</span>
                    </p>
                    {parseFloat(numPeople) > 0 && (
                      <p className="mt-0.5 text-muted-foreground">
                        Cuota por persona: <span className="font-bold text-foreground">
                          {currency} {Math.round(parseFloat(totalAmount) / parseFloat(numPeople)).toLocaleString("es-CL")}
                        </span>
                        <span className="ml-1">para {parseFloat(numPeople)} personas</span>
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Dashed divider */}
            <div className="border-t-2 border-dashed border-foreground/20" />

            {/* Toggle facturas */}
            <Toggle
              label="Adjuntar facturas o documentos"
              description={
                uploadInvoices
                  ? "Los archivos se subirán al crear la colecta."
                  : "Podrás subirlos desde la pantalla de la colecta después."
              }
              checked={uploadInvoices}
              onChange={(v) => { setUploadInvoices(v); if (!v) setInvoiceFiles([]); }}
            />

            {uploadInvoices && (
              <div className="space-y-2">
                <label
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 border-[3px] border-dashed border-foreground/40 bg-white px-4 py-5 text-center hover:border-foreground/70 transition-colors"
                  style={{ borderRadius: WOBBLY_RADIUS_MD }}
                >
                  <span className="text-2xl">📎</span>
                  <span className="text-base font-bold text-foreground">Seleccionar archivos</span>
                  <span className="text-sm text-muted-foreground">Imágenes o PDF · múltiples archivos</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    className="sr-only"
                    onChange={(e) => {
                      const newFiles = Array.from(e.target.files ?? []);
                      setInvoiceFiles((prev) => {
                        const existing = new Set(prev.map((f) => f.name));
                        return [...prev, ...newFiles.filter((f) => !existing.has(f.name))];
                      });
                      e.target.value = "";
                    }}
                  />
                </label>

                {invoiceFiles.length > 0 && (
                  <ul className="space-y-1.5">
                    {invoiceFiles.map((file, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between border-2 border-foreground bg-card px-3 py-2 shadow-[2px_2px_0px_0px_#2d2d2d]"
                        style={{ borderRadius: WOBBLY_RADIUS_SM }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base">{file.type.startsWith("image/") ? "🖼" : "📄"}</span>
                          <span className="truncate text-sm font-bold text-foreground">{file.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {(file.size / 1024).toFixed(0)} KB
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setInvoiceFiles((prev) => prev.filter((_, idx) => idx !== i))}
                          className="ml-2 shrink-0 font-bold text-muted-foreground hover:text-primary transition"
                          aria-label="Eliminar"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </StepCard>

          {/* ════ SECCIÓN 3 — Datos bancarios (opcional) ════ */}
          <div
            className="border-2 border-foreground bg-card overflow-hidden shadow-[3px_3px_0px_0px_rgba(45,45,45,0.15)]"
            style={{ borderRadius: WOBBLY_RADIUS_MD }}
          >
            {/* Toggle header */}
            <label className="flex cursor-pointer items-center justify-between gap-3 border-b-2 border-foreground bg-secondary px-4 py-3 hover:bg-secondary/70 transition-colors">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center bg-primary text-sm font-bold text-white shadow-[2px_2px_0px_0px_#2d2d2d]"
                  style={{ borderRadius: "50% 40% 60% 30% / 40% 50% 30% 60%" }}
                >
                  3
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-base font-bold text-foreground leading-tight">Datos de transferencia</h2>
                    <span
                      className="border border-foreground/30 bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground"
                      style={{ borderRadius: WOBBLY_RADIUS_SM }}
                    >
                      Opcional
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5 leading-snug">
                    {showBankInfo
                      ? "Se guardarán al crear la colecta."
                      : "¿Dónde deben pagarte? Puedes agregarlo después."}
                  </p>
                </div>
              </div>
              {/* Hand-drawn toggle switch */}
              <div className="relative shrink-0">
                <input
                  type="checkbox"
                  checked={showBankInfo}
                  onChange={(e) => setShowBankInfo(e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={`h-6 w-10 border-2 border-foreground transition-colors ${showBankInfo ? "bg-primary" : "bg-secondary"}`}
                  style={{ borderRadius: "9999px" }}
                />
                <div
                  className={`absolute top-0.5 h-5 w-5 border-2 border-foreground bg-white shadow-[1px_1px_0px_0px_#2d2d2d] transition-transform ${showBankInfo ? "translate-x-[18px]" : "translate-x-[1px]"}`}
                  style={{ borderRadius: "50%" }}
                />
              </div>
            </label>

            {showBankInfo && (
              <div className="border-t-2 border-foreground px-4 py-4 space-y-4">
                <FieldGroup label="Nombre del titular">
                  <input
                    value={bankHolder}
                    onChange={(e) => setBankHolder(e.target.value)}
                    placeholder="Ej: Juan Pérez"
                    className={fieldCls}
                    style={{ borderRadius: WOBBLY_RADIUS_SM }}
                  />
                </FieldGroup>

                <FieldGroup label="Banco">
                  <div className="space-y-2">
                    <select
                      value={bankSel}
                      onChange={(e) => { setBankSel(e.target.value); if (e.target.value !== "otro") setBankCustom(""); }}
                      className={fieldCls}
                      style={{ borderRadius: WOBBLY_RADIUS_SM }}
                    >
                      <option value="">Selecciona un banco...</option>
                      {CHILE_BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                      <option value="otro">Otro (escribir)</option>
                    </select>
                    {bankSel === "otro" && (
                      <input
                        autoFocus
                        value={bankCustom}
                        onChange={(e) => setBankCustom(e.target.value)}
                        placeholder="Nombre del banco"
                        className={fieldCls}
                        style={{ borderRadius: WOBBLY_RADIUS_SM }}
                      />
                    )}
                  </div>
                </FieldGroup>

                <FieldGroup label="Tipo de cuenta">
                  <div className="space-y-2">
                    <select
                      value={typeSel}
                      onChange={(e) => { setTypeSel(e.target.value); if (e.target.value !== "otro") setTypeCustom(""); }}
                      className={fieldCls}
                      style={{ borderRadius: WOBBLY_RADIUS_SM }}
                    >
                      <option value="">Selecciona un tipo...</option>
                      {CHILE_ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      <option value="otro">Otro (escribir)</option>
                    </select>
                    {typeSel === "otro" && (
                      <input
                        value={typeCustom}
                        onChange={(e) => setTypeCustom(e.target.value)}
                        placeholder="Tipo de cuenta"
                        className={fieldCls}
                        style={{ borderRadius: WOBBLY_RADIUS_SM }}
                      />
                    )}
                  </div>
                </FieldGroup>

                <div className="grid grid-cols-2 gap-3">
                  <FieldGroup label="N° de cuenta">
                    <input
                      value={bankNumber}
                      onChange={(e) => setBankNumber(e.target.value)}
                      placeholder="00123456789"
                      className={fieldCls}
                      style={{ borderRadius: WOBBLY_RADIUS_SM }}
                    />
                  </FieldGroup>
                  <FieldGroup label="RUT">
                    <input
                      value={bankRut}
                      onChange={(e) => setBankRut(e.target.value)}
                      placeholder="12.345.678-9"
                      className={fieldCls}
                      style={{ borderRadius: WOBBLY_RADIUS_SM }}
                    />
                  </FieldGroup>
                </div>

                <FieldGroup label="Email de transferencia">
                  <input
                    type="email"
                    value={bankEmail}
                    onChange={(e) => setBankEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className={fieldCls}
                    style={{ borderRadius: WOBBLY_RADIUS_SM }}
                  />
                </FieldGroup>
              </div>
            )}

            {!showBankInfo && (
              <div className="border-t border-dashed border-foreground/20 px-4 py-2.5">
                <p className="text-sm text-muted-foreground">
                  💡 Si no los agregas ahora, podrás hacerlo después desde la pantalla de tu colecta.
                </p>
              </div>
            )}
          </div>

          {/* ════ SECCIÓN 4 — PIN ════ */}
          <StepCard step={4} title="PIN del organizador">
            <p className="text-sm text-muted-foreground -mt-1 mb-1">
              Te permite gestionar la colecta desde cualquier dispositivo. Solo tú lo sabes.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <FieldGroup label="PIN (mín. 4 dígitos) *">
                <div className="relative">
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="••••"
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    required
                    maxLength={8}
                    autoComplete="off"
                    name="colecta-pin"
                    style={showPin ? { borderRadius: WOBBLY_RADIUS_SM } : { WebkitTextSecurity: "disc", borderRadius: WOBBLY_RADIUS_SM } as React.CSSProperties}
                    className="text-center tracking-widest font-bold text-lg pr-14"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground/70 hover:text-muted-foreground"
                  >
                    {showPin ? "Ocultar" : "Ver"}
                  </button>
                </div>
              </FieldGroup>

              <FieldGroup label="Confirmar PIN *">
                <div className="relative">
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="••••"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    required
                    maxLength={8}
                    autoComplete="off"
                    name="colecta-pin-confirm"
                    style={showPin
                      ? { borderRadius: WOBBLY_RADIUS_SM }
                      : { WebkitTextSecurity: "disc", borderRadius: WOBBLY_RADIUS_SM } as React.CSSProperties
                    }
                    className={`text-center tracking-widest font-bold text-lg ${
                      pinMismatch ? "border-primary" : pinMatch ? "border-accent" : ""
                    }`}
                  />
                  {pinMatch && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[hsl(var(--success))]">✓</span>
                  )}
                </div>
              </FieldGroup>
            </div>

            {pinMismatch && (
              <p className="flex items-center gap-1 text-sm font-bold text-primary">
                <span>⚠</span> Los PINs no coinciden
              </p>
            )}
            {pinMatch && adminPin.length >= 4 && (
              <p className="flex items-center gap-1 text-sm font-bold text-[hsl(var(--success-text))]">
                <span>✓</span> PINs coinciden
              </p>
            )}
          </StepCard>

        </form>
      </main>

      {/* CTA fijo */}
      <div className="fixed bottom-0 left-0 right-0 z-10 border-t-2 border-foreground bg-background px-4 py-3 shadow-[0px_-3px_0px_0px_#2d2d2d]">
        <div className="mx-auto flex max-w-lg gap-3 px-4 py-0">
          <Link href="/" className="flex-none">
            <Button
              variant="outline"
              className="h-12 px-5 text-base"
              type="button"
            >
              Cancelar
            </Button>
          </Link>
          <Button
            type="submit"
            className="flex-1 h-12 text-base font-bold"
            disabled={loading}
            onClick={handleSubmit}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Creando...
              </span>
            ) : (
              "Crear colecta →"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Field base styles ─────────────────────────────────────────────────── */
const fieldCls =
  "flex h-12 w-full border-2 border-foreground bg-white px-4 py-2.5 font-sans text-base text-foreground placeholder:text-foreground/35 focus-visible:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors";

/* ─── Reusable components ───────────────────────────────────────────────── */

function StepCard({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="border-2 border-foreground bg-card overflow-hidden shadow-[3px_3px_0px_0px_rgba(45,45,45,0.15)]"
      style={{ borderRadius: WOBBLY_RADIUS_MD }}
    >
      {/* Section header */}
      <div className="flex items-center gap-3 border-b-2 border-foreground bg-secondary px-4 py-3">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center bg-primary text-sm font-bold text-white shadow-[2px_2px_0px_0px_#2d2d2d]"
          style={{ borderRadius: "50% 40% 60% 30% / 40% 50% 30% 60%" }}
        >
          {step}
        </span>
        <h2 className="font-display text-base font-bold text-foreground">{title}</h2>
      </div>
      {/* Content */}
      <div className="px-4 py-4 space-y-4">
        {children}
      </div>
    </div>
  );
}

function FieldGroup({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-sm text-muted-foreground leading-relaxed">{hint}</p>
      )}
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className="flex cursor-pointer items-center gap-3 border-2 border-foreground bg-card px-3 py-3 hover:bg-secondary/60 transition-colors shadow-[2px_2px_0px_0px_rgba(45,45,45,0.12)]"
      style={{ borderRadius: WOBBLY_RADIUS_SM }}
    >
      {/* Hand-drawn toggle switch */}
      <div className="relative shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className={`h-6 w-10 border-2 border-foreground transition-colors ${checked ? "bg-primary" : "bg-secondary"}`}
          style={{ borderRadius: "9999px" }}
        />
        <div
          className={`absolute top-0.5 h-5 w-5 border-2 border-foreground bg-white shadow-[1px_1px_0px_0px_#2d2d2d] transition-transform ${checked ? "translate-x-[18px]" : "translate-x-[1px]"}`}
          style={{ borderRadius: "50%" }}
        />
      </div>
      {/* Text */}
      <div className="min-w-0">
        <p className="font-display text-base font-bold text-foreground leading-tight">{label}</p>
        <p className="text-sm text-muted-foreground mt-0.5 leading-snug">{description}</p>
      </div>
    </label>
  );
}
