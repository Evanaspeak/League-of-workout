"use client";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/LocaleContext";
import { settings as settingsDict } from "@/lib/i18n/dictionaries/settings";
import { oublierPremiereVisite } from "@/lib/premiereVisite";
import { useIdCompte } from "@/lib/useIdCompte";

/**
 * La rubrique « Avancé » des réglages : les coefficients du barème.
 *
 * Elle vivait dans `settings/page.tsx`, qui faisait mille lignes. Ces
 * cent-soixante-là n'avaient aucune raison d'y être : elles ne s'affichent que
 * pour un administrateur, elles ne partagent avec le reste de la page qu'une
 * seule valeur — les paliers — et elles portaient à elles seules cinq états
 * dont personne d'autre ne se servait.
 *
 * Les poids par rôle et les paramètres de maîtrise sont lus ici plutôt que
 * passés par la page : celle-ci les chargeait pour tout le monde, y compris
 * pour les comptes qui ne verront jamais ce panneau. Les paliers, eux, restent
 * partagés — la page les lit pour afficher le niveau du compte, et les modifier
 * ici doit continuer de mettre ce niveau à jour.
 */
type RoleWeight = {
  role: string; poidsMort: number; poidsKill: number; poidsAssist: number; maitriseActive: boolean;
};
export type LevelConfig = {
  niveau: number; seuilGainageSec: number; seuilPompes?: number;
  multiplicateur: number; malusDefaite: number;
};
type MasteryConfig = { surchargeMax: number; partiesPourMax: number };

