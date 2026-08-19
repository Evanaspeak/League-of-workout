"use client";
import { useEffect, useState } from "react";

/**
 * La clé sous laquelle ce compte range ses marques de première visite.
 *
 * `undefined` tant qu'on ne sait pas encore, `null` si personne n'est connecté.
 * La distinction compte : les écrans de première visite doivent attendre de
 * savoir À QUI ils s'adressent, sinon ils décideraient sur la foi d'une marque
 * laissée par quelqu'un d'autre.
 *
 * La clé porte aussi la génération d'intro. Elle vient du compte, si bien qu'un
 * administrateur peut rendre les marques caduques sans avoir accès au
 * navigateur de l'intéressé : la clé change, et l'intro rejoue.
 *
 * Le serveur reste seul juge de l'identité — le navigateur ne fait que la lui
 * demander.
 */
export function useIdCompte(): string | null | undefined {
  const [cle, setCle] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let obsolete = false;
    fetch("/api/user")
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => {
        if (obsolete) return;
        if (typeof u?.id !== "string") { setCle(null); return; }
        const generation = typeof u.introGeneration === "number" ? u.introGeneration : 0;
        setCle(generation > 0 ? `${u.id}#${generation}` : u.id);
      })
      .catch(() => { if (!obsolete) setCle(null); });
    return () => { obsolete = true; };
  }, []);

  return cle;
}
