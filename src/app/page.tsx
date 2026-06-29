import Link from "next/link";
import { auth } from "@/auth";

export const metadata = {
  title: "League of Workout — Transforme tes défaites en pompes",
  description: "L'application qui connecte ton compte Riot et calcule tes pompes après chaque game. Scoring intelligent basé sur ton KDA, ton rôle et ta maîtrise du champion.",
};

const DOWNLOAD_URL = process.env.NEXT_PUBLIC_DOWNLOAD_URL;

const STATS = [
  { value: "-30%", label: "de pas quotidiens chez les gamers par rapport à la population générale (Withings)" },
  { value: "13h", label: "de jeu par semaine en moyenne — soit près de 2h par jour (ESA, 2023)" },
  { value: "4ème", label: "cause de mortalité mondiale — la sédentarité, devant l'obésité (OMS)" },
  { value: "+20%", label: "de mémoire et concentration après 20 min d'exercice modéré (PNAS / Univ. Illinois)" },
];

const STEPS = [
  {
    num: "01",
    title: "Connecte ton compte Riot",
    desc: "Entre ton Riot ID et ta région dans les réglages. L'app se synchronise automatiquement avec ton historique.",
  },
  {
    num: "02",
    title: "Joue tes games normalement",
    desc: "Active le mode session et joue. L'app détecte chaque partie en temps réel grâce à l'API Riot.",
  },
  {
    num: "03",
    title: "Fais tes pompes",
    desc: "Après chaque game, ton score est calculé selon ton KDA, ton rôle et ta maîtrise du champion. Plus tu performes, moins tu souffres.",
  },
];

const BENEFITS = [
  {
    icon: "⚡",
    title: "Concentration",
    desc: "L'exercice physique augmente le flux sanguin cérébral, améliorant la concentration et les prises de décision en game.",
  },
  {
    icon: "🎯",
    title: "Réflexes",
    desc: "Une activité physique régulière réduit les temps de réaction. Tes réflexes en jeu s'améliorent avec ton cardio.",
  },
  {
    icon: "🧠",
    title: "Mental",
    desc: "L'exercice libère des endorphines qui réduisent le stress et la tilté. Tu joues mieux quand tu vas bien.",
  },
  {
    icon: "❤️",
    title: "Santé long terme",
    desc: "Rester assis plus de 6h par jour augmente de 34% les risques cardiovasculaires. Les pompes cassent ce cycle.",
  },
];

const FEATURES = [
  { title: "Détection automatique", desc: "Chaque partie est détectée en temps réel via l'API Riot. Zéro saisie manuelle." },
  { title: "Scoring intelligent", desc: "Calcul basé sur ton KDA, ton rôle, ta maîtrise du champion et ton niveau de gainage." },
  { title: "Mode session live", desc: "Polling toutes les 2 minutes pendant tes sessions. Le compteur tourne en fond." },
  { title: "Historique complet", desc: "Visualise tes pompes par rôle, par champion, par période. Graphiques et stats." },
  { title: "App desktop", desc: "Application Windows pour un overlay discret pendant tes games." },
  { title: "Objectifs personnalisés", desc: "Définis ton objectif de pompes et suis ta progression semaine après semaine." },
];

