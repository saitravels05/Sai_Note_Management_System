"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentUser, requirePermission } from "@/lib/auth/current-user";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { CategoryService } from "@/server/services/category.service";
import { CategoryType } from "@prisma/client";

export interface CategoryActionResult {
  success: boolean;
  categoryId?: string;
  categoryName?: string;
  error?: string;
  message?: string;
}

/**
 * Server Action: Quick-Create Category
 */
export async function quickCreateCategoryAction(
  _prevState: CategoryActionResult | null,
  formData: FormData
): Promise<CategoryActionResult> {
  try {
    const user = await requireCurrentUser();
    await requirePermission(PERMISSIONS.SETTINGS_MANAGE);

    const name = formData.get("name")?.toString().trim() || "";
    const typeStr = formData.get("type")?.toString() || CategoryType.BOTH;
    const type = typeStr as CategoryType;
    const description = formData.get("description")?.toString().trim() || undefined;

    if (!name) {
      return { success: false, error: "Category name is required" };
    }

    const category = await CategoryService.quickCreateCategory(user.businessId, {
      name,
      type,
      description,
    });

    revalidatePath("/records");
    revalidatePath("/settings");

    return {
      success: true,
      categoryId: category.id,
      categoryName: category.name,
      message: `Category ${category.name} created successfully`,
    };
  } catch (error) {
    console.error("Quick create category error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create category",
    };
  }
}

/**
 * Server Action: Get or Create Tag
 */
export async function getOrCreateTagAction(name: string) {
  const user = await requireCurrentUser();
  return CategoryService.getOrCreateTag(user.businessId, name);
}
