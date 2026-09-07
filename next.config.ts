import type { NextConfig } from "next";

const securityHeaders = [
  // Prevents the site being framed by another origin (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // Stops the browser guessing content types away from what we declare.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak the full referring URL (which can contain tokens/ids) to other origins.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Only the camera is used (photo upload); deny everything else by default.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(self)" },
  // Force HTTPS for a year, including subdomains — this is a payments app.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
