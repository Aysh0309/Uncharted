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
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(error || "Google authorization was cancelled")}`,
        baseUrl
      )
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/login?google_missing=true", baseUrl));
  }

  try {
    const redirectUri = `${baseUrl}/api/auth/google/callback`;

    // 1. Exchange code for Google Access Token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error("Google token exchange error:", errBody);
      return NextResponse.redirect(
        new URL("/login?error=Failed+to+exchange+Google+token", baseUrl)
      );
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // 2. Fetch Google User Profile
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userInfoRes.ok) {
      return NextResponse.redirect(
        new URL("/login?error=Failed+to+fetch+Google+user+profile", baseUrl)
      );
    }

    const profile = await userInfoRes.json();
    const email = profile.email?.toLowerCase().trim();

    if (!email) {
      return NextResponse.redirect(
        new URL("/login?error=No+email+associated+with+this+Google+account", baseUrl)
      );
    }

    // 3. Find or Create User in MongoDB
    const db = await getDb();
    const usersCol = db.collection("users");

    let user = await usersCol.findOne({ email });

    if (!user) {
      const insertResult = await usersCol.insertOne({
        name: profile.name || email.split("@")[0],
        email,
        role: "investigator", // Default operational role for Google users
        googleId: profile.sub,
        picture: profile.picture,
        createdAt: new Date(),
      });

      user = {
        _id: insertResult.insertedId,
        name: profile.name || email.split("@")[0],
        email,
        role: "investigator",
        picture: profile.picture,
      };
    } else {
      // Update Google profile info if not already set
      await usersCol.updateOne(
        { _id: user._id },
        {
          $set: {
            googleId: profile.sub,
            ...(profile.picture ? { picture: profile.picture } : {}),
          },
        }
      );
    }

    // 4. Issue Session Cookie and Redirect
    const sessionUser: UserSession = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role || "investigator",
      picture: profile.picture || user.picture,
    };

    const token = signToken(sessionUser);
    const response = NextResponse.redirect(new URL("/cases", baseUrl));
    attachAuthCookie(response, token);
    return response;
  } catch (err: any) {
    console.error("Google OAuth error:", err);
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(err.message || "Google login failed")}`, baseUrl)
    );
  }
}

