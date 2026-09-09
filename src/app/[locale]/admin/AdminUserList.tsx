"use client";
import { useEffect, useState } from "react";
import { useT, useDateLocale, useNombre, usePourcentage } from "@/lib/i18n/LocaleContext";
import { uniteLocalisee } from "@/lib/i18n/unite";
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
  const color = ratio === 0 ? "color-mix(in srgb, var(--steel) 10%, transparent)" : ratio < 0.3 ? "var(--loss)" : ratio < 0.7 ? "var(--bone)" : "var(--victory)";
  return (
    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
  );
}

export default function AdminUserList() {
  const pourcent = usePourcentage();
  const t = useT(adminUserList);
  const dateLocale = useDateLocale();
  // `totalPompes` monte à des dizaines de milliers : « 25000 » se lit mal, et
  // le reste du produit écrit « 25 000 » depuis que les nombres passent par
  // `Intl`. Un panneau qui échappe à la règle finit par la faire oublier.
  const nombre = useNombre();
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
      background: "color-mix(in srgb, var(--loss) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--loss) 30%, transparent)",
      borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: "0.86rem",
    }}>
      {erreurAction}
    </div>
  ) : null;

  return (
    <div className="lol-panel p-4" style={{ marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "1rem", color: "var(--bone)", letterSpacing: "0.1em" }}>
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
          background: "color-mix(in srgb, var(--bone) 4%, transparent)", border: "1px solid color-mix(in srgb, var(--steel) 20%, transparent)",
          color: "var(--bone)", fontSize: "0.85rem", boxSizing: "border-box",
        }}
      />

      {filtered.length === 0 && (
        <p style={{ color: "var(--faint)", fontSize: "0.85rem", padding: "12px 0" }}>{t.noResults}</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map(u => (
          <div key={u.id} style={{ border: "1px solid color-mix(in srgb, var(--steel) 12%, transparent)", borderRadius: 8, overflow: "hidden" }}>

            {/*
              * Ligne compacte — un BOUTON, pas un `div` qui écoute le clic.
              *
              * Elle ouvre et ferme le profil, donc c'est une commande. En
              * `div`, elle n'était atteignable ni au clavier ni par un lecteur
              * d'écran, et rien ne disait si le profil était ouvert : c'était,
              * avec le bloc facultatif de `/beta`, le seul dépliant du produit
              * à ne pas déclarer son état — sept autres le font.
              *
              * **Deux remises à zéro, et deux seulement.** Mesurées en retirant
              * chacune à son tour, sur la feuille de style du produit :
              *
              *   sans `width: 100%`   → la ligne passe de 600 à 112,91 px
              *   sans `textAlign`     → le pseudo et le courriel se centrent
              *   sans `border`        → rien
              *   sans `font`          → rien
              *   sans `color`         → rien
              *
              * Les trois dernières sont déjà faites par la remise à zéro de
              * Tailwind, qui pose `border: 0 solid` et `font: inherit` sur les
              * commandes. Les écrire quand même ne coûte rien et se relit comme
              * une garantie — c'est le défaut que ce projet paie en boucle, donc
              * elles sont parties. Un premier jet les nommait toutes les trois
              * comme nécessaires, et taisait `width`, qui est celle qui tient.
              */}
            <button
              type="button"
              onClick={() => setExpanded(expanded === u.id ? null : u.id)}
              aria-expanded={expanded === u.id}
              aria-controls={`profil-${u.id}`}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                cursor: "pointer", background: expanded === u.id ? "color-mix(in srgb, var(--steel) 4%, transparent)" : "transparent",
                width: "100%", textAlign: "left",
              }}
            >
              <ActivityDot value={u.gamesThisWeek} max={maxWeekly} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.88rem", color: "var(--bone)", fontWeight: 600 }}>{u.pseudo}</div>
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
                <span style={{ color: "var(--signal)" }}>{u.totalGames} {t.gamesSuffix}</span>
                <span style={{ color: "var(--bone)" }}>{u.totalPompes} {t.pompesSuffix}</span>
                <span style={{ color: "var(--faint)" }}>
                  {u.gamesThisWeek > 0 ? t.perWeek(u.gamesThisWeek) : t.inactive}
                </span>
              </div>
            </button>

            {/* Profil déroulant */}
            {expanded === u.id && (
              <div id={`profil-${u.id}`} style={{ padding: "14px 18px 18px", borderTop: "1px solid color-mix(in srgb, var(--steel) 10%, transparent)", background: "color-mix(in srgb, var(--ink) 40%, transparent)" }}>

                {/* Stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 14 }}>
                  <Stat label={t.totalGames} value={nombre(u.totalGames)} />
                  <Stat label={t.totalPompes} value={nombre(u.totalPompes)} />
                  <Stat label={t.avgPompesPerGame} value={u.totalGames > 0 ? nombre(u.avgPompes) : "—"} />
                  <Stat label={t.winrate} value={u.totalGames > 0 ? pourcent(u.winrate) : "—"} />
                  <Stat label={t.games7d} value={nombre(u.gamesThisWeek)} />
                  <Stat label={t.games30d} value={nombre(u.gamesThisMonth)} />
                  <Stat label={t.lastGame} value={daysSince(u.lastGame, t) ?? t.never} />
                  <Stat label={t.lastLevel} value={u.lastLevel ? t.levelAbrev(u.lastLevel) : "—"} />
                </div>

                {/* Infos perso */}
                <div style={{ borderTop: "1px solid color-mix(in srgb, var(--steel) 8%, transparent)", paddingTop: 12, marginBottom: 14 }}>
                  <SectionTitle>{t.profile}</SectionTitle>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 12 }}>
                    <Stat label={t.email} value={u.email ?? t.notProvided} />
                    <Stat label={t.riotId} value={u.riotId ?? t.notProvided} />
                    <Stat label={t.region} value={u.riotRegion} />
                    <Stat label={t.registeredOn} value={new Date(u.createdAt).toLocaleDateString(dateLocale)} />
                    <Stat label={t.gender} value={u.genre ?? t.notProvided} />
                    <Stat label={t.age} value={u.age != null ? `${u.age}` : t.notProvided} />
                    <Stat label={t.weight} value={u.poids != null ? uniteLocalisee(u.poids, "kilogram", dateLocale) : t.notProvided} />
                    <Stat label={t.height} value={u.taille != null ? uniteLocalisee(u.taille, "centimeter", dateLocale) : t.notProvided} />
                    <Stat label={t.sportPerWeek} value={u.sportsHoursPerWeek != null ? uniteLocalisee(u.sportsHoursPerWeek, "hour", dateLocale, 1) : t.notProvided} />
                  </div>
                  {newPasswords[u.id] ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 6, background: "color-mix(in srgb, var(--victory) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--victory) 30%, transparent)" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--faint)" }}>{t.newPassword}</span>
                      <code style={{ fontSize: "0.88rem", color: "var(--victory)", fontWeight: 700, letterSpacing: "0.05em" }}>{newPasswords[u.id]}</code>
                      <span style={{ fontSize: "0.7rem", color: "var(--faint)", marginLeft: 4 }}>{t.visibleOnce}</span>
                    </div>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); resetPassword(u.id); }}
                      disabled={resettingPwd === u.id}
                      style={{ padding: "5px 12px", borderRadius: 5, fontSize: "0.75rem", cursor: "pointer", background: "transparent", border: "1px dashed color-mix(in srgb, var(--steel) 35%, transparent)", color: "var(--steel)" }}
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
                      border: `1px dashed ${rearme[u.id] ? "color-mix(in srgb, var(--victory) 50%, transparent)" : "color-mix(in srgb, var(--steel) 35%, transparent)"}`,
                      color: rearme[u.id] ? "var(--victory)" : "var(--steel)",
                    }}
                  >
                    {rearmeEnCours === u.id ? "..." : rearme[u.id] ? (
                      // La coche se dessine : tapée en caractère, elle n'a ni
                      // taille ni couleur, et le lecteur d'écran l'annonce.
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <Icone nom="coche" taille={13} couleur="var(--victory)" />
                        {t.introRearmee}
                      </span>
                    ) : t.rejouerIntro}
                  </button>
                </div>

                {/* Test de force & niveau */}
                <div style={{ borderTop: "1px solid color-mix(in srgb, var(--steel) 8%, transparent)", paddingTop: 12, marginBottom: 14 }}>
                  <SectionTitle>{t.plankSettings}</SectionTitle>
                  <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                    <Stat label={t.plankMax} value={nombre(u.pompesMax)} />
                    <Stat label={t.currentLevel} value={u.niveauActuel != null ? t.levelAbrev(u.niveauActuel) : "—"} />
                    <Stat label={t.multiplier} value={u.multiplicateur != null ? `×${u.multiplicateur}` : "—"} />
                    <Stat label={t.lossPenalty} value={u.malusDefaite != null ? `${u.malusDefaite} ${t.pompesUnit}` : "—"} />
                  </div>
                </div>

                {/* Niveaux */}
                {scoring.levels.length > 0 && (
                  <div style={{ borderTop: "1px solid color-mix(in srgb, var(--steel) 8%, transparent)", paddingTop: 12, marginBottom: 14 }}>
                    <SectionTitle>{t.plankLevelsGlobal}</SectionTitle>
                    <div style={{ overflowX: "auto" }}>
                      <table aria-label={t.plankLevelsGlobal} style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
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
                              borderTop: "1px solid color-mix(in srgb, var(--steel) 6%, transparent)",
                              background: l.niveau === u.niveauActuel ? "color-mix(in srgb, var(--steel) 7%, transparent)" : "transparent",
                            }}>
                              <td style={tdStyle}>
                                <span style={{ color: l.niveau === u.niveauActuel ? "var(--bone)" : "var(--muted)", fontWeight: l.niveau === u.niveauActuel ? 700 : 400 }}>
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
                  <div style={{ borderTop: "1px solid color-mix(in srgb, var(--steel) 8%, transparent)", paddingTop: 12, marginBottom: 14 }}>
                    <SectionTitle>{t.kdaWeightsGlobal}</SectionTitle>
                    <div style={{ overflowX: "auto" }}>
                      <table aria-label={t.kdaWeightsGlobal} style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
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
                            <tr key={r.role} style={{ borderTop: "1px solid color-mix(in srgb, var(--steel) 6%, transparent)" }}>
                              <td style={tdStyle}><span style={{ color: "var(--bone)", fontWeight: 600 }}>{r.role}</span></td>
                              <td style={tdStyle}>{r.poidsMort}</td>
                              <td style={tdStyle}>{r.poidsKill}</td>
                              <td style={tdStyle}>{r.poidsAssist}</td>
                              <td style={tdStyle}>
                                <span style={{ color: r.maitriseActive ? "var(--victory)" : "color-mix(in srgb, var(--bone) 25%, transparent)" }}>
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
                  <div style={{ borderTop: "1px solid color-mix(in srgb, var(--steel) 8%, transparent)", paddingTop: 12, marginBottom: 14 }}>
                    <SectionTitle>{t.championMasteryGlobal}</SectionTitle>
                    <div style={{ display: "flex", gap: 24 }}>
                      <Stat label={t.maxOverload} value={`+${pourcent(scoring.mastery.surchargeMax * 100)}`} />
                      <Stat label={t.gamesForMaxLabel} value={t.gamesForMax(scoring.mastery.partiesPourMax)} />
                    </div>
                  </div>
                )}

                {/* Suppression */}
                <div style={{ borderTop: "1px solid color-mix(in srgb, var(--loss) 15%, transparent)", paddingTop: 12 }}>
                  {confirmDelete === u.id ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.78rem", color: "var(--loss)" }}>
                        {t.deleteConfirm}
                      </span>
                      <button
                        onClick={() => deleteUser(u.id)}
                        disabled={deleting === u.id}
                        style={{ padding: "5px 12px", borderRadius: 5, fontSize: "0.78rem", cursor: "pointer", background: "color-mix(in srgb, var(--loss) 15%, transparent)", border: "1px solid color-mix(in srgb, var(--loss) 50%, transparent)", color: "var(--loss)", fontWeight: 600 }}
                      >
                        {deleting === u.id ? "..." : t.confirm}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        style={{ padding: "5px 10px", borderRadius: 5, fontSize: "0.78rem", cursor: "pointer", background: "transparent", border: "1px solid color-mix(in srgb, var(--bone) 15%, transparent)", color: "var(--faint)" }}
                      >
                        {t.cancel}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDelete(u.id); }}
                      style={{ padding: "5px 12px", borderRadius: 5, fontSize: "0.75rem", cursor: "pointer", background: "transparent", border: "1px dashed color-mix(in srgb, var(--loss) 30%, transparent)", color: "color-mix(in srgb, var(--loss) 60%, transparent)" }}
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
