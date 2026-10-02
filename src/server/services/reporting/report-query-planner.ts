import { z } from "zod";
import { DATASET_REGISTRY, type ColumnDefinition, type FilterOperator } from "./dataset-registry";
import { FINANCIAL_MEASURE_REGISTRY } from "./measure-registry";
import { ValidationError, ForbiddenError } from "@/lib/errors";
import { prisma } from "@/lib/db";
import {
  startOfDay,
  endOfDay,
  subDays,
  startOfWeek,
  endOfWeek,
  subWeeks,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfQuarter,
  endOfQuarter,
  subQuarters,
  startOfYear,
  endOfYear,
  subYears,
} from "date-fns";

// ===================================================================
// ZOD SCHEMAS FOR STRUCTURED REPORT DEFINITIONS (ZERO RAW SQL)
// ===================================================================

export const FilterRuleSchema = z.object({
  columnId: z.string().min(1).max(100),
  operator: z.string().min(1).max(50),
  value: z.union([
    z.string().max(250),
    z.number(),
    z.boolean(),
    z.array(z.string().max(100)).max(50),
    z.tuple([z.string().max(100), z.string().max(100)]),
    z.tuple([z.number(), z.number()]),
  ]),
});

export type FilterRule = z.infer<typeof FilterRuleSchema>;

export const FilterGroupSchema = z.object({
  combinator: z.enum(["AND", "OR"]).default("AND"),
  rules: z.array(FilterRuleSchema).max(10),
});

export type FilterGroup = z.infer<typeof FilterGroupSchema>;

export const PeriodTypeSchema = z.enum([
  "TODAY",
  "YESTERDAY",
  "THIS_WEEK",
  "LAST_WEEK",
  "THIS_MONTH",
  "LAST_MONTH",
  "THIS_QUARTER",
  "LAST_QUARTER",
  "THIS_YEAR",
  "LAST_YEAR",
  "FINANCIAL_PERIOD",
  "CUSTOM",
  "AS_CLOSED",
]);

export type ReportPeriodType = z.infer<typeof PeriodTypeSchema>;

export const PeriodConfigSchema = z.object({
  type: PeriodTypeSchema,
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  financialYear: z.number().int().min(2000).max(2100).optional(),
  financialMonth: z.number().int().min(1).max(12).optional(),
  asClosed: z.boolean().default(false),
});

export type ReportPeriodConfig = z.infer<typeof PeriodConfigSchema>;

export const ChartConfigSchema = z.object({
  enabled: z.boolean().default(false),
  type: z.enum(["BAR", "LINE", "AREA", "DONUT", "AGING", "KPI"]),
  xAxisColumnId: z.string().optional(),
  yAxisMeasureId: z.string().optional(),
  title: z.string().max(100).optional(),
  topN: z.number().int().min(3).max(50).optional(),
});

export type ChartConfig = z.infer<typeof ChartConfigSchema>;

export const ComparisonConfigSchema = z.object({
  enabled: z.boolean().default(false),
  type: z.enum([
    "PREVIOUS_PERIOD",
    "PREVIOUS_MONTH",
    "PREVIOUS_QUARTER",
    "PREVIOUS_YEAR",
    "SAME_PERIOD_LAST_YEAR",
    "CUSTOM",
  ]),
  customStartDate: z.string().optional(),
  customEndDate: z.string().optional(),
});

export type ComparisonConfig = z.infer<typeof ComparisonConfigSchema>;

export const ColumnSelectionSchema = z.object({
  columnId: z.string().min(1).max(100),
  customLabel: z.string().max(100).optional(),
  aggregation: z.enum(["COUNT", "SUM", "AVG", "MIN", "MAX"]).optional(),
});

export type ColumnSelection = z.infer<typeof ColumnSelectionSchema>;

export const ReportDefinitionSchema = z.object({
  version: z.number().int().default(1),
  name: z.string().min(1).max(150),
  description: z.string().max(500).optional(),
  datasetId: z.string().min(1).max(100),
  period: PeriodConfigSchema,
  filterGroups: z.array(FilterGroupSchema).max(3).default([]),
  columns: z.array(ColumnSelectionSchema).min(1).max(30),
  grouping: z.array(z.string().max(100)).max(2).default([]),
  measures: z.array(z.string().max(100)).default([]),
  sort: z.object({
    columnId: z.string().max(100),
    direction: z.enum(["asc", "desc"]),
  }).optional(),
  topN: z.number().int().min(1).max(100).optional(),
  comparison: ComparisonConfigSchema.optional(),
  chart: ChartConfigSchema.optional(),
  notes: z.string().max(1000).optional(),
});

