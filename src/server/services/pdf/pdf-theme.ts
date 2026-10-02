import path from "path";
import fs from "fs";
import PDFDocument from "pdfkit";
import { format as formatDate } from "date-fns";
import { Money } from "@/lib/money";

export const PDF_COLORS = {
  primaryText: "#0f172a",
  secondaryText: "#475569",
  mutedText: "#64748b",
  border: "#cbd5e1",
  borderLight: "#e2e8f0",
  headerBg: "#0f172a",
  headerText: "#ffffff",
  cardBg: "#f8fafc",
  zebraBg: "#f8fafc",
  white: "#ffffff",
  incomeGreen: "#059669",
  incomeLight: "#ecfdf5",
  expenseRed: "#e11d48",
  expenseLight: "#fff1f2",
  netBlue: "#1d4ed8",
  netLight: "#eff6ff",
  amber: "#d97706",
  amberLight: "#fffbeb",
  purple: "#7c3aed",
  purpleLight: "#f5f3ff",
};

export const PDF_PAGE_CONFIG = {
  portrait: {
    size: "A4" as const,
    margin: 36,
    width: 595.28,
    height: 841.89,
    usableWidth: 595.28 - 72,
    usableHeight: 841.89 - 72,
  },
  landscape: {
    size: "A4" as const,
    layout: "landscape" as const,
    margin: 36,
    width: 841.89,
    height: 595.28,
    usableWidth: 841.89 - 72,
    usableHeight: 595.28 - 72,
  },
};

/**
 * Register Nirmala Unicode/Tamil font with Helvetica fallback.
 */
export function setupPdfFonts(doc: typeof PDFDocument.prototype): {
  regular: string;
  bold: string;
} {
  const fontDir = path.join(process.cwd(), "src", "assets", "fonts");
  const regularPath = path.join(fontDir, "Nirmala.ttf");
  const boldPath = path.join(fontDir, "NirmalaB.ttf");

  if (fs.existsSync(regularPath) && fs.existsSync(boldPath)) {
    try {
      doc.registerFont("Nirmala", regularPath);
      doc.registerFont("Nirmala-Bold", boldPath);
      return { regular: "Nirmala", bold: "Nirmala-Bold" };
    } catch {
      // Fallback
    }
  }

  return { regular: "Helvetica", bold: "Helvetica-Bold" };
}

/**
 * Format Money instance for PDF text with ₹ symbol.
 */
export function formatPdfMoney(money: Money | undefined | null): string {
  if (!money) return "₹0.00";
  const formatted = money.format();
  if (formatted.startsWith("₹")) {
    return formatted;
  }
  return `₹${formatted}`;
}

/**
 * Format Date in standard DD-MM-YYYY format.
 */
export function formatPdfDate(date: Date | string | undefined | null): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  return formatDate(d, "dd-MM-yyyy");
}

/**
 * Format Date & Time with timezone marker.
 */
export function formatPdfDateTime(date: Date | string | undefined | null, timezone = "IST"): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  return `${formatDate(d, "dd-MM-yyyy hh:mm a")} ${timezone}`;
}
