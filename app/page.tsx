"use client";
import { useState, useRef } from "react";
import dynamic from "next/dynamic";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

export default function Home() {
  const [filter, setFilter] = useState("all");
  const [provider, setProvider] = useState("all");
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState(5);
  const [address, setAddress] = useState("");
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="flex flex-col h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <header className="bg-white shadow-sm px-4 py-3 z-10 space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-blue-700">⚡ עמדות טעינה</h1>
          <div className="flex gap-2 flex-wrap justify-end">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === "all" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}
            >
              הכל
            </button>
            <button
              onClick={() => setFilter("available")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === "available" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600"}`}
            >
              ✅ פנויות
            </button>
            <div className="w-px bg-gray-200 self-stretch" />
            <button
              onClick={() => setProvider("all")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${provider === "all" ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-600"}`}
            >
              כל החברות
            </button>
            <button
              onClick={() => setProvider("evedge")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${provider === "evedge" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}
            >
              EV-Edge
            </button>
            <button
              onClick={() => setProvider("greenspot")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${provider === "greenspot" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600"}`}
            >
              GreenSpot
            </button>
          </div>
        </div>

        {/* Search row */}
        <div className="flex gap-2">
          <div className="flex flex-1 gap-1">
            <input
              ref={inputRef}
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchAddress()}
              placeholder="הכנס כתובת..."
              className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              onClick={searchAddress}
              disabled={geoLoading}
              className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              חפש
            </button>
          </div>
          <button
            onClick={useMyLocation}
            disabled={geoLoading}
            title="מיקום נוכחי"
            className="bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg text-sm disabled:opacity-50"
          >
            📍
          </button>
        </div>

        {/* Radius slider */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 shrink-0">רדיוס:</span>
          <input
            type="range"
            min={1}
            max={30}
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            className="flex-1 accent-blue-600"
          />
          <span className="text-sm font-semibold text-blue-700 w-14 text-center shrink-0">
            {radiusKm} ק"מ
          </span>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}
        {!center && (
          <p className="text-xs text-gray-400">הכנס כתובת או לחץ 📍 כדי להתחיל</p>
        )}
      </header>

      {/* Legend */}
      <div className="flex gap-4 px-4 py-2 bg-white border-b text-xs text-gray-600">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> פנויה</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" /> לא ידוע</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-400 inline-block" /> תפוסה</span>
        <span className="flex items-center gap-1 text-yellow-500">★ הזולה ביותר</span>
      </div>

      {/* Map */}
      <main className="flex-1 relative overflow-hidden">
        <MapView filter={filter} provider={provider} center={center} radiusKm={radiusKm} />
      </main>
    </div>
  );
}
