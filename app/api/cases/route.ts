import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { requireRole, getAuthorizedCaseFilter } from "@/lib/rbac";
import { CreateCaseInputSchema } from "@/lib/models";

export const dynamic = "force-dynamic";

/**
 * GET /api/cases
 * Scoped case list: Admin sees all cases; Investigator & Viewer see only cases where they are members.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json(
        { status: "unauthenticated", message: "Login required" },
        { status: 401 }
      );
    }

    const db = await getDb();
    const filter = getAuthorizedCaseFilter(session);

    const cases = await db
      .collection("cases")
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({
      status: "ok",
      cases: cases.map((c) => ({
        id: c._id.toString(),
        title: c.title,
        description: c.description || "",
        status: c.status || "active",
        memberIds: c.memberIds || [],
        summary: c.summary || "",
        createdBy: c.createdBy,
        createdAt: c.createdAt,
      })),
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: "error", message: err?.message || "Failed to load cases" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cases
 * Create new case. Only Admin and Investigator can create cases; Viewers are forbidden.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json(
        { status: "unauthenticated", message: "Login required" },
        { status: 401 }
      );
    }

    if (!requireRole(session, ["admin", "investigator"])) {
      return NextResponse.json(
        {
          status: "error",
          message: "Forbidden: Viewers cannot create new cases",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = CreateCaseInputSchema.safeParse(body);

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

    const { title, description, memberIds } = parsed.data;
    const initialMembers = Array.from(new Set([...memberIds, session.id]));

    const db = await getDb();
    const result = await db.collection("cases").insertOne({
      title,
      description,
      status: "active",
      memberIds: initialMembers,
      summary: "",
      createdBy: session.id,
      createdAt: new Date(),
    });

    return NextResponse.json(
      {
        status: "ok",
        message: "Case created successfully",
        case: {
          id: result.insertedId.toString(),
          title,
          description,
          status: "active",
          memberIds: initialMembers,
          createdBy: session.id,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { status: "error", message: err?.message || "Failed to create case" },
      { status: 500 }
    );
  }
}

