"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { Prisma } from "@prisma/client";

export interface FilterActionResult {
  success: boolean;
  filterId?: string;
  error?: string;
  message?: string;
}

/**
 * Save current search & filter state as a named filter for fast recall.
 */
export async function saveFilterAction(
  _prevState: FilterActionResult | null,
  formData: FormData
): Promise<FilterActionResult> {
  try {
    const user = await requireCurrentUser();

    const name = formData.get("name")?.toString().trim();
    const filterModule = formData.get("module")?.toString().trim() || "RECORDS";
    const filterJson = formData.get("filterDefinition")?.toString();

    if (!name) {
      return { success: false, error: "Filter name is required" };
    }
    if (!filterJson) {
      return { success: false, error: "Filter definition is missing" };
    }

    const filterDefinition = JSON.parse(filterJson) as Prisma.InputJsonValue;

    const saved = await prisma.savedFilter.upsert({
      where: {
        businessId_userId_name_module: {
          businessId: user.businessId,
          userId: user.id,
          name,
          module: filterModule,
        },
      },
      update: {
        filterDefinition,
      },
      create: {
        businessId: user.businessId,
        userId: user.id,
        name,
        module: filterModule,
        filterDefinition,
      },
    });

    revalidatePath("/records");

    return {
      success: true,
      filterId: saved.id,
      message: `Filter "${name}" saved`,
    };
  } catch (error) {
    console.error("Save filter error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save filter",
    };
  }
}

/**
 * Delete a saved filter.
 */
export async function deleteFilterAction(id: string): Promise<FilterActionResult> {
  try {
    const user = await requireCurrentUser();

    await prisma.savedFilter.deleteMany({
      where: {
        id,
        businessId: user.businessId,
        userId: user.id,
      },
    });

    revalidatePath("/records");

    return {
      success: true,
      message: "Saved filter removed",
    };
  } catch (error) {
    console.error("Delete filter error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete filter",
    };
  }
}

/**
 * Retrieve saved filters for a specific module.
 */
export async function getSavedFiltersAction(module: string = "RECORDS") {
  const user = await requireCurrentUser();

  return prisma.savedFilter.findMany({
    where: {
      businessId: user.businessId,
      userId: user.id,
      module,
    },
    orderBy: { createdAt: "desc" },
  });
}
