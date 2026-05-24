import { NextResponse } from "next/server";
import { fetchCelloProviders } from "@/lib/cellocharge";

export async function GET() {
  const providers = await fetchCelloProviders();
  return NextResponse.json(providers);
}
