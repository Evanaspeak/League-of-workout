import { Resend } from "resend";
import { lignesBilan, type TextesBilan } from "./i18n/courriels";
import type { Bilan } from "./bilanHebdo";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = "Win or Workout <noreply@winorworkout.com>";
const SITE = process.env.AUTH_URL?.replace(/\/$/, "") || "https://winorworkout.com";

/**
 * Un pseudo part d'un formulaire et arrive dans du HTML. Il est validé à
 * l'écriture, mais l'échapper ici coûte trois lignes et couvre le jour où un
 * autre chemin d'écriture oubliera la règle — ou celui où cet e-mail gagnera un
 * second destinataire.
 */
function echapper(texte: string): string {
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const WRAPPER_OPEN = `
  <div style="background:#0C0E11;color:#ECEFF4;font-family:sans-serif;padding:40px;max-width:560px;margin:0 auto;border:1px solid rgba(152,162,176,0.2);border-radius:12px;">
`;
const WRAPPER_CLOSE = `
    <hr style="border:none;border-top:1px solid rgba(152,162,176,0.15);margin:28px 0;" />
    <p style="font-size:0.8rem;color:rgba(236,239,244,0.3);">
      Win or Workout n'est pas affilié à Riot Games.
    </p>
  </div>
`;

/**
 * Lien de réinitialisation. Rien n'a encore changé sur le compte quand cet
 * e-mail part : c'est le clic qui déclenche le remplacement du code.
 *
 * Avant, la demande elle-même écrasait le mot de passe. N'importe qui
 * connaissant l'adresse de quelqu'un lui faisait donc tourner son identifiant
 * sans qu'il ait rien demandé — et l'e-mail lui affirmait pourtant que son
 * ancien code restait valable tant qu'il ignorait le message.
 */
export async function sendResetLink(to: string, pseudo: string, lien: string) {
  if (!resend) return;
  const nom = echapper(pseudo);
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Récupérer ton accès · Win or Workout",
    html: `
      ${WRAPPER_OPEN}
        <h1 style="font-size:1.4rem;color:#ECEFF4;margin-bottom:16px;">Récupérer ton accès, ${nom}</h1>
        <p style="line-height:1.7;color:rgba(236,239,244,0.75);margin-bottom:20px;">
          Quelqu'un a demandé un nouveau code de connexion pour ce compte.
          <strong>Rien n'a changé pour l'instant</strong> : ton code actuel fonctionne toujours.
        </p>
        <a href="${lien}"
           style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#FF4D2E,#FF8A3D);color:#fff;font-weight:700;text-decoration:none;border-radius:8px;margin-bottom:20px;">
          Obtenir un nouveau code
        </a>
        <p style="line-height:1.7;color:rgba(236,239,244,0.5);font-size:0.9rem;">
          Ce lien vaut une heure, et une seule fois. C'est en l'ouvrant que ton ancien
          code cessera de fonctionner.
          Si tu n'es pas à l'origine de cette demande, ignore cet e-mail : ton compte
          reste protégé par le code que tu utilises déjà.
        </p>
      ${WRAPPER_CLOSE}
    `,
  });
}

/**
 * Le bilan de la semaine.
 *
 * Court, et sans image : un courriel qui demande de faire défiler ne se lit
 * pas, et la semaine suivante il ne s'ouvre plus. Les chiffres sont ceux que
 * l'application affiche déjà — le courriel ne calcule rien de son côté, il ne
 * fait que rappeler ce qui s'est passé à quelqu'un qui n'a pas ouvert la page.
 */
export async function envoyerBilanHebdo(
  to: string,
  pseudo: string,
  t: TextesBilan,
  bilan: Bilan,
  detteRestante: boolean,
) {
  if (!resend) return false;
  const nom = echapper(pseudo);
  const lignes = lignesBilan(t, bilan).map(({ libelle, valeur }) => `
    <tr>
      <td style="padding:7px 0;color:rgba(236,239,244,0.6);font-size:0.92rem;">${echapper(libelle)}</td>
      <td style="padding:7px 0;color:#ECEFF4;font-weight:700;text-align:right;font-variant-numeric:tabular-nums;">${echapper(valeur)}</td>
    </tr>`).join("");

  await resend.emails.send({
    from: FROM,
    to,
    subject: `${t.sujet} · Win or Workout`,
    html: `
      ${WRAPPER_OPEN}
        <h1 style="font-size:1.4rem;color:#ECEFF4;margin-bottom:18px;">${echapper(t.titre(nom))}</h1>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">${lignes}</table>
        <p style="line-height:1.7;color:rgba(236,239,244,0.75);margin-bottom:20px;">
          ${echapper(t.cloture(detteRestante))}
        </p>
        <a href="${SITE}/dashboard"
           style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#FF4D2E,#FF8A3D);color:#fff;font-weight:700;text-decoration:none;border-radius:8px;">
          ${echapper(t.lien)}
        </a>
        <p style="margin-top:22px;font-size:0.82rem;color:rgba(236,239,244,0.4);">
          <a href="${SITE}/settings" style="color:rgba(236,239,244,0.5);">${echapper(t.arret)}</a>
        </p>
      ${WRAPPER_CLOSE}
    `,
  });
  return true;
}

export { SITE as SITE_URL };
