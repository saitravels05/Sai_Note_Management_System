import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      businessId: user.businessId,
      businessName: user.businessName,
      businessCode: user.businessCode,
      currency: user.currency,
      roles: user.roles,
      roleTypes: user.roleTypes,
      permissions: user.permissions,
    },
  });
}
