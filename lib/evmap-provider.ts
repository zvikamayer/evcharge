/**
 * Generic integration for EV charging providers using the ChargePoint/evmap platform.
 * Used by: ON-EV (Afcon), SonolEvi, and potentially others.
 */
import type { Pin } from "./api";

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
      return { ava: 0, occ: 0, unk: ns };
  }
}

interface EvmapCache {
  pins: Pin[];
  ts: number;
}

const caches: Record<string, EvmapCache> = {};
const CACHE_TTL_MS = 60_000;

export async function getEvmapPins(
  baseUrl: string,
  providerId: string,
  providerName: string,
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
): Promise<Pin[]> {
  const now = Date.now();
  const cached = caches[providerId];

  if (!cached || now - cached.ts > CACHE_TTL_MS) {
    const body = JSON.stringify({
      filterByBounds: {
        northEastLat: 33.5,
        northEastLng: 35.9,
        southWestLat: 29.5,
        southWestLng: 34.2,
      },
    });

    const res = await fetch(`${baseUrl}/stationFacade/findSitesInBounds`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": `${baseUrl}/findCharger`,
      },
      body,
      cache: "no-store",
    });

    if (!res.ok) return cached?.pins ?? [];

    const data = await res.json();
    if (!data.success || !Array.isArray(data.data)) return cached?.pins ?? [];

    const pins: Pin[] = data.data
      .filter((s: any) => s.sal === "PUBLIC" && !s.deleted)
      .map((s: any): Pin => ({
        id: String(s.siteId),
        source: "cellocharge" as const,
        providerName,
        providerId,
        geo: `${s.latitude},${s.longitude}`,
        av: statusToAv(s.ss ?? "UNKNOWN", s.ns ?? 1),
        inlineData: {
          name: s.dn ?? providerName,
          address: s.dn ?? "",
          pricePerKwh: null,
          total: s.ns ?? 1,
        },
      }));

    caches[providerId] = { pins, ts: now };
  }

  return caches[providerId].pins.filter((p) => {
    const [lat, lng] = p.geo.split(",").map(Number);
    return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
  });
}
