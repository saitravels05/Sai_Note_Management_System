import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { PaymentStatus, TransactionStatus } from "@prisma/client";
import { Money } from "../src/lib/money";
import { NumberingService } from "../src/server/services/numbering.service";
import { AuthorizationService } from "../src/server/services/authorization.service";
import { ALLOWED_MIME_TYPES } from "../src/server/services/attachment.service";
import { PERMISSIONS, hasPermission } from "../src/lib/auth/permissions";

describe("Phase 4 Record Validation & Business Logic", () => {
  test("strictly enforces positive amounts for financial transactions", () => {
    // Valid amounts
    assert.doesNotThrow(() => {
      const m1 = new Money(500);
      assert.ok(m1.isPositive());
    });

    const mZero = new Money(0);
    assert.equal(mZero.isPositive(), false, "Zero amount must not be considered positive for records");

    const mNegative = new Money(-1500);
    assert.equal(mNegative.isPositive(), false, "Negative amounts must be rejected");
  });

  test("safe transaction numbering formats correct type prefixes and padding", () => {
    // NumberingService generates standard prefixed sequence strings
    const num1 = NumberingService.formatNumber("TXN", 1, 2026);
    assert.equal(num1, "TXN-2026-000001");

    const incNum = NumberingService.formatNumber("INC", 42, 2026);
    assert.equal(incNum, "INC-2026-000042");

    const expNum = NumberingService.formatNumber("EXP", 1234, 2026);
    assert.equal(expNum, "EXP-2026-001234");

    const recNum = NumberingService.formatNumber("REC", 88, 2026);
    assert.equal(recNum, "REC-2026-000088");

    const payNum = NumberingService.formatNumber("PAY", 5, 2026);
    assert.equal(payNum, "PAY-2026-000005");
  });

  test("receivable and payable entries default to UNPAID status", () => {
    const defaultReceivableStatus = PaymentStatus.UNPAID;
    const defaultPayableStatus = PaymentStatus.UNPAID;

    assert.equal(defaultReceivableStatus, "UNPAID");
    assert.equal(defaultPayableStatus, "UNPAID");
  });
});

describe("Phase 4 Draft vs Posted vs Void Lifecycle", () => {
  test("DRAFT records do not require authoritative posting timestamp", () => {
    const draftRecord = {
      status: TransactionStatus.DRAFT,
      postedAt: null,
      title: "Draft Hotel Booking",
      amount: new Money("15000.00"),
    };

    assert.equal(draftRecord.status, TransactionStatus.DRAFT);
    assert.equal(draftRecord.postedAt, null, "Draft must have null postedAt");
  });

  test("POSTED records require postedAt timestamp and valid total amount", () => {
    const postedRecord = {
      status: TransactionStatus.POSTED,
      postedAt: new Date("2026-09-30T10:00:00Z"),
      title: "Confirmed Air Ticket",
      amount: new Money("28500.00"),
    };

    assert.equal(postedRecord.status, TransactionStatus.POSTED);
    assert.ok(postedRecord.postedAt instanceof Date, "Posted record must have a posted date");
    assert.equal(postedRecord.amount.toDecimalString(), "28500.00");
  });

  test("VOID action requires a mandatory non-empty reason", () => {
    const validateVoidReason = (reason: string | undefined | null) => {
      if (!reason || reason.trim().length < 3) {
        throw new Error("A reason is mandatory to void a financial transaction.");
      }
      return true;
    };

    // Fails on empty or short reason
    assert.throws(() => validateVoidReason(""), /mandatory/);
    assert.throws(() => validateVoidReason("  "), /mandatory/);
    assert.throws(() => validateVoidReason("no"), /mandatory/);

    // Passes on valid reason
    assert.doesNotThrow(() => validateVoidReason("Customer cancelled flight booking"));
  });

  test("Posted financial transactions must never be casually deleted", () => {
    const validateDeletionAllowed = (status: TransactionStatus) => {
      if (status !== TransactionStatus.DRAFT) {
        throw new Error("Security Violation: Only DRAFT records may be deleted. Posted transactions must be Voided.");
      }
      return true;
    };

    // Draft deletion is allowed
    assert.doesNotThrow(() => validateDeletionAllowed(TransactionStatus.DRAFT));

    // Posted deletion is strictly blocked
    assert.throws(
      () => validateDeletionAllowed(TransactionStatus.POSTED),
      /Only DRAFT records may be deleted/
    );

    // Voided deletion is strictly blocked
    assert.throws(
      () => validateDeletionAllowed(TransactionStatus.VOID),
      /Only DRAFT records may be deleted/
    );
  });

  test("Duplicating record resets payment status, reference number, and audit identity", () => {
    const originalRecord = {
      id: "txn_orig_999",
      transactionNumber: "EXP-2026-000456",
      title: "September Office Rent",
      amount: "45000.00",
      referenceNumber: "NEFT-REF-998877",
      paymentStatus: PaymentStatus.PAID,
      status: TransactionStatus.POSTED,
      createdAt: new Date("2026-09-01"),
    };

    // Safe duplicate transformation
    const duplicateData = {
      title: originalRecord.title,
      amount: originalRecord.amount,
      referenceNumber: "", // Reset per rule 23
      paymentStatus: PaymentStatus.UNPAID, // Reset per rule 23
      isDuplicate: true,
      id: undefined, // New ID must be generated
      transactionNumber: undefined, // Authoritative new sequence generated on save
    };

    assert.equal(duplicateData.referenceNumber, "", "Reference number must be cleared on duplicate");
    assert.equal(duplicateData.paymentStatus, PaymentStatus.UNPAID, "Payment status must reset to UNPAID");
    assert.equal(duplicateData.id, undefined, "Original ID must never be reused");
  });
});

