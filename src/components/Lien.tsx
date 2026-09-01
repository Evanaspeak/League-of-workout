"use client";
import Link from "next/link";
import type { ComponentProps } from "react";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { avecLocale } from "@/lib/i18n/cheminLocalise";

/**
 * Un lien interne, dans la langue de la page.
 *
 * Depuis que la langue vit dans l'adresse, un `href="/cgu"` écrit tel quel
 * renvoie sur une adresse sans langue : le middleware la rattrape et redirige,
 * mais vers la langue NÉGOCIÉE, pas vers celle qu'on était en train de lire.
 * Quelqu'un qui lit l'application en japonais et clique sur « conditions »
 * changerait de langue au passage, sans rien avoir demandé.
 *
 * Le composant est client pour lire la langue du contexte, ce qui ne l'empêche
 * pas d'être rendu depuis une page serveur.
 *
 * `avecLocale` laisse tranquille tout ce qui ne prend pas de préfixe : les
 * routes d'API, l'adresse de diffusion, les fichiers. `/api/user/export` et
 * `/api/bilan/image` sont deux liens de cette page, et les préfixer les
 * casserait.
 *
 * `src/liensLocalises.test.ts` refuse `next/link` partout ailleurs : un seul
 * import direct suffirait à rouvrir le trou, et rien ne le signalerait — le
 * lien marcherait, il changerait juste de langue.
 */
export function Lien({ href, ...reste }: ComponentProps<typeof Link>) {
  const { locale } = useLocale();
  const cible = typeof href === "string" && href.startsWith("/")
    ? avecLocale(href, locale)
    : href;
  return <Link href={cible} {...reste} />;
}
