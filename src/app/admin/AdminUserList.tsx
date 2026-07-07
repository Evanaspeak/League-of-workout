"use client";
import { useEffect, useState } from "react";
import { useT, useDateLocale } from "@/lib/i18n/LocaleContext";
import { adminUserList } from "@/lib/i18n/dictionaries/adminUserList";

type UserStat = {
  id: string;
  email: string | null;
  pseudo: string;
  betaRank: number | null;
  riotId: string | null;
  riotRegion: string;
  gainageMaxSec: number;
  createdAt: string;
  genre: string | null;
  age: number | null;
  poids: number | null;
  taille: number | null;
  sportsHoursPerWeek: number | null;
  totalGames: number;
  totalPompes: number;
  avgPompes: number;
  winrate: number;
  lastGame: string | null;
  gamesThisWeek: number;
  gamesThisMonth: number;
  lastLevel: number | null;
  niveauActuel: number | null;
  multiplicateur: number | null;
  malusDefaite: number | null;
};

type RoleWeight = { role: string; poidsMort: number; poidsKill: number; poidsAssist: number; maitriseActive: boolean };
type LevelConfig = { niveau: number; seuilGainageSec: number; multiplicateur: number; malusDefaite: number };
type MasteryConfig = { surchargeMax: number; partiesPourMax: number };

type ScoringConfig = {
  roles: RoleWeight[];
  levels: LevelConfig[];
  mastery: MasteryConfig | null;
};

function daysSince(date: string | null, t: ReturnType<typeof useT<typeof adminUserList>>) {
  if (!date) return null;
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return t.today;
  if (days === 1) return t.yesterday;
  return t.daysAgo(days);
}

function ActivityDot({ value, max }: { value: number; max: number }) {
  const ratio = max > 0 ? value / max : 0;
  const color = ratio === 0 ? "rgba(200,170,110,0.1)" : ratio < 0.3 ? "#ef5350" : ratio < 0.7 ? "#C8AA6E" : "#4caf50";
  return (
    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
  );
}

