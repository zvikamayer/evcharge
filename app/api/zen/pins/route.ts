// ============================================================================
// ZEN Energy pins route — REVERTED to inert handler
// ============================================================================
// Returns an empty array of pins. The ZEN integration is currently disabled.
// See lib/zen.ts for the full rollback context and instructions on how to
// re-enable the integration when a verified API endpoint becomes available.
// ============================================================================

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json([]);
}
