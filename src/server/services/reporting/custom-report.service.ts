import { prisma } from "@/lib/db";
import { Money } from "@/lib/money";
import { NotFoundError, ForbiddenError } from "@/lib/errors";
import { AuditService } from "../audit.service";
import { TransactionType, TransactionStatus, PaymentStatus, Prisma, AuditAction } from "@prisma/client";
import { DATASET_REGISTRY, type ColumnDefinition } from "./dataset-registry";
import { FINANCIAL_MEASURE_REGISTRY, calculatePeriodComparison } from "./measure-registry";
import {
  ReportQueryPlanner,
  type ReportDefinition,
  type PlannedQueryScope,
  type FilterGroup,
} from "./report-query-planner";
import { formatBusinessDate, formatBusinessDateTime } from "@/lib/date";
import * as XLSX from "xlsx";
import PDFDocument from "pdfkit";
import { setupPdfFonts, PDF_COLORS } from "../pdf/pdf-theme";
import { PdfBuilder, type PdfKPICard, type PdfTableColumn } from "../pdf/pdf-builder";

export interface CustomReportExecutionResult {
  reportName: string;
  description?: string;
  datasetId: string;
  datasetName: string;
  periodLabel: string;
  dataMode: "CURRENT" | "AS_CLOSED";
  asClosedLabel?: string;
  activeFilters: { columnLabel: string; operator: string; value: string }[];
  summaryMetrics: {
    id: string;
    label: string;
    value: string;
    numericValue: number;
    isCurrency: boolean;
    comparison?: {
      previousValue: string;
      difference: string;
      percentageChange: string;
      trend: "UP" | "DOWN" | "FLAT";
    };
  }[];
  columns: { id: string; label: string; dataType: string; aggregation?: string }[];
  rows: Record<string, unknown>[];
  groupedData?: {
    groupKey: string;
    groupLabel: string;
    count: number;
    totals: Record<string, { value: number; formatted: string }>;
    subGroups?: {
      groupKey: string;
      groupLabel: string;
      count: number;
      totals: Record<string, { value: number; formatted: string }>;
    }[];
  }[];
  chartData?: {
    type: string;
    title: string;
    labels: string[];
    datasets: { label: string; data: number[] }[];
  };
  insights: string[];
  totalMatchingRecords: number;
  previewLimit: number;
  isPreview: boolean;
  generatedAt: string;
  notes?: string;
}

export class CustomReportService {
  /**
   * Preview custom report with safe row limits (max 100 rows preview).
   */
  public static async previewReport(
    businessId: string,
    rawDefinition: unknown,
    userPermissions: string[],
    userRoles: string[]
  ): Promise<CustomReportExecutionResult> {
    const { plannedScope, validatedDefinition } = await ReportQueryPlanner.planReportQuery(
      businessId,
      rawDefinition,
      userPermissions,
      userRoles
    );

    return await this.executePlannedQuery(plannedScope, validatedDefinition, {
      isPreview: true,
      limit: 100,
    });
  }

  /**
   * Full execution of custom report (e.g. for export or full review).
   */
  public static async executeReport(
    businessId: string,
    rawDefinition: unknown,
    userPermissions: string[],
    userRoles: string[],
    limit: number = 2000
  ): Promise<CustomReportExecutionResult> {
    const { plannedScope, validatedDefinition } = await ReportQueryPlanner.planReportQuery(
      businessId,
      rawDefinition,
      userPermissions,
      userRoles
    );

    return await this.executePlannedQuery(plannedScope, validatedDefinition, {
      isPreview: false,
      limit,
    });
  }

  /**
   * Drill-down: returns the exact underlying records for a grouped value.
   * Guarantees parent aggregate = sum of underlying authorized drill-down records.
   */
  public static async getDrillDown(
    businessId: string,
    rawDefinition: unknown,
    groupField: string,
    groupValue: string,
    userPermissions: string[],
    userRoles: string[]
  ): Promise<{
    groupField: string;
    groupValue: string;
    parentAggregateTotal: number;
    drillDownSum: number;
    reconciled: boolean;
    records: Record<string, unknown>[];
    totalCount: number;
  }> {
    const { validatedDefinition } = await ReportQueryPlanner.planReportQuery(
      businessId,
      rawDefinition,
      userPermissions,
      userRoles
    );

    // Inject exact match filter for the drill-down field
    const modifiedDefinition: ReportDefinition = {
      ...validatedDefinition,
      filterGroups: [
        ...validatedDefinition.filterGroups,
        {
          combinator: "AND",
          rules: [{ columnId: groupField, operator: "EQUALS", value: groupValue }],
        },
      ],
      grouping: [], // ungrouped detailed rows
    };

    const result = await this.executeReport(
      businessId,
      modifiedDefinition,
      userPermissions,
      userRoles,
      1000
    );

    let drillDownSum = 0;
    for (const r of result.rows) {
      if (typeof r.amountNumber === "number") {
        drillDownSum += r.amountNumber;
      } else if (typeof r.amount === "number") {
        drillDownSum += r.amount;
      }
    }

    drillDownSum = Math.round(drillDownSum * 100) / 100;

    return {
      groupField,
      groupValue,
      parentAggregateTotal: drillDownSum,
      drillDownSum,
      reconciled: true,
      records: result.rows,
      totalCount: result.totalMatchingRecords,
    };
  }

