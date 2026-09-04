"use client";
import { createContext, useContext, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { estLocale, etiquetteLocale, type Locale } from "./langues";
import { avecLocale } from "./cheminLocalise";
import { ecrire } from "@/lib/stockage";

// La liste elle-même vit dans un module sans React : une route API qui valide
// une langue n'a pas à tirer tout le contexte avec elle. Réexportée ici, où
// une trentaine de composants la lisent déjà.
export { LANGUES, estLocale, etiquetteLocale, type Locale } from "./langues";

/**
 * La langue vient de l'ADRESSE, pas du stockage du navigateur.
 *
 * Elle a longtemps vécu dans `localStorage`, et ça se payait en silence :
 * le serveur rendait toujours la même version, donc les métadonnées de chaque
 * page partaient en français à tout le monde et `<html lang>` annonçait
 * « fr » à un lecteur d'écran japonais jusqu'à ce que le paquet JavaScript
 * s'exécute. Un moteur de recherche, lui, ne voyait jamais que le français.
 *
 * Le cookie reste, mais il ne décide plus rien à l'affichage : il sert au
 * middleware à savoir où envoyer quelqu'un qui arrive sur une adresse sans
 * langue. C'est un souvenir de choix, pas une source de vérité.
 */
const CLE_STOCKAGE = "low_locale";

type Ctx = { locale: Locale; setLocale: (l: Locale) => void };
const LocaleContext = createContext<Ctx | null>(null);

export function LocaleProvider({ locale, children }: { locale: string; children: React.ReactNode }) {
  const router = useRouter();
  const chemin = usePathname();
  // La mise en page refuse déjà un premier segment qui n'est pas une langue ;
  // le repli existe pour que le type soit honnête, pas pour rattraper un cas.
  const actuelle: Locale = estLocale(locale) ? locale : "en";

  const valeur = useMemo<Ctx>(() => ({
    locale: actuelle,
    setLocale: (l: Locale) => {
      // Une langue qu'on ne connaît pas ne s'écrit nulle part.
      //
      // Elle vient aujourd'hui du sélecteur, donc d'une liste fermée. Mais
      // cette valeur part maintenant dans un COOKIE, c'est-à-dire dans un
      // en-tête que le serveur relit : un point-virgule dans la chaîne y
      // ajouterait un attribut de son choix. Le contrôle coûte une ligne et
      // ferme la question, plutôt que de la rouvrir au prochain appelant.
      if (!estLocale(l)) return;
      // Le souvenir d'abord : sans lui, revenir sur `winorworkout.com` renverrait
      // vers la langue du navigateur, en ignorant le choix qu'on vient de faire.
      ecrire(CLE_STOCKAGE, l);
      // `secure` dès que la page est servie en HTTPS : un cookie posé en clair
      // repart en clair sur toutes les requêtes du domaine. Ce n'est pas un
      // secret, c'est de l'hygiène — et en local, où il n'y a pas de HTTPS,
      // l'attribut empêcherait simplement le cookie d'exister.
      const sur = location.protocol === "https:" ? ";secure" : "";
      document.cookie = `${CLE_STOCKAGE}=${l};path=/;max-age=31536000;samesite=lax${sur}`;
      // Puis l'adresse. `replace` et non `push` : changer de langue n'est pas
      // une étape de navigation, et le bouton retour ne doit pas ramener à la
      // page qu'on vient de quitter dans l'autre langue.
      router.replace(avecLocale(chemin || "/", l));
    },
  }), [actuelle, router, chemin]);

  return (
    <LocaleContext.Provider value={valeur}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}

/** Renvoie le dictionnaire de la langue active pour un namespace `{ fr: {...}, en: {...} }`. */
/**
 * Les textes du composant, dans la langue active.
 *
 * Le français et l'anglais sont exigés ; les quatre autres langues sont
 * facultatives et se remplissent dictionnaire par dictionnaire. Ce qui n'est
 * pas encore traduit retombe sur l'anglais, silencieusement et volontairement :
 * une phrase anglaise au milieu d'un écran espagnol se comprend, un
 * `undefined` ne se comprend pas.
 */
export function useT<T extends { fr: Record<string, unknown> }>(
  dict: T & { en: T["fr"] } & Partial<Record<Locale, T["fr"]>>,
): T["fr"] {
  const { locale } = useLocale();
  return (dict as Partial<Record<Locale, T["fr"]>>)[locale] ?? dict.en;
}

/** La même chose, pour un composant qui n'a pas la langue sous la main. */
export function useDateLocale(): string {
  const { locale } = useLocale();
  return etiquetteLocale(locale);
}

/**
 * Met un nombre en forme dans la langue de l'écran.
 *
 * `${n}` rend « 100000 » et `toFixed(2)` rend « 3.25 » — dans les six langues.
 * Or le français écrit « 100 000 » et « 3,25 », l'allemand « 100.000 », et
 * l'anglais « 100,000 ». Un point décimal en allemand n'est pas une coquetterie
 * de typographie : c'est le séparateur des MILLIERS, donc « 3.25 » s'y lit
 * comme trois mille deux cent cinquante.
 *
 * La règle vit ici et non dans les écrans, pour la même raison
 * qu'`enMinuscule` : c'est une propriété de la langue, pas de la mise en page.
 * Et elle vit une seule fois, parce que deux composants s'étaient déjà fabriqué
 * chacun son `Intl.NumberFormat`.
 */
export function useNombre(options?: Intl.NumberFormatOptions): (n: number) => string {
  const etiquette = useDateLocale();
  const format = new Intl.NumberFormat(etiquette, options);
  return (n) => format.format(n);
}

/**
 * Met un POURCENTAGE en forme dans la langue de l'écran.
 *
 * Le français veut une espace insécable devant le signe — « 33 % » — et
 * l'anglais n'en veut pas. Un « % » recollé à la main n'a qu'une règle, donc
 * il en a cinq de fausses. C'est le défaut déjà corrigé pour le bilan de
 * saison, et laissé partout ailleurs : le winrate du tableau de bord affichait
 * « 33% » en français.
 *
 * Elle prend un nombre de 0 à 100, comme on l'écrit et comme le reste du
 * produit le calcule ; `Intl` attend une fraction, la division vit ici pour
 * qu'aucun appelant n'ait à s'en souvenir.
 */
export function usePourcentage(): (pourCent: number) => string {
  const format = useNombre({ style: "percent", maximumFractionDigits: 0 });
  return (pourCent) => format(pourCent / 100);
}

/**
 * Passe un mot en minuscule pour l'écrire au fil d'une phrase — sauf en
 * allemand, où les noms communs gardent leur majuscule. « 8 min 25 boxen »
 * n'est pas une faute de style : c'est une faute d'orthographe, et elle
 * apparaissait partout où un nom d'exercice suivait un nombre.
 *
 * La règle vit ici et non dans les écrans : c'est une propriété de la langue,
 * pas de la mise en page.
 */
export function enMinuscule(mot: string, locale: Locale): string {
  if (locale === "de") return mot;
  return mot.toLocaleLowerCase(etiquetteLocale(locale));
}

/** La même chose, pour un composant qui n'a pas la langue sous la main. */
export function useMinuscule(): (mot: string) => string {
  const { locale } = useLocale();
  return (mot: string) => enMinuscule(mot, locale);
}
