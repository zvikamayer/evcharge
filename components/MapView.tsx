"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { Pin, LocationDetail } from "@/lib/api";
import { haversineKm, boundingBox } from "@/lib/geo";
import StationCard from "./StationCard";
import CheapTable, { StationRow } from "./CheapTable";

function pinColor(av: Pin["av"]) {
  if (av.ava > 0) return "#22c55e";
  if (av.unk > 0) return "#f59e0b";
  return "#ef4444";
}

const EV_BASE = "https://cp.evedge.co.il/api/v1/app";

const cache: Record<string, LocationDetail> = {};
async function fetchLocation(id: number | string, source?: "greenspot" | "cellocharge"): Promise<LocationDetail> {
  const key = source === "greenspot" ? `gs-${id}` : source === "cellocharge" ? `cello-${id}` : `ev-${id}`;
  if (cache[key]) return cache[key];
  const url = source === "greenspot"
    ? `/api/gs/station/${id}`
    : source === "cellocharge"
    ? `/api/cello/station/${id}`
    : `${EV_BASE}/locations/${id}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  cache[key] = await res.json();
  return cache[key];
}

interface Props {
  filter: string;
  provider: string;
  center: { lat: number; lng: number } | null;
  radiusKm: number;
}

export default function MapView({ filter, provider, center, radiusKm }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapReady = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const L = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const circle = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerMap = useRef<Record<string, { marker: any; pin: Pin }>>({});

  const [selected, setSelected] = useState<LocationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [tableRows, setTableRows] = useState<StationRow[]>([]);

  const filterRef = useRef(filter);
  useEffect(() => { filterRef.current = filter; }, [filter]);

  const providerRef = useRef(provider);
  useEffect(() => { providerRef.current = provider; }, [provider]);

  // Called once map is ready and whenever center/radius/filter change
  const refresh = useCallback(async (
    c: { lat: number; lng: number },
    r: number,
  ) => {
    if (!mapReady.current || !L.current || !map.current) return;

    // Pan map
    map.current.panTo([c.lat, c.lng]);

    // Draw circle
    if (circle.current) circle.current.remove();
    circle.current = L.current.circle([c.lat, c.lng], {
      radius: r * 1000,
      color: "#2563eb",
      fillColor: "#3b82f6",
      fillOpacity: 0.08,
      weight: 2,
    }).addTo(map.current);

    // Fetch pins from all providers in parallel
    const bb = boundingBox(c.lat, c.lng, r);
    const qs = `minLat=${bb.minLat}&maxLat=${bb.maxLat}&minLng=${bb.minLng}&maxLng=${bb.maxLng}`;
    const wantEv = providerRef.current !== "greenspot" && providerRef.current !== "cellocharge";
    const wantGs = providerRef.current !== "evedge" && providerRef.current !== "cellocharge";
    const wantCello = providerRef.current !== "evedge" && providerRef.current !== "greenspot";
    const [evRes, gsRes, celloRes] = await Promise.all([
      wantEv ? fetch(`${EV_BASE}/pins?minLatitude=${bb.minLat}&maxLatitude=${bb.maxLat}&minLongitude=${bb.minLng}&maxLongitude=${bb.maxLng}`) : Promise.resolve(null),
      wantGs ? fetch(`/api/gs/pins?${qs}`) : Promise.resolve(null),
      wantCello ? fetch(`/api/cello/pins?${qs}`) : Promise.resolve(null),
    ]);
    const evPins: Pin[] = evRes ? (await evRes.json().then((d: { pins?: Pin[] }) => d.pins ?? []).catch(() => [])) : [];
    const gsPins: Pin[] = gsRes ? await gsRes.json().catch(() => []) : [];
    const celloPins: Pin[] = celloRes ? await celloRes.json().catch(() => []) : [];
    const pins: Pin[] = [...evPins, ...gsPins, ...celloPins];

    const inRadius = pins.filter((p) => {
      const [lat, lng] = p.geo.split(",").map(Number);
      return haversineKm(c.lat, c.lng, lat, lng) <= r;
    });

    const visible = inRadius.filter((p) =>
      filterRef.current === "available" ? p.av.ava > 0 : true
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async function openPopupForMarker(marker: any, pin: Pin) {
      const detail = await fetchLocation(pin.id, pin.source);
      const loc = detail.locations[0];
      const tariffMap = Object.fromEntries(detail.tariffs.map((t) => [t.id, t]));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const evses = loc.zones.flatMap((z: any) => z.evses);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const available = evses.filter((e: any) => e.isAvailable).length;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prices = evses.map((e: any) => tariffMap[e.tariffId]?.priceForEnergy).filter((p: any): p is number => p != null);
      const minPrice = prices.length ? Math.min(...prices) : null;
      const badge = pin.source === "greenspot"
        ? `<span style="font-size:10px;background:#16a34a;color:#fff;padding:1px 5px;border-radius:8px;margin-left:4px">GreenSpot</span>`
        : pin.source === "cellocharge"
        ? `<span style="font-size:10px;background:#7c3aed;color:#fff;padding:1px 5px;border-radius:8px;margin-left:4px">CelloCharge</span>`
        : `<span style="font-size:10px;background:#2563eb;color:#fff;padding:1px 5px;border-radius:8px;margin-left:4px">EV-Edge</span>`;
      const [plat, plng] = loc.location.split(",").map(Number);
      const gUrl = `https://www.google.com/maps/dir/?api=1&destination=${plat},${plng}`;
      const wUrl = `https://waze.com/ul?ll=${plat},${plng}&navigate=yes`;
      marker.bindPopup(`
        <div style="font-family:sans-serif;direction:rtl;min-width:160px">
          <div style="font-weight:700;font-size:14px">${badge}${loc.name}</div>
          <div style="font-size:12px;color:#666;margin-bottom:6px">${loc.address}</div>
          <div style="font-size:13px;margin-bottom:6px">${available}/${evses.length} פנויים</div>
          ${minPrice != null ? `<div style="font-size:16px;font-weight:700;color:#1d4ed8;margin-bottom:8px">₪${minPrice.toFixed(2)} / kWh</div>` : ""}
          <div style="display:flex;gap:6px">
            <a href="${gUrl}" target="_blank" style="flex:1;text-align:center;padding:5px 4px;background:#eff6ff;color:#1d4ed8;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none">🗺 Google Maps</a>
            <a href="${wUrl}" target="_blank" style="flex:1;text-align:center;padding:5px 4px;background:#f0f9ff;color:#0369a1;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none">🔵 Waze</a>
          </div>
        </div>
      `, { closeButton: true, offset: [0, -8] }).openPopup();
    }

    // Clear old markers
    Object.values(markerMap.current).forEach(({ marker }) => marker.remove());
    markerMap.current = {};

    // Add new markers
    visible.forEach((pin) => {
      const [lat, lng] = pin.geo.split(",").map(Number);
      const color = pinColor(pin.av);
      const icon = L.current.divIcon({
        className: "",
        html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);cursor:pointer"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      const marker = L.current.marker([lat, lng], { icon }).addTo(map.current);
      const key = `${pin.source ?? "ev"}-${pin.id}`;
      markerMap.current[key] = { marker, pin };

      marker.on("mouseover", () => openPopupForMarker(marker, pin));

      marker.on("click", async () => {
        setLoading(true);
        try {
          const detail = await fetchLocation(pin.id, pin.source);
          setSelected(detail);
        } catch {
          alert("שגיאה בטעינת פרטי התחנה");
        } finally {
          setLoading(false);
        }
      });
    });

    // Build price table (closest 40)
    const sorted = [...inRadius]
      .map((p) => {
        const [lat, lng] = p.geo.split(",").map(Number);
        return { pin: p, dist: haversineKm(c.lat, c.lng, lat, lng) };
      })
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 40);

    const rows: StationRow[] = await Promise.all(
      sorted.map(async ({ pin, dist }) => {
        const [pinLat, pinLng] = pin.geo.split(",").map(Number);
        const detail = await fetchLocation(pin.id, pin.source);
        const loc = detail.locations[0];
        const tariffMap = Object.fromEntries(detail.tariffs.map((t) => [t.id, t]));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const evses = loc.zones.flatMap((z: any) => z.evses);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const available = evses.filter((e: any) => e.isAvailable).length;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prices = evses.map((e: any) => tariffMap[e.tariffId]?.priceForEnergy).filter((p: any): p is number => p != null);
        return {
          id: pin.id,
          source: pin.source,
          name: loc.name,
          address: loc.address,
          distanceKm: dist,
          pricePerKwh: prices.length ? Math.min(...prices) : null,
          available,
          total: evses.length,
          lat: pinLat,
          lng: pinLng,
        };
      })
    );
    setTableRows(rows);
  }, []);

  // Trigger refresh when props change
  const centerRef = useRef(center);
  const radiusRef = useRef(radiusKm);
  useEffect(() => { centerRef.current = center; }, [center]);
  useEffect(() => { radiusRef.current = radiusKm; }, [radiusKm]);

  useEffect(() => {
    if (center) refresh(center, radiusKm);
  }, [center, radiusKm, filter, provider, refresh]);

  // Init Leaflet once
  useEffect(() => {
    if (!mapRef.current) return;

    const doInit = () => {
      if (!mapRef.current || map.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Lref = (window as any).L;
      L.current = Lref;
      const m = Lref.map(mapRef.current).setView([31.76, 34.72], 9);
      Lref.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(m);
      map.current = m;
      mapReady.current = true;
      // If center already set, refresh now
      if (centerRef.current) refresh(centerRef.current, radiusRef.current);
    };

    if (!document.querySelector("#leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).L) {
      doInit();
    } else {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = doInit;
      document.head.appendChild(script);
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
        mapReady.current = false;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTableSelect = async (id: number | string, source?: "greenspot" | "cellocharge") => {
    const key = `${source ?? "ev"}-${id}`;
    const entry = markerMap.current[key];
    if (!entry) return;
    const { marker, pin } = entry;
    const [lat, lng] = pin.geo.split(",").map(Number);
    map.current?.setView([lat, lng], 16, { animate: true });
    // Highlight the marker briefly
    const el = marker.getElement();
    if (el) {
      const dot = el.querySelector("div");
      if (dot) {
        dot.style.width = "24px";
        dot.style.height = "24px";
        dot.style.border = "3px solid #1d4ed8";
        dot.style.marginLeft = "-4px";
        dot.style.marginTop = "-4px";
        setTimeout(() => {
          dot.style.width = "16px";
          dot.style.height = "16px";
          dot.style.border = "2px solid #fff";
          dot.style.marginLeft = "";
          dot.style.marginTop = "";
        }, 2000);
      }
    }
    // Open popup after pan
    setTimeout(async () => {
      const detail = await fetchLocation(pin.id, pin.source).catch(() => null);
      if (!detail) return;
      const loc = detail.locations[0];
      const tariffMap = Object.fromEntries(detail.tariffs.map((t) => [t.id, t]));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const evses = loc.zones.flatMap((z: any) => z.evses);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const available = evses.filter((e: any) => e.isAvailable).length;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prices = evses.map((e: any) => tariffMap[e.tariffId]?.priceForEnergy).filter((p: any): p is number => p != null);
      const minPrice = prices.length ? Math.min(...prices) : null;
      const badge = pin.source === "greenspot"
        ? `<span style="font-size:10px;background:#16a34a;color:#fff;padding:1px 5px;border-radius:8px;margin-left:4px">GreenSpot</span>`
        : pin.source === "cellocharge"
        ? `<span style="font-size:10px;background:#7c3aed;color:#fff;padding:1px 5px;border-radius:8px;margin-left:4px">CelloCharge</span>`
        : `<span style="font-size:10px;background:#2563eb;color:#fff;padding:1px 5px;border-radius:8px;margin-left:4px">EV-Edge</span>`;
      const [plat, plng] = loc.location.split(",").map(Number);
      const gUrl = `https://www.google.com/maps/dir/?api=1&destination=${plat},${plng}`;
      const wUrl = `https://waze.com/ul?ll=${plat},${plng}&navigate=yes`;
      marker.bindPopup(`
        <div style="font-family:sans-serif;direction:rtl;min-width:160px">
          <div style="font-weight:700;font-size:14px">${badge}${loc.name}</div>
          <div style="font-size:12px;color:#666;margin-bottom:6px">${loc.address}</div>
          <div style="font-size:13px;margin-bottom:6px">${available}/${evses.length} פנויים</div>
          ${minPrice != null ? `<div style="font-size:16px;font-weight:700;color:#1d4ed8;margin-bottom:8px">₪${minPrice.toFixed(2)} / kWh</div>` : ""}
          <div style="display:flex;gap:6px">
            <a href="${gUrl}" target="_blank" style="flex:1;text-align:center;padding:5px 4px;background:#eff6ff;color:#1d4ed8;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none">🗺 Google Maps</a>
            <a href="${wUrl}" target="_blank" style="flex:1;text-align:center;padding:5px 4px;background:#f0f9ff;color:#0369a1;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none">🔵 Waze</a>
          </div>
        </div>
      `, { closeButton: true, offset: [0, -8] }).openPopup();
    }, 400);
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />
      {tableRows.length > 0 && (
        <CheapTable stations={tableRows} onSelect={(id, source) => handleTableSelect(id, source)} />
      )}
      {loading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-lg px-4 py-2 text-sm font-medium z-[1000]">
          טוען...
        </div>
      )}
      {selected && <StationCard detail={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
