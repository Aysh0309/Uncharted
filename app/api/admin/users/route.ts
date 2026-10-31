import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { getSessionUser, hashPassword } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { CreateUserInputSchema } from "@/lib/models";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/users
 * Returns list of users with assigned cases (Admin only)
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
    
    // Fetch all users without password hashes
    const users = await db
      .collection("users")
      .find({}, { projection: { passwordHash: 0 } })
      .sort({ createdAt: -1 })
      .toArray();

    // Fetch cases to associate assigned cases to each user
    const cases = await db
      .collection("cases")
      .find({}, { projection: { _id: 1, title: 1, status: 1, memberIds: 1 } })
      .toArray();

    const enrichedUsers = users.map((u) => {
      const uId = u._id.toString();
      const assigned = cases.filter(
        (c) => Array.isArray(c.memberIds) && c.memberIds.includes(uId)
      );

      return {
        id: uId,
        email: u.email,
        name: u.name,
        role: u.role,
        createdAt: u.createdAt,
        assignedCases: assigned.map((c) => ({
          id: c._id.toString(),
          title: c.title,
          status: c.status || "active",
        })),
        assignedCount: assigned.length,
      };
    });

    return NextResponse.json({
      status: "ok",
      users: enrichedUsers,
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
    const cleanEmail = email.toLowerCase().trim();
    const db = await getDb();
    const usersCol = db.collection("users");

    const existing = await usersCol.findOne({ email: cleanEmail });
    if (existing) {
      return NextResponse.json(
        { status: "error", message: "User with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const result = await usersCol.insertOne({
      email: cleanEmail,
      passwordHash,
      name: name.trim(),
      role,
      createdAt: new Date(),
    });

    return NextResponse.json(
      {
        status: "ok",
        message: "User created successfully",
        user: {
          id: result.insertedId.toString(),
          email: cleanEmail,
          name: name.trim(),
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

/**
 * PATCH /api/admin/users
 * Updates a user's role (Admin only)
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session || !requireRole(session, ["admin"])) {
      return NextResponse.json(
        { status: "error", message: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { userId, role } = body;

    if (!userId) {
      return NextResponse.json(
        { status: "error", message: "User ID is required" },
        { status: 400 }
      );
    }

    if (role && !["admin", "investigator", "viewer"].includes(role)) {
      return NextResponse.json(
        { status: "error", message: "Invalid role specified" },
        { status: 400 }
      );
    }

    const db = await getDb();
    let query: any = { _id: userId };
    if (ObjectId.isValid(userId)) {
      query = { _id: new ObjectId(userId) };
    }

    const updateDoc: any = {};
    if (role) updateDoc.role = role;

    const updateRes = await db.collection("users").updateOne(query, { $set: updateDoc });

    if (updateRes.matchedCount === 0) {
      return NextResponse.json(
        { status: "error", message: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: "ok",
      message: "User updated successfully",
      userId,
      role,
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: "error", message: err?.message || "Failed to update user" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users
 * Deletes a user (Admin only)
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session || !requireRole(session, ["admin"])) {
      return NextResponse.json(
        { status: "error", message: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("id");

    if (!targetUserId) {
      return NextResponse.json(
        { status: "error", message: "User ID parameter is required" },
        { status: 400 }
      );
    }

    if (targetUserId === session.id) {
      return NextResponse.json(
        { status: "error", message: "You cannot delete your own administrator account" },
        { status: 400 }
      );
    }

    const db = await getDb();
    let query: any = { _id: targetUserId };
    if (ObjectId.isValid(targetUserId)) {
      query = { _id: new ObjectId(targetUserId) };
    }

    const deleteRes = await db.collection("users").deleteOne(query);
    if (deleteRes.deletedCount === 0) {
      return NextResponse.json(
        { status: "error", message: "User not found" },
        { status: 404 }
      );
    }

    // Also remove the user from any cases' memberIds
    await db.collection("cases").updateMany(
      { memberIds: targetUserId },
      { $pull: { memberIds: targetUserId } as any }
    );

    return NextResponse.json({
      status: "ok",
      message: "User successfully removed",
      userId: targetUserId,
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: "error", message: err?.message || "Failed to delete user" },
      { status: 500 }
    );
  }
}
