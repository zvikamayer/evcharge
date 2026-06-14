import type { Pin } from "./api";

const BASE = "https://cp.scala-ev.com/api/v2";

// ── Availability cache (pins endpoint) ── 60 s
let cachedPins: Pin[] | null = null;
let cacheTs = 0;
const PINS_TTL_MS = 60_000;

// ── Location metadata cache (names, addresses, prices) ── 30 min
// Each location is fetched individually; results are merged with fresh pin data.
interface LocationMeta {
  name: string;
  address: string;
  pricePerKwh: number | null;
  total: number;
  chargeType: "ac" | "dc" | "mixed" | undefined;
}
let locationMeta: Map<number, LocationMeta> | null = null;
let locationMetaTs = 0;
const META_TTL_MS = 30 * 60_000;

async function fetchOneMeta(id: number): Promise<LocationMeta | null> {
  try {
    const res = await fetch(`${BASE}/app/locations/${id}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data: {
      locations: {
        name: string;
        address: string;
        zones: { evses: { currentType: string; tariffId: string }[] }[];
      }[];
      tariffs: { id: string; priceForEnergy: number | null }[];
    } = await res.json();
    const loc = data.locations[0];
    if (!loc) return null;
    const tariffMap = new Map(data.tariffs.map((t) => [t.id, t.priceForEnergy]));
    const evses = loc.zones.flatMap((z) => z.evses);
    const types = new Set(evses.map((e) => e.currentType).filter(Boolean));
    const chargeType: "ac" | "dc" | "mixed" | undefined =
      types.has("dc") && types.has("ac")
        ? "mixed"
        : types.has("dc")
        ? "dc"
        : types.has("ac")
        ? "ac"
        : undefined;
    const prices = evses
      .map((e) => tariffMap.get(e.tariffId))
      .filter((p): p is number => p != null && p > 0);
    const pricePerKwh = prices.length ? Math.min(...prices) : null;
    return { name: loc.name, address: loc.address, pricePerKwh, total: evses.length, chargeType };
  } catch {
    return null;
  }
}

/** Ensure location metadata is populated; refetch every 30 minutes. */
async function ensureLocationMeta(ids: number[]): Promise<Map<number, LocationMeta>> {
  const now = Date.now();
  if (locationMeta && now - locationMetaTs < META_TTL_MS) return locationMeta;

  // Fetch all locations in parallel — 236 concurrent requests, ~200-400 ms total
  const results = await Promise.allSettled(ids.map(fetchOneMeta));
  const map = new Map<number, LocationMeta>();
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled" && r.value) map.set(ids[i], r.value);
  }
  locationMeta = map;
  locationMetaTs = now;
  return map;
}

export async function getScalaPins(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
): Promise<Pin[]> {
  const now = Date.now();
  if (!cachedPins || now - cacheTs > PINS_TTL_MS) {
    const res = await fetch(`${BASE}/app/pins`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return cachedPins ?? [];
    const data: {
      pins: { id: number; geo: string; av: { ava: number; unk: number; una: number } }[];
    } = await res.json();
    const rawPins = data.pins ?? [];

    // Merge availability with location metadata (names, addresses, prices)
    const meta = await ensureLocationMeta(rawPins.map((p) => p.id));

    cachedPins = rawPins.map((p) => {
      const m = meta.get(p.id);
      return {
        id: p.id,
        source: "cellocharge" as const,
        providerName: "Scala Energy",
        providerId: "scala",
        geo: p.geo,
        av: { ava: p.av.ava, unk: p.av.unk, occ: p.av.una },
        ...(m && {
          inlineData: {
            name: m.name,
            address: m.address,
            pricePerKwh: m.pricePerKwh,
            total: m.total,
            chargeType: m.chargeType,
          },
        }),
      };
    });
    cacheTs = now;
  }

  return cachedPins.filter((p) => {
    const [lat, lng] = p.geo.split(",").map(Number);
    return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
  });
}
