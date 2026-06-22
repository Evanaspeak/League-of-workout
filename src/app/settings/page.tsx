"use client";
import { useEffect, useState } from "react";
import { logout } from "@/lib/actions";

// ─── Types ───────────────────────────────────────────────────────────────────

type RoleWeight = { role: string; poidsMort: number; poidsKill: number; poidsAssist: number; maitriseActive: boolean };
type LevelConfig = { niveau: number; seuilGainageSec: number; multiplicateur: number; malusDefaite: number };
type MasteryConfig = { surchargeMax: number; partiesPourMax: number };

const REGIONS = ["EUW1", "EUN1", "NA1", "KR", "BR1", "JP1", "TR1", "RU", "OC1"];

// ─── Component ───────────────────────────────────────────────────────────────

export default function SettingsPage() {
  // ── Profile ──
  const [profileForm, setProfileForm] = useState({
    pseudo: "", riotId: "", riotRegion: "EUW1", objectifTotalPompes: 1000,
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [puuidLoading, setPuuidLoading] = useState(false);
  const [puuidMsg, setPuuidMsg] = useState("");
  const [riotPuuid, setRiotPuuid] = useState("");

  // ── Settings ──
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
      setProfileError(err.error ?? "Erreur lors de la sauvegarde.");
    }
  };

  const handleResolvePuuid = async () => {
    if (!profileForm.riotId.includes("#")) { setPuuidMsg("Format invalide : pseudo#tag"); return; }
    setPuuidLoading(true);
    setPuuidMsg("");
    const res = await fetch("/api/riot/resolve-puuid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ riotId: profileForm.riotId, region: profileForm.riotRegion }),
    });
    const data = await res.json();
    if (res.ok) {
      setPuuidMsg(`✓ Compte vérifié : ${data.gameName}#${data.tagLine}`);
      setRiotPuuid(data.puuid ?? "");
    } else {
      setPuuidMsg(`✗ ${data.error}`);
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

  if (!masteryConfig) return <div className="text-center py-20 gold-text">Chargement...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold gold-text tracking-widest">RÉGLAGES</h1>

      {/* ── Profil ──────────────────────────────────────────────────────── */}
      <div className="lol-panel p-5 space-y-4">
        <h2 className="gold-text text-sm font-semibold uppercase tracking-widest">Profil</h2>

        <div>
          <label className="block text-xs mb-1" style={{ color: "rgba(200,170,110,0.7)" }}>Pseudo affiché</label>
          <input
            className="lol-input"
            value={profileForm.pseudo}
            onChange={(e) => setProfileForm((f) => ({ ...f, pseudo: e.target.value }))}
          />
        </div>

        <div>
          <label className="block text-xs mb-1" style={{ color: "rgba(200,170,110,0.7)" }}>Objectif total de pompes</label>
          <input
            type="number" min="0" className="lol-input"
            value={profileForm.objectifTotalPompes}
            onChange={(e) => setProfileForm((f) => ({ ...f, objectifTotalPompes: Number(e.target.value) }))}
          />
        </div>

        <div className="space-y-3">
          <h3 className="text-xs uppercase tracking-widest" style={{ color: "rgba(200,170,110,0.6)" }}>Compte Riot Games</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: "rgba(200,170,110,0.7)" }}>Riot ID (pseudo#tag)</label>
              <input
                className="lol-input" placeholder="Faker#KR1"
                value={profileForm.riotId}
                onChange={(e) => setProfileForm((f) => ({ ...f, riotId: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "rgba(200,170,110,0.7)" }}>Région</label>
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
            {puuidLoading ? "Vérification..." : "Vérifier le compte Riot"}
          </button>
          {puuidMsg && (
            <p className={`text-sm ${puuidMsg.startsWith("✓") ? "blue-text" : "loss-text"}`}>{puuidMsg}</p>
          )}
          {riotPuuid && (
            <p className="text-xs" style={{ color: "rgba(240,230,211,0.4)" }}>PUUID : {riotPuuid.slice(0, 20)}…</p>
          )}
        </div>

        {profileError && <p className="text-sm loss-text">{profileError}</p>}
        <button className="lol-btn w-full" onClick={handleSaveProfile} disabled={savingProfile}>
          {savingProfile ? "Enregistrement..." : savedProfile ? "✓ Profil enregistré !" : "Enregistrer le profil"}
        </button>
      </div>

      {/* ── Poids par rôle ──────────────────────────────────────────────── */}
      <div className="lol-panel p-5 space-y-3">
        <h2 className="gold-text text-sm font-semibold uppercase tracking-widest">Poids par rôle / mode</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: "rgba(200,170,110,0.6)" }} className="text-xs uppercase tracking-wider">
                <th className="text-left py-2 pr-3">Rôle</th>
                <th className="text-center py-2 px-2">Poids Morts</th>
                <th className="text-center py-2 px-2">Poids Kills</th>
                <th className="text-center py-2 px-2">Poids Assists</th>
                <th className="text-center py-2 px-2">Maîtrise</th>
              </tr>
            </thead>
            <tbody>
              {roleWeights.map((rw) => (
                <tr key={rw.role} style={{ borderTop: "1px solid rgba(200,170,110,0.1)" }}>
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

      {/* ── Niveaux (gainage) ───────────────────────────────────────────── */}
      <div className="lol-panel p-5 space-y-3">
        <h2 className="gold-text text-sm font-semibold uppercase tracking-widest">Niveaux (gainage)</h2>
        <p className="text-xs" style={{ color: "rgba(240,230,211,0.4)" }}>
          Le niveau est déterminé à chaque session par le test de gainage — ces seuils définissent les paliers.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: "rgba(200,170,110,0.6)" }} className="text-xs uppercase tracking-wider">
                <th className="text-left py-2 pr-3">Niveau</th>
                <th className="text-center py-2 px-2">Seuil gainage (sec)</th>
                <th className="text-center py-2 px-2">Multiplicateur</th>
                <th className="text-center py-2 px-2">Malus défaite</th>
              </tr>
            </thead>
            <tbody>
              {levelConfigs.map((lc) => (
                <tr key={lc.niveau} style={{ borderTop: "1px solid rgba(200,170,110,0.1)" }}>
                  <td className="py-2 pr-3 gold-text font-bold">Niv. {lc.niveau}</td>
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

      {/* ── Maîtrise ────────────────────────────────────────────────────── */}
      <div className="lol-panel p-5 space-y-4">
        <h2 className="gold-text text-sm font-semibold uppercase tracking-widest">Paramètres de maîtrise</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs mb-1" style={{ color: "rgba(200,170,110,0.7)" }}>
              Surcharge max ({Math.round(masteryConfig.surchargeMax * 100)}%)
            </label>
            <input
              type="number" step="0.01" min="0" max="2"
              className="lol-input"
              value={masteryConfig.surchargeMax}
              onChange={(e) => setMasteryConfig((m) => m ? { ...m, surchargeMax: Number(e.target.value) } : m)}
            />
            <p className="text-xs mt-1" style={{ color: "rgba(240,230,211,0.4)" }}>Bonus maxi quand 100% de maîtrise (défaut : 0.5 = 50%)</p>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "rgba(200,170,110,0.7)" }}>Parties pour max</label>
            <input
              type="number" min="1"
              className="lol-input"
              value={masteryConfig.partiesPourMax}
              onChange={(e) => setMasteryConfig((m) => m ? { ...m, partiesPourMax: Number(e.target.value) } : m)}
            />
            <p className="text-xs mt-1" style={{ color: "rgba(240,230,211,0.4)" }}>Nbre de parties avant d&apos;atteindre le bonus max (défaut : 100)</p>
          </div>
        </div>
      </div>

      <button className="lol-btn w-full text-base" onClick={handleSaveSettings} disabled={savingSettings}>
        {savingSettings ? "Enregistrement..." : savedSettings ? "✓ Réglages sauvegardés !" : "Sauvegarder les réglages"}
      </button>

      {/* Déconnexion */}
      <form action={logout} className="pt-2">
        <button
          type="submit"
          className="w-full py-2 rounded text-sm"
          style={{ background: "rgba(200,70,70,0.12)", color: "#e05555", border: "1px solid rgba(200,70,70,0.3)" }}
        >
          Se déconnecter
        </button>
      </form>
    </div>
  );
}
