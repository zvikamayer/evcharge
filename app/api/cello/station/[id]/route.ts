import { NextRequest, NextResponse } from "next/server";
import { getCelloStationAsDetail } from "@/lib/cellocharge";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const data = await getCelloStationAsDetail(params.id);
  return NextResponse.json(data);
}