export type ReportDefinition = z.infer<typeof ReportDefinitionSchema>;

export interface PlannedQueryScope {
  businessId: string;
  datasetId: string;
  dataMode: "CURRENT" | "AS_CLOSED";
  asClosedPeriod?: { year: number; month: number; label: string };
  dateRange: { startDate: Date; endDate: Date; label: string };
  comparisonDateRange?: { startDate: Date; endDate: Date; label: string };
  sanitizedColumns: { column: ColumnDefinition; customLabel: string; aggregation?: string }[];
  sanitizedFilters: FilterGroup[];
  groupingColumns: ColumnDefinition[];
  measures: string[];
  sort: { columnId: string; direction: "asc" | "desc" };
  topN?: number;
  chart?: ChartConfig;
  notes?: string;
}

// ===================================================================
// QUERY PLANNER: STRICT VALIDATION & TENANT ISOLATION
// ===================================================================

export class ReportQueryPlanner {
  /**
   * Validate full report definition against dataset registry, user permissions, and tenant isolation.
   */
  public static async planReportQuery(
    businessId: string,
    rawDefinition: unknown,
    userPermissions: string[],
    userRoles: string[]
  ): Promise<{ plannedScope: PlannedQueryScope; validatedDefinition: ReportDefinition }> {
    // 1. Zod schema validation
    const parsed = ReportDefinitionSchema.safeParse(rawDefinition);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
      throw new ValidationError(`Invalid report definition: ${errorMsg}`);
    }
    const def = parsed.data;

    // 2. Dataset whitelist & permission validation
    const dataset = DATASET_REGISTRY[def.datasetId];
    if (!dataset) {
      throw new ValidationError(`Unknown or unauthorized dataset: "${def.datasetId}"`);
    }

    const isOwnerOrAdmin = userRoles.includes("OWNER") || userRoles.includes("ADMIN");
    if (!isOwnerOrAdmin && !userPermissions.includes(dataset.requiredPermission)) {
      throw new ForbiddenError(`You lack permission [${dataset.requiredPermission}] to query dataset "${dataset.displayName}"`);
    }

    // 3. Columns validation & sensitive columns protection
    const columnMap = new Map<string, ColumnDefinition>();
    for (const col of dataset.columns) {
      columnMap.set(col.id, col);
    }

    const sanitizedColumns: { column: ColumnDefinition; customLabel: string; aggregation?: string }[] = [];
    for (const colSel of def.columns) {
      const colDef = columnMap.get(colSel.columnId);
      if (!colDef) {
        throw new ValidationError(`Invalid column "${colSel.columnId}" for dataset "${dataset.displayName}"`);
      }

      // Sensitive column check
      if (colDef.isSensitive && colDef.requiredPermission) {
        if (!isOwnerOrAdmin && !userPermissions.includes(colDef.requiredPermission)) {
          throw new ForbiddenError(`You lack permission [${colDef.requiredPermission}] to include sensitive column "${colDef.label}"`);
        }
      }

      // Aggregation validation if specified
      if (colSel.aggregation) {
        if (!colDef.aggregations?.includes(colSel.aggregation as "SUM" | "AVG" | "COUNT" | "MIN" | "MAX")) {
          throw new ValidationError(`Aggregation "${colSel.aggregation}" is not supported on column "${colDef.label}"`);
        }
      }

      // Safe display label: sanitize HTML/script characters
      const customLabel = (colSel.customLabel || colDef.label).replace(/[<>{}]/g, "").trim();

      sanitizedColumns.push({
        column: colDef,
        customLabel: customLabel || colDef.label,
        aggregation: colSel.aggregation,
      });
    }

    // 4. Grouping validation
    const groupingColumns: ColumnDefinition[] = [];
    for (const gId of def.grouping) {
      const colDef = columnMap.get(gId);
      if (!colDef) {
        throw new ValidationError(`Unknown grouping column "${gId}"`);
      }
      if (!colDef.groupable) {
        throw new ValidationError(`Column "${colDef.label}" cannot be used for grouping`);
      }
      groupingColumns.push(colDef);
    }

    // 5. Semantic measures validation
    for (const measureId of def.measures) {
      const measureDef = FINANCIAL_MEASURE_REGISTRY[measureId];
      if (!measureDef) {
        throw new ValidationError(`Unknown financial measure: "${measureId}"`);
      }
      if (!measureDef.supportedDatasets.includes(def.datasetId)) {
        throw new ValidationError(`Measure "${measureDef.label}" is not supported on dataset "${dataset.displayName}"`);
      }
      if (!isOwnerOrAdmin && !userPermissions.includes(measureDef.requiredPermission)) {
        throw new ForbiddenError(`You lack permission [${measureDef.requiredPermission}] to query measure "${measureDef.label}"`);
      }
    }

