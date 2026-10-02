import { format, parse, parseISO, isValid } from "date-fns";

export const BUSINESS_TIMEZONE = "Asia/Kolkata";

/**
 * Format a Date or date string to Indian business standard: DD-MM-YYYY
 * e.g., 29-09-2026
 */
export function formatBusinessDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  try {
    const d = typeof date === "string" ? (date.includes("T") ? parseISO(date) : parse(date, "yyyy-MM-dd", new Date())) : date;
    if (!isValid(d)) return String(date);
    return format(d, "dd-MM-yyyy");
  } catch {
    return String(date);
  }
}

/**
 * Format date & time e.g., 29-09-2026, 04:30 PM
 */
export function formatBusinessDateTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  try {
    const d = typeof date === "string" ? parseISO(date) : date;
    if (!isValid(d)) return String(date);
    return format(d, "dd-MM-yyyy, hh:mm a");
  } catch {
    return String(date);
  }
}

/**
 * Format time only e.g., 04:30 PM
 */
export function formatBusinessTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  try {
    const d = typeof date === "string" ? parseISO(date) : date;
    if (!isValid(d)) return String(date);
    return format(d, "hh:mm a");
  } catch {
    return String(date);
  }
}

/**
 * Parse a DD-MM-YYYY or YYYY-MM-DD string into a valid Date object
 */
export function parseBusinessDate(dateString: string): Date | null {
  if (!dateString) return null;
  const trimmed = dateString.trim();

  // Try DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
    const d = parse(trimmed, "dd-MM-yyyy", new Date());
    return isValid(d) ? d : null;
  }

  // Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = parse(trimmed, "yyyy-MM-dd", new Date());
    return isValid(d) ? d : null;
  }

  // Fallback ISO
  try {
    const d = parseISO(trimmed);
    return isValid(d) ? d : null;
  } catch {
    return null;
  }
}

/**
 * Returns current date in YYYY-MM-DD for standard HTML date inputs
 */
export function getTodayInputDate(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/**
 * Month names lookup
 */
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function getMonthName(monthNumber: number): string {
  return MONTH_NAMES[monthNumber - 1] || `Month ${monthNumber}`;
}

export function getPeriodDisplayName(year: number, month: number): string {
  return `${getMonthName(month)} ${year}`;
}
