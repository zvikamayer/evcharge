"use client";
import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import type { CelloProvider } from "@/lib/cellocharge";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

const STATIC_PROVIDERS = [
  { id: "evedge", label: "EV-Edge" },
  { id: "greenspot", label: "GreenSpot" },
];

export default function Home() {
  const [filter, setFilter] = useState("all");
  const [provider, setProvider] = useState("all");
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState(5);
  const [address, setAddress] = useState("");
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError] = useState("");
  const [celloProviders, setCelloProviders] = useState<CelloProvider[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/cello/providers")
      .then((r) => r.json())
      .then(setCelloProviders)
      .catch(() => {});
  }, []);

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setAddress("המיקום שלי");
        setGeoLoading(false);
      },
      () => {
        setError("לא ניתן לקבל מיקום");
        setGeoLoading(false);
      }
    );
  };

  const searchAddress = async () => {
    if (!address.trim()) return;
    setGeoLoading(true);
    setError("");
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(address)}`);
    if (!res.ok) {
      setError("כתובת לא נמצאה");
      setGeoLoading(false);
      return;
    }
    const data = await res.json();
    setCenter({ lat: data.lat, lng: data.lng });
    setGeoLoading(false);
  };

  const allProviders = [
    { id: "all", label: "כל החברות" },
    ...STATIC_PROVIDERS,
    ...celloProviders.map((p) => ({ id: p.id, label: p.name })),
  ];

  return (
    <div className="flex flex-col h-screen bg-gray-100" dir="rtl">
      {/* Header */}
      <header className="bg-white shadow-md px-4 pt-3 pb-2 z-10 space-y-2.5">
        {/* Title row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white rounded-xl p-1.5 leading-none text-lg">⚡</div>
            <div>
              <h1 className="text-lg font-bold text-gray-800 leading-tight">עמדות טעינה</h1>
            </div>
          </div>
          {/* Status filters */}
          <div className="flex gap-1.5">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${filter === "all" ? "bg-gray-800 text-white shadow-sm" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
            >
              הכל
            </button>
            <button
              onClick={() => setFilter("available")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${filter === "available" ? "bg-emerald-500 text-white shadow-sm" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
            >
              ✓ פנויות
            </button>
          </div>
        </div>

        {/* Provider filters — scrollable */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
          {allProviders.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setProvider(id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all border shrink-0 ${
                provider === id
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-gray-500 border-gray-200 hover:border-blue-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search row */}
        <div className="flex gap-2">
          <div className="flex flex-1 items-center gap-1 bg-gray-100 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-blue-400 focus-within:bg-white transition-all">
            <span className="text-gray-400 text-sm">🔍</span>
            <input
              ref={inputRef}
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchAddress()}
              placeholder="הכנס כתובת..."
              className="flex-1 bg-transparent text-sm focus:outline-none text-gray-700 placeholder-gray-400"
            />
          </div>
          <button
            onClick={searchAddress}
            disabled={geoLoading}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {geoLoading ? "..." : "חפש"}
          </button>
          <button
            onClick={useMyLocation}
            disabled={geoLoading}
            title="מיקום נוכחי"
            className="bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-xl text-sm disabled:opacity-50 transition-colors border border-gray-200"
          >
            📍
          </button>
        </div>

        {/* Radius slider */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 shrink-0 w-10">רדיוס</span>
          <input
            type="range"
            min={1}
            max={30}
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            className="flex-1 accent-blue-600 h-1.5"
          />
          <span className="text-sm font-bold text-blue-600 w-14 text-center shrink-0 bg-blue-50 rounded-lg py-0.5">
            {radiusKm} ק״מ
          </span>
        </div>

        {error && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <span>⚠</span>{error}
          </p>
        )}
        {!center && !error && (
          <p className="text-xs text-gray-400 text-center pb-0.5">הכנס כתובת או לחץ 📍 כדי להתחיל</p>
        )}
      </header>

      {/* Legend */}
      <div className="flex gap-4 px-4 py-1.5 bg-white border-b border-gray-100 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />פנויה</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />לא ידוע</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />תפוסה</span>
        <span className="flex items-center gap-1.5 text-amber-500">★ הזולה ביותר</span>
      </div>

      {/* Map */}
      <main className="flex-1 relative overflow-hidden">
        <MapView filter={filter} provider={provider} center={center} radiusKm={radiusKm} />
      </main>
    </div>
  );
}
