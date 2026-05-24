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
  chargeType?: "ac" | "dc" | "mixed";
}

const PAGE_SIZE = 20;

export default function CheapTable({
  stations,
  onSelect,
}: {
  stations: StationRow[];
  onSelect: (id: number | string, source?: "greenspot" | "cellocharge") => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [sortBy, setSortBy] = useState<"price" | "distance">("price");
  const [filterType, setFilterType] = useState<"all" | "ac" | "dc">("all");
  const [showAll, setShowAll] = useState(false);

  if (!stations.length) return null;

  const withPrice = stations.filter((s) => s.pricePerKwh != null);
  const minPrice = withPrice.length ? Math.min(...withPrice.map((s) => s.pricePerKwh!)) : null;

  const sorted = [...stations].sort((a, b) => {
    if (sortBy === "distance") return a.distanceKm - b.distanceKm;
    if (a.pricePerKwh == null && b.pricePerKwh == null) return a.distanceKm - b.distanceKm;
    if (a.pricePerKwh == null) return 1;
    if (b.pricePerKwh == null) return -1;
    return a.pricePerKwh - b.pricePerKwh;
  });

  const filtered = filterType === "all" ? sorted : sorted.filter((s) => {
    if (filterType === "dc") return s.chargeType === "dc" || s.chargeType === "mixed";
    if (filterType === "ac") return s.chargeType === "ac" || s.chargeType === "mixed";
    return true;
  });

  const visible = showAll ? filtered : filtered.slice(0, PAGE_SIZE);

  return (
    <div className="absolute top-2 left-2 right-2 md:top-4 md:left-4 md:right-auto z-[1000] bg-white rounded-2xl shadow-xl md:w-80 flex flex-col overflow-hidden border border-gray-100">
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer select-none bg-gradient-to-l from-blue-50 to-white"
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">⚡</span>
          <h3 className="font-bold text-sm text-gray-800">תחנות בטווח</h3>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
            {stations.length}
          </span>
        </div>
        <span className="text-gray-400 text-sm">{collapsed ? "▲" : "▼"}</span>
      </div>

      {/* Sort + charge-type filter */}
      {!collapsed && (
        <div className="flex flex-col gap-1.5 px-4 py-2 border-b border-gray-100 bg-gray-50/60">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 shrink-0">מיון —</span>
            <button
              onClick={() => { setSortBy("price"); setShowAll(false); }}
              className={`flex-1 text-xs py-1 rounded-lg font-semibold transition-colors ${sortBy === "price" ? "bg-blue-600 text-white" : "bg-white text-gray-500 border border-gray-200 hover:border-blue-300"}`}
            >
              מחיר
            </button>
            <button
              onClick={() => { setSortBy("distance"); setShowAll(false); }}
              className={`flex-1 text-xs py-1 rounded-lg font-semibold transition-colors ${sortBy === "distance" ? "bg-blue-600 text-white" : "bg-white text-gray-500 border border-gray-200 hover:border-blue-300"}`}
            >
              מרחק
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 shrink-0">סוג —</span>
            <button
              onClick={() => { setFilterType("all"); setShowAll(false); }}
              className={`flex-1 text-xs py-1 rounded-lg font-semibold transition-colors ${filterType === "all" ? "bg-blue-600 text-white" : "bg-white text-gray-500 border border-gray-200 hover:border-blue-300"}`}
            >
              הכל
            </button>
            <button
              onClick={() => { setFilterType("ac"); setShowAll(false); }}
              className={`flex-1 text-xs py-1 rounded-lg font-semibold transition-colors ${filterType === "ac" ? "bg-gray-600 text-white" : "bg-white text-gray-500 border border-gray-200 hover:border-blue-300"}`}
            >
              AC
            </button>
            <button
              onClick={() => { setFilterType("dc"); setShowAll(false); }}
              className={`flex-1 text-xs py-1 rounded-lg font-semibold transition-colors ${filterType === "dc" ? "bg-orange-500 text-white" : "bg-white text-gray-500 border border-gray-200 hover:border-blue-300"}`}
            >
              ⚡ DC מהיר
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {!collapsed && (
        <div className="overflow-y-auto max-h-[35vh] md:max-h-[60vh]">
          {visible.map((s, i) => {
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
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="text-xs text-gray-400">{s.distanceKm.toFixed(1)} ק״מ</span>
                        <span className="text-gray-200">·</span>
                        <span className={`text-xs font-medium ${s.available > 0 ? "text-emerald-600" : "text-red-400"}`}>
                          {s.available}/{s.total} פנויים
                        </span>
                        {s.chargeType && (
                          <>
                            <span className="text-gray-200">·</span>
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                              s.chargeType === "dc"
                                ? "bg-orange-100 text-orange-600"
                                : s.chargeType === "mixed"
                                ? "bg-purple-100 text-purple-600"
                                : "bg-gray-100 text-gray-500"
                            }`}>
                              {s.chargeType === "dc" ? "⚡ DC מהיר" : s.chargeType === "mixed" ? "AC+DC" : "AC"}
                            </span>
                          </>
                        )}
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
          {!showAll && filtered.length > PAGE_SIZE && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full py-2.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors border-t border-gray-100"
            >
              הצג עוד {filtered.length - PAGE_SIZE} תחנות ▼
            </button>
          )}
          {showAll && filtered.length > PAGE_SIZE && (
            <button
              onClick={() => setShowAll(false)}
              className="w-full py-2.5 text-xs font-semibold text-gray-400 hover:bg-gray-50 transition-colors border-t border-gray-100"
            >
              הצג פחות ▲
            </button>
          )}
        </div>
      )}
    </div>
  );
}
