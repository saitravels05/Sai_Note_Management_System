"use server";

import { requireCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { AISafeFilters, AIQueryResponse } from "@/types/ai";
import { AIProviderService } from "../services/ai/ai-provider";
import { AIExecutionService } from "../services/ai/ai-execution.service";

/**
 * Main Server Action for submitting conversational accounting queries.
 * Server-side enforced authentication, multi-tenant isolation, and rate limiting.
 */
export async function submitAIQueryAction(
  query: string,
  currentFilters?: AISafeFilters
): Promise<AIQueryResponse> {
  try {
    const user = await requireCurrentUser();

    if (!query || query.trim().length === 0) {
      return {
        success: false,
        error: "Query text cannot be empty.",
      };
    }

    // 1. Natural Language Interpretation (with timeout & rate limiting)
    let interpretation;
    try {
      interpretation = await AIProviderService.interpret(
        query,
        currentFilters,
        user.id
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI_ERROR";
      if (msg === "AI_DISABLED") {
        return {
          success: false,
          error: "AI Assistant is currently disabled by administrator configuration.",
        };
      }
      if (msg === "RATE_LIMIT_EXCEEDED") {
        return {
          success: false,
          error: "Too many AI queries in a short time. Please wait a moment before trying again.",
        };
      }
      if (msg === "AI_TIMEOUT") {
        return {
          success: false,
          error: "AI Assistant timed out while processing your question. Please try again.",
        };
      }
      return {
        success: false,
        error: "AI Assistant is temporarily unavailable. Please try again later.",
      };
    }

    // 2. Safe Service Execution (with permission intersection and tenant isolation)
    const chatMessage = await AIExecutionService.execute(
      query,
      interpretation,
      {
        userId: user.id,
        businessId: user.businessId,
        permissions: user.permissions,
        roles: user.roles,
      }
    );

    return {
      success: true,
      message: chatMessage,
    };
  } catch (error) {
    console.error("AI query submission error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to process query.",
    };
  }
}

/**
 * Clear AI query history for the active user.
 * Underlying accounting records are never touched.
 */
export async function clearAIHistoryAction(): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireCurrentUser();

    await prisma.aIQuery.deleteMany({
      where: {
        businessId: user.businessId,
        userId: user.id,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Clear AI history error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to clear history.",
    };
  }
}