    // 6. Tenant isolation validation on filter values
    await this.validateFilterValues(businessId, def.filterGroups, columnMap);

    // 7. Period and Data Mode Resolution
    const { dateRange, dataMode, asClosedPeriod } = await this.resolvePeriodAndMode(
      businessId,
      def.period,
      dataset.supportsAsClosed
    );

    // 8. Comparison Date Range Resolution (if enabled)
    let comparisonDateRange: { startDate: Date; endDate: Date; label: string } | undefined;
    if (def.comparison?.enabled) {
      comparisonDateRange = this.resolveComparisonRange(dateRange.startDate, dateRange.endDate, def.comparison);
    }

    // 9. Sorting validation
    let sort = def.sort || dataset.defaultSort;
    if (sort) {
      const sortCol = columnMap.get(sort.columnId);
      if (!sortCol && !FINANCIAL_MEASURE_REGISTRY[sort.columnId]) {
        sort = dataset.defaultSort;
      }
    }

    const plannedScope: PlannedQueryScope = {
      businessId,
      datasetId: def.datasetId,
      dataMode,
      asClosedPeriod,
      dateRange,
      comparisonDateRange,
      sanitizedColumns,
      sanitizedFilters: def.filterGroups,
      groupingColumns,
      measures: def.measures,
      sort,
      topN: def.topN,
      chart: def.chart,
      notes: def.notes,
    };

