import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/* ─── Hand-Drawn border-radius constants ─────────────────────────────────────
   These organic ellipse values cannot be expressed as Tailwind classes.
   Use via inline style={{ borderRadius: WOBBLY_RADIUS }}.
─────────────────────────────────────────────────────────────────────────── */
/** Full wobbly oval — for buttons and large containers */
export const WOBBLY_RADIUS = "255px 15px 225px 15px / 15px 225px 15px 255px";
/** Medium wobbly — for cards and panels */
export const WOBBLY_RADIUS_MD = "30px 8px 28px 6px / 6px 28px 8px 30px";
/** Small wobbly — for inputs, badges, small elements */
export const WOBBLY_RADIUS_SM = "25px 6px 22px 6px / 6px 22px 6px 25px";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea un número como moneda
 * @param amount - El monto a formatear
 * @param currency - Código ISO de moneda (ej: "CLP", "USD", "ARS")
 * @param locale - Locale para el formato (ej: "es-CL")
 */
export function formatCurrency(
  amount: number,
  currency: string = "CLP",
  locale: string = "es-CL"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "CLP" ? 0 : 2,
    maximumFractionDigits: currency === "CLP" ? 0 : 2,
  }).format(amount);
}

/**
 * Divide un monto total entre N participantes de forma equitativa
 */
export function splitEqually(total: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, i) =>
    i < remainder ? base + 1 : base
  );
}

/**
 * Genera un código corto alfanumérico para compartir eventos
 */
export function generateEventCode(length: number = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join("");
}
