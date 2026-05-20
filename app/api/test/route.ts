import { NextResponse } from "next/server";

export async function GET() {
  const results: Record<string, unknown> = {};

  try {
    const r = await fetch(
      "https://cp.evedge.co.il/api/v1/app/pins?minLatitude=31&maxLatitude=32&minLongitude=34&maxLongitude=35",
      { cache: "no-store", headers: { "User-Agent": "okhttp/4.9.3", "Accept": "application/json" } }
    );
    const text = await r.text();
    results.evedge = { status: r.status, body: text.slice(0, 300) };
  } catch (e: unknown) {
    results.evedge = { error: String(e) };
  }

  try {
    const r = await fetch("https://mobile.greenspot.co.il", { cache: "no-store" });
    results.greenspot = { status: r.status, ok: r.ok };
  } catch (e: unknown) {
    results.greenspot = { error: String(e) };
  }

  return NextResponse.json(results);
}
