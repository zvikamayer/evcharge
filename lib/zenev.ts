/**
 * Zen Energy direct integration via Driivz/evmap platform.
 * Base: https://zen-energy.driivz.com
 *
 * - Availability: POST /stationFacade/findSitesInBounds (no auth needed)
 * - Prices:       POST /stationFacade/findSiteListDataBySiteIds (needs CSRF + session cookie)
 */
import type { Pin } from "./api";

const BASE = "https://zen-energy.driivz.com";
const BATCH = 25;

// ── Availability cache ── 60 s
let cachedPins: Pin[] | null = null;
let cacheTs = 0;
const PINS_TTL_MS = 60_000;

// ── Price cache ── 10 min
let priceCache: Map<string, number | null> | null = null;
let priceCacheTs = 0;
const PRICE_TTL_MS = 10 * 60_000;

// ── Session cache (CSRF + cookie needed for POST price calls) ── 25 min
let sessionCookie: string | null = null;
let csrfToken: string | null = null;
let sessionTs = 0;
const SESSION_TTL_MS = 25 * 60_000;

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

/** Obtain a JSESSIONID + CSRF token from the Driivz portal. */
async function ensureSession(): Promise<{ cookie: string; csrf: string } | null> {
  const now = Date.now();
  if (sessionCookie && csrfToken && now - sessionTs < SESSION_TTL_MS) {
    return { cookie: sessionCookie, csrf: csrfToken };
  }
  try {
    const res = await fetch(`${BASE}/`, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/html" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const html = await res.text();
    const csrf = html.match(/_csrf" content="([a-f0-9-]+)"/)?.[1];
    const setCookie = res.headers.get("set-cookie") ?? "";
    const jSession = setCookie.match(/JSESSIONID=([^;]+)/)?.[1];
    if (!csrf || !jSession) return null;
    sessionCookie = `JSESSIONID=${jSession}`;
    csrfToken = csrf;
    sessionTs = now;
    return { cookie: sessionCookie, csrf: csrfToken };
  } catch {
    return null;
  }
}

/** Fetch per-station kWh prices via batched findSiteListDataBySiteIds. */
async function fetchPriceMap(siteIds: string[]): Promise<Map<string, number | null>> {
  const now = Date.now();
  if (priceCache && now - priceCacheTs < PRICE_TTL_MS) return priceCache;

  const session = await ensureSession();
  if (!session) return priceCache ?? new Map();

  const batches: string[][] = [];
  for (let i = 0; i < siteIds.length; i += BATCH) batches.push(siteIds.slice(i, i + BATCH));

  const results = await Promise.allSettled(
    batches.map((batch) =>
      fetch(`${BASE}/stationFacade/findSiteListDataBySiteIds`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          "X-CSRF-TOKEN": session.csrf,
          "Cookie": session.cookie,
          "Referer": `${BASE}/`,
        },
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
    for (const site of r.value.data as {
      siteId: number;
      smstdlst?: { kp?: number }[];
    }[]) {
      const prices = (site.smstdlst ?? [])
        .map((s) => s.kp)
        .filter((p): p is number => p != null && p > 0);
      map.set(String(site.siteId), prices.length ? Math.min(...prices) : null);
    }
  }

  priceCache = map;
  priceCacheTs = now;
  return map;
}

export async function getZenEvPins(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
): Promise<Pin[]> {
  const now = Date.now();
  if (!cachedPins || now - cacheTs > PINS_TTL_MS) {
    // Driivz uses different bound param names than standard evmap
    const res = await fetch(`${BASE}/stationFacade/findSitesInBounds`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": `${BASE}/`,
      },
      body: JSON.stringify({
        upperLeftLatitude: 33.5,
        upperLeftLongitude: 34.2,
        bottomRightLatitude: 29.5,
        bottomRightLongitude: 35.9,
      }),
      cache: "no-store",
    });

    if (!res.ok) return cachedPins ?? [];
    const data = await res.json();
    if (!data.success || !Array.isArray(data.data)) return cachedPins ?? [];

    const raw = data.data as {
      siteId: number;
      dn: string;
      adr1?: string;
      adrc?: string;
      latitude: number;
      longitude: number;
      ss: string;
      ns: number;
      sal?: string;
      deleted?: boolean;
    }[];

    const allSiteIds = raw
      .filter((s) => s.sal === "PUBLIC" && !s.deleted)
      .map((s) => String(s.siteId));

    const priceMap = await fetchPriceMap(allSiteIds);

    cachedPins = raw
      .filter((s) => s.sal === "PUBLIC" && !s.deleted)
      .map((s): Pin => ({
        id: String(s.siteId),
        source: "cellocharge" as const,
        providerName: "Zen Energy",
        providerId: "zenev",
        geo: `${s.latitude},${s.longitude}`,
        av: statusToAv(s.ss ?? "UNKNOWN", s.ns ?? 1),
        inlineData: {
          name: s.dn ?? "Zen Energy",
          address: [s.adr1, s.adrc].filter(Boolean).join(", "),
          pricePerKwh: priceMap.get(String(s.siteId)) ?? null,
          total: s.ns ?? 1,
        },
      }));

    cacheTs = now;
  }

  return cachedPins.filter((p) => {
    const [lat, lng] = p.geo.split(",").map(Number);
    return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
  });
}