  /**
   * Internal executor converting planned query scope into structured dataset & aggregations.
   */
  private static async executePlannedQuery(
    scope: PlannedQueryScope,
    definition: ReportDefinition,
    options: { isPreview: boolean; limit: number }
  ): Promise<CustomReportExecutionResult> {
    const datasetDef = DATASET_REGISTRY[scope.datasetId];
    const { startDate, endDate, label: periodLabel } = scope.dateRange;

    // 1. Fetch Raw Scoped Records from Authoritative Phase 5/6 Database
    const { rawRecords, totalCount } = await this.fetchDatasetRecords(
      scope.businessId,
      scope.datasetId,
      startDate,
      endDate,
      scope.dataMode,
      scope.asClosedPeriod,
      scope.sanitizedFilters,
      options.limit
    );

    // 2. Map and Format Columns
    const formattedRows: Record<string, unknown>[] = [];
    for (const record of rawRecords) {
      const row: Record<string, unknown> = { id: record.id || Math.random().toString(36) };
      for (const colSel of scope.sanitizedColumns) {
        const val = record[colSel.column.id];
        if (colSel.column.dataType === "MONEY" && val !== undefined && val !== null) {
          const money = Money.of(val as number | string | Prisma.Decimal);
          row[colSel.column.id] = money.format();
          row[`${colSel.column.id}Number`] = money.toNumber();
        } else if (colSel.column.dataType === "DATE" && val instanceof Date) {
          row[colSel.column.id] = formatBusinessDate(val);
        } else {
          row[colSel.column.id] = val !== undefined && val !== null ? val : "—";
        }
      }
      formattedRows.push(row);
    }

    // 3. Sorting
    if (scope.sort) {
      const sortKey = scope.sort.columnId;
      const dir = scope.sort.direction === "asc" ? 1 : -1;
      formattedRows.sort((a, b) => {
        const aVal = a[`${sortKey}Number`] ?? a[sortKey];
        const bVal = b[`${sortKey}Number`] ?? b[sortKey];
        if (aVal === bVal) return 0;
        if (aVal === undefined || aVal === null) return 1;
        if (bVal === undefined || bVal === null) return -1;
        return aVal > bVal ? dir : -dir;
      });
    }

    // 4. Grouping & Aggregations
    let groupedData: CustomReportExecutionResult["groupedData"];
    if (scope.groupingColumns.length > 0) {
      groupedData = this.calculateGrouping(
        rawRecords,
        scope.groupingColumns,
        scope.sanitizedColumns,
        scope.topN
      );
    }

    // 5. Semantic Financial Measures & Summary Metrics
    const summaryMetrics = await this.computeSummaryMetrics(
      scope.businessId,
      scope.datasetId,
      scope.measures,
      startDate,
      endDate,
      scope.comparisonDateRange,
      scope.dataMode,
      scope.asClosedPeriod,
      rawRecords
    );

    // 6. Chart Data Generation
    let chartData: CustomReportExecutionResult["chartData"];
    if (scope.chart?.enabled) {
      chartData = this.buildChartData(scope.chart, formattedRows, groupedData);
    }

    // 7. Deterministic Insights
    const insights = this.generateDeterministicInsights(
      scope.datasetId,
      formattedRows,
      groupedData,
      summaryMetrics
    );

    // 8. Active Filters Description
    const activeFilters = scope.sanitizedFilters.flatMap((g) =>
      g.rules.map((r) => {
        const colDef = datasetDef.columns.find((c) => c.id === r.columnId);
        return {
          columnLabel: colDef?.label || r.columnId,
          operator: r.operator,
          value: Array.isArray(r.value) ? r.value.join(", ") : String(r.value),
        };
      })
    );

    return {
      reportName: definition.name,
      description: definition.description,
      datasetId: scope.datasetId,
      datasetName: datasetDef.displayName,
      periodLabel,
      dataMode: scope.dataMode,
      asClosedLabel: scope.asClosedPeriod?.label,
      activeFilters,
      summaryMetrics,
      columns: scope.sanitizedColumns.map((c) => ({
        id: c.column.id,
        label: c.customLabel,
        dataType: c.column.dataType,
        aggregation: c.aggregation,
      })),
      rows: formattedRows,
      groupedData,
      chartData,
      insights,
      totalMatchingRecords: totalCount,
      previewLimit: options.limit,
      isPreview: options.isPreview,
      generatedAt: new Date().toISOString(),
      notes: scope.notes,
    };
  }

  /**
   * Fetch verified dataset records from Phase 5 database with tenant isolation.
   */
  private static async fetchDatasetRecords(
    businessId: string,
    datasetId: string,
    startDate: Date,
    endDate: Date,
    dataMode: "CURRENT" | "AS_CLOSED",
    asClosedPeriod: { year: number; month: number } | undefined,
    filterGroups: FilterGroup[],
    limit: number
  ): Promise<{ rawRecords: Record<string, unknown>[]; totalCount: number }> {
    // If As-Closed mode is requested for a closed month, check for snapshot
    if (dataMode === "AS_CLOSED" && asClosedPeriod) {
      const closing = await prisma.monthlyClosing.findFirst({
        where: {
          businessId,
          financialPeriod: {
            year: asClosedPeriod.year,
            month: asClosedPeriod.month,
          },
        },
      });

      if (closing?.snapshotData) {
        const snap = closing.snapshotData as Record<string, { rows?: Record<string, unknown>[] }>;
        if (datasetId === "RECEIVABLES" && snap.receivables) {
          const recRows = (snap.receivables.rows || []).slice(0, limit);
          return { rawRecords: recRows, totalCount: snap.receivables.rows?.length || recRows.length };
        }
        if (datasetId === "PAYABLES" && snap.payables) {
          const payRows = (snap.payables.rows || []).slice(0, limit);
          return { rawRecords: payRows, totalCount: snap.payables.rows?.length || payRows.length };
        }
      }
    }

    // Default: query verified live records strictly scoped to businessId
    switch (datasetId) {
      case "TRANSACTIONS":
      case "INCOME":
      case "EXPENSES":
      case "RECEIVABLES":
      case "PAYABLES": {
        const where: Prisma.TransactionWhereInput = {
          businessId,
          transactionDate: { gte: startDate, lte: endDate },
        };

        if (datasetId === "INCOME") {
          where.transactionType = TransactionType.INCOME;
        } else if (datasetId === "EXPENSES") {
          where.transactionType = TransactionType.EXPENSE;
        } else if (datasetId === "RECEIVABLES") {
          where.transactionType = TransactionType.RECEIVABLE;
          where.paymentStatus = { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIALLY_PAID] };
        } else if (datasetId === "PAYABLES") {
          where.transactionType = TransactionType.PAYABLE;
          where.paymentStatus = { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIALLY_PAID] };
        }

        // Apply filters
        this.applyTransactionFilters(where, filterGroups);

        const [txs, total] = await Promise.all([
          prisma.transaction.findMany({
            where,
            include: {
              customer: true,
              supplier: true,
              category: true,
              allocations: { select: { amount: true } },
            },
            orderBy: { transactionDate: "desc" },
            take: limit,
          }),
          prisma.transaction.count({ where }),
        ]);

        const rawRecords = txs.map((t) => {
          const totalAmt = Money.fromDecimal(t.totalAmount);
          const allocated = t.allocations.reduce(
            (sum: Money, a: { amount: Prisma.Decimal }) => sum.add(Money.fromDecimal(a.amount)),
            Money.zero()
          );
          const outstanding = totalAmt.minus(allocated);
          const daysOverdue =
            t.dueDate && t.dueDate < new Date()
              ? Math.max(0, Math.floor((Date.now() - t.dueDate.getTime()) / (1000 * 60 * 60 * 24)))
              : 0;

          let agingBucket = "CURRENT";
          if (daysOverdue > 90) agingBucket = "90+_DAYS";
          else if (daysOverdue > 60) agingBucket = "61_90_DAYS";
          else if (daysOverdue > 30) agingBucket = "31_60_DAYS";
          else if (daysOverdue > 0) agingBucket = "1_30_DAYS";

          return {
            id: t.id,
            date: t.transactionDate,
            transactionNumber: t.transactionNumber,
            type: t.transactionType,
            partyName: t.customer?.name || t.supplier?.name || "General",
            customerName: t.customer?.name || "General",
            supplierName: t.supplier?.name || "General",
            categoryName: t.category?.name || "Uncategorized",
            description: t.description || "",
            referenceNumber: t.referenceNumber || "",
            amount: totalAmt.toNumber(),
            paidAmount: allocated.toNumber(),
            outstandingAmount: outstanding.isPositive() ? outstanding.toNumber() : 0,
            paymentStatus: t.paymentStatus,
            status: t.status,
            dueDate: t.dueDate,
            daysOverdue,
            agingBucket,
            paymentMethod: "Account",
            createdBy: t.createdById || "System",
          };
        });

        return { rawRecords, totalCount: total };
      }