export function ReglagesAvances({
  niveaux, setNiveaux,
}: {
  niveaux: LevelConfig[];
  setNiveaux: (maj: (prec: LevelConfig[]) => LevelConfig[]) => void;
}) {
  const t = useT(settingsDict);
  const uid = useIdCompte();
  const [roleWeights, setRoleWeights] = useState<RoleWeight[]>([]);
  const [masteryConfig, setMasteryConfig] = useState<MasteryConfig | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savedSettings, setSavedSettings] = useState(false);

  useEffect(() => {
    let vivant = true;
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        if (!vivant) return;
        // Repli explicite : une réponse incomplète posait `undefined` ici, et
        // le panneau emportait la page entière au premier rendu.
        setRoleWeights(Array.isArray(s.roleWeights) ? s.roleWeights : []);
        setMasteryConfig(s.masteryConfig ?? null);
      })
      .catch(() => { /* le panneau reste fermé, la page tient debout */ });
    return () => { vivant = false; };
  }, []);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleWeights, levelConfigs: niveaux, masteryConfig }),
    });
    setSavingSettings(false);
    setSavedSettings(true);
    setTimeout(() => setSavedSettings(false), 2000);
  };

  const updateRole = (role: string, field: keyof RoleWeight, value: string | boolean) => {
    setRoleWeights((prev) => prev.map((r) => r.role === role ? { ...r, [field]: value } : r));
  };

  const updateLevel = (niveau: number, field: keyof LevelConfig, value: string) => {
    setNiveaux((prev) => prev.map((l) => l.niveau === niveau ? { ...l, [field]: Number(value) } : l));
  };

  // Même garde qu'avant l'extraction : rien tant que les paramètres de
  // maîtrise ne sont pas là, sinon le rendu lit dans `null`.
  if (!masteryConfig) return null;

  return (
    <div>
        <div className="lol-panel p-5 space-y-6">

          <p style={{ fontSize: "0.78rem", color: "var(--faint)", lineHeight: 1.6 }}>
            {t.betaExplication}
          </p>

          {/* Poids par rôle */}
          <div className="space-y-3">
            <h2 className="titre-section">{t.poidsParRole}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: "var(--steel)" }} className="text-xs uppercase tracking-wider">
                    <th className="text-left py-2 pr-3">{t.role}</th>
                    <th className="text-center py-2 px-2">{t.poidsMorts}</th>
                    <th className="text-center py-2 px-2">{t.poidsKills}</th>
                    <th className="text-center py-2 px-2">{t.poidsAssists}</th>
                    <th className="text-center py-2 px-2">{t.maitrise}</th>
                  </tr>
                </thead>
                <tbody>
                  {roleWeights.map((rw) => (
                    <tr key={rw.role} style={{ borderTop: "1px solid rgba(152,162,176,0.1)" }}>
                      <td className="py-2 pr-3 gold-text font-medium">{rw.role}</td>
                      {(["poidsMort", "poidsKill", "poidsAssist"] as const).map((field) => (
                        <td key={field} className="py-2 px-2 text-center">
                          <input
                            type="number" step="0.1" min="0"
                            className="lol-input text-center w-20"
                            value={rw[field]}
                            onChange={(e) => updateRole(rw.role, field, e.target.value)}
                          />
                        </td>
                      ))}
                      <td className="py-2 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={rw.maitriseActive}
                          onChange={(e) => updateRole(rw.role, "maitriseActive", e.target.checked)}
                          className="w-4 h-4 accent-yellow-500"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Niveaux */}
          <div className="space-y-3">
            <h2 className="titre-section">{t.niveauxGainage}</h2>
            <p className="text-xs" style={{ color: "var(--faint)" }}>
              {t.niveauxExplication}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: "var(--steel)" }} className="text-xs uppercase tracking-wider">
                    <th className="text-left py-2 pr-3">{t.niveau}</th>
                    <th className="text-center py-2 px-2">{t.seuilPompes}</th>
                    <th className="text-center py-2 px-2">{t.multiplicateur}</th>
                    <th className="text-center py-2 px-2">{t.malusDefaite}</th>
                  </tr>
                </thead>
                <tbody>
                  {niveaux.map((lc) => (
                    <tr key={lc.niveau} style={{ borderTop: "1px solid rgba(152,162,176,0.1)" }}>
                      <td className="py-2 pr-3 gold-text font-bold">{t.niveauAbrev(lc.niveau)}</td>
                      <td className="py-2 px-2 text-center">
                        <input
                          type="number" min="1"
                          className="lol-input text-center w-24"
                          value={lc.niveau === 5 ? "∞" : lc.seuilPompes ?? ""}
                          readOnly={lc.niveau === 5}
                          style={lc.niveau === 5 ? { opacity: 0.5, cursor: "not-allowed" } : {}}
                          onChange={(e) => lc.niveau !== 5 && updateLevel(lc.niveau, "seuilPompes", e.target.value)}
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <input
                          type="number" step="0.01" min="0"
                          className="lol-input text-center w-24"
                          value={lc.multiplicateur}
                          onChange={(e) => updateLevel(lc.niveau, "multiplicateur", e.target.value)}
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <input
                          type="number" min="0"
                          className="lol-input text-center w-20"
                          value={lc.malusDefaite}
                          onChange={(e) => updateLevel(lc.niveau, "malusDefaite", e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Maîtrise */}
          <div className="space-y-4">
            <h2 className="titre-section">{t.parametresMaitrise}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: "var(--steel)" }}>
                  {t.surchargeMax(Math.round(masteryConfig.surchargeMax * 100))}
                </label>
                <input
                  type="number" step="0.01" min="0" max="2"
                  className="lol-input"
                  value={masteryConfig.surchargeMax}
                  onChange={(e) => setMasteryConfig((m) => m ? { ...m, surchargeMax: Number(e.target.value) } : m)}
                />
                <p className="text-xs mt-1" style={{ color: "var(--faint)" }}>{t.surchargeMaxDetail}</p>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: "var(--steel)" }}>{t.partiesPourMax}</label>
                <input
                  type="number" min="1"
                  className="lol-input"
                  value={masteryConfig.partiesPourMax}
                  onChange={(e) => setMasteryConfig((m) => m ? { ...m, partiesPourMax: Number(e.target.value) } : m)}
                />
                <p className="text-xs mt-1" style={{ color: "var(--faint)" }}>{t.partiesPourMaxDetail}</p>
              </div>
            </div>
          </div>

          <button className="lol-btn w-full text-base" onClick={handleSaveSettings} disabled={savingSettings}>
            {savingSettings ? t.enregistrementEnCours : savedSettings ? t.reglagesSauvegardes : t.sauvegarderReglages}
          </button>

          {/* Outils de test bêta */}
          <div style={{ borderTop: "1px solid rgba(152,162,176,0.1)", paddingTop: "1rem" }}>
            <p style={{ fontSize: "0.7rem", color: "var(--faint)", letterSpacing: "0.08em", marginBottom: "0.6rem" }}>
              {t.outilsDeTest}
            </p>
            <button
              onClick={() => {
                oublierPremiereVisite(uid);
                window.location.href = "/dashboard";
              }}
              style={{
                width: "100%",
                padding: "0.55rem",
                background: "transparent",
                border: "1px dashed rgba(152,162,176,0.2)",
                borderRadius: 4,
                color: "var(--faint)",
                fontSize: "0.78rem",
                cursor: "pointer",
                letterSpacing: "0.06em",
              }}
            >
              {t.rejouerIntro}
            </button>
          </div>
        </div>
    </div>
  );
}
