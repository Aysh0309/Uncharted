import { NextResponse } from "next/server";
import { removeAuthCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({
    status: "ok",
    message: "Logged out successfully",
  });

  removeAuthCookie(response);
  return response;
}