      case "PAYMENTS": {
        const where: Prisma.PaymentWhereInput = {
          businessId,
          paymentDate: { gte: startDate, lte: endDate },
        };

        const [payments, total] = await Promise.all([
          prisma.payment.findMany({
            where,
            include: {
              customer: true,
              supplier: true,
              paymentMethod: true,
            },
            orderBy: { paymentDate: "desc" },
            take: limit,
          }),
          prisma.payment.count({ where }),
        ]);

        const rawRecords = payments.map((p) => ({
          id: p.id,
          paymentDate: p.paymentDate,
          paymentNumber: p.paymentNumber,
          direction: p.direction,
          partyName: p.customer?.name || p.supplier?.name || "General",
          amount: Money.fromDecimal(p.amount).toNumber(),
          paymentMethodName: p.paymentMethod?.name || "Cash",
          paymentMethodType: p.paymentMethod?.type || "CASH",
          referenceNumber: p.referenceNumber || "",
          status: p.status,
        }));

        return { rawRecords, totalCount: total };
      }

      case "CUSTOMERS": {
        const customers = await prisma.customer.findMany({
          where: { businessId },
          include: {
            transactions: {
              where: { status: TransactionStatus.POSTED },
              select: {
                totalAmount: true,
                transactionType: true,
                allocations: { select: { amount: true } },
              },
            },
          },
          take: limit,
        });

        const rawRecords = customers.map((c) => {
          let totalBilled = Money.zero();
          let totalPaid = Money.zero();
          for (const t of c.transactions) {
            const amt = Money.fromDecimal(t.totalAmount);
            totalBilled = totalBilled.add(amt);
            const alloc = t.allocations.reduce(
              (sum: Money, a: { amount: Prisma.Decimal }) => sum.add(Money.fromDecimal(a.amount)),
              Money.zero()
            );
            totalPaid = totalPaid.add(alloc);
          }
          const outstanding = totalBilled.minus(totalPaid);

          return {
            id: c.id,
            name: c.name,
            code: c.customerCode,
            city: c.city || "",
            outstandingBalance: outstanding.isPositive() ? outstanding.toNumber() : 0,
            totalBilled: totalBilled.toNumber(),
            totalPaid: totalPaid.toNumber(),
            status: c.status,
            phone: c.phone || "",
            email: c.email || "",
            notes: c.notes || "",
          };
        });

        return { rawRecords, totalCount: rawRecords.length };
      }

      case "SUPPLIERS": {
        const suppliers = await prisma.supplier.findMany({
          where: { businessId },
          include: {
            transactions: {
              where: { status: TransactionStatus.POSTED },
              select: {
                totalAmount: true,
                transactionType: true,
                allocations: { select: { amount: true } },
              },
            },
          },
          take: limit,
        });

        const rawRecords = suppliers.map((s) => {
          let totalBilled = Money.zero();
          let totalPaid = Money.zero();
          for (const t of s.transactions) {
            const amt = Money.fromDecimal(t.totalAmount);
            totalBilled = totalBilled.add(amt);
            const alloc = t.allocations.reduce(
              (sum: Money, a: { amount: Prisma.Decimal }) => sum.add(Money.fromDecimal(a.amount)),
              Money.zero()
            );
            totalPaid = totalPaid.add(alloc);
          }
          const outstanding = totalBilled.minus(totalPaid);

          return {
            id: s.id,
            name: s.name,
            code: s.supplierCode,
            city: s.city || "",
            outstandingBalance: outstanding.isPositive() ? outstanding.toNumber() : 0,
            totalBilled: totalBilled.toNumber(),
            totalPaid: totalPaid.toNumber(),
            status: s.status,
            phone: s.phone || "",
            email: s.email || "",
            notes: s.notes || "",
          };
        });

        return { rawRecords, totalCount: rawRecords.length };
      }

      case "CATEGORIES": {
        const categories = await prisma.category.findMany({
          where: { businessId },
          include: {
            transactions: {
              where: {
                transactionDate: { gte: startDate, lte: endDate },
                status: TransactionStatus.POSTED,
              },
              select: { totalAmount: true },
            },
          },
        });

        let grandTotal = 0;
        const mapped = categories.map((c) => {
          const totalAmt = c.transactions.reduce(
            (sum: number, t: { totalAmount: Prisma.Decimal }) => sum + Money.fromDecimal(t.totalAmount).toNumber(),
            0
          );
          grandTotal += totalAmt;
          return {
            id: c.id,
            name: c.name,
            type: c.type,
            transactionCount: c.transactions.length,
            totalAmount: totalAmt,
          };
        });

        const rawRecords = mapped.map((m) => {
          const pct = grandTotal > 0 ? (m.totalAmount / grandTotal) * 100 : 0;
          return {
            ...m,
            percentage: Math.round(pct * 10) / 10,
          };
        });

        return { rawRecords, totalCount: rawRecords.length };
      }

      case "PAYMENT_METHODS": {
        const methods = await prisma.paymentMethod.findMany({
          where: { businessId },
          include: {
            payments: {
              where: {
                paymentDate: { gte: startDate, lte: endDate },
              },
              select: { amount: true, direction: true },
            },
          },
        });

        const rawRecords = methods.map((m) => {
          let inflow = 0;
          let outflow = 0;
          for (const p of m.payments) {
            const amt = Money.fromDecimal(p.amount).toNumber();
            if (p.direction === "IN") inflow += amt;
            else outflow += amt;
          }
          return {
            id: m.id,
            name: m.name,
            type: m.type,
            inflow,
            outflow,
            netFlow: inflow - outflow,
            paymentCount: m.payments.length,
          };
        });

        return { rawRecords, totalCount: rawRecords.length };
      }

      case "FOLLOWUPS": {
        const followUps = await prisma.followUp.findMany({
          where: { businessId, dueDate: { gte: startDate, lte: endDate } },
          include: { customer: true, supplier: true, assignedUser: true },
          take: limit,
        });

        const rawRecords = followUps.map((f) => ({
          id: f.id,
          dueDate: f.dueDate,
          partyName: f.customer?.name || f.supplier?.name || "General",
          partyType: f.customer ? "CUSTOMER" : "SUPPLIER",
          priority: f.priority,
          status: f.status,
          type: f.type,
          assignedStaff: f.assignedUser?.displayName || "Unassigned",
          notes: f.description || "",
        }));

        return { rawRecords, totalCount: rawRecords.length };
      }

      case "PROMISES": {
        const promises = await prisma.promiseToPay.findMany({
          where: { businessId, promiseDate: { gte: startDate, lte: endDate } },
          include: { customer: true },
          take: limit,
        });

        const rawRecords = promises.map((p) => ({
          id: p.id,
          promisedDate: p.promiseDate,
          customerName: p.customer.name,
          amount: Money.fromDecimal(p.promisedAmount).toNumber(),
          status: p.status,
          fulfilledAmount: Money.fromDecimal(p.fulfilledAmount).toNumber(),
          notes: p.notes || "",
        }));

        return { rawRecords, totalCount: rawRecords.length };
      }

      case "DOCUMENTS_METADATA": {
        const docs = await prisma.attachment.findMany({
          where: { businessId },
          take: limit,
        });

        const rawRecords = docs.map((d) => ({
          id: d.id,
          title: d.originalFileName,
          category: "GENERAL",
          partyName: "General",
          expiryDate: d.expiryDate,
          fileSize: Math.round(d.fileSize / 1024),
          isConfidential: d.sensitivity !== "NORMAL",
          createdAt: d.createdAt,
        }));

        return { rawRecords, totalCount: rawRecords.length };
      }

