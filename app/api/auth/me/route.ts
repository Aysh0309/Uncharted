import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json(
        { status: "unauthenticated", user: null },
        { status: 401 }
      );
    }

    return NextResponse.json({
      status: "ok",
      user,
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: "error", message: error?.message || "Failed to get user session" },
      { status: 500 }
    );
  }
}

