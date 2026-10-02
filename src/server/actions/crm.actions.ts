"use server";

import { requireCurrentUser } from "@/lib/auth/current-user";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { revalidatePath } from "next/cache";
import { CRMService } from "../services/crm/crm.service";
import { FollowUpService } from "../services/crm/follow-up.service";
import { PromiseService } from "../services/crm/promise.service";
import { CommunicationService } from "../services/crm/communication.service";
import { PartyService } from "../services/party.service";
import {
  CreateFollowUpInput,
  CompleteFollowUpInput,
  CreatePromiseInput,
  CreateCommitmentInput,
  CreateCommunicationLogInput,
  FollowUpItemDTO,
} from "@/types/crm";
import { prisma } from "@/lib/db";
import { PartyStatus } from "@prisma/client";

// ===================================================================
// CUSTOMER CRM ACTIONS
// ===================================================================

export async function createCustomerAction(input: {
  name: string;
  companyName?: string;
  phone?: string;
  email?: string;
  notes?: string;
  creditLimit?: number;
  assignedUserId?: string;
  tags?: string[];
  preferredContactMethod?: string;
  preferredContactTime?: string;
  languagePreference?: string;
}) {
  try {
    const user = await requireCurrentUser();
    if (!hasPermission(user.permissions, user.roleTypes, PERMISSIONS.CUSTOMERS_MANAGE)) {
      return { success: false, error: "Permission denied: customers.manage required." };
    }

    // 1. Check duplicate warning
    const duplicates = await CRMService.findDuplicateParties({
      businessId: user.businessId,
      type: "CUSTOMER",
      name: input.name,
      phone: input.phone,
      email: input.email,
    });

    // 2. Create customer
    const customer = await PartyService.quickCreateCustomer(
      {
        name: input.name,
        companyName: input.companyName,
        phone: input.phone,
        email: input.email,
        notes: input.notes,
      },
      { businessId: user.businessId, userId: user.id }
    );

    // 3. Update CRM metadata if provided
    if (input.assignedUserId || input.tags || input.preferredContactMethod || input.languagePreference) {
      await CRMService.updateCustomerCRMDetails({
        customerId: customer.id,
        businessId: user.businessId,
        userId: user.id,
        assignedUserId: input.assignedUserId,
        tags: input.tags,
        preferredContactMethod: input.preferredContactMethod,
        preferredContactTime: input.preferredContactTime,
        languagePreference: input.languagePreference,
      });
    }

    revalidatePath("/customers");
    revalidatePath("/receivables");
    revalidatePath("/parties");

    return {
      success: true,
      customerId: customer.id,
      duplicateWarnings: duplicates.length > 0 ? duplicates : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create customer.",
    };
  }
}

export async function updateCustomerCRMAction(params: {
  customerId: string;
  assignedUserId?: string | null;
  preferredContactMethod?: string | null;
  preferredContactTime?: string | null;
  languagePreference?: string;
  tags?: string[];
  isPinnedNote?: string | null;
}) {
  try {
    const user = await requireCurrentUser();
    if (!hasPermission(user.permissions, user.roleTypes, PERMISSIONS.CUSTOMERS_MANAGE)) {
      return { success: false, error: "Permission denied: customers.manage required." };
    }

    await CRMService.updateCustomerCRMDetails({
      ...params,
      businessId: user.businessId,
      userId: user.id,
    });

    revalidatePath(`/customers/${params.customerId}`);
    revalidatePath("/customers");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update customer details.",
    };
  }
}

export async function archiveCustomerAction(customerId: string) {
  try {
    const user = await requireCurrentUser();
    if (!hasPermission(user.permissions, user.roleTypes, PERMISSIONS.CUSTOMERS_MANAGE)) {
      return { success: false, error: "Permission denied: customers.manage required." };
    }

    await CRMService.archiveCustomer(customerId, user.businessId, user.id);

    revalidatePath(`/customers/${customerId}`);
    revalidatePath("/customers");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to archive customer.",
    };
  }
}

