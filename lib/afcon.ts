import type { Pin } from "./api";

const BASE = "https://account.afconev.co.il";
const HEADERS = {
  "Content-Type": "application/json",
  "Accept": "application/json",
  "X-Requested-With": "XMLHttpRequest",
  "Referer": "https://account.afconev.co.il/findCharger",
};

// Site status → available count mapping
function statusToAv(ss: string, ns: number): Pin["av"] {
  switch (ss) {
    case "AVAILABLE":
    case "FINISHING":
      return { ava: ns, occ: 0, unk: 0 };
    case "OCCUPIED":
    case "CHARGING":
    case "PREPARING":
      return { ava: 0, occ: ns, unk: 0 };
    default:
      // UNKNOWN, FAULTED, PAUSED
      return { ava: 0, occ: 0, unk: ns };
  }
}

let cache: { pins: Pin[]; ts: number } | null = null;
const CACHE_TTL_MS = 60_000;

export async function getAfconPins(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
): Promise<Pin[]> {
  const now = Date.now();

  // Fetch all-Israel if cache is stale, then filter by bounds
  if (!cache || now - cache.ts > CACHE_TTL_MS) {
    const body = JSON.stringify({
      filterByBounds: {
        northEastLat: 33.5,
        northEastLng: 35.9,
        southWestLat: 29.5,
        southWestLng: 34.2,
      },
    });

    const res = await fetch(`${BASE}/stationFacade/findSitesInBounds`, {
      method: "POST",
      headers: HEADERS,
      body,
      cache: "no-store",
    });

    if (!res.ok) return cache?.pins ?? [];

    const data = await res.json();
    if (!data.success || !Array.isArray(data.data)) return cache?.pins ?? [];

    const pins: Pin[] = data.data
      .filter((s: any) => s.sal === "PUBLIC" && !s.deleted)
      .map((s: any): Pin => ({
        id: String(s.siteId),
        source: "cellocharge" as const, // reuse cellocharge source so MapView handles popups
        providerName: "ON-EV",
        providerId: "afcon",
        geo: `${s.latitude},${s.longitude}`,
        av: statusToAv(s.ss ?? "UNKNOWN", s.ns ?? 1),
        inlineData: {
          name: s.dn ?? "ON-EV",
          address: s.dn ?? "",
          pricePerKwh: null,
          total: s.ns ?? 1,
        },
      }));

    cache = { pins, ts: now };
  }

  return cache.pins.filter((p) => {
    const [lat, lng] = p.geo.split(",").map(Number);
    return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
  });
}
