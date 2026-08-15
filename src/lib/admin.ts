/**
 * Qui administre l'application. L'adresse vit dans l'environnement plutôt que
 * dans le code : elle change sans redéploiement de source, et un second
 * administrateur s'ajoute en modifiant une variable Vercel.
 *
 * `ADMIN_EMAILS` accepte plusieurs adresses séparées par des virgules. La
 * valeur historique reste le défaut pour que rien ne casse si la variable
 * n'est pas définie.
 */
const DEFAUT = "evantocquet@gmail.com";

function liste(): string[] {
  return (process.env.ADMIN_EMAILS || DEFAUT)
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Vrai si cette adresse a les droits d'administration. Le prédicat de type
 * dit ce qui est vrai : une adresse absente n'est jamais administratrice, donc
 * après ce test l'appelant tient une chaîne.
 */
export function estAdmin(email: string | null | undefined): email is string {
  if (!email) return false;
  return liste().includes(email.trim().toLowerCase());
}
