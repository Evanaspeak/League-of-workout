import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  {
    // 'unsafe-inline' requis : Next.js (App Router) injecte des scripts inline
    // pour le bootstrap/hydratation, et tout le projet utilise des style={{}}
    // inline (convention CLAUDE.md). Le CSP continue de bloquer le chargement
    // de scripts EXTERNES (le principal vecteur d'injection) via 'self'.
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://ddragon.leagueoflegends.com",
      "font-src 'self' data:",
      "connect-src 'self' https://ddragon.leagueoflegends.com",
      "frame-ancestors 'none'",
    ].join("; "),
  },
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
