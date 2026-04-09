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

export default function NuevoEventoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [currency, setCurrency] = useState("CLP");
  const [eventDate, setEventDate] = useState("");
  const [adminPin, setAdminPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);

  // Cuota fija por participante
  const [fixedPerPerson, setFixedPerPerson] = useState(false);
  const [amountPerPerson, setAmountPerPerson] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) { toast.error("El nombre es requerido"); return; }

    const parsedTotal = parseFloat(totalAmount) || 0;
    const parsedPerPerson = parseFloat(amountPerPerson) || 0;

    if (fixedPerPerson && parsedPerPerson <= 0) {
      toast.error("La cuota por participante debe ser mayor a 0"); return;
    }
    if (!fixedPerPerson && parsedTotal <= 0) {
      toast.error("El monto total debe ser mayor a 0"); return;
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
        slug,
        code,
        admin_pin: adminPin,
        name: name.trim(),
        description: description.trim() || null,
        event_date: eventDate || null,
        total_amount: fixedPerPerson ? null : parsedTotal,
        amount_per_person: fixedPerPerson ? parsedPerPerson : null,
        currency,
      })
      .select()
      .single();

    if (eventError || !event) {
      toast.error("Error al crear la colecta: " + eventError?.message);
      setLoading(false);
      return;
    }

    // Marcar como organizador en localStorage
    localStorage.setItem(`colecta_organizer_${event.slug}`, "true");

    toast.success("¡Colecta creada! Comparte el link con los participantes.");
    router.push(`/evento/${event.slug}`);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">← Inicio</Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium text-gray-900">Nueva colecta</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Nueva colecta 🪣</h1>
          <p className="text-sm text-gray-500">Completa los datos y comparte el link o QR con tus participantes.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Datos básicos */}
          <Section title="¿Para qué es la colecta?">
            <FormField label="Nombre *">
              <Input placeholder="Ej: Asado del sábado, Viaje a Mendoza..." value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </FormField>
            <FormField label="Descripción (opcional)">
              <Input placeholder="Agrega un detalle..." value={description} onChange={(e) => setDescription(e.target.value)} />
            </FormField>
            <FormField label="Fecha del evento (opcional)">
              <Input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
              {!eventDate && (
                <p className="mt-1 text-xs text-gray-400">Si no se indica, se usará la fecha de hoy.</p>
              )}
            </FormField>
          </Section>

          {/* Monto */}
          <Section title="¿Cuánto hay que juntar?">
            <FormField label="Moneda">
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="CLP">🇨🇱 CLP — Peso chileno</option>
                <option value="ARS">🇦🇷 ARS — Peso argentino</option>
                <option value="USD">🇺🇸 USD — Dólar</option>
                <option value="EUR">🇪🇺 EUR — Euro</option>
                <option value="MXN">🇲🇽 MXN — Peso mexicano</option>
                <option value="COP">🇨🇴 COP — Peso colombiano</option>
              </select>
            </FormField>

            {/* Toggle: cuota fija por participante */}
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 hover:bg-gray-100 transition">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={fixedPerPerson}
                  onChange={(e) => setFixedPerPerson(e.target.checked)}
                  className="sr-only"
                />
                <div className={`h-5 w-9 rounded-full transition-colors ${fixedPerPerson ? "bg-violet-600" : "bg-gray-300"}`} />
                <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${fixedPerPerson ? "translate-x-4" : "translate-x-0.5"}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">Definir cuota por participante</p>
                <p className="text-xs text-gray-500">
                  {fixedPerPerson
                    ? "Cada persona paga un monto fijo. El total crece según cuántos se unan."
                    : "Se divide el monto total en partes iguales entre todos los participantes."}
                </p>
              </div>
            </label>

            {fixedPerPerson ? (
              <FormField label="Cuota por participante *">
                <Input
                  type="number"
                  min="1"
                  placeholder="Ej: 5000"
                  value={amountPerPerson}
                  onChange={(e) => setAmountPerPerson(e.target.value)}
                  autoFocus
                />
                {parseFloat(amountPerPerson) > 0 && (
                  <p className="mt-1.5 text-xs text-violet-600">
                    💡 El total se calculará automáticamente: {currency} {parseFloat(amountPerPerson).toLocaleString()} × participantes
                  </p>
                )}
              </FormField>
            ) : (
              <FormField label="Monto total *">
                <Input
                  type="number"
                  min="1"
                  placeholder="Ej: 50000"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                />
                {parseFloat(totalAmount) > 0 && (
                  <p className="mt-1.5 text-xs text-violet-600">
                    💡 Se dividirá en partes iguales entre todos los que se unan
                  </p>
                )}
              </FormField>
            )}
          </Section>

          {/* PIN del organizador */}
          <Section title="🔐 PIN del organizador">
            <p className="text-xs text-gray-500">
              Este PIN te permite gestionar la colecta desde cualquier dispositivo. Solo tú lo sabes — no lo compartas.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="PIN (mín. 4 dígitos) *">
                <div className="relative">
                  <Input
                    type={showPin ? "text" : "password"}
                    inputMode="numeric"
                    placeholder="••••"
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    required
                    maxLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                  >
                    {showPin ? "Ocultar" : "Ver"}
                  </button>
                </div>
              </FormField>
              <FormField label="Confirmar PIN *">
                <Input
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  placeholder="••••"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  required
                  maxLength={8}
                  className={confirmPin && adminPin !== confirmPin ? "border-red-400 focus-visible:ring-red-400" : ""}
                />
              </FormField>
            </div>
            {confirmPin && adminPin !== confirmPin && (
              <p className="text-xs text-red-500">Los PINs no coinciden</p>
            )}
          </Section>

          <div className="flex gap-3 pb-8">
            <Link href="/" className="flex-1">
              <Button variant="outline" className="w-full" type="button">Cancelar</Button>
            </Link>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Creando..." : "Crear colecta 🚀"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-gray-900">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}

