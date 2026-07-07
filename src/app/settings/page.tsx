"use client";
import { useEffect, useState } from "react";
import { logout, deleteAccount } from "@/lib/actions";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import { settings as settingsDict } from "@/lib/i18n/dictionaries/settings";
import { translateApiError } from "@/lib/i18n/apiErrors";

// ─── Types ───────────────────────────────────────────────────────────────────

type RoleWeight = { role: string; poidsMort: number; poidsKill: number; poidsAssist: number; maitriseActive: boolean };
type LevelConfig = { niveau: number; seuilGainageSec: number; multiplicateur: number; malusDefaite: number };
type MasteryConfig = { surchargeMax: number; partiesPourMax: number };

const REGIONS = ["EUW1", "EUN1", "NA1", "KR", "BR1", "JP1", "TR1", "RU", "OC1"];

const HEADING: React.CSSProperties = {
  fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
  fontSize: "0.72rem",
  color: "#ECEFF4",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const t = useT(settingsDict);
  const { locale } = useLocale();
  // ── Profile ──
  const [profileForm, setProfileForm] = useState({
    pseudo: "", riotId: "", riotRegion: "EUW1", objectifTotalPompes: 1000,
  });
  const [betaRank, setBetaRank] = useState<number | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [puuidLoading, setPuuidLoading] = useState(false);
  const [puuidMsg, setPuuidMsg] = useState("");
  const [riotPuuid, setRiotPuuid] = useState("");

  // ── Suppression de compte ──
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  // ── Beta panel ──
  const [showBeta, setShowBeta] = useState(false);
  const [roleWeights, setRoleWeights] = useState<RoleWeight[]>([]);
  const [levelConfigs, setLevelConfigs] = useState<LevelConfig[]>([]);
  const [masteryConfig, setMasteryConfig] = useState<MasteryConfig | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savedSettings, setSavedSettings] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/user").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]).then(([u, s]) => {
      setProfileForm({
        pseudo: u.pseudo ?? "",
        riotId: u.riotId ?? "",
        riotRegion: u.riotRegion ?? "EUW1",
        objectifTotalPompes: s.goal?.objectifTotalPompes ?? 1000,
      });
      setBetaRank(u.betaRank ?? null);
      setRiotPuuid(u.riotPuuid ?? "");
      setRoleWeights(s.roleWeights);
      setLevelConfigs(s.levelConfigs);
      setMasteryConfig(s.masteryConfig);
    });
  }, []);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setSavedProfile(false);
    setProfileError("");
    const res = await fetch("/api/user", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profileForm),
    });
    setSavingProfile(false);
    if (res.ok) {
      setSavedProfile(true);
      setTimeout(() => setSavedProfile(false), 2000);
    } else {
      const err = await res.json().catch(() => ({}));
      setProfileError(err.error ? translateApiError(err.error, locale) : t.erreurSauvegarde);
    }
  };

  const handleResolvePuuid = async () => {
    if (!profileForm.riotId.includes("#")) { setPuuidMsg(t.formatInvalide); return; }
    setPuuidLoading(true);
    setPuuidMsg("");
    const res = await fetch("/api/riot/resolve-puuid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ riotId: profileForm.riotId, region: profileForm.riotRegion }),
    });
    const data = await res.json();
    if (res.ok) {
      setPuuidMsg(t.compteVerifie(data.gameName, data.tagLine));
      setRiotPuuid(data.puuid ?? "");
    } else {
      setPuuidMsg(`✗ ${translateApiError(data.error, locale)}`);
    }
    setPuuidLoading(false);
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleWeights, levelConfigs, masteryConfig }),
    });
    setSavingSettings(false);
    setSavedSettings(true);
    setTimeout(() => setSavedSettings(false), 2000);
  };

  const updateRole = (role: string, field: keyof RoleWeight, value: string | boolean) => {
    setRoleWeights((prev) => prev.map((r) => r.role === role ? { ...r, [field]: value } : r));
  };

  const updateLevel = (niveau: number, field: keyof LevelConfig, value: string) => {
    setLevelConfigs((prev) => prev.map((l) => l.niveau === niveau ? { ...l, [field]: Number(value) } : l));
  };

  return (
    <div className="space-y-6">
      <h1 style={{ fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)", fontSize: "1.5rem", color: "#ECEFF4", letterSpacing: "0.18em" }}>{t.title}</h1>

      {/* ── Profil ──────────────────────────────────────────────────────── */}
      <div className="lol-panel p-5 space-y-4">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={HEADING}>{t.profil}</h2>
          {betaRank !== null && (
            <span style={{
              fontSize: "0.65rem",
              letterSpacing: "0.1em",
              color: "rgba(152,162,176,0.5)",
              background: "rgba(152,162,176,0.07)",
              border: "1px solid rgba(152,162,176,0.15)",
              borderRadius: 3,
              padding: "2px 8px",
            }}>
              {t.betaRank(betaRank)}
            </span>
          )}
        </div>

        <div>
          <label className="block text-xs mb-1" style={{ color: "rgba(152,162,176,0.7)" }}>{t.pseudoAffiche}</label>
          <input
            className="lol-input"
            value={profileForm.pseudo}
            onChange={(e) => setProfileForm((f) => ({ ...f, pseudo: e.target.value }))}
          />
        </div>

        <div>
          <label className="block text-xs mb-1" style={{ color: "rgba(152,162,176,0.7)" }}>{t.objectifTotalPompes}</label>
          <input
            type="number" min="0" className="lol-input"
            value={profileForm.objectifTotalPompes}
            onChange={(e) => setProfileForm((f) => ({ ...f, objectifTotalPompes: Number(e.target.value) }))}
          />
        </div>

        <div className="space-y-3">
          <h3 className="text-xs uppercase tracking-widest" style={{ color: "rgba(152,162,176,0.6)" }}>{t.compteRiot}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: "rgba(152,162,176,0.7)" }}>{t.riotIdLabel}</label>
              <input
                className="lol-input" placeholder="Faker#KR1"
                value={profileForm.riotId}
                onChange={(e) => setProfileForm((f) => ({ ...f, riotId: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "rgba(152,162,176,0.7)" }}>{t.region}</label>
              <select
                className="lol-select w-full"
                value={profileForm.riotRegion}
                onChange={(e) => setProfileForm((f) => ({ ...f, riotRegion: e.target.value }))}
              >
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <button
            className="lol-btn lol-btn-blue w-full"
            onClick={handleResolvePuuid}
            disabled={puuidLoading || !profileForm.riotId}
          >
            {puuidLoading ? t.verificationEnCours : t.verifierCompteRiot}
          </button>
          {puuidMsg && (
            <p className={`text-sm ${puuidMsg.startsWith("✓") ? "blue-text" : "loss-text"}`}>{puuidMsg}</p>
          )}
          {riotPuuid && (
            <p className="text-xs" style={{ color: "rgba(236,239,244,0.4)" }}>{t.puuidLabel(riotPuuid.slice(0, 20))}</p>
          )}
        </div>

        {profileError && <p className="text-sm loss-text">{profileError}</p>}
        <button className="lol-btn w-full" onClick={handleSaveProfile} disabled={savingProfile}>
          {savingProfile ? t.enregistrementEnCours : savedProfile ? t.profilEnregistre : t.enregistrerProfil}
        </button>
      </div>

      {/* ── Panneau Beta (coefficients) ─────────────────────────────────── */}
      {betaRank !== null && masteryConfig && (
        <div>
          <button
            onClick={() => setShowBeta((v) => !v)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.75rem 1.1rem",
              background: "rgba(152,162,176,0.04)",
              border: "1px solid rgba(152,162,176,0.14)",
              borderRadius: showBeta ? "6px 6px 0 0" : 6,
              cursor: "pointer",
              color: "rgba(152,162,176,0.6)",
              fontSize: "0.72rem",
              letterSpacing: "0.14em",
              fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
            }}
          >
            <span>{t.parametresAvancesBeta}</span>
            <span style={{ transition: "transform 0.2s", display: "inline-block", transform: showBeta ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
          </button>

          {showBeta && (
            <div style={{
              border: "1px solid rgba(152,162,176,0.14)",
              borderTop: "none",
              borderRadius: "0 0 6px 6px",
              padding: "1.25rem",
              background: "rgba(152,162,176,0.02)",
            }} className="space-y-6">

              <p style={{ fontSize: "0.78rem", color: "rgba(236,239,244,0.4)", lineHeight: 1.6 }}>
                {t.betaExplication}
              </p>

              {/* Poids par rôle */}
              <div className="space-y-3">
                <h2 style={HEADING}>{t.poidsParRole}</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ color: "rgba(152,162,176,0.6)" }} className="text-xs uppercase tracking-wider">
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
                <h2 style={HEADING}>{t.niveauxGainage}</h2>
                <p className="text-xs" style={{ color: "rgba(236,239,244,0.4)" }}>
                  {t.niveauxExplication}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ color: "rgba(152,162,176,0.6)" }} className="text-xs uppercase tracking-wider">
                        <th className="text-left py-2 pr-3">{t.niveau}</th>
                        <th className="text-center py-2 px-2">{t.seuilGainageSec}</th>
                        <th className="text-center py-2 px-2">{t.multiplicateur}</th>
                        <th className="text-center py-2 px-2">{t.malusDefaite}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {levelConfigs.map((lc) => (
                        <tr key={lc.niveau} style={{ borderTop: "1px solid rgba(152,162,176,0.1)" }}>
                          <td className="py-2 pr-3 gold-text font-bold">{t.niveauAbrev(lc.niveau)}</td>
                          <td className="py-2 px-2 text-center">
                            <input
                              type="number" min="1"
                              className="lol-input text-center w-24"
                              value={lc.seuilGainageSec === 9999 ? "∞" : lc.seuilGainageSec}
                              readOnly={lc.niveau === 5}
                              style={lc.niveau === 5 ? { opacity: 0.5, cursor: "not-allowed" } : {}}
                              onChange={(e) => lc.niveau !== 5 && updateLevel(lc.niveau, "seuilGainageSec", e.target.value)}
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
                <h2 style={HEADING}>{t.parametresMaitrise}</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: "rgba(152,162,176,0.7)" }}>
                      {t.surchargeMax(Math.round(masteryConfig.surchargeMax * 100))}
                    </label>
                    <input
                      type="number" step="0.01" min="0" max="2"
                      className="lol-input"
                      value={masteryConfig.surchargeMax}
                      onChange={(e) => setMasteryConfig((m) => m ? { ...m, surchargeMax: Number(e.target.value) } : m)}
                    />
                    <p className="text-xs mt-1" style={{ color: "rgba(236,239,244,0.4)" }}>{t.surchargeMaxDetail}</p>
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: "rgba(152,162,176,0.7)" }}>{t.partiesPourMax}</label>
                    <input
                      type="number" min="1"
                      className="lol-input"
                      value={masteryConfig.partiesPourMax}
                      onChange={(e) => setMasteryConfig((m) => m ? { ...m, partiesPourMax: Number(e.target.value) } : m)}
                    />
                    <p className="text-xs mt-1" style={{ color: "rgba(236,239,244,0.4)" }}>{t.partiesPourMaxDetail}</p>
                  </div>
                </div>
              </div>

              <button className="lol-btn w-full text-base" onClick={handleSaveSettings} disabled={savingSettings}>
                {savingSettings ? t.enregistrementEnCours : savedSettings ? t.reglagesSauvegardes : t.sauvegarderReglages}
              </button>

              {/* Outils de test bêta */}
              <div style={{ borderTop: "1px solid rgba(152,162,176,0.1)", paddingTop: "1rem" }}>
                <p style={{ fontSize: "0.7rem", color: "rgba(236,239,244,0.3)", letterSpacing: "0.08em", marginBottom: "0.6rem" }}>
                  {t.outilsDeTest}
                </p>
                <button
                  onClick={() => {
                    localStorage.removeItem("low_onboarded");
                    localStorage.removeItem("splash");
                    window.location.reload();
                  }}
                  style={{
                    width: "100%",
                    padding: "0.55rem",
                    background: "transparent",
                    border: "1px dashed rgba(152,162,176,0.2)",
                    borderRadius: 4,
                    color: "rgba(152,162,176,0.45)",
                    fontSize: "0.78rem",
                    cursor: "pointer",
                    letterSpacing: "0.06em",
                  }}
                >
                  {t.rejouerIntro}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Déconnexion */}
      <form action={logout} className="pt-2">
        <button type="submit" className="lol-btn lol-btn-danger w-full">
          {t.seDeconnecter}
        </button>
      </form>

      {/* ── Zone de danger : suppression de compte ──────────────────────── */}
      <div style={{
        marginTop: "1.5rem",
        padding: "1.25rem",
        borderRadius: 6,
        border: "1px solid rgba(255,90,71,0.3)",
        background: "rgba(255,90,71,0.04)",
      }}>
        <h2 style={{ ...HEADING, color: "#FF5A47" }}>{t.zoneDeDanger}</h2>
        <p style={{ fontSize: "0.8rem", color: "rgba(236,239,244,0.5)", lineHeight: 1.6, margin: "0.75rem 0 1rem" }}>
          {t.suppressionExplication}
        </p>
        <button
          onClick={() => { setShowDeleteModal(true); setDeleteConfirm(""); }}
          style={{
            width: "100%",
            padding: "0.6rem",
            background: "transparent",
            border: "1px solid rgba(255,90,71,0.5)",
            borderRadius: 4,
            color: "#FF5A47",
            fontSize: "0.85rem",
            fontWeight: 600,
            letterSpacing: "0.04em",
            cursor: "pointer",
          }}
        >
          {t.supprimerMonCompte}
        </button>
      </div>

      {/* Modal de confirmation */}
      {showDeleteModal && (
        <div
          onClick={() => !deleting && setShowDeleteModal(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.7)", padding: "1rem",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="lol-panel"
            style={{ maxWidth: 420, width: "100%", padding: "1.75rem" }}
          >
            <h3 style={{
              fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
              fontSize: "1.05rem", color: "#FF5A47", letterSpacing: "0.1em", marginBottom: "0.75rem",
            }}>
              {t.supprimerLeCompte}
            </h3>
            <p style={{ fontSize: "0.85rem", color: "rgba(236,239,244,0.6)", lineHeight: 1.6, marginBottom: "1rem" }}>
              {locale === "fr" ? (
                <>Cette action est irréversible. Pour confirmer, tapez{" "}
                  <strong style={{ color: "#FF5A47" }}>{t.confirmMot}</strong> ci-dessous.</>
              ) : (
                <>This action is irreversible. To confirm, type{" "}
                  <strong style={{ color: "#FF5A47" }}>{t.confirmMot}</strong> below.</>
              )}
            </p>
            <input
              autoFocus
              className="lol-input w-full"
              placeholder={t.confirmMot}
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              style={{ marginBottom: "1rem" }}
            />
            <div style={{ display: "flex", gap: "0.6rem" }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                style={{
                  flex: 1, padding: "0.55rem",
                  background: "transparent",
                  border: "1px solid rgba(152,162,176,0.3)",
                  borderRadius: 4, color: "rgba(236,239,244,0.7)",
                  fontSize: "0.85rem", cursor: "pointer",
                }}
              >
                {t.annuler}
              </button>
              <button
                onClick={async () => { setDeleting(true); await deleteAccount(); }}
                disabled={deleteConfirm !== t.confirmMot || deleting}
                style={{
                  flex: 1, padding: "0.55rem",
                  background: deleteConfirm === t.confirmMot ? "#FF5A47" : "rgba(255,90,71,0.25)",
                  border: "none", borderRadius: 4, color: "#fff",
                  fontSize: "0.85rem", fontWeight: 600,
                  cursor: deleteConfirm === t.confirmMot && !deleting ? "pointer" : "not-allowed",
                  opacity: deleting ? 0.6 : 1,
                }}
              >
                {deleting ? t.suppressionEnCours : t.supprimerDefinitivement}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
