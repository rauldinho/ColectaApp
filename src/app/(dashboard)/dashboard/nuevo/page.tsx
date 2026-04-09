"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { splitEqually, generateEventCode } from "@/lib/utils";
import { nanoid } from "nanoid";

type Item = { name: string; amount: string };
type Participant = { name: string; email: string };

export default function NuevoEventoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [splitType, setSplitType] = useState<"total" | "items">("total");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [currency, setCurrency] = useState("CLP");
  const [items, setItems] = useState<Item[]>([{ name: "", amount: "" }]);
  const [participants, setParticipants] = useState<Participant[]>([
    { name: "", email: "" },
    { name: "", email: "" },
  ]);

  function addItem() { setItems([...items, { name: "", amount: "" }]); }
  function removeItem(i: number) { setItems(items.filter((_, idx) => idx !== i)); }
  function updateItem(i: number, field: keyof Item, value: string) {
    const u = [...items]; u[i][field] = value; setItems(u);
  }

  function addParticipant() { setParticipants([...participants, { name: "", email: "" }]); }
  function removeParticipant(i: number) { setParticipants(participants.filter((_, idx) => idx !== i)); }
  function updateParticipant(i: number, field: keyof Participant, value: string) {
    const u = [...participants]; u[i][field] = value; setParticipants(u);
  }

  const itemsTotal = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const computedTotal = splitType === "total" ? parseFloat(totalAmount) || 0 : itemsTotal;
  const validParticipants = participants.filter((p) => p.name.trim());
  const perPerson = validParticipants.length > 0 ? computedTotal / validParticipants.length : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (validParticipants.length === 0) { toast.error("Agrega al menos un participante"); return; }
    if (computedTotal <= 0) { toast.error("El monto total debe ser mayor a 0"); return; }
    if (!name.trim()) { toast.error("El nombre es requerido"); return; }

    setLoading(true);
    const supabase = createClient();

    // Generar identificadores únicos
    const slug = `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${nanoid(6)}`;
    const code = generateEventCode();

    // 1. Crear evento
    const { data: event, error: eventError } = await supabase
      .from("events")
      .insert({
        slug,
        code,
        name: name.trim(),
        description: description.trim() || null,
        total_amount: computedTotal,
        currency,
      })
      .select()
      .single();

    if (eventError || !event) {
      toast.error("Error al crear la colecta: " + eventError?.message);
      setLoading(false);
      return;
    }

    // 2. Insertar ítems si aplica
    if (splitType === "items") {
      const validItems = items.filter((i) => i.name && parseFloat(i.amount) > 0);
      if (validItems.length > 0) {
        await supabase.from("event_items").insert(
          validItems.map((item) => ({
            event_id: event.id,
            name: item.name,
            amount: parseFloat(item.amount),
          }))
        );
      }
    }

    // 3. Insertar participantes con división equitativa
    const amounts = splitEqually(Math.round(computedTotal), validParticipants.length);
    const { error: participantsError } = await supabase.from("participants").insert(
      validParticipants.map((p, i) => ({
        event_id: event.id,
        name: p.name.trim(),
        email: p.email.trim() || null,
        amount_owed: amounts[i],
      }))
    );

    if (participantsError) {
      toast.error("Error al guardar participantes");
      setLoading(false);
      return;
    }

    // 4. Guardar admin_token en localStorage para acceso futuro
    localStorage.setItem(`colecta_admin_${event.slug}`, event.admin_token);

    toast.success("¡Colecta creada!");
    router.push(`/evento/${event.slug}?token=${event.admin_token}`);
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
          </Section>

          {/* Monto */}
          <Section title="¿Cuánto hay que juntar?">
            <div className="flex gap-2">
              <ToggleButton active={splitType === "total"} onClick={() => setSplitType("total")}>Monto total</ToggleButton>
              <ToggleButton active={splitType === "items"} onClick={() => setSplitType("items")}>Por ítems</ToggleButton>
            </div>

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

            {splitType === "total" ? (
              <FormField label="Monto total *">
                <Input type="number" min="1" placeholder="Ej: 50000" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} required />
              </FormField>
            ) : (
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="flex gap-2">
                    <Input placeholder="Ítem (ej: carne)" value={item.name} onChange={(e) => updateItem(i, "name", e.target.value)} className="flex-1" />
                    <Input type="number" placeholder="Monto" value={item.amount} onChange={(e) => updateItem(i, "amount", e.target.value)} className="w-32" />
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(i)} className="text-gray-400 hover:text-red-500">✕</button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addItem} className="text-sm text-violet-600 hover:underline">+ Agregar ítem</button>
                {itemsTotal > 0 && (
                  <p className="text-right text-sm font-medium text-gray-700">
                    Total: <span className="text-violet-600">{itemsTotal.toLocaleString()} {currency}</span>
                  </p>
                )}
              </div>
            )}
          </Section>

          {/* Participantes */}
          <Section title="¿Quiénes participan?">
            <div className="space-y-2">
              {participants.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <Input placeholder="Nombre *" value={p.name} onChange={(e) => updateParticipant(i, "name", e.target.value)} className="flex-1" />
                  <Input type="email" placeholder="Email (opcional)" value={p.email} onChange={(e) => updateParticipant(i, "email", e.target.value)} className="flex-1" />
                  {participants.length > 1 && (
                    <button type="button" onClick={() => removeParticipant(i)} className="text-gray-400 hover:text-red-500">✕</button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addParticipant} className="text-sm text-violet-600 hover:underline">+ Agregar participante</button>
            </div>

            {/* Preview división */}
            {computedTotal > 0 && validParticipants.length > 0 && (
              <div className="rounded-xl bg-violet-50 p-4">
                <p className="text-sm font-medium text-violet-800">
                  Cada uno paga:{" "}
                  <span className="text-xl font-bold">
                    {Math.ceil(perPerson).toLocaleString()} {currency}
                  </span>
                </p>
                <p className="text-xs text-violet-500">
                  {computedTotal.toLocaleString()} {currency} ÷ {validParticipants.length} persona{validParticipants.length !== 1 ? "s" : ""}
                </p>
              </div>
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

function ToggleButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-medium transition ${active ? "bg-violet-600 text-white" : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>
      {children}
    </button>
  );
}
