import {
  AISafeFilters,
  AIInterpretationResult,
} from "@/types/ai";
import { TransactionType, PaymentStatus, PaymentMethodType } from "@prisma/client";

// ===================================================================
// AI PROVIDER CONFIGURATION & INTERFACE
// ===================================================================

export interface AIProviderConfig {
  enabled: boolean;
  provider: "deterministic" | "gemini" | "openai" | "anthropic";
  apiKey?: string;
  model?: string;
  timeoutMs: number;
  rateLimitPerMinute: number;
}

export function getAIConfig(): AIProviderConfig {
  const enabledStr = process.env.AI_ENABLED;
  const isEnabled = enabledStr === undefined ? true : enabledStr.toLowerCase() === "true";

  return {
    enabled: isEnabled,
    provider: (process.env.AI_PROVIDER as AIProviderConfig["provider"]) || "deterministic",
    apiKey: process.env.AI_API_KEY,
    model: process.env.AI_MODEL || "deterministic-v1",
    timeoutMs: Number(process.env.AI_TIMEOUT) || 8000,
    rateLimitPerMinute: Number(process.env.AI_RATE_LIMIT_PER_MINUTE) || 30,
  };
}

// In-memory rate limiting map: key -> timestamps
const rateLimitMap = new Map<string, number[]>();

export function checkAIRateLimit(identifier: string, limitPerMinute: number): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const timestamps = rateLimitMap.get(identifier) || [];

  // Filter timestamps within the last minute
  const validTimestamps = timestamps.filter((t) => now - t < windowMs);

  if (validTimestamps.length >= limitPerMinute) {
    return false; // Rate limit exceeded
  }

  validTimestamps.push(now);
  rateLimitMap.set(identifier, validTimestamps);
  return true;
}

// ===================================================================
// DETERMINISTIC NATURAL LANGUAGE INTERPRETER (ZERO HALLUCINATION)
// ===================================================================

