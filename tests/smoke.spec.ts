/**
 * vcharge.co.il — Smoke & E2E Tests
 *
 * Run:  npx playwright test
 * UI:   npx playwright test --ui
 */
import { test, expect } from "@playwright/test";

const SEARCH_CITY = "כפר סבא";
const BOUNDS = "minLat=32.05&maxLat=32.35&minLng=34.75&maxLng=35.05";

/** Dismiss the welcome bubble by setting localStorage before the page loads. */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("vcharge_welcomed", "1");
  });
});

/** Wait for the loading spinner to appear then disappear. */
async function waitForLoad(page: import("@playwright/test").Page) {
  // Spinner should appear quickly
  await expect(page.locator("text=מחפש עמדות")).toBeVisible({ timeout: 8_000 });
  // All station details can take a while (especially cold-cache first call)
  await expect(page.locator("text=מחפש עמדות")).not.toBeVisible({ timeout: 120_000 });
}

// Default radius is 1 km — no need to change the slider in tests

/** Expand the collapsible header (needed to access provider filter buttons). */
async function expandHeader(page: import("@playwright/test").Page) {
  const toggle = page.locator("button", { hasText: "▼" }).or(
    page.locator("button", { hasText: "▲" })
  ).first();
  // Only expand if currently collapsed (shows ▼)
  if ((await toggle.textContent())?.trim() === "▼") {
    await toggle.click();
  }
}

// ─── API Health ────────────────────────────────────────────────────────────────

test.describe("API endpoints", () => {
  test("GreenSpot pins מחזיר מערך תקין", async ({ request }) => {
    const res = await request.get(`/api/gs/pins?${BOUNDS}`);
    expect(res.ok(), `status ${res.status()}`).toBeTruthy();
    const pins = await res.json();
    expect(Array.isArray(pins)).toBeTruthy();
    expect(pins.length).toBeGreaterThan(0);
    const pin = pins[0];
    expect(pin).toHaveProperty("geo");
    expect(pin).toHaveProperty("av");
  });

  test("CelloCharge pins מחזיר מערך תקין", async ({ request }) => {
    const res = await request.get(`/api/cello/pins?${BOUNDS}`);
    expect(res.ok(), `status ${res.status()}`).toBeTruthy();
    const pins = await res.json();
    expect(Array.isArray(pins)).toBeTruthy();
    expect(pins.length).toBeGreaterThan(0);
    const pin = pins[0];
    expect(pin).toHaveProperty("geo");
    expect(pin).toHaveProperty("source", "cellocharge");
  });

  test("CelloCharge providers מחזיר רשימת ספקים", async ({ request }) => {
    const res = await request.get("/api/cello/providers");
    expect(res.ok()).toBeTruthy();
    const providers = await res.json();
    expect(Array.isArray(providers)).toBeTruthy();
    expect(providers.length).toBeGreaterThan(0);
    expect(providers[0]).toHaveProperty("id");
    expect(providers[0]).toHaveProperty("name");
  });

  test("Geocode מחזיר קואורדינטות לכתובת", async ({ request }) => {
    const res = await request.get(
      `/api/geocode?q=${encodeURIComponent(SEARCH_CITY)}`
    );
    expect(res.ok(), `geocode failed with ${res.status()}`).toBeTruthy();
    const data = await res.json();
    expect(data).toHaveProperty("lat");
    expect(data).toHaveProperty("lng");
    // Kfar Saba is in Israel — rough bounds check
    expect(data.lat).toBeGreaterThan(31);
    expect(data.lat).toBeLessThan(33);
    expect(data.lng).toBeGreaterThan(34);
    expect(data.lng).toBeLessThan(36);
  });
});

// ─── Page Load ─────────────────────────────────────────────────────────────────

test.describe("טעינת האתר", () => {
  test("הדף נטען עם הכותרת הנכונה", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/vcharge/i);
    await expect(page.locator("h1")).toContainText("עמדות טעינה");
  });

  test("כפתורי פילטר הכל/פנויות גלויים תמיד", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "הכל" })).toBeVisible();
    await expect(page.getByRole("button", { name: /פנויות/ })).toBeVisible();
  });

  test("שדה חיפוש גלוי עם placeholder", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.locator("input[placeholder='הכנס כתובת...']")
    ).toBeVisible();
  });

  test("כפתור i מוצג על המפה", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.locator("button[title='מידע ויצירת קשר']")
    ).toBeVisible();
  });
});

// ─── Search Flow ───────────────────────────────────────────────────────────────

