"use client";
import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from "recharts";
import { useSession } from "@/lib/SessionContext";

type DashData = {
  totalGames: number;
  wins: number;
  winrate: number;
  totalPompes: number;
  recordPompes: number;
  pompesByRole: Record<string, number>;
  cumulByDate: { date: string; cumul: number }[];
  objectifTotalPompes: number;
};

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="lol-panel p-4 flex flex-col gap-1">
      <span className="text-xs uppercase tracking-widest" style={{ color: "rgba(200,170,110,0.6)" }}>{label}</span>
      <span className="text-2xl font-bold gold-text">{value}</span>
      {sub && <span className="text-xs" style={{ color: "rgba(240,230,211,0.5)" }}>{sub}</span>}
    </div>
  );
}

function getLevelLabel(sec: number): string {
  if (sec <= 45) return "Niveau 1";
  if (sec <= 90) return "Niveau 2";
  if (sec <= 150) return "Niveau 3";
  if (sec <= 240) return "Niveau 4";
  return "Niveau 5";
}

export default function Dashboard() {
  const [data, setData] = useState<DashData | null>(null);
  const [showGainageModal, setShowGainageModal] = useState(false);
  const [gainageInput, setGainageInput] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("lastGainageSec") ?? "60";
    return "60";
  });

  const { sessionActive, sessionGames, sessionError, polling, countdown, sessionLevel, gainageSec, startSession, stopSession } = useSession();

  const loadDash = () =>
    fetch("/api/dashboard").then(async (res) => {
      if (!res.ok) {
        // Session invalide (ex. cookie d'une ancienne base) → retour au login.
        if (res.status === 401 && typeof window !== "undefined") {
          window.location.href = "/login";
        }
        return;
      }
      setData(await res.json());
    });

  useEffect(() => { loadDash(); }, []);

  // Rafraîchit les stats globales à chaque nouvelle game loggée en session.
  useEffect(() => {
    if (sessionGames.length > 0) loadDash();
  }, [sessionGames.length]);

  const handleConfirmGainage = async () => {
    const sec = Math.max(1, Number(gainageInput) || 60);
    localStorage.setItem("lastGainageSec", String(sec));
    setShowGainageModal(false);
    await startSession(sec);
  };

  if (!data) return <div className="text-center py-20 gold-text">Chargement...</div>;

  const progress = data.objectifTotalPompes > 0
    ? Math.min(100, Math.round((data.totalPompes / data.objectifTotalPompes) * 100))
    : 0;
  const roleData = Object.entries(data.pompesByRole ?? {}).map(([role, pompes]) => ({ role, pompes }));
  const totalSessionPompes = sessionGames.reduce((s, g) => s + g.pompes, 0);
  const sessionChartData = [...sessionGames].reverse().map((g, i) => ({ label: `G${i + 1}`, pompes: g.pompes }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold gold-text tracking-widest">DASHBOARD</h1>

      {/* Stats globales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Games jouées" value={data.totalGames} />
        <StatCard label="Winrate" value={`${data.winrate}%`} sub={`${data.wins}V / ${data.totalGames - data.wins}D`} />
        <StatCard label="Total pompes" value={data.totalPompes} />
        <StatCard label="Record / game" value={data.recordPompes} sub="pompes" />
      </div>

      {data.objectifTotalPompes > 0 && (
        <div className="lol-panel p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="gold-text font-semibold">Objectif : {data.objectifTotalPompes} pompes</span>
            <span className="blue-text">{progress}%</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(200,170,110,0.15)" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, background: "linear-gradient(to right, #0bc4e3, #c8aa6e)" }}
            />
          </div>
          <div className="text-xs" style={{ color: "rgba(240,230,211,0.5)" }}>
            {data.totalPompes} / {data.objectifTotalPompes} pompes
            {data.objectifTotalPompes - data.totalPompes > 0
              ? ` · ${data.objectifTotalPompes - data.totalPompes} restantes`
              : " · Objectif atteint !"}
          </div>
        </div>
      )}

      {/* Mode Session */}
      <div className="lol-panel p-4 space-y-3">
        <h2 className="gold-text text-sm font-semibold uppercase tracking-widest">Mode Session</h2>
        <p className="text-xs" style={{ color: "rgba(240,230,211,0.5)" }}>
          Lance une session avant de jouer — chaque partie est détectée et loggée automatiquement toutes les 2 min.
        </p>

        {!sessionActive ? (
          <button className="lol-btn w-full" onClick={() => setShowGainageModal(true)}>
            ▶ Démarrer une session
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded" style={{ background: "rgba(76,175,80,0.1)", border: "1px solid rgba(76,175,80,0.3)" }}>
              <div className="w-2 h-2 rounded-full" style={{ background: "#4caf50", boxShadow: "0 0 6px #4caf50", animation: "pulse 1.5s infinite" }} />
              <span className="text-sm win-text font-semibold">Session active</span>
              <span className="text-xs gold-text">{sessionLevel} · gainage {gainageSec}s</span>
              <span className="ml-auto text-xs" style={{ color: "rgba(240,230,211,0.4)" }}>
                {polling ? "⟳ Vérification en cours..." : `Prochaine vérif. dans ${countdown}s`}
              </span>
            </div>

            {sessionGames.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                <div className="lol-panel p-3 text-center" style={{ background: "rgba(200,170,110,0.06)" }}>
                  <div className="text-2xl font-bold gold-text">{sessionGames.length}</div>
                  <div className="text-xs" style={{ color: "rgba(240,230,211,0.5)" }}>games</div>
                </div>
                <div className="lol-panel p-3 text-center" style={{ background: "rgba(200,170,110,0.06)" }}>
                  <div className="text-2xl font-bold gold-text">{totalSessionPompes}</div>
                  <div className="text-xs" style={{ color: "rgba(240,230,211,0.5)" }}>pompes</div>
                </div>
                <div className="lol-panel p-3 text-center" style={{ background: "rgba(200,170,110,0.06)" }}>
                  <div className="text-2xl font-bold win-text">
                    {sessionGames.filter((g) => g.result === "V").length}V
                  </div>
                  <div className="text-xs loss-text">
                    {sessionGames.filter((g) => g.result === "D").length}D
                  </div>
                </div>
              </div>
            )}

            {sessionGames.length > 0 && (
              <div className="lol-panel p-3" style={{ background: "rgba(200,170,110,0.04)" }}>
                <h3 className="text-xs uppercase tracking-widest mb-2" style={{ color: "rgba(200,170,110,0.6)" }}>
                  Pompes par partie (session)
                </h3>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={sessionChartData}>
                    <XAxis dataKey="label" tick={{ fill: "rgba(240,230,211,0.5)", fontSize: 10 }} />
                    <YAxis tick={{ fill: "rgba(240,230,211,0.5)", fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "#1a2634", border: "1px solid #c8aa6e40", color: "#f0e6d3" }} />
                    <Bar dataKey="pompes" fill="#0bc4e3" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {sessionGames.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs gold-text font-semibold">Détail · {totalSessionPompes} pompes</p>
                {sessionGames.map((g, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded text-sm"
                    style={{ background: "rgba(200,170,110,0.06)", border: "1px solid rgba(200,170,110,0.1)" }}>
                    <span className={g.result === "V" ? "win-text font-bold" : "loss-text font-bold"}>
                      {g.result === "V" ? "V" : "D"}
                    </span>
                    <span className="gold-text font-medium">{g.champion}</span>
                    <span className="text-xs" style={{ color: "rgba(240,230,211,0.5)" }}>{g.role}</span>
                    <span className="text-xs" style={{ color: "rgba(240,230,211,0.6)" }}>{g.kills}/{g.deaths}/{g.assists}</span>
                    <span className="ml-auto gold-text font-bold">{g.pompes} 💪</span>
                  </div>
                ))}
              </div>
            )}

            {sessionGames.length === 0 && !polling && (
              <p className="text-xs text-center" style={{ color: "rgba(240,230,211,0.4)" }}>
                En attente de la prochaine partie...
              </p>
            )}

            {sessionError && <p className="text-sm loss-text">{sessionError}</p>}

            <button
              className="lol-btn w-full"
              style={{ background: "linear-gradient(to bottom, #c23b22, #8b2515)", color: "#f0e6d3" }}
              onClick={stopSession}
            >
              ⏹ Arrêter la session
            </button>
          </div>
        )}
      </div>

      {/* Statistiques globales */}
      <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ color: "rgba(200,170,110,0.6)" }}>
        Statistiques globales
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {roleData.length > 0 && (
          <div className="lol-panel p-4">
            <h2 className="gold-text text-sm font-semibold uppercase tracking-widest mb-3">Pompes par rôle</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={roleData}>
                <XAxis dataKey="role" tick={{ fill: "#c8aa6e", fontSize: 11 }} />
                <YAxis tick={{ fill: "rgba(240,230,211,0.5)", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#1a2634", border: "1px solid #c8aa6e40", color: "#f0e6d3" }} />
                <Bar dataKey="pompes" fill="#c8aa6e" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {(data.cumulByDate ?? []).length > 0 && (
          <div className="lol-panel p-4">
            <h2 className="gold-text text-sm font-semibold uppercase tracking-widest mb-3">Progression cumulative</h2>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.cumulByDate}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(200,170,110,0.1)" />
                <XAxis dataKey="date" tick={{ fill: "rgba(240,230,211,0.4)", fontSize: 10 }} />
                <YAxis tick={{ fill: "rgba(240,230,211,0.5)", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#1a2634", border: "1px solid #c8aa6e40", color: "#f0e6d3" }} />
                <Line dataKey="cumul" stroke="#0bc4e3" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {data.totalGames === 0 && (
        <div className="lol-panel p-8 text-center space-y-2">
          <div className="text-4xl">⚔</div>
          <p className="gold-text font-semibold">Aucune game loggée</p>
          <p className="text-sm" style={{ color: "rgba(240,230,211,0.5)" }}>
            Va sur <strong>Historique</strong> pour logger ta première partie.
          </p>
        </div>
      )}

      {/* Modal test de gainage */}
      {showGainageModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowGainageModal(false); }}
        >
          <div className="lol-panel p-6 w-full max-w-sm mx-4 space-y-5">
            <h2 className="gold-text font-bold text-lg uppercase tracking-widest">Test de gainage</h2>
            <p className="text-sm" style={{ color: "rgba(240,230,211,0.7)" }}>
              Effectue ton test de gainage maintenant. Combien de secondes as-tu tenu ?
            </p>
            <div>
              <label className="block text-xs mb-1" style={{ color: "rgba(200,170,110,0.7)" }}>
                Durée (secondes)
              </label>
              <input
                type="number" min="1"
                className="lol-input text-center text-2xl font-bold"
                value={gainageInput}
                onChange={(e) => setGainageInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConfirmGainage()}
                autoFocus
              />
            </div>
            {gainageInput && Number(gainageInput) > 0 && (
              <div className="text-center p-3 rounded" style={{ background: "rgba(200,170,110,0.1)", border: "1px solid rgba(200,170,110,0.3)" }}>
                <span className="gold-text font-bold text-xl">{getLevelLabel(Number(gainageInput))}</span>
                <span className="text-sm ml-2" style={{ color: "rgba(240,230,211,0.5)" }}>pour cette session</span>
              </div>
            )}
            <div className="flex gap-3">
              <button
                className="flex-1 py-2 rounded text-sm"
                style={{ background: "rgba(200,170,110,0.1)", color: "rgba(240,230,211,0.6)", border: "1px solid rgba(200,170,110,0.2)" }}
                onClick={() => setShowGainageModal(false)}
              >
                Annuler
              </button>
              <button
                className="lol-btn flex-1"
                onClick={handleConfirmGainage}
                disabled={!gainageInput || Number(gainageInput) < 1}
              >
                Démarrer ▶
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
