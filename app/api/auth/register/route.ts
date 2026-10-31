import { NextRequest } from "next/server";
import { POST as handleSignup } from "../signup/route";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return handleSignup(req);
}
