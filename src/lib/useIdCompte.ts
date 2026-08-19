"use client";
import { useEffect, useState } from "react";

/**
 * L'identifiant du compte connecté, vu du navigateur.
 *
 * `undefined` tant qu'on ne sait pas encore, `null` si personne n'est
 * connecté. La distinction compte : les écrans de première visite doivent
 * attendre de savoir À QUI ils s'adressent, sinon ils décideraient sur la foi
 * d'une marque laissée par quelqu'un d'autre.
 *
 * Le serveur reste seul juge de l'identité — le navigateur ne fait que la lui
 * demander.
 */
export function useIdCompte(): string | null | undefined {
  const [uid, setUid] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let obsolete = false;
    fetch("/api/user")
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => { if (!obsolete) setUid(typeof u?.id === "string" ? u.id : null); })
      .catch(() => { if (!obsolete) setUid(null); });
    return () => { obsolete = true; };
  }, []);

  return uid;
}
