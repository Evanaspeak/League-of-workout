import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = "Win or Workout <noreply@winorworkout.com>";

export async function sendBetaConfirmation(to: string, pseudo: string) {
  if (!resend) return;
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Candidature bêta reçue — League of Workout",
    html: `
      <div style="background:#040810;color:#F0E6D3;font-family:sans-serif;padding:40px;max-width:560px;margin:0 auto;border:1px solid rgba(200,170,110,0.2);border-radius:12px;">
        <h1 style="font-size:1.4rem;color:#C8AA6E;margin-bottom:16px;">⚔ Candidature reçue, ${pseudo} !</h1>
        <p style="line-height:1.7;color:rgba(240,230,211,0.75);margin-bottom:16px;">
          Merci d'avoir postulé à la bêta de <strong>League of Workout</strong>.
          On passe en revue toutes les candidatures et on te contactera si tu fais partie des 100 sélectionnés.
        </p>
        <p style="line-height:1.7;color:rgba(240,230,211,0.75);">
          En attendant, garde un œil sur ta boîte mail. Les invitations partent par vagues.
        </p>
        <hr style="border:none;border-top:1px solid rgba(200,170,110,0.15);margin:28px 0;" />
        <p style="font-size:0.8rem;color:rgba(240,230,211,0.3);">
          League of Workout n'est pas affilié à Riot Games.
        </p>
      </div>
    `,
  });
}

export async function sendBetaAcceptance(to: string, pseudo: string) {
  if (!resend) return;
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Tu es sélectionné — Accès bêta League of Workout",
    html: `
      <div style="background:#040810;color:#F0E6D3;font-family:sans-serif;padding:40px;max-width:560px;margin:0 auto;border:1px solid rgba(200,170,110,0.2);border-radius:12px;">
        <h1 style="font-size:1.4rem;color:#C8AA6E;margin-bottom:16px;">⚔ Félicitations, ${pseudo} !</h1>
        <p style="line-height:1.7;color:rgba(240,230,211,0.75);margin-bottom:16px;">
          Tu fais partie des <strong style="color:#C8AA6E;">100 bêta testeurs</strong> de League of Workout.
          Ton accès est maintenant activé.
        </p>
        <a href="https://winorworkout.com/login"
           style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#C8AA6E,#a8893e);color:#040810;font-weight:700;text-decoration:none;border-radius:8px;margin-bottom:24px;">
          Accéder à l'app →
        </a>
        <p style="line-height:1.7;color:rgba(240,230,211,0.5);font-size:0.9rem;">
          Crée ton compte avec cet email (<strong>${to}</strong>) pour accéder à l'app.
          Tes retours comptent — n'hésite pas à nous signaler tout bug ou suggestion.
        </p>
        <hr style="border:none;border-top:1px solid rgba(200,170,110,0.15);margin:28px 0;" />
        <p style="font-size:0.8rem;color:rgba(240,230,211,0.3);">
          League of Workout n'est pas affilié à Riot Games.
        </p>
      </div>
    `,
  });
}
