"use client";
import { useEffect, useState } from "react";

type MatchEntry = {
  matchId: string;
  champion: string;
  role: string;
  kills: number;
  deaths: number;
  assists: number;
  result: string;
  date: string;
  alreadyLogged: boolean;
  pompesCalculees: number | null;
  indisponible?: boolean;
};

type DiagRow = {
  id: string;
  httpStatus: number;
  retryAfter?: string | null;
  queueId?: number;
  gameMode?: string;
  mapId?: number;
  participantCount?: number;
  participantFound?: boolean;
  roleCalcule?: string;
  champion?: string | null;
};

type DiagResult = {
  total: number;
  summary: Record<string, number>;
  rows: DiagRow[];
};

export default function GameHistoryPage() {
  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [httpStatus, setHttpStatus] = useState<number>(0);
  const [rawResponse, setRawResponse] = useState<string>("");
  const [parseError, setParseError] = useState<string>("");
  const [addingId, setAddingId] = useState<string | null>(null);

  const [diagLoading, setDiagLoading] = useState(false);
  const [diagResult, setDiagResult] = useState<DiagResult | null>(null);
  const [diagError, setDiagError] = useState<string>("");
  const [showDiag, setShowDiag] = useState(false);

  useEffect(() => {
    fetch("/api/riot/match-history")
      .then(async (r) => {
        setHttpStatus(r.status);
        const text = await r.text();
        setRawResponse(text);
        try {
          const data = JSON.parse(text);
          if (Array.isArray(data)) {
            setMatches(data);
          } else {
            setParseError(`L'API a renvoyé un objet au lieu d'un tableau: ${text.substring(0, 300)}`);
          }
        } catch (e) {
          setParseError(`Impossible de parser le JSON: ${e} — réponse brute: ${text.substring(0, 300)}`);
        }
        setLoading(false);
      })
      .catch((e) => {
        setParseError(`Erreur réseau: ${e.message}`);
        setLoading(false);
      });
  }, []);

  const handleAdd = async (m: MatchEntry) => {
    setAddingId(m.matchId);
    const res = await fetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: m.role,
        champion: m.champion,
        kills: m.kills,
        deaths: m.deaths,
        assists: m.assists,
        result: m.result,
        source: "riot_api",
        riotMatchId: m.matchId,
      }),
    });
    if (res.ok) {
      const { scoring } = await res.json();
      setMatches((prev) =>
        prev.map((x) =>
          x.matchId === m.matchId
            ? { ...x, alreadyLogged: true, pompesCalculees: scoring.pompesFinales }
            : x
        )
      );
    }
    setAddingId(null);
  };

  const runDiag = async () => {
    setDiagLoading(true);
    setDiagError("");
    setDiagResult(null);
    setShowDiag(true);
    try {
      const r = await fetch("/api/riot/debug-history");
      const text = await r.text();
      try {
        setDiagResult(JSON.parse(text));
      } catch {
        setDiagError(`HTTP ${r.status} — réponse brute: ${text.substring(0, 400)}`);
      }
    } catch (e) {
      setDiagError(`Erreur réseau: ${e}`);
    }
    setDiagLoading(false);
  };

  if (loading) return <div className="text-center py-20 gold-text">Chargement des parties Riot...</div>;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold gold-text tracking-widest">HISTORIQUE DE PARTIES</h1>

      {/* Bloc de diagnostic */}
      <div className="lol-panel p-3 space-y-2" style={{ borderColor: "rgba(200,170,110,0.2)" }}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs" style={{ color: "rgba(200,170,110,0.6)" }}>
            API match-history → HTTP {httpStatus || "?"} · {matches.length} parties chargées
          </span>
          {parseError && (
            <span className="text-xs loss-text">{parseError}</span>
          )}
          <button
            className="lol-btn text-xs px-3 py-1 ml-auto"
            onClick={runDiag}
            disabled={diagLoading}
          >
            {diagLoading ? "Diagnostic en cours…" : "Diagnostiquer (appel lent)"}
          </button>
        </div>

        {showDiag && (
          <div className="mt-2 text-xs space-y-1" style={{ fontFamily: "monospace" }}>
            {diagLoading && <p style={{ color: "rgba(240,230,211,0.5)" }}>Fetching 20 matches séquentiellement…</p>}
            {diagError && <p className="loss-text">{diagError}</p>}
            {diagResult && (
              <>
                <p className="gold-text">Total: {diagResult.total} IDs</p>
                <div className="space-y-0.5">
                  {Object.entries(diagResult.summary).map(([k, v]) => (
                    <p key={k} style={{ color: "rgba(240,230,211,0.7)" }}>{v}× {k}</p>
                  ))}
                </div>
                <div className="mt-2 space-y-0.5 max-h-64 overflow-y-auto">
                  {diagResult.rows.map((row) => (
                    <p key={row.id} style={{ color: row.httpStatus === 200 ? "rgba(240,230,211,0.6)" : "#e05555" }}>
                      {row.httpStatus !== 200
                        ? `HTTP ${row.httpStatus} (retry-after: ${row.retryAfter ?? "n/a"})`
                        : `${row.gameMode}/map${row.mapId}/q${row.queueId} → ${row.roleCalcule} [${row.champion}] participants:${row.participantCount} found:${row.participantFound}`
                      }
                    </p>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <p className="text-sm" style={{ color: "rgba(240,230,211,0.4)" }}>
        20 dernières parties du compte Riot · Cliquez sur &quot;Ajouter&quot; pour comptabiliser les pompes
      </p>

      {matches.length === 0 ? (
        <div className="lol-panel p-8 text-center space-y-3">
          <p style={{ color: "rgba(240,230,211,0.5)" }}>Aucune partie trouvée.</p>
          {rawResponse && (
            <pre className="text-left text-xs overflow-auto max-h-40 p-2 rounded"
              style={{ background: "rgba(0,0,0,0.3)", color: "rgba(240,230,211,0.5)" }}>
              {rawResponse.substring(0, 500)}
            </pre>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {matches.map((m, i) => (
            <div
              key={m.matchId}
              className="lol-panel px-4 py-3 flex items-center gap-3"
              style={{ background: "var(--lol-dark-light)" }}
            >
              <span className="text-xs w-5 text-center" style={{ color: "rgba(200,170,110,0.4)" }}>
                {i + 1}
              </span>

              <span
                className="font-bold text-sm w-16 text-center rounded px-2 py-0.5 shrink-0"
                style={{
                  background: m.result === "V" ? "rgba(70,180,100,0.15)" : "rgba(200,70,70,0.15)",
                  color: m.result === "V" ? "#4eb86e" : "#e05555",
                }}
              >
                {m.result === "V" ? "Victoire" : m.result === "D" ? "Défaite" : m.result}
              </span>

              <span className="gold-text font-semibold text-sm w-16 shrink-0">{m.role}</span>

              <span className="text-sm w-28 shrink-0" style={{ color: "rgba(240,230,211,0.85)" }}>
                {m.champion}
              </span>

              <span className="text-sm font-mono shrink-0" style={{ color: "rgba(240,230,211,0.7)" }}>
                {m.kills} / <span style={{ color: "#e05555" }}>{m.deaths}</span> / {m.assists}
              </span>

              <span className="text-xs shrink-0" style={{ color: "rgba(240,230,211,0.35)" }}>
                {(() => {
                  try { return new Date(m.date).toLocaleDateString("fr-FR"); }
                  catch { return m.date; }
                })()}
              </span>

              <div className="ml-auto flex items-center gap-3 shrink-0">
                {m.indisponible ? (
                  <span className="text-xs px-3 py-1 rounded" style={{ color: "rgba(240,230,211,0.35)" }}>
                    Indisponible
                  </span>
                ) : m.alreadyLogged ? (
                  <>
                    <span className="text-sm gold-text font-bold">{m.pompesCalculees} pompes</span>
                    <span
                      className="text-xs px-3 py-1 rounded"
                      style={{ background: "rgba(200,170,110,0.1)", color: "rgba(200,170,110,0.5)" }}
                    >
                      ✓ Loggée
                    </span>
                  </>
                ) : (
                  <button
                    className="lol-btn text-xs px-4 py-1"
                    onClick={() => handleAdd(m)}
                    disabled={addingId === m.matchId}
                  >
                    {addingId === m.matchId ? "…" : "+ Ajouter"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
