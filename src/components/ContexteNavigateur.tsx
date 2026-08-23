"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { estPagePublique } from "@/lib/pagesPubliques";

/**
 * Remonte vers le compte les deux choses que seul le navigateur connaît : la
 * langue affichée et le fuseau horaire.
 *
 * Elles vivaient uniquement côté navigateur, que le serveur ne voit pas. Les
 * notifications push partaient donc en français pour tout le monde, y compris
 * pour quelqu'un qui n'a jamais vu un écran français — et rien ne le
 * signalait, puisque celui qui écrit l'application la lit en français. Le
 * fuseau, lui, décide de l'heure à laquelle il est acceptable d'envoyer
 * quelque chose : sans lui, un rappel du matin réveille la moitié du monde.
 *
 * L'envoi ne part qu'une fois par valeur et par session : ni la langue ni le
 * fuseau ne changent souvent, et réécrire la même valeur à chaque page est
 * une requête de plus sur chaque chargement, pour rien.
 */
function fuseauDuNavigateur(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export function ContexteNavigateur() {
  const { locale } = useLocale();
  const pathname = usePathname();
  const envoye = useRef<string | null>(null);

  useEffect(() => {
    // Pas de compte sur une page publique : la route répondrait 401.
    if (estPagePublique(pathname)) return;
    const fuseau = fuseauDuNavigateur();
    const cle = `${locale}|${fuseau ?? ""}`;
    if (envoye.current === cle) return;
    envoye.current = cle;
    fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userPrefs: { langue: locale, ...(fuseau ? { fuseau } : {}) },
      }),
    }).catch(() => {
      // Hors ligne, ou session expirée : on retentera au prochain changement.
      envoye.current = null;
    });
  }, [locale, pathname]);

  return null;
}
