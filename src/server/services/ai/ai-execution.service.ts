import { prisma } from "@/lib/db";
import { Money } from "@/lib/money";
import { hasPermission } from "@/lib/auth/permissions";
import {
  AIChatMessage,
  AIIntent,
  AIInterpretationResult,
  AINoteItemDTO,
} from "@/types/ai";
import {
  TransactionType,
  TransactionStatus,
  PaymentMethodType,
  PromiseStatus,
  Prisma,
} from "@prisma/client";
import { MonthEndService } from "../month-end.service";
import { ReportDataService } from "../report-data.service";
import { AnalyticsService } from "../analytics.service";
import { AccountingService } from "../accounting.service";
import { RecordService } from "../record.service";
import { CRMService } from "../crm/crm.service";
import { FollowUpService } from "../crm/follow-up.service";

export interface UserContext {
  userId: string;
  businessId: string;
  permissions: string[];
  roles: string[];
}

export class AIExecutionService {
  /**
   * Safe mapping from AI Intent to required application permissions.
   * AI Permission ∩ Application Permission (Requirement 6, 7, 105)
   */
  private static getIntentRequiredPermissions(intent: AIIntent): string[] {
    switch (intent) {
      case "FILTER_RECORDS":
      case "SEARCH_RECORDS":
      case "FIND_DUPLICATES":
        return ["records.view"];

      case "GET_INCOME_TOTAL":
        return ["income.view"];

      case "GET_EXPENSE_TOTAL":
        return ["expenses.view"];

      case "GET_FINANCIAL_SUMMARY":
      case "GET_NET_RESULT":
      case "GET_PERIOD_COMPARISON":
        return ["income.view", "expenses.view"];

      case "GET_CASH_FLOW":
        return ["payments.view"];

      case "GET_RECEIVABLES":
        return ["receivables.view"];

      case "GET_PAYABLES":
        return ["payables.view"];

      case "GET_CUSTOMER_LEDGER":
        return ["customers.view", "receivables.view"];

      case "GET_SUPPLIER_LEDGER":
        return ["suppliers.view", "payables.view"];

      case "GET_MONTH_END_STATUS":
      case "EXPLAIN_CLOSE_FAILURE":
        return ["month_end.view"];

      case "GET_ACCOUNTING_HEALTH":
        return ["accounting.reconcile"];

      case "SEARCH_NOTES":
        return ["notes.view"];

      case "GET_FOLLOW_UPS_DUE":
        return ["followups.view"];

      case "GET_PROMISES_DUE":
        return ["promises.view"];

      case "GET_CUSTOMER_SUMMARY":
        return ["customers.view"];

      case "GET_SUPPLIER_PAYABLES_DUE":
        return ["payables.view"];

      case "PREPARE_EXPORT":
        return ["exports.execute"];

      case "EXPLAIN_CONCEPT":
      case "CLARIFICATION_NEEDED":
      case "UNKNOWN":
      default:
        return ["ai.use"];
    }
  }

  /**
   * Execute verified accounting query based on structured intent.
   * Multi-tenant scoped to user.businessId only.
   */
  public static async execute(
    rawQuery: string,
    interpretation: AIInterpretationResult,
    user: UserContext
  ): Promise<AIChatMessage> {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();
    const isTamil = interpretation.detectedLanguage === "ta";

    // 1. Verify primary AI permission (ai.use)
    if (!hasPermission(user.permissions, user.roles, "ai.use")) {
      return {
        id: messageId,
        role: "assistant",
        content: isTamil
          ? "மன்னிக்கவும், AI உதவியாளரைப் பயன்படுத்த உங்களுக்கு அனுமதி இல்லை (Permission: ai.use)."
          : "You do not have permission to use the AI Assistant (Permission: ai.use).",
        timestamp: nowIso,
        structuredData: {
          type: "PERMISSION_DENIED",
          permissionDenied: {
            missingPermission: "ai.use",
            explanation: "Access to AI Assistant requires the ai.use permission.",
          },
        },
      };
    }

    // 2. Verify Intent-specific permissions (Requirement 6, 7, 105)
    const requiredPerms = this.getIntentRequiredPermissions(interpretation.intent);
    for (const perm of requiredPerms) {
      if (!hasPermission(user.permissions, user.roles, perm)) {
        return {
          id: messageId,
          role: "assistant",
          content: isTamil
            ? `மன்னிக்கவும், இந்த தகவலைப் பார்க்க உங்களுக்கு அனுமதி இல்லை (${perm}).`
            : `Permission Denied: You do not have permission to view this financial information (${perm}).`,
          timestamp: nowIso,
          intent: interpretation.intent,
          structuredData: {
            type: "PERMISSION_DENIED",
            permissionDenied: {
              missingPermission: perm,
              explanation: `Viewing this accounting data requires the '${perm}' permission.`,
            },
          },
        };
      }
    }

    // 3. Resolve Ambiguous Customer / Supplier if needed (Requirement 20, 21, 106)
    if (interpretation.intent === "GET_CUSTOMER_LEDGER") {
      const matchWord = rawQuery.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/)?.[1] || "";
      if (matchWord && matchWord.toLowerCase() !== "show" && matchWord.toLowerCase() !== "ledger") {
        const matchingCustomers = await prisma.customer.findMany({
          where: {
            businessId: user.businessId,
            name: { contains: matchWord, mode: "insensitive" },
          },
          select: { id: true, name: true, customerCode: true },
          take: 5,
        });

        if (matchingCustomers.length > 1) {
          return {
            id: messageId,
            role: "assistant",
            content: `Multiple customers match "${matchWord}". Which customer's ledger would you like to view?`,
            timestamp: nowIso,
            intent: "CLARIFICATION_NEEDED",
            structuredData: {
              type: "CLARIFICATION",
              clarification: {
                prompt: `Select a customer to view ledger:`,
                options: matchingCustomers.map((c) => ({
                  label: `${c.name} (${c.customerCode})`,
                  value: `Show customer ledger for ${c.id}`,
                })),
              },
            },
          };
        } else if (matchingCustomers.length === 1) {
          interpretation.filters.customerId = matchingCustomers[0].id;
          interpretation.filters.customerName = matchingCustomers[0].name;
        }
      }
    }

    // 4. Resolve Date Range from filters
    let startDate: Date;
    let endDate: Date;
    let periodLabel: string;

