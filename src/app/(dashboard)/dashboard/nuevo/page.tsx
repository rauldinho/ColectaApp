"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { generateEventCode } from "@/lib/utils";
import { nanoid } from "nanoid";
import { CHILE_BANKS, CHILE_ACCOUNT_TYPES } from "@/lib/chile-constants";
import { ThemeToggle } from "@/components/ui/theme-toggle";

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
  // "person" = cuota por persona como base | "total" = monto total como base
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
      // numPeople is optional — if not provided, per-person stays null
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

    // Insertar datos bancarios opcionales
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

    // Subir facturas si el organizador las adjuntó
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
    <div className="min-h-screen bg-secondary">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Inicio
            </Link>
            <span className="text-border/60">·</span>
            <span className="text-sm font-semibold text-foreground">Nueva colecta</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6 pb-32">
        {/* Page title */}
        <div className="mb-7">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Nueva colecta</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Completa los pasos y comparte el link con tus participantes.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">

          {/* ════════════════════════════════════════
              SECCIÓN 1 — Datos de la colecta
          ════════════════════════════════════════ */}
          <StepCard step={1} title="Datos de la colecta">
            {/* Nombre */}
            <FieldGroup label="Nombre *">
              <Input
                placeholder="Ej: Asado del sábado, Regalo de cumpleaños..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                className="bg-secondary border-0 rounded-xl h-11 px-4 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
              />
            </FieldGroup>

            {/* Descripción */}
            <FieldGroup label="Descripción">
              <Input
                placeholder="Añade un detalle opcional..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-secondary border-0 rounded-xl h-11 px-4 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
              />
            </FieldGroup>

            {/* Fecha */}
            <FieldGroup
              label="Fecha del evento"
              hint={!eventDate ? "Puede ser pasada o futura. Si no se indica, se usará la de hoy." : undefined}
            >
              <Input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="bg-secondary border-0 rounded-xl h-11 px-4 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
              />
            </FieldGroup>
          </StepCard>

          {/* ════════════════════════════════════════
              SECCIÓN 2 — Monto y comprobantes
          ════════════════════════════════════════ */}
          <StepCard step={2} title="Monto a pagar">

            {/* Selector de modo — segmented control */}
            <div className="flex rounded-xl border border-border bg-secondary p-1 gap-1">
              <button
                type="button"
                onClick={() => setAmountMode("person")}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
                  amountMode === "person"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Cuota por persona
              </button>
              <button
                type="button"
                onClick={() => setAmountMode("total")}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
                  amountMode === "total"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Monto total
              </button>
            </div>

            {/* Modo: cuota por persona */}
            {amountMode === "person" && (
              <>
                <FieldGroup label="Cuota por persona *" hint="Cada participante pagará este monto al unirse.">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base font-semibold text-muted-foreground">$</span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={fmtCLP(amountPerPerson)}
                      onChange={(e) => setAmountPerPerson(digitsOnly(e.target.value))}
                      className="bg-secondary border-0 rounded-xl h-12 pl-8 text-lg font-bold tracking-tight focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
                    />
                  </div>
                </FieldGroup>

                <FieldGroup label="Número de personas (opcional)" hint="Si lo indicas, calcularemos el total estimado.">
                  <Input
                    type="number" min="1"
                    placeholder="Ej: 10"
                    value={numPeople}
                    onChange={(e) => setNumPeople(e.target.value)}
                    className="bg-secondary border-0 rounded-xl h-11 px-4 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
                  />
                </FieldGroup>

                {/* Resultado calculado */}
                {parseFloat(amountPerPerson) > 0 && (
                  <div className="rounded-xl bg-primary/[0.08] px-4 py-3 text-sm">
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

            {/* Modo: monto total */}
            {amountMode === "total" && (
              <>
                <FieldGroup label="Monto total de la colecta *" hint="El total general de gastos a cubrir entre todos.">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base font-semibold text-muted-foreground">$</span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={fmtCLP(totalAmount)}
                      onChange={(e) => setTotalAmount(digitsOnly(e.target.value))}
                      className="bg-secondary border-0 rounded-xl h-12 pl-8 text-lg font-bold tracking-tight focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
                    />
                  </div>
                </FieldGroup>

                <FieldGroup label="Número de personas (opcional)" hint="Si lo indicas, calcularemos la cuota individual automáticamente.">
                  <Input
                    type="number" min="1"
                    placeholder="Ej: 10"
                    value={numPeople}
                    onChange={(e) => setNumPeople(e.target.value)}
                    className="bg-secondary border-0 rounded-xl h-11 px-4 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
                  />
                </FieldGroup>

                {/* Resultado calculado */}
                {parseFloat(totalAmount) > 0 && (
                  <div className="rounded-xl bg-primary/[0.08] px-4 py-3 text-sm">
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

            {/* Divisor */}
            <div className="border-t border-border" />

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

            {/* Zona de carga — visible solo si toggle ON */}
            {uploadInvoices && (
              <div className="space-y-2">
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-secondary/50 px-4 py-5 text-center hover:bg-secondary/80 transition">
                  <span className="text-2xl">📎</span>
                  <span className="text-sm font-medium text-foreground">Seleccionar archivos</span>
                  <span className="text-xs text-muted-foreground">Imágenes o PDF · múltiples archivos</span>
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

                {/* Lista de archivos seleccionados */}
                {invoiceFiles.length > 0 && (
                  <ul className="space-y-1">
                    {invoiceFiles.map((file, i) => (
                      <li key={i} className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base">{file.type.startsWith("image/") ? "🖼" : "📄"}</span>
                          <span className="truncate text-xs font-medium text-foreground">{file.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {(file.size / 1024).toFixed(0)} KB
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setInvoiceFiles((prev) => prev.filter((_, idx) => idx !== i))}
                          className="ml-2 shrink-0 text-muted-foreground hover:text-foreground transition"
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

          {/* ════════════════════════════════════════
              SECCIÓN 3 — Datos bancarios (opcional)
          ════════════════════════════════════════ */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {/* Toggle header */}
            <label className="flex cursor-pointer items-center justify-between gap-3 border-b border-border bg-secondary px-4 py-3 hover:bg-secondary/70 transition-colors">
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
                  3
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-foreground leading-tight">Datos de transferencia</h2>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Opcional
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                    {showBankInfo
                      ? "Se guardarán al crear la colecta."
                      : "¿Dónde deben pagarte? Puedes agregarlo después."}
                  </p>
                </div>
              </div>
              {/* Switch */}
              <div className="relative shrink-0">
                <input
                  type="checkbox"
                  checked={showBankInfo}
                  onChange={(e) => setShowBankInfo(e.target.checked)}
                  className="sr-only"
                />
                <div className={`h-5 w-9 rounded-full transition-colors ${showBankInfo ? "bg-primary" : "bg-muted-foreground/25"}`} />
                <div className={`absolute top-0.5 h-4 w-4 rounded-full shadow transition-transform ${showBankInfo ? "translate-x-4 bg-white" : "translate-x-0.5 bg-white"}`} />
              </div>
            </label>

            {/* Campos — solo cuando toggle ON */}
            {showBankInfo && (
              <div className="border-t border-border px-4 py-4 space-y-4">
                <FieldGroup label="Nombre del titular">
                  <input
                    value={bankHolder}
                    onChange={(e) => setBankHolder(e.target.value)}
                    placeholder="Ej: Juan Pérez"
                    className={fieldCls}
                  />
                </FieldGroup>

                <FieldGroup label="Banco">
                  <div className="space-y-2">
                    <select
                      value={bankSel}
                      onChange={(e) => { setBankSel(e.target.value); if (e.target.value !== "otro") setBankCustom(""); }}
                      className={fieldCls}
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
                    />
                  </FieldGroup>
                  <FieldGroup label="RUT">
                    <input
                      value={bankRut}
                      onChange={(e) => setBankRut(e.target.value)}
                      placeholder="12.345.678-9"
                      className={fieldCls}
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
                  />
                </FieldGroup>
              </div>
            )}

            {/* Hint cuando está colapsado */}
            {!showBankInfo && (
              <div className="border-t border-border/50 px-4 py-2.5">
                <p className="text-xs text-muted-foreground/70">
                  💡 Si no los agregas ahora, podrás hacerlo después desde la pantalla de tu colecta.
                </p>
              </div>
            )}
          </div>

          {/* ════════════════════════════════════════
              SECCIÓN 4 — PIN del organizador
          ════════════════════════════════════════ */}
          <StepCard step={4} title="PIN del organizador">
            <p className="text-xs text-muted-foreground -mt-1 mb-1">
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
                    style={showPin ? {} : { WebkitTextSecurity: "disc" } as React.CSSProperties}
                    className="bg-secondary border-0 rounded-xl h-11 px-4 text-center tracking-widest font-bold text-base pr-14 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/70 hover:text-muted-foreground"
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
                    style={showPin ? {} : { WebkitTextSecurity: "disc" } as React.CSSProperties}
                    className={`bg-secondary border-0 rounded-xl h-11 px-4 text-center tracking-widest font-bold text-base focus-visible:ring-2 focus-visible:ring-offset-0 ${
                      pinMismatch
                        ? "border border-destructive focus-visible:ring-destructive"
                        : pinMatch
                        ? "border border-success focus-visible:ring-success"
                        : ""
                    }`}
                  />
                  {pinMatch && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-success font-medium">✓</span>
                  )}
                </div>
              </FieldGroup>
            </div>

            {pinMismatch && (
              <p className="flex items-center gap-1 text-xs text-destructive font-medium">
                <span>⚠</span> Los PINs no coinciden
              </p>
            )}
            {pinMatch && adminPin.length >= 4 && (
              <p className="flex items-center gap-1 text-xs text-success font-medium">
                <span>✓</span> PINs coinciden
              </p>
            )}
          </StepCard>

        </form>
      </main>

      {/* CTA fijo al fondo */}
      <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg gap-3 px-4 py-3">
          <Link href="/" className="flex-none">
            <Button
              variant="outline"
              className="h-11 rounded-full px-5 text-sm border border-border bg-background text-foreground"
              type="button"
            >
              Cancelar
            </Button>
          </Link>
          <Button
            type="submit"
            className="flex-1 h-11 rounded-full text-sm font-semibold bg-primary text-white"
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

/* ─── Estilos de campos ──────────────────────────────────── */
const fieldCls =
  "flex h-11 w-full rounded-xl border-0 bg-secondary px-4 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors placeholder:text-muted-foreground";

/* ─── Componentes reutilizables ─────────────────────────── */

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
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header de la sección */}
      <div className="flex items-center gap-3 border-b border-border bg-secondary px-4 py-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
          {step}
        </span>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      {/* Contenido */}
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
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-xs text-muted-foreground/70 leading-relaxed">{hint}</p>
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
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 hover:bg-secondary/60 transition-colors">
      {/* Switch */}
      <div className="relative shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className={`h-5 w-9 rounded-full transition-colors ${
            checked ? "bg-primary" : "bg-muted-foreground/25"
          }`}
        />
        <div
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </div>
      {/* Texto */}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground leading-tight">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>
      </div>
    </label>
  );
}
