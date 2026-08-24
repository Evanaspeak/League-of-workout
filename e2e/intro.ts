import type { Page } from "@playwright/test";

/**
 * Écarte ce qui recouvre l'écran d'un compte tout neuf : la demande de
 * consentement santé, la modale d'accueil, la visite guidée.
 *
 * Leur mémoire est propre au compte — `low_onboarded:<id>` — et l'identifiant
 * n'existe qu'une fois l'inscription faite. On ne peut donc pas les désamorcer
 * d'avance : on les traverse, comme un utilisateur qui n'a pas envie de les
 * lire. Les faire disparaître par le stockage reviendrait à ne jamais tester
 * qu'on peut en sortir.
 */
export async function passerIntro(page: Page) {
  // L'apostrophe des libellés est typographique, pas droite : on ne la met
  // pas dans le motif, sinon rien ne correspond.
  //
  // Et la modale ne s'affiche pas tout de suite : elle laisse passer l'écran
  // d'ouverture. La chercher à l'instant du chargement ne la trouve jamais,
  // puis elle arrive et recouvre ce qu'on essayait d'atteindre.
  // La demande de consentement santé passe avant les deux autres : elle est
  // modale, elle recouvre la modale d'accueil, et rien ne se clique tant
  // qu'elle est là. Le compte vient de donner ses mesures à l'inscription —
  // accepter est le chemin qu'il suit réellement.
  for (const nom of [
    /^j.accepte$|^i agree$/i,
    /passer.{0,6}introduction|skip.{0,6}introduction/i,
    /passer.{0,6}visite|skip.{0,10}tour/i,
  ]) {
    const lien = page.getByRole("button", { name: nom }).first();
    const apparue = await lien.waitFor({ state: "visible", timeout: 4_000 })
      .then(() => true).catch(() => false);
    if (!apparue) continue;
    await lien.click();
    await lien.waitFor({ state: "hidden", timeout: 4_000 }).catch(() => {});
  }
}
