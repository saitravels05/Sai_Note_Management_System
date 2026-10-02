import { NextRequest, NextResponse } from "next/server";
import { ImporterService } from "@/server/services/importer.service";
import * as XLSX from "xlsx";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params;
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get("format") || "xlsx").toLowerCase();

    const normalizedType = type.toUpperCase() as
      | "INCOME"
      | "EXPENSE"
      | "RECEIVABLE"
      | "PAYABLE"
      | "TRANSACTIONS"
      | "CUSTOMERS"
      | "SUPPLIERS";

    const templateData = ImporterService.getTemplateHeaders(normalizedType);

    if (format === "csv") {
      // Build clean CSV with headers and sample row
      const wsData = [templateData.headers, ...templateData.sampleRows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const csv = XLSX.utils.sheet_to_csv(ws);

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${type}_import_template.csv"`,
        },
      });
    }

    // Build XLSX with Headers, Sample Data, and Documentation sheet
    const wb = XLSX.utils.book_new();

    // Sheet 1: Template data entry
    const wsData = [templateData.headers, ...templateData.sampleRows];
    const ws1 = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws1, "Import_Data");

    // Sheet 2: Field Documentation
    const docData = [
      ["Column Name", "Requirement", "Description & Instructions"],
      ...Object.entries(templateData.columnDocumentation).map(([col, desc]) => [
        col,
        desc.startsWith("Required") ? "Required" : "Optional",
        desc,
      ]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(docData);
    XLSX.utils.book_append_sheet(wb, ws2, "Column_Guide");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${type}_import_template.xlsx"`,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to generate template";
    return NextResponse.json(
      { error: msg },
      { status: 400 }
    );
  }
}
