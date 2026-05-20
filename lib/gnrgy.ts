// ============================================================================
// Gnrgy (ג'ינרג'י) provider — placeholder adapter
// ============================================================================
// This module is a *placeholder* for an eventual live integration with
// Gnrgy's public mobile API. It is intentionally minimal and safe:
//
//   * getGnrgyPins(...)   - always resolves to an empty array.
//   * getGnrgyLocation(.) - always resolves to an empty LocationDetail shape.
//
// The placeholder is wired into the provider filter UI on the homepage so
// that the new "Gnrgy" tab is visible, but selecting it shows zero pins on
// the map. No fetch is attempted, so there is no risk of the site breaking
// or hanging on a non-existent endpoint.
//
// HOW TO FULLY ENABLE IN THE FUTURE
// ----------------------------------------------------------------------------
// 1. Discover Gnrgy's mobile API base URL by capturing the requests its
//    "Gnrgy Go" mobile app makes. The package IDs are:
//      - Android: gnrgy.android.emobilityapp
//      - iOS:     id1107590624
// 2. Implement getGnrgyPins and getGnrgyLocation against that endpoint.
// 3. Add a corresponding route under app/api/gnrgy/station/[id]/route.ts
//    and update components/MapView.tsx to fetch the new provider in parallel
//    with EV Edge and GreenSpot.
// 4. Run `npm run build` and confirm a clean tsc pass before deploying.
//
// FILE-SIZE NOTE
// ----------------------------------------------------------------------------
// In this sandbox we have observed Write operations that fail to truncate
// the target file when shrinking it. Keeping this placeholder verbose helps
// ensure future overwrites do not leave null-byte padding at the tail of the
// file, which TypeScript would otherwise flag as invalid characters.
// ============================================================================

import type { Pin, LocationDetail } from "./api";

export const GNRGY_DISABLED = true as const;

export async function getGnrgyPins(
  _minLat?: number,
  _maxLat?: number,
  _minLng?: number,
  _maxLng?: number,
): Promise<Pin[]> {
  return [];
}

export async function getGnrgyLocation(_id?: number): Promise<LocationDetail> {
  return { locations: [], tariffs: [] };
}
