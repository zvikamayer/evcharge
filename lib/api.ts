const BASE = "https://cp.evedge.co.il/api/v1/app";

export interface Pin {
  id: number | string;
  source?: "greenspot" | "cellocharge";
  providerName?: string;
  geo: string;
  av: { ava: number; unk: number; occ?: number; una?: number };
}

export interface Evse {
  id: string;
  identifier: string;
  maxPower: number;
  currentType: "ac" | "dc";
  status: string;
  isAvailable: boolean;
  tariffId: string;
  connectors: { id: string; name: string; icon: string }[];
}

export interface Tariff {
  id: string;
  currencyCode: string;
  priceForEnergy: number | null;
  priceForDuration: number | null;
  priceType: string;
  description: string;
}

export interface Location {
  id: number;
  name: string;
  address: string;
  location: string;
  zones: { evses: Evse[] }[];
}

export interface LocationDetail {
  locations: Location[];
  tariffs: Tariff[];
}

const HEADERS = {
  "User-Agent": "okhttp/4.9.3",
  "Accept": "application/json",
};

export async function getPins(
  minLat: number, maxLat: number,
  minLng: number, maxLng: number
): Promise<Pin[]> {
  const res = await fetch(
    `${BASE}/pins?minLatitude=${minLat}&maxLatitude=${maxLat}&minLongitude=${minLng}&maxLongitude=${maxLng}`,
    { headers: HEADERS, cache: "no-store" }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.pins ?? [];
}

export async function getLocation(id: number): Promise<LocationDetail> {
  const res = await fetch(`${BASE}/locations/${id}`, { headers: HEADERS, cache: "no-store" });
  return res.json();
}