export async function unarchiveCustomerAction(customerId: string) {
  try {
    const user = await requireCurrentUser();
    if (!hasPermission(user.permissions, user.roleTypes, PERMISSIONS.CUSTOMERS_MANAGE)) {
      return { success: false, error: "Permission denied: customers.manage required." };
    }

    await prisma.customer.update({
      where: { id: customerId, businessId: user.businessId },
      data: { status: PartyStatus.ACTIVE, archivedAt: null },
    });

    revalidatePath(`/customers/${customerId}`);
    revalidatePath("/customers");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to restore customer.",
    };
  }
}

// ===================================================================
// SUPPLIER CRM ACTIONS
// ===================================================================

export async function createSupplierAction(input: {
  name: string;
  companyName?: string;
  phone?: string;
  email?: string;
  notes?: string;
  assignedUserId?: string;
  tags?: string[];
  preferredContactMethod?: string;
  preferredContactTime?: string;
  languagePreference?: string;
}) {
  try {
    const user = await requireCurrentUser();
    if (!hasPermission(user.permissions, user.roleTypes, PERMISSIONS.SUPPLIERS_MANAGE)) {
      return { success: false, error: "Permission denied: suppliers.manage required." };
    }

    const duplicates = await CRMService.findDuplicateParties({
      businessId: user.businessId,
      type: "SUPPLIER",
      name: input.name,
      phone: input.phone,
      email: input.email,
    });

    const supplier = await PartyService.quickCreateSupplier(
      {
        name: input.name,
        companyName: input.companyName,
        phone: input.phone,
        email: input.email,
        notes: input.notes,
      },
      { businessId: user.businessId, userId: user.id }
    );

    if (input.assignedUserId || input.tags || input.preferredContactMethod || input.languagePreference) {
      await CRMService.updateSupplierCRMDetails({
        supplierId: supplier.id,
        businessId: user.businessId,
        userId: user.id,
        assignedUserId: input.assignedUserId,
        tags: input.tags,
        preferredContactMethod: input.preferredContactMethod,
        preferredContactTime: input.preferredContactTime,
        languagePreference: input.languagePreference,
      });
    }

    revalidatePath("/suppliers");
    revalidatePath("/payables");
    revalidatePath("/parties");

    return {
      success: true,
      supplierId: supplier.id,
      duplicateWarnings: duplicates.length > 0 ? duplicates : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create supplier.",
    };
  }
}

export async function updateSupplierCRMAction(params: {
  supplierId: string;
  assignedUserId?: string | null;
  preferredContactMethod?: string | null;
  preferredContactTime?: string | null;
  languagePreference?: string;
  tags?: string[];
  isPinnedNote?: string | null;
}) {
  try {
    const user = await requireCurrentUser();
    if (!hasPermission(user.permissions, user.roleTypes, PERMISSIONS.SUPPLIERS_MANAGE)) {
      return { success: false, error: "Permission denied: suppliers.manage required." };
    }

    await CRMService.updateSupplierCRMDetails({
      ...params,
      businessId: user.businessId,
      userId: user.id,
    });

    revalidatePath(`/suppliers/${params.supplierId}`);
    revalidatePath("/suppliers");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update supplier details.",
    };
  }
}

export async function archiveSupplierAction(supplierId: string) {
  try {
    const user = await requireCurrentUser();
    if (!hasPermission(user.permissions, user.roleTypes, PERMISSIONS.SUPPLIERS_MANAGE)) {
      return { success: false, error: "Permission denied: suppliers.manage required." };
    }

    await CRMService.archiveSupplier(supplierId, user.businessId, user.id);

    revalidatePath(`/suppliers/${supplierId}`);
    revalidatePath("/suppliers");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to archive supplier.",
    };
  }
}

// ===================================================================
// FOLLOW-UP ACTIONS
// ===================================================================

export async function createFollowUpAction(input: CreateFollowUpInput) {
  try {
    const user = await requireCurrentUser();
    if (!hasPermission(user.permissions, user.roleTypes, PERMISSIONS.FOLLOWUPS_CREATE)) {
      return { success: false, error: "Permission denied: followups.create required." };
    }

    const followUp = await FollowUpService.createFollowUp(input, {
      businessId: user.businessId,
      userId: user.id,
      userEmail: user.email,
    });

    revalidatePath("/follow-ups");
    if (input.customerId) revalidatePath(`/customers/${input.customerId}`);
    if (input.supplierId) revalidatePath(`/suppliers/${input.supplierId}`);
    revalidatePath("/receivables");
    revalidatePath("/payables");

    return { success: true, followUpId: followUp.id, followUp };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create follow-up.",
    };
  }
}

