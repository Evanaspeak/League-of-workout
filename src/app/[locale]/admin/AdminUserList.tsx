"use client";
import { useEffect, useState } from "react";
import { useT, useDateLocale } from "@/lib/i18n/LocaleContext";
import { adminUserList } from "@/lib/i18n/dictionaries/adminUserList";
import { Icone } from "@/components/Icone";

type UserStat = {
  id: string;
  email: string | null;
  pseudo: string;
  betaRank: number | null;
  riotId: string | null;
  riotRegion: string;
  pompesMax: number;
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
type LevelConfig = { niveau: number; seuilPompes: number; multiplicateur: number; malusDefaite: number };
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
  const color = ratio === 0 ? "rgba(152,162,176,0.1)" : ratio < 0.3 ? "#FF5A47" : ratio < 0.7 ? "#ECEFF4" : "#2FD98A";
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
  /** Compte dont l'intro est en train d'être réarmée, puis celui qui vient de l'être. */
  const [rearmeEnCours, setRearmeEnCours] = useState<string | null>(null);
  const [rearme, setRearme] = useState<Record<string, boolean>>({});
  const [newPasswords, setNewPasswords] = useState<Record<string, string>>({});
  /**
   * L'action qui n'a pas abouti.
   *
   * Les trois commandes de cette liste — réinitialiser un mot de passe,
   * refaire jouer l'intro, supprimer un compte — n'avaient pas de branche
   * d'échec : un refus du serveur ne produisait rien, on recliquait sans
   * savoir. Et l'envoi n'était pas protégé : sans réseau, la promesse partait
   * en erreur et l'indicateur d'attente ne s'effaçait jamais.
   */
  const [erreurAction, setErreurAction] = useState("");

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

  /**
   * Une commande de la liste, avec ce qui manquait aux trois : le `try`, le
   * message d'échec, et la garantie que l'indicateur d'attente s'efface.
   */
  async function commande(marquer: (v: string | null) => void, id: string,
                          faire: () => Promise<boolean>) {
    marquer(id);
    setErreurAction("");
    try {
      if (!(await faire())) setErreurAction(t.actionEchouee);
    } catch {
      setErreurAction(t.actionEchouee);
    } finally {
      marquer(null);
    }
  }

  async function resetPassword(id: string) {
    await commande(setResettingPwd, id, async () => {
      const res = await fetch(`/api/admin/users/${id}/reset-password`, { method: "POST" });
      if (!res.ok) return false;
      const data = await res.json();
      setNewPasswords(prev => ({ ...prev, [id]: data.password }));
      return true;
    });
  }

  /**
   * Fait rejouer l'intro à ce compte.
   *
   * Rien n'est effacé ici : les marques sont dans SON navigateur. On incrémente
   * la génération, qui entre dans leur clé — elles deviennent caduques sur tous
   * ses appareils à la fois.
   */
  async function rejouerIntro(id: string) {
    await commande(setRearmeEnCours, id, async () => {
      const res = await fetch(`/api/admin/users/${id}/intro`, { method: "POST" });
      if (!res.ok) return false;
      setRearme((p) => ({ ...p, [id]: true }));
      return true;
    });
  }

  async function deleteUser(id: string) {
    await commande(setDeleting, id, async () => {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      if (!res.ok) return false;
      setUsers(prev => prev.filter(u => u.id !== id));
      setExpanded(null);
      return true;
    });
    setConfirmDelete(null);
  }

  if (loading) return <div style={{ color: "var(--faint)", padding: 16 }}>{t.loading}</div>;

  /** Le bandeau d'échec, affiché au-dessus de la liste. */
  const bandeauErreur = erreurAction ? (
    <div className="loss-text" role="status" style={{
      background: "rgba(255,90,71,0.08)", border: "1px solid rgba(255,90,71,0.3)",
      borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: "0.86rem",
    }}>
      {erreurAction}
    </div>
  ) : null;

  return (
    <div className="lol-panel p-4" style={{ marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "1rem", color: "#ECEFF4", letterSpacing: "0.1em" }}>
          {t.title(users.length)}
        </h2>
      </div>

      {bandeauErreur}

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder={t.searchPlaceholder}
        style={{
          width: "100%", marginBottom: 16, padding: "8px 12px", borderRadius: 6,
          background: "rgba(236,239,244,0.04)", border: "1px solid rgba(152,162,176,0.2)",
          color: "#ECEFF4", fontSize: "0.85rem", boxSizing: "border-box",
        }}
      />

      {filtered.length === 0 && (
        <p style={{ color: "var(--faint)", fontSize: "0.85rem", padding: "12px 0" }}>{t.noResults}</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map(u => (
          <div key={u.id} style={{ border: "1px solid rgba(152,162,176,0.12)", borderRadius: 8, overflow: "hidden" }}>

            {/* Ligne compacte */}
            <div
              onClick={() => setExpanded(expanded === u.id ? null : u.id)}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                cursor: "pointer", background: expanded === u.id ? "rgba(152,162,176,0.04)" : "transparent",
              }}
            >
              <ActivityDot value={u.gamesThisWeek} max={maxWeekly} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.88rem", color: "#ECEFF4", fontWeight: 600 }}>{u.pseudo}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {u.email}
                </div>
              </div>
              <div style={{ display: "flex", gap: 16, alignItems: "center", flexShrink: 0, fontSize: "0.78rem" }}>
                {/* La date d'inscription, sur la ligne repliée.
                    Elle existait, mais seulement dans le profil déroulant : il
                    fallait ouvrir chaque compte pour savoir qui venait
                    d'arriver. C'est exactement la question qu'on se pose le
                    jour où l'on invite du monde, et elle demandait un clic par
                    compte. Relative plutôt que datée : « il y a 2j » se lit
                    sans compter, « 31/08 » non. La date exacte reste dans le
                    profil, elle n'a pas disparu. */}
                <span style={{ color: "var(--faint)" }}>{t.joinedAgo(daysSince(u.createdAt, t) ?? "")}</span>
                <span style={{ color: "#6E9BFF" }}>{u.totalGames} {t.gamesSuffix}</span>
                <span style={{ color: "#ECEFF4" }}>{u.totalPompes} {t.pompesSuffix}</span>
                <span style={{ color: "var(--faint)" }}>
                  {u.gamesThisWeek > 0 ? t.perWeek(u.gamesThisWeek) : t.inactive}
                </span>
              </div>
            </div>

            {/* Profil déroulant */}
            {expanded === u.id && (
              <div style={{ padding: "14px 18px 18px", borderTop: "1px solid rgba(152,162,176,0.1)", background: "rgba(12,14,17,0.4)" }}>

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
                <div style={{ borderTop: "1px solid rgba(152,162,176,0.08)", paddingTop: 12, marginBottom: 14 }}>
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
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 6, background: "rgba(47,217,138,0.08)", border: "1px solid rgba(47,217,138,0.3)" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--faint)" }}>{t.newPassword}</span>
                      <code style={{ fontSize: "0.88rem", color: "#2FD98A", fontWeight: 700, letterSpacing: "0.05em" }}>{newPasswords[u.id]}</code>
                      <span style={{ fontSize: "0.7rem", color: "var(--faint)", marginLeft: 4 }}>{t.visibleOnce}</span>
                    </div>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); resetPassword(u.id); }}
                      disabled={resettingPwd === u.id}
                      style={{ padding: "5px 12px", borderRadius: 5, fontSize: "0.75rem", cursor: "pointer", background: "transparent", border: "1px dashed rgba(152,162,176,0.35)", color: "var(--steel)" }}
                    >
                      {resettingPwd === u.id ? "..." : t.resetPassword}
                    </button>
                  )}

                  <button
                    onClick={e => { e.stopPropagation(); rejouerIntro(u.id); }}
                    disabled={rearmeEnCours === u.id}
                    style={{
                      marginLeft: 8, padding: "5px 12px", borderRadius: 5, fontSize: "0.75rem",
                      cursor: "pointer", background: "transparent",
                      border: `1px dashed ${rearme[u.id] ? "rgba(47,217,138,0.5)" : "rgba(152,162,176,0.35)"}`,
                      color: rearme[u.id] ? "#2FD98A" : "var(--steel)",
                    }}
                  >
                    {rearmeEnCours === u.id ? "..." : rearme[u.id] ? (
                      // La coche se dessine : tapée en caractère, elle n'a ni
                      // taille ni couleur, et le lecteur d'écran l'annonce.
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <Icone nom="coche" taille={13} couleur="#2FD98A" />
                        {t.introRearmee}
                      </span>
                    ) : t.rejouerIntro}
                  </button>
                </div>

                {/* Test de force & niveau */}
                <div style={{ borderTop: "1px solid rgba(152,162,176,0.08)", paddingTop: 12, marginBottom: 14 }}>
                  <SectionTitle>{t.plankSettings}</SectionTitle>
                  <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                    <Stat label={t.plankMax} value={String(u.pompesMax)} />
                    <Stat label={t.currentLevel} value={u.niveauActuel != null ? t.levelAbrev(u.niveauActuel) : "—"} />
                    <Stat label={t.multiplier} value={u.multiplicateur != null ? `×${u.multiplicateur}` : "—"} />
                    <Stat label={t.lossPenalty} value={u.malusDefaite != null ? `${u.malusDefaite} ${t.pompesUnit}` : "—"} />
                  </div>
                </div>

                {/* Niveaux */}
                {scoring.levels.length > 0 && (
                  <div style={{ borderTop: "1px solid rgba(152,162,176,0.08)", paddingTop: 12, marginBottom: 14 }}>
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
                              borderTop: "1px solid rgba(152,162,176,0.06)",
                              background: l.niveau === u.niveauActuel ? "rgba(152,162,176,0.07)" : "transparent",
                            }}>
                              <td style={tdStyle}>
                                <span style={{ color: l.niveau === u.niveauActuel ? "#ECEFF4" : "var(--muted)", fontWeight: l.niveau === u.niveauActuel ? 700 : 400 }}>
                                  {t.levelAbrev(l.niveau)}{l.niveau === u.niveauActuel ? " ◀" : ""}
                                </span>
                              </td>
                              <td style={tdStyle}>{l.niveau === 5 ? "∞" : l.seuilPompes}</td>
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
                  <div style={{ borderTop: "1px solid rgba(152,162,176,0.08)", paddingTop: 12, marginBottom: 14 }}>
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
                            <tr key={r.role} style={{ borderTop: "1px solid rgba(152,162,176,0.06)" }}>
                              <td style={tdStyle}><span style={{ color: "#ECEFF4", fontWeight: 600 }}>{r.role}</span></td>
                              <td style={tdStyle}>{r.poidsMort}</td>
                              <td style={tdStyle}>{r.poidsKill}</td>
                              <td style={tdStyle}>{r.poidsAssist}</td>
                              <td style={tdStyle}>
                                <span style={{ color: r.maitriseActive ? "#2FD98A" : "rgba(236,239,244,0.25)" }}>
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
                  <div style={{ borderTop: "1px solid rgba(152,162,176,0.08)", paddingTop: 12, marginBottom: 14 }}>
                    <SectionTitle>{t.championMasteryGlobal}</SectionTitle>
                    <div style={{ display: "flex", gap: 24 }}>
                      <Stat label={t.maxOverload} value={`+${Math.round(scoring.mastery.surchargeMax * 100)}%`} />
                      <Stat label={t.gamesForMaxLabel} value={t.gamesForMax(scoring.mastery.partiesPourMax)} />
                    </div>
                  </div>
                )}

                {/* Suppression */}
                <div style={{ borderTop: "1px solid rgba(255,90,71,0.15)", paddingTop: 12 }}>
                  {confirmDelete === u.id ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.78rem", color: "#FF5A47" }}>
                        {t.deleteConfirm}
                      </span>
                      <button
                        onClick={() => deleteUser(u.id)}
                        disabled={deleting === u.id}
                        style={{ padding: "5px 12px", borderRadius: 5, fontSize: "0.78rem", cursor: "pointer", background: "rgba(255,90,71,0.15)", border: "1px solid rgba(255,90,71,0.5)", color: "#FF5A47", fontWeight: 600 }}
                      >
                        {deleting === u.id ? "..." : t.confirm}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        style={{ padding: "5px 10px", borderRadius: 5, fontSize: "0.78rem", cursor: "pointer", background: "transparent", border: "1px solid rgba(236,239,244,0.15)", color: "var(--faint)" }}
                      >
                        {t.cancel}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDelete(u.id); }}
                      style={{ padding: "5px 12px", borderRadius: 5, fontSize: "0.75rem", cursor: "pointer", background: "transparent", border: "1px dashed rgba(255,90,71,0.3)", color: "rgba(255,90,71,0.6)" }}
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
      <div style={{ fontSize: "0.67rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--faint)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: "0.88rem", color: "var(--bone)", overflowWrap: "anywhere", wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--faint)", marginBottom: 8 }}>
      {children}
    </p>
  );
}

const thRowStyle: React.CSSProperties = { color: "var(--faint)", fontSize: "0.67rem", textTransform: "uppercase", letterSpacing: "0.08em" };
const thStyle: React.CSSProperties = { textAlign: "left", padding: "4px 8px 8px 0", fontWeight: 500 };
const tdStyle: React.CSSProperties = { padding: "6px 8px 6px 0", color: "var(--muted)" };
