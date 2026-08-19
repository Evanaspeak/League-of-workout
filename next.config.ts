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
      // va.vercel-scripts.com : mesure d'audience. Sans cette autorisation le
      // script est bloqué en silence et aucune visite n'est comptée — on
      // croirait mesurer alors qu'on ne mesure rien.
      "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://ddragon.leagueoflegends.com",
      "font-src 'self' data:",
      "connect-src 'self' https://ddragon.leagueoflegends.com https://va.vercel-scripts.com https://vitals.vercel-insights.com",
      // Le service worker des notifications doit pouvoir s'enregistrer.
      "worker-src 'self'",
      "frame-ancestors 'none'",
      // Ces deux-là ne retombent PAS sur `default-src` (CSP niveau 3) : sans
      // les écrire, ils restent libres. `base-uri` empêche de réécrire la base
      // des URL relatives, `form-action` d'envoyer un formulaire ailleurs.
      "base-uri 'self'",
      "form-action 'self'",
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
