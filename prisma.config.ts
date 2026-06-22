// Configuration Prisma (Prisma 7).
// L'URL de connexion vit ici (et non plus dans le schema).
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Utilisée par la CLI pour les migrations : on privilégie la connexion
    // DIRECTE (Supabase port 5432) car pgBouncer ne supporte pas les migrations.
    // Le runtime de l'app, lui, utilise DATABASE_URL (poolée) via l'adapter.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
