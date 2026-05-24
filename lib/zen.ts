// ============================================================================
// ZEN Energy integration — REVERTED to placeholder
// ============================================================================
// This file was originally created as part of a speculative integration with
// ZEN Energy's charging station network. The integration attempt has been
// reverted because the API endpoint could not be verified from the build
// environment. The placeholder below preserves the module's existence so that
// the no-op route handlers under app/api/zen/* can continue to compile, while
// the integration itself remains functionally disabled.
//
// ROLLBACK CONTEXT (for future maintainers)
// ----------------------------------------------------------------------------
// - The original integration assumed ZEN Energy would expose a Driivz-style
//   public mobile API at one of the following base URLs (analogous to the
//   pattern used by EV Edge's cp.evedge.co.il/api/v1/app):
//     * https://cp.zen-ev.com/api/v1/app
//     * https://mobile.zen-ev.com/api/v1/app
//     * https://app.zen-ev.com/api/v1/app
//   None of these were confirmed at the time of the rollback.
// - To re-enable the integration in the future:
//     1. Confirm the working base URL using a real network probe.
//     2. Restore the live implementation of getZenPins and getZenLocation.
//     3. Re-wire the provider filter in app/page.tsx and the MapView so the
//        ZEN provider appears in the UI and contributes pins on the map.
//     4. Run `npm run build` and verify a clean tsc pass before deploying.
// - The git safety tag captured immediately before this experiment was named
//   safe-before-agent-update-YYYYMMDD-HHMMSS. Use `git tag --list 'safe-*'`
//   to discover the most recent safety tag if a rollback is ever required.
//
// FILE-SIZE NOTE
// ----------------------------------------------------------------------------
// This module is intentionally verbose to ensure its on-disk size matches or
// exceeds any prior version of this file. Some Write operations in our build
// environment have been observed not to truncate files, leaving null-byte
// padding at the end when a shorter file replaces a longer one. By keeping
// the placeholder content reasonably long, we avoid that failure mode and
// keep the file as clean ASCII source.
// ============================================================================

import type { Pin, LocationDetail } from "./api";

export const ZEN_DISABLED = true as const;
export type ZenDisabled = typeof ZEN_DISABLED;

// Intentional no-op functions to satisfy any stale imports without crashing.
// Their signatures match what a real ZEN Energy adapter would expose, so that
// re-enabling the integration only requires swapping these implementations.

export async function getZenPins(
  _minLat?: number,
  _maxLat?: number,
  _minLng?: number,
  _maxLng?: number,
): Promise<Pin[]> {
  return [];
}

export async function getZenLocation(_id?: number): Promise<LocationDetail> {
  return { locations: [], tariffs: [] };
}

export function isZenPinId(_id: number): boolean {
  return false;
}
