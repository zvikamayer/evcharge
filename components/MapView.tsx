"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { Pin, LocationDetail } from "@/lib/api";
import { haversineKm, boundingBox } from "@/lib/geo";
import StationCard from "./StationCard";
import CheapTable, { StationRow } from "./CheapTable";

function pinColor(av: Pin["av"]) {
  if (av.ava > 0) return "#22c55e"; // green  — at least one charger free
  return "#ef4444";                  // red    — nothing available (occupied or unknown)
}

const EV_BASE = "https://cp.evedge.co.il/api/v1/app";
const LS_PREFIX = "vcharge_loc_";
const LS_TTL_MS  = 3 * 60 * 1000; // 3 min localStorage TTL for EV-Edge details
const MEM_TTL_MS = 2 * 60 * 1000; // 2 min in-memory TTL (shorter — ensures fresh colours)

// In-memory cache with timestamps so stale availability data doesn't persist
const cache: Record<string, { data: LocationDetail; ts: number }> = {};

function lsGet(key: string): LocationDetail | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > LS_TTL_MS) { localStorage.removeItem(LS_PREFIX + key); return null; }
    return data as LocationDetail;
  } catch { return null; }
}
function lsSet(key: string, data: LocationDetail) {
  try { localStorage.setItem(LS_PREFIX + key, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

async function fetchLocation(id: number | string, source?: "greenspot" | "cellocharge", providerId?: string): Promise<LocationDetail> {
  const key = source === "greenspot" ? `gs-${id}` : source === "cellocharge" && providerId === "scala" ? `scala-${id}` : source === "cellocharge" ? `cello-${id}` : `ev-${id}`;
  // Return in-memory cached value only if still fresh
  const cached = cache[key];
  if (cached && Date.now() - cached.ts < MEM_TTL_MS) return cached.data;
  // Check localStorage cache for EV-Edge (browser-side, 3 min TTL)
  if (!source) {
    const ls = lsGet(key);
    if (ls) { cache[key] = { data: ls, ts: Date.now() }; return ls; }
  }
  // EV-Edge is fetched client-side (has CORS headers); GreenSpot & CelloCharge via server proxy
  const url = source === "greenspot"
    ? `/api/gs/station/${id}`
    : source === "cellocharge" && providerId === "scala"
    ? `/api/scala/station/${id}`
    : source === "cellocharge"
    ? `/api/cello/station/${id}`
    : `${EV_BASE}/locations/${id}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: LocationDetail = await res.json();
  cache[key] = { data, ts: Date.now() };
  if (!source) lsSet(key, data); // persist EV-Edge details
  return data;
}

interface Props {
  filter: string;
  provider: string;
  center: { lat: number; lng: number } | null;
  radiusKm: number;
  nationalMode?: boolean;
  onPinCounts?: (counts: Record<string, number>) => void;
  onCenterChange?: (center: { lat: number; lng: number }) => void;
}

export default function MapView({ filter, provider, center, radiusKm, nationalMode, onPinCounts, onCenterChange }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapReady = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const L = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const circle = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const centerMarker = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerMap = useRef<Record<string, { marker: any; pin: Pin }>>({});

  const [selected, setSelected] = useState<LocationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [tableRows, setTableRows] = useState<StationRow[]>([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [emptySearch, setEmptySearch] = useState(false);

  // Track which marker currently shows the ★ star (cheapest station)
  const cheapestKeyRef = useRef<string | null>(null);

  // Whenever table rows change, move the ★ to the cheapest station on the map
  useEffect(() => {
    if (!L.current) return;
    const withPrice = tableRows.filter((r) => r.pricePerKwh != null && r.pricePerKwh > 0);

    // Helper — restore a marker to its plain colour
    const restore = (key: string) => {
      const e = markerMap.current[key];
      if (!e || !L.current) return;
      const color = e.pin.av.ava > 0 ? "#22c55e" : "#ef4444";
      e.marker.setZIndexOffset(e.pin.av.ava > 0 ? 0 : 500);
      e.marker.setIcon(L.current.divIcon({
        className: "",
        html: `<div style="width:20px;height:20px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);cursor:pointer"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      }));
    };

    if (withPrice.length === 0) {
      if (cheapestKeyRef.current) { restore(cheapestKeyRef.current); cheapestKeyRef.current = null; }
      return;
    }

    const minPrice = Math.min(...withPrice.map((r) => r.pricePerKwh!));
    const cheapest = withPrice.find((r) => r.pricePerKwh === minPrice);
    if (!cheapest) return;
    const newKey = `${cheapest.source ?? "ev"}-${cheapest.id}`;
    if (newKey === cheapestKeyRef.current) return; // already starred

    // Un-star the previous cheapest
    if (cheapestKeyRef.current) restore(cheapestKeyRef.current);

    // Star the new cheapest
    const entry = markerMap.current[newKey];
    if (entry && L.current) {
      entry.marker.setZIndexOffset(1000);
      entry.marker.setIcon(L.current.divIcon({
        className: "",
        html: `<div style="width:28px;height:28px;border-radius:50%;background:#22c55e;border:2.5px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;cursor:pointer"><span style="color:#fff;font-size:14px;line-height:1;font-weight:700">★</span></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      }));
    }
    cheapestKeyRef.current = newKey;
  }, [tableRows]);

  const filterRef = useRef(filter);
  useEffect(() => { filterRef.current = filter; }, [filter]);

  const providerRef = useRef(provider);
  useEffect(() => { providerRef.current = provider; }, [provider]);

  const nationalModeRef = useRef(nationalMode);
  useEffect(() => { nationalModeRef.current = nationalMode; }, [nationalMode]);

  const onPinCountsRef = useRef(onPinCounts);
  useEffect(() => { onPinCountsRef.current = onPinCounts; }, [onPinCounts]);

  const onCenterChangeRef = useRef(onCenterChange);
  useEffect(() => { onCenterChangeRef.current = onCenterChange; }, [onCenterChange]);

  // Called once map is ready and whenever center/radius/filter change
  const refresh = useCallback(async (
    c: { lat: number; lng: number },
    r: number,
  ) => {
    if (!mapReady.current || !L.current || !map.current) return;

    // Show loading indicator immediately — pin fetching can be slow on mobile
    setTableLoading(true);
    setTableRows([]);
    setEmptySearch(false);

    if (!nationalModeRef.current) {
      // Draw circle first so we can fitBounds on it
      if (circle.current) circle.current.remove();
      circle.current = L.current.circle([c.lat, c.lng], {
        radius: r * 1000,
        color: "#2563eb",
        fillColor: "#3b82f6",
        fillOpacity: 0.08,
        weight: 2,
      }).addTo(map.current);

      // Zoom + pan to fit the radius circle
      map.current.fitBounds(circle.current.getBounds(), { padding: [24, 24], animate: true });

      // Center / "you are here" pin — draggable
      if (centerMarker.current) centerMarker.current.remove();
      centerMarker.current = L.current.marker([c.lat, c.lng], {
        icon: L.current.divIcon({
          className: "",
          html: `
            <div style="position:relative;width:32px;height:40px;cursor:grab">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 40" width="32" height="40">
                <path d="M16 0C9.37 0 4 5.37 4 12c0 9 12 28 12 28S28 21 28 12C28 5.37 22.63 0 16 0z"
                  fill="#1d4ed8" stroke="#fff" stroke-width="1.5"/>
                <circle cx="16" cy="12" r="5" fill="#fff"/>
              </svg>
            </div>`,
          iconSize: [32, 40],
          iconAnchor: [16, 40],
        }),
        draggable: true,
        zIndexOffset: 1000,
      }).addTo(map.current);

      // Move circle in real-time while dragging
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      centerMarker.current.on("drag", (e: any) => {
        const { lat, lng } = e.target.getLatLng();
        circle.current?.setLatLng([lat, lng]);
      });

      // On drop — refresh stations at new location
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      centerMarker.current.on("dragend", (e: any) => {
        const { lat, lng } = e.target.getLatLng();
        const newCenter = { lat, lng };
        refresh(newCenter, radiusRef.current);
        onCenterChangeRef.current?.(newCenter);
      });

      centerMarker.current.bindTooltip("גרור לשינוי מיקום", {
        direction: "top",
        offset: [0, -44],
      });
    } else {
      // National mode: remove any stale circle / center marker
      if (circle.current) { circle.current.remove(); circle.current = null; }
      if (centerMarker.current) { centerMarker.current.remove(); centerMarker.current = null; }
    }

    // Fetch pins from all providers in parallel (all via server-side proxies to avoid CORS)
    const bb = boundingBox(c.lat, c.lng, r);
    const qs = `minLat=${bb.minLat}&maxLat=${bb.maxLat}&minLng=${bb.minLng}&maxLng=${bb.maxLng}`;
    const p = providerRef.current;
    const isStaticProvider = p === "all" || p === "evedge" || p === "greenspot" || p === "afcon" || p === "sonolevi" || p === "scala" || p === "zenev" || p === "energyone";
    // Any unknown provider id is treated as a CelloCharge providerId
    const wantEv = p === "all" || p === "evedge";
    const wantGs = p === "all" || p === "greenspot";
    const wantAfcon = p === "all" || p === "afcon";
    const wantSonol = p === "all" || p === "sonolevi";
    const wantScala = p === "all" || p === "scala";
    const wantZen = p === "all" || p === "zenev";
    const wantEnergyOne = p === "all" || p === "energyone";
    const wantCello = p === "all" || !isStaticProvider;
    const celloProviderParam = !isStaticProvider ? `&providerId=${encodeURIComponent(p)}` : "";
    // Fetch each provider independently so one failure doesn't block the others.
    const [evPins, gsPins, celloPins, afconPins, sonolPins, scalaPins, zenPins, energyOnePins] = await Promise.all([
      wantEv
        ? fetch(`${EV_BASE}/pins?minLatitude=${bb.minLat}&maxLatitude=${bb.maxLat}&minLongitude=${bb.minLng}&maxLongitude=${bb.maxLng}`)
            .then((r) => r.json()).then((d: { pins?: Pin[] }) => d.pins ?? []).catch(() => [] as Pin[])
        : ([] as Pin[]),
      wantGs
        ? fetch(`/api/gs/pins?${qs}`)
            .then((r) => r.json()).catch(() => [] as Pin[])
        : ([] as Pin[]),
      wantCello
        ? fetch(`/api/cello/pins?${qs}${celloProviderParam}`)
            .then((r) => r.json()).catch(() => [] as Pin[])
        : ([] as Pin[]),
      wantAfcon
        ? fetch(`/api/afcon/pins?${qs}`)
            .then((r) => r.json()).catch(() => [] as Pin[])
        : ([] as Pin[]),
      wantSonol
        ? fetch(`/api/sonolevi/pins?${qs}`)
            .then((r) => r.json()).catch(() => [] as Pin[])
        : ([] as Pin[]),
      wantScala
        ? fetch(`/api/scala/pins?${qs}`)
            .then((r) => r.json()).catch(() => [] as Pin[])
        : ([] as Pin[]),
      wantZen
        ? fetch(`/api/zenev/pins?${qs}`)
            .then((r) => r.json()).catch(() => [] as Pin[])
        : ([] as Pin[]),
      wantEnergyOne
        ? fetch(`/api/energyone/pins?${qs}`)
            .then((r) => r.json()).catch(() => [] as Pin[])
        : ([] as Pin[]),
    ]);
    const pins: Pin[] = [...evPins, ...gsPins, ...celloPins, ...afconPins, ...sonolPins, ...scalaPins, ...zenPins, ...energyOnePins];

    const inRadius = nationalModeRef.current
      ? pins
      : pins.filter((p) => {
          const [lat, lng] = p.geo.split(",").map(Number);
          return haversineKm(c.lat, c.lng, lat, lng) <= r;
        });

    // Emit per-provider counts for filter buttons
    if (onPinCountsRef.current) {
      const counts: Record<string, number> = { all: inRadius.length };
      counts["evedge"] = inRadius.filter((p) => p.source !== "greenspot" && p.source !== "cellocharge" && p.providerId !== "afcon").length;
      counts["greenspot"] = inRadius.filter((p) => p.source === "greenspot").length;
      counts["afcon"] = inRadius.filter((p) => p.providerId === "afcon").length;
      counts["sonolevi"] = inRadius.filter((p) => p.providerId === "sonolevi").length;
      counts["scala"] = inRadius.filter((p) => p.providerId === "scala").length;
      counts["zenev"] = inRadius.filter((p) => p.providerId === "zenev").length;
      counts["energyone"] = inRadius.filter((p) => p.providerId === "energyone").length;
      for (const p of inRadius) {
        if (p.source === "cellocharge" && p.providerId) {
          counts[p.providerId] = (counts[p.providerId] ?? 0) + 1;
        }
      }
      onPinCountsRef.current(counts);
    }

    // Always show all pins on map — colour conveys availability (green/amber/red)
    // The "available only" filter applies to the table, not to map markers
    const visible = inRadius;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async function openPopupForMarker(marker: any, pin: Pin) {
      const detail = await fetchLocation(pin.id, pin.source, pin.providerId);
      const loc = detail.locations[0];
      const tariffMap = Object.fromEntries(detail.tariffs.map((t) => [t.id, t]));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const evses = loc.zones.flatMap((z: any) => z.evses);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const available = evses.filter((e: any) => e.isAvailable).length;
      // Immediately correct the marker colour with real availability data
      if (L.current) {
        const actualColor = available > 0 ? "#22c55e" : "#ef4444";
        marker.setZIndexOffset(available > 0 ? 0 : 500);
        marker.setIcon(L.current.divIcon({
          className: "",
          html: `<div style="width:20px;height:20px;border-radius:50%;background:${actualColor};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);cursor:pointer"></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }));
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prices = evses.map((e: any) => tariffMap[e.tariffId]?.priceForEnergy).filter((p: any): p is number => p != null && p > 0);
      const minPrice = prices.length ? Math.min(...prices) : null;
      const badgeLabel = pin.source === "greenspot"
        ? "GreenSpot"
        : pin.source === "cellocharge"
        ? (pin.providerName ?? "CelloCharge")
        : "EV-Edge";
      const badgeColor = pin.source === "greenspot"
        ? "#16a34a"
        : pin.source === "cellocharge"
        ? "#7c3aed"
        : "#2563eb";
      const badge = `<span style="font-size:10px;background:${badgeColor};color:#fff;padding:1px 5px;border-radius:8px;margin-left:4px">${badgeLabel}</span>`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const types = new Set(evses.map((e: any) => e.currentType).filter(Boolean));
      const chargeType = types.has("dc") && types.has("ac") ? "mixed" : types.has("dc") ? "dc" : types.has("ac") ? "ac" : null;
      const chargeLabel = chargeType === "dc" ? "⚡ DC מהיר" : chargeType === "mixed" ? "AC+DC" : chargeType === "ac" ? "AC" : null;
      const chargeColor = chargeType === "dc" ? "#ea580c" : chargeType === "mixed" ? "#7c3aed" : "#6b7280";
      const chargeBadge = chargeLabel ? `<span style="font-size:10px;background:${chargeColor}1a;color:${chargeColor};padding:1px 6px;border-radius:8px;font-weight:600">${chargeLabel}</span>` : "";
      const [plat, plng] = loc.location.split(",").map(Number);
      const gUrl = `https://www.google.com/maps/dir/?api=1&destination=${plat},${plng}`;
      const wUrl = `https://waze.com/ul?ll=${plat},${plng}&navigate=yes`;
      marker.bindPopup(`
        <div style="font-family:sans-serif;direction:rtl;min-width:160px">
          <div style="font-weight:700;font-size:14px">${badge}${loc.name}</div>
          <div style="font-size:12px;color:#666;margin-bottom:6px">${loc.address}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
            <span style="font-size:13px">${available}/${evses.length} פנויים</span>
            ${chargeBadge}
          </div>
          ${minPrice != null ? `<div style="font-size:16px;font-weight:700;color:#1d4ed8;margin-bottom:8px">₪${minPrice.toFixed(2)} / kWh</div>` : ""}
          <div style="display:flex;gap:6px">
            <a href="${gUrl}" target="_blank" style="flex:1;text-align:center;padding:5px 4px;background:#eff6ff;color:#1d4ed8;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none">🗺 Google Maps</a>
            <a href="${wUrl}" target="_blank" style="flex:1;text-align:center;padding:5px 4px;background:#f0f9ff;color:#0369a1;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none">🔵 Waze</a>
          </div>
        </div>
      `, { closeButton: true, offset: [0, -8] }).openPopup();
    }

    // Clear old markers and reset cheapest-star tracking
    Object.values(markerMap.current).forEach(({ marker }) => marker.remove());
    markerMap.current = {};
    cheapestKeyRef.current = null;

    // Add new markers — defensive try/catch so one bad pin doesn't stop the rest
    visible.forEach((pin) => {
      try {
      const [lat, lng] = pin.geo.split(",").map(Number);
      if (isNaN(lat) || isNaN(lng)) return; // skip pins with invalid coordinates
      const color = pinColor(pin.av);
      // Occupied/unknown markers get a higher z-index so they render above green dots
      const isOccupied = pin.av.ava === 0;
      const icon = L.current.divIcon({
        className: "",
        html: `<div style="width:20px;height:20px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);cursor:pointer"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      const marker = L.current.marker([lat, lng], { icon, zIndexOffset: isOccupied ? 500 : 0 }).addTo(map.current);
      const key = `${pin.source ?? "ev"}-${pin.id}`;
      markerMap.current[key] = { marker, pin };

      marker.on("mouseover", () => openPopupForMarker(marker, pin));
      marker.on("mouseout", () => marker.closePopup());

      marker.on("click", async () => {
        setLoading(true);
        try {
          const detail = await fetchLocation(pin.id, pin.source, pin.providerId);
          setSelected(detail);
        } catch {
          alert("שגיאה בטעינת פרטי התחנה");
        } finally {
          setLoading(false);
        }
      });
      } catch {/* skip pins that fail to render */}
    });

    // In national mode: fit the map to all displayed pins
    if (nationalModeRef.current && visible.length > 0) {
      const lats = visible.map((p) => Number(p.geo.split(",")[0])).filter((l) => !isNaN(l));
      const lngs = visible.map((p) => Number(p.geo.split(",")[1])).filter((l) => !isNaN(l));
      if (lats.length > 0) {
        map.current.fitBounds(
          [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
          { padding: [32, 32], animate: true },
        );
      }
    }

    // ── Build price table ────────────────────────────────────────────────────
    // Strategy:
    //   Phase 1 (instant)  – CelloCharge pins carry all needed data inline.
    //                        Build those rows immediately, hide spinner, show table.
    //   Phase 2 (background) – EV-Edge / GreenSpot need individual API calls.
    //                        Add rows incrementally as they resolve.
    const withDist = [...inRadius].map((p) => {
      const [lat, lng] = p.geo.split(",").map(Number);
      return { pin: p, dist: haversineKm(c.lat, c.lng, lat, lng) };
    });

    // Phase 1: rows with inline data (no API call needed)
    // Apply availability filter to table rows (not to map markers)
    const inlineRows: StationRow[] = withDist
      .filter(({ pin }) => pin.inlineData && (filterRef.current !== "available" || pin.av.ava > 0))
      .map(({ pin, dist }) => {
        const [pinLat, pinLng] = pin.geo.split(",").map(Number);
        const d = pin.inlineData!;
        return {
          id: pin.id,
          source: pin.source,
          providerName: pin.providerName,
          name: d.name,
          address: d.address,
          distanceKm: dist,
          pricePerKwh: d.pricePerKwh,
          available: pin.av.ava,
          total: d.total,
          lat: pinLat,
          lng: pinLng,
          chargeType: d.chargeType,
        } as StationRow;
      });

    // Show CelloCharge rows immediately — dismiss spinner
    setTableRows(inlineRows);
    setTableLoading(false);

    // If no pins at all found — show empty state
    if (inRadius.length === 0) {
      setEmptySearch(true);
    }

    // Phase 2a: colour-sync ALL non-inline markers with real availability data.
    // EV-Edge / GreenSpot pins carry stale availability in the pins response —
    // fetch the detail for EVERY pin so every marker shows the correct colour.
    // Sort by distance so nearby stations update first; fetchLocation() caches
    // results so Phase 2b reuses them for free.
    const nonInlinePins = withDist
      .filter(({ pin }) => !pin.inlineData)
      .sort((a, b) => a.dist - b.dist);
    nonInlinePins.forEach(async ({ pin }) => {
      try {
        const detail = await fetchLocation(pin.id, pin.source, pin.providerId);
        const loc = detail.locations[0];
        if (!loc) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const evses = loc.zones.flatMap((z: any) => z.evses);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const available = evses.filter((e: any) => e.isAvailable).length;
        const markerKey = `${pin.source ?? "ev"}-${pin.id}`;
        const markerEntry = markerMap.current[markerKey];
        if (markerEntry && L.current) {
          const actualColor = available > 0 ? "#22c55e" : "#ef4444";
          markerEntry.marker.setZIndexOffset(available > 0 ? 0 : 500);
          markerEntry.marker.setIcon(
            L.current.divIcon({
              className: "",
              html: `<div style="width:20px;height:20px;border-radius:50%;background:${actualColor};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);cursor:pointer"></div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            })
          );
        }
      } catch {/* ignore */}
    });

    // Phase 2b: build table rows for the closest 40 non-inline stations.
    // fetchLocation() hits the in-memory cache populated by Phase 2a above.
    const apiItems = nonInlinePins
      .filter(({ pin }) => filterRef.current !== "available" || pin.av.ava > 0)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 40);

    if (apiItems.length > 0) {
      // Helper to build a single row via API
      const buildApiRow = async ({ pin, dist }: typeof apiItems[0]): Promise<StationRow | null> => {
        try {
          const [pinLat, pinLng] = pin.geo.split(",").map(Number);
          const detail = await fetchLocation(pin.id, pin.source, pin.providerId);
          const loc = detail.locations[0];
          if (!loc) return null;
          const tariffMap = Object.fromEntries(detail.tariffs.map((t) => [t.id, t]));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const evses = loc.zones.flatMap((z: any) => z.evses);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const available = evses.filter((e: any) => e.isAvailable).length;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const prices = evses.map((e: any) => tariffMap[e.tariffId]?.priceForEnergy).filter((p: any): p is number => p != null && p > 0);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const types = new Set(evses.map((e: any) => e.currentType).filter(Boolean));
          const chargeType: "ac" | "dc" | "mixed" | undefined =
            types.has("dc") && types.has("ac") ? "mixed" : types.has("dc") ? "dc" : types.has("ac") ? "ac" : undefined;

          return {
            id: pin.id,
            source: pin.source,
            providerName: pin.providerName,
            name: loc.name,
            address: loc.address,
            distanceKm: dist,
            pricePerKwh: prices.length ? Math.min(...prices) : null,
            available,
            total: evses.length,
            lat: pinLat,
            lng: pinLng,
            chargeType,
          } as StationRow;
        } catch {
          return null;
        }
      };

      // Fire all in parallel; each resolves independently and updates the table
      apiItems.forEach(async (item) => {
        const row = await buildApiRow(item);
        if (row) {
          setTableRows((prev) => {
            // Avoid duplicates if refresh was called again
            const exists = prev.some((r) => r.id === row.id && r.source === row.source);
            return exists ? prev : [...prev, row];
          });
        }
      });
    }
  }, []);

  // Trigger refresh when props change
  const centerRef = useRef(center);
  const radiusRef = useRef(radiusKm);
  useEffect(() => { centerRef.current = center; }, [center]);
  useEffect(() => { radiusRef.current = radiusKm; }, [radiusKm]);

  useEffect(() => {
    if (center) refresh(center, radiusKm);
  }, [center, radiusKm, filter, provider, nationalMode, refresh]);

  // Init Leaflet once
  useEffect(() => {
    if (!mapRef.current) return;

    const doInit = () => {
      if (!mapRef.current || map.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Lref = (window as any).L;
      L.current = Lref;
      const m = Lref.map(mapRef.current).setView([32.08, 34.78], 13);
      Lref.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
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

    // Invalidate Leaflet size whenever the container is resized
    // (e.g. when the header collapses after GPS/search)
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && mapRef.current) {
      ro = new ResizeObserver(() => {
        map.current?.invalidateSize();
      });
      ro.observe(mapRef.current);
    }

    return () => {
      ro?.disconnect();
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
        dot.style.width = "28px";
        dot.style.height = "28px";
        dot.style.border = "3px solid #1d4ed8";
        dot.style.marginLeft = "-4px";
        dot.style.marginTop = "-4px";
        setTimeout(() => {
          dot.style.width = "20px";
          dot.style.height = "20px";
          dot.style.border = "2px solid #fff";
          dot.style.marginLeft = "";
          dot.style.marginTop = "";
        }, 2000);
      }
    }
    // Open popup after pan
    setTimeout(async () => {
      const detail = await fetchLocation(pin.id, pin.source, pin.providerId).catch(() => null);
      if (!detail) return;
      const loc = detail.locations[0];
      const tariffMap = Object.fromEntries(detail.tariffs.map((t) => [t.id, t]));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const evses = loc.zones.flatMap((z: any) => z.evses);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const available = evses.filter((e: any) => e.isAvailable).length;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prices = evses.map((e: any) => tariffMap[e.tariffId]?.priceForEnergy).filter((p: any): p is number => p != null && p > 0);
      const minPrice = prices.length ? Math.min(...prices) : null;
      const badgeLabel = pin.source === "greenspot"
        ? "GreenSpot"
        : pin.source === "cellocharge"
        ? (pin.providerName ?? "CelloCharge")
        : "EV-Edge";
      const badgeColor = pin.source === "greenspot"
        ? "#16a34a"
        : pin.source === "cellocharge"
        ? "#7c3aed"
        : "#2563eb";
      const badge = `<span style="font-size:10px;background:${badgeColor};color:#fff;padding:1px 5px;border-radius:8px;margin-left:4px">${badgeLabel}</span>`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const types2 = new Set(evses.map((e: any) => e.currentType).filter(Boolean));
      const chargeType2 = types2.has("dc") && types2.has("ac") ? "mixed" : types2.has("dc") ? "dc" : types2.has("ac") ? "ac" : null;
      const chargeLabel2 = chargeType2 === "dc" ? "⚡ DC מהיר" : chargeType2 === "mixed" ? "AC+DC" : chargeType2 === "ac" ? "AC" : null;
      const chargeColor2 = chargeType2 === "dc" ? "#ea580c" : chargeType2 === "mixed" ? "#7c3aed" : "#6b7280";
      const chargeBadge2 = chargeLabel2 ? `<span style="font-size:10px;background:${chargeColor2}1a;color:${chargeColor2};padding:1px 6px;border-radius:8px;font-weight:600">${chargeLabel2}</span>` : "";
      const [plat, plng] = loc.location.split(",").map(Number);
      const gUrl = `https://www.google.com/maps/dir/?api=1&destination=${plat},${plng}`;
      const wUrl = `https://waze.com/ul?ll=${plat},${plng}&navigate=yes`;
      marker.bindPopup(`
        <div style="font-family:sans-serif;direction:rtl;min-width:160px">
          <div style="font-weight:700;font-size:14px">${badge}${loc.name}</div>
          <div style="font-size:12px;color:#666;margin-bottom:6px">${loc.address}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
            <span style="font-size:13px">${available}/${evses.length} פנויים</span>
            ${chargeBadge2}
          </div>
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
      {tableLoading && (
        <div className="absolute top-2 left-2 right-2 md:top-4 md:left-4 md:right-auto z-[1000] bg-white rounded-2xl shadow-xl md:w-80 px-4 py-4 flex items-center gap-3 border border-gray-100">
          <svg className="animate-spin h-5 w-5 text-blue-600 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <div>
            <div className="text-sm font-semibold text-gray-700">מחפש עמדות טעינה...</div>
            <div className="text-xs text-gray-400 mt-0.5">מסנכרן נתונים חיים מכל ספקי הטעינה בישראל</div>
            <div className="text-xs text-gray-300 mt-0.5">עשוי לקחת מספר דקות — זה תקין ✓</div>
          </div>
        </div>
      )}
      {!tableLoading && tableRows.length > 0 && (
        <CheapTable stations={tableRows} onSelect={(id, source) => handleTableSelect(id, source)} />
      )}
      {!tableLoading && emptySearch && (
        <div className="absolute bottom-16 left-2 right-2 md:left-4 md:right-auto md:w-80 z-[1000] bg-white rounded-2xl shadow-xl border border-gray-100 px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl">🔍</div>
            <div>
              <div className="text-sm font-semibold text-gray-700">לא נמצאו עמדות בקרבתך</div>
              <div className="text-xs text-gray-400 mt-1">הגדל את הרדיוס או גרור את הסיכה למקום אחר</div>
            </div>
          </div>
        </div>
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
