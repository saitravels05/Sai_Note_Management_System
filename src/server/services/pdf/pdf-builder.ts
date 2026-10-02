import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { PDF_COLORS, formatPdfDateTime } from "./pdf-theme";

export interface PdfBusinessInfo {
  name: string;
  legalName?: string | null;
  email?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  gstin?: string | null;
  logoUrl?: string | null;
}

export interface PdfHeaderOptions {
  business: PdfBusinessInfo;
  reportTitle: string;
  periodLabel: string;
  reportReference: string;
  accountingBasis?: "Accrual" | "Cash" | string;
  periodStatus?: string;
  isConfidential?: boolean;
  isDraft?: boolean;
}

export interface PdfKPICard {
  label: string;
  value: string;
  subtitle?: string;
  color?: string;
  bgColor?: string;
}

export interface PdfTableColumn {
  id: string;
  header: string;
  width: number;
  align?: "left" | "right" | "center";
}

export interface PdfTableOptions {
  columns: PdfTableColumn[];
  rows: Record<string, string | number | null | undefined>[];
  summaryRow?: Record<string, string | number | null | undefined>;
  summaryLabelColumnId?: string;
  title?: string;
}

export interface PdfFonts {
  regular: string;
  bold: string;
}

export class PdfBuilder {
  /**
   * Draw standard professional header with branding, report title, period, and reference.
   */
  public static drawHeader(
    doc: typeof PDFDocument.prototype,
    fonts: PdfFonts,
    options: PdfHeaderOptions
  ): number {
    const business = options.business || (options as unknown as PdfBusinessInfo) || { name: "Business" };
    const { reportTitle, periodLabel, reportReference, accountingBasis, periodStatus, isConfidential, isDraft } = options;
    const startY = doc.page.margins.top;
    const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const leftX = doc.page.margins.left;

    // Draw Draft Watermark if applicable
    if (isDraft) {
      doc.save();
      doc.font(fonts.bold).fontSize(56).fillColor("#f1f5f9").opacity(0.4);
      doc.rotate(-30, { origin: [doc.page.width / 2, doc.page.height / 2] });
      doc.text("DRAFT - UNFINALIZED", doc.page.width / 2 - 200, doc.page.height / 2, {
        align: "center",
        width: 400,
      });
      doc.restore();
    }

    // 1. Business Logo (if available on disk)
    let logoDrawn = false;
    const logoCandidates = [
      business.logoUrl ? path.resolve(/*turbopackIgnore: true*/ process.cwd(), business.logoUrl.replace(/^\//, "")) : "",
      path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "brand", "logo.jpg"),
      path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "brand", "logo.png"),
    ].filter(Boolean);

    for (const logoPath of logoCandidates) {
      if (fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, leftX, startY, { fit: [100, 42], align: "left", valign: "top" });
          logoDrawn = true;
          break;
        } catch {
          // Ignore and continue without logo
        }
      }
    }

    const businessTextX = logoDrawn ? leftX + 110 : leftX;
    const businessTextWidth = usableWidth * 0.5 - (logoDrawn ? 110 : 0);

    // 2. Business Details (Left Block)
    doc.font(fonts.bold).fontSize(14).fillColor(PDF_COLORS.primaryText);
    doc.text(business.name, businessTextX, startY, { width: businessTextWidth });

    let currentY = doc.y;
    doc.font(fonts.regular).fontSize(8).fillColor(PDF_COLORS.secondaryText);

    if (business.legalName && business.legalName !== business.name) {
      doc.text(business.legalName, businessTextX, currentY, { width: businessTextWidth });
      currentY = doc.y;
    }

    const addressParts = [
      business.addressLine1,
      business.addressLine2,
      [business.city, business.state, business.postalCode].filter(Boolean).join(" "),
    ].filter(Boolean);

    if (addressParts.length > 0) {
      doc.text(addressParts.join(", "), businessTextX, currentY, { width: businessTextWidth });
      currentY = doc.y;
    }

    const contactParts = [
      business.phone ? `Phone: ${business.phone}` : null,
      business.email ? `Email: ${business.email}` : null,
      business.gstin ? `GSTIN: ${business.gstin}` : null,
    ].filter(Boolean);

    if (contactParts.length > 0) {
      doc.text(contactParts.join(" | "), businessTextX, currentY, { width: businessTextWidth });
      currentY = doc.y;
    }

    // 3. Report Details (Right Block)
    const rightBlockWidth = usableWidth * 0.48;
    const rightBlockX = leftX + usableWidth - rightBlockWidth;

    doc.font(fonts.bold).fontSize(16).fillColor(PDF_COLORS.primaryText);
    doc.text(reportTitle, rightBlockX, startY, { width: rightBlockWidth, align: "right" });

    let rightY = doc.y;
    doc.font(fonts.bold).fontSize(9).fillColor(PDF_COLORS.netBlue);
    doc.text(`Period: ${periodLabel}`, rightBlockX, rightY, { width: rightBlockWidth, align: "right" });
    rightY = doc.y;

    doc.font(fonts.regular).fontSize(8).fillColor(PDF_COLORS.mutedText);
    doc.text(`Reference: ${reportReference}`, rightBlockX, rightY, { width: rightBlockWidth, align: "right" });
    rightY = doc.y;

    const metaLineParts: string[] = [];
    if (accountingBasis) metaLineParts.push(`Basis: ${accountingBasis}`);
    if (periodStatus) metaLineParts.push(`Status: ${periodStatus}`);
    if (isConfidential) metaLineParts.push("CONFIDENTIAL");

    if (metaLineParts.length > 0) {
      doc.text(metaLineParts.join(" | "), rightBlockX, rightY, { width: rightBlockWidth, align: "right" });
      rightY = doc.y;
    }

    // Determine bottom of header and draw dividing line
    const headerBottomY = Math.max(currentY, rightY, startY + (logoDrawn ? 46 : 38)) + 8;
    doc.strokeColor(PDF_COLORS.borderLight).lineWidth(1);
    doc.moveTo(leftX, headerBottomY).lineTo(leftX + usableWidth, headerBottomY).stroke();

    doc.y = headerBottomY + 10;
    return doc.y;
  }

  /**
   * Draw section title with subtle accent bar.
   */
  public static drawSectionTitle(
    doc: typeof PDFDocument.prototype,
    fonts: PdfFonts,
    title: string,
    subtitle?: string
  ): void {
    const leftX = doc.page.margins.left;
    const currentY = doc.y;

    // Check page break for section header
    if (currentY > doc.page.height - 100) {
      doc.addPage();
    }

    const y = doc.y;
    // Left blue accent bar
    doc.rect(leftX, y + 1, 3, 14).fillColor(PDF_COLORS.netBlue).fill();

    doc.font(fonts.bold).fontSize(11).fillColor(PDF_COLORS.primaryText);
    doc.text(title, leftX + 8, y + 1);

    if (subtitle) {
      doc.font(fonts.regular).fontSize(8).fillColor(PDF_COLORS.mutedText);
      doc.text(subtitle, leftX + 8, doc.y);
    }

    doc.y += 6;
  }

  /**
   * Draw KPI Cards Row.
   */
  public static drawKPICards(
    doc: typeof PDFDocument.prototype,
    fonts: PdfFonts,
    cards: PdfKPICard[]
  ): void {
    const leftX = doc.page.margins.left;
    const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const cardGap = 8;
    const cardCount = cards.length;
    const cardWidth = (usableWidth - (cardCount - 1) * cardGap) / cardCount;
    const cardHeight = 48;
    const startY = doc.y;

    if (startY + cardHeight > doc.page.height - doc.page.margins.bottom - 40) {
      doc.addPage();
    }

    const y = doc.y;

    cards.forEach((card, index) => {
      const cx = leftX + index * (cardWidth + cardGap);
      const accentColor = card.color || PDF_COLORS.netBlue;
      const bg = card.bgColor || PDF_COLORS.cardBg;

      // Card Background
      doc.roundedRect(cx, y, cardWidth, cardHeight, 4).fillColor(bg).fill();
      // Border
      doc.roundedRect(cx, y, cardWidth, cardHeight, 4).strokeColor(PDF_COLORS.borderLight).lineWidth(1).stroke();
      // Top accent bar
      doc.roundedRect(cx, y, cardWidth, 3, 2).fillColor(accentColor).fill();

      // Label
      doc.font(fonts.bold).fontSize(7.5).fillColor(PDF_COLORS.mutedText);
      doc.text(card.label.toUpperCase(), cx + 8, y + 7, { width: cardWidth - 16, ellipsis: true });

      // Value
      doc.font(fonts.bold).fontSize(11.5).fillColor(accentColor);
      doc.text(card.value, cx + 8, y + 18, { width: cardWidth - 16 });

      // Subtitle if present
      if (card.subtitle) {
        doc.font(fonts.regular).fontSize(7).fillColor(PDF_COLORS.secondaryText);
        doc.text(card.subtitle, cx + 8, y + 33, { width: cardWidth - 16, ellipsis: true });
      }
    });

    doc.y = y + cardHeight + 12;
  }

  /**
   * Draw multi-page table with repeating headers, zebra background, and summary row.
   */
  public static drawTable(
    doc: typeof PDFDocument.prototype,
    fonts: PdfFonts,
    options: PdfTableOptions
  ): void {
    const { columns, rows, summaryRow, summaryLabelColumnId, title } = options;
    const leftX = doc.page.margins.left;
    const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const maxY = doc.page.height - doc.page.margins.bottom - 25;

    if (title) {
      this.drawSectionTitle(doc, fonts, title);
    }

    // Scale column widths proportionally if they don't match usable width
    const totalGivenWidth = columns.reduce((acc, c) => acc + c.width, 0);
    const scaleFactor = totalGivenWidth > 0 ? usableWidth / totalGivenWidth : 1;
    const adjustedColumns = columns.map((c) => ({
      ...c,
      width: Math.floor(c.width * scaleFactor),
    }));

    // Re-adjust last column for rounding differences
    const currentTotal = adjustedColumns.reduce((acc, c) => acc + c.width, 0);
    if (adjustedColumns.length > 0 && currentTotal !== usableWidth) {
      adjustedColumns[adjustedColumns.length - 1].width += usableWidth - currentTotal;
    }

    const headerHeight = 20;

    const renderTableHeader = () => {
      const hy = doc.y;
      doc.rect(leftX, hy, usableWidth, headerHeight).fillColor(PDF_COLORS.headerBg).fill();

      let cx = leftX;
      adjustedColumns.forEach((col) => {
        doc.font(fonts.bold).fontSize(8).fillColor(PDF_COLORS.headerText);
        doc.text(col.header, cx + 4, hy + 5, {
          width: col.width - 8,
          align: col.align || "left",
          ellipsis: true,
        });
        cx += col.width;
      });

      doc.y = hy + headerHeight;
    };

    // Initial table header check
    if (doc.y + headerHeight + 30 > maxY) {
      doc.addPage();
    }
    renderTableHeader();

    if (rows.length === 0) {
      doc.font(fonts.regular).fontSize(8.5).fillColor(PDF_COLORS.mutedText);
      doc.text("No records found for the selected period/filters.", leftX, doc.y + 6, {
        align: "center",
        width: usableWidth,
      });
      doc.y += 16;
      return;
    }

    // Render Data Rows
    rows.forEach((row, rowIndex) => {
      // Calculate row height based on cell text wrapping
      let maxCellHeight = 16;
      adjustedColumns.forEach((col) => {
        const val = row[col.id] !== null && row[col.id] !== undefined ? String(row[col.id]) : "";
        const h = doc.heightOfString(val, { width: col.width - 8, fontSize: 8 });
        if (h + 6 > maxCellHeight) maxCellHeight = Math.ceil(h + 6);
      });

      // Page break check
      if (doc.y + maxCellHeight > maxY) {
        doc.addPage();
        renderTableHeader();
      }

      const ry = doc.y;
      const isZebra = rowIndex % 2 === 1;

      // Background row fill
      if (isZebra) {
        doc.rect(leftX, ry, usableWidth, maxCellHeight).fillColor(PDF_COLORS.zebraBg).fill();
      }

      // Bottom subtle row border
      doc.strokeColor(PDF_COLORS.borderLight).lineWidth(0.5);
      doc.moveTo(leftX, ry + maxCellHeight).lineTo(leftX + usableWidth, ry + maxCellHeight).stroke();

      // Render cell text
      let cx = leftX;
      adjustedColumns.forEach((col) => {
        const val = row[col.id] !== null && row[col.id] !== undefined ? String(row[col.id]) : "";
        doc.font(fonts.regular).fontSize(8).fillColor(PDF_COLORS.primaryText);
        doc.text(val, cx + 4, ry + 4, {
          width: col.width - 8,
          align: col.align || "left",
        });
        cx += col.width;
      });

      doc.y = ry + maxCellHeight;
    });

    // Render Summary Row if provided
    if (summaryRow) {
      const summaryHeight = 20;
      if (doc.y + summaryHeight > maxY) {
        doc.addPage();
        renderTableHeader();
      }

      const sy = doc.y;
      doc.rect(leftX, sy, usableWidth, summaryHeight).fillColor("#f1f5f9").fill();
      doc.strokeColor(PDF_COLORS.border).lineWidth(1);
      doc.moveTo(leftX, sy).lineTo(leftX + usableWidth, sy).stroke();
      doc.moveTo(leftX, sy + summaryHeight).lineTo(leftX + usableWidth, sy + summaryHeight).stroke();

      let cx = leftX;
      adjustedColumns.forEach((col) => {
        let val = summaryRow[col.id] !== null && summaryRow[col.id] !== undefined ? String(summaryRow[col.id]) : "";
        if (summaryLabelColumnId && col.id === summaryLabelColumnId && !val) {
          val = "TOTAL";
        }
        doc.font(fonts.bold).fontSize(8.5).fillColor(PDF_COLORS.primaryText);
        doc.text(val, cx + 4, sy + 5, {
          width: col.width - 8,
          align: col.align || "left",
          ellipsis: true,
        });
        cx += col.width;
      });

      doc.y = sy + summaryHeight;
    }

    doc.y += 12;
  }

  /**
   * Draw horizontal distribution bars for category, payment method, or aging breakdowns.
   */
  public static drawBarDistribution(
    doc: typeof PDFDocument.prototype,
    fonts: PdfFonts,
    title: string,
    items: { label: string; amountStr: string; percentage: number; color?: string }[]
  ): void {
    const leftX = doc.page.margins.left;
    const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    this.drawSectionTitle(doc, fonts, title);

    const barHeight = 12;
    const labelWidth = 140;
    const valueWidth = 90;
    const percentWidth = 45;
    const trackWidth = usableWidth - labelWidth - valueWidth - percentWidth - 10;

    items.forEach((item) => {
      if (doc.y + barHeight + 6 > doc.page.height - doc.page.margins.bottom - 20) {
        doc.addPage();
      }

      const y = doc.y;
      // Label
      doc.font(fonts.bold).fontSize(8).fillColor(PDF_COLORS.secondaryText);
      doc.text(item.label, leftX, y, { width: labelWidth, ellipsis: true });

      // Bar Track
      const trackX = leftX + labelWidth + 4;
      doc.roundedRect(trackX, y + 1, trackWidth, barHeight, 3).fillColor("#e2e8f0").fill();

      // Filled portion
      const fillW = Math.max(2, Math.min(trackWidth, (item.percentage / 100) * trackWidth));
      const color = item.color || PDF_COLORS.netBlue;
      doc.roundedRect(trackX, y + 1, fillW, barHeight, 3).fillColor(color).fill();

      // Amount
      const valueX = trackX + trackWidth + 8;
      doc.font(fonts.bold).fontSize(8).fillColor(PDF_COLORS.primaryText);
      doc.text(item.amountStr, valueX, y, { width: valueWidth, align: "right" });

      // Percentage
      const percentX = valueX + valueWidth + 6;
      doc.font(fonts.regular).fontSize(8).fillColor(PDF_COLORS.mutedText);
      doc.text(`${item.percentage.toFixed(1)}%`, percentX, y, { width: percentWidth, align: "right" });

      doc.y = y + barHeight + 6;
    });

    doc.y += 8;
  }

  /**
   * Finalize all document pages with accurate "Page X of Y" running footers.
   */
  public static finalizeFooters(
    doc: typeof PDFDocument.prototype,
    fonts: PdfFonts,
    businessName: string,
    reportReference: string,
    isConfidential = false,
    timezone = "IST"
  ): void {
    const range = doc.bufferedPageRange();
    const totalPages = range.count;
    const genTimestamp = formatPdfDateTime(new Date(), timezone);

    for (let i = range.start; i < range.start + totalPages; i++) {
      doc.switchToPage(i);
      const pageNumber = i - range.start + 1;
      const footerY = doc.page.height - doc.page.margins.bottom + 6;
      const leftX = doc.page.margins.left;
      const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      // Top subtle border line
      doc.strokeColor(PDF_COLORS.borderLight).lineWidth(0.5);
      doc.moveTo(leftX, footerY).lineTo(leftX + usableWidth, footerY).stroke();

      // Left text: Generated info + Ref + Business
      const leftText = `Generated: ${genTimestamp} | Ref: ${reportReference} | ${businessName}`;
      doc.font(fonts.regular).fontSize(7.5).fillColor(PDF_COLORS.mutedText);
      doc.text(leftText, leftX, footerY + 4, {
        width: usableWidth * 0.65,
        ellipsis: true,
      });

      // Right text: Confidential + Page X of Y
      const rightParts: string[] = [];
      if (isConfidential) rightParts.push("Confidential");
      rightParts.push(`Page ${pageNumber} of ${totalPages}`);

      doc.font(fonts.bold).fontSize(7.5).fillColor(PDF_COLORS.mutedText);
      doc.text(rightParts.join(" | "), leftX + usableWidth * 0.65, footerY + 4, {
        width: usableWidth * 0.35,
        align: "right",
      });
    }
  }
}
