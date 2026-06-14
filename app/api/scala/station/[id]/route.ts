import { NextRequest, NextResponse } from "next/server";

const BASE = "https://cp.scala-ev.com/api/v2";

/** Proxy the AMPECO location detail endpoint.
 *  The response format is already compatible with LocationDetail (locations + tariffs). */
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const res = await fetch(`${BASE}/app/locations/${params.id}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    return NextResponse.json({ locations: [], tariffs: [] }, { status: res.status });
  }
  const data = await res.json();
  return NextResponse.json(data);
}
