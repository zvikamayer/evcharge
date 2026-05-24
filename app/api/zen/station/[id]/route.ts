// ============================================================================
// ZEN Energy station route — REVERTED to inert handler
// ============================================================================
// Returns an empty LocationDetail. The ZEN integration is currently disabled.
// See lib/zen.ts for full rollback context and re-enable instructions.
// ============================================================================

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ locations: [], tariffs: [] });
}
