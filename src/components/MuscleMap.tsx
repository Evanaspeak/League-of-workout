"use client";
import { useState } from "react";

type Role = "Primaire" | "Secondaire" | "Gainage";
type View = "front" | "back";

const ROLE_COLORS: Record<Role, string> = {
  Primaire: "#C8AA6E",
  Secondaire: "#0bc4e3",
  Gainage: "#4caf50",
};

const ROLE_LABELS: Record<Role, string> = {
  Primaire: "Moteur principal",
  Secondaire: "Assistance",
  Gainage: "Stabilisation / gainage",
};

type Muscle = {
  id: string;
  name: string;
  region: string;
  role: Role;
  view: View;
  desc: string;
};

const MUSCLES: Muscle[] = [
  { id: "pec", name: "Pectoraux", region: "Poitrine", role: "Primaire", view: "front", desc: "Moteur principal de la poussée (grand pectoral)." },
  { id: "delt", name: "Deltoïdes antérieurs", region: "Épaules", role: "Primaire", view: "front", desc: "Stabilisent l'épaule et participent à la poussée." },
  { id: "serratus", name: "Grand dentelé", region: "Côtes / omoplates", role: "Secondaire", view: "front", desc: "Plaque les omoplates et protège l'articulation." },
  { id: "abs", name: "Sangle abdominale", region: "Tronc", role: "Gainage", view: "front", desc: "Grand droit, transverse et obliques maintiennent le corps rigide." },
  { id: "quads", name: "Quadriceps", region: "Cuisses", role: "Gainage", view: "front", desc: "Jambes gainées et tendues pour tenir la planche." },
  { id: "triceps", name: "Triceps", region: "Arrière du bras", role: "Primaire", view: "back", desc: "Étendent le coude à chaque remontée." },
  { id: "erectors", name: "Érecteurs du rachis", region: "Bas du dos", role: "Gainage", view: "back", desc: "Gardent la colonne alignée, sans creux lombaire." },
  { id: "glutes", name: "Fessiers", region: "Bassin", role: "Gainage", view: "back", desc: "Verrouillent le bassin dans l'axe du corps." },
];

const BY_ID = Object.fromEntries(MUSCLES.map((m) => [m.id, m]));

// Couleur du corps (silhouette) et trait.
const BODY_FILL = "#161d2b";
const BODY_STROKE = "rgba(200,170,110,0.18)";

// Helper : élément + sa copie miroir (symétrie autour de x=120).
function mirror(el: React.ReactNode) {
  return (
    <>
      {el}
      <g transform="translate(240,0) scale(-1,1)">{el}</g>
    </>
  );
}

// Formes des muscles (côté gauche, miroir auto pour le côté droit).
const SHAPES: Record<string, React.ReactNode> = {
  delt: mirror(<ellipse cx={82} cy={128} rx={14} ry={16} transform="rotate(8 82 128)" />),
  pec: mirror(<ellipse cx={105} cy={150} rx={17} ry={12} transform="rotate(-10 105 150)" />),
  serratus: mirror(
    <g>
      <ellipse cx={92} cy={177} rx={5} ry={3} transform="rotate(-28 92 177)" />
      <ellipse cx={95} cy={185} rx={5} ry={3} transform="rotate(-28 95 185)" />
      <ellipse cx={98} cy={193} rx={5} ry={3} transform="rotate(-28 98 193)" />
    </g>
  ),
  abs: <rect x={107} y={170} width={26} height={78} rx={11} />,
  quads: mirror(
    <path d="M101,330 C94,362 95,416 104,452 C108,457 117,456 119,448 C121,406 120,362 116,332 C111,325 105,325 101,330 Z" />
  ),
  triceps: mirror(
    <path d="M70,140 C62,166 62,202 68,234 C72,240 80,238 82,230 C84,202 84,168 80,146 C78,140 73,137 70,140 Z" />
  ),
  erectors: mirror(<rect x={109} y={196} width={8} height={64} rx={4} />),
  glutes: mirror(<ellipse cx={106} cy={300} rx={17} ry={18} />),
};

const FRONT_IDS = ["delt", "pec", "serratus", "abs", "quads"];
const BACK_IDS = ["triceps", "erectors", "glutes"];

