/**
 * Energy One direct integration — wraps CelloCharge data for
 * the "Lishatech" and "LishatechCEL" provider IDs.
 *
 * Nayax (the backend platform) has no publicly accessible API,
 * so we serve CelloCharge data which already includes real prices.
 */
import type { Pin } from "./api";
import { fetchAllCelloLocations } from "./cellocharge";

const PROVIDER_IDS = new Set(["Lishatech", "LishatechCEL"]);

let cachedPins: Pin[] | null = null;
let cacheTs = 0;
const PINS_TTL_MS = 60_000;

export async function getEnergyOnePins(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
): Promise<Pin[]> {
  const now = Date.now();
  if (!cachedPins || now - cacheTs > PINS_TTL_MS) {
    const all = await fetchAllCelloLocations();
    cachedPins = all
      .filter((loc) => PROVIDER_IDS.has(loc.providerId))
      .map((loc): Pin => {
        // CelloCharge includes maxPower (kW) in connectorsSummary at runtime
        const maxPowerKw =
          (loc.connectorsSummary as { total: number; available: number; occupied?: number; maxPower?: number })
            .maxPower ?? 0;
        const chargeType =
          maxPowerKw > 22 ? ("dc" as const) : maxPowerKw > 0 ? ("ac" as const) : undefined;
        return {
          id: loc.id,
          source: "cellocharge" as const,
          providerName: "Energy One",
          providerId: "energyone",
          geo: `${loc.coordinates.lat},${loc.coordinates.lng}`,
          av: {
            ava: loc.connectorsSummary.available,
            occ: loc.connectorsSummary.occupied ?? 0,
            unk: Math.max(
              0,
              loc.connectorsSummary.total -
                loc.connectorsSummary.available -
                (loc.connectorsSummary.occupied ?? 0),
            ),
          },
          inlineData: {
            name: loc.name,
            address: `${loc.address}${loc.city ? ", " + loc.city : ""}`,
            pricePerKwh:
              (loc.tariffsSummary.maxPerKwh ?? 0) > 0 ? loc.tariffsSummary.maxPerKwh : null,
            total: loc.connectorsSummary.total || 1,
            chargeType,
          },
        };
      });
    cacheTs = now;
  }

  return cachedPins!.filter((p) => {
    const [lat, lng] = p.geo.split(",").map(Number);
    return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
  });
}
