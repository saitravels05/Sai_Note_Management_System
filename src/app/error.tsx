"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log sanitized error client-side
    console.error("Application runtime error:", error.message);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full p-8 rounded-2xl glass-card border border-rose-500/30 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Something Went Wrong</h2>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            An unexpected error occurred while processing this accounting view. Sensitive credentials and database queries are strictly secured.
          </p>
        </div>
        <div className="pt-2 flex justify-center">
          <Button onClick={() => reset()} variant="primary" size="md">
            <RefreshCw className="w-4 h-4" />
            Try Again
          </Button>
        </div>
      </div>
    </div>
  );
}