export async function completeFollowUpAction(input: CompleteFollowUpInput) {
  try {
    const user = await requireCurrentUser();
    if (!hasPermission(user.permissions, user.roleTypes, PERMISSIONS.FOLLOWUPS_COMPLETE)) {
      return { success: false, error: "Permission denied: followups.complete required." };
    }

    const result = await FollowUpService.completeFollowUp(input, {
      businessId: user.businessId,
      userId: user.id,
    });

    revalidatePath("/follow-ups");
    revalidatePath("/receivables");
    revalidatePath("/payables");

    return {
      success: true,
      requiresPaymentRecord: result.requiresPaymentRecord,
      noticeMessage: result.noticeMessage,
      followUp: result.completedFollowUp as unknown as FollowUpItemDTO,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to complete follow-up.",
    };
  }
}

export async function cancelFollowUpAction(followUpId: string, reason?: string) {
  try {
    const user = await requireCurrentUser();
    if (!hasPermission(user.permissions, user.roleTypes, PERMISSIONS.FOLLOWUPS_EDIT)) {
      return { success: false, error: "Permission denied: followups.edit required." };
    }

    const updated = await FollowUpService.cancelFollowUp(followUpId, {
      businessId: user.businessId,
      userId: user.id,
      reason,
    });

    revalidatePath("/follow-ups");

    return { success: true, followUp: updated as unknown as FollowUpItemDTO };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to cancel follow-up.",
    };
  }
}

// ===================================================================
// PROMISE-TO-PAY ACTIONS (Requirements 39, 41, 104)
// ===================================================================

export async function createPromiseAction(input: CreatePromiseInput) {
  try {
    const user = await requireCurrentUser();
    if (!hasPermission(user.permissions, user.roleTypes, PERMISSIONS.PROMISES_MANAGE)) {
      return { success: false, error: "Permission denied: promises.manage required." };
    }

    const promise = await PromiseService.createPromise(input, {
      businessId: user.businessId,
      userId: user.id,
    });

    revalidatePath(`/customers/${input.customerId}`);
    revalidatePath("/receivables");
    revalidatePath("/follow-ups");

    return { success: true, promiseId: promise.id, promise };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to record promise-to-pay.",
    };
  }
}

export async function updatePromiseFulfillmentAction(promiseId: string, paidAmount: number | string) {
  try {
    const user = await requireCurrentUser();
    if (!hasPermission(user.permissions, user.roleTypes, PERMISSIONS.PROMISES_MANAGE)) {
      return { success: false, error: "Permission denied: promises.manage required." };
    }

    await PromiseService.updatePromiseFulfillment({
      promiseId,
      businessId: user.businessId,
      userId: user.id,
      actualPaidAmount: paidAmount,
    });

    revalidatePath("/receivables");
    revalidatePath("/follow-ups");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update promise fulfillment.",
    };
  }
}

// ===================================================================
// SUPPLIER COMMITMENT ACTIONS
// ===================================================================

export async function createCommitmentAction(input: CreateCommitmentInput) {
  try {
    const user = await requireCurrentUser();
    if (!hasPermission(user.permissions, user.roleTypes, PERMISSIONS.PAYABLES_VIEW)) {
      return { success: false, error: "Permission denied: payables.view required." };
    }

    const commitment = await PromiseService.createCommitment(input, {
      businessId: user.businessId,
      userId: user.id,
    });

    revalidatePath(`/suppliers/${input.supplierId}`);
    revalidatePath("/payables");
    revalidatePath("/follow-ups");

    return { success: true, commitmentId: commitment.id, commitment };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to record payment commitment.",
    };
  }
}

// ===================================================================
// COMMUNICATION ACTIONS
// ===================================================================

export async function logCommunicationAction(input: CreateCommunicationLogInput) {
  try {
    const user = await requireCurrentUser();

    const log = await CommunicationService.logCommunication(input, {
      businessId: user.businessId,
      userId: user.id,
    });

    if (input.customerId) revalidatePath(`/customers/${input.customerId}`);
    if (input.supplierId) revalidatePath(`/suppliers/${input.supplierId}`);

    return { success: true, logId: log.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to record communication log.",
    };
  }
}