test.describe("חיפוש כתובת", () => {
  test("חיפוש מציג ספינר ואחר כך טבלת תחנות", async ({ page }) => {
    await page.goto("/");

    await page.fill("input[placeholder='הכנס כתובת...']", SEARCH_CITY);
    await page.click("button:has-text('חפש')");
    await waitForLoad(page);
    await expect(page.locator("text=תחנות בטווח")).toBeVisible({ timeout: 5_000 });
  });

  test("טבלת תחנות מכילה לפחות תחנה אחת עם מחיר", async ({ page }) => {
    await page.goto("/");

    await page.fill("input[placeholder='הכנס כתובת...']", SEARCH_CITY);
    await page.click("button:has-text('חפש')");
    await waitForLoad(page);
    // At least one price in ₪
    await expect(page.locator("text=₪").first()).toBeVisible({ timeout: 5_000 });
  });

  test("Enter בשדה החיפוש מפעיל חיפוש", async ({ page }) => {
    await page.goto("/");
    await page.fill("input[placeholder='הכנס כתובת...']", SEARCH_CITY);
    await page.press("input[placeholder='הכנס כתובת...']", "Enter");
    await expect(page.locator("text=מחפש עמדות")).toBeVisible({ timeout: 8_000 });
  });

  test("Header מתקפל אחרי חיפוש", async ({ page }) => {
    await page.goto("/");
    await page.fill("input[placeholder='הכנס כתובת...']", SEARCH_CITY);
    await page.click("button:has-text('חפש')");
    // After search, header collapses → address shown as chip
    await expect(
      page.locator("input[placeholder='הכנס כתובת...']")
    ).not.toBeVisible({ timeout: 5_000 });
  });
});

// ─── Filters ───────────────────────────────────────────────────────────────────

test.describe("פילטרים", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");

    await page.fill("input[placeholder='הכנס כתובת...']", SEARCH_CITY);
    await page.click("button:has-text('חפש')");
    await waitForLoad(page);
    // Header collapses after search — re-expand to access provider buttons
    await expandHeader(page);
  });

  test("לחיצה על GreenSpot מסנן לספק", async ({ page }) => {
    const btn = page.getByRole("button", { name: /GreenSpot/ });
    await expect(btn).toBeVisible({ timeout: 5_000 });
    await btn.click();
    await expect(btn).toHaveClass(/bg-blue-600/);
  });

  test("לחיצה שנייה על ספק מחזיר ל-כל החברות", async ({ page }) => {
    const btn = page.getByRole("button", { name: /GreenSpot/ });
    await btn.click();
    await expect(btn).toHaveClass(/bg-blue-600/);
    await btn.click();
    await expect(btn).not.toHaveClass(/bg-blue-600/);
  });

  test("פילטר פנויות עובד", async ({ page }) => {
    const btn = page.getByRole("button", { name: /פנויות/ });
    await btn.click();
    await expect(btn).toHaveClass(/bg-emerald-500/);
  });
});

// ─── Table Controls ────────────────────────────────────────────────────────────

test.describe("פקדי טבלה", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");

    await page.fill("input[placeholder='הכנס כתובת...']", SEARCH_CITY);
    await page.click("button:has-text('חפש')");
    await waitForLoad(page);
    await expect(page.locator("text=תחנות בטווח")).toBeVisible();
  });

  test("מיון לפי מרחק מסמן את הכפתור", async ({ page }) => {
    await page.click("button:has-text('מרחק')");
    await expect(page.getByRole("button", { name: "מרחק" })).toHaveClass(/bg-blue-600/);
  });

  test("סינון DC מסנן לתחנות מהירות", async ({ page }) => {
    const dcBtn = page.getByRole("button", { name: /DC מהיר/ });
    await dcBtn.click();
    await expect(dcBtn).toHaveClass(/bg-orange-500/);
  });

  test("קיפול הטבלה עובד", async ({ page }) => {
    // Table header is clickable to collapse
    await page.locator("h3:has-text('תחנות בטווח')").click();
    // After collapse, station rows should be hidden
    await expect(page.locator("text=₪").first()).not.toBeVisible({ timeout: 3_000 });
  });
});

// ─── Info Modal ────────────────────────────────────────────────────────────────

test.describe("מודאל מידע", () => {
  test("לחיצה על i פותחת מודאל", async ({ page }) => {
    await page.goto("/");
    await page.click("button[title='מידע ויצירת קשר']");
    await expect(page.locator("text=vcharge.co.il")).toBeVisible();
  });

  test("טאב אודות מציג הגבלת אחריות", async ({ page }) => {
    await page.goto("/");
    await page.click("button[title='מידע ויצירת קשר']");
    await page.click("button:has-text('אודות')");
    await expect(page.locator("text=הגבלת אחריות")).toBeVisible();
  });

  test("סגירת מודאל עם X", async ({ page }) => {
    await page.goto("/");
    await page.click("button[title='מידע ויצירת קשר']");
    await expect(page.locator("text=vcharge.co.il")).toBeVisible();
    await page.click("button:has-text('✕')");
    await expect(page.locator("text=vcharge.co.il")).not.toBeVisible();
  });
});
