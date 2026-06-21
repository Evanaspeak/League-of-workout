"use client";
import { useEffect, useState } from "react";

const REGIONS = ["EUW1", "EUN1", "NA1", "KR", "BR1", "JP1", "TR1", "RU", "OC1"];

const LEVEL_LABELS: Record<number, string> = {
  1: "Niveau 1 · ≤45 sec",
  2: "Niveau 2 · ≤90 sec",
  3: "Niveau 3 · ≤150 sec",
  4: "Niveau 4 · ≤240 sec",
  5: "Niveau 5 · >240 sec",
};

function getLevel(sec: number): number {
  if (sec <= 45) return 1;
  if (sec <= 90) return 2;
  if (sec <= 150) return 3;
  if (sec <= 240) return 4;
  return 5;
}

export default function ProfilePage() {
  const [user, setUser] = useState<{ pseudo: string; riotId?: string; riotRegion: string; gainageMaxSec: number; riotPuuid?: string } | null>(null);
  const [goal, setGoal] = useState<{ objectifTotalPompes: number } | null>(null);
  const [form, setForm] = useState({ pseudo: "", riotId: "", riotRegion: "EUW1", gainageMaxSec: 45, objectifTotalPompes: 1000 });
  const [saving, setSaving] = useState(false);
  const [puuidLoading, setPuuidLoading] = useState(false);
  const [puuidMsg, setPuuidMsg] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([fetch("/api/user").then((r) => r.json()), fetch("/api/settings").then((r) => r.json())])
      .then(([u, s]) => {
        setUser(u);
        setGoal(s.goal);
        setForm({
          pseudo: u.pseudo ?? "",
          riotId: u.riotId ?? "",
          riotRegion: u.riotRegion ?? "EUW1",
          gainageMaxSec: u.gainageMaxSec ?? 45,
          objectifTotalPompes: s.goal?.objectifTotalPompes ?? 1000,
        });
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    await fetch("/api/user", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleResolvePuuid = async () => {
    if (!form.riotId.includes("#")) { setPuuidMsg("Format invalide : pseudo#tag"); return; }
    setPuuidLoading(true);
    setPuuidMsg("");
    const res = await fetch("/api/riot/resolve-puuid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ riotId: form.riotId, region: form.riotRegion }),
    });
    const data = await res.json();
    if (res.ok) {
      setPuuidMsg(`✓ Compte vérifié : ${data.gameName}#${data.tagLine}`);
    } else {
      setPuuidMsg(`✗ ${data.error}`);
    }
    setPuuidLoading(false);
  };

  if (!user) return <div className="text-center py-20 gold-text">Chargement...</div>;

  const niveau = getLevel(form.gainageMaxSec);

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <h1 className="text-2xl font-bold gold-text tracking-widest">PROFIL</h1>

      <div className="lol-panel p-5 space-y-4">
        <h2 className="gold-text text-sm font-semibold uppercase tracking-widest">Identité</h2>
        <div>
          <label className="block text-xs mb-1" style={{ color: "rgba(200,170,110,0.7)" }}>Pseudo affiché</label>
          <input className="lol-input" value={form.pseudo} onChange={(e) => setForm((f) => ({ ...f, pseudo: e.target.value }))} />
        </div>
      </div>

      <div className="lol-panel p-5 space-y-4">
        <h2 className="gold-text text-sm font-semibold uppercase tracking-widest">Temps de gainage max</h2>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs mb-1" style={{ color: "rgba(200,170,110,0.7)" }}>Secondes</label>
            <input
              type="number" min="1" className="lol-input"
              value={form.gainageMaxSec}
              onChange={(e) => setForm((f) => ({ ...f, gainageMaxSec: Number(e.target.value) }))}
            />
          </div>
          <div className="lol-panel px-4 py-2 text-center min-w-[140px]">
            <div className="text-xs" style={{ color: "rgba(200,170,110,0.6)" }}>Niveau calculé</div>
            <div className="text-xl font-bold gold-text">Niv. {niveau}</div>
            <div className="text-xs" style={{ color: "rgba(240,230,211,0.5)" }}>{LEVEL_LABELS[niveau]}</div>
          </div>
        </div>
        <p className="text-xs" style={{ color: "rgba(240,230,211,0.4)" }}>
          Modifie ton record de gainage pour changer ton niveau — le multiplicateur de pompes en dépend.
        </p>
      </div>

      <div className="lol-panel p-5 space-y-4">
        <h2 className="gold-text text-sm font-semibold uppercase tracking-widest">Objectif</h2>
        <div>
          <label className="block text-xs mb-1" style={{ color: "rgba(200,170,110,0.7)" }}>Total de pompes à atteindre</label>
          <input
            type="number" min="0" className="lol-input"
            value={form.objectifTotalPompes}
            onChange={(e) => setForm((f) => ({ ...f, objectifTotalPompes: Number(e.target.value) }))}
          />
        </div>
      </div>

      <div className="lol-panel p-5 space-y-4">
        <h2 className="gold-text text-sm font-semibold uppercase tracking-widest">Compte Riot Games</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: "rgba(200,170,110,0.7)" }}>Riot ID (pseudo#tag)</label>
            <input className="lol-input" placeholder="Faker#KR1" value={form.riotId} onChange={(e) => setForm((f) => ({ ...f, riotId: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "rgba(200,170,110,0.7)" }}>Région</label>
            <select className="lol-select w-full" value={form.riotRegion} onChange={(e) => setForm((f) => ({ ...f, riotRegion: e.target.value }))}>
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <button className="lol-btn lol-btn-blue w-full" onClick={handleResolvePuuid} disabled={puuidLoading || !form.riotId}>
          {puuidLoading ? "Vérification..." : "Vérifier le compte Riot"}
        </button>
        {puuidMsg && (
          <p className={`text-sm ${puuidMsg.startsWith("✓") ? "blue-text" : "loss-text"}`}>{puuidMsg}</p>
        )}
        {user.riotPuuid && (
          <p className="text-xs" style={{ color: "rgba(240,230,211,0.4)" }}>PUUID : {user.riotPuuid.slice(0, 20)}…</p>
        )}
        <p className="text-xs" style={{ color: "rgba(240,230,211,0.4)" }}>
          Nécessite une clé API Riot dans RIOT_API_KEY (fichier .env).
        </p>
      </div>

      <button className="lol-btn w-full text-base" onClick={handleSave} disabled={saving}>
        {saving ? "Enregistrement..." : saved ? "✓ Enregistré !" : "Enregistrer le profil"}
      </button>
    </div>
  );
}
