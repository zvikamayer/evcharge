import type { Pin } from "./api";
import { getEvmapPins } from "./evmap-provider";

const BASE = "https://account.sonolevi.co.il";

export async function getSonolEviPins(
  minLat: number, maxLat: number, minLng: number, maxLng: number,
): Promise<Pin[]> {
  return getEvmapPins(BASE, "sonolevi", "SonolEvi", minLat, maxLat, minLng, maxLng);
}
