import { DATASET_REGISTRY, listAvailableDatasets } from "./dataset-registry";
import { type ReportDefinition } from "./report-query-planner";

export interface AIReportProposalResult {
  understood: boolean;
  explanation: string;
  proposedDefinition?: ReportDefinition;
  unavailableMetricReason?: string;
}

export class AIReportPlannerService {
  /**
   * Parse natural language user intent into a safe, structured Report Definition proposal.
   * NEVER generates SQL. Rejects unverified or fabricated business metrics.
   */
  public static proposeReportDefinition(
    prompt: string,
    userPermissions: string[],
    userRoles: string[]
  ): AIReportProposalResult {
    const lower = prompt.toLowerCase().trim();

    // 1. Check for unsupported/invented metrics (e.g. "customer profitability", "employee performance score")
    if (lower.includes("customer profit") || lower.includes("profitability by customer") || lower.includes("supplier profit")) {
      return {
        understood: false,
        explanation: "Attributable customer or supplier profitability is not a verified financial metric in the current accounting engine. Net Result is maintained at the business level.",
        unavailableMetricReason: "Customer Profitability metric is not available in the verified financial model.",
      };
    }

    if (lower.includes("employee score") || lower.includes("staff performance rating")) {
      return {
        understood: false,
        explanation: "Subjective employee performance scores are not calculated. Operational task counts (e.g. completed follow-ups) can be reported instead.",
        unavailableMetricReason: "Subjective employee scoring is disallowed.",
      };
    }

    // 2. Identify Target Dataset
    let datasetId = "TRANSACTIONS";
    if (lower.includes("expense") || lower.includes("cost") || lower.includes("spending") || lower.includes("disbursement")) {
      datasetId = "EXPENSES";
    } else if (lower.includes("income") || lower.includes("revenue") || lower.includes("sales") || lower.includes("earning")) {
      datasetId = "INCOME";
    } else if (lower.includes("receivable") || lower.includes("unpaid invoice") || lower.includes("customer outstanding")) {
      datasetId = "RECEIVABLES";
    } else if (lower.includes("payable") || lower.includes("vendor bill") || lower.includes("supplier outstanding")) {
      datasetId = "PAYABLES";
    } else if (lower.includes("cash") || lower.includes("payment") || lower.includes("bank") || lower.includes("upi")) {
      datasetId = "PAYMENTS";
    } else if (lower.includes("follow up") || lower.includes("crm") || lower.includes("reminder")) {
      datasetId = "FOLLOWUPS";
    } else if (lower.includes("document") || lower.includes("passport") || lower.includes("visa expiry")) {
      datasetId = "DOCUMENTS_METADATA";
    } else if (lower.includes("closing") || lower.includes("month-end") || lower.includes("snapshot")) {
      datasetId = "MONTH_END_CLOSINGS";
    }

    // 3. Identify Period
    let periodType: ReportDefinition["period"]["type"] = "THIS_MONTH";
    let financialMonth: number | undefined;
    let financialYear: number | undefined;

    if (lower.includes("september 2026") || lower.includes("sep 2026")) {
      periodType = "FINANCIAL_PERIOD";
      financialYear = 2026;
      financialMonth = 9;
    } else if (lower.includes("october 2026") || lower.includes("oct 2026")) {
      periodType = "FINANCIAL_PERIOD";
      financialYear = 2026;
      financialMonth = 10;
    } else if (lower.includes("today")) {
      periodType = "TODAY";
    } else if (lower.includes("yesterday")) {
      periodType = "YESTERDAY";
    } else if (lower.includes("this week")) {
      periodType = "THIS_WEEK";
    } else if (lower.includes("last week")) {
      periodType = "LAST_WEEK";
    } else if (lower.includes("last month")) {
      periodType = "LAST_MONTH";
    } else if (lower.includes("this quarter")) {
      periodType = "THIS_QUARTER";
    } else if (lower.includes("last quarter")) {
      periodType = "LAST_QUARTER";
    } else if (lower.includes("this year")) {
      periodType = "THIS_YEAR";
    } else if (lower.includes("last year")) {
      periodType = "LAST_YEAR";
    }

    // 4. Identify Grouping
    const grouping: string[] = [];
    if (lower.includes("by category") || lower.includes("category")) {
      grouping.push("categoryName");
    } else if (lower.includes("by customer") || lower.includes("customer")) {
      grouping.push("partyName");
    } else if (lower.includes("by supplier") || lower.includes("supplier")) {
      grouping.push("partyName");
    } else if (lower.includes("by status")) {
      grouping.push("paymentStatus");
    } else if (lower.includes("by payment method")) {
      grouping.push("paymentMethod");
    } else if (lower.includes("by priority")) {
      grouping.push("priority");
    }

    // 5. Select Whitelisted Columns
    const available = listAvailableDatasets(userPermissions, userRoles);
    const datasetDef = available.find((d) => d.id === datasetId) || DATASET_REGISTRY[datasetId];
    const columns = datasetDef.defaultColumns.map((colId) => ({ columnId: colId }));

    // 6. Select Semantic Measures
    const measures: string[] = [];
    if (datasetId === "EXPENSES") {
      measures.push("RECOGNIZED_EXPENSES");
    } else if (datasetId === "INCOME") {
      measures.push("RECOGNIZED_INCOME");
    } else if (datasetId === "RECEIVABLES") {
      measures.push("OUTSTANDING_RECEIVABLES", "OVERDUE_RECEIVABLES");
    } else if (datasetId === "PAYABLES") {
      measures.push("OUTSTANDING_PAYABLES", "OVERDUE_PAYABLES");
    } else if (datasetId === "PAYMENTS") {
      measures.push("MONEY_RECEIVED", "MONEY_PAID");
    } else {
      measures.push("RECOGNIZED_INCOME", "RECOGNIZED_EXPENSES", "NET_RESULT");
    }

    // 7. Chart Configuration
    let chartType: "BAR" | "LINE" | "DONUT" | "AGING" = "BAR";
    const chartEnabled = true;
    if (lower.includes("trend") || lower.includes("timeline")) {
      chartType = "LINE";
    } else if (lower.includes("share") || lower.includes("distribution") || lower.includes("pie") || lower.includes("donut")) {
      chartType = "DONUT";
    } else if (datasetId === "RECEIVABLES" || datasetId === "PAYABLES") {
      chartType = "AGING";
    }

    const proposedDefinition: ReportDefinition = {
      version: 1,
      name: prompt.length > 50 ? `${prompt.substring(0, 47)}...` : prompt,
      description: `AI proposed report configuration for: "${prompt}"`,
      datasetId,
      period: {
        type: periodType,
        financialYear,
        financialMonth,
        asClosed: lower.includes("as closed"),
      },
      filterGroups: [],
      columns,
      grouping,
      measures,
      sort: datasetDef.defaultSort,
      chart: {
        enabled: chartEnabled,
        type: chartType,
        title: `${datasetDef.displayName} Analysis`,
      },
    };

    return {
      understood: true,
      explanation: `Proposed report targeting **${datasetDef.displayName}** for **${periodType.replace(/_/g, " ")}**${
        grouping.length > 0 ? ` grouped by **${grouping.join(", ")}**` : ""
      }. Visualized via **${chartType}** chart.`,
      proposedDefinition,
    };
  }
}
