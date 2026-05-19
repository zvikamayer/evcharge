"use client";
import { LocationDetail } from "@/lib/api";

function speedLabel(maxPower: number) {
  if (maxPower >= 50000) return { label: "מהיר מאוד", color: "bg-green-100 text-green-800" };
  if (maxPower >= 22000) return { label: "מהיר", color: "bg-blue-100 text-blue-800" };
  return { label: "רגיל", color: "bg-gray-100 text-gray-700" };
}

function statusColor(status: string) {
  if (status === "available") return "bg-green-500";
  if (status === "charging") return "bg-yellow-500";
  return "bg-red-400";
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

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl p-4 max-h-[70vh] overflow-y-auto md:absolute md:top-4 md:left-4 md:right-auto md:bottom-auto md:rounded-xl md:w-80">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h2 className="font-bold text-lg leading-tight">{loc.name}</h2>
          <p className="text-sm text-gray-500">{loc.address}</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
      </div>

      <div className="flex gap-2 mb-4">
        <span className="text-sm font-medium px-2 py-1 rounded-full bg-green-50 text-green-700">
          {available}/{allEvses.length} פנויים
        </span>
      </div>

      <div className="space-y-2">
        {allEvses.map((evse) => {
          const tariff = tariffMap[evse.tariffId];
          const speed = speedLabel(evse.maxPower);
          return (
            <div key={evse.id} className="flex items-center justify-between p-2 rounded-lg border border-gray-100">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${statusColor(evse.status)}`} />
                <span className="text-sm font-medium">{(evse.maxPower / 1000).toFixed(0)} kW</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${speed.color}`}>{speed.label}</span>
                <span className="text-xs text-gray-400 uppercase">{evse.currentType}</span>
              </div>
              {tariff?.priceForEnergy != null && (
                <span className="text-sm font-bold text-blue-700">
                  ₪{tariff.priceForEnergy.toFixed(2)}/kWh
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
