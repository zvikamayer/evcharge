import type { Pin } from "./api";
import { getEvmapPins } from "./evmap-provider";
import { fetchAllCelloLocations } from "./cellocharge";

const BASE = "https://account.sonolevi.co.il";

// Cache for the CelloCharge price lookup table (built once per cache cycle)
let priceMapCache: Map<string, number | null> | null = null;
let priceMapTs = 0;
const PRICE_CACHE_TTL_MS = 5 * 60_000; // 5 min — prices change rarely

/**
 * Builds a coordinate-keyed price lookup from CelloCharge SonolEvi locations.
 * Key = "lat,lng" rounded to 4 decimal places (~11m precision).
 */
async function buildPriceMap(): Promise<Map<string, number | null>> {
  const now = Date.now();
  if (priceMapCache && now - priceMapTs < PRICE_CACHE_TTL_MS) return priceMapCache;

  const allLocs = await fetchAllCelloLocations();
  const priceMap = new Map<string, number | null>();

  for (const loc of allLocs) {
    if (loc.providerId !== "SonolEvi") continue;
    const key = `${loc.coordinates.lat.toFixed(4)},${loc.coordinates.lng.toFixed(4)}`;
    const price =
      loc.tariffsSummary.maxPerKwh != null && loc.tariffsSummary.maxPerKwh > 0
        ? loc.tariffsSummary.maxPerKwh
        : null;
    priceMap.set(key, price);
  }

  priceMapCache = priceMap;
  priceMapTs = now;
  return priceMap;
}

export async function getSonolEviPins(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
): Promise<Pin[]> {
  const [pins, priceMap] = await Promise.all([
    getEvmapPins(BASE, "sonolevi", "SonolEvi", minLat, maxLat, minLng, maxLng),
    buildPriceMap(),
  ]);

  // Enrich each pin with the matching CelloCharge price
  return pins.map((pin) => {
    const [lat, lng] = pin.geo.split(",").map(Number);
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const price = priceMap.get(key) ?? null;
    return {
      ...pin,
      inlineData: pin.inlineData
        ? { ...pin.inlineData, pricePerKwh: price }
        : pin.inlineData,
    };
  });
}
