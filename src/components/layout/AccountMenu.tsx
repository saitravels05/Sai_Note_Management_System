"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { logoutAction } from "@/server/actions/auth.actions";
import {
  User,
  Shield,
  Settings,
  Users,
  LogOut,
  ChevronDown,
  Building,
} from "lucide-react";

export interface AccountMenuUser {
  id: string;
  displayName: string;
  email: string;
  businessName: string;
  businessCode: string;
  roleName: string;
  roleType: string;
  permissions: string[];
}

interface AccountMenuProps {
  user?: AccountMenuUser | null;
}

export function AccountMenu({ user: initialUser }: AccountMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<AccountMenuUser | null>(initialUser || null);
  const menuRef = useRef<HTMLDivElement>(null);

  // If user wasn't passed down from server layout, fetch from /api/auth/me
  useEffect(() => {
    if (!initialUser) {
      fetch("/api/auth/me")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.user) {
            setUser({
              id: data.user.id,
              displayName: data.user.displayName,
              email: data.user.email,
              businessName: data.user.businessName,
              businessCode: data.user.businessCode,
              roleName: data.user.roles[0] || data.user.roleTypes[0] || "Staff",
              roleType: data.user.roleTypes[0] || "STAFF",
              permissions: data.user.permissions || [],
            });
          }
        })
        .catch(() => {});
    }
  }, [initialUser]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold shadow-sm transition-all"
        >
          Sign In
        </Link>
      </div>
    );
  }

  const initials = user.displayName
    ? user.displayName
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "SA";

  const canManageUsers =
    user.roleType === "OWNER" ||
    user.permissions.includes("users.manage") ||
    user.permissions.includes("users.view");

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-slate-800/60 border border-transparent hover:border-slate-700/60 transition-all select-none"
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-orange-500 to-amber-500 text-white font-bold text-xs flex items-center justify-center shadow-md shadow-orange-500/20">
          {initials}
        </div>
        <div className="hidden md:flex flex-col text-left">
          <span className="text-xs font-semibold text-slate-200 leading-tight truncate max-w-[120px]">
            {user.displayName}
          </span>
          <span className="text-[10px] text-orange-400 font-medium leading-none mt-0.5">
            {user.roleName}
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[#0e1422] border border-slate-800 shadow-2xl py-2 z-50 animate-in fade-in duration-100">
          {/* User & Business Context Header */}
          <div className="px-4 py-3 border-b border-slate-800/80 bg-slate-900/40">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white truncate">
              <User className="w-3.5 h-3.5 text-orange-400" />
              <span>{user.displayName}</span>
            </div>
            <div className="text-[11px] text-slate-400 truncate mt-0.5">{user.email}</div>

            <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between">
              <div className="flex items-center gap-1 text-[11px] text-slate-400 truncate">
                <Building className="w-3 h-3 text-slate-500" />
                <span className="truncate">{user.businessName}</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-orange-500/20 text-orange-400 border border-orange-500/30">
                {user.roleName}
              </span>
            </div>
          </div>

          {/* Links */}
          <div className="py-1">
            {canManageUsers && (
              <Link
                href="/users"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
              >
                <Users className="w-4 h-4 text-slate-400" />
                <span>Team & Access Control</span>
              </Link>
            )}

            <Link
              href="/settings"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
            >
              <Settings className="w-4 h-4 text-slate-400" />
              <span>Business Settings</span>
            </Link>

            <Link
              href="/audit-log"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
            >
              <Shield className="w-4 h-4 text-slate-400" />
              <span>Audit Trail</span>
            </Link>
          </div>

          {/* Sign Out Action */}
          <div className="pt-1 mt-1 border-t border-slate-800/80">
            <form action={logoutAction}>
              <button
                type="submit"
                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