    return { plannedScope, validatedDefinition: def };
  }

  /**
   * Validate filter values to guarantee strict tenant isolation (no cross-tenant party leakage)
   */
  private static async validateFilterValues(
    businessId: string,
    filterGroups: FilterGroup[],
    columnMap: Map<string, ColumnDefinition>
  ): Promise<void> {
    for (const group of filterGroups) {
      for (const rule of group.rules) {
        const colDef = columnMap.get(rule.columnId);
        if (!colDef) {
          throw new ValidationError(`Filter references unknown column: "${rule.columnId}"`);
        }

        if (!colDef.allowedOperators.includes(rule.operator as FilterOperator)) {
          throw new ValidationError(
            `Operator "${rule.operator}" is not permitted for column "${colDef.label}" (Type: ${colDef.dataType})`
          );
        }

        // Cross-business validation on foreign IDs
        if (rule.columnId === "customerId" || rule.columnId === "customerName") {
          if (typeof rule.value === "string" && (rule.value.startsWith("c") || rule.columnId === "customerId")) {
            let exists: { id: string } | null = null;
            try {
              exists = await prisma.customer.findFirst({
                where: { id: rule.value, businessId },
                select: { id: true },
              });
            } catch {
              exists = null;
            }
            if (!exists) {
              throw new ForbiddenError(`Customer filter value is invalid or belongs to another business.`);
            }
          }
        }

        if (rule.columnId === "supplierId" || rule.columnId === "supplierName") {
          if (typeof rule.value === "string" && (rule.value.startsWith("c") || rule.columnId === "supplierId")) {
            let exists: { id: string } | null = null;
            try {
              exists = await prisma.supplier.findFirst({
                where: { id: rule.value, businessId },
                select: { id: true },
              });
            } catch {
              exists = null;
            }
            if (!exists) {
              throw new ForbiddenError(`Supplier filter value is invalid or belongs to another business.`);
            }
          }
        }

        // Amount filters must be valid decimal numbers
        if (colDef.dataType === "MONEY" || colDef.dataType === "NUMBER") {
          if (typeof rule.value === "string" && isNaN(Number(rule.value))) {
            throw new ValidationError(`Filter value for "${colDef.label}" must be a valid number.`);
          }
        }
      }
    }
  }

  /**
   * Deterministic period and As-Closed snapshot resolution.
   */
  public static async resolvePeriodAndMode(
    businessId: string,
    periodConfig: ReportPeriodConfig,
    supportsAsClosed: boolean
  ): Promise<{
    dateRange: { startDate: Date; endDate: Date; label: string };
    dataMode: "CURRENT" | "AS_CLOSED";
    asClosedPeriod?: { year: number; month: number; label: string };
  }> {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;
    let label: string;
    let dataMode: "CURRENT" | "AS_CLOSED" = "CURRENT";
    let asClosedPeriod: { year: number; month: number; label: string } | undefined;

    switch (periodConfig.type) {
      case "TODAY":
        startDate = startOfDay(now);
        endDate = endOfDay(now);
        label = "Today";
        break;
      case "YESTERDAY": {
        const y = subDays(now, 1);
        startDate = startOfDay(y);
        endDate = endOfDay(y);
        label = "Yesterday";
        break;
      }
      case "THIS_WEEK":
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        endDate = endOfWeek(now, { weekStartsOn: 1 });
        label = "This Week";
        break;
      case "LAST_WEEK": {
        const lw = subWeeks(now, 1);
        startDate = startOfWeek(lw, { weekStartsOn: 1 });
        endDate = endOfWeek(lw, { weekStartsOn: 1 });
        label = "Last Week";
        break;
      }
      case "THIS_MONTH":
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        label = "This Month";
        break;
      case "LAST_MONTH": {
        const lm = subMonths(now, 1);
        startDate = startOfMonth(lm);
        endDate = endOfMonth(lm);
        label = "Last Month";
        break;
      }
      case "THIS_QUARTER":
        startDate = startOfQuarter(now);
        endDate = endOfQuarter(now);
        label = "This Quarter";
        break;
      case "LAST_QUARTER": {
        const lq = subQuarters(now, 1);
        startDate = startOfQuarter(lq);
        endDate = endOfQuarter(lq);
        label = "Last Quarter";
        break;
      }
      case "THIS_YEAR":
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        label = "This Year";
        break;
      case "LAST_YEAR": {
        const ly = subYears(now, 1);
        startDate = startOfYear(ly);
        endDate = endOfYear(ly);
        label = "Last Year";
        break;
      }
      case "FINANCIAL_PERIOD":
      case "AS_CLOSED": {
        const year = periodConfig.financialYear || now.getFullYear();
        const month = periodConfig.financialMonth || now.getMonth() + 1;
        startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
        endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
        const monthNames = [
          "January", "February", "March", "April", "May", "June",
          "July", "August", "September", "October", "November", "December"
        ];
        const periodLabel = `${monthNames[month - 1]} ${year}`;
        label = periodLabel;

        if (supportsAsClosed && periodConfig.asClosed) {
          dataMode = "AS_CLOSED";
          asClosedPeriod = { year, month, label: periodLabel };
        }
        break;
      }
      case "CUSTOM":
      default: {
        startDate = periodConfig.startDate ? startOfDay(new Date(periodConfig.startDate)) : startOfMonth(now);
        endDate = periodConfig.endDate ? endOfDay(new Date(periodConfig.endDate)) : endOfMonth(now);
        label = `${startDate.toISOString().split("T")[0]} to ${endDate.toISOString().split("T")[0]}`;
        break;
      }
    }

    return {
      dateRange: { startDate, endDate, label },
      dataMode,
      asClosedPeriod,
    };
  }

  /**
   * Resolve comparison date range based on comparison configuration
   */
  private static resolveComparisonRange(
    currStart: Date,
    currEnd: Date,
    comparison: ComparisonConfig
  ): { startDate: Date; endDate: Date; label: string } {
    switch (comparison.type) {
      case "PREVIOUS_PERIOD": {
        const durationMs = currEnd.getTime() - currStart.getTime();
        const prevEnd = new Date(currStart.getTime() - 1);
        const prevStart = new Date(prevEnd.getTime() - durationMs);
        return {
          startDate: prevStart,
          endDate: prevEnd,
          label: "Previous Period",
        };
      }
      case "PREVIOUS_MONTH": {
        const prevMonth = subMonths(currStart, 1);
        return {
          startDate: startOfMonth(prevMonth),
          endDate: endOfMonth(prevMonth),
          label: "Previous Month",
        };
      }
      case "PREVIOUS_QUARTER": {
        const prevQuarter = subQuarters(currStart, 1);
        return {
          startDate: startOfQuarter(prevQuarter),
          endDate: endOfQuarter(prevQuarter),
          label: "Previous Quarter",
        };
      }
      case "PREVIOUS_YEAR":
      case "SAME_PERIOD_LAST_YEAR": {
        return {
          startDate: subYears(currStart, 1),
          endDate: subYears(currEnd, 1),
          label: "Same Period Last Year",
        };
      }
      case "CUSTOM": {
        const cStart = comparison.customStartDate ? new Date(comparison.customStartDate) : subMonths(currStart, 1);
        const cEnd = comparison.customEndDate ? new Date(comparison.customEndDate) : subMonths(currEnd, 1);
        return {
          startDate: cStart,
          endDate: cEnd,
          label: "Custom Comparison",
        };
      }
    }
  }
}
