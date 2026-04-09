import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { splitEqually, generateEventCode } from "@/lib/utils";
import { nanoid } from "nanoid";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Verificar autenticación
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const { name, description, currency, totalAmount, items, participants, computedTotal } = body;

  // Validaciones básicas
  if (!name?.trim()) {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  }
  if (!computedTotal || computedTotal <= 0) {
    return NextResponse.json({ error: "El monto debe ser mayor a 0" }, { status: 400 });
  }
  const validParticipants = participants?.filter((p: { name: string }) => p.name?.trim()) ?? [];
  if (validParticipants.length === 0) {
    return NextResponse.json({ error: "Agrega al menos un participante" }, { status: 400 });
  }

  // Generar slug y código únicos
  const slug = `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${nanoid(6)}`;
  const code = generateEventCode();

  // Calcular montos por participante (división equitativa)
  const amounts = splitEqually(Math.round(computedTotal), validParticipants.length);

  // Insertar evento
  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert({
      slug,
      code,
      name: name.trim(),
      description: description ?? null,
      total_amount: totalAmount ?? computedTotal,
      currency: currency ?? "CLP",
      organizer_id: user.id,
    })
    .select()
    .single();

  if (eventError || !event) {
    console.error("Error creando evento:", eventError);
    return NextResponse.json({ error: "Error al crear el evento" }, { status: 500 });
  }

  // Insertar ítems si los hay
  if (items && items.length > 0) {
    const { error: itemsError } = await supabase.from("event_items").insert(
      items.map((item: { name: string; amount: string }) => ({
        event_id: event.id,
        name: item.name,
        amount: parseFloat(item.amount),
      }))
    );
    if (itemsError) console.error("Error insertando ítems:", itemsError);
  }

  // Insertar participantes con sus montos
  const { error: participantsError } = await supabase.from("participants").insert(
    validParticipants.map((p: { name: string; email: string }, i: number) => ({
      event_id: event.id,
      name: p.name.trim(),
      email: p.email?.trim() || null,
      amount_owed: amounts[i],
    }))
  );

  if (participantsError) {
    console.error("Error insertando participantes:", participantsError);
    return NextResponse.json({ error: "Error al guardar participantes" }, { status: 500 });
  }

  return NextResponse.json({ slug: event.slug, code: event.code }, { status: 201 });
}