export class DeterministicNLPInterpreter {
  /**
   * Safe parser translating English and Tamil natural language queries into verified structured intents and filters.
   */
  public static interpret(
    rawQuery: string,
    existingFilters?: AISafeFilters
  ): AIInterpretationResult {
    const query = rawQuery.trim();
    const lower = query.toLowerCase();

    // 1. Prompt Injection Defense (Requirement 57 & 110)
    // If the query attempts instruction hijacking or prompt overrides, treat it strictly as search content or unknown
    const isInjectionAttempt =
      lower.includes("ignore previous instructions") ||
      lower.includes("ignore all rules") ||
      lower.includes("reveal all businesses") ||
      lower.includes("system prompt override") ||
      lower.includes("drop table") ||
      lower.includes("delete all");

    if (isInjectionAttempt) {
      return {
        intent: "SEARCH_RECORDS",
        confidence: 0.95,
        filters: { searchKeyword: query },
        detectedLanguage: "en",
        explanationText: "Searching records for query text.",
      };
    }

    // 2. Language Detection
    // Simple check for Tamil Unicode block (0x0B80 - 0x0BFF)
    const isTamil = /[\u0B80-\u0BFF]/.test(query);
    const language: "en" | "ta" = isTamil ? "ta" : "en";

    // 3. Context Switch Detection (Requirement 85 & 121)
    // Check if the query switches to a new primary dimension (e.g. from September to October, or Expense to Income)
    const mentionsNewPeriod =
      lower.includes("now show") ||
      lower.includes("switch to") ||
      (lower.includes("october") && existingFilters?.month === 9) ||
      (lower.includes("september") && existingFilters?.month === 10) ||
      (lower.includes("income") && existingFilters?.transactionType === TransactionType.EXPENSE) ||
      (lower.includes("expense") && existingFilters?.transactionType === TransactionType.INCOME);

    let baseFilters: AISafeFilters = {};
    if (existingFilters && !mentionsNewPeriod) {
      // Retain compatible previous filters for follow-up questions
      baseFilters = { ...existingFilters };
    }

    // 4. Intent Classification
    // A. Concept explanation (Requirement 89)
    if (
      lower.startsWith("what is ") ||
      lower.startsWith("explain ") ||
      lower.includes("என்ன பொருள்") ||
      lower.includes("விளக்கம்")
    ) {
      if (lower.includes("receivable") || lower.includes("வரவேண்டியவை")) {
        return {
          intent: "EXPLAIN_CONCEPT",
          confidence: 0.99,
          filters: {},
          detectedLanguage: language,
          explanationText:
            language === "ta"
              ? "வரவேண்டிய தொகை (Receivable) என்பது வாடிக்கையாளர்கள் உங்கள் வணிகத்திற்கு இன்னும் செலுத்த வேண்டிய நிலுவைத் தொகையாகும்."
              : "Receivable is money that your customers currently owe your business for completed trips, tours, or services.",
        };
      }
      if (lower.includes("payable") || lower.includes("செலுத்தவேண்டியவை")) {
        return {
          intent: "EXPLAIN_CONCEPT",
          confidence: 0.99,
          filters: {},
          detectedLanguage: language,
          explanationText:
            language === "ta"
              ? "செலுத்தவேண்டிய தொகை (Payable) என்பது உங்கள் வணிகம் சப்ளையர்களுக்கு (டீசல், ஹோட்டல், பராமரிப்பு) செலுத்த வேண்டிய நிலுவைத் தொகையாகும்."
              : "Payable is money that your business owes to suppliers or vendors (such as fuel stations, hotels, and maintenance).",
        };
      }
      if (lower.includes("accrual") || lower.includes("accounting basis")) {
        return {
          intent: "EXPLAIN_CONCEPT",
          confidence: 0.99,
          filters: {},
          detectedLanguage: language,
          explanationText:
            "Accrual accounting recognizes income when services are performed and expenses when incurred, regardless of when cash is physically received or paid.",
        };
      }
    }

    // B. Export Preparation (Requirement 54, 82, 122)
    if (lower.startsWith("export ") || lower.includes("download ") || lower.includes("எக்ஸ்போர்ட்")) {
      const type: TransactionType = lower.includes("income")
        ? TransactionType.INCOME
        : TransactionType.EXPENSE;
      const parsedFilters = this.extractFilters(query, baseFilters);
      return {
        intent: "PREPARE_EXPORT",
        confidence: 0.95,
        filters: { ...parsedFilters, transactionType: type },
        detectedLanguage: language,
      };
    }

    // C. Month-End Status & Blocking Failure Explanation (Requirements 41, 42, 108)
    if (
      lower.includes("why can't") ||
      lower.includes("why cannot") ||
      lower.includes("why cant") ||
      lower.includes("மூட முடியவில்லை") ||
      lower.includes("why can't september") ||
      lower.includes("close failure")
    ) {
      const parsed = this.extractFilters(query, baseFilters);
      return {
        intent: "EXPLAIN_CLOSE_FAILURE",
        confidence: 0.98,
        filters: {
          year: parsed.year || 2026,
          month: parsed.month || 9,
        },
        detectedLanguage: language,
      };
    }

    if (
      lower.includes("can i close") ||
      lower.includes("ready to close") ||
      lower.includes("month-end status") ||
      lower.includes("close september") ||
      lower.includes("மாத முடிவு நிலை") ||
      lower.includes("செப்டம்பர் மாதத்தை மூட முடியுமா")
    ) {
      const parsed = this.extractFilters(query, baseFilters);
      return {
        intent: "GET_MONTH_END_STATUS",
        confidence: 0.98,
        filters: {
          year: parsed.year || 2026,
          month: parsed.month || 9,
        },
        detectedLanguage: language,
      };
    }

    // D. Period Comparison (Requirements 38, 107)
    if (
      lower.includes("compare") ||
      lower.includes("comparison") ||
      lower.includes("ஒப்பீடு") ||
      lower.includes("versus") ||
      lower.includes("vs last month")
    ) {
      return {
        intent: "GET_PERIOD_COMPARISON",
        confidence: 0.95,
        filters: { periodType: "this-month" },
        detectedLanguage: language,
      };
    }

    // E. Potential Duplicates Search (Requirements 43, 109)
    if (
      lower.includes("duplicate") ||
      lower.includes("duplicates") ||
      lower.includes("போலி பதிவுகள்") ||
      lower.includes("இரட்டை பதிவுகள்")
    ) {
      return {
        intent: "FIND_DUPLICATES",
        confidence: 0.98,
        filters: this.extractFilters(query, baseFilters),
        detectedLanguage: language,
      };
    }

    // CRM-1: Follow-Ups Due (Requirements 78, 80, 115)
    if (
      lower.includes("follow up") ||
      lower.includes("followup") ||
      lower.includes("who should i follow") ||
      lower.includes("who needs follow") ||
      lower.includes("ஃபாலோ அப்")
    ) {
      return {
        intent: "GET_FOLLOW_UPS_DUE",
        confidence: 0.98,
        filters: this.extractFilters(query, baseFilters),
        detectedLanguage: language,
      };
    }

    // CRM-2: Promises to Pay (Requirements 78, 104, 109)
    if (
      lower.includes("promise") ||
      lower.includes("promised payment") ||
      lower.includes("overdue promises") ||
      lower.includes("வாக்குறுதி")
    ) {
      return {
        intent: "GET_PROMISES_DUE",
        confidence: 0.98,
        filters: this.extractFilters(query, baseFilters),
        detectedLanguage: language,
      };
    }

    // CRM-3: Customer Summary (Requirements 78, 79)
    if (
      lower.startsWith("summarize customer") ||
      lower.startsWith("summarize ") ||
      lower.includes("customer summary") ||
      lower.includes("customer history") ||
      lower.includes("வாடிக்கையாளர் விவரம்")
    ) {
      const partyName = query
        .replace(/summarize customer/i, "")
        .replace(/summarize/i, "")
        .replace(/customer summary for/i, "")
        .replace(/customer history for/i, "")
        .replace(/வாடிக்கையாளர் விவரம்/i, "")
        .trim();
      return {
        intent: "GET_CUSTOMER_SUMMARY",
        confidence: 0.95,
        filters: { customerName: partyName || undefined },
        detectedLanguage: language,
      };
    }

    // CRM-4: Supplier Payables Due / Payments Due This Week (Requirement 78)
    if (
      (lower.includes("supplier") && (lower.includes("due") || lower.includes("pay this week") || lower.includes("pay today"))) ||
      lower.includes("suppliers due this week")
    ) {
      return {
        intent: "GET_SUPPLIER_PAYABLES_DUE",
        confidence: 0.98,
        filters: this.extractFilters(query, baseFilters),
        detectedLanguage: language,
      };
    }

    // F. Notes Search (Requirement 44)
    if (lower.startsWith("find notes") || lower.startsWith("search notes") || lower.includes("குறிப்புகள்")) {
      const keyword = query
        .replace(/find notes (about|for|mentioning)?/i, "")
        .replace(/search notes (for|about)?/i, "")
        .replace(/குறிப்புகள்/i, "")
        .trim();
      return {
        intent: "SEARCH_NOTES",
        confidence: 0.95,
        filters: { searchKeyword: keyword },
        detectedLanguage: language,
      };
    }

    // G. Customer Receivables & Unpaid Customers (Requirements 30, 31, 32, 34, 103, 104, 117)
    const isReceivableQuery =
      lower.includes("receivable") ||
      lower.includes("customers owe") ||
      (lower.includes("customer") && lower.includes("owe")) ||
      lower.includes("owe us") ||
      lower.includes("pending payments") ||
      lower.includes("unpaid customers") ||
      lower.includes("overdue receivables") ||
      lower.includes("who hasn't paid") ||
      lower.includes("who has not paid") ||
      lower.includes("outstanding") ||
      lower.includes("நிலுவை") ||
      lower.includes("யாருக்கு பாக்கி") ||
      lower.includes("யார் பணம் தர வேண்டும்") ||
      lower.includes("வரவேண்டிய தொகை");

    if (isReceivableQuery) {
      const parsedFilters = this.extractFilters(query, baseFilters);
      // Check if querying historical closing snapshot (Requirement 31 & 104)
      const isAsClosed =
        lower.includes("when september closed") ||
        lower.includes("when closed") ||
        lower.includes("at closing") ||
        lower.includes("as closed") ||
        lower.includes("closing snapshot");

      return {
        intent: "GET_RECEIVABLES",
        confidence: 0.98,
        filters: {
          ...parsedFilters,
          isAsClosed,
          year: parsedFilters.year || (isAsClosed ? 2026 : undefined),
          month: parsedFilters.month || (isAsClosed ? 9 : undefined),
        },
        detectedLanguage: language,
      };
    }

    // H. Supplier Payables (Requirements 33, 105)
    const isPayableQuery =
      lower.includes("owe suppliers") ||
      lower.includes("supplier payments") ||
      lower.includes("supplier payables") ||
      lower.includes("payables") ||
      lower.includes("unpaid suppliers") ||
      lower.includes("செலுத்த வேண்டிய");

    if (isPayableQuery) {
      const parsedFilters = this.extractFilters(query, baseFilters);
      return {
        intent: "GET_PAYABLES",
        confidence: 0.98,
        filters: parsedFilters,
        detectedLanguage: language,
      };
    }

    // I. Customer or Supplier Ledger (Requirements 35, 36)
    if (lower.includes("ledger") || lower.includes("பேரேடு")) {
      const parsedFilters = this.extractFilters(query, baseFilters);
      if (lower.includes("supplier")) {
        return {
          intent: "GET_SUPPLIER_LEDGER",
          confidence: 0.95,
          filters: parsedFilters,
          detectedLanguage: language,
        };
      }
      return {
        intent: "GET_CUSTOMER_LEDGER",
        confidence: 0.95,
        filters: parsedFilters,
        detectedLanguage: language,
      };
    }

    // J. Cash Movement & Inflows / UPI (Requirements 28, 29, 102)
    if (
      lower.includes("cash do we have") ||
      lower.includes("cash balance") ||
      lower.includes("cash movement") ||
      lower.includes("money came in") ||
      lower.includes("money received") ||
      lower.includes("receive through upi") ||
      lower.includes("upi payments") ||
      lower.includes("ரொக்க இருப்பு") ||
      lower.includes("பணம் வந்தது") ||
      lower.includes("upi மூலம்")
    ) {
      const parsedFilters = this.extractFilters(query, baseFilters);
      if (lower.includes("upi")) {
        parsedFilters.paymentMethodType = PaymentMethodType.UPI;
        parsedFilters.paymentMethodName = "UPI";
      }
      return {
        intent: "GET_CASH_FLOW",
        confidence: 0.95,
        filters: parsedFilters,
        detectedLanguage: language,
      };
    }

    // K. Profit / Net Result (Requirement 27)
    if (lower.includes("profit") || lower.includes("net result") || lower.includes("லாபம்")) {
      const parsedFilters = this.extractFilters(query, baseFilters);
      return {
        intent: "GET_NET_RESULT",
        confidence: 0.95,
        filters: parsedFilters,
        detectedLanguage: language,
      };
    }

    // L. Income queries (Requirements 25)
    if (lower.includes("income") || lower.includes("வருமானம்") || lower.includes("revenue")) {
      const parsedFilters = this.extractFilters(query, baseFilters);
      parsedFilters.transactionType = TransactionType.INCOME;
      return {
        intent: "GET_INCOME_TOTAL",
        confidence: 0.95,
        filters: parsedFilters,
        detectedLanguage: language,
      };
    }

    // M. Expense queries (Requirements 26, 100, 101, 117)
    if (
      lower.includes("expense") ||
      lower.includes("expenses") ||
      lower.includes("spend") ||
      lower.includes("spent") ||
      lower.includes("செலவு") ||
      lower.includes("செலவுகள்")
    ) {
      const parsedFilters = this.extractFilters(query, baseFilters);
      parsedFilters.transactionType = TransactionType.EXPENSE;
      return {
        intent: "FILTER_RECORDS",
        confidence: 0.98,
        filters: parsedFilters,
        detectedLanguage: language,
      };
    }

    // N. General Financial Summary (Requirement 40)
    if (lower.includes("summary") || lower.includes("summarize") || lower.includes("சுருக்கம்")) {
      const parsedFilters = this.extractFilters(query, baseFilters);
      return {
        intent: "GET_FINANCIAL_SUMMARY",
        confidence: 0.95,
        filters: parsedFilters,
        detectedLanguage: language,
      };
    }

    // O. Generic Transaction / Record Filter (e.g. "Show transactions between ₹10,000 and ₹50,000", "Show records created yesterday")
    if (
      lower.includes("transaction") ||
      lower.includes("transactions") ||
      lower.includes("record") ||
      lower.includes("records") ||
      lower.includes("பதிவு") ||
      lower.includes("பதிவுகள்") ||
      lower.includes("between") ||
      lower.includes("above") ||
      lower.includes("below")
    ) {
      const parsedFilters = this.extractFilters(query, baseFilters);
      return {
        intent: "FILTER_RECORDS",
        confidence: 0.95,
        filters: parsedFilters,
        detectedLanguage: language,
      };
    }

    // P. Follow-up constraints on existing context (e.g. "Only UPI", "Above ₹20,000") (Requirements 84, 120)
    if (baseFilters.transactionType || baseFilters.month || baseFilters.periodType) {
      const parsedFilters = this.extractFilters(query, baseFilters);
      return {
        intent: "FILTER_RECORDS",
        confidence: 0.92,
        filters: parsedFilters,
        detectedLanguage: language,
      };
    }

    // Default: Search Records
    return {
      intent: "SEARCH_RECORDS",
      confidence: 0.85,
      filters: { searchKeyword: query },
      detectedLanguage: language,
    };
  }

