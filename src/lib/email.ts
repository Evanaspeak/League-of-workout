import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = "Win or Workout <noreply@winorworkout.com>";

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

export async function sendCodeReset(to: string, pseudo: string, newCode: string) {
  if (!resend) return;
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Ton nouveau code d'accès — Win or Workout",
    html: `
      ${WRAPPER_OPEN}
        <h1 style="font-size:1.4rem;color:#ECEFF4;margin-bottom:16px;">Nouveau code, ${pseudo}</h1>
        <p style="line-height:1.7;color:rgba(236,239,244,0.75);margin-bottom:20px;">
          Tu as demandé un nouveau code de connexion. L'ancien ne fonctionne plus.
        </p>
        <div style="font-family:monospace;font-size:1.8rem;font-weight:700;letter-spacing:0.2em;color:#ECEFF4;background:rgba(12,14,17,0.7);border:1px dashed rgba(152,162,176,0.4);border-radius:10px;padding:16px;text-align:center;margin-bottom:20px;">
          ${newCode}
        </div>
        <a href="https://winorworkout.com/login"
           style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#FF4D2E,#FF8A3D);color:#fff;font-weight:700;text-decoration:none;border-radius:8px;margin-bottom:20px;">
          Se connecter →
        </a>
        <p style="line-height:1.7;color:rgba(236,239,244,0.5);font-size:0.9rem;">
          Connecte-toi avec ton pseudo (<strong>${pseudo}</strong>) et ce code.
          Si tu n'es pas à l'origine de cette demande, ignore cet email — ton compte reste protégé par l'ancien code.
        </p>
      ${WRAPPER_CLOSE}
    `,
  });
}
