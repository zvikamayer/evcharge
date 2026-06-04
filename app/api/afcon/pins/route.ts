import { NextRequest, NextResponse } from "next/server";
import { getAfconPins } from "@/lib/afcon";

export async function GET(req: NextRequest) {
  const s = req.nextUrl.searchParams;
  const pins = await getAfconPins(
    Number(s.get("minLat") ?? 29),
    Number(s.get("maxLat") ?? 33),
    Number(s.get("minLng") ?? 34),
    Number(s.get("maxLng") ?? 36),
  );
  return NextResponse.json(pins);
}
