import { NextRequest, NextResponse } from "next/server";
import { getLocation } from "@/lib/api";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const data = await getLocation(Number(params.id));
  return NextResponse.json(data);
}
