"use client";
import { useEffect, useState } from "react";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import { settings as dict } from "@/lib/i18n/dictionaries/settings";
import { translateApiError } from "@/lib/i18n/apiErrors";
import { Icone } from "@/components/Icone";

const REGIONS = ["EUW1", "EUN1", "NA1", "KR", "BR1", "JP1", "TR1", "RU", "OC1"];

/**
 * Compte Riot rattaché à League of Legends.
 *
 * Il vivait dans le profil, à côté du pseudo et de l'objectif — comme si
 * c'était une information sur la personne. C'en est une sur un jeu : elle
 * n'existe que pour League, et n'a rien à faire là où quelqu'un qui joue à
 * Rocket League irait chercher ses réglages.
 */
export function CompteRiot() {
  const t = useT(dict);
  const { locale } = useLocale();

  const [riotId, setRiotId] = useState("");
  const [region, setRegion] = useState("EUW1");
  const [puuid, setPuuid] = useState("");
  const [charge, setCharge] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [enregistre, setEnregistre] = useState(false);
  // Le message ET son issue : un glyphe collé en tête de chaîne n'est pas un
  // état, et sa couleur ne se déduit pas.
  const [message, setMessage] = useState<{ texte: string; ok: boolean } | null>(null);

  useEffect(() => {
    let vivant = true;
    fetch("/api/user")
      .then((r) => r.json())
      .then((u) => {
        if (!vivant) return;
        setRiotId(u.riotId ?? "");
        setRegion(u.riotRegion ?? "EUW1");
        setPuuid(u.riotPuuid ?? "");
        setCharge(true);
      })
      .catch(() => { if (vivant) setCharge(true); });
    return () => { vivant = false; };
  }, []);

  if (!charge) return null;

  /**
   * Vérifie puis enregistre, en un seul geste. Séparer les deux laissait des
   * comptes vérifiés mais jamais sauvegardés — le bouton disait « vérifié » et
   * le suivi restait muet.
   */
  const verifierEtEnregistrer = async () => {
    if (!riotId.includes("#")) { setMessage({ texte: t.formatInvalide, ok: false }); return; }
    setOccupe(true);
    setMessage(null);
    setEnregistre(false);
    try {
      const res = await fetch("/api/riot/resolve-puuid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riotId, region }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ texte: translateApiError(data.error, locale), ok: false });
        return;
      }
      setMessage({ texte: t.compteVerifie(data.gameName, data.tagLine), ok: true });
      setPuuid(data.puuid ?? "");

      const sauve = await fetch("/api/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riotId, riotRegion: region, riotPuuid: data.puuid }),
      });
      if (sauve.ok) {
        setEnregistre(true);
        setTimeout(() => setEnregistre(false), 2000);
      } else {
        setMessage({ texte: t.erreurSauvegarde, ok: false });
      }
    } catch {
      setMessage({ texte: t.erreurSauvegarde, ok: false });
    } finally {
      setOccupe(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-xs uppercase tracking-widest" style={{ color: "rgba(152,162,176,0.6)" }}>
          {t.compteRiot}
        </h3>
        {enregistre && <span className="win-text"><Icone nom="coche" taille={13} titre={t.enregistre} /></span>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs mb-1" style={{ color: "rgba(152,162,176,0.7)" }}>{t.riotIdLabel}</label>
          <input
            className="lol-input" placeholder="Faker#KR1"
            value={riotId}
            onChange={(e) => setRiotId(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: "rgba(152,162,176,0.7)" }}>{t.region}</label>
          <select className="lol-select w-full" value={region} onChange={(e) => setRegion(e.target.value)}>
            {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      <button
        className="lol-btn lol-btn-blue w-full"
        onClick={verifierEtEnregistrer}
        disabled={occupe || !riotId}
      >
        {occupe ? t.verificationEnCours : t.verifierCompteRiot}
      </button>

      {message && (
        <p className={`text-sm flex items-center gap-2 ${message.ok ? "blue-text" : "loss-text"}`}>
          <Icone nom={message.ok ? "coche" : "croix"} taille={15} />
          {message.texte}
        </p>
      )}
      {puuid && (
        <p className="text-xs" style={{ color: "rgba(236,239,244,0.4)" }}>{t.puuidLabel(puuid.slice(0, 20))}</p>
      )}
    </div>
  );
}