// Silhouette commune (face / dos).
function Silhouette() {
  const armL = (
    <path d="M78,108 C60,138 55,190 60,242 C62,262 67,280 74,296 L86,292 C81,262 81,210 85,160 C87,140 89,124 93,110 Z" />
  );
  const legL = (
    <path d="M101,322 C93,365 93,432 101,472 C103,502 105,520 109,538 L121,538 C121,466 121,398 119,324 C113,318 106,318 101,322 Z" />
  );
  return (
    <g fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth={1}>
      <circle cx={120} cy={40} r={22} />
      <rect x={111} y={58} width={18} height={18} rx={5} />
      {/* torse */}
      <path d="M80,106 C76,150 86,210 98,252 C102,264 106,270 120,270 C134,270 138,264 142,252 C154,210 164,150 160,106 C148,94 132,90 120,90 C108,90 92,94 80,106 Z" />
      {/* bassin */}
      <path d="M98,256 C92,276 94,306 102,326 L118,326 C119,300 119,278 120,268 C121,278 121,300 122,326 L138,326 C146,306 148,276 142,256 C130,266 110,266 98,256 Z" />
      {mirror(armL)}
      {mirror(legL)}
    </g>
  );
}

function MuscleShape({
  m,
  active,
  setActive,
  children,
}: {
  m: Muscle;
  active: string | null;
  setActive: (id: string | null) => void;
  children: React.ReactNode;
}) {
  const color = ROLE_COLORS[m.role];
  const isActive = active === m.id;
  return (
    <g
      onMouseEnter={() => setActive(m.id)}
      onMouseLeave={() => setActive(null)}
      onClick={() => setActive(isActive ? null : m.id)}
      style={{ cursor: "pointer", transition: "fill-opacity .2s" }}
      fill={color}
      fillOpacity={isActive ? 1 : 0.6}
      stroke={isActive ? color : "transparent"}
      strokeWidth={isActive ? 2 : 0}
      filter={isActive ? "url(#muscle-glow)" : undefined}
    >
      {children}
    </g>
  );
}

function BodySVG({
  ids,
  active,
  setActive,
}: {
  ids: string[];
  active: string | null;
  setActive: (id: string | null) => void;
}) {
  return (
    <svg viewBox="0 0 240 560" style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <filter id="muscle-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <Silhouette />
      {ids.map((id) => (
        <MuscleShape key={id} m={BY_ID[id]} active={active} setActive={setActive}>
          {SHAPES[id]}
        </MuscleShape>
      ))}
    </svg>
  );
}

