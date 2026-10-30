import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser, hashPassword } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { CreateUserInputSchema } from "@/lib/models";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/users
 * Returns list of users (Admin only)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session || !requireRole(session, ["admin"])) {
      return NextResponse.json(
        { status: "error", message: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    const db = await getDb();
    const users = await db
      .collection("users")
      .find({}, { projection: { passwordHash: 0 } })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({
      status: "ok",
      users: users.map((u) => ({
        id: u._id.toString(),
        email: u.email,
        name: u.name,
        role: u.role,
        createdAt: u.createdAt,
      })),
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: "error", message: err?.message || "Failed to fetch users" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/users
 * Creates a new user with hashed password (Admin only)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session || !requireRole(session, ["admin"])) {
      return NextResponse.json(
        { status: "error", message: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = CreateUserInputSchema.safeParse(body);

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

    const { email, password, name, role } = parsed.data;
    const db = await getDb();
    const usersCol = db.collection("users");

    const existing = await usersCol.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return NextResponse.json(
        { status: "error", message: "User with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const result = await usersCol.insertOne({
      email: email.toLowerCase().trim(),
      passwordHash,
      name,
      role,
      createdAt: new Date(),
    });

    return NextResponse.json(
      {
        status: "ok",
        message: "User created successfully",
        user: {
          id: result.insertedId.toString(),
          email,
          name,
          role,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { status: "error", message: err?.message || "Failed to create user" },
      { status: 500 }
    );
  }
}

