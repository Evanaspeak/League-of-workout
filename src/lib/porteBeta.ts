import { prisma } from "@/lib/prisma";
import { estAdmin } from "@/lib/admin";

/**
 * Qui peut entrer par mot de passe.
 *
 * Depuis l'ouverture de la bêta, deux régimes coexistent : Google et Discord
 * entrent librement, le mot de passe reste sur invitation. Ce n'est pas un
 * oubli, c'est un choix — mais il vivait uniquement dans la porte de connexion,
 * et le formulaire d'inscription ne le connaissait pas.
 *
 * Résultat : le formulaire créait un compte, annonçait « Compte créé »,
 * et la connexion suivante était refusée avec « Email ou mot de passe
 * incorrect ». L'adresse et le mot de passe étaient pourtant les bons. Rien,
 * dans ce que voyait la personne, ne pouvait la mettre sur la piste.
 *
 * La règle vit désormais ici, à un seul endroit, et les deux chemins la
 * consultent. C'est la même leçon que pour la validation des pseudos : deux
 * copies d'une règle finissent toujours par diverger.
 */
export type VerdictPorte =
  | { ouverte: true }
  | { ouverte: false; raison: "refusee" | "en-attente" | "sans-invitation" };

export async function porteMotDePasse(email: string): Promise<VerdictPorte> {
  const adresse = email.trim().toLowerCase();
  if (estAdmin(adresse)) return { ouverte: true };

  // Liste blanche manuelle : l'adresse d'une candidature peut différer de
  // celle du compte, d'où ce second registre tenu à la main.
  const liste = await prisma.systemConfig.findUnique({
    where: { key: "betaWhitelistEmails" },
    select: { value: true },
  });
  const adresses: string[] = liste ? JSON.parse(liste.value) : [];
  if (adresses.includes(adresse)) return { ouverte: true };

  const candidature = await prisma.betaApplication.findUnique({
    where: { email: adresse },
    select: { status: true },
  });
  if (candidature?.status === "accepted") return { ouverte: true };
  if (candidature?.status === "rejected") return { ouverte: false, raison: "refusee" };
  if (candidature?.status === "pending") return { ouverte: false, raison: "en-attente" };
  return { ouverte: false, raison: "sans-invitation" };
}

/** Ce qu'on dit à quelqu'un qui n'entre pas, et où on l'envoie. */
export const MESSAGES_PORTE: Record<
  Exclude<VerdictPorte, { ouverte: true }>["raison"],
  string
> = {
  refusee: "Cette adresse n'a pas accès à la bêta.",
  "en-attente": "Ta candidature est en cours d'examen. Tu recevras un e-mail dès qu'elle est traitée.",
  "sans-invitation":
    "La création de compte par mot de passe est réservée aux invités. Demande un accès, ou connecte-toi avec Google ou Discord.",
};

/** Clé de la liste blanche dans la configuration système. */
const CLE_LISTE = "betaWhitelistEmails";

/**
 * Inscrit une adresse parmi celles qui peuvent entrer par mot de passe.
 *
 * Appelée par la porte d'accès bêta, qui est l'entrée officielle et ouverte.
 * Sans elle, la porte de connexion refusait ensuite ces comptes : elle
 * déduisait « vient de la bêta » de l'absence d'adresse, ce qui cessait d'être
 * vrai dès que la personne remplissait le champ e-mail — pourtant facultatif.
 * Elle repartait avec un code et un compte qu'elle ne pouvait jamais ouvrir.
 *
 * Ne jette pas : un compte créé vaut mieux qu'une inscription perdue parce que
 * la liste n'a pas pu s'écrire. Le cas se rattrape depuis l'administration.
 */
export async function autoriserAdresse(email: string | null | undefined): Promise<void> {
  const adresse = (email ?? "").trim().toLowerCase();
  if (!adresse) return;
  try {
    const ligne = await prisma.systemConfig.findUnique({
      where: { key: CLE_LISTE },
      select: { value: true },
    });
    const adresses: string[] = ligne ? JSON.parse(ligne.value) : [];
    if (adresses.includes(adresse)) return;
    adresses.push(adresse);
    await prisma.systemConfig.upsert({
      where: { key: CLE_LISTE },
      create: { key: CLE_LISTE, value: JSON.stringify(adresses) },
      update: { value: JSON.stringify(adresses) },
    });
  } catch {
    // Table absente ou base injoignable : on n'empêche pas l'inscription.
  }
}
