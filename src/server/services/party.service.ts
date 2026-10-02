import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { NumberingService } from "./numbering.service";
import { AuditService } from "./audit.service";
import { AuditAction, PartyStatus } from "@prisma/client";

export interface PartyContext {
  userId: string;
  businessId: string;
}

export interface QuickCreateCustomerInput {
  name: string;
  companyName?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface QuickCreateSupplierInput {
  name: string;
  companyName?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export class PartyService {
  /**
   * Search Customers by Name, Phone, Code, or Email within authenticated business.
   */
  public static async searchCustomers(businessId: string, query?: string) {
    const q = query?.trim() || "";

    return prisma.customer.findMany({
      where: {
        businessId,
        status: PartyStatus.ACTIVE,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { companyName: { contains: q, mode: "insensitive" } },
                { phone: { contains: q, mode: "insensitive" } },
                { customerCode: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
      take: 25,
    });
  }

  /**
   * Search Suppliers by Name, Phone, Code, or Company within authenticated business.
   */
  public static async searchSuppliers(businessId: string, query?: string) {
    const q = query?.trim() || "";

    return prisma.supplier.findMany({
      where: {
        businessId,
        status: PartyStatus.ACTIVE,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { companyName: { contains: q, mode: "insensitive" } },
                { phone: { contains: q, mode: "insensitive" } },
                { supplierCode: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
      take: 25,
    });
  }

  /**
   * Quick-Create a Customer on the fly during transaction/note entry.
   */
  public static async quickCreateCustomer(input: QuickCreateCustomerInput, ctx: PartyContext) {
    const { businessId, userId } = ctx;

    if (!input.name || input.name.trim().length === 0) {
      throw new AppError("Customer name is required.", 400);
    }

    const customerCode = await NumberingService.getNextSequenceNumber(
      businessId,
      "CUSTOMER",
      "CUS"
    );

    const customer = await prisma.customer.create({
      data: {
        businessId,
        customerCode,
        name: input.name.trim(),
        companyName: input.companyName?.trim() || null,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        notes: input.notes?.trim() || null,
        status: PartyStatus.ACTIVE,
      },
    });

    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.CREATE,
      entityType: "CUSTOMER",
      entityId: customer.id,
      newValues: { customerCode, name: customer.name },
      reason: "Quick customer created during record entry",
    });

    return customer;
  }

  /**
   * Quick-Create a Supplier on the fly during transaction/note entry.
   */
  public static async quickCreateSupplier(input: QuickCreateSupplierInput, ctx: PartyContext) {
    const { businessId, userId } = ctx;

    if (!input.name || input.name.trim().length === 0) {
      throw new AppError("Supplier name is required.", 400);
    }

    const supplierCode = await NumberingService.getNextSequenceNumber(
      businessId,
      "SUPPLIER",
      "SUP"
    );

    const supplier = await prisma.supplier.create({
      data: {
        businessId,
        supplierCode,
        name: input.name.trim(),
        companyName: input.companyName?.trim() || null,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        notes: input.notes?.trim() || null,
        status: PartyStatus.ACTIVE,
      },
    });

    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.CREATE,
      entityType: "SUPPLIER",
      entityId: supplier.id,
      newValues: { supplierCode, name: supplier.name },
      reason: "Quick supplier created during record entry",
    });

    return supplier;
  }
}
