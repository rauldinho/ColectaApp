import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

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