export default function MuscleMap() {
  const [view, setView] = useState<View>("front");
  const [active, setActive] = useState<string | null>(null);

  // Sélectionne un muscle depuis la liste : bascule la vue si besoin.
  function selectFromList(id: string | null) {
    setActive(id);
    if (id && BY_ID[id].view !== view) setView(BY_ID[id].view);
  }

  const activeMuscle = active ? BY_ID[active] : null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(220px, 320px) 1fr",
        gap: 40,
        alignItems: "start",
      }}
      className="muscle-map-grid"
    >
      {/* Colonne figure */}
      <div>
        {/* Toggle Face / Dos */}
        <div
          style={{
            display: "flex",
            gap: 4,
            background: "rgba(255,255,255,0.03)",
            borderRadius: 8,
            padding: 4,
            marginBottom: 18,
            maxWidth: 220,
            marginInline: "auto",
          }}
        >
          {(["front", "back"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                flex: 1,
                padding: "7px 0",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                fontSize: "0.78rem",
                letterSpacing: "0.06em",
                fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
                background: view === v ? "rgba(200,170,110,0.16)" : "transparent",
                color: view === v ? "#C8AA6E" : "rgba(240,230,211,0.4)",
                transition: "all .15s",
              }}
            >
              {v === "front" ? "FACE" : "DOS"}
            </button>
          ))}
        </div>

        {/* Carte qui se retourne en 3D */}
        <div style={{ perspective: 1200, maxWidth: 280, margin: "0 auto" }}>
          <div
            style={{
              position: "relative",
              transformStyle: "preserve-3d",
              transition: "transform .7s cubic-bezier(0.4,0.1,0.2,1)",
              transform: view === "back" ? "rotateY(180deg)" : "rotateY(0deg)",
            }}
          >
            <div style={{ backfaceVisibility: "hidden" }}>
              <BodySVG ids={FRONT_IDS} active={active} setActive={setActive} />
            </div>
            <div
              style={{
                position: "absolute",
                inset: 0,
                backfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
              }}
            >
              <BodySVG ids={BACK_IDS} active={active} setActive={setActive} />
            </div>
          </div>
        </div>

        {/* Détail du muscle actif */}
        <div
          style={{
            marginTop: 18,
            minHeight: 78,
            background: "rgba(4,8,16,0.5)",
            border: "1px solid rgba(200,170,110,0.12)",
            borderRadius: 12,
            padding: "14px 16px",
            textAlign: "center",
          }}
        >
          {activeMuscle ? (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 6 }}>
                <span
                  style={{
                    fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
                    fontSize: "0.95rem",
                    color: "#F0E6D3",
                  }}
                >
                  {activeMuscle.name}
                </span>
                <span
                  style={{
                    padding: "2px 9px",
                    borderRadius: 999,
                    fontSize: "0.64rem",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: ROLE_COLORS[activeMuscle.role],
                    border: `1px solid ${ROLE_COLORS[activeMuscle.role]}40`,
                    background: `${ROLE_COLORS[activeMuscle.role]}12`,
                  }}
                >
                  {activeMuscle.role}
                </span>
              </div>
              <p style={{ fontSize: "0.82rem", lineHeight: 1.55, color: "rgba(240,230,211,0.6)" }}>
                {activeMuscle.desc}
              </p>
            </>
          ) : (
            <p style={{ fontSize: "0.82rem", color: "rgba(240,230,211,0.4)", lineHeight: 1.6 }}>
              Survole un muscle sur le corps ou dans la liste pour le détailler.
            </p>
          )}
        </div>
      </div>

      {/* Colonne liste + légende */}
      <div>
        {/* Légende des rôles */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 18 }}>
          {(Object.keys(ROLE_COLORS) as Role[]).map((role) => (
            <div key={role} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: ROLE_COLORS[role],
                  boxShadow: `0 0 8px ${ROLE_COLORS[role]}66`,
                }}
              />
              <span style={{ fontSize: "0.78rem", color: "rgba(240,230,211,0.55)" }}>
                <strong style={{ color: ROLE_COLORS[role], fontWeight: 600 }}>{role}</strong> · {ROLE_LABELS[role]}
              </span>
            </div>
          ))}
        </div>

        {/* Liste des muscles */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {MUSCLES.map((m) => {
            const c = ROLE_COLORS[m.role];
            const isActive = active === m.id;
            return (
              <div
                key={m.id}
                onMouseEnter={() => selectFromList(m.id)}
                onMouseLeave={() => setActive(null)}
                onClick={() => selectFromList(isActive ? null : m.id)}
                style={{
                  background: isActive ? `${c}10` : "rgba(4,8,16,0.5)",
                  border: `1px solid ${isActive ? `${c}55` : "rgba(200,170,110,0.1)"}`,
                  borderLeft: `3px solid ${c}`,
                  borderRadius: 12,
                  padding: "14px 16px",
                  cursor: "pointer",
                  transition: "background .2s, border-color .2s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
                  <span style={{ fontFamily: "var(--font-heading, 'Russo One', sans-serif)", fontSize: "0.88rem", color: "#F0E6D3" }}>
                    {m.name}
                  </span>
                  <span
                    style={{
                      flexShrink: 0,
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontSize: "0.62rem",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: c,
                      border: `1px solid ${c}40`,
                      background: `${c}12`,
                    }}
                  >
                    {m.role}
                  </span>
                </div>
                <div style={{ fontSize: "0.7rem", color: "rgba(200,170,110,0.45)", marginBottom: 7, letterSpacing: "0.03em" }}>
                  {m.region} · {m.view === "front" ? "face" : "dos"}
                </div>
                <p style={{ fontSize: "0.8rem", lineHeight: 1.55, color: "rgba(240,230,211,0.55)" }}>{m.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
