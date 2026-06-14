"use client";
import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import type { CelloProvider } from "@/lib/cellocharge";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

// Fixed center of Israel used for national-provider-view fetches
const IL_CENTER = { lat: 31.5, lng: 34.8 };

const STATIC_PROVIDERS = [
  { id: "evedge", label: "EV-Edge" },
  { id: "greenspot", label: "GreenSpot" },
  { id: "afcon", label: "ON-EV" },
  { id: "sonolevi", label: "SonolEvi" },
  { id: "scala", label: "Scala" },
  { id: "zenev", label: "Zen Energy" },
  { id: "energyone", label: "Energy One" },
];

export default function Home() {
  const [filter, setFilter] = useState("all");
  const [provider, setProvider] = useState("all");
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState(1);
  // nationalMode = show ALL stations of selected provider across Israel (no radius)
  const [nationalMode, setNationalMode] = useState(false);
  const [address, setAddress] = useState("");
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError] = useState("");
  const [celloProviders, setCelloProviders] = useState<CelloProvider[]>([]);
  const [pinCounts, setPinCounts] = useState<Record<string, number>>({});
  const [showInfo, setShowInfo] = useState(false);
  const [infoTab, setInfoTab] = useState<"contact" | "about">("contact");
  const [headerExpanded, setHeaderExpanded] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!localStorage.getItem("vcharge_welcomed")) {
      setShowWelcome(true);
    }
  }, []);

  const dismissWelcome = () => {
    localStorage.setItem("vcharge_welcomed", "1");
    setShowWelcome(false);
  };

  useEffect(() => {
    fetch("/api/cello/providers")
      .then((r) => r.json())
      .then(setCelloProviders)
      .catch(() => {});
  }, []);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError("הדפדפן שלך לא תומך בשירותי מיקום");
      return;
    }
    setGeoLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setAddress("המיקום שלי");
        setNationalMode(false);
        setGeoLoading(false);
        setHeaderExpanded(false);
      },
      (err) => {
        let msg = "לא ניתן לקבל מיקום — נסה שוב";
        if (err.code === 1) msg = "הרשאת מיקום נדחתה — אפשר מיקום בהגדרות הדפדפן";
        else if (err.code === 2) msg = "לא ניתן לאתר מיקום — נסה בחוץ או עם WiFi";
        else if (err.code === 3) msg = "פג זמן הבקשה — נסה שוב";
        setError(msg);
        setGeoLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,      // 10 שניות — מונע תקיעה על אנדרואיד
        maximumAge: 30000,   // מיקום שמור עד 30 שניות מקביל
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
    setNationalMode(false);
    setGeoLoading(false);
    setHeaderExpanded(false);
  };

  const allProviders = [
    { id: "all", label: "כל החברות" },
    ...STATIC_PROVIDERS,
    ...celloProviders.map((p) => ({ id: p.id, label: p.name })),
  ];

  /** Toggle a provider. When switching to a specific provider with no location → national mode. */
  const handleProviderClick = (id: string) => {
    const next = provider === id && id !== "all" ? "all" : id;
    setProvider(next);
    if (next === "all") {
      setNationalMode(false);
      // If we were in national mode (center was IL_CENTER, no real user location),
      // reset to the initial "pick a location" state so the map isn't stuck.
      if (nationalMode) {
        setCenter(null);
        setAddress("");
        setHeaderExpanded(true);
      }
    } else if (!center || nationalMode) {
      // No real location (or switching between national-mode providers) → stay national
      setNationalMode(true);
      setCenter(IL_CENTER);
      setAddress("כל ישראל");
    }
  };

  return (
    <div className="flex flex-col bg-gray-100" style={{ height: "100dvh" }} dir="rtl">
      {/* Header */}
      <header className="bg-white shadow-md z-10">
        {/* Always-visible title row */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="bg-blue-600 text-white rounded-xl p-1.5 leading-none text-base shrink-0">⚡</div>
            <h1 className="text-base font-bold text-gray-800 leading-tight truncate">עמדות טעינה</h1>
            {center && !headerExpanded && (
              <span className="text-xs text-gray-400 truncate hidden sm:block">{address}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setFilter("all")}
              className={`px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all ${filter === "all" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-500"}`}
            >
              הכל
            </button>
            <button
              onClick={() => setFilter("available")}
              className={`px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all ${filter === "available" ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-500"}`}
            >
              ✓ פנויות
            </button>
            <button
              onClick={() => setHeaderExpanded((v) => !v)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-xs"
            >
              {headerExpanded ? "▲" : "▼"}
            </button>
          </div>
        </div>

        {/* Collapsible section */}
        {headerExpanded && (
          <div className="px-3 pb-2.5 space-y-2 border-t border-gray-50">
            {/* Provider filters */}
            <div className="flex gap-1.5 overflow-x-auto pt-2 pb-0.5 scrollbar-hide">
              {allProviders.map(({ id, label }) => {
                const count = pinCounts[id];
                return (
                  <button
                    key={id}
                    onClick={() => handleProviderClick(id)}
                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-all border shrink-0 ${
                      provider === id
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : "bg-white text-gray-500 border-gray-200"
                    }`}
                  >
                    {label}
                    {count != null && count > 0 && (
                      <span className={`text-[10px] font-semibold px-1 rounded-full ${
                        provider === id ? "bg-white/20 text-white" : "bg-gray-100 text-gray-400"
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
              {/* National-mode toggle — only shown when a specific provider is selected */}
              {provider !== "all" && (
                <button
                  onClick={() => {
                    if (nationalMode) {
                      setNationalMode(false);
                    } else {
                      setNationalMode(true);
                      setCenter(IL_CENTER);
                      setAddress("כל ישראל");
                    }
                  }}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-all border shrink-0 ${
                    nationalMode
                      ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                      : "bg-white text-amber-600 border-amber-300"
                  }`}
                >
                  🗺 כל ישראל
                </button>
              )}
            </div>

            {/* Search row — RTL order: input (right) → חפש → 📍 (left) */}
            <div className="flex gap-2 overflow-hidden">
              <div className="flex flex-1 min-w-0 items-center gap-1 bg-white rounded-xl px-3 border-2 border-gray-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-sm" style={{ minHeight: "44px" }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchAddress()}
                  placeholder="הכנס כתובת..."
                  className="flex-1 min-w-0 bg-transparent focus:outline-none text-gray-700 placeholder-gray-400"
                  style={{ fontSize: "16px" }}
                />
                <span className="text-gray-400 text-sm shrink-0">🔍</span>
              </div>
              <button
                onClick={searchAddress}
                disabled={geoLoading}
                className="shrink-0 bg-blue-600 text-white px-4 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
                style={{ minHeight: "44px" }}
              >
                {geoLoading ? "..." : "חפש"}
              </button>
              <button
                onClick={useMyLocation}
                disabled={geoLoading}
                title="מיקום נוכחי"
                className="shrink-0 bg-white border-2 border-gray-300 rounded-xl w-11 flex items-center justify-center text-xl hover:bg-blue-50 disabled:opacity-50 transition-colors shadow-sm"
                style={{ minHeight: "44px" }}
              >
                {geoLoading ? "⏳" : "📍"}
              </button>
            </div>

            {/* Radius slider */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 shrink-0">רדיוס</span>
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

            {error && <p className="text-xs text-red-500 flex items-center gap-1"><span>⚠</span>{error}</p>}
            {!center && !error && (
              <p className="text-xs text-gray-400 text-center">הכנס כתובת או לחץ 📍 כדי להתחיל</p>
            )}
          </div>
        )}

        {/* Legend — compact, always visible */}
        <div className="flex gap-3 px-3 py-1.5 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 overflow-x-auto scrollbar-hide">
          <span className="flex items-center gap-1 shrink-0"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />פנויה</span>
          <span className="flex items-center gap-1 shrink-0"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />תפוסה</span>
          <span className="flex items-center gap-1 shrink-0 text-amber-500">★ הזולה ביותר</span>
        </div>
      </header>

      {/* Map */}
      <main className="flex-1 relative overflow-hidden">
        <MapView
          filter={filter}
          provider={provider}
          center={center}
          radiusKm={radiusKm}
          nationalMode={nationalMode}
          onPinCounts={setPinCounts}
          onCenterChange={(newCenter) => {
            setCenter(newCenter);
            setAddress("מיקום מותאם");
            setNationalMode(false);
          }}
        />

        {/* Info button */}
        <button
          onClick={() => setShowInfo(true)}
          className="absolute bottom-4 right-4 z-[2000] w-9 h-9 rounded-full bg-white shadow-lg border border-gray-200 flex items-center justify-center text-blue-600 font-bold text-base hover:bg-blue-50 transition-colors"
          title="מידע ויצירת קשר"
        >
          i
        </button>

        {/* Info modal */}
        {showInfo && (
          <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-black/40" onClick={() => setShowInfo(false)}>
            <div
              className="bg-white rounded-2xl shadow-2xl mx-4 w-full max-w-sm text-right overflow-hidden"
              dir="rtl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <button onClick={() => setShowInfo(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
                <h2 className="font-bold text-gray-800 text-base">⚡ vcharge.co.il</h2>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-100 px-5">
                <button
                  onClick={() => setInfoTab("contact")}
                  className={`flex-1 py-2 text-sm font-semibold border-b-2 transition-colors ${infoTab === "contact" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-400"}`}
                >
                  צור קשר
                </button>
                <button
                  onClick={() => setInfoTab("about")}
                  className={`flex-1 py-2 text-sm font-semibold border-b-2 transition-colors ${infoTab === "about" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-400"}`}
                >
                  אודות
                </button>
              </div>

              <div className="p-5">
                {infoTab === "contact" ? (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-500 mb-3">לתגובות, הצעות לשיפור או דיווח על תקלות:</p>
                    <div className="flex items-center gap-3">
                      <span className="text-lg">👤</span>
                      <span className="text-sm font-semibold text-gray-700">צביקה מאייר</span>
                    </div>
                    <a href="mailto:vcharge.info@gmail.com" className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors">
                      <span className="text-lg">📧</span>
                      <span className="text-sm text-blue-700 font-medium">vcharge.info@gmail.com</span>
                    </a>
                  </div>
                ) : (
                  <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
                    <p>
                      <span className="font-semibold text-gray-800">vcharge.co.il</span> הוא שירות עצמאי לאיתור ומציאת עמדות טעינה לרכב חשמלי בישראל. האתר מרכז מידע ממקורות שונים לנוחות המשתמש בלבד ואינו קשור, שותף או מייצג את חברות הטעינה המופיעות בו.
                    </p>
                    <div className="border-t border-gray-100 pt-3 space-y-2">
                      <p className="font-semibold text-gray-700 text-xs">הגבלת אחריות</p>
                      <p className="text-xs text-gray-500">
                        המידע המוצג באתר — לרבות מיקומי עמדות, מחירים, זמינות ומפרטים טכניים — מגיע ממקורות צד שלישי ועשוי להיות חלקי, שגוי או לא מעודכן. האתר <span className="font-semibold">אינו מתחייב</span> לנכונות המידע, לרציפות השירות, או לזמינות העמדות בפועל.
                      </p>
                      <p className="text-xs text-gray-500">
                        עמדות הטעינה מופעלות על ידי <span className="font-semibold">חברות צד שלישי בלבד</span>. האתר אינו אחראי לתקינות העמדות, לתנאי השימוש בהן, לגביית תשלומים, או לכל נזק ישיר, עקיף או תוצאתי שייגרם כתוצאה מהסתמכות על המידע באתר.
                      </p>
                      <p className="text-xs text-gray-400 pt-1">
                        השימוש באתר הוא על אחריות המשתמש בלבד ומהווה הסכמה מלאה לתנאים אלו.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Welcome bubble — shown only on first visit */}
      {showWelcome && (
        <div
          className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)" }}
          onClick={dismissWelcome}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-l from-blue-700 to-blue-500 px-6 pt-6 pb-5 text-white">
              <div className="flex items-center gap-3 mb-1">
                <div className="bg-white/20 rounded-xl p-2 text-xl leading-none">⚡</div>
                <h2 className="text-lg font-bold tracking-tight">ברוכים הבאים ל-vcharge</h2>
              </div>
              <p className="text-sm text-blue-100 leading-relaxed mt-2">
                מראה לך בזמן אמת אילו עמדות טעינה <span className="font-semibold text-white">פנויות עכשיו</span> בקרבתך — וכמה הן עולות.
              </p>
            </div>

            {/* Steps */}
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-2xl bg-blue-50 flex items-center justify-center text-lg shrink-0">📍</div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">הכנס כתובת או לחץ על המיקום שלך</p>
                  <p className="text-xs text-gray-400 mt-0.5">לחץ על הכפתור 📍 לאיתור אוטומטי</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-2xl bg-emerald-50 flex items-center justify-center text-lg shrink-0">🗺</div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">ראה עמדות על המפה בזמן אמת</p>
                  <p className="text-xs text-gray-400 mt-0.5">🟢 פנויה &nbsp;·&nbsp; 🔴 תפוסה &nbsp;·&nbsp; ★ הזולה ביותר</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-2xl bg-amber-50 flex items-center justify-center text-lg shrink-0">💰</div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">השווה מחירים בין כל הספקים</p>
                  <p className="text-xs text-gray-400 mt-0.5">הטבלה ממיינת אוטומטית לפי מחיר ומרחק</p>
                </div>
              </div>
            </div>

            {/* Button */}
            <div className="px-6 pb-6">
              <button
                onClick={dismissWelcome}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-2xl text-base transition-colors shadow-md shadow-blue-200"
              >
                בואו נמצא עמדה! ⚡
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