export default function AdminUserList() {
  const t = useT(adminUserList);
  const dateLocale = useDateLocale();
  const [users, setUsers] = useState<UserStat[]>([]);
  const [scoring, setScoring] = useState<ScoringConfig>({ roles: [], levels: [], mastery: null });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [resettingPwd, setResettingPwd] = useState<string | null>(null);
  const [newPasswords, setNewPasswords] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/users").then(r => r.json()),
      fetch("/api/admin/config/scoring").then(r => r.json()),
    ]).then(([ud, sd]) => {
      if (ud.users) setUsers(ud.users);
      setScoring({ roles: sd.roles ?? [], levels: sd.levels ?? [], mastery: sd.mastery ?? null });
    }).finally(() => setLoading(false));
  }, []);

  const maxWeekly = Math.max(...users.map(u => u.gamesThisWeek), 1);
  const filtered = users.filter(u =>
    search === "" ||
    u.pseudo.toLowerCase().includes(search.toLowerCase()) ||
    (u.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  async function resetPassword(id: string) {
    setResettingPwd(id);
    const res = await fetch(`/api/admin/users/${id}/reset-password`, { method: "POST" });
    const data = await res.json();
    if (res.ok) setNewPasswords(prev => ({ ...prev, [id]: data.password }));
    setResettingPwd(null);
  }

  async function deleteUser(id: string) {
    setDeleting(id);
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (res.ok) { setUsers(prev => prev.filter(u => u.id !== id)); setExpanded(null); }
    setDeleting(null);
    setConfirmDelete(null);
  }

  if (loading) return <div style={{ color: "rgba(240,230,211,0.4)", padding: 16 }}>{t.loading}</div>;

  return (
    <div className="lol-panel p-4" style={{ marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "1rem", color: "#C8AA6E", letterSpacing: "0.1em" }}>
          {t.title(users.length)}
        </h2>
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder={t.searchPlaceholder}
        style={{
          width: "100%", marginBottom: 16, padding: "8px 12px", borderRadius: 6,
          background: "rgba(240,230,211,0.04)", border: "1px solid rgba(200,170,110,0.2)",
          color: "#F0E6D3", fontSize: "0.85rem", outline: "none", boxSizing: "border-box",
        }}
      />

      {filtered.length === 0 && (
        <p style={{ color: "rgba(240,230,211,0.3)", fontSize: "0.85rem", padding: "12px 0" }}>{t.noResults}</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map(u => (
          <div key={u.id} style={{ border: "1px solid rgba(200,170,110,0.12)", borderRadius: 8, overflow: "hidden" }}>

            {/* Ligne compacte */}
            <div
              onClick={() => setExpanded(expanded === u.id ? null : u.id)}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                cursor: "pointer", background: expanded === u.id ? "rgba(200,170,110,0.04)" : "transparent",
              }}
            >
              <ActivityDot value={u.gamesThisWeek} max={maxWeekly} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.88rem", color: "#F0E6D3", fontWeight: 600 }}>{u.pseudo}</div>
                <div style={{ fontSize: "0.72rem", color: "rgba(240,230,211,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {u.email}
                </div>
              </div>
              <div style={{ display: "flex", gap: 16, alignItems: "center", flexShrink: 0, fontSize: "0.78rem" }}>
                <span style={{ color: "#0bc4e3" }}>{u.totalGames} {t.gamesSuffix}</span>
                <span style={{ color: "#C8AA6E" }}>{u.totalPompes} {t.pompesSuffix}</span>
                <span style={{ color: "rgba(240,230,211,0.3)" }}>
                  {u.gamesThisWeek > 0 ? t.perWeek(u.gamesThisWeek) : t.inactive}
                </span>
              </div>
            </div>

            {/* Profil déroulant */}
            {expanded === u.id && (
              <div style={{ padding: "14px 18px 18px", borderTop: "1px solid rgba(200,170,110,0.1)", background: "rgba(4,8,16,0.4)" }}>

                {/* Stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 14 }}>
                  <Stat label={t.totalGames} value={String(u.totalGames)} />
                  <Stat label={t.totalPompes} value={String(u.totalPompes)} />
                  <Stat label={t.avgPompesPerGame} value={u.totalGames > 0 ? String(u.avgPompes) : "—"} />
                  <Stat label={t.winrate} value={u.totalGames > 0 ? `${u.winrate}%` : "—"} />
                  <Stat label={t.games7d} value={String(u.gamesThisWeek)} />
                  <Stat label={t.games30d} value={String(u.gamesThisMonth)} />
                  <Stat label={t.lastGame} value={daysSince(u.lastGame, t) ?? t.never} />
                  <Stat label={t.lastLevel} value={u.lastLevel ? t.levelAbrev(u.lastLevel) : "—"} />
                </div>

                {/* Infos perso */}
                <div style={{ borderTop: "1px solid rgba(200,170,110,0.08)", paddingTop: 12, marginBottom: 14 }}>
                  <SectionTitle>{t.profile}</SectionTitle>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 12 }}>
                    <Stat label={t.email} value={u.email ?? t.notProvided} />
                    <Stat label={t.riotId} value={u.riotId ?? t.notProvided} />
                    <Stat label={t.region} value={u.riotRegion} />
                    <Stat label={t.registeredOn} value={new Date(u.createdAt).toLocaleDateString(dateLocale)} />
                    <Stat label={t.gender} value={u.genre ?? t.notProvided} />
                    <Stat label={t.age} value={u.age != null ? `${u.age}` : t.notProvided} />
                    <Stat label={t.weight} value={u.poids != null ? `${u.poids} kg` : t.notProvided} />
                    <Stat label={t.height} value={u.taille != null ? `${u.taille} cm` : t.notProvided} />
                    <Stat label={t.sportPerWeek} value={u.sportsHoursPerWeek != null ? `${u.sportsHoursPerWeek} h` : t.notProvided} />
                  </div>
                  {newPasswords[u.id] ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 6, background: "rgba(76,175,80,0.08)", border: "1px solid rgba(76,175,80,0.3)" }}>
                      <span style={{ fontSize: "0.75rem", color: "rgba(240,230,211,0.5)" }}>{t.newPassword}</span>
                      <code style={{ fontSize: "0.88rem", color: "#4caf50", fontWeight: 700, letterSpacing: "0.05em" }}>{newPasswords[u.id]}</code>
                      <span style={{ fontSize: "0.7rem", color: "rgba(240,230,211,0.3)", marginLeft: 4 }}>{t.visibleOnce}</span>
                    </div>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); resetPassword(u.id); }}
                      disabled={resettingPwd === u.id}
                      style={{ padding: "5px 12px", borderRadius: 5, fontSize: "0.75rem", cursor: "pointer", background: "transparent", border: "1px dashed rgba(200,170,110,0.35)", color: "rgba(200,170,110,0.7)" }}
                    >
                      {resettingPwd === u.id ? "..." : t.resetPassword}
                    </button>
                  )}
                </div>

                {/* Gainage & niveau */}
                <div style={{ borderTop: "1px solid rgba(200,170,110,0.08)", paddingTop: 12, marginBottom: 14 }}>
                  <SectionTitle>{t.plankSettings}</SectionTitle>
                  <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                    <Stat label={t.plankMax} value={`${u.gainageMaxSec}s`} />
                    <Stat label={t.currentLevel} value={u.niveauActuel != null ? t.levelAbrev(u.niveauActuel) : "—"} />
                    <Stat label={t.multiplier} value={u.multiplicateur != null ? `×${u.multiplicateur}` : "—"} />
                    <Stat label={t.lossPenalty} value={u.malusDefaite != null ? `${u.malusDefaite} ${t.pompesUnit}` : "—"} />
                  </div>
                </div>

                {/* Niveaux */}
                {scoring.levels.length > 0 && (
                  <div style={{ borderTop: "1px solid rgba(200,170,110,0.08)", paddingTop: 12, marginBottom: 14 }}>
                    <SectionTitle>{t.plankLevelsGlobal}</SectionTitle>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                        <thead>
                          <tr style={thRowStyle}>
                            <th style={thStyle}>{t.level}</th>
                            <th style={thStyle}>{t.threshold}</th>
                            <th style={thStyle}>{t.multiplier}</th>
                            <th style={thStyle}>{t.lossPenalty}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scoring.levels.map(l => (
                            <tr key={l.niveau} style={{
                              borderTop: "1px solid rgba(200,170,110,0.06)",
                              background: l.niveau === u.niveauActuel ? "rgba(200,170,110,0.07)" : "transparent",
                            }}>
                              <td style={tdStyle}>
                                <span style={{ color: l.niveau === u.niveauActuel ? "#C8AA6E" : "rgba(240,230,211,0.6)", fontWeight: l.niveau === u.niveauActuel ? 700 : 400 }}>
                                  {t.levelAbrev(l.niveau)}{l.niveau === u.niveauActuel ? " ◀" : ""}
                                </span>
                              </td>
                              <td style={tdStyle}>{l.seuilGainageSec === 9999 ? "∞" : `${l.seuilGainageSec}s`}</td>
                              <td style={tdStyle}>×{l.multiplicateur}</td>
                              <td style={tdStyle}>{l.malusDefaite} {t.pompesUnit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Poids par rôle */}
                {scoring.roles.length > 0 && (
                  <div style={{ borderTop: "1px solid rgba(200,170,110,0.08)", paddingTop: 12, marginBottom: 14 }}>
                    <SectionTitle>{t.kdaWeightsGlobal}</SectionTitle>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                        <thead>
                          <tr style={thRowStyle}>
                            <th style={thStyle}>{t.role}</th>
                            <th style={thStyle}>{t.deaths}</th>
                            <th style={thStyle}>{t.kills}</th>
                            <th style={thStyle}>{t.assists}</th>
                            <th style={thStyle}>{t.mastery}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scoring.roles.map(r => (
                            <tr key={r.role} style={{ borderTop: "1px solid rgba(200,170,110,0.06)" }}>
                              <td style={tdStyle}><span style={{ color: "#F0E6D3", fontWeight: 600 }}>{r.role}</span></td>
                              <td style={tdStyle}>{r.poidsMort}</td>
                              <td style={tdStyle}>{r.poidsKill}</td>
                              <td style={tdStyle}>{r.poidsAssist}</td>
                              <td style={tdStyle}>
                                <span style={{ color: r.maitriseActive ? "#4caf50" : "rgba(240,230,211,0.25)" }}>
                                  {r.maitriseActive ? t.yes : t.no}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Maîtrise */}
                {scoring.mastery && (
                  <div style={{ borderTop: "1px solid rgba(200,170,110,0.08)", paddingTop: 12, marginBottom: 14 }}>
                    <SectionTitle>{t.championMasteryGlobal}</SectionTitle>
                    <div style={{ display: "flex", gap: 24 }}>
                      <Stat label={t.maxOverload} value={`+${Math.round(scoring.mastery.surchargeMax * 100)}%`} />
                      <Stat label={t.gamesForMaxLabel} value={t.gamesForMax(scoring.mastery.partiesPourMax)} />
                    </div>
                  </div>
                )}

                {/* Suppression */}
                <div style={{ borderTop: "1px solid rgba(239,83,80,0.15)", paddingTop: 12 }}>
                  {confirmDelete === u.id ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.78rem", color: "#ef5350" }}>
                        {t.deleteConfirm}
                      </span>
                      <button
                        onClick={() => deleteUser(u.id)}
                        disabled={deleting === u.id}
                        style={{ padding: "5px 12px", borderRadius: 5, fontSize: "0.78rem", cursor: "pointer", background: "rgba(239,83,80,0.15)", border: "1px solid rgba(239,83,80,0.5)", color: "#ef5350", fontWeight: 600 }}
                      >
                        {deleting === u.id ? "..." : t.confirm}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        style={{ padding: "5px 10px", borderRadius: 5, fontSize: "0.78rem", cursor: "pointer", background: "transparent", border: "1px solid rgba(240,230,211,0.15)", color: "rgba(240,230,211,0.5)" }}
                      >
                        {t.cancel}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDelete(u.id); }}
                      style={{ padding: "5px 12px", borderRadius: 5, fontSize: "0.75rem", cursor: "pointer", background: "transparent", border: "1px dashed rgba(239,83,80,0.3)", color: "rgba(239,83,80,0.6)" }}
                    >
                      {t.deleteAccount}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: "0.67rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(200,170,110,0.4)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: "0.88rem", color: "rgba(240,230,211,0.8)", overflowWrap: "anywhere", wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(200,170,110,0.4)", marginBottom: 8 }}>
      {children}
    </p>
  );
}

const thRowStyle: React.CSSProperties = { color: "rgba(200,170,110,0.45)", fontSize: "0.67rem", textTransform: "uppercase", letterSpacing: "0.08em" };
const thStyle: React.CSSProperties = { textAlign: "left", padding: "4px 8px 8px 0", fontWeight: 500 };
const tdStyle: React.CSSProperties = { padding: "6px 8px 6px 0", color: "rgba(240,230,211,0.65)" };
