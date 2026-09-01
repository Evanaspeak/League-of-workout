"use client";
import { Icone } from "@/components/Icone";
import { Lien } from "@/components/Lien";
import { LoginButtons } from "@/components/LoginButtons";
import { DesktopModeDetector } from "@/components/DesktopModeDetector";
import { Wordmark } from "@/components/Wordmark";
import { useT } from "@/lib/i18n/LocaleContext";
import { login as loginDict } from "@/lib/i18n/dictionaries/login";

export function LoginClient({
  betaFull,
  betaPending,
  betaRejected,
  transferred,
  transfertEchec,
  deleted,
  reconnexion,
  code,
}: {
  betaFull: boolean;
  betaPending: boolean;
  betaRejected: boolean;
  transferred?: string;
  /** Le transfert de session vers l'app desktop a échoué : "token" | "reseau". */
  transfertEchec?: string;
  deleted?: string;
  /**
   * L'application a demandé une connexion alors qu'une session était déjà
   * ouverte ici. On ne la lui envoie pas — elle n'a été choisie par personne —
   * et on invite à désigner explicitement le compte.
   */
  reconnexion?: boolean;
  /**
   * Le code du refus, tel que le serveur l'a nommé. Deux pannes très
   * différentes menaient ici avec exactement le même écran : impossible, en
   * lisant un signalement, de savoir laquelle on regardait.
   */
  code?: string;
}) {
  const t = useT(loginDict);

  const card: React.CSSProperties = {
    position: "relative",
    background: "var(--carbon)",
    border: "1px solid var(--line)",
    borderRadius: 16,
    padding: "2.5rem 2rem",
    width: "100%",
    textAlign: "center",
    overflow: "hidden",
  };

  // Liseré ember en haut de la carte — la signature de la marque
  const topSlash = (
    <span aria-hidden style={{
      position: "absolute", top: 0, left: 0, right: 0, height: 2,
      background: "linear-gradient(90deg, transparent 15%, var(--ember) 50%, transparent 85%)",
    }} />
  );

  // L'app desktop n'a pas reçu la session : le dire, plutôt que de laisser
  // croire à une réussite pendant que l'application reste déconnectée.
  if (transfertEchec) {
    return (
      <div style={{ minHeight: "76vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ ...card, maxWidth: 360 }}>
          {topSlash}
          <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "center" }}><Icone nom="croix" taille={30} couleur="var(--loss)" /></div>
          <p style={{
            fontFamily: "var(--font-heading, 'Chakra Petch', sans-serif)",
            fontWeight: 600,
            fontSize: "1.15rem",
            color: "var(--bone)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: "0.75rem",
          }}>
            {t.transfertEchecTitle}
          </p>
          <p style={{ fontSize: "0.84rem", color: "var(--muted)", lineHeight: 1.65 }}>
            {t.transfertEchecBody}<br />{t.transfertEchecAide}
          </p>
        </div>
      </div>
    );
  }

  if (transferred === "1") {
    return (
      <div style={{ minHeight: "76vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ ...card, maxWidth: 360 }}>
          {topSlash}
          <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "center" }}><Icone nom="coche" taille={30} couleur="var(--victory)" /></div>
          <p style={{
            fontFamily: "var(--font-heading, 'Chakra Petch', sans-serif)",
            fontWeight: 600,
            fontSize: "1.15rem",
            color: "var(--bone)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: "0.75rem",
          }}>
            {t.connexionReussieTitle}
          </p>
          <p style={{ fontSize: "0.84rem", color: "var(--muted)", lineHeight: 1.65 }}>
            {t.connexionReussieBody}<br />{t.connexionReussieClose}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "76vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <DesktopModeDetector />
      <div style={{ ...card, maxWidth: 400 }}>
        {topSlash}

        {deleted === "1" && (
          <div style={{
            padding: "0.7rem 0.9rem",
            marginBottom: "1.5rem",
            background: "var(--victory-soft)",
            border: "1px solid rgba(47,217,138,0.3)",
            borderRadius: 8,
            fontSize: "0.82rem",
            color: "var(--victory)",
          }}>
            {t.compteSupprime}
          </div>
        )}

        {reconnexion && (
          <div style={{
            padding: "0.7rem 0.9rem",
            marginBottom: "1.5rem",
            background: "rgba(255,180,84,0.08)",
            border: "1px solid rgba(255,180,84,0.3)",
            borderRadius: 8,
            fontSize: "0.82rem",
            color: "var(--amber)",
            lineHeight: 1.6,
          }}>
            {t.reconnexionDesktop}
            {code && (
              <span style={{ display: "block", marginTop: "0.45rem", opacity: 0.7, fontSize: "0.72rem", letterSpacing: "0.04em" }}>
                code : {code}
              </span>
            )}
          </div>
        )}

        <div style={{ marginBottom: "2rem" }}>
          {/* Le nom du produit EST le titre de cette page, et il n'était
              qu'un `div` : l'écran n'avait donc aucun titre de niveau un.
              Un lecteur d'écran ne peut pas sauter au contenu, et un moteur
              de recherche ne voit rien qui dise de quoi la page parle. Les
              marges sont reprises telles quelles pour que rien ne bouge. */}
          <h1 style={{
            display: "flex", justifyContent: "center",
            margin: "0 0 0.8rem", fontSize: "inherit", fontWeight: "inherit",
          }}>
            <Wordmark fontSize="1.35rem" />
          </h1>
          <p className="eyebrow" style={{ marginTop: "0.4rem" }}>
            {t.accesReserve}
          </p>
        </div>

        {betaPending ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{
              padding: "1rem",
              borderRadius: 10,
              background: "rgba(236,239,244,0.04)",
              border: "1px solid var(--line-strong)",
            }}>
              <p style={{ fontWeight: 600, color: "var(--bone)", marginBottom: "0.3rem" }}>{t.candidatureEnCours}</p>
              <p style={{ fontSize: "0.82rem", color: "var(--muted)", lineHeight: 1.6 }}>
                {t.candidatureEnCoursBody}
              </p>
            </div>
          </div>
        ) : betaRejected ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{
              padding: "1rem",
              borderRadius: 10,
              background: "rgba(255,90,71,0.08)",
              border: "1px solid rgba(255,90,71,0.28)",
            }}>
              <p className="loss-text" style={{ fontWeight: 600, marginBottom: "0.3rem" }}>{t.candidatureNonRetenue}</p>
              <p style={{ fontSize: "0.82rem", color: "var(--muted)", lineHeight: 1.6 }}>
                {t.candidatureNonRetenueBody}
              </p>
            </div>
          </div>
        ) : betaFull ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{
              padding: "1rem",
              borderRadius: 10,
              background: "rgba(255,90,71,0.08)",
              border: "1px solid rgba(255,90,71,0.28)",
            }}>
              <p className="loss-text" style={{ fontWeight: 600, marginBottom: "0.3rem" }}>{t.accesRefuse}</p>
              <p style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                {t.accesRefuseBody}
              </p>
            </div>
            <Lien href="/beta" className="lol-btn" style={{ display: "inline-block" }}>
              {t.candidaterBeta}
            </Lien>
          </div>
        ) : (
          <LoginButtons />
        )}

        <p style={{
          marginTop: "1.5rem",
          fontSize: "0.7rem",
          color: "var(--faint)",
          lineHeight: 1.7,
        }}>
          {t.mentionsAcceptation}{" "}
          <Lien href="/cgu" style={{ color: "var(--faint)" }}>{t.cgu}</Lien>
          {" "}{t.et}{" "}
          <Lien href="/confidentialite" style={{ color: "var(--faint)" }}>{t.politiqueConfidentialite}</Lien>.
        </p>
      </div>
    </div>
  );
}