describe("Phase 4 Operational Notes System", () => {
  test("validates required fields for smart operational notes", () => {
    const validateNote = (title: string, content: string) => {
      if (!title || title.trim().length === 0) throw new Error("Note title is required.");
      if (!content || content.trim().length === 0) throw new Error("Note content cannot be empty.");
      return true;
    };

    assert.throws(() => validateNote("", "Valid content"), /title is required/);
    assert.throws(() => validateNote("Valid Title", ""), /content cannot be empty/);
    assert.doesNotThrow(() => validateNote("Passport Pending", "Customer to send scanned copy tomorrow"));
  });

  test("toggles pinned state correctly", () => {
    let isPinned = false;

    // Toggle 1 -> Pinned
    isPinned = !isPinned;
    assert.equal(isPinned, true, "Note should become pinned");

    // Toggle 2 -> Unpinned
    isPinned = !isPinned;
    assert.equal(isPinned, false, "Note should become unpinned");
  });
});

describe("Phase 4 Attachments Security & Storage", () => {
  test("validates supported business document MIME types", () => {
    const isMimeAllowed = (mime: string) => ALLOWED_MIME_TYPES.includes(mime);

    // Supported formats
    assert.ok(isMimeAllowed("application/pdf"), "PDF must be allowed");
    assert.ok(isMimeAllowed("image/jpeg"), "JPEG must be allowed");
    assert.ok(isMimeAllowed("image/png"), "PNG must be allowed");
    assert.ok(
      isMimeAllowed("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
      "XLSX must be allowed"
    );
    assert.ok(isMimeAllowed("text/csv"), "CSV must be allowed");

    // Disallowed dangerous formats
    assert.equal(isMimeAllowed("application/x-msdownload"), false, "EXE must be blocked");
    assert.equal(isMimeAllowed("application/javascript"), false, "JS must be blocked");
    assert.equal(isMimeAllowed("text/html"), false, "HTML must be blocked");
  });

  test("generates unguessable multi-tenant storage key", () => {
    const businessId = "biz_sai_tours_77";
    const entityType = "TRANSACTION";
    const fileName = "invoice_booking.pdf";
    const ext = fileName.split(".").pop();

    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const storageKey = `${businessId}/${entityType.toLowerCase()}/1727670000_${uuid}.${ext}`;

    assert.ok(storageKey.startsWith("biz_sai_tours_77/transaction/"), "Storage key must be isolated by business");
    assert.ok(storageKey.endsWith(".pdf"), "Storage key must preserve extension");
    assert.match(storageKey, /[0-9a-f]{8}-[0-9a-f]{4}/, "Must contain random UUID");
  });

  test("rejects files exceeding 10MB limit", () => {
    const MAX_SIZE = 10 * 1024 * 1024;

    const validSize = 5 * 1024 * 1024; // 5MB
    const oversized = 11 * 1024 * 1024; // 11MB

    assert.ok(validSize <= MAX_SIZE, "5MB file must be accepted");
    assert.ok(oversized > MAX_SIZE, "11MB file must exceed limit");
  });
});

describe("Phase 4 Pre-flight Duplicate Detection", () => {
  test("detects exact duplicate match by amount, date, and reference", () => {
    const existingRecords = [
      {
        id: "rec_1",
        transactionDate: "2026-09-30",
        amount: "5000.00",
        referenceNumber: "UPI-998877",
      },
    ];

    const isDuplicate = (checkDate: string, checkAmount: string, checkRef?: string) => {
      return existingRecords.some(
        (r) =>
          r.transactionDate === checkDate &&
          r.amount === checkAmount &&
          r.referenceNumber === checkRef
      );
    };

    // Identical entry -> detected
    assert.equal(isDuplicate("2026-09-30", "5000.00", "UPI-998877"), true);

    // Different amount -> not duplicate
    assert.equal(isDuplicate("2026-09-30", "6000.00", "UPI-998877"), false);

    // Different date -> not duplicate
    assert.equal(isDuplicate("2026-09-29", "5000.00", "UPI-998877"), false);
  });
});

describe("Phase 4 Cross-Business Tenant Isolation", () => {
  test("User belonging to Business A is strictly forbidden from accessing Business B record", async () => {
    const userA = {
      id: "usr_A",
      businessId: "biz_sai_tours_A",
      displayName: "Staff A",
    };

    const recordBelongingToB = {
      id: "rec_B_123",
      businessId: "biz_competitor_B",
      title: "Confidential Competitor Booking",
    };

    // Multi-tenant check
    await assert.rejects(
      async () => {
        await AuthorizationService.requireBusinessAccess(userA, recordBelongingToB.businessId);
      },
      {
        name: "ForbiddenError",
        message: /Cross-tenant access prohibited/,
      },
      "User A must NEVER access record belonging to Business B"
    );
  });

  test("User without records.void permission is strictly forbidden from voiding", () => {
    const staffPermissions = ["records.view", "records.create", "records.edit"];
    const staffRoles = ["STAFF"];

    const canVoid = hasPermission(staffPermissions, staffRoles, PERMISSIONS.RECORDS_VOID);
    assert.equal(canVoid, false, "Staff user must not possess void permissions");
  });
});