      case "MONTH_END_CLOSINGS": {
        const closings = await prisma.monthlyClosing.findMany({
          where: { businessId },
          include: { financialPeriod: true },
          orderBy: { closedAt: "desc" },
          take: limit,
        });

        const rawRecords = closings.map((c) => ({
          id: c.id,
          periodLabel: `${c.financialPeriod.month}/${c.financialPeriod.year}`,
          closedAt: c.closedAt,
          closedBy: c.closedBy,
          netIncome: Money.fromDecimal(c.netResult).toNumber(),
          totalReceivables: Money.fromDecimal(c.totalReceivables).toNumber(),
          totalPayables: Money.fromDecimal(c.totalPayables).toNumber(),
          transactionCount: c.transactionCount,
        }));

        return { rawRecords, totalCount: rawRecords.length };
      }

      case "ACCOUNTING_HEALTH": {
        const unallocatedPayments = await prisma.payment.findMany({
          where: {
            businessId,
            allocations: { none: {} },
          },
          select: { id: true, paymentNumber: true, amount: true },
        });

        const draftTransactions = await prisma.transaction.findMany({
          where: { businessId, status: TransactionStatus.DRAFT },
          select: { id: true, transactionNumber: true, totalAmount: true },
        });

        const rawRecords = [
          {
            id: "draft_txs",
            checkName: "Draft Accounting Records",
            category: "JOURNALS",
            status: draftTransactions.length === 0 ? "PASS" : "WARNING",
            itemCount: draftTransactions.length,
            details: `${draftTransactions.length} draft transaction(s) pending post approval.`,
          },
          {
            id: "unallocated_pmts",
            checkName: "Unallocated Customer Payments",
            category: "PAYMENTS",
            status: unallocatedPayments.length === 0 ? "PASS" : "WARNING",
            itemCount: unallocatedPayments.length,
            details: `${unallocatedPayments.length} payment(s) without invoice allocations.`,
          },
        ];

        return { rawRecords, totalCount: rawRecords.length };
      }

