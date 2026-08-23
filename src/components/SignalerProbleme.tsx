"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Modale } from "@/components/Modale";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import { signalement as dict } from "@/lib/i18n/dictionaries/signalement";

/**
 * Signaler un problème sans écrire un courriel.
 *
 * Un bug se signalait par courriel, donc ne se signalait pas. Et le peu qui
 * arrivait manquait de tout : quelle page, quelle version, bureau ou
 * navigateur, connecté ou non. On répondait par des questions, et la moitié
 * des échanges s'arrêtait là.
 *
 * Le contexte part avec le message, et la fenêtre le MONTRE avant l'envoi.
 * Quelqu'un qui ne sait pas ce qu'il envoie n'envoie pas — et il aurait
 * raison.
 */

type Contexte = {
  version: string;
  bureau: boolean;
  langue: string;
  ecran: string;
  navigateur: string;
  connecte: boolean;
};

export function SignalerProbleme({ surFermeture }: { surFermeture?: () => void }) {
  const t = useT(dict);
  const { locale } = useLocale();
  const chemin = usePathname();
  const [ouvert, setOuvert] = useState(false);
  const [message, setMessage] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [contexte, setContexte] = useState<Contexte | null>(null);

  useEffect(() => {
    if (!ouvert) return;
    let vivant = true;
    (async () => {
      const pont = window.electronLOL;
      const version = await pont?.version?.().catch(() => null) ?? null;
      // Le nom du navigateur suffit : la chaîne complète identifie une machine
      // bien plus finement qu'un signalement ne le demande.
      const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
      const nom = /Firefox\//.test(ua) ? "Firefox"
        : /Edg\//.test(ua) ? "Edge"
        : /Chrome\//.test(ua) ? "Chrome"
        : /Safari\//.test(ua) ? "Safari"
        : "autre";
      let connecte = false;
      try {
        const s = await fetch("/api/auth/session").then((r) => r.json());
        connecte = Boolean(s?.user);
      } catch { /* on suppose déconnecté */ }
      if (!vivant) return;
      setContexte({
        version: version ?? "web",
        bureau: Boolean(pont),
        langue: locale,
        ecran: typeof window === "undefined" ? "?" : `${window.innerWidth}x${window.innerHeight}`,
        navigateur: nom,
        connecte,
      });
    })();
    return () => { vivant = false; };
  }, [ouvert, locale]);

  const fermer = () => {
    setOuvert(false);
    setMessage("");
    setEnvoye(false);
    setErreur(null);
    surFermeture?.();
  };

  const envoyer = async () => {
    if (message.trim().length < 5) { setErreur(t.court); return; }
    setEnvoi(true); setErreur(null);
    try {
      const r = await fetch("/api/signalement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, page: chemin, contexte }),
      });
      if (r.status === 201) setEnvoye(true);
      else if (r.status === 429) setErreur(t.trop);
      else if (r.status === 400) setErreur(t.court);
      else setErreur(t.echec);
    } catch {
      setErreur(t.echec);
    } finally {
      setEnvoi(false);
    }
  };

  const ligne = (libelle: string, valeur: string) => (
    <div className="flex justify-between gap-3" style={{ fontSize: "0.78rem" }}>
      <span style={{ color: "var(--steel)" }}>{libelle}</span>
      <b style={{ fontWeight: 500 }}>{valeur}</b>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="text-xs"
        style={{
          color: "var(--steel)", background: "none", border: "none",
          cursor: "pointer", padding: 0, textDecoration: "underline",
        }}
      >
        {t.bouton}
      </button>

      {ouvert && (
        <Modale titre={t.titre} onFermer={fermer} largeur="30rem">
          {envoye ? (
            <div className="flex flex-col gap-4">
              <p style={{ color: "var(--muted)" }}>{t.merci}</p>
              <button className="lol-btn w-full" onClick={fermer}>{t.fermer}</button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p style={{ color: "var(--muted)", fontSize: "0.85rem", lineHeight: 1.6 }}>
                {t.intro}
              </p>

              <div>
                <label className="block text-xs mb-1" style={{ color: "var(--steel)" }} htmlFor="signalement-message">
                  {t.champ}
                </label>
                <textarea
                  id="signalement-message"
                  className="lol-input"
                  rows={4}
                  placeholder={t.exemple}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  style={{ resize: "vertical", width: "100%" }}
                />
              </div>

              {contexte && (
                <div
                  style={{
                    border: "1px solid var(--line)", borderRadius: 6,
                    padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4,
                  }}
                >
                  <div style={{
                    fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase",
                    color: "var(--gold)", marginBottom: 2,
                  }}>
                    {t.jointTitre}
                  </div>
                  {ligne(t.page, chemin ?? "/")}
                  {ligne(t.version, contexte.version)}
                  {ligne(t.bureau, contexte.bureau ? t.oui : t.non)}
                  {ligne(t.navigateur, contexte.navigateur)}
                  {ligne(t.langue, contexte.langue)}
                  {ligne(t.ecran, contexte.ecran)}
                  <p className="text-xs mt-1" style={{ color: "var(--steel)" }}>{t.jointAide}</p>
                </div>
              )}

              {erreur && <p className="text-sm loss-text">{erreur}</p>}

              <button className="lol-btn w-full" onClick={envoyer} disabled={envoi}>
                {envoi ? t.envoi : t.envoyer}
              </button>
            </div>
          )}
        </Modale>
      )}
    </>
  );
}
