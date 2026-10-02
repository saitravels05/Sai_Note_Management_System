import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { CategoryType } from "@prisma/client";

export class CategoryService {
  /**
   * Retrieve active categories appropriate for the transaction type.
   * Income -> INCOME or BOTH
   * Expense -> EXPENSE or BOTH
   */
  public static async getCategories(businessId: string, filterType?: "INCOME" | "EXPENSE" | "BOTH" | "ALL") {
    let types: CategoryType[] = [CategoryType.INCOME, CategoryType.EXPENSE, CategoryType.BOTH, CategoryType.NOTE];

    if (filterType === "INCOME") {
      types = [CategoryType.INCOME, CategoryType.BOTH];
    } else if (filterType === "EXPENSE") {
      types = [CategoryType.EXPENSE, CategoryType.BOTH];
    }

    return prisma.category.findMany({
      where: {
        businessId,
        isActive: true,
        type: { in: types },
      },
      orderBy: [
        { sortOrder: "asc" },
        { name: "asc" },
      ],
    });
  }

  /**
   * Quick-Create a Category.
   */
  public static async quickCreateCategory(
    businessId: string,
    input: { name: string; type: CategoryType; description?: string }
  ) {
    if (!input.name || input.name.trim().length === 0) {
      throw new AppError("Category name is required.", 400);
    }

    const existing = await prisma.category.findFirst({
      where: {
        businessId,
        name: input.name.trim(),
        type: input.type,
      },
    });

    if (existing) {
      return existing;
    }

    return prisma.category.create({
      data: {
        businessId,
        name: input.name.trim(),
        type: input.type,
        description: input.description?.trim() || null,
        isActive: true,
      },
    });
  }

  /**
   * Retrieve all Tags for the business.
   */
  public static async getTags(businessId: string) {
    return prisma.tag.findMany({
      where: { businessId },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Quick-Create or get an existing Tag.
   */
  public static async getOrCreateTag(businessId: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) throw new AppError("Tag name cannot be empty.", 400);

    return prisma.tag.upsert({
      where: {
        businessId_name: {
          businessId,
          name: trimmed,
        },
      },
      update: {},
      create: {
        businessId,
        name: trimmed,
      },
    });
  }
}
