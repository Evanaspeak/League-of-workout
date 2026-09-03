import "dotenv/config";
import { Client } from "pg";

/**
 * Lire la base depuis un parcours navigateur.
 *
 * Chaque contrôle regarde l'écran ET la base : sans le second, un écran qui se
 * contente d'afficher ce qu'on vient de taper passerait le test. C'est le
 * client `pg` et non Prisma, comme dans `limiteur.ts` — le client engendré
 * demande une configuration qui n'a rien à faire dans un fichier de test, et
 * une requête écrite en clair dit exactement ce qu'elle vérifie.
 */
export async function requeteSql<T = Record<string, unknown>>(
  sql: string,
  valeurs: unknown[] = [],
): Promise<T[]> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL absente : le contrôle en base ne peut pas se faire.");
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    const res = await client.query(sql, valeurs);
    return res.rows as T[];
  } finally {
    await client.end().catch(() => {});
  }
}

/** Combien de lignes la requête rend. Un `count(*)` de PostgreSQL est une chaîne. */
export async function compter(sql: string, valeurs: unknown[] = []): Promise<number> {
  const [ligne] = await requeteSql<{ n: string }>(sql, valeurs);
  return Number(ligne?.n ?? 0);
}