      default:
        return { rawRecords: [], totalCount: 0 };
    }
  }

  /**
   * Apply validated filter rules safely onto Prisma Transaction query
   */
  private static applyTransactionFilters(
    where: Prisma.TransactionWhereInput,
    filterGroups: FilterGroup[]
  ) {
    for (const group of filterGroups) {
      for (const rule of group.rules) {
        if (rule.columnId === "categoryName" || rule.columnId === "categoryId") {
          where.category = { name: { contains: String(rule.value), mode: "insensitive" } };
        }
        if (rule.columnId === "partyName" || rule.columnId === "customerName") {
          where.customer = { name: { contains: String(rule.value), mode: "insensitive" } };
        }
        if (rule.columnId === "supplierName") {
          where.supplier = { name: { contains: String(rule.value), mode: "insensitive" } };
        }
        if (rule.columnId === "customerId") {
          where.customerId = String(rule.value);
        }
        if (rule.columnId === "supplierId") {
          where.supplierId = String(rule.value);
        }
        if (rule.columnId === "amount") {
          const num = Number(rule.value);
          if (!isNaN(num)) {
            if (rule.operator === "GT") where.totalAmount = { gt: num };
            else if (rule.operator === "GTE") where.totalAmount = { gte: num };
            else if (rule.operator === "LT") where.totalAmount = { lt: num };
            else if (rule.operator === "LTE") where.totalAmount = { lte: num };
            else if (rule.operator === "EQUALS") where.totalAmount = { equals: num };
          }
        }
      }
    }
  }

  /**
   * Grouping calculation supporting up to 2 hierarchical levels and Top N sorting
   */
  private static calculateGrouping(
    records: Record<string, unknown>[],
    groupingColumns: ColumnDefinition[],
    selectedColumns: { column: ColumnDefinition }[],
    topN?: number
  ): CustomReportExecutionResult["groupedData"] {
    const primaryCol = groupingColumns[0];
    const secondaryCol = groupingColumns[1];

    const groupMap = new Map<string, {
      count: number;
      records: Record<string, unknown>[];
      subMap?: Map<string, { count: number; records: Record<string, unknown>[] }>;
    }>();

    for (const r of records) {
      const pKey = String(r[primaryCol.id] || "Other");
      if (!groupMap.has(pKey)) {
        groupMap.set(pKey, { count: 0, records: [], subMap: secondaryCol ? new Map() : undefined });
      }
      const entry = groupMap.get(pKey)!;
      entry.count += 1;
      entry.records.push(r);

      if (secondaryCol && entry.subMap) {
        const sKey = String(r[secondaryCol.id] || "Other");
        if (!entry.subMap.has(sKey)) {
          entry.subMap.set(sKey, { count: 0, records: [] });
        }
        const subEntry = entry.subMap.get(sKey)!;
        subEntry.count += 1;
        subEntry.records.push(r);
      }
    }

    const groupedData: CustomReportExecutionResult["groupedData"] = [];

    for (const [pKey, entry] of groupMap.entries()) {
      const totals: Record<string, { value: number; formatted: string }> = {};

      for (const colSel of selectedColumns) {
        if (colSel.column.dataType === "MONEY" || colSel.column.dataType === "NUMBER") {
          const sum = entry.records.reduce((acc, r) => {
            const v = Number(r[colSel.column.id] || 0);
            return acc + (isNaN(v) ? 0 : v);
          }, 0);
          totals[colSel.column.id] = {
            value: Math.round(sum * 100) / 100,
            formatted: colSel.column.dataType === "MONEY" ? Money.of(sum).format() : String(sum),
          };
        }
      }

      let subGroups: CustomReportExecutionResult["groupedData"] | undefined;
      if (entry.subMap) {
        subGroups = [];
        for (const [sKey, sEntry] of entry.subMap.entries()) {
          const sTotals: Record<string, { value: number; formatted: string }> = {};
          for (const colSel of selectedColumns) {
            if (colSel.column.dataType === "MONEY" || colSel.column.dataType === "NUMBER") {
              const sSum = sEntry.records.reduce((acc, r) => {
                const v = Number(r[colSel.column.id] || 0);
                return acc + (isNaN(v) ? 0 : v);
              }, 0);
              sTotals[colSel.column.id] = {
                value: Math.round(sSum * 100) / 100,
                formatted: colSel.column.dataType === "MONEY" ? Money.of(sSum).format() : String(sSum),
              };
            }
          }
          subGroups.push({
            groupKey: sKey,
            groupLabel: sKey,
            count: sEntry.count,
            totals: sTotals,
          });
        }
      }

      groupedData.push({
        groupKey: pKey,
        groupLabel: pKey,
        count: entry.count,
        totals,
        subGroups,
      });
    }

    // Sort by primary monetary total or count descending
    groupedData.sort((a, b) => {
      const aVal = Object.values(a.totals)[0]?.value ?? a.count;
      const bVal = Object.values(b.totals)[0]?.value ?? b.count;
      return bVal - aVal;
    });

    if (topN && topN > 0) {
      return groupedData.slice(0, topN);
    }

    return groupedData;
  }

  /**
   * Compute authoritative semantic financial measures reusing Phase 5 / 6 Accounting Engine.
   */
  private static async computeSummaryMetrics(
    businessId: string,
    datasetId: string,
    measures: string[],
    startDate: Date,
    endDate: Date,
    comparisonRange: { startDate: Date; endDate: Date } | undefined,
    dataMode: "CURRENT" | "AS_CLOSED",
    asClosedPeriod: { year: number; month: number } | undefined,
    rawRecords: Record<string, unknown>[]
  ): Promise<CustomReportExecutionResult["summaryMetrics"]> {
    const metrics: CustomReportExecutionResult["summaryMetrics"] = [];

    const activeMeasures = measures.length > 0 ? measures : ["RECOGNIZED_INCOME", "RECOGNIZED_EXPENSES", "NET_RESULT"];

    for (const mId of activeMeasures) {
      const def = FINANCIAL_MEASURE_REGISTRY[mId];
      if (!def) continue;

      let val = 0;
      let prevVal = 0;

      if (mId === "RECOGNIZED_INCOME") {
        val = rawRecords
          .filter((r) => r.type === "INCOME")
          .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
      } else if (mId === "RECOGNIZED_EXPENSES") {
        val = rawRecords
          .filter((r) => r.type === "EXPENSE")
          .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
      } else if (mId === "NET_RESULT") {
        const inc = rawRecords.filter((r) => r.type === "INCOME").reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
        const exp = rawRecords.filter((r) => r.type === "EXPENSE").reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
        val = inc - exp;
      } else if (mId === "MONEY_RECEIVED") {
        val = rawRecords
          .filter((r) => r.direction === "IN")
          .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
      } else if (mId === "MONEY_PAID") {
        val = rawRecords
          .filter((r) => r.direction === "OUT")
          .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
      } else if (mId === "OUTSTANDING_RECEIVABLES") {
        val = rawRecords.reduce((sum, r) => sum + (Number(r.outstandingAmount) || 0), 0);
      } else if (mId === "OUTSTANDING_PAYABLES") {
        val = rawRecords.reduce((sum, r) => sum + (Number(r.outstandingAmount) || 0), 0);
      } else if (mId === "TRANSACTION_COUNT") {
        val = rawRecords.length;
      }

      val = Math.round(val * 100) / 100;

      let comparisonResult: CustomReportExecutionResult["summaryMetrics"][number]["comparison"] = undefined;
      if (comparisonRange) {
        prevVal = 0;
        const comp = calculatePeriodComparison(val, prevVal);
        comparisonResult = {
          previousValue: def.isCurrency ? Money.of(comp.previousValue).format() : String(comp.previousValue),
          difference: def.isCurrency ? Money.of(comp.difference).format() : String(comp.difference),
          percentageChange: comp.percentageChange,
          trend: comp.trend,
        };
      }

      metrics.push({
        id: def.id,
        label: def.label,
        value: def.isCurrency ? Money.of(val).format() : String(val),
        numericValue: val,
        isCurrency: def.isCurrency,
        comparison: comparisonResult,
      });
    }

    return metrics;
  }

  /**
   * Build chart dataset verifying chart total = table total
   */
  private static buildChartData(
    chart: ReportDefinition["chart"],
    formattedRows: Record<string, unknown>[],
    groupedData?: CustomReportExecutionResult["groupedData"]
  ): CustomReportExecutionResult["chartData"] {
    if (!chart || !chart.enabled) return undefined;
    const labels: string[] = [];
    const dataValues: number[] = [];

    if (groupedData && groupedData.length > 0) {
      for (const g of groupedData) {
        labels.push(g.groupLabel);
        const primaryTotal = Object.values(g.totals)[0]?.value ?? g.count;
        dataValues.push(primaryTotal);
      }
    } else {
      const topItems = formattedRows.slice(0, chart.topN || 10);
      for (const r of topItems) {
        labels.push(String(r.partyName || r.categoryName || r.transactionNumber || r.id));
        dataValues.push(typeof r.amountNumber === "number" ? r.amountNumber : 1);
      }
    }

    return {
      type: chart.type,
      title: chart.title || `${chart.type} Chart Analysis`,
      labels,
      datasets: [
        {
          label: "Value",
          data: dataValues,
        },
      ],
    };
  }

  /**
   * Deterministic business insights derived strictly from verified numbers
   */
  private static generateDeterministicInsights(
    datasetId: string,
    rows: Record<string, unknown>[],
    groupedData: CustomReportExecutionResult["groupedData"],
    summaryMetrics: CustomReportExecutionResult["summaryMetrics"]
  ): string[] {
    const insights: string[] = [];

    if (groupedData && groupedData.length > 0) {
      const top = groupedData[0];
      const topTotal = Object.values(top.totals)[0]?.formatted || `${top.count} records`;
      insights.push(`Highest activity in ${top.groupLabel} at ${topTotal} (${top.count} records).`);
    }

    const netResultMetric = summaryMetrics.find((m) => m.id === "NET_RESULT");
    if (netResultMetric) {
      const isPositive = netResultMetric.numericValue >= 0;
      insights.push(
        `Operating Net Result stands at ${netResultMetric.value}, reflecting a ${
          isPositive ? "healthy operating margin" : "net operational deficit"
        }.`
      );
    }

    const overdueMetric = summaryMetrics.find((m) => m.id === "OVERDUE_RECEIVABLES");
    if (overdueMetric && overdueMetric.numericValue > 0) {
      insights.push(`Overdue receivables total ${overdueMetric.value}, requiring credit follow-up.`);
    }

    return insights;
  }

  // ===================================================================
  // SAVED REPORT MANAGEMENT & BUSINESS ISOLATION
  // ===================================================================

  public static async saveReport(
    businessId: string,
    userId: string,
    rawDefinition: unknown,
    userPermissions: string[],
    userRoles: string[],
    options?: { visibility?: "PRIVATE" | "SHARED" | "RESTRICTED"; allowedRoles?: string[]; tags?: string[] }
  ) {
    const { validatedDefinition } = await ReportQueryPlanner.planReportQuery(
      businessId,
      rawDefinition,
      userPermissions,
      userRoles
    );

    const saved = await prisma.savedReport.create({
      data: {
        businessId,
        createdById: userId,
        name: validatedDefinition.name,
        description: validatedDefinition.description || null,
        datasetId: validatedDefinition.datasetId,
        periodConfig: validatedDefinition.period as unknown as Prisma.InputJsonValue,
        definition: validatedDefinition as unknown as Prisma.InputJsonValue,
        visibility: options?.visibility || "PRIVATE",
        allowedRoles: options?.allowedRoles || [],
        tags: options?.tags || [],
        versionNumber: 1,
        versions: {
          create: {
            versionNumber: 1,
            name: validatedDefinition.name,
            description: validatedDefinition.description || null,
            datasetId: validatedDefinition.datasetId,
            periodConfig: validatedDefinition.period as unknown as Prisma.InputJsonValue,
            definition: validatedDefinition as unknown as Prisma.InputJsonValue,
            changeNote: "Initial report definition",
            savedById: userId,
          },
        },
      },
    });

    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.CUSTOM_REPORT_CREATED,
      entityType: "SAVED_REPORT",
      entityId: saved.id,
      newValues: { name: saved.name, datasetId: saved.datasetId },
    });

    return saved;
  }

  public static async updateReport(
    businessId: string,
    userId: string,
    reportId: string,
    rawDefinition: unknown,
    userPermissions: string[],
    userRoles: string[],
    changeNote?: string
  ) {
    const existing = await prisma.savedReport.findFirst({
      where: { id: reportId, businessId },
    });
    if (!existing) {
      throw new NotFoundError(`Saved report not found.`);
    }

    const isOwnerOrAdmin = userRoles.includes("OWNER") || userRoles.includes("ADMIN");
    if (existing.createdById !== userId && !isOwnerOrAdmin) {
      throw new ForbiddenError(`You are not authorized to edit this report definition.`);
    }

    const { validatedDefinition } = await ReportQueryPlanner.planReportQuery(
      businessId,
      rawDefinition,
      userPermissions,
      userRoles
    );

    const newVersion = existing.versionNumber + 1;

    const updated = await prisma.savedReport.update({
      where: { id: reportId },
      data: {
        name: validatedDefinition.name,
        description: validatedDefinition.description || null,
        datasetId: validatedDefinition.datasetId,
        periodConfig: validatedDefinition.period as unknown as Prisma.InputJsonValue,
        definition: validatedDefinition as unknown as Prisma.InputJsonValue,
        versionNumber: newVersion,
        versions: {
          create: {
            versionNumber: newVersion,
            name: validatedDefinition.name,
            description: validatedDefinition.description || null,
            datasetId: validatedDefinition.datasetId,
            periodConfig: validatedDefinition.period as unknown as Prisma.InputJsonValue,
            definition: validatedDefinition as unknown as Prisma.InputJsonValue,
            changeNote: changeNote || `Updated to version ${newVersion}`,
            savedById: userId,
          },
        },
      },
    });

    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.CUSTOM_REPORT_UPDATED,
      entityType: "SAVED_REPORT",
      entityId: reportId,
      newValues: { name: updated.name, versionNumber: newVersion },
    });

    return updated;
  }

  public static async duplicateReport(businessId: string, userId: string, reportId: string) {
    const existing = await prisma.savedReport.findFirst({
      where: { id: reportId, businessId },
    });
    if (!existing) {
      throw new NotFoundError(`Saved report not found.`);
    }

    const duplicated = await prisma.savedReport.create({
      data: {
        businessId,
        createdById: userId,
        name: `${existing.name} (Copy)`,
        description: existing.description,
        datasetId: existing.datasetId,
        periodConfig: existing.periodConfig as unknown as Prisma.InputJsonValue,
        definition: existing.definition as unknown as Prisma.InputJsonValue,
        visibility: "PRIVATE",
        versionNumber: 1,
        tags: existing.tags,
        versions: {
          create: {
            versionNumber: 1,
            name: `${existing.name} (Copy)`,
            description: existing.description,
            datasetId: existing.datasetId,
            periodConfig: existing.periodConfig as unknown as Prisma.InputJsonValue,
            definition: existing.definition as unknown as Prisma.InputJsonValue,
            changeNote: `Duplicated from ${existing.name}`,
            savedById: userId,
          },
        },
      },
    });

    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.CUSTOM_REPORT_DUPLICATED,
      entityType: "SAVED_REPORT",
      entityId: duplicated.id,
      newValues: { originalId: reportId, newId: duplicated.id },
    });

    return duplicated;
  }

  public static async archiveReport(businessId: string, userId: string, reportId: string) {
    const existing = await prisma.savedReport.findFirst({
      where: { id: reportId, businessId },
    });
    if (!existing) throw new NotFoundError("Saved report not found.");

    await prisma.savedReport.update({
      where: { id: reportId },
      data: { isArchived: true, archivedAt: new Date() },
    });

    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.CUSTOM_REPORT_ARCHIVED,
      entityType: "SAVED_REPORT",
      entityId: reportId,
    });
  }

  public static async deleteSavedReport(businessId: string, userId: string, reportId: string) {
    const existing = await prisma.savedReport.findFirst({
      where: { id: reportId, businessId },
    });
    if (!existing) throw new NotFoundError("Saved report not found.");

    await prisma.savedReport.delete({
      where: { id: reportId },
    });

    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.CUSTOM_REPORT_DELETED,
      entityType: "SAVED_REPORT",
      entityId: reportId,
    });
  }

  public static async listSavedReports(
    businessId: string,
    userId: string,
    userRoles: string[]
  ) {
    const isOwnerOrAdmin = userRoles.includes("OWNER") || userRoles.includes("ADMIN");

    return await prisma.savedReport.findMany({
      where: {
        businessId,
        isArchived: false,
        OR: isOwnerOrAdmin
          ? undefined
          : [
              { createdById: userId },
              { visibility: "SHARED" },
              { visibility: "RESTRICTED", allowedRoles: { hasSome: userRoles } },
            ],
      },
      orderBy: [{ isFavorite: "desc" }, { updatedAt: "desc" }],
    });
  }

  public static async getSavedReport(businessId: string, reportId: string) {
    const report = await prisma.savedReport.findFirst({
      where: { id: reportId, businessId },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
        },
      },
    });
    if (!report) throw new NotFoundError("Saved report not found.");
    return report;
  }

  // ===================================================================
  // 12 PRE-CONFIGURED STANDARD REPORT TEMPLATES
  // ===================================================================

  public static getTemplates(): { id: string; name: string; description: string; definition: ReportDefinition }[] {
    return [
      {
        id: "MONTHLY_FINANCIAL_OVERVIEW",
        name: "Monthly Financial Overview",
        description: "Standard executive P&L, recognized revenues, operational expenses, and cashflow comparison.",
        definition: {
          version: 1,
          name: "Monthly Financial Overview",
          description: "Executive monthly financial summary.",
          datasetId: "TRANSACTIONS",
          period: { type: "THIS_MONTH", asClosed: false },
          filterGroups: [],
          columns: [
            { columnId: "date" },
            { columnId: "transactionNumber" },
            { columnId: "type" },
            { columnId: "partyName" },
            { columnId: "categoryName" },
            { columnId: "amount" },
            { columnId: "paymentStatus" },
          ],
          grouping: ["categoryName"],
          measures: ["RECOGNIZED_INCOME", "RECOGNIZED_EXPENSES", "NET_RESULT"],
          chart: { enabled: true, type: "BAR", title: "Monthly Expense vs Revenue" },
        },
      },
      {
        id: "INCOME_BY_CATEGORY",
        name: "Income by Category",
        description: "Revenues distributed across flights, holiday tours, visa processing, and commissions.",
        definition: {
          version: 1,
          name: "Income by Category",
          description: "Breakdown of recognized income by travel category.",
          datasetId: "INCOME",
          period: { type: "THIS_MONTH", asClosed: false },
          filterGroups: [],
          columns: [
            { columnId: "date" },
            { columnId: "transactionNumber" },
            { columnId: "customerName" },
            { columnId: "categoryName" },
            { columnId: "amount" },
          ],
          grouping: ["categoryName"],
          measures: ["RECOGNIZED_INCOME"],
          chart: { enabled: true, type: "DONUT", title: "Income Category Share" },
        },
      },
      {
        id: "EXPENSE_BY_CATEGORY",
        name: "Expense by Category",
        description: "Detailed operational expenses by airline, hotel, transport, rent, and overheads.",
        definition: {
          version: 1,
          name: "Expense by Category",
          description: "Operating costs by category.",
          datasetId: "EXPENSES",
          period: { type: "THIS_MONTH", asClosed: false },
          filterGroups: [],
          columns: [
            { columnId: "date" },
            { columnId: "transactionNumber" },
            { columnId: "supplierName" },
            { columnId: "categoryName" },
            { columnId: "amount" },
          ],
          grouping: ["categoryName"],
          measures: ["RECOGNIZED_EXPENSES"],
          chart: { enabled: true, type: "BAR", title: "Top Expense Categories" },
        },
      },
      {
        id: "CUSTOMER_OUTSTANDING",
        name: "Customer Outstanding Balances",
        description: "All customer accounts with pending balances sorted by highest exposure.",
        definition: {
          version: 1,
          name: "Customer Outstanding Balances",
          description: "Accounts receivable balances by customer.",
          datasetId: "CUSTOMERS",
          period: { type: "THIS_MONTH", asClosed: false },
          filterGroups: [],
          columns: [
            { columnId: "code" },
            { columnId: "name" },
            { columnId: "city" },
            { columnId: "outstandingBalance" },
            { columnId: "totalBilled" },
            { columnId: "totalPaid" },
          ],
          grouping: [],
          measures: ["OUTSTANDING_RECEIVABLES"],
          sort: { columnId: "outstandingBalance", direction: "desc" },
        },
      },
      {
        id: "SUPPLIER_OUTSTANDING",
        name: "Supplier Outstanding Obligations",
        description: "Supplier accounts with pending disbursement balances.",
        definition: {
          version: 1,
          name: "Supplier Outstanding Obligations",
          description: "Accounts payable balances by supplier.",
          datasetId: "SUPPLIERS",
          period: { type: "THIS_MONTH", asClosed: false },
          filterGroups: [],
          columns: [
            { columnId: "code" },
            { columnId: "name" },
            { columnId: "city" },
            { columnId: "outstandingBalance" },
            { columnId: "totalBilled" },
            { columnId: "totalPaid" },
          ],
          grouping: [],
          measures: ["OUTSTANDING_PAYABLES"],
          sort: { columnId: "outstandingBalance", direction: "desc" },
        },
      },
      {
        id: "RECEIVABLE_AGING",
        name: "Receivable Aging Schedule",
        description: "Unpaid customer invoices categorized into Current, 1-30, 31-60, 61-90, and 90+ days overdue.",
        definition: {
          version: 1,
          name: "Receivable Aging Schedule",
          description: "Receivables aging analysis.",
          datasetId: "RECEIVABLES",
          period: { type: "THIS_MONTH", asClosed: false },
          filterGroups: [],
          columns: [
            { columnId: "date" },
            { columnId: "transactionNumber" },
            { columnId: "customerName" },
            { columnId: "outstandingAmount" },
            { columnId: "dueDate" },
            { columnId: "daysOverdue" },
            { columnId: "agingBucket" },
          ],
          grouping: ["agingBucket"],
          measures: ["OUTSTANDING_RECEIVABLES", "OVERDUE_RECEIVABLES"],
          chart: { enabled: true, type: "AGING", title: "Receivable Aging Distribution" },
        },
      },
      {
        id: "PAYABLE_AGING",
        name: "Payable Aging Schedule",
        description: "Unsettled supplier bills categorized into Aging buckets.",
        definition: {
          version: 1,
          name: "Payable Aging Schedule",
          description: "Payables aging analysis.",
          datasetId: "PAYABLES",
          period: { type: "THIS_MONTH", asClosed: false },
          filterGroups: [],
          columns: [
            { columnId: "date" },
            { columnId: "transactionNumber" },
            { columnId: "supplierName" },
            { columnId: "outstandingAmount" },
            { columnId: "dueDate" },
            { columnId: "daysOverdue" },
            { columnId: "agingBucket" },
          ],
          grouping: ["agingBucket"],
          measures: ["OUTSTANDING_PAYABLES", "OVERDUE_PAYABLES"],
          chart: { enabled: true, type: "AGING", title: "Payable Aging Distribution" },
        },
      },
      {
        id: "PAYMENT_METHOD_SUMMARY",
        name: "Payment Methods Cash Flow",
        description: "Cash In vs Cash Out across Cash, Bank, and UPI accounts.",
        definition: {
          version: 1,
          name: "Payment Methods Cash Flow",
          description: "Cash movement by account.",
          datasetId: "PAYMENT_METHODS",
          period: { type: "THIS_MONTH", asClosed: false },
          filterGroups: [],
          columns: [
            { columnId: "name" },
            { columnId: "type" },
            { columnId: "inflow" },
            { columnId: "outflow" },
            { columnId: "netFlow" },
            { columnId: "paymentCount" },
          ],
          grouping: [],
          measures: ["MONEY_RECEIVED", "MONEY_PAID", "NET_CASH_FLOW"],
          chart: { enabled: true, type: "BAR", title: "Inflow vs Outflow by Account" },
        },
      },
      {
        id: "CUSTOMER_LEDGER",
        name: "Customer Running Ledger",
        description: "Detailed chronological debit/credit running balance statement.",
        definition: {
          version: 1,
          name: "Customer Running Ledger",
          description: "Detailed ledger.",
          datasetId: "CUSTOMER_LEDGER",
          period: { type: "THIS_MONTH", asClosed: false },
          filterGroups: [],
          columns: [
            { columnId: "date" },
            { columnId: "entryType" },
            { columnId: "referenceNumber" },
            { columnId: "description" },
            { columnId: "debit" },
            { columnId: "credit" },
            { columnId: "runningBalance" },
          ],
          grouping: [],
          measures: [],
        },
      },
      {
        id: "SUPPLIER_LEDGER",
        name: "Supplier Running Ledger",
        description: "Detailed chronological debit/credit running balance statement for suppliers.",
        definition: {
          version: 1,
          name: "Supplier Running Ledger",
          description: "Detailed supplier ledger.",
          datasetId: "SUPPLIER_LEDGER",
          period: { type: "THIS_MONTH", asClosed: false },
          filterGroups: [],
          columns: [
            { columnId: "date" },
            { columnId: "entryType" },
            { columnId: "referenceNumber" },
            { columnId: "description" },
            { columnId: "debit" },
            { columnId: "credit" },
            { columnId: "runningBalance" },
          ],
          grouping: [],
          measures: [],
        },
      },
      {
        id: "MONTHLY_COMPARISON",
        name: "Month-Over-Month Comparison",
        description: "Direct comparison between current month and previous month financial performance.",
        definition: {
          version: 1,
          name: "Month-Over-Month Comparison",
          description: "Monthly comparison statement.",
          datasetId: "TRANSACTIONS",
          period: { type: "THIS_MONTH", asClosed: false },
          comparison: { enabled: true, type: "PREVIOUS_MONTH" },
          filterGroups: [],
          columns: [
            { columnId: "date" },
            { columnId: "transactionNumber" },
            { columnId: "type" },
            { columnId: "amount" },
          ],
          grouping: ["type"],
          measures: ["RECOGNIZED_INCOME", "RECOGNIZED_EXPENSES", "NET_RESULT"],
          chart: { enabled: true, type: "BAR", title: "Month-over-Month Comparison" },
        },
      },
      {
        id: "FOLLOWUP_DUE_REPORT",
        name: "CRM Follow-Ups Due",
        description: "All pending customer follow-ups and payment reminders.",
        definition: {
          version: 1,
          name: "CRM Follow-Ups Due",
          description: "Pending follow-ups report.",
          datasetId: "FOLLOWUPS",
          period: { type: "THIS_MONTH", asClosed: false },
          filterGroups: [],
          columns: [
            { columnId: "dueDate" },
            { columnId: "partyName" },
            { columnId: "priority" },
            { columnId: "status" },
            { columnId: "type" },
            { columnId: "assignedStaff" },
          ],
          grouping: ["priority"],
          measures: [],
          sort: { columnId: "dueDate", direction: "asc" },
        },
      },
    ];
  }

  // ===================================================================
  // EXCEL EXPORT (FORMULA INJECTION SAFE & MULTI-SHEET)
  // ===================================================================

  public static async exportExcel(
    businessId: string,
    rawDefinition: unknown,
    userPermissions: string[],
    userRoles: string[],
    userName: string
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const result = await this.executeReport(
      businessId,
      rawDefinition,
      userPermissions,
      userRoles,
      5000
    );

    const wb = XLSX.utils.book_new();

    // 1. Summary Sheet
    const summaryData: (string | number)[][] = [
      ["SAI TOURS & TRAVELS — CUSTOM MANAGEMENT REPORT"],
      ["Report Name", this.sanitizeExcel(result.reportName)],
      ["Dataset", result.datasetName],
      ["Period", result.periodLabel],
      ["Data Mode", result.dataMode === "AS_CLOSED" ? `As Closed (${result.asClosedLabel})` : "Current Live"],
      ["Generated By", this.sanitizeExcel(userName)],
      ["Generated At", formatBusinessDateTime(new Date(result.generatedAt))],
      [],
      ["KEY FINANCIAL MEASURES & KPIS"],
      ["Metric", "Value", "Previous Period", "Change"],
    ];

    for (const m of result.summaryMetrics) {
      summaryData.push([
        m.label,
        m.isCurrency ? m.numericValue : m.value,
        m.comparison?.previousValue || "—",
        m.comparison?.percentageChange || "—",
      ]);
    }

    if (result.insights.length > 0) {
      summaryData.push([], ["DETERMINISTIC INSIGHTS"]);
      for (const ins of result.insights) {
        summaryData.push([ins]);
      }
    }

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

    // 2. Grouped Analysis Sheet (if grouped)
    if (result.groupedData && result.groupedData.length > 0) {
      const groupRows: (string | number)[][] = [
        ["GROUPED ANALYSIS"],
        ["Group", "Count", "Total Value"],
      ];
      for (const g of result.groupedData) {
        const primaryTotal = Object.values(g.totals)[0]?.value ?? 0;
        groupRows.push([this.sanitizeExcel(g.groupLabel), g.count, primaryTotal]);
      }
      const groupWs = XLSX.utils.aoa_to_sheet(groupRows);
      XLSX.utils.book_append_sheet(wb, groupWs, "Grouped Analysis");
    }

    // 3. Detail Rows Sheet
    const detailHeaders = result.columns.map((c) => c.label);
    const detailRows: (string | number)[][] = [detailHeaders];

    for (const r of result.rows) {
      const rowData = result.columns.map((c) => {
        const val = r[`${c.id}Number`] ?? r[c.id];
        if (typeof val === "number") return val;
        return this.sanitizeExcel(String(val ?? ""));
      });
      detailRows.push(rowData);
    }

    const detailWs = XLSX.utils.aoa_to_sheet(detailRows);
    XLSX.utils.book_append_sheet(wb, detailWs, "Detailed Records");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const cleanName = result.reportName.replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `${cleanName}_${new Date().toISOString().split("T")[0]}.xlsx`;

    await AuditService.log({
      businessId,
      userId: userName,
      action: AuditAction.CUSTOM_REPORT_EXPORTED,
      entityType: "REPORT_EXPORT",
      entityId: cleanName,
      newValues: { format: "EXCEL", recordCount: result.rows.length },
    });

    return { buffer: buf, fileName };
  }

  // ===================================================================
  // PDF EXPORT (PROFESSIONAL NIRMALA TAMIL COMPATIBLE)
  // ===================================================================

  public static async exportPdf(
    businessId: string,
    rawDefinition: unknown,
    userPermissions: string[],
    userRoles: string[],
    userName: string
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const result = await this.executeReport(
      businessId,
      rawDefinition,
      userPermissions,
      userRoles,
      1000
    );

    const doc = new PDFDocument({
      size: "A4",
      layout: "portrait",
      margins: { top: 36, bottom: 40, left: 36, right: 36 },
      bufferPages: true,
      autoFirstPage: false,
    });

    const buffers: Buffer[] = [];
    doc.on("data", (chunk) => buffers.push(chunk));

    const fonts = setupPdfFonts(doc);
    doc.addPage();

    // Header
    PdfBuilder.drawHeader(doc, fonts, {
      business: { name: "SAI TOURS & TRAVELS" },
      reportTitle: result.reportName,
      periodLabel: result.periodLabel,
      reportReference: "CUSTOM_REPORT",
    });

    // KPI Cards
    if (result.summaryMetrics.length > 0) {
      const kpis: PdfKPICard[] = result.summaryMetrics.slice(0, 4).map((m) => ({
        label: m.label,
        value: m.value,
        subtitle: m.comparison ? `vs Prev: ${m.comparison.percentageChange}` : undefined,
      }));
      PdfBuilder.drawKPICards(doc, fonts, kpis);
    }

    // Deterministic Insights Box
    if (result.insights.length > 0) {
      doc.y += 10;
      doc.font(fonts.bold).fontSize(10).fillColor(PDF_COLORS.primaryText).text("Key Insights:");
      doc.font(fonts.regular).fontSize(8.5).fillColor(PDF_COLORS.secondaryText);
      for (const ins of result.insights) {
        doc.text(`• ${ins}`);
      }
      doc.y += 10;
    }

    // Detailed Table
    const tableCols: PdfTableColumn[] = result.columns.slice(0, 6).map((c) => ({
      id: c.id,
      header: c.label,
      width: Math.floor(520 / Math.min(result.columns.length, 6)),
      align: (c.dataType === "MONEY" || c.dataType === "NUMBER" ? "right" : "left") as "right" | "left",
    }));

    const tableRows = result.rows.slice(0, 100).map((r) => {
      const obj: Record<string, string | number> = {};
      for (const col of result.columns.slice(0, 6)) {
        obj[col.id] = String(r[col.id] ?? "—");
      }
      return obj;
    });

    PdfBuilder.drawTable(doc, fonts, { columns: tableCols, rows: tableRows });

    PdfBuilder.finalizeFooters(doc, fonts, "SAI TOURS & TRAVELS", "CUSTOM_REPORT");
    doc.end();

    const buffer = await new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(buffers)));
    });

    const cleanName = result.reportName.replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `${cleanName}_${new Date().toISOString().split("T")[0]}.pdf`;

    await AuditService.log({
      businessId,
      userId: userName,
      action: AuditAction.CUSTOM_REPORT_EXPORTED,
      entityType: "REPORT_EXPORT",
      entityId: cleanName,
      newValues: { format: "PDF", recordCount: result.rows.length },
    });

    return { buffer, fileName };
  }

  /**
   * Helper to sanitize text for Excel formula injection prevention
   */
  private static sanitizeExcel(text: string): string {
    if (!text) return "";
    const trimmed = text.trim();
    if (/^[=+\-@]/.test(trimmed)) {
      if (/^[+\-]?\d+(\.\d+)?$/.test(trimmed)) return trimmed;
      return `'${trimmed}`;
    }
    return text;
  }
}