    if (interpretation.filters.year && interpretation.filters.month) {
      const dates = MonthEndService.getPeriodDates(
        interpretation.filters.year,
        interpretation.filters.month
      );
      startDate = dates.startDate;
      endDate = dates.endDate;
      periodLabel = MonthEndService.getPeriodLabel(
        interpretation.filters.year,
        interpretation.filters.month
      );
    } else {
      const resolved = AnalyticsService.resolveDateRange({
        period: interpretation.filters.periodType || "this-month",
        now: new Date(),
      });
      startDate = resolved.startDate;
      endDate = resolved.endDate;
      periodLabel = resolved.label;
    }

    try {
      // 5. Dispatch Intent to Authorized Accounting Services
      switch (interpretation.intent) {
        // -------------------------------------------------------------
        // A. FILTER_RECORDS & SEARCH_RECORDS (Requirements 15, 100, 101)
        // -------------------------------------------------------------
        case "FILTER_RECORDS":
        case "SEARCH_RECORDS": {
          const type = interpretation.filters.transactionType;
          const recordsResult = await RecordService.getRecords(
            {
              type,
              startDate,
              endDate,
              minAmount: interpretation.filters.minAmount,
              maxAmount: interpretation.filters.maxAmount,
              search: interpretation.filters.searchKeyword,
              paymentStatus: interpretation.filters.paymentStatus,
              page: 1,
              pageSize: 15,
              sortBy: interpretation.filters.sortBy || "newest",
            },
            {
              userId: user.userId,
              businessId: user.businessId,
            }
          );

          // Compute total sum for displayed records
          let totalSum = Money.zero();
          for (const r of recordsResult.records) {
            totalSum = totalSum.add(Money.fromDecimal(r.totalAmount));
          }

          const recordsDTO = recordsResult.records.map((r) => ({
            id: r.id,
            transactionNumber: r.transactionNumber,
            title: r.title,
            transactionType: r.transactionType,
            status: r.status,
            paymentStatus: r.paymentStatus,
            transactionDate: r.transactionDate.toISOString().split("T")[0],
            amount: Money.fromDecimal(r.totalAmount).format(),
            categoryName: r.category?.name || "Uncategorized",
            partyName: r.customer?.name || r.supplier?.name,
            partyType: (r.customer ? "CUSTOMER" : r.supplier ? "SUPPLIER" : undefined) as "CUSTOMER" | "SUPPLIER" | undefined,
          }));

          const filterParams = new URLSearchParams();
          if (type) filterParams.set("type", type);
          if (startDate) filterParams.set("startDate", startDate.toISOString().split("T")[0]);
          if (endDate) filterParams.set("endDate", endDate.toISOString().split("T")[0]);
          if (interpretation.filters.minAmount) filterParams.set("minAmount", interpretation.filters.minAmount.toString());
          if (interpretation.filters.maxAmount) filterParams.set("maxAmount", interpretation.filters.maxAmount.toString());

          const filterUrl = `/records?${filterParams.toString()}`;
          const count = recordsResult.pagination.totalCount;

          let content = "";
          if (isTamil) {
            content = type === TransactionType.EXPENSE
              ? `${periodLabel} மொத்த செலவு: ${totalSum.format()} (${count} பதிவுகள்)`
              : `${periodLabel} பதிவுகள்: ${count} கண்டுபிடிக்கப்பட்டது (${totalSum.format()})`;
          } else {
            content = type === TransactionType.EXPENSE
              ? `Found ${count} expense record(s) for ${periodLabel} totaling ${totalSum.format()}.`
              : `Found ${count} transaction(s) for ${periodLabel} totaling ${totalSum.format()}.`;
          }

          return {
            id: messageId,
            role: "assistant",
            content,
            timestamp: nowIso,
            intent: interpretation.intent,
            sourceAttribution: "VERIFIED_ACCOUNTING_DATA",
            sourceLabel: "Verified Accounting Records",
            dataFreshnessTimestamp: nowIso,
            activeFilters: interpretation.filters,
            handoffAction: {
              type: "RECORDS",
              label: `View ${count} Records in Ledger`,
              url: filterUrl,
            },
            structuredData: {
              type: "RECORDS_LIST",
              recordsData: {
                totalCount: count,
                displayedCount: recordsDTO.length,
                records: recordsDTO,
                summaryAmount: totalSum.format(),
                filterLabel: periodLabel,
                filterUrl,
              },
            },
          };
        }

        // -------------------------------------------------------------
        // B. GET_INCOME_TOTAL (Requirement 25)
        // -------------------------------------------------------------
        case "GET_INCOME_TOTAL": {
          const summary = await ReportDataService.getFinancialSummaryReport({
            businessId: user.businessId,
            startDate,
            endDate,
          });

          const content = isTamil
            ? `${periodLabel} மொத்த வருமானம்: ${summary.totalIncome.format()}`
            : `Total recognized income for ${periodLabel} is ${summary.totalIncome.format()} across ${summary.transactionCount} transactions.`;

          return {
            id: messageId,
            role: "assistant",
            content,
            timestamp: nowIso,
            intent: interpretation.intent,
            sourceAttribution: "VERIFIED_ACCOUNTING_DATA",
            sourceLabel: "Verified Accounting Records",
            handoffAction: {
              type: "DASHBOARD",
              label: "Open Financial Dashboard",
              url: "/dashboard",
            },
            structuredData: {
              type: "FINANCIAL_SUMMARY",
              financialSummary: {
                periodLabel,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                openingBalance: summary.openingBalance.format(),
                totalIncome: summary.totalIncome.format(),
                totalExpenses: summary.totalExpenses.format(),
                netResult: summary.netResult.format(),
                moneyReceived: summary.moneyReceived.format(),
                moneyPaid: summary.moneyPaid.format(),
                closingCashPosition: summary.closingBalance.format(),
                receivablesOutstanding: summary.receivablesOutstanding.format(),
                payablesOutstanding: summary.payablesOutstanding.format(),
                transactionCount: summary.transactionCount,
                accountingBasis: summary.business.accountingBasis,
                isAsClosed: false,
              },
            },
          };
        }

        // -------------------------------------------------------------
        // C. GET_EXPENSE_TOTAL (Requirement 26)
        // -------------------------------------------------------------
        case "GET_EXPENSE_TOTAL": {
          const summary = await ReportDataService.getFinancialSummaryReport({
            businessId: user.businessId,
            startDate,
            endDate,
          });

          const content = isTamil
            ? `${periodLabel} மொத்த செலவு: ${summary.totalExpenses.format()}`
            : `Total recognized expenses for ${periodLabel} are ${summary.totalExpenses.format()}.`;

          return {
            id: messageId,
            role: "assistant",
            content,
            timestamp: nowIso,
            intent: interpretation.intent,
            sourceAttribution: "VERIFIED_ACCOUNTING_DATA",
            sourceLabel: "Verified Accounting Records",
            handoffAction: {
              type: "DASHBOARD",
              label: "Open Dashboard",
              url: "/dashboard",
            },
            structuredData: {
              type: "FINANCIAL_SUMMARY",
              financialSummary: {
                periodLabel,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                openingBalance: summary.openingBalance.format(),
                totalIncome: summary.totalIncome.format(),
                totalExpenses: summary.totalExpenses.format(),
                netResult: summary.netResult.format(),
                moneyReceived: summary.moneyReceived.format(),
                moneyPaid: summary.moneyPaid.format(),
                closingCashPosition: summary.closingBalance.format(),
                receivablesOutstanding: summary.receivablesOutstanding.format(),
                payablesOutstanding: summary.payablesOutstanding.format(),
                transactionCount: summary.transactionCount,
                accountingBasis: summary.business.accountingBasis,
                isAsClosed: false,
              },
            },
          };
        }

        // -------------------------------------------------------------
        // D. GET_NET_RESULT & FINANCIAL_SUMMARY (Requirements 27, 40)
        // -------------------------------------------------------------
        case "GET_NET_RESULT":
        case "GET_FINANCIAL_SUMMARY": {
          const summary = await ReportDataService.getFinancialSummaryReport({
            businessId: user.businessId,
            startDate,
            endDate,
          });

          let content = "";
          if (isTamil) {
            content = `${periodLabel} நிதி சுருக்கம்:\nவருமானம்: ${summary.totalIncome.format()}\nசெலவு: ${summary.totalExpenses.format()}\nநிகர முடிவு: ${summary.netResult.format()}`;
          } else {
            content = `Financial Summary for ${periodLabel}: Recognized Income is ${summary.totalIncome.format()}, Expenses are ${summary.totalExpenses.format()}, resulting in a Net Result of ${summary.netResult.format()} (${summary.business.accountingBasis} basis).`;
          }

          return {
            id: messageId,
            role: "assistant",
            content,
            timestamp: nowIso,
            intent: interpretation.intent,
            sourceAttribution: "VERIFIED_ACCOUNTING_DATA",
            sourceLabel: "Verified Accounting Records",
            handoffAction: {
              type: "DASHBOARD",
              label: "Open Dashboard",
              url: "/dashboard",
            },
            structuredData: {
              type: "FINANCIAL_SUMMARY",
              financialSummary: {
                periodLabel,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                openingBalance: summary.openingBalance.format(),
                totalIncome: summary.totalIncome.format(),
                totalExpenses: summary.totalExpenses.format(),
                netResult: summary.netResult.format(),
                moneyReceived: summary.moneyReceived.format(),
                moneyPaid: summary.moneyPaid.format(),
                closingCashPosition: summary.closingBalance.format(),
                receivablesOutstanding: summary.receivablesOutstanding.format(),
                payablesOutstanding: summary.payablesOutstanding.format(),
                transactionCount: summary.transactionCount,
                accountingBasis: summary.business.accountingBasis,
                isAsClosed: false,
              },
            },
          };
        }

        // -------------------------------------------------------------
        // E. GET_CASH_FLOW (Requirements 28, 29, 102)
        // -------------------------------------------------------------
        case "GET_CASH_FLOW": {
          const [cashFlow, paymentMethods] = await Promise.all([
            AccountingService.getCashMovement({
              businessId: user.businessId,
              startDate,
              endDate,
            }),
            AccountingService.getPaymentMethodSummaries({
              businessId: user.businessId,
            }),
          ]);

          const isUpi = interpretation.filters.paymentMethodType === PaymentMethodType.UPI;
          let content = "";

          if (isUpi) {
            const upiSummary = paymentMethods.find((m) => m.type === PaymentMethodType.UPI);
            const upiReceived = upiSummary ? upiSummary.inflow.format() : "₹0.00";
            content = isTamil
              ? `${periodLabel} UPI மூலம் பெறப்பட்ட மொத்த தொகை: ${upiReceived}`
              : `Money received via UPI in ${periodLabel} is ${upiReceived}.`;
          } else {
            content = isTamil
              ? `${periodLabel} ரொக்க வரவு: ${cashFlow.inflow.format()}, செலவு: ${cashFlow.outflow.format()}, நிகர மாற்றம்: ${cashFlow.netCashFlow.format()}`
              : `Cash movement for ${periodLabel}: Received ${cashFlow.inflow.format()}, Paid ${cashFlow.outflow.format()}, Net Movement ${cashFlow.netCashFlow.format()}.`;
          }

          return {
            id: messageId,
            role: "assistant",
            content,
            timestamp: nowIso,
            intent: interpretation.intent,
            sourceAttribution: "VERIFIED_ACCOUNTING_DATA",
            sourceLabel: "Verified Cash Movement Records",
            handoffAction: {
              type: "REPORT",
              label: "View Cash Movement Report",
              url: "/reports",
            },
            structuredData: {
              type: "FINANCIAL_SUMMARY",
              financialSummary: {
                periodLabel,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                openingBalance: "₹0.00",
                totalIncome: cashFlow.inflow.format(),
                totalExpenses: cashFlow.outflow.format(),
                netResult: cashFlow.netCashFlow.format(),
                moneyReceived: cashFlow.inflow.format(),
                moneyPaid: cashFlow.outflow.format(),
                closingCashPosition: cashFlow.netCashFlow.format(),
                receivablesOutstanding: "₹0.00",
                payablesOutstanding: "₹0.00",
                transactionCount: paymentMethods.reduce((acc, m) => acc + m.transactionCount, 0),
                accountingBasis: "CASH",
                isAsClosed: false,
              },
            },
          };
        }

        // -------------------------------------------------------------
        // F. GET_RECEIVABLES (As-Closed vs Current) (Requirements 30, 31, 32, 103, 104)
        // -------------------------------------------------------------
        case "GET_RECEIVABLES": {
          const isAsClosed = !!interpretation.filters.isAsClosed;
          const targetYear = interpretation.filters.year || 2026;
          const targetMonth = interpretation.filters.month || 9;

          if (isAsClosed) {
            // Retrieve frozen closing snapshot (Requirement 31 & 104)
            const period = await prisma.financialPeriod.findUnique({
              where: {
                businessId_year_month: {
                  businessId: user.businessId,
                  year: targetYear,
                  month: targetMonth,
                },
              },
              include: { closing: true },
            });

            if (period?.closing) {
              const snapshot = period.closing.snapshotData as Record<string, unknown>;
              const receivables = (snapshot?.receivables as Record<string, unknown>) || {};
              const totalOutstanding = (receivables.totalOutstanding as string) || Money.fromDecimal(period.closing.totalReceivables).format();

              const content = isTamil
                ? `${MonthEndService.getPeriodLabel(targetYear, targetMonth)} மாத முடிவின் போது (As Closed) வாடிக்கையாளர் நிலுவைத் தொகை: ${totalOutstanding}`
                : `Customer receivables outstanding when ${MonthEndService.getPeriodLabel(targetYear, targetMonth)} closed: ${totalOutstanding} (Source: Closing Snapshot v${period.closing.snapshotData ? (snapshot.version || 1) : 1}).`;

              return {
                id: messageId,
                role: "assistant",
                content,
                timestamp: nowIso,
                intent: interpretation.intent,
                sourceAttribution: "CLOSING_SNAPSHOT",
                sourceLabel: `${MonthEndService.getPeriodLabel(targetYear, targetMonth)} Closing Snapshot`,
                handoffAction: {
                  type: "MONTH_END",
                  label: "View Month-End Closing Snapshot",
                  url: `/month-end/${targetYear}-${String(targetMonth).padStart(2, "0")}`,
                },
                structuredData: {
                  type: "RECEIVABLE_LIST",
                  receivableData: {
                    partyType: "CUSTOMER",
                    totalOutstanding,
                    totalOverdue: "₹0.00",
                    partyCount: Array.isArray(receivables.items) ? receivables.items.length : 1,
                    items: [],
                    isAsClosed: true,
                  },
                },
              };
            }
          }

          // Live Current Receivables
          const [recSummary, aging, customerSummaries] = await Promise.all([
            AccountingService.getReceivablesSummary({ businessId: user.businessId }),
            AccountingService.getAgingAnalysis({ businessId: user.businessId, type: "RECEIVABLE" }),
            ReportDataService.getCustomerSummaryReport({ businessId: user.businessId }),
          ]);

          const items = customerSummaries.map((c) => ({
            partyId: c.id,
            partyName: c.name,
            partyCode: c.code,
            totalBilled: c.totalBilled.format(),
            totalPaid: c.totalPaid.format(),
            outstanding: c.outstanding.format(),
            overdueAmount: "₹0.00",
          }));

          const totalOutstanding = recSummary.totalReceivables.format();
          const totalOverdue = recSummary.overdueAmount.format();

          const content = isTamil
            ? `தற்போதைய மொத்த வாடிக்கையாளர் நிலுவைத் தொகை: ${totalOutstanding} (காலாவதியானது: ${totalOverdue}).`
            : `Current total receivables outstanding: ${totalOutstanding} across ${items.length} customer(s). Total overdue: ${totalOverdue}.`;

          return {
            id: messageId,
            role: "assistant",
            content,
            timestamp: nowIso,
            intent: interpretation.intent,
            sourceAttribution: "VERIFIED_ACCOUNTING_DATA",
            sourceLabel: "Live Customer Ledgers",
            handoffAction: {
              type: "RECORDS",
              label: "View Receivables Ledger",
              url: "/receivables",
            },
            structuredData: {
              type: "RECEIVABLE_LIST",
              receivableData: {
                partyType: "CUSTOMER",
                totalOutstanding,
                totalOverdue,
                partyCount: items.length,
                items: items.slice(0, 10),
                agingSchedule: {
                  current: aging.current.amount.format(),
                  days1To30: aging.days1To30.amount.format(),
                  days31To60: aging.days31To60.amount.format(),
                  days61To90: aging.days61To90.amount.format(),
                  days90Plus: aging.days90Plus.amount.format(),
                },
                isAsClosed: false,
              },
            },
          };
        }

        // -------------------------------------------------------------
        // G. GET_PAYABLES (Requirements 33, 105)
        // -------------------------------------------------------------
        case "GET_PAYABLES": {
          const [paySummary, aging, supplierSummaries] = await Promise.all([
            AccountingService.getPayablesSummary({ businessId: user.businessId }),
            AccountingService.getAgingAnalysis({ businessId: user.businessId, type: "PAYABLE" }),
            ReportDataService.getSupplierSummaryReport({ businessId: user.businessId }),
          ]);

          const items = supplierSummaries.map((s) => ({
            partyId: s.id,
            partyName: s.name,
            partyCode: s.code,
            totalBilled: s.totalBilled.format(),
            totalPaid: s.totalPaid.format(),
            outstanding: s.outstanding.format(),
            overdueAmount: "₹0.00",
          }));

          const totalOutstanding = paySummary.totalPayables.format();

          const content = isTamil
            ? `விற்பனையாளர்களுக்கு செலுத்த வேண்டிய மொத்த தொகை: ${totalOutstanding} (${items.length} சப்ளையர்கள்).`
            : `Total supplier payables outstanding: ${totalOutstanding} across ${items.length} supplier(s).`;

          return {
            id: messageId,
            role: "assistant",
            content,
            timestamp: nowIso,
            intent: interpretation.intent,
            sourceAttribution: "VERIFIED_ACCOUNTING_DATA",
            sourceLabel: "Live Supplier Ledgers",
            handoffAction: {
              type: "RECORDS",
              label: "View Payables Ledger",
              url: "/payables",
            },
            structuredData: {
              type: "PAYABLE_LIST",
              payableData: {
                partyType: "SUPPLIER",
                totalOutstanding,
                totalOverdue: paySummary.overdueAmount.format(),
                partyCount: items.length,
                items: items.slice(0, 10),
                agingSchedule: {
                  current: aging.current.amount.format(),
                  days1To30: aging.days1To30.amount.format(),
                  days31To60: aging.days31To60.amount.format(),
                  days61To90: aging.days61To90.amount.format(),
                  days90Plus: aging.days90Plus.amount.format(),
                },
                isAsClosed: false,
              },
            },
          };
        }

        // -------------------------------------------------------------
        // G2. GET_CUSTOMER_LEDGER (Requirement 35)
        // -------------------------------------------------------------
        case "GET_CUSTOMER_LEDGER": {
          if (!interpretation.filters.customerId) {
            const firstCustomer = await prisma.customer.findFirst({
              where: { businessId: user.businessId },
              select: { id: true, name: true, customerCode: true },
            });
            if (firstCustomer) {
              interpretation.filters.customerId = firstCustomer.id;
              interpretation.filters.customerName = firstCustomer.name;
            } else {
              return {
                id: messageId,
                role: "assistant",
                content: "No customers found in your records.",
                timestamp: nowIso,
                intent: interpretation.intent,
              };
            }
          }

          const ledger = await ReportDataService.getCustomerLedgerReport(
            user.businessId,
            interpretation.filters.customerId!,
            startDate,
            endDate
          );

          const content = isTamil
            ? `${ledger.customer.name} அவர்களின் பேரேடு சுருக்கம்: தொடக்க இருப்பு ${ledger.openingBalance.format()}, மொத்த பற்று ${ledger.totalDebits.format()}, வரவு ${ledger.totalCredits.format()}, தற்போதைய நிலுவை ${ledger.closingBalance.format()}.`
            : `Customer Ledger for ${ledger.customer.name} (${ledger.customer.customerCode}): Opening ${ledger.openingBalance.format()}, Debits ${ledger.totalDebits.format()}, Credits ${ledger.totalCredits.format()}, Current Balance ${ledger.closingBalance.format()}.`;

          return {
            id: messageId,
            role: "assistant",
            content,
            timestamp: nowIso,
            intent: interpretation.intent,
            sourceAttribution: "CUSTOMER_LEDGER",
            sourceLabel: "Customer Ledger Service",
            handoffAction: {
              type: "LEDGER",
              label: `Open Full Ledger for ${ledger.customer.name}`,
              url: `/customers/${ledger.customer.id}/ledger`,
            },
            structuredData: {
              type: "LEDGER_SUMMARY",
              ledgerData: {
                partyId: ledger.customer.id,
                partyName: ledger.customer.name,
                partyType: "CUSTOMER",
                openingBalance: ledger.openingBalance.format(),
                totalBilled: ledger.totalDebits.format(),
                totalPaid: ledger.totalCredits.format(),
                currentBalance: ledger.closingBalance.format(),
                periodLabel,
                entriesCount: ledger.entries.length,
                recentEntries: ledger.entries.slice(-5).map((e) => ({
                  date: e.date.toISOString().split("T")[0],
                  reference: e.entityNumber,
                  description: e.description,
                  type: e.type,
                  debit: e.debit.format(),
                  credit: e.credit.format(),
                  runningBalance: e.runningBalance.format(),
                })),
                ledgerUrl: `/customers/${ledger.customer.id}/ledger`,
              },
            },
          };
        }

        // -------------------------------------------------------------
        // G3. GET_SUPPLIER_LEDGER (Requirement 36)
        // -------------------------------------------------------------
        case "GET_SUPPLIER_LEDGER": {
          if (!interpretation.filters.supplierId) {
            const firstSupplier = await prisma.supplier.findFirst({
              where: { businessId: user.businessId },
              select: { id: true, name: true, supplierCode: true },
            });
            if (firstSupplier) {
              interpretation.filters.supplierId = firstSupplier.id;
              interpretation.filters.supplierName = firstSupplier.name;
            } else {
              return {
                id: messageId,
                role: "assistant",
                content: "No suppliers found in your records.",
                timestamp: nowIso,
                intent: interpretation.intent,
              };
            }
          }

          const ledger = await ReportDataService.getSupplierLedgerReport(
            user.businessId,
            interpretation.filters.supplierId!,
            startDate,
            endDate
          );

          const content = isTamil
            ? `${ledger.supplier.name} அவர்களின் பேரேடு சுருக்கம்: தொடக்க இருப்பு ${ledger.openingBalance.format()}, பற்று ${ledger.totalDebits.format()}, வரவு ${ledger.totalCredits.format()}, தற்போதைய நிலுவை ${ledger.closingBalance.format()}.`
            : `Supplier Ledger for ${ledger.supplier.name} (${ledger.supplier.supplierCode}): Opening ${ledger.openingBalance.format()}, Debits ${ledger.totalDebits.format()}, Credits ${ledger.totalCredits.format()}, Current Balance ${ledger.closingBalance.format()}.`;

          return {
            id: messageId,
            role: "assistant",
            content,
            timestamp: nowIso,
            intent: interpretation.intent,
            sourceAttribution: "SUPPLIER_LEDGER",
            sourceLabel: "Supplier Ledger Service",
            handoffAction: {
              type: "LEDGER",
              label: `Open Full Ledger for ${ledger.supplier.name}`,
              url: `/suppliers/${ledger.supplier.id}/ledger`,
            },
            structuredData: {
              type: "LEDGER_SUMMARY",
              ledgerData: {
                partyId: ledger.supplier.id,
                partyName: ledger.supplier.name,
                partyType: "SUPPLIER",
                openingBalance: ledger.openingBalance.format(),
                totalBilled: ledger.totalCredits.format(),
                totalPaid: ledger.totalDebits.format(),
                currentBalance: ledger.closingBalance.format(),
                periodLabel,
                entriesCount: ledger.entries.length,
                recentEntries: ledger.entries.slice(-5).map((e) => ({
                  date: e.date.toISOString().split("T")[0],
                  reference: e.entityNumber,
                  description: e.description,
                  type: e.type,
                  debit: e.debit.format(),
                  credit: e.credit.format(),
                  runningBalance: e.runningBalance.format(),
                })),
                ledgerUrl: `/suppliers/${ledger.supplier.id}/ledger`,
              },
            },
          };
        }

        // -------------------------------------------------------------
        // H. GET_PERIOD_COMPARISON (Requirements 38, 107)
        // -------------------------------------------------------------
        case "GET_PERIOD_COMPARISON": {
          const commandCenter = await AnalyticsService.getFinancialCommandCenter({
            businessId: user.businessId,
            period: "this-month",
          });

          const kpi = commandCenter.kpi;
          const currentLabel = commandCenter.dateRange.label;
          const prevLabel = commandCenter.dateRange.prevLabel;

          const content = isTamil
            ? `${currentLabel} vs ${prevLabel} ஒப்பீடு:\nவருமானம்: ${kpi.income.current} (${kpi.income.diff}, ${kpi.income.percentageChange || 0}%)\nசெலவு: ${kpi.expenses.current} (${kpi.expenses.diff}, ${kpi.expenses.percentageChange || 0}%)\nநிகர முடிவு: ${kpi.netResult.current}`
            : `Comparison: ${currentLabel} vs ${prevLabel}:\n• Income: ${kpi.income.current} (vs ${kpi.income.previous}, ${kpi.income.percentageChange || 0}%)\n• Expenses: ${kpi.expenses.current} (vs ${kpi.expenses.previous}, ${kpi.expenses.percentageChange || 0}%)\n• Net Result: ${kpi.netResult.current} (vs ${kpi.netResult.previous})`;

          return {
            id: messageId,
            role: "assistant",
            content,
            timestamp: nowIso,
            intent: interpretation.intent,
            sourceAttribution: "VERIFIED_ACCOUNTING_DATA",
            sourceLabel: "Analytics Engine",
            handoffAction: {
              type: "DASHBOARD",
              label: "Open Analytics Dashboard",
              url: "/dashboard",
            },
            structuredData: {
              type: "COMPARISON",
              comparisonData: {
                currentPeriodLabel: currentLabel,
                previousPeriodLabel: prevLabel,
                income: {
                  current: kpi.income.current,
                  previous: kpi.income.previous,
                  diff: kpi.income.diff,
                  percentChange: kpi.income.percentageChange,
                  trend: kpi.income.trend,
                },
                expenses: {
                  current: kpi.expenses.current,
                  previous: kpi.expenses.previous,
                  diff: kpi.expenses.diff,
                  percentChange: kpi.expenses.percentageChange,
                  trend: kpi.expenses.trend,
                },
                netResult: {
                  current: kpi.netResult.current,
                  previous: kpi.netResult.previous,
                  diff: kpi.netResult.diff,
                  percentChange: kpi.netResult.percentageChange,
                  trend: kpi.netResult.trend,
                },
                moneyIn: {
                  current: kpi.moneyReceived.current,
                  previous: kpi.moneyReceived.previous,
                  diff: kpi.moneyReceived.diff,
                  percentChange: kpi.moneyReceived.percentageChange,
                  trend: kpi.moneyReceived.trend,
                },
                moneyOut: {
                  current: kpi.moneyPaid.current,
                  previous: kpi.moneyPaid.previous,
                  diff: kpi.moneyPaid.diff,
                  percentChange: kpi.moneyPaid.percentageChange,
                  trend: kpi.moneyPaid.trend,
                },
                receivables: {
                  current: kpi.totalReceivables,
                  previous: kpi.totalReceivables,
                  diff: "0.00",
                  percentChange: 0,
                  trend: "FLAT",
                },
              },
            },
          };
        }

        // -------------------------------------------------------------
        // I. GET_MONTH_END_STATUS & EXPLAIN_CLOSE_FAILURE (Requirements 41, 42, 108)
        // -------------------------------------------------------------
        case "GET_MONTH_END_STATUS":
        case "EXPLAIN_CLOSE_FAILURE": {
          const targetYear = interpretation.filters.year || 2026;
          const targetMonth = interpretation.filters.month || 9;
          const pLabel = MonthEndService.getPeriodLabel(targetYear, targetMonth);

          const checklist = await MonthEndService.runPreCloseChecklist(
            user.businessId,
            targetYear,
            targetMonth
          );

          const blockingItems = checklist.items.filter((it) => it.severity === "BLOCKING");
          const warningItems = checklist.items.filter((it) => it.severity === "WARNING");

          let content = "";
          if (checklist.overallStatus === "READY") {
            content = isTamil
              ? `${pLabel} மாதத்தை மூட தயாராக உள்ளது (Status: READY). அனைத்து சரிபார்ப்புகளும் வெற்றிகரமாக முடிந்தது.`
              : `${pLabel} is READY to close! All ${checklist.passedChecks} pre-close integrity checks have passed with zero blocking issues.`;
          } else if (checklist.overallStatus === "BLOCKED") {
            const reasonsSummary = blockingItems.map((b) => `• ${b.title}: ${b.description}`).join("\n");
            content = isTamil
              ? `${pLabel} மாதத்தை மூட முடியாது (${blockingItems.length} தடுக்கும் சிக்கல்கள் உள்ளன):\n${reasonsSummary}`
              : `${pLabel} CANNOT be closed because ${blockingItems.length} blocking issue(s) require resolution:\n${reasonsSummary}`;
          } else {
            content = isTamil
              ? `${pLabel} மாதத்தில் ${warningItems.length} எச்சரிக்கைகள் உள்ளன. மதிப்பாய்வு செய்து தொடரலாம்.`
              : `${pLabel} has ${warningItems.length} warning(s) that should be reviewed before closing.`;
          }

          return {
            id: messageId,
            role: "assistant",
            content,
            timestamp: nowIso,
            intent: interpretation.intent,
            sourceAttribution: "VERIFIED_ACCOUNTING_DATA",
            sourceLabel: "Month-End Pre-Close Engine",
            handoffAction: {
              type: "MONTH_END",
              label: `Open ${pLabel} Month-End`,
              url: `/month-end/${targetYear}-${String(targetMonth).padStart(2, "0")}`,
            },
            structuredData: {
              type: "MONTH_END_STATUS",
              monthEndData: {
                periodLabel: pLabel,
                year: targetYear,
                month: targetMonth,
                periodStatus: checklist.periodStatus,
                overallStatus: checklist.overallStatus,
                blockingCount: checklist.blockingChecks,
                warningCount: checklist.warningChecks,
                passedCount: checklist.passedChecks,
                blockingReasons: blockingItems.map((b) => ({
                  title: b.title,
                  description: b.description,
                  count: b.count,
                })),
                warningReasons: warningItems.map((w) => ({
                  title: w.title,
                  description: w.description,
                  count: w.count,
                })),
                monthEndUrl: `/month-end/${targetYear}-${String(targetMonth).padStart(2, "0")}`,
              },
            },
          };
        }

        // -------------------------------------------------------------
        // J. FIND_DUPLICATES (Requirements 43, 109)
        // -------------------------------------------------------------
        case "FIND_DUPLICATES": {
          const postedRecords = await prisma.transaction.findMany({
            where: {
              businessId: user.businessId,
              status: TransactionStatus.POSTED,
            },
            select: {
              id: true,
              transactionNumber: true,
              title: true,
              totalAmount: true,
              transactionDate: true,
              referenceNumber: true,
              status: true,
            },
            take: 200,
          });

          const duplicateMap = new Map<string, typeof postedRecords>();
          for (const r of postedRecords) {
            const key = `${r.transactionDate.toISOString().split("T")[0]}_${r.totalAmount.toString()}_${r.referenceNumber || r.title}`;
            if (!duplicateMap.has(key)) duplicateMap.set(key, []);
            duplicateMap.get(key)!.push(r);
          }

          const duplicateGroups = Array.from(duplicateMap.values()).filter((g) => g.length > 1);

          const groupsData = duplicateGroups.map((g) => ({
            amount: Money.fromDecimal(g[0].totalAmount).format(),
            date: g[0].transactionDate.toISOString().split("T")[0],
            referenceOrTitle: g[0].referenceNumber || g[0].title,
            records: g.map((r) => ({
              id: r.id,
              transactionNumber: r.transactionNumber,
              title: r.title,
              status: r.status,
            })),
          }));

          const content = duplicateGroups.length === 0
            ? (isTamil ? "சாத்தியமான போலி பதிவுகள் எதுவும் கண்டறியப்படவில்லை." : "No potential duplicate records detected in posted transactions.")
            : (isTamil
                ? `${duplicateGroups.length} சாத்தியமான போலி பதிவுகள் கண்டறியப்பட்டுள்ளன.`
                : `Detected ${duplicateGroups.length} potential duplicate group(s) sharing identical date, amount, and reference.`);

          return {
            id: messageId,
            role: "assistant",
            content,
            timestamp: nowIso,
            intent: interpretation.intent,
            sourceAttribution: "VERIFIED_ACCOUNTING_DATA",
            sourceLabel: "Deterministic Duplicate Detector",
            handoffAction: {
              type: "RECORDS",
              label: "Review Records",
              url: "/records",
            },
            structuredData: {
              type: "DUPLICATE_LIST",
              duplicateData: {
                duplicateGroupCount: duplicateGroups.length,
                groups: groupsData,
              },
            },
          };
        }

        // -------------------------------------------------------------
        // K. SEARCH_NOTES (Requirement 44)
        // -------------------------------------------------------------
        case "SEARCH_NOTES": {
          const keyword = interpretation.filters.searchKeyword || "";
          const notes = await prisma.note.findMany({
            where: {
              businessId: user.businessId,
              OR: [
                { title: { contains: keyword, mode: "insensitive" } },
                { content: { contains: keyword, mode: "insensitive" } },
              ],
            },
            include: { customer: true, supplier: true },
            orderBy: { createdAt: "desc" },
            take: 10,
          });

          const notesDTO: AINoteItemDTO[] = notes.map((n) => ({
            id: n.id,
            title: n.title,
            content: n.content,
            category: n.noteType,
            isPinned: n.isPinned,
            createdAt: n.createdAt.toISOString().split("T")[0],
            author: n.customer?.name || n.supplier?.name || "System",
          }));

          const content = isTamil
            ? `"${keyword}" என்ற தேடலில் ${notesDTO.length} குறிப்புகள் கண்டறியப்பட்டன.`
            : `Found ${notesDTO.length} note(s) matching "${keyword}".`;

          return {
            id: messageId,
            role: "assistant",
            content,
            timestamp: nowIso,
            intent: interpretation.intent,
            sourceAttribution: "VERIFIED_ACCOUNTING_DATA",
            sourceLabel: "Operational Notes Records",
            handoffAction: {
              type: "RECORDS",
              label: "Open Notes",
              url: "/notes",
            },
            structuredData: {
              type: "NOTES_LIST",
              notesData: {
                count: notesDTO.length,
                notes: notesDTO,
              },
            },
          };
        }

        // -------------------------------------------------------------
        // CRM-1. GET_FOLLOW_UPS_DUE (Requirements 78, 80, 115)
        // -------------------------------------------------------------
        case "GET_FOLLOW_UPS_DUE": {
          const followUpsResult = await FollowUpService.getFollowUps({
            businessId: user.businessId,
            filter: "today",
            page: 1,
            pageSize: 10,
          });
          const metrics = await FollowUpService.getFollowUpSummaryMetrics({
            businessId: user.businessId,
            userId: user.userId,
          });

          let content = isTamil
            ? `இன்று ${metrics.dueToday} ஃபாலோ அப் பணிகள் நிலுவையில் உள்ளன. ${metrics.overdue} பணிகள் தாமதமாகியுள்ளன.`
            : `You have ${metrics.dueToday} follow-up(s) due today and ${metrics.overdue} overdue in your operational queue.`;

          if (followUpsResult.items.length > 0) {
            content +=
              "\n\n" +
              followUpsResult.items
                .map(
                  (f, i) =>
                    `${i + 1}. ${f.title} (${f.customerName || f.supplierName || "General"}) — Priority: ${f.priority}`
                )
                .join("\n");
          }

          return {
            id: messageId,
            role: "assistant",
            content,
            timestamp: nowIso,
            intent: interpretation.intent,
            sourceAttribution: "VERIFIED_ACCOUNTING_DATA",
            sourceLabel: "CRM Operational Queue",
            handoffAction: {
              type: "RECORDS",
              label: "Open Follow-Ups Work Queue",
              url: "/follow-ups",
            },
          };
        }

        // -------------------------------------------------------------
        // CRM-2. GET_PROMISES_DUE (Requirements 78, 104, 109)
        // -------------------------------------------------------------
        case "GET_PROMISES_DUE": {
          const now = new Date();
          const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000);

          const promises = await prisma.promiseToPay.findMany({
            where: {
              businessId: user.businessId,
              status: PromiseStatus.ACTIVE,
            },
            include: {
              customer: { select: { name: true, customerCode: true } },
            },
            orderBy: { promiseDate: "asc" },
            take: 10,
          });

          const overduePromises = promises.filter((p) => p.promiseDate < now);
          const thisWeekPromises = promises.filter((p) => p.promiseDate >= now && p.promiseDate <= endOfWeek);

          let content = isTamil
            ? `தற்போது ${promises.length} வாக்குறுதிகள் செயல்பாட்டில் உள்ளன (${overduePromises.length} காலாவதி, ${thisWeekPromises.length} இந்த வாரம்).`
            : `There are ${promises.length} active promise(s)-to-pay (${overduePromises.length} overdue, ${thisWeekPromises.length} due this week). Operational note: Promises do not alter accounting balances.`;

          if (promises.length > 0) {
            content +=
              "\n\n" +
              promises
                .map((p, i) => {
                  const amt = Money.fromDecimal(p.promisedAmount).format();
                  const dt = p.promiseDate.toLocaleDateString("en-IN");
                  const isOver = p.promiseDate < now;
                  return `${i + 1}. ${p.customer.name} (#${p.customer.customerCode}): ${amt} on ${dt} ${isOver ? "[OVERDUE]" : ""}`;
                })
                .join("\n");
          }

          return {
            id: messageId,
            role: "assistant",
            content,
            timestamp: nowIso,
            intent: interpretation.intent,
            sourceAttribution: "VERIFIED_ACCOUNTING_DATA",
            sourceLabel: "Operational Promises",
            handoffAction: {
              type: "RECORDS",
              label: "View Customer Receivables",
              url: "/receivables",
            },
          };
        }

        // -------------------------------------------------------------
        // CRM-3. GET_CUSTOMER_SUMMARY (Requirements 78, 79)
        // -------------------------------------------------------------
        case "GET_CUSTOMER_SUMMARY": {
          const custName = interpretation.filters.customerName?.trim();
          let targetCustomer;
          if (custName) {
            targetCustomer = await prisma.customer.findFirst({
              where: {
                businessId: user.businessId,
                name: { contains: custName, mode: "insensitive" },
              },
            });
          }

          if (!targetCustomer) {
            return {
              id: messageId,
              role: "assistant",
              content: custName
                ? `No customer matching "${custName}" found.`
                : "Please specify which customer to summarize (e.g., 'Summarize Mohamed Ibrahim').",
              timestamp: nowIso,
              intent: interpretation.intent,
              sourceAttribution: "NONE",
            };
          }

          const profile = await CRMService.getCustomer360Profile({
            businessId: user.businessId,
            customerId: targetCustomer.id,
          });

          const content = isTamil
            ? `வாடிக்கையாளர் விவரம்: ${profile.customer.name} (${profile.customer.customerCode})\n` +
              `• மொத்த வர்த்தகம்: ${profile.financialSummary.totalBusinessVolume}\n` +
              `• பெறப்பட்ட தொகை: ${profile.financialSummary.moneyReceived}\n` +
              `• தற்போதைய நிலுவை: ${profile.financialSummary.currentReceivables}\n` +
              `• தாமதமான நிலுவை: ${profile.financialSummary.overdueReceivables}\n` +
              `• நிலுவை பணிகள்: ${profile.financialSummary.openFollowUpsCount}`
            : `Customer Profile Summary: ${profile.customer.name} (${profile.customer.customerCode})\n` +
              `• Client Since: ${new Date(profile.customer.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}\n` +
              `• Total Business Volume: ${profile.financialSummary.totalBusinessVolume}\n` +
              `• Money Received: ${profile.financialSummary.moneyReceived}\n` +
              `• Current Receivables: ${profile.financialSummary.currentReceivables}\n` +
              `• Overdue Receivables: ${profile.financialSummary.overdueReceivables}\n` +
              `• Open Follow-Ups: ${profile.financialSummary.openFollowUpsCount}, Active Promises: ${profile.financialSummary.activePromisesCount}` +
              (profile.customer.isPinnedNote ? `\n• Notice: "${profile.customer.isPinnedNote}"` : "");

          return {
            id: messageId,
            role: "assistant",
            content,
            timestamp: nowIso,
            intent: interpretation.intent,
            sourceAttribution: "VERIFIED_ACCOUNTING_DATA",
            sourceLabel: "Customer 360° Profile",
            handoffAction: {
              type: "RECORDS",
              label: `Open ${profile.customer.name}'s Profile`,
              url: `/customers/${profile.customer.id}`,
            },
          };
        }

        // -------------------------------------------------------------
        // CRM-4. GET_SUPPLIER_PAYABLES_DUE (Requirement 78)
        // -------------------------------------------------------------
        case "GET_SUPPLIER_PAYABLES_DUE": {
          const payablesSummary = await AccountingService.getPayablesSummary({
            businessId: user.businessId,
          });

          const content = isTamil
            ? `சப்ளையர் செலுத்த வேண்டிய நிலுவை: ${payablesSummary.totalPayables.format()} (மொத்தம் ${payablesSummary.totalCount} பதிவுகள்).`
            : `Supplier payables status: Total outstanding ${payablesSummary.totalPayables.format()} across ${payablesSummary.totalCount} bill(s).`;

          return {
            id: messageId,
            role: "assistant",
            content,
            timestamp: nowIso,
            intent: interpretation.intent,
            sourceAttribution: "VERIFIED_ACCOUNTING_DATA",
            sourceLabel: "Accounts Payable",
            handoffAction: {
              type: "REPORT",
              label: "Open Payables Directory",
              url: "/payables",
            },
          };
        }

        // -------------------------------------------------------------
        // L. PREPARE_EXPORT (Requirements 54, 82, 122)
        // -------------------------------------------------------------
        case "PREPARE_EXPORT": {
          const reportType = interpretation.filters.transactionType === TransactionType.INCOME ? "INCOME" : "EXPENSE";
          const exportUrl = `/reports/exports?type=${reportType}&startDate=${startDate.toISOString().split("T")[0]}&endDate=${endDate.toISOString().split("T")[0]}`;

          const content = isTamil
            ? `${periodLabel} ${reportType === "INCOME" ? "வருமான" : "செலவு"} எக்ஸ்போர்ட் தயார் செய்யப்பட்டுள்ளது. எக்செல் அல்லது PDF வடிவத்தை தேர்வு செய்யவும்.`
            : `Export proposal prepared for ${periodLabel} ${reportType} report. Proceed to choose Excel or PDF format.`;

          return {
            id: messageId,
            role: "assistant",
            content,
            timestamp: nowIso,
            intent: interpretation.intent,
            sourceAttribution: "NONE",
            handoffAction: {
              type: "REPORT",
              label: "Download / Export Report",
              url: exportUrl,
            },
            structuredData: {
              type: "EXPORT_PREPARATION",
              exportPreparation: {
                reportType: reportType as "INCOME" | "EXPENSE",
                periodLabel,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                suggestedFormats: ["EXCEL", "PDF", "CSV"],
                exportUrl,
              },
            },
          };
        }

        // -------------------------------------------------------------
        // M. EXPLAIN_CONCEPT (Requirement 89)
        // -------------------------------------------------------------
        case "EXPLAIN_CONCEPT": {
          return {
            id: messageId,
            role: "assistant",
            content: interpretation.explanationText || "Accounting concept explanation.",
            timestamp: nowIso,
            intent: interpretation.intent,
            sourceAttribution: "GENERAL_KNOWLEDGE",
            sourceLabel: "Accounting Knowledge Base",
          };
        }

        // -------------------------------------------------------------
        // N. DEFAULT / UNKNOWN
        // -------------------------------------------------------------
        case "CLARIFICATION_NEEDED":
        case "UNKNOWN":
        default: {
          return {
            id: messageId,
            role: "assistant",
            content: isTamil
              ? "உங்கள் கேள்வியை மேலும் விளக்க முடியுமா? (உதாரணம்: 'இந்த மாத செலவு எவ்வளவு?', 'செப்டம்பர் வருமானம்', 'யாருக்கு பாக்கி உள்ளது?')"
              : "I could not fully understand that accounting question. Try asking: 'Show this month's expenses', 'How much do customers owe us?', 'Compare this month with last month', or 'Why can't September close?'.",
            timestamp: nowIso,
            intent: "UNKNOWN",
            sourceAttribution: "NONE",
          };
        }
      }
    } finally {
      // 6. Log AI Query Audit Event (Requirement 70)
      try {
        await prisma.aIQuery.create({
          data: {
            businessId: user.businessId,
            userId: user.userId,
            originalQuery: rawQuery,
            interpretedFilter: interpretation.filters as unknown as Prisma.InputJsonValue,
            actionType: interpretation.intent,
            status: "SUCCESS",
          },
        });
      } catch (err) {
        console.error("Failed to log AI query to audit:", err);
      }
    }
  }
}
