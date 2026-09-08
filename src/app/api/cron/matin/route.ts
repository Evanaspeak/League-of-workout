import { NextResponse } from "next/server";
import { secretProgrammeValide } from "@/lib/secretProgramme";
import { POST as rappelsDuMatin } from "@/app/api/push/programme/route";
import { POST as bilanHebdo } from "@/app/api/mail/hebdo/route";

/**
 * Le déclencheur du matin, appelé par les tâches planifiées de Vercel.
 *
 * **Pourquoi il existe.** Les deux envois du matin étaient suspendus au
 * `schedule` de GitHub Actions, qui est au mieux disant : relevé sur cent
 * exécutions et douze jours, 8,3 passages par jour au lieu de vingt-quatre, et
 * **six jours sur douze sans aucun passage dans la fenêtre de 9 h à midi**. Le
 * rappel du matin partait donc environ un jour sur deux, et le bilan
 * hebdomadaire — qui ne part que le lundi — perdait une semaine sur deux.
 *
 * **Pourquoi une route de plus plutôt que deux crons.** Vercel appelle un
 * CHEMIN, en GET, une fois par expression cron. Les deux routes d'envoi sont
 * en POST et le resteront : elles écrivent, et un GET qui écrit se fait
 * atteindre par un préchargeur ou un explorateur. Un aiguilleur coûte donc une
 * route et rend deux choses — les deux envois partent ensemble, et le plan
 * Hobby, qui n'autorise que deux tâches, garde ses deux créneaux pour donner
 * DEUX chances à la même matinée au lieu d'une seule à chaque envoi.
 *
 * **Les deux routes restent la source de vérité.** Elles sont appelées ici par
 * leur fonction, pas par un aller-retour HTTP : recopier leur logique aurait
 * créé une troisième vérité, et c'est le motif que ce projet paie en boucle.
 * L'échec de l'une ne doit pas emporter l'autre — d'où `allSettled` plutôt
 * qu'un `all` : le bilan du lundi n'a pas à sauter parce qu'un service de
 * notification est en panne.
 *
 * **Ce que ça ne règle PAS, et il vaut mieux l'écrire.** Deux passages par
 * jour couvrent la France, pas le monde : un compte à Tokyo a sa matinée à une
 * heure UTC que ces deux crons n'atteignent jamais. Le travail GitHub reste
 * donc en place, avec sa loterie, pour tout le reste. Le jour où le plan
 * Vercel passe en Pro, un seul `0 * * * *` remplace les deux ET le travail
 * GitHub.
 */
export async function GET(req: Request) {
  if (!secretProgrammeValide(req)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // Les deux routes se gardent elles-mêmes par le même secret. On leur
  // fabrique la requête qu'elles attendent plutôt que de leur ouvrir une porte
  // de service : un second chemin d'entrée est un second chemin à surveiller.
  const secret = process.env.RAPPEL_SECRET as string;
  const commePOST = () =>
    new Request(new URL("/api/interne", req.url), {
      method: "POST",
      headers: { "x-rappel-secret": secret },
    });

  const [push, mail] = await Promise.allSettled([
    rappelsDuMatin(commePOST()),
    bilanHebdo(commePOST()),
  ]);

  const lire = async (r: PromiseSettledResult<Response>) => {
    if (r.status === "rejected") return { erreur: true };
    try {
      return await r.value.json();
    } catch {
      return { erreur: true };
    }
  };

  return NextResponse.json({
    push: await lire(push),
    mail: await lire(mail),
  });
}
