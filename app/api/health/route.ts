import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  try {
    const db = await getDb();
    const pingResult = await db.command({ ping: 1 });
    const latencyMs = Date.now() - startTime;

    return NextResponse.json({
      status: "ok",
      service: "CaseMemory API",
      database: "connected",
      ping: pingResult.ok === 1 ? "pong" : pingResult,
      latencyMs,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
    });
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    return NextResponse.json(
      {
        status: "error",
        service: "CaseMemory API",
        database: "disconnected",
        message: error?.message || "Failed to connect to MongoDB",
        latencyMs,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}

