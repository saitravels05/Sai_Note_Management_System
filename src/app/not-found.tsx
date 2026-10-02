import Link from "next/link";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full p-8 rounded-2xl glass-card border border-slate-800 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Page Not Found</h2>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            The requested accounting page or record view does not exist.
          </p>
        </div>
        <div className="pt-2 flex justify-center">
          <Link href="/">
            <Button variant="primary" size="md">
              <ArrowLeft className="w-4 h-4" />
              Return to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
