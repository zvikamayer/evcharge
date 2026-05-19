import { LocationDetail } from "./api";

const BASE = "https://mobile.greenspot.co.il";

let session: { cookie: string; csrf: string; ts: number } | null = null;

async function getSession(force = false) {
  const now = Date.now();
  if (!force && session && now - session.ts < 20 * 60 * 1000) return session;

  const res = await fetch(BASE, { cache: "no-store" });
  const html = await res.text();
  const csrfMatch = html.match(/name="_csrf"\s+content="([^"]+)"/);
  const csrf = csrfMatch?.[1] ?? "";
  const setCookie = res.headers.get("set-cookie") ?? "";
  const jsMatch = setCookie.match(/JSESSIONID=([^;]+)/);
  session = { cookie: `JSESSIONID=${jsMatch?.[1] ?? ""}`, csrf, ts: now };
  return session;
}

async function post<T>(path: string, body: unknown, retry = true): Promise<T> {
  const { cookie, csrf } = await getSession();
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      Cookie: cookie,
      "X-CSRF-TOKEN": csrf,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await res.json();
  if (!data.success && retry) {
    await getSession(true);
    return post(path, body, false);
  }
  return data.data;
}

async function get<T>(path: string, retry = true): Promise<T> {
  const { cookie, csrf } = await getSession();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Accept": "application/json",
      Cookie: cookie,
      "X-CSRF-TOKEN": csrf,
    },
    cache: "no-store",
  });
  const data = await res.json();
  if (!data.success && retry) {
    await getSession(true);
    return get(path, false);
  }
  return data.data;
}

export interface GsPin {
  id: number;
  source: "greenspot";
  geo: string;
  av: { ava: number; occ: number; unk: number };
}

interface RawStation {
  id: number;
  latitude: number;
  longitude: number;
  stationStatusId: string;
  stationSockets: { socketStatusId?: string }[];
}

export async function getGsPins(
  minLat: number, maxLat: number, minLng: number, maxLng: number
): Promise<GsPin[]> {
  const stations: RawStation[] = await post("/stationFacade/findStationsInBounds", {
    northEastLat: maxLat,
    northEastLng: maxLng,
    southWestLat: minLat,
    southWestLng: minLng,
  });

  return (stations ?? [])
    .filter((s) => s.latitude >= minLat && s.latitude <= maxLat && s.longitude >= minLng && s.longitude <= maxLng)
    .map((s) => {
      const sockets = s.stationSockets ?? [];
      const socketsWithStatus = sockets.filter((sk) => sk.socketStatusId);
      const n = Math.max(1, sockets.length);
      let av: GsPin["av"];
      if (socketsWithStatus.length > 0) {
        const ava = socketsWithStatus.filter((sk) => sk.socketStatusId === "AVAILABLE").length;
        const occ = socketsWithStatus.filter((sk) => sk.socketStatusId === "OCCUPIED").length;
        av = { ava, occ, unk: sockets.length - ava - occ };
      } else {
        // Fall back to station-level status
        av = {
          ava: s.stationStatusId === "AVAILABLE" ? n : 0,
          occ: s.stationStatusId === "OCCUPIED" ? n : 0,
          unk: s.stationStatusId !== "AVAILABLE" && s.stationStatusId !== "OCCUPIED" ? n : 0,
        };
      }
      return { id: s.id, source: "greenspot" as const, geo: `${s.latitude},${s.longitude}`, av };
    });
}

interface RawSocketPrice {
  kwhPrice: number;
  transactionFee: number;
}

interface RawSocket {
  id: number;
  socketStatusId: string;
  maximumPower: number;
  stationModelSocketVoltageType: string;
  socketPrices: RawSocketPrice[];
}

interface RawDetail {
  id: number;
  caption: string;
  siteDisplayName?: string;
  addressAddress1?: string;
  addressCity?: string;
  latitude: number;
  longitude: number;
  stationSockets: RawSocket[];
}

// Maps GreenSpot station to the same LocationDetail shape StationCard already uses
export async function getGsStationAsDetail(id: number): Promise<LocationDetail> {
  const s: RawDetail = await get(`/stationFacade/findStationById?stationId=${id}`);

  const tariffs = s.stationSockets.map((sk) => ({
    id: `gs-${sk.id}`,
    currencyCode: "ILS",
    priceForEnergy: sk.socketPrices?.[0]?.kwhPrice ?? null,
    priceForDuration: null,
    priceType: "ENERGY",
    description: "",
  }));

  const evses = s.stationSockets.map((sk) => ({
    id: `gs-${sk.id}`,
    identifier: sk.id.toString(),
    maxPower: (sk.maximumPower ?? 0) * 1000,
    currentType: (sk.stationModelSocketVoltageType ?? "AC").toLowerCase() as "ac" | "dc",
    status: sk.socketStatusId === "AVAILABLE" ? "available" : sk.socketStatusId === "OCCUPIED" ? "charging" : "unavailable",
    isAvailable: sk.socketStatusId === "AVAILABLE",
    tariffId: `gs-${sk.id}`,
    connectors: [],
  }));

  const name = s.siteDisplayName || s.caption || `תחנה ${id}`;
  const address = [s.addressAddress1, s.addressCity].filter(Boolean).join(", ");

  return {
    locations: [{
      id: s.id,
      name,
      address,
      location: `${s.latitude},${s.longitude}`,
      zones: [{ evses }],
    }],
    tariffs,
  };
}
