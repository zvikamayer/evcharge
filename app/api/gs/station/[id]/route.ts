import { NextRequest, NextResponse } from "next/server";
import { getGsStationAsDetail } from "@/lib/greenspot";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const data = await getGsStationAsDetail(Number(params.id));
  return NextResponse.json(data);
}
