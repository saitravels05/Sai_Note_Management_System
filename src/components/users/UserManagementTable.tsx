"use client";

import { useState, useActionState } from "react";
import {
  inviteUserAction,
  changeUserRoleAction,
  deactivateUserAction,
  reactivateUserAction,
  type UserActionResult,
} from "@/server/actions/user.actions";
import {
  UserPlus,
  Shield,
  UserCheck,
  UserX,
  Clock,
  Mail,
  Calendar,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";

export interface SerializedUser {
  id: string;
  displayName: string;
  email: string;
  phone: string | null;
  status: "INVITED" | "ACTIVE" | "INACTIVE" | "SUSPENDED";
  roleName: string;
  roleId: string;
  roleType: string;
  createdAt: string;
  lastActiveAt: string | null;
}

export interface SerializedRole {
  id: string;
  name: string;
  type: string;
  description: string | null;
}

interface UserManagementTableProps {
  users: SerializedUser[];
  roles: SerializedRole[];
  currentUserId: string;
  canManageUsers: boolean;
}

export function UserManagementTable({
  users,
  roles,
  currentUserId,
  canManageUsers,
}: UserManagementTableProps) {
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SerializedUser | null>(null);

  const [inviteState, inviteFormAction, isInvitePending] = useActionState<
    UserActionResult | null,
    FormData
  >(async (prev, formData) => {
    const res = await inviteUserAction(prev, formData);
    if (res.success) {
      setIsInviteOpen(false);
    }
    return res;
  }, null);

  const [roleState, roleFormAction, isRolePending] = useActionState<
    UserActionResult | null,
    FormData
  >(async (prev, formData) => {
    const res = await changeUserRoleAction(prev, formData);
    if (res.success) {
      setEditingUser(null);
    }
    return res;
  }, null);

  const getStatusBadge = (status: SerializedUser["status"]) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Active
          </span>
        );
      case "INVITED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Invited
          </span>
        );
      case "SUSPENDED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Suspended
          </span>
        );
      case "INACTIVE":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            Inactive
          </span>
        );
    }
  };

  const getRoleBadge = (roleType: string, roleName: string) => {
    switch (roleType) {
      case "OWNER":
        return (
          <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/30">
            {roleName}
          </span>
        );
      case "ADMIN":
        return (
          <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            {roleName}
          </span>
        );
      case "ACCOUNTANT":
        return (
          <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30">
            {roleName}
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            {roleName}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Team Members & Access</h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage authorized staff, assign roles, and control permission boundaries for your business.
          </p>
        </div>

        {canManageUsers && (
          <button
            onClick={() => setIsInviteOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold text-xs shadow-lg shadow-orange-500/20 active:scale-95 transition-all self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4 stroke-[2.5]" />
            <span>Invite Team Member</span>
          </button>
        )}
      </div>

      {/* Users Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-800/90 bg-[#0e1422]/90 backdrop-blur-xl shadow-xl shadow-black/40">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-5 py-3.5">User</th>
                <th className="px-4 py-3.5">Role</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Last Active</th>
                <th className="px-4 py-3.5">Joined Date</th>
                {canManageUsers && <th className="px-5 py-3.5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                  {/* Name and Email */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-slate-700 to-slate-800 border border-slate-700 text-white font-bold text-xs flex items-center justify-center shrink-0">
                        {user.displayName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-white flex items-center gap-1.5 truncate">
                          {user.displayName}
                          {user.id === currentUserId && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-orange-500/20 text-orange-400 font-medium">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 truncate">
                          <Mail className="w-3 h-3 text-slate-500" />
                          <span>{user.email}</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-4 py-4">{getRoleBadge(user.roleType, user.roleName)}</td>

                  {/* Status */}
                  <td className="px-4 py-4">{getStatusBadge(user.status)}</td>

                  {/* Last Active */}
                  <td className="px-4 py-4 text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>
                        {user.lastActiveAt
                          ? format(new Date(user.lastActiveAt), "dd MMM yyyy, HH:mm")
                          : "Never"}
                      </span>
                    </div>
                  </td>

                  {/* Joined Date */}
                  <td className="px-4 py-4 text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>{format(new Date(user.createdAt), "dd MMM yyyy")}</span>
                    </div>
                  </td>

                  {/* Actions */}
                  {canManageUsers && (
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingUser(user)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-[11px] transition-colors"
                        >
                          Change Role
                        </button>

                        {user.status === "ACTIVE" ? (
                          <form
                            action={async (fd) => {
                              if (
                                confirm(
                                  `Are you sure you want to deactivate ${user.displayName}? They will immediately lose access.`
                                )
                              ) {
                                await deactivateUserAction(null, fd);
                              }
                            }}
                          >
                            <input type="hidden" name="userId" value={user.id} />
                            <button
                              type="submit"
                              disabled={user.id === currentUserId && user.roleType === "OWNER"}
                              title={
                                user.id === currentUserId && user.roleType === "OWNER"
                                  ? "Cannot deactivate your own Owner account"
                                  : "Deactivate user"
                              }
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                          </form>
                        ) : (
                          <form
                            action={async (fd) => {
                              await reactivateUserAction(null, fd);
                            }}
                          >
                            <input type="hidden" name="userId" value={user.id} />
                            <button
                              type="submit"
                              title="Reactivate user"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                            >
                              <UserCheck className="w-4 h-4" />
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite User Modal */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#0e1422] border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <UserPlus className="w-5 h-5 text-orange-400" />
                <span>Invite New Team Member</span>
              </div>
              <button
                onClick={() => setIsInviteOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {inviteState?.error && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-200">
                {inviteState.error}
              </div>
            )}

            <form action={inviteFormAction} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  name="displayName"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="ramesh@saitours.com"
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Assigned Role
                </label>
                <select
                  name="roleId"
                  required
                  defaultValue={roles[0]?.id}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-orange-500"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.type})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-500">
                  Role permissions strictly govern ledger and report operations.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsInviteOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInvitePending}
                  className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-orange-500/20 disabled:opacity-60 transition-all"
                >
                  {isInvitePending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending Invitation...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Send Invitation</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Role Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#0e1422] border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Shield className="w-5 h-5 text-orange-400" />
                <span>Change User Role</span>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {roleState?.error && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-200">
                {roleState.error}
              </div>
            )}

            <form action={roleFormAction} className="space-y-4">
              <input type="hidden" name="userId" value={editingUser.id} />

              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-400">Target Member</div>
                <div className="text-sm font-semibold text-white mt-0.5">{editingUser.displayName}</div>
                <div className="text-[11px] text-slate-500">{editingUser.email}</div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Select New Role
                </label>
                <select
                  name="newRoleId"
                  required
                  defaultValue={editingUser.roleId}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-orange-500"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.type})
                    </option>
                  ))}
                </select>
              </div>

              {editingUser.roleType === "OWNER" && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-amber-300">Last-Owner Protection:</span>
                    <span className="block mt-0.5">
                      If this is the only remaining Owner of the business, demotion will be blocked to maintain business continuity.
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRolePending}
                  className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-orange-500/20 disabled:opacity-60 transition-all"
                >
                  {isRolePending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating Role...</span>
                    </>
                  ) : (
                    <span>Confirm Role Change</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
