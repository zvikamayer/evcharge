import type { Pin, LocationDetail, Evse } from "./api";

const CELLO_BASE = "https://api.prod.ev.cellocharge.com/evsfeed/api/v2/portal";
// This token is embedded in the public cellocharge.com JavaScript bundle
const CELLO_TOKEN = "150048bf-7667-424e-8923-b1ca8dd0e0fd";
const CELLO_HEADERS = { Accept: "application/json", Authorization: `Bearer ${CELLO_TOKEN}` };

// Providers with direct integrations — exclude from CelloCharge list to avoid duplication
const DIRECT_PROVIDER_IDS = new Set(["EvEdge", "Greenspot", "AfconEv"]);

export interface CelloLocation {
  id: string;
  providerId: string;
  name: string;
  city: string;
  address: string;
  coordinates: { lat: number; lng: number };
  tariffsSummary: { hasTariffs: boolean; maxPerKwh: number | null };
  connectorsSummary: { total: number; available: number; occupied?: number };
}

export interface CelloProvider {
  id: string;
  name: string;
  imageUrl: string;
}

// Server-side caches
let cachedLocations: CelloLocation[] | null = null;
let cacheTs = 0;
let cachedProviders: CelloProvider[] | null = null;
// Maps every raw provider ID → canonical (deduplicated) provider ID
let providerIdMap: Map<string, string> = new Map();
const CACHE_TTL_MS = 60_000;

export async function fetchAllCelloLocations(): Promise<CelloLocation[]> {
  const now = Date.now();
  if (cachedLocations && now - cacheTs < CACHE_TTL_MS) return cachedLocations;

  const res = await fetch(`${CELLO_BASE}/locations`, {
    headers: CELLO_HEADERS,
    cache: "no-store",
  });
  if (!res.ok) return cachedLocations ?? [];
  cachedLocations = await res.json();
  cacheTs = now;
  return cachedLocations!;
}

export async function fetchCelloProviders(): Promise<CelloProvider[]> {
  if (cachedProviders) return cachedProviders;

  const res = await fetch(`${CELLO_BASE}/providers`, {
    headers: CELLO_HEADERS,
    cache: "no-store",
  });
  if (!res.ok) return [];

  const raw: { id: string; name: string; imageUrl: string }[] = await res.json();

  // Deduplicate by name, exclude providers with direct integrations.
  // Also build providerIdMap so every raw ID maps to a canonical ID.
  const seenName = new Map<string, string>(); // normalised name → canonical ID
  providerIdMap = new Map();
  cachedProviders = [];

  for (const p of raw) {
    if (DIRECT_PROVIDER_IDS.has(p.id)) continue;
    const key = p.name.trim().toLowerCase();
    if (seenName.has(key)) {
      // Duplicate — map this ID to the canonical ID chosen first
      providerIdMap.set(p.id, seenName.get(key)!);
    } else {
      // First occurrence — this becomes the canonical ID
      seenName.set(key, p.id);
      providerIdMap.set(p.id, p.id);
      cachedProviders.push({ id: p.id, name: p.name.trim(), imageUrl: p.imageUrl });
    }
  }

  return cachedProviders;
}

export async function getCelloPins(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
  providerId?: string,
): Promise<Pin[]> {
  const [all, providers] = await Promise.all([fetchAllCelloLocations(), fetchCelloProviders()]);
  const nameMap = Object.fromEntries(providers.map((p) => [p.id, p.name]));

  return all
    .filter((loc) => {
      const canonicalId = providerIdMap.get(loc.providerId) ?? loc.providerId;
      return (
        loc.coordinates.lat >= minLat &&
        loc.coordinates.lat <= maxLat &&
        loc.coordinates.lng >= minLng &&
        loc.coordinates.lng <= maxLng &&
        (providerId == null || canonicalId === providerId)
      );
    })
    .map((loc) => {
      const canonicalId = providerIdMap.get(loc.providerId) ?? loc.providerId;
      return {
      id: loc.id,
      source: "cellocharge" as const,
      providerName: nameMap[canonicalId] ?? loc.providerId,
      providerId: canonicalId,
      geo: `${loc.coordinates.lat},${loc.coordinates.lng}`,
      av: {
        ava: loc.connectorsSummary.available,
        occ: loc.connectorsSummary.occupied ?? 0,
        unk: Math.max(
          0,
          loc.connectorsSummary.total -
            loc.connectorsSummary.available -
            (loc.connectorsSummary.occupied ?? 0),
        ),
      },
      // Embed rich data so MapView can build table rows without a detail API call
      inlineData: {
        name: loc.name,
        address: `${loc.address}${loc.city ? ", " + loc.city : ""}`,
        pricePerKwh: (loc.tariffsSummary.maxPerKwh ?? 0) > 0
          ? loc.tariffsSummary.maxPerKwh
          : null,
        total: loc.connectorsSummary.total || 1,
      },
    };
    });
}

export async function getCelloStationAsDetail(id: string): Promise<LocationDetail> {
  const all = await fetchAllCelloLocations();
  const loc = all.find((l) => l.id === id);
  if (!loc) return { locations: [], tariffs: [] };
  return celloLocationAsDetail(loc);
}

function celloLocationAsDetail(loc: CelloLocation): LocationDetail {
  const tariffId = `cello-${loc.id}`;
  const total = loc.connectorsSummary.total || 1;
  const available = loc.connectorsSummary.available;

  const evses: Evse[] = Array.from({ length: total }, (_, i) => ({
    id: `${tariffId}-${i}`,
    identifier: String(i + 1),
    maxPower: 22000,
    currentType: "ac" as const,
    status: i < available ? "available" : "unavailable",
    isAvailable: i < available,
    tariffId,
    connectors: [],
  }));

  return {
    locations: [
      {
        id: 0,
        name: loc.name,
        address: loc.address,
        location: `${loc.coordinates.lat},${loc.coordinates.lng}`,
        zones: [{ evses }],
      },
    ],
    tariffs: [
      {
        id: tariffId,
        currencyCode: "ILS",
        priceForEnergy: loc.tariffsSummary.maxPerKwh,
        priceForDuration: null,
        priceType: "ENERGY",
        description: loc.providerId,
      },
    ],
  };
}
