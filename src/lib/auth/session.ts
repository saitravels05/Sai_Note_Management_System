import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { RoleType } from "@prisma/client";

export const SESSION_COOKIE_NAME = "sai_auth_session";

export interface SessionPayload {
  userId: string;
  authUserId: string;
  businessId: string;
  email: string;
  displayName: string;
  roles: string[];
  roleTypes: RoleType[];
  permissions: string[];
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET || "dev-secret-key-change-in-production-1234";
  return new TextEncoder().encode(secret);
}

/**
 * Sign a secure JWT session token using jose (HS256)
 */
export async function signSessionToken(
  payload: SessionPayload,
  rememberMe: boolean = false
): Promise<string> {
  const secret = getJwtSecret();
  const expirationTime = rememberMe ? "7d" : "24h";

  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(expirationTime)
    .setSubject(payload.userId)
    .sign(secret);
}

/**
 * Verify and decode a JWT session token
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  if (!token) return null;

  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });

    return {
      userId: payload.userId as string,
      authUserId: payload.authUserId as string,
      businessId: payload.businessId as string,
      email: payload.email as string,
      displayName: payload.displayName as string,
      roles: (payload.roles as string[]) || [],
      roleTypes: (payload.roleTypes as RoleType[]) || [],
      permissions: (payload.permissions as string[]) || [],
    };
  } catch {
    return null;
  }
}

/**
 * Set the session HTTP-only cookie on the outgoing response headers.
 */
export async function setSessionCookie(token: string, rememberMe: boolean = false): Promise<void> {
  const cookieStore = await cookies();
  const maxAge = rememberMe ? 7 * 24 * 60 * 60 : 24 * 60 * 60; // 7 days or 24 hours

  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

/**
 * Clear the session cookie (Logout)
 */
export async function deleteSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Retrieve raw session token from incoming request cookies
 */
export async function getSessionCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}
