"use client";
import { LocationDetail } from "@/lib/api";

function speedLabel(maxPower: number) {
  if (maxPower >= 50000) return { label: "טעינה מהירה מאוד", color: "bg-emerald-100 text-emerald-700" };
  if (maxPower >= 22000) return { label: "טעינה מהירה", color: "bg-blue-100 text-blue-700" };
  return { label: "טעינה רגילה", color: "bg-gray-100 text-gray-600" };
}

function statusDot(status: string) {
  if (status === "available") return "bg-emerald-500";
  if (status === "charging") return "bg-amber-400";
  return "bg-red-400";
}

function statusLabel(status: string) {
  if (status === "available") return "פנוי";
  if (status === "charging") return "בטעינה";
  return "לא זמין";
}

export default function StationCard({
  detail,
  onClose,
}: {
  detail: LocationDetail;
  onClose: () => void;
}) {
  const loc = detail.locations[0];
  const tariffMap = Object.fromEntries(detail.tariffs.map((t) => [t.id, t]));
  const allEvses = loc.zones.flatMap((z) => z.evses);
  const available = allEvses.filter((e) => e.isAvailable).length;
  const [lat, lng] = loc.location.split(",").map(Number);
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  const wazeUrl = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[75vh] overflow-y-auto md:absolute md:top-4 md:left-4 md:right-auto md:bottom-auto md:rounded-2xl md:w-84 md:max-h-[85vh]">
      {/* Drag handle (mobile) */}
      <div className="flex justify-center pt-3 pb-1 md:hidden">
        <div className="w-10 h-1 bg-gray-200 rounded-full" />
      </div>

      {/* Header */}
      <div className="px-4 pt-2 pb-3 border-b border-gray-100">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-base text-gray-900 leading-snug">{loc.name}</h2>
            <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1">
              <span>📍</span>{loc.address}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors shrink-0 text-xl"
          >
            ×
          </button>
        </div>

        {/* Availability badge */}
        <div className="mt-2 flex items-center gap-2">
          <span className={`text-sm font-semibold px-3 py-1 rounded-full ${available > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
            {available}/{allEvses.length} פנויים
          </span>
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="px-4 py-3 flex gap-2 border-b border-gray-100">
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-50 text-blue-700 text-sm font-semibold hover:bg-blue-100 transition-colors"
        >
          🗺 Google Maps
        </a>
        <a
          href={wazeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-sky-50 text-sky-700 text-sm font-semibold hover:bg-sky-100 transition-colors"
        >
          🔵 Waze
        </a>
      </div>

      {/* Chargers list */}
      <div className="px-4 py-3 space-y-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">עמדות טעינה</p>
        {allEvses.map((evse) => {
          const tariff = tariffMap[evse.tariffId];
          const speed = speedLabel(evse.maxPower);
          return (
            <div key={evse.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-2.5">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusDot(evse.status)}`} />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-gray-800">{(evse.maxPower / 1000).toFixed(0)} kW</span>
                    <span className="text-xs text-gray-400 uppercase">{evse.currentType}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${speed.color}`}>{speed.label}</span>
                    <span className={`text-xs ${evse.isAvailable ? "text-emerald-600" : "text-gray-400"}`}>{statusLabel(evse.status)}</span>
                  </div>
                </div>
              </div>
              {tariff?.priceForEnergy != null && tariff.priceForEnergy > 0 && (
                <div className="text-right">
                  <span className="text-base font-bold text-blue-600">₪{tariff.priceForEnergy.toFixed(2)}</span>
                  <div className="text-xs text-gray-400">/kWh</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
