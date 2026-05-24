"use client";
import { useState } from "react";

export interface StationRow {
  id: number | string;
  source?: "greenspot" | "cellocharge";
  providerName?: string;
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
  onSelect: (id: number | string, source?: "greenspot" | "cellocharge") => void;
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
    <div className="absolute top-2 left-2 right-2 md:top-4 md:left-4 md:right-auto z-[1000] bg-white rounded-2xl shadow-xl md:w-80 flex flex-col overflow-hidden border border-gray-100">
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer select-none bg-gradient-to-l from-blue-50 to-white"
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">⚡</span>
          <h3 className="font-bold text-sm text-gray-800">
            תחנות בטווח
          </h3>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
            {stations.length}
          </span>
        </div>
        <span className="text-gray-400 text-sm">{collapsed ? "▲" : "▼"}</span>
      </div>

      {/* List */}
      {!collapsed && (
        <div className="overflow-y-auto max-h-[35vh] md:max-h-[60vh]">
          {sorted.map((s, i) => {
            const isCheapest = minPrice != null && s.pricePerKwh === minPrice;
            const gUrl = `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`;
            const wUrl = `https://waze.com/ul?ll=${s.lat},${s.lng}&navigate=yes`;
            return (
              <div
                key={`${s.source ?? "ev"}-${s.id}`}
                className={`border-b border-gray-50 last:border-0 ${isCheapest ? "bg-amber-50" : i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
              >
                <button
                  onClick={() => onSelect(s.id, s.source)}
                  className="w-full text-right px-4 pt-3 pb-2 hover:bg-blue-50/40 transition-colors"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap mb-0.5">
                        {isCheapest && <span className="text-amber-400 text-sm">★</span>}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                          s.source === "greenspot"
                            ? "bg-emerald-100 text-emerald-700"
                            : s.source === "cellocharge"
                            ? "bg-violet-100 text-violet-700"
                            : "bg-blue-100 text-blue-700"
                        }`}>
                          {s.source === "greenspot"
                            ? "GreenSpot"
                            : s.source === "cellocharge"
                            ? (s.providerName ?? "CelloCharge")
                            : "EV-Edge"}
                        </span>
                        <span className="font-semibold text-sm text-gray-800 truncate">{s.name}</span>
                      </div>
                      <div className="text-xs text-gray-400 truncate">{s.address}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-xs text-gray-400">{s.distanceKm.toFixed(1)} ק״מ</span>
                        <span className="text-gray-200">·</span>
                        <span className={`text-xs font-medium ${s.available > 0 ? "text-emerald-600" : "text-red-400"}`}>
                          {s.available}/{s.total} פנויים
                        </span>
                      </div>
                    </div>
                    <div className="text-left shrink-0">
                      {s.pricePerKwh != null ? (
                        <div className={`text-right ${isCheapest ? "text-blue-600" : "text-gray-700"}`}>
                          <span className="text-sm font-bold">₪{s.pricePerKwh.toFixed(2)}</span>
                          <div className="text-xs text-gray-400">/kWh</div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">אין מחיר</span>
                      )}
                    </div>
                  </div>
                </button>
                {/* Nav buttons */}
                <div className="flex gap-1.5 px-4 pb-2.5">
                  <a
                    href={gUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 text-center text-xs py-1.5 rounded-lg bg-blue-50 text-blue-600 font-semibold hover:bg-blue-100 transition-colors"
                  >
                    🗺 Google Maps
                  </a>
                  <a
                    href={wUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 text-center text-xs py-1.5 rounded-lg bg-sky-50 text-sky-600 font-semibold hover:bg-sky-100 transition-colors"
                  >
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
