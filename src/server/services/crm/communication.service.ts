import { prisma } from "@/lib/db";
import {
  CommunicationDirection,
  AuditAction,
} from "@prisma/client";
import { AppError, NotFoundError } from "@/lib/errors";
import {
  CommunicationLogItemDTO,
  CreateCommunicationLogInput,
  CRMActivityItemDTO,
} from "@/types/crm";
import { AuditService } from "../audit.service";
import { Money } from "@/lib/money";

export class CommunicationService {
  // ===================================================================
  // COMMUNICATION LOG (Requirements 68, 69, 70, 71)
  // Records manual interaction records. Does NOT claim automated delivery.
  // ===================================================================

  public static async logCommunication(
    input: CreateCommunicationLogInput,
    ctx: { businessId: string; userId: string }
  ): Promise<CommunicationLogItemDTO> {
    const { businessId, userId } = ctx;

    if (!input.summary || input.summary.trim().length === 0) {
      throw new AppError("Communication summary is required.", 400);
    }
    if (!input.channel) {
      throw new AppError("Communication channel is required.", 400);
    }

    if (input.customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: input.customerId, businessId },
      });
      if (!customer) {
        throw new NotFoundError("Customer not found in this business.");
      }
    }

    if (input.supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: input.supplierId, businessId },
      });
      if (!supplier) {
        throw new NotFoundError("Supplier not found in this business.");
      }
    }

    const commDate = input.communicationDate ? new Date(input.communicationDate) : new Date();

    const log = await prisma.communicationLog.create({
      data: {
        businessId,
        customerId: input.customerId || null,
        supplierId: input.supplierId || null,
        channel: input.channel,
        direction: input.direction || CommunicationDirection.OUTBOUND,
        subject: input.subject?.trim() || null,
        summary: input.summary.trim(),
        communicationDate: commDate,
        userId,
        followUpId: input.followUpId || null,
      },
      include: {
        user: { select: { displayName: true } },
        customer: { select: { name: true } },
        supplier: { select: { name: true } },
      },
    });

    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.COMMUNICATION_LOGGED,
      entityType: "COMMUNICATION_LOG",
      entityId: log.id,
      newValues: { channel: log.channel, direction: log.direction },
    });

    return {
      id: log.id,
      channel: log.channel,
      direction: log.direction,
      subject: log.subject,
      summary: log.summary,
      communicationDate: log.communicationDate.toISOString(),
      userName: log.user.displayName,
      customerId: log.customerId,
      customerName: log.customer?.name || null,
      supplierId: log.supplierId,
      supplierName: log.supplier?.name || null,
      createdAt: log.createdAt.toISOString(),
    };
  }

  public static async getCommunicationLogs(params: {
    businessId: string;
    customerId?: string;
    supplierId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: CommunicationLogItemDTO[]; totalCount: number }> {
    const { businessId, customerId, supplierId, page = 1, pageSize = 25 } = params;

    const where: Record<string, unknown> = {
      businessId,
      ...(customerId ? { customerId } : {}),
      ...(supplierId ? { supplierId } : {}),
    };

    const [logs, totalCount] = await Promise.all([
      prisma.communicationLog.findMany({
        where,
        include: {
          user: { select: { displayName: true } },
          customer: { select: { name: true } },
          supplier: { select: { name: true } },
        },
        orderBy: { communicationDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.communicationLog.count({ where }),
    ]);

    const items: CommunicationLogItemDTO[] = logs.map((l) => ({
      id: l.id,
      channel: l.channel,
      direction: l.direction,
      subject: l.subject,
      summary: l.summary,
      communicationDate: l.communicationDate.toISOString(),
      userName: l.user.displayName,
      customerId: l.customerId,
      customerName: l.customer?.name || null,
      supplierId: l.supplierId,
      supplierName: l.supplier?.name || null,
      createdAt: l.createdAt.toISOString(),
    }));

    return { items, totalCount };
  }

  // ===================================================================
  // UNIFIED CRM ACTIVITY TIMELINE (Requirements 53, 60)
  // Aggregates follow-ups, promises, payments, transactions, and logs
  // ===================================================================

  public static async getPartyActivityTimeline(params: {
    businessId: string;
    customerId?: string;
    supplierId?: string;
  }): Promise<CRMActivityItemDTO[]> {
    const { businessId, customerId, supplierId } = params;
    const activities: CRMActivityItemDTO[] = [];

    // 1. Follow-ups
    const followUps = await prisma.followUp.findMany({
      where: {
        businessId,
        ...(customerId ? { customerId } : {}),
        ...(supplierId ? { supplierId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    for (const f of followUps) {
      activities.push({
        id: `fu_${f.id}`,
        date: f.createdAt.toISOString(),
        type: "FOLLOW_UP",
        title: f.title,
        description: f.outcomeNotes || f.description || `Status: ${f.status}`,
        badge: f.status,
        badgeColor: f.status === "COMPLETED" ? "bg-emerald-500/20 text-emerald-400" : "bg-cyan-500/20 text-cyan-400",
        author: f.createdBy,
      });
    }

    // 2. Promises
    if (customerId) {
      const promises = await prisma.promiseToPay.findMany({
        where: { businessId, customerId },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      for (const p of promises) {
        activities.push({
          id: `prom_${p.id}`,
          date: p.createdAt.toISOString(),
          type: "PROMISE",
          title: `Payment Promised: ${Money.fromDecimal(p.promisedAmount).format()}`,
          description: p.notes || `Promise date: ${p.promiseDate.toLocaleDateString("en-IN")}`,
          badge: p.status,
          badgeColor: p.status === "FULFILLED" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400",
          amount: Money.fromDecimal(p.promisedAmount).format(),
        });
      }
    }

    // 3. Commitments
    if (supplierId) {
      const commitments = await prisma.paymentCommitment.findMany({
        where: { businessId, supplierId },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      for (const c of commitments) {
        activities.push({
          id: `com_${c.id}`,
          date: c.createdAt.toISOString(),
          type: "COMMITMENT",
          title: `Planned Payment: ${Money.fromDecimal(c.plannedAmount).format()}`,
          description: c.notes || `Planned date: ${c.commitmentDate.toLocaleDateString("en-IN")}`,
          badge: c.status,
          badgeColor: "bg-purple-500/20 text-purple-400",
          amount: Money.fromDecimal(c.plannedAmount).format(),
        });
      }
    }

    // 4. Communication Logs
    const comms = await prisma.communicationLog.findMany({
      where: {
        businessId,
        ...(customerId ? { customerId } : {}),
        ...(supplierId ? { supplierId } : {}),
      },
      include: { user: { select: { displayName: true } } },
      orderBy: { communicationDate: "desc" },
      take: 20,
    });

    for (const c of comms) {
      activities.push({
        id: `comm_${c.id}`,
        date: c.communicationDate.toISOString(),
        type: "COMMUNICATION",
        title: `${c.direction === "OUTBOUND" ? "Outbound" : "Inbound"} ${c.channel}: ${c.subject || "Interaction"}`,
        description: c.summary,
        badge: c.channel,
        badgeColor: "bg-blue-500/20 text-blue-400",
        author: c.user.displayName,
      });
    }

    // Sort all chronologically descending
    activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return activities.slice(0, 30);
  }
}
