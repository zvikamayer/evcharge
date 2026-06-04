import type { Pin } from "./api";

const AMPECO_BASE = "https://cp.scala-ev.com/api/v2";

// Server-side cache — full Israel fetch, filtered by bounds on the way out
let cachedPins: Pin[] | null = null;
let cacheTs = 0;
const CACHE_TTL_MS = 60_000;

export async function getScalaPins(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
): Promise<Pin[]> {
  const now = Date.now();
  if (!cachedPins || now - cacheTs > CACHE_TTL_MS) {
    const res = await fetch(`${AMPECO_BASE}/app/pins`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return cachedPins ?? [];
    const data: { pins: { id: number; geo: string; av: { ava: number; unk: number; una: number } }[] } =
      await res.json();
    cachedPins = (data.pins ?? []).map((p) => ({
      id: p.id,
      source: "cellocharge" as const, // treated like a "direct" provider — not really cellocharge but reuses the detail flow
      providerName: "Scala Energy",
      providerId: "scala",
      geo: p.geo,
      av: { ava: p.av.ava, unk: p.av.unk, occ: p.av.una },
    }));
    cacheTs = now;
  }

  return cachedPins.filter((p) => {
    const [lat, lng] = p.geo.split(",").map(Number);
    return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
  });
}
