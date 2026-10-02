import { format, parseISO } from "date-fns";
import Decimal from "decimal.js";

/**
 * Format a number or Decimal string into Indian Rupee (INR) format (e.g. ₹25,000.00 or ₹4,85,000)
 */
export function formatINR(
  amount: number | string | Decimal | null | undefined,
  showDecimals = true
): string {
  if (amount === null || amount === undefined || amount === "") {
    return "₹0.00";
  }

  try {
    const dec = new Decimal(amount.toString());
    const num = dec.toNumber();

    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: showDecimals ? 2 : 0,
      maximumFractionDigits: showDecimals ? 2 : 0,
    }).format(num);
  } catch {
    return "₹0.00";
  }
}

/**
 * Format a date string or Date object into standard DD-MM-YYYY format
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "-";
  try {
    const d = typeof date === "string" ? parseISO(date) : date;
    return format(d, "dd-MM-yyyy");
  } catch {
    return String(date);
  }
}

/**
 * Format date and time e.g., 29-09-2026, 04:30 PM
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "-";
  try {
    const d = typeof date === "string" ? parseISO(date) : date;
    return format(d, "dd-MM-yyyy, hh:mm a");
  } catch {
    return String(date);
  }
}

/**
 * Parse an input string safely into Decimal. Returns Decimal(0) if invalid.
 */
export function toDecimal(value: string | number | null | undefined): Decimal {
  if (value === null || value === undefined || value === "") {
    return new Decimal(0);
  }
  try {
    // Strip currency symbols and commas if pasted from Excel/text
    const cleaned = value.toString().replace(/[^0-9.-]+/g, "");
    return new Decimal(cleaned || "0");
  } catch {
    return new Decimal(0);
  }
}
