import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export type UserRole = "admin" | "investigator" | "viewer";

export interface UserSession {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export const JWT_COOKIE_NAME = "casememory_token";

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET must be defined in production");
    }
    return "dev-insecure-jwt-secret-replace-in-env";
  }
  return secret;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(user: UserSession): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    getJwtSecret(),
    { expiresIn: "7d" }
  );
}

export function verifyToken(token: string): UserSession | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as UserSession;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Extracts and verifies the current session user from incoming Request cookies
 * or Next.js server cookie store.
 */
export async function getSessionUser(req?: NextRequest): Promise<UserSession | null> {
  let token: string | undefined;

  if (req) {
    token = req.cookies.get(JWT_COOKIE_NAME)?.value;
    if (!token) {
      const authHeader = req.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }
  } else {
    try {
      const cookieStore = cookies();
      token = cookieStore.get(JWT_COOKIE_NAME)?.value;
    } catch {
      // In contexts without cookies() header
    }
  }

  if (!token) return null;
  return verifyToken(token);
}

export function attachAuthCookie(res: NextResponse, token: string): void {
  res.cookies.set(JWT_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
}

export function removeAuthCookie(res: NextResponse): void {
  res.cookies.set(JWT_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
