-- Ce qu'un ami a le droit de voir : "total" (défaut) ou "detail".
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "partageAmis" TEXT NOT NULL DEFAULT 'total';
