import type { Pin } from "./api";
import { getEvmapPins } from "./evmap-provider";

const BASE = "https://account.sonolevi.co.il";
const HEADERS = {
  "Content-Type": "application/json",
  "Accept": "application/json",
  "X-Requested-With": "XMLHttpRequest",
  "Referer": `${BASE}/findCharger`,
};
const BATCH = 25; // safe below the ~30-item server limit
const PRICE_TTL_MS = 10 * 60_000; // prices change rarely — 10 min cache

let priceCache: Map<string, number | null> | null = null;
let priceCacheTs = 0;

/** Fetch per-station kWh prices via batched findSiteListDataBySiteIds calls. */
async function fetchPriceMap(siteIds: string[]): Promise<Map<string, number | null>> {
  const now = Date.now();
  if (priceCache && now - priceCacheTs < PRICE_TTL_MS) return priceCache;

  // Split into batches of BATCH, run all in parallel
  const batches: string[][] = [];
  for (let i = 0; i < siteIds.length; i += BATCH) {
    batches.push(siteIds.slice(i, i + BATCH));
  }

  const results = await Promise.allSettled(
    batches.map((batch) =>
      fetch(`${BASE}/stationFacade/findSiteListDataBySiteIds`, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify({ filterBySiteIds: batch.map(Number) }),
        cache: "no-store",
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ),
  );

  const map = new Map<string, number | null>();
  for (const r of results) {
    if (r.status !== "fulfilled" || !r.value?.data) continue;
    for (const site of r.value.data as { siteId: number; smstdlst?: { kp?: number }[] }[]) {
      const kp = site.smstdlst?.[0]?.kp;
      map.set(String(site.siteId), kp && kp > 0 ? kp : null);
    }
  }

  priceCache = map;
  priceCacheTs = now;
  return map;
}

export async function getSonolEviPins(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
): Promise<Pin[]> {
  // Fetch availability pins and prices in parallel
  const pinsPromise = getEvmapPins(BASE, "sonolevi", "SonolEvi", minLat, maxLat, minLng, maxLng);

  // We need the full Israel siteId list to build the price map.
  // Reuse the same evmap cache by fetching all-Israel bounds and extracting IDs.
  // Since getEvmapPins already caches the full list, we call it with wide bounds
  // and extract the IDs from the returned filtered subset isn't enough —
  // we need ALL ids for the price map, not just the ones in the current viewport.
  // So fetch the full list separately (it shares the evmap cache).
  const allPinsPromise = getEvmapPins(BASE, "sonolevi", "SonolEvi", 29, 33, 34, 36);

  const [pins, allPins] = await Promise.all([pinsPromise, allPinsPromise]);

  const allSiteIds = allPins.map((p) => String(p.id));
  const priceMap = await fetchPriceMap(allSiteIds);

  return pins.map((pin) => ({
    ...pin,
    inlineData: pin.inlineData
      ? { ...pin.inlineData, pricePerKwh: priceMap.get(String(pin.id)) ?? null }
      : pin.inlineData,
  }));
}