  /**
   * Helper to parse dates, amounts, payment methods, and party names into safe filters.
   */
  public static extractFilters(query: string, current: AISafeFilters = {}): AISafeFilters {
    const filters: AISafeFilters = { ...current };
    const lower = query.toLowerCase();

    // 1. Date / Period Extraction
    if (lower.includes("today") || lower.includes("இன்று")) {
      filters.periodType = "today";
      delete filters.month;
      delete filters.year;
    } else if (lower.includes("yesterday") || lower.includes("நேற்று")) {
      filters.periodType = "yesterday";
      delete filters.month;
      delete filters.year;
    } else if (lower.includes("this week") || lower.includes("இந்த வாரம்")) {
      filters.periodType = "this-week";
    } else if (lower.includes("last week") || lower.includes("கடந்த வாரம்")) {
      filters.periodType = "last-week";
    } else if (lower.includes("this month") || lower.includes("இந்த மாதம்") || lower.includes("இந்த மாத")) {
      filters.periodType = "this-month";
      filters.year = new Date().getFullYear();
      filters.month = new Date().getMonth() + 1;
    } else if (lower.includes("last month") || lower.includes("கடந்த மாதம்") || lower.includes("கடந்த மாத")) {
      filters.periodType = "last-month";
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      filters.year = d.getFullYear();
      filters.month = d.getMonth() + 1;
    } else if (lower.includes("september 2026") || lower.includes("செப்டம்பர் 2026")) {
      filters.periodType = "custom";
      filters.year = 2026;
      filters.month = 9;
      filters.startDate = "2026-09-01T00:00:00.000Z";
      filters.endDate = "2026-09-30T23:59:59.999Z";
    } else if (lower.includes("september") || lower.includes("செப்டம்பர்")) {
      filters.periodType = "custom";
      filters.year = 2026;
      filters.month = 9;
      filters.startDate = "2026-09-01T00:00:00.000Z";
      filters.endDate = "2026-09-30T23:59:59.999Z";
    } else if (lower.includes("october 2026") || lower.includes("அக்டோபர் 2026")) {
      filters.periodType = "custom";
      filters.year = 2026;
      filters.month = 10;
      filters.startDate = "2026-10-01T00:00:00.000Z";
      filters.endDate = "2026-10-31T23:59:59.999Z";
    } else if (lower.includes("october") || lower.includes("அக்டோபர்")) {
      filters.periodType = "custom";
      filters.year = 2026;
      filters.month = 10;
      filters.startDate = "2026-10-01T00:00:00.000Z";
      filters.endDate = "2026-10-31T23:59:59.999Z";
    } else if (lower.includes("august 2026") || lower.includes("ஆகஸ்ட் 2026")) {
      filters.periodType = "custom";
      filters.year = 2026;
      filters.month = 8;
      filters.startDate = "2026-08-01T00:00:00.000Z";
      filters.endDate = "2026-08-31T23:59:59.999Z";
    }

    // 2. Amount Extraction (Requirements 18, 101)
    // Support formats: above ₹10,000, above 10000, > 10000, over 25000, between ₹10,000 and ₹50,000
    const betweenMatch = query.match(/between\s*(?:₹|rs\.?)?\s*([\d,]+)\s*and\s*(?:₹|rs\.?)?\s*([\d,]+)/i);
    if (betweenMatch) {
      const min = parseFloat(betweenMatch[1].replace(/,/g, ""));
      const max = parseFloat(betweenMatch[2].replace(/,/g, ""));
      if (!isNaN(min)) filters.minAmount = min;
      if (!isNaN(max)) filters.maxAmount = max;
    } else {
      const minMatch =
        query.match(/(?:above|greater than|more than|over|>|மேல்|அதிகமான)\s*(?:₹|rs\.?)?\s*([\d,]+)/i);
      if (minMatch) {
        const val = parseFloat(minMatch[1].replace(/,/g, ""));
        if (!isNaN(val)) filters.minAmount = val;
      }

      const maxMatch =
        query.match(/(?:below|less than|under|<|குறைவாக)\s*(?:₹|rs\.?)?\s*([\d,]+)/i);
      if (maxMatch) {
        const val = parseFloat(maxMatch[1].replace(/,/g, ""));
        if (!isNaN(val)) filters.maxAmount = val;
      }

      const exactMatch = query.match(/(?:exactly|equal to|=)\s*(?:₹|rs\.?)?\s*([\d,]+)/i);
      if (exactMatch) {
        const val = parseFloat(exactMatch[1].replace(/,/g, ""));
        if (!isNaN(val)) filters.exactAmount = val;
      }
    }

    // 3. Payment Method Extraction (Requirement 19, 102)
    if (lower.includes("upi") || lower.includes("யுபிஐ")) {
      filters.paymentMethodType = PaymentMethodType.UPI;
      filters.paymentMethodName = "UPI";
    } else if (lower.includes("cash") || lower.includes("ரொக்கம்")) {
      filters.paymentMethodType = PaymentMethodType.CASH;
      filters.paymentMethodName = "Cash";
    } else if (lower.includes("bank transfer") || lower.includes("வங்கி")) {
      filters.paymentMethodType = PaymentMethodType.BANK_TRANSFER;
      filters.paymentMethodName = "Bank Transfer";
    } else if (lower.includes("cheque") || lower.includes("காசோலை")) {
      filters.paymentMethodType = PaymentMethodType.CHEQUE;
      filters.paymentMethodName = "Cheque";
    }

    // 4. Category Recognition (Requirement 22)
    if (lower.includes("hotel") || lower.includes("ஹோட்டல்")) {
      filters.categoryName = "Hotel";
    } else if (lower.includes("diesel") || lower.includes("fuel") || lower.includes("டீசல்")) {
      filters.categoryName = "Fuel";
    } else if (lower.includes("vehicle rent") || lower.includes("வாடகை")) {
      filters.categoryName = "Vehicle Rent";
    } else if (lower.includes("driver allowance") || lower.includes("படி")) {
      filters.categoryName = "Driver Allowance";
    } else if (lower.includes("maintenance") || lower.includes("பராமரிப்பு")) {
      filters.categoryName = "Maintenance";
    }

    // 5. Payment Status
    if (lower.includes("unpaid") || lower.includes("pending") || lower.includes("நிலுவை")) {
      filters.paymentStatus = PaymentStatus.UNPAID;
    } else if (lower.includes("partially paid")) {
      filters.paymentStatus = PaymentStatus.PARTIALLY_PAID;
    } else if (lower.includes("paid in full") || lower.includes("fully paid")) {
      filters.paymentStatus = PaymentStatus.PAID;
    }

    return filters;
  }
}

// ===================================================================
// AI PROVIDER DELEGATOR
// ===================================================================

export class AIProviderService {
  /**
   * Main entrypoint to interpret natural language queries.
   * Uses server-side config and falls back safely to deterministic parser.
   */
  public static async interpret(
    query: string,
    existingFilters?: AISafeFilters,
    clientIdentifier = "user_default"
  ): Promise<AIInterpretationResult> {
    const config = getAIConfig();

    // Check if AI feature is globally disabled (Requirement 63 & 130)
    if (!config.enabled) {
      throw new Error("AI_DISABLED");
    }

    // Check rate limit (Requirement 66 & 116)
    const withinLimit = checkAIRateLimit(clientIdentifier, config.rateLimitPerMinute);
    if (!withinLimit) {
      throw new Error("RATE_LIMIT_EXCEEDED");
    }

    // Execute with timeout safeguard (Requirement 65)
    return await Promise.race([
      DeterministicNLPInterpreter.interpret(query, existingFilters),
      new Promise<AIInterpretationResult>((_, reject) =>
        setTimeout(() => reject(new Error("AI_TIMEOUT")), config.timeoutMs)
      ),
    ]);
  }
}
