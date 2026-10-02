"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PlusCircle,
  FileText,
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
  ArrowUpRight,
  Users,
  Building2,
  Clock,
  CalendarCheck,
  UploadCloud,
  BarChart3,
  Sparkles,
  ShieldCheck,
  Database,
  Settings,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { useState, useEffect } from "react";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

interface AuthUserMeta {
  displayName: string;
  businessName: string;
  roleName: string;
  roleType: string;
  permissions: string[];
}

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: string;
  permission?: string;
}

interface NavigationSection {
  title: string;
  items: NavigationItem[];
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUserMeta | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setUser({
            displayName: data.user.displayName,
            businessName: data.user.businessName,
            roleName: data.user.roles[0] || data.user.roleTypes[0] || "Staff",
            roleType: data.user.roleTypes[0] || "STAFF",
            permissions: data.user.permissions || [],
          });
        }
      })
      .catch(() => {});
  }, []);

  const navigationSections: NavigationSection[] = [
    {
      title: "OPERATIONS",
      items: [
        {
          name: "Dashboard",
          href: "/",
          icon: LayoutDashboard,
        },
        {
          name: "Quick Entry",
          href: "/quick-entry",
          icon: PlusCircle,
          badge: "Fast",
          badgeColor: "bg-orange-500/20 text-orange-400 border border-orange-500/30",
        },
        {
          name: "Records & Notes",
          href: "/records",
          icon: FileText,
        },
        {
          name: "Documents Vault",
          href: "/documents",
          icon: FileText,
          badge: "Vault",
          badgeColor: "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30",
        },
        {
          name: "Income",
          href: "/income",
          icon: TrendingUp,
        },
        {
          name: "Expenses",
          href: "/expenses",
          icon: TrendingDown,
        },
        {
          name: "Customers",
          href: "/customers",
          icon: Users,
        },
        {
          name: "Suppliers",
          href: "/suppliers",
          icon: Building2,
        },
        {
          name: "Follow-Ups",
          href: "/follow-ups",
          icon: Clock,
          badge: "Queue",
          badgeColor: "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30",
        },
        {
          name: "Receivables",
          href: "/receivables",
          icon: ArrowDownLeft,
        },
        {
          name: "Payables",
          href: "/payables",
          icon: ArrowUpRight,
        },
        {
          name: "Parties / Ledger",
          href: "/parties",
          icon: Users,
        },
      ],
    },
    {
      title: "MONTH-END & REPORTING",
      items: [
        {
          name: "Month-End Closing",
          href: "/month-end",
          icon: CalendarCheck,
          badge: "Audit Lock",
          badgeColor: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
        },
        {
          name: "Excel / CSV Import",
          href: "/imports",
          icon: UploadCloud,
        },
        {
          name: "Reports & Exports",
          href: "/reports",
          icon: BarChart3,
        },
      ],
    },
    {
      title: "INTELLIGENCE & AUDIT",
      items: [
        {
          name: "AI Assistant",
          href: "/ai",
          icon: Sparkles,
          badge: "AI",
          badgeColor: "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30",
          permission: "ai.use",
        },
        {
          name: "Team & Users",
          href: "/users",
          icon: Users,
          permission: "users.view",
        },
        {
          name: "Audit Control Center",
          href: "/audit",
          icon: ShieldCheck,
          permission: "audit.view",
        },
        {
          name: "Backups & Recovery",
          href: "/settings/backups",
          icon: Database,
          permission: "backups.view",
        },
        {
          name: "Settings",
          href: "/settings",
          icon: Settings,
          permission: "settings.view",
        },
      ],
    },
  ];

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 w-72 flex flex-col bg-[#0d131f] border-r border-slate-800/80 transition-transform duration-200 lg:static lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-900/40">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-white/95 p-0.5 border border-orange-500/30 shadow-sm shadow-orange-500/10 group-hover:border-orange-500/60 transition-all flex items-center justify-center shrink-0">
            <Image
              src="/brand/logo.jpg"
              alt="Sai Tours & Travels"
              width={44}
              height={44}
              className="object-contain"
              priority
            />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base tracking-tight text-white truncate">
                Sai Tours & Travels
              </span>
            </div>
            <span className="text-xs text-orange-400/90 font-medium tracking-wide flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Accounting & Notes
            </span>
          </div>
        </Link>
      </div>

      {/* Period Lock Status Chip */}
      <div className="mx-4 mt-3 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded bg-orange-500/10 text-orange-400">
            <CalendarCheck className="w-3.5 h-3.5" />
          </span>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              Period
            </div>
            <div className="text-xs font-medium text-slate-200">September 2026</div>
          </div>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20">
          Open
        </span>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navigationSections.map((section) => (
          <div key={section.title} className="space-y-1">
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {section.title}
            </div>
            {section.items
              .filter((item) => {
                if (!item.permission) return true;
                if (!user) return true; // keep visible during initial load
                return (
                  user.roleType === "OWNER" ||
                  user.permissions.includes(item.permission) ||
                  user.permissions.includes("*")
                );
              })
              .map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all group",
                      isActive
                        ? "bg-gradient-to-r from-orange-500/20 to-orange-600/10 text-orange-300 border border-orange-500/30 shadow-sm"
                        : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={cn(
                          "w-4 h-4 transition-colors",
                          isActive
                            ? "text-orange-400"
                            : "text-slate-400 group-hover:text-slate-200"
                        )}
                      />
                      <span>{item.name}</span>
                    </div>

                    {item.badge ? (
                      <span
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded font-medium",
                          item.badgeColor
                        )}
                      >
                        {item.badge}
                      </span>
                    ) : isActive ? (
                      <ChevronRight className="w-3.5 h-3.5 text-orange-400/80" />
                    ) : null}
                  </Link>
                );
              })}
          </div>
        ))}
      </nav>

      {/* User / Session Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-900/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 text-white font-bold text-xs flex items-center justify-center shrink-0">
              {user?.displayName ? user.displayName.slice(0, 2).toUpperCase() : "SA"}
            </div>
            <div className="truncate">
              <div className="text-xs font-semibold text-slate-200 truncate">
                {user?.displayName || "Loading..."}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {user?.roleName || "Staff"} • {user?.businessName || "Sai Tours"}
              </div>
            </div>
          </div>
          <span
            title="Production Mode • Multi-Tenant Isolated"
            className="p-1 text-slate-500 hover:text-emerald-400 transition-colors"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400/80" />
          </span>
        </div>
      </div>
    </aside>
  );
}
