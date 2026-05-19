import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "עמדות טעינה | EV Edge",
  description: "מצא עמדות טעינה פנויות וזולות בקרבתך",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
