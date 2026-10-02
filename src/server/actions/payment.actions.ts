"use server";

import { requirePermission } from "@/lib/auth/current-user";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { PaymentService, type CreateAllocationDto } from "@/server/services/payment.service";
import { ReconciliationService } from "@/server/services/reconciliation.service";
import { PaymentDirection } from "@prisma/client";
import { revalidatePath } from "next/cache";

export interface PaymentActionResult {
  success: boolean;
  paymentId?: string;
  paymentNumber?: string;
  error?: string;
}

export async function recordPaymentAction(
  _prevState: unknown,
  formData: FormData
): Promise<PaymentActionResult> {
  try {
    const user = await requirePermission(PERMISSIONS.PAYMENTS_CREATE);

    const directionStr = formData.get("direction") as string;
    const direction =
      directionStr === "OUT" ? PaymentDirection.OUT : PaymentDirection.IN;

    const amountStr = formData.get("amount") as string;
    const paymentDateStr = formData.get("paymentDate") as string;
    const paymentMethodId = formData.get("paymentMethodId") as string;
    const customerId = (formData.get("customerId") as string) || null;
    const supplierId = (formData.get("supplierId") as string) || null;
    const referenceNumber = (formData.get("referenceNumber") as string) || null;
    const notes = (formData.get("notes") as string) || null;
    const allocationsJson = formData.get("allocations") as string;

    let allocations: CreateAllocationDto[] = [];
    if (allocationsJson) {
      try {
        allocations = JSON.parse(allocationsJson);
      } catch {
        return { success: false, error: "Invalid allocation format" };
      }
    }

    const paymentDate = paymentDateStr ? new Date(paymentDateStr) : new Date();

    const payment = await PaymentService.recordPayment({
      businessId: user.businessId,
      userId: user.id,
      direction,
      amount: amountStr,
      paymentDate,
      paymentMethodId,
      customerId,
      supplierId,
      referenceNumber,
      notes,
      allocations,
    });

    revalidatePath("/records");
    revalidatePath("/receivables");
    revalidatePath("/payables");
    revalidatePath("/dashboard");
    revalidatePath("/");

    return {
      success: true,
      paymentId: payment.id,
      paymentNumber: payment.paymentNumber,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to record payment";
    return { success: false, error: msg };
  }
}

export async function voidPaymentAction(
  paymentId: string,
  voidReason: string
): Promise<PaymentActionResult> {
  try {
    const user = await requirePermission(PERMISSIONS.PAYMENTS_VOID);

    await PaymentService.voidPayment({
      paymentId,
      businessId: user.businessId,
      userId: user.id,
      voidReason,
    });

    revalidatePath("/records");
    revalidatePath("/receivables");
    revalidatePath("/payables");
    revalidatePath("/dashboard");
    revalidatePath("/");

    return { success: true, paymentId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to void payment";
    return { success: false, error: msg };
  }
}

export async function runReconciliationAction() {
  try {
    const user = await requirePermission(PERMISSIONS.ACCOUNTING_RECONCILE);

    const report = await ReconciliationService.runReconciliation(user.businessId);
    return { success: true, report };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Reconciliation check failed";
    return { success: false, error: msg };
  }
}
