import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/**
 * POST /api/cases/[id]/assign
 * Admin-only: Assigns an investigator or viewer to a case.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionUser(req);
    if (!session || !requireRole(session, ["admin"])) {
      return NextResponse.json(
        { status: "error", message: "Forbidden: Admin access required to assign users to cases" },
        { status: 403 }
      );
    }

    const caseId = params.id;
    const body = await req.json();
    const { userId } = body;

    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { status: "error", message: "userId string is required" },
        { status: 400 }
      );
    }

    const db = await getDb();
    
    // Verify user exists
    let userQuery: any = { _id: userId };
    if (ObjectId.isValid(userId)) {
      userQuery = { _id: new ObjectId(userId) };
    }
    const targetUser = await db.collection("users").findOne(userQuery);
    if (!targetUser) {
      return NextResponse.json(
        { status: "error", message: "Target user not found" },
        { status: 404 }
      );
    }

    // Update case memberIds
    let caseQuery: any = { _id: caseId };
    if (ObjectId.isValid(caseId)) {
      caseQuery = { _id: new ObjectId(caseId) };
    }

    const updateRes = await db.collection("cases").updateOne(
      caseQuery,
      {
        $addToSet: { memberIds: userId },
      }
    );

    if (updateRes.matchedCount === 0) {
      return NextResponse.json(
        { status: "error", message: "Case not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: "ok",
      message: `User ${targetUser.name} (${targetUser.role}) assigned to case`,
      assignedUserId: userId,
      caseId,
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: "error", message: err?.message || "Failed to assign user to case" },
      { status: 500 }
    );
  }
}

