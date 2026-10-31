import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { signToken, attachAuthCookie, UserSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

function getBaseUrl(req: NextRequest): string {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL.replace(/\/$/, "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  const baseUrl = getBaseUrl(req);
  const searchParams = req.nextUrl.searchParams;
  const isDemo = searchParams.get("demo") === "true";

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  // If user explicitly triggers the simulated Demo Google login or keys are missing with demo flag:
  if (isDemo || (!clientId && isDemo)) {
    try {
      const db = await getDb();
      const usersCol = db.collection("users");
      const demoGoogleEmail = "google.investigator@casememory.local";

      let existing = await usersCol.findOne({ email: demoGoogleEmail });
      if (!existing) {
        const insertRes = await usersCol.insertOne({
          name: "Det. Marcus Vance (Google)",
          email: demoGoogleEmail,
          role: "investigator",
          googleId: "google-demo-marcus-123456",
          createdAt: new Date(),
        });
        existing = {
          _id: insertRes.insertedId,
          name: "Det. Marcus Vance (Google)",
          email: demoGoogleEmail,
          role: "investigator",
        };
      }

      const sessionUser: UserSession = {
        id: existing._id.toString(),
        name: existing.name,
        email: existing.email,
        role: existing.role || "investigator",
      };

      const token = signToken(sessionUser);
      const res = NextResponse.redirect(new URL("/cases", baseUrl));
      attachAuthCookie(res, token);
      return res;
    } catch (err: any) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(err.message || "Demo login failed")}`, baseUrl)
      );
    }
  }

  // If real Google OAuth credentials are not set in .env.local yet:
  if (!clientId || !clientSecret || clientId.startsWith("replace_")) {
    return NextResponse.redirect(new URL("/login?google_missing=true", baseUrl));
  }

  // Real Google OAuth 2.0 Redirect
  const redirectUri = `${baseUrl}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
  });

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return NextResponse.redirect(googleAuthUrl);
}

