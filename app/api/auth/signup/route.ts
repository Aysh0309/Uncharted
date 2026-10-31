import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { SignUpInputSchema } from "@/lib/models";
import { hashPassword, signToken, attachAuthCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = SignUpInputSchema.safeParse(body);

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

    const { name, email, password, role } = parsed.data;
    const cleanEmail = email.toLowerCase().trim();

    const db = await getDb();
    const usersCol = db.collection("users");

    // Check if user already exists
    const existing = await usersCol.findOne({ email: cleanEmail });
    if (existing) {
      return NextResponse.json(
        { status: "error", message: "An account with this email already exists. Please sign in instead." },
        { status: 409 }
      );
    }

    // Hash password and store user
    const passwordHash = await hashPassword(password);
    const now = new Date();
    const result = await usersCol.insertOne({
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      role: role || "investigator",
      createdAt: now,
    });

    const sessionUser = {
      id: result.insertedId.toString(),
      email: cleanEmail,
      name: name.trim(),
      role: role || "investigator",
    };

    // Sign JWT and set session cookie
    const token = signToken(sessionUser);
    const response = NextResponse.json(
      {
        status: "ok",
        message: "Account registered successfully",
        user: sessionUser,
      },
      { status: 201 }
    );

    attachAuthCookie(response, token);
    return response;
  } catch (error: any) {
    return NextResponse.json(
      { status: "error", message: error?.message || "Internal server error during registration" },
      { status: 500 }
    );
  }
}

