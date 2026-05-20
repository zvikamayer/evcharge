"use client";
import { useState } from "react";

export interface StationRow {
  id: number;
  source?: "greenspot";
  name: string;
  address: string;
  distanceKm: number;
  pricePerKwh: number | null;
  available: number;
  total: number;
  lat: number;
  lng: number;
}

export default function CheapTable({
  stations,
  onSelect,
}: {
  stations: StationRow[];
  onSelect: (id: number, source?: "greenspot") => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  if (!stations.length) return null;

  const withPrice = stations.filter((s) => s.pricePerKwh != null);
  const minPrice = withPrice.length ? Math.min(...withPrice.map((s) => s.pricePerKwh!)) : null;

  const sorted = [...stations].sort((a, b) => {
    if (a.pricePerKwh == null && b.pricePerKwh == null) return a.distanceKm - b.distanceKm;
    if (a.pricePerKwh == null) return 1;
    if (b.pricePerKwh == null) return -1;
    return a.pricePerKwh - b.pricePerKwh;
  });

  return (
    <div className="absolute top-2 left-2 right-2 md:top-4 md:left-4 md:right-auto z-[1000] bg-white rounded-xl shadow-xl md:w-72 flex flex-col overflow-hidden">
      {/* Header — always visible */}
      <div
        className="px-4 py-3 bg-blue-50 flex items-center justify-between cursor-pointer select-none"
        onClick={() => setCollapsed((c) => !c)}
      >
        <h3 className="font-bold text-sm text-blue-800">
          תחנות בטווח ({stations.length})
        </h3>
        <span className="text-blue-600 text-lg leading-none">
          {collapsed ? "▲" : "▼"}
        </span>
      </div>

      {/* List — hidden when collapsed */}
      {!collapsed && (
        <div className="overflow-y-auto max-h-[35vh] md:max-h-[60vh]">
          {sorted.map((s) => {
            const isCheapest = minPrice != null && s.pricePerKwh === minPrice;
            const gUrl = `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`;
            const wUrl = `https://waze.com/ul?ll=${s.lat},${s.lng}&navigate=yes`;
            return (
              <div key={`${s.source ?? "ev"}-${s.id}`} className="border-b last:border-0">
                <button
                  onClick={() => onSelect(s.id, s.source)}
                  className="w-full text-right px-4 pt-3 pb-1 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        {isCheapest && <span className="text-yellow-500 text-base">★</span>}
                        {s.source === "greenspot"
                          ? <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full shrink-0">GreenSpot</span>
                          : <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full shrink-0">EV-Edge</span>}
                        <span className="font-semibold text-sm truncate">{s.name}</span>
                      </div>
                      <div className="text-xs text-gray-400 truncate">{s.address}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {s.distanceKm.toFixed(1)} ק"מ ·{" "}
                        <span className={s.available > 0 ? "text-green-600" : "text-red-500"}>
                          {s.available}/{s.total} פנויים
                        </span>
                      </div>
                    </div>
                    <div className="text-left shrink-0">
                      {s.pricePerKwh != null ? (
                        <>
                          <span className={`text-sm font-bold ${isCheapest ? "text-blue-700" : "text-gray-700"}`}>
                            ₪{s.pricePerKwh.toFixed(2)}
                          </span>
                          <div className="text-xs text-gray-400">/kWh</div>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400">אין מחיר</span>
                      )}
                    </div>
                  </div>
                </button>
                <div className="flex gap-1.5 px-4 pb-2">
                  <a href={gUrl} target="_blank" rel="noopener noreferrer"
                    className="flex-1 text-center text-xs py-1 rounded bg-blue-50 text-blue-700 font-medium hover:bg-blue-100"
                    onClick={(e) => e.stopPropagation()}>
                    🗺 Google Maps
                  </a>
                  <a href={wUrl} target="_blank" rel="noopener noreferrer"
                    className="flex-1 text-center text-xs py-1 rounded bg-sky-50 text-sky-700 font-medium hover:bg-sky-100"
                    onClick={(e) => e.stopPropagation()}>
                    🔵 Waze
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
