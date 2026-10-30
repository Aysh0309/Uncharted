import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { LoginInputSchema } from "@/lib/models";
import { verifyPassword, signToken, attachAuthCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = LoginInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          status: "error",
          message: "Validation failed",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    const db = await getDb();
    const user = await db.collection("users").findOne({
      email: email.toLowerCase().trim(),
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { status: "error", message: "Invalid email or password" },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { status: "error", message: "Invalid email or password" },
        { status: 401 }
      );
    }

    const sessionUser = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    };

    const token = signToken(sessionUser);
    const response = NextResponse.json({
      status: "ok",
      message: "Login successful",
      user: sessionUser,
    });

    attachAuthCookie(response, token);
    return response;
  } catch (error: any) {
    return NextResponse.json(
      { status: "error", message: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

