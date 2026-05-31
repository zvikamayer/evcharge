import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #3b82f6 0%, #1e3a8a 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 36,
        }}
      >
        <svg width="110" height="110" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
          <path d="M275 50 L145 278 L238 278 L200 462 L360 234 L268 234 Z" fill="white" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