export default async function LandingPage() {
  // On lit la session pour adapter le bouton de la nav, mais on NE redirige plus :
  // la page d'accueil reste accessible même connecté.
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <div style={{ background: "#040810", minHeight: "100dvh", color: "#F0E6D3" }}>

      {/* NAV */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 40,
        background: "rgba(4,8,16,0.88)",
        backdropFilter: "blur(14px)",
        borderBottom: "1px solid rgba(200,170,110,0.16)",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{
            fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
            fontSize: "1rem", letterSpacing: "0.14em", color: "#C8AA6E",
            textShadow: "0 0 22px rgba(200,170,110,0.5)",
          }}>
            ⚔ L·O·W
          </span>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {DOWNLOAD_URL && (
              <a
                href={DOWNLOAD_URL}
                style={{
                  padding: "6px 16px", borderRadius: 6, fontSize: "0.8rem",
                  border: "1px solid rgba(200,170,110,0.35)", color: "#C8AA6E",
                  textDecoration: "none", letterSpacing: "0.05em",
                }}
              >
                Télécharger
              </a>
            )}
            <Link
              href={isLoggedIn ? "/dashboard" : "/login"}
              style={{
                padding: "6px 18px", borderRadius: 6, fontSize: "0.8rem",
                background: "linear-gradient(135deg, #C8AA6E, #a8893e)",
                color: "#040810", fontWeight: 700, textDecoration: "none",
                letterSpacing: "0.05em",
              }}
            >
              {isLoggedIn ? "Mon espace" : "Se connecter"}
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{
        minHeight: "92dvh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "80px 24px 60px",
        position: "relative", overflow: "hidden",
        textAlign: "center",
      }}>
        {/* Background glow */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse 80% 60% at 50% 30%, rgba(200,170,110,0.07) 0%, transparent 70%)",
        }} />
        <div style={{
          position: "absolute", top: "20%", left: "10%", width: 300, height: 300,
          borderRadius: "50%", background: "rgba(11,196,227,0.04)",
          filter: "blur(80px)", pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", top: "30%", right: "8%", width: 250, height: 250,
          borderRadius: "50%", background: "rgba(200,170,110,0.05)",
          filter: "blur(60px)", pointerEvents: "none",
        }} />

        <div style={{ position: "relative", maxWidth: 760 }}>
          <Link href="/beta" style={{ textDecoration: "none" }}>
            <div style={{
              display: "inline-block", marginBottom: 24,
              padding: "4px 16px", borderRadius: 999,
              border: "1px solid rgba(11,196,227,0.3)",
              background: "rgba(11,196,227,0.06)",
              fontSize: "0.75rem", letterSpacing: "0.12em", textTransform: "uppercase",
              color: "#0bc4e3", cursor: "pointer",
            }}>
              Bêta fermée — candidatures ouvertes →
            </div>
          </Link>

          <h1 style={{
            fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
            fontSize: "clamp(2.4rem, 6vw, 4.5rem)",
            lineHeight: 1.08, marginBottom: 24,
            background: "linear-gradient(135deg, #F0E6D3 0%, #C8AA6E 50%, #0bc4e3 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            Transforme tes défaites<br />en pompes
          </h1>

          <p style={{
            fontSize: "clamp(1rem, 2vw, 1.2rem)", lineHeight: 1.65,
            color: "rgba(240,230,211,0.65)", marginBottom: 40, maxWidth: 580, margin: "0 auto 40px",
          }}>
            League of Workout connecte ton compte Riot et calcule automatiquement
            tes pompes après chaque partie. Plus t&apos;es bon, moins tu souffres.
          </p>

          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            {DOWNLOAD_URL && (
              <a
                href={DOWNLOAD_URL}
                style={{
                  padding: "14px 32px", borderRadius: 8, fontSize: "0.95rem",
                  background: "linear-gradient(135deg, #C8AA6E, #a8893e)",
                  color: "#040810", fontWeight: 700, textDecoration: "none",
                  letterSpacing: "0.05em", boxShadow: "0 4px 24px rgba(200,170,110,0.3)",
                }}
              >
                Télécharger l&apos;app Windows
              </a>
            )}
            <Link
              href="/beta"
              style={{
                padding: "14px 32px", borderRadius: 8, fontSize: "0.95rem",
                border: "1px solid rgba(200,170,110,0.4)",
                background: "rgba(200,170,110,0.06)",
                color: "#C8AA6E", textDecoration: "none",
                letterSpacing: "0.05em",
              }}
            >
              Candidater à la bêta →
            </Link>
          </div>
        </div>
      </section>

      {/* STATS BAR */}
      <section style={{
        borderTop: "1px solid rgba(200,170,110,0.12)",
        borderBottom: "1px solid rgba(200,170,110,0.12)",
        background: "rgba(200,170,110,0.03)",
        padding: "48px 24px",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p style={{
            textAlign: "center", fontSize: "0.75rem", letterSpacing: "0.14em",
            textTransform: "uppercase", color: "rgba(200,170,110,0.5)", marginBottom: 40,
          }}>
            La réalité des gamers
          </p>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 32,
          }}>
            {STATS.map((s) => (
              <div key={s.value} style={{ textAlign: "center" }}>
                <div style={{
                  fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
                  fontSize: "clamp(2rem, 4vw, 3rem)", color: "#C8AA6E",
                  textShadow: "0 0 30px rgba(200,170,110,0.4)", lineHeight: 1,
                  marginBottom: 10,
                }}>
                  {s.value}
                </div>
                <div style={{ fontSize: "0.85rem", color: "rgba(240,230,211,0.5)", lineHeight: 1.5 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LE PROBLÈME */}
      <section style={{ padding: "100px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center",
        }}
          className="landing-two-col"
        >
          <div>
            <p style={{
              fontSize: "0.75rem", letterSpacing: "0.14em", textTransform: "uppercase",
              color: "#0bc4e3", marginBottom: 16,
            }}>
              Le problème
            </p>
            <h2 style={{
              fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
              fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)", lineHeight: 1.2, marginBottom: 24,
            }}>
              On est tous assis à<br />ne rien faire pendant<br />
              <span style={{ color: "#C8AA6E" }}>des heures</span>
            </h2>
            <p style={{ fontSize: "1rem", lineHeight: 1.75, color: "rgba(240,230,211,0.6)", marginBottom: 16 }}>
              Une session LoL moyenne dure 6h30. Entre les games, les lobbies, les replays et le stream,
              on reste assis des journées entières. Le corps paie la note.
            </p>
            <p style={{ fontSize: "1rem", lineHeight: 1.75, color: "rgba(240,230,211,0.6)" }}>
              La sédentarité chronique augmente les risques cardiovasculaires, réduit la concentration
              et dégrade les performances cognitives — exactement ce dont tu as besoin pour carry.
            </p>
          </div>
          <div style={{
            background: "rgba(200,170,110,0.04)",
            border: "1px solid rgba(200,170,110,0.14)",
            borderRadius: 16, padding: "40px 32px",
          }}>
            {[
              { label: "Temps assis moyen / jour (gamer PC)", value: "8-10h", color: "#ef5350" },
              { label: "Adultes insuffisamment actifs (OMS)", value: "1 sur 4", color: "#ef5350" },
              { label: "Décès liés à la sédentarité / an (OMS)", value: "3,2M", color: "#ef5350" },
              { label: "Risque maladies chroniques", value: "+20-30%", color: "#ef5350" },
            ].map((item) => (
              <div key={item.label} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "16px 0",
                borderBottom: "1px solid rgba(200,170,110,0.08)",
              }}>
                <span style={{ fontSize: "0.9rem", color: "rgba(240,230,211,0.55)" }}>{item.label}</span>
                <span style={{
                  fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
                  fontSize: "1.4rem", color: item.color,
                }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMMENT ÇA MARCHE */}
      <section style={{
        padding: "80px 24px",
        background: "rgba(11,196,227,0.02)",
        borderTop: "1px solid rgba(11,196,227,0.08)",
        borderBottom: "1px solid rgba(11,196,227,0.08)",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p style={{
            textAlign: "center", fontSize: "0.75rem", letterSpacing: "0.14em",
            textTransform: "uppercase", color: "#0bc4e3", marginBottom: 12,
          }}>
            Comment ça marche
          </p>
          <h2 style={{
            fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
            fontSize: "clamp(1.8rem, 3vw, 2.4rem)", textAlign: "center", marginBottom: 60,
          }}>
            3 étapes, c&apos;est tout
          </h2>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24,
          }}>
            {STEPS.map((step) => (
              <div key={step.num} style={{
                background: "rgba(4,8,16,0.6)",
                border: "1px solid rgba(200,170,110,0.14)",
                borderRadius: 16, padding: "36px 28px",
                position: "relative",
              }}>
                <div style={{
                  fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
                  fontSize: "3rem", color: "rgba(200,170,110,0.12)",
                  position: "absolute", top: 20, right: 24, lineHeight: 1,
                }}>
                  {step.num}
                </div>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: "rgba(200,170,110,0.1)",
                  border: "1px solid rgba(200,170,110,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 20,
                  fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
                  fontSize: "0.85rem", color: "#C8AA6E",
                }}>
                  {step.num}
                </div>
                <h3 style={{
                  fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
                  fontSize: "1.1rem", color: "#F0E6D3", marginBottom: 12,
                }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: "0.9rem", lineHeight: 1.7, color: "rgba(240,230,211,0.55)" }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BIENFAITS */}
      <section style={{ padding: "100px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <p style={{
          textAlign: "center", fontSize: "0.75rem", letterSpacing: "0.14em",
          textTransform: "uppercase", color: "#C8AA6E", marginBottom: 12,
        }}>
          Pourquoi s&apos;y mettre
        </p>
        <h2 style={{
          fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
          fontSize: "clamp(1.8rem, 3vw, 2.4rem)", textAlign: "center", marginBottom: 16,
        }}>
          L&apos;exercice améliore ton jeu
        </h2>
        <p style={{
          textAlign: "center", fontSize: "1rem", color: "rgba(240,230,211,0.5)",
          maxWidth: 520, margin: "0 auto 60px", lineHeight: 1.7,
        }}>
          Ce n&apos;est pas juste de la santé. C&apos;est un avantage compétitif.
        </p>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20,
        }}>
          {BENEFITS.map((b) => (
            <div key={b.title} style={{
              background: "rgba(200,170,110,0.04)",
              border: "1px solid rgba(200,170,110,0.12)",
              borderRadius: 14, padding: "28px 24px",
              transition: "border-color 0.2s",
            }}>
              <div style={{ fontSize: "1.6rem", marginBottom: 14 }}>{b.icon}</div>
              <h3 style={{
                fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
                fontSize: "1rem", color: "#C8AA6E", marginBottom: 10,
              }}>
                {b.title}
              </h3>
              <p style={{ fontSize: "0.875rem", lineHeight: 1.7, color: "rgba(240,230,211,0.55)" }}>
                {b.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section style={{
        padding: "80px 24px",
        background: "rgba(200,170,110,0.025)",
        borderTop: "1px solid rgba(200,170,110,0.1)",
        borderBottom: "1px solid rgba(200,170,110,0.1)",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p style={{
            textAlign: "center", fontSize: "0.75rem", letterSpacing: "0.14em",
            textTransform: "uppercase", color: "#C8AA6E", marginBottom: 12,
          }}>
            Fonctionnalités
          </p>
          <h2 style={{
            fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
            fontSize: "clamp(1.8rem, 3vw, 2.4rem)", textAlign: "center", marginBottom: 56,
          }}>
            Tout est automatique
          </h2>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16,
          }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{
                display: "flex", gap: 16, padding: "20px 20px",
                background: "rgba(4,8,16,0.5)",
                border: "1px solid rgba(200,170,110,0.1)",
                borderRadius: 12,
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: "#0bc4e3", marginTop: 6, flexShrink: 0,
                  boxShadow: "0 0 8px rgba(11,196,227,0.6)",
                }} />
                <div>
                  <div style={{
                    fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
                    fontSize: "0.9rem", color: "#F0E6D3", marginBottom: 6,
                  }}>
                    {f.title}
                  </div>
                  <div style={{ fontSize: "0.825rem", color: "rgba(240,230,211,0.5)", lineHeight: 1.6 }}>
                    {f.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{
        padding: "120px 24px", textAlign: "center",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(200,170,110,0.07) 0%, transparent 70%)",
        }} />
        <div style={{ position: "relative", maxWidth: 600, margin: "0 auto" }}>
          <h2 style={{
            fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
            fontSize: "clamp(2rem, 4vw, 3rem)", lineHeight: 1.15, marginBottom: 20,
          }}>
            Prêt à commencer ?
          </h2>
          <p style={{
            fontSize: "1rem", color: "rgba(240,230,211,0.55)", lineHeight: 1.7, marginBottom: 40,
          }}>
            Rejoins la bêta et transforme chaque défaite en séance de sport.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            {DOWNLOAD_URL && (
              <a
                href={DOWNLOAD_URL}
                style={{
                  padding: "14px 36px", borderRadius: 8, fontSize: "1rem",
                  background: "linear-gradient(135deg, #C8AA6E, #a8893e)",
                  color: "#040810", fontWeight: 700, textDecoration: "none",
                  letterSpacing: "0.05em", boxShadow: "0 4px 24px rgba(200,170,110,0.3)",
                }}
              >
                Télécharger l&apos;app
              </a>
            )}
            <Link
              href="/beta"
              style={{
                padding: "14px 36px", borderRadius: 8, fontSize: "1rem",
                border: "1px solid rgba(200,170,110,0.4)",
                background: "rgba(200,170,110,0.06)",
                color: "#C8AA6E", textDecoration: "none",
                letterSpacing: "0.05em",
              }}
            >
              Candidater à la bêta →
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{
        borderTop: "1px solid rgba(200,170,110,0.1)",
        padding: "32px 24px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: 16,
        maxWidth: 1100, margin: "0 auto",
        fontSize: "0.8rem", color: "rgba(240,230,211,0.3)",
      }}>
        <span style={{ fontFamily: "var(--font-heading)", color: "rgba(200,170,110,0.4)", letterSpacing: "0.1em" }}>
          ⚔ L·O·W
        </span>
        <div style={{ display: "flex", gap: 24 }}>
          <Link href="/cgu" style={{ color: "rgba(240,230,211,0.3)", textDecoration: "none" }}>CGU</Link>
          <Link href="/confidentialite" style={{ color: "rgba(240,230,211,0.3)", textDecoration: "none" }}>Confidentialité</Link>
          <Link href="/login" style={{ color: "rgba(240,230,211,0.3)", textDecoration: "none" }}>Se connecter</Link>
        </div>
        <span>League of Workout n&apos;est pas affilié à Riot Games.</span>
      </footer>

      <style>{`
        @media (max-width: 768px) {
          .landing-two-col {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
