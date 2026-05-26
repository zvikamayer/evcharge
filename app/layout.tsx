import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "vcharge — עמדות טעינה לרכב חשמלי",
  description: "מצא עמדות טעינה פנויות וזולות בקרבתך — EV-Edge, GreenSpot, CelloCharge ועוד",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#2563eb",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className="overscroll-none">{children}</body>
    </html>
  );
}
