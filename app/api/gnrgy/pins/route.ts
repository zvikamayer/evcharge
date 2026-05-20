// ============================================================================
// Gnrgy pins route — placeholder
// ============================================================================
// Returns an empty pin list. The Gnrgy integration is intentionally
// disabled — see lib/gnrgy.ts for the rollout plan and re-enable steps.
// ============================================================================

import { NextResponse } from "next/server";
import { getGnrgyPins } from "@/lib/gnrgy";

export async function GET() {
  const pins = await getGnrgyPins();
  return NextResponse.json(pins);
}
