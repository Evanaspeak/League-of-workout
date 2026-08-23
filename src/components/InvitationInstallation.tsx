"use client";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/LocaleContext";
import { installation } from "@/lib/i18n/dictionaries/installation";
import { estPagePublique } from "@/lib/pagesPubliques";
import {
  CLE_REFUS, CLE_SESSION, CLE_VISITES, compterVisite, dejaInstallee, estIOS,
  estTelephone, proposerInstallation, visitesLues,
} from "@/lib/installation";

/**
 * L'invite d'installation du navigateur, telle que Chrome et Edge la
 * remettent. Le type n'existe pas dans les définitions standard : la
 * spécification n'est implémentée nulle part ailleurs.
 */
type InviteInstallation = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Proposition d'installer l'application sur l'écran d'accueil.
 *
 * À la troisième visite seulement, sur téléphone seulement, et une seule fois
 * — un refus vaut pour toujours. Le manifeste existe depuis longtemps, mais
 * personne ne va chercher « ajouter à l'écran d'accueil » dans un menu de
 * navigateur : sans invitation, la fonction n'existe pas pour l'utilisateur.
 *
 * Sur iPhone, il n'y a aucune invite à déclencher — Safari ne l'implémente
 * pas. On décrit alors le geste, ce qui est la seule chose à faire : c'est
 * précisément là que l'installation compte le plus, puisque c'est la seule
 * façon d'y recevoir une notification.
 */
export function InvitationInstallation() {
  const t = useT(installation);
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [invite, setInvite] = useState<InviteInstallation | null>(null);
  const [ios, setIos] = useState(false);

  const refuser = useCallback(() => {
    setVisible(false);
    try { localStorage.setItem(CLE_REFUS, "1"); } catch { /* navigation privée */ }
  }, []);

  useEffect(() => {
    // Les pages publiques ne comptent pas : quelqu'un qui lit la présentation
    // trois fois n'est pas quelqu'un qui utilise l'application.
    if (estPagePublique(pathname)) return;

    let visites = 0;
    let refuse = false;
    try {
      const stocke = localStorage.getItem(CLE_VISITES);
      // Une visite se compte à l'ouverture, pas à chaque page : les écrans
      // suivants se contentent de relire.
      if (sessionStorage.getItem(CLE_SESSION) === "1") {
        visites = visitesLues(stocke);
      } else {
        visites = compterVisite(stocke);
        localStorage.setItem(CLE_VISITES, String(visites));
        sessionStorage.setItem(CLE_SESSION, "1");
      }
      refuse = localStorage.getItem(CLE_REFUS) === "1";
    } catch {
      // Navigation privée ou stockage bloqué : on ne propose rien plutôt que
      // de reproposer à chaque page, faute de pouvoir retenir un refus.
      return;
    }

    const surIOS = estIOS();
    setIos(surIOS);

    const droit = proposerInstallation({
      visites, refuse, telephone: estTelephone(), installee: dejaInstallee(),
    });
    if (!droit) return;

    // iOS n'émettra jamais l'événement : on affiche le geste tout de suite.
    if (surIOS) { setVisible(true); return; }

    const surInvite = (e: Event) => {
      // Sans cela, Chrome affiche sa propre barre en bas de l'écran, et il y
      // en aurait deux.
      e.preventDefault();
      setInvite(e as InviteInstallation);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", surInvite);
    return () => window.removeEventListener("beforeinstallprompt", surInvite);
  }, [pathname]);

  // Installée entre-temps depuis le menu du navigateur : l'invitation n'a plus
  // d'objet, et la laisser affichée ferait douter que ça a marché.
  useEffect(() => {
    const installee = () => setVisible(false);
    window.addEventListener("appinstalled", installee);
    return () => window.removeEventListener("appinstalled", installee);
  }, []);

  if (!visible) return null;

  const accepter = async () => {
    if (!invite) return;
    setVisible(false);
    try {
      await invite.prompt();
      const { outcome } = await invite.userChoice;
      // Un refus dans la boîte du navigateur vaut refus : on ne repassera pas.
      if (outcome === "dismissed") localStorage.setItem(CLE_REFUS, "1");
    } catch { /* l'invite a expiré, on n'insiste pas */ }
  };

  return (
    <div
      role="dialog"
      aria-label={t.titre}
      className="lol-panel"
      style={{
        position: "fixed", left: 12, right: 12, bottom: 12, zIndex: 9400,
        padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10,
        boxShadow: "0 12px 34px rgba(0,0,0,0.5)",
      }}
    >
      <div>
        <div style={{ color: "var(--bone)", fontWeight: 600, fontSize: "0.92rem" }}>
          {t.titre}
        </div>
        <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "var(--faint)", lineHeight: 1.5 }}>
          {ios ? t.gesteIOS : t.aide}
        </p>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={refuser}
          style={{
            flex: 1, padding: "9px 14px", borderRadius: 8, cursor: "pointer",
            fontSize: "0.82rem", background: "transparent",
            border: "1px solid var(--line-strong)", color: "var(--muted)",
            minHeight: 44,
          }}
        >
          {ios ? t.fermer : t.plusTard}
        </button>
        {!ios && (
          <button className="lol-btn" style={{ flex: 1, minHeight: 44 }} onClick={accepter}>
            {t.installer}
          </button>
        )}
      </div>
    </div>
  );
}
