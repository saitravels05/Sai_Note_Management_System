"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentUser, requirePermission } from "@/lib/auth/current-user";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { PartyService } from "@/server/services/party.service";

export interface PartyActionResult {
  success: boolean;
  partyId?: string;
  partyName?: string;
  error?: string;
  message?: string;
}

/**
 * Server Action: Quick-Create Customer from modal/drawer
 */
export async function quickCreateCustomerAction(
  _prevState: PartyActionResult | null,
  formData: FormData
): Promise<PartyActionResult> {
  try {
    const user = await requireCurrentUser();
    await requirePermission(PERMISSIONS.CUSTOMERS_MANAGE);

    const name = formData.get("name")?.toString().trim() || "";
    const companyName = formData.get("companyName")?.toString().trim() || undefined;
    const phone = formData.get("phone")?.toString().trim() || undefined;
    const email = formData.get("email")?.toString().trim().toLowerCase() || undefined;
    const notes = formData.get("notes")?.toString().trim() || undefined;

    if (!name) {
      return { success: false, error: "Customer name is required" };
    }

    const customer = await PartyService.quickCreateCustomer(
      { name, companyName, phone, email, notes },
      { userId: user.id, businessId: user.businessId }
    );

    revalidatePath("/customers");
    revalidatePath("/records");

    return {
      success: true,
      partyId: customer.id,
      partyName: customer.name,
      message: `Customer ${customer.name} created successfully`,
    };
  } catch (error) {
    console.error("Quick create customer error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create customer",
    };
  }
}

/**
 * Server Action: Quick-Create Supplier from modal/drawer
 */
export async function quickCreateSupplierAction(
  _prevState: PartyActionResult | null,
  formData: FormData
): Promise<PartyActionResult> {
  try {
    const user = await requireCurrentUser();
    await requirePermission(PERMISSIONS.SUPPLIERS_MANAGE);

    const name = formData.get("name")?.toString().trim() || "";
    const companyName = formData.get("companyName")?.toString().trim() || undefined;
    const phone = formData.get("phone")?.toString().trim() || undefined;
    const email = formData.get("email")?.toString().trim().toLowerCase() || undefined;
    const notes = formData.get("notes")?.toString().trim() || undefined;

    if (!name) {
      return { success: false, error: "Supplier name is required" };
    }

    const supplier = await PartyService.quickCreateSupplier(
      { name, companyName, phone, email, notes },
      { userId: user.id, businessId: user.businessId }
    );

    revalidatePath("/suppliers");
    revalidatePath("/records");

    return {
      success: true,
      partyId: supplier.id,
      partyName: supplier.name,
      message: `Supplier ${supplier.name} created successfully`,
    };
  } catch (error) {
    console.error("Quick create supplier error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create supplier",
    };
  }
}

/**
 * Server Action: Search Customers
 */
export async function searchCustomersAction(query: string) {
  const user = await requireCurrentUser();
  return PartyService.searchCustomers(user.businessId, query);
}

/**
 * Server Action: Search Suppliers
 */
export async function searchSuppliersAction(query: string) {
  const user = await requireCurrentUser();
  return PartyService.searchSuppliers(user.businessId, query);
}
