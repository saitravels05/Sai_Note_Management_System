import { prisma } from "@/lib/db";

export type SequenceType = "TRANSACTION" | "PAYMENT" | "CUSTOMER" | "SUPPLIER" | "REPORT";

/**
 * Enterprise Safe Numbering Service.
 * 
 * Rules:
 * 1. NEVER use COUNT(*) + 1 (prone to duplicate collisions under concurrency).
 * 2. Uses atomic upsert/increment on `BusinessSequence`.
 * 3. Formats:
 *    - TXN: TXN-YYYY-000001
 *    - PAY: PAY-YYYY-000001
 *    - CUS: CUS-000001
 *    - SUP: SUP-000001
 */
export class NumberingService {
  /**
   * Format sequence number with zero-padding
   */
  public static formatNumber(prefix: string, seqNum: number | bigint, year?: number, padding = 6): string {
    const padded = seqNum.toString().padStart(padding, "0");
    if (year) {
      return `${prefix}-${year}-${padded}`;
    }
    return `${prefix}-${padded}`;
  }

  /**
   * Atomically generate next sequence number in a transaction-safe manner
   */
  public static async getNextSequenceNumber(
    businessId: string,
    sequenceType: SequenceType,
    prefix: string,
    year?: number
  ): Promise<string> {
    // In database operations, execute atomic upsert increment
    const sequence = await prisma.businessSequence.upsert({
      where: {
        businessId_sequenceType_prefix_year: {
          businessId,
          sequenceType,
          prefix,
          year: year ?? 0,
        },
      },
      update: {
        currentValue: {
          increment: 1,
        },
      },
      create: {
        businessId,
        sequenceType,
        prefix,
        year: year ?? 0,
        currentValue: 1,
      },
    });

    return NumberingService.formatNumber(prefix, sequence.currentValue, year);
  }
}
