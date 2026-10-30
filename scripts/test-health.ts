import { GET } from "../app/api/health/route";

async function main() {
  console.log("Testing GET /api/health without MONGODB_URI...");
  const res = await GET();
  const data = await res.json();
  console.log("Response status:", res.status);
  console.log("Response body:", data);
}

main().catch(console.error);

