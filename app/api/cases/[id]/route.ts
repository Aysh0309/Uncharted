import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessCase } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/**
 * GET /api/cases/[id]
 * Retrieves single case details, enforcing RBAC access.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json(
        { status: "unauthenticated", message: "Login required" },
        { status: 401 }
      );
    }

    const caseId = params.id;
    let query: any = { _id: caseId };
    if (ObjectId.isValid(caseId)) {
      query = { _id: new ObjectId(caseId) };
    }

    const db = await getDb();
    const caseDoc = await db.collection("cases").findOne(query);

    if (!caseDoc) {
      return NextResponse.json(
        { status: "error", message: "Case not found" },
        { status: 404 }
      );
    }

    if (!canAccessCase(session, caseDoc as any)) {
      return NextResponse.json(
        { status: "error", message: "Forbidden: You are not assigned to this case" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      status: "ok",
      case: {
        id: caseDoc._id.toString(),
        title: caseDoc.title,
        description: caseDoc.description || "",
        status: caseDoc.status || "active",
        memberIds: caseDoc.memberIds || [],
        summary: caseDoc.summary || "",
        createdBy: caseDoc.createdBy,
        createdAt: caseDoc.createdAt,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: "error", message: err?.message || "Failed to load case" },
      { status: 500 }
    );
  }
}

